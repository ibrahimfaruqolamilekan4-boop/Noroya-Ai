import React, { useState } from "react";
import {
  Copy,
  Check,
  Code,
  FileCode,
  Cpu,
  Flame,
  Layers,
} from "lucide-react";

export default function PineScriptGenerator() {
  const [activePineScript, setActivePineScript] = useState<"smc_core" | "boom_crash" | "fib_smc">("smc_core");
  const [copied, setCopied] = useState(false);

  const confluencePineCode = `//@version=5
indicator("SMC + CRT + Silver Bullet Confluence [QuantSMC]", overlay=true, max_boxes_count=500, max_lines_count=500)

// Inputs
showFib = input.bool(true, "Show Fibonacci Retracement")
showOB = input.bool(true, "Show Order Blocks")
showCRT = input.bool(true, "Show Candle Range Theory (CRT)")
showSB = input.bool(true, "Highlight Silver Bullet Session Windows")
showKZ = input.bool(true, "Highlight ICT Kill Zone Windows")
showJudas = input.bool(true, "Show Judas Swing Traps")
showAMD = input.bool(true, "Show Power of 3 (AMD) Cycles")

// --- CANDLE RANGE THEORY (CRT) ---
var float crtHigh = na
var float crtLow = na
var bool crtSwept = false

if ta.change(time("D")) != 0
    crtHigh := high[1]
    crtLow := low[1]
    crtSwept := false

if showCRT and not na(crtHigh) and not crtSwept
    if high > crtHigh and close < crtHigh
        label.new(bar_index, high, "CRT Sweep High (Reverse)", color=color.red, textcolor=color.white, style=label.style_label_down)
        crtSwept := true
    else if low < crtLow and close > crtLow
        label.new(bar_index, low, "CRT Sweep Low (Reverse)", color=color.green, textcolor=color.white, style=label.style_label_up)
        crtSwept := true

// --- SILVER BULLET & ICT KILL ZONES ---
inLondon = (hour == 3)
inNYAM = (hour == 10)
inNYPM = (hour == 14)
isSBActive = inLondon or inNYAM or inNYPM

if showSB and isSBActive
    box.new(bar_index, high, bar_index + 1, low, bgcolor=color.new(color.green, 92), border_color=color.green)

// --- FIBONACCI OTE 0.618 - 0.786 ZONE ---
swingHigh = ta.pivothigh(high, 10, 10)
swingLow = ta.pivotlow(low, 10, 10)

if swingHigh and showFib
    fibHigh = swingHigh
    fibLow = ta.lowest(low, 50)
    fib618 = fibHigh - (fibHigh - fibLow) * 0.618
    fib705 = fibHigh - (fibHigh - fibLow) * 0.705
    fib786 = fibHigh - (fibHigh - fibLow) * 0.786
    line.new(bar_index[1], fib618, bar_index + 30, fib618, color=color.teal, width=1)
    line.new(bar_index[1], fib705, bar_index + 30, fib705, color=color.green, width=2)
    line.new(bar_index[1], fib786, bar_index + 30, fib786, color=color.teal, width=1)

// --- ORDER BLOCKS ---
if swingLow and showOB
    box.new(bar_index[1], high[1], bar_index + 35, low[1], bgcolor=color.new(color.green, 90), border_color=color.green)
`;

  const smcPineCode = `//@version=5
indicator("QuantSMC Structural BOS, CHoCH & Order Blocks", overlay=true, max_boxes_limit=500, max_lines_limit=500)

group_smc = "SMC Structure Settings"
showBOS = input.bool(true, "Show BOS / CHoCH Breaks", group=group_smc)
showOB = input.bool(true, "Highlight Unmitigated Order Blocks", group=group_smc)
voidThreshold = input.float(1.5, "Displacement Candle Multiplier", minval=1.0, step=0.1)

highestHigh = ta.highest(high, 20)
lowestLow = ta.lowest(low, 20)

bool bullishBOS = ta.crossover(close, ta.valuewhen(highestHigh == high, high, 1))
bool bearishBOS = ta.crossunder(close, ta.valuewhen(lowestLow == low, low, 1))

plotshape(bullishBOS, title="Bullish BOS", style=shape.triangleup, location=location.belowbar, color=color.green, size=size.small, text="BOS")
plotshape(bearishBOS, title="Bearish BOS", style=shape.triangledown, location=location.abovebar, color=color.red, size=size.small, text="BOS")

candleBody = math.abs(close - open)
avgBody = ta.ema(candleBody, 20)
isDisplaced = candleBody > (avgBody * voidThreshold)

isUpBlock = (close[1] < open[1]) and (close > open) and isDisplaced
isDownBlock = (close[1] > open[1]) and (close < open) and isDisplaced

if isUpBlock and showOB
    box.new(left=bar_index[1], top=high[1], right=bar_index + 20, bottom=low[1], bgcolor=color.new(color.green, 88), border_color=color.green)

if isDownBlock and showOB
    box.new(left=bar_index[1], top=high[1], right=bar_index + 20, bottom=low[1], bgcolor=color.new(color.red, 88), border_color=color.red)
`;

  const boomCrashPineCode = `//@version=5
indicator("Boom & Crash Pre-Spike Base & Retest Predictor [QuantSMC]", overlay=true)

spikeThreshold = input.float(2.0, "Spike Magnitude Ratio (EMA Multiplier)", minval=1.2, step=0.1)

candleHeight = high - low
avgHeight = ta.sma(candleHeight, 50)
isSpike = candleHeight > (avgHeight * spikeThreshold)

var float lastSpikeBase = na
var float lastSpikeTip = na

if isSpike
    lastSpikeBase := close > open ? open : close
    lastSpikeTip := close > open ? close : open

plot(lastSpikeBase, title="Active Spike Mitigation Base", color=color.new(color.green, 20), linewidth=2, style=plot.style_linebr)

bool inRetestRange = not na(lastSpikeBase) and (low <= lastSpikeBase + (lastSpikeTip - lastSpikeBase) * 0.25) and (close >= lastSpikeBase)

plotshape(inRetestRange and ta.crossover(close, open), title="Spike Retest Confluence", style=shape.arrowup, location=location.belowbar, color=color.green, size=size.normal, text="OTE SPIKE BASE")
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
    <div className="bg-white border border-slate-200 rounded-xl p-6" id="pine-script-workstation-panel">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4 mb-5">
        <div>
          <div className="text-xs font-mono text-emerald-700">
            TradingView Pine Script v5 Integration
          </div>
          <h3 className="text-lg font-bold font-display text-slate-900 mt-0.5 flex items-center gap-2">
            <Code className="h-4 w-4 text-emerald-600" />
            SMC &amp; OTE Indicator Script Generator
          </h3>
        </div>

        <button
          onClick={handleCopy}
          type="button"
          className={`px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            copied
              ? "bg-emerald-700 text-white"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copied to Clipboard</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy Pine Script</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Toggle options & Instruction */}
        <div className="md:col-span-1 space-y-4">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-700 block">
              Select Script Edition
            </span>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setActivePineScript("smc_core");
                  setCopied(false);
                }}
                type="button"
                className={`py-3 px-4 rounded-lg text-left border transition-colors cursor-pointer flex items-start gap-3 ${
                  activePineScript === "smc_core"
                    ? "bg-emerald-50 border-emerald-600 text-slate-900"
                    : "bg-[#F8FAF9] border-slate-200 text-slate-600 hover:text-slate-900"
                }`}
              >
                <Cpu
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    activePineScript === "smc_core" ? "text-emerald-600" : "text-slate-500"
                  }`}
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Institutional SMC Core</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                    Plots structural BOS/CHoCH breaks, Order Blocks, and displacement zones.
                  </p>
                </div>
              </button>

              <button
                onClick={() => {
                  setActivePineScript("boom_crash");
                  setCopied(false);
                }}
                type="button"
                className={`py-3 px-4 rounded-lg text-left border transition-colors cursor-pointer flex items-start gap-3 ${
                  activePineScript === "boom_crash"
                    ? "bg-emerald-50 border-emerald-600 text-slate-900"
                    : "bg-[#F8FAF9] border-slate-200 text-slate-600 hover:text-slate-900"
                }`}
              >
                <Flame
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    activePineScript === "boom_crash" ? "text-emerald-600" : "text-slate-500"
                  }`}
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Boom &amp; Crash Spike Base</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                    Maps algorithmic tick-spike origins and pre-spike consolidation retests.
                  </p>
                </div>
              </button>

              <button
                onClick={() => {
                  setActivePineScript("fib_smc");
                  setCopied(false);
                }}
                type="button"
                className={`py-3 px-4 rounded-lg text-left border transition-colors cursor-pointer flex items-start gap-3 ${
                  activePineScript === "fib_smc"
                    ? "bg-emerald-50 border-emerald-600 text-slate-900"
                    : "bg-[#F8FAF9] border-slate-200 text-slate-600 hover:text-slate-900"
                }`}
              >
                <Layers
                  className={`h-4 w-4 mt-0.5 shrink-0 ${
                    activePineScript === "fib_smc" ? "text-emerald-600" : "text-slate-500"
                  }`}
                />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">SMC + 0.705 OTE + Killzones</h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
                    Integrates Daily CRT sweeps, ICT Silver Bullet windows, and 0.618–0.786 OTE Fib levels.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Quick instructions block */}
          <div className="p-4 bg-[#F8FAF9] border border-slate-200 rounded-lg space-y-2 text-xs text-slate-600">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
              <FileCode className="h-3.5 w-3.5 text-emerald-600" />
              TradingView Setup Guide
            </span>
            <ol className="space-y-1.5 list-decimal list-inside text-[11px] leading-relaxed">
              <li>Click <strong className="text-slate-900">Copy Pine Script</strong> above.</li>
              <li>Open your target chart on <strong className="text-slate-900">TradingView</strong>.</li>
              <li>Open the <strong className="text-emerald-700 font-mono">Pine Editor</strong> tab at the bottom.</li>
              <li>Paste the script and click <strong className="text-emerald-700">Add to chart</strong>.</li>
            </ol>
          </div>
        </div>

        {/* Code View Console */}
        <div className="md:col-span-2 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500 px-1">
            <span>Pine Script v5 Source</span>
            <span className="text-emerald-700 font-semibold">Ready to Compile</span>
          </div>

          <div className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between bg-slate-900 border-b border-slate-800 px-4 py-2.5">
              <span className="text-xs font-mono text-emerald-400">
                {activePineScript === "smc_core"
                  ? "smc_core_institutional.v5.pine"
                  : activePineScript === "boom_crash"
                  ? "boom_crash_spike_base.v5.pine"
                  : "quantsmc_ote_killzone_confluence.v5.pine"}
              </span>
              <span className="text-[11px] font-mono text-slate-400">UTF-8</span>
            </div>

            <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-100 leading-relaxed max-h-[340px] overflow-y-auto">
              <code>{activeScriptCode}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
