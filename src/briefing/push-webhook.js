/**
 * 简报一键推送：企业微信群机器人 / 飞书自定义机器人
 * Webhook 地址配置于 config/webhooks.json（不入仓库）；未启用则跳过
 */
const fs = require('fs');
const path = require('path');
const db = require('../store/db');

function loadWebhooks() {
  const p = path.join(db.ROOT, 'config', 'webhooks.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

/** 超长文本分片（企业微信 markdown 上限约 4096 字节） */
function chunkText(text, maxLen = 3500) {
  const chunks = [];
  const lines = text.split('\n');
  let cur = '';
  for (const line of lines) {
    if ((cur + line).length > maxLen) {
      chunks.push(cur);
      cur = '';
    }
    cur += line + '\n';
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** Markdown → 企业微信 markdown 子集（去掉表格，改为列表，保留链接与加粗） */
function mdToWecom(md) {
  const out = [];
  for (const line of md.split('\n')) {
    if (/^\|[-|\s]+\|$/.test(line)) continue;
    if (line.startsWith('|')) {
      out.push('> ' + line.split('|').slice(1, -1).map((c) => c.trim()).join(' ｜ '));
    } else {
      out.push(line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '[$1]($2)'));
    }
  }
  return out.join('\n');
}

async function pushBriefing(md) {
  const hooks = loadWebhooks();
  let sent = 0;

  if (hooks.wecom && hooks.wecom.enabled && hooks.wecom.url) {
    try {
      const text = mdToWecom(md);
      for (const chunk of chunkText(text)) {
        const res = await fetch(hooks.wecom.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ msgtype: 'markdown', markdown: { content: chunk } }),
        });
        const j = await res.json().catch(() => ({}));
        if (j.errcode !== 0) throw new Error(j.errmsg || `HTTP ${res.status}`);
      }
      console.log('[push] 企业微信推送成功');
      sent++;
    } catch (e) {
      console.error('[push] 企业微信推送失败:', e.message);
    }
  }

  if (hooks.feishu && hooks.feishu.enabled && hooks.feishu.url) {
    try {
      // 飞书：用纯文本消息承载，兼容性最好
      const plain = md.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1($2)');
      for (const chunk of chunkText(plain, 20000)) {
        const res = await fetch(hooks.feishu.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ msg_type: 'text', content: { text: chunk } }),
        });
        const j = await res.json().catch(() => ({}));
        if (j.code !== 0 && j.StatusCode !== 0) throw new Error(j.msg || `HTTP ${res.status}`);
      }
      console.log('[push] 飞书推送成功');
      sent++;
    } catch (e) {
      console.error('[push] 飞书推送失败:', e.message);
    }
  }

  if (sent === 0) console.log('[push] 未配置/未启用 Webhook，跳过推送（简报文件已保存）');
  return sent;
}

module.exports = { pushBriefing };
