'use strict';
const { validateMachine } = require('./validation');
const { normalizeMachineId, sameMachineId } = require('./machineIdentity');
const fields = ['nome_maquina','tipo_maquina','usuario','setor','sistema_operacional','tipo_aquisicao'];
const conflict = message => Object.assign(Error(message), { status: 409 });
function inventorySnapshot(machine) { return validateMachine(machine, machine); }
function sameInventory(left, right) {
  if (!left || !right) return false;
  const a = inventorySnapshot(left), b = inventorySnapshot(right);
  return fields.every(key => a[key] === b[key]);
}
async function saveDeliveryInventory({ item, body, repository, persist, actor }) {
  const machine = validateMachine(body.inventory);
  const targetId = normalizeMachineId(body.inventoryMachineId);
  if (body.inventoryMachineId !== null && targetId === null) throw Object.assign(Error('Selecione o notebook existente ou a opção de novo cadastro.'), { status: 400 });
  if (sameMachineId(targetId, item.machineId)) throw conflict('Selecione o novo notebook. O equipamento atual avaliado deve permanecer no inventário.');
  const linkedId = normalizeMachineId(item.delivery?.inventoryMachineId);
  if (linkedId !== null && !sameMachineId(linkedId, targetId)) throw conflict('Esta entrega já possui um notebook cadastrado. Edite os dados desse notebook para manter o vínculo.');
  const requested = { machine, targetId };
  const signature = JSON.stringify(requested);
  let operation = item.inventoryOperation;
  if (operation && operation.signature !== signature) throw conflict('Há um cadastro anterior aguardando confirmação. Reabra o controle de entrega e salve os mesmos dados para concluí-lo.');
  if (!operation) {
    let before = null;
    if (targetId !== null) {
      before = await repository.get(targetId);
      if (!before) throw conflict('O notebook selecionado não está mais no inventário. Atualize a página.');
      if (!body.expectedInventory || !sameInventory(before, body.expectedInventory)) throw conflict('O cadastro do notebook foi alterado no Gerenciamento. Atualize a página antes de salvar.');
    } else {
      const existing = (await repository.list()).find(m => m.nome_maquina.trim().toLocaleLowerCase('pt-BR') === machine.nome_maquina.toLocaleLowerCase('pt-BR'));
      if (existing) throw conflict('Já existe uma máquina com esse nome. Se este é o novo notebook, selecione-o na opção de equipamento já cadastrado.');
    }
    operation = { signature, requested: machine, targetId, before: before ? inventorySnapshot(before) : null, phase: 'prepared', preparedAt: new Date().toISOString() };
    item.inventoryOperation = operation;
    // Persist the intent before SQL writes, so retries after an interrupted save
    // can reconcile the exact six-field payload instead of creating duplicates.
    await persist();
  }
  try {
    let saved;
    if (operation.phase === 'committed') {
      saved = await repository.get(operation.machineId);
      if (!saved || !sameInventory(saved, machine)) throw conflict('O notebook foi alterado após o cadastro. Confira os dados no Gerenciamento antes de continuar.');
    } else if (targetId === null) {
      const existing = (await repository.list()).find(m => m.nome_maquina.trim().toLocaleLowerCase('pt-BR') === machine.nome_maquina.toLocaleLowerCase('pt-BR'));
      if (existing) {
        if (!sameInventory(existing, machine)) throw conflict('O nome informado já está em uso por outro cadastro. Confira o notebook antes de continuar.');
        saved = existing;
      } else saved = await repository.create(machine, { name: actor, role: 'admin' });
    } else {
      const current = await repository.get(targetId);
      if (!current) throw conflict('O notebook selecionado não está mais no inventário.');
      if (sameInventory(current, machine)) saved = current;
      else {
        if (!sameInventory(current, operation.before)) throw conflict('O cadastro do notebook foi alterado durante o salvamento. Atualize a página.');
        saved = await repository.update(targetId, machine, { name: actor, role: 'admin' }, operation.before);
      }
    }
    const id = normalizeMachineId(saved?.id_maquina);
    if (id === null) throw Error('O inventário não confirmou o identificador do notebook.');
    item.inventoryOperation = { ...operation, phase: 'committed', machineId: id };
    await persist();
    return { inventoryMachineId: id, inventorySnapshot: inventorySnapshot(saved), inventoryUpdatedAt: new Date().toISOString() };
  } catch (error) {
    // A definitive validation/conflict error made no uncertain SQL write. Keep
    // prepared intents after connection/commit failures for safe reconciliation.
    if (error.status && error.status < 500 && item.inventoryOperation?.phase === 'prepared') { delete item.inventoryOperation; await persist(); }
    throw error;
  }
}
module.exports = { saveDeliveryInventory, inventorySnapshot, sameInventory };
