const LENGTHS = {
  nome_maquina: 100,
  tipo_maquina: 50,
  usuario: 150,
  setor: 100,
  sistema_operacional: 100,
  tipo_aquisicao: 30
};

const EQUIPMENT_TYPES = new Map([
  ['notebook', 'Notebook'],
  ['desktop', 'Desktop'],
  ['desk', 'Desktop'],
  ['outros', 'Outros']
]);
const ACQUISITION_INPUT = new Map([
  ['próprio', 'Ativo'],
  ['proprio', 'Ativo'],
  ['ativo', 'Ativo'],
  ['alugado', 'Locação'],
  ['locação', 'Locação'],
  ['locacao', 'Locação']
]);

function cleanText(value, field, required = false) {
  if (value === null || value === undefined) {
    if (required) throw new ValidationError(`${field} é obrigatório.`);
    return null;
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`${field} deve ser um texto.`);
  }
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned) {
    if (required) throw new ValidationError(`${field} é obrigatório.`);
    return null;
  }
  if (cleaned.length > LENGTHS[field]) {
    throw new ValidationError(`${field} deve ter no máximo ${LENGTHS[field]} caracteres.`);
  }
  return cleaned;
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

function parseId(raw) {
  if (!/^\d+$/.test(String(raw))) throw new ValidationError('Identificador inválido.');
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
    throw new ValidationError('Identificador inválido.');
  }
  return id;
}

function parseListQuery(query = {}) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || 25);
  if (!Number.isInteger(page) || page < 1) throw new ValidationError('Página inválida.');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ValidationError('O tamanho da página deve estar entre 1 e 100.');
  }
  const allowedSorts = new Set(['nome_maquina', 'usuario', 'setor', 'tipo_maquina', 'sistema_operacional', 'tipo_aquisicao']);
  const sort = allowedSorts.has(query.sort) ? query.sort : 'nome_maquina';
  const direction = String(query.direction || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
  return {
    page,
    pageSize,
    sort,
    direction,
    q: cleanText(query.q, 'nome_maquina') || '',
    setor: cleanText(query.setor, 'setor') || '',
    tipo: cleanText(query.tipo, 'tipo_maquina') || '',
    aquisicao: cleanText(query.aquisicao, 'tipo_aquisicao') || ''
  };
}

function validateMachine(body, current = null) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Informe os dados do equipamento.');
  }

  const machine = {
    nome_maquina: cleanText(body.nome_maquina, 'nome_maquina', true),
    tipo_maquina: cleanText(body.tipo_maquina, 'tipo_maquina', true),
    usuario: cleanText(body.usuario, 'usuario'),
    setor: cleanText(body.setor, 'setor'),
    sistema_operacional: cleanText(body.sistema_operacional, 'sistema_operacional'),
    tipo_aquisicao: cleanText(body.tipo_aquisicao, 'tipo_aquisicao', true)
  };

  if (machine.tipo_maquina) {
    const normalizedType = EQUIPMENT_TYPES.get(machine.tipo_maquina.toLocaleLowerCase('pt-BR'));
    if (!normalizedType && machine.tipo_maquina !== current?.tipo_maquina) {
      throw new ValidationError('Selecione um tipo de equipamento válido.');
    }
    if (normalizedType) machine.tipo_maquina = normalizedType;
  }

  const mappedAcquisition = ACQUISITION_INPUT.get(machine.tipo_aquisicao.toLocaleLowerCase('pt-BR'));
  if (mappedAcquisition) {
    machine.tipo_aquisicao = mappedAcquisition;
  } else if (machine.tipo_aquisicao !== current?.tipo_aquisicao) {
    throw new ValidationError('Selecione um tipo de aquisição válido.');
  }

  return machine;
}

module.exports = { ValidationError, parseId, parseListQuery, validateMachine };
