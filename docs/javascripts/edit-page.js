/* 编辑本页：右下角胶囊按钮，跳到 md-editor-v3 编辑器并带入当前文档。
   两个门槛：
     1) 必须是局域网地址（编辑器是内网服务，公网 Pages 上不出现）
     2) 必须已用 GitHub 登录（未登录时不显示，登录后自动出现） */
(function () {
  "use strict";

  var EDIT_HOSTS = ["192.168.7.130", "localhost", "127.0.0.1"];
  var EDIT_PORT = "8080";
  var btn = null;

  function editorUrl() {
    var rawPath = location.pathname;
    try {
      rawPath = decodeURI(decodeURI(rawPath));
    } catch (e) {
      /* 保持原样 */
    }
    var base =
      location.protocol + "//" + location.hostname + ":" + EDIT_PORT + "/?url=" +
      encodeURIComponent(rawPath);
    var token = window.MDGitHub && window.MDGitHub.token;
    if (token) base += "#t=" + encodeURIComponent(token);
    return base;
  }

  function render(authed) {
    if (!authed) {
      if (btn) {
        btn.remove();
        btn = null;
      }
      return;
    }
    if (btn || document.querySelector(".edit-page")) return;

    btn = document.createElement("a");
    btn.className = "edit-page";
    btn.href = editorUrl();
    btn.target = "_blank";
    btn.rel = "noopener";
    btn.title = "用 md-editor-v3 编辑本页";
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">' +
      '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 ' +
      '7.04a1 1 0 0 0 0-1.42l-2.34-2.34a1 1 0 0 0-1.42 0l-1.83 1.83 3.75 ' +
      '3.75 2.83-2.83z"/></svg>' +
      "<span>编辑本页</span>";
    document.body.appendChild(btn);
  }

  function init() {
    if (EDIT_HOSTS.indexOf(location.hostname) === -1) return;
    if (window.MDGitHub) {
      window.MDGitHub.onChange(function (s) {
        render(!!s.token);
      });
    } else {
      render(false);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
