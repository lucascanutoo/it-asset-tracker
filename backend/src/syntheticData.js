const { normalizeEvaluation } = require('./replacementScore');
const sectors = ['Laboratório Demo', 'Produto Demo', 'Criação Demo', 'Operações Demo', 'Suporte Demo', 'Pesquisa Demo'];
function generateMachines() {
  return Array.from({ length: 72 }, (_, i) => ({
    id_maquina: i + 1,
    nome_maquina: `DEMO-${i % 3 === 0 ? 'DT' : 'NB'}-${String(i + 1).padStart(4, '0')}`,
    tipo_maquina: i % 3 === 0 ? 'Desktop' : 'Notebook',
    usuario: `Pessoa Demo ${String(i === 71 ? 12 : i + 1).padStart(3, '0')}`,
    setor: sectors[i % sectors.length],
    sistema_operacional: ['Windows 11', 'Ubuntu 24.04', 'Windows 10'][i % 3],
    tipo_aquisicao: i % 4 === 0 ? 'Locação' : 'Ativo'
  }));
}
function generateEvaluations(machines) {
  return { version: 1, sync: {}, items: machines.slice(0, 12).map((machine, i) => {
    const stamp = `2026-09-${String(i + 1).padStart(2, '0')}T12:00:00.000Z`;
    const approved = i >= 8;
    return {
      ...normalizeEvaluation({ manager: `Gestor Demo ${i % 3 + 1}`, sector: machine.setor,
        user: machine.usuario, machineName: machine.nome_maquina, type: machine.tipo_maquina,
        frequency: ['diaria', 'semanal', 'mensal', 'raramente'][i % 4],
        impact: ['critico', 'alto', 'moderado', 'baixo'][i % 4], mobility: i % 2 ? 'ocasional' : 'fixa',
        systems: ['Editor Demo', 'Painel Demo'], problems: ['Lentidão simulada'], notes: 'Cenário criado artificialmente para apresentação.' }),
      id: `demo-evaluation-${String(i + 1).padStart(3, '0')}`, source: 'manual', machineId: machine.id_maquina,
      status: approved ? 'Aprovado' : i >= 4 ? 'Em análise' : 'Pendente',
      technicalNotes: i >= 4 ? 'Análise técnica inteiramente fictícia.' : '',
      submittedAt: stamp, createdAt: stamp, updatedAt: stamp, updatedBy: 'demo.gestor', history: [],
      ...(approved ? { approvedAt: stamp, approvedBy: 'demo.admin', delivery: {
        status: i === 11 ? 'Entregue' : i === 10 ? 'Agendada' : 'Aguardando entrega',
        model: '', asset: '', serial: '', date: i >= 10 ? '2026-09-20' : '',
        receivedBy: i === 11 ? machine.usuario : '', notes: 'Entrega simulada.',
        ...(i === 11 ? { inventoryMachineId: 72, inventorySnapshot: machines[71] } : {})
      } } : {})
    };
  }) };
}
module.exports = { generateMachines, generateEvaluations };
