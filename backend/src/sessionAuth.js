const crypto = require('node:crypto');
const express = require('express');
const { readAdmins, verifyPassword, normalizeUsername, hashPassword, changeAdminPassword } = require('./adminCredentials');
const { write } = require('./logger');

function createSessionAuth(config) {
  const sessions = new Map();
  const attempts = new Map();
  const cookieName = 'inventario_session';
  const lifetime = config.sessionLifetimeMs || 8 * 60 * 60 * 1000;
  const idleTime = config.sessionIdleMs || lifetime;
  const loginWindow = 15 * 60 * 1000;
  const dummy = 'scrypt$' + '0'.repeat(48) + '$' + '0'.repeat(128);
  const router = express.Router();
  const publicAssets = new Set([
    '/login.html', '/login.js', '/style.css', '/theme.css', '/ui.js',
    '/demo-logo.svg', '/vendor/bootstrap/bootstrap.min.css'
  ]);
  const handle = (fn) => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
  const sessionId = (req) => {
    const match = String(req.headers.cookie || '').match(/(?:^|;\s*)inventario_session=([a-f0-9]{64})(?:;|$)/);
    return match?.[1] || '';
  };
  const clearCookie = (res) => res.clearCookie(cookieName, { httpOnly: true, sameSite: 'strict', secure: config.cookieSecure, path: '/' });
  function sameOrigin(req) {
    const origin = req.get('origin');
    if (!origin) return true; // JSON requests without Origin are available to local maintenance clients.
    return origin === (config.publicOrigin || `${req.protocol}://${req.get('host')}`);
  }
  function prune() {
    const now = Date.now();
    for (const [key, value] of sessions) if (now - value.created >= lifetime || now - value.touched >= idleTime) sessions.delete(key);
    for (const [key, value] of attempts) if (now >= value.until) attempts.delete(key);
  }
  async function authenticate(req, res, next) {
    try {
      res.set('Cache-Control', 'no-store');
      prune();
      req.user = { name: 'Visitante', role: 'reader', authMode: 'session' };
      const id = sessionId(req);
      const session = sessions.get(id);
      if (session) {
        const users = await readAdmins(config.usersFile);
        const current = users.find((user) => normalizeUsername(user.username) === session.username && user.passwordHash === session.credential);
        if (!current) { sessions.delete(id); clearCookie(res); }
        else {
          session.touched = Date.now();
          const passwordChangeRequired = current.mustChangePassword !== false;
          req.user = { name: session.username, role: passwordChangeRequired ? 'reader' : 'admin', authMode: 'session', csrfToken: session.csrfToken, passwordChangeRequired };
          req.adminSession = session;
        }
      }
      if (req.adminSession && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        if (!sameOrigin(req) || req.get('x-csrf-token') !== req.user.csrfToken) {
          return res.status(403).json({ message: 'Sessão de segurança inválida. Atualize a página e tente novamente.' });
        }
      }
      if (req.user.passwordChangeRequired && req.path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
          && !['/api/auth/change-password', '/api/auth/logout'].includes(req.path)) {
        return res.status(403).json({ message: 'Defina sua senha definitiva antes de realizar alterações.', passwordChangeRequired: true });
      }
      next();
    } catch (error) { next(error); }
  }

  function requireAccess(req, res, next) {
    const readRequest = ['GET', 'HEAD'].includes(req.method);
    if (readRequest && (publicAssets.has(req.path) || req.path === '/api/session')) return next();
    if (req.adminSession && req.user.passwordChangeRequired) {
      if (readRequest && ['/definir-senha.html', '/definir-senha.js'].includes(req.path)) return next();
      if (req.path === '/api' || req.path.startsWith('/api/')) {
        return res.status(403).json({ message: 'Defina sua senha definitiva para acessar o inventário.', passwordChangeRequired: true });
      }
      return res.redirect('/definir-senha.html');
    }
    if (req.adminSession && req.user.role === 'admin') return next();
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      return res.status(401).json({ message: 'Entre com uma conta administrativa para acessar o inventário.' });
    }
    return res.redirect('/login.html');
  }

  router.get('/status', handle(async (_req, res) => res.json({ configured: (await readAdmins(config.usersFile)).length > 0 })));
  router.post('/login', handle(async (req, res) => {
    if (!sameOrigin(req) || !req.is('application/json')) return res.status(403).json({ message: 'Origem de login inválida.' });
    if (config.cookieSecure && !req.secure) return res.status(400).json({ message: 'O login administrativo exige HTTPS.' });
    const username = normalizeUsername(req.body?.username);
    const password = req.body?.password;
    if (!/^[a-z0-9._@-]{3,80}$/.test(username) || typeof password !== 'string' || password.length > 256) {
      return res.status(400).json({ message: 'Informe um usuário e uma senha válidos.' });
    }
    prune();
    const keys = ['ip:' + req.ip, 'user:' + username];
    if (keys.some((key) => (attempts.get(key)?.count || 0) >= 10)) {
      res.set('Retry-After', '900');
      return res.status(429).json({ message: 'Muitas tentativas de acesso. Tente novamente em 15 minutos.' });
    }
    if (attempts.size > 10000) return res.status(429).json({ message: 'Limite temporário de acessos. Tente novamente mais tarde.' });
    for (const key of keys) {
      const previous = attempts.get(key);
      attempts.set(key, { count: (previous?.count || 0) + 1, until: previous?.until || Date.now() + loginWindow });
    }
    const users = await readAdmins(config.usersFile);
    if (!users.length) return res.status(503).json({ message: 'O administrador ainda não foi configurado no servidor.' });
    const user = users.find((entry) => normalizeUsername(entry.username) === username);
    const valid = await verifyPassword(password, user?.passwordHash || dummy);
    if (!user || !valid) {
      write('info', 'admin_login_failed');
      return res.status(401).json({ message: 'Usuário ou senha inválidos.' });
    }
    keys.forEach((key) => attempts.delete(key));
    sessions.delete(sessionId(req));
    if (sessions.size >= 1000) sessions.delete(sessions.keys().next().value);
    const id = crypto.randomBytes(32).toString('hex');
    const session = { username, credential: user.passwordHash, csrfToken: crypto.randomBytes(32).toString('hex'), created: Date.now(), touched: Date.now() };
    sessions.set(id, session);
    res.cookie(cookieName, id, { httpOnly: true, sameSite: 'strict', secure: config.cookieSecure, path: '/', maxAge: lifetime });
    write('info', 'admin_login_succeeded', { user: username });
    const passwordChangeRequired = user.mustChangePassword !== false;
    return res.json({ name: username, role: passwordChangeRequired ? 'reader' : 'admin', csrfToken: session.csrfToken, passwordChangeRequired });
  }));
  router.post('/change-password', handle(async (req, res) => {
    if (!req.adminSession || !req.user.passwordChangeRequired) return res.status(403).json({ message: 'Entre com sua senha temporária para definir a senha definitiva.' });
    if (!sameOrigin(req) || !req.is('application/json')) return res.status(403).json({ message: 'Origem de alteração inválida.' });
    if (config.cookieSecure && !req.secure) return res.status(400).json({ message: 'A alteração de senha exige HTTPS.' });
    const { newPassword, confirmPassword } = req.body || {};
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 256) {
      return res.status(400).json({ message: 'A nova senha deve ter de 8 a 256 caracteres.' });
    }
    if (newPassword !== confirmPassword) return res.status(400).json({ message: 'A confirmação da senha não coincide.' });
    const session = req.adminSession;
    if (await verifyPassword(newPassword, session.credential)) return res.status(400).json({ message: 'Escolha uma senha diferente da senha temporária.' });
    const passwordHash = await hashPassword(newPassword);
    await changeAdminPassword(config.usersFile, session.username, session.credential, passwordHash);
    for (const [id, existing] of sessions) if (existing.username === session.username) sessions.delete(id);
    const id = crypto.randomBytes(32).toString('hex');
    const renewed = { username: session.username, credential: passwordHash, csrfToken: crypto.randomBytes(32).toString('hex'), created: Date.now(), touched: Date.now() };
    sessions.set(id, renewed);
    res.cookie(cookieName, id, { httpOnly: true, sameSite: 'strict', secure: config.cookieSecure, path: '/', maxAge: lifetime });
    write('info', 'admin_password_changed', { user: session.username });
    return res.json({ name: session.username, role: 'admin', csrfToken: renewed.csrfToken, passwordChangeRequired: false });
  }));
  router.post('/logout', (req, res) => {
    if (!sameOrigin(req) || (req.adminSession && req.get('x-csrf-token') !== req.adminSession.csrfToken)) return res.status(403).json({ message: 'Sessão de segurança inválida.' });
    sessions.delete(sessionId(req));
    clearCookie(res);
    write('info', 'admin_logout', { user: req.user.name });
    return res.status(204).send();
  });
  return { authenticate, requireAccess, router };
}

module.exports = { createSessionAuth };
