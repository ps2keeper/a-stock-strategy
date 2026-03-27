import React, { useEffect, useState } from "react";
import { fetchMarket } from "../api";
import type { MarketOverview } from "../types";

export const MarketBar: React.FC = () => {
  const [data, setData] = useState<MarketOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarket()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card px-4 py-2 flex items-center gap-3 text-xs text-[#475569]">
        <span className="animate-pulse">正在获取大盘数据...</span>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="card px-4 py-2 text-xs text-[#475569]">
        大盘数据暂时不可用
      </div>
    );
  }

  const shChange = data.sh_index?.pct_chg ?? 0;
  const szChange = data.sz_index?.pct_chg ?? 0;

  const sentimentClass = data.sentiment?.includes("启动")
    ? "tag-green"
    : data.sentiment?.includes("低迷")
    ? "tag-gray"
    : "tag-yellow";

  return (
    <div className="card px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      {/* 上证 */}
      <div className="flex items-center gap-2">
        <span className="text-[#475569]">上证</span>
        <span className="font-mono font-semibold text-[#e2e8f0]">
          {data.sh_index?.close?.toLocaleString() ?? "--"}
        </span>
        <span className={shChange >= 0 ? "text-red-400" : "text-green-400"}>
          {shChange >= 0 ? "+" : ""}{shChange.toFixed(2)}%
        </span>
      </div>

      {/* 深证 */}
      <div className="flex items-center gap-2">
        <span className="text-[#475569]">深证</span>
        <span className="font-mono font-semibold text-[#e2e8f0]">
          {data.sz_index?.close?.toLocaleString() ?? "--"}
        </span>
        <span className={szChange >= 0 ? "text-red-400" : "text-green-400"}>
          {szChange >= 0 ? "+" : ""}{szChange.toFixed(2)}%
        </span>
      </div>

      <div className="w-px h-4 bg-[#1e2d45]" />

      {/* 上涨/下跌家数 */}
      {data.rise_count != null && (
        <div className="flex items-center gap-1.5">
          <span className="text-red-400">{data.rise_count.toLocaleString()}↑</span>
          <span className="text-[#475569]">/</span>
          <span className="text-green-400">{data.fall_count?.toLocaleString()}↓</span>
        </div>
      )}

      {/* 涨跌停 */}
      {data.limit_up != null && (
        <div className="flex items-center gap-2">
          <span className="text-[#475569]">涨停</span>
          <span className="text-red-400 font-bold">{data.limit_up}</span>
          <span className="text-[#475569]">跌停</span>
          <span className="text-green-400 font-bold">{data.limit_down}</span>
        </div>
      )}

      {/* 活跃度 */}
      {data.activity_rate && (
        <div className="flex items-center gap-1.5">
          <span className="text-[#475569]">活跃度</span>
          <span className="text-amber-400 font-medium">{data.activity_rate}%</span>
        </div>
      )}

      <div className="w-px h-4 bg-[#1e2d45]" />

      {/* 情绪标签 */}
      {data.sentiment && (
        <div className={`px-2 py-0.5 rounded font-medium ${sentimentClass}`}>
          {data.sentiment}
          {data.limit_up != null && data.limit_up >= 30 && " · 涨停≥30家"}
          {data.limit_up != null && data.limit_up < 10 && " · 涨停<10家"}
        </div>
      )}
    </div>
  );
};
