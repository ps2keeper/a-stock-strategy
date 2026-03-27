import axios from "axios";
import type { AnalysisResult, MarketOverview, StrategyConfig } from "./types";

const BASE = "http://localhost:5001/api";

export function buildParams(code: string, cfg: StrategyConfig): URLSearchParams {
  const p = new URLSearchParams();
  p.set("code", code);
  p.set("enable_kline", String(cfg.enable_kline));
  p.set("enable_volume", String(cfg.enable_volume));
  p.set("enable_ma", String(cfg.enable_ma));
  p.set("enable_macd", String(cfg.enable_macd));
  p.set("enable_kdj", String(cfg.enable_kdj));
  p.set("enable_rsi", String(cfg.enable_rsi));
  p.set("enable_boll", String(cfg.enable_boll));
  p.set("vol_ratio_threshold", String(cfg.vol_ratio_threshold));
  p.set("kdj_oversold_threshold", String(cfg.kdj_oversold_threshold));
  p.set("rsi_oversold_threshold", String(cfg.rsi_oversold_threshold));
  p.set("rsi_breakout", String(cfg.rsi_breakout));
  p.set("stop_loss_pct", String(cfg.stop_loss_pct));
  p.set("ma_relaxed", String(cfg.ma_relaxed));
  return p;
}

export async function fetchAnalysis(
  code: string,
  cfg: StrategyConfig
): Promise<AnalysisResult> {
  const { data } = await axios.get<AnalysisResult>(
    `${BASE}/stock/kline?${buildParams(code, cfg)}`
  );
  return data;
}

export async function fetchMarket(): Promise<MarketOverview> {
  const { data } = await axios.get<MarketOverview>(`${BASE}/market/overview`);
  return data;
}

export async function fetchPrices(codes: string[]): Promise<Record<string, number>> {
  if (codes.length === 0) return {};
  const { data } = await axios.post<{ prices: Record<string, number> }>(
    `${BASE}/stock/prices`,
    { codes }
  );
  return data.prices;
}
