# 运维知识库（MkDocs Material）

基于 MkDocs Material 的运维文档站：自动亮暗模式、标签索引、mike 多版本发布，产物由 GitHub Pages 托管。

- 站点：<https://rainayom.github.io/>
- 源码分支：`main`（`mkdocs.yml` + `docs/` + `hooks/` + `deploy.sh`）
- 产物分支：`gh-pages`（mike 生成，Pages 只认这个）

## 目录结构

```
.
├── mkdocs.yml            # 站点配置：主题/调色板/插件/hooks
├── requirements.txt      # mkdocs-material、awesome-pages、mike
├── deploy.sh             # 一键脚本：环境/预览/构建/发布/密钥/Release
├── hooks/index_listing.py# 首页自动目录
└── docs/
    ├── index.md
    ├── guide.md          # 全流程部署手册（SMB、Windows、Git、密钥、Pages）
    ├── tags.md           # 标签索引页
    ├── ops/  ansible/    # 运维与自动化笔记
    └── images/
```

## 一键部署

```bash
git clone git@github.com:rainayom/RainAYOM.github.io.git
cd RainAYOM.github.io
./deploy.sh bootstrap          # 建 .venv 并安装依赖（会修正 pip 生成的 shebang）
./deploy.sh serve              # 本地预览 0.0.0.0:8000
./deploy.sh deploy 1.0 latest  # 构建 + mike 发布 + 推 gh-pages
```

脚本以 root 运行时会自动 `runuser` 切到仓库属主（默认 `mkdocs`），避免 git 报 “dubious ownership”。

## 子命令

| 子命令 | 作用 |
| --- | --- |
| `bootstrap` | 创建 `.venv`、安装 `requirements.txt`、修正入口脚本 shebang |
| `serve` | `mkdocs serve -a 0.0.0.0:8000` 热重载预览 |
| `build` | `mkdocs build --clean` 输出到 `site/` |
| `deploy [版本] [别名]` | `mike deploy --update-aliases` + `set-default latest` + 推 `gh-pages` |
| `push` | 只推送 `main` |
| `status` | 打印 `mike list`、最近提交与工作区状态 |
| `genkey [路径]` | 生成 ed25519 部署密钥并打印公钥 |
| `release [tag]` | 打 tag、推 tag、`git archive` 出源码包 |

## 首次部署要做的三件事

1. **部署密钥**：`./deploy.sh genkey` 生成密钥，把 `.pub` 内容加到仓库 Settings → Deploy keys，并**勾选 Allow write access**；再把私钥与 `~/.ssh/config` 放到运行用户可读的位置（600）。
2. **远端**：`git remote add origin git@github.com:<user>/<user>.github.io.git`，先推 `main`，再推 `gh-pages`。
3. **Pages**：Settings → Pages → Source 选 `Deploy from a branch` → `gh-pages` → `/ (root)` → Save。

## 版本管理

```bash
./deploy.sh deploy 1.1 latest   # 发 1.1，同时把 latest 指到它
mike list                       # 看已发布版本
mike delete 1.0 --push          # 撤销某版本
```

版本选择器依赖 `plugins.mike.version_selector: true` 与 `alias_type: redirect`（GitHub Pages 不解析符号链接）。

## 完整手册

Samba 共享、Windows 资源管理器访问、git 提交、部署密钥、Pages 验收、明文清理等细节，见站点里的 `使用指南 → 16～18 章`（源文件 `docs/guide.md`）。
