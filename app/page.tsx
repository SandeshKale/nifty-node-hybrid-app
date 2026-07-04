import { getServerSupabase } from '@/lib/supabase';
import { AnalysisRun } from '@/lib/types';

const SCORE_COLORS: Record<string, string> = {
  'STAY OUT': 'text-gray-400',
  'ENTRY CE': 'text-accent-green',
  'ENTRY PE': 'text-accent-red',
};

async function getLatestRun(): Promise<AnalysisRun | null> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from('analysis_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data as AnalysisRun | null;
}

async function getScreenshotUrl(): Promise<string | null> {
  const sb = getServerSupabase();
  const { data } = await sb
    .from('screenshots')
    .select('storage_path')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (!data) return null;
  const { data: urlData } = sb.storage.from('screenshots').getPublicUrl(data.storage_path);
  return urlData?.publicUrl ?? null;
}

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [run, screenshotUrl] = await Promise.all([getLatestRun(), getScreenshotUrl()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatusCard
          label="Last Analysis"
          value={run?.ist_time ? `${run.ist_time} IST` : 'Never'}
          sub={run?.status === 'failed' ? 'Failed' : run?.provider_used ?? ''}
          color={run?.status === 'failed' ? 'text-accent-red' : 'text-accent-green'}
        />
        <StatusCard
          label="Score"
          value={run?.score !== null && run?.score !== undefined ? `${run.score >= 0 ? '+' : ''}${run.score}` : '--'}
          sub="out of ±12"
        />
        <StatusCard
          label="Verdict"
          value={run?.verdict ?? '--'}
          color={SCORE_COLORS[run?.verdict ?? ''] ?? 'text-gray-400'}
        />
        <StatusCard
          label="Provider"
          value={run?.provider_used ?? '--'}
          sub={run?.fallback_used ? 'Fallback used' : ''}
          color={run?.fallback_used ? 'text-accent-amber' : 'text-gray-300'}
        />
      </div>

      {/* Scorecard */}
      {run?.scorecard && Array.isArray(run.scorecard) && (
        <div className="bg-surface-raised border border-surface-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-gray-400 mb-3">Scorecard</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {(run.scorecard as string[]).map((line, i) => {
              const score = parseScoreLine(line);
              return (
                <div key={i} className="text-sm font-mono flex justify-between px-2 py-1 rounded bg-surface/50">
                  <span className="text-gray-300">{line}</span>
                  <span className={score > 0 ? 'text-accent-green' : score < 0 ? 'text-accent-red' : 'text-gray-500'}>
                    {score > 0 ? '+' : ''}{score}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Screenshot */}
      {screenshotUrl && (
        <div className="bg-surface-raised border border-surface-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-gray-400 mb-3">Latest Kite Screenshot</h2>
          <img
            src={screenshotUrl}
            alt="Kite terminal"
            className="w-full rounded border border-surface-border"
          />
        </div>
      )}

      {/* Duration + metadata */}
      {run && (
        <div className="text-xs text-gray-500 space-x-4">
          <span>Duration: {run.duration_ms}ms</span>
          <span>Run: {run.id?.slice(0, 8)}</span>
          <span>Status: {run.status}</span>
          {run.error && <span className="text-accent-red">Error: {run.error}</span>}
        </div>
      )}
    </div>
  );
}

function StatusCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-surface-raised border border-surface-border rounded-lg p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-semibold ${color ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function parseScoreLine(line: string): number {
  const match = line.match(/:\s*([+-]?\d)/);
  return match ? parseInt(match[1]) : 0;
}
