// Crypto asset catalog and pure/async helpers for the Crypto Trading Workstation.
// Self-contained so it can later be folded into src/data/symbols.ts.

export type CryptoCategory = 'Majors' | 'Layer 1' | 'Layer 2' | 'DeFi' | 'Meme';

export interface CryptoAsset {
  symbol: string;
  ticker: string;
  name: string;
  category: CryptoCategory;
  tvSymbol: string;
  defaultPrice: number;
  description: string;
}

export interface CryptoTicker {
  symbol: string;
  source: string;
  price: number;
  changePercent: number;
  high: number;
  low: number;
  quoteVolume: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const CRYPTO_ASSETS: CryptoAsset[] = [
  {
    symbol: 'BTCUSDT',
    ticker: 'BTC/USD',
    name: 'Bitcoin',
    category: 'Majors',
    tvSymbol: 'BINANCE:BTCUSDT',
    defaultPrice: 65000,
    description: '24/7 market leader. CME Friday-to-Sunday gap fills, weekend liquidity sweeps, Monday weekly-open Power of 3 and funding-rate liquidation cascades drive the highest-probability SMC setups.',
  },
  {
    symbol: 'ETHUSDT',
    ticker: 'ETH/USD',
    name: 'Ethereum',
    category: 'Majors',
    tvSymbol: 'BINANCE:ETHUSDT',
    defaultPrice: 2650,
    description: 'High-beta follower of Bitcoin with clean FVG rebalances during US hours. Leads altcoin rotation and can be used as an SMT filter against the ETH/BTC ratio.',
  },
  {
    symbol: 'SOLUSDT',
    ticker: 'SOL/USD',
    name: 'Solana',
    category: 'Layer 1',
    tvSymbol: 'BINANCE:SOLUSDT',
    defaultPrice: 155,
    description: 'High-throughput Layer 1. Violent weekend liquidity runs and momentum continuation; require wider stops and reduced size around network or listing events.',
  },
  {
    symbol: 'BNBUSDT',
    ticker: 'BNB/USD',
    name: 'BNB',
    category: 'Majors',
    tvSymbol: 'BINANCE:BNBUSDT',
    defaultPrice: 590,
    description: 'Exchange token with defensive liquidity. Reacts sharply to exchange and regulatory headlines which create immediate displacement and mitigation blocks.',
  },
  {
    symbol: 'XRPUSDT',
    ticker: 'XRP/USD',
    name: 'XRP',
    category: 'Majors',
    tvSymbol: 'BINANCE:XRPUSDT',
    defaultPrice: 0.62,
    description: 'News and legal-headline sensitive. Prone to vertical spikes; trade the FVG retest after the initial impulse, never the first candle.',
  },
  {
    symbol: 'ADAUSDT',
    ticker: 'ADA/USD',
    name: 'Cardano',
    category: 'Layer 1',
    tvSymbol: 'BINANCE:ADAUSDT',
    defaultPrice: 0.45,
    description: 'Beta Layer 1 with slow accumulation ranges followed by aggressive expansion out of tight weekly consolidations.',
  },
  {
    symbol: 'AVAXUSDT',
    ticker: 'AVAX/USD',
    name: 'Avalanche',
    category: 'Layer 1',
    tvSymbol: 'BINANCE:AVAXUSDT',
    defaultPrice: 30,
    description: 'High-volatility Layer 1 that amplifies Bitcoin moves. Reserve for deep discount OTE entries only.',
  },
  {
    symbol: 'LINKUSDT',
    ticker: 'LINK/USD',
    name: 'Chainlink',
    category: 'DeFi',
    tvSymbol: 'BINANCE:LINKUSDT',
    defaultPrice: 13,
    description: 'Oracle leader with strong institutional demand zones and clean order-block reactions during US and Asian sessions.',
  },
  {
    symbol: 'ARBUSDT',
    ticker: 'ARB/USD',
    name: 'Arbitrum',
    category: 'Layer 2',
    tvSymbol: 'BINANCE:ARBUSDT',
    defaultPrice: 0.9,
    description: 'Layer 2 token with thinner liquidity than majors. Widen stop buffers beyond the displacement origin and avoid weekend manipulation sweeps.',
  },
  {
    symbol: 'OPUSDT',
    ticker: 'OP/USD',
    name: 'Optimism',
    category: 'Layer 2',
    tvSymbol: 'BINANCE:OPUSDT',
    defaultPrice: 1.7,
    description: 'Trades in sympathy with Ethereum. Tight ranges resolve into sharp liquidity sweeps at session opens.',
  },
  {
    symbol: 'UNIUSDT',
    ticker: 'UNI/USD',
    name: 'Uniswap',
    category: 'DeFi',
    tvSymbol: 'BINANCE:UNIUSDT',
    defaultPrice: 7.5,
    description: 'DeFi bellwether. Sensitive to protocol and regulatory news which engineers rapid displacement and rebalancing gaps.',
  },
  {
    symbol: 'AAVEUSDT',
    ticker: 'AAVE/USD',
    name: 'Aave',
    category: 'DeFi',
    tvSymbol: 'BINANCE:AAVEUSDT',
    defaultPrice: 95,
    description: 'Blue-chip DeFi with a thinner order book than majors, so require a wider structural stop buffer beyond the displacement origin.',
  },
  {
    symbol: 'DOGEUSDT',
    ticker: 'DOGE/USD',
    name: 'Dogecoin',
    category: 'Meme',
    tvSymbol: 'BINANCE:DOGEUSDT',
    defaultPrice: 0.12,
    description: 'Sentiment-driven meme leader with extreme wick behaviour. Only trade confirmed structure and reduce position size.',
  },
  {
    symbol: 'SHIBUSDT',
    ticker: 'SHIB/USD',
    name: 'Shiba Inu',
    category: 'Meme',
    tvSymbol: 'BINANCE:SHIBUSDT',
    defaultPrice: 0.000018,
    description: 'Low-priced meme asset with high relative volatility. Mini-contract sizing is required and stops must clear manipulation sweeps.',
  },
];

export const CRYPTO_ENDPOINT = '/api/crypto-market';
const BINANCE_BASE = 'https://api.binance.com';
const COINBASE_BASE = 'https://api.exchange.coinbase.com';
const COINBASE_GRANULARITY: { [key: string]: number } = { '15m': 900, '1h': 3600, '4h': 21600, '1d': 86400 };

export function getCryptoAsset(symbol: string): CryptoAsset | undefined {
  return CRYPTO_ASSETS.find((asset) => asset.symbol === symbol);
}

export function cryptoCategories(): CryptoCategory[] {
  const order: CryptoCategory[] = ['Majors', 'Layer 1', 'Layer 2', 'DeFi', 'Meme'];
  return order.filter((category) => CRYPTO_ASSETS.some((asset) => asset.category === category));
}

export function toCoinbasePair(symbol: string): string {
  return symbol.endsWith('USDT') ? symbol.slice(0, -4) + '-USD' : symbol;
}

export function formatUsd(value: number): string {
  if (!isFinite(value)) return '--';
  const digits = Math.abs(value) >= 1 ? 2 : 6;
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatCompact(value: number): string {
  if (!isFinite(value)) return '--';
  if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return '$' + (value / 1e3).toFixed(2) + 'K';
  return '$' + value.toFixed(2);
}

export function formatPct(value: number): string {
  if (!isFinite(value)) return '--';
  return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
}

export interface PositionSizeInput {
  accountSize: number;
  riskPercent: number;
  entry: number;
  stop: number;
  takeProfit?: number;
}

export interface PositionSizeResult {
  riskAmount: number;
  perUnitRisk: number;
  units: number;
  notional: number;
  riskReward: number | null;
}

export function computePositionSize(input: PositionSizeInput): PositionSizeResult {
  const riskAmount = (input.accountSize * input.riskPercent) / 100;
  const perUnitRisk = Math.abs(input.entry - input.stop);
  const units = perUnitRisk > 0 ? riskAmount / perUnitRisk : 0;
  const notional = units * input.entry;
  const riskReward = input.takeProfit != null && perUnitRisk > 0
    ? Math.abs(input.takeProfit - input.entry) / perUnitRisk
    : null;
  return { riskAmount, perUnitRisk, units, notional, riskReward };
}

async function directTicker(symbol: string): Promise<CryptoTicker> {
  try {
    const response = await fetch(BINANCE_BASE + '/api/v3/ticker/24hr?symbol=' + symbol);
    if (!response.ok) throw new Error('binance ' + response.status);
    const row = await response.json();
    return {
      symbol,
      source: 'binance',
      price: parseFloat(row.lastPrice),
      changePercent: parseFloat(row.priceChangePercent),
      high: parseFloat(row.highPrice),
      low: parseFloat(row.lowPrice),
      quoteVolume: parseFloat(row.quoteVolume),
    };
  } catch (error) {
    const pair = toCoinbasePair(symbol);
    const response = await fetch(COINBASE_BASE + '/products/' + pair + '/stats');
    if (!response.ok) throw new Error('coinbase ' + response.status);
    const row = await response.json();
    const last = parseFloat(row.last);
    const open = parseFloat(row.open);
    return {
      symbol,
      source: 'coinbase',
      price: last,
      changePercent: open > 0 ? ((last - open) / open) * 100 : 0,
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      quoteVolume: parseFloat(row.volume) * last,
    };
  }
}

async function directCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  try {
    const url = BINANCE_BASE + '/api/v3/klines?symbol=' + symbol + '&interval=' + interval + '&limit=' + limit;
    const response = await fetch(url);
    if (!response.ok) throw new Error('binance ' + response.status);
    const rows = await response.json();
    return rows.map((row: any[]) => ({
      time: Math.floor(row[0] / 1000),
      open: parseFloat(row[1]),
      high: parseFloat(row[2]),
      low: parseFloat(row[3]),
      close: parseFloat(row[4]),
      volume: parseFloat(row[5]),
    }));
  } catch (error) {
    const pair = toCoinbasePair(symbol);
    const granularity = COINBASE_GRANULARITY[interval] || 3600;
    const response = await fetch(COINBASE_BASE + '/products/' + pair + '/candles?granularity=' + granularity);
    if (!response.ok) throw new Error('coinbase ' + response.status);
    const rows = await response.json();
    const mapped: Candle[] = rows.map((row: any[]) => ({
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

export async function loadTickers(symbols: string[]): Promise<CryptoTicker[]> {
  try {
    const response = await fetch(CRYPTO_ENDPOINT + '?action=ticker&symbols=' + symbols.join(','));
    if (response.ok) {
      const payload = await response.json();
      if (payload && payload.success && Array.isArray(payload.data) && payload.data.length > 0) {
        return payload.data as CryptoTicker[];
      }
    }
  } catch (error) {
    // Endpoint unavailable (for example local dev without serverless functions) - use direct providers.
  }
  const results = await Promise.all(symbols.map((symbol) => directTicker(symbol).catch(() => null)));
  return results.filter((item): item is CryptoTicker => item !== null);
}

export async function loadCandles(symbol: string, interval: string, limit: number = 200): Promise<Candle[]> {
  try {
    const url = CRYPTO_ENDPOINT + '?action=klines&symbol=' + symbol + '&interval=' + interval + '&limit=' + limit;
    const response = await fetch(url);
    if (response.ok) {
      const payload = await response.json();
      if (payload && payload.success && Array.isArray(payload.data) && payload.data.length > 0) {
        return payload.data as Candle[];
      }
    }
  } catch (error) {
    // Falls back to direct providers below.
  }
  return directCandles(symbol, interval, limit);
}
