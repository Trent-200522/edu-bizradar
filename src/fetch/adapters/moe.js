/** 教育部官网：专业备案/审批/停招等政策公示 */
const { collectGeneric } = require('./generic');

async function collect(source) {
  return collectGeneric(source, 'majorMove');
}

module.exports = { collect };
