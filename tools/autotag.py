#!/usr/bin/env python3
"""给缺少 tags 的文档自动补 front matter 标签，供 tags 插件生成标签索引。

规则：
- 取文档在 docs/ 下的第一级目录名作为标签（根目录文档用「通用」）；
- 已有 tags 的文件跳过，docs/tags.md（标签索引页）跳过；
- 幂等，重复运行不会重复写入。

用法：
    python3 tools/autotag.py docs
    python3 tools/autotag.py docs --dry-run
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SKIP_NAMES = {"tags.md"}
TAGS_RE = re.compile(r"^tags:", re.M)
FM_RE = re.compile(r"^---\n(.*?)\n---\n", re.S)


def tags_for(path: Path, docs_root: Path) -> str:
    rel = path.relative_to(docs_root)
    parts = rel.parts
    if len(parts) <= 1:
        return "通用"
    return parts[0]


def add_tags(text: str, tag: str) -> str:
    block = f"tags:\n  - {tag}\n"
    if text.startswith("---\n"):
        m = FM_RE.match(text)
        if m:
            body = m.group(1)
            if TAGS_RE.search(body):
                return text
            new_fm = f"---\n{body}\n{block}---\n"
            return new_fm + text[m.end():]
    return f"---\n{block}---\n\n" + text


def main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    args = [a for a in argv if not a.startswith("--")]
    if not args:
        print(__doc__)
        return 2

    docs_root = Path(args[0]).resolve()
    if not docs_root.is_dir():
        print(f"目录不存在：{docs_root}")
        return 2

    added = skipped = 0
    for f in sorted(docs_root.rglob("*.md")):
        if f.name in SKIP_NAMES:
            continue
        text = f.read_text(encoding="utf-8")
        if TAGS_RE.search(text[:2000]):
            skipped += 1
            continue
        tag = tags_for(f, docs_root)
        new = add_tags(text, tag)
        if new == text:
            skipped += 1
            continue
        added += 1
        print(f"{'[dry]' if dry else '[tag]'} {f.relative_to(docs_root)} -> {tag}")
        if not dry:
            f.write_text(new, encoding="utf-8")

    print(f"\n新增标签 {added} 个，已有标签跳过 {skipped} 个。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
