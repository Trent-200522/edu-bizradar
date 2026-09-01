/**
 * GitHub Pages 静态站生成器
 * 输出 dist/：商机看板首页 + 分类浏览页 + 简报存档页 + 数据 JSON
 */
const fs = require('fs');
const path = require('path');
const db = require('../store/db');

const DIST = path.join(db.ROOT, 'dist');

function w(rel, content) {
  const p = path.join(DIST, rel);
  db.ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, 'utf8');
}

function run() {
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true, force: true });
  db.ensureDir(DIST);

  const opportunities = db.readTable('opportunities');
  const signals = db.readTable('signals').slice(-2000); // 控制体积：最近2000条
  const majors = db.readTable('majors');
  const schoolsCfg = require('../../config/schools.json');

  w('data/opportunities.json', JSON.stringify(opportunities));
  w('data/signals.json', JSON.stringify(signals));
  w('data/majors.json', JSON.stringify(majors));
  w('data/schools.json', JSON.stringify(schoolsCfg.schools));

  // 简报存档索引 + 拷贝简报文件
  const briefingDir = path.join(db.DATA_DIR, 'briefings');
  const index = [];
  if (fs.existsSync(briefingDir)) {
    for (const f of fs.readdirSync(briefingDir).sort().reverse()) {
      if (f.endsWith('.html') && /^\d{4}-\d{2}-\d{2}\.html$/.test(f)) {
        fs.copyFileSync(path.join(briefingDir, f), path.join(DIST, `briefing-${f}`));
        index.push({ date: f.replace('.html', ''), type: 'daily', href: `briefing-${f}` });
      } else if (f.startsWith('weekly-') && f.endsWith('.csv')) {
        fs.copyFileSync(path.join(briefingDir, f), path.join(DIST, f));
        index.push({ date: f.replace('weekly-', '').replace('.csv', ''), type: 'weekly', href: f });
      }
    }
  }
  w('data/briefings-index.json', JSON.stringify(index, null, 2));

  w('.nojekyll', '');
  w('style.css', CSS);
  w('app.js', APP_JS);
  w('index.html', page('商机看板', INDEX_BODY));
  w('browse.html', page('分类浏览', BROWSE_BODY));
  w('briefings.html', page('简报存档', BRIEFINGS_BODY));

  console.log(`[site] 静态站已生成: ${DIST}`);
}

function page(title, body) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - 商科商机雷达</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<header>
  <h1>全国商科院校商机雷达</h1>
  <nav>
    <a href="index.html">商机看板</a>
    <a href="browse.html">分类浏览</a>
    <a href="briefings.html">简报存档</a>
  </nav>
</header>
<main>${body}</main>
<footer>仅采集公开发布页面，遵守 robots 协议，不采集个人隐私信息 · 数据每日更新</footer>
<script src="app.js"></script>
</body>
</html>`;
}

const INDEX_BODY = `
<div class="stats" id="stats"></div>
<h2>A类高意向商机</h2>
<div id="gradeA" class="cards"></div>
<h2>关注（有招标信号）</h2>
<div id="gradeWatch" class="cards"></div>
<h2>B类（师资信号）</h2>
<div id="gradeB" class="cards"></div>
<h2>红牌（停招，暂不跟进）</h2>
<div id="gradeRed" class="cards"></div>`;

const BROWSE_BODY = `
<div class="filters">
  <select id="f-province"><option value="">全部省份</option></select>
  <select id="f-tier"><option value="">全部层次</option></select>
  <select id="f-grade"><option value="">全部级别</option></select>
  <select id="f-signal"><option value="">全部信号类型</option></select>
  <input id="f-major" type="text" placeholder="按商科专业筛选，如：大数据与财务管理">
  <span id="f-count"></span>
</div>
<div class="tabs">
  <button data-tab="opp" class="active">商机视图</button>
  <button data-tab="sig">信号明细</button>
  <button data-tab="major">专业动态</button>
</div>
<div id="pane-opp"><table id="t-opp"></table></div>
<div id="pane-sig" hidden><table id="t-sig"></table></div>
<div id="pane-major" hidden><table id="t-major"></table></div>`;

const BRIEFINGS_BODY = `
<h2>每日简报存档</h2>
<ul id="brief-list" class="brief-list"></ul>
<p class="hint">提示：每日简报于 08:30 自动生成并推送企业微信/飞书；周度线索池为 CSV，可用 Excel 打开。</p>`;

const CSS = `*{box-sizing:border-box}
body{font-family:"Microsoft YaHei",sans-serif;margin:0;background:#f5f7fa;color:#222}
header{background:#1d3a8a;color:#fff;padding:16px 24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap}
header h1{font-size:20px;margin:0}
nav a{color:#cfe0ff;margin-left:16px;text-decoration:none}
nav a:hover{text-decoration:underline}
main{max-width:1200px;margin:20px auto;padding:0 16px}
footer{text-align:center;color:#888;font-size:12px;padding:24px}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.stat{background:#fff;border-radius:8px;padding:14px 20px;box-shadow:0 1px 3px rgba(0,0,0,.08);min-width:130px}
.stat b{font-size:26px;display:block}
.stat.a b{color:#d4380d}.stat.w b{color:#d48806}.stat.b b{color:#1664ff}.stat.r b{color:#888}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px;margin-bottom:24px}
.card{background:#fff;border-radius:8px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.08);border-left:4px solid #1664ff}
.card.A{border-left-color:#d4380d}.card.红牌{border-left-color:#999}
.card h3{margin:0 0 6px;font-size:16px}
.card .meta{color:#666;font-size:13px;margin:2px 0}
.card .talk{background:#f0f5ff;border-radius:6px;padding:8px;font-size:13px;margin-top:8px}
.card a{color:#1664ff;font-size:13px}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.filters select,.filters input{padding:6px 10px;border:1px solid #d9d9d9;border-radius:6px}
.tabs button{padding:8px 16px;border:1px solid #d9d9d9;background:#fff;cursor:pointer;border-radius:6px 6px 0 0}
.tabs button.active{background:#1d3a8a;color:#fff;border-color:#1d3a8a}
table{border-collapse:collapse;width:100%;background:#fff;font-size:13px}
th,td{border:1px solid #e5e7eb;padding:8px;text-align:left;vertical-align:top}
th{background:#f0f5ff;position:sticky;top:0}
.badge{display:inline-block;padding:1px 8px;border-radius:10px;font-size:12px;color:#fff}
.badge.A{background:#d4380d}.badge.关注{background:#d48806}.badge.B{background:#1664ff}.badge.红牌{background:#999}
.brief-list{list-style:none;padding:0}
.brief-list li{background:#fff;border-radius:8px;padding:10px 14px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.brief-list a{color:#1664ff}
.hint{color:#888;font-size:13px}`;

const APP_JS = `const SIGNAL_NAME={bid:'招标',majorMove:'专业动态',hr:'师资招聘',grant:'课题立项',competitorBid:'竞品中标'};
async function load(name){const r=await fetch('data/'+name+'.json');return r.json()}
function fmtYuan(n){if(!n)return'';if(n>=1e8)return(n/1e8).toFixed(2)+'亿元';if(n>=1e4)return(n/1e4).toFixed(1)+'万元';return n+'元'}
function badge(g){return '<span class="badge '+g+'">'+g+'</span>'}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;')}

async function renderIndex(){
  const opps=await load('opportunities');
  const groups={A:[],关注:[],B:[],红牌:[]};
  opps.forEach(o=>{(groups[o.grade]||(groups[o.grade]=[])).push(o)});
  document.getElementById('stats').innerHTML=
    '<div class="stat a"><b>'+(groups.A||[]).length+'</b>A类商机</div>'+
    '<div class="stat w"><b>'+(groups.关注||[]).length+'</b>关注</div>'+
    '<div class="stat b"><b>'+(groups.B||[]).length+'</b>B类</div>'+
    '<div class="stat r"><b>'+(groups.红牌||[]).length+'</b>红牌</div>';
  for(const[g,id]of[['A','gradeA'],['关注','gradeWatch'],['B','gradeB'],['红牌','gradeRed']]){
    const el=document.getElementById(id);
    const list=groups[g]||[];
    el.innerHTML=list.length?list.map(cardHtml).join(''):'<p style="color:#999">暂无</p>';
  }
}
function cardHtml(o){
  const depts=Array.isArray(o.departments)?o.departments.join('/'):o.departments||'';
  return '<div class="card '+o.grade+'">'+badge(o.grade)+' <h3 style="display:inline">'+esc(o.schoolName)+'</h3>'+
  '<div class="meta">'+esc(o.province)+'·'+esc(o.tier)+'｜'+esc(depts)+'</div>'+
  '<div class="meta">触发：'+esc(o.triggerTitle||'')+(o.bestBudget?'｜预算 '+fmtYuan(o.bestBudget):'')+(o.deadline?'｜截止 '+esc(o.deadline):'')+'</div>'+
  '<div class="meta">依据：'+(o.reasons||[]).map(esc).join('；')+'</div>'+
  (o.talk?'<div class="talk">'+esc(o.talk)+'</div>':'')+
  (o.triggerUrl?'<a href="'+o.triggerUrl+'" target="_blank">查看原文</a>':'')+'</div>';
}

let DATA={};
async function renderBrowse(){
  DATA.opps=await load('opportunities');
  DATA.sigs=await load('signals');
  DATA.majors=await load('majors');
  const prov=[...new Set(DATA.opps.map(o=>o.province))];
  const tiers=[...new Set(DATA.opps.map(o=>o.tier))];
  const grades=[...new Set(DATA.opps.map(o=>o.grade))];
  const sigTypes=[...new Set(DATA.sigs.map(s=>s.signalType))];
  fillSel('f-province',prov);fillSel('f-tier',tiers);fillSel('f-grade',grades);
  fillSel('f-signal',sigTypes.map(t=>SIGNAL_NAME[t]||t));
  document.querySelectorAll('.filters select,.filters input').forEach(el=>el.addEventListener('input',applyFilter));
  document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    ['opp','sig','major'].forEach(t=>document.getElementById('pane-'+t).hidden=(t!==b.dataset.tab));
  }));
  applyFilter();
}
function fillSel(id,arr){const sel=document.getElementById(id);arr.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;sel.appendChild(o)})}
function applyFilter(){
  const prov=document.getElementById('f-province').value;
  const tier=document.getElementById('f-tier').value;
  const grade=document.getElementById('f-grade').value;
  const sigName=document.getElementById('f-signal').value;
  const major=document.getElementById('f-major').value.trim();
  const sigType=sigName?Object.keys(SIGNAL_NAME).find(k=>SIGNAL_NAME[k]===sigName):'';
  const matchMajor=o=>!major||(o.newMajors||[]).some(m=>m.majorName.includes(major));
  const opps=DATA.opps.filter(o=>(!prov||o.province===prov)&&(!tier||o.tier===tier)&&(!grade||o.grade===grade)&&matchMajor(o)&&(!sigType||o.triggerType===sigType));
  const sigs=DATA.sigs.filter(s=>(!prov||!s.schoolId||true)&&(!sigType||s.signalType===sigType)&&(!major||(s.businessMajors||[]).some(m=>m.includes(major))));
  const mjs=DATA.majors.filter(m=>(!prov||true)&&(!major||m.majorName.includes(major)));
  document.getElementById('f-count').textContent='商机 '+opps.length+' / 信号 '+sigs.length+' / 专业 '+mjs.length;
  document.getElementById('t-opp').innerHTML=oppTable(opps);
  document.getElementById('t-sig').innerHTML=sigTable(sigs.slice(-200).reverse());
  document.getElementById('t-major').innerHTML=majorTable(mjs);
}
function oppTable(list){
  let h='<tr><th>级别</th><th>院校</th><th>省份</th><th>层次</th><th>院系</th><th>触发事件</th><th>新设专业</th><th>预算</th><th>截止</th><th>话术</th><th>原文</th></tr>';
  for(const o of list){h+='<tr><td>'+badge(o.grade)+'</td><td>'+esc(o.schoolName)+'</td><td>'+esc(o.province)+'</td><td>'+esc(o.tier)+'</td><td>'+esc(Array.isArray(o.departments)?o.departments.join('/'):'')+'</td><td>'+esc(o.triggerTitle||'')+'</td><td>'+(o.newMajors||[]).map(m=>esc(m.majorName)).join('、')+'</td><td>'+fmtYuan(o.bestBudget)+'</td><td>'+esc(o.deadline||'')+'</td><td style="max-width:260px">'+esc(o.talk||'')+'</td><td>'+(o.triggerUrl?'<a href="'+o.triggerUrl+'" target="_blank">原文</a>':'')+'</td></tr>'}
  return h;
}
function sigTable(list){
  let h='<tr><th>发现日期</th><th>数据源</th><th>类型</th><th>标题</th><th>院校</th><th>预算</th><th>软件采购</th><th>原文</th></tr>';
  for(const s of list){h+='<tr><td>'+esc((s.firstSeenAt||s.crawledAt||'').slice(0,10))+'</td><td>'+esc(s.sourceName)+'</td><td>'+esc(SIGNAL_NAME[s.signalType]||s.signalType)+'</td><td>'+esc(s.title)+'</td><td>'+esc(s.schoolName||'')+'</td><td>'+fmtYuan(s.budget)+'</td><td>'+(s.softwareBuy?'是':'')+'</td><td><a href="'+s.sourceUrl+'" target="_blank">原文</a></td></tr>'}
  return h;
}
function majorTable(list){
  let h='<tr><th>院校</th><th>专业</th><th>申报年份</th><th>批次</th><th>状态</th><th>近3年招生变化</th><th>原文</th></tr>';
  for(const m of list){h+='<tr><td>'+esc(m.schoolName)+'</td><td>'+esc(m.majorName)+'</td><td>'+esc(m.applyYear)+'</td><td>'+esc(m.batch)+'</td><td>'+esc(m.status)+'</td><td>'+esc(m.enrollmentTrend||'待补充')+'</td><td><a href="'+m.sourceUrl+'" target="_blank">原文</a></td></tr>'}
  return h;
}

async function renderBriefings(){
  const list=await load('briefings-index');
  const ul=document.getElementById('brief-list');
  if(!list.length){ul.innerHTML='<li>暂无简报，请先运行采集与简报生成。</li>';return}
  ul.innerHTML=list.map(b=>'<li><b>'+b.date+'</b> '+(b.type==='daily'?'每日商机简报':'周度线索池')+' <a href="'+b.href+'" target="_blank">'+(b.type==='daily'?'在线查看':'下载 CSV')+'</a></li>').join('');
}

(function(){
  if(document.getElementById('gradeA'))renderIndex();
  else if(document.getElementById('f-province'))renderBrowse();
  else if(document.getElementById('brief-list'))renderBriefings();
})();`;

module.exports = { run };
