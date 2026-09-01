/**
 * 周度线索池导出（每周五）：全部 A/关注/B 类商机 + 本周新增信号 → CSV（UTF-8 BOM，Excel 直接打开）
 */
const fs = require('fs');
const path = require('path');
const db = require('../store/db');
const { fmtYuan } = require('../score/engine');

function esc(v) {
  const s = String(v == null ? '' : v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function run() {
  const opportunities = db.readTable('opportunities').filter((o) => o.grade !== '红牌');
  const signals = db.readTable('signals');
  const weekAgo = Date.now() - 7 * 86400000;
  const weekSignals = signals.filter((s) => new Date(s.firstSeenAt || s.crawledAt).getTime() >= weekAgo);

  const dir = path.join(db.DATA_DIR, 'briefings');
  db.ensureDir(dir);
  const date = today();

  // 表1：线索池
  let csv = '\ufeff【周度线索池】\n';
  csv += ['级别', '院校', '省份', '层次', '院系', '触发事件', '新设专业', '预算', '截止日期', '开口话术', '原文链接'].join(',') + '\n';
  for (const o of opportunities) {
    csv += [
      o.grade,
      o.schoolName,
      o.province,
      o.tier,
      Array.isArray(o.departments) ? o.departments.join('/') : o.departments,
      o.triggerTitle,
      (o.newMajors || []).map((m) => m.majorName).join('、'),
      o.bestBudget ? fmtYuan(o.bestBudget) : '',
      o.deadline,
      o.talk,
      o.triggerUrl,
    ].map(esc).join(',') + '\n';
  }

  // 表2：本周新增信号
  csv += '\n【本周新增信号】\n';
  csv += ['首次发现', '数据源', '信号类型', '标题', '院校', '原文链接'].join(',') + '\n';
  for (const s of weekSignals) {
    csv += [(s.firstSeenAt || '').slice(0, 10), s.sourceName, s.signalType, s.title, s.schoolName, s.sourceUrl].map(esc).join(',') + '\n';
  }

  const file = path.join(dir, `weekly-${date}.csv`);
  fs.writeFileSync(file, csv, 'utf8');
  console.log(`[weekly] 周度线索池已导出: ${file}（商机${opportunities.length}，本周信号${weekSignals.length}）`);
}

module.exports = { run };
