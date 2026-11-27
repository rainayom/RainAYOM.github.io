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

## 16. 阶段十：Samba 共享（Windows 直连 docs 目录）

### 16.1 权限模型

目标：仓库目录由 `mkdocs` 写、`docs` 组共享，Windows 端用 `mdftp` 账号直接拖文件进来，落地后必须满足「文件 664、目录 2775、属组 docs」，这样 mkdocs 构建才不会被权限挡住。

| 层级 | 归属 | 权限 |
| --- | --- | --- |
| `/srv/mkdocs/repo/docs` | `mkdocs:docs` | `2775`（setgid） |
| 新建子目录 | 继承 | `2775` |
| 新建文件 | 继承 | `0664` |

### 16.2 smb.conf 片段

```ini
[share]
   comment = Linux SMB share
   path = /srv/mkdocs/repo/docs/
   browseable = yes
   read only = no
   valid users = @docs
   write list = @docs
   force group = docs
   create mask = 0664
   directory mask = 2775
```

三个容易踩的点：

1. `browsable` 是拼写错误，Samba 只认 `browseable`。
2. 模板里的 `valid users = your_username` 是占位符，必须换成真实账号或 `@组`，否则 `pdbedit -L` 为空时一律 `NT_STATUS_LOGON_FAILURE`。
3. 不要用 `inherit permissions = yes`：源文件带属主可执行位时，落地会变成 `-rwxrw-r--`；显式掩码才稳。

### 16.3 账号

```bash
groupadd -f docs
usermod -aG docs mkdocs
smbpasswd -a mdftp        # 口令自行设定，不要写进任何文档
smbpasswd -e mdftp
pdbedit -L                # 确认 passdb 里能列出账号
```

### 16.4 启停与端口

```bash
systemctl enable --now smb nmb
systemctl status smb --no-pager | head -5
ss -lntp | grep -E ':445|:139'
```

本机 SELinux 为 Disabled、firewalld 未启用（启用会挡 SSH），因此不需要额外放行；若开了 firewalld，需 `firewall-cmd --permanent --add-service=samba && firewall-cmd --reload`。

### 16.5 端到端验证

```bash
smbclient //127.0.0.1/share -U mdftp%'口令' -c 'mkdir t1; mkdir t1/t2; put docs/guide.md t1/g.md; ls t1'
# 期望：t1、t1/t2 为 2775，t1/g.md 为 664，属主 mdftp:docs
rm -rf /srv/mkdocs/repo/docs/t1
```

### 16.6 Windows 访问

1. 资源管理器地址栏输入 `\\192.168.7.130\share`。
2. 账号填 `mdftp`，口令填你设的那个；首次会提示“不安全连接”，选允许。
3. 直接拖拽 `.md` 到对应子目录，刷新 `http://192.168.7.130:8000/` 即可看到热重载。
4. 需要盘符时：`net use Z: \\192.168.7.130\share /user:mdftp 口令`。
5. 传完确认编码：Windows 记事本可能写成 GBK 或 CRLF，务必存 UTF-8（LF）。

## 17. 阶段十一：Git → 部署密钥 → 推送 GitHub

### 17.1 为什么走 SSH 而不是 HTTPS

实测该主机访问 `https://github.com` 与 `git info/refs` 全部超时（curl 000/28），但 22 端口可达、`ssh -T git@github.com` 能建连。因此推送统一走 SSH + **Deploy Key**：只授予单个仓库的写权限，比个人 PAT 的权限面小得多。

### 17.2 仓库初始化

```bash
cd /srv/mkdocs/repo
git init -b main
git config user.name  mkdocs
git config user.email mkdocs@vm7.130
printf 'site/\n.venv/\n__pycache__/\n*.pyc\n*.bak*\n*.swp\n' >> .gitignore
git add -A && git commit -m "初始化：Material 主题 + 亮暗自动 + 标签"
```

仓库属主必须是 `mkdocs`，用 root 直接执行 git 会报“可疑的仓库所有权（dubious ownership）”，统一这样跑：

```bash
G="runuser -u mkdocs -- env HOME=/var/lib/mkdocs git -C /srv/mkdocs/repo"
```

### 17.3 生成部署密钥

```bash
ssh-keygen -t ed25519 -f /root/.ssh/github_deploy -N "" -C "mkdocs@$(hostname) mike deploy"
cat /root/.ssh/github_deploy.pub
```

### 17.4 GitHub 侧添加

Settings → Deploy keys → Add deploy key：

- Title：`vm7.130-mike-push`
- Key：粘贴上面的 `.pub` 全文
- **勾选 Allow write access**（mike 要推 `gh-pages`，只读不够）

> 删库重建后同一把密钥会报 `Key is already in use`，直接重新 `ssh-keygen` 生成一把新的即可。

### 17.5 VM 侧 SSH 配置

mike 以 `mkdocs` 用户运行，所以密钥与 config 都要放到 `mkdocs` 能读的位置：

```bash
install -d -m 700 -o mkdocs -g docs /var/lib/mkdocs/.ssh
install -m 600 -o mkdocs -g docs /root/.ssh/github_deploy /var/lib/mkdocs/.ssh/github_deploy
cat > /var/lib/mkdocs/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF
chown mkdocs:docs /var/lib/mkdocs/.ssh/config
chmod 600 /var/lib/mkdocs/.ssh/config
runuser -u mkdocs -- env HOME=/var/lib/mkdocs ssh -T git@github.com
# 期望输出：Hi <user>/<repo>! You've successfully authenticated...
```

### 17.6 关联 remote 与推送

```bash
$G remote add origin git@github.com:rainayom/RainAYOM.github.io.git
$G push -u origin main
$G push origin gh-pages
```

分支模型：

| 分支 | 内容 | 谁用 |
| --- | --- | --- |
| `main` | 源码：`mkdocs.yml`、`docs/`、`hooks/`、`deploy.sh` | 你编辑 |
| `gh-pages` | mike 生成的静态站点 | GitHub Pages 只读它 |

### 17.7 mike 的两个必要设置

```yaml
plugins:
  - mike:
      version_selector: true
      alias_type: redirect
```

- 只写 `extra.version.provider: mike` 不会出下拉框，Material 模板判断的是 `config.plugins.mike`。
- `alias_type` 默认 `symlink`，GitHub Pages 不解析符号链接，必须改 `redirect`。

部署命令固定带环境变量（否则找不到 mkdocs / HOME 不对）：

```bash
runuser -u mkdocs -- env PATH=/srv/mkdocs/.venv/bin:/usr/local/bin:/usr/bin:/bin HOME=/var/lib/mkdocs \
  /srv/mkdocs/.venv/bin/mike deploy --update-aliases 1.0 latest
runuser -u mkdocs -- env PATH=/srv/mkdocs/.venv/bin:/usr/local/bin:/usr/bin:/bin HOME=/var/lib/mkdocs \
  /srv/mkdocs/.venv/bin/mike set-default latest
```

### 17.8 明文口令进过历史怎么办

只删文件不够：`git log -S '<口令>'` 还能翻出旧提交，强推后 GitHub 仍可能按 SHA 返回游离对象（实测旧提交 API 仍是 200，只有删除重建后才变 422）。彻底清除的可靠做法是**删库重建 + 重新推送**，并在清完后立刻更换真实口令（`smbpasswd`），因为历史清干净不等于口令失效。

## 18. 阶段十二：GitHub Pages 与 Release

### 18.1 Pages 配置

Settings → Pages → Source 选 **Deploy from a branch** → Branch `gh-pages` → 目录 `/ (root)` → Save。新建的空库默认挂在 `main`，必须手动改成 `gh-pages`，否则 Pages 会把源码当 Jekyll 站点渲染。

### 18.2 访问验收

| 地址 | 期望 |
| --- | --- |
| `https://rainayom.github.io/` | 200，1 秒后跳 `latest/` |
| `/latest/` | 200，再跳 `/1.0/` |
| `/1.0/` | 200，`<title>运维知识库</title>` |
| `/1.0/tags/` | 200（标签索引） |
| `/versions.json` | 200，版本选择器数据源 |

### 18.3 打 Release

```bash
$G tag -a v1.0.0 -m "运维知识库 v1.0.0"
$G push origin v1.0.0
$G archive --format=tar.gz --prefix=mkdocs-ops-docs-1.0.0/ -o /tmp/mkdocs-ops-docs-1.0.0.tar.gz v1.0.0
```

再到 GitHub → Releases → Draft a new release，选 tag `v1.0.0`，上传该 tar.gz 作为源码包。

## 19. 阶段十三：自动/定时推送

### 19.1 三种做法对比

| 方案 | 触发方式 | 延迟 | 适用 |
| --- | --- | --- | --- |
| systemd timer（本文采用） | 定时轮询 `git status` | 最长 5 分钟 | 无人值守的小型文档站，零外部依赖 |
| systemd path unit（inotify） | 文件一变立刻触发 | 秒级 | 想即时生效，但一次编辑可能触发多次构建 |
| GitHub Actions | push 后云端构建再部署 | 云端 1～2 分钟 | 多人协作；需把 Pages 源改成 GitHub Actions |

注意：本机到 `github.com` 的 HTTPS 被墙，Actions 的 `checkout` 反而跑不通；而且 Pages 现在是「branch 模式」，推送 `gh-pages` 后 GitHub 自己会构建，不需要再上一套 Actions。

### 19.2 生效链路

```text
docs/*.md 改动
   └─ mkdocs-autopush.service（每 5 分钟）
        ├─ git add -A + commit
        ├─ git push origin main          # 源码留痕
        └─ mike deploy 1.0 latest
             ├─ 重建 site/ 并写入 gh-pages
             └─ git push origin gh-pages
                  └─ GitHub Pages 收到 gh-pages 更新，约 1 分钟重建
                       └─ https://rainayom.github.io/ 生效
```

### 19.3 脚本与单元

`/srv/mkdocs/repo/autopush.sh`（关键点）：

- `flock -n 9` 单实例，定时器与手工触发不会撞车；
- 先看 `git status --porcelain`，没有改动就不 commit，避免空提交；
- 再比 `origin/main..main` 的提交数，只有领先才 push；
- 最后固定跑 `mike deploy --update-aliases 1.0 latest` + `set-default` + `push gh-pages`；
- 全部以 `mkdocs` 身份执行（`User=mkdocs`、`HOME=/var/lib/mkdocs`），否则 git 会报可疑所有权。

`/etc/systemd/system/mkdocs-autopush.service`：

```ini
[Service]
Type=oneshot
User=mkdocs
Group=docs
WorkingDirectory=/srv/mkdocs/repo
Environment=HOME=/var/lib/mkdocs
Environment=PATH=/srv/mkdocs/.venv/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/srv/mkdocs/repo/autopush.sh
TimeoutStartSec=300
```

`/etc/systemd/system/mkdocs-autopush.timer`：

```ini
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
AccuracySec=30s
Unit=mkdocs-autopush.service
```

### 19.4 启用与验收

```bash
install -m 755 -o mkdocs -g docs autopush.sh /srv/mkdocs/repo/autopush.sh
install -m 644 mkdocs-autopush.service /etc/systemd/system/
install -m 644 mkdocs-autopush.timer   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now mkdocs-autopush.timer

systemctl list-timers mkdocs-autopush.timer --no-pager   # 看下次触发时间
systemctl start mkdocs-autopush.service                  # 立即同步一次
journalctl -u mkdocs-autopush.service -n 20 --no-pager    # 看本次日志
```

验收标准：`journalctl` 出现「推送 gh-pages / 完成」；`git log --oneline -1` 有 `auto:` 开头的提交；等 1 分钟后刷新站点能看到新内容。

### 19.5 想更快就换事件驱动

把定时器换成 path unit，文件一改就推（示例）：

```ini
# /etc/systemd/system/mkdocs-autopush.path
[Path]
PathModified=/srv/mkdocs/repo/docs
Unit=mkdocs-autopush.service

[Install]
WantedBy=paths.target
```

代价：保存一次文档会连触发多次构建，建议在脚本里加 `sleep 5` 做去抖。多数场景 5 分钟轮询已经够用。

### 19.6 常见故障

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 定时器到点但没提交 | 脚本没执行权限 / 单元里 User 不对 | `ls -l autopush.sh`、`journalctl -u mkdocs-autopush` |
| `dubious ownership` | 用 root 跑了 git | 单元必须 `User=mkdocs`，别手工 sudo 跑 |
| 推 `gh-pages` 报权限拒绝 | 部署密钥没勾写权限 | Deploy key 上补勾 Allow write access |
| 站点没变化 | Pages 还在构建 / 缓存 | 看 Actions 里 pages build，等 1～2 分钟再刷 |
| 提交里混进垃圾文件 | `.gitignore` 不全 | 补 `*.bak*`、`*.swp`、`site/`、`.venv/` |

---

## 20. 阶段十四：右侧目录缺失修复 + 新文档自动打标签

### 20.1 现象

`http://192.168.7.130:8000/Linux基础教程/` 下的 12 篇 md 全部能打开，但**右侧目录栏永远空白**；同时这批文档不出现在 `/tags/` 标签页。

### 20.2 根因

Material 的目录模板 `partials/toc.html` 有这样一段：

```jinja
{% set toc = page.toc %}
{% set first = toc | first %}
{% if first and first.level == 1 %}
  {% set toc = first.children %}
{% endif %}
```

即：**如果正文第一个标题是 H1，右侧目录只显示它的下级标题**。

而这批文档是 Typora/语雀导出的，结构是「一个文章标题 H1 + 若干同级 `# 一、xxx` H1」，等于第一个 H1 下面什么都没有 → `first.children` 为空 → 目录标签渲染出来但里面没有条目。

另一种情况是文件里只有 1 个 H1、完全没有 H2，那也是空目录（`0、linux文档目录摘要.md` 就属于这种，属正常）。

源码里还能看到两处 Typora 痕迹：行尾是 CRLF、正文有一行字面 `[TOC]`（MkDocs 的 toc 扩展会把它替换成内嵌目录，所以不报错，但位置和右侧目录重复）。

### 20.3 处理办法

规矩只有一条：**一篇文档只能有一个 H1（页面标题），其余标题按层级往下排**。

仓库里放了两个不改内容语义的脚本：

| 脚本 | 作用 | 用法 |
| --- | --- | --- |
| `tools/fix_headings.py` | 第一个 H1 保留，其余标题统一降一级（H1→H2、H2→H3…最深 H6）；顺带 CRLF→LF；跳过 front matter 与代码块里的 `#` | `python3 tools/fix_headings.py docs/Linux基础教程` |
| `tools/autotag.py` | 没有 `tags` 的文档自动补 front matter，标签取文档所在的一级目录名（根目录文档记「通用」）；幂等，`docs/tags.md` 跳过 | `python3 tools/autotag.py docs` |

两个脚本都支持 `--dry-run` 先看要改哪些文件：

```bash
cd /srv/mkdocs/repo
runuser -u mkdocs -- /srv/mkdocs/.venv/bin/python tools/fix_headings.py docs/Linux基础教程 --dry-run
```

实测这批文档 12 篇里 11 篇需要降级（`8、Linux系统用户与组管理.md` 最多，28 处；`/etc/shadow` 配置块里的 `#` 注释因为在代码块内，原样保留）。

执行完的效果：

```text
# Linux系统基础设置与命令行      <- 页面标题，唯一 H1
## 一、系统基本操作              <- 右侧目录第一层
### 1、登录界面
### 2、桌面
```

### 20.4 让标签自动跟上

`autopush.sh` 在每次同步前会先跑一遍 `autotag.py`：

```bash
# 0) 新文档自动补标签（幂等：已带 tags 的文件不动，无新文件时几毫秒返回）
if [[ -x "$VENV/bin/python" && -f "$ROOT/tools/autotag.py" ]]; then
  if ! "$VENV/bin/python" "$ROOT/tools/autotag.py" "$ROOT/docs" >/tmp/autotag.log 2>&1; then
    log "autotag 执行失败，详见 /tmp/autotag.log"
  elif grep -q '新增标签 0 个' /tmp/autotag.log; then
    log "标签无需补全"
  else
    log "已为新文档补标签：$(grep -c '^\[tag\]' /tmp/autotag.log) 个"
  fi
fi
```

所以往 `docs/Linux基础教程/` 里再丢一篇 md，5 分钟内会自动：补 `tags: Linux基础教程` → 提交 main → `mike deploy 1.0 latest` → 推 gh-pages → Pages 更新，标签页与版本站同时刷新。

### 20.5 权限要点

通过 SMB 上传的文件属主是 Samba 账号（`mdftp`），但目录里若混有 root 属主文件，`mkdocs` 身份构建时可能读不动、后续也无法由 mkdocs 改写。统一归位：

```bash
D=/srv/mkdocs/repo/docs/Linux基础教程
chown -R mkdocs:docs "$D"
find "$D" -type d -exec chmod 2775 {} +
find "$D" -type f -exec chmod 0664 {} +
```

### 20.6 验收

| 检查点 | 命令 | 期望 |
| --- | --- | --- |
| 右侧目录有条目 | 打开页面，右侧栏 | 出现「一、系统基本操作 / 1、登录界面…」 |
| 构建产物里有 TOC | `grep -c 'data-md-component="toc"' site/Linux基础教程/*/index.html` | 各页 ≥1 |
| 标签收录 | 打开 `/tags/` | 出现「Linux基础教程」，链接 12 篇 |
| 版本站同步 | `https://rainayom.github.io/1.0/Linux%E5%9F%BA%E7%A1%80%E6%95%99%E7%A8%8B/` | 页面正常、目录可见 |

已实测：`4、Linux系统基础设置与命令行` 右侧目录 11 条、`8、Linux系统用户与组管理` 4 条（其余是代码块内的注释，本来就不该进目录）。

### 20.7 常见故障

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 目录还是空 | 该页只有一个 H1 | 补 H2 小节，或接受空目录 |
| 目录层级过深 | 标题层级本来就 4～5 层 | `mkdocs.yml` 加 `toc_depth: 2-3` 截断 |
| 标签页没有新目录 | 没跑 autotag / 文档已有 tags 但混写 | 手工跑 `tools/autotag.py docs` 看输出 |
| `tools/*.py` 报 Permission denied | 属主是 root | `chown mkdocs:docs tools/*.py` |

### 20.8 目录首页（章节索引）

`/Linux基础教程/` 原来直接 404，因为该目录没有 `index.md`。现在：

1. `hooks/index_listing.py` 新增标记 `<!-- SECTION-LIST -->`：在**任意目录的 `index.md`** 里写这个标记，构建时自动列出该目录（含子目录）下所有 md，带标题与相对链接；
2. `docs/Linux基础教程/index.md` 用了这个标记，正文只写一句简介 + `## 文档列表`。

```markdown
---
tags:
  - Linux基础教程
---

# Linux 基础教程

本目录是从 Linux 入门到日常运维的系统化笔记，按章节顺序阅读即可。

## 文档列表

<!-- SECTION-LIST -->
```

再往这个目录丢新 md，标题会自动出现在列表里，`tags` 也会由 `tools/autotag.py` 补；两件事都在 autopush 一次循环内完成。

---

## 21. 阶段十五：返回顶部按钮

Material 本身没有「返回顶部」，用一份 CSS + 一份原生 JS 补上，不改主题模板。

### 21.1 文件

| 文件 | 作用 |
| --- | --- |
| `docs/stylesheets/back-to-top.css` | 右下角白色胶囊样式，跟随亮/暗主题配色 |
| `docs/javascripts/back-to-top.js` | 滚动 400px 后淡入，点击平滑回顶，支持 `prefers-reduced-motion` |

### 21.2 挂进配置

```yaml
extra_css:
  - stylesheets/back-to-top.css
extra_javascript:
  - javascripts/back-to-top.js
```

注意这两个 key 是**顶层**配置，不能缩进到 `extra:` 下面——`extra.version` 管的是 mike 版本选择器，两者互不相干。

### 21.3 交互细节

- 按钮由 JS 动态插入 `<body>`，`.md-content` 内部的任何页面（含 tags 页、章节首页）都生效，不用逐页改 md；
- 显示阈值 400px，用 `requestAnimationFrame` 节流，避免滚动时掉帧；
- 点击后 `window.scrollTo({ top: 0, behavior: 'smooth' })`，系统开了「减少动效」则直接跳；
- 暗色模式用 `var(--md-default-bg-color)` 跟随主题，避免白底刺眼；
- 宽度小于 `76.1875em` 时自动缩小并贴近边缘，不挡正文；
- `@media print` 下隐藏，打印不出现按钮。

### 21.4 验收

```bash
grep -o 'stylesheets/back-to-top.css\|javascripts/back-to-top.js' site/index.html
```

两行都能命中即为注入成功；浏览器里把页面往下滚，右下角出现胶囊按钮，点一下回到顶部。

---

## 22. 阶段十六：浏览器里的 Markdown 编辑器（md-editor-v3）

### 22.1 为什么这么做

站点要能"边写边看"，但文档放在服务器上，有两种做法：

1. 给本机开一个仓库根目录的 SMB 共享，用本地编辑器打开 —— **没有采用**，等于把 `mkdocs.yml`、`.venv`、`.git` 全暴露到网络；
2. 把编辑器跑在服务器上，浏览器访问 —— **采用**。前端用 [md-editor-v3](https://github.com/imzbf/md-editor-v3)，后端用 Python 标准库写的零依赖小服务，只暴露 `docs/` 下的 `.md`。

### 22.2 组成

| 组件 | 路径 | 说明 |
| --- | --- | --- |
| 前端源码 | `/srv/mkdocs/editor-app` | Vue 3 + md-editor-v3，`npm run build` 产出 `dist/` |
| 后端 | `/srv/mkdocs/editor_server.py` | 标准库 `http.server`，无第三方依赖 |
| 服务单元 | `/etc/systemd/system/mkdocs-editor.service` | `User=mkdocs`、端口 8080 |
| 站点按钮 | `docs/javascripts/edit-page.js`、`docs/stylesheets/edit-page.css` | 右下角「编辑本页」胶囊 |

### 22.3 按钮与「返回顶部」的排布

两个按钮同一套胶囊样式，靠 `bottom` 错开，不重叠：

```css
.back-to-top { right: 1.4rem; bottom: 1.6rem; }   /* 返回顶部 */
.edit-page   { right: 1.4rem; bottom: 4.35rem; }  /* 编辑本页，位于其上方 */
```

实测位置（视口 518px 高时）：编辑本页底边 441px、返回顶部顶边 473px，中间留 32px 间隙。

按钮只在局域网里出现，公网 Pages 上自动隐藏：

```js
var EDIT_HOSTS = ["192.168.7.130", "localhost", "127.0.0.1"];
if (EDIT_HOSTS.indexOf(location.hostname) === -1) return;
```

点击后跳到 `http://192.168.7.130:8080/?url=<当前页面路径>`，后端按 URL 反查源文件（会依次尝试去掉版本前缀、补 `/index.md`、补 `.md`），所以 mike 的 `/1.0/xxx/`、`/latest/xxx/`、本地 `:8000/xxx/` 都能定位到同一篇 md。

### 22.4 后端接口

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/api/session` | 查询是否已登录 |
| POST | `/api/login` | `{"password": "..."}`，成功种 30 天 HttpOnly Cookie |
| GET | `/api/list` | 列出 docs 下全部 md（标题 + 相对路径） |
| GET | `/api/doc?path=xxx.md` | 读单篇内容 |
| GET | `/api/resolve?url=/1.0/xxx/` | 站点 URL 反查源文件 |
| POST | `/api/doc` | `{"path": "...", "content": "..."}` 保存 |

安全边界都在 `safe_doc()` 里：`normpath` 之后必须仍在 `docs/` 内、后缀必须 `.md`，穿越和写非 md 一律 400；`\r\n` 统一转 `\n`；写回后 `chmod 0664`（root 运行时顺带 chown 到 mkdocs:docs），保证 Samba 侧仍能读写。

### 22.5 使用

1. 站点页面右下角点「编辑本页」→ 新标签页打开编辑器，自动带出当前文档；
2. 首次进入要登录：账号 `mdftp`，口令 `MdEditor@2026`（Cookie 会话 30 天，之后不再问）；
3. 左边编辑、右边 Markdown 实时预览，随输入更新；`Ctrl+S` 或右上「保存」写回服务器；
4. 保存后 `mkdocs serve`（:8000）自动重建，刷新即可看到站点效果；
5. 5 分钟内 `mkdocs-autopush.timer` 会把改动 commit、`mike deploy` 并推到 gh-pages，GitHub Pages 同步更新。

### 22.6 服务管理

```bash
systemctl status mkdocs-editor
journalctl -u mkdocs-editor -f

# 改了前端源码后重新构建
cd /srv/mkdocs/editor-app
runuser -u mkdocs -- env HOME=/var/lib/mkdocs PATH=/usr/bin:/bin npm run build
systemctl restart mkdocs-editor
```

改口令：编辑单元里的 `Environment=EDITOR_PASS=...`，`systemctl daemon-reload && systemctl restart mkdocs-editor`，旧 Cookie 立刻失效（Cookie 值由账号口令哈希派生）。

### 22.7 验收

| 检查 | 命令 / 操作 | 期望 |
| --- | --- | --- |
| 端口 | `ss -lntp \| grep 8080` | python3 监听 0.0.0.0:8080 |
| 登录接口 | `curl -s -X POST -d '{"password":"MdEditor@2026"}' http://127.0.0.1:8080/api/login` | `{"ok": true}` |
| 未登录拦截 | `curl -s http://127.0.0.1:8080/api/session` | `{"auth": false}` |
| 保存 | 页面点「保存」 | 顶部出现「已保存 HH:MM:SS · N 字节」 |
| 站点按钮 | 打开任意页 | 右下角「编辑本页」在「返回顶部」上方 |
| 公网站点 | 打开 `https://rainayom.github.io/` | 不出现「编辑本页」 |

### 22.8 常见故障

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 打开 8080 白屏 | `dist/` 不存在 | 进 `editor-app` 跑 `npm run build` |
| 点保存提示需要登录 | Cookie 过期或换了口令 | 重新输入口令登录 |
| 保存成功但站点没变 | mkdocs serve 未 watch 到 | `systemctl restart mkdocs-serve` |
| 打开某篇报"没有匹配到源文件" | 该页不在 docs（如标签页） | 用左上文档下拉选择 |
| 端口被占 | 8080 有其他服务 | 改单元里的 `EDITOR_PORT` 并同步 `edit-page.js` |
## 23. 协作化编辑：页脚导航、GitHub 登录、个人中心与提交审核

本章记录在既有站点与网页编辑器之上，叠加「读的人能切换文档、登录的人能改文档、拥有者能拍板」的一层协作能力。

### 23.1 页脚「上一篇 / 下一篇」

Material 主题自带开关，只在 `mkdocs.yml` 的 `theme.features` 里加一行：

```yaml
theme:
  features:
    - navigation.footer      # 页脚出现上一篇 / 下一篇
```

顺序按 `nav`（含 hooks 自动生成的章节首页）走，不需要手写任何模板。

### 23.2 用 GitHub 登录（OAuth Device Flow）

选设备码流程的原因：不需要后端保存 client secret，也不需要在 Pages 上跑服务，浏览器直连 `github.com` 即可（`login/device/code` 与 `login/oauth/access_token` 两个接口都允许跨域）。

1. 在 GitHub 建 OAuth App：`Settings → Developer settings → OAuth Apps → New OAuth App`
   - Application name：`运维知识库编辑器`
   - Homepage URL：`https://rainayom.github.io/`
   - Redirect URI：`https://rainayom.github.io/`（设备码流程用不到，但字段必填）
   - **勾选 Enable Device Flow**（不勾会直接报 `device_flow_disabled`）
2. 记下 `Client ID`（本项目为 `Ov23liZFcmfLX6wLHrmi`），写进两处前端常量。
3. 登录时序：

```text
浏览器 → POST https://github.com/login/device/code   {client_id, scope}
       ← {device_code, user_code, verification_uri, interval}
用户  → 打开 https://github.com/login/device 输入 user_code 并 Authorize
浏览器 → GET(轮询) https://github.com/login/oauth/access_token {client_id, device_code}
       ← {access_token}
```

注意几个实测坑：

- **授权时必须过一次 sudo 密码**：GitHub 在 Authorize 页会弹 `Confirm access`，要求输入账号密码；跳过或超时会返回 `access_denied`，此时轮询拿到的是 `error: access_denied`，不是网络问题。
- 轮询偶发 `Failed to fetch`（网络抖动/浏览器限流），代码里对单次请求异常做了 `continue`，不中断整个轮询。
- 设备码有效期 15 分钟，`interval` 默认 5 秒，`slow_down` 时要把间隔加 5 秒。

- **内网 HTTP 页面复制不了设备码**：`navigator.clipboard` 只在安全上下文（HTTPS / localhost）可用，`http://192.168.7.130:8000` 下会直接报「复制失败」。现在改成 `clipboard` 优先、`document.execCommand("copy")` 兜底，两者都失败时把代码整段选中并提示 `Ctrl+C`；弹窗打开时已经自动选中，直接按 `Ctrl+C` 也能复制。

### 23.3 页眉右上角个人中心

`docs/javascripts/github-hub.js` 在 `.md-header__inner` 尾部插一个胶囊（未登录显示 `GitHub 登录`，登录后显示头像 + 用户名），点开是下拉面板：

| 区块 | 数据来源 | 说明 |
| --- | --- | --- |
| 身份 | `GET /api.github.com/user` + `GET /repos/{owner}/{repo}` | 显示 `仓库拥有者 · 可直接提交` 或 `贡献者 · 提交需审核` |
| 我的收藏 | `localStorage["mdgh.fav.<login>"]` | 键按登录名隔离，每人一份；收藏当前页路径 + 标题，支持点击跳转、✕ 取消 |
| 我的提交 | `GET /api.github.com/search/issues?q=repo:...+is:pr+author:<login>` | `state=open` → 提交审核中；`merged_at` 非空 → 审核通过；`closed` 未合并 → 已关闭 |

退出登录只清 localStorage 里的 token 与身份缓存。

样式在 `docs/stylesheets/github-hub.css`，跟随主题色变量（`--md-default-bg-color`、`--md-primary-fg-color`），暗色模式不用单独写；窄屏（≤60em）只留头像圆点。

### 23.4 编辑入口与权限分流

「编辑本页」按钮现在有两个门槛，缺一不显示：

1. 访问地址是局域网（`192.168.7.130 / localhost / 127.0.0.1`），因为编辑器是内网服务；
2. 已用 GitHub 登录（`window.MDGitHub.token` 存在），登录后按钮自动出现、退出后自动消失。

点击后跳 `http://<host>:8080/?url=<页面路径>#t=<token>`，token 放 hash 里（不进服务端日志、不参与 Referer），编辑器读到后写进自己的 localStorage 并立刻抹掉 hash。

保存分两条路：

| 身份 | 按钮文案 | 动作 | 结果 |
| --- | --- | --- | --- |
| 仓库拥有者 / 有 push 权限的协作者 | 保存 | `POST /api/doc` 直接写服务器文件 | `已保存 HH:MM:SS · N 字节`，5 分钟内随 autopush 提交并发版 |
| 其他 GitHub 用户 | 提交审核 | fork → 建分支 → 提交文件 → `POST /repos/.../pulls` | `已提交审核 PR #N`，附 PR 链接；拥有者合并后自动发版 |

非拥有者的分支命名为 `edit/<文件名净化>-<base36 时间戳>`，PR 标题 `docs: 更新 <path>`，正文标明提交人和文件路径。

### 23.5 后端鉴权（editor_server.py v2）

```text
Authorization: Bearer <github_token>   ← 前端带，后端拿它去 api.github.com/user 换身份
身份缓存 5 分钟，避免每次保存都打 API
```

| 接口 | 方法 | 权限 |
| --- | --- | --- |
| `/api/session`、`/api/me` | GET | 无 token 返回 `{auth:false, need_login:true}` |
| `/api/list`、`/api/doc`、`/api/resolve` | GET | 任意已登录 GitHub 用户 |
| `/api/doc` | POST | 仅拥有者/协作者；其他人返回 `403 {mode:"pr"}` |

写文件仍然走 `safe_doc()`：`normpath` 规范化 + 必须在 `docs/` 下 + 只允许 `.md`，换行统一 LF，写后 `chmod 0664`。

服务单元新增 `Environment=REPO_OWNER=rainayom`、`Environment=REPO_NAME=RainAYOM.github.io`；原来的 `EDITOR_USER/EDITOR_PASS` 口令登录已移除。

### 23.6 与自动发布的关系

PR 合并、网页直改都会让 GitHub 上的 `main` 领先服务器本地仓库，所以 `autopush.sh` 在推送前增加一步：

```bash
git fetch -q origin main
behind=$(git rev-list --count main..origin/main)
[[ $behind -gt 0 ]] && git pull -q --rebase origin main
```

rebase 冲突时脚本记录日志并跳过本轮推送（不覆盖远端），等人工处理。

### 23.7 验收清单

```bash
# 1. 页脚导航
curl -s http://192.168.7.130:8000/ | grep -c md-footer__link       # ≥1

# 2. 登录接口（未带 token）
curl -s http://192.168.7.130:8080/api/session                       # {"auth": false, "need_login": true}
curl -s -o /dev/null -w '%{http_code}\n' http://192.168.7.130:8080/api/list   # 401

# 3. 带 token 换成身份
curl -s -H "Authorization: Bearer $T" http://192.168.7.130:8080/api/session

# 4. 旧口令登录已失效
curl -s -o /dev/null -w '%{http_code}\n' -X POST -d '{"password":"MdEditor@2026"}' \
  -H 'Content-Type: application/json' http://192.168.7.130:8080/api/login   # 404
```

浏览器侧：未登录时页面没有「编辑本页」；登录后出现；页眉头像点开能看到收藏与「我的提交」状态标签。

### 23.8 故障排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 登录报 `The authorization request was denied` | 授权页的 sudo 密码没填/超时，或点了 Cancel | 重新取码，走完 `Confirm access` → `Authorize` |
| 登录报 `Failed to fetch` | 轮询请求被网络/限流打断 | 已自动重试；仍失败就重开登录 |
| `device_flow_disabled` | OAuth App 没勾 Enable Device Flow | 在应用设置里补勾 |
| 非拥有者保存报「没有直接写入权限」 | 后端判定非 owner | 改用「提交审核」，等拥有者合并 |
| PR 已合并但站点没更新 | autopush 未跑或 rebase 冲突 | `journalctl -u mkdocs-autopush`，看 `/tmp/autopush.log` |
| 页眉没有登录胶囊 | JS 未加载或被缓存 | 强刷；确认 `extra_javascript` 里有 `javascripts/github-hub.js` |

## 24. 阶段十八：自建评论区（GitHub Discussions）与编辑器主题、工具栏

这一章做三件事：给每页加评论区、让「页眉登录」和「评论登录」合成一次、把网页编辑器修成单预览 + 全功能工具栏。

### 24.1 为什么最后没用 Giscus

Material 官方推荐 Giscus，先按官方文档接过一版，能跑通：装 giscus App、开 Discussions、`overrides/partials/comments.html` 里放脚本、随 palette 切明暗。但它有个绕不开的问题——**Giscus 有自己的 OAuth 会话**，用户点「使用 GitHub 登录」会在 iframe 里再走一遍 GitHub 授权，还会跳走再回来。站点页眉那套设备码登录拿到的 token 无法交给 Giscus 用。

要求是「登录一次，页眉和评论都能用，认证完回到原页面」，那就只能自建：评论读写走 GitHub Discussions 的 GraphQL 接口，鉴权直接用页眉的 `mdgh.token`。

### 24.2 数据模型

| 项 | 取值 |
| --- | --- |
| repo_id | `R_kgDOV9nhcA`（仓库 node id） |
| category_id | `DIC_kwDOV9nhcM4DMFBc`（Announcements） |
| 讨论标题 | `评论：<page.url>`，比如 `评论：guide/` |
| 讨论正文 | 记录对应页面地址，方便在 GitHub 里认领 |

页面 key 用 `page.url`（相对路径），不用 `location.pathname`——这样内网 IP 和 `rainayom.github.io` 共用同一串讨论，换域名不丢评论。每页第一次有人发言时才创建讨论，没人评论的页面不会产生空讨论。

### 24.3 三个文件

`overrides/partials/comments.html`（只留标题和占位容器，页面 key 塞进 data 属性）：

```html
{% if page.meta.comments %}
<h2 id="__comments">{{ lang.t("meta.comments") }}</h2>
<div id="mdgh-comments" data-page="{{ page.url }}" data-title="{{ page.title | e }}"></div>
{% endif %}
```

`docs/javascripts/comments.js`（渲染、查询、发表，约 300 行）：

```js
// 找讨论串
query($o:String!,$n:String!,$c:ID!){ repository(owner:$o,name:$n){
  discussions(first:100, categoryId:$c){ nodes { id title url } } } }

// 首次发言时创建
mutation($rid:ID!,$cid:ID!,$title:String!,$body:String!){
  createDiscussion(input:{repositoryId:$rid, categoryId:$cid, title:$title, body:$body}){
    discussion { id url } } }

// 发表评论
mutation($id:ID!,$body:String!){
  addDiscussionComment(input:{discussionId:$id, body:$body}){ comment { id } } }
```

`docs/stylesheets/comments.css`：卡片式列表、输入框、两个胶囊按钮，颜色全部走 `var(--md-*)` 变量，暗黑模式自动适配；底部留 8rem 空间避开「编辑本页 / 返回顶部」。

`mkdocs.yml` 里加载顺序很重要，`comments.js` 必须排在 `github-hub.js` 之后（要先有 `window.MDGitHub`）：

```yaml
extra_javascript:
  - javascripts/back-to-top.js
  - javascripts/github-hub.js?v=20261127c
  - javascripts/edit-page.js?v=20261127b
  - javascripts/comments.js?v=20261127e
```

### 24.4 一次登录是怎么串起来的

页眉脚本对外暴露了 `window.MDGitHub = { token, user, login, logout, onChange(fn) }`。评论区订阅 `onChange`，状态一变就重绘：

```js
window.MDGitHub.onChange(function (s) {
  apply(s && s.token, s && s.user);   // 有 token 就拉评论，没 token 就只显示登录按钮
});
```

三个细节缺一不可：

1. **页眉 init 完成后要主动 `emit()` 一次**，否则评论区在页面刚加载时读到的是空 token，会一直显示「用 GitHub 登录」。
2. 评论区自己在 900ms / 2600ms 各补一次同步，并在窗口 `focus` 时再同步，兜住脚本执行顺序的竞争。
3. 设备码登录不跳页面，`loginModal()` 打开前把 `mdgh.returnTo` 和 `mdgh.returnScroll` 记进 localStorage，登录成功后滚回原位置并把光标放进评论输入框——这就是「认证完回到登录前的页面」。

### 24.5 GraphQL 踩坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `Type mismatch on variable $c and argument categoryId (String! / ID)` | `categoryId` 参数类型是 `ID!`，不是 `String!` | 查询里写 `$c:ID!` |
| `Argument 'id' on InputObject 'DeleteDiscussionInput'` | 删讨论的入参字段叫 `id`，不是 `discussionId` | `deleteDiscussion(input:{id:$id})` |
| 普通用户点发表报权限错误 | `createDiscussion` 需要仓库写权限，只有拥有者/协作者能建串 | 让拥有者先在页面发一条，生成讨论串后其他人即可在串里评论 |

### 24.6 验收

```bash
curl -s http://192.168.7.130:8000/guide/ | grep -c 'id="mdgh-comments"'   # 1
curl -s http://192.168.7.130:8000/ | grep -c 'id="mdgh-comments"'         # 0（首页关掉了）
```

浏览器侧：未登录时评论框显示「用 GitHub 登录」；点页眉登录授权完成后，评论区自己变成「已登录 xxx + 发表评论」，不用再点第二次；发表后列表出现头像、昵称、「刚刚」和正文，右上角多一个「在 GitHub 查看 ↗」。

### 24.7 编辑器：一个预览 + 全功能工具栏

原来页面是「自建 MdPreview + MdEditor 内建预览」两套预览并排，看着像三个栏。改法：删掉外层 MdPreview，只用 `MdEditor` 自己那套分栏预览（`main` 里只剩一个 `MdEditor`）。

工具栏换成 md-editor-v3 的默认全集，与官方 demo 一致：

```js
const FULL_TOOLBARS = [
  'bold', 'underline', 'italic', 'strikeThrough', '-',
  'title', 'sub', 'sup', 'quote', 'unorderedList', 'orderedList', 'task', '-',
  'codeRow', 'code', 'link', 'image', 'table', 'mermaid', 'katex', '-',
  'revoke', 'next', 'save', '=', 'prettier', 'pageFullscreen', 'fullscreen',
  'preview', 'previewOnly', 'htmlPreview', 'catalog', 'github'
]
const FULL_FOOTERS = ['markdownTotal', '=', 'scrollSwitch']
```

含：加粗/下划线/斜体/删除线、标题、下标、上标、引用、无序与有序列表、任务列表、行内代码、块级代码、链接、图片、表格、mermaid、katex、撤回/重做、保存（绑 `onSave`，即写文件）、prettier 格式化、页面全屏/屏幕全屏、预览开关、仅预览、HTML 预览、目录、GitHub 链接；页脚是「字数 / 同步滚动」。

### 24.8 本轮故障表

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 编辑器出现两个预览 | 外层又放了一个 `MdPreview` | 删掉外层预览，只留 `MdEditor` 内建分栏 |
| 下拉菜单展开是空列表 | 模板 `v-for` 用了不存在的 `codeThemes` | 补 `const codeThemes = CODE_THEMES` |
| 菜单一展开就消失 | 给 `document` 加了「点外部关闭」，程序化点击会误触 | 去掉全局关闭，只在选中项/再次点按钮时收起 |
| 评论区一直显示「用 GitHub 登录」但页眉已登录 | 页眉 init 完成后没有 `emit()`，订阅者拿到的是初始空 token | `renderPanel()` 后补 `emit()`，评论区再加定时兜底同步 |
| `Type mismatch ... categoryId (String! / ID)` | GraphQL 变量类型写错 | 改成 `$c:ID!` |
