import React from 'react';
import { AppLayoutId, APP_LAYOUT_PRESETS } from '../../types/layout';
import {
  Zap,
  CircleDot,
  Bot,
  Grid,
  Check,
  Sparkles,
  ArrowRight,
  X,
  LayoutGrid,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLayout: AppLayoutId;
  onSelectLayout: (layoutId: AppLayoutId) => void;
}

export const LayoutSelectorModal: React.FC<LayoutSelectorModalProps> = ({
  isOpen,
  onClose,
  currentLayout,
  onSelectLayout,
}) => {
  if (!isOpen) return null;

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Zap':
        return <Zap className="w-5 h-5 text-amber-400" />;
      case 'CircleDot':
        return <CircleDot className="w-5 h-5 text-red-500" />;
      case 'Bot':
        return <Bot className="w-5 h-5 text-cyan-400" />;
      case 'Grid':
        return <Grid className="w-5 h-5 text-emerald-400" />;
      default:
        return <LayoutGrid className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-5xl w-full shadow-2xl space-y-6 my-8 max-h-[90vh] overflow-y-auto"
        >
          {/* Modal Header */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> APP WORKSPACE LAYOUT SHOWCASE
              </div>
              <h2 className="text-2xl font-black text-white mt-1">
                Choose Your Preferred Workspace Layout
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                Select from 4 specialized interface layouts tailored for manual trading, statistical digit radar, automated DBot execution, or multi-market monitoring.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 4 Layout Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {APP_LAYOUT_PRESETS.map((preset) => {
              const isSelected = currentLayout === preset.id;
              return (
                <div
                  key={preset.id}
                  id={`layout-card-${preset.id}`}
                  onClick={() => {
                    onSelectLayout(preset.id);
                    onClose();
                  }}
                  className={`p-5 sm:p-6 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between group ${
                    isSelected
                      ? 'bg-slate-950/90 border-amber-500 shadow-2xl ring-2 ring-amber-500/30'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 hover:bg-slate-950/80'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Header with Icon, Badge, and Selection State */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                          {getIcon(preset.iconName)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-white group-hover:text-amber-400 transition-colors">
                              {preset.name}
                            </h3>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-500">
                            {preset.tagline}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {preset.badge}
                      </span>
                    </div>

                    {/* Layout Wireframe Mockup Preview */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 h-28 flex flex-col justify-between text-[9px] font-mono text-slate-500 overflow-hidden relative">
                      {preset.id === 'pro_terminal' && (
                        <div className="h-full flex flex-col justify-between gap-1.5">
                          <div className="h-4 bg-slate-800 rounded-lg w-full flex items-center px-2 text-[8px] text-slate-400">
                            Top Market Ticker & Live Spot
                          </div>
                          <div className="flex-1 grid grid-cols-3 gap-1.5">
                            <div className="col-span-2 bg-slate-800/60 rounded-lg p-1.5 flex flex-col justify-between">
                              <div className="flex gap-1 justify-center">
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                                  <div key={d} className="w-3 h-3 rounded-full bg-red-950 border border-red-500 text-[6px] text-center" />
                                ))}
                              </div>
                              <div className="h-4 bg-slate-950 rounded flex items-center justify-center text-[7px] text-emerald-400">
                                Live Candlestick & Tick Path
                              </div>
                            </div>
                            <div className="bg-slate-800/80 rounded-lg p-1.5 flex flex-col justify-between text-[7px] text-amber-300">
                              <div>Fast Scalp Dock</div>
                              <div className="h-3 bg-red-600 rounded text-white text-[6px] text-center pt-0.5">BUY DIFF</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {preset.id === 'digit_specialist' && (
                        <div className="h-full flex flex-col justify-between gap-1.5">
                          <div className="flex-1 bg-red-950/20 border border-red-900/40 rounded-lg p-2 flex flex-col justify-between">
                            <div className="text-[8px] font-black text-red-400 text-center">10 Circular Deriv Digit Gauges (0–9)</div>
                            <div className="flex justify-around items-center">
                              {[0, 2, 4, 6, 8].map((d) => (
                                <div key={d} className="w-4 h-4 rounded-full border border-red-500 flex items-center justify-center text-[7px] text-white">
                                  {d}
                                </div>
                              ))}
                            </div>
                            <div className="h-2 bg-slate-950 rounded-full flex overflow-hidden">
                              <div className="bg-emerald-500 w-1/2" />
                              <div className="bg-indigo-500 w-1/2" />
                            </div>
                          </div>
                        </div>
                      )}

                      {preset.id === 'bot_operator' && (
                        <div className="h-full grid grid-cols-3 gap-1.5">
                          <div className="bg-slate-800/70 rounded-lg p-1.5 text-[7px] text-cyan-300 flex flex-col justify-between">
                            <div>XXY Strategy</div>
                            <div className="h-2 bg-slate-950 rounded" />
                          </div>
                          <div className="col-span-2 bg-slate-800/50 rounded-lg p-1.5 flex flex-col justify-between text-[7px]">
                            <div className="text-white font-black">[X, X, Y] Memory Inspector</div>
                            <div className="h-3 bg-emerald-600/30 border border-emerald-500 rounded text-emerald-300 text-[6px] px-1">
                              Running Martingale Auto-Trader
                            </div>
                          </div>
                        </div>
                      )}

                      {preset.id === 'multi_market_grid' && (
                        <div className="h-full grid grid-cols-2 gap-1.5">
                          {['Vol 100', 'Vol 75', 'Crash 500', 'Boom 1000'].map((m) => (
                            <div key={m} className="bg-slate-800/60 rounded-lg p-1 flex items-center justify-between text-[7px] text-slate-300">
                              <span>{m}</span>
                              <span className="text-emerald-400 font-mono">LIVE</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <p className="text-slate-400 text-xs leading-relaxed">
                      {preset.description}
                    </p>

                    {/* Key Features List */}
                    <div className="space-y-1.5 pt-1">
                      {preset.features.map((feat, i) => (
                        <div key={i} className="flex items-center gap-2 text-[11px] text-slate-300 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Switch Button */}
                  <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Ideal for: <strong className="text-slate-300">{preset.idealFor.slice(0, 30)}...</strong>
                    </span>
                    <button
                      className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" /> Active Layout
                        </>
                      ) : (
                        <>
                          Select Layout <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer close button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
