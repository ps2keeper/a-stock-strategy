import React, { useRef, useEffect } from "react";
import * as echarts from "echarts";
import type { Portfolio, RiskMetrics } from "../types";
import { calcPositions } from "../portfolio";

interface Props {
  portfolio: Portfolio;
  metrics: RiskMetrics;
  stopLossPct: number;
}

const RISK_COLOR: Record<string, string> = {
  低风险:   "#22c55e",
  中等风险: "#f59e0b",
  高风险:   "#f97316",
  极高风险: "#ef4444",
};

const fmt = (n: number) =>
  n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const RiskDashboard: React.FC<Props> = ({ portfolio, metrics, stopLossPct }) => {
  const pieRef = useRef<HTMLDivElement>(null);
  const pieInstance = useRef<echarts.ECharts | null>(null);

  const posCalc = calcPositions(portfolio.positions, metrics.totalAssets, stopLossPct);
  const riskColor = RISK_COLOR[metrics.riskLevel] ?? "#ef4444";

  // 仓位构成饼图
  useEffect(() => {
    if (!pieRef.current) return;
    if (!pieInstance.current) {
      pieInstance.current = echarts.init(pieRef.current, "dark");
    }
    const pieData = [
      ...posCalc.map((p) => ({
        name: p.name,
        value: Math.round(p.marketValue * 100) / 100,
        itemStyle: {},
      })),
      {
        name: "现金",
        value: Math.round(portfolio.cash * 100) / 100,
        itemStyle: { color: "#22c55e" },
      },
    ];

    pieInstance.current.setOption(
      {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "item",
          backgroundColor: "#0f1623",
          borderColor: "#1e2d45",
          textStyle: { color: "#e2e8f0", fontSize: 11 },
          formatter: (p: { name: string; value: number; percent: number }) =>
            `${p.name}<br/>¥${fmt(p.value)}<br/>${p.percent}%`,
        },
        legend: {
          orient: "vertical",
          right: 10,
          top: "center",
          textStyle: { color: "#64748b", fontSize: 11 },
          icon: "circle",
        },
        series: [
          {
            type: "pie",
            radius: ["40%", "68%"],
            center: ["38%", "50%"],
            data: pieData,
            label: { show: false },
            emphasis: {
              itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.5)" },
            },
          },
        ],
      },
      true
    );
  }, [posCalc, portfolio.cash]);

  useEffect(() => {
    const resize = () => pieInstance.current?.resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => () => { pieInstance.current?.dispose(); pieInstance.current = null; }, []);

  const riskScore = metrics.riskScore;
  // Gauge arc params
  const r = 52;
  const circ = 2 * Math.PI * r;
  const arcLen = circ * 0.75;
  const filled = arcLen * (riskScore / 100);
  const offset = arcLen - filled;

  return (
    <div className="space-y-4">
      {/* 顶部：风险评级 + 评分仪表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 风险仪表 */}
        <div className="card p-5 flex flex-col items-center gap-3">
          <p className="text-xs tracking-widest text-[#64748b] uppercase">风险评级</p>
          <div className="relative" style={{ filter: `drop-shadow(0 0 14px ${riskColor}55)` }}>
            <svg width="150" height="115" viewBox="0 0 150 115">
              <circle cx="75" cy="90" r={r} fill="none" stroke="#1e2d45" strokeWidth="10"
                strokeDasharray={`${arcLen} ${circ}`} strokeDashoffset={0}
                strokeLinecap="round" transform="rotate(-225 75 90)" />
              <circle cx="75" cy="90" r={r} fill="none" stroke={riskColor} strokeWidth="10"
                strokeDasharray={`${arcLen} ${circ}`} strokeDashoffset={offset}
                strokeLinecap="round" transform="rotate(-225 75 90)"
                style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-3">
              <span className="text-3xl font-bold" style={{ color: riskColor }}>{riskScore}</span>
              <span className="text-xs text-[#475569]">风险分</span>
            </div>
          </div>
          <div
            className="px-4 py-1.5 rounded-full text-sm font-bold"
            style={{ color: riskColor, background: `${riskColor}22`, border: `1px solid ${riskColor}44` }}
          >
            {metrics.riskLevel}
          </div>
          <div className="w-full grid grid-cols-4 gap-1 text-center text-[10px]">
            {[
              { label: "低风险", color: "#22c55e", range: "0-20" },
              { label: "中等",   color: "#f59e0b", range: "20-45" },
              { label: "高风险", color: "#f97316", range: "45-70" },
              { label: "极高",   color: "#ef4444", range: "70+" },
            ].map((it) => (
              <div key={it.label}>
                <div className="w-full h-0.5 rounded mb-0.5" style={{ background: it.color }} />
                <div style={{ color: it.color }}>{it.label}</div>
                <div className="text-[#475569]">{it.range}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 核心指标 */}
        <div className="card p-5 grid grid-cols-2 gap-3">
          <MetricCard
            label="总资产"
            value={`¥${fmt(metrics.totalAssets)}`}
            sub={`${portfolio.positions.length} 只股票`}
            color="text-[#e2e8f0]"
          />
          <MetricCard
            label="仓位比例"
            value={`${metrics.stockRatio.toFixed(1)}%`}
            sub={`现金 ${metrics.cashRatio.toFixed(1)}%`}
            color={metrics.stockRatio > 70 ? "text-red-400" : metrics.stockRatio > 50 ? "text-amber-400" : "text-green-400"}
          />
          <MetricCard
            label="最大单股占比"
            value={`${metrics.maxSingleWeight.toFixed(1)}%`}
            sub={metrics.maxSingleWeight > 30 ? "集中度过高" : "分散合理"}
            color={metrics.maxSingleWeight > 30 ? "text-red-400" : "text-green-400"}
          />
          <MetricCard
            label="浮盈亏"
            value={`${metrics.unrealizedPnl >= 0 ? "+" : ""}¥${fmt(metrics.unrealizedPnl)}`}
            sub={`${metrics.unrealizedPnlPct >= 0 ? "+" : ""}${metrics.unrealizedPnlPct.toFixed(2)}%`}
            color={metrics.unrealizedPnl >= 0 ? "text-red-400" : "text-green-400"}
          />
          <MetricCard
            label="止损触发数"
            value={`${metrics.stopLossCount} 只`}
            sub={metrics.stopLossCount > 0 ? "须立即止损！" : "暂无触发"}
            color={metrics.stopLossCount > 0 ? "text-red-400 animate-pulse" : "text-green-400"}
          />
          <MetricCard
            label="现金安全垫"
            value={`¥${fmt(metrics.cashValue)}`}
            sub={metrics.cashRatio < 10 ? "严重不足" : metrics.cashRatio < 30 ? "偏少" : "充足"}
            color={metrics.cashRatio < 10 ? "text-red-400" : metrics.cashRatio < 30 ? "text-amber-400" : "text-green-400"}
          />
        </div>
      </div>

      {/* 风险预警 */}
      {metrics.warnings.length > 0 && (
        <div className="card p-4 border border-red-900/40">
          <p className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse inline-block" />
            风险预警 ({metrics.warnings.length})
          </p>
          <ul className="space-y-1.5">
            {metrics.warnings.map((w, i) => (
              <li key={i} className="text-xs text-[#f87171] flex items-start gap-2">
                <span className="mt-0.5 flex-shrink-0 text-red-500">▲</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 资产构成饼图 */}
      {portfolio.positions.length > 0 && (
        <div className="card p-4">
          <p className="text-xs tracking-widest text-[#64748b] uppercase mb-3">资产构成</p>
          <div ref={pieRef} style={{ height: 280 }} />
        </div>
      )}

      {/* 个股风险明细 */}
      {posCalc.length > 0 && (
        <div className="card p-4">
          <p className="text-xs tracking-widest text-[#64748b] uppercase mb-3">个股风险明细</p>
          <div className="space-y-2">
            {posCalc.map((pos) => {
              const barColor = pos.stopLossTriggered
                ? "#ef4444"
                : pos.weight > 30
                ? "#f97316"
                : "#3b82f6";
              return (
                <div key={pos.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[#e2e8f0]">{pos.name}</span>
                      <span className="text-[#475569]">{pos.code}</span>
                      {pos.stopLossTriggered && (
                        <span className="tag-red px-1.5 py-0.5 rounded text-[10px] font-bold">止损触发</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span style={{ color: barColor }}>{pos.weight.toFixed(1)}%</span>
                      <span className={pos.pnlPct >= 0 ? "text-red-400" : "text-green-400"}>
                        {pos.pnlPct >= 0 ? "+" : ""}{pos.pnlPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#1e2d45] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(pos.weight, 100)}%`,
                        background: barColor,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {/* 现金条 */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#64748b]">现金</span>
                <span className="text-green-400">{metrics.cashRatio.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#1e2d45] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${metrics.cashRatio}%`, background: "#22c55e", opacity: 0.6 }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 铁律合规检查 */}
      <div className="card p-4">
        <p className="text-xs tracking-widest text-[#64748b] uppercase mb-3">铁律合规检查</p>
        <div className="space-y-2">
          {[
            {
              rule: "现金≥30%（黑天鹅防御）",
              pass: metrics.cashRatio >= 30,
              actual: `当前 ${metrics.cashRatio.toFixed(1)}%`,
            },
            {
              rule: "单股占比≤30%（分散风险）",
              pass: metrics.maxSingleWeight <= 30,
              actual: `最大 ${metrics.maxSingleWeight.toFixed(1)}%`,
            },
            {
              rule: "无止损触发（铁律清仓）",
              pass: metrics.stopLossCount === 0,
              actual: metrics.stopLossCount > 0 ? `${metrics.stopLossCount} 只触发` : "全部正常",
            },
            {
              rule: "总浮亏≤-15%（整体风控）",
              pass: metrics.unrealizedPnlPct >= -15,
              actual: `当前 ${metrics.unrealizedPnlPct.toFixed(1)}%`,
            },
            {
              rule: "持仓标的≤10只（有效跟踪）",
              pass: portfolio.positions.length <= 10,
              actual: `当前 ${portfolio.positions.length} 只`,
            },
          ].map((item) => (
            <div
              key={item.rule}
              className={`flex items-center justify-between p-2.5 rounded-md text-xs ${
                item.pass ? "bg-green-950/20" : "bg-red-950/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                    item.pass ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {item.pass ? "✓" : "✗"}
                </span>
                <span className={item.pass ? "text-[#94a3b8]" : "text-red-300"}>{item.rule}</span>
              </div>
              <span className={item.pass ? "text-[#475569]" : "text-red-400 font-medium"}>
                {item.actual}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  label: string; value: string; sub: string; color: string;
}> = ({ label, value, sub, color }) => (
  <div className="card2 p-3">
    <p className="text-[10px] text-[#475569] mb-1">{label}</p>
    <p className={`text-base font-bold leading-tight ${color}`}>{value}</p>
    <p className="text-[10px] text-[#475569] mt-0.5">{sub}</p>
  </div>
);
