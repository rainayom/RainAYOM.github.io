"""给 codehilite 生成的代码块补一个 data-lang 属性。

MkDocs 的 codehilite 扩展不会把围栏语言写进产物，站点代码块头部需要它显示语言标签。
做法：按顺序统计源文件里的围栏（``` 或 ~~~）语言，若数量与页面里 codehilite 块数量一致，
就逐个注入 data-lang；数量对不上（例如页面混用了缩进式代码块）时整体跳过，宁缺勿错。
"""

import re

FENCE = re.compile(r"(?m)^ {0,3}(`{3,}|~{3,})([^\n]*)$")
SAFE = re.compile(r"[A-Za-z0-9+#._-]+")


def _lang_of(meta):
    meta = (meta or "").strip()
    if not meta:
        return ""
    first = meta.split()[0].strip("{}")
    first = first.split(",")[0].strip()
    m = SAFE.match(first)
    return m.group(0) if m else ""


def _fence_langs(text):
    langs = []
    opened = False
    for m in FENCE.finditer(text):
        if opened:
            opened = False
            continue
        opened = True
        langs.append(_lang_of(m.group(2)))
    return langs


def on_page_content(html, page, config, files):
    src = getattr(getattr(page, "file", None), "abs_src_path", None)
    if not src:
        return html
    try:
        with open(src, encoding="utf-8") as f:
            text = f.read()
    except OSError:
        return html

    langs = _fence_langs(text)
    marker = '<div class="codehilite">'
    if not langs or html.count(marker) != len(langs):
        return html

    for lang in langs:
        tag = '<div class="codehilite" data-lang="%s">' % lang if lang else marker
        html = html.replace(marker, tag, 1)
    return html
