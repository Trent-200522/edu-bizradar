/** 国家级/省级社科、教改课题立项公示 */
const { collectGeneric } = require('./generic');

async function collect(source) {
  return collectGeneric(source, 'grant');
}

module.exports = { collect };
