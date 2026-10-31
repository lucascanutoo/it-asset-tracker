'use strict';
const express = require('express');
const { authorize } = require('./auth');
const { normalizeEvaluation } = require('./replacementScore');
const { normalizeMachineId, sameMachineId } = require('./machineIdentity');
function createReplacementRouter({ store, repository, sync }) {
  const router = express.Router();
  const wrap = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
  router.use(authorize('admin'));
  router.get('/', wrap(async (_req, res) => {
    const [data, machines, connection] = await Promise.all([store.read(), repository.list(), sync.status()]);
    const normalizedMachines = machines.map(m => ({ ...m, id_maquina: normalizeMachineId(m.id_maquina) })).filter(m => m.id_maquina !== null);
    const items = data.items.map(({ history, fingerprint, ...item }) => ({ ...item, machine: normalizedMachines.find(m => sameMachineId(m.id_maquina, item.machineId)) || null, revisions: history?.length || 0 }));
    res.json({ items, machines: normalizedMachines, sync: { ...data.sync, ...connection } });
  }));
  router.get('/:id/history', wrap(async (req, res) => {
    const item = (await store.read()).items.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ message: 'Avaliação não encontrada.' });
    res.json({ items: (item.history || []).map(({ fingerprint, ...row }) => row) });
  }));
  router.post('/', wrap(async (req, res) => {
    const row = normalizeEvaluation(req.body);
    const result = await store.importRows([row], await repository.list(), req.user.name);
    res.status(201).json(result);
  }));
  router.put('/:id/review', wrap(async (req, res) => {
    const item = await store.review(req.params.id, req.body, await repository.list(), req.user.name);
    res.json({ id: item.id, updatedAt: item.updatedAt });
  }));
  router.put('/:id/delivery', wrap(async (req, res) => {
    const item = await store.updateDelivery(req.params.id, req.body, req.user.name, repository);
    res.json({ id: item.id, updatedAt: item.updatedAt, inventoryMachineId: item.delivery.inventoryMachineId });
  }));
  router.post('/sync', (_req, res) => res.status(410).json({ message: 'Integrações externas não existem nesta demo.' }));
  return router;
}
module.exports = { createReplacementRouter };
