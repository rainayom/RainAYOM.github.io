/* 返回顶部：滚动超过 400px 显示，点击平滑回到顶部。
   纯原生 JS，无依赖；配合 stylesheets/back-to-top.css 使用。 */
(function () {
  "use strict";

  var SHOW_AFTER = 400;

  function init() {
    if (document.querySelector(".back-to-top")) return;

    var btn = document.createElement("a");
    btn.className = "back-to-top";
    btn.href = "#";
    btn.setAttribute("aria-label", "返回顶部");
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">' +
      '<path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>' +
      "<span>返回顶部</span>";
    document.body.appendChild(btn);

    var visible = false;
    var ticking = false;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function toggle() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var next = y > SHOW_AFTER;
      if (next !== visible) {
        visible = next;
        btn.classList.toggle("is-visible", visible);
      }
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(toggle);
      },
      { passive: true }
    );

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: reduceMotion.matches ? "auto" : "smooth",
      });
      // 键盘/读屏用户：把焦点交回正文起点
      var main = document.querySelector(".md-content");
      if (main) {
        main.setAttribute("tabindex", "-1");
        main.focus({ preventScroll: true });
      }
    });

    toggle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Material 切换页面（instant navigation）时重新挂载
  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(init);
  }
})();
