const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
function getConfig() {
  if (process.env.NODE_ENV === 'production') throw Error('Esta demo tem contas públicas e não pode iniciar em modo de produção.');
  let port = process.env.DEMO_PORT || '4317';
  const envFile = path.join(ROOT, '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const match = line.match(/^DEMO_PORT\s*=\s*(\d+)\s*$/);
      if (!match) throw Error('A demo aceita somente DEMO_PORT no arquivo .env.');
      if (!process.env.DEMO_PORT) port = match[1];
    }
  }
  port = Number(port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('DEMO_PORT deve estar entre 1024 e 65535.');
  return { port, host: '127.0.0.1', root: ROOT, dataDir: path.join(ROOT, 'data') };
}
module.exports = { getConfig, ROOT };
