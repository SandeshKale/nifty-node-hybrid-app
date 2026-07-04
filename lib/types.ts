export interface ExtractedMarketData {
  nifty_spot: number;
  vix: number;
  pcr: number;
  max_pain: number;
  atm_iv: number;
  ivp: number;
  nifty_day_change_pct: number;
  bank_nifty_day_change_pct: number;
  advancing: number;
  declining: number;
  fii_net_cr: number;
  dii_net_cr: number;
  dow_change_pct: number;
  sp500_change_pct: number;
  expiry_label: string;
  expiry_ddmmmyy: string;
  atm_strike: number;
  atm_ce_ltp: number;
  atm_pe_ltp: number;
  chart_pattern: string;
}

export interface FactorScores {
  f1: number; f2: number; f3: number; f4: number; f5: number;
  f6: number; f7: number; f8: number; f9: number; f10: number;
  f11: number; total: number;
}

export type Verdict = 'STAY OUT' | 'ENTRY CE' | 'ENTRY PE';

export interface AnalysisResult {
  timestamp_ist: string;
  extracted_data: ExtractedMarketData;
  scores: FactorScores;
  scorecard: string[];
  verdict: Verdict;
  auto_trade: boolean;
  option_symbol: string;
  option_type: string;
  strike: number;
  expiry: string;
  entry_price: number;
  sl_price: number;
  target_price: number;
  rationale: string;
}

export interface MarketData {
  vix: number | null;
  vix_change: number | null;
  nifty_change_pct: number | null;
  banknifty_change_pct: number | null;
  advances: number | null;
  declines: number | null;
  fii_net: number | null;
  dii_net: number | null;
  fii_date: string | null;
  dow_change_pct: number | null;
  sp500_change_pct: number | null;
}

export interface LLMProvider {
  name: string;
  baseUrl: string;
  model: string;
  supportsVision: boolean;
  apiKeyEnvVar: string;
  maxTimeoutMs: number;
}

export interface AnalysisRun {
  id: string;
  created_at: string;
  ist_time: string;
  score: number | null;
  verdict: string | null;
  scorecard: string[] | null;
  extracted_data: ExtractedMarketData | null;
  scores: FactorScores | null;
  raw_llm_response: string | null;
  provider_used: string | null;
  fallback_used: boolean;
  duration_ms: number | null;
  screenshot_url: string | null;
  market_data: MarketData | null;
  error: string | null;
  status: string;
}

export interface LogEntry {
  id: string;
  run_id: string | null;
  created_at: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  component: string;
  action: string;
  duration_ms: number | null;
  success: boolean | null;
  input_summary: Record<string, unknown> | null;
  output_summary: Record<string, unknown> | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
}

export interface TradeState {
  id: string;
  date: string;
  trades_today: number;
  in_position: boolean;
  last_symbol: string | null;
  last_verdict: string | null;
  updated_at: string;
}
