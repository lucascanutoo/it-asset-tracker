'use strict';
const { normalizeMachineId } = require('./machineIdentity');
const FREQUENCY = { nenhuma: 0, raramente: 10, mensal: 20, semanal: 30, diaria: 40, desconhecida: null };
const IMPACT = { nenhum: 0, baixo: 15, moderado: 30, alto: 45, critico: 60, desconhecido: null };
const fail = (message) => Object.assign(new Error(message), { status: 400 });
function scoreEvaluation(frequency, impact) {
  if (!Object.hasOwn(FREQUENCY, frequency) || !Object.hasOwn(IMPACT, impact)) throw fail('Frequência ou impacto inválido.');
  const frequencyPoints = FREQUENCY[frequency], impactPoints = IMPACT[impact];
  const score = frequencyPoints === null || impactPoints === null ? null : frequencyPoints + impactPoints;
  const priority = impact === 'critico' ? 'Crítica' : score === null ? 'Pendente' : score >= 75 ? 'Crítica' : score >= 50 ? 'Alta' : score >= 25 ? 'Média' : 'Baixa';
  return { score, priority, frequencyPoints, impactPoints, ruleVersion: 1, immediateReview: impact === 'critico' };
}
function text(value, label, max, required = true) {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw fail(`${label}: preencha um texto de até ${max} caracteres.`);
  return value.trim();
}
function normalizeEvaluation(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail('Avaliação inválida.');
  const result = {
    manager: text(body.manager, 'Gestor', 150), sector: text(body.sector, 'Setor', 100),
    user: text(body.user, 'Colaborador', 150), machineName: text(body.machineName || '', 'Máquina', 100, false),
    type: body.type, frequency: body.frequency, impact: body.impact, mobility: body.mobility,
    notes: text(body.notes || '', 'Observações', 3000, false)
  };
  if (!['Notebook', 'Desktop', 'Não sei informar'].includes(result.type)) throw fail('Tipo de computador inválido.');
  if (!['frequente', 'ocasional', 'fixa', 'desconhecida'].includes(result.mobility)) throw fail('Mobilidade inválida.');
  for (const name of ['problems', 'systems']) {
    if (!Array.isArray(body[name]) || body[name].length > 30 || (name === 'systems' && body[name].length === 0)) throw fail('Informe os sistemas utilizados e os problemas observados.');
    result[name] = [...new Set(body[name].map(v => text(v, name === 'systems' ? 'Sistema' : 'Problema', 300)))];
  }
  return { ...result, ...scoreEvaluation(result.frequency, result.impact) };
}
function matchMachine(name, machines) {
  const normalize = s => String(s || '').trim().toLocaleLowerCase('pt-BR');
  const key = normalize(name);
  if (!key || ['não sei informar', 'nao sei informar', 'não sei', 'nao sei'].includes(key)) return null;
  const matches = machines.filter(m => normalize(m.nome_maquina) === key);
  return matches.length === 1 ? normalizeMachineId(matches[0].id_maquina) : null;
}
module.exports = { FREQUENCY, IMPACT, scoreEvaluation, normalizeEvaluation, matchMachine };
