import React, { useState, useEffect, useRef } from 'react';
import { MarketInfo, MarketSymbol, ActiveContract, Candle, Tick } from '../../types/deriv';
import { derivWS } from '../../services/derivWebSocket';
import { CandleChart } from './CandleChart';
import { DTraderManualPanel } from './DTraderManualPanel';
import { CandleScannerBot } from './CandleScannerBot';
import { evaluateConfluence, IndicatorResult } from './indicatorCalculations';
import { getMarketPipSize } from '../../utils/derivFormatters';
import { ErrorBoundary } from '../common/ErrorBoundary';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Gauge,
  Sliders,
  Zap,
  BarChart2,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface CandleAnalysisPanelProps {
  markets: MarketInfo[];
  selectedSymbol: MarketSymbol;
  onSelectSymbol: (symbol: MarketSymbol) => void;
  balanceUsd: number;
  onUpdateBalance?: (bal: number) => void;
  activeContracts: ActiveContract[];
}

export const CandleAnalysisPanel: React.FC<CandleAnalysisPanelProps> = ({
  markets,
  selectedSymbol,
  onSelectSymbol,
  balanceUsd,
  onUpdateBalance,
  activeContracts,
}) => {
  const [timeframe, setTimeframe] = useState<string>('1m');
  const [liveQuote, setLiveQuote] = useState<number>(0);
  const [allMarketCandles, setAllMarketCandles] = useState<Record<string, Candle[]>>({});
  const [activeCandles, setActiveCandles] = useState<Candle[]>([]);
  const [candleCountdown, setCandleCountdown] = useState<number>(60);
  const [indicators, setIndicators] = useState<IndicatorResult | null>(null);

  const safeMarkets = markets && markets.length > 0 ? markets : [];
  const activeMarket =
    safeMarkets.find((m) => m?.symbol === selectedSymbol) ||
    safeMarkets[0] || {
      symbol: selectedSymbol || 'R_100',
      displayName: 'Volatility 100 Index',
      category: 'synthetics',
      currentPrice: 727.5,
      change24h: 0.15,
      isPopular: true,
    };
  const pipSize = getMarketPipSize(selectedSymbol || 'R_100');

  // Initialize synthetic baseline historical candles for selected symbol and other markets
  useEffect(() => {
    const initialCandlesMap: Record<string, Candle[]> = {};
    const nowEpoch = Math.floor(Date.now() / 1000);
    const intervalSec = timeframe === '1m' ? 60 : timeframe === '2m' ? 120 : timeframe === '5m' ? 300 : 900;

    const listToInit = safeMarkets.length > 0 ? safeMarkets.slice(0, 10) : [{ symbol: 'R_100', displayName: 'Volatility 100 Index', currentPrice: 727.5 }];

    listToInit.forEach((m) => {
      if (!m || !m.symbol) return;
      let currentPrice = m.currentPrice || (m.symbol.includes('100') ? 727.5 : m.symbol.includes('50') ? 245.0 : 110.0);
      const generated: Candle[] = [];

      for (let i = 28; i >= 0; i--) {
        const epoch = nowEpoch - i * intervalSec;
        const volatility = currentPrice * 0.0018;
        const delta = (Math.random() - 0.48) * volatility * 2;
        const open = currentPrice;
        const close = currentPrice + delta;
        const high = Math.max(open, close) + Math.random() * volatility;
        const low = Math.min(open, close) - Math.random() * volatility;

        generated.push({ epoch, open, high, low, close });
        currentPrice = close;
      }
      initialCandlesMap[m.symbol] = generated;
    });

    setAllMarketCandles(initialCandlesMap);
    const curr = initialCandlesMap[selectedSymbol] || initialCandlesMap['R_100'] || [];
    setActiveCandles(curr);
    if (curr.length > 0) {
      try {
        setIndicators(evaluateConfluence(curr));
      } catch (e) {
        console.error(e);
      }
    }
  }, [selectedSymbol, timeframe]);

  // Subscribe to live ticks for the ACTIVE selected symbol
  useEffect(() => {
    if (!selectedSymbol) return;

    let lastIndicatorCompute = 0;

    const handleTick = (tick: Tick) => {
      if (!tick || !tick.symbol || tick.symbol !== selectedSymbol) return;

      setLiveQuote(tick.quote);

      setActiveCandles((prevCandles) => {
        if (!prevCandles || prevCandles.length === 0) return prevCandles;
        const existing = [...prevCandles];
        const intervalSec = timeframe === '1m' ? 60 : timeframe === '2m' ? 120 : timeframe === '5m' ? 300 : 900;
        const currentCandleEpoch = Math.floor(tick.epoch / intervalSec) * intervalSec;
        const last = { ...existing[existing.length - 1] };

        let candleClosed = false;

        if (last.epoch === currentCandleEpoch) {
          last.close = tick.quote;
          last.high = Math.max(last.high, tick.quote);
          last.low = Math.min(last.low, tick.quote);
          existing[existing.length - 1] = last;
        } else {
          existing.push({
            epoch: currentCandleEpoch,
            open: tick.quote,
            high: tick.quote,
            low: tick.quote,
            close: tick.quote,
          });
          if (existing.length > 40) existing.shift();
          candleClosed = true;
        }

        // Throttle indicator evaluation to at most once every 1.5s or on candle close
        const now = Date.now();
        if (candleClosed || now - lastIndicatorCompute > 1500) {
          lastIndicatorCompute = now;
          try {
            const computed = evaluateConfluence(existing);
            setIndicators(computed);
          } catch (err) {
            console.error('Error evaluating confluence indicators:', err);
          }
        }

        return existing;
      });
    };

    derivWS.subscribeTicks(selectedSymbol, handleTick);

    return () => {
      derivWS.unsubscribeTicks(selectedSymbol, handleTick);
    };
  }, [selectedSymbol, timeframe]);

  // Real-time 1m candle countdown timer
  useEffect(() => {
    const timer = window.setInterval(() => {
      const nowSec = Math.floor(Date.now() / 1000);
      const intervalSec = timeframe === '1m' ? 60 : timeframe === '2m' ? 120 : timeframe === '5m' ? 300 : 900;
      const rem = intervalSec - (nowSec % intervalSec);
      setCandleCountdown(rem);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timeframe]);

  // Active trade entry spot for current symbol
  const activeTrade = (activeContracts || []).find(
    (c) => c?.symbol === selectedSymbol && c?.status === 'OPEN'
  );

  const activeTradeEntry = activeTrade
    ? {
        entrySpot: activeTrade.entrySpot,
        tradeType: (activeTrade.contractType === 'CALL' ? 'RISE' : 'FALL') as 'RISE' | 'FALL',
        startTime: activeTrade.startTime,
        expiryTime: activeTrade.expiryTime,
      }
    : null;

  const confluence = indicators?.confluence;

  // Safe indicator values
  const currentRsi =
    indicators?.rsi14 && indicators.rsi14.length > 0
      ? indicators.rsi14[indicators.rsi14.length - 1]
      : 50;

  const currentMacdHist =
    indicators?.macd?.histogram && indicators.macd.histogram.length > 0
      ? indicators.macd.histogram[indicators.macd.histogram.length - 1]
      : 0;

  const currentEma9 =
    indicators?.ema9 && indicators.ema9.length > 0
      ? indicators.ema9[indicators.ema9.length - 1]
      : 0;

  const currentEma21 =
    indicators?.ema21 && indicators.ema21.length > 0
      ? indicators.ema21[indicators.ema21.length - 1]
      : 0;

  const currentSuperTrend =
    indicators?.superTrend?.trend && indicators.superTrend.trend.length > 0
      ? indicators.superTrend.trend[indicators.superTrend.trend.length - 1]
      : 'UP';

  const displayPriceStr = liveQuote
    ? Number(liveQuote).toFixed(pipSize)
    : activeMarket?.currentPrice !== undefined
    ? Number(activeMarket.currentPrice).toFixed(pipSize)
    : '0.00';

  return (
    <div className="space-y-4">
      {/* Top Banner / Market Overview */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-red-900/30">
              <BarChart2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black tracking-tight">{activeMarket.displayName}</h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono text-emerald-400 font-bold">
                  {displayPriceStr}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real-Time Deriv Candlestick Analysis & 1-Minute Autonomous AI Engine
              </p>
            </div>
          </div>

          {/* Confluence Rating Pill */}
          {confluence && (
            <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-2xl">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Confluence Consensus
                </span>
                <span
                  className={`text-sm font-black flex items-center gap-1 ${
                    confluence.tradeAction === 'RISE'
                      ? 'text-emerald-400'
                      : confluence.tradeAction === 'FALL'
                      ? 'text-[#ff444f]'
                      : 'text-amber-400'
                  }`}
                >
                  {confluence.tradeAction === 'RISE' && <ArrowUpRight className="w-4 h-4" />}
                  {confluence.tradeAction === 'FALL' && <ArrowDownRight className="w-4 h-4" />}
                  {confluence.direction} ({confluence.confidence}%)
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-black text-sm">
                {confluence.score > 0 ? `+${confluence.score}` : confluence.score}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Chart + Technical Indicators + DTrader / Bot Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left / Center Column: Candlestick Chart & Technical Dashboard (7 cols on desktop) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Interactive Deriv Real-Time Candlestick Chart (Matches screenshot exact layout) */}
          <ErrorBoundary fallbackTitle="Candlestick Chart">
            <CandleChart
              symbol={selectedSymbol}
              symbolName={activeMarket.displayName}
              candles={activeCandles}
              liveQuote={liveQuote || activeMarket.currentPrice}
              pipSize={pipSize}
              timeframe={timeframe}
              onChangeTimeframe={setTimeframe}
              indicators={indicators}
              activeTradeEntry={activeTradeEntry}
              candleCountdownSeconds={candleCountdown}
            />
          </ErrorBoundary>

          {/* Technical Indicators Confluence Dashboard */}
          {indicators && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-slate-700" />
                  <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">
                    Predictive Technical Indicators & Momentum Metrics
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-slate-400 font-mono">
                  1-Min Confluence Engine
                </span>
              </div>

              {/* Indicator Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                {/* 1. RSI (14) */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>RSI (14)</span>
                    <Gauge className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="text-sm font-black font-mono text-slate-900">
                    {currentRsi}
                  </div>
                  <div className="text-[10px] font-bold">
                    {currentRsi < 30 ? (
                      <span className="text-emerald-600 font-black">Oversold (Buy Rise)</span>
                    ) : currentRsi > 70 ? (
                      <span className="text-[#ff444f] font-black">Overbought (Buy Fall)</span>
                    ) : (
                      <span className="text-slate-500">Neutral Momentum</span>
                    )}
                  </div>
                </div>

                {/* 2. MACD (12, 26, 9) */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>MACD</span>
                    <TrendingUp className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="text-sm font-black font-mono text-slate-900">
                    {Number(currentMacdHist).toFixed(2)}
                  </div>
                  <div className="text-[10px] font-bold">
                    {currentMacdHist > 0 ? (
                      <span className="text-emerald-600 font-black">Bullish Expansion</span>
                    ) : (
                      <span className="text-[#ff444f] font-black">Bearish Acceleration</span>
                    )}
                  </div>
                </div>

                {/* 3. EMA Ribbon */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>EMA Ribbon</span>
                    <Layers className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="text-sm font-black font-mono text-slate-900">
                    9 / 21 / 50
                  </div>
                  <div className="text-[10px] font-bold">
                    {currentEma9 >= currentEma21 ? (
                      <span className="text-emerald-600 font-black">Golden Uptrend</span>
                    ) : (
                      <span className="text-[#ff444f] font-black">Death Downtrend</span>
                    )}
                  </div>
                </div>

                {/* 4. SuperTrend */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                    <span>SuperTrend</span>
                    <Zap className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="text-sm font-black font-mono text-slate-900">
                    ATR (10, 3)
                  </div>
                  <div className="text-[10px] font-bold">
                    {currentSuperTrend === 'UP' ? (
                      <span className="text-emerald-600 font-black">Green Buy Trend</span>
                    ) : (
                      <span className="text-[#ff444f] font-black">Red Sell Trend</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Detected Candlestick Patterns List */}
              {indicators?.patterns && indicators.patterns.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Recognized Candlestick Patterns
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {indicators.patterns.slice(-3).map((p, idx) => (
                      <div
                        key={idx}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1.5 ${
                          p?.type === 'BULLISH'
                            ? 'bg-emerald-100/70 border-emerald-300 text-emerald-800'
                            : 'bg-rose-100/70 border-rose-300 text-rose-800'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{p?.name || 'Pattern'}</span>
                        <span className="text-[9px] font-mono opacity-75">({p?.reliability || 'MED'})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: DTrader Manual Trading Panel & 1-Minute Autonomous Scanner Bot (5 cols on desktop) */}
        <div className="lg:col-span-5 space-y-4">
          {/* DTrader Manual Execution Panel (Matches User Screenshot) */}
          <ErrorBoundary fallbackTitle="Manual Trading Panel">
            <DTraderManualPanel
              markets={markets}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={onSelectSymbol}
              balanceUsd={balanceUsd}
              onUpdateBalance={onUpdateBalance}
              activeContracts={activeContracts}
              liveQuote={liveQuote || activeMarket.currentPrice}
              pipSize={pipSize}
            />
          </ErrorBoundary>

          {/* 1-Minute Autonomous Confluence Scanner Bot */}
          <ErrorBoundary fallbackTitle="Candle Scanner Bot">
            <CandleScannerBot
              markets={markets}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={onSelectSymbol}
              balanceUsd={balanceUsd}
              onUpdateBalance={onUpdateBalance}
              activeContracts={activeContracts}
              allMarketCandles={allMarketCandles}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};
