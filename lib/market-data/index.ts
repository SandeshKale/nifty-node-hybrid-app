import { MarketData } from '@/lib/types';
import { log } from '@/lib/logging/logger';

const NSE_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.nseindia.com/',
};

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function getNSECookies(): Promise<string> {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout('https://www.nseindia.com/', {
      ...NSE_HEADERS,
      'Accept': 'text/html,application/xhtml+xml',
    }, 8000);
    const cookies = (res.headers.get('set-cookie') ?? '')
      .split(',')
      .map(c => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
    await log('INFO', 'market-data', 'get_nse_cookies', {
      duration_ms: Date.now() - start,
      success: true,
      output_summary: { cookie_length: cookies.length },
    });
    return cookies;
  } catch (e) {
    await log('WARN', 'market-data', 'get_nse_cookies', {
      duration_ms: Date.now() - start,
      success: false,
      error: e instanceof Error ? e.message : String(e),
    });
    return '';
  }
}

async function fetchNSEIndices(cookies: string): Promise<Partial<MarketData>> {
  const start = Date.now();
  const result: Partial<MarketData> = {};
  try {
    const res = await fetchWithTimeout('https://www.nseindia.com/api/allIndices', {
      ...NSE_HEADERS,
      'Cookie': cookies,
    }, 8000);
    if (!res.ok) throw new Error(`NSE allIndices HTTP ${res.status}`);
    const json = await res.json();
    const indices = json?.data;
    if (!Array.isArray(indices)) throw new Error('NSE allIndices: no data array');

    interface NSEIndex { index: string; last: number; percentChange: number; advances?: number; declines?: number }
    const vix = indices.find((d: NSEIndex) => d.index === 'INDIA VIX');
    const nifty = indices.find((d: NSEIndex) => d.index === 'NIFTY 50');
    const bank = indices.find((d: NSEIndex) => d.index === 'NIFTY BANK');

    if (vix) { result.vix = vix.last; result.vix_change = vix.percentChange; }
    if (nifty) { result.nifty_change_pct = nifty.percentChange; result.advances = nifty.advances; result.declines = nifty.declines; }
    if (bank) { result.banknifty_change_pct = bank.percentChange; }

    await log('INFO', 'market-data', 'fetch_nse_indices', {
      duration_ms: Date.now() - start,
      success: true,
      output_summary: { vix: result.vix, nifty_pct: result.nifty_change_pct, advances: result.advances, declines: result.declines },
    });
  } catch (e) {
    await log('WARN', 'market-data', 'fetch_nse_indices', {
      duration_ms: Date.now() - start,
      success: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return result;
}

async function fetchNSEFII(cookies: string): Promise<Partial<MarketData>> {
  const start = Date.now();
  const result: Partial<MarketData> = {};
  try {
    const res = await fetchWithTimeout('https://www.nseindia.com/api/fiidiiTradeReact', {
      ...NSE_HEADERS,
      'Cookie': cookies,
    }, 8000);
    if (!res.ok) throw new Error(`NSE FII HTTP ${res.status}`);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('NSE FII: not an array');

    interface FIIEntry { category: string; netValue: number; date: string }
    const fiiData = json.find((d: FIIEntry) => d.category === 'FII/FPI');
    const diiData = json.find((d: FIIEntry) => d.category === 'DII');
    if (fiiData) { result.fii_net = fiiData.netValue; result.fii_date = fiiData.date; }
    if (diiData) { result.dii_net = diiData.netValue; }

    await log('INFO', 'market-data', 'fetch_nse_fii', {
      duration_ms: Date.now() - start,
      success: true,
      output_summary: { fii_net: result.fii_net, dii_net: result.dii_net },
    });
  } catch (e) {
    await log('WARN', 'market-data', 'fetch_nse_fii', {
      duration_ms: Date.now() - start,
      success: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return result;
}

async function fetchYahoo(symbol: string, label: string): Promise<number | null> {
  const start = Date.now();
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetchWithTimeout(url, {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
    }, 6000);
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta?.chartPreviousClose || !meta?.regularMarketPrice) throw new Error('No price data');
    const pct = ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100);
    const rounded = parseFloat(pct.toFixed(2));
    await log('INFO', 'market-data', `fetch_yahoo_${label}`, {
      duration_ms: Date.now() - start,
      success: true,
      output_summary: { change_pct: rounded },
    });
    return rounded;
  } catch (e) {
    await log('WARN', 'market-data', `fetch_yahoo_${label}`, {
      duration_ms: Date.now() - start,
      success: false,
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function fetchMarketData(): Promise<MarketData> {
  const start = Date.now();
  const md: MarketData = {
    vix: null, vix_change: null,
    nifty_change_pct: null, banknifty_change_pct: null,
    advances: null, declines: null,
    fii_net: null, dii_net: null, fii_date: null,
    dow_change_pct: null, sp500_change_pct: null,
  };

  // Step 1: Get NSE cookies
  const cookies = await getNSECookies();

  // Step 2: Parallel fetch — NSE indices + FII + Yahoo (all independent after cookies)
  if (cookies) {
    await new Promise(r => setTimeout(r, 1500)); // NSE rate-limit delay
    const [indices, fii, dow, sp500] = await Promise.all([
      fetchNSEIndices(cookies),
      fetchNSEFII(cookies),
      fetchYahoo('^DJI', 'dow'),
      fetchYahoo('^GSPC', 'sp500'),
    ]);
    Object.assign(md, indices, fii);
    md.dow_change_pct = dow;
    md.sp500_change_pct = sp500;
  } else {
    // NSE failed — still try Yahoo
    const [dow, sp500] = await Promise.all([
      fetchYahoo('^DJI', 'dow'),
      fetchYahoo('^GSPC', 'sp500'),
    ]);
    md.dow_change_pct = dow;
    md.sp500_change_pct = sp500;
  }

  const filled = Object.entries(md).filter(([, v]) => v !== null).map(([k]) => k);
  const missing = Object.entries(md).filter(([, v]) => v === null).map(([k]) => k);
  await log('INFO', 'market-data', 'fetch_complete', {
    duration_ms: Date.now() - start,
    success: true,
    output_summary: { filled_count: filled.length, missing_count: missing.length, missing },
  });

  return md;
}
