import React from "react";

interface Props {
  score: number;
  maxScore: number;
  scorePct: number;
  recommendation: string;
  color: string;
  threeConfirm: boolean;
}

const colorMap: Record<string, { stroke: string; glow: string; text: string; bg: string }> = {
  green:  { stroke: "#22c55e", glow: "rgba(34,197,94,0.3)",   text: "text-green-400",  bg: "bg-green-500" },
  yellow: { stroke: "#f59e0b", glow: "rgba(245,158,11,0.3)",  text: "text-amber-400",  bg: "bg-amber-500" },
  orange: { stroke: "#f97316", glow: "rgba(249,115,22,0.3)",  text: "text-orange-400", bg: "bg-orange-500" },
  red:    { stroke: "#ef4444", glow: "rgba(239,68,68,0.3)",   text: "text-red-400",    bg: "bg-red-500" },
};

export const ScoreGauge: React.FC<Props> = ({
  score, maxScore, scorePct, recommendation, color, threeConfirm,
}) => {
  const c = colorMap[color] ?? colorMap.red;
  const r = 54;
  const circumference = 2 * Math.PI * r;
  // 270° arc gauge (from -135° to +135°)
  const arcLength = circumference * 0.75;
  const filled = arcLength * (scorePct / 100);
  const dashOffset = arcLength - filled;

  return (
    <div className="card p-6 flex flex-col items-center gap-4">
      <h3 className="text-xs tracking-widest text-[#64748b] uppercase">综合评分</h3>

      {/* SVG Gauge */}
      <div className="relative" style={{ filter: `drop-shadow(0 0 12px ${c.glow})` }}>
        <svg width="140" height="110" viewBox="0 0 140 110">
          {/* Background arc */}
          <circle
            cx="70" cy="85" r={r}
            fill="none"
            stroke="#1e2d45"
            strokeWidth="10"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform="rotate(-225 70 85)"
          />
          {/* Filled arc */}
          <circle
            cx="70" cy="85" r={r}
            fill="none"
            stroke={c.stroke}
            strokeWidth="10"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform="rotate(-225 70 85)"
            style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span className={`text-3xl font-bold ${c.text}`}>{scorePct.toFixed(0)}</span>
          <span className="text-xs text-[#475569]">{score}/{maxScore} 项通过</span>
        </div>
      </div>

      {/* Recommendation badge */}
      <div className={`px-4 py-2 rounded-full text-sm font-bold ${c.text}`}
        style={{ background: c.glow, border: `1px solid ${c.stroke}33` }}>
        {recommendation}
      </div>

      {/* Three confirm badge */}
      <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full ${
        threeConfirm ? "tag-green" : "tag-gray"
      }`}>
        <span>{threeConfirm ? "✓" : "✗"}</span>
        <span>三确认法则{threeConfirm ? "通过" : "未通过"}</span>
      </div>

      {/* Mini legend */}
      <div className="w-full grid grid-cols-4 gap-1 text-center">
        {[
          { range: "≥70", label: "强买", c: "#22c55e" },
          { range: "60+", label: "谨慎", c: "#f59e0b" },
          { range: "40+", label: "观察", c: "#f97316" },
          { range: "<40", label: "回避", c: "#ef4444" },
        ].map((it) => (
          <div key={it.label} className="text-[10px]">
            <div className="w-full h-0.5 rounded mb-1" style={{ background: it.c }} />
            <div style={{ color: it.c }}>{it.label}</div>
            <div className="text-[#475569]">{it.range}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
