#!/usr/bin/env python3
"""把「多个 H1」的文档整理成单一 H1 + 层级递增，让 Material 右侧目录能生成。

Material 的 toc.html 逻辑：若 page.toc 的第一项是 level 1，就只取它的 children。
文档里出现多个 `#` 时，第一个 H1 的 children 为空，右侧目录就整块空白。

规则：
- 第一个 H1 保留为页面标题，其余所有标题统一降一级（H1→H2、H2→H3 …，最深 H6）；
- 顺带把 CRLF/CR 换成 LF；
- 跳过 front matter 与代码块内的 `#`。

用法：
    python3 tools/fix_headings.py docs/Linux基础教程
    python3 tools/fix_headings.py docs/Linux基础教程 --dry-run
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

HEAD = re.compile(r"^(#{1,6})(\s+)(.*)$")
FENCE = re.compile(r"^\s*(```|~~~)")


def fix_text(text: str) -> tuple[str, int]:
    raw = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = raw.split("\n")
    out: list[str] = []
    seen_h1 = False
    shifted = 0
    in_front_matter = False
    in_code = False

    for idx, line in enumerate(lines):
        if idx == 0 and line.strip() == "---":
            in_front_matter = True
            out.append(line)
            continue
        if in_front_matter:
            out.append(line)
            if line.strip() == "---":
                in_front_matter = False
            continue
        if FENCE.match(line):
            in_code = not in_code
            out.append(line)
            continue
        if not in_code:
            m = HEAD.match(line)
            if m:
                level = len(m.group(1))
                if level == 1 and not seen_h1:
                    seen_h1 = True
                else:
                    new_level = min(level + 1, 6)
                    if new_level != level:
                        shifted += 1
                        line = "#" * new_level + m.group(2) + m.group(3)
        out.append(line)

    return "\n".join(out), shifted


def main(argv: list[str]) -> int:
    dry = "--dry-run" in argv
    args = [a for a in argv if not a.startswith("--")]
    if not args:
        print(__doc__)
        return 2

    targets = []
    for a in args:
        p = Path(a)
        if p.is_dir():
            targets.extend(sorted(p.rglob("*.md")))
        elif p.is_file():
            targets.append(p)
        else:
            print(f"跳过（不存在）：{a}")

    changed = 0
    for f in targets:
        text = f.read_text(encoding="utf-8")
        new, shifted = fix_text(text)
        if new == text:
            continue
        changed += 1
        print(f"{'[dry]' if dry else '[fix]'} {f}  降级标题 {shifted} 处")
        if not dry:
            f.write_text(new, encoding="utf-8")

    print(f"\n共处理 {len(targets)} 个文件，需要改动 {changed} 个。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
