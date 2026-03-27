import React from "react";
import type { Signal } from "../types";

interface Props {
  signals: Record<string, Signal>;
  suggestion: string;
  entryPrice: number;
  stopLoss: number;
  stopLossPct: number;
}

const SIGNAL_LABELS: Record<string, { label: string; group: string }> = {
  kline_hammer:       { label: "锤头线/长下影",     group: "K线形态" },
  kline_engulfing:    { label: "看涨吞没形态",       group: "K线形态" },
  kline_morning_star: { label: "早晨之星",           group: "K线形态" },
  volume_surge:       { label: "当日放量",           group: "量价分析" },
  volume_ladder:      { label: "连续价升量增",       group: "量价分析" },
  ma_5_10:            { label: "5/10日金叉",         group: "均线系统" },
  ma_60:              { label: "站上60日线",         group: "均线系统" },
  ma_bull_arrange:    { label: "多头排列",           group: "均线系统" },
  macd:               { label: "MACD金叉",           group: "辅助指标" },
  kdj:                { label: "KDJ超卖金叉",        group: "辅助指标" },
  rsi:                { label: "RSI超卖突破",        group: "辅助指标" },
  boll:               { label: "布林线确认",         group: "辅助指标" },
};

const GROUP_ORDER = ["K线形态", "量价分析", "均线系统", "辅助指标"];

export const SignalList: React.FC<Props> = ({
  signals, suggestion, entryPrice, stopLoss, stopLossPct,
}) => {
  const groups: Record<string, { key: string; label: string; signal: Signal }[]> = {};
  for (const [key, sig] of Object.entries(signals)) {
    const meta = SIGNAL_LABELS[key];
    if (!meta) continue;
    if (!groups[meta.group]) groups[meta.group] = [];
    groups[meta.group].push({ key, label: meta.label, signal: sig });
  }

  return (
    <div className="space-y-4">
      {/* 投资建议卡片 */}
      <div className="card2 p-4 border-l-4 border-blue-500">
        <p className="text-xs text-[#64748b] mb-1">投资建议</p>
        <p className="text-sm text-[#e2e8f0] leading-relaxed">{suggestion}</p>
        <div className="flex gap-4 mt-3 text-xs">
          <div>
            <span className="text-[#475569]">参考入场</span>
            <span className="ml-2 text-amber-400 font-bold">¥{entryPrice.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-[#475569]">止损位</span>
            <span className="ml-2 text-red-400 font-bold">
              ¥{stopLoss.toFixed(2)} (-{(stopLossPct * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      </div>

      {/* 实战Checklist */}
      <div className="card p-4">
        <p className="text-xs tracking-widest text-[#64748b] uppercase mb-3">实战 Checklist</p>
        <div className="space-y-3">
          {GROUP_ORDER.map((group) => {
            const items = groups[group];
            if (!items?.length) return null;
            const passCount = items.filter((i) => i.signal.pass).length;
            return (
              <div key={group}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-[#475569]">{group}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      passCount === items.length
                        ? "tag-green"
                        : passCount > 0
                        ? "tag-yellow"
                        : "tag-gray"
                    }`}
                  >
                    {passCount}/{items.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {items.map(({ key, label, signal }) => (
                    <div
                      key={key}
                      className={`flex items-start gap-2 p-2 rounded-md text-xs ${
                        signal.pass ? "bg-green-950/30" : "bg-[#141d2e]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          signal.pass
                            ? "bg-green-500/20 text-green-400"
                            : "bg-[#1e2d45] text-[#475569]"
                        }`}
                      >
                        {signal.pass ? "✓" : "✗"}
                      </span>
                      <div>
                        <span
                          className={signal.pass ? "text-green-300" : "text-[#64748b]"}
                        >
                          {label}
                        </span>
                        <p className="text-[#475569] mt-0.5 leading-relaxed">{signal.desc}</p>
                        {signal.value !== undefined && (
                          <span className="text-[#94a3b8]">值: {signal.value}</span>
                        )}
                        {signal.dif !== undefined && (
                          <span className="text-[#94a3b8]">
                            DIF:{signal.dif} DEA:{signal.dea} HIST:{signal.hist}
                          </span>
                        )}
                        {signal.k !== undefined && (
                          <span className="text-[#94a3b8]">
                            K:{signal.k} D:{signal.d} J:{signal.j}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 铁律提示 */}
      <div className="card2 p-3 border-l-4 border-amber-600">
        <p className="text-xs text-amber-500 font-semibold mb-1">交易铁律</p>
        <ul className="text-xs text-[#64748b] space-y-1">
          <li>• 首次入场最多 3 成仓，确认上涨后再加仓</li>
          <li>• 个股跌破入场价 -{(stopLossPct * 100).toFixed(0)}% 无条件止损，不讲理由</li>
          <li>• 熊市反弹最多 5 成仓，牛市确认后再满仓</li>
          <li>• 宁可错过，不可做错；趋势为王，风控至上</li>
        </ul>
      </div>
    </div>
  );
};
