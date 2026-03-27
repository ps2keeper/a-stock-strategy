export interface StrategyConfig {
  enable_kline: boolean;
  enable_volume: boolean;
  enable_ma: boolean;
  enable_macd: boolean;
  enable_kdj: boolean;
  enable_rsi: boolean;
  enable_boll: boolean;
  vol_ratio_threshold: number;
  kdj_oversold_threshold: number;
  rsi_oversold_threshold: number;
  rsi_breakout: number;
  stop_loss_pct: number;
  ma_relaxed: boolean;
}

export interface Signal {
  pass: boolean;
  desc: string;
  value?: number;
  dif?: number;
  dea?: number;
  hist?: number;
  k?: number;
  d?: number;
  j?: number;
  upper?: number;
  mid?: number;
  lower?: number;
}

export interface KlineBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export interface ChartData {
  dates: string[];
  ma5: (number | null)[];
  ma10: (number | null)[];
  ma20: (number | null)[];
  ma60: (number | null)[];
  dif: (number | null)[];
  dea: (number | null)[];
  histogram: (number | null)[];
  k: (number | null)[];
  d: (number | null)[];
  j: (number | null)[];
  rsi: (number | null)[];
  boll_upper: (number | null)[];
  boll_mid: (number | null)[];
  boll_lower: (number | null)[];
  volume: number[];
  vol_ma5: (number | null)[];
}

export interface AnalysisResult {
  code: string;
  name: string;
  score: number;
  max_score: number;
  score_pct: number;
  passed_count: number;
  total_count: number;
  three_confirm: boolean;
  recommendation: string;
  suggestion: string;
  color: "green" | "yellow" | "orange" | "red";
  entry_price: number;
  stop_loss: number;
  signals: Record<string, Signal>;
  kline_data: KlineBar[];
  chart: ChartData;
  error?: string;
}

// ─────────────────────────── 持仓 & 组合 ────────────────────────────

export interface Position {
  id: string;          // uuid
  code: string;        // 股票代码
  name: string;        // 股票名称
  shares: number;      // 持股数量（股）
  costPrice: number;   // 成本价（均价）
  // 实时行情填充（从后端拉取）
  currentPrice?: number;
  lastUpdated?: string; // ISO timestamp
}

export interface Portfolio {
  cash: number;           // 现金（元）
  positions: Position[];
  updatedAt: string;      // ISO timestamp
}

export interface PositionWithCalc extends Position {
  marketValue: number;    // 市值 = shares * currentPrice
  cost: number;           // 持仓成本 = shares * costPrice
  pnl: number;            // 浮盈亏 = marketValue - cost
  pnlPct: number;         // 盈亏百分比
  weight: number;         // 占总资产比例
  stopLossPrice: number;  // 止损价（costPrice * (1 - stop_loss_pct)）
  stopLossTriggered: boolean; // 是否触及止损价
}

export interface RiskMetrics {
  totalAssets: number;       // 总资产 = 持仓市值 + 现金
  stockValue: number;        // 持仓总市值
  cashValue: number;         // 现金
  stockRatio: number;        // 仓位比例 = stockValue / totalAssets
  cashRatio: number;         // 现金比例
  maxSingleWeight: number;   // 最大单股占比
  stopLossCount: number;     // 触及止损数量
  unrealizedPnl: number;     // 总浮盈亏
  unrealizedPnlPct: number;  // 总浮盈亏%
  riskLevel: "低风险" | "中等风险" | "高风险" | "极高风险";
  riskScore: number;         // 0-100
  warnings: string[];        // 风险警告列表
}

export type MarketOverview = {
  sh_index?: { close: number; pct_chg: number; data: { date: string; close: number }[] };
  sz_index?: { close: number; pct_chg: number };
  limit_up?: number;
  limit_down?: number;
  rise_count?: number;
  fall_count?: number;
  activity_rate?: string;
  sentiment?: string;
  north_flow?: string | null;
  error?: string;
};
