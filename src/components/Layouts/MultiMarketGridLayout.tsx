import React, { useState, useEffect, useMemo } from 'react';
import { MarketSymbol, MarketInfo, Tick, ActiveContract } from '../../types/deriv';
import { derivWS, extractDerivLastDigit } from '../../services/derivWebSocket';
import { soundManager } from '../../utils/soundEffects';
import {
  Grid,
  Activity,
  ArrowUp,
  ArrowDown,
  Flame,
  Zap,
  CheckCircle2,
  TrendingUp,
  SlidersHorizontal,
  Plus
} from 'lucide-react';

interface MultiMarketGridLayoutProps {
  markets: MarketInfo[];
  balanceUsd: number;
  onUpdateBalance: (newBalance: number) => void;
  onSelectMarketForDetailedView: (symbol: MarketSymbol) => void;
}

const DEFAULT_QUAD_SYMBOLS: MarketSymbol[] = ['R_100', 'R_75', 'CRASH500', 'BOOM1000'];

export const MultiMarketGridLayout: React.FC<MultiMarketGridLayoutProps> = ({
  markets,
  balanceUsd,
  onUpdateBalance,
  onSelectMarketForDetailedView,
}) => {
  const [quadSymbols, setQuadSymbols] = useState<MarketSymbol[]>(DEFAULT_QUAD_SYMBOLS);
  const [stake, setStake] = useState<number>(10);
  const [marketTicks, setMarketTicks] = useState<Record<string, Tick[]>>({});
  const [latestQuotes, setLatestQuotes] = useState<Record<string, number>>({});
  const [lastDigits, setLastDigits] = useState<Record<string, number>>({});
  const [tradeNotifications, setTradeNotifications] = useState<string[]>([]);

  // Subscribe to all 4 quad markets simultaneously
  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    quadSymbols.forEach((sym) => {
      const handleTick = (tick: Tick) => {
        const q = Number(tick.quote);
        if (!Number.isFinite(q)) return;
        const pip = Number.isInteger(tick.pipSize) ? tick.pipSize : 2;
        const digit = extractDerivLastDigit(q, pip);

        setLatestQuotes((prev) => ({ ...prev, [sym]: q }));
        setLastDigits((prev) => ({ ...prev, [sym]: digit }));
        setMarketTicks((prev) => {
          const current = prev[sym] || [];
          return {
            ...prev,
            [sym]: [...current.slice(-50), tick],
          };
        });
      };

      derivWS.subscribeTicks(sym, handleTick);
      unsubscribes.push(() => derivWS.unsubscribeTicks(sym, handleTick));
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [quadSymbols]);

  const handleQuickBuy = (symbol: MarketSymbol, contractType: string, targetDigit?: number) => {
    if (balanceUsd < stake) {
      alert('Insufficient balance.');
      return;
    }

    soundManager.playButtonClick();
    const marketObj = markets.find((m) => m.symbol === symbol);
    const symName = marketObj?.displayName || symbol;

    const contract = derivWS.purchaseContract({
      symbol,
      contractType,
      stake,
      durationTicks: 1,
      targetDigit: targetDigit ?? 5,
      barrier: targetDigit ?? 5,
      symbolName: symName,
    });

    const msg = `Ordered ${contractType} on ${symName} ($${stake})`;
    setTradeNotifications((prev) => [msg, ...prev].slice(0, 5));
    setTimeout(() => {
      setTradeNotifications((prev) => prev.filter((m) => m !== msg));
    }, 4000);
  };

  return (
    <div id="multi-market-grid-layout" className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Grid className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
              <span>DERIV QUAD COMMAND STATION • 4 SYNCHRONIZED FEEDS</span>
            </div>
            <h1 className="text-xl font-black text-white">Multi-Market Command Grid</h1>
          </div>
        </div>

        {/* Global Stake Selector */}
        <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2">
          <span className="text-xs font-bold text-slate-400">Quick Scalp Stake:</span>
          <div className="flex items-center gap-1">
            {[5, 10, 25, 50].map((amt) => (
              <button
                key={amt}
                onClick={() => setStake(amt)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  stake === amt
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Temporary Toast Notifications */}
      {tradeNotifications.length > 0 && (
        <div className="space-y-2">
          {tradeNotifications.map((notif, i) => (
            <div
              key={i}
              className="p-3 bg-emerald-950/80 border border-emerald-600/80 text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{notif}</span>
            </div>
          ))}
        </div>
      )}

      {/* 4 Synchronized Market Cards (Quad Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {quadSymbols.map((sym, index) => {
          const marketObj = markets.find((m) => m.symbol === sym) || markets[0];
          const ticks = marketTicks[sym] || [];
          const quote = latestQuotes[sym] || 0;
          const currentDigit = lastDigits[sym] !== undefined ? lastDigits[sym] : null;

          // Compute mini distribution
          const digitCounts = Array(10).fill(0);
          ticks.forEach((t) => {
            const pip = Number.isInteger(t.pipSize) ? t.pipSize : 2;
            const d = extractDerivLastDigit(t.quote, pip);
            if (d >= 0 && d <= 9) digitCounts[d]++;
          });
          const totalTicks = ticks.length || 1;

          // Find min price & max price for sparkline
          const prices = ticks.map((t) => t.quote);
          const minP = Math.min(...(prices.length ? prices : [quote]));
          const maxP = Math.max(...(prices.length ? prices : [quote]));
          const pRange = maxP - minP || 1;

          return (
            <div
              key={sym}
              id={`quad-card-${sym}`}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              {/* Card Header: Market Name, Switcher, Quote */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <select
                    value={sym}
                    onChange={(e) => {
                      const newSym = e.target.value as MarketSymbol;
                      setQuadSymbols((prev) => {
                        const next = [...prev];
                        next[index] = newSym;
                        return next;
                      });
                    }}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-black text-white outline-none focus:border-amber-500"
                  >
                    {markets.map((m) => (
                      <option key={m.symbol} value={m.symbol}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-black text-white">
                    {quote > 0 ? quote.toFixed(2) : 'Connecting...'}
                  </span>
                  {currentDigit !== null && (
                    <span className="w-7 h-7 rounded-lg bg-red-600 text-white font-mono font-black text-sm flex items-center justify-center shadow">
                      {currentDigit}
                    </span>
                  )}
                </div>
              </div>

              {/* Sparkline & Mini Circles Bar */}
              <div className="space-y-3">
                {/* SVG Mini Sparkline */}
                <div className="w-full h-24 bg-slate-950 rounded-xl border border-slate-800/80 p-2 relative overflow-hidden flex items-center">
                  {ticks.length > 2 ? (
                    <svg className="w-full h-full" viewBox="0 0 300 80" preserveAspectRatio="none">
                      {(() => {
                        const pts = ticks.map((t, idx) => {
                          const x = (idx / (ticks.length - 1)) * 300;
                          const y = 70 - ((t.quote - minP) / pRange) * 60;
                          return `${x},${y}`;
                        });
                        return (
                          <path
                            d={`M ${pts.join(' L ')}`}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        );
                      })()}
                    </svg>
                  ) : (
                    <div className="w-full text-center text-[11px] text-slate-600">Buffering ticks...</div>
                  )}
                </div>

                {/* 10 Mini Deriv Circles */}
                <div className="grid grid-cols-10 gap-1 text-center font-mono">
                  {digitCounts.map((count, d) => {
                    const pct = ((count / totalTicks) * 100).toFixed(0);
                    const isCur = currentDigit === d;
                    return (
                      <div
                        key={d}
                        className={`py-1 rounded-lg border flex flex-col items-center justify-center transition-all ${
                          isCur
                            ? 'bg-red-950 border-red-500 text-red-400 font-black'
                            : 'bg-slate-950 border-slate-800/80 text-slate-400'
                        }`}
                      >
                        <span className="text-[11px] font-black">{d}</span>
                        <span className="text-[8px] text-slate-500">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Instant Execution Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => handleQuickBuy(sym, 'DIGITDIFF', currentDigit ?? 5)}
                  className="py-2.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 text-xs font-black transition-all"
                >
                  DIFFERS {currentDigit ?? 5}
                </button>
                <button
                  onClick={() => handleQuickBuy(sym, 'CALL')}
                  className="py-2.5 rounded-xl bg-slate-950 hover:bg-emerald-950 border border-slate-800 hover:border-emerald-600 text-emerald-400 text-xs font-black transition-all"
                >
                  RISE ▲
                </button>
                <button
                  onClick={() => handleQuickBuy(sym, 'PUT')}
                  className="py-2.5 rounded-xl bg-slate-950 hover:bg-rose-950 border border-slate-800 hover:border-rose-600 text-rose-400 text-xs font-black transition-all"
                >
                  FALL ▼
                </button>
              </div>

              {/* Full Terminal Drill-down link */}
              <button
                onClick={() => onSelectMarketForDetailedView(sym)}
                className="w-full text-center text-[11px] font-bold text-slate-500 hover:text-amber-400 transition-colors pt-1"
              >
                Open Full Terminal for {marketObj.displayName} →
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
