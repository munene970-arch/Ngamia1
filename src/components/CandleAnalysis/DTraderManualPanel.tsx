import React, { useState } from 'react';
import { MarketInfo, MarketSymbol, ActiveContract } from '../../types/deriv';
import { Plus, X, ChevronDown, Check, ArrowUpRight, ArrowDownRight, Clock, ShieldCheck, Zap } from 'lucide-react';
import { derivWS } from '../../services/derivWebSocket';

interface DTraderManualPanelProps {
  markets: MarketInfo[];
  selectedSymbol: MarketSymbol;
  onSelectSymbol: (symbol: MarketSymbol) => void;
  balanceUsd: number;
  onUpdateBalance?: (newBal: number) => void;
  activeContracts: ActiveContract[];
  liveQuote?: number;
  pipSize?: number;
}

export const DTraderManualPanel: React.FC<DTraderManualPanelProps> = ({
  markets,
  selectedSymbol,
  onSelectSymbol,
  balanceUsd,
  onUpdateBalance,
  activeContracts,
  liveQuote,
  pipSize = 2,
}) => {
  const [tradeDirection, setTradeDirection] = useState<'RISE' | 'FALL'>('RISE');
  const [stake, setStake] = useState<number>(1);
  const [durationValue, setDurationValue] = useState<number>(1);
  const [durationUnit, setDurationUnit] = useState<'m' | 't'>('m');
  const [allowEquals, setAllowEquals] = useState<boolean>(false);
  const [showMarketDropdown, setShowMarketDropdown] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  const safeMarkets = markets && markets.length > 0 ? markets : [];
  const activeMarket =
    safeMarkets.find((m) => m?.symbol === selectedSymbol) ||
    safeMarkets[0] || {
      symbol: selectedSymbol || 'R_100',
      displayName: 'Volatility 100 Index',
      currentPrice: 727.5,
    };

  // Calculated Payout (Deriv synthetic ~92% payout rate)
  const payoutMultiplier = 1.92;
  const potentialPayout = Number((stake * payoutMultiplier).toFixed(2));
  const potentialProfit = Number((stake * (payoutMultiplier - 1)).toFixed(2));

  // Find active 1-minute or open contracts for this symbol
  const openContract = (activeContracts || []).find(
    (c) => c?.symbol === selectedSymbol && c?.status === 'OPEN'
  );

  const handleExecuteTrade = () => {
    if (stake <= 0 || isExecuting) return;
    setIsExecuting(true);

    const contractType = tradeDirection === 'RISE' ? 'CALL' : 'PUT';

    derivWS.purchaseContract({
      symbol: selectedSymbol || 'R_100',
      symbolName: activeMarket.displayName,
      contractType,
      stake,
      durationValue,
      durationUnit,
      durationTicks: durationUnit === 'm' ? durationValue * 60 : durationValue,
    });

    if (onUpdateBalance && balanceUsd >= stake) {
      onUpdateBalance(balanceUsd - stake);
    }

    setTimeout(() => {
      setIsExecuting(false);
    }, 400);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {/* Top Deriv Style Market Header (Matches Screenshot) */}
      <div className="p-3.5 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/50">
        <div className="flex items-center gap-2 flex-1 relative">
          <button
            onClick={() => setShowMarketDropdown(!showMarketDropdown)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl shadow-xs transition-all text-left flex-1"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">
              {(selectedSymbol || '').includes('1HZ') ? '1s' : 'Vol'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-slate-900 truncate">
                {activeMarket.displayName}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 font-semibold">
                <span>Rise/Fall</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>
            </div>
          </button>

          {/* Market Dropdown Menu */}
          {showMarketDropdown && (
            <div className="absolute top-full left-0 mt-1 w-72 max-h-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-y-auto p-1.5 space-y-1">
              <div className="text-[10px] font-black uppercase text-slate-400 px-2.5 py-1">
                Select Synthetic Market
              </div>
              {safeMarkets.map((m) => (
                <button
                  key={m.symbol}
                  onClick={() => {
                    onSelectSymbol(m.symbol);
                    setShowMarketDropdown(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold flex items-center justify-between transition-all ${
                    m.symbol === selectedSymbol
                      ? 'bg-red-50 text-red-600 font-black'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{m.displayName}</span>
                  {m.symbol === selectedSymbol && <Check className="w-3.5 h-3.5 text-red-600" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Trade Setup Form */}
      <div className="p-4 space-y-4">
        {/* Rise / Fall Segmented Tabs (Matches screenshot) */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setTradeDirection('RISE')}
            className={`py-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              tradeDirection === 'RISE'
                ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            <span>Rise</span>
          </button>
          <button
            onClick={() => setTradeDirection('FALL')}
            className={`py-2.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
              tradeDirection === 'FALL'
                ? 'bg-white text-[#ff444f] shadow-sm border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ArrowDownRight className="w-4 h-4 text-[#ff444f]" />
            <span>Fall</span>
          </button>
        </div>

        {/* Trade Parameters Row: Duration, Stake, Allow Equals */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Duration Selector */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
              <Clock className="w-3 h-3" /> Duration
            </label>
            <div className="mt-1 flex items-center gap-1">
              <input
                type="number"
                min="1"
                max="60"
                value={durationValue}
                onChange={(e) => setDurationValue(Math.max(1, Number(e.target.value)))}
                className="w-12 bg-transparent text-xs font-black text-slate-900 outline-none"
              />
              <select
                value={durationUnit}
                onChange={(e) => setDurationUnit(e.target.value as 'm' | 't')}
                className="bg-white border border-slate-200 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-slate-700 outline-none"
              >
                <option value="m">Minute(s)</option>
                <option value="t">Tick(s)</option>
              </select>
            </div>
          </div>

          {/* Stake Input Box (Matches Screenshot) */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Stake</label>
            <div className="mt-1 flex items-center justify-between">
              <input
                type="number"
                min="0.35"
                step="0.5"
                value={stake}
                onChange={(e) => setStake(Math.max(0.35, Number(e.target.value)))}
                className="w-16 bg-transparent text-xs font-black text-slate-900 outline-none"
              />
              <span className="text-[11px] font-bold text-slate-500 font-mono">USD</span>
            </div>
          </div>

          {/* Quick Stake Buttons */}
          <div className="col-span-2 flex items-center gap-1.5">
            {[1, 5, 10, 25, 50].map((val) => (
              <button
                key={val}
                onClick={() => setStake(val)}
                className={`flex-1 py-1 rounded-lg text-[10px] font-extrabold border transition-all ${
                  stake === val
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ${val}
              </button>
            ))}
          </div>

          {/* Allow Equals Box */}
          <div className="col-span-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Allow equals</span>
              <span className="text-xs font-bold text-slate-700">Win if exit equals entry spot</span>
            </div>
            <button
              onClick={() => setAllowEquals(!allowEquals)}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                allowEquals ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.75 transition-transform ${
                  allowEquals ? 'left-4.5' : 'left-0.75'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Primary Action Buy / Fall Button (Matches Screenshot Exact Style) */}
        <div className="pt-2">
          {tradeDirection === 'RISE' ? (
            <button
              id="btn-dtrader-buy-rise"
              onClick={handleExecuteTrade}
              disabled={isExecuting || balanceUsd < stake}
              className="w-full py-3.5 rounded-2xl bg-[#00a79e] hover:bg-[#00938b] active:scale-[0.99] text-white shadow-lg shadow-[#00a79e]/25 flex flex-col items-center justify-center transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-1.5 text-sm font-black uppercase tracking-wider">
                <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                <span>Buy (Rise)</span>
              </div>
              <div className="text-[11px] font-bold text-white/90 font-mono mt-0.5">
                Payout {potentialPayout} USD (+${potentialProfit})
              </div>
            </button>
          ) : (
            <button
              id="btn-dtrader-buy-fall"
              onClick={handleExecuteTrade}
              disabled={isExecuting || balanceUsd < stake}
              className="w-full py-3.5 rounded-2xl bg-[#ff444f] hover:bg-[#e03a45] active:scale-[0.99] text-white shadow-lg shadow-[#ff444f]/25 flex flex-col items-center justify-center transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-1.5 text-sm font-black uppercase tracking-wider">
                <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
                <span>Buy (Fall)</span>
              </div>
              <div className="text-[11px] font-bold text-white/90 font-mono mt-0.5">
                Payout {potentialPayout} USD (+${potentialProfit})
              </div>
            </button>
          )}
        </div>

        {/* Open Position Tracker Card (If active order on this market) */}
        {openContract && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 animate-pulse">
            <div className="flex items-center justify-between text-xs font-black text-emerald-900">
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                Active {openContract.contractType} Contract
              </span>
              <span className="font-mono">{openContract.remainingTicks}s remaining</span>
            </div>
            <div className="grid grid-cols-2 text-[11px] font-mono text-emerald-800">
              <div>Entry: {openContract.entrySpot}</div>
              <div>Current: {openContract.currentSpot}</div>
              <div>Stake: ${openContract.stake}</div>
              <div>Payout: ${openContract.potentialPayout}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
