import { NextRequest, NextResponse } from 'next/server';
import { pollUpdates, sendMessage } from '@/lib/telegram/bot';
import { getTradeState } from '@/lib/analysis/state';
import { getServerSupabase } from '@/lib/supabase';
import { getISTString } from '@/lib/time';

export const maxDuration = 30;

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth check
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const commands = await pollUpdates();
    if (commands.length === 0) {
      return NextResponse.json({ polled: true, commands: 0 });
    }

    for (const cmd of commands) {
      switch (cmd.command) {
        case 'analyse': {
          await sendMessage('\ud83d\udd0d Analysing...');
          // Trigger analysis via internal fetch
          const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000';
          fetch(`${baseUrl}/api/analyse`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET ?? ''}` },
          }).catch(() => {}); // Fire and forget — analysis sends its own Telegram messages
          break;
        }

        case 'status': {
          const state = await getTradeState();
          const sb = getServerSupabase();

          // Screenshot age
          let screenshotAge = 'No screenshots';
          const { data: latestSS } = await sb.from('screenshots').select('created_at').order('created_at', { ascending: false }).limit(1).single();
          if (latestSS) {
            const ageMin = Math.round((Date.now() - new Date(latestSS.created_at).getTime()) / 60000);
            screenshotAge = ageMin < 60 ? `${ageMin}m ago` : `${(ageMin / 60).toFixed(1)}h ago`;
          }

          // Last analysis
          let lastAnalysis = 'None';
          const { data: lastRun } = await sb.from('analysis_runs').select('ist_time, score, verdict, status').order('created_at', { ascending: false }).limit(1).single();
          if (lastRun) {
            lastAnalysis = `${lastRun.ist_time} IST — ${lastRun.verdict ?? lastRun.status} (${lastRun.score ?? '?'})`;
          }

          const msg = [
            '\ud83d\udcca STATUS',
            '',
            `Screenshot: ${screenshotAge}`,
            `Last analysis: ${lastAnalysis}`,
            `Trades today: ${state.trades_today}/2`,
            `In position: ${state.in_position ? 'Yes (' + state.last_symbol + ')' : 'No'}`,
            `IST: ${getISTString()}`,
          ].join('\n');

          await sendMessage(msg);
          break;
        }

        case 'login': {
          // Set a flag in Supabase that the local service polls for
          const sb = getServerSupabase();
          await sb.from('tg_state').update({ updated_at: new Date().toISOString() }).eq('id', 'current');
          await sendMessage('\ud83d\udd11 Login requested. The local screenshot service will pick this up shortly.');
          break;
        }

        case 'history': {
          const sb = getServerSupabase();
          const { data: runs } = await sb
            .from('analysis_runs')
            .select('ist_time, score, verdict, provider_used, status')
            .order('created_at', { ascending: false })
            .limit(5);

          if (!runs || runs.length === 0) {
            await sendMessage('No analysis history yet.');
            break;
          }

          const lines = runs.map((r, i) =>
            `${i + 1}. ${r.ist_time} IST — ${r.verdict ?? r.status} (${r.score ?? '?'}) via ${r.provider_used ?? '?'}`
          );
          await sendMessage('\ud83d\udcdc Last 5 analyses:\n\n' + lines.join('\n'));
          break;
        }

        case 'help': {
          await sendMessage([
            '\ud83e\udd16 Nifty Auto-Trader v14',
            '',
            '/analyse — Run analysis now',
            '/status — System health',
            '/history — Last 5 analyses',
            '/login — Trigger Kite login',
            '/help — This message',
          ].join('\n'));
          break;
        }

        default:
          break;
      }
    }

    return NextResponse.json({ polled: true, commands: commands.length });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error('Telegram poll error:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
