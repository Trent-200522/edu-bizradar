/** 省教育厅：新增专业/专业审批/停招公示（通用列表适配，各省只需配 URL 与选择器） */
const { collectGeneric } = require('./generic');

async function collect(source) {
  return collectGeneric(source, 'majorMove');
}

module.exports = { collect };
