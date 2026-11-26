"""首页与章节首页自动生成文档索引。

- 根 `index.md` 中写 `<!-- DOC-LIST -->`：列出 docs 下全部 md，按目录分组；
- 任意目录的 `index.md` 中写 `<!-- SECTION-LIST -->`：只列本目录（含子目录）的 md。

两个标记都保留原文件内容，只做替换，因此重复构建结果一致。
"""
import re
from pathlib import Path

MARKER_ALL = "<!-- DOC-LIST -->"
MARKER_SECTION = "<!-- SECTION-LIST -->"


def _title_from(path: Path, fallback: str) -> str:
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return fallback
    m = re.search(r"^#\s+(.+?)\s*$", text, re.MULTILINE)
    return m.group(1).strip() if m else fallback


def _normalize(src_path: str) -> str:
    return src_path.replace("\\", "/")


def _doc_table(rows, docs_dir: Path):
    lines = ["| 文档 | 文件 |", "| --- | --- |"]
    for title, src in rows:
        lines.append("| [%s](%s) | `%s` |" % (title, src, src))
    return lines


def on_page_markdown(markdown, page, config, files):
    src = _normalize(page.file.src_path)
    if not src.endswith("index.md"):
        return markdown

    docs_dir = Path(config["docs_dir"])
    section_dir = str(Path(src).parent)
    if section_dir == ".":
        section_dir = ""

    if MARKER_ALL in markdown:
        groups = {}
        count = 0
        for f in files:
            fs = _normalize(f.src_path)
            if not fs.endswith(".md") or fs == "index.md":
                continue
            parent = str(Path(fs).parent)
            label = "根目录" if parent == "." else parent
            groups.setdefault(label, []).append(
                (_title_from(docs_dir / fs, Path(fs).stem), fs)
            )
            count += 1

        lines = ["共 **%d** 篇文档。" % count, ""]
        for label in sorted(groups):
            lines += ["### %s" % label, ""]
            lines += _doc_table(sorted(groups[label], key=lambda x: x[1]), docs_dir)
            lines.append("")
        return markdown.replace(MARKER_ALL, "\n".join(lines))

    if MARKER_SECTION in markdown:
        rows = []
        for f in files:
            fs = _normalize(f.src_path)
            if not fs.endswith(".md") or fs == src:
                continue
            if section_dir:
                if not fs.startswith(section_dir + "/"):
                    continue
                rel = fs[len(section_dir) + 1:]
            else:
                rel = fs
            rows.append((_title_from(docs_dir / fs, Path(fs).stem), rel))
        if not rows:
            return markdown.replace(MARKER_SECTION, "*本目录暂无文档。*")
        lines = ["共 **%d** 篇文档。" % len(rows), ""]
        lines += _doc_table(sorted(rows, key=lambda x: x[1]), docs_dir)
        lines.append("")
        return markdown.replace(MARKER_SECTION, "\n".join(lines))

    return markdown
