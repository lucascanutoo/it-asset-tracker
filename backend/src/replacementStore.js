'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { matchMachine } = require('./replacementScore');
const { normalizeMachineId, sameMachineId } = require('./machineIdentity');
const { saveDeliveryInventory } = require('./deliveryInventory');
const statuses = ['Pendente', 'Em análise', 'Aprovado'];
const deliveryStatuses = ['Aguardando entrega', 'Agendada', 'Entregue'];
const emptyDelivery = () => ({ status: 'Aguardando entrega', model: '', asset: '', serial: '', date: '', receivedBy: '', notes: '' });
function migrateApproval(item) {
  if (item.machineId != null && normalizeMachineId(item.machineId) !== null) item.machineId = normalizeMachineId(item.machineId);
  if (['Aprovada', 'Substituído', 'Descartada'].includes(item.status)) {
    const previous = item.status;
    item.legacyStatus ||= previous;
    item.status = previous === 'Descartada' ? 'Pendente' : 'Aprovado';
    if (previous === 'Substituído') item.delivery ||= { ...emptyDelivery(), status: 'Entregue', legacy: true };
  }
  if (item.status === 'Aprovado') {
    item.approvedAt ||= item.updatedAt;
    item.approvedBy ||= item.updatedBy;
    item.delivery ||= emptyDelivery();
  }
  return item;
}
function createReplacementStore(file) {
  let queue = Promise.resolve();
  async function read() {
    try {
      const data = JSON.parse(await fs.readFile(file, 'utf8'));
      if (data.version !== 1 || !Array.isArray(data.items)) throw Error('Arquivo de avaliações inválido.');
      data.items.forEach(migrateApproval);
      return data;
    } catch (error) { if (error.code === 'ENOENT') return { version: 1, items: [], sync: {} }; throw error; }
  }
  async function persist(data) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(tmp, JSON.stringify(data), { mode: 0o600 });
        for (let attempt = 0; ; attempt++) {
          try { await fs.rename(tmp, file); break; }
          catch (error) {
            if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 4) throw error;
            await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
          }
        }
      }
      catch (error) { await fs.unlink(tmp).catch(() => {}); throw error; }
  }
  function mutate(work) {
    const pending = queue.then(async () => {
      const data = await read(), result = await work(data, () => persist(data));
      await persist(data);
      return result;
    });
    queue = pending.catch(() => {});
    return pending;
  }
  async function importRows(rows, machines, actor, syncTime) {
    return mutate(data => {
      let inserted = 0, updated = 0;
      for (const row of rows) {
        const source = row.sourceId ? (row.source === 'microsoft' ? 'microsoft' : 'google') : 'manual';
        // A cleaned-up test must not return when its cloud response is polled again.
        if (row.sourceId && (data.excludedResponses || []).some(entry => entry.source === source && entry.sourceId === row.sourceId)) continue;
        const fingerprint = createHash('sha256').update(JSON.stringify(row)).digest('hex');
        const existing = row.sourceId && data.items.find(i => i.source === source && i.sourceId === row.sourceId);
        if (existing?.fingerprint === fingerprint) continue;
        const now = new Date(Math.max(Date.now(), existing ? Date.parse(existing.updatedAt) + 1 : 0)).toISOString();
        if (existing) {
          existing.history ||= [];
          existing.history.push({ ...existing, history: undefined });
          if (existing.status === 'Aprovado') existing.sourceChanged = true;
          if (existing.machineName !== row.machineName && existing.status !== 'Aprovado') {
            existing.machineId = matchMachine(row.machineName, machines);
            existing.status = 'Pendente';
            existing.technicalNotes = '';
          }
          Object.assign(existing, row, { fingerprint, updatedAt: now, updatedBy: actor });
          updated++;
        } else {
          data.items.push({ ...row, fingerprint, id: randomUUID(), source,
            submittedAt: row.submittedAt || now, machineId: matchMachine(row.machineName, machines),
            status: 'Pendente', technicalNotes: '', createdAt: now, updatedAt: now, updatedBy: actor, history: [] });
          inserted++;
        }
      }
      if (syncTime) data.sync = { lastSuccess: syncTime, received: rows.length, inserted, updated };
      return { inserted, updated };
    });
  }
  async function review(id, body, machines, actor) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(Error('Análise inválida.'), { status: 400 });
    if (!statuses.includes(body.status) || typeof body.technicalNotes !== 'string' || body.technicalNotes.length > 3000) throw Object.assign(Error('Aprovação ou parecer técnico inválido.'), { status: 400 });
    const machineId = normalizeMachineId(body.machineId);
    if (body.machineId !== null && (machineId === null || !machines.some(m => sameMachineId(m.id_maquina, machineId)))) throw Object.assign(Error('Selecione uma máquina válida.'), { status: 400 });
    return mutate(data => {
      const item = data.items.find(i => i.id === id);
      if (!item) throw Object.assign(Error('Avaliação não encontrada.'), { status: 404 });
      if (body.expectedUpdatedAt !== item.updatedAt) throw Object.assign(Error('Esta avaliação foi alterada. Atualize a lista antes de salvar.'), { status: 409 });
      if (item.inventoryOperation) throw Object.assign(Error('Conclua o cadastro pendente no controle de entrega antes de alterar a aprovação.'), { status: 409 });
      if (item.delivery?.status === 'Entregue' && (body.status !== 'Aprovado' || (machineId === null ? item.machineId !== null : !sameMachineId(machineId, item.machineId)))) throw Object.assign(Error('A entrega já foi concluída. Corrija o registro da entrega antes de alterar a aprovação ou o equipamento.'), { status: 409 });
      if (body.status === 'Aprovado' && machineId !== null && data.items.some(other => other.id !== id && other.status === 'Aprovado' && sameMachineId(other.machineId, machineId) && other.delivery?.status !== 'Entregue')) throw Object.assign(Error('Este equipamento já possui uma aprovação aguardando entrega. Consulte a tabela de entregas.'), { status: 409 });
      item.history ||= [];
      item.history.push({ ...item, history: undefined });
      if (body.status === 'Aprovado') {
        if (item.status !== 'Aprovado') { item.approvedAt = new Date().toISOString(); item.approvedBy = actor; }
        item.delivery ||= emptyDelivery();
      }
      Object.assign(item, { machineId, status: body.status, technicalNotes: body.technicalNotes.trim(), updatedAt: new Date(Math.max(Date.now(), Date.parse(item.updatedAt) + 1)).toISOString(), updatedBy: actor });
      return item;
    });
  }
  async function updateDelivery(id, body, actor, repository) {
    const invalid = message => Object.assign(Error(message), { status: 400 });
    if (!body || typeof body !== 'object' || !deliveryStatuses.includes(body.status)) throw invalid('Situação de entrega inválida.');
    const delivery = { status: body.status };
    for (const [key, max] of Object.entries({ model: 200, asset: 100, serial: 100, date: 10, receivedBy: 150, notes: 3000 })) {
      const value = ['model','asset','serial'].includes(key) && body[key] === undefined ? '' : body[key];
      if (typeof value !== 'string' || value.trim().length > max) throw invalid('Preencha os dados de entrega dentro dos limites permitidos.');
      delivery[key] = value.trim();
    }
    if (delivery.date && (!/^\d{4}-\d{2}-\d{2}$/.test(delivery.date) || !Number.isFinite(Date.parse(delivery.date)) || new Date(delivery.date).toISOString().slice(0, 10) !== delivery.date)) throw invalid('Informe uma data de entrega válida.');
    if (delivery.status === 'Agendada' && !delivery.date) throw invalid('Informe a data prevista para a entrega agendada.');
    if (delivery.status === 'Entregue') {
      if (!delivery.date || !delivery.receivedBy || (!repository && !delivery.asset && !delivery.serial)) throw invalid(repository ? 'Para concluir a entrega, informe a data e quem recebeu o notebook.' : 'Para concluir a entrega, informe a data, quem recebeu e o patrimônio ou número de série do notebook.');
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      if (delivery.date > today) throw invalid('A data de uma entrega concluída não pode estar no futuro.');
    }
    return mutate(async (data, save) => {
      const item = data.items.find(i => i.id === id);
      if (!item) throw Object.assign(Error('Avaliação não encontrada.'), { status: 404 });
      if (item.status !== 'Aprovado') throw Object.assign(Error('A avaliação precisa estar aprovada para controlar a entrega.'), { status: 409 });
      if (body.expectedUpdatedAt !== item.updatedAt) throw Object.assign(Error('Este registro foi alterado. Atualize a lista antes de salvar.'), { status: 409 });
      const before = { ...item, history: undefined, inventoryOperation: undefined };
      if (repository && normalizeMachineId(body.inventoryMachineId) !== null && data.items.some(other => other.id !== id && other.status === 'Aprovado' && sameMachineId(other.delivery?.inventoryMachineId, body.inventoryMachineId))) throw Object.assign(Error('Este notebook já está vinculado a outra entrega aprovada.'), { status: 409 });
      const registration = repository ? await saveDeliveryInventory({ item, body, repository, persist: save, actor }) : {};
      item.history ||= [];
      item.history.push(before);
      const now = new Date(Math.max(Date.now(), Date.parse(item.updatedAt) + 1)).toISOString();
      item.delivery = { ...delivery, model: body.model ?? item.delivery?.model ?? '', asset: body.asset ?? item.delivery?.asset ?? '', serial: body.serial ?? item.delivery?.serial ?? '', ...registration, updatedAt: now, updatedBy: actor };
      delete item.inventoryOperation;
      item.updatedAt = now; item.updatedBy = actor;
      return item;
    });
  }
  return { read, importRows, review, updateDelivery };
}
module.exports = { createReplacementStore, statuses, deliveryStatuses };
