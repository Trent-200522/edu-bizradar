/**
 * 通用列表页采集：教育部 / 省教育厅 / 课题公示共用
 * 流程：抓取配置的列表页 → 解析条目 → 关键词过滤 → 归一为信号
 */
const { fetchPage } = require('../http');
const { saveRaw } = require('../../store/db');
const { extractListItems, hitKeywords, matchSchool, extractBusinessMajors, buildSignal } = require('../../pipeline/common');

async function collectGeneric(source, signalType = 'majorMove') {
  const signals = [];
  for (const url of source.urls || []) {
    const html = await fetchPage(url);
    if (!html) continue;
    saveRaw(source.id, url, html);
    const items = extractListItems(html, url, source.selectors || {});
    for (const item of items) {
      const text = `${item.title} ${item.summary}`;
      const hits = hitKeywords(text, source.keywordGroup);
      if (hits.length === 0) continue;
      if (source.requireBusinessMajor && extractBusinessMajors(text).length === 0 && !matchSchool(text)) continue;
      const school = matchSchool(text);
      signals.push(
        buildSignal({
          sourceId: source.id,
          sourceName: source.name,
          level: source.level,
          signalType: source.signalType || signalType,
          item,
          school,
          extra: { hitKeywords: hits },
        })
      );
    }
  }
  return signals;
}

module.exports = { collectGeneric };
