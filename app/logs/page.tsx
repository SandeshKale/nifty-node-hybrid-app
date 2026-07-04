'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

interface LogRow {
  id: string;
  run_id: string | null;
  created_at: string;
  level: string;
  component: string;
  action: string;
  duration_ms: number | null;
  success: boolean | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
}

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: 'text-gray-500',
  INFO: 'text-accent-blue',
  WARN: 'text-accent-amber',
  ERROR: 'text-accent-red',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const sb = createClient(url, key);

    async function fetchLogs() {
      let query = sb
        .from('analysis_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filter !== 'ALL') {
        query = query.eq('level', filter);
      }

      const { data } = await query;
      setLogs(data ?? []);
    }

    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  function copyForClaude() {
    // Group logs by run_id, format for Claude
    const grouped = new Map<string, LogRow[]>();
    for (const l of logs.slice(0, 100)) {
      const key = l.run_id ?? 'no-run';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(l);
    }

    const lines: string[] = ['## Nifty Auto-Trader v14 — Recent Logs', ''];
    for (const [runId, entries] of grouped) {
      lines.push(`### Run ${runId.slice(0, 8)} — ${entries[0]?.created_at ?? ''}`);
      for (const e of entries) {
        const dur = e.duration_ms ? ` (${e.duration_ms}ms)` : '';
        const err = e.error ? ` — ${e.error}` : '';
        lines.push(`[${e.level}] ${e.component}.${e.action}${dur}${err}`);
      }
      lines.push('');
    }

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Logs</h1>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-surface-raised border border-surface-border rounded px-3 py-1.5 text-sm text-gray-300"
          >
            <option value="ALL">All levels</option>
            <option value="ERROR">Errors only</option>
            <option value="WARN">Warnings</option>
            <option value="INFO">Info</option>
            <option value="DEBUG">Debug</option>
          </select>
          <button
            onClick={copyForClaude}
            className="bg-accent-blue/20 text-accent-blue px-3 py-1.5 rounded text-sm hover:bg-accent-blue/30 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy for Claude'}
          </button>
        </div>
      </div>

      <div className="bg-surface-raised border border-surface-border rounded-lg overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto">
          {logs.map(l => (
            <div
              key={l.id}
              className="px-4 py-2 border-b border-surface-border/30 font-mono text-xs hover:bg-surface/50"
            >
              <span className="text-gray-600 mr-2">
                {new Date(l.created_at).toLocaleTimeString()}
              </span>
              <span className={`font-semibold mr-2 ${LEVEL_COLORS[l.level] ?? 'text-gray-400'}`}>
                [{l.level}]
              </span>
              <span className="text-gray-400 mr-1">{l.component}.</span>
              <span className="text-gray-300">{l.action}</span>
              {l.duration_ms && <span className="text-gray-600 ml-2">({l.duration_ms}ms)</span>}
              {l.error && <span className="text-accent-red ml-2">— {l.error}</span>}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-center text-gray-500 py-8">No logs yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
