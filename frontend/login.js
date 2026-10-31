'use strict';
const form = document.querySelector('#login-form');
const feedback = document.querySelector('#login-feedback');
const button = document.querySelector('#login-submit');
document.querySelector('#show-password').addEventListener('change', (event) => {
  form.elements.password.type = event.target.checked ? 'text' : 'password';
});
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  button.disabled = true; button.textContent = 'Entrando…'; feedback.hidden = true;
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.elements.username.value.trim(), password: form.elements.password.value })
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Não foi possível entrar.');
    form.elements.password.value = '';
    location.assign(body.passwordChangeRequired ? '/definir-senha.html' : '/gerenciamento.html');
  } catch (error) { feedback.textContent = error.message; feedback.hidden = false; }
  finally { button.disabled = false; button.textContent = 'Entrar'; }
});
(async function () {
  try {
    const [sessionResponse, statusResponse] = await Promise.all([fetch('/api/session', { cache:'no-store' }), fetch('/api/auth/status', { cache:'no-store' })]);
    if (sessionResponse.ok) {
      const session = await sessionResponse.json();
      if (session.passwordChangeRequired) { location.replace('/definir-senha.html'); return; }
      if (session.role === 'admin') { location.replace('/gerenciamento.html'); return; }
    }
    if (statusResponse.ok && !(await statusResponse.json()).configured) {
      feedback.textContent = 'O acesso ainda não foi configurado. Solicite ao responsável pelo sistema a criação da conta inicial.';
      feedback.hidden = false; button.disabled = true;
    }
  } catch { feedback.textContent = 'Servidor indisponível. Tente novamente.'; feedback.hidden = false; }
})();
