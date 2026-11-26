---
tags:
  - ansible
  - docker
  - 自动化
---

# 使用ansible批量安装docker

# 1.首先安装好ansible
本文测试环境为centos7.9



具体方法参考：

<font style="color:rgb(38, 38, 38);">https://www.yuque.com/xianzhou-eiffx/aklhoc/vsz13ega7edlk67l?singleDoc# 《ansible基础》</font>

```bash
root@control /home/roles # cat /etc/ansible/hosts
[all:vars]
ansible_user=root
#ansible_ssh_pass=Gww603397654
ansible_become=true

[control]
172.16.120.249

[nodes]
172.16.120.250
172.16.120.248

[web]
172.16.120.250

[database]
172.16.120.248
root@control /home/roles # 

```

<font style="color:rgb(38, 38, 38);"></font>

```bash
root@control /home/roles # ansible all -m ping
172.16.120.248 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python"
    }, 
    "changed": false, 
    "ping": "pong"
}
172.16.120.250 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python"
    }, 
    "changed": false, 
    "ping": "pong"
}
172.16.120.249 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python"
    }, 
    "changed": false, 
    "ping": "pong"
}
root@control /home/roles # 

```

# <font style="color:rgb(38, 38, 38);">2.写yml文件</font>
```bash
root@control /home/roles # cat installDocker.yml 
---
- name: Install Docker on CentOS 7
  hosts: all
  become: yes
  tasks:
  - name: Install required packages
    yum:
      name:
        - yum-utils
        - device-mapper-persistent-data
        - lvm2
      state: present

  - name: Set up the Docker repository
    yum_repository:
      name: docker-ce-stable
      description: Docker CE Stable - $basearch
      baseurl: https://mirrors.aliyun.com/docker-ce/linux/centos/7/$basearch/stable/
      enabled: 1
      gpgcheck: 1
      gpgkey: https://mirrors.aliyun.com/docker-ce/linux/centos/gpg

  - name: Install Docker CE
    yum:
      name:
        - docker-ce
        - docker-ce-cli
        - containerd.io
      state: present

  - name: Start and enable Docker service
    service:
      name: docker
      state: started
      enabled: true
      

root@control /home/roles # 

```

# 3.执行yml
```bash
root@control /home/roles # ansible-playbook installDocker.yml 

PLAY [Install Docker on CentOS 7] *****************************************************************

TASK [Gathering Facts] ****************************************************************************
ok: [172.16.120.248]
ok: [172.16.120.249]
ok: [172.16.120.250]

TASK [Install required packages] ******************************************************************
ok: [172.16.120.248]
ok: [172.16.120.250]
ok: [172.16.120.249]

TASK [Set up the Docker repository] ***************************************************************
changed: [172.16.120.248]
changed: [172.16.120.250]
changed: [172.16.120.249]

TASK [Install Docker CE] **************************************************************************
ok: [172.16.120.250]
changed: [172.16.120.248]
changed: [172.16.120.249]

TASK [Start and enable Docker service] ************************************************************
ok: [172.16.120.250]
changed: [172.16.120.248]
changed: [172.16.120.249]

PLAY RECAP ****************************************************************************************
172.16.120.248             : ok=5    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
172.16.120.249             : ok=5    changed=3    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   
172.16.120.250             : ok=5    changed=1    unreachable=0    failed=0    skipped=0    rescued=0    ignored=0   


```

# 4.测试
```bash
root@control /home/roles # ansible all -m shell -a 'docker -v'
172.16.120.248 | CHANGED | rc=0 >>
Docker version 26.1.4, build 5650f9b
172.16.120.250 | CHANGED | rc=0 >>
Docker version 26.1.4, build 5650f9b
172.16.120.249 | CHANGED | rc=0 >>
Docker version 26.1.4, build 5650f9b

```

# 5.配置加速
```bash
root@control /home/roles # vim /etc/docker/daemon.json
root@control /home/roles # sudo systemctl restart docker
root@control /home/roles # systemctl start docker
root@control /home/roles # docker pull hello-world
Using default tag: latest
latest: Pulling from library/hello-world
c1ec31eb5944: Pull complete 
Digest: sha256:305243c734571da2d100c8c8b3c3167a098cab6049c9a5b066b6021a60fcb966
Status: Downloaded newer image for hello-world:latest
docker.io/library/hello-world:latest
root@control /home/roles # docker images
REPOSITORY    TAG       IMAGE ID       CREATED         SIZE
hello-world   latest    d2c94e258dcb   19 months ago   13.3kB
root@control /home/roles # cat /etc/docker/daemon.json
{
  "registry-mirrors": ["https://dockerproxy.net"]
}

root@control /home/roles # 


```

# 6.配置文件批量复制到其他主机
```bash
root@control /home/roles # ansible all -m copy -a 'src=/etc/docker/daemon.json dest=/etc/docker/daemon.json'
172.16.120.248 | CHANGED => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python"
    }, 
    "changed": true, 
    "checksum": "8121e02353351ab5d972e8e216eb7b850e553071", 
    "dest": "/etc/docker/daemon.json", 
    "gid": 0, 
    "group": "root", 
    "md5sum": "267b79ba57fc6815f74cb58b87770ce8", 
    "mode": "0644", 
    "owner": "root", 
    "size": 239, 
    "src": "/root/.ansible/tmp/ansible-tmp-1733238321.3-17622-176414340626762/source", 
    "state": "file", 
    "uid": 0
}
172.16.120.250 | CHANGED => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python"
    }, 
    "changed": true, 
    "checksum": "8121e02353351ab5d972e8e216eb7b850e553071", 
    "dest": "/etc/docker/daemon.json", 
    "gid": 0, 
    "group": "root", 
    "md5sum": "267b79ba57fc6815f74cb58b87770ce8", 
    "mode": "0644", 
    "owner": "root", 
    "size": 239, 
    "src": "/root/.ansible/tmp/ansible-tmp-1733238321.26-17621-277554555133945/source", 
    "state": "file", 
    "uid": 0
}
172.16.120.249 | SUCCESS => {
    "ansible_facts": {
        "discovered_interpreter_python": "/usr/bin/python"
    }, 
    "changed": false, 
    "checksum": "8121e02353351ab5d972e8e216eb7b850e553071", 
    "dest": "/etc/docker/daemon.json", 
    "gid": 0, 
    "group": "root", 
    "mode": "0644", 
    "owner": "root", 
    "path": "/etc/docker/daemon.json", 
    "size": 239, 
    "state": "file", 
    "uid": 0
}
root@control /home/roles # ls /etc/docker/daemon.json 
/etc/docker/daemon.json
root@control /home/roles # 
#批量重启加载配置
ansible all -m shell -a 'systemctl daemon-reload'
ansible all -m shell -a 'systemctl restart docker'
```

# 7.拉取测试镜像
```bash
root@control /home/roles # ansible all -m shell -a 'docker pull hello-world'
172.16.120.249 | CHANGED | rc=0 >>
Using default tag: latest
latest: Pulling from library/hello-world
Digest: sha256:305243c734571da2d100c8c8b3c3167a098cab6049c9a5b066b6021a60fcb966
Status: Image is up to date for hello-world:latest
docker.io/library/hello-world:latest
172.16.120.250 | CHANGED | rc=0 >>
Using default tag: latest
latest: Pulling from library/hello-world
c1ec31eb5944: Pulling fs layer
c1ec31eb5944: Download complete
c1ec31eb5944: Pull complete
Digest: sha256:305243c734571da2d100c8c8b3c3167a098cab6049c9a5b066b6021a60fcb966
Status: Downloaded newer image for hello-world:latest
docker.io/library/hello-world:latest
172.16.120.248 | CHANGED | rc=0 >>
Using default tag: latest
latest: Pulling from library/hello-world
c1ec31eb5944: Pulling fs layer
c1ec31eb5944: Download complete
c1ec31eb5944: Pull complete
Digest: sha256:305243c734571da2d100c8c8b3c3167a098cab6049c9a5b066b6021a60fcb966
Status: Downloaded newer image for hello-world:latest
docker.io/library/hello-world:latest
root@control /home/roles # 


```



> 更新: 2024-12-03 23:29:39  
> 原文: <https://www.yuque.com/xianzhou-eiffx/aklhoc/xz7x3pvgwcgg6hzl>