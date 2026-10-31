const { parseId, parseListQuery } = require('../validation');

function createMaquinasService(repository) {
  async function list(query) {
    const options = parseListQuery(query);
    const result = await repository.search(options);
    return {
      items: result.items,
      pagination: {
        page: options.page,
        pageSize: options.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / options.pageSize))
      }
    };
  }

  async function get(rawId) { return repository.get(parseId(rawId)); }
  async function create(body, actor) { return repository.create(body, actor); }
  async function update(rawId, body, actor) { return repository.update(parseId(rawId), body, actor); }
  async function remove(rawId, confirmedName, actor) {
    const id = parseId(rawId);
    const machine = await repository.get(id);
    if (!machine) return { found: false };
    if (confirmedName !== machine.nome_maquina) {
      const error = new Error('Confirme o nome da máquina antes de excluir.');
      error.status = 400;
      throw error;
    }
    return { found: await repository.remove(id, machine.nome_maquina, actor), machine };
  }

  return { list, get, create, update, remove, dashboard: repository.dashboard, filters: repository.filters };
}

module.exports = { createMaquinasService };
