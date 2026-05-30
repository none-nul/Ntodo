const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY || '';

function json(value) {
  return JSON.stringify(value);
}

function accountPageHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ntodo Account</title>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <style>
    :root{color-scheme:light;--ink:#111827;--muted:#647084;--line:#dbe3ee;--paper:#f4f7fb;--panel:#fff;--green:#16836b;--green2:#1ea982;--blue:#2563a9;--red:#b9473d;--soft:#edf7f4;--shadow:0 24px 70px rgba(25,35,52,.14);font-family:Inter,"Segoe UI","Microsoft YaHei",Arial,sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:linear-gradient(120deg,#f7f9fc,#eef3f8);color:var(--ink)}body:before{content:"";position:fixed;inset:0;background-image:linear-gradient(rgba(17,24,39,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(17,24,39,.035) 1px,transparent 1px);background-size:38px 38px;mask-image:linear-gradient(90deg,transparent,black 14%,black 86%,transparent);pointer-events:none}a{color:inherit;text-decoration:none}h1,h2,p{overflow-wrap:anywhere}.shell{position:relative;width:min(1040px,calc(100% - 32px));min-height:100vh;margin:0 auto;padding:36px 0;display:grid;align-content:center;gap:18px}.brand{display:inline-flex;align-items:center;gap:12px;width:max-content;font-weight:950}.brand span{display:grid;place-items:center;width:42px;height:42px;border-radius:11px;background:linear-gradient(135deg,var(--green),#0f6f5e);color:#fff;box-shadow:0 14px 34px rgba(22,131,107,.24)}.panel{position:relative;overflow:hidden;padding:30px;border:1px solid rgba(219,227,238,.9);border-radius:14px;background:rgba(255,255,255,.94);box-shadow:var(--shadow);animation:panelIn .36s ease both}.panel:before{content:"";position:absolute;inset:0 0 auto;height:5px;background:linear-gradient(90deg,var(--green),var(--blue));opacity:.95}.panel-head{display:flex;align-items:start;justify-content:space-between;gap:16px;margin:8px 0 24px}.eyebrow{margin:0 0 8px;color:var(--green);font-size:12px;font-weight:950;text-transform:uppercase}h1{margin:0;font-size:36px;line-height:1.1;letter-spacing:0}.auth-shell{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.12fr);gap:16px}.auth-box{padding:18px;border:1px solid var(--line);border-radius:12px;background:#fff}.auth-box h2{margin:0 0 5px;font-size:21px}.auth-box p{margin:0 0 16px;color:var(--muted);font-size:13px;line-height:1.55}.auth-form{display:grid;gap:14px}.field{display:grid;gap:7px}.field span{color:var(--muted);font-size:13px;font-weight:900}input{width:100%;min-height:48px;padding:0 14px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font:inherit;font-size:16px}input:focus{border-color:var(--green);outline:none;box-shadow:0 0 0 4px rgba(22,131,107,.13)}.turnstile-wrap{min-height:70px;display:flex;align-items:center}.turnstile-wrap.empty{min-height:0;padding:10px 12px;border:1px solid rgba(185,71,61,.22);border-radius:10px;background:rgba(185,71,61,.08);color:var(--red);font-size:13px;font-weight:800}.form-actions{display:grid;gap:10px;margin-top:2px}.register-actions{grid-template-columns:1fr 1fr}button{min-height:46px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font:inherit;font-weight:950;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,opacity .18s ease}button:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 10px 24px rgba(25,35,52,.1)}button.primary{border-color:var(--green);background:linear-gradient(135deg,var(--green),var(--green2));color:#fff}button.secondary{min-height:38px;padding:0 13px;color:var(--blue)}button:disabled{opacity:.58;cursor:default}.dashboard{display:grid;gap:16px;opacity:1;transform:none}.dashboard.ready{animation:dashboardIn .3s ease both}.account-card{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:16px 18px;border:1px solid rgba(22,131,107,.22);border-radius:12px;background:var(--soft)}.identity{display:flex;align-items:center;gap:12px;min-width:0}.identity strong{display:block;overflow:hidden;text-overflow:ellipsis}.identity p{margin:3px 0 0;color:var(--muted);font-size:14px}.status-dot{flex:0 0 auto;width:11px;height:11px;border-radius:5px;background:var(--green);animation:onlinePulse 2.3s ease-out infinite}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.stat{position:relative;min-height:126px;padding:16px;border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden;animation:cardIn .34s ease both}.stat:after{content:"";position:absolute;left:0;right:0;bottom:0;height:4px;background:linear-gradient(90deg,var(--green),var(--blue));transform-origin:left;animation:barGrow .6s ease both}.stat span{display:block;color:var(--muted);font-size:13px;font-weight:900}.stat strong{display:block;margin-top:14px;font-size:38px;line-height:1}.stat em{color:var(--muted);font-style:normal;font-size:13px}.dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.section{min-height:360px;padding:18px;border:1px solid var(--line);border-radius:12px;background:#fff;animation:cardIn .34s ease both}.section-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}.section-title h2{margin:0;font-size:22px}.section-title span{color:var(--blue);font-size:12px;font-weight:950}.list{display:grid;gap:10px;color:var(--muted)}.list.empty{place-items:center;min-height:220px;border:1px dashed var(--line);border-radius:10px}.row{display:grid;gap:4px;padding:13px 14px;border:1px solid rgba(219,227,238,.76);border-radius:10px;background:#fafbfd;animation:listIn .25s ease both}.row strong{font-size:15px}.row span{color:var(--muted);font-size:12px;line-height:1.45}.message{margin:16px 0 0;padding:12px;border-radius:10px;background:rgba(37,99,169,.1);color:var(--blue);line-height:1.5;animation:messageIn .22s ease both}.message.error{background:rgba(185,71,61,.1);color:var(--red)}[hidden]{display:none!important}@keyframes panelIn{from{opacity:0;transform:translateY(12px) scale(.99)}to{opacity:1;transform:none}}@keyframes dashboardIn{from{opacity:.6;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes cardIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes listIn{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}@keyframes barGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}@keyframes onlinePulse{70%{box-shadow:0 0 0 10px rgba(22,131,107,0)}100%{box-shadow:0 0 0 0 rgba(22,131,107,0)}}@keyframes messageIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}@media(max-width:820px){.shell{align-content:start;padding:20px 0}.panel{padding:20px}.auth-shell,.dash-grid{grid-template-columns:1fr}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.section{min-height:auto}.list.empty{min-height:128px}}@media(max-width:460px){.panel-head,.account-card{align-items:flex-start;flex-direction:column}.stats,.register-actions{grid-template-columns:1fr}h1{font-size:31px}}
  </style>
  <style>
    .auth-shell{grid-template-columns:1fr}
    .auth-switch{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .auth-switch button{background:rgba(22,131,107,.08);border-color:rgba(22,131,107,.22);color:var(--green)}
    .auth-switch button.active{background:linear-gradient(135deg,var(--green),var(--green2));border-color:var(--green);color:#fff}
    #loginPanel[hidden],#registerPanel[hidden]{display:none!important}
  </style>
</head>
<body>
  <main class="shell">
    <a class="brand" href="https://ntodo.nonenull.top"><span>N</span><strong>Ntodo Account</strong></a>
    <section class="panel" aria-labelledby="accountTitle">
      <div class="panel-head">
        <div><p class="eyebrow">Account</p><h1 id="accountTitle">Ntodo 控制台</h1></div>
        <button id="logoutButton" class="secondary" type="button" hidden>退出</button>
      </div>
      <div id="authShell" class="auth-shell">
        <div id="authSwitch" class="auth-switch">
          <button id="loginModeButton" class="active" type="button">登录</button>
          <button id="registerModeButton" type="button">注册</button>
        </div>
        <section id="loginPanel" class="auth-box" aria-labelledby="loginTitle">
          <h2 id="loginTitle">登录</h2>
          <p>已经有账号时只需要填写登录邮箱和密码。</p>
          <form id="loginForm" class="auth-form">
            <label class="field"><span>邮箱</span><input id="loginEmailInput" type="email" autocomplete="username" placeholder="you@example.com" required /></label>
            <label class="field"><span>密码</span><input id="loginPasswordInput" type="password" autocomplete="current-password" placeholder="Password" required /></label>
            <div class="form-actions">
              <button id="loginButton" class="primary" type="submit">登录</button>
            </div>
          </form>
        </section>
        <section id="registerPanel" class="auth-box" aria-labelledby="registerTitle" hidden>
          <h2 id="registerTitle">注册</h2>
          <p>新账号先通过人机验证并发送邮箱验证码，验证码正确后才会创建用户。</p>
          <form id="registerForm" class="auth-form">
            <label class="field"><span>注册邮箱</span><input id="registerEmailInput" type="email" autocomplete="email" placeholder="you@example.com" required /></label>
            <label class="field"><span>密码</span><input id="registerPasswordInput" type="password" autocomplete="new-password" placeholder="至少 8 位" minlength="8" required /></label>
            <label class="field"><span>昵称</span><input id="nameInput" type="text" autocomplete="name" placeholder="可选" /></label>
            <label id="codeField" class="field"><span>邮箱验证码</span><input id="codeInput" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 位验证码" /></label>
            <div id="turnstileWrap" class="turnstile-wrap"></div>
            <div class="form-actions register-actions">
              <button id="sendCodeButton" type="button">发送验证码</button>
              <button id="registerButton" class="primary" type="submit">完成注册</button>
            </div>
          </form>
        </section>
      </div>
      <section id="dashboard" class="dashboard" hidden>
        <div class="account-card"><div class="identity"><span class="status-dot"></span><div><strong id="accountEmail">已登录</strong><p id="accountMeta"></p></div></div><button id="refreshButton" class="secondary" type="button">刷新</button></div>
        <div class="stats"><article class="stat"><span>连接设备</span><strong id="deviceCount" data-value="0">0</strong><em>台</em></article><article class="stat"><span>全部任务</span><strong id="totalTodos" data-value="0">0</strong><em>个</em></article><article class="stat"><span>待办</span><strong id="activeTodos" data-value="0">0</strong><em>个</em></article><article class="stat"><span>已完成</span><strong id="completedTodos" data-value="0">0</strong><em>个</em></article></div>
        <div class="dash-grid"><article class="section"><div class="section-title"><h2>最近设备</h2><span id="syncVersion">v0</span></div><div id="deviceList" class="list empty">暂无设备</div></article><article class="section"><div class="section-title"><h2>最近任务</h2><span id="lastChange">暂无同步</span></div><div id="todoList" class="list empty">暂无任务</div></article></div>
      </section>
      <p id="messageBox" class="message" role="status" hidden></p>
    </section>
  </main>
  <script>
    const TOKEN_KEY = 'ntodo:account-token';
    const TURNSTILE_SITE_KEY = ${json(TURNSTILE_SITE_KEY)};
    const authShell = document.querySelector('#authShell');
    const loginModeButton = document.querySelector('#loginModeButton');
    const registerModeButton = document.querySelector('#registerModeButton');
    const loginPanel = document.querySelector('#loginPanel');
    const registerPanel = document.querySelector('#registerPanel');
    const loginForm = document.querySelector('#loginForm');
    const registerForm = document.querySelector('#registerForm');
    const loginEmailInput = document.querySelector('#loginEmailInput');
    const loginPasswordInput = document.querySelector('#loginPasswordInput');
    const registerEmailInput = document.querySelector('#registerEmailInput');
    const registerPasswordInput = document.querySelector('#registerPasswordInput');
    const nameInput = document.querySelector('#nameInput');
    const codeInput = document.querySelector('#codeInput');
    const turnstileWrap = document.querySelector('#turnstileWrap');
    const loginButton = document.querySelector('#loginButton');
    const sendCodeButton = document.querySelector('#sendCodeButton');
    const registerButton = document.querySelector('#registerButton');
    const logoutButton = document.querySelector('#logoutButton');
    const refreshButton = document.querySelector('#refreshButton');
    const dashboard = document.querySelector('#dashboard');
    const accountEmail = document.querySelector('#accountEmail');
    const accountMeta = document.querySelector('#accountMeta');
    const messageBox = document.querySelector('#messageBox');
    const stats = { device_count: document.querySelector('#deviceCount'), total_todos: document.querySelector('#totalTodos'), active_todos: document.querySelector('#activeTodos'), completed_todos: document.querySelector('#completedTodos') };
    const deviceList = document.querySelector('#deviceList');
    const todoList = document.querySelector('#todoList');
    const syncVersion = document.querySelector('#syncVersion');
    const lastChange = document.querySelector('#lastChange');
    let turnstileToken = '';
    let turnstileWidgetId = null;
    let codeCooldownTimer = null;
    let codeCooldownUntil = 0;
    let registerBusy = false;
    let authMode = 'login';

    window.onRegisterTurnstile = (token) => { turnstileToken = token || ''; };
    window.onRegisterTurnstileExpired = () => { turnstileToken = ''; };

    function token() { return localStorage.getItem(TOKEN_KEY) || ''; }
    function setToken(value) { value ? localStorage.setItem(TOKEN_KEY, value) : localStorage.removeItem(TOKEN_KEY); }
    function msg(text, error = false) { messageBox.textContent = text; messageBox.classList.toggle('error', error); messageBox.hidden = false; }
    function clearMsg() { messageBox.hidden = true; messageBox.textContent = ''; }
    function setAuthMode(mode) {
      authMode = mode === 'register' ? 'register' : 'login';
      loginPanel.hidden = authMode !== 'login';
      registerPanel.hidden = authMode !== 'register';
      loginModeButton.classList.toggle('active', authMode === 'login');
      registerModeButton.classList.toggle('active', authMode === 'register');
      clearMsg();
    }
    function setLoginBusy(value) { loginButton.disabled = value; }
    function setRegisterBusy(value) { registerBusy = value; registerButton.disabled = value; updateCodeButton(); }
    function updateCodeButton() {
      const left = Math.ceil((codeCooldownUntil - Date.now()) / 1000);
      if (left > 0) {
        sendCodeButton.textContent = left + ' 秒后重发';
        sendCodeButton.disabled = true;
        return;
      }
      sendCodeButton.textContent = '发送验证码';
      sendCodeButton.disabled = registerBusy;
    }
    function resetTurnstile() { turnstileToken = ''; if (window.turnstile && turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId); }
    function renderTurnstile() {
      if (!TURNSTILE_SITE_KEY) {
        turnstileWrap.classList.add('empty');
        turnstileWrap.textContent = 'Turnstile 未配置，暂时不能发送注册验证码。';
        return;
      }
      turnstileWrap.textContent = '';
      turnstileWrap.classList.remove('empty');
      const target = document.createElement('div');
      turnstileWrap.append(target);
      const tryRender = () => {
        if (!window.turnstile) { window.setTimeout(tryRender, 120); return; }
        turnstileWidgetId = window.turnstile.render(target, { sitekey: TURNSTILE_SITE_KEY, callback: window.onRegisterTurnstile, 'expired-callback': window.onRegisterTurnstileExpired, 'error-callback': window.onRegisterTurnstileExpired, theme: 'light' });
      };
      tryRender();
    }
    function startCodeCooldown(seconds) {
      codeCooldownUntil = Date.now() + Math.max(1, Number(seconds) || 60) * 1000;
      window.clearInterval(codeCooldownTimer);
      const tick = () => {
        updateCodeButton();
        if (Date.now() >= codeCooldownUntil) {
          codeCooldownUntil = 0;
          updateCodeButton();
          window.clearInterval(codeCooldownTimer);
        }
      };
      tick();
      codeCooldownTimer = window.setInterval(tick, 1000);
    }
    async function api(path, options = {}) {
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      if (options.token !== false && token()) headers.Authorization = 'Bearer ' + token();
      const response = await fetch(path, { method: options.method || 'GET', headers, body: options.body ? JSON.stringify(options.body) : undefined });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error?.message || '请求失败：' + response.status);
      return data;
    }
    function time(value) { if (!value) return '暂无记录'; return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
    function animate(element, nextValue) { const start = Number(element.dataset.value || element.textContent || 0), end = Number(nextValue || 0); element.dataset.value = String(end); const t0 = performance.now(), duration = 520; function tick(now) { const p = Math.min(1, (now - t0) / duration), eased = 1 - Math.pow(1 - p, 3); element.textContent = String(Math.round(start + (end - start) * eased)); if (p < 1) requestAnimationFrame(tick); } requestAnimationFrame(tick); }
    function list(container, items, render, empty) { container.textContent = ''; container.classList.toggle('empty', !items.length); if (!items.length) { container.textContent = empty; return; } items.forEach((item, index) => { const row = render(item); row.style.animationDelay = (index * 50) + 'ms'; container.append(row); }); }
    function renderSummary(summary = {}) { animate(stats.device_count, summary.device_count); animate(stats.total_todos, summary.total_todos); animate(stats.active_todos, summary.active_todos); animate(stats.completed_todos, summary.completed_todos); syncVersion.textContent = 'v' + (summary.latest_server_version || 0); lastChange.textContent = time(summary.last_change_at); }
    function renderDevices(devices = []) { list(deviceList, devices, (device) => { const row = document.createElement('div'); row.className = 'row'; row.innerHTML = '<strong>' + (device.device_name || 'Ntodo 设备') + '</strong><span>' + (device.platform || 'unknown') + ' · ' + time(device.last_seen_at || device.created_at) + '</span>'; return row; }, '暂无设备'); }
    function renderTodos(todos = []) { list(todoList, todos, (todo) => { const row = document.createElement('div'); row.className = 'row'; row.innerHTML = '<strong>' + (todo.title || '未命名任务') + '</strong><span>' + (todo.completed ? '已完成' : '待办') + ' · 优先级 ' + (todo.priority || 0) + ' · ' + time(todo.updated_at) + '</span>'; return row; }, '暂无任务'); }
    async function loadDashboard() { const data = await api('/account/summary'); renderSummary(data.summary || {}); renderDevices(data.devices || []); renderTodos(data.recent_todos || []); }
    function renderUser(user) { authShell.hidden = true; dashboard.hidden = false; logoutButton.hidden = false; accountEmail.textContent = user.email || '已登录'; accountMeta.textContent = user.name ? '昵称：' + user.name : ''; dashboard.classList.add('ready'); }
    function renderGuest() { authShell.hidden = false; dashboard.hidden = true; logoutButton.hidden = true; setAuthMode(authMode); }
    async function refreshAccount() { if (!token()) { renderGuest(); return; } try { const data = await api('/auth/me'); renderUser(data.user); await loadDashboard(); clearMsg(); } catch { setToken(''); renderGuest(); } }
    async function sendRegisterCode() {
      const email = registerEmailInput.value.trim().toLowerCase();
      if (!email) { msg('请先填写注册邮箱。', true); registerEmailInput.focus(); return; }
      if (!turnstileToken) { msg('请先完成注册区域的人机验证。', true); return; }
      setRegisterBusy(true); clearMsg();
      let cooldownSeconds = 0;
      try {
        const data = await api('/auth/register/code', { method: 'POST', token: false, body: { email, cf_turnstile_token: turnstileToken } });
        codeInput.focus();
        msg(data.message || '验证码已发送，请查收邮箱。');
        cooldownSeconds = 60;
      } catch (error) {
        msg(error.message || '验证码发送失败，请稍后重试。', true);
      } finally {
        setRegisterBusy(false);
        resetTurnstile();
      }
      if (cooldownSeconds) startCodeCooldown(cooldownSeconds);
    }
    async function login() {
      const email = loginEmailInput.value.trim().toLowerCase(), password = loginPasswordInput.value;
      if (!email || !password) { msg('请输入登录邮箱和密码。', true); return; }
      setLoginBusy(true); clearMsg();
      try {
        const body = { email, password, device: { device_name: 'Ntodo Account Web', platform: 'web' } };
        const data = await api('/auth/login', { method: 'POST', token: false, body });
        setToken(data.access_token);
        loginPasswordInput.value = '';
        renderUser(data.user);
        await loadDashboard();
        clearMsg();
      } catch (error) {
        msg(error.message || '登录失败，请稍后重试。', true);
      } finally {
        setLoginBusy(false);
      }
    }
    async function register() {
      const email = registerEmailInput.value.trim().toLowerCase(), password = registerPasswordInput.value, name = nameInput.value.trim(), code = codeInput.value.trim();
      if (!email || password.length < 8) { msg('请输入注册邮箱和至少 8 位密码。', true); return; }
      if (!/^\\d{6}$/.test(code)) { msg('请输入邮件中的 6 位验证码。', true); codeInput.focus(); return; }
      setRegisterBusy(true); clearMsg();
      try {
        const body = { email, password, name, code, device: { device_name: 'Ntodo Account Web', platform: 'web' } };
        const data = await api('/auth/register', { method: 'POST', token: false, body });
        setToken(data.access_token);
        registerPasswordInput.value = '';
        codeInput.value = '';
        renderUser(data.user);
        await loadDashboard();
        clearMsg();
      } catch (error) {
        msg(error.message || '注册失败，请稍后重试。', true);
      } finally {
        setRegisterBusy(false);
      }
    }
    loginForm.addEventListener('submit', (event) => { event.preventDefault(); login(); });
    registerForm.addEventListener('submit', (event) => { event.preventDefault(); register(); });
    loginModeButton.addEventListener('click', () => setAuthMode('login'));
    registerModeButton.addEventListener('click', () => setAuthMode('register'));
    sendCodeButton.addEventListener('click', sendRegisterCode);
    logoutButton.addEventListener('click', () => { setToken(''); renderGuest(); clearMsg(); });
    refreshButton.addEventListener('click', async () => { refreshButton.disabled = true; try { await loadDashboard(); clearMsg(); } catch (error) { msg(error.message || '刷新失败。', true); } finally { refreshButton.disabled = false; } });
    renderTurnstile();
    setAuthMode(window.location.hash === '#register' ? 'register' : 'login');
    refreshAccount();
  </script>
</body>
</html>`;
}

function accountPageHandler(req, res, next) {
  const host = String(req.headers.host || '').split(':')[0];
  if (host && host !== 'account.nonenull.top' && req.path === '/') return next();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(accountPageHtml());
}

module.exports = { accountPageHandler };
