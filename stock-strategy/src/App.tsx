import React, { useState, useCallback, useEffect } from "react";
import type { StrategyConfig, AnalysisResult } from "./types";
import { fetchAnalysis, fetchPrices } from "./api";
import { loadPortfolio, savePortfolio, updatePrices, calcRisk } from "./portfolio";
import { StrategyPanel } from "./components/StrategyPanel";
import { ScoreGauge } from "./components/ScoreGauge";
import { SignalList } from "./components/SignalList";
import { StockChart } from "./components/StockChart";
import { MarketBar } from "./components/MarketBar";
import { PortfolioPanel } from "./components/PortfolioPanel";
import { RiskDashboard } from "./components/RiskDashboard";
import type { Portfolio } from "./types";

const DEFAULT_CONFIG: StrategyConfig = {
  enable_kline: true,
  enable_volume: true,
  enable_ma: true,
  enable_macd: true,
  enable_kdj: true,
  enable_rsi: true,
  enable_boll: true,
  vol_ratio_threshold: 1.5,
  kdj_oversold_threshold: 20,
  rsi_oversold_threshold: 30,
  rsi_breakout: 50,
  stop_loss_pct: 0.07,
  ma_relaxed: false,
};

const CHART_TABS = [
  { key: "kline", label: "K线" },
  { key: "macd",  label: "MACD" },
  { key: "kdj",   label: "KDJ" },
  { key: "rsi",   label: "RSI" },
  { key: "boll",  label: "布林" },
] as const;

type ChartTab = (typeof CHART_TABS)[number]["key"];
type NavTab = "analyze" | "portfolio" | "risk";

const EXAMPLE_STOCKS = [
  { code: "000001", name: "平安银行" },
  { code: "000651", name: "格力电器" },
  { code: "000858", name: "五粮液" },
  { code: "600519", name: "贵州茅台" },
  { code: "601318", name: "中国平安" },
  { code: "300750", name: "宁德时代" },
];

export default function App() {
  const [navTab, setNavTab] = useState<NavTab>("analyze");
  const [config, setConfig] = useState<StrategyConfig>(DEFAULT_CONFIG);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartTab, setChartTab] = useState<ChartTab>("kline");

  // Portfolio state — persisted in localStorage
  const [portfolio, setPortfolioState] = useState<Portfolio>(loadPortfolio);
  const [refreshing, setRefreshing] = useState(false);

  const setPortfolio = useCallback((p: Portfolio) => {
    setPortfolioState(p);
    savePortfolio(p);
  }, []);

  const metrics = calcRisk(portfolio, config.stop_loss_pct);

  // Refresh prices from backend
  const handleRefreshPrices = useCallback(async () => {
    if (portfolio.positions.length === 0) return;
    setRefreshing(true);
    try {
      const codes = portfolio.positions.map((p) => p.code);
      const prices = await fetchPrices(codes);
      setPortfolio(updatePrices(portfolio, prices));
    } catch {
      // silently fail — prices stay at cost
    } finally {
      setRefreshing(false);
    }
  }, [portfolio, setPortfolio]);

  // Auto-refresh prices when switching to portfolio/risk tab
  useEffect(() => {
    if ((navTab === "portfolio" || navTab === "risk") && portfolio.positions.length > 0) {
      handleRefreshPrices();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navTab]);

  const analyze = useCallback(
    async (targetCode?: string) => {
      const c = (targetCode ?? code).trim();
      if (!c) return;
      setLoading(true);
      setError(null);
      setResult(null);
      setNavTab("analyze");
      try {
        const res = await fetchAnalysis(c, config);
        if (res.error) throw new Error(res.error);
        setResult(res);
        setChartTab("kline");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "分析失败，请检查股票代码或后端服务");
      } finally {
        setLoading(false);
      }
    },
    [code, config]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") analyze();
  };

  const colorMap: Record<string, string> = {
    green: "border-green-500/40 glow-green",
    yellow: "border-amber-500/40 glow-yellow",
    orange: "border-orange-500/40",
    red: "border-red-500/40 glow-red",
  };

  const stopLossCount = metrics.stopLossCount;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Header */}
      <header className="border-b border-[#1e2d45] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-semibold tracking-wider text-[#e2e8f0]">
            A股选股策略分析
          </span>
          <span className="text-xs text-[#475569] hidden sm:block">
            多因子确认 · 三确认法则 · 风控优先
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Nav tabs */}
          <nav className="flex gap-1">
            {(
              [
                { key: "analyze",   label: "选股分析" },
                { key: "portfolio", label: "持仓管理" },
                { key: "risk",      label: "风险评估", badge: stopLossCount > 0 ? stopLossCount : undefined },
              ] as { key: NavTab; label: string; badge?: number }[]
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setNavTab(t.key)}
                className={`relative px-3 py-1.5 text-xs rounded-md transition-colors ${
                  navTab === t.key
                    ? "bg-blue-600 text-white"
                    : "text-[#64748b] hover:text-[#94a3b8] hover:bg-[#141d2e]"
                }`}
              >
                {t.label}
                {t.badge !== undefined && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="text-xs text-[#475569]">数据来源: AKShare</div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4 max-w-screen-2xl mx-auto">
        {/* Market overview — always visible */}
        <MarketBar />

        {/* ══════════ 选股分析 Tab ══════════ */}
        {navTab === "analyze" && (
          <>
            {/* Search bar */}
            <div className="card p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-48">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入股票代码（如 000001）"
                    className="w-full px-4 py-2.5 rounded-lg text-sm"
                  />
                </div>
                <button
                  onClick={() => analyze()}
                  disabled={loading || !code.trim()}
                  className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                >
                  {loading ? "分析中..." : "开始分析"}
                </button>
                <div className="flex gap-2 flex-wrap">
                  {EXAMPLE_STOCKS.map((s) => (
                    <button
                      key={s.code}
                      onClick={() => { setCode(s.code); analyze(s.code); }}
                      className="text-xs px-2.5 py-1 rounded border border-[#1e2d45] text-[#64748b] hover:text-[#94a3b8] hover:border-[#2d4060] transition-colors"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main layout */}
            <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
              <StrategyPanel config={config} onChange={setConfig} />

              <div className="space-y-4">
                {loading && (
                  <div className="card p-16 flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-[#475569]">正在获取行情并分析...</p>
                  </div>
                )}

                {error && (
                  <div className="card p-6 border border-red-900/40 bg-red-950/20">
                    <p className="text-red-400 text-sm">{error}</p>
                    <p className="text-[#475569] text-xs mt-1">
                      请确认股票代码正确，且后端服务已启动（python backend/app.py）
                    </p>
                  </div>
                )}

                {result && !loading && (
                  <div className="fade-in space-y-4">
                    {/* Stock header */}
                    <div className={`card p-4 flex items-center justify-between border ${colorMap[result.color] ?? ""}`}>
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-xl font-bold text-[#e2e8f0]">{result.name}</span>
                          <span className="ml-2 text-[#475569] text-sm">{result.code}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            result.color === "green" ? "tag-green" : result.color === "yellow" ? "tag-yellow"
                            : result.color === "orange" ? "tag-yellow" : "tag-red"
                          }`}>
                            {result.recommendation}
                          </span>
                          {result.three_confirm && (
                            <span className="tag-green text-xs px-2 py-0.5 rounded-full font-medium">三确认通过</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-lg font-bold text-[#e2e8f0]">¥{result.entry_price.toFixed(2)}</div>
                          <div className="text-xs text-[#475569]">最新收盘</div>
                        </div>
                        {/* 快速加入持仓 */}
                        <button
                          onClick={() => {
                            // Pre-fill to portfolio tab — open portfolio with this stock
                            setNavTab("portfolio");
                            // Set a global trigger (via sessionStorage) for PortfolioPanel to pick up
                            sessionStorage.setItem(
                              "addStock",
                              JSON.stringify({ code: result!.code, name: result!.name, price: result!.entry_price })
                            );
                          }}
                          className="text-xs px-3 py-1.5 rounded border border-blue-800 text-blue-400 hover:bg-blue-900/20 transition-colors whitespace-nowrap"
                        >
                          + 加入持仓
                        </button>
                      </div>
                    </div>

                    {/* Score + Signals */}
                    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
                      <ScoreGauge
                        score={result.score}
                        maxScore={result.max_score}
                        scorePct={result.score_pct}
                        recommendation={result.recommendation}
                        color={result.color}
                        threeConfirm={result.three_confirm}
                      />
                      <SignalList
                        signals={result.signals}
                        suggestion={result.suggestion}
                        entryPrice={result.entry_price}
                        stopLoss={result.stop_loss}
                        stopLossPct={config.stop_loss_pct}
                      />
                    </div>

                    {/* Chart */}
                    <div className="card p-4">
                      <div className="flex gap-1 mb-3">
                        {CHART_TABS.map((t) => (
                          <button
                            key={t.key}
                            onClick={() => setChartTab(t.key)}
                            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                              chartTab === t.key
                                ? "bg-blue-600 text-white"
                                : "text-[#64748b] hover:text-[#94a3b8] hover:bg-[#141d2e]"
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ height: 420 }}>
                        <StockChart result={result} activeTab={chartTab} />
                      </div>
                    </div>
                  </div>
                )}

                {!loading && !error && !result && (
                  <div className="card p-16 flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-[#141d2e] flex items-center justify-center text-3xl">📈</div>
                    <div>
                      <p className="text-[#94a3b8] font-medium">输入股票代码开始分析</p>
                      <p className="text-[#475569] text-sm mt-1 max-w-sm">
                        系统将自动获取日K数据，通过多因子确认体系给出投资建议
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-left mt-2 w-full max-w-sm">
                      {[
                        { icon: "K", text: "K线形态（锤头/吞没/晨星）" },
                        { icon: "V", text: "量价分析（放量+阶梯量增）" },
                        { icon: "M", text: "均线系统（多头排列确认）" },
                        { icon: "I", text: "MACD/KDJ/RSI/布林线" },
                      ].map((it) => (
                        <div key={it.icon} className="card2 p-3 flex items-center gap-2">
                          <span className="w-6 h-6 rounded bg-blue-900/30 text-blue-400 flex items-center justify-center text-xs font-bold">
                            {it.icon}
                          </span>
                          <span className="text-[#64748b]">{it.text}</span>
                        </div>
                      ))}
                    </div>
                    {/* Portfolio summary if has positions */}
                    {portfolio.positions.length > 0 && (
                      <button
                        onClick={() => setNavTab("risk")}
                        className={`mt-2 px-4 py-2 rounded-lg text-xs border transition-colors ${
                          stopLossCount > 0
                            ? "border-red-800 text-red-400 hover:bg-red-900/20"
                            : "border-[#1e2d45] text-[#64748b] hover:text-[#94a3b8]"
                        }`}
                      >
                        {stopLossCount > 0
                          ? `⚠ ${stopLossCount} 只股票触及止损 — 查看风险评估`
                          : `查看持仓风险评估（${portfolio.positions.length} 只，总资产 ¥${metrics.totalAssets.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}）`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ══════════ 持仓管理 Tab ══════════ */}
        {navTab === "portfolio" && (
          <PortfolioPanel
            portfolio={portfolio}
            onChange={setPortfolio}
            onRefreshPrices={handleRefreshPrices}
            refreshing={refreshing}
            stopLossPct={config.stop_loss_pct}
          />
        )}

        {/* ══════════ 风险评估 Tab ══════════ */}
        {navTab === "risk" && (
          <RiskDashboard
            portfolio={portfolio}
            metrics={metrics}
            stopLossPct={config.stop_loss_pct}
          />
        )}
      </div>
    </div>
  );
}
