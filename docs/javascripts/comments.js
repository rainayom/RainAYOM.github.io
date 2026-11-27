/* 站点评论区：复用页眉的 GitHub 登录，评论存到仓库的 GitHub Discussions */
(function () {
  "use strict";

  var OWNER = "rainayom";
  var REPO = "RainAYOM.github.io";
  var REPO_ID = "R_kgDOV9nhcA";
  var CATEGORY_ID = "DIC_kwDOV9nhcM4DMFBc";
  var CODE_HREF = "https://github.com/login/device";

  var root = document.getElementById("mdgh-comments");
  if (!root || root.dataset.inited) return;
  root.dataset.inited = "1";

  var pageKey = (root.dataset.page || location.pathname).replace(/^\/+|\/+$/g, "") || "index";
  var threadTitle = "评论：" + pageKey;

  var state = { token: "", user: null, thread: null, comments: [], busy: false };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mdLite(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code class="mdc-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");
  }

  function when(iso) {
    var d = new Date(iso);
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "刚刚";
    if (diff < 3600) return Math.floor(diff / 60) + " 分钟前";
    if (diff < 86400) return Math.floor(diff / 3600) + " 小时前";
    if (diff < 2592000) return Math.floor(diff / 86400) + " 天前";
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  async function gql(query, variables) {
    var r = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + state.token },
      body: JSON.stringify({ query: query, variables: variables || {} }),
    });
    var d = await r.json().catch(function () { return {}; });
    if (d && d.errors && d.errors.length) throw new Error(d.errors[0].message || "GitHub 接口报错");
    if (!r.ok) throw new Error("GitHub " + r.status);
    return d.data;
  }

  function build() {
    root.innerHTML =
      '<div class="mdc-head">' +
      '<span class="mdc-count">评论加载中…</span>' +
      '<a class="mdc-thread hidden" target="_blank" rel="noopener">在 GitHub 查看 ↗</a>' +
      "</div>" +
      '<div class="mdc-list"></div>' +
      '<div class="mdc-box">' +
      '<p class="mdc-hint">用页眉的 GitHub 登录后即可发言，登录一次页眉和评论同时生效。</p>' +
      '<textarea class="mdc-input" rows="3" placeholder="说点什么…（支持 Markdown，Enter 换行）"></textarea>' +
      '<div class="mdc-row">' +
      '<button class="mdc-send" type="button" disabled>发表评论</button>' +
      '<button class="mdc-login" type="button">用 GitHub 登录</button>' +
      '<span class="mdc-status"></span>' +
      "</div>" +
      "</div>";

    root.querySelector(".mdc-login").addEventListener("click", function () {
      if (window.MDGitHub && window.MDGitHub.login) {
        localStorage.setItem("mdgh.returnTo", location.href);
        localStorage.setItem("mdgh.returnScroll", String(window.scrollY || 0));
        window.MDGitHub.login();
      } else {
        location.href = CODE_HREF;
      }
    });

    root.querySelector(".mdc-send").addEventListener("click", function () {
      var ta = root.querySelector(".mdc-input");
      post(ta.value);
    });
  }

  function renderAuth() {
    var send = root.querySelector(".mdc-send");
    var login = root.querySelector(".mdc-login");
    var input = root.querySelector(".mdc-input");
    var hint = root.querySelector(".mdc-hint");
    if (!send) return;
    if (state.token && state.user) {
      login.classList.add("hidden");
      send.classList.remove("hidden");
      send.disabled = state.busy;
      input.classList.remove("hidden");
      input.placeholder = "以 " + state.user.login + " 的身份说点什么…";
      hint.textContent = "已登录 " + state.user.login + "，评论会以这个 GitHub 身份公开。";
      hint.classList.remove("hidden");
    } else {
      login.classList.remove("hidden");
      send.classList.add("hidden");
      input.classList.add("hidden");
      hint.textContent = "登录一次 GitHub，页眉与评论同时生效；登录后会回到这个页面。";
      hint.classList.remove("hidden");
    }
  }

  function renderList() {
    var list = root.querySelector(".mdc-list");
    var count = root.querySelector(".mdc-count");
    var link = root.querySelector(".mdc-thread");
    if (!list) return;

    count.textContent = state.comments.length + " 条评论";
    if (state.thread && state.thread.url) {
      link.href = state.thread.url;
      link.classList.remove("hidden");
    } else {
      link.classList.add("hidden");
    }

    if (!state.comments.length) {
      list.innerHTML = '<p class="mdc-empty">还没有评论，' + (state.token ? "来发第一条。" : "登录后发第一条。") + "</p>";
      return;
    }

    list.innerHTML = state.comments
      .map(function (c) {
        var login = (c.author && c.author.login) || "ghost";
        var avatar = (c.author && c.author.avatarUrl) || "";
        var head =
          '<div class="mdc-item-head">' +
          (avatar ? '<img class="mdc-av" src="' + esc(avatar) + '" alt="" loading="lazy">' : '<span class="mdc-av mdc-av-fallback">' + esc(login.slice(0, 2).toUpperCase()) + "</span>") +
          '<a class="mdc-user" href="https://github.com/' + esc(login) + '" target="_blank" rel="noopener">' + esc(login) + "</a>" +
          '<span class="mdc-time">' + when(c.createdAt) + "</span>" +
          "</div>";
        return '<div class="mdc-item">' + head + '<div class="mdc-body">' + mdLite(c.body) + "</div></div>";
      })
      .join("");
  }

  function status(msg, isErr) {
    var el = root.querySelector(".mdc-status");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("err", !!isErr);
  }

  async function findThread() {
    var data = await gql(
      "query($o:String!,$n:String!,$c:ID!){ repository(owner:$o,name:$n){ discussions(first:100, categoryId:$c){ nodes { id title url } } } }",
      { o: OWNER, n: REPO, c: CATEGORY_ID }
    );
    var nodes = (data.repository.discussions && data.repository.discussions.nodes) || [];
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].title === threadTitle) return nodes[i];
    }
    return null;
  }

  async function loadComments(thread) {
    var data = await gql(
      "query($id:ID!){ node(id:$id){ ... on Discussion { id url comments(first:100){ nodes { author { login avatarUrl } body createdAt } } } } }",
      { id: thread.id }
    );
    var node = data.node || {};
    thread.url = node.url || thread.url;
    state.comments = (node.comments && node.comments.nodes) || [];
  }

  async function load() {
    if (!state.token) {
      renderAuth();
      renderList();
      return;
    }
    status("加载中…");
    try {
      state.thread = await findThread();
      if (state.thread) await loadComments(state.thread);
      else state.comments = [];
      status("");
    } catch (e) {
      status("评论加载失败：" + e.message, true);
    }
    renderAuth();
    renderList();
  }

  async function createThread() {
    var data = await gql(
      "mutation($rid:ID!,$cid:ID!,$title:String!,$body:String!){ createDiscussion(input:{repositoryId:$rid, categoryId:$cid, title:$title, body:$body}){ discussion { id url } } }",
      {
        rid: REPO_ID,
        cid: CATEGORY_ID,
        title: threadTitle,
        body: "页面评论串：`" + pageKey + "`\n\n本讨论由站点评论区自动创建，对应页面 " + location.origin + "/" + pageKey,
      }
    );
    return data.createDiscussion.discussion;
  }

  async function post(body) {
    if (state.busy) return;
    var text = (body || "").trim();
    if (!text) return status("写点什么再发吧", true);
    if (!state.token || !state.user) return renderAuth();
    state.busy = true;
    renderAuth();
    status("提交中…");
    try {
      if (!state.thread) state.thread = await createThread();
      await gql(
        "mutation($id:ID!,$body:String!){ addDiscussionComment(input:{discussionId:$id, body:$body}){ comment { id } } }",
        { id: state.thread.id, body: text }
      );
      root.querySelector(".mdc-input").value = "";
      await loadComments(state.thread);
      state.busy = false;
      renderAuth();
      renderList();
      status("已发表");
      setTimeout(function () { status(""); }, 2500);
    } catch (e) {
      state.busy = false;
      renderAuth();
      status("提交失败：" + e.message, true);
    }
  }

  function restore() {
    var back = localStorage.getItem("mdgh.returnTo");
    if (!back || back !== location.href) return;
    var y = parseInt(localStorage.getItem("mdgh.returnScroll") || "0", 10);
    localStorage.removeItem("mdgh.returnTo");
    localStorage.removeItem("mdgh.returnScroll");
    if (y > 0) window.scrollTo(0, y);
    var ta = root.querySelector(".mdc-input");
    if (ta) ta.focus();
  }

  build();
  renderAuth();

  function apply(token, user) {
    var wasAnon = !state.token;
    state.token = token || "";
    state.user = user || null;
    renderAuth();
    if (state.token && wasAnon) {
      load().then(restore);
    } else if (!state.token) {
      state.thread = null;
      state.comments = [];
      renderList();
    }
  }

  function syncFromHub() {
    if (!window.MDGitHub) return;
    apply(window.MDGitHub.token || localStorage.getItem("mdgh.token") || "", window.MDGitHub.user || null);
  }

  if (window.MDGitHub && window.MDGitHub.onChange) {
    window.MDGitHub.onChange(function (s) {
      apply(s && s.token, s && s.user);
    });
    // 页眉脚本初始化晚于本脚本时，补两次同步；回到页面时再同步一次
    setTimeout(syncFromHub, 900);
    setTimeout(syncFromHub, 2600);
    window.addEventListener("focus", syncFromHub);
  } else {
    apply(localStorage.getItem("mdgh.token") || "", null);
    load();
  }
})();
