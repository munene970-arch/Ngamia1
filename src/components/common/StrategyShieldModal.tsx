import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, X, RotateCcw, Sliders, Activity, Radio, Lock } from 'lucide-react';
import { StrategyShieldPanel } from '../BotStudio/StrategyShieldPanel';
import { strategyShield } from '../../services/strategyShield';
import { derivWS } from '../../services/derivWebSocket';

interface StrategyShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StrategyShieldModal: React.FC<StrategyShieldModalProps> = ({ isOpen, onClose }) => {
  const [currentPingMs, setCurrentPingMs] = useState<number>(() => derivWS.getPingMs() || 28);
  const [shieldLossStreak, setShieldLossStreak] = useState<number>(() => strategyShield.getConsecutiveLosses());
  const [circuitBreakerSec, setCircuitBreakerSec] = useState<number>(() => strategyShield.getRemainingCircuitBreakerSec());

  useEffect(() => {
    if (!isOpen) return;

    const interval = window.setInterval(() => {
      setCurrentPingMs(derivWS.getPingMs() || 28);
      setShieldLossStreak(strategyShield.getConsecutiveLosses());
      setCircuitBreakerSec(strategyShield.getRemainingCircuitBreakerSec());
    }, 500);

    return () => window.clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-900/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-wide">
                  Strategy Shield & Anti-Manipulation Protection
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-400 font-mono">
                  GLOBAL (ALL TRADES)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Active on Trading Terminal, Bot Studio, Market Scanner & AutoTrader
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          <StrategyShieldPanel
            currentPingMs={currentPingMs}
            consecutiveLosses={shieldLossStreak}
            circuitBreakerSec={circuitBreakerSec}
            onResetCircuitBreaker={() => {
              strategyShield.resetCircuitBreaker();
              setCircuitBreakerSec(0);
              setShieldLossStreak(0);
            }}
          />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Real-time protection layer enforcing slippage, timing jitter & circuit breakers</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
