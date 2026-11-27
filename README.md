# 运维知识库（MkDocs Material + 网页编辑器）

用 Markdown 写运维笔记，MkDocs Material 渲染成站，浏览器里可以直接编辑（md-editor-v3），改动自动提交并发布到 GitHub Pages。

- 站点：<https://rainayom.github.io/>（`/latest/` → `/1.0/`）
- 源码分支：`main`；产物分支：`gh-pages`（mike 生成，Pages 只认这个）
- 详细说明：[使用指南](docs/guide.md)

## 功能

| 能力 | 说明 |
| --- | --- |
| 三态主题 | 跟随系统 / 亮 / 暗，选择记在 `localStorage` |
| 文档内容主题 | 6 套（默认 md-editor、github、vuepress、mk-cute、smart-blue、cyanosis），明暗各一套 |
| 代码配色 | 8 套 pygments 主题，默认 One Dark |
| 代码块 | 深色卡片 + 三个圆点 + 语言标签 + 文字「复制代码」+ 折叠 + 行号 |
| 搜索 | 居中弹窗，`Ctrl+K` 唤起，带标题/正文/标签过滤 |
| 评论 | 基于 GitHub Discussions 的自建评论区 |
| 编辑入口 | 所有者直写仓库，其他人 fork → PR |
| 网页编辑器 | 单预览、28 项工具栏、导出 PDF、返回、未保存拦截（`:8080`） |
| 多版本 | mike 管理版本与 `latest` 别名（`:8001`） |
| 自动发布 | systemd timer 每 5 分钟提交并 `mike deploy` |

## 目录

```text
mkdocs.yml              站点配置（主题/插件/hooks/资源）
requirements.txt        mkdocs-material、awesome-pages、mike
deploy.sh               一键脚本：bootstrap/serve/build/deploy/release
autopush.sh             自动提交并发布
deploy/                 systemd 单元 + 离线安装脚本
hooks/                  首页目录、标签、代码语言
overrides/              模板覆盖
editor/                 网页编辑器源码（Vue3 + md-editor-v3）
server/editor_server.py 编辑器后端（零依赖标准库）
packaging/              打离线包 / 源码包
docs/                   正文、样式、脚本、图片
```

## 部署（在线）

```bash
git clone git@github.com:rainayom/RainAYOM.github.io.git
cd RainAYOM.github.io
./deploy.sh bootstrap                       # 建 .venv 并装依赖
./deploy.sh serve                           # 本地预览 0.0.0.0:8000

# 常驻服务
sudo cp deploy/mkdocs-serve.service deploy/mkdocs-versions.service \
        deploy/mkdocs-editor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mkdocs-serve mkdocs-versions mkdocs-editor

# 编辑器前端（首次或改过前端后）
cd editor && npm ci && npm run build
```

## 部署（离线）

到 [Releases](https://github.com/rainayom/RainAYOM.github.io/releases) 下载：

- `ops-kb-<版本>-offline.tar.gz`：**完全离线可装**，自带全部 Python wheels + 编辑器构建产物 + systemd 单元；
- `ops-kb-<版本>-source.tar.gz`：纯源码，自行打包或二次开发。

```bash
tar xzf ops-kb-<版本>-offline.tar.gz
cd ops-kb-<版本>-offline
sudo bash install.sh              # 默认 /srv/mkdocs，用户 mkdocs
sudo bash install.sh --help       # 其它参数（--prefix / --with-versions）
```

装完即可访问 `http://<IP>:8000`（站点）与 `http://<IP>:8080`（编辑器），全程不需要联网。

## 发布与更新

```bash
./deploy.sh deploy 1.0 latest     # 构建 + mike 发布 + 推 gh-pages
./autopush.sh                     # 立即同步一次（等价于定时器跑一轮）
packaging/build-bundles.sh 1.1.0  # 打离线包与源码包到 packaging/out/
```

## License

仅供个人学习与内部运维使用，引用请注明出处。
