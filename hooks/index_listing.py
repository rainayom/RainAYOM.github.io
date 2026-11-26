"""首页自动生成 docs 目录下全部 md 文件索引。"""
import re
from pathlib import Path

MARKER = "<!-- DOC-LIST -->"


def _title_from(path: Path, fallback: str) -> str:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return fallback
    m = re.search(r"^#\s+(.+?)\s*$", text, re.MULTILINE)
    return m.group(1).strip() if m else fallback


def on_page_markdown(markdown, page, config, files):
    if page.file.src_path.replace("\\\\", "/") != "index.md":
        return markdown
    if MARKER not in markdown:
        return markdown

    docs_dir = Path(config["docs_dir"])
    groups = {}
    count = 0
    for f in files:
        src = f.src_path.replace("\\\\", "/")
        if not src.endswith(".md") or src == "index.md":
            continue
        parent = str(Path(src).parent)
        label = "根目录" if parent == "." else parent
        groups.setdefault(label, []).append((_title_from(docs_dir / src, Path(src).stem), src))
        count += 1

    lines = ["共 **%d** 篇文档。" % count, ""]
    for label in sorted(groups):
        lines += ["### %s" % label, "", "| 文档 | 文件 |", "| --- | --- |"]
        for title, src in sorted(groups[label], key=lambda x: x[1]):
            lines.append("| [%s](%s) | `%s` |" % (title, src, src))
        lines.append("")
    return markdown.replace(MARKER, "\n".join(lines))
