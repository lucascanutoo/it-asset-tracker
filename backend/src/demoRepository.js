const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const { validateMachine, ValidationError } = require('./validation');
const fields = ['nome_maquina','tipo_maquina','usuario','setor','sistema_operacional','tipo_aquisicao'];
const conflict = message => Object.assign(Error(message), { status: 409 });
function createDemoRepository(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'demo.sqlite'));
  db.exec(fs.readFileSync(path.resolve(__dirname, '../../banco-de-dados/schema.sql'), 'utf8'));
  function list() { return db.prepare('SELECT * FROM maquinas ORDER BY nome_maquina, id_maquina').all(); }
  function get(id) { return db.prepare('SELECT * FROM maquinas WHERE id_maquina = ?').get(id) || null; }
  function audit(action, before, after, actor) {
    const event = { id: randomUUID(), timestamp: new Date().toISOString(), action,
      actor: actor?.name || 'demo.admin', role: actor?.role || 'admin',
      machineId: (after || before).id_maquina, machine: (after || before).nome_maquina,
      before, after, status: 'confirmed', changes: fields.filter(f => (before?.[f] ?? null) !== (after?.[f] ?? null))
        .map(field => ({ field, before: before?.[field] ?? null, after: after?.[field] ?? null })) };
    db.prepare('INSERT INTO auditoria(event) VALUES (?)').run(JSON.stringify(event));
  }
  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function validate(body, current, id) {
    const row = validateMachine(body, current);
    if (list().some(m => m.id_maquina !== id && m.nome_maquina.toLocaleLowerCase('pt-BR') === row.nome_maquina.toLocaleLowerCase('pt-BR'))) throw conflict('Já existe uma máquina cadastrada com esse nome.');
    if (row.sistema_operacional && !filters().sistemas.includes(row.sistema_operacional)) throw new ValidationError('Selecione um sistema operacional cadastrado.');
    return row;
  }
  function create(body, actor) { return transaction(() => {
    const row = validate(body);
    const result = db.prepare(`INSERT INTO maquinas (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...fields.map(f => row[f]));
    const saved = get(Number(result.lastInsertRowid)); audit('create', null, saved, actor); return saved;
  }); }
  function update(id, body, actor, expected = null) { return transaction(() => {
    const current = get(id); if (!current) return null;
    if (expected && fields.some(f => (current[f] ?? null) !== (expected[f] ?? null))) throw conflict('O cadastro foi alterado. Atualize a página.');
    const row = validate(body, current, id);
    db.prepare(`UPDATE maquinas SET ${fields.map(f => f+'=?').join(',')} WHERE id_maquina=?`).run(...fields.map(f => row[f]), id);
    const saved = get(id); audit('update', current, saved, actor); return saved;
  }); }
  function remove(id, name, actor) { return transaction(() => {
    const row = get(id); if (!row || row.nome_maquina !== name) return false;
    db.prepare('DELETE FROM maquinas WHERE id_maquina=?').run(id); audit('delete', row, null, actor); return true;
  }); }
  function search(options) {
    const filtered = list().filter(m => (!options.q || [m.nome_maquina, m.usuario].some(v => String(v || '').toLocaleLowerCase('pt-BR').includes(options.q.toLocaleLowerCase('pt-BR'))))
      && (!options.setor || m.setor === options.setor) && (!options.tipo || m.tipo_maquina === options.tipo)
      && (!options.aquisicao || m.tipo_aquisicao === ({Alugado:'Locação', 'Próprio':'Ativo'}[options.aquisicao] || options.aquisicao)));
    filtered.sort((a,b) => String(a[options.sort] || '').localeCompare(String(b[options.sort] || ''), 'pt-BR') * (options.direction === 'desc' ? -1 : 1) || a.id_maquina - b.id_maquina);
    return { items: filtered.slice((options.page-1)*options.pageSize, options.page*options.pageSize), total: filtered.length };
  }
  function filters() {
    const rows = list(), unique = f => [...new Set(rows.map(m => m[f]).filter(Boolean))].sort();
    return { setores: unique('setor'), tipos: unique('tipo_maquina'), sistemas: ['Windows 11','Ubuntu 24.04','Windows 10'], aquisicoes: ['Ativo','Alugado'] };
  }
  function dashboard() {
    const rows = list(), count = fn => rows.filter(fn).length, bySector = new Map();
    for (const m of rows) bySector.set(m.setor || 'Sem setor', (bySector.get(m.setor || 'Sem setor') || 0) + 1);
    return { total: rows.length, notebooks: count(m => m.tipo_maquina === 'Notebook'), desktops: count(m => m.tipo_maquina === 'Desktop'),
      alugadas: count(m => m.tipo_aquisicao === 'Locação'), proprias: count(m => m.tipo_aquisicao === 'Ativo'),
      setores: [...bySector].map(([setor, quantidade]) => ({setor, quantidade})).sort((a,b) => b.quantidade-a.quantidade || a.setor.localeCompare(b.setor)) };
  }
  function queryAudit(query = {}) {
    const page = Number(query.page || 1), pageSize = Number(query.pageSize || 25);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new ValidationError('Paginação inválida.');
    for (const key of ['q','actor','action','from','to']) if (query[key] !== undefined && (typeof query[key] !== 'string' || query[key].length > 150)) throw new ValidationError('Filtro inválido.');
    for (const key of ['from','to']) if (query[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(query[key]) || !Number.isFinite(Date.parse(query[key])) || new Date(query[key]).toISOString().slice(0,10) !== query[key])) throw new ValidationError('Data inválida.');
    if (query.from && query.to && query.from > query.to) throw new ValidationError('Intervalo inválido.');
    if (query.action && !['create','update','delete'].includes(query.action)) throw new ValidationError('Operação inválida.');
    const all = db.prepare('SELECT event FROM auditoria ORDER BY id DESC').all().map(r => JSON.parse(r.event));
    const contains = (value, term) => String(value || '').toLocaleLowerCase('pt-BR').includes(String(term || '').toLocaleLowerCase('pt-BR'));
    const filtered = all.filter(e => { const date = new Date(e.timestamp).toLocaleDateString('sv-SE', {timeZone:'America/Sao_Paulo'});return (!query.action || e.action === query.action) && contains(e.actor,query.actor) && (!query.q || contains(JSON.stringify([e.machine,e.machineId,e.changes]),query.q)) && (!query.from || date >= query.from) && (!query.to || date <= query.to); });
    return { items: filtered.slice((page-1)*pageSize,page*pageSize), pagination: {page,pageSize,total:filtered.length,totalPages:Math.max(1,Math.ceil(filtered.length/pageSize))}, summary:{confirmed:all.length,pending:0,failed:0,damagedLines:0} };
  }
  function seed(machines) {
    if (list().length || db.prepare('SELECT COUNT(*) AS n FROM auditoria').get().n) return;
    transaction(() => { for (const machine of machines) { db.prepare(`INSERT INTO maquinas (id_maquina,${fields.join(',')}) VALUES (?,?,?,?,?,?,?)`).run(machine.id_maquina,...fields.map(f => machine[f])); audit('create',null,machine,{name:'demo.seed',role:'admin'}); } });
  }
  return {list,get,create,update,remove,search,filters,dashboard,queryAudit,seed,close:()=>db.close()};
}
module.exports = { createDemoRepository };
