# Docker 容器安装指南

本项目支持通过 Docker Compose 启动应用容器。应用容器内会同时启动主服务和认证服务：

- 主服务：对外暴露 `14558`
- 认证服务：容器内部 `2233`，由主服务代理 `/api/auth`

默认配置会连接宿主机已有的 MySQL 和 Redis，不再额外启动 MySQL/Redis 容器。

## 1Panel / 宝塔环境变量

如果通过 1Panel、宝塔面板或其他可视化面板创建容器，可以直接在“环境变量”里填写数据库配置。容器启动时会把这些环境变量同步写入持久化的 `/app/config/.env`，后续重启仍会保留。

建议填写：

```env
NODE_ENV=production
PORT=14558
AUTH_PORT=2233
AUTH_SERVICE_URL=http://127.0.0.1:2233
ALLOWED_ORIGINS=http://你的服务器IP:14558,http://localhost:14558,http://127.0.0.1:14558

DATABASE_STORAGE=mysql
MYSQL_HOST=你的MySQL地址
MYSQL_PORT=3306
MYSQL_USER=kiro
MYSQL_PASSWORD=你的MySQL密码
MYSQL_DATABASE=KrioServer

REDIS_HOST=你的Redis地址
REDIS_PORT=6379
REDIS_PASSWORD=你的Redis密码
REDIS_DB=0

LOG_LEVEL=info
KIRO_AUTO_SETUP_FROM_ENV=true
```

`JWT_SECRET` 和 `ENCRYPTION_KEY` 可以不填，容器首次启动会自动生成并写入 `/app/config/.env`。如果你在面板里填写了这两个变量，入口脚本也会同步写入 `.env`。

当 `KIRO_AUTO_SETUP_FROM_ENV=true` 时，如果 MySQL 或 Redis 环境变量齐全，容器会自动写入 `/app/config/.setup-completed`，启动时直接连接数据库，不必先进入配置向导。需要保留向导流程时，把它设为 `false`。

面板创建容器时还需要：

- 端口映射：宿主机 `14558` -> 容器 `14558`
- 持久化挂载：`/app/config`、`/app/data`、`/app/logs`
- 如果数据库在宿主机上，`MYSQL_HOST`/`REDIS_HOST` 建议填宿主机内网 IP；如果面板支持 `host.docker.internal` 或自定义 hosts，也可以使用 `host.docker.internal`

## 前置条件

- Windows 11 已安装 Docker Desktop，或 Linux 已安装 Docker Engine
- 已安装 Docker Compose v2，也就是 `docker compose` 命令
- 当前目录为项目根目录 `D:\kiroAuto`，Linux 下为项目克隆目录
- 宿主机已有 MySQL 和 Redis，并允许 Docker 容器访问

## 配置宿主机数据库

复制 Docker 环境变量示例：

```powershell
Copy-Item server\.env.docker.example .env
notepad .env
```

Linux 下：

```bash
cp server/.env.docker.example .env
nano .env
```

至少修改 MySQL 密码：

```env
MYSQL_USER=kiro
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=KrioServer
```

如果 Redis 设置了密码，也同步修改：

```env
REDIS_PASSWORD=your_redis_password
```

Linux 下容器通过 `host.docker.internal` 访问宿主机，compose 文件已配置：

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

## MySQL 授权示例

宿主机 MySQL 需要允许来自 Docker 网桥网络的连接。最简单的本地部署授权示例：

```sql
CREATE DATABASE IF NOT EXISTS KrioServer;
CREATE USER IF NOT EXISTS 'kiro'@'%' IDENTIFIED BY 'your_mysql_password';
GRANT ALL PRIVILEGES ON KrioServer.* TO 'kiro'@'%';
FLUSH PRIVILEGES;
```

同时确认 MySQL 没有只监听 `127.0.0.1`。Ubuntu 常见配置文件是：

```bash
/etc/mysql/mysql.conf.d/mysqld.cnf
```

需要把 `bind-address` 调整为可被 Docker 网桥访问的地址，例如：

```ini
bind-address = 0.0.0.0
```

修改后重启 MySQL。

## Redis 注意事项

如果 Redis 开启了 `protected-mode` 或密码认证，需要允许 Docker 容器来源，并在 `.env` 中设置 `REDIS_PASSWORD`。如果 Redis 只监听 `127.0.0.1`，容器也无法连接，需要调整 Redis 监听地址或防火墙规则。

## 启动

```powershell
docker compose up -d --build
```

Linux 下同样执行：

```bash
docker compose up -d --build
```

启动后访问：

- 管理面板：http://localhost:14558
- 配置向导：http://localhost:14558/setup
- 健康检查：http://localhost:14558/health-basic

首次启动时，容器会在持久化卷 `kiro_config` 中生成 `/app/config/.env`，包含随机 `JWT_SECRET` 和 `ENCRYPTION_KEY`。配置向导写入的数据库配置、完成标记、数据和日志都会保存在 Docker 卷中。

## 常用命令

```powershell
# 查看服务状态
docker compose ps

# 查看应用日志
docker compose logs -f kiro

# 重启应用容器
docker compose restart kiro

# 停止服务但保留数据卷
docker compose down

# 停止并删除应用配置、JSON 数据和日志卷
docker compose down -v
```

## 数据持久化

Compose 会创建以下卷：

- `kiro_config`：运行时 `.env`、数据库配置和 setup 完成标记
- `kiro_data`：JSON 模式数据文件
- `kiro_logs`：服务日志

MySQL 和 Redis 数据由宿主机原有服务负责持久化和备份。
