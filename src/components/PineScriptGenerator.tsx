import React, { useState } from "react";
import { 
  Copy, 
  Check, 
  HelpCircle, 
  Code, 
  FileCode, 
  Cpu, 
  Sparkles, 
  Flame, 
  Terminal,
  Layers,
  ArrowRight
} from "lucide-react";

export default function PineScriptGenerator() {
  const [activePineScript, setActivePineScript] = useState<"smc_core" | "boom_crash" | "fib_smc">("smc_core");
  const [copied, setCopied] = useState(false);

  const confluencePineCode = `//@version=5
indicator("SMC + CRT + Silver Bullet Confluence [Elite Synthetics]", overlay=true, max_boxes_count=500, max_lines_count=500)

// Inputs
showFib = input.bool(true, "Show Fibonacci Retracement")
showOB = input.bool(true, "Show Order Blocks")
showCRT = input.bool(true, "Show Candle Range Theory (CRT)")
showSB = input.bool(true, "Highlight Silver Bullet Session Windows")
showKZ = input.bool(true, "Highlight ICT Kill Zone Windows")
showJudas = input.bool(true, "Show Judas Swing Traps")
showAMD = input.bool(true, "Show Power of 3 (AMD) Cycles")

// --- CANDLE RANGE THEORY (CRT) ---
// Define HTF (daily cycle) range boundaries
var float crtHigh = na
var float crtLow = na
var bool crtSwept = false

if ta.change(time("D")) != 0
    crtHigh := high[1]
    crtLow := low[1]
    crtSwept := false

// Sweep checks
if showCRT and not na(crtHigh) and not crtSwept
    if high > crtHigh and close < crtHigh
        label.new(bar_index, high, "🧹 CRT Sweep High (Target Reverse)", color=color.rose, textcolor=color.white, style=label.style_label_down)
        crtSwept := true
    else if low < crtLow and close > crtLow
        label.new(bar_index, low, "🧹 CRT Sweep Low (Target Reverse)", color=color.emerald, textcolor=color.white, style=label.style_label_up)
        crtSwept := true

// --- JUDAS SWING DETECTOR ---
if showJudas and not na(crtHigh)
    // False breakout sweep above Daily high range extreme, closes back inside range (Bearish trap)
    if high > crtHigh and close < crtHigh and close < open
        label.new(bar_index, high, "🪤 Bearish Judas Swing (Bull Trap)", color=color.magenta, textcolor=color.white, style=label.style_label_down)
    // False breakout sweep below Daily low range extreme, closes back inside range (Bullish trap)
    else if low < crtLow and close > crtLow and close > open
        label.new(bar_index, low, "🪤 Bullish Judas Swing (Bear Trap)", color=color.magenta, textcolor=color.white, style=label.style_label_up)

// Draw HTF Ranges
if showCRT and not na(crtHigh)
    box.new(bar_index[1], crtHigh, bar_index + 12, crtLow, bgcolor=color.new(color.violet, 96), border_color=color.new(color.violet, 80), border_style=line.style_dashed)

// --- POWER OF 3 (AMD) ---
if showAMD and not na(crtHigh)
    // Draw Accumulation range overlay as a box (normally spans several candles before Judas/CRT sweeps)
    box.new(bar_index[10], crtHigh - (crtHigh - crtLow)*0.15, bar_index[2], crtLow + (crtHigh - crtLow)*0.15, bgcolor=color.new(color.cyan, 96), border_color=color.new(color.cyan, 75), border_style=line.style_dashed)
    
    // Warn about Manipulation during active session open times when a false hunt sweep is detected
    if isSBActive or isLondonKZ or isNYAMKZ
        if (high > crtHigh and close < crtHigh) or (low < crtLow and close > crtLow)
            label.new(bar_index, high, "🚨 AMD Manipulation Phase Active", color=color.orange, textcolor=color.white, style=label.style_label_down)

// --- SILVER BULLET SESSION BOXES ---
// London (3-4 AM EST), NY AM (10-11 AM EST), NY PM (2-3 PM EST)
inLondon = (hour == 3)
inNYAM = (hour == 10)
inNYPM = (hour == 14)
isSBActive = inLondon or inNYAM or inNYPM

if showSB and isSBActive
    box.new(bar_index, high, bar_index + 1, low, bgcolor=color.new(color.yellow, 92), border_color=color.yellow)

// --- ICT KILL ZONES ---
// London KZ (2-5 AM EST), NY AM KZ (9:30-12 PM EST), NY PM KZ (3-5 PM EST)
isLondonKZ = (hour >= 2 and hour < 5)
isNYAMKZ = (hour >= 9 and hour < 12)
isNYPMKZ = (hour >= 15 and hour < 17)

if showKZ
    if isLondonKZ
        box.new(bar_index, high, bar_index + 1, low, bgcolor=color.new(color.cyan, 95), border_color=color.cyan)
    else if isNYAMKZ
        box.new(bar_index, high, bar_index + 1, low, bgcolor=color.new(color.teal, 95), border_color=color.teal)
    else if isNYPMKZ
        box.new(bar_index, high, bar_index + 1, low, bgcolor=color.new(color.blue, 95), border_color=color.blue)

// --- FIBONACCI RETRACEMENT ZONE ---
swingHigh = ta.pivothigh(high, 10, 10)
swingLow = ta.pivotlow(low, 10, 10)

if swingHigh and showFib
    fibHigh = swingHigh
    fibLow = ta.lowest(low, 50)
    fib618 = fibHigh - (fibHigh - fibLow) * 0.618
    fib786 = fibHigh - (fibHigh - fibLow) * 0.786
    line.new(bar_index[1], fib618, bar_index + 30, fib618, color=color.yellow, width=1)
    line.new(bar_index[1], fib786, bar_index + 30, fib786, color=color.orange, width=1)

// --- ORDER BLOCKS ---
if swingLow and showOB
    box.new(bar_index[1], high[1], bar_index + 35, low[1], bgcolor=color.new(color.green, 92), border_color=color.green)
`;


  const smcPineCode = `//@version=5
indicator("Elite SMC & Liquidity Void Indicator [Synthetic]", overlay=true, max_boxes_limit=500, max_lines_limit=500)

// --- INPUTS ---
group_smc = "SMC Structure Settings"
showBOS = input.bool(true, "Show BOS / CHoCH Breaks", group=group_smc)
showOB = input.bool(true, "Highlight Mitigated/Fresh Order Blocks", group=group_smc)
obLength = input.int(10, "Order Block Sensitivity", minval=2, group=group_smc)

group_void = "Liquidity Void / Vacuum Block Settings"
showVoids = input.bool(true, "Plot Liquidity Voids (Dashed)", group=group_void)
voidThreshold = input.float(1.5, "Void Candle Displacement Mult", minval=1.0, step=0.1, group=group_void)

// --- STRUCTURAL SCANNING LOGIC ---
var float highestHigh = na
var float lowestLow = na
var int highBar = na
var int lowBar = na

highestHigh := ta.highest(high, 20)
lowestLow := ta.lowest(low, 20)

// Detect Break of Structure (BOS)
bool bullishBOS = ta.crossover(close, ta.valuewhen(highestHigh == high, high, 1))
bool bearishBOS = ta.crossunder(close, ta.valuewhen(lowestLow == low, low, 1))

plotshape(bullishBOS, title="Bullish BOS", style=shape.triangleup, location=location.belowbar, color=color.cyan, size=size.small, text="BOS")
plotshape(bearishBOS, title="Bearish BOS", style=shape.triangledown, location=location.abovebar, color=color.rose, size=size.small, text="BOS")

// --- LIQUIDITY VOIDS / DISPLACEMENT ---
candleBody = math.abs(close - open)
avgBody = ta.ema(candleBody, 20)
isDisplaced = candleBody > (avgBody * voidThreshold)

// Plot high volume imbalances / Liquidity Voids
if isDisplaced and showVoids
    line.new(bar_index, high, bar_index + 5, high, color=color.new(color.purple, 30), style=line.style_dashed, width=1)
    line.new(bar_index, low, bar_index + 5, low, color=color.new(color.purple, 30), style=line.style_dashed, width=1)

// --- ORDER BLOCKS (POI) ---
// Simple block detection: last down candle before rapid up candle
isUpBlock = (close[1] < open[1]) and (close > open) and isDisplaced
isDownBlock = (close[1] > open[1]) and (close < open) and isDisplaced

if isUpBlock and showOB
    box.new(left=bar_index[1], top=high[1], right=bar_index + 20, bottom=low[1], 
            bgcolor=color.new(color.teal, 90), border_color=color.teal, border_style=line.style_solid)

if isDownBlock and showOB
    box.new(left=bar_index[1], top=high[1], right=bar_index + 20, bottom=low[1], 
            bgcolor=color.new(color.rose, 90), border_color=color.rose, border_style=line.style_solid)
`;

  const boomCrashPineCode = `//@version=5
indicator("Boom & Crash Spike Retest Predictor [Synthetic]", overlay=true)

// --- INPUT CONTROL ---
group_spk = "Spike Analysis Parameters"
spikeThreshold = input.float(2.0, "Spike Magnitude Ratio (EMA Multiplier)", minval=1.2, step=0.1, group=group_spk)
shinkZone = input.int(15, "POI Retracement Lookback", minval=5, group=group_spk)

// --- DETECT ANOMALOUS SPIKES ---
candleHeight = high - low
avgHeight = ta.sma(candleHeight, 50)
isSpike = candleHeight > (avgHeight * spikeThreshold)

// Track spike base zone acting as Vacuum Block magnet
var float lastSpikeBase = na
var float lastSpikeTip = na
var int lastSpikeIdx = na

if isSpike
    lastSpikeBase := close > open ? open : close
    lastSpikeTip := close > open ? close : open
    lastSpikeIdx := bar_index

// Highlight current POI spike base level
plot(lastSpikeBase, title="Active Spike Mitigation Zone", color=color.new(color.orange, 40), linewidth=2, style=plot.style_linebr)

// Retest verification: is price returning to spike base within 61.8% discount?
bool inRetestRange = not na(lastSpikeBase) and (low <= lastSpikeBase + (lastSpikeTip - lastSpikeBase) * 0.25) and (close >= lastSpikeBase)

plotshape(inRetestRange and ta.crossover(close, open), title="Spike Retest Confluence", 
          style=shape.arrowup, location=location.belowbar, color=color.emerald, size=size.medium, text="RETEST BUY")
`;

  const activeScriptCode = 
    activePineScript === "smc_core" 
      ? smcPineCode 
      : activePineScript === "boom_crash" 
      ? boomCrashPineCode 
      : confluencePineCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden" id="pine-script-workstation-panel">
      {/* Light design bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-500"></div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-indigo-950/40 border border-indigo-500/25 text-indigo-400 font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              TradingView Indicator Integration
            </span>
          </div>
          <h3 className="text-md font-bold font-display text-white mt-1 flex items-center gap-2">
            <Code className="h-4 w-4 text-indigo-400" />
            SMC Pine Script Indicator Generator
          </h3>
        </div>

        <button
          onClick={handleCopy}
          type="button"
          className={`px-3 py-1.5 text-xs font-bold rounded-lg uppercase tracking-wide cursor-pointer transition-all duration-300 flex items-center gap-1.5 ${
            copied 
              ? "bg-emerald-600 border border-emerald-500 text-white" 
              : "bg-[#111827] hover:bg-slate-800 border border-slate-700 text-indigo-200"
          }`}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>COPIED CODE</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>COPY TO CLIPBOARD</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
        {/* Toggle options & Instruction */}
        <div className="md:col-span-1 space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-mono font-bold block uppercase">Select Script Edition</span>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setActivePineScript("smc_core"); setCopied(false); }}
                type="button"
                className={`py-3 px-4 rounded-xl text-left border transition-all cursor-pointer flex items-start gap-3 ${
                  activePineScript === "smc_core"
                    ? "bg-indigo-950/25 border-indigo-500/40 text-white shadow-indigo-900/10 shadow-lg"
                    : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Cpu className={`h-4 w-4 mt-0.5 shrink-0 ${activePineScript === "smc_core" ? "text-indigo-400" : "text-slate-500"}`} />
                <div>
                  <h4 className="text-xs font-bold font-sans">Premium SMC Core</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">Detects primary structural breaks, Order Blocks, and Liquidity voids across indices.</p>
                </div>
              </button>

              <button
                onClick={() => { setActivePineScript("boom_crash"); setCopied(false); }}
                type="button"
                className={`py-3 px-4 rounded-xl text-left border transition-all cursor-pointer flex items-start gap-3 ${
                  activePineScript === "boom_crash"
                    ? "bg-pink-950/25 border-pink-500/40 text-white shadow-pink-900/10 shadow-lg"
                    : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Flame className={`h-4 w-4 mt-0.5 shrink-0 ${activePineScript === "boom_crash" ? "text-pink-400" : "text-slate-500"}`} />
                <div>
                  <h4 className="text-xs font-bold font-sans">Boom & Crash Predictor</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">Designed specifically to map sudden spike origins (Vacuum blocks) and calculate retest triggers.</p>
                </div>
              </button>

              <button
                onClick={() => { setActivePineScript("fib_smc"); setCopied(false); }}
                type="button"
                className={`py-3 px-4 rounded-xl text-left border transition-all cursor-pointer flex items-start gap-3 ${
                  activePineScript === "fib_smc"
                    ? "bg-emerald-950/25 border-emerald-500/40 text-white shadow-emerald-900/10 shadow-lg"
                    : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers className={`h-4 w-4 mt-0.5 shrink-0 ${activePineScript === "fib_smc" ? "text-emerald-400" : "text-slate-500"}`} />
                <div>
                  <h4 className="text-xs font-bold font-sans">SMC + CRT + Silver Bullet</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">Integrates HTF Candle Range Theory sweeps, Silver Bullet hourly gaps, Fib Levels, and Order Blocks in a master confluence script.</p>
                </div>
              </button>

            </div>
          </div>

          {/* Quick instructions block */}
          <div className="p-4 bg-[#0d1527] border border-slate-850 rounded-xl space-y-2 text-xs text-slate-400 font-sans shadow-inner">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest block font-mono flex items-center gap-1">
              <FileCode className="h-3 w-3" /> TradingView Import Guide
            </span>
            <ol className="space-y-2 list-decimal list-inside text-[11px] leading-relaxed">
              <li>Click <strong className="text-white">Copy To Clipboard</strong> above.</li>
              <li>Open any synthetic pair on <strong className="text-white">TradingView</strong>.</li>
              <li>At the bottom panel, open the <strong className="text-indigo-400 font-mono">Pine Editor</strong> tab.</li>
              <li>Select all default template code and overwrite by pasting this script.</li>
              <li>Click <strong className="text-emerald-400">Save</strong>, then click <strong className="text-emerald-400">Add to chart</strong> to overlay SMC live zones.</li>
            </ol>
          </div>
        </div>

        {/* Code View Console */}
        <div className="md:col-span-2 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 px-1">
            <span>PINE SCRIPT GENERATOR ENGINE V5.0</span>
            <span className="text-cyan-400 animate-pulse">● EDITOR SECURE</span>
          </div>
          
          <div className="relative bg-[#020617] border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            {/* Top terminal visual layout bar */}
            <div className="flex items-center justify-between bg-slate-950 border-b border-slate-900 px-4 py-2.5">
              <div className="flex gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              </div>
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                {activePineScript === "smc_core" 
                  ? "smc_core_synthetic.v5.pine" 
                  : activePineScript === "boom_crash" 
                  ? "boom_crash_retest.v5.pine" 
                  : "synthetic_fib_smc_confluence.v5.pine"}
              </span>
            </div>

            <pre className="p-4 overflow-x-auto text-[10.5px] font-mono text-slate-300 leading-relaxed max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 bg-[#020617]">
              <code>{activeScriptCode}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
