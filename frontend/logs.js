'use strict';
const $ = (selector) => document.querySelector(selector);
const operations = { create: 'Cadastro', update: 'Edição', delete: 'Exclusão' };
const fields = { nome_maquina:'Nome da máquina', tipo_maquina:'Tipo', usuario:'Usuário', sistema_operacional:'Sistema operacional', setor:'Setor', tipo_aquisicao:'Aquisição' };
const statusNames = { confirmed:'Confirmada', pending:'Confirmação pendente', failed:'Cancelada' };
const state = { page:1, pageSize:25, totalPages:1, request:0, loading:false, filters:{} };
const time = new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium',timeZone:'America/Sao_Paulo'});
function element(tag, text, className='') { const item=document.createElement(tag); if(text !== undefined) item.textContent=text; if(className)item.className=className; return item; }
function value(text) { return text === null || text === undefined || text === '' ? 'Não informado' : String(text); }
function showDetails(event) {
  $('#log-detail-title').textContent=operations[event.action]+' · '+event.machine;
  $('#log-detail-meta').textContent=time.format(new Date(event.timestamp))+' · '+event.actor+' · Equipamento #'+event.machineId;
  const changed=new Set(event.changes.map((item)=>item.field));
  $('#log-detail-rows').replaceChildren(...Object.entries(fields).map(([key,label])=>{
    const row=element('tr');
    row.append(element('td',label+(changed.has(key)?' •':'')),element('td',event.before ? value(event.before[key]) : '—'),element('td',event.after ? value(event.after[key]) : '—')); return row;
  }));
  $('#log-detail-status').textContent=event.status === 'pending' ? 'A gravação do histórico foi iniciada, mas a confirmação da transação não está disponível. Verifique o registro no banco antes de concluir se a alteração foi aplicada.' : event.status === 'failed' ? 'A operação foi cancelada e não deve ser considerada uma alteração confirmada.' : 'Alteração confirmada. Os campos marcados com • foram alterados.';
  $('#log-detail').showModal();
}
async function load() {
  const request=++state.request; state.loading=true; $('#refresh-logs').disabled=true; $('#logs-feedback').hidden=true;
  try {
    const params=new URLSearchParams({page:state.page,pageSize:state.pageSize,...state.filters});
    const response=await fetch('/api/logs?'+params,{cache:'no-store'});
    if(response.status===403 || response.status===401){location.replace('/login.html');return;}
    const data=await response.json(); if(!response.ok)throw new Error(data.message||'Não foi possível carregar os logs.');
    if(request!==state.request)return;
    state.totalPages=data.pagination.totalPages;
    if(state.page>state.totalPages){state.page=state.totalPages;return load();}
    $('#logs-rows').replaceChildren(...data.items.map((event)=>{
      const row=element('tr'); row.append(element('td',time.format(new Date(event.timestamp))),element('td',event.actor));
      const operation=element('td'); operation.append(element('span',operations[event.action],'log-badge '+event.action));row.append(operation,element('td',event.machine));
      row.append(element('td',event.changes.map((change)=>fields[change.field]||change.field).join(', ')||'Sem mudança de valores'));
      const status=element('td');status.append(element('span',statusNames[event.status]||'Pendente','log-badge'+(event.status!=='confirmed'?' warning':'')));row.append(status);
      const details=element('td'); const button=element('button','Ver detalhes','text-button');button.type='button';button.addEventListener('click',()=>showDetails(event));details.append(button);row.append(details);return row;
    }));
    $('#logs-count').textContent=data.pagination.total+' registros encontrados';
    $('#logs-summary').textContent=data.summary.confirmed+' alterações confirmadas no histórico · '+data.summary.pending+' pendentes · '+data.summary.failed+' canceladas';
    $('#logs-updated').textContent='Atualizado em '+time.format(new Date())+'. Atualização automática a cada 30 segundos na primeira página.';
    if(data.summary.damagedLines) {$('#logs-feedback').textContent='Há linhas de histórico ilegíveis. Solicite a verificação do arquivo de auditoria.';$('#logs-feedback').hidden=false;}
    $('#logs-empty').hidden=Boolean(data.items.length);$('#logs-page').textContent='Página '+state.page+' de '+state.totalPages;
    $('#logs-previous').disabled=state.page<=1;$('#logs-next').disabled=state.page>=state.totalPages;
  } catch(error){$('#logs-feedback').textContent=error.message;$('#logs-feedback').hidden=false;}
  finally{if(request===state.request){state.loading=false;$('#refresh-logs').disabled=false;}}
}
function readFilters(){return {q:$('#log-search').value.trim(),actor:$('#log-actor').value.trim(),action:$('#log-action').value,from:$('#log-from').value,to:$('#log-to').value};}
$('#logs-filters').addEventListener('submit',(event)=>{event.preventDefault();state.filters=readFilters();state.page=1;load();});
$('#clear-log-filters').addEventListener('click',()=>{$('#logs-filters').reset();state.filters={};state.page=1;load();});
$('#refresh-logs').addEventListener('click',()=>{state.page=1;load();});
$('#logs-previous').addEventListener('click',()=>{state.page--;load();});$('#logs-next').addEventListener('click',()=>{state.page++;load();});
$('#close-log-detail').addEventListener('click',()=>$('#log-detail').close());
function refreshIfVisible(){
  if(document.hidden||state.loading||state.page!==1||$('#log-detail').open||document.activeElement?.closest('#logs-filters'))return;
  load();
}
const refreshTimer=setInterval(refreshIfVisible,30000);
window.addEventListener('focus',refreshIfVisible);
document.addEventListener('visibilitychange',refreshIfVisible);
window.addEventListener('pagehide',(event)=>{if(!event.persisted)clearInterval(refreshTimer);});
load();
