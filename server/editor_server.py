#!/usr/bin/env python3
"""md-editor-v3 的本地编辑后端（零依赖，只用标准库）。

身份与权限（v2）：
- 鉴权改为 GitHub 身份：请求头 `Authorization: Bearer <github_token>`
- 后端拿 token 去 api.github.com/user 换身份（带 5 分钟缓存）
- 只有仓库拥有者（OWNER）或对仓库有 push 权限的协作者，才允许直接写文件
- 其他 GitHub 用户：返回 403 {mode: "pr"}，前端改走 fork → 分支 → PR 审核流程

接口：
    GET  /api/session                 登录态（含 login / owner）
    GET  /api/list                    列出 docs 下全部 md
    GET  /api/doc?path=xxx.md         读单个文件
    GET  /api/resolve?url=/1.0/xxx/   按站点 URL 反查源文件
    POST /api/doc {path, content}     保存（拥有者/协作者；限制在 docs 内、只允许 .md）
"""
from __future__ import annotations

import json
import os
import posixpath
import re
import sys
import threading
import time
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DOCS = Path(os.environ.get("DOCS_DIR", "/srv/mkdocs/repo/docs")).resolve()
DIST = Path(os.environ.get("DIST_DIR", "/srv/mkdocs/editor-app/dist")).resolve()
OWNER = os.environ.get("REPO_OWNER", "rainayom")
REPO = os.environ.get("REPO_NAME", "RainAYOM.github.io")
PORT = int(os.environ.get("EDITOR_PORT", "8080"))
VERSION_SEG = re.compile(r"^(v?\d+(\.\d+)*|latest|stable)$")
API = "https://api.github.com"
_CACHE: dict[str, tuple[float, dict]] = {}
_LOCK = threading.Lock()
TTL = 300


def gh(path: str, token: str) -> dict | None:
    req = urllib.request.Request(
        API + path,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "mkdocs-editor",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        sys.stderr.write(f"[editor] github api fail {path}: {e}\n")
        return None


def whoami(token: str) -> dict | None:
    """token -> {login, avatar, name, owner}"""
    if not token:
        return None
    now = time.time()
    with _LOCK:
        hit = _CACHE.get(token)
    if hit and now - hit[0] < TTL:
        return hit[1]
    user = gh("/user", token)
    if not user or "login" not in user:
        return None
    info = {
        "login": user["login"],
        "name": user.get("name") or user["login"],
        "avatar": user.get("avatar_url", ""),
        "owner": user["login"].lower() == OWNER.lower(),
    }
    if not info["owner"]:
        repo = gh(f"/repos/{OWNER}/{REPO}", token) or {}
        info["owner"] = bool((repo.get("permissions") or {}).get("push"))
    with _LOCK:
        _CACHE[token] = (now, info)
    return info


def title_of(p: Path) -> str:
    try:
        for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.startswith("# "):
                return line[2:].strip() or p.stem
    except OSError:
        pass
    return p.stem


def list_docs() -> list[dict]:
    items = []
    for f in sorted(DOCS.rglob("*.md")):
        rel = f.relative_to(DOCS).as_posix()
        if rel.startswith(".") or "/." in rel:
            continue
        items.append({"path": rel, "title": title_of(f)})
    return items


def page_url_of(rel: str) -> str:
    body = rel[:-3] if rel.endswith(".md") else rel
    if body == "index":
        return "/"
    if body.endswith("/index"):
        return "/" + body[: -len("/index")] + "/"
    return "/" + body + "/"


def safe_doc(rel: str) -> Path | None:
    rel = urllib.parse.unquote(rel).replace("\\", "/").lstrip("/")
    rel = posixpath.normpath(rel)
    if rel.startswith("../") or rel == ".." or not rel.endswith(".md"):
        return None
    p = (DOCS / rel).resolve()
    try:
        p.relative_to(DOCS)
    except ValueError:
        return None
    return p


def resolve_url(url: str) -> dict | None:
    raw = urllib.parse.unquote(url).split("?")[0].split("#")[0]
    parts = [s for s in raw.strip("/").split("/") if s]
    if not parts:              # 站点首页 -> docs/index.md
        parts = ["index"]
    cands: list[str] = []

    def variants(segs: list[str], suffix: str) -> None:
        if not segs:
            return
        cands.append("/".join(segs) + suffix)

    for skip in range(0, min(3, len(parts)) + 1):
        segs = parts[skip:]
        if not segs:
            continue
        if VERSION_SEG.match(segs[0]) and skip == 0:
            continue
        variants(segs, "/index.md" if raw.endswith("/") else ".md")
        variants(segs, "/index.md")
        variants(segs, ".md")
        cands.append("/".join(segs) + "/index.md")

    for cand in cands:
        p = safe_doc(cand)
        if p and p.is_file():
            rel = p.relative_to(DOCS).as_posix()
            return {"path": rel, "content": p.read_text(encoding="utf-8"), "page_url": page_url_of(rel)}
    return None


class Handler(SimpleHTTPRequestHandler):
    server_version = "mdEditorBackend/2.0"

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(DIST), **kw)

    # ---------- 鉴权 ----------
    def bearer(self) -> str:
        hdr = self.headers.get("Authorization", "")
        return hdr[7:].strip() if hdr.startswith("Bearer ") else ""

    def me(self) -> dict | None:
        return whoami(self.bearer())

    def need_auth(self) -> bool:
        info = self.me()
        if info:
            self._me = info
            return False
        self.send_json({"error": "未登录或 token 失效", "need_login": True}, 401)
        return True

    # ---------- 工具 ----------
    def send_json(self, obj, code=200) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 8 * 1024 * 1024:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def log_message(self, fmt, *args):
        sys.stderr.write("[editor] %s - %s\n" % (self.address_string(), fmt % args))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    # ---------- 路由 ----------
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path
        if route in ("/api/session", "/api/me"):
            info = self.me()
            if not info:
                return self.send_json({"auth": False, "need_login": True})
            return self.send_json({"auth": True, **info, "repo": f"{OWNER}/{REPO}"})
        if route.startswith("/api/"):
            if self.need_auth():
                return
        if route == "/api/list":
            return self.send_json(list_docs())
        if route == "/api/doc":
            q = urllib.parse.parse_qs(parsed.query)
            p = safe_doc((q.get("path") or [""])[0])
            if not p or not p.is_file():
                return self.send_json({"error": "文件不存在或不在 docs 内"}, 404)
            rel = p.relative_to(DOCS).as_posix()
            return self.send_json({"path": rel, "content": p.read_text(encoding="utf-8"), "page_url": page_url_of(rel)})
        if route == "/api/resolve":
            q = urllib.parse.parse_qs(parsed.query)
            data = resolve_url((q.get("url") or [""])[0])
            if not data:
                return self.send_json({"error": "没有匹配到源文件"}, 404)
            return self.send_json(data)
        if route == "/api/env":
            return self.send_json({"docs": str(DOCS), "owner": OWNER, "repo": REPO})

        # 静态资源 + SPA 兜底
        target = (DIST / route.lstrip("/")).resolve()
        if route == "/" or not target.exists() or DIST not in target.parents and target != DIST:
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/api/doc":
            return self.send_json({"error": "not found"}, 404)
        if self.need_auth():
            return
        try:
            data = self.json_body()
        except Exception:
            return self.send_json({"error": "请求体不是合法 JSON"}, 400)

        info = self._me
        if not info.get("owner"):
            return self.send_json(
                {
                    "error": "你不是本仓库的拥有者/协作者，无法直接写入",
                    "mode": "pr",
                    "login": info["login"],
                    "hint": "请在前端选择「提交审核」，会创建分支并发起 Pull Request，等仓库拥有者合并后生效",
                },
                403,
            )

        p = safe_doc(str(data.get("path", "")))
        content = data.get("content")
        if p is None:
            return self.send_json({"error": "路径不合法，只允许 docs 下的 .md"}, 400)
        if not isinstance(content, str):
            return self.send_json({"error": "content 必须是字符串"}, 400)

        content = content.replace("\r\n", "\n").replace("\r", "\n")
        existed = p.exists()
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        try:
            os.chmod(p, 0o664)
            if os.geteuid() == 0:
                os.chown(p, 1000, os.stat(p.parent).st_gid)
        except PermissionError:
            pass
        return self.send_json(
            {
                "ok": True,
                "path": p.relative_to(DOCS).as_posix(),
                "bytes": len(content.encode("utf-8")),
                "created": not existed,
                "by": info["login"],
                "mode": "direct",
            }
        )


def main() -> None:
    if not DIST.is_dir():
        sys.exit(f"前端未构建：{DIST} 不存在，请先执行 npm run build")
    os.chdir(DIST)
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"editor listening on 0.0.0.0:{PORT}, docs={DOCS}, repo={OWNER}/{REPO}", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
