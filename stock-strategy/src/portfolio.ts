/**
 * 纯计算函数：持仓估值 + 风险评估
 * 数据持久化已迁移至后端 SQLite，见 portfolioApi.ts
 */
import type { Portfolio, Position, PositionWithCalc, RiskMetrics } from "./types";

// ─────────────────────────── 计算 ────────────────────────────

export function calcPositions(
  positions: Position[],
  totalAssets: number,
  stopLossPct: number
): PositionWithCalc[] {
  return positions.map((pos) => {
    const price = pos.currentPrice ?? pos.costPrice;
    const marketValue = pos.shares * price;
    const cost = pos.shares * pos.costPrice;
    const pnl = marketValue - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    const weight = totalAssets > 0 ? (marketValue / totalAssets) * 100 : 0;
    const stopLossPrice = pos.costPrice * (1 - stopLossPct);
    const stopLossTriggered = price <= stopLossPrice;
    return { ...pos, marketValue, cost, pnl, pnlPct, weight, stopLossPrice, stopLossTriggered };
  });
}

export function calcRisk(portfolio: Portfolio, stopLossPct: number): RiskMetrics {
  const stockValue = portfolio.positions.reduce((sum, pos) => {
    const price = pos.currentPrice ?? pos.costPrice;
    return sum + pos.shares * price;
  }, 0);
  const cashValue = portfolio.cash;
  const totalAssets = stockValue + cashValue;
  const stockRatio = totalAssets > 0 ? (stockValue / totalAssets) * 100 : 0;
  const cashRatio = 100 - stockRatio;

  const positionsCalc = calcPositions(portfolio.positions, totalAssets, stopLossPct);

  const maxSingleWeight =
    positionsCalc.length > 0 ? Math.max(...positionsCalc.map((p) => p.weight)) : 0;
  const stopLossCount = positionsCalc.filter((p) => p.stopLossTriggered).length;
  const unrealizedPnl = positionsCalc.reduce((sum, p) => sum + p.pnl, 0);
  const totalCost = positionsCalc.reduce((sum, p) => sum + p.cost, 0);
  const unrealizedPnlPct = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

  let riskScore = 0;
  const warnings: string[] = [];

  if (stockRatio > 90) {
    riskScore += 35;
    warnings.push(`仓位高达 ${stockRatio.toFixed(0)}%，现金不足 10%，无法应对黑天鹅`);
  } else if (stockRatio > 70) {
    riskScore += 20;
    warnings.push(`仓位 ${stockRatio.toFixed(0)}%，建议保留至少 30% 现金`);
  } else if (stockRatio > 50) {
    riskScore += 8;
  }

  if (maxSingleWeight > 50) {
    riskScore += 30;
    warnings.push(`单股占比 ${maxSingleWeight.toFixed(0)}%，集中度过高，一旦利空损失惨重`);
  } else if (maxSingleWeight > 30) {
    riskScore += 15;
    warnings.push(`单股占比 ${maxSingleWeight.toFixed(0)}%，建议分散至 30% 以内`);
  } else if (maxSingleWeight > 20) {
    riskScore += 5;
  }

  if (stopLossCount > 0) {
    riskScore += stopLossCount * 15;
    warnings.push(`${stopLossCount} 只股票已触及止损价，按铁律必须无条件清仓！`);
  }

  if (unrealizedPnlPct < -15) {
    riskScore += 20;
    warnings.push(`持仓整体浮亏 ${Math.abs(unrealizedPnlPct).toFixed(1)}%，亏损超过警戒线`);
  } else if (unrealizedPnlPct < -7) {
    riskScore += 10;
    warnings.push(`持仓整体浮亏 ${Math.abs(unrealizedPnlPct).toFixed(1)}%，注意风险`);
  }

  if (portfolio.positions.length > 10) {
    riskScore += 5;
    warnings.push(`持仓标的超过 10 只，难以有效跟踪，建议精简`);
  }

  riskScore = Math.min(100, riskScore);

  let riskLevel: RiskMetrics["riskLevel"];
  if (riskScore < 20) riskLevel = "低风险";
  else if (riskScore < 45) riskLevel = "中等风险";
  else if (riskScore < 70) riskLevel = "高风险";
  else riskLevel = "极高风险";

  return {
    totalAssets, stockValue, cashValue, stockRatio, cashRatio,
    maxSingleWeight, stopLossCount, unrealizedPnl, unrealizedPnlPct,
    riskLevel, riskScore, warnings,
  };
}
