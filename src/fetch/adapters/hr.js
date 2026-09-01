/**
 * 高校人事处招聘采集：新招"实验系列"人员 = 实验室建设信号
 * 遍历 config/schools.json 中配置了 hrUrl 的院校
 */
const { fetchPage } = require('../http');
const { saveRaw } = require('../../store/db');
const schoolsCfg = require('../../../config/schools.json');
const { extractListItems, hitKeywords, buildSignal } = require('../../pipeline/common');

async function collect(source) {
  const signals = [];
  const targets = (schoolsCfg.schools || []).filter((s) => s.hrUrl);
  for (const school of targets) {
    const html = await fetchPage(school.hrUrl);
    if (!html) continue;
    saveRaw(source.id, school.hrUrl, html);
    for (const item of extractListItems(html, school.hrUrl, {})) {
      const text = `${item.title} ${item.summary}`;
      const hits = hitKeywords(text, source.keywordGroup);
      if (hits.length === 0) continue;
      signals.push(
        buildSignal({
          sourceId: source.id,
          sourceName: `${source.name}-${school.name}`,
          level: source.level,
          signalType: 'hr',
          item,
          school,
          extra: { hitKeywords: hits },
        })
      );
    }
  }
  return signals;
}

module.exports = { collect };
