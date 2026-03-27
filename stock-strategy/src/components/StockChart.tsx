import React, { useRef, useEffect } from "react";
import * as echarts from "echarts";
import type { AnalysisResult } from "../types";

interface Props {
  result: AnalysisResult;
  activeTab: "kline" | "macd" | "kdj" | "rsi" | "boll";
}

function buildKlineOption(result: AnalysisResult) {
  const { kline_data, chart } = result;
  const dates = kline_data.map((d) => d.date);
  const kData = kline_data.map((d) => [d.open, d.close, d.low, d.high]);

  return {
    backgroundColor: "transparent",
    animation: true,
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      backgroundColor: "#0f1623",
      borderColor: "#1e2d45",
      textStyle: { color: "#e2e8f0", fontSize: 11 },
    },
    legend: {
      data: ["K线", "MA5", "MA10", "MA20", "MA60"],
      textStyle: { color: "#64748b", fontSize: 11 },
      top: 4,
    },
    grid: [
      { left: 60, right: 20, top: 40, height: "55%" },
      { left: 60, right: 20, bottom: 20, height: "22%" },
    ],
    xAxis: [
      {
        type: "category",
        data: dates,
        gridIndex: 0,
        axisLine: { lineStyle: { color: "#1e2d45" } },
        axisLabel: { color: "#475569", fontSize: 10 },
        splitLine: { show: false },
      },
      {
        type: "category",
        data: dates,
        gridIndex: 1,
        axisLine: { lineStyle: { color: "#1e2d45" } },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ],
    yAxis: [
      {
        gridIndex: 0,
        scale: true,
        axisLabel: { color: "#475569", fontSize: 10 },
        splitLine: { lineStyle: { color: "#1e2d45" } },
      },
      {
        gridIndex: 1,
        scale: true,
        axisLabel: { color: "#475569", fontSize: 10 },
        splitLine: { lineStyle: { color: "#1e2d45" } },
      },
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1], start: 50, end: 100 },
      {
        type: "slider",
        xAxisIndex: [0, 1],
        start: 50,
        end: 100,
        height: 16,
        bottom: 4,
        fillerColor: "rgba(59,130,246,0.1)",
        borderColor: "#1e2d45",
        textStyle: { color: "#64748b" },
      },
    ],
    series: [
      {
        name: "K线",
        type: "candlestick",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: kData,
        itemStyle: {
          color: "#ef4444",
          color0: "#22c55e",
          borderColor: "#ef4444",
          borderColor0: "#22c55e",
        },
      },
      {
        name: "MA5",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: chart.ma5,
        smooth: true,
        lineStyle: { width: 1, color: "#f59e0b" },
        symbol: "none",
      },
      {
        name: "MA10",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: chart.ma10,
        smooth: true,
        lineStyle: { width: 1, color: "#3b82f6" },
        symbol: "none",
      },
      {
        name: "MA20",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: chart.ma20,
        smooth: true,
        lineStyle: { width: 1, color: "#a855f7" },
        symbol: "none",
      },
      {
        name: "MA60",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: chart.ma60,
        smooth: true,
        lineStyle: { width: 1.5, color: "#fb923c" },
        symbol: "none",
      },
      // Volume bars
      {
        name: "成交量",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: chart.volume.map((v, i) => {
          const bar = kline_data[kline_data.length - chart.volume.length + i];
          return {
            value: v,
            itemStyle: {
              color: bar && bar.close >= bar.open ? "#ef4444" : "#22c55e",
              opacity: 0.7,
            },
          };
        }),
      },
      {
        name: "VOL-MA5",
        type: "line",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: chart.vol_ma5,
        smooth: true,
        lineStyle: { width: 1, color: "#f59e0b" },
        symbol: "none",
      },
    ],
  };
}

function buildMacdOption(result: AnalysisResult) {
  const { chart, kline_data } = result;
  const dates = kline_data.map((d) => d.date).slice(-chart.dif.length);
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "#0f1623",
      borderColor: "#1e2d45",
      textStyle: { color: "#e2e8f0", fontSize: 11 },
    },
    legend: { textStyle: { color: "#64748b", fontSize: 11 }, top: 4 },
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
    xAxis: {
      type: "category",
      data: dates,
      axisLine: { lineStyle: { color: "#1e2d45" } },
      axisLabel: { color: "#475569", fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      scale: true,
      axisLabel: { color: "#475569", fontSize: 10 },
      splitLine: { lineStyle: { color: "#1e2d45" } },
    },
    dataZoom: [{ type: "inside", start: 50, end: 100 }],
    series: [
      {
        name: "DIF",
        type: "line",
        data: chart.dif,
        smooth: true,
        lineStyle: { width: 1.5, color: "#f59e0b" },
        symbol: "none",
      },
      {
        name: "DEA",
        type: "line",
        data: chart.dea,
        smooth: true,
        lineStyle: { width: 1.5, color: "#3b82f6" },
        symbol: "none",
      },
      {
        name: "MACD柱",
        type: "bar",
        data: chart.histogram.map((v) => ({
          value: v,
          itemStyle: { color: v != null && v >= 0 ? "#ef4444" : "#22c55e" },
        })),
      },
    ],
  };
}

function buildKdjOption(result: AnalysisResult) {
  const { chart, kline_data } = result;
  const dates = kline_data.map((d) => d.date).slice(-chart.k.length);
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "#0f1623",
      borderColor: "#1e2d45",
      textStyle: { color: "#e2e8f0", fontSize: 11 },
    },
    legend: { textStyle: { color: "#64748b", fontSize: 11 }, top: 4 },
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
    xAxis: {
      type: "category",
      data: dates,
      axisLine: { lineStyle: { color: "#1e2d45" } },
      axisLabel: { color: "#475569", fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      min: 0,
      max: 100,
      axisLabel: { color: "#475569", fontSize: 10 },
      splitLine: { lineStyle: { color: "#1e2d45" } },
    },
    dataZoom: [{ type: "inside", start: 50, end: 100 }],
    series: [
      { name: "K", type: "line", data: chart.k, smooth: true, lineStyle: { width: 1.5, color: "#f59e0b" }, symbol: "none" },
      { name: "D", type: "line", data: chart.d, smooth: true, lineStyle: { width: 1.5, color: "#3b82f6" }, symbol: "none" },
      { name: "J", type: "line", data: chart.j, smooth: true, lineStyle: { width: 1, color: "#a855f7" }, symbol: "none" },
    ],
  };
}

function buildRsiOption(result: AnalysisResult) {
  const { chart, kline_data } = result;
  const dates = kline_data.map((d) => d.date).slice(-chart.rsi.length);
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "#0f1623",
      borderColor: "#1e2d45",
      textStyle: { color: "#e2e8f0", fontSize: 11 },
    },
    grid: { left: 60, right: 20, top: 30, bottom: 40 },
    xAxis: {
      type: "category",
      data: dates,
      axisLine: { lineStyle: { color: "#1e2d45" } },
      axisLabel: { color: "#475569", fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      min: 0,
      max: 100,
      axisLabel: { color: "#475569", fontSize: 10 },
      splitLine: { lineStyle: { color: "#1e2d45" } },
    },
    dataZoom: [{ type: "inside", start: 50, end: 100 }],
    series: [
      {
        name: "RSI(14)",
        type: "line",
        data: chart.rsi,
        smooth: true,
        lineStyle: { width: 2, color: "#3b82f6" },
        symbol: "none",
        areaStyle: { color: "rgba(59,130,246,0.08)" },
        markLine: {
          silent: true,
          lineStyle: { color: "#ef4444", type: "dashed" },
          data: [{ yAxis: 30 }, { yAxis: 70 }],
          label: { color: "#64748b", fontSize: 10 },
        },
      },
    ],
  };
}

function buildBollOption(result: AnalysisResult) {
  const { chart, kline_data } = result;
  const n = chart.boll_upper.length;
  const dates = kline_data.map((d) => d.date).slice(-n);
  const closes = kline_data.map((d) => d.close).slice(-n);
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "#0f1623",
      borderColor: "#1e2d45",
      textStyle: { color: "#e2e8f0", fontSize: 11 },
    },
    legend: { textStyle: { color: "#64748b", fontSize: 11 }, top: 4 },
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
    xAxis: {
      type: "category",
      data: dates,
      axisLine: { lineStyle: { color: "#1e2d45" } },
      axisLabel: { color: "#475569", fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      scale: true,
      axisLabel: { color: "#475569", fontSize: 10 },
      splitLine: { lineStyle: { color: "#1e2d45" } },
    },
    dataZoom: [{ type: "inside", start: 50, end: 100 }],
    series: [
      { name: "上轨", type: "line", data: chart.boll_upper, smooth: true, lineStyle: { width: 1, color: "#ef4444" }, symbol: "none" },
      { name: "中轨", type: "line", data: chart.boll_mid,   smooth: true, lineStyle: { width: 1.5, color: "#f59e0b" }, symbol: "none" },
      { name: "下轨", type: "line", data: chart.boll_lower, smooth: true, lineStyle: { width: 1, color: "#22c55e" }, symbol: "none" },
      { name: "收盘价", type: "line", data: closes, smooth: false, lineStyle: { width: 1, color: "#94a3b8" }, symbol: "none" },
    ],
  };
}

export const StockChart: React.FC<Props> = ({ result, activeTab }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current, "dark");
    }
    const chart = instanceRef.current;
    let option: object;
    switch (activeTab) {
      case "macd":  option = buildMacdOption(result); break;
      case "kdj":   option = buildKdjOption(result);  break;
      case "rsi":   option = buildRsiOption(result);  break;
      case "boll":  option = buildBollOption(result); break;
      default:      option = buildKlineOption(result);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chart.setOption(option as any, true);
  }, [result, activeTab]);

  useEffect(() => {
    const resize = () => instanceRef.current?.resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, []);

  return <div ref={chartRef} style={{ width: "100%", height: "100%" }} />;
};
