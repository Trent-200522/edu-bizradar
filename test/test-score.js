/**
 * 评分引擎三分支测试（A类/B类/红牌/关注）
 * 注入合成数据验证后恢复真实数据
 */
const fs = require('fs');
const path = require('path');
const db = require('../src/store/db');

const now = new Date().toISOString();

function backup(name) {
  const p = path.join(db.DATA_DIR, `${name}.json`);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}
function restore(name, content) {
  const p = path.join(db.DATA_DIR, `${name}.json`);
  if (content === null) fs.existsSync(p) && fs.rmSync(p);
  else fs.writeFileSync(p, content, 'utf8');
}

const syntheticSignals = [
  // zufe：新专业 + 20万招标 + 无软件采购记录 → A类
  { sourceId: 'test', sourceName: '测试', level: 'P0', signalType: 'bid', schoolId: 'zufe', schoolName: '浙江财经大学', title: '浙江财经大学数智商科实训平台采购项目公开招标公告', date: '2026-08-30', budget: 200000, deadline: '2026-09-20', agency: '测试代理公司', softwareBuy: false, businessMajors: ['大数据与财务管理'], summary: '预算金额20万元', sourceUrl: 'http://example.com/1', crawledAt: now },
  { sourceId: 'test', sourceName: '测试', level: 'P0', signalType: 'majorMove', schoolId: 'zufe', schoolName: '浙江财经大学', title: '浙江财经大学新增大数据与财务管理专业公示', date: '2026-08-20', budget: 0, deadline: '', agency: '', softwareBuy: false, businessMajors: ['大数据与财务管理'], summary: '2026年备案 公示', sourceUrl: 'http://example.com/2', crawledAt: now },
  // hznu：仅师资招聘 → B类
  { sourceId: 'test', sourceName: '测试', level: 'P1', signalType: 'hr', schoolId: 'hznu', schoolName: '杭州师范大学', title: '杭州师范大学2026年公开招聘实验教学人员公告', date: '2026-08-25', budget: 0, deadline: '', agency: '', softwareBuy: false, businessMajors: [], summary: '招聘实验师2名', sourceUrl: 'http://example.com/3', crawledAt: now },
  // usx：会计学专业停招 → 红牌
  { sourceId: 'test', sourceName: '测试', level: 'P0', signalType: 'majorMove', schoolId: 'usx', schoolName: '绍兴文理学院', title: '绍兴文理学院关于会计学专业停止招生的公示', date: '2026-08-15', budget: 0, deadline: '', agency: '', softwareBuy: false, businessMajors: ['会计学'], summary: '经研究决定，会计学专业自2026年起停招', sourceUrl: 'http://example.com/4', crawledAt: now },
  // zust：新专业+预算够，但有历史软件采购记录 → 关注（非A）
  { sourceId: 'test', sourceName: '测试', level: 'P0', signalType: 'bid', schoolId: 'zust', schoolName: '浙江科技大学', title: '浙江科技大学经管综合实训软件采购项目中标公告', date: '2026-08-28', budget: 300000, deadline: '', agency: '', softwareBuy: true, businessMajors: [], summary: '实训软件采购，预算30万元', sourceUrl: 'http://example.com/5', crawledAt: now },
  { sourceId: 'test', sourceName: '测试', level: 'P0', signalType: 'majorMove', schoolId: 'zust', schoolName: '浙江科技大学', title: '浙江科技大学新增数字经济专业获批', date: '2026-08-22', budget: 0, deadline: '', agency: '', softwareBuy: false, businessMajors: ['数字经济'], summary: '2026年备案 批准', sourceUrl: 'http://example.com/6', crawledAt: now },
];

const syntheticMajors = [
  { dedupKey: 't1', schoolId: 'zufe', schoolName: '浙江财经大学', majorCode: '120210T', majorName: '大数据与财务管理', applyYear: '2026', batch: '2026年备案', status: '公示中', enrollmentTrend: '', sourceUrl: 'http://example.com/2', crawledAt: now },
  { dedupKey: 't2', schoolId: 'usx', schoolName: '绍兴文理学院', majorCode: '120203K', majorName: '会计学', applyYear: '2026', batch: '', status: '停招', enrollmentTrend: '', sourceUrl: 'http://example.com/4', crawledAt: now },
  { dedupKey: 't3', schoolId: 'zust', schoolName: '浙江科技大学', majorCode: '020109T', majorName: '数字经济', applyYear: '2026', batch: '2026年备案', status: '已获批', enrollmentTrend: '', sourceUrl: 'http://example.com/6', crawledAt: now },
];

const expected = { zufe: 'A', hznu: 'B', usx: '红牌', zust: '关注' };

function main() {
  const bakSignals = backup('signals');
  const bakMajors = backup('majors');
  const bakOpps = backup('opportunities');
  let failed = 0;
  try {
    db.writeTable('signals', syntheticSignals);
    db.writeTable('majors', syntheticMajors);
    require('../src/score/engine').run();
    const opps = db.readTable('opportunities');
    for (const [schoolId, want] of Object.entries(expected)) {
      const got = opps.find((o) => o.schoolId === schoolId);
      const grade = got ? got.grade : '(未生成)';
      const ok = grade === want;
      if (!ok) failed++;
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${schoolId}: 期望[${want}] 实际[${grade}]${got ? '  依据: ' + got.reasons.join('；') : ''}`);
      if (got && want === 'A' && !got.talk.includes('demo')) {
        failed++;
        console.log(`FAIL  zufe 话术异常: ${got.talk}`);
      }
    }
  } finally {
    restore('signals', bakSignals);
    restore('majors', bakMajors);
    restore('opportunities', bakOpps);
    console.log('[test] 已恢复真实数据');
  }
  console.log(failed === 0 ? '===== 全部通过 =====' : `===== ${failed} 项失败 =====`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
