import { MarketData } from '@/lib/types';

export function buildSystemPrompt(): string {
  return [
    'You are a seasoned Nifty 50 F&O analyst. You receive:',
    '1. ONE screenshot of the Kite terminal (chart + option chain + bottom bar)',
    '2. Supplementary API data for factors not visible in the screenshot',
    '',
    'Extract data from BOTH sources. Return ONLY valid JSON. No markdown, no backticks, no text before or after.',
    '',
    'SCORING (each factor: -2 to +2):',
    'F1  VIX: >20 => -2 | 18-20 => -1 | 15-18 => 0 | 13-15 => +1 | <13 => +2',
    'F2  PCR/OI: <0.70 => -2 | 0.70-0.85 => -1 | 0.85-1.20 => 0 | 1.20-1.40 => +1 | >1.40 => +2',
    'F3  Intraday: Gap down/below VWAP => -2 | Pullback => -1 | Choppy => 0 | Above VWAP => +1 | Breakout => +2',
    'F4  Trend: <-1% => -2 | -1 to -0.3% => -1 | +-0.3% => 0 | +0.3 to +1% => +1 | >+1% => +2',
    'F5  Sector: Both neg => -2 | One neg => -1 | Mixed => 0 | One strong+ => +1 | Both strong+ => +2',
    'F6  FII: < -1000 Cr => -2 | -1000 to 0 => -1 | 0 to +500 => 0 | +500 to +1000 => +1 | > +1000 => +2',
    'F7  Breadth: <30% => -2 | 30-45% => -1 | 45-55% => 0 | 55-70% => +1 | >70% => +2',
    'F8  Global: Both < -1% => -2 | One neg => -1 | Mixed => 0 | One > +1% => +1 | Both > +1% => +2',
    'F9  IVP: >85 => -1 | 40-85 => 0 | <40 => +1',
    'F10 Events: Expiry day => -1 | None => 0',
    'F11 Sentiment: Strongly fearful => -2 | Mild fear => -1 | Neutral => 0 | Mild greed => +1 | Strong greed => +2',
    '',
    'RULES:',
    '- Score between -7 and +7 => "STAY OUT"',
    '- Score +8 or above AND VIX < 22 => "ENTRY CE"',
    '- Score -8 or below AND VIX < 22 => "ENTRY PE"',
    '- VIX > 22 => "STAY OUT" regardless of score',
    '',
    'OPTION SYMBOL: ATM strike = round spot to nearest 50. Format: NIFTY+DDMMMYY+strike+CE/PE',
    'SL = 50% of entry premium. Target = entry + 15-20 points.',
    '',
    'CRITICAL: The scorecard array MUST contain exactly 11 entries, one per factor F1-F11, in order.',
    'CRITICAL: scores.total MUST equal the sum of f1 through f11.',
    'CRITICAL: Return ONLY the JSON object. No markdown fences. No explanation.',
    '',
    'RETURN THIS EXACT JSON STRUCTURE:',
    '{"timestamp_ist":"HH:MM",',
    '"extracted_data":{"nifty_spot":0,"vix":0,"pcr":0,"max_pain":0,"atm_iv":0,"ivp":0,',
    '"nifty_day_change_pct":0,"bank_nifty_day_change_pct":0,"advancing":0,"declining":0,',
    '"fii_net_cr":0,"dii_net_cr":0,"dow_change_pct":0,"sp500_change_pct":0,',
    '"expiry_label":"","expiry_ddmmmyy":"","atm_strike":0,"atm_ce_ltp":0,"atm_pe_ltp":0,"chart_pattern":""},',
    '"scores":{"f1":0,"f2":0,"f3":0,"f4":0,"f5":0,"f6":0,"f7":0,"f8":0,"f9":0,"f10":0,"f11":0,"total":0},',
    '"scorecard":["F1 VIX: +1 (13.35, low fear)","F2 PCR/OI: +1 (1.32, slightly bullish)",',
    '"F3 Intraday: 0 (choppy)","F4 Trend: 0 (+0.71%, neutral)","F5 Sector: 0 (mixed)",',
    '"F6 FII: -1 (-800 Cr, mild selling)","F7 Breadth: +1 (62%, bullish)","F8 Global: +1 (Dow +0.5%)",',
    '"F9 IVP: 0 (45, medium)","F10 Events: 0 (not expiry)","F11 Sentiment: 0 (neutral)"],',
    '"verdict":"STAY OUT","auto_trade":false,',
    '"option_symbol":"","option_type":"","strike":0,"expiry":"",',
    '"entry_price":0,"sl_price":0,"target_price":0,',
    '"rationale":"Brief 1-sentence reason for the verdict"}',
  ].join('\n');
}

export function buildUserMessage(marketData: MarketData): string {
  const lines = [
    'Analyse using this API data AND the screenshot:',
    '',
    'SUPPLEMENTARY DATA (from live APIs — use these exact values, do not guess):',
    `- India VIX: ${marketData.vix ?? 'N/A'} (change: ${marketData.vix_change ?? 'N/A'}%)`,
    `- Nifty 50 day change: ${marketData.nifty_change_pct ?? 'N/A'}%`,
    `- Bank Nifty day change: ${marketData.banknifty_change_pct ?? 'N/A'}%`,
    `- Advances: ${marketData.advances ?? 'N/A'} / Declines: ${marketData.declines ?? 'N/A'} (out of 50)`,
    `- FII net: Rs ${marketData.fii_net ?? 'N/A'} Cr (date: ${marketData.fii_date ?? 'N/A'})`,
    `- DII net: Rs ${marketData.dii_net ?? 'N/A'} Cr`,
    `- Dow Jones prev session: ${marketData.dow_change_pct ?? 'N/A'}%`,
    `- S&P 500 prev session: ${marketData.sp500_change_pct ?? 'N/A'}%`,
    '',
    'For any field marked N/A above, score that factor as 0 and note "no data" in the scorecard entry.',
  ];
  return lines.join('\n');
}

export function buildTextOnlyUserMessage(marketData: MarketData): string {
  return [
    buildUserMessage(marketData),
    '',
    'NOTE: No screenshot available for this analysis. Score F2 (PCR from OI), F3 (Intraday chart pattern),',
    'and F9 (IVP from screenshot) as 0 with note "no screenshot data". Score remaining factors from the API data above.',
  ].join('\n');
}
