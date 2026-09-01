import React from 'react';
import { MarketSymbol, MarketInfo, DBotStrategy } from '../../types/deriv';
import { SystemAutoTerminal } from '../Terminal/SystemAutoTerminal';
import { DBotStudio } from '../BotStudio/DBotStudio';
import { Bot, Cpu, Sparkles } from 'lucide-react';

interface BotOperatorLayoutProps {
  markets: MarketInfo[];
  selectedSymbol: MarketSymbol;
  balanceUsd: number;
  onUpdateBalance: (newBalance: number) => void;
  activeBotOverride?: DBotStrategy | null;
}

export const BotOperatorLayout: React.FC<BotOperatorLayoutProps> = ({
  markets,
  selectedSymbol,
  balanceUsd,
  onUpdateBalance,
  activeBotOverride,
}) => {
  return (
    <div id="bot-operator-layout" className="space-y-6">
      {/* Bot Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
              <span>ALGORITHMIC OPERATOR MODE • CONTINUOUS PATTERN EXECUTION</span>
            </div>
            <h1 className="text-xl font-black text-white">Deriv Algorithmic Command Center</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">Current Balance:</span>
          <span className="text-sm font-mono font-black text-emerald-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            ${balanceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* System Auto Differ Super Fast Terminal */}
      <SystemAutoTerminal
        markets={markets}
        selectedSymbol={selectedSymbol}
        onSelectSymbol={() => {}}
        balanceUsd={balanceUsd}
        onUpdateBalance={onUpdateBalance}
        activeContracts={[]}
      />

      {/* Complete DBot Studio Strategy Runner */}
      <DBotStudio
        markets={markets}
        balanceUsd={balanceUsd}
        onUpdateBalance={onUpdateBalance}
        activeBotOverride={activeBotOverride}
      />
    </div>
  );
};
