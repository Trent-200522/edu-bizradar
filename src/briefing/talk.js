/** 一句销售开口话术：模板槽位填充，不依赖大模型 */
const rules = require('../../config/rules.json');

const TPL = (rules.briefing || {}).talkTemplates || {};
const DEFAULT_CONTACT = (rules.briefing || {}).defaultContact || '院系负责人';

function contactOf(school) {
  if (!school) return DEFAULT_CONTACT;
  const dept = Array.isArray(school.departments) && school.departments.length ? school.departments[0] : '经管学院';
  return `${dept}负责人`;
}

function nextMonth() {
  const m = new Date().getMonth() + 2; // 下月
  return m > 12 ? m - 12 : m;
}

function fill(tpl, vars) {
  if (!tpl) return '';
  // 无截止日期的特殊处理，避免出现"距—截止还有时间"的病句
  let text = tpl;
  if (!vars.deadline) {
    text = text
      .replace(/，?距\{deadline\}截止还有时间，?/g, '')
      .replace(/，?距—截止还有时间，?/g, '');
  }
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null && vars[k] !== '' ? vars[k] : '—'));
}

/** 截断过长标题，用于话术中的项目引用 */
function shortTitle(title) {
  const t = String(title || '');
  return t.length > 30 ? t.slice(0, 30) + '…' : t;
}

/**
 * 按商机主触发类型生成话术
 * @param {string} triggerType  newMajor/bid/hr/grant/competitorBid
 * @param {object} ctx  {school, major, bidTitle, deadline, title}
 */
function makeTalk(triggerType, ctx = {}) {
  const school = ctx.school || null;
  const vars = {
    contact: contactOf(school),
    major: ctx.major || '',
    month: nextMonth(),
    bidTitle: shortTitle(ctx.bidTitle || ''),
    deadline: ctx.deadline || '',
    title: ctx.title || '',
    advantage: '省级立项虚拟仿真实验库与同类院校落地案例',
  };
  return fill(TPL[triggerType] || TPL.bid, vars);
}

module.exports = { makeTalk };
