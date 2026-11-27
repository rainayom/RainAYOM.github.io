/* 站点页眉工具条：主题切换 / 代码主题切换 / Ctrl+K 搜索弹窗 */
(function () {
  "use strict";

  var LS_THEME = "mdgh.siteTheme";
  var LS_CODE = "mdgh.codeTheme";

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

  /* ---------------- 主题切换 ---------------- */
  function scheme() {
    return document.body.getAttribute("data-md-color-scheme") || "default";
  }

  function setScheme(target) {
    var inputs = document.querySelectorAll('[data-md-component="palette"] input[type="radio"]');
    var hit = null;
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].value === target) hit = inputs[i];
    }
    if (hit) {
      hit.checked = true;
      hit.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      document.body.setAttribute("data-md-color-scheme", target);
    }
    localStorage.setItem(LS_THEME, target);
    paintThemeBtn();
  }

  function paintThemeBtn() {
    var b = document.querySelector(".mui-theme");
    if (!b) return;
    var dark = scheme() === "slate";
    b.innerHTML =
      '<span class="mui-ico">' + (dark ? "☾" : "☀") + '</span><span class="mui-theme-label">' + (dark ? "夜间" : "日间") + "</span>";
    b.title = dark ? "当前暗黑，点击切回明亮" : "当前明亮，点击切到暗黑";
  }

  function toggleTheme() {
    setScheme(scheme() === "slate" ? "default" : "slate");
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
    } else {
      link.disabled = false;
      link.href = siteRoot() + "stylesheets/code-themes/" + id + ".css";
    }
    var label = document.querySelector(".mui-code .mui-code-label");
    for (var i = 0; i < CODE_THEMES.length; i++) {
      if (CODE_THEMES[i].id === id) {
        if (label) label.textContent = CODE_THEMES[i].name;
        break;
      }
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

    var codeWrap = document.createElement("div");
    codeWrap.className = "mui-code";
    codeWrap.innerHTML =
      '<button class="mui-btn mui-code-btn" type="button">代码主题：<span class="mui-code-label">默认</span> ▾</button>' +
      '<ul class="mui-menu hidden">' +
      CODE_THEMES.map(function (c) {
        return '<li data-id="' + c.id + '">' + esc(c.name) + "</li>";
      }).join("") +
      "</ul>";
    var menu = codeWrap.querySelector(".mui-menu");
    codeWrap.querySelector(".mui-code-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });
    menu.addEventListener("click", function (e) {
      var li = e.target.closest("li");
      if (!li) return;
      applyCodeTheme(li.getAttribute("data-id"), true);
      menu.classList.add("hidden");
    });
    document.addEventListener("click", function (e) {
      if (!codeWrap.contains(e.target)) menu.classList.add("hidden");
    });
    tools.appendChild(codeWrap);

    if (ghh && ghh.parentNode === inner) inner.insertBefore(tools, ghh);
    else inner.appendChild(tools);

    paintThemeBtn();

    // 搜索入口：占位在页眉正中间，点击/Ctrl+K 打开弹窗
    var searchBtn = document.createElement("button");
    searchBtn.type = "button";
    searchBtn.className = "mui-search";
    searchBtn.innerHTML =
      '<span class="mui-search-ico">⌕</span><span class="mui-search-text">搜索文档</span>' +
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
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
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
      '<span class="mui-search-ico">⌕</span>' +
      '<input class="mui-input" type="search" placeholder="搜索文档…" autocomplete="off">' +
      '<button class="mui-filterbtn" type="button" title="筛选">⚙</button>' +
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
  function boot() {
    buildHeaderTools();
    var savedTheme = localStorage.getItem(LS_THEME);
    if (savedTheme) setScheme(savedTheme);
    var savedCode = localStorage.getItem(LS_CODE) || "material";
    applyCodeTheme(savedCode, false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  window.addEventListener("load", function () {
    setTimeout(buildHeaderTools, 200);
  });
})();
