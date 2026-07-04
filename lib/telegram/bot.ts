import { getServerSupabase } from '@/lib/supabase';
import { log } from '@/lib/logging/logger';

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN ?? '';
const CHAT_ID = () => process.env.TELEGRAM_CHAT_ID ?? '380433720';

// ── Telegram API helper ─────────────────────────────────────
async function telegramAPI(method: string, body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = BOT_TOKEN();
  if (!token) return { ok: false, description: 'No bot token' };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    return await res.json();
  } catch {
    return { ok: false, description: 'Network error' };
  }
}

export async function sendMessage(text: string, chatId?: string): Promise<void> {
  const target = chatId ?? CHAT_ID();
  // Telegram message limit is 4096 chars
  const truncated = text.length > 4000 ? text.slice(0, 3997) + '...' : text;
  await telegramAPI('sendMessage', { chat_id: target, text: truncated });
}

export async function sendPhoto(imageBuffer: Buffer, chatId?: string): Promise<void> {
  const target = chatId ?? CHAT_ID();
  const token = BOT_TOKEN();
  if (!token) return;

  const boundary = '----TelegramBoundary' + Date.now().toString(16);
  const parts: Buffer[] = [];
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${target}\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="kite.png"\r\nContent-Type: image/png\r\n\r\n`));
  parts.push(imageBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  const body = Buffer.concat(parts);

  await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
}

// ── Polling ─────────────────────────────────────────────────
interface TelegramUpdate {
  update_id: number;
  message?: {
    text?: string;
    chat?: { id: number };
  };
}

interface ParsedCommand {
  command: string;
  args: string;
  chatId: string;
}

export async function pollUpdates(): Promise<ParsedCommand[]> {
  const sb = getServerSupabase();

  // Get current offset
  const { data: state } = await sb.from('tg_state').select('poll_offset').eq('id', 'current').single();
  const offset = state?.poll_offset ?? 0;

  const result = await telegramAPI('getUpdates', {
    offset,
    limit: 10,
    timeout: 0,
  }) as { ok: boolean; result?: TelegramUpdate[] };

  if (!result.ok || !result.result || result.result.length === 0) return [];

  const expectedChatId = CHAT_ID();
  const commands: ParsedCommand[] = [];
  let maxUpdateId = offset;

  for (const update of result.result) {
    if (update.update_id >= maxUpdateId) maxUpdateId = update.update_id;

    const text = (update.message?.text ?? '').trim();
    const chatId = String(update.message?.chat?.id ?? '');
    if (chatId !== expectedChatId) continue;

    if (text.startsWith('/analyse') || text.startsWith('/analyze')) {
      commands.push({ command: 'analyse', args: '', chatId });
    } else if (text.startsWith('/status')) {
      commands.push({ command: 'status', args: '', chatId });
    } else if (text.startsWith('/login')) {
      commands.push({ command: 'login', args: '', chatId });
    } else if (text.startsWith('/token ')) {
      commands.push({ command: 'token', args: text.slice(7).trim(), chatId });
    } else if (text.startsWith('/history')) {
      commands.push({ command: 'history', args: '', chatId });
    } else if (text.startsWith('/help')) {
      commands.push({ command: 'help', args: '', chatId });
    }
    // Ignore non-command messages (e.g. TOTP codes)
  }

  // Update offset
  await sb.from('tg_state').update({ poll_offset: maxUpdateId + 1, updated_at: new Date().toISOString() }).eq('id', 'current');

  if (commands.length > 0) {
    await log('INFO', 'telegram', 'poll_updates', {
      success: true,
      output_summary: { commands_found: commands.length, commands: commands.map(c => c.command) },
    });
  }

  return commands;
}

export function formatAnalysisMessage(analysis: {
  timestamp_ist: string;
  scores: { total: number };
  scorecard: string[];
  verdict: string;
  option_symbol?: string;
  entry_price?: number;
  sl_price?: number;
  target_price?: number;
}): string {
  const score = analysis.scores.total;
  const sp = score >= 0 ? '+' : '';
  const sc = analysis.scorecard.join('\n');

  if (analysis.verdict === 'STAY OUT') {
    return [
      `\ud83d\udcca NIFTY \u2014 ${analysis.timestamp_ist} IST`,
      '',
      `SCORE: ${sp}${score}/\u00b112`,
      '',
      sc,
      '',
      `Verdict: ${analysis.verdict}`,
    ].join('\n');
  }

  const icon = analysis.verdict === 'ENTRY CE' ? '\ud83d\udfe2' : '\ud83d\udd34';
  return [
    `\ud83c\udfaf NIFTY \u2014 ${analysis.timestamp_ist} IST`,
    '',
    `SCORE: ${sp}${score}/\u00b112`,
    '',
    sc,
    '',
    `${icon} ${analysis.verdict}`,
    `Option: ${analysis.option_symbol}`,
    `Entry: Rs${analysis.entry_price} | SL: Rs${analysis.sl_price} | TP: Rs${analysis.target_price}`,
  ].join('\n');
}
