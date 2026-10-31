(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InventoryAnalytics = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const dimensions = ['setor', 'tipo_maquina', 'sistema_operacional', 'tipo_aquisicao'];
  const clean = (value) => String(value ?? '').trim();
  const fold = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function normalize(row) {
    const type = fold(row.tipo_maquina);
    const acquisition = fold(row.tipo_aquisicao);
    return { ...row,
      nome_maquina: clean(row.nome_maquina), usuario: clean(row.usuario),
      setor: clean(row.setor) || 'Sem setor',
      sistema_operacional: clean(row.sistema_operacional) || 'Não informado',
      tipo_maquina: type.startsWith('note') ? 'Notebook' : ['desk', 'desktop'].includes(type) ? 'Desktop' : clean(row.tipo_maquina) || 'Não informado',
      tipo_aquisicao: ['locacao', 'alugado'].includes(acquisition) ? 'Alugado' : ['ativo', 'proprio'].includes(acquisition) ? 'Ativo' : clean(row.tipo_aquisicao) || 'Não informado'
    };
  }
  function filter(rows, state, except = '') {
    return rows.filter((row) => {
      if (state.page === 'alugadas' && row.tipo_aquisicao !== 'Alugado') return false;
      if (!fold(row.nome_maquina).includes(fold(state.machine))) return false;
      if (!fold(row.usuario).includes(fold(state.user))) return false;
      if (state.status === 'sem_usuario' && row.usuario) return false;
      if (state.status === 'com_usuario' && !row.usuario) return false;
      if (state.status === 'sem_setor' && row.setor !== 'Sem setor') return false;
      return dimensions.every((field) => field === except || !state.filters[field]?.length || state.filters[field].includes(row[field]));
    });
  }
  function summarize(rows) {
    return { total: rows.length,
      com_usuario: rows.filter((row) => row.usuario).length,
      sem_usuario: rows.filter((row) => !row.usuario).length,
      sem_setor: rows.filter((row) => row.setor === 'Sem setor').length,
      setores: new Set(rows.filter((row) => row.setor !== 'Sem setor').map((row) => row.setor)).size,
      alugadas: rows.filter((row) => row.tipo_aquisicao === 'Alugado').length,
      ativos: rows.filter((row) => row.tipo_aquisicao === 'Ativo').length
    };
  }
  function group(rows, field) {
    const counts = new Map();
    for (const row of rows) counts.set(row[field], (counts.get(row[field]) || 0) + 1);
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
  }
  function sorted(rows, key, direction) {
    return [...rows].sort((a, b) => (clean(a[key]).localeCompare(clean(b[key]), 'pt-BR', { numeric: true }) || a.id_maquina - b.id_maquina) * (direction === 'desc' ? -1 : 1));
  }
  function csv(rows) {
    const fields = ['nome_maquina', 'usuario', 'setor', 'tipo_maquina', 'sistema_operacional', 'tipo_aquisicao'];
    const quote = (value) => '"' + (/^[=+\-@\t\r\n]/.test(String(value ?? '')) ? "'" : '') + String(value ?? '').replace(/"/g, '""') + '"';
    return '\ufeff' + [['Máquina', 'Usuário', 'Setor', 'Tipo', 'Sistema operacional', 'Aquisição'], ...rows.map((row) => fields.map((field) => row[field]))].map((row) => row.map(quote).join(';')).join('\r\n');
  }
  return { dimensions, normalize, filter, summarize, group, sorted, csv };
});
