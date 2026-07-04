import { getServerSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const sb = getServerSupabase();

  // Provider status
  const providers = [
    { name: 'Groq', key: 'GROQ_API_KEY', model: 'llama-4-scout-17b', configured: !!process.env.GROQ_API_KEY },
    { name: 'Cerebras', key: 'CEREBRAS_API_KEY', model: 'llama-3.3-70b', configured: !!process.env.CEREBRAS_API_KEY },
    { name: 'Gemini', key: 'GEMINI_API_KEY', model: 'gemini-2.5-flash', configured: !!process.env.GEMINI_API_KEY },
    { name: 'OpenRouter', key: 'OPENROUTER_API_KEY', model: 'llama-3.2-11b-vision', configured: !!process.env.OPENROUTER_API_KEY },
  ];

  // Recent provider usage
  const { data: recentRuns } = await sb
    .from('analysis_runs')
    .select('provider_used, fallback_used, status')
    .order('created_at', { ascending: false })
    .limit(20);

  const providerCounts = (recentRuns ?? []).reduce<Record<string, number>>((acc, r) => {
    const p = r.provider_used ?? 'unknown';
    acc[p] = (acc[p] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      {/* LLM Providers */}
      <div className="bg-surface-raised border border-surface-border rounded-lg p-5">
        <h2 className="text-sm font-medium text-gray-400 mb-4">LLM Providers (cascade order)</h2>
        <div className="space-y-3">
          {providers.map((p, i) => (
            <div key={p.name} className="flex items-center justify-between py-2 px-3 bg-surface/50 rounded">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-600 font-mono w-4">{i + 1}.</span>
                <div className={`w-2 h-2 rounded-full ${p.configured ? 'bg-accent-green' : 'bg-gray-600'}`} />
                <span className="text-gray-300 font-medium">{p.name}</span>
                <span className="text-xs text-gray-500">{p.model}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">Used {providerCounts[p.name.toLowerCase()] ?? 0}x (last 20)</span>
                <span className={`text-xs px-2 py-0.5 rounded ${p.configured ? 'bg-accent-green/20 text-accent-green' : 'bg-gray-700 text-gray-500'}`}>
                  {p.configured ? 'Configured' : 'Not set'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Config */}
      <div className="bg-surface-raised border border-surface-border rounded-lg p-5">
        <h2 className="text-sm font-medium text-gray-400 mb-4">Trading Config</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <ConfigRow label="Score threshold" value={process.env.ANALYSIS_SCORE_THRESHOLD ?? '8'} />
          <ConfigRow label="Max trades/day" value={process.env.MAX_TRADES_PER_DAY ?? '2'} />
          <ConfigRow label="Trade cutoff" value="1:45 PM IST" />
          <ConfigRow label="Analysis interval" value="Every 2 minutes" />
          <ConfigRow label="Telegram chat ID" value={process.env.TELEGRAM_CHAT_ID ?? 'Not set'} />
          <ConfigRow label="Kite user" value={process.env.KITE_USER_ID ?? 'Not set'} />
        </div>
      </div>

      {/* External services */}
      <div className="bg-surface-raised border border-surface-border rounded-lg p-5">
        <h2 className="text-sm font-medium text-gray-400 mb-4">Setup Checklist</h2>
        <div className="space-y-2 text-sm">
          <CheckItem label="Supabase connected" ok={!!process.env.NEXT_PUBLIC_SUPABASE_URL} />
          <CheckItem label="Telegram bot token" ok={!!process.env.TELEGRAM_BOT_TOKEN} />
          <CheckItem label="Cron secret" ok={!!process.env.CRON_SECRET} />
          <CheckItem label="At least 1 LLM provider" ok={providers.some(p => p.configured)} />
          <CheckItem label="cron-job.org configured" ok hint="Manual check — visit cron-job.org" />
        </div>
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 px-2 bg-surface/50 rounded">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300 font-mono">{value}</span>
    </div>
  );
}

function CheckItem({ label, ok, hint }: { label: string; ok: boolean; hint?: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={ok ? 'text-accent-green' : 'text-accent-red'}>{ok ? '✓' : '✗'}</span>
      <span className="text-gray-300">{label}</span>
      {hint && <span className="text-xs text-gray-600">({hint})</span>}
    </div>
  );
}
