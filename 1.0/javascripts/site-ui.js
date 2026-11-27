/* 站点页眉工具条：主题切换 / 代码主题切换 / Ctrl+K 搜索弹窗 */
(function () {
  "use strict";

  var LS_THEME = "mdgh.siteTheme";
  var LS_CODE = "mdgh.codeTheme";
  var LS_MD = "mdgh.mdContentTheme";

  // 文档内容主题：与编辑器里的“预览主题”同一套，material = 站点原生
  var MD_THEMES = [
    { id: "material", name: "默认（站点原生）", color: "#3f51b5" },
    { id: "github", name: "github", color: "#0969da" },
    { id: "vuepress", name: "vuepress", color: "#3eaf7c" },
    { id: "mk-cute", name: "mk-cute", color: "#36ace1" },
    { id: "smart-blue", name: "smart-blue", color: "#135ce0" },
    { id: "cyanosis", name: "cyanosis", color: "#3da8f5" }
  ];

  var CODE_THEMES = [
    { id: "material", name: "默认（跟随主题）" },
    { id: "github-dark", name: "github-dark" },
    { id: "one-dark", name: "one-dark" },
    { id: "dracula", name: "dracula" },
    { id: "monokai", name: "monokai" },
    { id: "nord", name: "nord" },
    { id: "solarized-light", name: "solarized-light" },
    { id: "vs", name: "vs" },
    { id: "xcode", name: "xcode" }
  ];

  function siteRoot() {
    var s = document.querySelector('script[src*="site-ui.js"]');
    if (!s) return "/";
    return s.src.replace(/javascripts\/site-ui\.js.*$/, "");
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var ICON = {
    search:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
    moon:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12.3 3.1a9 9 0 1 0 8.6 11.6 7 7 0 0 1-8.6-11.6z"/></svg>',
    sun:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M11 1.5h2v3.2h-2zm0 17.8h2v3.2h-2zM1.5 11h3.2v2H1.5zm17.8 0h3.2v2h-3.2zM4.3 2.9l1.4-1.4 2.3 2.3-1.4 1.4zm11.7 11.7 1.4-1.4 2.3 2.3-1.4 1.4zm0-12.9 1.4 1.4-2.3 2.3-1.4-1.4zM4.3 21.1l-1.4-1.4 2.3-2.3 1.4 1.4z"/></svg>',
    code:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6z"/></svg>',
    filter:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M4 5h16v2H4zm2 6h12v2H6zm3 6h6v2H9z"/></svg>',
    auto:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-4.4 2.26 5.4 5.4 0 0 1-3.1-9.8c-.44-.06-.9-.1-1.4-.1z"/><circle cx="16.5" cy="7.5" r="4.6"/></svg>'
  };

  /* ---------------- 主题切换：跟随系统 / 暗 / 亮 ---------------- */
  var MODE_NEXT = { auto: "slate", slate: "default", default: "auto" };
  var MODE_TEXT = { auto: "跟随系统", slate: "暗黑", default: "明亮" };

  // 三枚图标严格取自 Material 图标库（与参考图 2/3/4 一致）：
  // theme-light-dark（日+月）/ weather-night（月+星）/ white-balance-sunny（太阳）
  var THEME_ICONS = {
    auto:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">' +
      '<path d="M7.5 2c-1.79 1.15-3 3.18-3 5.5s1.21 4.35 3.03 5.5C4.46 13 2 10.54 2 7.5A5.5 5.5 0 0 1 7.5 2m11.57 1.5 1.43 1.43L4.93 20.5 3.5 19.07zm-6.18 2.43L11.41 5 9.97 6l.42-1.7L9 3.24l1.75-.12.58-1.65L12 3.1l1.73.03-1.35 1.13zm-3.3 3.61-1.16-.73-1.12.78.34-1.32-1.09-.83 1.36-.09.45-1.29.51 1.27 1.36.03-1.05.87zM19 13.5a5.5 5.5 0 0 1-5.5 5.5c-1.22 0-2.35-.4-3.26-1.07l7.69-7.69c.67.91 1.07 2.04 1.07 3.26m-4.4 6.58 2.77-1.15-.24 3.35zm4.33-2.7 1.15-2.77 2.2 2.54zm1.15-4.96-1.14-2.78 3.34.24zM9.63 18.93l2.77 1.15-2.53 2.19z"/>' +
      "</svg>",
    dark:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">' +
      '<path d="m17.75 4.09-2.53 1.94.91 3.06-2.63-1.81-2.63 1.81.91-3.06-2.53-1.94L12.44 4l1.06-3 1.06 3zm3.5 6.91-1.64 1.25.59 1.98-1.7-1.17-1.7 1.17.59-1.98L15.75 11l2.06-.05L18.5 9l.69 1.95zm-2.28 4.95c.83-.08 1.72 1.1 1.19 1.85-.32.45-.66.87-1.08 1.27C15.17 23 8.84 23 4.94 19.07c-3.91-3.9-3.91-10.24 0-14.14.4-.4.82-.76 1.27-1.08.75-.53 1.93.36 1.85 1.19-.27 2.86.69 5.83 2.89 8.02a9.96 9.96 0 0 0 8.02 2.89m-1.64 2.02a12.08 12.08 0 0 1-7.8-3.47c-2.17-2.19-3.33-5-3.49-7.82-2.81 3.14-2.7 7.96.31 10.98 3.02 3.01 7.84 3.12 10.98.31"/>' +
      "</svg>",
    light:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">' +
      '<path d="m3.55 19.09 1.41 1.41 1.8-1.79-1.42-1.42M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6c0-3.32-2.69-6-6-6m8 7h3v-2h-3m-2.76 7.71 1.8 1.79 1.41-1.41-1.79-1.8M20.45 5l-1.41-1.4-1.8 1.79 1.42 1.42M13 1h-2v3h2M6.76 5.39 4.96 3.6 3.55 5l1.79 1.81zM1 13h3v-2H1m12 9h-2v3h2"/>' +
      "</svg>"
  };

  function systemScheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "slate"
      : "default";
  }

  function currentMode() {
    return localStorage.getItem(LS_THEME) || "auto";
  }

  function applyMode(mode, remember) {
    var scheme = mode === "auto" ? systemScheme() : mode;
    document.body.setAttribute("data-md-color-scheme", scheme);
    if (remember !== false) localStorage.setItem(LS_THEME, mode);
    paintThemeBtn();
  }

  function paintThemeBtn() {
    var b = document.querySelector(".mui-theme");
    if (!b) return;
    var mode = currentMode();
    var key = mode === "auto" ? "auto" : mode === "slate" ? "dark" : "light";
    b.innerHTML = '<span class="mui-ico">' + THEME_ICONS[key] + "</span>";
    b.title = "主题：" + MODE_TEXT[mode] + "（点击切换）";
    b.setAttribute("aria-label", "主题：" + MODE_TEXT[mode]);
    b.setAttribute("data-mode", mode);
  }

  function toggleTheme() {
    applyMode(MODE_NEXT[currentMode()] || "auto");
  }

  /* ---------------- 文档内容主题（md 预览主题） ---------------- */
  function currentMdTheme() {
    return localStorage.getItem(LS_MD) || "material";
  }

  function applyMdTheme(id, remember) {
    id = id || "material";
    if (id === "material") document.body.removeAttribute("data-md-content-theme");
    else document.body.setAttribute("data-md-content-theme", id);

    var hit = MD_THEMES[0];
    for (var i = 0; i < MD_THEMES.length; i++) {
      if (MD_THEMES[i].id === id) { hit = MD_THEMES[i]; break; }
    }
    var btn = document.querySelector(".mui-md-btn");
    if (btn) {
      btn.title = "文档内容主题：" + hit.name + "（点击切换）";
      btn.setAttribute("aria-label", "文档内容主题：" + hit.name);
      btn.setAttribute("data-theme", id);
      btn.style.setProperty("--mui-dot", hit.color);
    }
    var menu = document.querySelector(".mui-md .mui-menu");
    if (menu) {
      [].forEach.call(menu.querySelectorAll("li"), function (li) {
        li.classList.toggle("sel", li.getAttribute("data-id") === id);
      });
    }
    if (remember) localStorage.setItem(LS_MD, id);
  }

  /* ---------------- 代码主题 ---------------- */
  function codeThemeLink() {
    var l = document.getElementById("mui-code-theme");
    if (!l) {
      l = document.createElement("link");
      l.id = "mui-code-theme";
      l.rel = "stylesheet";
      document.head.appendChild(l);
    }
    return l;
  }

  function applyCodeTheme(id, remember) {
    var link = codeThemeLink();
    if (!id || id === "material") {
      link.removeAttribute("href");
      link.disabled = true;
      document.body.removeAttribute("data-md-code-theme");
    } else {
      link.disabled = false;
      link.href = siteRoot() + "stylesheets/code-themes/" + id + ".css";
      document.body.setAttribute("data-md-code-theme", id);
    }
    var label = document.querySelector(".mui-code .mui-code-label");
    var btn = document.querySelector(".mui-code-btn");
    for (var i = 0; i < CODE_THEMES.length; i++) {
      if (CODE_THEMES[i].id === id) {
        if (btn) btn.title = "代码主题：" + CODE_THEMES[i].name + "（点击切换）";
        break;
      }
    }
    var menu = document.querySelector(".mui-code .mui-menu");
    if (menu) {
      [].forEach.call(menu.querySelectorAll("li"), function (li) {
        li.classList.toggle("sel", li.getAttribute("data-id") === id);
      });
    }
    if (remember) localStorage.setItem(LS_CODE, id);
  }

  /* ---------------- 页眉控件 ---------------- */
  function buildHeaderTools() {
    var inner = document.querySelector(".md-header__inner");
    if (!inner || inner.querySelector(".mui-tools")) return;

    var ghh = inner.querySelector(".ghh");

    var tools = document.createElement("div");
    tools.className = "mui-tools";

    var themeBtn = document.createElement("button");
    themeBtn.type = "button";
    themeBtn.className = "mui-btn mui-theme";
    themeBtn.addEventListener("click", function (e) {
      e.preventDefault();
      toggleTheme();
    });
    tools.appendChild(themeBtn);

    function closeMenus(except) {
      var all = document.querySelectorAll(".mui-menu");
      [].forEach.call(all, function (m) {
        if (m !== except) m.classList.add("hidden");
      });
    }

    function makeDropdown(cls, btnCls, glyphHtml, items, pick) {
      var wrap = document.createElement("div");
      wrap.className = "mui-dd " + cls;
      wrap.innerHTML =
        '<button class="mui-btn ' + btnCls + '" type="button">' + glyphHtml +
        '<span class="mui-dot"></span></button>' +
        '<ul class="mui-menu hidden">' +
        items.map(function (it) {
          var sw = it.color ? '<span class="mui-swatch" style="background:' + it.color + '"></span>' : "";
          return '<li data-id="' + it.id + '">' + sw + esc(it.name) + "</li>";
        }).join("") +
        "</ul>";
      var menu = wrap.querySelector(".mui-menu");
      var btn = wrap.querySelector(".mui-btn");
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var willOpen = menu.classList.contains("hidden");
        closeMenus(menu);
        menu.classList.toggle("hidden", !willOpen);
      });
      menu.addEventListener("click", function (e) {
        e.stopPropagation();
        var li = e.target.closest("li");
        if (!li) return;
        pick(li.getAttribute("data-id"));
        menu.classList.add("hidden");
      });
      document.addEventListener("click", function () {
        menu.classList.add("hidden");
      });
      return wrap;
    }

    // 文档内容主题（Aa）
    tools.appendChild(
      makeDropdown("mui-md", "mui-md-btn", '<span class="mui-gly">Aa</span>', MD_THEMES, function (id) {
        applyMdTheme(id, true);
      })
    );

    // 代码主题（</>）
    tools.appendChild(
      makeDropdown("mui-code", "mui-code-btn", '<span class="mui-gly mono">&lt;/&gt;</span>', CODE_THEMES, function (id) {
        applyCodeTheme(id, true);
      })
    );

    if (ghh && ghh.parentNode === inner) inner.insertBefore(tools, ghh);
    else inner.appendChild(tools);

    paintThemeBtn();

    // 搜索入口：占位在页眉正中间，点击/Ctrl+K 打开弹窗
    var searchBtn = document.createElement("button");
    searchBtn.type = "button";
    searchBtn.className = "mui-search";
    searchBtn.innerHTML =
      '<span class="mui-search-ico">' + ICON.search + '</span><span class="mui-search-text">搜索文档</span>' +
      '<kbd class="mui-kbd">Ctrl+K</kbd>';
    searchBtn.addEventListener("click", openSearch);
    inner.appendChild(searchBtn);
  }

  /* ---------------- 搜索弹窗 ---------------- */
  var idx = null;
  var tagsData = null;
  var activeTag = "";
  var loadingIndex = null;

  function loadIndex() {
    if (loadingIndex) return loadingIndex;
    loadingIndex = fetch(siteRoot() + "search/search_index.json")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var pages = {};
        (d.docs || []).forEach(function (doc) {
          var loc = doc.location || "";
          var base = loc.split("#")[0];
          if (!pages[base]) pages[base] = { url: base, title: doc.title || base, text: "" };
          pages[base].text += " " + (doc.text || "");
        });
        idx = Object.keys(pages).map(function (k) { return pages[k]; });
        return idx;
      })
      .catch(function () { idx = []; return idx; });
    return loadingIndex;
  }

  function loadTags() {
    if (tagsData) return Promise.resolve(tagsData);
    return fetch(siteRoot() + "tags.json")
      .then(function (r) { return r.json(); })
      .then(function (d) { tagsData = d; return d; })
      .catch(function () { tagsData = { tags: [], docs: {} }; return tagsData; });
  }

  function cleanText(s) {
    return String(s || "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s*[=\-\+\*\/\\|<>]{2,}\s*/g, " ")
      .replace(/[\*`#>|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function titleOf(p) {
    var info = tagsData && tagsData.docs && tagsData.docs[p.url];
    if (info && info.title) return info.title;
    return cleanText(p.title).slice(0, 60) || p.url;
  }

  function snippet(text, q) {
    var src = cleanText(text);
    if (!q) return src.slice(0, 100);
    var i = src.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return src.slice(0, 100);
    var start = Math.max(0, i - 30);
    var piece = src.slice(start, start + 120);
    var safe = esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var clean = esc(piece).replace(new RegExp(safe, "gi"), function (m) {
      return "<mark>" + m + "</mark>";
    });
    return (start > 0 ? "…" : "") + clean + "…";
  }

  function renderResults(q) {
    var box = document.querySelector(".mui-results");
    if (!box) return;
    if (!idx) {
      box.innerHTML = '<p class="mui-empty">正在加载索引…</p>';
      return;
    }
    var query = (q || "").trim();
    var pool = idx;

    if (activeTag) {
      var docs = (tagsData && tagsData.docs) || {};
      pool = pool.filter(function (p) {
        var info = docs[p.url] || null;
        return info && info.tags && info.tags.indexOf(activeTag) >= 0;
      });
    }

    if (!query) {
      if (activeTag) {
        box.innerHTML = pool.slice(0, 30).map(function (p) {
          return '<a class="mui-hit" href="' + esc(siteRoot() + p.url) + '"><span class="mui-hit-t">' + esc(titleOf(p)) + '</span><span class="mui-hit-s">' + esc(p.url) + "</span></a>";
        }).join("") || '<p class="mui-empty">这个标签下没有文档</p>';
      } else {
        box.innerHTML =
          '<p class="mui-tip">输入关键词开始搜索；也可以点右侧标签过滤。</p>' +
          '<p class="mui-tip small">快捷键：<kbd>Ctrl</kbd>+<kbd>K</kbd> 打开，<kbd>Esc</kbd> 关闭，<kbd>Enter</kbd> 跳到第一条结果。</p>';
      }
      return;
    }

    var ql = query.toLowerCase();
    var hits = pool.map(function (p) {
      var score = 0;
      var tl = p.title.toLowerCase();
      if (tl.indexOf(ql) >= 0) score += 6;
      var n = p.text.toLowerCase().split(ql).length - 1;
      score += Math.min(n, 6);
      return { p: p, score: score, n: n };
    }).filter(function (h) { return h.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 20);

    if (!hits.length) {
      box.innerHTML = '<p class="mui-empty">没有找到「' + esc(query) + '」相关内容</p>';
      return;
    }

    box.innerHTML = hits.map(function (h) {
      return '<a class="mui-hit" href="' + esc(siteRoot() + h.p.url) + '">' +
        '<span class="mui-hit-t">' + esc(titleOf(h.p)) + "</span>" +
        '<span class="mui-hit-s">' + snippet(h.p.text, query) + "</span>" +
        "</a>";
    }).join("");
  }

  function renderTags() {
    var ul = document.querySelector(".mui-taglist");
    if (!ul) return;
    var list = (tagsData && tagsData.tags) || [];
    var all = '<li class="mui-tag' + (activeTag ? "" : " on") + '" data-tag="">全部文档</li>';
    ul.innerHTML = all + list.map(function (t) {
      return '<li class="mui-tag' + (t.name === activeTag ? " on" : "") + '" data-tag="' + esc(t.name) + '">' +
        '<span>' + esc(t.name) + "</span><b>" + t.count + "</b></li>";
    }).join("");
    ul.onclick = function (e) {
      var li = e.target.closest(".mui-tag");
      if (!li) return;
      activeTag = li.getAttribute("data-tag") || "";
      renderTags();
      renderResults(document.querySelector(".mui-input").value);
    };
  }

  var modal = null;

  function openSearch() {
    if (!modal) buildModal();
    modal.classList.remove("hidden");
    document.body.classList.add("mui-lock");
    var input = modal.querySelector(".mui-input");
    input.value = "";
    input.focus();
    loadIndex().then(function () { renderResults(""); });
    loadTags().then(renderTags);
  }

  function closeSearch() {
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.classList.remove("mui-lock");
  }

  function buildModal() {
    modal = document.createElement("div");
    modal.className = "mui-mask";
    modal.innerHTML =
      '<div class="mui-card" role="dialog" aria-modal="true" aria-label="搜索">' +
      '<div class="mui-left">' +
      '<div class="mui-inputrow">' +
      '<span class="mui-search-ico">' + ICON.search + "</span>" +
      '<input class="mui-input" type="search" placeholder="搜索文档…" autocomplete="off">' +
      '<button class="mui-filterbtn" type="button" title="显示/隐藏标签筛选">' + ICON.filter + "</button>" +
      "</div>" +
      '<div class="mui-results"><p class="mui-tip">正在加载…</p></div>' +
      "</div>" +
      '<aside class="mui-filters">' +
      '<div class="mui-filters-title">筛选</div>' +
      '<div class="mui-filters-body"><p class="mui-label">标签</p><ul class="mui-taglist"></ul></div>' +
      "</aside>" +
      "</div>";
    document.body.appendChild(modal);

    var input = modal.querySelector(".mui-input");
    var timer = null;
    input.addEventListener("input", function () {
      clearTimeout(timer);
      var v = input.value;
      timer = setTimeout(function () { renderResults(v); }, 160);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        var first = modal.querySelector(".mui-hit");
        if (first) location.href = first.getAttribute("href");
      }
    });
    modal.querySelector(".mui-filterbtn").addEventListener("click", function () {
      modal.querySelector(".mui-card").classList.toggle("no-filter");
    });
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeSearch();
    });
  }

  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      if (modal && !modal.classList.contains("hidden")) closeSearch();
      else openSearch();
    } else if (e.key === "Escape") {
      closeSearch();
    }
  });

  /* ---------------- 启动 ---------------- */
  function dropNativeSearch() {
    // 原生搜索按钮与我们的胶囊重复，直接移除（否则页眉会出现两个放大镜）
    var nodes = document.querySelectorAll(
      '.md-header__button[for="__search"], label[for="__search"].md-header__button'
    );
    [].forEach.call(nodes, function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function boot() {
    buildHeaderTools();
    dropNativeSearch();
    applyMode(currentMode(), false);
    applyMdTheme(currentMdTheme(), false);
    var savedCode = localStorage.getItem(LS_CODE) || "material";
    applyCodeTheme(savedCode, false);
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () {
        if (currentMode() === "auto") applyMode("auto", false);
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
    // 系统主题变化的兜底：回到前台 / 窗口聚焦时再核对一次
    var resync = function () {
      if (currentMode() === "auto") applyMode("auto", false);
    };
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) resync();
    });
    window.addEventListener("focus", resync);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  window.addEventListener("load", function () {
    setTimeout(function () {
      buildHeaderTools();
      dropNativeSearch();
      applyMode(currentMode(), false);
      applyMdTheme(currentMdTheme(), false);
    }, 200);
  });
})();
