/**
 * 中国政府采购网（ccgp.gov.cn）搜索采集
 * - 按关键词组批量搜索招标公告，窗口为最近 searchDays 天
 * - 反爬降级：主站全部失败时改用配置的兜底站点（省采购网/公共服务平台）做列表页采集
 * - 竞品监测复用本适配器（keywordGroup=competitors，signalType=competitorBid）
 */
const cheerio = require('cheerio');
const { fetchPage } = require('../http');
const { saveRaw } = require('../../store/db');
const keywordsCfg = require('../../../config/keywords.json');
const { extractListItems, extractDate, cleanText, matchSchool, buildSignal, hitKeywords } = require('../../pipeline/common');

function fmtDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}:${p(d.getMonth() + 1)}:${p(d.getDate())}`;
}

function searchUrl(kw, page, start, end) {
  const params = new URLSearchParams({
    searchtype: '1',
    page_index: String(page),
    bidSort: '0',
    buyerName: '',
    projectId: '',
    pinMu: '0',
    bidType: '0',
    dbselect: 'bidx',
    kw,
    start_time: start,
    end_time: end,
    timeType: '6',
    displayZone: '',
    zoneId: '',
    pppStatus: '0',
    agentName: '',
  });
  return `http://search.ccgp.gov.cn/bxsearch?${params.toString()}`;
}

/** 解析 ccgp 搜索结果页 */
function parseCcgpResults(html, baseUrl) {
  const $ = cheerio.load(html);
  const items = [];
  $('ul.vT-srch-result-list-bid li, ul.vT-srch-result-list li').each((_, el) => {
    const $li = $(el);
    const $a = $li.find('a').first();
    if (!$a.length) return;
    const title = cleanText($a.text());
    const href = $a.attr('href');
    const summary = cleanText($li.find('p').text() || $li.text());
    items.push({ title, url: href || '', date: extractDate($li.text()), summary: summary.slice(0, 300) });
  });
  if (items.length > 0) return items;
  return extractListItems(html, baseUrl, {});
}

async function collect(source) {
  const signals = [];
  const kws = (keywordsCfg[source.keywordGroup] || []).slice(0, 8);
  const end = new Date();
  const start = new Date(Date.now() - (source.searchDays || 3) * 86400000);
  let ccgpOk = 0;

  for (const kw of kws) {
    for (let page = 1; page <= (source.maxPages || 1); page++) {
      const url = searchUrl(kw, page, fmtDate(start), fmtDate(end));
      const html = await fetchPage(url);
      if (!html) continue;
      if (/验证|captcha|checkcode/i.test(html.slice(0, 500)) && !html.includes('vT-srch-result')) {
        console.warn('[ccgp] 触发反爬验证，停止该关键词');
        break;
      }
      saveRaw(source.id, url, html);
      ccgpOk++;
      for (const item of parseCcgpResults(html, url)) {
        const text = `${item.title} ${item.summary}`;
        if (!hitKeywords(text, source.keywordGroup).length && !text.includes(kw)) continue;
        const school = matchSchool(text);
        signals.push(
          buildSignal({
            sourceId: source.id,
            sourceName: source.name,
            level: source.level,
            signalType: source.signalType || 'bid',
            item,
            school,
            extra: { keyword: kw },
          })
        );
      }
    }
  }

  // 反爬降级：主站一无所获时用兜底站点
  if (ccgpOk === 0 && Array.isArray(source.fallbacks)) {
    for (const fb of source.fallbacks) {
      const html = await fetchPage(fb.url);
      if (!html) continue;
      saveRaw(source.id, fb.url, html);
      for (const item of extractListItems(html, fb.url, {})) {
        const text = `${item.title} ${item.summary}`;
        if (!hitKeywords(text, source.keywordGroup).length) continue;
        signals.push(
          buildSignal({
            sourceId: source.id,
            sourceName: `${source.name}(兜底:${fb.name})`,
            level: source.level,
            signalType: source.signalType || 'bid',
            item,
            school: matchSchool(text),
          })
        );
      }
    }
  }
  return signals;
}

module.exports = { collect };
