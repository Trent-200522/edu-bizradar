/**
 * 数据源探测工具（开发辅助）
 *   node scripts/probe.js            探测省教育厅公告栏目（自动发现候选）
 *   node scripts/probe.js campus     探测目标院校招标/采购栏目链接
 *   node scripts/probe.js url <u1> <u2> ...   对指定 URL 评估列表条目数
 */
const cheerio = require('cheerio');
const { fetchPage } = require('../src/fetch/http');
const { extractListItems, absUrl, hitKeywords } = require('../src/pipeline/common');
const schoolsCfg = require('../config/schools.json');
const sourcesCfg = require('../config/sources.json');

const PROV = (sourcesCfg.sources || []).filter((s) => s.adapter === 'province');
const SAMPLE = ['zjgsu', 'zufe', 'hdu', 'zjut', 'wzu', 'nbu', 'hznu', 'zust'];

function evalPage(html, baseUrl) {
  const items = extractListItems(html, baseUrl, {});
  const kwHits = items.filter((i) => hitKeywords(`${i.title} ${i.summary}`, 'major').length > 0);
  return { items, kwHits };
}

async function probeProvince() {
  for (const src of PROV) {
    const url = src.urls[0];
    console.log(`\n===== ${src.name} ${url} =====`);
    const html = await fetchPage(url);
    if (!html) { console.log('  抓取失败'); continue; }
    const $ = cheerio.load(html);
    const { items } = evalPage(html, url);
    console.log(`  首页列表条目: ${items.length}`);
    // 找"通知/公告/公示"栏目链接候选
    const cands = new Map();
    $('a').each((_, el) => {
      const t = ($(el).text() || '').trim();
      const href = $(el).attr('href');
      if (!href || !/通知|公告|公示/.test(t) || t.length > 12) return;
      const u = absUrl(url, href);
      if (u && !cands.has(u)) cands.set(u, t);
    });
    for (const [u, t] of [...cands.entries()].slice(0, 6)) {
      const h2 = await fetchPage(u);
      if (!h2) { console.log(`  [${t}] ${u} -> 抓取失败`); continue; }
      const r = evalPage(h2, u);
      console.log(`  [${t}] ${u} -> 条目${r.items.length}${r.items.length ? '，首条: ' + r.items[0].title.slice(0, 40) : ''}`);
    }
  }
}

async function probeCampus() {
  const schools = (schoolsCfg.schools || []).filter((s) => SAMPLE.includes(s.id));
  for (const school of schools) {
    console.log(`\n===== ${school.name} ${school.site} =====`);
    const html = await fetchPage(school.site);
    if (!html) { console.log('  主页抓取失败'); continue; }
    const $ = cheerio.load(html);
    const cands = new Map();
    $('a').each((_, el) => {
      const t = ($(el).text() || '').trim();
      const href = $(el).attr('href');
      if (!href || !/招标|采购/.test(t) || t.length > 16) return;
      const u = absUrl(school.site, href);
      if (u && !cands.has(u)) cands.set(u, t);
    });
    if (cands.size === 0) console.log('  未找到招标/采购链接');
    for (const [u, t] of [...cands.entries()].slice(0, 4)) {
      const h2 = await fetchPage(u);
      if (!h2) { console.log(`  [${t}] ${u} -> 抓取失败`); continue; }
      const r = evalPage(h2, u);
      console.log(`  [${t}] ${u} -> 条目${r.items.length}${r.items.length ? '，首条: ' + r.items[0].title.slice(0, 40) : ''}`);
    }
  }
}

async function probeUrls(urls) {
  for (const u of urls) {
    const html = await fetchPage(u);
    if (!html) { console.log(`${u} -> 抓取失败`); continue; }
    const r = evalPage(html, u);
    console.log(`${u} -> 条目${r.items.length}${r.items.length ? '，首条: ' + r.items[0].title.slice(0, 40) : ''}`);
  }
}

(async () => {
  const mode = process.argv[2];
  if (mode === 'campus') await probeCampus();
  else if (mode === 'url') await probeUrls(process.argv.slice(3));
  else await probeProvince();
})();
