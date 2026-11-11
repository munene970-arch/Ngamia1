import React, { useEffect, useRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  LineStyle,
  AreaSeries,
  LineSeries,
  UTCTimestamp,
} from 'lightweight-charts';

export interface ChartPricePoint {
  time: number; // Unix timestamp in seconds
  value: number;
}

export interface TradingViewChartProps {
  data: ChartPricePoint[];
  ema9Data?: ChartPricePoint[];
  ema21Data?: ChartPricePoint[];
  bbUpperData?: ChartPricePoint[];
  bbLowerData?: ChartPricePoint[];
  bbMidData?: ChartPricePoint[];
  height?: number;
  pipSize?: number;
  symbol: string;
  showIndicators?: boolean;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  data,
  ema9Data = [],
  ema21Data = [],
  bbUpperData = [],
  bbLowerData = [],
  bbMidData = [],
  height = 260,
  pipSize = 4,
  symbol,
  showIndicators = true,
}) => {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMidSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Initialize TradingView Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' },
        textColor: '#94a3b8',
        fontSize: 11,
        fontFamily: 'monospace, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.5)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.5)' },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: '#34d399',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#064e3b',
        },
        horzLine: {
          color: '#34d399',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#064e3b',
        },
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 5,
        barSpacing: 8,
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        autoScale: true,
        scaleMargins: {
          top: 0.15,
          bottom: 0.15,
        },
      },
    });

    chartRef.current = chart;

    // 1. Bollinger Band Upper (Dashed sky-blue)
    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: 'rgba(56, 189, 248, 0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: 'BB Upper (+2σ)',
      priceLineVisible: false,
    });
    bbUpperSeriesRef.current = bbUpperSeries;

    // 2. Bollinger Band Lower (Dashed sky-blue)
    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: 'rgba(56, 189, 248, 0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      title: 'BB Lower (-2σ)',
      priceLineVisible: false,
    });
    bbLowerSeriesRef.current = bbLowerSeries;

    // 3. Bollinger Band Mid (SMA 20)
    const bbMidSeries = chart.addSeries(LineSeries, {
      color: 'rgba(148, 163, 184, 0.35)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      title: 'BB Mid',
      priceLineVisible: false,
    });
    bbMidSeriesRef.current = bbMidSeries;

    // 4. EMA 21 Series (Orange / Gold)
    const ema21Series = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      title: 'EMA 21',
      priceLineVisible: false,
    });
    ema21SeriesRef.current = ema21Series;

    // 5. EMA 9 Series (Cyan)
    const ema9Series = chart.addSeries(LineSeries, {
      color: '#06b6d4',
      lineWidth: 2,
      title: 'EMA 9',
      priceLineVisible: false,
    });
    ema9SeriesRef.current = ema9Series;

    // 6. Area Price Series (Emerald)
    const priceSeries = chart.addSeries(AreaSeries, {
      topColor: 'rgba(16, 185, 129, 0.35)',
      bottomColor: 'rgba(16, 185, 129, 0.0)',
      lineColor: '#10b981',
      lineWidth: 2,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineColor: '#10b981',
      priceLineStyle: LineStyle.Dotted,
    });
    priceSeriesRef.current = priceSeries;

    // Handle responsive container resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [height]);

  // Update Data across all series
  useEffect(() => {
    if (!chartRef.current || !priceSeriesRef.current) return;

    if (data.length > 0) {
      // Ensure time points are strictly sorted ascending and unique
      const sortedPrices = formatUniqueTimes(data);
      if (sortedPrices.length > 0) {
        priceSeriesRef.current.setData(sortedPrices as any);
      }
    }

    if (showIndicators) {
      if (ema9SeriesRef.current && ema9Data.length > 0) {
        const sorted = formatUniqueTimes(ema9Data);
        ema9SeriesRef.current.setData(sorted as any);
      }
      if (ema21SeriesRef.current && ema21Data.length > 0) {
        const sorted = formatUniqueTimes(ema21Data);
        ema21SeriesRef.current.setData(sorted as any);
      }
      if (bbUpperSeriesRef.current && bbUpperData.length > 0) {
        const sorted = formatUniqueTimes(bbUpperData);
        bbUpperSeriesRef.current.setData(sorted as any);
      }
      if (bbLowerSeriesRef.current && bbLowerData.length > 0) {
        const sorted = formatUniqueTimes(bbLowerData);
        bbLowerSeriesRef.current.setData(sorted as any);
      }
      if (bbMidSeriesRef.current && bbMidData.length > 0) {
        const sorted = formatUniqueTimes(bbMidData);
        bbMidSeriesRef.current.setData(sorted as any);
      }
    }
  }, [data, ema9Data, ema21Data, bbUpperData, bbLowerData, bbMidData, showIndicators]);

  return (
    <div className="w-full relative rounded-xl overflow-hidden border border-slate-800 bg-[#090d16]">
      {/* Legend Overlay Header */}
      <div className="absolute top-2 left-3 z-10 flex items-center gap-2.5 text-[11px] font-mono pointer-events-none select-none bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800/80 backdrop-blur-sm">
        <span className="font-bold text-white">{symbol}</span>
        <span className="flex items-center gap-1 text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Price</span>
        </span>
        {showIndicators && (
          <>
            <span className="flex items-center gap-1 text-cyan-400">
              <span className="w-2 h-0.5 bg-cyan-400" />
              <span>EMA 9</span>
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-0.5 bg-amber-400" />
              <span>EMA 21</span>
            </span>
            <span className="flex items-center gap-1 text-sky-400">
              <span className="w-2 h-0.5 border-t border-dashed border-sky-400" />
              <span>BB (20,2)</span>
            </span>
          </>
        )}
      </div>

      {/* Chart Container Canvas */}
      <div ref={chartContainerRef} className="w-full h-full" style={{ height: `${height}px` }} />
    </div>
  );
};

// Helper: Guarantee strictly ascending non-duplicate timestamps for TradingView
function formatUniqueTimes(data: ChartPricePoint[]): { time: UTCTimestamp; value: number }[] {
  if (!data || data.length === 0) return [];
  const map = new Map<number, number>();
  let lastTime = 0;

  for (const item of data) {
    let t = Math.floor(item.time);
    if (t <= lastTime) {
      t = lastTime + 1; // Ensure strictly increasing timestamp
    }
    lastTime = t;
    map.set(t, item.value);
  }

  const result: { time: UTCTimestamp; value: number }[] = [];
  map.forEach((val, t) => {
    result.push({ time: t as UTCTimestamp, value: val });
  });

  return result.sort((a, b) => (a.time as number) - (b.time as number));
}
