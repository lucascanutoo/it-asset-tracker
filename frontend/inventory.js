const API = '/api/maquinas';
const state = { items: [], page: 1, pageSize: 25, totalPages: 1, sort: 'nome_maquina', direction: 'asc', role: 'reader', editingId: null, deletingId: null, deletingName: null };
const $ = (selector) => document.querySelector(selector);
const createForm = $('#create-form');
const editForm = $('#edit-form');
const editDialog = $('#edit-dialog');
const deleteDialog = $('#delete-dialog');
const createDialog = $('#create-dialog');
let csrfToken = '';

async function request(url, options = {}) {
  let response;
  try { response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}), ...options.headers } }); }
  catch { throw new Error('Não foi possível conectar ao servidor.'); }
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Não foi possível concluir a operação.');
  return body;
}

function showFeedback(message, kind = 'success') {
  const element = $('#feedback'); element.textContent = message; element.className = `feedback ${kind}`; element.hidden = false;
}
function display(value) { return value === null || value === undefined || value === '' ? '—' : String(value); }
function acquisition(value) { return ['Locação', 'Alugado'].includes(value) ? 'Alugado' : ['Ativo', 'Próprio'].includes(value) ? 'Ativo' : display(value); }
function addCell(row, value, className = '') { const cell = document.createElement('td'); cell.textContent = display(value); cell.className = className; row.append(cell); }

function render() {
  const tbody = $('#machine-rows'); tbody.replaceChildren();
  for (const item of state.items) {
    const row = document.createElement('tr');
    const nameCell = document.createElement('td'); const detail = document.createElement('button');
    detail.type = 'button'; detail.className = 'text-button machine-name'; detail.textContent = item.nome_maquina;
    detail.addEventListener('click', () => openDetail(item.id_maquina)); nameCell.append(detail); row.append(nameCell);
    addCell(row, item.usuario); addCell(row, item.setor); addCell(row, item.tipo_maquina);
    addCell(row, item.sistema_operacional); addCell(row, acquisition(item.tipo_aquisicao));
    tbody.append(row);
  }
  $('#result-count').textContent = `${state.items.length} nesta página`;
  $('#page-status').textContent = `Página ${state.page} de ${state.totalPages}`;
  $('#previous-page').disabled = state.page <= 1; $('#next-page').disabled = state.page >= state.totalPages;
  $('#table-message').hidden = state.items.length > 0; $('#table-message').textContent = 'Nenhum equipamento encontrado.';
}

function actionButton(label, handler, danger = false) {
  const button = document.createElement('button'); button.type = 'button'; button.className = `text-button${danger ? ' danger-text' : ''}`;
  button.textContent = label; button.addEventListener('click', handler); return button;
}

function params() {
  return new URLSearchParams({ page: state.page, pageSize: state.pageSize, q: $('#search').value.trim(), setor: $('#filter-sector').value,
    tipo: $('#filter-type').value, aquisicao: $('#filter-acquisition').value, sort: state.sort, direction: state.direction });
}
async function loadMachines() {
  const data = await request(`${API}?${params()}`); state.items = data.items; state.totalPages = data.pagination.totalPages;
  if (state.page > state.totalPages) { state.page = state.totalPages; return loadMachines(); } render();
}

function addOptions(select, values) {
  select.append(...values.map((value) => { const option = document.createElement('option'); option.value = value; option.textContent = value; return option; }));
}
async function initialize() {
  const [session, filters] = await Promise.all([request('/api/session'), request('/api/meta/filters')]);
  if (session.passwordChangeRequired) { location.replace('/definir-senha.html'); return; }
  state.role = session.role; csrfToken = session.csrfToken || ''; $('#session-user').textContent = `${session.name} · ${session.role}`;
  const canCreate = ['editor', 'admin'].includes(state.role);
  $('#open-create').disabled = !canCreate;
  $('#open-create').title = canCreate ? 'Cadastrar um novo equipamento' : 'Entre como administrador para cadastrar';
  $('#create-access-note').hidden = canCreate;
  addOptions($('#filter-sector'), filters.setores); addOptions($('#filter-type'), filters.tipos);
  const sectorSelect = $('#create-sector'); sectorSelect.replaceChildren(new Option('Selecione um setor', '')); addOptions(sectorSelect, filters.setores);
  $('#create-sector-search').disabled = false; sectorSelect.disabled = false;
  const datalist = $('#setores'); datalist.replaceChildren(...filters.setores.map((value) => new Option('', value)));
  fillOperatingSystems(filters.sistemas || []);
  await loadMachines();
}

function fillOperatingSystems(values) {
  for (const form of [createForm, editForm]) {
    const select = form.elements.namedItem('sistema_operacional');
    const selected = select.value;
    select.replaceChildren(new Option('Não informado', ''));
    addOptions(select, values);
    select.value = values.includes(selected) ? selected : '';
    select.disabled = false;
  }
}

function formPayload(form) { const data = new FormData(form); return Object.fromEntries(['nome_maquina','tipo_maquina','usuario','setor','sistema_operacional','tipo_aquisicao'].map((key) => [key, String(data.get(key) || '').trim() || null])); }
function setSelect(select, value) { if (value && ![...select.options].some((option) => option.value === value)) select.add(new Option(`${value} (existente)`, value)); select.value = value || ''; }

async function openDetail(id) {
  try {
    const item = await request(`${API}/${id}`); $('#detail-heading').textContent = item.nome_maquina;
    const fields = [['Usuário', item.usuario], ['Setor', item.setor], ['Tipo', item.tipo_maquina], ['Sistema operacional', item.sistema_operacional], ['Aquisição', acquisition(item.tipo_aquisicao)], ['Identificador', item.id_maquina]];
    $('#detail-list').replaceChildren(...fields.flatMap(([label, value]) => { const dt = document.createElement('dt'); dt.textContent = label; const dd = document.createElement('dd'); dd.textContent = display(value); return [dt, dd]; }));
    const dialog = $('#detail-dialog');
    let actions = $('#detail-actions');
    if (!actions) {
      actions = document.createElement('div'); actions.id = 'detail-actions'; actions.className = 'dialog-padding';
      $('#detail-list').after(actions);
    }
    actions.replaceChildren();
    if (['editor', 'admin'].includes(state.role)) actions.append(actionButton('Editar equipamento', () => { dialog.close(); openEdit(item.id_maquina); }));
    if (state.role === 'admin') actions.append(actionButton('Excluir equipamento', () => { dialog.close(); openDelete(item); }, true));
    actions.hidden = !actions.childElementCount;
    dialog.showModal();
  } catch (error) { showFeedback(error.message, 'error'); }
}
async function openEdit(id) {
  try {
    const [item, filters] = await Promise.all([request(`${API}/${id}`), request('/api/meta/filters')]); state.editingId = item.id_maquina;
    fillOperatingSystems(filters.sistemas || []);
    for (const key of ['nome_maquina','usuario','setor']) editForm.elements.namedItem(key).value = item[key] || '';
    editForm.elements.namedItem('sistema_operacional').value = item.sistema_operacional?.trim() || '';
    setSelect(editForm.elements.namedItem('tipo_maquina'), item.tipo_maquina); setSelect(editForm.elements.namedItem('tipo_aquisicao'), acquisition(item.tipo_aquisicao));
    $('#edit-feedback').hidden = true; editDialog.showModal();
  } catch (error) { showFeedback(error.message, 'error'); }
}
function openDelete(item) { state.deletingId = item.id_maquina; state.deletingName = item.nome_maquina; $('#delete-name').textContent = item.nome_maquina; deleteDialog.showModal(); }

$('#open-create').addEventListener('click', () => {
  if (!['editor', 'admin'].includes(state.role)) return;
  $('#create-feedback').hidden = true;
  createDialog.showModal();
  createForm.elements.namedItem('nome_maquina').focus();
});
createForm.addEventListener('submit', async (event) => { event.preventDefault(); if (!createForm.reportValidity()) return; const button = createForm.querySelector('[type=submit]'); button.disabled = true;
  $('#create-feedback').hidden = true;
  try {
    await request(API, { method: 'POST', body: JSON.stringify(formPayload(createForm)) });
    createForm.reset(); createDialog.close(); showFeedback('Equipamento cadastrado com sucesso.');
    state.page = 1;
    try { await loadMachines(); } catch { showFeedback('Equipamento cadastrado. Não foi possível atualizar a lista; recarregue a página.', 'error'); }
  }
  catch (error) { $('#create-feedback').textContent = error.message; $('#create-feedback').hidden = false; } finally { button.disabled = false; }
});
editForm.addEventListener('submit', async (event) => { event.preventDefault(); if (!editForm.reportValidity()) return; const button = editForm.querySelector('[type=submit]'); button.disabled = true;
  try { await request(`${API}/${state.editingId}`, { method: 'PUT', body: JSON.stringify(formPayload(editForm)) }); editDialog.close(); showFeedback('Equipamento atualizado com sucesso.'); await loadMachines(); }
  catch (error) { $('#edit-feedback').textContent = error.message; $('#edit-feedback').hidden = false; } finally { button.disabled = false; }
});
$('#confirm-delete').addEventListener('click', async () => { try { await request(`${API}/${state.deletingId}`, { method: 'DELETE', body: JSON.stringify({ confirmar_nome: state.deletingName }) }); deleteDialog.close(); showFeedback('Equipamento excluído com sucesso.'); await loadMachines(); } catch (error) { deleteDialog.close(); showFeedback(error.message, 'error'); } });

let debounce; $('#search').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => { state.page = 1; loadMachines().catch((error) => showFeedback(error.message, 'error')); }, 250); });
for (const id of ['filter-sector','filter-type','filter-acquisition']) $(id.startsWith('#') ? id : `#${id}`).addEventListener('change', () => { state.page = 1; loadMachines().catch((error) => showFeedback(error.message, 'error')); });
$('#clear-filters').addEventListener('click', () => { $('#search').value = ''; $('#filter-sector').value = ''; $('#filter-type').value = ''; $('#filter-acquisition').value = ''; state.page = 1; loadMachines(); });
$('#previous-page').addEventListener('click', () => { state.page--; loadMachines(); }); $('#next-page').addEventListener('click', () => { state.page++; loadMachines(); });
document.querySelectorAll('.sort-button').forEach((button) => button.addEventListener('click', () => { state.direction = state.sort === button.dataset.sort && state.direction === 'asc' ? 'desc' : 'asc'; state.sort = button.dataset.sort; loadMachines(); }));
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
$('#create-sector-search').addEventListener('input', () => { const value = $('#create-sector-search').value.toLocaleLowerCase('pt-BR'); [...$('#create-sector').options].forEach((option) => { option.hidden = Boolean(option.value && !option.textContent.toLocaleLowerCase('pt-BR').includes(value)); }); });
initialize().catch((error) => showFeedback(error.message, 'error'));
