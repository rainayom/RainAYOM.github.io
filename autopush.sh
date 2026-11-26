#!/usr/bin/env bash
# 文档改动自动提交并发布到 GitHub Pages
# 由 mkdocs-autopush.timer 每 5 分钟触发；手工执行等价于立即同步一次。
set -euo pipefail

ROOT="${ROOT:-/srv/mkdocs/repo}"
VENV="${VENV:-/srv/mkdocs/.venv}"
VERSION="${VERSION:-1.0}"
ALIAS="${ALIAS:-latest}"
LOCK="${LOCK:-/var/lib/mkdocs/autopush.lock}"

export PATH="$VENV/bin:/usr/local/bin:/usr/bin:/bin"
export HOME="${HOME:-/var/lib/mkdocs}"

log() { printf '[%s] %s\n' "$(date +'%F %T')" "$*"; }
die() { printf '[err] %s\n' "$*" >&2; exit 1; }

[[ -d "$ROOT/.git" ]] || die "不是 git 仓库：$ROOT"
[[ -x "$VENV/bin/mike" ]] || die "缺少 mike：$VENV/bin/mike"

# 单实例，避免定时器与手工触发撞车
mkdir -p "$(dirname "$LOCK")"
exec 9>"$LOCK"
flock -n 9 || { log "已有实例在运行，跳过本次"; exit 0; }

cd "$ROOT"

# 0) 新文档自动补标签（幂等：已带 tags 的文件不动，无新文件时几毫秒返回）
if [[ -x "$VENV/bin/python" && -f "$ROOT/tools/autotag.py" ]]; then
  if ! "$VENV/bin/python" "$ROOT/tools/autotag.py" "$ROOT/docs" >/tmp/autotag.log 2>&1; then
    log "autotag 执行失败，详见 /tmp/autotag.log"
  elif grep -q '新增标签 0 个' /tmp/autotag.log; then
    log "标签无需补全"
  else
    log "已为新文档补标签：$(grep -c '^\[tag\]' /tmp/autotag.log) 个"
  fi
fi

# 1) 有无改动
if [[ -n "$(git status --porcelain)" ]]; then
  log "检测到改动，提交中"
  git add -A
  git commit -q -m "auto: $(date +'%F %T') 自动同步文档" || log "无实际变更，跳过提交"
else
  log "工作区干净，无新增改动"
fi

# 2) main 是否领先远端
if git rev-parse --verify -q origin/main >/dev/null; then
  ahead="$(git rev-list --count origin/main..main)"
  if [[ "$ahead" -gt 0 ]]; then
    log "推送 main（$ahead 个提交）"
    git push -q origin main
  else
    log "main 与远端一致"
  fi
else
  log "远端 main 未知，直接推送"
  git push -q -u origin main
fi

# 3) 构建并发布版本，产出 gh-pages
log "mike deploy $VERSION -> $ALIAS"
if mike deploy --update-aliases "$VERSION" "$ALIAS" 2>&1 | tail -3; then
  mike set-default "$ALIAS" >/dev/null 2>&1 || true
  log "推送 gh-pages"
  git push -q origin gh-pages
  log "完成，Pages 约 1 分钟后更新：https://rainayom.github.io/"
else
  die "mike deploy 失败"
fi
