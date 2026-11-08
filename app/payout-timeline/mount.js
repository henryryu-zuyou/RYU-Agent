// 代管撥款時間軸：計算與畫面邏輯。
// 由 payout-timeline-for-portal.html 的 <script> 原樣搬來，只改了三件事：
//   1. 包成 mountPayoutTimeline(root)，查 DOM 一律限定在 root 內
//   2. 事件監聽掛 AbortController，卸載時（含 React 開發模式的二次掛載）能拆乾淨
//   3. 回傳 cleanup 給 useEffect
export function mountPayoutTimeline(root){
const ac=new AbortController();
const on=(el,type,fn)=>el.addEventListener(type,fn,{signal:ac.signal});
const LS='zuyou-payout-timeline-v2';
const PAYOUT_DAY=5,FEE_RATE=0.1;
const CN=['零','一','二','三','四','五','六'];
const EXAMPLES={
  a:{name:'源峰醇萃實驗室',sign:'2026-10-19',start:'2026-11-01',term:'24',rent:'36000',payDay:'5',depMonths:'2',depHolder:'zuyou',periods:'6',
     extras:[{name:'契約公證費',amount:'3000',month:'2026-10'},{name:'入住前水電瓦斯結清',amount:'571',month:'2026-10'},{name:'主臥牆面修繕',amount:'6000',month:'2026-11'}]},
  b:{name:'',sign:'2026-11-08',start:'2026-11-16',term:'24',rent:'21500',payDay:'20',depMonths:'2',depHolder:'owner',periods:'6',
     extras:[{name:'水電瓦斯結清',amount:'',month:'2026-11'}]}
};
const BLANK={name:'',sign:'',start:'',term:'12',rent:'',payDay:'5',depMonths:'2',depHolder:'zuyou',periods:'6',extras:[]};
const clone=o=>JSON.parse(JSON.stringify(o));
const $=s=>root.querySelector(s);

/* ---------- 日期工具 ---------- */
const pad=n=>String(n).padStart(2,'0');
function parseD(s){if(!s)return null;const a=String(s).split('-').map(Number);if(a.length!==3||a.some(isNaN))return null;return {y:a[0],m:a[1],d:a[2]};}
const dim=(y,m)=>new Date(Date.UTC(y,m,0)).getUTCDate();
function mk(y,m,d){while(m>12){m-=12;y++;}while(m<1){m+=12;y--;}return {y,m,d:Math.max(1,Math.min(d,dim(y,m)))};}
const addM=(t,n)=>mk(t.y,t.m+n,t.d);
function prevDay(t){if(t.d>1)return {y:t.y,m:t.m,d:t.d-1};const p=mk(t.y,t.m-1,1);return {y:p.y,m:p.m,d:dim(p.y,p.m)};}
const ser=t=>t.y*10000+t.m*100+t.d;
const key=t=>t.y+'-'+pad(t.m);
function keyAdd(k,n){const[y,m]=k.split('-').map(Number);return key(mk(y,m+n,1));}
const md=t=>t.m+'/'+t.d;
const ymd=t=>t.y+'/'+t.m+'/'+t.d;
const kLabel=k=>{const[y,m]=k.split('-');return y+'/'+(+m);};
const mLabel=k=>(+k.split('-')[1])+'月';
function fmt(n){n=Math.round(n);return (n<0?'−':'')+'$'+Math.abs(n).toLocaleString('en-US');}
const cn=n=>n<CN.length?CN[n]:String(n);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number(String(v??'').replace(/,/g,'').trim());
function brokerFor(rent,term){return term>=24?rent:Math.round(rent*.5);}
function normTerm(t){t=parseInt(t);return t===24||t===36?t:12;}
function termLabel(t){return t%12===0?(t/12)+' 年':t+' 個月';}

/* ---------- 計算 ---------- */
function compute(s){
  const sign=parseD(s.sign),start=parseD(s.start),rent=num(s.rent);
  if(!sign||!start||!(rent>0))return null;
  const term=normTerm(s.term);
  const N=Math.min(parseInt(s.periods)||6,term);
  const payDay=Math.min(28,Math.max(1,parseInt(s.payDay)||5));
  const payoutDay=PAYOUT_DAY;
  const fee=Math.round(rent*FEE_RATE);
  const depM=Math.max(0,parseInt(s.depMonths)||0);
  const dep=rent*depM;
  const broker=brokerFor(rent,term);
  const owner=s.depHolder==='owner';
  const prepaid=true;

  const periods=[];
  for(let k=0;k<N;k++){
    const ps=addM(start,k),pe=prevDay(addM(start,k+1));
    let due=mk(ps.y,ps.m,payDay);
    if(ser(due)<ser(ps))due=mk(ps.y,ps.m+1,payDay);
    const pre=k===0&&prepaid;
    const col=pre?sign:due;
    periods.push({k,ps,pe,due,col,pre,key:key(col)});
  }
  const months={};
  const ens=k=>months[k]||(months[k]={key:k,rents:[],deposit:0,broker:0,extras:[],pending:[]});
  const sk=key(sign);
  const sm=ens(sk);sm.broker=broker;if(owner)sm.deposit=dep;
  periods.forEach(p=>ens(p.key).rents.push(p));
  (s.extras||[]).forEach(e=>{
    const raw=String(e.amount??'').replace(/,/g,'').trim();
    if(!(e.name||'').trim()&&raw==='')return;
    const name=(e.name||'').trim()||'其他扣款';
    const mm=ens(e.month||sk);
    if(raw===''){mm.pending.push(name);return;}
    const v=Number(raw);
    if(!isNaN(v)&&v!==0)mm.extras.push({name,amt:v});
  });
  const keys=Object.keys(months).sort();
  const last=keys[keys.length-1];
  const list=[];let carry=0,pend=[];
  for(let k=keys[0];k<=last;k=keyAdd(k,1)){
    const m=ens(k);
    const income=m.rents.length*rent+m.deposit;
    const fees=m.rents.length*fee;
    const ex=m.extras.reduce((a,b)=>a+b.amt,0);
    const ded=m.broker+fees+ex;
    const bal=income-ded+carry;
    const pendAll=pend.concat(m.pending);
    const[y,mo]=k.split('-').map(Number);
    const r=Object.assign({},m,{income,fees,ded,carryIn:carry,pendIn:pend,bal,pendAll,payDate:mk(y,mo+1,payoutDay)});
    if(bal<0){r.payout=0;r.status='neg';carry=bal;pend=pendAll;}
    else{
      r.payout=bal;carry=0;pend=[];
      r.status=(income===0&&ded===0&&!pendAll.length&&r.carryIn===0)?'empty':(bal===0?'zero':'paid');
    }
    r.standard=m.rents.length===1&&!m.deposit&&!m.broker&&!m.extras.length&&!m.pending.length&&!r.carryIn&&!r.pendIn.length;
    list.push(r);
  }
  return {sign,start,rent,term,N,payDay,payoutDay,fee,dep,depM,broker,owner,prepaid,periods,months:list,endCarry:carry,endPend:pend,stable:rent-fee};
}

/* ---------- 畫面 ---------- */
function bdRows(m,r){
  const rows=[];
  m.rents.forEach(p=>rows.push([`第${p.k+1}期租金`,r.rent]));
  if(m.deposit)rows.push([`押金（${cn(r.depM)}個月）`,m.deposit]);
  if(m.broker)rows.push(['仲介服務費',-m.broker]);
  if(r.fee)m.rents.forEach(p=>rows.push([`代管費（第${p.k+1}期）`,-r.fee]));
  m.extras.forEach(x=>rows.push([x.name,-x.amt]));
  m.pending.forEach(n=>rows.push([n,null]));
  if(m.carryIn)rows.push(['上月遞延',m.carryIn]);
  m.pendIn.forEach(n=>rows.push([n+'（上月遞延）',null]));
  return rows;
}
function bdHtml(m,r){
  const rows=bdRows(m,r).map(([l,v])=>`<div><span>${esc(l)}</span><span class="${v===null?'pend':''}">${v===null?'待確認':(v>0?'+':'')+fmt(v)}</span></div>`).join('');
  const pend=m.pendAll.length?` − ${esc(m.pendAll.join('、'))}`:'';
  return `<div class="bd">${rows}<div class="tot"><span>屋主應收</span><span>${fmt(m.bal)}${pend}</span></div></div>`;
}
function payoutDateOfKey(k,r){const[y,m]=k.split('-').map(Number);return mk(y,m+1,r.payoutDay);}

function cardSign(r){
  const p0=r.periods[0];
  let title=r.prepaid?(r.depM?`簽約，收${cn(r.depM)}押一租`:'簽約，收首期租金'):(r.depM?'簽約，收押金':'簽約');
  const amt=(r.prepaid?r.rent:0)+r.dep;
  const parts=[];
  if(r.depM)parts.push(`押金 ${fmt(r.dep)}`);
  if(r.prepaid)parts.push(`第1期 ${fmt(r.rent)}`);
  let s=parts.join(' + ');
  if(r.prepaid)s+=`<br>第1期租期 ${md(p0.ps)}–${md(p0.pe)}，原 ${md(p0.due)} 應繳`;
  if(r.depM)s+=`<br>押金${r.owner?'於首期撥給屋主':'由租寓保管'}`;
  return `<div class="ev"><div class="t"><span class="lt">收款</span>${title}${amt?' '+fmt(amt):''}</div><div class="s">${s}</div></div>`;
}
function cardCol(p,r){
  return `<div class="ev"><div class="t"><span class="lt">收租</span>收第${p.k+1}期租金 ${fmt(r.rent)}</div><div class="s">租期 ${md(p.ps)}–${md(p.pe)}，${md(payoutDateOfKey(p.key,r))} 撥款</div></div>`;
}
function cardPay(m,r){
  if(m.status==='empty')
    return `<div class="ev empty"><div class="t"><span class="lt">撥款</span>無款可撥</div><div class="s">${mLabel(m.key)}沒有收到租金</div></div>`;
  if(m.status==='neg'||m.status==='zero')
    return `<div class="ev neg"><div class="t"><span class="lt">撥款</span>實撥 $0</div><div class="s">${kLabel(m.key)} 計費結算 ${fmt(m.bal)}${m.status==='neg'?'，遞延下月扣':''}</div>${bdHtml(m,r)}</div>`;
  const pend=m.pendAll.length?` − ${esc(m.pendAll.join('、'))}`:'';
  const sub=m.standard?`${mLabel(m.key)}收到的租金扣代管費`:`${kLabel(m.key)} 計費`;
  return `<div class="ev"><div class="t"><span class="lt">撥款</span>撥款 ${fmt(m.payout)}${pend}</div><div class="s">${sub}</div>${m.standard?'':bdHtml(m,r)}</div>`;
}

function timeline(r){
  const ev=[{d:r.sign,o:0,t:'sign'},{d:r.start,o:1,t:'start'}];
  r.months.forEach(m=>ev.push({d:m.payDate,o:2,t:'pay',m}));
  r.periods.forEach(p=>{if(!p.pre)ev.push({d:p.col,o:3,t:'col',p});});
  ev.sort((a,b)=>ser(a.d)-ser(b.d)||a.o-b.o);
  let prevS=null,prevY=null,h='';
  ev.forEach(e=>{
    const s=ser(e.d),show=s!==prevS,yr=e.d.y!==prevY;
    prevS=s;prevY=e.d.y;
    const dt=`<div class="dt">${show?`<span>${yr?`<small>${e.d.y}</small>`:''}${md(e.d)}</span>`:''}</div>`;
    if(e.t==='sign')h+=`<div class="row c">${dt}${cardSign(r)}</div>`;
    else if(e.t==='start')h+=`<div class="row s">${dt}<div class="ev">起租，租期 ${termLabel(r.term)}</div></div>`;
    else if(e.t==='col')h+=`<div class="row c">${dt}${cardCol(e.p,r)}</div>`;
    else h+=`<div class="row p">${dt}${cardPay(e.m,r)}</div>`;
  });
  return `<div class="lanes-head"><div class="lh-c">房客繳給租寓</div><div class="lh-p">租寓撥給屋主</div></div><div class="tl">${h}</div>`;
}

function explain(m,r){
  if(m.status==='empty')return `${mLabel(m.key)}沒有租金收入。`;
  const pos=[],neg=[];
  m.rents.forEach(p=>pos.push(`${p.k===0?'首期':'第'+(p.k+1)+'期'}租金 ${fmt(r.rent)}`));
  if(m.deposit)pos.push(`押金 ${fmt(m.deposit)}`);
  if(m.broker)neg.push(`仲介服務費 ${fmt(m.broker)}`);
  if(m.fees)neg.push(`代管費 ${fmt(m.fees)}`);
  m.extras.forEach(x=>neg.push(`${x.name} ${fmt(x.amt)}`));
  m.pending.forEach(n=>neg.push(`${n}（金額待確認）`));
  if(m.carryIn)neg.push(`前期未扣完的 ${fmt(-m.carryIn)}`);
  let s=pos.length?pos.join('、'):`${mLabel(m.key)}沒有租金收入`;
  if(neg.length)s+=`，扣除${neg.join('、')}`;
  s+=m.status==='neg'?`，不足的 ${fmt(-m.bal)} 會從下一期扣除。`:'。';
  return s;
}
function message(r,name){
  const L=[`屋主您好，${name?`「${name}」`:'本物件'}前幾期撥款如下：`,''];
  const ms=r.months;let lastNon=-1;
  ms.forEach((m,i)=>{if(!m.standard)lastNon=i;});
  for(let i=0;i<=lastNon;i++){
    const m=ms[i];
    const amt=m.payout>0?`預計 ${fmt(m.payout)}`:'$0';
    const pend=m.payout>0&&m.pendAll.length?`（尚未扣除${m.pendAll.join('、')}）`:'';
    L.push(`・${md(m.payDate)}：${amt}${pend}`,explain(m,r),'');
  }
  if(lastNon<ms.length-1)L.push(`・${md(ms[lastNon+1].payDate)} 起：每月預計 ${fmt(r.stable)}`,'');
  L.push(`房客每月 ${r.payDay} 日前繳租，我們會在隔月 5 日撥款給您（遇國定假日順延至下一個工作日）。每月 5 日的前一個工作日，會透過租寓官方 LINE 傳送代管表，實際金額以代管表為準。`);
  if(r.owner&&r.dep)L.push('押金已於首期一併撥給您。房客退租時，請將押金退還給租寓，我們點交確認無誤後，再退還給房客。');
  L.push('有任何問題歡迎聯繫，謝謝您！');
  return L.join('\n');
}
function notes(r){
  const n=[];
  if(ser(r.start)<ser(r.sign))n.push(['warn','起租日早於簽約日，請確認日期。']);
  const empties=r.months.filter(m=>m.status==='empty');
  if(empties.length)n.push(['warn',`${empties.map(m=>ymd(m.payDate)).join('、')} 無款可撥：前一個月沒有收到租金，因為首期租金在簽約時就提前收了。建議簽約時先告訴屋主。`]);
  const zs=r.months.filter(m=>m.status==='neg'||m.status==='zero');
  if(zs.length)n.push(['warn',`首期費用大於收入，${zs.map(m=>ymd(m.payDate)).join('、')} 實撥 $0，差額遞延到下個月扣。`]);
  if(r.payDay===r.payoutDay)n.push(['info',`繳租日和撥款日都是 ${r.payDay} 號，但當天收到的租金要到下個月才撥，屋主容易誤會。`]);
  if(r.owner&&r.dep)n.push(['info','押金於首期撥給屋主。房客退租時，屋主須將押金退還給租寓，點交確認無誤後再退給房客。']);
  if(r.months.some(m=>m.pending.length))n.push(['info','有扣款項目還沒填金額，填入後時間軸和金額會自動更新。']);
  if(r.endCarry<0)n.push(['warn',`到第 ${r.N} 期為止仍有 ${fmt(r.endCarry)} 未扣完，請增加顯示期數。`]);
  return n;
}

let lastMsg='';
function render(){
  const res=$('#res');
  const r=compute(state);
  if(!r){res.innerHTML=`<div class="box empty-state">填入簽約日、起租日和月租金後，這裡會出現收租與撥款時間軸。</div>`;return;}
  const first=r.months.find(m=>m.payout>0);
  const zeros=r.months.filter(m=>m.payout===0);
  const nts=notes(r);
  const facts=`<div class="facts">
    <div class="fact"><div class="k">屋主第一次收到撥款</div><div class="v">${first?`${ymd(first.payDate)}　${fmt(first.payout)}${first.pendAll.length?' − '+esc(first.pendAll.join('、')):''}`:'—'}</div></div>
    <div class="fact z"><div class="k">撥款為 $0 的日期</div><div class="v">${zeros.length?zeros.map(m=>ymd(m.payDate)).join('、'):'沒有'}</div></div>
    <div class="fact"><div class="k">之後每月撥款</div><div class="v">${fmt(r.stable)}</div></div>
  </div><div class="notes">${nts.map(([c,t])=>`<div class="note ${c}">${t}</div>`).join('')}<div class="note">每月 5 日撥款，遇國定假日順延下一工作日。每月 5 日前一工作日，租寓官方 LINE 發送代管表。</div></div>`;
  const rows=r.months.map(m=>{
    const pend=m.pendAll.length?`<span class="pend"> − ${esc(m.pendAll.join('、'))}</span>`:'';
    return `<tr><td>${kLabel(m.key)}</td><td>${m.income?fmt(m.income):'—'}</td><td>${m.ded?fmt(-m.ded):'—'}${m.pending.length?`<span class="pend"> − 待確認</span>`:''}</td><td>${m.carryIn?fmt(m.carryIn):'—'}</td><td class="${m.bal<0?'n':''}">${fmt(m.bal)}</td><td>${ymd(m.payDate)}</td><td class="strong">${fmt(m.payout)}${m.payout>0?pend:''}</td></tr>`;
  }).join('');
  lastMsg=message(r,(state.name||'').trim());
  res.innerHTML=`
    <section class="box">${facts}</section>
    <section class="box"><h2>收租與撥款時間軸</h2>${timeline(r)}</section>
    <section class="box"><h2>每月結算</h2><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>計費月份</th><th>收入</th><th>扣款</th><th>上月遞延</th><th>結算</th><th>撥款日</th><th>實撥</th></tr></thead>
      <tbody>${rows}</tbody></table></div></section>
    <section class="box"><h2>給屋主的說明</h2>
      <textarea id="msg" readonly aria-label="給屋主的說明"></textarea>
      <div class="msg-actions"><button type="button" class="btn primary" id="copy">複製說明</button><span class="flash" id="flash" aria-live="polite"></span></div>
    </section>`;
  $('#msg').value=lastMsg;
  $('#copy').addEventListener('click',copyMsg);
}
async function copyMsg(){
  const fl=$('#flash');
  try{await navigator.clipboard.writeText(lastMsg);}
  catch(e){const t=$('#msg');t.removeAttribute('readonly');t.select();try{document.execCommand('copy');}catch(_){}t.setAttribute('readonly','');}
  fl.textContent='已複製';setTimeout(()=>{fl.textContent='';},1800);
}

/* ---------- 表單 ---------- */
let state;
function save(){try{localStorage.setItem(LS,JSON.stringify(state));}catch(e){}}
function load(){try{const v=localStorage.getItem(LS);if(v){const o=JSON.parse(v);if(o&&typeof o==='object'){const s=Object.assign(clone(BLANK),o);s.term=String(normTerm(s.term));return s;}}}catch(e){}return clone(EXAMPLES.b);}

function fillDays(sel){let h='';for(let i=1;i<=28;i++)h+=`<option value="${i}">${i} 日</option>`;sel.innerHTML=h;}
fillDays($('#payDay'));

function monthOptions(cur){
  const s=parseD(state.sign);const now=new Date();
  const base=s?key(s):now.getFullYear()+'-'+pad(now.getMonth()+1);
  const ks=[];for(let i=-1;i<=10;i++)ks.push(keyAdd(base,i));
  if(cur&&!ks.includes(cur))ks.push(cur);ks.sort();
  return ks.map(k=>`<option value="${k}"${k===cur?' selected':''}>${kLabel(k)} 計費</option>`).join('');
}
function renderExtras(){
  const s=parseD(state.sign);const def=s?key(s):'';
  $('#extras').innerHTML=state.extras.map((e,i)=>{
    if(!e.month&&def)e.month=def;
    return `<div class="ex" data-i="${i}">
      <input class="exn" data-f="name" placeholder="項目名稱" value="${esc(e.name||'')}" aria-label="扣款項目名稱">
      <input class="exa" data-f="amount" inputmode="numeric" placeholder="待確認" value="${esc(e.amount??'')}" aria-label="扣款金額">
      <select data-f="month" aria-label="計費月份">${monthOptions(e.month)}</select>
      <button type="button" class="x" aria-label="刪除這筆扣款">×</button></div>`;
  }).join('');
}
function syncBroker(){
  const rent=num(state.rent),term=normTerm(state.term);
  const b=rent>0?fmt(brokerFor(rent,term)):'—',f=rent>0?fmt(Math.round(rent*FEE_RATE)):'—';
  $('#feeInfo').innerHTML=`<div><div class="k">仲介服務費（${term===12?'半個月':'一個月'}）</div><div class="v">${b}</div></div><div><div class="k">代管費（每月 10%）</div><div class="v">${f}</div></div>`;
}
function fillForm(){
  root.querySelectorAll('[data-k]').forEach(el=>{const k=el.dataset.k;if(el.type==='checkbox')el.checked=!!state[k];else el.value=state[k]??'';});
  syncBroker();renderExtras();
}
function readForm(){
  root.querySelectorAll('[data-k]').forEach(el=>{const k=el.dataset.k;state[k]=el.type==='checkbox'?el.checked:el.value;});
}
function update(){save();render();}

on($('#f'),'input',e=>{
  const t=e.target;
  if(t.closest('#extras')||t.id==='ex')return;
  readForm();syncBroker();
  if(t.dataset.k==='sign')renderExtras();
  update();
});
on($('#f'),'change',e=>{
  const t=e.target;
  if(t.closest('#extras')||t.id==='ex')return;
  readForm();syncBroker();
  if(t.dataset.k==='sign')renderExtras();
  update();
});
on($('#extras'),'input',e=>{
  const row=e.target.closest('.ex');if(!row)return;
  state.extras[+row.dataset.i][e.target.dataset.f]=e.target.value;update();
});
on($('#extras'),'change',e=>{
  const row=e.target.closest('.ex');if(!row||!e.target.dataset.f)return;
  state.extras[+row.dataset.i][e.target.dataset.f]=e.target.value;update();
});
on($('#extras'),'click',e=>{
  if(!e.target.classList.contains('x'))return;
  const row=e.target.closest('.ex');state.extras.splice(+row.dataset.i,1);renderExtras();update();
});
on($('#addEx'),'click',()=>{
  const s=parseD(state.sign);state.extras.push({name:'',amount:'',month:s?key(s):''});renderExtras();update();
  const rows=root.querySelectorAll('#extras .exn');if(rows.length)rows[rows.length-1].focus();
});
on($('#ex'),'change',e=>{
  const v=e.target.value;if(!v||!EXAMPLES[v])return;
  state=clone(EXAMPLES[v]);fillForm();update();e.target.value='';
});
on($('#clear'),'click',()=>{state=clone(BLANK);fillForm();update();});

state=load();fillForm();render();
return ()=>ac.abort();
}
