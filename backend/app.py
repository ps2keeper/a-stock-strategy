"""
A股选股策略分析后端
基于多因子确认体系：K线形态 + 量价分析 + 均线系统 + MACD/KDJ/RSI/布林线
"""

import json
import traceback
from datetime import datetime, timedelta

import akshare as ak
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ── 股票列表缓存（启动后台线程预热，避免首次请求阻塞）──────────────
import threading

_stock_list_cache: list = []
_stock_list_lock = threading.Lock()
_stock_list_loaded = False


def _load_stock_list():
    global _stock_list_cache, _stock_list_loaded
    try:
        df = ak.stock_info_a_code_name()
        with _stock_list_lock:
            _stock_list_cache = [
                {"code": row["code"], "name": row["name"].strip()}
                for _, row in df.iterrows()
            ]
            _stock_list_loaded = True
    except Exception as e:
        print(f"[stock list] 加载失败: {e}")


threading.Thread(target=_load_stock_list, daemon=True).start()


# ─────────────────────────── 指标计算 ────────────────────────────

def calc_ma(close: pd.Series, period: int) -> pd.Series:
    return close.rolling(window=period, min_periods=period).mean()


def calc_ema(close: pd.Series, period: int) -> pd.Series:
    return close.ewm(span=period, adjust=False).mean()


def calc_macd(close: pd.Series, fast=12, slow=26, signal=9):
    ema_fast = calc_ema(close, fast)
    ema_slow = calc_ema(close, slow)
    dif = ema_fast - ema_slow
    dea = calc_ema(dif, signal)
    histogram = (dif - dea) * 2
    return dif, dea, histogram


def calc_kdj(high: pd.Series, low: pd.Series, close: pd.Series, period=9):
    lowest_low = low.rolling(window=period, min_periods=1).min()
    highest_high = high.rolling(window=period, min_periods=1).max()
    rsv = (close - lowest_low) / (highest_high - lowest_low + 1e-10) * 100
    k = rsv.ewm(com=2, adjust=False).mean()
    d = k.ewm(com=2, adjust=False).mean()
    j = 3 * k - 2 * d
    return k, d, j


def calc_rsi(close: pd.Series, period=14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(window=period, min_periods=period).mean()
    loss = (-delta.clip(upper=0)).rolling(window=period, min_periods=period).mean()
    rs = gain / (loss + 1e-10)
    return 100 - 100 / (1 + rs)


def calc_boll(close: pd.Series, period=20, std_mult=2):
    mid = calc_ma(close, period)
    std = close.rolling(window=period, min_periods=period).std()
    upper = mid + std_mult * std
    lower = mid - std_mult * std
    return upper, mid, lower


def calc_volume_ma(volume: pd.Series, period=5) -> pd.Series:
    return volume.rolling(window=period, min_periods=period).mean()


# ─────────────────────────── K线形态识别 ────────────────────────────

def detect_hammer(df: pd.DataFrame) -> pd.Series:
    """锤头线：下影线 >= 2倍实体，上影线 <= 实体/2"""
    body = (df["close"] - df["open"]).abs()
    lower_shadow = df[["open", "close"]].min(axis=1) - df["low"]
    upper_shadow = df["high"] - df[["open", "close"]].max(axis=1)
    return (lower_shadow >= 2 * body) & (upper_shadow <= body / 2) & (body > 0)


def detect_engulfing(df: pd.DataFrame) -> pd.Series:
    """看涨吞没：大阳线吞没前阴线"""
    prev_bear = df["close"].shift(1) < df["open"].shift(1)
    curr_bull = df["close"] > df["open"]
    engulf = (df["open"] < df["close"].shift(1)) & (df["close"] > df["open"].shift(1))
    return prev_bear & curr_bull & engulf


def detect_morning_star(df: pd.DataFrame) -> pd.Series:
    """早晨之星：阴线+小实体+大阳线"""
    day1_bear = df["close"].shift(2) < df["open"].shift(2)
    day2_small = (df["close"].shift(1) - df["open"].shift(1)).abs() < \
                 (df["close"].shift(2) - df["open"].shift(2)).abs() * 0.3
    day3_bull = df["close"] > df["open"]
    day3_recover = df["close"] > (df["open"].shift(2) + df["close"].shift(2)) / 2
    return day1_bear & day2_small & day3_bull & day3_recover


# ─────────────────────────── 策略评分引擎 ────────────────────────────

def analyze_stock(df: pd.DataFrame, config: dict) -> dict:
    """
    对给定的日K数据做全因子分析，返回评分和信号明细。
    config: 策略参数（权重、阈值等）
    """
    if len(df) < 60:
        return {"error": "数据不足（需要至少60日K线）"}

    close = df["close"]
    high = df["high"]
    low = df["low"]
    volume = df["volume"]

    # 均线
    ma5 = calc_ma(close, 5)
    ma10 = calc_ma(close, 10)
    ma20 = calc_ma(close, 20)
    ma60 = calc_ma(close, 60)

    # 成交量均线
    vol_ma5 = calc_volume_ma(volume, 5)

    # MACD
    dif, dea, histogram = calc_macd(close)

    # KDJ
    k, d, j = calc_kdj(high, low, close)

    # RSI
    rsi = calc_rsi(close, 14)

    # 布林线
    boll_upper, boll_mid, boll_lower = calc_boll(close, 20)

    # K线形态
    hammer = detect_hammer(df)
    engulfing = detect_engulfing(df)
    morning_star = detect_morning_star(df)

    # 取最近一个有效数据点
    i = -1

    signals = {}
    score = 0
    max_score = 0

    # ── 1. K线形态 ─────────────────────────────────────────
    if config.get("enable_kline", True):
        kline_score = 0
        kline_max = 3
        max_score += kline_max

        if hammer.iloc[i]:
            kline_score += 1
            signals["kline_hammer"] = {"pass": True, "desc": "锤头线 / 长下影（看涨反转信号）"}
        else:
            signals["kline_hammer"] = {"pass": False, "desc": "未出现锤头线"}

        if engulfing.iloc[i]:
            kline_score += 1
            signals["kline_engulfing"] = {"pass": True, "desc": "看涨吞没形态（大阳吞前阴）"}
        else:
            signals["kline_engulfing"] = {"pass": False, "desc": "未出现吞没形态"}

        if morning_star.iloc[i]:
            kline_score += 1
            signals["kline_morning_star"] = {"pass": True, "desc": "早晨之星（三K底部反转）"}
        else:
            signals["kline_morning_star"] = {"pass": False, "desc": "未出现早晨之星"}

        score += kline_score

    # ── 2. 量价分析 ─────────────────────────────────────────
    if config.get("enable_volume", True):
        max_score += 2

        # 当日放量（>=1.5倍5日均量）
        vol_ratio = volume.iloc[i] / vol_ma5.iloc[i] if vol_ma5.iloc[i] > 0 else 0
        vol_threshold = config.get("vol_ratio_threshold", 1.5)
        if vol_ratio >= vol_threshold:
            score += 1
            signals["volume_surge"] = {
                "pass": True,
                "desc": f"放量上涨（量比={vol_ratio:.2f}x，阈值≥{vol_threshold}x）",
                "value": round(vol_ratio, 2),
            }
        else:
            signals["volume_surge"] = {
                "pass": False,
                "desc": f"量能不足（量比={vol_ratio:.2f}x，阈值≥{vol_threshold}x）",
                "value": round(vol_ratio, 2),
            }

        # 连续3日价升量增
        price_up_3 = all(close.iloc[i - k] > close.iloc[i - k - 1] for k in range(3))
        vol_up_3 = all(volume.iloc[i - k] > volume.iloc[i - k - 1] for k in range(3))
        if price_up_3 and vol_up_3:
            score += 1
            signals["volume_ladder"] = {"pass": True, "desc": "连续3日价升量增（阶梯式放量）"}
        else:
            signals["volume_ladder"] = {"pass": False, "desc": "未见连续3日价升量增"}

    # ── 3. 均线系统 ─────────────────────────────────────────
    if config.get("enable_ma", True):
        max_score += 3

        # 5日金叉10日
        ma5_cross_ma10 = (ma5.iloc[i] > ma10.iloc[i]) and (ma5.iloc[i - 1] <= ma10.iloc[i - 1])
        ma5_above_ma10 = ma5.iloc[i] > ma10.iloc[i]
        if ma5_cross_ma10 or (ma5_above_ma10 and config.get("ma_relaxed", False)):
            score += 1
            signals["ma_5_10"] = {"pass": True, "desc": "5日线上穿/上方10日线（短期金叉）"}
        else:
            signals["ma_5_10"] = {"pass": False, "desc": "5日线未突破10日线"}

        # 股价站上60日线
        price_above_ma60 = close.iloc[i] > ma60.iloc[i]
        ma60_flat_or_up = ma60.iloc[i] >= ma60.iloc[i - 5]  # 近5日走平或上翘
        if price_above_ma60 and ma60_flat_or_up:
            score += 1
            signals["ma_60"] = {"pass": True, "desc": "股价站上60日线且60日线走平/上翘（中线确认）"}
        else:
            signals["ma_60"] = {
                "pass": False,
                "desc": f"股价{'未站上' if not price_above_ma60 else '站上'}60日线，"
                        f"60日线{'走平/上翘' if ma60_flat_or_up else '向下'}",
            }

        # 均线多头排列
        bull_arrange = (ma5.iloc[i] > ma10.iloc[i] > ma20.iloc[i] > ma60.iloc[i])
        if bull_arrange:
            score += 1
            signals["ma_bull_arrange"] = {"pass": True, "desc": "均线多头排列（5>10>20>60）"}
        else:
            signals["ma_bull_arrange"] = {"pass": False, "desc": "均线未形成多头排列"}

    # ── 4. MACD ─────────────────────────────────────────────
    if config.get("enable_macd", True):
        max_score += 1
        dif_cross_dea = (dif.iloc[i] > dea.iloc[i]) and (dif.iloc[i - 1] <= dea.iloc[i - 1])
        macd_gold = dif.iloc[i] > dea.iloc[i]
        hist_grow = histogram.iloc[i] > histogram.iloc[i - 1] > 0
        if (dif_cross_dea or macd_gold) and hist_grow:
            score += 1
            signals["macd"] = {
                "pass": True,
                "desc": f"MACD金叉+红柱扩大（DIF={dif.iloc[i]:.3f}, DEA={dea.iloc[i]:.3f}）",
                "dif": round(float(dif.iloc[i]), 4),
                "dea": round(float(dea.iloc[i]), 4),
                "hist": round(float(histogram.iloc[i]), 4),
            }
        else:
            signals["macd"] = {
                "pass": False,
                "desc": f"MACD未确认（DIF={dif.iloc[i]:.3f}, DEA={dea.iloc[i]:.3f}）",
                "dif": round(float(dif.iloc[i]), 4),
                "dea": round(float(dea.iloc[i]), 4),
                "hist": round(float(histogram.iloc[i]), 4),
            }

    # ── 5. KDJ ──────────────────────────────────────────────
    if config.get("enable_kdj", True):
        max_score += 1
        j_oversold = j.iloc[i - 1] < config.get("kdj_oversold_threshold", 20)
        kdj_gold = (k.iloc[i] > d.iloc[i]) and (k.iloc[i - 1] <= d.iloc[i - 1])
        if j_oversold and kdj_gold:
            score += 1
            signals["kdj"] = {
                "pass": True,
                "desc": f"KDJ超卖后金叉（J={j.iloc[i]:.1f}）",
                "k": round(float(k.iloc[i]), 2),
                "d": round(float(d.iloc[i]), 2),
                "j": round(float(j.iloc[i]), 2),
            }
        else:
            signals["kdj"] = {
                "pass": False,
                "desc": f"KDJ未满足条件（K={k.iloc[i]:.1f}, D={d.iloc[i]:.1f}, J={j.iloc[i]:.1f}）",
                "k": round(float(k.iloc[i]), 2),
                "d": round(float(d.iloc[i]), 2),
                "j": round(float(j.iloc[i]), 2),
            }

    # ── 6. RSI ──────────────────────────────────────────────
    if config.get("enable_rsi", True):
        max_score += 1
        rsi_val = rsi.iloc[i]
        rsi_prev = rsi.iloc[i - 1]
        rsi_threshold = config.get("rsi_oversold_threshold", 30)
        rsi_breakout = config.get("rsi_breakout", 50)
        if rsi_prev < rsi_threshold and rsi_val > rsi_breakout:
            score += 1
            signals["rsi"] = {
                "pass": True,
                "desc": f"RSI从超卖区上穿{rsi_breakout}（当前={rsi_val:.1f}）",
                "value": round(float(rsi_val), 2),
            }
        elif rsi_prev < rsi_threshold:
            signals["rsi"] = {
                "pass": False,
                "desc": f"RSI超卖但未突破{rsi_breakout}（当前={rsi_val:.1f}）",
                "value": round(float(rsi_val), 2),
            }
        else:
            signals["rsi"] = {
                "pass": False,
                "desc": f"RSI未在超卖区（当前={rsi_val:.1f}）",
                "value": round(float(rsi_val), 2),
            }

    # ── 7. 布林线 ────────────────────────────────────────────
    if config.get("enable_boll", True):
        max_score += 1
        touched_lower = low.iloc[i - 1] <= boll_lower.iloc[i - 1]
        above_mid = close.iloc[i] > boll_mid.iloc[i]
        if touched_lower and above_mid:
            score += 1
            signals["boll"] = {
                "pass": True,
                "desc": f"触下轨后突破中轨（下轨={boll_lower.iloc[i]:.2f}, 中轨={boll_mid.iloc[i]:.2f}）",
                "upper": round(float(boll_upper.iloc[i]), 2),
                "mid": round(float(boll_mid.iloc[i]), 2),
                "lower": round(float(boll_lower.iloc[i]), 2),
            }
        else:
            signals["boll"] = {
                "pass": False,
                "desc": f"布林线未确认（收盘={close.iloc[i]:.2f}, 中轨={boll_mid.iloc[i]:.2f}）",
                "upper": round(float(boll_upper.iloc[i]), 2),
                "mid": round(float(boll_mid.iloc[i]), 2),
                "lower": round(float(boll_lower.iloc[i]), 2),
            }

    # ── 综合评分 & 投资建议 ──────────────────────────────────
    if max_score == 0:
        max_score = 1
    score_pct = round(score / max_score * 100, 1)

    passed_count = sum(1 for v in signals.values() if v.get("pass"))
    total_count = len(signals)

    # 三确认法则：K线+量价+至少两个指标同时满足
    kline_pass = any(signals.get(k, {}).get("pass") for k in ["kline_hammer", "kline_engulfing", "kline_morning_star"])
    vol_pass = signals.get("volume_surge", {}).get("pass", False)
    indicator_pass_count = sum(
        1 for k in ["macd", "kdj", "rsi", "boll"]
        if signals.get(k, {}).get("pass")
    )
    three_confirm = kline_pass and vol_pass and indicator_pass_count >= 2

    if three_confirm and score_pct >= 70:
        recommendation = "强烈买入"
        suggestion = "三确认法则全部满足，可入场3成仓，确认上涨后分批加仓。止损设入场价-7%。"
        color = "green"
    elif score_pct >= 60 and (kline_pass or vol_pass) and indicator_pass_count >= 1:
        recommendation = "谨慎买入"
        suggestion = "多数信号满足但未达三确认，可观望等待更多确认信号，或超小仓位试探。"
        color = "yellow"
    elif score_pct >= 40:
        recommendation = "持续观察"
        suggestion = "部分信号满足，继续等待趋势确认，不宜入场。"
        color = "orange"
    else:
        recommendation = "回避/观望"
        suggestion = "信号不足，市场方向不明，严格等待。宁可错过，不可做错。"
        color = "red"

    # 止损位
    entry_price = float(close.iloc[i])
    stop_loss = round(entry_price * (1 - config.get("stop_loss_pct", 0.07)), 2)

    # K线数据序列化
    kline_data = []
    for idx, row in df.tail(120).iterrows():
        kline_data.append({
            "date": str(idx)[:10],
            "open": round(float(row["open"]), 2),
            "close": round(float(row["close"]), 2),
            "high": round(float(row["high"]), 2),
            "low": round(float(row["low"]), 2),
            "volume": int(row["volume"]),
        })

    # 指标序列（最近120日）
    n = 120
    dates = [str(x)[:10] for x in df.index[-n:]]

    def safe_list(series):
        return [round(float(v), 4) if not np.isnan(v) else None for v in series.iloc[-n:]]

    return {
        "score": score,
        "max_score": max_score,
        "score_pct": score_pct,
        "passed_count": passed_count,
        "total_count": total_count,
        "three_confirm": three_confirm,
        "recommendation": recommendation,
        "suggestion": suggestion,
        "color": color,
        "entry_price": entry_price,
        "stop_loss": stop_loss,
        "signals": signals,
        "kline_data": kline_data,
        "chart": {
            "dates": dates,
            "ma5": safe_list(ma5),
            "ma10": safe_list(ma10),
            "ma20": safe_list(ma20),
            "ma60": safe_list(ma60),
            "dif": safe_list(dif),
            "dea": safe_list(dea),
            "histogram": safe_list(histogram),
            "k": safe_list(k),
            "d": safe_list(d),
            "j": safe_list(j),
            "rsi": safe_list(rsi),
            "boll_upper": safe_list(boll_upper),
            "boll_mid": safe_list(boll_mid),
            "boll_lower": safe_list(boll_lower),
            "volume": [int(v) for v in df["volume"].iloc[-n:]],
            "vol_ma5": safe_list(vol_ma5),
        },
    }


# ─────────────────────────── API 路由 ────────────────────────────

@app.route("/api/stock/kline", methods=["GET"])
def get_kline():
    """获取股票日K数据并进行因子分析"""
    code = request.args.get("code", "").strip()
    if not code:
        return jsonify({"error": "请提供股票代码"}), 400

    # 策略配置
    config = {
        "enable_kline": request.args.get("enable_kline", "true") == "true",
        "enable_volume": request.args.get("enable_volume", "true") == "true",
        "enable_ma": request.args.get("enable_ma", "true") == "true",
        "enable_macd": request.args.get("enable_macd", "true") == "true",
        "enable_kdj": request.args.get("enable_kdj", "true") == "true",
        "enable_rsi": request.args.get("enable_rsi", "true") == "true",
        "enable_boll": request.args.get("enable_boll", "true") == "true",
        "vol_ratio_threshold": float(request.args.get("vol_ratio_threshold", 1.5)),
        "kdj_oversold_threshold": float(request.args.get("kdj_oversold_threshold", 20)),
        "rsi_oversold_threshold": float(request.args.get("rsi_oversold_threshold", 30)),
        "rsi_breakout": float(request.args.get("rsi_breakout", 50)),
        "stop_loss_pct": float(request.args.get("stop_loss_pct", 0.07)),
        "ma_relaxed": request.args.get("ma_relaxed", "false") == "true",
    }

    try:
        end_date = datetime.now().strftime("%Y%m%d")
        start_date = (datetime.now() - timedelta(days=365)).strftime("%Y%m%d")

        df = ak.stock_zh_a_hist(
            symbol=code,
            period="daily",
            start_date=start_date,
            end_date=end_date,
            adjust="qfq",
        )

        if df is None or len(df) == 0:
            return jsonify({"error": f"未找到股票 {code} 的数据"}), 404

        df = df.rename(columns={
            "日期": "date",
            "开盘": "open",
            "收盘": "close",
            "最高": "high",
            "最低": "low",
            "成交量": "volume",
            "成交额": "amount",
            "涨跌幅": "pct_chg",
        })
        df["date"] = pd.to_datetime(df["date"])
        df = df.set_index("date").sort_index()

        # 获取股票名称
        try:
            info = ak.stock_individual_info_em(symbol=code)
            stock_name = info[info["item"] == "股票简称"]["value"].values[0]
        except Exception:
            stock_name = code

        result = analyze_stock(df, config)
        result["code"] = code
        result["name"] = stock_name

        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"获取数据失败：{str(e)}"}), 500


@app.route("/api/market/overview", methods=["GET"])
def get_market_overview():
    """大盘概况：上证/深证/北向资金/成交额/涨停板数量"""
    try:
        result = {}

        # 上证指数
        try:
            sh = ak.stock_zh_index_daily(symbol="sh000001")
            sh = sh.tail(10)
            result["sh_index"] = {
                "close": round(float(sh["close"].iloc[-1]), 2),
                "pct_chg": round(
                    (sh["close"].iloc[-1] / sh["close"].iloc[-2] - 1) * 100, 2
                ),
                "data": [
                    {"date": str(r["date"])[:10], "close": round(float(r["close"]), 2)}
                    for _, r in sh.iterrows()
                ],
            }
        except Exception as e:
            result["sh_index"] = {"error": str(e)}

        # 深证指数
        try:
            sz = ak.stock_zh_index_daily(symbol="sz399001")
            sz = sz.tail(10)
            result["sz_index"] = {
                "close": round(float(sz["close"].iloc[-1]), 2),
                "pct_chg": round(
                    (sz["close"].iloc[-1] / sz["close"].iloc[-2] - 1) * 100, 2
                ),
            }
        except Exception as e:
            result["sz_index"] = {"error": str(e)}

        # 市场情绪：涨跌停统计（stock_market_activity_legu 一次返回全部）
        try:
            activity = ak.stock_market_activity_legu()
            # 转成 {item: value} 字典方便取值
            act = dict(zip(activity["item"], activity["value"]))
            up_count   = int(act.get("涨停", 0) or 0)
            down_count = int(act.get("跌停", 0) or 0)
            rise_count = int(act.get("上涨", 0) or 0)
            fall_count = int(act.get("下跌", 0) or 0)
            activity_rate = str(act.get("活跃度", "")).replace("%", "")
            result["limit_up"]     = up_count
            result["limit_down"]   = down_count
            result["rise_count"]   = rise_count
            result["fall_count"]   = fall_count
            result["activity_rate"] = activity_rate
            result["sentiment"] = (
                "情绪启动" if up_count >= 30 else "情绪低迷" if up_count < 10 else "情绪中性"
            )
        except Exception:
            result["limit_up"]    = None
            result["limit_down"]  = None
            result["sentiment"]   = "数据获取失败"

        # 北向资金
        try:
            north = ak.stock_connect_position_statistics_em()
            result["north_flow"] = "已获取（北向持股数据）"
        except Exception:
            result["north_flow"] = None

        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/screen/batch", methods=["POST"])
def batch_screen():
    """批量选股：传入股票代码列表，返回通过三确认的股票"""
    data = request.get_json()
    codes = data.get("codes", [])
    config = data.get("config", {})

    results = []
    for code in codes[:20]:  # 最多20只，防止超时
        try:
            end_date = datetime.now().strftime("%Y%m%d")
            start_date = (datetime.now() - timedelta(days=365)).strftime("%Y%m%d")
            df = ak.stock_zh_a_hist(
                symbol=code, period="daily",
                start_date=start_date, end_date=end_date, adjust="qfq"
            )
            if df is None or len(df) < 60:
                continue
            df = df.rename(columns={
                "日期": "date", "开盘": "open", "收盘": "close",
                "最高": "high", "最低": "low", "成交量": "volume",
            })
            df["date"] = pd.to_datetime(df["date"])
            df = df.set_index("date").sort_index()

            res = analyze_stock(df, config)
            results.append({
                "code": code,
                "score_pct": res.get("score_pct"),
                "recommendation": res.get("recommendation"),
                "three_confirm": res.get("three_confirm"),
                "entry_price": res.get("entry_price"),
                "stop_loss": res.get("stop_loss"),
            })
        except Exception:
            pass

    results.sort(key=lambda x: x.get("score_pct", 0), reverse=True)
    return jsonify({"results": results})


@app.route("/api/stock/prices", methods=["POST"])
def get_prices():
    """批量获取最新收盘价，供持仓估值使用"""
    data = request.get_json()
    codes = data.get("codes", [])
    if not codes:
        return jsonify({"prices": {}})

    prices = {}
    for code in codes[:30]:
        try:
            end_date = datetime.now().strftime("%Y%m%d")
            start_date = (datetime.now() - timedelta(days=10)).strftime("%Y%m%d")
            df = ak.stock_zh_a_hist(
                symbol=code, period="daily",
                start_date=start_date, end_date=end_date, adjust="qfq"
            )
            if df is not None and len(df) > 0:
                col = "收盘" if "收盘" in df.columns else "close"
                prices[code] = round(float(df[col].iloc[-1]), 2)
        except Exception:
            pass

    return jsonify({"prices": prices})


@app.route("/api/stock/list", methods=["GET"])
def stock_list():
    """返回全量A股列表（code + name），供前端拼音/汉字/代码搜索"""
    with _stock_list_lock:
        if not _stock_list_loaded:
            return jsonify({"ready": False, "stocks": []})
        return jsonify({"ready": True, "stocks": _stock_list_cache})


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": datetime.now().isoformat()})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)
