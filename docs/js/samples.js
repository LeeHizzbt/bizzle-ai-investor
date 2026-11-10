/* Ai Investor v4.20 — original EXAMPLE strategies (written for this app; for learning, not advice). */
(function (root) {
  var S = [
    { id: 'ex-trend', name: 'Trend Rider (example)', description: 'Holds the strongest sector/index ETFs while they trade above their 200-day average.',
      idea: 'Own the 3 strongest US index and sector ETFs over the last 6 months, but only while each is above its 200-day average. Sell if it drops below the 200-day or falls 10% from its best close.',
      rules: { name: 'Trend Rider (example)', universe: ['SPY', 'QQQ', 'IWM', 'DIA', 'XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLP'],
        entry: { all: [{ left: { ind: 'close' }, op: '>', right: { ind: 'sma', period: 200 } }, { left: { ind: 'return', period: 126 }, op: '>', right: { value: 0 } }] },
        rank: { by: { ind: 'return', period: 126 }, order: 'desc' }, sizing: { type: 'equal_weight' }, maxPositions: 3,
        exit: { any: [{ left: { ind: 'close' }, op: '<', right: { ind: 'sma', period: 200 } }], trailingStopPct: 10 } } },
    { id: 'ex-rsi', name: 'RSI Dip Buyer (example)', description: 'Buys big US companies when RSI is oversold inside an uptrend; quick exits.',
      idea: 'Buy large US companies when RSI(14) drops below 30 while the price is still above the 200-day average. Sell when RSI recovers above 55, after 15 trading days, or at a 7% loss.',
      rules: { name: 'RSI Dip Buyer (example)', universe: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'JPM', 'XOM', 'UNH', 'COST'],
        entry: { all: [{ left: { ind: 'rsi', period: 14 }, op: '<', right: { value: 30 } }, { left: { ind: 'close' }, op: '>', right: { ind: 'sma', period: 200 } }] },
        rank: { by: { ind: 'rsi', period: 14 }, order: 'asc' }, sizing: { type: 'percent_equity', value: 20 }, maxPositions: 5,
        exit: { any: [{ left: { ind: 'rsi', period: 14 }, op: '>', right: { value: 55 } }], stopLossPct: 7, maxHoldDays: 15 } } },
    { id: 'ex-cross', name: 'Golden Cross ETFs (example)', description: 'Classic 50/200-day moving-average cross on major ETFs.',
      idea: 'Buy an index ETF when its 50-day average crosses above its 200-day average, and sell when it crosses back below.',
      rules: { name: 'Golden Cross ETFs (example)', universe: ['SPY', 'QQQ', 'IWM', 'DIA', 'XLK', 'XLF'],
        entry: { all: [{ left: { ind: 'sma', period: 50 }, op: '>', right: { ind: 'sma', period: 200 } }, { left: { ind: 'close' }, op: '>', right: { ind: 'sma', period: 50 } }] },
        sizing: { type: 'equal_weight' }, maxPositions: 6,
        exit: { any: [{ left: { ind: 'sma', period: 50 }, op: 'crosses_below', right: { ind: 'sma', period: 200 } }] } } },
    { id: 'ex-breakout', name: 'Volume Breakout (example)', description: 'Buys mega-caps closing at a new 55-day high on heavy volume; trailing stop.',
      idea: 'Buy a mega-cap stock when it closes above its highest close of the prior 55 days on at least 1.3x its 20-day average volume. Exit on an 8% trailing stop or 15% gain.',
      rules: { name: 'Volume Breakout (example)', universe: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'AVGO', 'TSLA'],
        entry: { all: [{ left: { ind: 'close' }, op: '>', right: { ind: 'highest', period: 55 } }, { left: { ind: 'volume' }, op: '>', right: { ind: 'avg_volume', period: 20, mult: 1.3 } }] },
        rank: { by: { ind: 'return', period: 20 }, order: 'desc' }, sizing: { type: 'percent_equity', value: 25 }, maxPositions: 4,
        exit: { trailingStopPct: 8, takeProfitPct: 15 } } }
  ];
  if (typeof module !== 'undefined') module.exports = S; else root.SAMPLES = S;
})(typeof window !== 'undefined' ? window : this);
