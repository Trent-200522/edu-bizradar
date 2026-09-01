/**
 * 商机评分引擎（rules.json 驱动）
 * - A类：新设专业 + 无历史软件采购记录 + 预算≥15万
 * - B类：仅师资变动/实验人员招聘信号
 * - 红牌：目标商科专业停招（暂不跟进，从简报剔除）
 * - 关注：有招标信号但不满足A类条件（便于销售自查）
 */
const db = require('../store/db');
const schoolsCfg = require('../../config/schools.json');
const rules = require('../../config/rules.json');
const { makeTalk } = require('../briefing/talk');

function run() {
  const signals = db.readTable('signals');
  const majors = db.readTable('majors');
  const schools = schoolsCfg.schools || [];
  const scoreCfg = rules.score || {};
  const budgetMin = (scoreCfg.A || {}).budgetMin || 150000;
  const windowYears = scoreCfg.softwareHistoryWindowYears || 3;
  const redTriggers = (scoreCfg.redCard || {}).triggerStatus || ['停招'];
  const cutoff = Date.now() - windowYears * 365 * 86400000;

  const bySchool = new Map();
  for (const sig of signals) {
    if (!sig.schoolId) continue;
    if (!bySchool.has(sig.schoolId)) bySchool.set(sig.schoolId, []);
    bySchool.get(sig.schoolId).push(sig);
  }

  const opportunities = [];
  for (const school of schools) {
    const sigs = bySchool.get(school.id) || [];
    const schoolMajors = majors.filter((m) => m.schoolId === school.id);
    if (sigs.length === 0 && schoolMajors.length === 0) continue;

    const reasons = [];
    let grade = '';

    // 红牌：停招专业
    const stopped = schoolMajors.filter((m) => redTriggers.includes(m.status));
    if (stopped.length > 0) {
      grade = '红牌';
      reasons.push(`停招专业：${stopped.map((m) => m.majorName).join('、')}（暂不跟进）`);
    }

    // 新设专业（近2年，状态为公示中/已获批）
    const thisYear = new Date().getFullYear();
    const newMajors = schoolMajors.filter(
      (m) => m.status !== '停招' && m.applyYear && Number(m.applyYear) >= thisYear - 1
    );

    // 预算：该校招标信号中的最大预算
    const bidSignals = sigs.filter((s) => s.signalType === 'bid');
    const maxBudget = bidSignals.reduce((mx, s) => Math.max(mx, s.budget || 0), 0);
    const bestBid = bidSignals.find((s) => s.budget === maxBudget && maxBudget > 0) || bidSignals[0];

    // 历史软件采购记录：窗口期内软件采购/竞品中标信号
    const softwareHistory = sigs.filter(
      (s) =>
        (s.signalType === 'competitorBid' || (s.signalType === 'bid' && s.softwareBuy)) &&
        new Date(s.crawledAt || Date.now()).getTime() >= cutoff
    );

    const hrSignals = sigs.filter((s) => s.signalType === 'hr');

    if (grade !== '红牌') {
      if (
        (scoreCfg.A || {}).requireNewMajor !== false &&
        newMajors.length > 0 &&
        ((scoreCfg.A || {}).requireNoSoftwareHistory === false || softwareHistory.length === 0) &&
        maxBudget >= budgetMin
      ) {
        grade = 'A';
        reasons.push(`新设专业：${newMajors.map((m) => m.majorName).join('、')}`);
        if (maxBudget > 0) reasons.push(`预算 ${fmtYuan(maxBudget)} ≥ ${fmtYuan(budgetMin)}`);
        if (softwareHistory.length === 0) reasons.push('无历史软件采购记录');
      } else if (hrSignals.length > 0 && bidSignals.length === 0 && newMajors.length === 0) {
        grade = 'B';
        reasons.push(`师资变动：${hrSignals[0].title}`);
      } else if (sigs.length > 0) {
        grade = '关注';
        if (newMajors.length > 0) reasons.push(`新设专业：${newMajors.map((m) => m.majorName).join('、')}`);
        if (maxBudget > 0) reasons.push(`招标预算 ${fmtYuan(maxBudget)}`);
        if (softwareHistory.length > 0) reasons.push('有历史软件采购记录（不满足A类）');
      }
    }
    if (!grade) continue;

    // 主触发事件：优先新专业，其次招标，其次师资
    let triggerType = 'bid';
    let triggerSig = bestBid || sigs[0];
    if (newMajors.length > 0) {
      triggerType = 'newMajor';
      triggerSig = sigs.find((s) => s.signalType === 'majorMove') || triggerSig;
    } else if (hrSignals.length > 0 && !bestBid) {
      triggerType = 'hr';
      triggerSig = hrSignals[0];
    } else if (sigs.some((s) => s.signalType === 'competitorBid') && !bestBid) {
      triggerType = 'competitorBid';
      triggerSig = sigs.find((s) => s.signalType === 'competitorBid');
    }

    opportunities.push({
      schoolId: school.id,
      schoolName: school.name,
      province: school.province,
      city: school.city,
      tier: school.tier,
      departments: school.departments,
      grade,
      reasons,
      newMajors: newMajors.map((m) => ({ majorName: m.majorName, applyYear: m.applyYear, status: m.status })),
      stoppedMajors: stopped.map((m) => m.majorName),
      bestBudget: maxBudget,
      deadline: (bestBid && bestBid.deadline) || '',
      contact: school.contactEmail || '',
      triggerType,
      triggerTitle: triggerSig ? triggerSig.title : '',
      triggerUrl: triggerSig ? triggerSig.sourceUrl : '',
      triggerDate: triggerSig ? triggerSig.date : '',
      signalCount: sigs.length,
      talk: makeTalk(triggerType, {
        school,
        major: newMajors[0] ? newMajors[0].majorName : '',
        bidTitle: bestBid ? bestBid.title : '',
        deadline: (bestBid && bestBid.deadline) || '',
        title: triggerSig ? triggerSig.title : '',
      }),
      updatedAt: new Date().toISOString(),
    });
  }

  // 排序：A > 关注 > B > 红牌
  const order = { A: 0, 关注: 1, B: 2, 红牌: 3 };
  opportunities.sort((a, b) => (order[a.grade] - order[b.grade]) || (b.bestBudget - a.bestBudget));
  db.writeTable('opportunities', opportunities);
  const stat = {};
  opportunities.forEach((o) => (stat[o.grade] = (stat[o.grade] || 0) + 1));
  console.log(`[score] 商机 ${opportunities.length} 条：`, stat);
}

function fmtYuan(n) {
  if (!n) return '';
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿元`;
  if (n >= 1e4) return `${(n / 1e4).toFixed(1)}万元`;
  return `${n}元`;
}

module.exports = { run, fmtYuan };
