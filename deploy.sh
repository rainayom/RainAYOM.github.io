#!/usr/bin/env bash
# 运维知识库 · 一键部署脚本
# 详细说明见 README.md；运行 ./deploy.sh help 查看子命令。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="${VENV:-$ROOT/.venv}"
PY="${PYTHON:-python3}"
VERSION="${VERSION:-1.0}"
ALIASES="${ALIASES:-latest}"

green=$'\033[32m'; red=$'\033[31m'; off=$'\033[0m'
log()  { printf '%s[%s]%s %s\n' "$green" "$(date +%H:%M:%S)" "$off" "$*"; }
warn() { printf '%s[warn]%s %s\n' "$red" "$off" "$*" >&2; }
die()  { printf '%s[err]%s %s\n' "$red" "$off" "$*" >&2; exit 1; }

have() { command -v "$1" >/dev/null 2>&1; }

# root 运行时自动切到仓库属主，规避 git 的 dubious ownership
if [[ "${EUID:-$(id -u)}" -eq 0 && "${DEPLOY_REEXEC:-0}" != "1" ]]; then
  owner="$(stat -c %U "$ROOT/.git" 2>/dev/null || echo mkdocs)"
  export DEPLOY_REEXEC=1
  exec runuser -u "$owner" -- env HOME="/var/lib/$owner" PATH="$VENV/bin:$PATH" bash "$0" "$@"
fi
export PATH="$VENV/bin:$PATH"

run_git() { git -C "$ROOT" "$@"; }

need_venv() {
  [[ -x "$VENV/bin/python" ]] || die "虚拟环境不存在：$VENV（先跑 ./deploy.sh bootstrap）"
  [[ -x "$VENV/bin/mkdocs" ]] || die "mkdocs 未安装（先跑 ./deploy.sh bootstrap）"
}

bootstrap() {
  have "$PY" || die "缺少 $PY"
  if [[ ! -x "$VENV/bin/python" ]]; then
    log "创建虚拟环境 $VENV"
    "$PY" -m venv "$VENV"
  fi
  log "安装 / 更新依赖"
  "$VENV/bin/python" -m pip install -q -U pip
  "$VENV/bin/python" -m pip install -q -r "$ROOT/requirements.txt"
  # pip 生成的入口脚本 shebang 可能指向别的解释器，统一改写
  local f
  for f in "$VENV"/bin/*; do
    [[ -f "$f" ]] || continue
    head -n1 "$f" | grep -q '^#!' || continue
    sed -i "1s|^#!.*|#!$VENV/bin/python|" "$f"
  done
  log "完成：$("$VENV/bin/mkdocs" --version | awk '{print $3}')"
}

serve() {
  need_venv
  log "预览地址 http://$(hostname -I | awk '{print $1}'):8000"
  exec "$VENV/bin/mkdocs" serve -a 0.0.0.0:8000
}

build() {
  need_venv
  "$VENV/bin/mkdocs" build --clean
  log "产物目录：$ROOT/site"
}

push_main() {
  run_git push origin main
  log "main 已推送"
}

deploy() {
  need_venv
  if [[ $# -ge 1 ]]; then VERSION="$1"; fi
  if [[ $# -ge 2 ]]; then ALIASES="$2"; fi
  log "构建并发布版本 $VERSION（别名 $ALIASES）"
  # shellcheck disable=SC2086
  "$VENV/bin/mike" deploy --update-aliases "$VERSION" $ALIASES
  "$VENV/bin/mike" set-default latest
  run_git push origin gh-pages
  log "gh-pages 已推送，Pages 约 1 分钟后生效"
}

status() {
  need_venv
  "$VENV/bin/mike" list || true
  run_git log --oneline -3
  run_git status -sb
}

genkey() {
  local f="${1:-$HOME/.ssh/github_deploy}"
  [[ -f "$f" ]] && die "$f 已存在，先删除或指定其它路径"
  mkdir -p "$(dirname "$f")"
  chmod 700 "$(dirname "$f")"
  ssh-keygen -t ed25519 -f "$f" -N "" -C "mkdocs@$(hostname) mike deploy" >/dev/null
  log "公钥（粘到 Settings → Deploy keys，务必勾 Allow write access）："
  cat "$f.pub"
}

release() {
  need_venv
  local tag="${1:-v$VERSION}"
  local pkg="/tmp/mkdocs-ops-docs-${tag#v}.tar.gz"
  if run_git tag -a "$tag" -m "运维知识库 $tag" 2>/dev/null; then
    log "已建 tag $tag"
  else
    warn "tag $tag 已存在，跳过创建"
  fi
  run_git push origin "$tag" || warn "tag 推送失败（可能已存在）"
  run_git archive --format=tar.gz --prefix="mkdocs-ops-docs-${tag#v}/" -o "$pkg" "$tag"
  log "源码包：$pkg"
  log "到 GitHub → Releases → Draft a new release 选 tag $tag 并上传该包"
}

usage() {
  cat <<'EOF'
运维知识库 · 部署脚本

  ./deploy.sh bootstrap              建虚拟环境并安装依赖
  ./deploy.sh serve                  本地预览 0.0.0.0:8000
  ./deploy.sh build                  只构建到 site/
  ./deploy.sh deploy [版本] [别名]  构建 + mike 发布 + 推 gh-pages（默认 1.0 latest）
  ./deploy.sh push                   只推送 main
  ./deploy.sh status                 版本列表与 git 状态
  ./deploy.sh genkey [路径]          生成 ed25519 部署密钥并打印公钥
  ./deploy.sh release [tag]          打 tag、推 tag、生成源码包（默认 v1.0）
EOF
}

cmd="${1:-help}"
if [[ $# -ge 1 ]]; then shift; fi

case "$cmd" in
  bootstrap) bootstrap ;;
  serve)     serve ;;
  build)     build ;;
  deploy)    deploy "$@" ;;
  push)      push_main ;;
  status)    status ;;
  genkey)    genkey "$@" ;;
  release)   release "$@" ;;
  help|-h|--help) usage ;;
  *)         usage; exit 1 ;;
esac
