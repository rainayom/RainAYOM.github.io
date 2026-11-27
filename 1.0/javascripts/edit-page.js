/* 编辑本页：在页面右下角插入一个胶囊按钮，跳到 md-editor-v3 编辑器并带入当前文档。
   只在局域网访问时显示，公网 Pages 上不出现（编辑器是内网服务）。 */
(function () {
  "use strict";

  var EDIT_HOSTS = ["192.168.7.130", "localhost", "127.0.0.1"];
  var EDIT_PORT = "8080";

  function init() {
    if (document.querySelector(".edit-page")) return;
    if (EDIT_HOSTS.indexOf(location.hostname) === -1) return;

    var a = document.createElement("a");
    a.className = "edit-page";
    a.href =
      location.protocol + "//" + location.hostname + ":" + EDIT_PORT + "/?url=" +
      encodeURIComponent(location.pathname);
    a.target = "_blank";
    a.rel = "noopener";
    a.title = "用 md-editor-v3 编辑本页";
    a.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">' +
      '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 ' +
      '7.04a1 1 0 0 0 0-1.42l-2.34-2.34a1 1 0 0 0-1.42 0l-1.83 1.83 3.75 ' +
      '3.75 2.83-2.83z"/></svg>' +
      "<span>编辑本页</span>";
    document.body.appendChild(a);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
