// 临时探测：在指定院校主页中查找"师资/教师队伍"栏目链接并评估列表条目数
const cheerio = require('cheerio');
const { fetchPage } = require('../src/fetch/http');
const { extractListItems, absUrl } = require('../src/pipeline/common');
const schoolsCfg = require('../config/schools.json');

const TARGETS = process.argv.slice(2); // 院校 id 列表
(async () => {
  const schools = (schoolsCfg.schools || []).filter((s) => TARGETS.includes(s.id));
  for (const school of schools) {
    console.log(`\n===== ${school.name} ${school.site} =====`);
    const html = await fetchPage(school.site);
    if (!html) { console.log('  主页抓取失败'); continue; }
    const $ = cheerio.load(html);
    const seen = new Set();
    const cands = [];
    $('a').each((_, el) => {
      const t = ($(el).text() || '').trim();
      const h = $(el).attr('href');
      if (!h || !/师资队伍|师资|教师队伍|人才/.test(t) || t.length > 12) return;
      const u = absUrl(school.site, h);
      if (u && !seen.has(u)) { seen.add(u); cands.push([u, t]); }
    });
    if (!cands.length) { console.log('  未找到师资链接'); continue; }
    for (const [u, t] of cands.slice(0, 3)) {
      const h2 = await fetchPage(u);
      if (!h2) { console.log(`  [${t}] ${u} -> 抓取失败`); continue; }
      const items = extractListItems(h2, u, {});
      console.log(`  [${t}] ${u} -> 条目${items.length}${items.length ? '，首条: ' + items[0].title.slice(0, 30) : ''}`);
    }
  }
})();
