import { AnalysisResult, LLMProvider, MarketData } from '@/lib/types';
import { buildSystemPrompt, buildUserMessage, buildTextOnlyUserMessage } from '@/lib/llm/prompt';
import { log } from '@/lib/logging/logger';
import { z } from 'zod';

// ── Provider definitions ───────────────────────────────────────
const PROVIDERS: LLMProvider[] = [
  {
    name: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    supportsVision: true,
    apiKeyEnvVar: 'GROQ_API_KEY',
    maxTimeoutMs: 45000,
  },
  {
    name: 'cerebras',
    baseUrl: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'llama-3.3-70b',
    supportsVision: false,
    apiKeyEnvVar: 'CEREBRAS_API_KEY',
    maxTimeoutMs: 45000,
  },
  {
    name: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.5-flash',
    supportsVision: true,
    apiKeyEnvVar: 'GEMINI_API_KEY',
    maxTimeoutMs: 50000,
  },
  {
    name: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.2-11b-vision-instruct:free',
    supportsVision: true,
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    maxTimeoutMs: 50000,
  },
];

// ── Zod schema for response validation ─────────────────────────
const AnalysisSchema = z.object({
  timestamp_ist: z.string(),
  extracted_data: z.object({
    nifty_spot: z.number(),
    vix: z.number(),
    pcr: z.number(),
    max_pain: z.number(),
    atm_iv: z.number(),
    ivp: z.number(),
    nifty_day_change_pct: z.number(),
    bank_nifty_day_change_pct: z.number(),
    advancing: z.number(),
    declining: z.number(),
    fii_net_cr: z.number(),
    dii_net_cr: z.number(),
    dow_change_pct: z.number(),
    sp500_change_pct: z.number(),
    expiry_label: z.string(),
    expiry_ddmmmyy: z.string(),
    atm_strike: z.number(),
    atm_ce_ltp: z.number(),
    atm_pe_ltp: z.number(),
    chart_pattern: z.string(),
  }),
  scores: z.object({
    f1: z.number(), f2: z.number(), f3: z.number(), f4: z.number(),
    f5: z.number(), f6: z.number(), f7: z.number(), f8: z.number(),
    f9: z.number(), f10: z.number(), f11: z.number(), total: z.number(),
  }),
  scorecard: z.array(z.string()),
  verdict: z.enum(['STAY OUT', 'ENTRY CE', 'ENTRY PE']),
  auto_trade: z.boolean(),
  option_symbol: z.string(),
  option_type: z.string(),
  strike: z.number(),
  expiry: z.string(),
  entry_price: z.number(),
  sl_price: z.number(),
  target_price: z.number(),
  rationale: z.string(),
});

// ── Call a single provider ─────────────────────────────────────
async function callProvider(
  provider: LLMProvider,
  screenshotBase64: string | null,
  marketData: MarketData
): Promise<{ raw: string; parsed: AnalysisResult; provider: string }> {
  const apiKey = process.env[provider.apiKeyEnvVar];
  if (!apiKey) throw new Error(`${provider.name}: API key not configured (${provider.apiKeyEnvVar})`);

  const systemPrompt = buildSystemPrompt();
  const hasScreenshot = screenshotBase64 && provider.supportsVision;

  type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
  const userContent: ContentPart[] = [];

  if (hasScreenshot) {
    userContent.push({ type: 'text', text: buildUserMessage(marketData) });
    userContent.push({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,' + screenshotBase64 },
    });
  } else {
    userContent.push({ type: 'text', text: buildTextOnlyUserMessage(marketData) });
  }

  const body = JSON.stringify({
    model: provider.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    max_tokens: 2000,
    temperature: 0.1,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  if (provider.name === 'openrouter') {
    headers['HTTP-Referer'] = 'https://nifty-node-hybrid-app.vercel.app';
    headers['X-Title'] = 'Nifty Auto-Trader';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), provider.maxTimeoutMs);

  try {
    const res = await fetch(provider.baseUrl, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const err = new Error(`${provider.name} HTTP ${res.status}: ${errText.slice(0, 200)}`);
      (err as { status?: number }).status = res.status;
      throw err;
    }

    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? '';

    // Parse — strip markdown fences if present
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);
    const validated = validateAndFix(parsed);

    return { raw, parsed: validated, provider: provider.name };
  } finally {
    clearTimeout(timer);
  }
}

// ── Validate and auto-fix common LLM response issues ───────────
function validateAndFix(data: unknown): AnalysisResult {
  const result = AnalysisSchema.parse(data);

  // Auto-fix: recalculate total if it doesn't match sum
  const sum = result.scores.f1 + result.scores.f2 + result.scores.f3 + result.scores.f4 +
    result.scores.f5 + result.scores.f6 + result.scores.f7 + result.scores.f8 +
    result.scores.f9 + result.scores.f10 + result.scores.f11;
  if (result.scores.total !== sum) {
    result.scores.total = sum;
  }

  // Warn if scorecard length is wrong (don't fail — still usable)
  if (result.scorecard.length !== 11) {
    console.warn(`Scorecard has ${result.scorecard.length} entries instead of 11`);
  }

  return result;
}

// ── Main cascade ───────────────────────────────────────────────
export async function analyseWithCascade(
  screenshotBase64: string | null,
  marketData: MarketData
): Promise<{ result: AnalysisResult; raw: string; provider: string; fallbackUsed: boolean }> {
  const errors: Array<{ provider: string; error: string; durationMs: number }> = [];

  for (let i = 0; i < PROVIDERS.length; i++) {
    const provider = PROVIDERS[i];
    const start = Date.now();

    try {
      const { raw, parsed, provider: providerName } = await callProvider(
        provider, screenshotBase64, marketData
      );
      const durationMs = Date.now() - start;

      await log('INFO', 'llm', 'call_provider', {
        duration_ms: durationMs,
        success: true,
        metadata: {
          provider: providerName,
          model: provider.model,
          fallback_index: i,
          vision_used: !!(screenshotBase64 && provider.supportsVision),
        },
        output_summary: {
          score: parsed.scores.total,
          verdict: parsed.verdict,
          scorecard_count: parsed.scorecard.length,
        },
      });

      return {
        result: parsed,
        raw,
        provider: providerName,
        fallbackUsed: i > 0,
      };
    } catch (e) {
      const durationMs = Date.now() - start;
      const errMsg = e instanceof Error ? e.message : String(e);
      const status = (e as { status?: number }).status;

      errors.push({ provider: provider.name, error: errMsg, durationMs });

      await log('WARN', 'llm', 'provider_failed', {
        duration_ms: durationMs,
        success: false,
        error: errMsg,
        metadata: { provider: provider.name, model: provider.model, status, fallback_index: i },
      });

      // On rate limit, brief pause before next provider
      if (status === 429) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  // All providers failed
  const errorSummary = errors.map(e => `${e.provider}: ${e.error} (${e.durationMs}ms)`).join(' | ');
  await log('ERROR', 'llm', 'all_providers_failed', {
    success: false,
    error: errorSummary,
    metadata: { errors },
  });

  throw new Error('All LLM providers failed: ' + errorSummary);
}
