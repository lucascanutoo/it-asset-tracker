const { write } = require('../logger');

function createMaquinasController(service) {
  return {
    list: async (req, res) => res.json(await service.list(req.query)),
    dashboard: async (_req, res) => res.json(await service.dashboard()),
    filters: async (_req, res) => res.json(await service.filters()),
    get: async (req, res) => {
      const item = await service.get(req.params.id);
      return item ? res.json(item) : res.status(404).json({ message: 'Equipamento não encontrado.' });
    },
    create: async (req, res) => {
      const item = await service.create(req.body, { name: req.user.name, role: req.user.role });
      write('info', 'machine_created', { id: item.id_maquina, user: req.user.name });
      return res.status(201).location(`/api/maquinas/${item.id_maquina}`).json(item);
    },
    update: async (req, res) => {
      const item = await service.update(req.params.id, req.body, { name: req.user.name, role: req.user.role });
      if (!item) return res.status(404).json({ message: 'Equipamento não encontrado.' });
      write('info', 'machine_updated', { id: item.id_maquina, user: req.user.name });
      return res.json(item);
    },
    remove: async (req, res) => {
      const result = await service.remove(req.params.id, req.body?.confirmar_nome, { name: req.user.name, role: req.user.role });
      if (!result.found) return res.status(404).json({ message: 'Equipamento não encontrado.' });
      write('info', 'machine_deleted', { id: result.machine.id_maquina, name: result.machine.nome_maquina, user: req.user.name });
      return res.status(204).send();
    }
  };
}

module.exports = { createMaquinasController };
