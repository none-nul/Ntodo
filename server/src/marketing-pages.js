const fs = require('fs');
const path = require('path');

const DOWNLOAD_ROOT = process.env.DOWNLOAD_ROOT || path.join(__dirname, '..', 'downloads');

const WINDOWS_RELEASE_NOTES = {
  '1.0': ['正式版发布。', '修复 Windows 与 Android 同账号同步链路。', '新增账号控制台、设备统计与任务统计。'],
  '0.2.1': ['加入账号登录与云同步。', '支持同步删除、同步恢复和冲突处理。'],
  '0.1.5': ['优化桌面便签交互和任务展示。', '改进 AI 添加任务体验。'],
  '0.1.3': ['加入任务优先级、截止日期和基础设置项。'],
  '0.1.2': ['优化窗口置顶和启动行为。'],
  '0.1.1': ['修复早期桌面端稳定性问题。'],
  '0.1.0': ['首个 Windows 安装包。']
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function layout(title, body, styles = '') {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${title}</title><style>${baseStyles()}${styles}</style></head><body>${body}</body></html>`;
}

function baseStyles() {
  return `:root{color-scheme:light;--ink:#111827;--muted:#647084;--line:#dbe3ee;--paper:#f4f7fb;--panel:#fff;--green:#16836b;--blue:#2563a9;--red:#b9473d;--yellow:#d99a21;font-family:Inter,"Segoe UI","Microsoft YaHei",Arial,sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 16% 18%,rgba(30,169,130,.12),transparent 26%),linear-gradient(120deg,#f7f9fc,#eef3f8);color:var(--ink)}body:before{content:"";position:fixed;inset:0;background-image:linear-gradient(rgba(17,24,39,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(17,24,39,.035) 1px,transparent 1px);background-size:38px 38px;mask-image:linear-gradient(90deg,transparent,black 18%,black 82%,transparent);pointer-events:none}a{color:inherit;text-decoration:none}h1,h2,h3,p{overflow-wrap:anywhere}.topbar{position:relative;display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:72px;padding:0 clamp(18px,5vw,56px);border-bottom:1px solid rgba(219,227,238,.88);background:rgba(255,255,255,.72);backdrop-filter:blur(16px)}.brand,nav,.actions,.links{display:flex;align-items:center;gap:12px}.brand{font-weight:950}.brand span{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--green),#0f6f5e);color:#fff;box-shadow:0 14px 34px rgba(22,131,107,.22)}nav a{color:var(--muted);font-size:14px;font-weight:850}.wrap{position:relative;width:min(1180px,calc(100% - 32px));margin:0 auto}.eyebrow{margin:0 0 12px;color:var(--green);font-size:12px;font-weight:950;text-transform:uppercase}.button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border:1px solid var(--line);border-radius:10px;background:#fff;font-weight:950;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}.button:hover{transform:translateY(-2px);border-color:rgba(22,131,107,.44);box-shadow:0 10px 28px rgba(25,35,52,.1)}.button.primary{border-color:var(--green);background:linear-gradient(135deg,var(--green),#1ea982);color:#fff}.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,.9fr);gap:clamp(30px,6vw,76px);align-items:center;min-height:calc(100vh - 72px);padding:54px 0}.hero h1{margin:0;font-size:clamp(46px,8vw,96px);line-height:.94;letter-spacing:0}.lead{max-width:660px;margin:24px 0 0;color:var(--muted);font-size:18px;line-height:1.78}.actions{flex-wrap:wrap;margin-top:30px}.panel{border:1px solid rgba(219,227,238,.9);border-radius:14px;background:rgba(255,255,255,.9);box-shadow:0 24px 70px rgba(25,35,52,.14)}.section{padding:30px 0 82px}.grid{display:grid;gap:14px}.card{padding:20px;border:1px solid var(--line);border-radius:12px;background:#fff}.card p{margin:0;color:var(--muted);line-height:1.65}@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@media(max-width:900px){.hero{grid-template-columns:1fr;min-height:auto}.topbar{align-items:flex-start;flex-direction:column;padding:16px}.grid{grid-template-columns:1fr!important}}`;
}

function portalPageHtml() {
  return layout('NoneNull Products', `<header class="topbar"><a class="brand" href="https://www.nonenull.top"><span>N</span><strong>NoneNull</strong></a><nav><a href="https://ntodo.nonenull.top">Ntodo</a><a href="https://github.com/none-nul">GitHub</a></nav></header><main class="wrap"><section class="hero"><div><p class="eyebrow">Products / Tools / Experiments</p><h1>NoneNull 产品入口</h1><p class="lead">这里集中放置正在开发和公开展示的工具、软件与工程项目。当前重点是 Ntodo，一个轻量的跨端任务工具。</p><div class="actions"><a class="button primary" href="https://ntodo.nonenull.top">进入 Ntodo</a><a class="button" href="https://github.com/none-nul">查看 GitHub</a></div></div><div class="panel ntodo-preview"><div class="head"><span></span><strong>Ntodo</strong><em>1.0</em></div><div class="task high">今天必须完成的任务</div><div class="task medium">同步桌面和 Android</div><div class="task low">整理下一个项目说明</div></div></section><section class="section"><p class="eyebrow">Public projects</p><h2>项目矩阵</h2><div class="grid projects"><article class="card"><h3>Ntodo</h3><p>桌面置顶任务便签，支持 Windows、Android、账号同步、优先级、子任务和 AI 快速整理。</p><div class="links"><a href="https://ntodo.nonenull.top">产品页</a><a href="https://github.com/none-nul/Ntodo">GitHub</a></div></article><article class="card"><h3>FishCutter</h3><p>基于 YOLOv8-seg、树莓派 5 和 STM32 的自动化鱼头检测与切割系统。</p><div class="links"><a href="https://github.com/none-nul/fish_cutter">GitHub</a></div></article><article class="card"><h3>Plane Game</h3><p>HTML5 Canvas 飞机射击小游戏，支持键盘和触屏操作。</p><div class="links"><a href="https://github.com/none-nul/plane-game">GitHub</a></div></article><article class="card"><h3>L-ink Card</h3><p>电子墨水屏 NFC 智能卡片改造项目，包含硬件、固件和 3D 模型。</p><div class="links"><a href="https://github.com/none-nul/L-ink_Card">GitHub</a></div></article></div></section></main>`, `.ntodo-preview{display:grid;gap:14px;padding:18px;animation:rise .5s ease both}.ntodo-preview .head{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding-bottom:12px;border-bottom:1px solid var(--line)}.ntodo-preview .head span{width:14px;height:14px;border-radius:4px;background:var(--green)}.ntodo-preview .head em{color:var(--muted);font-style:normal;font-size:13px;font-weight:850}.task{min-height:62px;padding:18px;border-left:5px solid var(--green);border-radius:10px;background:#f9fafc;font-weight:900}.task.high{border-color:var(--red)}.task.medium{border-color:var(--yellow)}.task.low{border-color:var(--blue)}.projects{grid-template-columns:repeat(4,minmax(0,1fr));margin-top:18px}.links{flex-wrap:wrap;margin-top:20px}.links a{color:var(--blue);font-weight:900}h2{margin:0;font-size:34px}h3{margin:0 0 12px;font-size:23px}`);
}

function ntodoPageHtml() {
  return layout('Ntodo - 桌面与 Android 任务便签', `<header class="topbar"><a class="brand" href="https://ntodo.nonenull.top"><span>N</span><strong>Ntodo</strong></a><nav><a href="https://account.nonenull.top">账号</a><a href="https://github.com/none-nul/Ntodo">GitHub</a><a href="https://www.nonenull.top">NoneNull</a></nav></header><main class="wrap"><section class="hero"><div><p class="eyebrow">Windows + Android</p><h1>Ntodo</h1><p class="lead">一个放在手边的任务便签。桌面端固定在右上角，Android 端随手记录，账号同步让任务在设备之间保持一致。</p><div class="actions"><a class="button primary" href="/downloads/windows">下载 Windows</a><a class="button" href="/downloads/android/android-release/Ntodo-Android-1.0.apk">下载 Android</a><a class="button" href="https://account.nonenull.top">打开控制台</a></div></div><div class="product"><div class="window panel"><div class="title"><strong>Ntodo</strong><span>置顶</span></div><div class="quick">添加现在要做的事</div><div class="todo high"><strong>准备发布官网</strong><span>高优先级 · 子项目 2/4</span></div><div class="todo medium"><strong>检查 Android 安装包</strong><span>中优先级 · 今天</span></div><div class="todo low"><strong>整理下一版想法</strong><span>低优先级</span></div></div><div class="phone panel"><strong>Android</strong><span>同一账号同步</span></div></div></section><section class="section"><p class="eyebrow">Downloads</p><h2>下载 Ntodo</h2><div class="grid downloads"><article class="card"><h3>Windows 历史版本</h3><p>查看历代安装包、更新日志和下载入口。</p><a class="button primary" href="/downloads/windows">选择 Windows 版本</a></article><article class="card"><h3>Android 1.0</h3><p>发行版 APK，包名 com.ntodo.mobile。</p><a class="button primary" href="/downloads/android/android-release/Ntodo-Android-1.0.apk">下载 APK</a></article></div></section></main>`, `.product{position:relative;min-height:470px}.window{display:grid;gap:12px;width:min(390px,100%);padding:16px;animation:rise .5s ease both}.title{display:flex;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid var(--line)}.title span{color:var(--green);font-size:13px;font-weight:950}.quick{min-height:42px;padding:12px;border:1px solid var(--line);border-radius:10px;color:var(--muted)}.todo{display:grid;gap:7px;min-height:76px;padding:15px;border-left:5px solid var(--green);border-radius:10px;background:#f8fafc}.todo span{color:var(--muted);font-size:13px}.todo.high{border-color:var(--red)}.todo.medium{border-color:var(--yellow)}.todo.low{border-color:var(--blue)}.phone{position:absolute;right:0;bottom:0;display:grid;gap:8px;width:170px;min-height:240px;padding:24px 16px;background:#17202b;color:#fff}.phone span{color:#b9c8d7}.downloads{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:18px}.downloads .button{justify-self:start;margin-top:16px}h2{margin:0;font-size:34px}h3{margin:0 0 12px;font-size:23px}@media(max-width:620px){.product{min-height:auto}.phone{position:static;width:100%;min-height:140px;margin-top:14px}.downloads{grid-template-columns:1fr}}`);
}

function parseWindowsRelease(fileName, stats) {
  const match = /^Ntodo-Setup-(.+)\.exe$/i.exec(fileName);
  if (!match) return null;
  const version = match[1];
  return {
    version,
    fileName,
    url: `/downloads/windows/desktop-main/${encodeURIComponent(fileName)}`,
    sizeMb: (stats.size / 1024 / 1024).toFixed(1),
    updated: stats.mtime.toISOString().slice(0, 10),
    notes: WINDOWS_RELEASE_NOTES[version] || ['历史安装包。']
  };
}

function compareVersions(a, b) {
  const left = a.version.split('.').map(Number);
  const right = b.version.split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (right[i] || 0) - (left[i] || 0);
    if (diff) return diff;
  }
  return b.updated.localeCompare(a.updated);
}

function listWindowsReleases() {
  const dir = path.join(DOWNLOAD_ROOT, 'windows', 'desktop-main');
  return fs.readdirSync(dir)
    .map((fileName) => {
      const fullPath = path.join(dir, fileName);
      const stats = fs.statSync(fullPath);
      return stats.isFile() ? parseWindowsRelease(fileName, stats) : null;
    })
    .filter(Boolean)
    .sort(compareVersions);
}

function windowsDownloadsPageHtml(releases) {
  const rows = releases.map((release, index) => `<article class="release-card ${index === 0 ? 'latest' : ''}"><div><p class="version">Windows ${escapeHtml(release.version)}${index === 0 ? '<span>最新</span>' : ''}</p><p class="meta">${escapeHtml(release.fileName)} · ${release.sizeMb} MB · ${release.updated}</p></div><ul>${release.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul><a class="button primary" href="${release.url}">下载安装包</a></article>`).join('');
  return layout('Ntodo Windows 历史版本', `<header class="topbar"><a class="brand" href="https://ntodo.nonenull.top"><span>N</span><strong>Ntodo</strong></a><nav><a href="https://ntodo.nonenull.top">产品页</a><a href="https://account.nonenull.top">账号</a><a href="https://www.nonenull.top">NoneNull</a></nav></header><main class="wrap releases-page"><section class="section"><p class="eyebrow">Windows Downloads</p><h1>Windows 安装包</h1><p class="lead">这里保留 Ntodo Windows 桌面端的历代安装包和更新日志。一般建议下载最新版本；需要回退时可以选择旧版本。</p><div class="release-list">${rows || '<div class="card"><h3>暂无安装包</h3><p>服务器下载目录里还没有 Windows 安装包。</p></div>'}</div></section></main>`, `.releases-page{padding-top:30px}.releases-page h1{margin:0;font-size:clamp(42px,7vw,78px);line-height:1}.release-list{display:grid;gap:14px;margin-top:32px}.release-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,.8fr) auto;gap:18px;align-items:center;padding:20px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.92);box-shadow:0 18px 46px rgba(25,35,52,.08)}.release-card.latest{border-top:5px solid var(--green)}.version{display:flex;align-items:center;gap:10px;margin:0;font-size:24px;font-weight:950}.version span{padding:4px 8px;border-radius:999px;background:rgba(22,131,107,.1);color:var(--green);font-size:12px}.meta{margin:8px 0 0;color:var(--muted);font-size:14px}.release-card ul{margin:0;padding-left:20px;color:var(--muted);line-height:1.7}@media(max-width:800px){.release-card{grid-template-columns:1fr}.release-card .button{justify-self:start}}`);
}

function marketingPageHandler(req, res, next) {
  const host = String(req.headers.host || '').split(':')[0];
  if (req.path !== '/') return next();
  if (host === 'nonenull.top') {
    return res.redirect(301, `https://www.nonenull.top${req.originalUrl || '/'}`);
  }
  if (host === 'www.nonenull.top') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(portalPageHtml());
  }
  if (host === 'ntodo.nonenull.top') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(ntodoPageHtml());
  }
  next();
}

function windowsDownloadsPageHandler(req, res, next) {
  const host = String(req.headers.host || '').split(':')[0];
  if (host !== 'ntodo.nonenull.top' || !['/downloads/windows', '/downloads/windows/'].includes(req.path)) {
    return next();
  }
  try {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(windowsDownloadsPageHtml(listWindowsReleases()));
  } catch (error) {
    return next(error);
  }
}

module.exports = { marketingPageHandler, windowsDownloadsPageHandler };
