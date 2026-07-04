import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase';
import { getTradeState } from '@/lib/analysis/state';
import { getISTString, isMarketHours } from '@/lib/time';

export async function GET(): Promise<NextResponse> {
  const sb = getServerSupabase();

  // Screenshot age
  const { data: latestSS } = await sb.from('screenshots').select('created_at, size_bytes').order('created_at', { ascending: false }).limit(1).single();
  const screenshotAge = latestSS ? Math.round((Date.now() - new Date(latestSS.created_at).getTime()) / 60000) : null;

  // Last analysis
  const { data: lastRun } = await sb.from('analysis_runs').select('*').order('created_at', { ascending: false }).limit(1).single();

  // Recent errors
  const { data: recentErrors } = await sb.from('analysis_logs').select('action, error, created_at').eq('level', 'ERROR').order('created_at', { ascending: false }).limit(5);

  // Trade state
  const state = await getTradeState();

  // Provider health (check which keys are configured)
  const providers = {
    groq: !!process.env.GROQ_API_KEY,
    cerebras: !!process.env.CEREBRAS_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
  };

  return NextResponse.json({
    ist_time: getISTString(),
    is_market_hours: isMarketHours(),
    screenshot: {
      age_minutes: screenshotAge,
      size_bytes: latestSS?.size_bytes ?? null,
      status: screenshotAge === null ? 'missing' : screenshotAge < 5 ? 'fresh' : screenshotAge < 15 ? 'stale' : 'expired',
    },
    last_analysis: lastRun ? {
      time: lastRun.ist_time,
      score: lastRun.score,
      verdict: lastRun.verdict,
      provider: lastRun.provider_used,
      status: lastRun.status,
      duration_ms: lastRun.duration_ms,
    } : null,
    trade_state: state,
    providers,
    recent_errors: recentErrors ?? [],
  });
}
