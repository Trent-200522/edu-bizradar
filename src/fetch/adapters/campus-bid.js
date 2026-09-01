/**
 * 目标院校官网招标/采购栏目采集
 * 遍历 config/schools.json 中配置了 bidUrl 的院校，通用解析 + 采购关键词过滤
 */
const { fetchPage } = require('../http');
const { saveRaw } = require('../../store/db');
const schoolsCfg = require('../../../config/schools.json');
const { extractListItems, hitKeywords, buildSignal } = require('../../pipeline/common');

async function collect(source) {
  const signals = [];
  const targets = (schoolsCfg.schools || []).filter((s) => s.bidUrl);
  for (const school of targets) {
    const html = await fetchPage(school.bidUrl);
    if (!html) continue;
    saveRaw(source.id, school.bidUrl, html);
    for (const item of extractListItems(html, school.bidUrl, {})) {
      const text = `${item.title} ${item.summary}`;
      // 目标院校自有招标栏目：全量入库（分类查阅），关键词命中作为信号标记交由评分引擎分层
      const hits = hitKeywords(text, source.keywordGroup);
      signals.push(
        buildSignal({
          sourceId: source.id,
          sourceName: `${source.name}-${school.name}`,
          level: source.level,
          signalType: 'bid',
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
