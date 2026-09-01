/**
 * 商学院/经管学院师资列表采集（P1，低频全量+增量）
 * 遍历 config/schools.json 中配置了 facultyUrl 的院校
 * 合规：仅采集官网公开的师资页；只保留公开办公邮箱，不采集个人手机号
 */
const { fetchPage } = require('../http');
const { saveRaw } = require('../../store/db');
const schoolsCfg = require('../../../config/schools.json');
const { extractListItems, buildSignal } = require('../../pipeline/common');

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

async function collect(source) {
  const signals = [];
  const targets = (schoolsCfg.schools || []).filter((s) => s.facultyUrl);
  for (const school of targets) {
    const html = await fetchPage(school.facultyUrl);
    if (!html) continue;
    saveRaw(source.id, school.facultyUrl, html);
    const publicEmails = [...new Set((html.match(EMAIL_RE) || []))].slice(0, 10);
    for (const item of extractListItems(html, school.facultyUrl, {}).slice(0, 50)) {
      signals.push(
        buildSignal({
          sourceId: source.id,
          sourceName: `${source.name}-${school.name}`,
          level: source.level,
          signalType: 'faculty',
          item,
          school,
          extra: { publicEmails },
        })
      );
    }
  }
  return signals;
}

module.exports = { collect };
