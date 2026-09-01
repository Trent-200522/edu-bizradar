// 临时探测：在指定主页中查找"招标/采购"栏目链接
const cheerio = require('cheerio');
const { fetchPage } = require('../src/fetch/http');
const { absUrl } = require('../src/pipeline/common');

(async () => {
  for (const base of process.argv.slice(2)) {
    const html = await fetchPage(base);
    if (!html) { console.log(base, '抓取失败'); continue; }
    const $ = cheerio.load(html);
    const seen = new Set();
    $('a').each((_, el) => {
      const t = ($(el).text() || '').trim();
      const h = $(el).attr('href');
      if (!h || !/招标|采购/.test(t) || t.length > 16) return;
      const u = absUrl(base, h);
      if (u && !seen.has(u)) { seen.add(u); console.log(base, '->', t, u); }
    });
    if (seen.size === 0) console.log(base, '-> 无招标/采购链接');
  }
})();
