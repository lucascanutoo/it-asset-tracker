'use strict';
(async function () {
  const $ = id => document.getElementById(id);
  let session, data = { items: [], machines: [], sync: {} }, selected, deliverySelected, deliveryInventoryBase;
  let inventoryFilters = { sistemas: [], setores: [] };
  const inventoryFields = ['nome_maquina','tipo_maquina','usuario','setor','sistema_operacional','tipo_aquisicao'];
  const frequency = { nenhuma:'Não apresenta falhas', raramente:'Raramente', mensal:'Algumas vezes por mês', semanal:'Algumas vezes por semana', diaria:'Diariamente', desconhecida:'Não sei informar' };
  const impact = { nenhum:'Não prejudica o trabalho', baixo:'Pouco: pequenos incômodos durante o trabalho', moderado:'Causa atrasos, mas ainda permite trabalhar', alto:'Compromete entregas e produtividade', critico:'Impede a realização de atividades essenciais', desconhecido:'Não sei informar' };
  const mobility = { fixa:'Não. O computador é utilizado em uma estação fixa.', frequente:'Sim, frequentemente: reuniões, outras unidades, campo ou viagens.', ocasional:'Sim, ocasionalmente.', desconhecida:'Não sei informar' };
  const date = value => value ? new Date(value).toLocaleString('pt-BR') : '—';
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function element(tag, text, cls) { const node = document.createElement(tag); if (text != null) node.textContent = text; if (cls) node.className = cls; return node; }
  function notice(target, message, error = false) { const node = $(target); node.textContent = message; node.hidden = !message; node.classList.toggle('error', error); }
  async function api(url, options = {}) {
    const response = await fetch(url, { cache:'no-store', ...options, headers: { 'Content-Type':'application/json', 'X-CSRF-Token': session?.csrfToken || '', ...options.headers } });
    if (response.status === 401) { location.replace('/login.html'); throw Error('Entre novamente para continuar.'); }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(body.message || 'Não foi possível concluir a operação.');
    return body;
  }
  function badge(priority) { return element('span', priority, `replacement-badge priority-${normalize(priority)}`); }
  function currentItems() {
    if (!$('latest').checked) return data.items;
    const latest = new Map(); const pending = [];
    for (const item of data.items) {
      if (!item.machine) { pending.push(item); continue; }
      const prev = latest.get(item.machineId);
      if (!prev || Date.parse(item.submittedAt) > Date.parse(prev.submittedAt) || (item.submittedAt === prev.submittedAt && item.createdAt > prev.createdAt)) latest.set(item.machineId, item);
    }
    return [...latest.values(), ...pending];
  }
  function render() {
    const current = currentItems();
    $('metrics').replaceChildren(...[
      ['Avaliações', current.length], ['Prioridade crítica', current.filter(i => i.priority === 'Crítica').length],
      ['Aguardando aprovação', current.filter(i => ['Pendente','Em análise'].includes(i.status)).length], ['Aguardando entrega', data.items.filter(i => i.status === 'Aprovado' && i.delivery?.status !== 'Entregue').length]
    ].map(([label, count]) => { const card = element('article', null, 'metric-card'); card.append(element('span',label), element('strong',count)); return card; }));
    const query = normalize($('search').value);
    const matchesFilters = i => (!query || normalize([i.machine?.nome_maquina, i.machineName, i.user, i.manager, i.sector].join(' ')).includes(query))
      && (!$('priority').value || i.priority === $('priority').value) && (!$('status').value || i.status === $('status').value)
      && (!$('matching').value || ($('matching').value === 'linked' ? Boolean(i.machine) : !i.machine));
    const items = current.filter(i => i.status !== 'Aprovado' && matchesFilters(i));
    const order = { 'Crítica':0, 'Alta':1, 'Média':2, 'Baixa':3, 'Pendente':4 };
    items.sort((a,b) => order[a.priority] - order[b.priority] || (b.score ?? -1) - (a.score ?? -1) || Date.parse(b.submittedAt) - Date.parse(a.submittedAt));
    $('rows').replaceChildren(...items.map(item => {
      const tr = element('tr'); const machine = element('td'); machine.append(element('strong', item.machine?.nome_maquina || item.machineName || 'Equipamento não informado'), element('small',item.user));
      if (!item.machine) machine.append(element('small','Aguardando identificação'));
      const score = element('td', item.score === null ? 'Pendente' : `${item.score}/100`, 'replacement-score');
      const priority = element('td'); priority.append(badge(item.priority));
      const approval = element('td'), select = element('select', null, 'form-select approval-select');
      select.setAttribute('aria-label', `Aprovação de ${item.user} (${item.machine?.nome_maquina || item.machineName || 'sem equipamento identificado'})`);
      for (const value of ['Pendente','Em análise','Aprovado']) select.append(element('option',value));
      select.value = item.status;
      select.addEventListener('change', async () => {
        const status = select.value; select.disabled = true;
        try {
          await api(`/api/avaliacoes-troca/${item.id}/review`, { method:'PUT', body:JSON.stringify({ machineId:item.machine?.id_maquina || null, status, technicalNotes:item.technicalNotes || '', expectedUpdatedAt:item.updatedAt }) });
          await load(); notice('feedback', status === 'Aprovado' ? 'Avaliação aprovada e encaminhada para a tabela de entrega dos notebooks.' : 'Aprovação atualizada.');
        } catch (error) { select.value = item.status; notice('feedback',error.message,true); select.disabled = false; }
      });
      approval.append(select);
      const action = element('td'), button = element('button','Analisar','button button-secondary'); button.type = 'button'; button.addEventListener('click', () => openReview(item)); action.append(button);
      tr.append(machine, element('td',item.sector), score, priority, approval, element('td',date(item.submittedAt)), action); return tr;
    }));
    $('result-count').textContent = `${items.length} aguardando aprovação nesta seleção · ${data.items.length} avaliação(ões) recebida(s) no total`;
    $('empty').hidden = items.length > 0;
    $('empty-description').textContent = data.items.length ? 'Não há avaliações aguardando aprovação nesta seleção. As aprovadas ficam na tabela de entregas abaixo.' : 'As respostas aparecerão aqui após a sincronização. Você também pode registrar uma avaliação nesta página.';
    renderDeliveries(data.items.filter(i => i.status === 'Aprovado' && matchesFilters(i)));
  }
  function renderDeliveries(approved) {
    const items = approved.filter(i => !$('delivery-filter').value || (i.delivery?.status || 'Aguardando entrega') === $('delivery-filter').value);
    items.sort((a,b) => Number(a.delivery?.status === 'Entregue') - Number(b.delivery?.status === 'Entregue') || Date.parse(b.approvedAt || b.updatedAt) - Date.parse(a.approvedAt || a.updatedAt));
    $('delivery-rows').replaceChildren(...items.map(item => {
      const d = item.delivery || {}, tr = element('tr');
      const person = element('td'); person.append(element('strong',item.user),element('small',item.sector));
      const machine = element('td',item.machine?.nome_maquina || item.machineName || 'Não informado');
      if (!item.machine) machine.append(element('small','Aguardando identificação'));
      const registered = data.machines.find(m => m.id_maquina === d.inventoryMachineId);
      const notebook = element('td',registered?.nome_maquina || d.inventorySnapshot?.nome_maquina || d.model || 'A definir');
      if (registered || d.inventorySnapshot) notebook.append(element('small','Cadastrado no Inventário Demo'));
      if (d.asset) notebook.append(element('small',`Patrimônio: ${d.asset}`));
      if (d.serial) notebook.append(element('small',`Série: ${d.serial}`));
      const status = element('td'); status.append(element('span',d.status || 'Aguardando entrega',`replacement-badge ${d.status === 'Entregue' ? 'priority-baixa' : 'priority-media'}`));
      const action = element('td',null,'delivery-actions');
      const edit = element('button','Controlar entrega','button button-secondary'); edit.type = 'button'; edit.addEventListener('click',()=>openDelivery(item));
      const review = element('button','Analisar','button button-secondary'); review.type = 'button'; review.addEventListener('click',()=>openReview(item));
      action.append(edit,review);
      tr.append(person,machine,notebook,element('td',date(item.approvedAt)),status,element('td',d.date ? d.date.split('-').reverse().join('/') : '—'),element('td',d.receivedBy || '—'),action); return tr;
    }));
    $('delivery-count').textContent = `${items.length} entrega(s) nesta seleção · ${approved.filter(i => i.delivery?.status !== 'Entregue').length} aguardando conclusão`;
    $('delivery-empty').hidden = items.length > 0;
  }
  function openDelivery(item) {
    deliverySelected = item; notice('delivery-error',''); $('delivery-title').textContent = `Entrega para ${item.user}`;
    $('delivery-context').textContent = `${item.sector} · Equipamento atual: ${item.machine?.nome_maquina || item.machineName || 'não informado'}`;
    const delivery = item.delivery || {};
    for (const key of ['date','receivedBy','notes']) $(`delivery-${key}`).value = delivery[key] || '';
    const pending = item.inventoryOperation;
    const linkedId = delivery.inventoryMachineId || pending?.targetId || '';
    const existing = $('delivery-existing'); existing.replaceChildren(element('option','Cadastrar novo notebook')); existing.options[0].value = '';
    for (const m of [...data.machines].sort((a,b) => a.nome_maquina.localeCompare(b.nome_maquina))) {
      if (m.id_maquina === item.machineId) continue;
      const option = element('option',`${m.nome_maquina} · ${m.usuario || 'Sem usuário'}`); option.value = m.id_maquina; option.dataset.search = normalize(m.nome_maquina); existing.append(option);
    }
    if (linkedId && !data.machines.some(m => m.id_maquina === linkedId)) { const option = element('option','Notebook vinculado não encontrado — confira o Gerenciamento'); option.value = linkedId; existing.append(option); }
    existing.value = linkedId; existing.disabled = Boolean(delivery.inventoryMachineId || pending);
    $('delivery-existing-search').value = ''; $('delivery-existing-search').disabled = existing.disabled;
    const current = data.machines.find(m => m.id_maquina === linkedId);
    deliveryInventoryBase = pending?.before || current || null;
    fillInventoryFields(pending?.requested || current || delivery.inventorySnapshot || { tipo_maquina:'Notebook', usuario:item.user, setor:item.sector });
    $('delivery-registration-note').textContent = pending ? 'O cadastro anterior aguarda confirmação. Confira os dados e salve novamente para concluí-lo.' : delivery.inventoryMachineId ? 'Este notebook já está vinculado à entrega. Alterações nos campos acima serão gravadas no inventário.' : 'Informe os dados de um novo notebook ou selecione um equipamento já cadastrado.';
    const legacy = [delivery.model && `Modelo: ${delivery.model}`, delivery.asset && `Patrimônio: ${delivery.asset}`, delivery.serial && `Série: ${delivery.serial}`].filter(Boolean);
    $('delivery-legacy').hidden = !legacy.length; $('delivery-legacy').textContent = 'Informações anteriores preservadas: ' + legacy.join(' · ');
    $('delivery-status').value = delivery.status || 'Aguardando entrega';
    $('delivery-dialog').showModal();
  }
  function fillInventoryFields(machine) {
    const os = $('delivery-sistema_operacional'); os.replaceChildren(element('option','Não informado')); os.options[0].value = '';
    for (const value of [...new Set([...(inventoryFilters.sistemas || []), machine.sistema_operacional].filter(Boolean))]) { const option = element('option',value); option.value = value; os.append(option); }
    for (const key of inventoryFields) $(`delivery-${key}`).value = key === 'tipo_aquisicao' ? (['Locação','Alugado'].includes(machine[key]) ? 'Alugado' : ['Próprio','Ativo'].includes(machine[key]) ? 'Ativo' : '') : machine[key] || '';
    if (!$('delivery-tipo_maquina').value) $('delivery-tipo_maquina').value = 'Notebook';
  }
  function filterMachineSelect(select, query, count) {
    let matches = 0;
    for (const option of select.options) {
      const match = !option.value || (option.dataset.search || normalize(option.textContent)).includes(normalize(query));
      option.hidden = !match && !option.selected;
      if (option.value && match) matches++;
    }
    if (count) count.textContent = `${matches} máquina(s) encontrada(s)`;
  }
  function fillMachineOptions(select) {
    select.replaceChildren(element('option','Aguardando identificação')); select.options[0].value = '';
    for (const m of [...data.machines].sort((a,b) => a.nome_maquina.localeCompare(b.nome_maquina))) { const o = element('option',`${m.nome_maquina} · ${m.usuario || 'Sem usuário'}`); o.value = m.id_maquina; o.dataset.search = normalize(m.nome_maquina); select.append(o); }
  }
  async function load() {
    [data, inventoryFilters] = await Promise.all([api('/api/avaliacoes-troca'), api('/api/meta/filters')]);
    $('delivery-sectors').replaceChildren(...(inventoryFilters.setores || []).map(value => { const o = element('option'); o.value = value; return o; }));
    $('loading').hidden = true; $('evaluation-content').hidden = false; $('new-evaluation').disabled = false;
    $('form-provider-title').textContent = 'Cenário sintético';
    $('sync-status').textContent = 'Registre avaliações manualmente. Esta demo não possui integrações externas.';
    $('sync-now').hidden = true;
    fillMachineOptions($('review-machine')); fillMachineOptions($('new-machine')); render();
  }
  function openReview(item) {
    selected = item; notice('review-error',''); $('review-title').textContent = item.machine?.nome_maquina || item.machineName || item.user;
    const summary = element('div', null, 'replacement-score-card'); summary.append(element('strong', item.score === null ? 'Pontuação pendente' : `${item.score} de 100 pontos`), document.createTextNode(' · '), badge(item.priority));
    summary.append(element('p', `Frequência: ${item.frequencyPoints ?? 'pendente'}/40 · Impacto: ${item.impactPoints ?? 'pendente'}/60 · Regra v${item.ruleVersion}`));
    if (item.immediateReview) summary.append(element('p','Atividade essencial impedida: requer avaliação imediata da TI.'));
    $('score-summary').replaceChildren(summary);
    const entries = [['Responsável pela avaliação',item.manager],['Colaborador que utiliza o computador',item.user],['Setor / área do colaborador',item.sector],['Nome da máquina ou patrimônio informado',item.machineName || 'Não informado pelo gestor'],['Tipo de computador',item.type],['Frequência de falhas ou lentidão',frequency[item.frequency]],['Impacto dos problemas no trabalho',impact[item.impact]],['Problemas relatados',item.problems.join('\n') || 'Nenhum problema informado'],['Programas e sistemas utilizados',item.systems.join('\n')],['Precisa levar o computador a outros locais?',mobility[item.mobility]],['Justificativa ou informações adicionais',item.notes || 'Nenhuma informação adicional'],['Como a avaliação foi registrada','Registro local de demonstração'],['Data e hora da resposta',date(item.submittedAt)]];
    if (item.legacyStatus) entries.push(['Situação anterior à atualização',item.legacyStatus]);
    if (item.sourceChanged) entries.push(['Atenção','A resposta do formulário foi atualizada após a aprovação. Confira as informações.']);
    $('answers').replaceChildren(...entries.flatMap(([label,value]) => [element('dt',label),element('dd',value)]));
    $('review-machine').value = item.machine?.id_maquina || ''; $('review-status').value = item.status; $('review-notes').value = item.technicalNotes;
    $('review-machine-search').value = ''; filterMachineSelect($('review-machine'), '', $('review-machine-count')); $('review-dialog').showModal();
  }
  $('review-form').addEventListener('submit', async event => {
    event.preventDefault(); $('save-review').disabled = true; notice('review-error','');
    try { const status = $('review-status').value; await api(`/api/avaliacoes-troca/${selected.id}/review`, { method:'PUT', body:JSON.stringify({ machineId:$('review-machine').value ? Number($('review-machine').value) : null, status, technicalNotes:$('review-notes').value, expectedUpdatedAt:selected.updatedAt }) }); $('review-dialog').close(); await load(); notice('feedback',status === 'Aprovado' ? 'Avaliação aprovada e encaminhada para a tabela de entrega dos notebooks.' : 'Aprovação e parecer salvos.'); }
    catch (error) { notice('review-error',error.message,true); } finally { $('save-review').disabled = false; }
  });
  $('review-machine-search').addEventListener('input', () => filterMachineSelect($('review-machine'), $('review-machine-search').value, $('review-machine-count')));
  $('delivery-existing-search').addEventListener('input', () => filterMachineSelect($('delivery-existing'), $('delivery-existing-search').value));
  $('delivery-existing').addEventListener('change', () => {
    const current = data.machines.find(m => String(m.id_maquina) === $('delivery-existing').value);
    deliveryInventoryBase = current || null;
    fillInventoryFields(current || { tipo_maquina:'Notebook', usuario:deliverySelected.user, setor:deliverySelected.sector });
  });
  $('delivery-form').addEventListener('submit', async event => {
    event.preventDefault(); $('save-delivery').disabled = true; notice('delivery-error','');
    const body = { status:$('delivery-status').value, expectedUpdatedAt:deliverySelected.updatedAt };
    for (const key of ['date','receivedBy','notes']) body[key] = $(`delivery-${key}`).value;
    body.inventory = Object.fromEntries(inventoryFields.map(key => [key,$(`delivery-${key}`).value]));
    body.inventoryMachineId = $('delivery-existing').value ? Number($('delivery-existing').value) : null;
    body.expectedInventory = deliveryInventoryBase;
    try { await api(`/api/avaliacoes-troca/${deliverySelected.id}/delivery`, { method:'PUT', body:JSON.stringify(body) }); $('delivery-dialog').close(); await load(); notice('feedback',body.status === 'Entregue' ? 'Entrega concluída e inventário atualizado.' : 'Entrega salva e notebook atualizado no inventário.'); }
    catch (error) { notice('delivery-error',error.message,true); } finally { $('save-delivery').disabled = false; }
  });
  $('new-evaluation').addEventListener('click', () => { $('new-form').reset(); notice('new-error',''); $('new-dialog').showModal(); });
  $('new-machine').addEventListener('change', () => {
    const m = data.machines.find(m => String(m.id_maquina) === $('new-machine').value); if (!m) return;
    const form = $('new-form').elements; form.machineName.value = m.nome_maquina; form.user.value = m.usuario || ''; form.sector.value = m.setor || '';
  });
  $('new-form').addEventListener('submit', async event => {
    event.preventDefault(); $('save-new').disabled = true; notice('new-error','');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const split = value => value.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
    values.systems = split(values.systems); values.problems = split(values.problems);
    try { await api('/api/avaliacoes-troca', { method:'POST', body:JSON.stringify(values) }); $('new-dialog').close(); await load(); notice('feedback','Avaliação registrada e pontuação calculada.'); }
    catch (error) { notice('new-error',error.message,true); } finally { $('save-new').disabled = false; }
  });
  $('sync-now').addEventListener('click', async () => {
    $('sync-now').disabled = true; notice('feedback','Buscando respostas do formulário…');
    try { const result = await api('/api/avaliacoes-troca/sync',{method:'POST',body:'{}'}); await load(); notice('feedback',`${result.inserted} nova(s) avaliação(ões) e ${result.updated} atualização(ões).`); }
    catch (error) { notice('feedback',error.message,true); try { await load(); } catch { /* original error remains */ } }
  });
  $('refresh').addEventListener('click', () => load().catch(e => notice('feedback',e.message,true)));
  for (const id of ['search','priority','status','matching','latest','delivery-filter']) $(id).addEventListener(id === 'search' ? 'input' : 'change',render);
  for (const close of document.querySelectorAll('[data-close]')) close.addEventListener('click', () => $(close.dataset.close).close());
  try { session = await api('/api/session'); if (session.role !== 'admin') { location.replace('/login.html'); return; } await load(); }
  catch (error) { $('loading').hidden = true; notice('feedback',error.message,true); }
})();
