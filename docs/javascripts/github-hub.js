/* GitHub 登录 + 页眉个人中心（收藏 / 我的提交审核状态）
 * 纯前端实现：OAuth Device Flow（client_id 是公开信息，无需后端），
 * token 存 localStorage，所有 GitHub API 调用走 api.github.com（支持 CORS）。
 */
(function () {
  "use strict";

  window.__ghhRuns = (window.__ghhRuns || 0) + 1;

  const CLIENT_ID = "Ov23liZFcmfLX6wLHrmi";
  const OWNER = "rainayom";
  const REPO = "RainAYOM.github.io";
  const LS_TOKEN = "mdgh.token";
  const LS_USER = "mdgh.user";
  const favKey = (login) => "mdgh.fav." + login;

  const state = { token: "", user: null, busy: false };
  const listeners = [];

  function emit() {
    listeners.forEach((fn) => {
      try {
        fn({ token: state.token, user: state.user });
      } catch (e) {
        console.warn(e);
      }
    });
  }

  function load() {
    state.token = localStorage.getItem(LS_TOKEN) || "";
    try {
      state.user = JSON.parse(localStorage.getItem(LS_USER) || "null");
    } catch (e) {
      state.user = null;
    }
  }

  function save(token, user) {
    state.token = token || "";
    state.user = user || null;
    if (state.token) localStorage.setItem(LS_TOKEN, state.token);
    else localStorage.removeItem(LS_TOKEN);
    if (user) localStorage.setItem(LS_USER, JSON.stringify(user));
    else localStorage.removeItem(LS_USER);
    emit();
  }

  async function api(path, opts) {
    const r = await fetch("https://api.github.com" + path, {
      ...opts,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + state.token,
        ...(opts && opts.headers),
      },
    });
    if (r.status === 401) throw new Error("token 失效，请重新登录");
    if (r.status === 403) throw new Error("GitHub 访问受限（可能是限流），稍后再试");
    if (!r.ok) throw new Error("GitHub API " + r.status);
    return r.json();
  }

  async function fetchUser() {
    const u = await api("/user");
    let owner = u.login.toLowerCase() === OWNER.toLowerCase();
    if (!owner) {
      try {
        const repo = await api("/repos/" + OWNER + "/" + REPO);
        owner = !!(repo.permissions && repo.permissions.push);
      } catch (e) {
        owner = false;
      }
    }
    return {
      login: u.login,
      name: u.name || u.login,
      avatar: u.avatar_url,
      profile: u.html_url,
      owner: owner,
    };
  }

  /* 剪贴板：安全上下文优先用 clipboard API，HTTP 内网地址回退 execCommand */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      /* 继续走兜底 */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.left = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch (e) {
      return false;
    }
  }

  /* ---------------- 设备码登录 ---------------- */
  async function deviceLogin(ui) {
    if (state.busy) return;
    state.busy = true;
    try {
      const r = await fetch("https://github.com/login/device/code", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: "client_id=" + CLIENT_ID + "&scope=" + encodeURIComponent("public_repo read:user"),
      });
      const d = await r.json();
      if (!d.device_code) throw new Error(d.error_description || "无法获取设备码");
      ui.showCode(d.user_code, d.verification_uri);
      const interval = (d.interval || 5) * 1000;
      const deadline = Date.now() + (d.expires_in || 900) * 1000;
      let wait = interval;
      while (Date.now() < deadline) {
        await new Promise((res) => setTimeout(res, wait));
        if (ui.cancelled()) return;
        let pd;
        try {
          const pr = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
            body:
              "client_id=" + CLIENT_ID +
              "&device_code=" + d.device_code +
              "&grant_type=urn:ietf:params:oauth:grant-type:device_code",
          });
          pd = await pr.json();
        } catch (e) {
          // 网络抖动/CORS 偶发失败：继续轮询，不当作授权失败
          continue;
        }
        if (pd.access_token) {
          const user = await (async () => {
            const old = state.token;
            state.token = pd.access_token;
            try {
              return await fetchUser();
            } finally {
              if (!state.token && old) state.token = old;
            }
          })();
          save(pd.access_token, user);
          ui.done(user);
          return;
        }
        if (pd.error === "authorization_pending") continue;
        if (pd.error === "slow_down") {
          wait += 5000;
          continue;
        }
        throw new Error(pd.error_description || pd.error || "授权失败");
      }
      throw new Error("设备码已过期，请重新登录");
    } catch (e) {
      ui.fail(e.message || String(e));
    } finally {
      state.busy = false;
    }
  }

  /* ---------------- 登录弹窗 ---------------- */
    function loginModal() {
    let cancelled = false;
    const mask = document.createElement("div");
    mask.className = "ghm-mask";
    mask.innerHTML =
      '<div class="ghm">' +
      '<div class="ghm-title">用 GitHub 登录</div>' +
      '<div class="ghm-body">' +
      '<p class="ghm-step">正在向 GitHub 申请设备码…</p>' +
      '<div class="ghm-code hidden"><span class="ghm-code-text">----</span>' +
      '<button class="ghm-copy" type="button">复制</button></div>' +
      '<p class="ghm-hint hidden">在打开的页面输入上面的代码并点击 Authorize 后，此窗口会自动完成登录。</p>' +
      '<p class="ghm-err hidden"></p>' +
      "</div>" +
      '<div class="ghm-actions"><a class="ghm-open hidden" target="_blank" rel="noopener" href="https://github.com/login/device">打开授权页 ↗</a>' +
      '<button class="ghm-close" type="button">关闭</button></div>' +
      "</div>";
    document.body.appendChild(mask);
    const $ = (s) => mask.querySelector(s);
    const close = () => {
      cancelled = true;
      mask.remove();
    };
    $(".ghm-close").addEventListener("click", close);
    mask.addEventListener("click", (e) => {
      if (e.target === mask) close();
    });

    const ui = {
      showCode(code, url) {
        $(".ghm-step").classList.add("hidden");
        $(".ghm-code").classList.remove("hidden");
        $(".ghm-hint").classList.remove("hidden");
        $(".ghm-code-text").textContent = code;
        const a = $(".ghm-open");
        a.href = url || "https://github.com/login/device";
        a.classList.remove("hidden");
        $(".ghm-copy").onclick = async () => {
          const btn = $(".ghm-copy");
          const ok = await copyText(code);
          if (ok) {
            btn.textContent = "已复制";
            setTimeout(() => (btn.textContent = "复制"), 1500);
          } else {
            // 兜底：把代码整段选中，让用户直接 Ctrl+C
            const el = $(".ghm-code-text");
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(el);
            sel.removeAllRanges();
            sel.addRange(range);
            btn.textContent = "已选中，Ctrl+C";
            setTimeout(() => (btn.textContent = "复制"), 3000);
          }
        };
        $(".ghm-code-text").onclick = () => {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents($(".ghm-code-text"));
          sel.removeAllRanges();
          sel.addRange(range);
        };
      },
      done() {
        setTimeout(close, 600);
      },
      fail(msg) {
        $(".ghm-err").classList.remove("hidden");
        $(".ghm-err").textContent = "登录失败：" + msg;
      },
      cancelled() {
        return cancelled;
      },
    };
    deviceLogin(ui);
  }

  /* ---------------- 头部件 ---------------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function favs() {
    const login = state.user && state.user.login;
    if (!login) return [];
    try {
      return JSON.parse(localStorage.getItem(favKey(login)) || "[]");
    } catch (e) {
      return [];
    }
    }

  function setFavs(list) {
    const login = state.user && state.user.login;
    if (!login) return;
    localStorage.setItem(favKey(login), JSON.stringify(list.slice(0, 200)));
  }

  function pagePath() {
    let p = decodeURI(location.pathname).replace(/^\/(latest|stable|v?[0-9.]+)/, "");
    if (p === "" || p === "/") p = "/";
    return p || "/";
  }

  function pageTitle() {
    const h = document.querySelector("h1");
    if (h) {
      const c = h.cloneNode(true);
      c.querySelectorAll(".headerlink, .md-content__button, svg").forEach((x) => x.remove());
      const t = c.textContent.replace(/[¶#]/g, "").trim();
      if (t) return t;
    }
    return document.title.split(" - ")[0] || pagePath();
  }

  function statusOf(pr) {
    if (pr.state === "open") return { cls: "wait", text: "提交审核中" };
    if (pr.pull_request && pr.pull_request.merged_at) return { cls: "ok", text: "审核通过" };
    if (pr.state === "closed") return { cls: "no", text: "已关闭未合并" };
    return { cls: "wait", text: pr.state };
  }

  function build() {
    const inner = document.querySelector(".md-header__inner");
    if (!inner) return null;

    const box = document.createElement("div");
    box.className = "ghh";
    box.innerHTML =
      '<button class="ghh-btn" type="button">' +
      '<span class="ghh-avatar">GH</span><span class="ghh-login">GitHub 登录</span>' +
      "</button>" +
      '<div class="ghh-panel hidden">' +
      '<div class="ghh-id"><img class="ghh-img" alt="" src="">' +
      '<div class="ghh-meta"><b class="ghh-name"></b><span class="ghh-role"></span></div>' +
      '<button class="ghh-out" type="button">退出</button></div>' +
      '<div class="ghh-acts"><button class="ghh-fav" type="button">☆ 收藏本页</button>' +
      '<a class="ghh-prof" target="_blank" rel="noopener">GitHub 主页 ↗</a></div>' +
      '<div class="ghh-sec"><div class="ghh-sec-h">我的收藏<span class="ghh-favn"></span></div>' +
      '<ul class="ghh-favlist"></ul></div>' +
      '<div class="ghh-sec"><div class="ghh-sec-h">我的提交<span class="ghh-prn"></span></div>' +
      '<ul class="ghh-prlist"></ul></div>' +
      "</div>";
    inner.appendChild(box);

    const btn = box.querySelector(".ghh-btn");
    const panel = box.querySelector(".ghh-panel");

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!state.token) return loginModal();
      panel.classList.toggle("hidden");
      if (!panel.classList.contains("hidden")) renderPanel();
    });
    document.addEventListener("click", (e) => {
      if (!box.contains(e.target)) panel.classList.add("hidden");
    });
    box.querySelector(".ghh-out").addEventListener("click", () => {
      save("", null);
      panel.classList.add("hidden");
    });
    box.querySelector(".ghh-fav").addEventListener("click", toggleFav);
    return box;
  }

  function toggleFav() {
    const p = pagePath();
    const list = favs();
    const idx = list.findIndex((x) => x.path === p);
    if (idx >= 0) list.splice(idx, 1);
    else list.unshift({ path: p, title: pageTitle(), ts: Date.now() });
    setFavs(list);
    renderPanel();
  }

  async function renderPrs(ulEl) {
    const login = state.user && state.user.login;
    if (!login) return;
    ulEl.innerHTML = '<li class="ghh-empty">加载中…</li>';
    try {
      const q = encodeURIComponent(`repo:${OWNER}/${REPO} is:pr author:${login}`);
      const d = await api("/search/issues?q=" + q + "&per_page=15&sort=updated");
      if (!d.items || !d.items.length) {
        ulEl.innerHTML = '<li class="ghh-empty">还没有提交记录。在编辑器里选「提交审核」后，这里会显示进度。</li>';
        return;
      }
      ulEl.innerHTML = d.items
        .map(function (pr) {
          const st = statusOf(pr);
          return (
            '<li><a href="' + esc(pr.html_url) + '" target="_blank" rel="noopener">' + esc(pr.title) + "</a>" +
            '<span class="ghh-tag ' + st.cls + '">' + st.text + "</span>" +
            '<time>' + new Date(pr.created_at).toLocaleString("zh-CN") + "</time></li>"
          );
        })
        .join("");
    } catch (e) {
      ulEl.innerHTML = '<li class="ghh-empty">读取失败：' + esc(e.message) + "</li>";
    }
  }

  function renderPanel() {
    const box = document.querySelector(".ghh");
    if (!box) return;
    const panel = box.querySelector(".ghh-panel");
    const btn = box.querySelector(".ghh-btn");
    const user = state.user;

    if (!user) {
      btn.querySelector(".ghh-avatar").textContent = "GH";
      btn.querySelector(".ghh-avatar").style.backgroundImage = "";
      btn.querySelector(".ghh-login").textContent = "GitHub 登录";
      box.classList.remove("on");
      return;
    }
    box.classList.add("on");
    btn.querySelector(".ghh-login").textContent = user.login;
    const av = btn.querySelector(".ghh-avatar");
    av.style.backgroundImage = user.avatar ? "url(" + user.avatar + ")" : "";
    av.textContent = user.avatar ? "" : user.login.slice(0, 2).toUpperCase();

    panel.querySelector(".ghh-img").src = user.avatar || "";
    panel.querySelector(".ghh-name").textContent = user.name || user.login;
    panel.querySelector(".ghh-role").textContent = user.owner ? "仓库拥有者 · 可直接提交" : "贡献者 · 提交需审核";
    panel.querySelector(".ghh-role").className = "ghh-role " + (user.owner ? "ok" : "wait");
    panel.querySelector(".ghh-prof").href = user.profile || "https://github.com/" + user.login;

    const list = favs();
    const inFav = list.some((x) => x.path === pagePath());
    const favBtn = panel.querySelector(".ghh-fav");
    favBtn.textContent = inFav ? "★ 已收藏（点击取消）" : "☆ 收藏本页";
    favBtn.classList.toggle("on", inFav);

    const favUl = panel.querySelector(".ghh-favlist");
    panel.querySelector(".ghh-favn").textContent = list.length ? "（" + list.length + "）" : "";
    favUl.innerHTML = list.length
      ? list
          .map(function (f, i) {
            return (
              '<li><a href="' + esc(f.path) + '">' + esc(f.title) + "</a>" +
              '<button class="ghh-del" data-i="' + i + '" type="button" title="取消收藏">✕</button></li>'
            );
          })
          .join("")
      : '<li class="ghh-empty">点上面「收藏本页」把常用文档存到这里</li>';
    favUl.querySelectorAll(".ghh-del").forEach((b) => {
      b.addEventListener("click", (e) => {
        e.preventDefault();
        const l = favs();
        l.splice(Number(b.dataset.i), 1);
        setFavs(l);
        renderPanel();
      });
    });

    renderPrs(panel.querySelector(".ghh-prlist"));
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    load();
    const box = build();
    if (!box) return;
    renderPanel();
    if (state.token && !state.user) {
      fetchUser()
        .then((u) => save(state.token, u))
        .catch(() => save("", null));
    } else if (state.token) {
      // 后台静默刷新身份（token 可能已失效）
      fetchUser()
        .then((u) => {
          if (JSON.stringify(u) !== JSON.stringify(state.user)) save(state.token, u);
        })
        .catch(() => save("", null));
    }
  }

  // 先把对外 API 挂出去，避免 init 里任何异常导致 window.MDGitHub 缺失
  // （edit-page.js 依赖它判断是否显示「编辑本页」）
  window.MDGitHub = {
    get token() {
      return state.token;
    },
    get user() {
      return state.user;
    },
    clientId: CLIENT_ID,
    owner: OWNER,
    repo: REPO,
    login: loginModal,
    logout() {
      save("", null);
      try {
        renderPanel();
      } catch (e) {
        /* 忽略渲染异常 */
      }
    },
    onChange(fn) {
      listeners.push(fn);
      fn({ token: state.token, user: state.user });
    },
  };

  try {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        try {
          init();
        } catch (e) {
          console.warn("[ghh] init failed", e);
        }
      });
    } else {
      init();
    }
  } catch (e) {
    console.warn("[ghh] init failed", e);
  }
})();
