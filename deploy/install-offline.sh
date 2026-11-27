#!/usr/bin/env bash
# 离线安装：不联网即可完成部署（Python 依赖全部来自本包 wheels/）
# 用法：sudo bash install.sh [--prefix DIR] [--user NAME] [--with-versions] [--help]
set -euo pipefail

PREFIX="/srv/mkdocs"
RUNUSER="mkdocs"
RUNGROUP="docs"
WITH_VERSIONS="0"
BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="$(cat "$BUNDLE_DIR/VERSION" 2>/dev/null || echo unknown)"

green=$'\033[32m'; red=$'\033[31m'; off=$'\033[0m'
log()  { printf '%s[%s]%s %s\n' "$green" "$(date +%H:%M:%S)" "$off" "$*"; }
warn() { printf '%s[warn]%s %s\n' "$red" "$off" "$*" >&2; }
die()  { printf '%s[err]%s %s\n' "$red" "$off" "$*" >&2; exit 1; }

usage() {
  cat <<EOF
运维知识库 · 离线安装器（包版本 $VERSION）

  sudo bash install.sh                    默认装到 /srv/mkdocs，运行用户 mkdocs
  sudo bash install.sh --prefix /opt/kb   换安装目录
  sudo bash install.sh --user kb          换运行用户（同名前缀组自动创建）
  sudo bash install.sh --with-versions    额外启用 mike 多版本服务（:8001）
  sudo bash install.sh --no-start         只铺文件，不启动服务

安装内容：站点源码 → \$PREFIX/repo；编辑器产物 → \$PREFIX/editor-app；
Python 依赖 → \$PREFIX/.venv（--no-index 从 wheels 装）；systemd 单元 → /etc/systemd/system。
EOF
}

START="1"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prefix) PREFIX="$2"; shift 2 ;;
    --user) RUNUSER="$2"; RUNGROUP="$2"; shift 2 ;;
    --with-versions) WITH_VERSIONS="1"; shift ;;
    --no-start) START="0"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "未知参数：$1（用 --help 看用法）" ;;
  esac
done

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "请用 root 运行：sudo bash install.sh"
[[ -d "$BUNDLE_DIR/wheels" ]] || die "包不完整：缺少 wheels/"

PY="$(command -v python3 || true)"
[[ -n "$PY" ]] || die "缺少 python3"
"$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' || die "需要 Python 3.9+"
log "Python：$("$PY" -V 2>&1)"

# 1) 用户与组
if ! getent group "$RUNGROUP" >/dev/null; then
  log "创建组 $RUNGROUP"
  groupadd -r "$RUNGROUP"
fi
if ! id "$RUNUSER" >/dev/null 2>&1; then
  log "创建用户 $RUNUSER"
  useradd -r -m -d "/var/lib/$RUNUSER" -s /bin/bash -g "$RUNGROUP" "$RUNUSER"
else
  usermod -aG "$RUNGROUP" "$RUNUSER" || true
fi

# 2) 铺站点与编辑器
log "安装目录 $PREFIX"
mkdir -p "$PREFIX/repo" "$PREFIX/editor-app"
cp -a "$BUNDLE_DIR/site/." "$PREFIX/repo/"
rm -rf "$PREFIX/repo/site"
cp -a "$BUNDLE_DIR/editor/dist" "$PREFIX/editor-app/dist"
cp -a "$BUNDLE_DIR/editor/index.html" "$PREFIX/editor-app/index.html"
cp -a "$BUNDLE_DIR/site/server/editor_server.py" "$PREFIX/editor_server.py"
chown -R "$RUNUSER:$RUNGROUP" "$PREFIX/repo" "$PREFIX/editor-app" "$PREFIX/editor_server.py"

# 3) 离线装依赖
if [[ ! -x "$PREFIX/.venv/bin/python" ]]; then
  log "创建虚拟环境"
  "$PY" -m venv "$PREFIX/.venv"
fi
log "从 wheels 安装依赖（不访问网络）"
"$PREFIX/.venv/bin/python" -m pip install -q --no-index --find-links "$BUNDLE_DIR/wheels" \
  -r "$PREFIX/repo/requirements.txt"
for f in "$PREFIX"/.venv/bin/*; do
  [[ -f "$f" ]] || continue
  head -n1 "$f" | grep -q '^#!' || continue
  sed -i "1s|^#!.*|#!$PREFIX/.venv/bin/python|" "$f"
done

# 4) 本地 git 仓库（mike 与版本服务需要）
if command -v git >/dev/null 2>&1 && [[ ! -d "$PREFIX/repo/.git" ]]; then
  log "初始化本地 git 仓库（仅用于 mike 版本记录）"
  runuser -u "$RUNUSER" -- env HOME="/var/lib/$RUNUSER" git -C "$PREFIX/repo" init -q
  runuser -u "$RUNUSER" -- env HOME="/var/lib/$RUNUSER" git -C "$PREFIX/repo" \
    -c user.name=installer -c user.email=installer@local add -A
  runuser -u "$RUNUSER" -- env HOME="/var/lib/$RUNUSER" git -C "$PREFIX/repo" \
    -c user.name=installer -c user.email=installer@local commit -qm "offline install $VERSION" || true
fi

# 5) systemd 单元
UNITS=("mkdocs-serve.service" "mkdocs-editor.service")
[[ "$WITH_VERSIONS" == "1" ]] && UNITS+=("mkdocs-versions.service")
for u in "${UNITS[@]}"; do
  sed -e "s|/srv/mkdocs|$PREFIX|g" \
      -e "s|User=mkdocs|User=$RUNUSER|g" \
      -e "s|Group=docs|Group=$RUNGROUP|g" \
      -e "s|HOME=/var/lib/mkdocs|HOME=/var/lib/$RUNUSER|g" \
      "$BUNDLE_DIR/systemd/$u" > "/etc/systemd/system/$u"
  log "写入 /etc/systemd/system/$u"
done
systemctl daemon-reload

chown -R "$RUNUSER:$RUNGROUP" "$PREFIX/repo" "$PREFIX/editor-app" "$PREFIX/editor_server.py"
chmod -R a+rX "$PREFIX/repo" "$PREFIX/editor-app"

if [[ "$START" == "1" ]]; then
  log "启动服务"
  systemctl enable --now mkdocs-serve mkdocs-editor >/dev/null 2>&1 || true
  [[ "$WITH_VERSIONS" == "1" ]] && systemctl enable --now mkdocs-versions >/dev/null 2>&1 || true
  sleep 3
  for u in "${UNITS[@]}"; do
    printf '  %-24s %s\n' "$u" "$(systemctl is-active "$u" 2>/dev/null || true)"
  done
fi

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
cat <<EOF

安装完成（包版本 $VERSION）

  站点        http://${IP:-<IP>}:8000
  编辑器      http://${IP:-<IP>}:8080
  多版本      $( [[ "$WITH_VERSIONS" == "1" ]] && echo "http://${IP:-<IP>}:8001" || echo "未启用（--with-versions 开启）")

  文档目录    $PREFIX/repo/docs
  日志        journalctl -u mkdocs-serve -f
  重新发布    sudo -u $RUNUSER env PATH=$PREFIX/.venv/bin:\$PATH bash $PREFIX/repo/deploy.sh deploy 1.0 latest

离线包不含 GitHub 远端凭据，Pages 自动发布（autopush）默认未启用。
EOF
