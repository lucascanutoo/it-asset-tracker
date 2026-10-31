const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { getConfig } = require('./config');
const { openDemoData } = require('./demoData');
const { createSessionAuth } = require('./sessionAuth');
const { authorize } = require('./auth');
const { createMaquinasService } = require('./services/maquinasService');
const { createMaquinasController } = require('./controllers/maquinasController');
const { createMaquinasRouter } = require('./routes/maquinas');
const { createReplacementStore } = require('./replacementStore');
const { createReplacementRouter } = require('./replacementRoutes');
const { localAccess } = require('./localAccess');
function createApp(config = getConfig()) {
  const { repository, replacementFile } = openDemoData(config.dataDir);
  const store = createReplacementStore(replacementFile);
  const sync = { status: async () => ({configured:false,provider:'demo'}) };
  const session = createSessionAuth({cookieSecure:false,sessionLifetimeMs:3600000,sessionIdleMs:1800000});
  const controller = createMaquinasController(createMaquinasService(repository));
  const app = express();
  app.locals.repository = repository;
  app.disable('x-powered-by');
  app.use(localAccess);
  app.use((req,res,next) => {
    res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store',
      'X-Frame-Options':'DENY','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Resource-Policy':'same-origin',
      'Permissions-Policy':'camera=(), microphone=(), geolocation=()','X-DNS-Prefetch-Control':'off',
      'Content-Security-Policy':"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"});
    next();
  });
  app.use(express.json({limit:'16kb'}));
  app.get('/health',(_req,res)=>res.json({status:'ok',mode:'synthetic-demo'}));
  app.use(session.authenticate);
  app.use('/api/auth',session.router);
  app.use(session.requireAccess);
  app.get('/api/session',(req,res)=>res.json(req.user));
  app.get('/api/logs',authorize('admin'),(req,res,next)=>{try{res.json(repository.queryAudit(req.query));}catch(e){next(e);}});
  app.get('/api/analytics',(_req,res)=>res.json({items:repository.list(),updatedAt:new Date().toISOString()}));
  app.get('/api/dashboard',controller.dashboard);
  app.get('/api/meta/filters',controller.filters);
  app.use('/api/maquinas',createMaquinasRouter(controller));
  app.use('/api/avaliacoes-troca',createReplacementRouter({store,repository,sync}));
  app.use('/api',(_req,res)=>res.status(404).json({message:'Rota não encontrada.'}));
  app.use(express.static(path.join(config.root,'frontend')));
  app.use((_req,res)=>res.status(404).json({message:'Recurso não encontrado.'}));
  app.use((error,_req,res,_next)=>{
    const status=error.status || 500;
    res.status(status).json({message:status<500 ? (error.type==='entity.parse.failed'?'JSON inválido.':error.message) : 'Não foi possível concluir a operação na demo.'});
  });
  return app;
}
if(require.main===module){
  const config=getConfig(),app=createApp(config),server=http.createServer({requestTimeout:15000,headersTimeout:10000,keepAliveTimeout:5000,maxHeaderSize:16384},app);
  server.listen(config.port,config.host,()=>console.log(`Inventário Demo: http://${config.host}:${config.port} · dados inteiramente fictícios`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{app.locals.repository.close();process.exit(0);}));
}
module.exports={createApp};
