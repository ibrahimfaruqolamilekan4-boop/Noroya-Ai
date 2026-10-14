import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Gauge,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  CRYPTO_ASSETS,
  computePositionSize,
  cryptoCategories,
  formatCompact,
  formatPct,
  formatUsd,
  getCryptoAsset,
  loadCandles,
  loadTickers,
} from '../lib/cryptoMarket.ts';
import type { Candle, CryptoTicker } from '../lib/cryptoMarket.ts';

const TIMEFRAMES = ['15m', '1h', '4h', '1d'];

function CandleChart({ candles, height }: { candles: Candle[]; height: number }) {
  if (!candles || candles.length === 0) {
    return (
      <div className='flex items-center justify-center text-sm text-slate-500' style={{ height: height }}>
        Loading candles...
      </div>
    );
  }
  const width = 800;
  const pad = 10;
  const max = Math.max.apply(null, candles.map((candle) => candle.high));
  const min = Math.min.apply(null, candles.map((candle) => candle.low));
  const span = max - min || 1;
  const slot = width / candles.length;
  const bodyWidth = Math.max(1, slot * 0.6);
  const toY = (price: number) => pad + ((max - price) / span) * (height - pad * 2);
  return (
    <svg viewBox={'0 0 ' + width + ' ' + height} className='w-full' role='img' aria-label='Crypto price candles'>
      {candles.map((candle, index) => {
        const cx = index * slot + slot / 2;
        const bullish = candle.close >= candle.open;
        const color = bullish ? '#34d399' : '#fb7185';
        const openY = toY(candle.open);
        const closeY = toY(candle.close);
        const top = Math.min(openY, closeY);
        const bodyHeight = Math.max(1, Math.abs(closeY - openY));
        return (
          <g key={candle.time}>
            <line x1={cx} y1={toY(candle.high)} x2={cx} y2={toY(candle.low)} stroke={color} strokeWidth='1' />
            <rect x={cx - bodyWidth / 2} y={top} width={bodyWidth} height={bodyHeight} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className='flex flex-col gap-0.5'>
      <span className='text-[10px] uppercase tracking-wider font-mono text-slate-400'>{label}</span>
      <span className='text-sm text-slate-700'>{String(value)}</span>
    </div>
  );
}

export default function CryptoWorkstation() {
  const [watchlist, setWatchlist] = useState<CryptoTicker[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [candlesLoading, setCandlesLoading] = useState(true);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [accountSize, setAccountSize] = useState('1000');
  const [riskPercent, setRiskPercent] = useState('1');
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  const selectedAsset = getCryptoAsset(symbol);
  const selectedTicker = watchlist.find((item) => item.symbol === symbol);

  const refreshWatchlist = useCallback(async () => {
    try {
      const data = await loadTickers(CRYPTO_ASSETS.map((asset) => asset.symbol));
      setWatchlist(data);
    } catch (error) {
      setWatchlist([]);
    } finally {
      setWatchlistLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWatchlist();
    const timer = setInterval(refreshWatchlist, 30000);
    return () => clearInterval(timer);
  }, [refreshWatchlist]);

  useEffect(() => {
    let active = true;
    setCandlesLoading(true);
    loadCandles(symbol, timeframe, 180)
      .then((data) => {
        if (active) setCandles(data);
      })
      .catch(() => {
        if (active) setCandles([]);
      })
      .finally(() => {
        if (active) setCandlesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [symbol, timeframe]);

  const runAnalysis = useCallback(async () => {
    if (!selectedAsset) return;
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const response = await fetch('/api/analyze-crypto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedAsset.symbol,
          ticker: selectedAsset.ticker,
          timeframe: timeframe,
          currentPrice: selectedTicker ? selectedTicker.price : selectedAsset.defaultPrice,
          candles: candles.slice(-120),
        }),
      });
      const payload = await response.json();
      if (!payload || !payload.success) {
        throw new Error((payload && payload.error) || 'Analysis failed.');
      }
      setAnalysis(payload.data);
      const setup = payload.data && payload.data.tradeSetup ? payload.data.tradeSetup : null;
      if (setup) {
        if (setup.entry) setEntry(String(setup.entry));
        if (setup.stopLoss) setStop(String(setup.stopLoss));
        if (Array.isArray(setup.takeProfits) && setup.takeProfits.length > 0) setTakeProfit(String(setup.takeProfits[0]));
      }
    } catch (error: any) {
      setAnalysisError((error && error.message) || 'Analysis request failed.');
      setAnalysis(null);
    } finally {
      setAnalyzing(false);
    }
  }, [selectedAsset, selectedTicker, timeframe, candles]);

  const size = useMemo(() => {
    const entryValue = parseFloat(entry) || 0;
    const stopValue = parseFloat(stop) || 0;
    const tpValue = parseFloat(takeProfit) || 0;
    if (entryValue <= 0 || stopValue <= 0 || entryValue === stopValue) return null;
    return computePositionSize({
      accountSize: parseFloat(accountSize) || 0,
      riskPercent: parseFloat(riskPercent) || 0,
      entry: entryValue,
      stop: stopValue,
      takeProfit: tpValue > 0 ? tpValue : undefined,
    });
  }, [accountSize, riskPercent, entry, stop, takeProfit]);

  const categories = cryptoCategories();
  const setup = analysis && analysis.tradeSetup ? analysis.tradeSetup : null;
  const bias = analysis && analysis.bias ? String(analysis.bias).toUpperCase() : '';
  const biasColor = bias === 'BULLISH' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : bias === 'BEARISH' ? 'text-rose-600 bg-rose-50 border-rose-200' : 'text-slate-600 bg-slate-50 border-slate-200';

  return (
    <div className='min-h-screen bg-[#f8fafc] text-slate-900'>
      <div className='max-w-6xl mx-auto p-4 sm:p-6 space-y-6'>
        <div className='bg-white border border-slate-200 rounded-2xl p-5 shadow-2xl relative overflow-hidden'>
          <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-cyan-500' />
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
            <div>
              <span className='text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-600 font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider'>24/7 Crypto Desk</span>
              <h1 className='text-xl font-bold font-display text-slate-900 mt-2 flex items-center gap-2'>
                <Activity className='h-5 w-5 text-amber-500' /> Crypto Trading Workstation
              </h1>
              <p className='text-xs text-slate-500 mt-1 max-w-2xl'>Live prices, SMC order-flow analysis with CME gap and funding context, and position sizing. Educational only, not financial advice.</p>
            </div>
            <button type='button' onClick={refreshWatchlist} className='inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white hover:border-slate-300 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700'>
              <RefreshCw className={'h-4 w-4 ' + (watchlistLoading ? 'animate-spin' : '')} /> Refresh
            </button>
          </div>
        </div>

        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2'>
          {CRYPTO_ASSETS.map((asset) => {
            const ticker = watchlist.find((item) => item.symbol === asset.symbol);
            const active = asset.symbol === symbol;
            const change = ticker ? ticker.changePercent : 0;
            const up = change >= 0;
            return (
              <button
                key={asset.symbol}
                type='button'
                onClick={() => setSymbol(asset.symbol)}
                className={'text-left rounded-xl border p-3 transition ' + (active ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300')}
              >
                <div className='flex items-center justify-between'>
                  <span className='text-xs font-bold text-slate-800 font-display'>{asset.ticker}</span>
                  {up ? <TrendingUp className='h-3.5 w-3.5 text-emerald-500' /> : <TrendingDown className='h-3.5 w-3.5 text-rose-500' />}
                </div>
                <div className='text-sm font-mono text-slate-900 mt-1'>{ticker ? formatUsd(ticker.price) : '--'}</div>
                <div className={'text-[11px] font-mono mt-0.5 ' + (up ? 'text-emerald-600' : 'text-rose-600')}>{ticker ? formatPct(change) : '--'}</div>
                <div className='text-[10px] text-slate-400 mt-1 font-mono'>{asset.category}</div>
              </button>
            );
          })}
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 items-start'>
          <div className='lg:col-span-2 space-y-6'>
            <div className='bg-white border border-slate-200 rounded-2xl p-5 shadow-2xl'>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4 mb-4'>
                <div>
                  <h2 className='text-base font-bold font-display text-slate-900'>
                    {selectedAsset ? selectedAsset.name : ''} <span className='text-slate-400 font-mono text-sm'>{selectedAsset ? selectedAsset.ticker : ''}</span>
                  </h2>
                  <p className='text-[11px] text-slate-500 font-mono mt-1'>
                    {selectedTicker ? 'Last ' + formatUsd(selectedTicker.price) + '  |  24h ' + formatPct(selectedTicker.changePercent) + '  |  Vol ' + formatCompact(selectedTicker.quoteVolume) : 'Fetching live market data...'}
                  </p>
                </div>
                <div className='flex items-center gap-1'>
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      type='button'
                      onClick={() => setTimeframe(tf)}
                      aria-pressed={timeframe === tf}
                      className={'px-3 py-1.5 text-xs font-mono font-bold rounded-lg border ' + (timeframe === tf ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300')}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              <div className='rounded-xl bg-[#020617] p-2'>
                <CandleChart candles={candles} height={320} />
              </div>

              <div className='flex items-center justify-between mt-3 text-[11px] text-slate-400 font-mono'>
                <span>{candlesLoading ? 'Loading candles...' : candles.length + ' candles'}</span>
                <span>{selectedAsset ? selectedAsset.tvSymbol : ''}</span>
              </div>

              <button
                type='button'
                onClick={runAnalysis}
                disabled={analyzing}
                className='mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-900 font-bold text-sm py-3'
              >
                <Sparkles className='h-4 w-4' /> {analyzing ? 'Analysing order flow...' : 'Run Crypto SMC Analysis'}
              </button>

              {analysisError ? (
                <div className='mt-3 flex items-start gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3'>
                  <AlertTriangle className='h-4 w-4 mt-0.5 shrink-0' />
                  <span>{analysisError}</span>
                </div>
              ) : null}
            </div>

            {analysis ? (
              <div className='bg-white border border-slate-200 rounded-2xl p-5 shadow-2xl space-y-4'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-base font-bold font-display text-slate-900'>AI Crypto SMC Report</h3>
                  <div className='flex items-center gap-2'>
                    {bias ? <span className={'text-[11px] font-bold border rounded-full px-3 py-0.5 ' + biasColor}>{bias}</span> : null}
                    {analysis.confluenceScore !== undefined ? <span className='text-[11px] font-mono font-bold text-slate-600 border border-slate-200 rounded-full px-3 py-0.5'>Confluence {analysis.confluenceScore}/5</span> : null}
                  </div>
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                  <InfoRow label='Market structure' value={analysis.marketStructure} />
                  <InfoRow label='Session context' value={analysis.sessionContext} />
                  <InfoRow label='BTC dominance' value={analysis.dominanceContext} />
                  <InfoRow label='Funding rate' value={analysis.fundingRateContext} />
                  <InfoRow label='Liquidation magnet' value={analysis.liquidationContext} />
                  {analysis.cmeGap ? <InfoRow label='CME gap' value={analysis.cmeGap.present ? (analysis.cmeGap.gapRange || 'present') + ' (fill ' + (analysis.cmeGap.fillProbability || '?') + ')' : 'No open gap'} /> : null}
                  {analysis.antiStopLossShield ? <InfoRow label='Anti stop-hunt' value={analysis.antiStopLossShield.protectionRationale} /> : null}
                </div>

                {setup ? (
                  <div className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
                    <div className='flex items-center justify-between mb-2'>
                      <span className='text-xs font-bold uppercase tracking-wider text-slate-500'>Trade setup</span>
                      <span className={'text-xs font-bold ' + (setup.type === 'BUY' ? 'text-emerald-600' : setup.type === 'SELL' ? 'text-rose-600' : 'text-slate-500')}>{setup.type || 'WAIT'}</span>
                    </div>
                    <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-sm'>
                      <div><div className='text-[10px] text-slate-400 uppercase'>Entry</div>{setup.entry || '--'}</div>
                      <div><div className='text-[10px] text-slate-400 uppercase'>Stop</div>{setup.stopLoss || '--'}</div>
                      <div><div className='text-[10px] text-slate-400 uppercase'>Targets</div>{Array.isArray(setup.takeProfits) ? setup.takeProfits.join(' / ') : '--'}</div>
                      <div><div className='text-[10px] text-slate-400 uppercase'>R:R</div>{setup.riskRewardRatio || '--'}</div>
                    </div>
                    {setup.rationale ? <p className='text-xs text-slate-600 mt-3'>{setup.rationale}</p> : null}
                  </div>
                ) : null}

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  {Array.isArray(analysis.doActions) && analysis.doActions.length > 0 ? (
                    <div>
                      <span className='text-xs font-bold text-emerald-600 uppercase tracking-wider'>Do</span>
                      <ul className='mt-2 space-y-1 list-disc list-inside text-xs text-slate-600'>
                        {analysis.doActions.map((item: string, index: number) => <li key={index}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}
                  {Array.isArray(analysis.dontActions) && analysis.dontActions.length > 0 ? (
                    <div>
                      <span className='text-xs font-bold text-rose-600 uppercase tracking-wider'>Do not</span>
                      <ul className='mt-2 space-y-1 list-disc list-inside text-xs text-slate-600'>
                        {analysis.dontActions.map((item: string, index: number) => <li key={index}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null}
                </div>

                {analysis.educationalInsight ? (
                  <div className='rounded-xl bg-indigo-50 border border-indigo-200 p-4'>
                    <span className='text-xs font-bold text-indigo-600 uppercase tracking-wider'>Insight</span>
                    <p className='text-xs text-slate-700 mt-1'>{analysis.educationalInsight}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className='bg-white border border-slate-200 rounded-2xl p-5 shadow-2xl space-y-4'>
            <h3 className='text-base font-bold font-display text-slate-900 flex items-center gap-2'>
              <Gauge className='h-4 w-4 text-indigo-500' /> Position Sizing
            </h3>
            <div className='grid grid-cols-2 gap-3'>
              <label className='flex flex-col gap-1 text-[11px] text-slate-500'>Account (USD)
                <input value={accountSize} onChange={(event) => setAccountSize(event.target.value)} inputMode='decimal' className='rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-amber-400' />
              </label>
              <label className='flex flex-col gap-1 text-[11px] text-slate-500'>Risk %
                <input value={riskPercent} onChange={(event) => setRiskPercent(event.target.value)} inputMode='decimal' className='rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-amber-400' />
              </label>
              <label className='flex flex-col gap-1 text-[11px] text-slate-500'>Entry
                <input value={entry} onChange={(event) => setEntry(event.target.value)} inputMode='decimal' className='rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-amber-400' />
              </label>
              <label className='flex flex-col gap-1 text-[11px] text-slate-500'>Stop loss
                <input value={stop} onChange={(event) => setStop(event.target.value)} inputMode='decimal' className='rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-amber-400' />
              </label>
              <label className='col-span-2 flex flex-col gap-1 text-[11px] text-slate-500'>Take profit
                <input value={takeProfit} onChange={(event) => setTakeProfit(event.target.value)} inputMode='decimal' className='rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-amber-400' />
              </label>
            </div>

            {size ? (
              <div className='rounded-xl bg-[#020617] p-4 font-mono text-xs text-slate-300 space-y-2'>
                <div className='flex items-center gap-1 text-amber-400'><Shield className='h-3.5 w-3.5' /> Risk plan</div>
                <div className='flex justify-between'><span className='text-slate-500'>Risk amount</span><span>{formatUsd(size.riskAmount)}</span></div>
                <div className='flex justify-between'><span className='text-slate-500'>Per-unit risk</span><span>{size.perUnitRisk.toFixed(4)}</span></div>
                <div className='flex justify-between'><span className='text-slate-500'>Units</span><span>{size.units.toFixed(4)}</span></div>
                <div className='flex justify-between'><span className='text-slate-500'>Notional</span><span>{formatUsd(size.notional)}</span></div>
                <div className='flex justify-between'><span className='text-slate-500'>Reward ratio</span><span>{size.riskReward ? '1:' + size.riskReward.toFixed(2) : '--'}</span></div>
              </div>
            ) : (
              <p className='text-xs text-slate-400'>Enter an entry and stop to calculate position size, or run an analysis to auto-fill the levels.</p>
            )}

            <div className='border-t border-slate-200 pt-3'>
              <span className='text-[10px] uppercase tracking-wider font-mono text-slate-400'>Coverage</span>
              <div className='flex flex-wrap gap-1 mt-2'>
                {categories.map((category) => (
                  <span key={category} className='text-[10px] font-mono text-slate-500 border border-slate-200 rounded-full px-2 py-0.5'>{category}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className='text-[11px] text-slate-400 text-center pb-6'>
          Crypto data from public exchange feeds (Binance with Coinbase fallback). Analysis is educational only and not financial advice. Always manage risk.
        </p>
      </div>
    </div>
  );
}
