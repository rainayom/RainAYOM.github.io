---
tags:
  - mkdocs
  - 部署
---

# 使用指南

一套「Markdown 文档站 + 网页编辑器」的实现：MkDocs Material 渲染站点，md-editor-v3 在浏览器里改文档，改动自动提交并发布到 GitHub Pages。本文只讲三件事：**有什么、怎么装、怎么用**。

## 1. 模块与功能

| 模块 | 能力 | 位置 |
| --- | --- | --- |
| 站点渲染 | MkDocs Material，markdown 文件即唯一数据源 | `mkdocs.yml`、`docs/` |
| 首页目录 | hook 扫描 docs 自动生成索引，新增文件不用改 nav | `hooks/index_listing.py` |
| 标签体系 | front matter 的 `tags` 汇总成标签页，并导出 `tags.json` | `hooks/tags_json.py`、`docs/tags.md` |
| 代码语言 | 按围栏顺序给代码块补 `data-lang` | `hooks/code_lang.py` |
| 页眉工具条 | 主题（跟随系统/亮/暗）、文档内容主题、代码主题、搜索胶囊、个人中心 | `docs/javascripts/site-ui.js` |
| 文档内容主题 | 6 套：默认（md-editor）/ github / vuepress / mk-cute / smart-blue / cyanosis，明暗各一套 | `docs/stylesheets/content-themes.css` |
| 代码块外观 | 深色卡片、三点、语言标签、文字「复制代码」、折叠、行号 | `docs/stylesheets/code-block.css` |
| 代码配色 | 8 套 pygments 主题（默认 One Dark） | `docs/stylesheets/code-themes/` |
| 搜索 | 居中弹窗，Ctrl+K 唤起，支持标题/正文/标签过滤器 | `site-ui.js` |
| 评论区 | 基于 GitHub Discussions 的自建评论 UI | `docs/javascripts/comments.js` |
| 编辑入口 | 页眉「编辑」按权限分流：仓库所有者直写，其他人 fork → PR | `docs/javascripts/edit-page.js` |
| 网页编辑器 | Vue3 + md-editor-v3，单预览、28 项工具栏、三套主题、导出 PDF、返回、未保存拦截 | `editor/` |
| 编辑器后端 | 零依赖标准库 HTTP 服务：读写 docs 内 md、校验 token、GitHub 代理 | `server/editor_server.py` |
| 自动发布 | 定时器每 5 分钟提交 main 并 `mike deploy` 推 gh-pages | `autopush.sh`、`deploy/mkdocs-autopush.*` |
| 多版本 | mike 管理版本与 `latest` 别名 | `mkdocs.yml`（mike 插件） |
| 离线安装 | release 附件里的离线包，自带全部 Python wheels | `deploy/install-offline.sh` |

## 2. 目录结构

```text
.
├── mkdocs.yml               # 站点配置：主题 / 插件 / hooks / 资源
├── requirements.txt         # mkdocs-material、awesome-pages、mike
├── deploy.sh                # 一键脚本：bootstrap / serve / build / deploy / release
├── autopush.sh              # 自动提交并发布（systemd timer 调用）
├── deploy/                  # systemd 单元 + 离线安装脚本
├── hooks/                   # 首页目录、标签、代码语言
├── overrides/               # 模板覆盖（页脚、评论挂载点等）
├── tools/                   # 辅助脚本（自动打标签、标题修复）
├── editor/                  # 网页编辑器源码（Vue3 + md-editor-v3）
│   ├── src/  index.html  package.json  vite.config.js
├── server/editor_server.py  # 编辑器后端
├── packaging/               # 打离线包 / 源码包的脚本
└── docs/                    # 正文、样式、脚本、图片
```

## 3. 部署（在线，机器能联网）

环境：openEuler 24.03 / CentOS Stream 9 一类，`python3.11`、`git`，内存 1G 足够。

```bash
# 1) 取源码
git clone git@github.com:rainayom/RainAYOM.github.io.git
cd RainAYOM.github.io

# 2) 建虚拟环境并装依赖
./deploy.sh bootstrap          # 生成 .venv，装 requirements.txt

# 3) 起服务（三个常驻单元，路径按需改）
sudo cp deploy/mkdocs-serve.service deploy/mkdocs-versions.service \
        deploy/mkdocs-editor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mkdocs-serve mkdocs-versions mkdocs-editor

# 4) 编辑器的前端要先构建一次
cd editor && npm ci && npm run build     # 产物在 editor/dist
sudo cp -r dist /srv/mkdocs/editor-app/  # 后端 DIST_DIR 指向这里

# 5) 访问
#    http://<IP>:8000   站点预览
#    http://<IP>:8001   多版本（mike）
#    http://<IP>:8080   网页编辑器
```

发布到 GitHub Pages：

```bash
./deploy.sh deploy 1.0 latest   # mike deploy + 推 gh-pages
```

自动发布：装好 `deploy/mkdocs-autopush.service` 与 `.timer`，之后每 5 分钟检查一次改动自动提交 + 发布。

## 4. 部署（离线，机器不能联网）

Release 里有两个包：

| 包 | 内容 | 用途 |
| --- | --- | --- |
| `ops-kb-<版本>-offline.tar.gz` | 站点源码 + **全部 Python wheels** + 编辑器构建产物 + systemd 单元 + 安装脚本 | 断网机器直接装 |
| `ops-kb-<版本>-source.tar.gz` | 纯源码（不含构建产物与 wheels） | 二次开发 / 自己打包 |

离线安装：

```bash
tar xzf ops-kb-<版本>-offline.tar.gz
cd ops-kb-<版本>-offline
sudo bash install.sh            # 默认装到 /srv/mkdocs，用户 mkdocs
```

安装脚本做的事：建用户与目录 → 从 `wheels/` 离线装 Python 依赖（`pip install --no-index --find-links`）→ 铺站点与编辑器产物 → 装并启动 `mkdocs-serve`、`mkdocs-editor` 两个单元 → 打印访问地址。装完不需要任何联网动作。

可选：

```bash
sudo bash install.sh --with-versions   # 额外启用 mike 多版本（需要本地 git 仓库）
sudo bash install.sh --prefix /opt/kb  # 换安装目录（单元文件会跟着改路径）
```

## 5. 日常使用

- **写文档**：直接往 `docs/` 里加 md 和图片；首页目录、标签页会自动更新，不用改 nav。
- **改主题**：页眉 `Aa` 换文档内容主题，`</>` 换代码配色，太阳/月亮切亮暗；选择记在浏览器 `localStorage`。
- **网页编辑**：打开 `:8080`，选文档 → 编辑 → 保存；有改动未保存时按返回会提示「保存并离开 / 不保存离开 / 取消」。
- **导出 PDF**：编辑器工具栏「PDF」会打开打印页，浏览器「另存为 PDF」即可（A4、`!!!` 转引用块）。
- **手动发布**：`./deploy.sh deploy 1.0 latest`，或直接跑 `./autopush.sh` 立即同步一次。
- **打新包**：`packaging/build-bundles.sh 1.1.0`，产物在 `packaging/out/`。

## 6. 常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 站点 8000 打不开 | 单元没起或端口占用 | `systemctl status mkdocs-serve`、`journalctl -u mkdocs-serve -n 40` |
| 页眉图标点了没反应 | `site-ui.js` 版本被缓存 | 改 `mkdocs.yml` 里的 `?v=` 后强刷 |
| 代码块没有语言标签 | 该页围栏数与代码块数对不上 | 正常降级；检查是否有缩进式代码块 |
| 编辑器提示未登录 | 缺 GitHub token | 页眉「编辑」走一次设备码登录即可 |
| 发布后线上还是旧版 | Pages 缓存或 autopush 未跑 | 看 `git log gh-pages`，等 1 分钟或硬刷 |
| 离线装报缺依赖 | wheels 版本与目标 Python 不匹配 | 在同版本 Python 上重跑 `packaging/build-bundles.sh` |
