import { getServerSupabase } from '@/lib/supabase';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

let currentRunId: string | null = null;

export function setRunId(runId: string): void {
  currentRunId = runId;
}

export function getRunId(): string | null {
  return currentRunId;
}

export async function log(
  level: LogLevel,
  component: string,
  action: string,
  details: {
    duration_ms?: number;
    success?: boolean;
    input_summary?: Record<string, unknown>;
    output_summary?: Record<string, unknown>;
    error?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const entry = {
    run_id: currentRunId,
    level,
    component,
    action,
    duration_ms: details.duration_ms ?? null,
    success: details.success ?? null,
    input_summary: details.input_summary ?? null,
    output_summary: details.output_summary ?? null,
    error: details.error ?? null,
    metadata: details.metadata ?? null,
  };

  // Always print to console for Vercel runtime logs
  const prefix = `[${level}] ${component}.${action}`;
  const suffix = details.duration_ms ? ` (${details.duration_ms}ms)` : '';
  const errSuffix = details.error ? ` — ${details.error}` : '';
  console.log(`${prefix}${suffix}${errSuffix}`);

  // Write to Supabase (non-blocking — don't await in hot path if not critical)
  try {
    const sb = getServerSupabase();
    await sb.from('analysis_logs').insert(entry);
  } catch (e) {
    console.error('Failed to write log to Supabase:', e);
  }
}

export async function createRun(istTime: string): Promise<string> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('analysis_runs')
    .insert({ ist_time: istTime, status: 'running' })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('Failed to create analysis run: ' + (error?.message ?? 'no data'));
  }

  currentRunId = data.id;
  return data.id;
}

export async function completeRun(
  runId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const sb = getServerSupabase();
  await sb.from('analysis_runs').update({ ...updates, status: 'completed' }).eq('id', runId);
}

export async function failRun(runId: string, error: string): Promise<void> {
  const sb = getServerSupabase();
  await sb.from('analysis_runs').update({ error, status: 'failed' }).eq('id', runId);
}
