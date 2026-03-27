#!/bin/bash
# 启动A股选股策略分析系统

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== A股选股策略分析系统 ==="
echo ""

# 启动后端
echo "[1/2] 启动 Flask 后端 (port 5001)..."
cd "$ROOT"
"$ROOT/backend-env/bin/python" "$ROOT/backend/app.py" &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# 等待后端就绪
sleep 2

# 启动前端
echo "[2/2] 启动前端开发服务器 (port 5173)..."
cd "$ROOT/stock-strategy"
npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "  前端地址: http://localhost:5173"
echo "  后端地址: http://localhost:5001"
echo ""
echo "  按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '已停止'; exit" SIGINT SIGTERM
wait
