# nonenull.top 动态部署说明

这个版本不再用静态站点托管。`www.nonenull.top`、`ntodo.nonenull.top`、`account.nonenull.top`、`api.nonenull.top` 全部反代到同一个 Ntodo API 容器，由 Express 按 Host 动态渲染页面和提供接口。

## 域名职责

- `nonenull.top`：301 跳转到 `https://www.nonenull.top`
- `www.nonenull.top`：NoneNull 产品总入口
- `ntodo.nonenull.top`：Ntodo 官网和下载页
- `account.nonenull.top`：Ntodo 登录、注册、设备和任务统计控制台
- `api.nonenull.top`：Ntodo API，同步、认证、健康检查

## 生成部署包

在仓库根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File deploy\nonenull\prepare-release.ps1
```

输出目录：

```text
deploy\nonenull\out\srv\nonenull
```

生成后的服务器结构：

```text
/srv/nonenull/
  downloads/
    windows/desktop-main/Ntodo-Setup-1.0.exe
    windows/desktop-main/latest.json
    android/android-release/Ntodo-Android-1.0.apk
    android/android-release/latest.json
  api/
    docker-compose.yml
    .env.example
    server/
  nginx.conf
```

页面不再复制到 `www/site`、`ntodo/site`、`account/site`。这些页面都在 `api/server/src/marketing-pages.js` 和 `api/server/src/account-page.js` 里动态生成。

## 上传到服务器

把本地：

```text
deploy\nonenull\out\srv\nonenull
```

上传覆盖到服务器：

```text
/srv/nonenull
```

## 启动 API

服务器执行：

```bash
cd /srv/nonenull/api
cp .env.example .env
nano .env
```

至少修改：

```text
POSTGRES_PASSWORD=生产强密码
JWT_SECRET=生产强随机密钥
```

启动或重建：

```bash
docker compose up -d --build
curl http://127.0.0.1:3000/health
```

## Caddy 配置

你的服务器当前是 Docker Caddy 占用 80/443，所以推荐继续用 Caddy，不需要启动系统 Nginx。

`/root/Caddyfile` 改成：

```caddyfile
nonenull.top {
    redir https://www.nonenull.top{uri} permanent
}

www.nonenull.top {
    reverse_proxy api-api-1:3000
}

ntodo.nonenull.top {
    reverse_proxy api-api-1:3000
}

account.nonenull.top {
    reverse_proxy api-api-1:3000
}

api.nonenull.top {
    reverse_proxy api-api-1:3000
}
```

确保 Caddy 容器加入 API 网络：

```bash
docker network connect api_default root-caddy-1 2>/dev/null || true
```

检查并重载：

```bash
docker exec root-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec root-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

## Nginx 备用配置

如果以后不用 Caddy，才使用 `nginx.conf`。该配置也已经改成全部反代到 `127.0.0.1:3000`，不再包含静态 root。

## 上线检查

```bash
curl -I https://nonenull.top
curl -I https://www.nonenull.top
curl -I https://ntodo.nonenull.top
curl -I https://account.nonenull.top
curl https://api.nonenull.top/health
```

下载链接：

```text
https://ntodo.nonenull.top/downloads/windows/desktop-main/Ntodo-Setup-1.0.exe
https://ntodo.nonenull.top/downloads/android/android-release/Ntodo-Android-1.0.apk
```

账号控制台登录后会调用同一个服务的 `/auth/me` 和 `/account/summary`，显示连接设备数量、任务总数、待办数、完成数、最近设备和最近任务。
