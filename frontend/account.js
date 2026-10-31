'use strict';
(async function () {
  try {
    const response = await fetch('/api/session', { cache: 'no-store' });
    if (!response.ok) { location.replace('/login.html'); return; }
    const session = await response.json();
    if (session.passwordChangeRequired) { location.replace('/definir-senha.html'); return; }
    const anchor = document.querySelector('#session-user');
    if (!anchor) return;
    const area = document.createElement('div'); area.className = 'account-controls';
    if (session.role === 'admin') {
      const nav = document.querySelector('.sidebar nav');
      if (nav && !nav.querySelector('[data-admin-logs]')) {
        const logs = document.createElement('a'); logs.href = '/logs.html'; logs.className = 'nav-link'; logs.dataset.adminLogs = ''; logs.textContent = 'Logs'; nav.append(logs);
      }
      anchor.textContent = session.name + ' · Administrador';
      const logout = document.createElement('button'); logout.type = 'button'; logout.className = 'account-link'; logout.textContent = 'Sair';
      logout.addEventListener('click', async () => {
        logout.disabled = true;
        try {
          const result = await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': session.csrfToken || '' } });
          if (!result.ok) throw new Error('Não foi possível sair. Atualize a página.');
          location.replace('/login.html');
        } catch (error) { anchor.textContent = error.message; logout.disabled = false; }
      });
      area.append(logout);
    } else {
      location.replace('/login.html'); return;
    }
    anchor.after(area);
  } catch { /* A página principal apresenta erros de conexão. */ }
})();
