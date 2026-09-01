/**
 * 抓取基础层（合规强制层）：
 * - 仅抓取公开发布页面；遵守 robots.txt（Disallow 命中即跳过）
 * - 全局限速（默认 ≥2s/请求）、超时、有限重试、浏览器 UA
 * - 自动识别 GBK/UTF-8 编码（政府站常见 GBK）
 */
const { URL } = require('url');

const sourcesCfg = require('../../config/sources.json');
const G = sourcesCfg.global || {};
const UA = G.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const TIMEOUT = G.timeoutMs || 20000;
const MAX_RETRY = G.maxRetry == null ? 2 : G.maxRetry;
const DELAY = G.delayMs || 2000;
const RESPECT_ROBOTS = G.respectRobots !== false;

const robotsCache = new Map(); // origin -> {rules:[{path}], fetchedAt}
let lastRequestAt = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function throttle() {
  const wait = lastRequestAt + DELAY - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function fetchText(url, extraHeaders = {}) {
  await throttle();
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      ...extraHeaders,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return decodeHtml(buf, res.headers.get('content-type') || '');
}

/** 按 HTTP 头 / meta charset / BOM 判断编码，GBK 站点用 TextDecoder('gbk') */
function decodeHtml(buf, contentType) {
  let charset = '';
  const ctMatch = /charset\s*=\s*([\w-]+)/i.exec(contentType);
  if (ctMatch) charset = ctMatch[1];
  if (!charset) {
    const head = buf.slice(0, 2048).toString('latin1');
    const m = /charset\s*=\s*["']?([\w-]+)/i.exec(head);
    if (m) charset = m[1];
  }
  charset = charset.toLowerCase();
  if (charset === 'utf-8' || charset === 'utf8') return buf.toString('utf8');
  try {
    return new TextDecoder(charset).decode(buf);
  } catch {
    return buf.toString('utf8');
  }
}

async function fetchRobots(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let rules = [];
  try {
    const text = await fetchText(origin + '/robots.txt');
    let inOurAgent = false;
    let inAny = false;
    for (const line of text.split(/\r?\n/)) {
      const l = line.trim();
      if (/^user-agent\s*:/i.test(l)) {
        const agent = l.split(':')[1].trim();
        inOurAgent = /edubizradar/i.test(agent);
        inAny = agent === '*';
      } else if (/^disallow\s*:/i.test(l) && (inOurAgent || inAny)) {
        const p = l.split(':')[1].trim();
        if (p) rules.push(p);
      }
    }
  } catch {
    // robots 不可达时不阻断（多数政府站未部署 robots）
  }
  const entry = { rules, fetchedAt: Date.now() };
  robotsCache.set(origin, entry);
  return entry;
}

async function allowedByRobots(url) {
  if (!RESPECT_ROBOTS) return true;
  const u = new URL(url);
  const { rules } = await fetchRobots(u.origin);
  return !rules.some((p) => u.pathname.startsWith(p));
}

/**
 * 带限速、重试、robots 检查的页面抓取
 * @returns {Promise<string|null>} HTML 文本；失败返回 null 并打日志
 */
async function fetchPage(url, { retries = MAX_RETRY } = {}) {
  try {
    if (!(await allowedByRobots(url))) {
      console.warn(`[fetch] robots.txt 禁止，跳过: ${url}`);
      return null;
    }
  } catch {
    /* robots 检查异常不阻断 */
  }
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchText(url);
    } catch (e) {
      if (i === retries) {
        console.warn(`[fetch] 失败(${e.message}): ${url}`);
        return null;
      }
      await sleep(1500 * (i + 1));
    }
  }
  return null;
}

module.exports = { fetchPage, fetchText, sleep, UA };
