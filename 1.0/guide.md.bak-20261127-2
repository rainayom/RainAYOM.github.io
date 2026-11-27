---
tags:
  - mkdocs
  - 部署
---

# 使用指南

这篇是本知识库的完整搭建与运维指南：从 Markdown 写作约定、MkDocs Material 构建、首页自动目录，到 systemd 常驻、FTP 共享，以及 git → GitHub Actions → Cloudflare Pages 发布。所有命令与参数都已在 openEuler 24.03 LTS-SP3 实机验证。

!!! tip "最短路径"
    只想快速跑起来：`sudo FTP_PASS='强密码' bash deploy-mkdocs-ftp.sh`，详见第 11 节。想看写作约定，跳到第 5 节。

本手册记录一套已在 openEuler 24.03 LTS-SP3 实机跑通的 Markdown 文档站流水线：**写作 → FTP 上传 → 热构建预览 → git 推送 → GitHub Actions → Cloudflare Pages**。所有命令、参数、报错都是真机验证过的，可直接照抄。

!!! note "适用场景"
    内网/单机的 Markdown 知识库：运维笔记、项目文档、教程合集。要求是「文件即源」——不引入数据库，md 与图片就是唯一数据，随时可备份、可迁移、可进 git。

## 1. 最终形态

| 能力 | 落地方式 | 端口 |
| --- | --- | --- |
| 网页浏览/搜索 | MkDocs Material + `mkdocs serve` | 8000 |
| 首页自动目录 | 自定义 hook 扫描 `docs/` 下全部 md | — |
| 网页编辑 | 本地编辑器 / code-server（可选） | 8443 |
| 文件上传管理 | FTP（pyftpdlib），Windows 资源管理器原生可用 | 21 + 21200-21210 |
| 常驻守护 | systemd 两个单元，重启自愈 | — |
| 公网发布 | git push → GitHub Actions → Cloudflare Pages | — |

## 2. 架构与数据流

```text
        ┌─────────────────────────────────────────┐
        │  Windows 资源管理器 (FTP 21, 被动)       │
        └───────────────┬─────────────────────────┘
                        │ 上传 md / 图片
                        ▼
   /srv/mkdocs/repo/  ←── 唯一数据源（文件即数据库）
     ├── docs/*.md          正文
     ├── docs/images/       图片（必须在 docs 内）
     ├── hooks/             首页目录生成 hook
     ├── mkdocs.yml         站点配置
     └── site/              构建产物（只读保护）
                        │
       ┌────────────────┴─────────────────┐
       ▼                                  ▼
  mkdocs serve (8000)              git push
  systemd: mkdocs-serve            → GitHub Actions (mkdocs build --strict)
  systemd: ftp-share               → Cloudflare Pages (公网)
```

关键设计：**一个目录，多协议访问**。FTP、本机编辑、git、mkdocs 全都指向 `/srv/mkdocs/repo`，不存在「同步」这一步，也就不会出现两边内容不一致。

## 3. 环境与目录规划

实测环境：openEuler 24.03 LTS-SP3、内核 6.6、Python 3.11.6、git 2.43、SELinux Disabled、firewalld inactive。

| 路径 | 属主/权限 | 用途 |
| --- | --- | --- |
| `/srv/mkdocs` | `root:root 755` | 文档根 |
| `/srv/mkdocs/.venv` | `mkdocs:docs 755` | 专用 Python 环境 |
| `/srv/mkdocs/repo` | `mkdocs:docs 2775` | 仓库（setgid，组自动继承） |
| `/srv/mkdocs/repo/docs` | `mkdocs:docs 2775` | 正文与图片 |
| `/srv/mkdocs/repo/site` | `mkdocs:docs 2755` | 构建产物，组不可写 |
| `/opt/ftp-share` | `root:root 755` | FTP 服务与其 venv |
| `/etc/ftp-share.env` | `root:root 600` | FTP 凭据（密码所在） |

!!! warning "为什么不用 root 跑服务"
    站点与 FTP 都用专用账号（`mkdocs` uid 991、`mdftp`），配 systemd 沙箱。`systemd-analyze security mkdocs-serve` 实测从 5.6 MEDIUM 降到 **1.7 OK**。

## 4. 阶段一：Python 环境

不要用系统 pip 装 mkdocs——openEuler 的 pip 受 PEP 668 与发行版策略限制，且升级会污染系统包。统一用 venv：

```bash
python3 -m venv /srv/mkdocs/.venv
/srv/mkdocs/.venv/bin/pip install -U pip
/srv/mkdocs/.venv/bin/pip install 'mkdocs-material>=9.6,<10' 'mkdocs-awesome-pages-plugin>=2.9,<3'
```

国内网络慢就加镜像：`-i https://pypi.tuna.tsinghua.edu.cn/simple`。实测 mkdocs-material 9.8.2 + mkdocs 1.6.1 + awesome-pages 2.10.1。

依赖写进 `requirements.txt`，让本机与 GitHub Actions 用同一份版本约束：

```text
mkdocs-material>=9.6,<10
mkdocs-awesome-pages-plugin>=2.9,<3
```

## 5. 阶段二：仓库骨架与写作约定

```
repo/
├── docs/
│   ├── index.md          首页（内含 <!-- DOC-LIST --> 占位）
│   ├── guide.md
│   ├── images/           图片目录
│   └── ops/              子目录自动归组
├── hooks/index_listing.py
├── mkdocs.yml
├── requirements.txt
└── .github/workflows/deploy-cloudflare.yml
```

三条硬约定，违反必踩坑：

1. **图片必须放在 `docs/` 内**（推荐 `docs/images/`），正文写 `images/xxx.png`。放到 `docs/` 之外，`mkdocs build --strict` 直接报 `link '...' ... not found among documentation files` 并中断构建。实测：图片在 `docs/images/` 内时 strict 构建 0.61 秒通过；移到 `docs/` 外立刻失败。
2. **一篇文章一个 `.md`**，首个一级标题就是首页目录里的展示名。
3. **文件名避开纯数字和特殊符号**，中文名可用（FTP 与 mkdocs 均按 UTF-8 处理），但 URL 里会被转义，分享链接略丑。

## 6. 阶段三：mkdocs.yml 逐项说明

```yaml
site_name: 我的知识库
docs_dir: docs
site_dir: site

theme:
  name: material
  language: zh
  features:
    - navigation.tabs
    - navigation.sections
    - content.code.copy

plugins:
  - search
  - awesome-pages

hooks:
  - hooks/index_listing.py

markdown_extensions:
  - admonition
  - codehilite
  - toc:
      permalink: true
```

| 配置 | 作用 | 注意 |
| --- | --- | --- |
| `theme.material` | Material 主题，自带深色模式与搜索 | 9.8.x 会提示 2027-05-05 EOL 并推荐 Zensical，暂不影响使用 |
| `language: zh` | 中文界面与搜索分词 | 必须写，否则界面英文 |
| `plugins: awesome-pages` | 侧边栏按目录结构自动生成 | **启用后不能再写 `nav`**，否则插件报冲突；也不用手工维护导航 |
| `hooks` | 构建期改写首页 | 新增 md 无需改任何配置 |
| `markdown_extensions: admonition` | `!!! note` 提示块 | 手册里大量使用 |

## 7. 阶段四：首页自动目录的原理

`docs/index.md` 里只放一个占位标记：

```markdown
## 文档目录

<!-- DOC-LIST -->
```

hook 在每个页面渲染前拦截：只在 `index.md`、且只有出现标记时才动作。它遍历 mkdocs 已收集的 `files`，跳过 `index.md`，按父目录分组（`根目录` / 子目录名），取每个文件首个 H1 作标题，生成表格替换标记：

```python
def on_page_markdown(markdown, page, config, files):
    src_path = page.file.src_path.replace("\\", "/")
    if src_path != "index.md" or MARKER not in markdown:
        return markdown
    docs_dir = Path(config["docs_dir"])
    # 遍历 files → 分组 → 取首个 H1 → 生成表格
    return markdown.replace(MARKER, "\n".join(lines))
```

实测输出：首页显示 `共 8 篇文档`，分组「根目录」与「ops」，侧栏 17 个链接全部自动生成；通过 FTP 上传一篇新 md 后，8 秒内变 `共 9 篇文档` 并出现新标题——无需重启、无需改 nav。

!!! tip "排序由文件名控制"
    想固定顺序就在文件名前加 `01-`、`02-` 前缀；awesome-pages 与首页表格都按路径字符串排序。

## 8. 阶段五：构建与验收

```bash
cd /srv/mkdocs/repo
/srv/mkdocs/.venv/bin/python -m mkdocs build --strict   # CI 用这条
/srv/mkdocs/.venv/bin/python -m mkdocs serve -a 0.0.0.0:8000
```

验收口径（每次改完都看这三条）：

1. `build --strict` 退出码 0，无 warning（strict 会把断链、缺图当成错误）；
2. `curl -s http://127.0.0.1:8000/` 返回 200；
3. 首页出现 `共 <strong>N</strong> 篇文档`，N 与 `find docs -name '*.md' | wc -l` 减 1 后一致。

`serve` 是热重载模式：改 md 自动重建，适合内网预览；CI 与生产用 `build`。

!!! warning "装了新插件要重启 serve"
    先起 `serve` 再 `pip install` 插件，热重载会报 `The "awesome-pages" plugin is not installed` 并卡死——旧进程的 entry-points 缓存不会刷新。必须 `systemctl restart mkdocs-serve`。

## 9. 阶段六：systemd 常驻

两个单元，都放在 `/etc/systemd/system/`：

| 单元 | 类型 | 关键点 |
| --- | --- | --- |
| `mkdocs-serve.service` | simple | `User=mkdocs`、`KillSignal=SIGINT`（mkdocs 需优雅退出）、`Restart=always` |
| `ftp-share.service` | simple | `User=mdftp` + `AmbientCapabilities=CAP_NET_BIND_SERVICE`（非 root 绑 21） |

`mkdocs-serve.service` 的沙箱项与理由：

| 配置 | 作用 |
| --- | --- |
| `ProtectSystem=strict` | 整个 `/usr` `/etc` 只读 |
| `ProtectHome=yes` | 隐藏 `/home` `/root` |
| `ReadWritePaths=/srv/mkdocs/repo` | 只放行仓库目录可写 |
| `ReadOnlyPaths=/srv/mkdocs/.venv` | venv 只读，防篡改 |
| `SystemCallFilter=@system-service` | 只允许系统服务常用系统调用 |
| `CapabilityBoundingSet=` / `AmbientCapabilities=` | 清空全部 capability |
| `UMask=0027` | 新建文件默认不给组外读 |

验证自愈：`kill -9` 主进程，5 秒内 PID 变化、端口仍 200：

```bash
systemctl show -p MainPID mkdocs-serve --value
kill -9 $(systemctl show -p MainPID mkdocs-serve --value)
sleep 6; systemctl show -p MainPID mkdocs-serve --value; curl -sI http://127.0.0.1:8000 | head -1
```

实测 PID 1970 → 2075，HTTP 200 保持。

## 10. 阶段七：FTP 共享

### 10.1 为什么是 pyftpdlib

| 方案 | 结果 |
| --- | --- |
| `dnf install vsftpd` | openEuler SP3 的 `update` 仓拉不到 `repomd.xml`（`All mirrors were tried`），需 `--disablerepo=update --disablerepo=update-source`，且要 root 装系统包 |
| SFTP（sshd 内置） | 零安装、加密，但 **Windows 资源管理器原生不支持**，只能 WinSCP/FileZilla |
| **pyftpdlib（采用）** | 纯 Python，pip 装进独立 venv，不碰系统包；非 root 运行；`encoding=utf8` 支持中文名；被动端口可控 |

### 10.2 被动模式是唯一的坑

FTP 有两个连接：控制连接（21）传命令，数据连接（每次列表/传输新建）传内容。客户端默认用被动模式：服务端回一个「我的地址+端口」，客户端去连。容器或 NAT 后面，服务端回的是内网/容器地址，客户端连不上，就出现「能登录，但读取目录列表失败」。

两个参数解决：

```python
handler.passive_ports = range(21200, 21211)     # 固定被动端口段，好放行
handler.masquerade_address = "192.168.7.130"   # 回给客户端的就是这个 IP
```

容器里跑还要把 21200-21210 映射出来；单机直装只需防火墙放行。

### 10.3 权限模型

| 对象 | 权限 | 说明 |
| --- | --- | --- |
| `/srv/mkdocs/repo` | `mkdocs:docs 2775` | 目录 2775 = setgid + 组可写，新文件自动继承 docs 组 |
| `docs/*.md` | `mkdocs:docs 664` | FTP 上传落盘即 644/664，mkdocs 可读 |
| `site/` | `mkdocs:docs 2755` | 组不可写：FTP 账号改不到构建产物 |
| 组 `docs` | gid 1002 | 成员：`mkdocs`、`mdftp` |

FTP 服务以 `mdftp` 运行，系统层权限是 `docs` 组可写；pyftpdlib 的 `DummyAuthorizer(perm="elradfmwMT")` 只控制协议层允许哪些命令。两层叠加才是完整权限。

### 10.4 Windows 资源管理器接法

**方式 A：地址栏**（临时传文件最快）

1. 地址栏输 `ftp://192.168.7.130/`；
2. 登录框填账号 `mdftp` + 密码；
3. 进入后看到 `docs`、`hooks`、`mkdocs.yml`，进 `docs` 即可拖拽。

**方式 B：映射网络位置**（图标常驻「此电脑」）

「此电脑」右键 → 映射网络驱动器 → 「连接到可用于存储文档和图片的网站」→ 自定义网络位置 → `ftp://192.168.7.130/` → 取消匿名 → 填账号密码。

!!! note "资源管理器相关设置"
    资源管理器走被动模式，需要「使用被动 FTP」（IE 选项 → 高级，默认已开）。若单位网络拦截，把 `PASV_MIN/MAX` 收窄到 10 个端口，或先用 FileZilla 判断是服务端还是网络问题。

### 10.5 实测记录

| 项 | 结果 |
| --- | --- |
| 登录 / 列目录 | 成功，根目录 `docs hooks mkdocs.yml site` |
| 中文名上传 | `FTP上传测试笔记.md` 成功，落盘 `mdftp:docs 644` |
| 目录操作 | `MKD` / `RNFR+RNTO` / `DELE` / `RMD` 全部通过 |
| 站点联动 | 上传后首页 `8 → 9 篇`，出现标题「FTP 上传测试」；删除后回落 8 |
| 日志无害报错 | `550 SIZE not allowed in ASCII mode` —— 客户端未先发 `TYPE I`，资源管理器走二进制不受影响 |

### 10.6 安全边界

FTP 是明文协议，账号密码与内容都可被嗅探。因此：

- 只在内网监听，**不要把 21 与 21200-21210 映射到公网**；
- 跨公网用 SFTP 或 WireGuard/Tailscale 隧道；
- 需要加密又要资源管理器：pyftpdlib 换 `TLS_FTPHandler` + 自签证书即可；
- 密码放 `/etc/ftp-share.env`（600，root 独占），不要留在脚本里。

## 11. 阶段八：一键部署脚本

`deploy-mkdocs-ftp.sh` 是单文件脚本，把上面第 4-10 阶段全部自动化，不依赖其他模板文件（内容都内嵌了）。

```bash
sudo FTP_PASS='换成你的强密码' bash deploy-mkdocs-ftp.sh
```

常用变体：

```bash
sudo bash deploy-mkdocs-ftp.sh --dry-run              # 只打印将要做什么
sudo bash deploy-mkdocs-ftp.sh --skip-ftp             # 只要站点，不要 FTP
sudo FTP_PASS=xxx PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple \
     DOC_ROOT=/srv/mkdocs bash deploy-mkdocs-ftp.sh    # 国内镜像 + 自定义根
```

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DOC_ROOT` | `/srv/mkdocs` | 文档根 |
| `SITE_PORT` | `8000` | 站点端口 |
| `SERVICE_USER` / `SHARE_GROUP` | `mkdocs` / `docs` | 站点账号 / 共享组 |
| `FTP_USER` | `mdftp` | FTP 账号 |
| `FTP_PASS` | 随机生成 | 不传则生成 16 位并打印，务必记录 |
| `FTP_MASQ` | 自动探测 | 被动模式回给客户端的 IP |
| `FTP_PORT` / `PASV_MIN` / `PASV_MAX` | `21` / `21200` / `21210` | 端口规划 |
| `FORCE_CONFIG` | `0` | 设 1 才覆盖已有的 `mkdocs.yml`、hook、`index.md` |

脚本行为要点：

- **幂等**：重复执行只补缺失项、校正权限与单元文件，**绝不覆盖你已有的 md**；
- 已存在的 `mkdocs.yml` / `hooks` / `index.md` 默认保留（避免吃掉你的配置）；
- 内置验收：检查两个服务 active、站点 HTTP 200、首页文档数、FTP 端口监听；
- firewalld 运行时自动放行 8000 / 21 / 被动段，未运行则提示。

脚本分九步：参数打印 → 建用户组 → venv 与依赖 → 仓库骨架 → mkdocs-serve 单元 → FTP 服务（venv/ftpd.py/env/单元）→ 启动自启 → 防火墙 → 验收与摘要。



##  部署samba共享doc目录

方便linux与windows之间进行文档编辑上传，即时生效



```bash
#安装
sudo yum install samba samba-client -y

#设置共享目录、设置权限
#共享目录   /srv/mkdocs/repo/docs/
#其他目录使用mkdir 目录路径

#配置权限
sudo chmod 2775 /srv/mkdocs/repo/docs/
```

**1. 配置文件**（`/etc/samba/smb.conf`）

```bash
#编辑配置文件
vim /etc/samba.smb.conf
#添加下面配置
## read only = no  才运行写入
## valid users = your_username  指定允许访问的samba用户
[share]
	comment = Linux SMB share
	path = /srv/mkdocs/repo/docs
	browseable = yes
	read only = no
	valid users = @docs
	write list = @docs
	force group = docs
	#inherit permissions = yes   # 副作用: 新文件会带上属主 x 位，故改用显式掩码
	create mask = 0664
	directory mask = 2775

```

`valid users` 从占位符改成 `@docs`；`browsable` 改成正确的 `browseable`；补上 `write list`（写入白名单，和 valid users 分离，后续只想让人看不想让人改时改这一行就行）；`force group = docs` 兜底；`directory mask` 用 **2775**（四位数，含 setgid），这样客户端建子目录不会丢组继承。

中途我先试过 `inherit permissions = yes`，实测发现它会让上传的普通文件变成 `-rwxrw-r--`（属主多出执行位），对 md 文件不干净，所以改成显式掩码，最终文件是标准的 `664`。

**2. SMB 账号**

`smbpasswd -a mdftp` 建好了 passdb 账号并 `-e` 启用。选 `mdftp` 是因为它主组就是 `docs`、和 FTP 上传走同一身份，省掉再加组。**密码在部署时自行设定（文档不留明文）**，仅用于这次联调，请你自己执行 `smbpasswd mdftp` 改掉。

**3. 服务与端口**

`systemctl enable --now smb nmb`，两个服务都已 enabled + active，139/445（含 IPv6）正常监听。



Windows 端直接 `\\192.168.7.130\share`，账号 `mdftp` + 你设定的密码即可；第一次连上后建议先传一个文件，看 `ll` 是否是 `-rw-rw-r-- ... docs`

## 12. 阶段九：git → GitHub Actions → Cloudflare Pages

前置：GitHub 仓库、Cloudflare 账号、Pages 项目。

1. **本机初始化并推送**

```bash
cd /srv/mkdocs/repo
git init -b main
git add -A && git commit -m "init: mkdocs site"
git remote add origin git@github.com:<user>/<repo>.git
git push -u origin main
```

2. **仓库内 workflow**（`.github/workflows/deploy-cloudflare.yml`）

```yaml
name: Build & Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r requirements.txt
      - run: mkdocs build --strict
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy ./site --project-name=${{ secrets.CLOUDFLARE_PROJECT_NAME }}
```

3. **三个 secret**：`CLOUDFLARE_API_TOKEN`（Pages:Edit）、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_PROJECT_NAME`。

4. **自动推送（可选）**：不想手敲 git 就用 `git-sync-loop.sh`——定时 `add/commit/push`，配合 deploy key（`config/ssh/` 下的只读私钥挂进容器）。

!!! tip "构建失败先看 strict"
    CI 用 `--strict`：任何断链、缺图都会让 Action 红。本地先跑同一条命令，能省一轮来回。

## 13. 日常运维速查

| 需求 | 命令 |
| --- | --- |
| 看服务状态 | `systemctl status mkdocs-serve ftp-share --no-pager` |
| 重启站点 | `systemctl restart mkdocs-serve` |
| 实时日志 | `journalctl -u mkdocs-serve -f` |
| 改 FTP 密码 | `sudo sed -i 's\|^FTP_PASS=.*\|FTP_PASS=新密码\|' /etc/ftp-share.env && sudo systemctl restart ftp-share` |
| 手动构建检查 | `cd /srv/mkdocs/repo && ../.venv/bin/python -m mkdocs build --strict` |
| 新增文档 | FTP 传 md 到 `docs/`，等 5-10 秒刷新首页 |
| 备份 | `tar czf /backup/docs-$(date +%F).tar.gz -C /srv/mkdocs/repo docs mkdocs.yml hooks` |
| 安全评分 | `systemd-analyze security mkdocs-serve ftp-share` |

## 14. 故障排查总表

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `build --strict` 报 `not found among documentation files` | 图片不在 `docs_dir` 内 | 移到 `docs/images/`，正文写 `images/x.png` |
| `The "awesome-pages" plugin is not installed` | 装插件后没重启 serve | `systemctl restart mkdocs-serve` |
| 侧栏为空/重复 | 同时写了 `nav` 和 awesome-pages | 删掉 `nav` |
| 站点 502/无响应 | 单元启动失败 | `journalctl -u mkdocs-serve -n 40` |
| 端口被占 | 旧进程或改了端口 | `ss -lntp \| grep :8000` |
| FTP 能登录但列不出目录 | 被动模式地址/端口不对 | 设 `FTP_MASQUERADE` 为本机局域网 IP，放行 21200-21210 |
| FTP 上传后站点没变 | 文件不在 `docs/`，或不是 `.md` | 传进 `docs/`，确认后缀 |
| FTP 写入 permission denied | 目录丢了 setgid | `chgrp -R docs repo && find repo -type d -exec chmod 2775 {} +` |
| 中文名乱码 | 客户端编码 | 服务端已设 `encoding="utf8"`；用 FileZilla 复核 |
| `550 SIZE not allowed in ASCII mode` | 客户端未发 `TYPE I` | ftplib 脚本先 `voidcmd("TYPE I")`，资源管理器无影响 |
| Actions 红 | strict 构建失败或缺 secret | 本地跑同命令；检查三个 secret 名 |
| Cloudflare 404 | 项目名/分支不匹配 | 核对 `CLOUDFLARE_PROJECT_NAME` 与 Pages 生产分支 |

## 15. 已知限制与后续

- **FTP 明文**：仅限内网。要加密就上 FTPS（pyftpdlib `TLS_FTPHandler` + 自签证书）或改用 SFTP。
- **Material 9.8.x EOL 提示**：2027-05-05 后需迁移 Zensical 或换主题，构建暂不受影响。
- **`serve` 是开发服务器**：小团队内网够用；对外高并发应 `build` 后交给 Nginx 静态托管。
- **首页表格是全量列表**：文档过千条时建议 hook 里加分页或只列目录级索引。
- **单机无高可用**：需要多副本就把 repo 放进 git，任意机器 clone + 一键脚本即可重建。
