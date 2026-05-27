$ErrorActionPreference = "Stop"

$HostName = "root@198.12.120.149"
$Archive = "E:\Project\todo\deploy\nonenull\nonenull-1.0-release.tar.gz"
$RemoteArchive = "/root/nonenull-1.0-release.tar.gz"

if (-not (Test-Path -LiteralPath $Archive)) {
  throw "Release archive not found: $Archive"
}

Write-Host "Uploading $Archive to ${HostName}:$RemoteArchive"
scp $Archive "${HostName}:$RemoteArchive"

Write-Host "Running remote deployment commands..."
ssh $HostName @'
set -e
cd /root
rm -rf /root/nonenull
tar -xzf /root/nonenull-1.0-release.tar.gz
mkdir -p /root/srv/nonenull
if command -v rsync >/dev/null 2>&1; then
  rsync -a /root/nonenull/ /root/srv/nonenull/
else
  cp -a /root/nonenull/. /root/srv/nonenull/
fi
cd /root/srv/nonenull/api
docker compose up -d --build
docker network connect api_default root-caddy-1 2>/dev/null || true
docker exec root-caddy-1 caddy reload --config /etc/caddy/Caddyfile
echo
echo "Health checks:"
curl -fsS https://api.nonenull.top/health
echo
curl -I https://ntodo.nonenull.top/downloads/windows/desktop-main/Ntodo-Setup-1.0.exe
curl -I https://ntodo.nonenull.top/downloads/android/android-release/Ntodo-Android-1.0.apk
'@

Write-Host "Deployment finished."
Read-Host "Press Enter to close"
