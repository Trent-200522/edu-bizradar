/**
 * 总调度入口
 *   node src/run.js collect    按各源频率执行采集 → 去重入库 → 派生专业动态
 *   node src/run.js score      商机评分（A类/B类/红牌）
 *   node src/run.js briefing   生成每日简报 + 推送企业微信/飞书
 *   node src/run.js weekly     导出周度线索池 CSV
 *   node src/run.js site       生成 GitHub Pages 静态站
 *   node src/run.js all        collect → score → briefing → site
 */
const fs = require('fs');
const path = require('path');
const sourcesCfg = require('../config/sources.json');
const db = require('./store/db');

const STATE_FILE = path.join(db.DATA_DIR, 'state.json');
const ADAPTERS = {
  moe: require('./fetch/adapters/moe'),
  province: require('./fetch/adapters/province'),
  ccgp: require('./fetch/adapters/ccgp'),
  'campus-bid': require('./fetch/adapters/campus-bid'),
  hr: require('./fetch/adapters/hr'),
  grant: require('./fetch/adapters/grant'),
};

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  db.ensureDir(db.DATA_DIR);
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

/** 判断某源是否到期（超过 freqHours） */
function due(state, source) {
  const last = state[source.id];
  if (!last) return true;
  return Date.now() - new Date(last).getTime() >= (source.freqHours || 24) * 3600000;
}

async function collect() {
  const state = readState();
  const sources = (sourcesCfg.sources || []).filter((s) => s.enabled !== false);
  let totalAdded = 0;
  let totalSkipped = 0;
  for (const source of sources) {
    if (!due(state, source)) {
      console.log(`[collect] ${source.name} 未到周期，跳过`);
      continue;
    }
    const adapter = ADAPTERS[source.adapter];
    if (!adapter) {
      console.warn(`[collect] 未知适配器: ${source.adapter}`);
      continue;
    }
    console.log(`[collect] 开始采集: ${source.name} (${source.id})`);
    try {
      const signals = await adapter.collect(source);
      const { added, skipped } = db.upsertSignals(signals);
      totalAdded += added;
      totalSkipped += skipped;
      console.log(`[collect] ${source.name}: 抓取${signals.length}条，新增${added}，去重${skipped}`);
    } catch (e) {
      console.error(`[collect] ${source.name} 异常:`, e.message);
    }
    state[source.id] = new Date().toISOString();
    writeState(state);
  }
  deriveMajors();
  console.log(`[collect] 完成：新增${totalAdded}，去重${totalSkipped}`);
}

/** 从"专业动态"信号派生商科专业动态表（申报年份/批次/状态） */
function deriveMajors() {
  const signals = db.readTable('signals').filter((s) => s.signalType === 'majorMove');
  const majors = db.readTable('majors');
  const seen = new Set(majors.map((m) => m.dedupKey));
  let added = 0;
  for (const sig of signals) {
    const text = `${sig.title} ${sig.summary}`;
    for (const majorName of sig.businessMajors || []) {
      const yearMatch = /(20\d{2})\s*年/.exec(text);
      const year = yearMatch ? yearMatch[1] : '';
      const batchMatch = /(20\d{2})\s*年(备案|审批|新增)/.exec(text);
      let status = '公示中';
      if (/停招|停止招生/.test(text)) status = '停招';
      else if (/批准|获批|备案通过|予以备案/.test(text)) status = '已获批';
      const key = db.hash(`${sig.schoolId}|${majorName}|${year}|${status}`);
      if (seen.has(key)) continue;
      seen.add(key);
      majors.push({
        dedupKey: key,
        schoolId: sig.schoolId,
        schoolName: sig.schoolName,
        majorCode: '',
        majorName,
        applyYear: year,
        batch: batchMatch ? batchMatch[0] : '',
        status,
        enrollmentTrend: '', // 近3年招生数变化：公开数据可得时人工/后续补充
        sourceUrl: sig.sourceUrl,
        crawledAt: sig.crawledAt,
      });
      added++;
    }
  }
  if (added > 0) {
    db.writeTable('majors', majors);
    console.log(`[collect] 专业动态表新增 ${added} 条`);
  }
}

async function main() {
  const cmd = process.argv[2] || 'collect';
  switch (cmd) {
    case 'collect':
      await collect();
      break;
    case 'score':
      require('./score/engine').run();
      break;
    case 'briefing':
      await require('./briefing/daily').run(true);
      break;
    case 'briefing-nopush':
      await require('./briefing/daily').run(false);
      break;
    case 'weekly':
      require('./briefing/weekly').run();
      break;
    case 'site':
      require('./site/build').run();
      break;
    case 'all':
      await collect();
      require('./score/engine').run();
      await require('./briefing/daily').run(true);
      require('./site/build').run();
      break;
    default:
      console.error(`未知命令: ${cmd}（可用：collect/score/briefing/weekly/site/all）`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error('[run] 致命错误:', e);
  process.exit(1);
});
