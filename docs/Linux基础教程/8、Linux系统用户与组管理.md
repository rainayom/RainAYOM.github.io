# Linux用户与组管理



[TOC]

# 一、用户与组概述



与windows类似，Linux也有用户和用户组的概念。在Linux系统中，每次登录系统都必须以一个用户的身份登录，并且登录后的权限也会根据用户身份来确定。 每一个进程在执行时，也会有其用户，该用户也和进程所能控制的资源有关。Linux系统下的每一个目录、文件，都会有其属于的用户和用户组，我们称其为属主和属组。由此课件，用户和用户组与Linux系统的运行息息相关。在实际操作使用系统时，我们往往关注用户较多与关注用户组。  

在Linux系统中，每个用户都有自己的用户ID，称为UID，每个用户组也有自己的用户组ID，称为GID，UID和GID在Linux系统中是不可重复的。Linux系统就是通过UID和GID来对用户和组进行管理的，而对于管理员来说，往往会设置用户名和组名，这样使得用户和用户组的使用管理更人性化。  

## 1、用户组类型

- **root用户**  

root用户时UID和GID都等于0的用户，是Linux系统中的“上帝”，拥有最大的权限。如果深入了解Linux系统，会发现root用户真的拥有很多特权，比如：无视Linux对权限的设置而强行读、写、执行文件，切换其他用户登录不需要密码，可以强行切换到已经所用的用户，只有root可以为普通用户修改密码等等。  

- **系统用户**  

系统用户通常用于运行服务，但是此用户无家目录，也不能用于登录系统。例如，在yum安装apache、nginx等服务后，就会自动创建apache和nginx的用户和同名用户组。在CentOS6系统中，系统用户的UID范围是1-499，在CentOS7系统中，系统用户的ID是1-999。  

- **普通用户**  

普通用户只能由root用户创建，该用户拥有家目录，并且可以登录，该用户的权限由root分配。普通用户拥有指定的shell环境。

## 2、用户和用户组关系

在Linux系统中，每个用户必定属于一个主组，默认情况下属于与其同名的用户组，最多可以有31个附属组，从用户权限的角度看，主组和附属组其实差别不大，用户也会拥有其附属组的组相关权限。

## 3、用户和用户组配置文件

Linux系统下用户和用户组相关的配置文件主要有以下几个： 

- **/etc/passwd**

存储用户信息

```bash
tail -1 /etc/passwd
user10:x:1014:1014::/home/user10:/bin/bash
#用户名:密码占位符:用户ID:组ID:用户描述信息:用户家目录:登录shell
```

- **/etc/shadow**  

该配置文件保存了用户的密码信息 。

```bash
tail -1 /etc/shadow
user2:!!:19522:0:99999:7:::
#用户名:密码:用户创建时间:密码最短使用期限:密码最长使用期限:密码过期提醒时间:密码过期后的宽容时间:密码过期时间:没用
```

   

- **/etc/group** 

该文件保存了用户组的信息 。

```bash
tail -1 /etc/group
nginx:x:982:
#组名:占位符:组ID:非同名用户的组成员
```

- **/etc/gshadow**  

该文件保存了用户组的密码。 

- **/etc/login.defs**  

该文件可以设置密码过期时间，密码最大长度限制等内容。

```bash
[root@ansible ~]# cat /etc/login.defs 
#
# Please note that the parameters in this configuration file control the
# behavior of the tools from the shadow-utils component. None of these
# tools uses the PAM mechanism, and the utilities that use PAM (such as the
# passwd command) should therefore be configured elsewhere. Refer to
# /etc/pam.d/system-auth for more information.
#

# *REQUIRED*
#   Directory where mailboxes reside, _or_ name of file, relative to the
#   home directory.  If you _do_ define both, MAIL_DIR takes precedence.
#   QMAIL_DIR is for Qmail
#
#QMAIL_DIR	Maildir
MAIL_DIR	/var/spool/mail
#MAIL_FILE	.mail

# Password aging controls:
#
#	PASS_MAX_DAYS	Maximum number of days a password may be used.
#	PASS_MIN_DAYS	Minimum number of days allowed between password changes.
#	PASS_MIN_LEN	Minimum acceptable password length.
#	PASS_WARN_AGE	Number of days warning given before a password expires.
#
PASS_MAX_DAYS	99999
PASS_MIN_DAYS	0
PASS_MIN_LEN	5
PASS_WARN_AGE	7

#
# Min/max values for automatic uid selection in useradd
#
UID_MIN                  1000
UID_MAX                 60000
# System accounts
SYS_UID_MIN               201
SYS_UID_MAX               999

#
# Min/max values for automatic gid selection in groupadd
#
GID_MIN                  1000
GID_MAX                 60000
# System accounts
SYS_GID_MIN               201
SYS_GID_MAX               999

#
# If defined, this command is run when removing a user.
# It should remove any at/cron/print jobs etc. owned by
# the user to be removed (passed as the first argument).
#
#USERDEL_CMD	/usr/sbin/userdel_local

#
# If useradd should create home directories for users by default
# On RH systems, we do. This option is overridden with the -m flag on
# useradd command line.
#
CREATE_HOME	yes

# The permission mask is initialized to this value. If not specified, 
# the permission mask will be initialized to 022.
UMASK           077

# This enables userdel to remove user groups if no members exist.
#
USERGROUPS_ENAB yes

# Use SHA512 to encrypt password.
ENCRYPT_METHOD SHA512

```



# 二、用户管理



## 1、useradd命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

## 2、userdel

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

## 3、password命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**



## 4、usermod命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

## 5、chpasswd命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

## 4、chage命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

# 三、组管理

## 1、groupadd命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

## 2、groupdel命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

## 3、groupmod命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：*

## 4、gpasswd命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

# 四、用户切换与sudo提权

## 1、su命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

## 2、sudo命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

# 五、用户登录信息查看

## 1、id命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

## 2、w命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

## 3、who命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

## 4、whoami命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

## 5、finger命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**





## 6、last命令

last命令可以查看登录用户列表，last命令实际上从日志文件/var/log/wtmp读取信息并显示用户最近的登录列表。此命令普通用户也可以执行。

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

## 7、lastb命令

lastb命令可以从日志文件/var/log/btmp中读取信息，并显示用户登录失败的记录用于发现系统登录异常。此命令要求root用户才可以执行，lastb可用参数与last命令参数相同。

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**

## 8、lastlog命令

**语法：**

```bash

```

**选项：**

| 选项 | 作用 |
| ---- | ---- |
|      |      |
|      |      |
|      |      |

**案例：**