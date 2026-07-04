import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketData } from '@/lib/market-data';
import { analyseWithCascade } from '@/lib/llm/provider-cascade';
import { getLatestScreenshot } from '@/lib/screenshot/supabase-storage';
import { sendMessage, sendPhoto, formatAnalysisMessage } from '@/lib/telegram/bot';
import { getTradeState } from '@/lib/analysis/state';
import { log, createRun, completeRun, failRun, setRunId } from '@/lib/logging/logger';
import { getISTString, isMarketHours, isWeekday, canTrade as checkCanTrade } from '@/lib/time';
import { getServerSupabase } from '@/lib/supabase';

export const maxDuration = 60;

function validateCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // No secret configured = allow (dev mode)
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleAnalysis(req, 'cron');
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleAnalysis(req, 'manual');
}

async function handleAnalysis(req: NextRequest, source: string): Promise<NextResponse> {
  // Auth check for cron
  if (source === 'cron' && !validateCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const istTime = getISTString();
  const pipelineStart = Date.now();

  // Market hours check (skip for manual/telegram triggers)
  if (source === 'cron' && !isMarketHours()) {
    return NextResponse.json({ skipped: true, reason: 'Outside market hours', ist: istTime });
  }

  // Create run record
  let runId: string;
  try {
    runId = await createRun(istTime);
    setRunId(runId);
  } catch (e) {
    console.error('Failed to create run:', e);
    return NextResponse.json({ error: 'Failed to create run' }, { status: 500 });
  }

  // Lock check — prevent concurrent analyses
  const sb = getServerSupabase();
  const twoMinutesAgo = new Date(Date.now() - 90000).toISOString();
  const { data: recentRun } = await sb
    .from('analysis_runs')
    .select('id')
    .eq('status', 'running')
    .gt('created_at', twoMinutesAgo)
    .neq('id', runId)
    .limit(1)
    .single();

  if (recentRun) {
    await failRun(runId, 'Another analysis is already running');
    return NextResponse.json({ skipped: true, reason: 'Already running' });
  }

  try {
    // Step 1: Parallel fetch — screenshot + market data
    await log('INFO', 'pipeline', 'start', {
      metadata: { source, ist_time: istTime, is_market_hours: isMarketHours(), is_weekday: isWeekday() },
    });

    const [screenshot, marketData] = await Promise.all([
      getLatestScreenshot(),
      fetchMarketData(),
    ]);

    // Warn if screenshot is stale
    if (screenshot.ageMinutes > 5) {
      await log('WARN', 'screenshot', 'stale', {
        metadata: { age_minutes: screenshot.ageMinutes },
      });
    }

    // If screenshot is too old (>15 min), skip vision — use text-only
    const screenshotBase64 = screenshot.ageMinutes <= 15 ? screenshot.base64 : null;
    if (!screenshotBase64 && screenshot.base64) {
      await log('WARN', 'screenshot', 'too_old_for_vision', {
        metadata: { age_minutes: screenshot.ageMinutes },
      });
    }

    // Step 2: LLM analysis with cascade
    const { result: analysis, raw, provider, fallbackUsed } = await analyseWithCascade(
      screenshotBase64, marketData
    );

    // Step 3: Check trade state
    const state = await getTradeState();
    const tradingAllowed = checkCanTrade();
    let skipReason: string | null = null;

    if (analysis.verdict === 'STAY OUT') {
      skipReason = 'STAY OUT signal';
    } else if (!tradingAllowed) {
      skipReason = 'After 1:45 PM IST cutoff';
    } else if (state.trades_today >= 2) {
      skipReason = 'Daily limit (2/2)';
    }

    // Step 4: Complete run record
    const durationMs = Date.now() - pipelineStart;
    await completeRun(runId, {
      score: analysis.scores.total,
      verdict: analysis.verdict,
      scorecard: analysis.scorecard,
      extracted_data: analysis.extracted_data,
      scores: analysis.scores,
      raw_llm_response: raw,
      provider_used: provider,
      fallback_used: fallbackUsed,
      duration_ms: durationMs,
      screenshot_url: screenshot.url,
      market_data: marketData,
    });

    // Step 5: Send Telegram message
    const message = formatAnalysisMessage(analysis);
    const prefix = !isMarketHours()
      ? `\u26a0\ufe0f Outside market hours (${istTime} IST) \u2014 running for testing...\n\n`
      : '';
    await sendMessage(prefix + message);

    // Send screenshot image if available
    if (screenshot.base64) {
      try {
        await sendPhoto(Buffer.from(screenshot.base64, 'base64'));
      } catch {
        await log('WARN', 'telegram', 'send_photo_failed', { success: false });
      }
    }

    await log('INFO', 'pipeline', 'complete', {
      duration_ms: durationMs,
      success: true,
      output_summary: {
        score: analysis.scores.total,
        verdict: analysis.verdict,
        provider,
        fallback_used: fallbackUsed,
        skip_reason: skipReason,
        factors_with_data: analysis.scorecard.filter(s => !s.includes('no data')).length,
      },
    });

    return NextResponse.json({
      success: true,
      run_id: runId,
      score: analysis.scores.total,
      verdict: analysis.verdict,
      provider,
      duration_ms: durationMs,
    });

  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const durationMs = Date.now() - pipelineStart;

    await failRun(runId, errMsg);
    await log('ERROR', 'pipeline', 'failed', {
      duration_ms: durationMs,
      success: false,
      error: errMsg,
    });

    // Alert via Telegram
    await sendMessage(`\u26a0\ufe0f ERROR: ${errMsg.slice(0, 300)}`);

    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
