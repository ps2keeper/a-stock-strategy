import React, { useState } from "react";
import type { Portfolio } from "../types";
import { calcPositions } from "../portfolio";

interface Props {
  portfolio: Portfolio;
  onAdd: (params: { code: string; name: string; shares: number; costPrice: number }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCashChange: (amount: number) => Promise<void>;
  onRefreshPrices: () => void;
  refreshing: boolean;
  stopLossPct: number;
  loading?: boolean;
}

const fmt = (n: number) =>
  n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const PortfolioPanel: React.FC<Props> = ({
  portfolio,
  onAdd,
  onDelete,
  onCashChange,
  onRefreshPrices,
  refreshing,
  stopLossPct,
  loading,
}) => {
  const [form, setForm] = useState({ code: "", name: "", shares: "", costPrice: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingCash, setEditingCash] = useState(false);
  const [cashInput, setCashInput] = useState(String(portfolio.cash));
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const stockValue = portfolio.positions.reduce((s, p) => {
    const price = p.currentPrice ?? p.costPrice;
    return s + p.shares * price;
  }, 0);
  const totalAssets = stockValue + portfolio.cash;
  const posCalc = calcPositions(portfolio.positions, totalAssets, stopLossPct);

  const handleAdd = async () => {
    const shares = Number(form.shares);
    const costPrice = Number(form.costPrice);
    if (!form.code.trim()) return setFormError("请输入股票代码");
    if (!shares || shares <= 0) return setFormError("请输入有效股数");
    if (!costPrice || costPrice <= 0) return setFormError("请输入有效成本价");
    setFormError("");
    setSaving(true);
    try {
      await onAdd({
        code: form.code.trim(),
        name: form.name.trim() || form.code.trim(),
        shares,
        costPrice,
      });
      setForm({ code: "", name: "", shares: "", costPrice: "" });
    } catch {
      setFormError("添加失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCashSave = async () => {
    const v = Number(cashInput);
    if (!isNaN(v) && v >= 0) {
      await onCashChange(v);
    }
    setEditingCash(false);
  };

  if (loading) {
    return (
      <div className="card p-16 flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#475569]">加载持仓数据...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 总资产概览 */}
      <div className="card p-5 grid grid-cols-3 gap-4">
        <AssetCard label="总资产" value={totalAssets} color="text-[#e2e8f0]" />
        <AssetCard label="持仓市值" value={stockValue} color="text-amber-400" />
        <div className="text-center">
          <p className="text-xs text-[#475569] mb-1">现金</p>
          {editingCash ? (
            <div className="flex gap-1 justify-center">
              <input
                type="number"
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCashSave()}
                className="w-28 px-2 py-1 text-xs rounded text-center"
                autoFocus
              />
              <button
                onClick={handleCashSave}
                className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500"
              >
                确定
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setEditingCash(true); setCashInput(String(portfolio.cash)); }}
              className="text-lg font-bold text-green-400 hover:text-green-300 transition-colors"
              title="点击编辑现金"
            >
              ¥{fmt(portfolio.cash)}
            </button>
          )}
          <p className="text-xs text-[#475569] mt-0.5">点击编辑 · 已存入数据库</p>
        </div>
      </div>

      {/* 添加持仓 */}
      <div className="card p-4">
        <p className="text-xs tracking-widest text-[#64748b] uppercase mb-3">添加持仓</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          <input type="text" placeholder="股票代码 *" value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className="px-3 py-2 rounded-lg text-xs" />
          <input type="text" placeholder="股票名称" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3 py-2 rounded-lg text-xs" />
          <input type="number" placeholder="持股数量（股）*" value={form.shares}
            onChange={(e) => setForm({ ...form, shares: e.target.value })}
            className="px-3 py-2 rounded-lg text-xs" min={1} />
          <input type="number" placeholder="成本价（元）*" value={form.costPrice}
            onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
            className="px-3 py-2 rounded-lg text-xs" step={0.01} min={0.01} />
        </div>
        {formError && <p className="text-red-400 text-xs mb-2">{formError}</p>}
        <div className="flex gap-2 items-center">
          <button onClick={handleAdd} disabled={saving}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-medium transition-colors">
            {saving ? "保存中..." : "添加 / 合并"}
          </button>
          <button onClick={onRefreshPrices} disabled={refreshing || portfolio.positions.length === 0}
            className="px-4 py-1.5 rounded-lg border border-[#1e2d45] text-xs text-[#64748b] hover:text-[#94a3b8] disabled:opacity-40 transition-colors">
            {refreshing ? "更新中..." : "刷新行情"}
          </button>
          <span className="text-[10px] text-[#334155] ml-auto">数据存储于 SQLite</span>
        </div>
      </div>

      {/* 持仓列表 */}
      {portfolio.positions.length === 0 ? (
        <div className="card p-10 text-center text-[#475569] text-sm">
          暂无持仓，请添加股票持仓
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1e2d45] text-[#475569]">
                  {["代码/名称","持股数","成本价","现价","市值","浮盈亏","占比","止损价",""].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posCalc.map((pos) => (
                  <tr key={pos.id}
                    className={`border-b border-[#1e2d45]/50 hover:bg-[#141d2e] transition-colors ${pos.stopLossTriggered ? "bg-red-950/20" : ""}`}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-[#e2e8f0]">{pos.name}</div>
                      <div className="text-[#475569]">{pos.code}</div>
                    </td>
                    <td className="px-3 py-2.5 text-[#94a3b8]">{pos.shares.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-[#94a3b8]">¥{pos.costPrice.toFixed(2)}</td>
                    <td className="px-3 py-2.5">
                      {pos.currentPrice !== undefined ? (
                        <span className={pos.currentPrice >= pos.costPrice ? "text-red-400" : "text-green-400"}>
                          ¥{pos.currentPrice.toFixed(2)}
                        </span>
                      ) : <span className="text-[#475569]">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-amber-400 font-medium">¥{fmt(pos.marketValue)}</td>
                    <td className="px-3 py-2.5">
                      <div className={pos.pnl >= 0 ? "text-red-400" : "text-green-400"}>
                        {pos.pnl >= 0 ? "+" : ""}¥{fmt(pos.pnl)}
                      </div>
                      <div className={`text-[10px] ${pos.pnlPct >= 0 ? "text-red-400/70" : "text-green-400/70"}`}>
                        {pos.pnlPct >= 0 ? "+" : ""}{pos.pnlPct.toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <div className="h-1 rounded-full bg-blue-500/40"
                          style={{ width: `${Math.min(pos.weight, 100) * 0.6}px` }} />
                        <span className="text-[#94a3b8]">{pos.weight.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {pos.stopLossTriggered ? (
                        <span className="tag-red px-1.5 py-0.5 rounded text-[10px] font-bold">
                          触发！¥{pos.stopLossPrice.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-[#475569]">¥{pos.stopLossPrice.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => handleRemove(pos.id)}
                        disabled={deletingId === pos.id}
                        className="text-[#475569] hover:text-red-400 transition-colors text-xs disabled:opacity-40"
                        title="删除">
                        {deletingId === pos.id ? "..." : "✕"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 合计行 */}
          <div className="border-t border-[#1e2d45] px-3 py-2.5 flex items-center gap-6 text-xs">
            <span className="text-[#475569]">持仓合计</span>
            <span className="text-amber-400 font-medium">市值 ¥{fmt(stockValue)}</span>
            <span className={posCalc.reduce((s, p) => s + p.pnl, 0) >= 0 ? "text-red-400" : "text-green-400"}>
              浮盈亏 {posCalc.reduce((s, p) => s + p.pnl, 0) >= 0 ? "+" : ""}
              ¥{fmt(posCalc.reduce((s, p) => s + p.pnl, 0))}
            </span>
            {portfolio.positions[0]?.lastUpdated && (
              <span className="text-[#475569]">
                行情更新: {new Date(portfolio.positions[0].lastUpdated).toLocaleTimeString("zh-CN")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const AssetCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="text-center">
    <p className="text-xs text-[#475569] mb-1">{label}</p>
    <p className={`text-lg font-bold ${color}`}>¥{fmt(value)}</p>
  </div>
);
