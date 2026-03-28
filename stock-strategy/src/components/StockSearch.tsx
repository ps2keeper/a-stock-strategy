import React, { useState, useEffect, useRef, useCallback } from "react";
import { pinyin } from "pinyin-pro";
import axios from "axios";

interface StockItem {
  code: string;
  name: string;
  initials: string; // 拼音首字母，预计算
}

interface Props {
  onSelect: (code: string, name: string) => void;
  loading?: boolean;
}

// 计算拼音首字母（贵州茅台 -> gzmt）
function getInitials(name: string): string {
  return pinyin(name, { pattern: "first", toneType: "none", separator: "" })
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

// 三种匹配方式：代码前缀 / 名称包含 / 拼音首字母前缀
function match(stock: StockItem, q: string): boolean {
  if (!q) return false;
  const ql = q.toLowerCase();
  return (
    stock.code.startsWith(ql) ||
    stock.name.includes(q) ||
    stock.initials.startsWith(ql)
  );
}

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

export const StockSearch: React.FC<Props> = ({ onSelect, loading }) => {
  const [query, setQuery] = useState("");
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [listReady, setListReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // 拉取股票列表（后端缓存好后才返回）
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      for (let attempt = 0; attempt < 12; attempt++) {
        try {
          const { data } = await axios.get<{ ready: boolean; stocks: { code: string; name: string }[] }>(
            `${BASE}/stock/list`
          );
          if (data.ready && data.stocks.length > 0) {
            if (!cancelled) {
              setStocks(
                data.stocks.map((s) => ({
                  ...s,
                  initials: getInitials(s.name),
                }))
              );
              setListReady(true);
            }
            return;
          }
        } catch {
          // 后端未就绪，继续重试
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // 过滤结果（最多显示 12 条）
  const results = listReady && query.trim().length > 0
    ? stocks.filter((s) => match(s, query.trim())).slice(0, 12)
    : [];

  const handleSelect = useCallback((code: string, name: string) => {
    setQuery("");
    setOpen(false);
    onSelect(code, name);
  }, [onSelect]);

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      if (e.key === "Enter" && query.trim()) {
        // 如果输入的是6位数字，直接当代码用
        if (/^\d{6}$/.test(query.trim())) {
          handleSelect(query.trim(), query.trim());
        }
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const s = results[highlighted];
      if (s) handleSelect(s.code, s.name);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setHighlighted(0);
    setOpen(results.length > 0);
  }, [results.length]);

  // 高亮匹配文字
  const highlight = (text: string, q: string) => {
    if (!q) return <>{text}</>;
    const idx = text.indexOf(q);
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <span className="text-blue-400 font-bold">{text.slice(idx, idx + q.length)}</span>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div className="relative flex-1 min-w-48">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={listReady ? "代码 / 股票名 / 拼音首字母（如 gzmt）" : "股票列表加载中..."}
          className="w-full px-4 py-2.5 rounded-lg text-sm pr-10"
          disabled={loading}
        />
        {/* 状态图标 */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {!listReady ? (
            <div className="w-3.5 h-3.5 border border-[#475569] border-t-blue-400 rounded-full animate-spin" />
          ) : (
            <span className="text-[#475569] text-xs">
              {query ? `${results.length}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* 下拉列表 */}
      {open && results.length > 0 && (
        <div
          ref={dropRef}
          className="absolute z-50 top-full mt-1 w-full rounded-lg border border-[#1e2d45] shadow-2xl overflow-hidden"
          style={{ background: "#0f1623" }}
        >
          {results.map((s, i) => (
            <button
              key={s.code}
              onMouseDown={(e) => {
                e.preventDefault(); // 防止 input onBlur 先触发
                handleSelect(s.code, s.name);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-xs text-left transition-colors ${
                i === highlighted ? "bg-blue-600/20" : "hover:bg-[#141d2e]"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* 代码 */}
                <span className="font-mono text-amber-400 w-14 flex-shrink-0">
                  {highlight(s.code, /^\d/.test(query) ? query : "")}
                </span>
                {/* 名称 */}
                <span className="text-[#e2e8f0]">
                  {highlight(s.name, /[^\x00-\x7F]/.test(query) ? query : "")}
                </span>
              </div>
              {/* 拼音首字母提示 */}
              <span className="text-[#334155] text-[10px] flex-shrink-0 ml-2">{s.initials}</span>
            </button>
          ))}

          {/* 底部提示 */}
          <div className="px-4 py-1.5 border-t border-[#1e2d45] flex items-center gap-3 text-[10px] text-[#334155]">
            <span>↑↓ 导航</span>
            <span>Enter 确认</span>
            <span>Esc 关闭</span>
            <span className="ml-auto">{stocks.length.toLocaleString()} 只股票</span>
          </div>
        </div>
      )}
    </div>
  );
};
