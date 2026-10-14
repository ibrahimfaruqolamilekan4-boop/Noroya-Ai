// Live crypto market data for the Crypto Trading Workstation (Vercel serverless function).
// Providers: Binance (primary) with an automatic Coinbase fallback for geo-restricted regions.

const BINANCE_BASE = 'https://api.binance.com';
const COINBASE_BASE = 'https://api.exchange.coinbase.com';
const COINBASE_GRANULARITY: { [key: string]: number } = { '15m': 900, '1h': 3600, '4h': 21600, '1d': 86400 };

function applyHeaders(res: any): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
}

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'noroya-crypto/1.0' } });
    if (!response.ok) throw new Error('Upstream status ' + response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function toCoinbasePair(symbol: string): string {
  return symbol.endsWith('USDT') ? symbol.slice(0, -4) + '-USD' : symbol;
}

async function getTicker(symbol: string): Promise<any> {
  const sym = symbol.toUpperCase();
  try {
    const row = await fetchJson(BINANCE_BASE + '/api/v3/ticker/24hr?symbol=' + sym);
    return {
      symbol: sym,
      source: 'binance',
      price: parseFloat(row.lastPrice),
      changePercent: parseFloat(row.priceChangePercent),
      high: parseFloat(row.highPrice),
      low: parseFloat(row.lowPrice),
      quoteVolume: parseFloat(row.quoteVolume),
    };
  } catch (error) {
    const pair = toCoinbasePair(sym);
    const row = await fetchJson(COINBASE_BASE + '/products/' + pair + '/stats');
    const last = parseFloat(row.last);
    const open = parseFloat(row.open);
    return {
      symbol: sym,
      source: 'coinbase',
      price: last,
      changePercent: open > 0 ? ((last - open) / open) * 100 : 0,
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      quoteVolume: parseFloat(row.volume) * last,
    };
  }
}

async function getCandles(symbol: string, interval: string, limit: number): Promise<any[]> {
  const sym = symbol.toUpperCase();
  try {
    const url = BINANCE_BASE + '/api/v3/klines?symbol=' + sym + '&interval=' + interval + '&limit=' + limit;
    const rows: any[] = await fetchJson(url);
    return rows.map((row) => ({
      time: Math.floor(row[0] / 1000),
      open: parseFloat(row[1]),
      high: parseFloat(row[2]),
      low: parseFloat(row[3]),
      close: parseFloat(row[4]),
      volume: parseFloat(row[5]),
    }));
  } catch (error) {
    const pair = toCoinbasePair(sym);
    const granularity = COINBASE_GRANULARITY[interval] || 3600;
    const rows: any[] = await fetchJson(COINBASE_BASE + '/products/' + pair + '/candles?granularity=' + granularity);
    const mapped = rows.map((row) => ({
      time: row[0],
      open: parseFloat(row[3]),
      high: parseFloat(row[2]),
      low: parseFloat(row[1]),
      close: parseFloat(row[4]),
      volume: parseFloat(row[5]),
    }));
    mapped.sort((a, b) => a.time - b.time);
    return mapped.slice(-limit);
  }
}

export default async function handler(req: any, res: any): Promise<void> {
  applyHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed. Use GET.' });
    return;
  }

  try {
    const action = String((req.query && req.query.action) || 'ticker');

    if (action === 'ticker') {
      const raw = String((req.query && req.query.symbols) || 'BTCUSDT,ETHUSDT,SOLUSDT');
      const symbols = raw.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean).slice(0, 30);
      const results = await Promise.all(symbols.map((symbol) => getTicker(symbol).catch(() => null)));
      res.status(200).json({ success: true, data: results.filter(Boolean) });
      return;
    }

    if (action === 'klines') {
      const symbol = String((req.query && req.query.symbol) || 'BTCUSDT').toUpperCase();
      const interval = String((req.query && req.query.interval) || '1h');
      if (!COINBASE_GRANULARITY[interval]) {
        res.status(400).json({ success: false, error: 'Unsupported interval.' });
        return;
      }
      const limit = Math.min(Math.max(parseInt(String((req.query && req.query.limit) || '200'), 10) || 200, 20), 1000);
      const candles = await getCandles(symbol, interval, limit);
      res.status(200).json({ success: true, data: candles });
      return;
    }

    res.status(400).json({ success: false, error: 'Unknown action.' });
  } catch (error: any) {
    res.status(502).json({ success: false, error: (error && error.message) || 'Crypto market data unavailable.' });
  }
}
