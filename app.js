const SIGNAL_NAME={bid:'招标',majorMove:'专业动态',hr:'师资招聘',grant:'课题立项',competitorBid:'竞品中标'};
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
})();