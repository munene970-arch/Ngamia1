import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Candle, MarketSymbol } from '../../types/deriv';
import { IndicatorResult } from './indicatorCalculations';
import { Maximize2, Minimize2, Eye, EyeOff, TrendingUp, Sliders } from 'lucide-react';

interface CandleChartProps {
  symbol: MarketSymbol;
  symbolName: string;
  candles: Candle[];
  liveQuote?: number;
  pipSize?: number;
  timeframe: string;
  onChangeTimeframe: (tf: string) => void;
  indicators: IndicatorResult | null;
  activeTradeEntry?: {
    entrySpot: number;
    tradeType: 'RISE' | 'FALL';
    startTime: number;
    expiryTime: number;
  } | null;
  candleCountdownSeconds?: number;
}

export const CandleChart: React.FC<CandleChartProps> = ({
  symbol,
  symbolName,
  candles,
  liveQuote,
  pipSize = 2,
  timeframe,
  onChangeTimeframe,
  indicators,
  activeTradeEntry,
  candleCountdownSeconds = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 420 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showEma, setShowEma] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);
  const [showSuperTrend, setShowSuperTrend] = useState(true);
  const [hoveredCandle, setHoveredCandle] = useState<{
    candle: Candle;
    x: number;
    y: number;
    index: number;
  } | null>(null);

  // Window and container resize handler with tolerance threshold to prevent infinite loops
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = Math.max(280, Math.floor(rect.width || 360));
      const h = Math.max(300, Math.floor(rect.height || 360));
      setDimensions((prev) => {
        if (Math.abs(prev.width - w) < 2 && Math.abs(prev.height - h) < 2) return prev;
        return { width: w, height: h };
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isFullscreen]);

  // Update canvas resolution only when dimensions change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(280, dimensions.width || 360);
    const height = Math.max(300, dimensions.height || 360);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }, [dimensions.width, dimensions.height]);

  // Helper for drawing rounded rectangle safely across all browsers
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    if (typeof (ctx as any).roundRect === 'function') {
      try {
        (ctx as any).roundRect(x, y, width, height, radius);
        return;
      } catch {
        // Fallback below
      }
    }
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  // Format quotes according to pip size safely
  const formatPrice = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '0.00';
    return Number(val).toLocaleString('en-US', {
      minimumFractionDigits: pipSize,
      maximumFractionDigits: pipSize,
    });
  };

  const formatTime = (epoch: number | undefined) => {
    if (!epoch) return '--:--:--';
    const d = new Date(epoch * 1000);
    return d.toTimeString().split(' ')[0];
  };

  // Determine current display candle including live quote
  const displayCandles = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    const copy = [...candles];
    if (liveQuote !== undefined && !isNaN(liveQuote) && copy.length > 0) {
      const last = { ...copy[copy.length - 1] };
      last.close = liveQuote;
      last.high = Math.max(last.high, liveQuote);
      last.low = Math.min(last.low, liveQuote);
      copy[copy.length - 1] = last;
    }
    return copy;
  }, [candles, liveQuote]);

  // Render High-Performance Candlestick Canvas using RAF
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const renderChart = () => {
      try {
        const width = Math.max(300, dimensions.width || 800);
        const height = Math.max(300, dimensions.height || 400);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Clear and Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        if (!displayCandles || displayCandles.length === 0) {
          ctx.fillStyle = '#64748b';
          ctx.font = 'bold 13px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Streaming Deriv Real-Time Market Candlesticks...', width / 2, height / 2);
          ctx.restore();
          return;
        }

        const paddingRight = 70; // Price axis space on right (Deriv style)
        const paddingBottom = 26; // Time axis space on bottom
        const paddingTop = 28;
        const paddingLeft = 10;

        const chartWidth = Math.max(100, width - paddingRight - paddingLeft);
        const chartHeight = Math.max(100, height - paddingBottom - paddingTop);

        // Visible candle count
        const maxVisibleCandles = 32;
        const visibleCandles = displayCandles.slice(-maxVisibleCandles);
        const candleCount = visibleCandles.length;
        const candleSlotWidth = chartWidth / Math.max(candleCount, 15);
        const candleBodyWidth = Math.max(3, candleSlotWidth * 0.65);

        // Calculate Price Range
        let minPrice = Infinity;
        let maxPrice = -Infinity;

        visibleCandles.forEach((c) => {
          if (c && typeof c.low === 'number' && typeof c.high === 'number') {
            minPrice = Math.min(minPrice, c.low);
            maxPrice = Math.max(maxPrice, c.high);
          }
        });

        if (!isFinite(minPrice) || !isFinite(maxPrice)) {
          minPrice = 100;
          maxPrice = 105;
        }

        // Add margin to price scale
        const priceRange = maxPrice - minPrice || 1;
        const priceMargin = priceRange * 0.12;
        const scaleMin = minPrice - priceMargin;
        const scaleMax = maxPrice + priceMargin;
        const scaleRange = Math.max(0.0001, scaleMax - scaleMin);

        const getY = (val: number) => {
          if (isNaN(val)) return paddingTop + chartHeight / 2;
          return paddingTop + chartHeight - ((val - scaleMin) / scaleRange) * chartHeight;
        };

        // Draw Subtle Grid Lines (Deriv exact style)
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;

        // Horizontal Price Grids (4 steps)
        const priceGridSteps = 4;
        for (let i = 0; i <= priceGridSteps; i++) {
          const priceVal = scaleMin + (scaleRange / priceGridSteps) * i;
          const y = getY(priceVal);

          ctx.beginPath();
          ctx.moveTo(paddingLeft, y);
          ctx.lineTo(width - paddingRight, y);
          ctx.stroke();

          // Right-side price labels
          ctx.fillStyle = '#94a3b8';
          ctx.font = '10px Inter, system-ui, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(formatPrice(priceVal), width - paddingRight + 6, y + 3);
        }

        // Vertical Time Grids
        const timeStep = Math.max(1, Math.floor(candleCount / 4));
        for (let i = 0; i < candleCount; i += timeStep) {
          const c = visibleCandles[i];
          if (!c) continue;
          const x = paddingLeft + i * candleSlotWidth + candleSlotWidth / 2;

          ctx.beginPath();
          ctx.moveTo(x, paddingTop);
          ctx.lineTo(x, height - paddingBottom);
          ctx.stroke();

          // Bottom time label
          ctx.fillStyle = '#94a3b8';
          ctx.font = '10px Inter, system-ui, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(formatTime(c.epoch), x, height - 8);
        }

        // -------------------------------------------------------------
        // DRAW TECHNICAL INDICATOR OVERLAYS
        // -------------------------------------------------------------
        const startIndex = Math.max(0, displayCandles.length - visibleCandles.length);

        // 1. Bollinger Bands
        if (showBollinger && indicators?.bollingerBands) {
          const { upper, lower } = indicators.bollingerBands;
          if (upper && lower && upper.length > 0 && lower.length > 0) {
            // Draw Bollinger Cloud
            ctx.beginPath();
            for (let i = 0; i < visibleCandles.length; i++) {
              const fullIdx = startIndex + i;
              const x = paddingLeft + i * candleSlotWidth + candleSlotWidth / 2;
              const yUpper = getY(upper[fullIdx] ?? visibleCandles[i].close);
              if (i === 0) ctx.moveTo(x, yUpper);
              else ctx.lineTo(x, yUpper);
            }
            for (let i = visibleCandles.length - 1; i >= 0; i--) {
              const fullIdx = startIndex + i;
              const x = paddingLeft + i * candleSlotWidth + candleSlotWidth / 2;
              const yLower = getY(lower[fullIdx] ?? visibleCandles[i].close);
              ctx.lineTo(x, yLower);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(59, 130, 246, 0.04)';
            ctx.fill();

            // Draw Upper/Lower Lines
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';

            // Upper Line
            ctx.beginPath();
            for (let i = 0; i < visibleCandles.length; i++) {
              const fullIdx = startIndex + i;
              const x = paddingLeft + i * candleSlotWidth + candleSlotWidth / 2;
              const y = getY(upper[fullIdx] ?? visibleCandles[i].close);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Lower Line
            ctx.beginPath();
            for (let i = 0; i < visibleCandles.length; i++) {
              const fullIdx = startIndex + i;
              const x = paddingLeft + i * candleSlotWidth + candleSlotWidth / 2;
              const y = getY(lower[fullIdx] ?? visibleCandles[i].close);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        // 2. EMA Ribbons
        if (showEma && indicators) {
          const drawEmaLine = (emaData: number[], color: string, lineWidth = 1.5) => {
            if (!emaData || emaData.length === 0) return;
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            let started = false;
            for (let i = 0; i < visibleCandles.length; i++) {
              const fullIdx = startIndex + i;
              const val = emaData[fullIdx];
              if (val === undefined || isNaN(val)) continue;
              const x = paddingLeft + i * candleSlotWidth + candleSlotWidth / 2;
              const y = getY(val);
              if (!started) {
                ctx.moveTo(x, y);
                started = true;
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.stroke();
          };

          if (indicators.ema9) drawEmaLine(indicators.ema9, '#06b6d4', 1.8);
          if (indicators.ema21) drawEmaLine(indicators.ema21, '#f59e0b', 1.5);
          if (indicators.ema50) drawEmaLine(indicators.ema50, '#8b5cf6', 1.2);
        }

        // 3. SuperTrend Overlay Line
        if (showSuperTrend && indicators?.superTrend) {
          const { trend, superTrendLine } = indicators.superTrend;
          if (trend && superTrendLine) {
            ctx.lineWidth = 2;
            for (let i = 1; i < visibleCandles.length; i++) {
              const fullIdx = startIndex + i;
              const prevIdx = fullIdx - 1;
              const currentTrend = trend[fullIdx];
              const val1 = superTrendLine[prevIdx];
              const val2 = superTrendLine[fullIdx];

              if (val1 === undefined || val2 === undefined || isNaN(val1) || isNaN(val2)) continue;

              const x1 = paddingLeft + (i - 1) * candleSlotWidth + candleSlotWidth / 2;
              const y1 = getY(val1);
              const x2 = paddingLeft + i * candleSlotWidth + candleSlotWidth / 2;
              const y2 = getY(val2);

              ctx.strokeStyle = currentTrend === 'UP' ? '#10b981' : '#ef4444';
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
            }
          }
        }

        // -------------------------------------------------------------
        // DRAW CANDLESTICKS (Real-time Green / Red Deriv format)
        // -------------------------------------------------------------
        visibleCandles.forEach((c, idx) => {
          if (!c) return;
          const xCenter = paddingLeft + idx * candleSlotWidth + candleSlotWidth / 2;
          const isGreen = c.close >= c.open;
          const color = isGreen ? '#00a79e' : '#ff444f';

          const yOpen = getY(c.open);
          const yClose = getY(c.close);
          const yHigh = getY(c.high);
          const yLow = getY(c.low);

          // Draw Wick
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(xCenter, yHigh);
          ctx.lineTo(xCenter, yLow);
          ctx.stroke();

          // Draw Body
          const bodyTop = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));
          const bodyLeft = xCenter - candleBodyWidth / 2;

          ctx.fillStyle = color;
          ctx.fillRect(bodyLeft, bodyTop, candleBodyWidth, bodyHeight);

          // Highlight hovered candle
          if (hoveredCandle?.index === idx) {
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(bodyLeft - 1, bodyTop - 1, candleBodyWidth + 2, bodyHeight + 2);
          }
        });

        // -------------------------------------------------------------
        // ACTIVE TRADE ENTRY MARKER
        // -------------------------------------------------------------
        if (activeTradeEntry && activeTradeEntry.entrySpot) {
          const entryY = getY(activeTradeEntry.entrySpot);
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = activeTradeEntry.tradeType === 'RISE' ? '#10b981' : '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(paddingLeft, entryY);
          ctx.lineTo(width - paddingRight, entryY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Trade Entry Badge
          ctx.fillStyle = activeTradeEntry.tradeType === 'RISE' ? '#10b981' : '#ef4444';
          ctx.fillRect(paddingLeft + 4, entryY - 10, 75, 20);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            `ENTRY ${activeTradeEntry.tradeType} @ ${formatPrice(activeTradeEntry.entrySpot)}`,
            paddingLeft + 41,
            entryY + 4
          );
        }

        // -------------------------------------------------------------
        // REAL-TIME PRICE LINE & RIGHT-AXIS BADGE
        // -------------------------------------------------------------
        if (visibleCandles.length > 0) {
          const latestCandle = visibleCandles[visibleCandles.length - 1];
          const currentPrice = liveQuote !== undefined && !isNaN(liveQuote) ? liveQuote : latestCandle.close;
          const currentY = getY(currentPrice);
          const lastCandleX = paddingLeft + (visibleCandles.length - 1) * candleSlotWidth + candleSlotWidth / 2;

          // Horizontal live price line extending to right axis
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(lastCandleX, currentY);
          ctx.lineTo(width - paddingRight, currentY);
          ctx.stroke();

          // Pulsing price anchor circle on latest candle
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(lastCandleX, currentY, 4, 0, Math.PI * 2);
          ctx.fill();

          // Black Deriv Right-Axis Badge
          const badgeWidth = 66;
          const badgeHeight = 22;
          const badgeX = width - paddingRight;
          const badgeY = currentY - badgeHeight / 2;

          ctx.fillStyle = '#0f172a';
          drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 4);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px Inter, system-ui, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(formatPrice(currentPrice), badgeX + badgeWidth / 2, currentY + 4);
        }

        ctx.restore();
      } catch (renderError) {
        console.error('Candle chart canvas render error:', renderError);
      }
    };

    animId = requestAnimationFrame(renderChart);
    return () => cancelAnimationFrame(animId);
  }, [
    dimensions,
    displayCandles,
    liveQuote,
    pipSize,
    showEma,
    showBollinger,
    showSuperTrend,
    hoveredCandle,
    indicators,
    activeTradeEntry,
  ]);

  // Handle Canvas Mouse Move for Crosshair / OHLC tooltip
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || displayCandles.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const paddingRight = 70;
    const paddingLeft = 10;
    const chartWidth = dimensions.width - paddingRight - paddingLeft;
    const maxVisibleCandles = 32;
    const visibleCandles = displayCandles.slice(-maxVisibleCandles);
    const candleSlotWidth = chartWidth / Math.max(visibleCandles.length, 15);

    const candleIdx = Math.floor((x - paddingLeft) / candleSlotWidth);
    if (candleIdx >= 0 && candleIdx < visibleCandles.length) {
      setHoveredCandle({
        candle: visibleCandles[candleIdx],
        x,
        y,
        index: candleIdx,
      });
    } else {
      setHoveredCandle(null);
    }
  };

  const handleMouseLeave = () => setHoveredCandle(null);

  const activeCandleForBar = hoveredCandle?.candle || displayCandles[displayCandles.length - 1];

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none w-screen h-screen' : 'w-full'
      }`}
    >
      {/* Top Chart Header / Timeframe & Live OHLC Stats Bar */}
      <div className="flex flex-wrap items-center justify-between px-3.5 py-2.5 bg-slate-50/90 border-b border-slate-200 text-xs gap-2 select-none">
        {/* Left: Timeframe Button & Live Candle Countdown */}
        <div className="flex items-center space-x-2">
          {/* Timeframe Selector Pill (Matches screenshot 1m button) */}
          <div className="flex items-center rounded-xl bg-white border border-slate-200 p-0.5 shadow-xs">
            {['1m', '2m', '5m', '15m'].map((tf) => (
              <button
                key={tf}
                onClick={() => onChangeTimeframe(tf)}
                className={`px-2.5 py-1 text-[11px] font-extrabold rounded-lg transition-all flex items-center gap-1 ${
                  timeframe === tf
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <TrendingUp className="w-3 h-3" />
                <span>{tf}</span>
              </button>
            ))}
          </div>

          {/* 1m Candle Timer Countdown */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-mono text-[11px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Candle Closes: {candleCountdownSeconds}s</span>
          </div>
        </div>

        {/* Center/Right: Live OHLC Display */}
        {activeCandleForBar && (
          <div className="flex items-center space-x-3 text-[11px] font-mono font-bold text-slate-600">
            <span>O: <strong className="text-slate-900">{formatPrice(activeCandleForBar.open)}</strong></span>
            <span>H: <strong className="text-emerald-600">{formatPrice(activeCandleForBar.high)}</strong></span>
            <span>L: <strong className="text-rose-600">{formatPrice(activeCandleForBar.low)}</strong></span>
            <span>C: <strong className={activeCandleForBar.close >= activeCandleForBar.open ? 'text-emerald-600' : 'text-rose-600'}>
              {formatPrice(activeCandleForBar.close)}
            </strong></span>
          </div>
        )}

        {/* Right: Indicator Controls & Fullscreen */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowEma(!showEma)}
            className={`p-1.5 rounded-lg text-[10px] font-bold border transition-all ${
              showEma ? 'bg-cyan-50 border-cyan-300 text-cyan-700' : 'bg-white border-slate-200 text-slate-400'
            }`}
            title="Toggle EMA 9/21/50 Ribbons"
          >
            EMA
          </button>
          <button
            onClick={() => setShowBollinger(!showBollinger)}
            className={`p-1.5 rounded-lg text-[10px] font-bold border transition-all ${
              showBollinger ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-slate-400'
            }`}
            title="Toggle Bollinger Bands (20, 2)"
          >
            BB
          </button>
          <button
            onClick={() => setShowSuperTrend(!showSuperTrend)}
            className={`p-1.5 rounded-lg text-[10px] font-bold border transition-all ${
              showSuperTrend ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-400'
            }`}
            title="Toggle SuperTrend Line"
          >
            SuperTrend
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="relative w-full h-[360px] sm:h-[400px] bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="absolute inset-0 w-full h-full cursor-crosshair block"
        />

        {/* Floating Indicator Legend (Top-Left of Chart) */}
        <div className="absolute top-2 left-3 flex items-center space-x-2 text-[10px] font-bold font-mono pointer-events-none opacity-80">
          {showEma && (
            <>
              <span className="text-cyan-600">EMA9</span>
              <span className="text-amber-600">EMA21</span>
              <span className="text-purple-600">EMA50</span>
            </>
          )}
          {showBollinger && <span className="text-blue-600">BB (20, 2)</span>}
          {showSuperTrend && <span className="text-emerald-600">SuperTrend</span>}
        </div>
      </div>
    </div>
  );
};
