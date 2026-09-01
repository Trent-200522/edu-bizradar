/**
 * 每日 08:30《今日高意向商科院校商机简报》
 * 结构：纯文字 + 表格 + 原文链接；红牌院校剔除
 * 输出：data/briefings/YYYY-MM-DD.md 与 .html，并推送企业微信/飞书
 */
const fs = require('fs');
const path = require('path');
const db = require('../store/db');
const rules = require('../../config/rules.json');
const { fmtYuan } = require('../score/engine');
const { pushBriefing } = require('./push-webhook');

const TRIGGER_NAME = {
  newMajor: '新设专业',
  bid: '招标/采购',
  hr: '师资招聘',
  grant: '课题立项',
  competitorBid: '竞品中标',
  majorMove: '专业动态',
};

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function buildBriefing() {
  const opportunities = db.readTable('opportunities');
  const signals = db.readTable('signals');
  const maxItems = (rules.briefing || {}).maxItems || 30;
  const date = today();

  // 红牌剔除；其余按 A > 关注 > B 排序
  const list = opportunities
    .filter((o) => o.grade !== '红牌')
    .slice(0, maxItems);
  const redCards = opportunities.filter((o) => o.grade === '红牌');

  // 过去24小时新增信号（用于"今日新增动态"栏目）
  const dayAgo = Date.now() - 86400000;
  const freshSignals = signals.filter((s) => new Date(s.firstSeenAt || s.crawledAt).getTime() >= dayAgo);

  const stat = { A: 0, 关注: 0, B: 0 };
  list.forEach((o) => (stat[o.grade] = (stat[o.grade] || 0) + 1));

  let md = `# 《今日高意向商科院校商机简报》\n`;
  md += `**日期：${date}**  |  A类 ${stat.A} 个  |  关注 ${stat.关注} 个  |  B类 ${stat.B} 个  |  红牌（暂不跟进）${redCards.length} 个\n\n`;

  md += `## 一、高意向商机清单（A类优先）\n\n`;
  if (list.length === 0) {
    md += `> 暂无新增高意向商机，建议核对数据源配置后重新采集。\n`;
  } else {
    md += `| 级别 | 触发事件 | 院校+院系 | 关键联系人 | 预算与Deadline | 原文 |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const o of list) {
      const depts = Array.isArray(o.departments) ? o.departments.join('/') : o.departments || '';
      const budget = o.bestBudget ? fmtYuan(o.bestBudget) : '待核实';
      const deadline = o.deadline ? `，截止 ${o.deadline}` : '';
      md += `| **${o.grade}** | ${TRIGGER_NAME[o.triggerType] || o.triggerType}：${o.triggerTitle} | ${o.schoolName}（${depts}） | ${o.contact || '院系公开渠道'} | ${budget}${deadline} | [原文](${o.triggerUrl}) |\n`;
    }
    md += `\n## 二、开口话术（可直接复制）\n\n`;
    for (const o of list) {
      if (!o.talk) continue;
      md += `- **${o.schoolName}**（${o.grade}）：${o.talk}\n`;
    }
  }

  if (freshSignals.length > 0) {
    md += `\n## 三、过去24小时新增信号（${freshSignals.length}条）\n\n`;
    for (const s of freshSignals.slice(0, 20)) {
      md += `- [${s.sourceName}] ${s.title}（${s.schoolName || '未匹配院校'}）[原文](${s.sourceUrl})\n`;
    }
  }

  if (redCards.length > 0) {
    md += `\n## 四、红牌提示（停招，暂不跟进）\n\n`;
    for (const o of redCards) {
      md += `- ${o.schoolName}：${o.reasons.join('；')}\n`;
    }
  }

  md += `\n---\n*本简报由「商科商机雷达」自动生成，仅使用公开信息。生成时间：${new Date().toLocaleString('zh-CN', { hour12: false })}*\n`;
  return { md, date };
}

function mdToHtml(md) {
  // 轻量转换：标题/表格/列表/链接/加粗，不引入额外依赖
  const lines = md.split('\n');
  let html = '';
  let inTable = false;
  let inList = false;
  const inline = (s) =>
    s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  for (const line of lines) {
    if (line.startsWith('|')) {
      if (!inTable) { html += '<table>'; inTable = true; }
      if (/^\|[-|\s]+\|$/.test(line)) continue;
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      const tag = !html.includes('<tr>') || !inTable ? 'th' : 'td';
      html += '<tr>' + cells.map((c) => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>';
      continue;
    }
    if (inTable) { html += '</table>'; inTable = false; }
    if (line.startsWith('- ')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.slice(2))}</li>`;
      continue;
    }
    if (inList) { html += '</ul>'; inList = false; }
    if (line.startsWith('### ')) html += `<h3>${inline(line.slice(4))}</h3>`;
    else if (line.startsWith('## ')) html += `<h2>${inline(line.slice(3))}</h2>`;
    else if (line.startsWith('# ')) html += `<h1>${inline(line.slice(2))}</h1>`;
    else if (line.startsWith('---')) html += '<hr>';
    else if (line.trim()) html += `<p>${inline(line)}</p>`;
  }
  if (inTable) html += '</table>';
  if (inList) html += '</ul>';
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>商机简报</title>
<style>body{font-family:"Microsoft YaHei",sans-serif;max-width:960px;margin:24px auto;padding:0 16px;color:#222;line-height:1.7}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:14px}th,td{border:1px solid #d9d9d9;padding:8px;text-align:left}th{background:#f0f5ff}
a{color:#1664ff}h1{font-size:22px}h2{font-size:18px;border-left:4px solid #1664ff;padding-left:8px}</style>
</head><body>${html}</body></html>`;
}

async function run(push = true) {
  const { md, date } = buildBriefing();
  const dir = path.join(db.DATA_DIR, 'briefings');
  db.ensureDir(dir);
  fs.writeFileSync(path.join(dir, `${date}.md`), md, 'utf8');
  fs.writeFileSync(path.join(dir, `${date}.html`), mdToHtml(md), 'utf8');
  console.log(`[briefing] 已生成 ${date} 简报（md + html）`);
  if (push) {
    await pushBriefing(md);
  }
}

module.exports = { run, buildBriefing };
