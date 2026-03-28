/**
 * 后端 SQLite 持仓 API 封装
 * 所有持仓/现金/策略配置的持久化均通过此模块与后端通信
 */
import axios from "axios";
import type { StrategyConfig } from "./types";

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

// ─────────────── Types ───────────────

export interface DBPosition {
  id: string;
  code: string;
  name: string;
  shares: number;
  cost_price: number;
  current_price: number | null;
  last_updated: string | null;
  created_at: string;
  updated_at: string;
}

export interface Snapshot {
  positions: DBPosition[];
  cash: number;
  cash_updated_at: string;
  config: StrategyConfig;
  config_updated_at: string;
}

// ─────────────── 快照（一次拿全部）───────────────

export async function fetchSnapshot(): Promise<Snapshot> {
  const { data } = await axios.get<Snapshot>(`${BASE}/portfolio/snapshot`);
  return data;
}

// ─────────────── 持仓 ───────────────

export async function apiAddPosition(params: {
  code: string;
  name: string;
  shares: number;
  costPrice: number;
}): Promise<DBPosition> {
  const { data } = await axios.post<DBPosition>(`${BASE}/portfolio/positions`, params);
  return data;
}

export async function apiDeletePosition(id: string): Promise<void> {
  await axios.delete(`${BASE}/portfolio/positions/${id}`);
}

export async function apiUpdatePosition(
  id: string,
  patch: Partial<{ shares: number; costPrice: number; name: string; currentPrice: number; lastUpdated: string }>
): Promise<DBPosition> {
  const { data } = await axios.patch<DBPosition>(`${BASE}/portfolio/positions/${id}`, patch);
  return data;
}

// ─────────────── 现金 ───────────────

export async function apiSetCash(amount: number): Promise<{ amount: number; updated_at: string }> {
  const { data } = await axios.put(`${BASE}/portfolio/cash`, { amount });
  return data;
}

// ─────────────── 策略配置 ───────────────

export async function apiSaveConfig(config: StrategyConfig): Promise<void> {
  await axios.put(`${BASE}/portfolio/config`, { config });
}

// ─────────────── 刷新持仓现价 ───────────────

export async function apiRefreshPrices(): Promise<{ updated: number; positions: DBPosition[] }> {
  const { data } = await axios.post(`${BASE}/portfolio/prices/refresh`);
  return data;
}

// ─────────────── localStorage 迁移 ───────────────
// 首次加载时，如果 DB 里没有数据但 localStorage 里有旧数据，自动导入一次

const LEGACY_KEY = "astock_portfolio_v1";
const MIGRATED_KEY = "astock_migrated_v1";

export async function migrateFromLocalStorage(): Promise<boolean> {
  if (localStorage.getItem(MIGRATED_KEY)) return false;

  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) {
    localStorage.setItem(MIGRATED_KEY, "1");
    return false;
  }

  try {
    const old = JSON.parse(raw) as {
      cash?: number;
      positions?: { code: string; name: string; shares: number; costPrice: number }[];
    };

    if (old.cash != null) {
      await apiSetCash(old.cash);
    }
    for (const pos of old.positions ?? []) {
      await apiAddPosition({
        code: pos.code,
        name: pos.name,
        shares: pos.shares,
        costPrice: pos.costPrice,
      });
    }

    localStorage.setItem(MIGRATED_KEY, "1");
    console.log("[migration] localStorage 数据已导入 SQLite");
    return true;
  } catch (e) {
    console.warn("[migration] 迁移失败", e);
    return false;
  }
}
