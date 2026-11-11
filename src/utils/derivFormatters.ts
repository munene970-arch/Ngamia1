import { MarketSymbol } from '../types/deriv';

export function getMarketPipSize(symbol: MarketSymbol | string): number {
  if (symbol.includes('1HZ10V') || symbol.includes('1HZ15V') || symbol.includes('1HZ25V') || symbol.includes('1HZ30V') || symbol === 'R_10' || symbol === 'R_25') {
    return 3;
  }
  if (symbol.includes('1HZ50V') || symbol === 'R_50') {
    return 4;
  }
  if (symbol.includes('1HZ75V') || symbol === 'R_75') {
    return 4;
  }
  if (symbol.includes('1HZ90V') || symbol.includes('1HZ100V') || symbol === 'R_100') {
    return 2;
  }
  if (symbol.includes('CRASH') || symbol.includes('BOOM') || symbol.includes('STEP')) {
    return 2;
  }
  return 2;
}

export function formatQuotePrice(quote: number, symbol?: MarketSymbol | string): string {
  const pipSize = symbol ? getMarketPipSize(symbol) : 2;
  return Number(quote).toLocaleString('en-US', {
    minimumFractionDigits: pipSize,
    maximumFractionDigits: pipSize,
  });
}
