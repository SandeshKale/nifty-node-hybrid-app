import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const sb = getServerSupabase();
  const { data: runs } = await sb
    .from('analysis_runs')
    .select('id, created_at, ist_time, score, verdict, provider_used, fallback_used, duration_ms, status, error')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Analysis History</h1>

      <div className="bg-surface-raised border border-surface-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-surface-border">
            <tr className="text-left text-xs text-gray-500">
              <th className="px-4 py-3">Time (IST)</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Verdict</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(runs ?? []).map(run => (
              <tr key={run.id} className="border-b border-surface-border/50 hover:bg-surface/50">
                <td className="px-4 py-2.5 text-gray-300 font-mono">{run.ist_time}</td>
                <td className="px-4 py-2.5">
                  <span className={
                    (run.score ?? 0) > 0 ? 'text-accent-green' :
                    (run.score ?? 0) < 0 ? 'text-accent-red' :
                    'text-gray-400'
                  }>
                    {run.score !== null ? `${run.score >= 0 ? '+' : ''}${run.score}` : '--'}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    run.verdict === 'ENTRY CE' ? 'bg-accent-green/20 text-accent-green' :
                    run.verdict === 'ENTRY PE' ? 'bg-accent-red/20 text-accent-red' :
                    'bg-gray-700/50 text-gray-400'
                  }`}>
                    {run.verdict ?? run.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-400">
                  {run.provider_used ?? '--'}
                  {run.fallback_used && <span className="text-accent-amber ml-1">(fb)</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-500 font-mono">
                  {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '--'}
                </td>
                <td className="px-4 py-2.5">
                  <span className={run.status === 'completed' ? 'text-accent-green' : run.status === 'failed' ? 'text-accent-red' : 'text-accent-amber'}>
                    {run.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!runs || runs.length === 0) && (
          <div className="text-center text-gray-500 py-8">No analysis runs yet. Send /analyse to start.</div>
        )}
      </div>
    </div>
  );
}
