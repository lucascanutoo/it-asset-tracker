'use strict';
const A = window.InventoryAnalytics;
const $ = (selector) => document.querySelector(selector);
const pages = { visao: ['VISÃO GERAL DO INVENTÁRIO', 'Consulta, distribuição e análise dos equipamentos'], alugadas: ['MÁQUINAS ALUGADAS', 'Acompanhamento dos equipamentos alugados'] };
const fields = [['nome_maquina','Máquina'],['usuario','Usuário'],['setor','Setor'],['tipo_maquina','Tipo'],['sistema_operacional','Sistema operacional'],['tipo_aquisicao','Aquisição']];
const labels = Object.fromEntries(fields);
const statusLabels = { com_usuario: 'Com usuário', sem_usuario: 'Sem usuário', sem_setor: 'Sem setor' };
const colors = ['#164b56', '#FF6C1C', '#6771A5', '#A5ADC9', '#BCC4DB', '#667085'];
const state = { rows: [], page: 'visao', filters: {}, machine: '', user: '', status: '', tablePage: 1, pageSize: 25, sort: 'nome_maquina', direction: 'asc', loaded: false };
let requestNumber = 0;
let selectedRows = [];
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function readUrl() {
  const params = new URLSearchParams(location.search);
  state.page = pages[params.get('page')] ? params.get('page') : 'visao';
  state.machine = params.get('machine') || ''; state.user = params.get('user') || '';
  state.status = statusLabels[params.get('status')] ? params.get('status') : '';
  state.filters = Object.fromEntries(A.dimensions.map((key) => [key, params.getAll(key)]));
  if (state.page === 'alugadas') state.filters.tipo_aquisicao = [];
  state.tablePage = 1;
  if (params.get('page') === 'inventario') saveUrl();
}
function saveUrl() {
  const params = new URLSearchParams({ page: state.page });
  if (state.machine) params.set('machine', state.machine);
  if (state.user) params.set('user', state.user);
  if (state.status) params.set('status', state.status);
  for (const field of A.dimensions) for (const value of state.filters[field] || []) params.append(field, value);
  history.replaceState(null, '', '?' + params.toString());
}
function update() { state.tablePage = 1; saveUrl(); render(); }
function toggle(field, value, multi = false) {
  const current = state.filters[field] || [];
  state.filters[field] = current.includes(value) ? current.filter((item) => item !== value) : multi ? [...current, value] : [value];
  update();
}
function metric(label, count, selected, handler, attention = false) {
  const element = node(handler ? 'button' : 'article', 'metric-card' + (attention ? ' attention' : '') + (selected ? ' selected' : ''));
  if (handler) { element.type = 'button'; element.setAttribute('aria-pressed', String(selected)); element.addEventListener('click', handler); }
  element.append(node('span', '', label), node('strong', '', count.toLocaleString('pt-BR')));
  if (handler) element.title = 'Clique para aplicar ou remover este filtro';
  return element;
}
function renderMetrics(rows) {
  const counts = A.summarize(rows);
  const toggleStatus = (status) => () => { state.status = state.status === status ? '' : status; update(); };
  const total = metric(state.page === 'alugadas' ? 'Total alugadas' : 'Total máquinas', counts.total, false);
  const cards = [total, metric('Com usuário', counts.com_usuario, state.status === 'com_usuario', toggleStatus('com_usuario')),
    metric('Sem usuário', counts.sem_usuario, state.status === 'sem_usuario', toggleStatus('sem_usuario'), true),
    metric('Total de setores', counts.setores, false)];
  if (state.page === 'visao') cards.push(metric('Sem setor', counts.sem_setor, state.status === 'sem_setor', toggleStatus('sem_setor'), true));
  $('#metrics').replaceChildren(...cards);
}
function renderFilters(rows) {
  $('#machine-filter').value = state.machine; $('#user-filter').value = state.user;
  document.querySelectorAll('select[data-field]').forEach((select) => {
    const field = select.dataset.field;
    const values = A.group(A.filter(rows, state, field), field).map((group) => group.name);
    const selected = state.filters[field] || [];
    const options = [...new Set([...values, ...selected])].sort((a,b) => a.localeCompare(b, 'pt-BR'));
    select.replaceChildren(new Option(selected.length > 1 ? selected.length + ' selecionados' : 'Todos', ''), ...options.map((value) => new Option(value, value)));
    select.value = selected.length === 1 ? selected[0] : '';
    select.disabled = field === 'tipo_aquisicao' && state.page === 'alugadas';
    if (select.disabled) { select.replaceChildren(new Option('Alugado', '')); }
  });
  const chips = [];
  function chip(label, action) {
    const button = node('button', 'filter-chip', label + ' ×'); button.type = 'button'; button.setAttribute('aria-label', 'Remover filtro ' + label);
    button.addEventListener('click', action); chips.push(button);
  }
  for (const field of A.dimensions) for (const value of state.filters[field] || []) chip(labels[field] + ': ' + value, () => toggle(field, value, true));
  if (state.machine) chip('Máquina: ' + state.machine, () => { state.machine = ''; update(); });
  if (state.user) chip('Usuário: ' + state.user, () => { state.user = ''; update(); });
  if (state.status) chip(statusLabels[state.status], () => { state.status = ''; update(); });
  if (state.page === 'alugadas') chips.unshift(node('span', 'filter-chip fixed-chip', 'Aquisição: Alugado'));
  $('#filter-chips').replaceChildren(...chips);
}
function chartPanel(title, wide = false) {
  const panel = node('article', 'panel chart-panel' + (wide ? ' chart-wide' : ''));
  const heading = node('div', 'panel-heading'); const group = node('div');
  group.append(node('h2', '', title)); heading.append(group); panel.append(heading);
  return panel;
}
function barChart(title, field, rows, missingOnly = false, wide = false) {
  const panel = chartPanel(title, wide); const list = node('div', 'chart-bars');
  const data = A.group(rows, field); const max = Math.max(1, ...data.map((item) => item.count));
  for (const item of data) {
    const selected = (state.filters[field] || []).includes(item.name) && (!missingOnly || state.status === 'sem_usuario');
    const button = node('button', 'chart-bar-row' + (selected ? ' selected' : '')); button.type = 'button';
    button.setAttribute('aria-pressed', String(selected));
    const percent = rows.length ? (item.count / rows.length * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : 0;
    button.title = item.name + ': ' + item.count + ' (' + percent + '%). Clique para filtrar.';
    const track = node('span', 'chart-bar-track'); const bar = node('span', 'chart-bar-fill'); bar.style.width = (item.count / max * 100) + '%'; track.append(bar);
    button.append(node('span', 'chart-bar-label', item.name), track, node('strong', '', item.count));
    button.addEventListener('click', (event) => {
      if (missingOnly) state.status = 'sem_usuario';
      toggle(field, item.name, event.ctrlKey || event.metaKey);
    }); list.append(button);
  }
  if (!data.length) list.append(node('p', 'chart-empty', 'Sem dados para os filtros selecionados.'));
  panel.append(list); return panel;
}
function pieChart(title, rows) {
  const panel = chartPanel(title); const body = node('div', 'pie-body'); const data = A.group(rows, 'tipo_maquina');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 220 220'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', title);
  const legend = node('div', 'chart-legend'); let angle = -Math.PI / 2;
  for (const [index, item] of data.entries()) {
    const color = colors[index % colors.length]; const end = angle + item.count / rows.length * Math.PI * 2;
    const path = document.createElementNS(svg.namespaceURI, 'path');
    if (data.length === 1) path.setAttribute('d', 'M110,14 A96,96 0 1,1 109.999,14 Z');
    else path.setAttribute('d', 'M110,110 L' + (110 + 96 * Math.cos(angle)) + ',' + (110 + 96 * Math.sin(angle)) + ' A96,96 0 ' + (end-angle > Math.PI ? 1 : 0) + ',1 ' + (110 + 96 * Math.cos(end)) + ',' + (110 + 96 * Math.sin(end)) + ' Z');
    path.setAttribute('fill', color); path.setAttribute('stroke', '#fff'); path.setAttribute('stroke-width', '2'); path.setAttribute('tabindex', '0'); path.setAttribute('role', 'button');
    const selected = (state.filters.tipo_maquina || []).includes(item.name); path.setAttribute('aria-pressed', String(selected));
    const percent = (item.count / rows.length * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    path.setAttribute('aria-label', item.name + ': ' + item.count + ', ' + percent + '%');
    const titleNode = document.createElementNS(svg.namespaceURI, 'title'); titleNode.textContent = item.name + ': ' + item.count + ' (' + percent + '%)'; path.append(titleNode);
    const choose = (event) => toggle('tipo_maquina', item.name, event.ctrlKey || event.metaKey);
    path.addEventListener('click', choose); path.addEventListener('keydown', (event) => { if (['Enter',' '].includes(event.key)) { event.preventDefault(); choose(event); } });
    svg.append(path);
    const button = node('button', 'legend-button' + (selected ? ' selected' : '')); button.type = 'button'; button.setAttribute('aria-pressed', String(selected));
    const dot = node('span', 'legend-dot'); dot.style.backgroundColor = color;
    button.append(dot, node('span', '', item.name), node('strong', '', item.count + ' · ' + percent + '%')); button.addEventListener('click', choose); legend.append(button);
    angle = end;
  }
  if (!data.length) body.append(node('p', 'chart-empty', 'Sem dados para os filtros selecionados.'));
  else body.append(svg, legend);
  panel.append(body); return panel;
}
function renderCharts() {
  const charts = $('#charts');
  const sectors = A.filter(state.rows, state, 'setor'), types = A.filter(state.rows, state, 'tipo_maquina');
  const panels = [barChart(state.page === 'alugadas' ? 'Alugadas por Setor' : 'Máquinas por Setor', 'setor', sectors, false, true), pieChart(state.page === 'alugadas' ? 'Tipos de Máquinas' : 'Tipos de Equipamentos', types)];
  if (state.page === 'visao') panels.push(barChart('Sistemas Operacionais', 'sistema_operacional', A.filter(state.rows, state, 'sistema_operacional')),
    barChart('Máquinas sem Usuário por Setor', 'setor', A.filter(state.rows, { ...state, status: 'sem_usuario' }, 'setor'), true));
  charts.replaceChildren(...panels);
}
function openDetails(row) {
  $('#equipment-title').textContent = row.nome_maquina;
  $('#equipment-detail').replaceChildren(...[['Identificador', row.id_maquina], ...fields.slice(1).map(([key,label]) => [label, row[key] || 'Sem usuário'])].flatMap(([label,value]) => [node('dt','',label), node('dd','',value)]));
  $('#equipment-dialog').showModal();
}
function renderTable(rows) {
  selectedRows = A.sorted(rows, state.sort, state.direction);
  const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize)); state.tablePage = Math.min(totalPages, state.tablePage);
  $('#table-title').textContent = state.page === 'alugadas' ? 'Inventário de Máquinas Alugadas' : 'Inventário detalhado';
  $('#table-count').textContent = rows.length.toLocaleString('pt-BR') + ' equipamentos · clique na máquina para consultar detalhes';
  $('#table-head').replaceChildren(...fields.map(([key,label]) => {
    const th = node('th'); th.scope = 'col'; th.setAttribute('aria-sort', key === state.sort ? state.direction === 'asc' ? 'ascending' : 'descending' : 'none');
    const button = node('button','sort-button',label + (key === state.sort ? state.direction === 'asc' ? ' ↑' : ' ↓' : '')); button.type = 'button';
    button.addEventListener('click', () => { state.direction = state.sort === key && state.direction === 'asc' ? 'desc' : 'asc'; state.sort = key; renderTable(rows); }); th.append(button); return th;
  }));
  $('#table-body').replaceChildren(...selectedRows.slice((state.tablePage-1)*state.pageSize, state.tablePage*state.pageSize).map((row) => {
    const tr = node('tr');
    for (const [key] of fields) {
      const td = node('td');
      if (key === 'nome_maquina') { const button = node('button','text-button machine-name',row[key]); button.type = 'button'; button.addEventListener('click', () => openDetails(row)); td.append(button); }
      else td.textContent = row[key] || 'Sem usuário';
      tr.append(td);
    } return tr;
  }));
  $('#empty-state').hidden = rows.length > 0; $('#export-csv').disabled = rows.length === 0;
  $('#pagination-status').textContent = 'Página ' + state.tablePage + ' de ' + totalPages;
  $('#previous').disabled = state.tablePage === 1; $('#next').disabled = state.tablePage >= totalPages;
}
function render() {
  const rows = A.filter(state.rows, state);
  $('#page-title').textContent = pages[state.page][0]; $('#page-subtitle').textContent = pages[state.page][1];
  document.title = pages[state.page][0] + ' | Inventário Demo';
  document.querySelectorAll('[data-page]').forEach((link) => { const active = link.dataset.page === state.page; link.classList.toggle('active', active); if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
  renderMetrics(rows); renderFilters(state.rows); renderCharts(); renderTable(rows);
  $('#filter-summary').textContent = rows.length + ' de ' + (state.page === 'alugadas' ? state.rows.filter((row) => row.tipo_aquisicao === 'Alugado').length : state.rows.length) + ' equipamentos';
}
async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Não foi possível carregar o inventário.');
  return data;
}
async function load() {
  const number = ++requestNumber;
  $('#refresh-data').disabled = true; $('#feedback').hidden = true;
  $('#loading-state').hidden = false; $('#loading-state').textContent = 'Atualizando inventário…';
  try {
    const [data, session] = await Promise.all([fetchJson('/api/analytics'), fetchJson('/api/session')]);
    if (number !== requestNumber) return;
    state.rows = data.items.map(A.normalize); state.loaded = true; render();
    $('#dashboard-content').hidden = false;
    $('#session-user').textContent = session.name + ' · ' + ({admin:'Administrador',editor:'Editor',reader:'Leitor'}[session.role] || session.role);
    $('#updated-at').textContent = 'Atualizado às ' + new Date(data.updatedAt).toLocaleTimeString('pt-BR');
  } catch (error) { $('#feedback').textContent = error.message + (state.loaded ? ' Os dados exibidos são da última atualização bem-sucedida.' : ' Use Atualizar dados para tentar novamente.'); $('#feedback').hidden = false; }
  finally { if (number === requestNumber) { $('#refresh-data').disabled = false; $('#loading-state').hidden = true; } }
}
document.querySelectorAll('[data-page]').forEach((link) => link.addEventListener('click', (event) => {
  event.preventDefault(); state.page = link.dataset.page; if (state.page === 'alugadas') state.filters.tipo_aquisicao = []; update();
}));
for (const [selector,key] of [['#machine-filter','machine'],['#user-filter','user']]) $(selector).addEventListener('input', (event) => {
  const start = event.target.selectionStart; state[key] = event.target.value; update(); if (start !== null) event.target.setSelectionRange(start,start);
});
document.querySelectorAll('select[data-field]').forEach((select) => select.addEventListener('change', () => { state.filters[select.dataset.field] = select.value ? [select.value] : []; update(); }));
$('#reset-filters').addEventListener('click', () => { state.filters = {}; state.machine = ''; state.user = ''; state.status = ''; update(); });
$('#refresh-data').addEventListener('click', load);
$('#previous').addEventListener('click', () => { state.tablePage--; renderTable(A.filter(state.rows,state)); });
$('#next').addEventListener('click', () => { state.tablePage++; renderTable(A.filter(state.rows,state)); });
$('#page-size').addEventListener('change', (event) => { state.pageSize = Number(event.target.value); state.tablePage = 1; renderTable(A.filter(state.rows,state)); });
$('#close-detail').addEventListener('click', () => $('#equipment-dialog').close());
$('#export-csv').addEventListener('click', () => { const url = URL.createObjectURL(new Blob([A.csv(selectedRows)],{type:'text/csv;charset=utf-8'})); const link = node('a'); link.href = url; link.download = 'inventario-' + state.page + '-' + new Date().toISOString().slice(0,10) + '.csv'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
window.addEventListener('popstate', () => { readUrl(); if (state.loaded) render(); });
readUrl(); load();
