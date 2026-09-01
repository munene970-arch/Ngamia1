export type AppLayoutId = 
  | 'pro_terminal'      // Standard Pro Trader Terminal Layout
  | 'bot_operator'      // Bot & Algorithmic Focus Layout
  | 'digit_specialist'  // Pure Deriv Circles & Statistical Digit Radar
  | 'multi_market_grid';// Quad Multi-Market Grid Command Station

export interface AppLayoutPreset {
  id: AppLayoutId;
  name: string;
  badge: string;
  tagline: string;
  description: string;
  iconName: string;
  idealFor: string;
  features: string[];
}

export const APP_LAYOUT_PRESETS: AppLayoutPreset[] = [
  {
    id: 'pro_terminal',
    name: 'Pro Trader Terminal',
    badge: 'FLAGSHIP',
    tagline: 'Balanced multi-panel trading terminal',
    description: 'Combines real-time Deriv circles, interactive price chart, double repeat scanner, and immediate order execution in a high-density workstation.',
    iconName: 'Zap',
    idealFor: 'Day traders, manual scalp execution, and multi-indicator technical analysis.',
    features: [
      'Live Deriv Circles with Moving Cursor',
      'Dual Tick Price Chart & EMA/Bollinger overlays',
      'Quick Scalp Order Dock with Stake & TP/SL',
      'Real-time Active Contracts & Settlement Feed'
    ]
  },
  {
    id: 'digit_specialist',
    name: 'Digit Specialist & Circle Radar',
    badge: 'DIGIT RADAR',
    tagline: 'Maximized 0–9 circular digit gauges & probability matrix',
    description: 'Positions the 10 live Deriv Circles, moving cursor worm, Even/Odd & Over/Under gauges front-and-center with 1-click Hot/Cold scalp execution.',
    iconName: 'CircleDot',
    idealFor: 'Differ/Match, Even/Odd, and Over/Under digit traders looking for maximum statistical clarity.',
    features: [
      'Expanded 10 Deriv Circular Digit Gauges (0–9)',
      'Live Moving Cursor with Directional Tick Worm',
      'Even vs Odd & Over vs Under Parity Split Bars',
      'Instant 1-Click Buy Differ / Match on Hot & Cold Digits'
    ]
  },
  {
    id: 'bot_operator',
    name: 'DBot Algorithmic Command',
    badge: 'AUTOMATION',
    tagline: 'Focused algorithmic strategy runner & pattern scanner',
    description: 'Designed for automated trading with XXY Pattern Scanner, S-Differ Quad Engine, Martingale configuration, sliding memory inspector, and live audit stream.',
    iconName: 'Bot',
    idealFor: 'Automated strategy runners, Martingale operators, and pattern-based bot traders.',
    features: [
      'XXY Pattern Sliding 3-Digit Memory Inspector',
      'Continuous 1-Tick Auto-Trader with Non-Colliding Engine',
      'Live Martingale Multiplier & Profit/Loss Gauges',
      'Real-time Bot Execution & Rule Audit Log'
    ]
  },
  {
    id: 'multi_market_grid',
    name: 'Multi-Market Command Grid',
    badge: 'QUAD VIEW',
    tagline: '4 synchronized live markets side-by-side',
    description: 'Monitors 4 Volatility and Crash/Boom synthetic markets simultaneously with synchronized live Deriv circles and instant execution triggers.',
    iconName: 'Grid',
    idealFor: 'Traders monitoring multiple synthetic indices simultaneously to spot the best probability setups.',
    features: [
      '4 Synchronized Live Deriv WebSocket Feeds',
      'Compact Deriv Circles Radar per Market',
      'One-Click Quick Differ / Rise / Fall Scalp triggers',
      'Aggregated Multi-Market Live Ticker & Spot Tracker'
    ]
  }
];
