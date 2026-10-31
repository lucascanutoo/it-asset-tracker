function localAccess(req, res, next) {
  const address = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const host = req.get('host') || '';
  const match = /^(127\.0\.0\.1|localhost)(?::(\d+))?$/.exec(host);
  const port = match ? Number(match[2] || 80) : null;
  const proxyHeaders = ['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip'];
  const site = req.get('sec-fetch-site');
  const origin = req.get('origin');
  if (!['127.0.0.1', '::1'].includes(address)
      || !match || port !== req.socket.localPort
      || proxyHeaders.some(name => req.get(name) !== undefined)
      || (site && !['same-origin', 'none'].includes(site))
      || (origin && origin !== `http://${host}`)) {
    return res.status(403).json({message:'Esta demo aceita somente acesso direto no computador local.'});
  }
  next();
}
module.exports = { localAccess };
