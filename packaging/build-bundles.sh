#!/usr/bin/env bash
# 打两个发布包：
#   ops-kb-<ver>-source.tar.gz   纯源码
#   ops-kb-<ver>-offline.tar.gz  离线可装（含全部 Python wheels + 编辑器产物 + 安装脚本）
# 用法：packaging/build-bundles.sh [版本号]
set -euo pipefail

VER="${1:-$(date +%Y%m%d)}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/packaging/out"
WHEELS="$ROOT/packaging/wheels"
STAGE="$OUT/ops-kb-$VER-offline"
VENV="${VENV:-/srv/mkdocs/.venv}"

green=$'\033[32m'; off=$'\033[0m'
log() { printf '%s[%s]%s %s\n' "$green" "$(date +%H:%M:%S)" "$off" "$*"; }
die() { printf '[err] %s\n' "$*" >&2; exit 1; }

[[ -d "$ROOT/docs" && -f "$ROOT/mkdocs.yml" ]] || die "不在仓库根目录：$ROOT"
[[ -d "$ROOT/editor" ]] || die "缺少 editor/（编辑器源码）"
[[ -d "$ROOT/server" ]] || die "缺少 server/（编辑器后端）"

if [[ -x "$VENV/bin/python" ]]; then
  PIP=("$VENV/bin/python" -m pip)
else
  PIP=(python3 -m pip)
fi

# 1) 依赖 wheel（离线安装的原料）
rm -rf "$WHEELS" && mkdir -p "$WHEELS"
log "下载依赖 wheel（$("$PIP" --version 2>/dev/null | awk '{print $1,$2}')）"
"${PIP[@]}" download -q --prefer-binary -d "$WHEELS" -r "$ROOT/requirements.txt"
ls "$WHEELS" | wc -l | xargs -I{} echo "  wheels 共 {} 个"

# 2) 编辑器构建产物（仓库内 editor/dist，或线上 /srv/mkdocs/editor-app/dist）
DIST="${EDITOR_DIST:-$ROOT/editor/dist}"
[[ -f "$DIST/index.html" ]] || DIST="/srv/mkdocs/editor-app/dist"
if [[ ! -f "$DIST/index.html" ]]; then
  die "编辑器尚未构建：先 cd editor && npm ci && npm run build"
fi

# 3) 源码包
mkdir -p "$OUT"
SRC_TGZ="$OUT/ops-kb-$VER-source.tar.gz"
log "生成源码包 $SRC_TGZ"
tar -C "$ROOT" \
  --exclude='./.git' --exclude='./site' --exclude='./.venv' \
  --exclude='./packaging/out' --exclude='./packaging/wheels' \
  --exclude='./editor/node_modules' --exclude='./editor/dist' \
  --exclude='*.bak*' --exclude='__pycache__' --exclude='*.pyc' \
  --transform "s|^\./|ops-kb-$VER/|" \
  -czf "$SRC_TGZ" .

# 4) 离线包
rm -rf "$STAGE" && mkdir -p "$STAGE"
log "装配离线包 $STAGE"
tar -C "$ROOT" \
  --exclude='./.git' --exclude='./site' --exclude='./.venv' \
  --exclude='./packaging' --exclude='./editor/node_modules' --exclude='./editor/dist' \
  --exclude='*.bak*' --exclude='__pycache__' --exclude='*.pyc' \
  --transform "s|^\./|site/|" \
  -cf - . | tar -C "$STAGE" -xf -

mkdir -p "$STAGE/editor" "$STAGE/systemd"
cp -a "$DIST" "$STAGE/editor/dist"
cp -a "$ROOT/editor/index.html" "$STAGE/editor/index.html"
cp -a "$ROOT/deploy/"*.service "$ROOT/deploy/"*.timer "$STAGE/systemd/" 2>/dev/null || true
cp -a "$ROOT/deploy/install-offline.sh" "$STAGE/install.sh"
cp -a "$WHEELS" "$STAGE/wheels"
echo "$VER" > "$STAGE/VERSION"
chmod +x "$STAGE/install.sh"

cat > "$STAGE/README-OFFLINE.md" <<EOF
# 运维知识库 $VER · 离线安装包

完全不联网即可安装：Python 依赖均已打包在 \`wheels/\`。

\`\`\`bash
tar xzf ops-kb-$VER-offline.tar.gz
cd ops-kb-$VER-offline
sudo bash install.sh
\`\`\`

默认安装到 \`/srv/mkdocs\`，运行用户 \`mkdocs\`，启动 \`mkdocs-serve\`（:8000）与 \`mkdocs-editor\`（:8080）。
更多参数：\`sudo bash install.sh --help\`。
EOF

OFF_TGZ="$OUT/ops-kb-$VER-offline.tar.gz"
log "打包 $OFF_TGZ"
tar -C "$OUT" -czf "$OFF_TGZ" "ops-kb-$VER-offline"
rm -rf "$STAGE"

log "完成："
du -h "$SRC_TGZ" "$OFF_TGZ" | sed 's/^/  /'
