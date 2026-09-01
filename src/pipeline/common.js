/**
 * 通用列表解析 + 信号归一化
 * 政府/高校页面结构异构严重，这里提供"选择器优先 + 通用兜底"两级解析
 */
const cheerio = require('cheerio');
const { URL } = require('url');
const keywords = require('../../config/keywords.json');
const schoolsCfg = require('../../config/schools.json');

const SCHOOL_NAMES = (schoolsCfg.schools || []).map((s) => s.name).sort((a, b) => b.length - a.length);

function absUrl(base, href) {
  if (!href || href.startsWith('javascript:') || href.startsWith('#')) return '';
  try {
    return new URL(href, base).toString();
  } catch {
    return '';
  }
}

/** 从任意文本中提取最近的一个日期，返回 YYYY-MM-DD 或 '' */
function extractDate(text) {
  const t = String(text || '');
  const m = /(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/.exec(t);
  if (!m) return '';
  const mm = m[2].padStart(2, '0');
  const dd = m[3].padStart(2, '0');
  return `${m[1]}-${mm}-${dd}`;
}

/** 提取投标截止日期："于2026年09月21日09时30分前提交"/"截止"等 */
function extractDeadline(text) {
  const m = /(20\d{2})年(\d{1,2})月(\d{1,2})日[^。\n]{0,30}?(?:前|截止)/.exec(String(text || ''));
  if (!m) return '';
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

/** 提取招标代理机构名称 */
function extractAgency(text) {
  const m = /(?:采购代理机构|招标代理机构|代理机构)[：:名称\s]{0,6}([\u4e00-\u9fa5A-Za-z()（）]{4,30}?)(?:公司|机构|中心|事务所)/.exec(String(text || ''));
  return m ? m[1] + m[2] : '';
}

function cleanText(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * 从列表页提取条目：[{title, url, date, summary}]
 * selectors 可选：{item, link, date}；为空则走通用兜底解析
 */
function extractListItems(html, baseUrl, selectors = {}) {
  const $ = cheerio.load(html);
  const items = [];
  const seen = new Set();

  const push = (title, href, date, summary) => {
    const url = absUrl(baseUrl, href);
    title = cleanText(title);
    if (!title || title.length < 6 || title.length > 120 || !url) return;
    const key = url + '|' + title;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ title, url, date: date || '', summary: cleanText(summary).slice(0, 300) });
  };

  if (selectors.item) {
    try {
      $(selectors.item).each((_, el) => {
        const $el = $(el);
        const $a = selectors.link ? $el.find(selectors.link).first() : $el.find('a').first();
        if (!$a.length) return;
        const date = selectors.date ? cleanText($el.find(selectors.date).first().text()) : extractDate($el.text());
        push($a.text() || $a.attr('title'), $a.attr('href'), extractDate(date) || extractDate($el.text()), $el.text());
      });
      if (items.length > 0) return items.slice(0, 100);
    } catch {
      /* 选择器失效走兜底 */
    }
  }

  // 通用兜底：扫描所有链接，取文本≥6字且父级文本含日期的条目
  $('a').each((_, el) => {
    const $a = $(el);
    const title = $a.text() || $a.attr('title') || '';
    const href = $a.attr('href');
    if (!href || cleanText(title).length < 6) return;
    const parentText = $a.parent().text() || '';
    const date = extractDate(parentText);
    if (!date) return; // 无日期多为导航链接，过滤
    push(title, href, date, parentText);
  });
  return items.slice(0, 100);
}

function hitKeywords(text, group) {
  const list = keywords[group] || [];
  return list.filter((kw) => text.includes(kw));
}

/** 在文本中匹配目标院校（最长校名优先） */
function matchSchool(text) {
  const t = String(text || '');
  for (const name of SCHOOL_NAMES) {
    if (t.includes(name)) {
      return (schoolsCfg.schools || []).find((s) => s.name === name) || null;
    }
  }
  return null;
}

/** 提取文本中出现的商科专业名称 */
function extractBusinessMajors(text) {
  return (keywords.businessMajorNames || []).filter((m) => String(text || '').includes(m));
}

/** 从招标摘要/标题中提取预算金额（单位：元），无法识别返回 0 */
function extractBudget(text) {
  const t = String(text || '');
  let m = /预算[^0-9]{0,8}([0-9][0-9,.]*)\s*万/.exec(t) || /([0-9][0-9,.]*)\s*万元/.exec(t);
  if (m) return Math.round(parseFloat(m[1].replace(/,/g, '')) * 10000);
  m = /预算[^0-9]{0,8}([0-9][0-9,.]*)\s*亿/.exec(t);
  if (m) return Math.round(parseFloat(m[1].replace(/,/g, '')) * 1e8);
  m = /([0-9][0-9,.]{5,})\s*元/.exec(t);
  if (m) return Math.round(parseFloat(m[1].replace(/,/g, '')));
  return 0;
}

/** 判断是否含"软件采购/平台部署"类内容 */
function hasSoftwareBuy(text) {
  return hitKeywords(text, 'softwareBuy').length > 0;
}

/** 构造标准信号对象 */
function buildSignal({ sourceId, sourceName, level, signalType, item, school, extra = {} }) {
  const fullText = `${item.title} ${item.summary || ''}`;
  return {
    sourceId,
    sourceName,
    level,
    signalType, // bid / majorMove / hr / grant / competitorBid
    schoolId: school ? school.id : '',
    schoolName: school ? school.name : (extra.schoolName || ''),
    title: item.title,
    date: item.date || '',
    budget: extractBudget(fullText),
    deadline: extra.deadline || extractDeadline(fullText),
    agency: extra.agency || extractAgency(fullText),
    softwareBuy: hasSoftwareBuy(fullText),
    businessMajors: extractBusinessMajors(fullText),
    summary: item.summary || '',
    sourceUrl: item.url,
    crawledAt: new Date().toISOString(),
    ...extra,
  };
}

module.exports = { extractListItems, extractDate, extractDeadline, extractAgency, cleanText, hitKeywords, matchSchool, extractBusinessMajors, extractBudget, hasSoftwareBuy, buildSignal, absUrl };
