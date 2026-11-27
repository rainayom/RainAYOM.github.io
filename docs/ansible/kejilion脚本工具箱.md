---
tags:
  - 脚本
  - 工具箱
---

# kejilion脚本工具箱

[科技lion一键脚本 Linux服务器运维工具箱 监控管理建站一个脚本全搞定！ - 科技lion官方博客【国内版】](https://blog.kejilion.pro/kejilion-sh/)

```bash
安装基础组件
Debian/Ubuntu

apt update -y  && apt install -y curl

CentOS/RedHat/Fedora/AlmaLinux/Rocky Linux

yum update && yum install -y curl

Alpine Linux

apk update && apk add curl



运行脚本
bash <(curl -sL kejilion.sh)

或者
curl -sS -O https://raw.gitmirror.com/kejilion/sh/main/cn/kejilion.sh && chmod +x kejilion.sh && ./kejilion.sh
```

批量安装

```bash
我有三台服务器，（debian安装pssh老是报错，所以我用centos7来安装pssh作为服务端）
A：debian12 192.168.227.142
B：centos7 192.168.227.140
C：centos7 192.168.227.148
首先在B服务器做免密登录
ssh-keygen -t rsa
ssh-copy-id -i ~/.ssh/id_rsa.pub root@192.168.227.142
ssh-copy-id -i ~/.ssh/id_rsa.pub root@192.168.227.148

然后下载pssh自动化工具
yum install epel-release
yum install pssh
写host文件
vim pssh-hosts
192.168.227.148:22
192.168.227.142:22



#执行命令
[root@localhost ~]# pssh -h pssh-hosts -l root -i "echo 'y' | bash <(curl -sL kejilion.sh)"
[1] 16:34:07 [SUCCESS] 192.168.227.148:22
[2] 16:34:25 [SUCCESS] 192.168.227.142:22
[root@localhost ~]# ls
anaconda-ks.cfg  kejilion.sh  kernel-lt-5.4.278-1.el7.elrepo.x86_64.rpm  pssh-hosts
[root@localhost ~]#

```

> 更新: 2024-11-12 16:41:15  
> 原文: <https://www.yuque.com/xianzhou-eiffx/aklhoc/rgkd92n8nkdgltus>
