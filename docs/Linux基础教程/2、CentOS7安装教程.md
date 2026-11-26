---
tags:
  - Linux基础教程
---

#  CentOS7安装教程



[TOC]



## 一、安装前的准备

1.VMware的安装本文不再介绍，正常安装即可

2.下载CentOS 7 的镜像文件

## 二、下载镜像文件

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_12,color_FFFFFF,t_70,g_se,x_16.png)

 ![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_20,color_FFFFFF,t_70,g_se,x_16.png)

 ![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_19,color_FFFFFF,t_70,g_se,x_16.png)

## 三、开始安装

### 第1步：文件 → 新建虚拟机 或 直接点击 创建新的虚拟机 图标

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_20,color_FFFFFF,t_70,g_se,x_16-1710309337623-7.png)

###  第2步：选择 典型（推荐）→ 下一步

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_20,color_FFFFFF,t_70,g_se,x_16-1710309340342-10.png)

###  第3步：稍后安装操作系统

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_20,color_FFFFFF,t_70,g_se,x_16-1710309342404-13.png)

###  第4步：选择操作系统和版本

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_20,color_FFFFFF,t_70,g_se,x_16-1710309344227-16.png)

### 第5步：输入虚拟机名称和安装路径

![](https://img-blog.csdnimg.cn/20210909212520698.png?x-oss-process=image/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_20,color_FFFFFF,t_70,g_se,x_16)

###  第6步：设置磁盘大小，本文选择默认配置20G

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_20,color_FFFFFF,t_70,g_se,x_16-1710309346168-19.png)

### 第7步：自定义硬件

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_20,color_FFFFFF,t_70,g_se,x_16-1710309348116-22.png)

### 第8步：选择CentOS安装镜像文件

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_15,color_FFFFFF,t_70,g_se,x_16.png)

### 第9步：点击完成

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_20,color_FFFFFF,t_70,g_se,x_16-1710309352258-27.png)

## 四、进行初始化配置

### 第1步：启动虚拟机

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_20,color_FFFFFF,t_70,g_se,x_16-1710309354324-30.png)

###  第2步：选择第一项，Install CentOS 7，等待一会儿

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_20,color_FFFFFF,t_70,g_se,x_16-1710309356102-33.png)

###  第3步：选择语言，这里选择的是中文简体

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_16,color_FFFFFF,t_70,g_se,x_16.png)

### 第4步：进行安装信息的配置，选择安装位置

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_16,color_FFFFFF,t_70,g_se,x_16-1710309359926-38.png)

###  第5步：进行设置目标位置，配置分区

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_16,color_FFFFFF,t_70,g_se,x_16-1710309361852-41.png)

###  第6步：选择自动创建它们，然后进行分区设置，这里选择默认配置，也可以安装自己的需求自定义设置。

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_16,color_FFFFFF,t_70,g_se,x_16-1710309364088-44.png)

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_16,color_FFFFFF,t_70,g_se,x_16-1710309366342-47.png)

###  第7步： 设置好之后完成，保存接收更改

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_16,color_FFFFFF,t_70,g_se,x_16-1710309372804-50.png)

###   第8步： 选择网络和主机名

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_16,color_FFFFFF,t_70,g_se,x_16-1710309375084-53.png)

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_16,color_FFFFFF,t_70,g_se,x_16-1710309377071-56.png)

###  第9步： 安装位置与网络都已配置好，开始安装

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_16,color_FFFFFF,t_70,g_se,x_16-1710309379514-59.png)

### 第10步：系统安装的同时，设置root账户的密码，密码很重要，要记住！！

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_16,color_FFFFFF,t_70,g_se,x_16-1710309381786-62.png)

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_20,color_FFFFFF,t_70,g_se,x_16-1710309383617-65.png)

###  第11步：等待一会儿，安装完成，重启设备

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_16,color_FFFFFF,t_70,g_se,x_16-1710309385798-68.png)

### 第12步：选择第一项，输入账户名密码登录，账户名root，密码是上一步自定义的

**输入命令ip addr 查看自己的虚拟机的ip**

![](./2、CentOS7安装教程.assets/watermark,type_ZHJvaWRzYW5zZmFsbGJhY2s,shadow_50,text_Q1NETiBA5bCP5bCP5byg6Ieq55Sx4oCUPuW8oOacieWNmg==,size_19,color_FFFFFF,t_70,g_se,x_16-1710309387815-71.png)

### 第13步：安装完成



