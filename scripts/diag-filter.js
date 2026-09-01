// 诊断：检查各省教育厅/院校招标栏目在当前解析器下的条目数与关键词命中
const { fetchPage } = require('../src/fetch/http');
const { extractListItems, hitKeywords, extractBusinessMajors, matchSchool } = require('../src/pipeline/common');

const CASES = [
  ['major', 'http://jyt.henan.gov.cn/xxgk/gggs/'],
  ['major', 'http://jyt.henan.gov.cn/xxgk/wjtz/'],
  ['major', 'https://edu.gd.gov.cn/zwgknew/gsgg/index.html'],
  ['major', 'http://jyt.hubei.gov.cn/zfxxgk/zc_GK2020/qtzdgkwj_GK2020/'],
  ['procurement', 'https://www.zust.edu.cn/index/ksdh/zbcg.htm'],
  ['procurement', 'https://ztb.usx.edu.cn/'],
];
(async () => {
  for (const [group, url] of CASES) {
    const html = await fetchPage(url);
    if (!html) { console.log(`${url} -> 抓取失败`); continue; }
    const items = extractListItems(html, url, {});
    let hit = 0;
    for (const i of items.slice(0, 8)) {
      const text = `${i.title} ${i.summary}`;
      const hits = hitKeywords(text, group);
      const biz = extractBusinessMajors(text);
      const sch = matchSchool(text);
      if (hits.length) hit++;
      if (items.indexOf(i) < 5) console.log(`  - ${i.title.slice(0, 42)} | kw[${hits.join(',')}] biz[${biz.join(',')}] school=${sch ? sch.name : '-'}`);
    }
    console.log(`${url}\n  条目${items.length}，关键词命中${hit}\n`);
  }
})();
