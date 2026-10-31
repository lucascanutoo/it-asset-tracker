const fs = require('node:fs');
const path = require('node:path');
const { createDemoRepository } = require('./demoRepository');
const { generateMachines, generateEvaluations } = require('./syntheticData');
function openDemoData(dataDir) {
  const repository = createDemoRepository(dataDir);
  const machines = generateMachines();
  repository.seed(machines);
  const replacementFile = path.join(dataDir, 'evaluations.json');
  if (!fs.existsSync(replacementFile)) fs.writeFileSync(replacementFile, JSON.stringify(generateEvaluations(machines),null,2), {flag:'wx'});
  return { repository, replacementFile };
}
module.exports = { openDemoData };
