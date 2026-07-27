#!/usr/bin/env bash
#
# data_update.sh - 数据导出与部署自动化脚本
# 用途: 在 venv 虚拟环境中运行 export.py 导出数据，并提交推送到 GitHub
#

set -euo pipefail

# 切换到项目根目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "========================================"
echo "  kevi_nya 数据更新脚本"
echo "========================================"

# 1. 激活虚拟环境并运行导出
echo ""
echo "[1/4] 激活虚拟环境并导出数据..."
source venv/bin/activate
python tools/export.py

# 2. 添加生成的 data.json
echo ""
echo "[2/4] 暂存 data.json..."
git add data.json

# 3. 提交更改
echo ""
echo "[3/4] 提交更改..."
git commit -m "feat: 更改网站内容"

# 4. 推送到远程
echo ""
echo "[4/4] 推送到 GitHub..."
git push -u origin main

echo ""
echo "✅ 数据更新完毕！"
