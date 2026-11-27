"""构建后生成 tags.json：给站点的 Ctrl+K 搜索弹窗做标签筛选。

输出结构：
{
  "tags": [{"name": "部署", "count": 12}, ...],
  "docs": {"guide/": {"title": "使用指南", "tags": ["部署", "mkdocs"]}, ...}
}
"""

import json
import os
import re

FRONT = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.S)


def _tags_of(front):
    inline = re.search(r"^tags:\s*\[(.+?)\]", front, re.M)
    if inline:
        return [t.strip().strip("\"'") for t in inline.group(1).split(",") if t.strip()]
    block = re.search(r"^tags:\s*\n((?:\s*-\s*.+\n?)+)", front, re.M)
    if block:
        return [re.sub(r"^\s*-\s*", "", line).strip().strip("\"'") for line in block.group(1).splitlines() if line.strip()]
    single = re.search(r"^tags:\s+(\S.*)$", front, re.M)
    if single:
        return [single.group(1).strip().strip("\"'")]
    return []


def on_post_build(config):
    docs_dir = config["docs_dir"]
    site_dir = config["site_dir"]
    items = []

    for root, dirs, files in os.walk(docs_dir):
        dirs[:] = [d for d in dirs if not d.startswith(".") and not d.endswith(".assets")]
        for name in files:
            if not name.endswith(".md"):
                continue
            path = os.path.join(root, name)
            rel = os.path.relpath(path, docs_dir).replace(os.sep, "/")
            try:
                text = open(path, encoding="utf-8").read()
            except OSError:
                continue
            match = FRONT.match(text)
            tags = _tags_of(match.group(1)) if match else []
            body = text[match.end():] if match else text
            heading = re.search(r"^#\s+(.+)$", body, re.M)
            title = heading.group(1).strip() if heading else rel
            url = rel[:-3]
            if url.endswith("index"):
                url = url[:-5]
            if url and not url.endswith("/"):
                url += "/"
            items.append({"url": url, "title": title, "tags": tags})

    counts = {}
    for item in items:
        for tag in item["tags"]:
            counts[tag] = counts.get(tag, 0) + 1

    data = {
        "tags": sorted(
            [{"name": k, "count": v} for k, v in counts.items()],
            key=lambda x: (-x["count"], x["name"]),
        ),
        "docs": {it["url"]: {"title": it["title"], "tags": it["tags"]} for it in items},
    }

    try:
        os.makedirs(site_dir, exist_ok=True)
        with open(os.path.join(site_dir, "tags.json"), "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False)
    except OSError as exc:
        print(f"[tags_json] 写入失败：{exc}")
