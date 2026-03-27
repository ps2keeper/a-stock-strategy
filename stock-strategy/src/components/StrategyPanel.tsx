import React from "react";
import type { StrategyConfig } from "../types";

interface Props {
  config: StrategyConfig;
  onChange: (cfg: StrategyConfig) => void;
}

const toggles: { key: keyof StrategyConfig; label: string; desc: string }[] = [
  { key: "enable_kline", label: "K线形态", desc: "锤头线 / 吞没 / 早晨之星" },
  { key: "enable_volume", label: "量价分析", desc: "放量上涨 + 连续价升量增" },
  { key: "enable_ma", label: "均线系统", desc: "5/10/20/60日均线多头排列" },
  { key: "enable_macd", label: "MACD", desc: "金叉 + 红柱扩大" },
  { key: "enable_kdj", label: "KDJ", desc: "超卖后金叉" },
  { key: "enable_rsi", label: "RSI(14)", desc: "超卖后突破50" },
  { key: "enable_boll", label: "布林线", desc: "触下轨后突破中轨" },
];

export const StrategyPanel: React.FC<Props> = ({ config, onChange }) => {
  const set = <K extends keyof StrategyConfig>(k: K, v: StrategyConfig[K]) =>
    onChange({ ...config, [k]: v });

  return (
    <div className="card p-5 space-y-5">
      <h2 className="text-sm font-semibold tracking-widest text-[#64748b] uppercase">
        策略配置
      </h2>

      {/* 因子开关 */}
      <div className="space-y-2">
        {toggles.map(({ key, label, desc }) => (
          <label
            key={key}
            className="flex items-center justify-between cursor-pointer group"
          >
            <div>
              <span className="text-sm text-[#e2e8f0]">{label}</span>
              <p className="text-xs text-[#475569]">{desc}</p>
            </div>
            <div
              onClick={() => set(key, !config[key] as StrategyConfig[typeof key])}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
                config[key] ? "bg-blue-500" : "bg-[#1e2d45]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  config[key] ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
          </label>
        ))}
      </div>

      <hr className="border-[#1e2d45]" />

      {/* 参数调节 */}
      <div className="space-y-4">
        <SliderRow
          label="量比阈值"
          value={config.vol_ratio_threshold}
          min={1}
          max={3}
          step={0.1}
          unit="x"
          onChange={(v) => set("vol_ratio_threshold", v)}
        />
        <SliderRow
          label="KDJ超卖线"
          value={config.kdj_oversold_threshold}
          min={5}
          max={30}
          step={1}
          unit=""
          onChange={(v) => set("kdj_oversold_threshold", v)}
        />
        <SliderRow
          label="RSI超卖线"
          value={config.rsi_oversold_threshold}
          min={20}
          max={40}
          step={1}
          unit=""
          onChange={(v) => set("rsi_oversold_threshold", v)}
        />
        <SliderRow
          label="RSI突破线"
          value={config.rsi_breakout}
          min={45}
          max={60}
          step={1}
          unit=""
          onChange={(v) => set("rsi_breakout", v)}
        />
        <SliderRow
          label="止损比例"
          value={Math.round(config.stop_loss_pct * 100)}
          min={3}
          max={15}
          step={1}
          unit="%"
          onChange={(v) => set("stop_loss_pct", v / 100)}
        />
      </div>

      <hr className="border-[#1e2d45]" />

      {/* 均线宽松模式 */}
      <label className="flex items-center justify-between cursor-pointer">
        <div>
          <span className="text-sm text-[#e2e8f0]">均线宽松模式</span>
          <p className="text-xs text-[#475569]">5线在10线上方即视为金叉</p>
        </div>
        <div
          onClick={() => set("ma_relaxed", !config.ma_relaxed)}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
            config.ma_relaxed ? "bg-amber-500" : "bg-[#1e2d45]"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
              config.ma_relaxed ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </div>
      </label>

      {/* 预设策略 */}
      <hr className="border-[#1e2d45]" />
      <div>
        <p className="text-xs text-[#475569] mb-2">快速预设</p>
        <div className="flex gap-2 flex-wrap">
          <PresetBtn
            label="激进"
            onClick={() =>
              onChange({
                ...config,
                enable_kline: true, enable_volume: true, enable_ma: true,
                enable_macd: true, enable_kdj: false, enable_rsi: false, enable_boll: false,
                vol_ratio_threshold: 1.2, stop_loss_pct: 0.1, ma_relaxed: true,
              })
            }
            color="text-red-400 border-red-800 hover:bg-red-900/20"
          />
          <PresetBtn
            label="均衡"
            onClick={() =>
              onChange({
                ...config,
                enable_kline: true, enable_volume: true, enable_ma: true,
                enable_macd: true, enable_kdj: true, enable_rsi: true, enable_boll: true,
                vol_ratio_threshold: 1.5, stop_loss_pct: 0.07, ma_relaxed: false,
              })
            }
            color="text-blue-400 border-blue-800 hover:bg-blue-900/20"
          />
          <PresetBtn
            label="保守"
            onClick={() =>
              onChange({
                ...config,
                enable_kline: true, enable_volume: true, enable_ma: true,
                enable_macd: true, enable_kdj: true, enable_rsi: true, enable_boll: true,
                vol_ratio_threshold: 2.0, stop_loss_pct: 0.05, ma_relaxed: false,
              })
            }
            color="text-green-400 border-green-800 hover:bg-green-900/20"
          />
        </div>
      </div>
    </div>
  );
};

const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, unit, onChange }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="text-[#94a3b8]">{label}</span>
      <span className="text-[#f59e0b] font-medium">
        {value}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
      style={{ accentColor: "#3b82f6" }}
    />
  </div>
);

const PresetBtn: React.FC<{
  label: string;
  onClick: () => void;
  color: string;
}> = ({ label, onClick, color }) => (
  <button
    onClick={onClick}
    className={`text-xs px-3 py-1 rounded border transition-colors ${color}`}
  >
    {label}
  </button>
);
