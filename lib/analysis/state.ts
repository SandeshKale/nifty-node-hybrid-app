import { getServerSupabase } from '@/lib/supabase';
import { TradeState } from '@/lib/types';
import { getISTDate } from '@/lib/time';

export async function getTradeState(): Promise<TradeState> {
  const sb = getServerSupabase();
  const { data } = await sb.from('trade_state').select('*').eq('id', 'current').single();

  if (!data) {
    return { id: 'current', date: '', trades_today: 0, in_position: false, last_symbol: null, last_verdict: null, updated_at: new Date().toISOString() };
  }

  // Auto-reset if date changed (new trading day)
  const today = getISTDate();
  if (data.date !== today) {
    const resetState: TradeState = {
      id: 'current',
      date: today,
      trades_today: 0,
      in_position: false,
      last_symbol: null,
      last_verdict: null,
      updated_at: new Date().toISOString(),
    };
    await sb.from('trade_state').update(resetState).eq('id', 'current');
    return resetState;
  }

  return data as TradeState;
}

export async function updateTradeState(updates: Partial<TradeState>): Promise<void> {
  const sb = getServerSupabase();
  await sb.from('trade_state').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', 'current');
}
