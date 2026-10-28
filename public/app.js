// NARA CRM – ระบบ Commit ยอดขายทีม
// Front-end module. Backend: self-hosted PocketBase (same origin, /api).
// Original UI and business rules are preserved; analytics (forecast, trends,
// funnel, customers, digest, exports, quota history, data health) were added
// per the 2026-10-27 audit (docs/ANALYTICS.md).
import PocketBase from './vendor/pocketbase.es.mjs';

const pb=new PocketBase(location.origin);
pb.autoCancellation(false);           // several collections are loaded in parallel

const nowM=()=>{const t=new Date();return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')};
let me=null,users=[],deals=[],tab='ov',M=nowM(),q='',rf='',tf='',wf='',W='',reports=[],rcom=[],werr='',PM=nowM(),pf='',plans=[],perr='',pinit=0,srs=[],sinit=0,serr='',sq='',sst='',authMethods=null;
// analytics state
let customers=[],quotas=[],events=[],evBy={},wplans=[],snaps=[],yrep=[],aggWon=null,aggCust=null,aggDirty=true,aggBusy=false;
let anTeam='',anInit=0,cuQ='',cuProv='',cuSel='',cuData={},cuMerge=null,tmY=String(new Date().getFullYear()),hl=null,snapMsg='',dgInfo=null,dgMsg='',tmInit=0;
// stage colours are CSS tokens per theme (index.html): open stages = one blue ramp ordered by
// probability, won/lost = status colours, always shown next to their text label
const C={won:['ปิดขายแล้ว','var(--st-won)'],c100:['Commit 100%','var(--st-c100)'],c80:['Commit 80%','var(--st-c80)'],pending:['รอลูกค้าพิจารณา','var(--st-pending)'],lost:['ปิดไม่ได้','var(--st-lost)']};
const OPEN=['c100','c80','pending'];
const VT={visit:'เข้าพบ',call:'โทร',survey:'สำรวจหน้างาน',online:'ออนไลน์',other:'อื่นๆ'};
const OC={interested:'สนใจ',quote:'ขอใบเสนอราคา',followup:'ติดตามต่อ',won:'ได้งาน',lost:'ไม่ได้งาน',none:'-'};
const CT={owner:'เจ้าของโครงการ',contractor:'ผู้รับเหมา',designer:'ผู้ออกแบบ',dealer:'ตัวแทนจำหน่าย',other:'อื่นๆ'};
const DEF={pendingProb:30,staleDays:14,teams:['PJ-BKK','PJ-PKT'],productLines:['ฝ้า','ผนัง','พื้น','อื่นๆ'],lostReasons:['ราคาสูงกว่าคู่แข่ง','ลูกค้าเลื่อน/ยกเลิกโครงการ','สเปคไม่ตรง','ระยะเวลาส่งมอบ','อื่นๆ']};
let cfg={...DEF},cfgId='';
const $=s=>document.querySelector(s);
let TH='dark';try{TH=localStorage.getItem('sf_theme')||'dark'}catch{}
const setTh=t=>{TH=t;document.documentElement.dataset.theme=t;document.querySelector('meta[name=theme-color]')?.setAttribute('content',t==='light'?'#ffffff':'#141a24');try{localStorage.setItem('sf_theme',t)}catch{}};setTh(TH);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=n=>(+n||0).toLocaleString('th-TH');
// compact number: 1.25M, 12.2M, 150M, 330K, 7.5K (trailing zeros dropped only after a decimal point)
const fmtK=n=>{n=+n||0;const a=Math.abs(n),t=(v,d)=>{let s=v.toFixed(d);if(s.includes('.'))s=s.replace(/0+$/,'').replace(/\.$/,'');return s};return a>=1e6?t(n/1e6,a>=1e8?0:a>=1e7?1:2)+'M':a>=1e3?t(n/1e3,a>=1e4?0:1)+'K':String(Math.round(n))};
const val=d=>(+d.product||0)+(+d.install||0);
const inMo=(d,m)=>d.cat==='won'||d.cat==='lost'?(d.closedMonth||d.month)===m:m>=d.month;
const inM=d=>inMo(d,M);
const sum=a=>a.reduce((s,d)=>s+val(d),0);
const dir=()=>me?.role==='director';
const can=d=>dir()||d.owner===me.id;
const nm=id=>users.find(u=>u.id===id)?.name||'';
const log=txt=>({t:Date.now(),by:me.name,txt});
const isSales=u=>u.role==='rep'||u.role==='am';
const viewAll=()=>['director','am','viewer'].includes(me?.role);
const writer=()=>['rep','am','spec'].includes(me?.role);
const RL={director:'Director',am:'Assistant Manager',rep:'Sales',spec:'Sales Spec',viewer:'ผู้เยี่ยมชม'};
const ymd=t=>t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
const monOf=s=>{const t=s?new Date(s+'T00:00:00'):new Date();t.setDate(t.getDate()-((t.getDay()+6)%7));return ymd(t)};
const addD=(s,n)=>{const t=new Date(s+'T00:00:00');t.setDate(t.getDate()+n);return ymd(t)};
const thD=s=>new Date(s+'T00:00:00').toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit'});
const addM=(s,n)=>{const [y,m]=s.split('-').map(Number),t=new Date(y,m-1+n,1);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')};
const mlab=m=>new Date(m+'-01T00:00:00').toLocaleDateString('th-TH',{month:'short',year:'2-digit'});
const defPf=()=>{if(!viewAll()||me.role==='am')return me.id;const a=users.find(u=>u.role==='am');return(a||users.find(u=>['rep','spec'].includes(u.role))||{}).id||''};
const DN=['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
const emsg=e=>{const d=e?.response?.data;if(d&&typeof d==='object'){const k=Object.keys(d)[0];if(k&&d[k]?.message)return k+': '+d[k].message}return e?.response?.message||e?.message||String(e)};
const randPw=()=>{const a=new Uint8Array(30);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(36).padStart(2,'0')).join('').slice(0,40)};
const GSVG='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z"/><path fill="#FBBC05" d="M10.5 28.6A14.5 14.5 0 0 1 9.7 24c0-1.6.3-3.1.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.8l-7.7-6c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';

// ===== analytics helpers =====================================================
const TEAMS=()=>Array.isArray(cfg.teams)&&cfg.teams.length?cfg.teams:DEF.teams;
const LIST=k=>Array.isArray(cfg[k])&&cfg[k].length?cfg[k]:DEF[k];
// same normalisation as pb_hooks/lib/analytics.js normKey()
const normKey=n=>String(n||'').toLowerCase().trim().replace(/\(มหาชน\)|มหาชน|บริษัท|บจก\.?|บมจ\.?|หจก\.?|ห้างหุ้นส่วนจำกัด|จำกัด|co\.?,?\s*ltd\.?|company limited|limited|ltd\.?|inc\.?|corp\.?|plc\.?/g,' ').replace(/[.,()\-_/"'`]+/g,' ').replace(/\s+/g,' ').trim();
const pd=s=>new Date(String(s||'').replace(' ','T'));
const dayOf=s=>ymd(pd(s));
const daysAgo=s=>Math.max(0,Math.floor((Date.now()-pd(s))/864e5));
const isOpen=d=>OPEN.includes(d.cat);
const since=d=>{const L=evBy[d.id];return daysAgo(L&&L.length?L[L.length-1].created:d.created)};   // days in current status
const stale=d=>isOpen(d)&&daysAgo(d.updated)>=(+cfg.staleDays||14);                               // no activity
const prob=k=>k==='pending'?(+cfg.pendingProb||0)/100:k==='c80'?.8:k==='won'||k==='c100'?1:0;
const fcast=ds=>ds.reduce((s,d)=>s+val(d)*prob(d.cat),0);
const qUser=(uid,m)=>{const x=quotas.find(q=>q.user===uid&&!q.team&&q.month===m);return x?+x.amount||0:+(users.find(u=>u.id===uid)?.quota)||0};
const qTeam=(t,m,reps)=>{const x=t&&quotas.find(q=>!q.user&&q.team===t&&q.month===m);return x?+x.amount||0:reps.reduce((s,u)=>s+qUser(u.id,m),0)};
const custName=id=>customers.find(c=>c.id===id)?.name||'';
const months=(end,n)=>[...Array(n)].map((_,i)=>addM(end,i-n+1));
const niceMax=v=>{if(v<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(v))),f=v/p;return(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p};
const pctN=(a,b)=>b?Math.round(a/b*100):0;
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const median=a=>{if(!a.length)return 0;const s=a.slice().sort((x,y)=>x-y),h=s.length>>1;return s.length%2?s[h]:(s[h-1]+s[h])/2};

// ===== visual helpers (dataviz audit, see docs/DATAVIZ.md) ===================
const CH={},TV=new Set();                 // chart specs by id (rebuilt each render) · charts shown as tables
const money=v=>'฿'+fmtK(v);
const mk=v=>`<span data-tt="฿${fmt(v)}">${money(v)}</span>`;          // compact value, exact on hover
const dot=c=>`<i class="dot" style="background:${c}"></i>`;
// signed change vs the previous month; arrow + text, colour only reinforces
function delta(cur,prev,{upGood=true,points=false}={}){
 if(prev==null||(!prev&&!cur))return'';const d=cur-prev;
 if(Math.abs(d)<1e-9)return'<span class="dl flat">● เท่ากับเดือนก่อน</span>';
 const up=d>0,mag=points?Math.abs(Math.round(d))+' จุด':prev?Math.round(Math.abs(d)/Math.abs(prev)*100)+'%':money(Math.abs(d));
 return`<span class="dl ${up===upGood?'good':'bad'}">${up?'▲':'▼'} ${mag} เทียบเดือนก่อน</span>`}
// 12-point sparkline: de-emphasis line, current period dot in the accent
function spark(vals,labels){const w=132,h=30,p=5,n=vals.length,mx=Math.max(1,...vals);if(n<2)return'';
 const X=i=>p+i*(w-2*p)/(n-1),Y=v=>h-p-(v/mx)*(h-2*p),tt=['ปิดขายแล้ว รายเดือน',...labels.map((l,i)=>l+'  ฿'+fmt(vals[i]))].join('\n');
 return`<svg class="spk" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(tt.replace(/\n/g,', '))}" data-tt="${esc(tt)}" tabindex="0"><polyline class="sl" points="${vals.map((v,i)=>X(i).toFixed(1)+','+Y(v).toFixed(1)).join(' ')}"/><circle class="sd" cx="${X(n-1).toFixed(1)}" cy="${Y(vals[n-1]).toFixed(1)}" r="4"/></svg>`}
// meter: closed-won fill, lighter forecast extension, target tick; domain grows past the target
function meter(won,fc,target,label){const top=Math.max(fc,won),dom=Math.max(1,target,top)*1.04,P=v=>Math.min(100,v/dom*100);
 const tt=`${label}\nปิดแล้ว ฿${fmt(won)}\nพยากรณ์ ฿${fmt(Math.round(fc))}\nเป้า ${target?'฿'+fmt(target):'ยังไม่ได้ตั้ง'}`;
 return`<div class="mtw" data-tt="${esc(tt)}" tabindex="0" role="img" aria-label="${esc(tt.replace(/\n/g,', '))}"><div class="mt"><i class="fc" style="width:${P(top).toFixed(1)}%"></i><i style="width:${P(won).toFixed(1)}%"></i></div>${target?`<b class="tk" style="left:calc(${P(target).toFixed(1)}% - 1px)"></b>`:''}</div>`}
const meterKey=()=>`<span><i class="lk" style="background:var(--st-won)"></i>ปิดขายแล้ว</span><span><i class="lk" style="background:color-mix(in srgb,var(--st-won) 42%,transparent)"></i>พยากรณ์ที่จะปิดเพิ่ม</span><span><i class="lk" style="background:var(--target);width:3px"></i>เป้า</span>`;
// 100% bar for part-to-whole with a value legend (labels live in the legend, not inside thin segments)
function pbar(parts,{money:isM=true,empty='ยังไม่มีข้อมูล',label=''}={}){const t=parts.reduce((a,p)=>a+p.v,0);if(!t)return`<p class="mu">${empty}</p>`;
 const fv=v=>isM?'฿'+fmt(v):fmt(v);
 return`<div class="pb" role="img" aria-label="${esc(label+': '+parts.map(p=>p.n+' '+fv(p.v)).join(', '))}">${parts.map(p=>p.v?`<i style="flex:${p.v} 1 0;background:${p.c}" data-tt="${esc(p.n+'\n'+fv(p.v)+' ('+pctN(p.v,t)+'%)')}"></i>`:'').join('')}</div><div class="pl">${parts.map(p=>`<div>${dot(p.c)}<span>${esc(p.n)}</span><span class="mu">${pctN(p.v,t)}%</span><span class="v">${fv(p.v)}</span></div>`).join('')}</div>`}

// fig(): titled chart with a table-view twin. The SVG is drawn after render at the
// real container width (drawCharts), so text stays 11 px on phones.
function fig(id,title,spec){CH[id]=spec;const tv=TV.has(id),plain=title.replace(/<[^>]+>/g,'');
 const s=spec.series||[],n=s.length+(spec.line?1:0);
 const lg=n>=2?`<div class="lgd2">${s.map(x=>`<span><i style="background:${x.color}"></i>${esc(x.name)}</span>`).join('')}${spec.line?`<span><i class="ln" style="background:${spec.line.color}"></i>${esc(spec.line.name)}</span>`:''}</div>`:'';
 return`<figure class="fig"><div class="fh"><h3>${title}</h3><button class="b gh sm" data-a="tv" data-c="${id}">${tv?'ดูเป็นกราฟ':'ดูเป็นตาราง'}</button></div>${tv?tvTable(spec):`<div class="chart" data-ch="${id}" role="img" aria-label="${esc(plain+'. '+summary(spec))}"></div>${lg}`}${spec.note?`<small class="mu">${spec.note}</small>`:''}</figure>`}
const fv=(s,v)=>s.money===false?fmt(v):'฿'+fmt(v);
function summary(s){const i=s.labels.length-1;if(i<0)return'';const tot=(s.series||[]).reduce((a,x)=>a+(+x.data[i]||0),0);return`ล่าสุด ${s.labels[i]} ${fv(s,tot)}${s.line?`, ${s.line.name} ${fv(s,s.line.data[i])}`:''}`}
function tvTable(s){const S=s.series||[];return`<div style="overflow-x:auto"><table class="tv"><tr><th>${esc(s.xName||'เดือน')}${S.map(x=>`<th class="num">${esc(x.name)}`).join('')}${S.length>1?'<th class="num">รวม':''}${s.line?`<th class="num">${esc(s.line.name)}`:''}</tr>${s.labels.map((l,i)=>`<tr><td>${esc(l)}${S.map(x=>`<td class="num">${fv(s,+x.data[i]||0)}`).join('')}${S.length>1?`<td class="num">${fv(s,S.reduce((a,x)=>a+(+x.data[i]||0),0))}`:''}${s.line?`<td class="num">${fv(s,+s.line.data[i]||0)}`:''}</tr>`).join('')}</table></div>`}
function drawCharts(){document.querySelectorAll('.chart[data-ch]').forEach(el=>{const s=CH[el.dataset.ch];if(s)el.innerHTML=svgChart(el.dataset.ch,s,Math.max(240,el.clientWidth||600))})}
function svgChart(id,s,W){const{labels,series=[],line=null,h=230}=s,n=labels.length||1,pl=58,pr=12,pt=20,pbm=28,iw=W-pl-pr,ih=h-pt-pbm;
 const tot=labels.map((_,i)=>series.reduce((a,x)=>a+(+x.data[i]||0),0)),raw=Math.max(0,...tot,...(line?line.data.map(v=>+v||0):[0]));
 const fa=v=>s.money===false?fmtK(v):'฿'+fmtK(v);
 if(!raw)return`<svg width="${W}" height="70" aria-hidden="true"><text x="${W/2}" y="40" text-anchor="middle" class="em">ยังไม่มีข้อมูลในช่วงนี้</text></svg>`;
 const mx=niceMax(raw),y=v=>pt+ih-(v/mx)*ih,step=iw/n,bw=Math.max(4,Math.min(24,step*.6)),skip=Math.max(1,Math.ceil(48/step));
 const f=mx/Math.pow(10,Math.floor(Math.log10(mx))),nt=f===2.5||f===5?5:4;let g='';
 for(let t=1;t<=nt;t++){const yy=y(mx*t/nt).toFixed(1);g+=`<line x1="${pl}" x2="${W-pr}" y1="${yy}" y2="${yy}" class="gl"/>`}
 for(let t=0;t<=nt;t++){const v=mx*t/nt;g+=`<text x="${pl-8}" y="${(y(v)+4).toFixed(1)}" text-anchor="end" class="ax">${fa(v)}</text>`}
 // hover/focus bands (one per x position, larger than the mark) + crosshair
 labels.forEach((l,i)=>{g+=`<rect class="hit" data-hit="${id}:${i}" tabindex="0" x="${(pl+step*i).toFixed(1)}" y="${pt}" width="${step.toFixed(1)}" height="${ih}" aria-label="${esc(l+": "+fv(s,tot[i]))}"/>`});
 g+=`<line class="xh" x1="0" x2="0" y1="${pt}" y2="${pt+ih}"/>`;
 // columns: <=24px, 4px rounded data-end, square at the baseline, 2px surface gap between stacked segments
 const top=(x,yt,w,yb,r)=>{r=Math.min(r,w/2,yb-yt);return`M${x.toFixed(1)},${yb.toFixed(1)}V${(yt+r).toFixed(1)}Q${x.toFixed(1)},${yt.toFixed(1)} ${(x+r).toFixed(1)},${yt.toFixed(1)}H${(x+w-r).toFixed(1)}Q${(x+w).toFixed(1)},${yt.toFixed(1)} ${(x+w).toFixed(1)},${(yt+r).toFixed(1)}V${yb.toFixed(1)}Z`};
 labels.forEach((l,i)=>{const x=pl+step*i+(step-bw)/2,vs=series.map(se=>+se.data[i]||0),last=vs.reduce((a,v,j)=>v?j:a,-1);let acc=0;
  series.forEach((se,j)=>{const v=vs[j];if(!v)return;const yt=y(acc+v);let yb=y(acc);if(acc>0)yb-=2;acc+=v;if(yb-yt<.5)return;
   g+=`<path d="${j===last?top(x,yt,bw,yb,4):`M${x.toFixed(1)},${yb.toFixed(1)}V${yt.toFixed(1)}H${(x+bw).toFixed(1)}V${yb.toFixed(1)}Z`}" style="fill:${se.color}"/>`});
  if(i%skip===(n-1)%skip)g+=`<text x="${(pl+step*i+step/2).toFixed(1)}" y="${h-8}" text-anchor="middle" class="ax">${esc(l)}</text>`});
 g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(0)}" y2="${y(0)}" class="bl"/>`;
 if(line){const pts=line.data.map((v,i)=>[pl+step*i+step/2,y(+v||0)]);
  g+=`<polyline points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" style="fill:none;stroke:${line.color};stroke-width:2;stroke-linejoin:round;stroke-linecap:round" ${line.dash?'stroke-dasharray="6 4"':''}/>`+pts.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" style="fill:${line.color};stroke:var(--cd);stroke-width:2"/>`).join('')}
 // selective direct labels: the latest period and the peak, never every bar
 if(series.length){const last=n-1,peak=tot.indexOf(Math.max(...tot)),idx=[last];if(peak!==last&&Math.abs(peak-last)*step>56)idx.push(peak);
  idx.forEach(i=>{if(tot[i])g+=`<text x="${(pl+step*i+step/2).toFixed(1)}" y="${(y(tot[i])-7).toFixed(1)}" text-anchor="middle" class="lb">${fa(tot[i])}</text>`})}
 return`<svg width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" aria-hidden="false">${g}</svg>`}
const hbars=(rows,fv=v=>'฿'+fmt(v))=>{const mx=Math.max(1,...rows.map(r=>r.value));return rows.length?rows.map(r=>`<div class="r"><span>${esc(r.label)}</span><div class="bar"><i style="width:${r.value/mx*100}%;background:${r.color||'var(--s1)'}"></i></div><span class="mu">${fv(r.value)}${r.sub?' · '+esc(r.sub):''}</span></div>`).join(''):'<p class="mu">ยังไม่มีข้อมูล</p>'};
// stat tile: label · value · sub · optional change/sparkline; warnings carry ⚠ + text, not colour alone
const kpi=(label,value,sub='',o={})=>{if(typeof o==='string')o={c:o};const c=o.warn?'var(--serious)':o.c;return`<div class="k"${c?` style="border-top:3px solid ${c}"`:''}><span class="mu">${o.warn?ico('warn')+' ':''}${label}</span><b>${value}</b>${sub?`<small class="mu">${sub}</small>`:''}${o.x||''}</div>`};

// ===== tooltip layer (pointer, touch and keyboard focus; text via textContent) ==
const tipEl=()=>document.getElementById('tip');
function tipShow(x,y,head,rows){const t=tipEl();if(!t)return;t.replaceChildren();const hd=document.createElement('div');hd.className='th';hd.textContent=head;t.append(hd);
 rows.forEach(r=>{const d=document.createElement('div');d.className='tr';if(r.c){const k=document.createElement('i');k.className='lk';k.style.background=r.c;d.append(k)}const b=document.createElement('b');b.textContent=r.v;d.append(b);if(r.n){const sp=document.createElement('span');sp.textContent=r.n;d.append(sp)}t.append(d)});
 t.hidden=false;const rc=t.getBoundingClientRect();let L=x+14,T=y+14;if(L+rc.width>innerWidth-8)L=x-rc.width-14;if(T+rc.height>innerHeight-8)T=y-rc.height-14;t.style.left=Math.max(8,L)+'px';t.style.top=Math.max(8,T)+'px'}
function tipHide(){const t=tipEl();if(t)t.hidden=true;document.querySelectorAll('.hit.on,.xh.on').forEach(e=>e.classList.remove('on'))}
function tipFor(el,x,y){
 if(el.dataset.hit){const[id,i]=el.dataset.hit.split(':'),s=CH[id];if(!s)return;const S=s.series||[];
  const rows=S.map(se=>({c:se.color,v:fv(s,+se.data[i]||0),n:se.name}));if(S.length>1)rows.push({v:fv(s,S.reduce((a,se)=>a+(+se.data[i]||0),0)),n:'รวม'});if(s.line)rows.push({c:s.line.color,v:fv(s,+s.line.data[i]||0),n:s.line.name});
  tipHide();el.classList.add('on');const xh=el.ownerSVGElement&&el.ownerSVGElement.querySelector('.xh');if(xh){const cx=(+el.getAttribute('x')+(+el.getAttribute('width'))/2).toFixed(1);xh.setAttribute('x1',cx);xh.setAttribute('x2',cx);xh.classList.add('on')}
  tipShow(x,y,s.labels[i],rows)}
 else if(el.dataset.tt!=null){const L=el.dataset.tt.split('\n');tipShow(x,y,L[0],L.slice(1).map(v=>({v})))}}
document.addEventListener('pointermove',e=>{const el=e.target.closest&&e.target.closest('[data-hit],[data-tt]');if(!el){const t=tipEl();if(t&&!t.hidden)tipHide();return}tipFor(el,e.clientX,e.clientY)});
document.addEventListener('pointerdown',e=>{const el=e.target.closest&&e.target.closest('[data-hit],[data-tt]');if(el&&e.pointerType!=='mouse')tipFor(el,e.clientX,e.clientY)});
document.addEventListener('focusin',e=>{const el=e.target.closest&&e.target.closest('[data-hit],[data-tt]');if(el){const r=el.getBoundingClientRect();tipFor(el,r.left+r.width/2,r.top)}});
document.addEventListener('focusout',tipHide);
// focusing a mark scrolls it into view: keep the tooltip with the focused mark instead of hiding it
addEventListener('scroll',()=>{const el=document.activeElement;if(el&&el.matches&&el.matches('[data-hit],[data-tt]')){const r=el.getBoundingClientRect();tipFor(el,r.left+r.width/2,r.top)}else tipHide()},true);
let rzT=0;addEventListener('resize',()=>{clearTimeout(rzT);rzT=setTimeout(()=>{tipHide();drawCharts()},150)});

// CSV export (UTF-8 BOM so Thai opens correctly in Excel; formula-injection safe)
function csv(name,head,rows){
 const cell=v=>{if(v==null)v='';if(typeof v==='number')return String(v);v=String(v);if(/^[=+\-@\t\r]/.test(v))v="'"+v;return /[",\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
 const t='﻿'+[head,...rows].map(r=>r.map(cell).join(',')).join('\r\n');
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/csv;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}

// link a free-text customer name to the customer master (optionally creating it)
async function linkCust(name,create){
 const k=normKey(name);if(!k)return'';
 const c=customers.find(x=>x.nameKey===k);if(c)return c.id;
 if(!create||!(writer()||dir()))return'';
 try{const r=await pb.collection('customers').create({name:String(name).trim()});return r.id}
 catch(e){try{return(await pb.collection('customers').getFirstListItem(pb.filter('nameKey = {:k}',{k}))).id}catch{return''}}}
const custList=()=>`<datalist id="cul">${customers.map(c=>`<option value="${esc(c.name)}">`).join('')}</datalist>`;

// ===== UX helpers (UX audit): icons, live region, toasts, confirm dialog, empty states, nav =====
const ICO={plus:'M12 5v14M5 12h14',chevL:'M15 18l-6-6 6-6',chevR:'M9 18l6-6-6-6',dl:'M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3',print:'M6 9V3h12v6M6 18H4v-7h16v7h-2M8 15h8v6H8z',refresh:'M20 11a8 8 0 1 0 .5 4M20 4v7h-7',clip:'M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8',cam:'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7',lock:'M6 11h12v10H6zM9 11V7a3 3 0 0 1 6 0v4',warn:'M12 3l10 18H2zM12 10v4m0 3v.5',clock:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20M12 7v5l3 2',link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',check:'M4 12l5 5L20 7',cal:'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',moon:'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',logout:'M10 17l5-5-5-5M15 12H3M12 3h7v18h-7',user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0',x:'M18 6L6 18M6 6l12 12',chart:'M4 20V10M10 20V4M16 20v-7M22 20H2',people:'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M2 20a6 6 0 0 1 12 0M12 20a6 6 0 0 1 10 0',doc:'M6 2h8l6 6v14H6zM14 2v6h6M9 13h6M9 17h6',inbox:'M4 4h16v16H4zM4 14h5l2 3h2l2-3h5',edit:'M4 20h4l10-10-4-4L4 16zM13 7l4 4',trash:'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',phone:'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2'};
const ico=(n,cls='')=>`<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICO[n]||''}"/></svg>`;
// month picker: Thai month text on a button with the native input invisible on top
// (browsers without type=month, e.g. older Safari/Firefox, get the plain input)
const MPK=(()=>{const i=document.createElement('input');i.type='month';return i.type==='month'})();
const mPick=(id,v,l,txt=true)=>MPK?`<label class="b gh pk" title="${l}">${ico('cal')}${txt?`<span class="pkt">${mlab(v)}</span>`:''}${vh(l)}<input type="month" id="${id}" value="${v}"></label>`:`<label>${vh(l)}<input type="month" id="${id}" value="${v}" style="width:150px"></label>`;
// theme toggle: icon only, shows the theme it switches to
const thBtn=()=>{const l=TH==='dark'?'เปลี่ยนเป็นโหมดสว่าง':'เปลี่ยนเป็นโหมดมืด';return`<button type="button" class="b gh thb" data-a="theme" aria-label="${l}" title="${l}">${ico(TH==='dark'?'sun':'moon')}</button>`};
const vh=t=>`<span class="vh">${t}</span>`;
// NARA brand: the mark is traced from logo/Nara-LOGOOnly-PNG.png; the wordmark is a CSS mask (brand/wordmark.png) tinted with the text colour
const MARK='<svg class="mk" viewBox="0 0 414.5 421" aria-hidden="true"><path fill="#F1BD48" d="M0 120.5L85 70.25L294.75 190.5L293.25 288.25L86 169.5L85.5 372L0.25 421ZM119.25 50.5L207.25 0L414.25 120L414.5 372L329.25 421L329.25 170Z"/></svg>';
const LOCKUP=`${MARK}<span class="wm" aria-hidden="true"></span><span class="crm" aria-hidden="true">CRM</span>`;
const homeTab=()=>me?.role==='spec'?'wk':'ov';
let toastT=0;
function announce(msg){const l=$('#live');if(!l)return;l.textContent='';setTimeout(()=>{l.textContent=msg},30)}
function toast(msg,ms=2200){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');document.body.append(t)}t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true},ms);announce(msg)}
// styled confirmation (replaces window.confirm); resolves true / false
function confirmDlg({title,text='',ok='ตกลง',danger=false}){return new Promise(res=>{let d=$('#cfm');if(!d){d=document.createElement('dialog');d.id='cfm';document.body.append(d)}
 d.innerHTML=`<h3 id="cfmT">${esc(title)}</h3>${text?`<p>${esc(text)}</p>`:''}<div class="ft"><button type="button" class="b gh" data-c="0">ยกเลิก</button><button type="button" class="b${danger?' rd':''}" data-c="1" style="margin:0">${esc(ok)}</button></div>`;
 d.setAttribute('aria-labelledby','cfmT');const done=v=>{d.close();d.onclick=null;d.oncancel=null;res(v)};
 d.onclick=e=>{const b=e.target.closest('[data-c]');if(b)done(b.dataset.c==='1')};d.oncancel=e=>{e.preventDefault();done(false)};d.showModal();d.querySelector('[data-c="0"]').focus()})}
// open the shared dialog with an accessible name; the error line is a live region
function showDlg(){const d=$('#dlg');const h=d.querySelector('h3');if(h){h.id='dlgT';d.setAttribute('aria-labelledby','dlgT')}const er=d.querySelector('.er');if(er)er.setAttribute('aria-live','polite');d.showModal();d.scrollTop=0}
const empty=(icon,text,action='')=>`<div class="emp">${ico(icon)}<div>${text}</div>${action}</div>`;
// required marker + inline field error
const req=l=>`<span class="lt">${l} <span class="rq" aria-hidden="true">*</span></span>`;
function fieldErr(id,msg){const f=$(id);if(!f)return;f.classList.add('inv');f.setAttribute('aria-invalid','true');let s=f.parentElement.querySelector('.fe');if(!s){s=document.createElement('small');s.className='fe';f.parentElement.append(s)}s.textContent=msg;f.focus()}
function clearErr(root='#dlg'){document.querySelectorAll(root+' .inv').forEach(f=>{f.classList.remove('inv');f.removeAttribute('aria-invalid')});document.querySelectorAll(root+' .fe').forEach(s=>s.remove())}
// navigation: four areas, each with sub tabs; the URL hash mirrors the current tab
const AREAS=[['sales','ขาย','chart',['ov','pl','al','an']],['cust','ลูกค้า','people',['cu']],['rep','รายงาน','doc',['wk','dg','pn','sr']],['team','ทีม','user',['tm']]];
const TABL={ov:'ภาพรวม',pl:'Pipeline',al:'Commit',an:'วิเคราะห์',cu:'ลูกค้า',wk:'รายงานประจำสัปดาห์',dg:'สรุปสัปดาห์',pn:'แพลนเข้าพบลูกค้า',sr:'Sales Spec Report',tm:'ทีมและเป้า'};
const areaOf=t=>AREAS.find(x=>x[3].includes(t))||AREAS[0];
const lastIn={};
let busyN=0;const busy=on=>{busyN=Math.max(0,busyN+(on?1:-1));const m=$('main');if(m)m.classList.toggle('busy',busyN>0)};
const csvBtn=x=>`<button type="button" class="b gh sm" data-a="exp" data-x="${x}">${ico('dl')} CSV</button>`;
// focus is kept across re-renders (the page is rebuilt on every state change)
function focusKey(){const e=document.activeElement;if(!e||!$('#app')||!$('#app').contains(e))return null;const d=e.dataset||{};return{id:e.id,a:d.a,i:d.id||d.k||d.dt||d.x||d.c||'',sel:e.tagName==='INPUT'&&['text','search','email',''].includes(e.type||'')&&e.selectionStart!=null?e.selectionStart:null}}
function restoreFocus(k){if(!k)return;let el=null;if(k.id)el=document.getElementById(k.id);if(!el&&k.a)el=[...document.querySelectorAll(`[data-a="${k.a}"]`)].find(x=>{const d=x.dataset;return(d.id||d.k||d.dt||d.x||d.c||'')===k.i});
 if(el){try{el.focus({preventScroll:true});if(k.sel!=null)el.setSelectionRange(k.sel,k.sel)}catch{}}}
function afterRender(fk){const m=$('main');if(!m)return;
 // rows, cards and calendar cells act as buttons for keyboard and screen readers
 m.querySelectorAll('tr[data-a],.cd[data-a],.cc[data-a]:not(.e)').forEach(el=>{el.setAttribute('tabindex','0');el.setAttribute('role','button')});
 // copy header texts onto cells (phone card layout) and mark header rows
 m.querySelectorAll('table').forEach(t=>{const hr=[...t.rows].find(r=>r.cells.length&&[...r.cells].every(c=>c.tagName==='TH'));if(!hr)return;hr.classList.add('hd');const H=[...hr.cells].map(c=>c.innerText.trim());
  [...t.rows].forEach(r=>{if(r===hr||r.classList.contains('dh'))return;let i=0;[...r.cells].forEach(c=>{if(c.colSpan>1){i+=c.colSpan;return}if(H[i]&&c.tagName==='TD')c.dataset.label=H[i];i++})})});
 if(busyN>0)m.classList.add('busy');
 drawCharts();
 const s=$('nav.sub a[aria-current]');if(s&&s.scrollIntoView)s.scrollIntoView({block:'nearest',inline:'center'});
 restoreFocus(fk)}

// ===== live data (REST list + realtime subscription) =========================
// One permanent subscription per collection; the current filter decides which
// records are kept. PocketBase applies the collection list rule to every event,
// so a client only ever receives what it is allowed to read.
const S={};
async function watch(name,{filter='',sort='+created',test=null}={},apply){
 const st=S[name]||(S[name]={seq:0,sub:false});st.test=test;st.apply=apply;const seq=++st.seq;
 const list=await pb.collection(name).getFullList({filter,sort});
 if(seq!==st.seq||!me)return;
 st.list=list;apply(list);
 if(!st.sub){st.sub=true;
  pb.collection(name).subscribe('*',e=>{const r=e.record,L=st.list||[],i=L.findIndex(x=>x.id===r.id);
   if(e.action==='delete'){if(i>=0)L.splice(i,1)}else{const ok=!st.test||st.test(r);if(!ok){if(i>=0)L.splice(i,1)}else if(i>=0)L[i]=r;else L.push(r)}
   st.apply(L)}).catch(()=>{st.sub=false})}}
function stopAll(){for(const k of Object.keys(S))delete S[k];pb.realtime.unsubscribe().catch(()=>{})}

// ===== auth ==================================================================
let lastHtml='';
function loginView(msg=''){lastHtml='';
 const am=authMethods,g=am?.oauth2?.enabled&&(am.oauth2.providers||[]).some(p=>p.name==='google'),pw=am?.password?.enabled;
 $('#app').innerHTML=`<div class="lgw"><div class="lg"><h1 class="vh">NARA CRM</h1><div class="lgb">${LOCKUP}</div><span class="mu lgs">ระบบ Commit ยอดขายทีม</span>${g?`<button class="b gb" data-a="google">${GSVG}เข้าสู่ระบบด้วย Google</button>`:am?'<p class="er">ยังไม่ได้ตั้งค่า Google Sign-In บนเซิร์ฟเวอร์ (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)</p>':'<span class="mu">กำลังโหลด...</span>'}${pw?`<details><summary class="mu" style="cursor:pointer">เข้าสู่ระบบด้วยรหัสผ่าน (สำหรับทดสอบ)</summary><div style="display:flex;flex-direction:column;gap:8px;margin-top:8px"><input id="em" placeholder="อีเมล"><input id="pw" type="password" placeholder="รหัสผ่าน"><button class="b" data-a="login">เข้าสู่ระบบ</button></div></details>`:''}<div class="er">${esc(msg)}</div>${thBtn()}</div></div>`}
async function boot(msg=''){
 if(!authMethods){try{authMethods=await pb.collection('users').listAuthMethods()}catch(e){authMethods=null}}
 if(pb.authStore.isValid){try{await pb.collection('users').authRefresh()}catch(e){if(e?.status===401||e?.status===403||e?.status===404)pb.authStore.clear()}}
 if(!pb.authStore.isValid){loginView(msg);return}
 const u=pb.authStore.record;
 if(!u?.role){pb.authStore.clear();loginView('บัญชีนี้ยังไม่ได้ลงทะเบียนในทีม ติดต่อ Director');return}
 start({id:u.id,...u})}
function logout(){stopAll();pb.authStore.clear();me=null;users=[];deals=[];reports=[];rcom=[];plans=[];srs=[];customers=[];quotas=[];events=[];evBy={};wplans=[];snaps=[];yrep=[];aggWon=aggCust=null;aggDirty=true;cuData={};cuMerge=null;cuSel='';hl=null;dgInfo=null;anInit=tmInit=0;snapMsg=dgMsg='';M=nowM();PM=nowM();q=rf=tf=wf=sq=sst=cuQ=cuProv=anTeam='';cfg={...DEF};loginView()}
function start(u){me=u;W=monOf();tab=homeTab();const h0=location.hash.slice(1);if(TABL[h0])tab=h0;pinit=0;pf='';sinit=0;srs=[];
 watch('users',{sort:'+name'},L=>{users=L;const m=users.find(x=>x.id===me?.id);if(me&&!m){logout();loginView('บัญชีนี้ถูกนำออกจากรายชื่อทีมแล้ว');return}if(m){me={...me,...m};if(!me.role){logout();loginView('บัญชีนี้ยังไม่ได้ลงทะเบียนในทีม ติดต่อ Director');return}}if(!pinit){pinit=1;pf=defPf();subP()}render()}).catch(e=>loginView(emsg(e)));
 watch('deals',{},L=>{deals=L;aggDirty=true;render()}).catch(e=>{const m=$('.er');if(m)m.textContent=emsg(e)});
 watch('crm_settings',{},L=>{const s=L[0];if(s){cfgId=s.id;cfg={...DEF,...Object.fromEntries(Object.entries(s).filter(([,v])=>v!==null&&v!==''))}}render()}).catch(()=>{});
 watch('customers',{sort:'+name'},L=>{customers=L;aggDirty=true;render()}).catch(()=>{});
 watch('quotas',{},L=>{quotas=L;render()}).catch(()=>{});
 watch('deal_events',{},L=>{events=L;evBy={};L.forEach(e=>(evBy[e.deal]=evBy[e.deal]||[]).push(e));for(const k in evBy)evBy[k].sort((a,b)=>a.created<b.created?-1:1);render()}).catch(()=>{});
 subW()}

// lazy loaders (server-side views and non-realtime lists)
async function loadAgg(){if(aggBusy)return;aggBusy=true;aggDirty=false;busy(1);
 try{const[a,b]=await Promise.all([pb.collection('v_won_monthly').getFullList(),pb.collection('v_customer_totals').getFullList()]);aggWon=a;aggCust=b}catch{aggWon=aggWon||[];aggCust=aggCust||[]}
 aggBusy=false;busy(0);render()}
async function loadAn(){const ms=winM();busy(1);
 try{snaps=await pb.collection('deal_snapshots').getFullList({filter:pb.filter('month >= {:a} && month <= {:b}',{a:ms[0],b:ms[ms.length-1]}),fields:'id,month,deal,owner,team,cat,value'})}catch{snaps=[]}
 try{yrep=await pb.collection('reports').getFullList({filter:pb.filter('date >= {:a}',{a:ms[0]+'-01'}),fields:'id,owner,date,visitType,outcome,customer'})}catch{yrep=[]}
 busy(0);render()}
async function loadWP(){if(!me)return;const f=pb.filter('date >= {:a} && date <= {:b}',{a:W,b:addD(W,6)})+(viewAll()?'':pb.filter(' && owner = {:o}',{o:me.id}));
 try{wplans=await pb.collection('plans').getFullList({filter:f})}catch{wplans=[]}render()}
async function loadHealth(){busy(1);try{hl=await pb.send('/api/crm/health',{})}catch(e){hl={error:emsg(e)}}busy(0);render()}
async function loadDg(){if(!dir())return;try{dgInfo=await pb.send('/api/crm/digest',{})}catch(e){dgInfo={error:emsg(e)}}render()}

// ===== render ================================================================
function render(){if(!me)return;if(tab==='sr'&&!sinit){sinit=1;subS()}const ds=deals.filter(inM);
 const NV=['viewer','spec'].includes(me.role),mg=dir()||me.role==='am';if(!mg&&tab==='tm')tab='ov';if(!viewAll()&&tab==='dg')tab='ov';
 if((tab==='an'||tab==='cu')&&aggDirty&&!aggBusy)loadAgg();
 if(tab==='an'&&!anInit){anInit=1;loadAn()}
 if(tab==='tm'&&!tmInit){tmInit=1;loadHealth();loadDg()}
 const allowed=k=>k==='tm'?mg:k==='dg'?viewAll():true,ar=areaOf(tab),subs=ar[3].filter(allowed);lastIn[ar[0]]=tab;
 const areaLink=(x,cls)=>{const to=x[3].includes(lastIn[x[0]])&&allowed(lastIn[x[0]])?lastIn[x[0]]:x[3].find(allowed);return`<a href="#${to}" data-a="tab" data-k="${to}" ${x===ar?'aria-current="page"':''}>${cls==='bb'?ico(x[2]):''}<span>${x[1]}</span></a>`};
 const ARS=AREAS.filter(x=>x[3].some(allowed));
 const body=tab==='ov'?ov(ds):tab==='pl'?pl(ds):tab==='al'?al(ds):tab==='an'?an():tab==='cu'?cu():tab==='wk'?wk():tab==='dg'?dg():tab==='pn'?cal():tab==='sr'?sr():tm();
 const fk=focusKey();
 const html=`<header><div class="hdr"><a class="brand" href="#${homeTab()}" data-a="tab" data-k="${homeTab()}" aria-label="NARA CRM – หน้าแรก">${LOCKUP}</a><nav class="pri" aria-label="เมนูหลัก">${ARS.map(x=>areaLink(x,'pri')).join('')}</nav>${['ov','pl','al'].includes(tab)?mPick('mo',M,'เลือกเดือน'):''}${NV||!['ov','pl','al','cu'].includes(tab)?'':`<button class="b" data-a="new">${ico('plus')} ดีลใหม่</button>`}${thBtn()}<details class="um"><summary aria-label="เมนูผู้ใช้ ${esc(me.name)}">${ico('user')}<span class="un">${esc(me.name)}</span></summary><div class="mn"><small class="mu" style="padding:6px 10px">${esc(me.name)} · ${RL[me.role]||''}</small><button type="button" class="lnk" data-a="out">${ico('logout')} ออกจากระบบ</button></div></details></div>${subs.length>1?`<nav class="sub" aria-label="เมนูย่อย">${subs.map(k=>`<a href="#${k}" data-a="tab" data-k="${k}" ${k===tab?'aria-current="page"':''}>${TABL[k]}</a>`).join('')}</nav>`:''}</header><main id="main" tabindex="-1"><div class="pbrand" aria-hidden="true">${LOCKUP}<span class="pt">${TABL[tab]} · ${new Date().toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'})}</span></div><h1 class="vh">${TABL[tab]}</h1>${body}</main><nav class="bb" aria-label="เมนูหลัก (มือถือ)">${ARS.map(x=>areaLink(x,'bb')).join('')}</nav>`;
 // realtime events often change nothing visible: keep the current frame (no flash)
 if(html===lastHtml)return;lastHtml=html;tipHide();$('#app').innerHTML=html;afterRender(fk)}

const pct=(a,b)=>b?(a/b*100).toFixed(1)+'%':'-';
const age=d=>isOpen(d)?` <small class="age${stale(d)?' st':''}" title="อยู่สถานะนี้ ${since(d)} วัน · ไม่มีความเคลื่อนไหว ${daysAgo(d.updated)} วัน">${stale(d)?ico('warn'):''}${ico('clock')} ${since(d)} วัน${stale(d)?vh(' ไม่มีความเคลื่อนไหว'):''}</small>`:'';
const qAll=m=>{const R=users.filter(isSales),TT=TEAMS();return TT.reduce((s,t)=>s+qTeam(t,m,R.filter(u=>u.team===t)),0)+R.filter(u=>!TT.includes(u.team)).reduce((s,u)=>s+qUser(u.id,m),0)};
const closedIn=(m,k)=>deals.filter(d=>d.cat===k&&(d.closedMonth||d.month)===m);
// the one hero figure of the view: closed-won this month for all teams, with meter,
// 12-month sparkline and change vs last month; KPI tiles follow the stat-tile contract
function ovTop(ds){const pm=addM(M,-1),qt=qAll(M),wonD=ds.filter(d=>d.cat==='won'),lostD=ds.filter(d=>d.cat==='lost'),won=sum(wonD),fc=fcast(ds);
 const wP=closedIn(pm,'won'),lP=closedIn(pm,'lost'),ms=months(M,12),sv=ms.map(m=>sum(closedIn(m,'won')));
 const wr=wonD.length+lostD.length?pctN(wonD.length,wonD.length+lostD.length):null,wrP=wP.length+lP.length?pctN(wP.length,wP.length+lP.length):null;
 const avgW=wonD.length?won/wonD.length:0,avgP=wP.length?sum(wP)/wP.length:0,st=deals.filter(stale);
 return`<div class="hero"><div><div class="hl">ปิดขายแล้ว · ${mlab(M)} · ทุกทีม</div><div class="hv">${mk(won)}</div><div class="hs">${qt?`${pct(won,qt)} ของเป้า ${money(qt)}`:'ยังไม่ได้ตั้งเป้า'} &nbsp; ${delta(won,sum(wP))}</div></div><div>${spark(sv,ms.map(mlab))}<small class="mu">12 เดือนล่าสุด</small></div>${meter(won,fc,qt,'ทุกทีม เดือน '+mlab(M))}<div class="mtc" style="grid-column:1/-1">${meterKey()}<span>พยากรณ์ ${mk(Math.round(fc))}${qt?` (${pct(fc,qt)} ของเป้า)`:''}</span></div></div>
<div class="g">${kpi('พยากรณ์ยอดปิด (ถ่วงน้ำหนัก)',mk(Math.round(fc)),`Commit 100% ×100% · 80% ×80% · รอพิจารณา ×${cfg.pendingProb}%`)}${kpi('Win rate',wr==null?'-':wr+'%',`ปิดได้ ${wonD.length} / ปิดไม่ได้ ${lostD.length} ดีล`,{x:wr!=null&&wrP!=null?delta(wr,wrP,{points:true}):''})}${kpi('มูลค่าเฉลี่ยต่อดีลที่ปิดได้',avgW?mk(Math.round(avgW)):'-','',{x:avgW&&avgP?delta(avgW,avgP):''})}${kpi('มูลค่าที่ปิดไม่ได้',mk(sum(lostD)),`${lostD.length} ดีล`,{x:delta(sum(lostD),sum(lP),{upGood:false})})}${kpi(`ดีลไม่เคลื่อนไหว ≥ ${cfg.staleDays} วัน`,String(st.length),st.length?'ดูรายการด้านล่าง':'ไม่มี',st.length?{warn:1}:{})}</div>`}
// value per person by stage; one scale (mx) shared by all team sections so bars compare
function people(ds,reps,mx){if(!reps.length)return'<p class="mu">ยังไม่มีข้อมูล</p>';const ks=Object.keys(C);
 return reps.map(u=>{const m=ds.filter(d=>d.owner===u.id),t=sum(m);return`<div class="r2"><span>${esc(u.name)}</span><div class="sb"><div style="width:${(t/mx*100).toFixed(1)}%">${ks.map(k=>{const v=sum(m.filter(d=>d.cat===k));return v?`<i style="flex:${v} 1 0;background:${C[k][1]}" data-tt="${esc(u.name+' · '+C[k][0]+'\n฿'+fmt(v))}"></i>`:''}).join('')}</div></div><span class="mu num">${money(t)}</span></div>`}).join('')
  +`<div class="lgd2">${ks.map(k=>`<span><i style="background:${C[k][1]}"></i>${C[k][0]}</span>`).join('')}</div><small class="mu">สเกลเดียวกันทุกทีม</small>`}
function sec(title,reps,ds,team,mx){
 const cards=Object.entries(C).map(([k,[l,c]])=>{const x=ds.filter(d=>d.cat===k);return`<div class="k" style="border-top:3px solid ${c}"><span class="mu">${l}</span><b>${mk(sum(x))}</b><small class="mu">${x.length} ดีล</small></div>`}).join('');
 const wonD=ds.filter(d=>d.cat==='won'),lostD=ds.filter(d=>d.cat==='lost'),won=sum(wonD),qt=qTeam(team,M,reps),fc=fcast(ds),open=ds.filter(isOpen);
 const wr=wonD.length+lostD.length?pctN(wonD.length,wonD.length+lostD.length)+'%':'-';
 const rows=reps.map(u=>{const mine=ds.filter(d=>d.owner===u.id),w=sum(mine.filter(d=>d.cat==='won')),f=fcast(mine),uq=qUser(u.id,M);return`<div class="r"><span>${esc(u.name)}</span>${meter(w,f,uq,u.name)}<span class="mu">${money(w)} / ${money(uq)} (${pct(w,uq)}) · พยากรณ์ ${pct(f,uq)}</span></div>`}).join('');
 return`<section class="tm"><h2>${esc(title)} <small class="mu">${reps.length} คน · มูลค่าดีลรวม ${money(sum(ds))} · Win rate ${wr}</small></h2><div class="g">${cards}</div>
<div class="cg"><div class="k"><b>Pipeline ที่เปิดอยู่ ${mk(sum(open))}</b>${pbar(OPEN.map(k=>({n:C[k][0],c:C[k][1],v:sum(ds.filter(d=>d.cat===k))})),{empty:'ไม่มีดีลที่เปิดอยู่',label:'Pipeline '+title})}<small class="mu" style="margin-top:8px">ถ่วงน้ำหนัก ${mk(Math.round(fcast(open)))}</small></div><div class="k"><b>มูลค่าดีลของแต่ละคน แยกตามสถานะ</b>${people(ds,reps,mx)}</div></div>
<h3>ยอดปิดขายเทียบเป้า เดือน ${mlab(M)}</h3><div class="mtc">${meterKey()}</div><div class="r" style="font-weight:600"><span>รวมทีม</span>${meter(won,fc,qt,'ทีม '+title)}<span>${money(won)} / ${money(qt)} (${pct(won,qt)}) · พยากรณ์ ${pct(fc,qt)}</span></div>${rows||'<p class="mu">ยังไม่มีเซลส์ในทีมนี้</p>'}</section>`}
function ov(ds){const R=users.filter(isSales),ids=new Set(R.map(u=>u.id)),TT=TEAMS();
 const mx=Math.max(1,...R.map(u=>sum(ds.filter(d=>d.owner===u.id))));
 const parts=[ovTop(ds),...TT.map(t=>{const r=R.filter(u=>u.team===t);return sec(t,r,ds.filter(d=>r.some(u=>u.id===d.owner)),t,mx)})];
 const o=R.filter(u=>!TT.includes(u.team)),od=ds.filter(d=>o.some(u=>u.id===d.owner)||!ids.has(d.owner));
 if(o.length||od.length)parts.push(sec('ยังไม่ระบุทีม',o,od,'',mx));
 const sl=deals.filter(stale).sort((a,b)=>daysAgo(b.updated)-daysAgo(a.updated));
 if(sl.length)parts.push(`<section class="tm"><h2>${ico('warn')} ดีลที่ไม่มีความเคลื่อนไหว ≥ ${cfg.staleDays} วัน <small class="mu">${sl.length} ดีล · ${money(sum(sl))}</small></h2><table><tr><th>โครงการ<th>ลูกค้า<th>เซลส์<th>สถานะ<th class="num">มูลค่า<th class="num">ไม่เคลื่อนไหว<th class="num">อยู่สถานะนี้</tr>${sl.slice(0,15).map(d=>`<tr data-a="edit" data-id="${d.id}" class="stl"><td>${esc(d.title)}<td>${esc(d.company)}<td>${esc(nm(d.owner))}<td>${tag(d.cat)}<td class="num">฿${fmt(val(d))}<td class="num">${daysAgo(d.updated)} วัน<td class="num">${since(d)} วัน</tr>`).join('')}</table></section>`);
 return parts.join('')}
// status tag: coloured dot + text in ink colour (legible in both themes)
const tag=k=>`<span class="tg">${dot(C[k][1])}${C[k][0]}</span>`;
const card=d=>`<div class="cd${stale(d)?' stl':''}" draggable="${can(d)}" data-id="${d.id}" data-a="edit"><b>${esc(d.title)}</b><div class="mu">${esc(d.company)}</div><div>฿${fmt(val(d))}${(d.files||[]).length?` <small class="mu" title="ไฟล์แนบ">${ico('clip')}${d.files.length}${vh(' ไฟล์แนบ')}</small>`:''}</div><small class="mu">${esc(nm(d.owner))}</small>${age(d)}</div>`;
let plStage='';
function pl(ds){const ks=Object.keys(C);if(!ks.includes(plStage))plStage=ks.find(k=>ds.some(d=>d.cat===k))||'c80';
 return`<div class="seg plseg" role="tablist" aria-label="สถานะดีล">${ks.map(k=>`<button type="button" role="tab" aria-selected="${plStage===k}" data-a="plStage" data-k="${k}">${dot(C[k][1])} ${C[k][0]} <small>(${ds.filter(d=>d.cat===k).length})</small></button>`).join('')}</div><div class="kb">${ks.map(k=>{const [l,c]=C[k],x=ds.filter(d=>d.cat===k);return`<div class="col${plStage===k?' on':''}" data-k="${k}" style="border-top-color:${c}"><h4>${dot(c)}${l} <small class="mu">(${x.length})</small></h4><small class="mu">฿${fmt(sum(x))}${k==='won'||k==='lost'?'':` · ถ่วงน้ำหนัก ฿${fmt(fcast(x))}`}</small>${x.length?x.map(card).join(''):'<p class="mu" style="margin:14px 0 0;text-align:center">ไม่มีดีล</p>'}</div>`}).join('')}</div><p class="mu plhint">ลากการ์ดเพื่อเปลี่ยนสถานะ หรือเปิดการ์ดแล้วเลือกสถานะใหม่</p>`}

let alRows=[];
function al(ds){const x=ds.filter(d=>(!rf||d.owner===rf)&&(!tf||users.some(u=>u.id===d.owner&&u.team===tf))&&(d.title+d.company+nm(d.owner)).toLowerCase().includes(q.toLowerCase()));alRows=x;
 return`<div class="flt"><label>ทีม <select id="tf"><option value="">ทุกทีม</option>${TEAMS().map(t=>`<option ${tf===t?'selected':''}>${esc(t)}</option>`).join('')}</select></label><label>เซลส์ <select id="rf"><option value="">ทั้งหมด</option>${users.filter(u=>!['viewer','spec'].includes(u.role)&&(!tf||u.team===tf)).map(u=>`<option value="${u.id}" ${rf===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label><label class="grow">${vh('ค้นหา')}<input id="q" type="search" placeholder="ค้นหาโครงการ ลูกค้า หรือเซลส์" value="${esc(q)}"></label><span class="sp"></span>${csvBtn('al')}</div><p class="mu">${x.length} ดีล รวม ฿${fmt(sum(x))} · พยากรณ์ถ่วงน้ำหนัก ฿${fmt(Math.round(fcast(x)))}</p>${x.length?'':empty('inbox',q||rf||tf?'ไม่พบดีลที่ตรงกับตัวกรอง':'ยังไม่มีดีลในเดือนนี้',['viewer','spec'].includes(me.role)?'':`<button class="b" data-a="new">${ico('plus')} ดีลใหม่</button>`)}${x.length?'':'<!--'}<table><tr><th>โครงการ<th>ลูกค้า<th>เซลส์<th>สถานะ<th class="num">มูลค่า<th>คาดว่าปิด<th>อายุสถานะ<th>หมายเหตุ<th>${vh('สิทธิ์แก้ไข')}</tr>${x.map(d=>`<tr data-a="edit" data-id="${d.id}" class="${stale(d)?'stl':''}"><td>${esc(d.title)}<td>${esc(d.company)}${d.customer?` <small class="mu" title="เชื่อมกับข้อมูลลูกค้าแล้ว">${ico('link')}${vh('เชื่อมกับข้อมูลลูกค้าแล้ว')}</small>`:''}<td>${esc(nm(d.owner))}<td>${tag(d.cat)}<td class="num">฿${fmt(val(d))}<td>${d.expectedClose?thD(d.expectedClose):''}<td>${age(d)}<td>${esc(d.note)}${(d.files||[]).length?` <small class="mu">${ico('clip')}${d.files.length}${vh(' ไฟล์แนบ')}</small>`:''}<td class="lk">${can(d)?'':ico('lock')+vh('แก้ไขไม่ได้')}</tr>`).join('')}</table>${x.length?'':'-->'}`}

// ===== analytics tab =========================================================
let anLB=[],anP='12';
// one filter row scopes every tile and chart on this tab: period preset + end month + team
const winM=()=>anP==='ytd'?months(M,+M.slice(5,7)):months(M,+anP);
function an(){const ms=winM(),N=ms.length,per=anP==='ytd'?'ตั้งแต่ต้นปี':N+' เดือน',TT=TEAMS(),R=users.filter(isSales),RS=anTeam?R.filter(u=>u.team===anTeam):R,ids=new Set(RS.map(u=>u.id));
 const inScope=d=>anTeam?ids.has(d.owner):true;
 const D=deals.filter(inScope);
 // closed-won per month (server view, falls back to client data)
 const wonBy={};if(aggWon)aggWon.forEach(r=>{if(!anTeam||ids.has(r.owner))wonBy[r.month]=(wonBy[r.month]||0)+(+r.won||0)});
 else D.filter(d=>d.cat==='won').forEach(d=>{const m=d.closedMonth||d.month;wonBy[m]=(wonBy[m]||0)+val(d)});
 const quotaM=m=>anTeam?qTeam(anTeam,m,RS):qAll(m);
 const wonS=ms.map(m=>wonBy[m]||0),qS=ms.map(quotaM),wonT=wonS.reduce((a,b)=>a+b,0),qT=qS.reduce((a,b)=>a+b,0);
 const y=M.slice(0,4),ytd=months(M,+M.slice(5,7)),wonY=ytd.reduce((s,m)=>s+(wonBy[m]||0),0),qY=ytd.reduce((s,m)=>s+quotaM(m),0);
 // pipeline at month end from snapshots
 const sn=snaps.filter(s=>anTeam?(s.team===anTeam||ids.has(s.owner)):true),have=new Set(sn.map(s=>s.month));
 const pipeS=k=>ms.map(m=>sn.filter(s=>s.month===m&&s.cat===k).reduce((a,s)=>a+(+s.value||0),0));
 // months before the first deal was entered cannot be reconstructed -> not "missing"
 const first=deals.reduce((a,d)=>{const m=dayOf(d.created).slice(0,7);return!a||m<a?m:a},'');
 const missing=first?ms.filter(m=>m>=first&&!have.has(m)&&m<=nowM()):[];
 // funnel & cycle from deal_events (deals created in the window)
 const start=ms[0]+'-01',inWin=d=>dayOf(d.created)>=start;
 const created=D.filter(inWin),reached=k=>created.filter(d=>(evBy[d.id]||[]).some(e=>e.to===k)||d.cat===k);
 const nWon=reached('won').length,nLost=reached('lost').length,n100=created.filter(d=>(evBy[d.id]||[]).some(e=>e.to==='c100'||e.to==='won')||d.cat==='c100'||d.cat==='won').length;
 const cyc=[],stay={c80:[],c100:[],pending:[]};
 D.forEach(d=>{const L=evBy[d.id]||[];for(let i=1;i<L.length;i++){const k=L[i].from,dd=(pd(L[i].created)-pd(L[i-1].created))/864e5;if(stay[k])stay[k].push(dd)}
  const w=L.find(e=>e.to==='won');if(w&&inWin(d))cyc.push((pd(w.created)-pd(d.created))/864e5)});
 // win/loss and product mix (closed in the window)
 const closed=D.filter(d=>(d.cat==='won'||d.cat==='lost')&&ms.includes(d.closedMonth||d.month)),lost=closed.filter(d=>d.cat==='lost'),wonW=closed.filter(d=>d.cat==='won');
 const grp=(arr,key)=>{const g={};arr.forEach(d=>{const k=key(d)||'ไม่ระบุ';(g[k]=g[k]||[]).push(d)});return Object.entries(g).map(([label,a])=>({label,value:sum(a),sub:a.length+' ดีล'})).sort((a,b)=>b.value-a.value)};
 const inst=wonW.reduce((s,d)=>s+(+d.install||0),0);
 // visits: total per month (one series) + type mix (documented categorical slots 1-4 + grey "other")
 const yr=yrep.filter(r=>(!anTeam||ids.has(r.owner))&&ms.includes(r.date.slice(0,7)));
 const VK=Object.keys(VT),VC=['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--other)'];
 const vTot=ms.map(m=>yr.filter(r=>r.date.startsWith(m)).length),vMix=VK.map((k,i)=>({n:VT[k],c:VC[i],v:yr.filter(r=>(r.visitType||'visit')===k).length}));
 const oc=Object.keys(OC).filter(k=>k!=='none').map(k=>({label:OC[k],value:yr.filter(r=>r.outcome===k).length}));
 // leaderboard
 const lb=RS.map(u=>{const mine=D.filter(d=>d.owner===u.id),cw=mine.filter(d=>d.cat==='won'&&ms.includes(d.closedMonth||d.month)),cl=mine.filter(d=>d.cat==='lost'&&ms.includes(d.closedMonth||d.month)),w=sum(cw),qq=ms.reduce((s,m)=>s+qUser(u.id,m),0),v=yr.filter(r=>r.owner===u.id).length;
  const seeV=viewAll()||u.id===me.id;   // reports of others are not readable for Sales/Spec
  return{u,w,qq,att:pctN(w,qq),wr:cw.length+cl.length?pctN(cw.length,cw.length+cl.length):null,avgW:cw.length?w/cw.length:0,open:sum(mine.filter(isOpen)),fc:fcast(mine.filter(inM)),visits:seeV?v:'-',vpw:seeV&&cw.length?(v/cw.length).toFixed(1):'-',stale:mine.filter(stale).length}}).sort((a,b)=>b.w-a.w);
 anLB=lb;
 const conv=(a,b)=>b?pctN(a,b)+'% ของขั้นก่อน':'';
 return`<div class="flt noprint"><label>ช่วงเวลา <select id="anP">${[['3','3 เดือน'],['6','6 เดือน'],['12','12 เดือน'],['ytd','ตั้งแต่ต้นปี']].map(([v,l])=>`<option value="${v}" ${anP===v?'selected':''}>${l}</option>`).join('')}</select></label><span class="fl">ถึงเดือน ${mPick('mo',M,'ถึงเดือน')}</span><label>ทีม <select id="anTeam"><option value="">ทุกทีม</option>${TT.map(t=>`<option ${anTeam===t?'selected':''}>${esc(t)}</option>`).join('')}</select></label><button type="button" class="b gh" data-a="anReload">${ico('refresh')} โหลดใหม่</button><span class="mu">${mlab(ms[0])} – ${mlab(ms[N-1])}</span></div>
<div class="g">${kpi('ปิดขายได้ตั้งแต่ต้นปี '+y,mk(wonY),qY?`${pct(wonY,qY)} ของเป้า ${money(qY)}`:'ยังไม่ได้ตั้งเป้า',{c:'var(--st-won)'})}${kpi('ปิดขายได้ '+per,mk(wonT),(qT?`${pct(wonT,qT)} ของเป้า · `:'')+'เฉลี่ย '+money(Math.round(wonT/N))+' / เดือน')}${kpi('Win rate (ดีลที่ปิดในช่วงนี้)',wonW.length+lost.length?pctN(wonW.length,wonW.length+lost.length)+'%':'-',`ปิดได้ ${wonW.length} / ปิดไม่ได้ ${lost.length}`)}${kpi('รอบการขายเฉลี่ย',cyc.length?Math.round(avg(cyc))+' วัน':'-',cyc.length?'มัธยฐาน '+Math.round(median(cyc))+' วัน':'ต้องมีประวัติสถานะ')}${kpi('Pipeline เปิดอยู่ตอนนี้',mk(sum(D.filter(isOpen))),'ถ่วงน้ำหนัก '+money(Math.round(fcast(D.filter(isOpen)))))}</div>
<section class="tm">${fig('an-won','ยอดปิดขายรายเดือนเทียบเป้า',{labels:ms.map(mlab),series:[{name:'ปิดขายแล้ว',color:'var(--st-won)',data:wonS}],line:{name:'เป้า',color:'var(--target)',data:qS,dash:1}})}</section>
<section class="tm">${fig('an-pipe','Pipeline ณ สิ้นเดือน <small class="mu">จาก snapshot</small>',{labels:ms.map(mlab),series:['c100','c80','pending'].map(k=>({name:C[k][0],color:C[k][1],data:pipeS(k)}))})}${missing.length?`<p class="mu">ไม่มี snapshot ของ ${missing.map(mlab).join(', ')} ${dir()?`<button class="b gh" data-a="snapFill">สร้าง snapshot ย้อนหลัง</button> <small>(สร้างจากประวัติสถานะ ดีลที่ไม่มีประวัติใช้สถานะปัจจุบัน)</small>`:'(Director สร้างย้อนหลังได้)'}</p>`:''}${snapMsg?`<p class="mu">${esc(snapMsg)}</p>`:''}</section>
<div class="cg2"><section class="tm"><h3>Funnel ของดีลที่สร้างใน${per==='ตั้งแต่ต้นปี'?'ปีนี้':' '+per}</h3>${hbars([{label:'สร้างดีล',value:created.length,color:'var(--st-pending)'},{label:'ถึง Commit 100%',value:n100,color:'var(--st-c80)',sub:conv(n100,created.length)},{label:'ปิดขายได้',value:nWon,color:'var(--st-c100)',sub:conv(nWon,n100)}],v=>v+' ดีล')}<h3>ผลลัพธ์ของดีลเหล่านี้</h3>${pbar([{n:'ปิดขายได้',c:'var(--st-won)',v:nWon},{n:'ปิดไม่ได้',c:'var(--st-lost)',v:nLost},{n:'ยังเปิดอยู่',c:'var(--other)',v:Math.max(0,created.length-nWon-nLost)}],{money:false,label:'ผลลัพธ์ของดีล'})}<h3>จำนวนวันเฉลี่ยในแต่ละสถานะ</h3>${hbars(OPEN.map(k=>({label:C[k][0],value:Math.round(avg(stay[k])),sub:stay[k].length+' ครั้ง'})),v=>v+' วัน')}</section>
<section class="tm"><h3>เหตุผลที่ปิดไม่ได้ (${per})</h3>${hbars(grp(lost,d=>d.lostReason))}<h3>ยอดปิดได้ตามกลุ่มสินค้า (${per})</h3>${hbars(grp(wonW,d=>d.productLine))}<p class="mu">สัดส่วนค่าติดตั้งในยอดปิดได้: ${pct(inst,sum(wonW))}</p></section></div>
<section class="tm">${fig('an-vis',`จำนวนการเข้าพบรายเดือน${viewAll()?'':' <small class="mu">เฉพาะของคุณ</small>'}`,{labels:ms.map(mlab),series:[{name:'เข้าพบ',color:'var(--s1)',data:vTot}],money:false,h:200})}<h3>ประเภทการติดต่อ (${per})</h3>${pbar(vMix,{money:false,label:'ประเภทการติดต่อ'})}<h3>ผลการเข้าพบ (${per})</h3>${hbars(oc,v=>v+' ครั้ง')}</section>
<section class="tm"><h3>ตารางผลงานรายบุคคล (${per}) ${csvBtn('lb')}</h3><div style="overflow-x:auto"><table><tr><th>เซลส์<th>ทีม<th class="num">ปิดได้<th class="num">เป้า<th class="num">% เป้า<th class="num">Win rate<th class="num">เฉลี่ย/ดีล<th class="num">Pipeline เปิด<th class="num">พยากรณ์เดือนนี้<th class="num">เข้าพบ<th class="num">เข้าพบ/ดีลที่ได้<th class="num">ดีลค้าง</tr>${lb.map(r=>`<tr><td>${esc(r.u.name)}<td>${esc(r.u.team||'-')}<td class="num">฿${fmt(r.w)}<td class="num">฿${fmt(r.qq)}<td class="num">${r.qq?r.att+'%':'-'}<td class="num">${r.wr==null?'-':r.wr+'%'}<td class="num">${r.avgW?'฿'+fmt(Math.round(r.avgW)):'-'}<td class="num">฿${fmt(r.open)}<td class="num">฿${fmt(Math.round(r.fc))}<td class="num">${r.visits}<td class="num">${r.vpw}<td class="num">${r.stale?ico('warn')+' '+r.stale:''}</tr>`).join('')}</table></div></section>`}

// ===== customers tab =========================================================
function custAgg(){const m={};
 if(aggCust)aggCust.forEach(r=>m[r.id]={won:+r.won||0,pipeline:+r.pipeline||0,deals:+r.deals||0,lastWon:r.lastWon||''});
 else customers.forEach(c=>{const ds=deals.filter(d=>d.customer===c.id);m[c.id]={won:sum(ds.filter(d=>d.cat==='won')),pipeline:sum(ds.filter(isOpen)),deals:ds.length,lastWon:ds.filter(d=>d.cat==='won').map(d=>d.closedMonth).sort().pop()||''}});
 return m}
let cuRows=[];
function cu(){if(cuMerge)return cuMergeView();if(cuSel)return cu360();
 const A=custAgg(),provs=[...new Set(customers.map(c=>c.province).filter(Boolean))].sort();
 const x=customers.filter(c=>(!cuProv||c.province===cuProv)&&(c.name+' '+(c.province||'')+' '+(c.phone||'')).toLowerCase().includes(cuQ.toLowerCase())).map(c=>({c,a:A[c.id]||{won:0,pipeline:0,deals:0,lastWon:''}})).sort((p,q)=>q.a.won-p.a.won||q.a.pipeline-p.a.pipeline||p.c.name.localeCompare(q.c.name));cuRows=x;
 const unl=deals.filter(d=>!d.customer&&normKey(d.company)).length,top=x.filter(r=>r.a.won>0).slice(0,10);
 return`<div class="flt"><label class="grow">${vh('ค้นหา')}<input id="cuQ" type="search" placeholder="ค้นหาลูกค้า จังหวัด เบอร์โทร" value="${esc(cuQ)}"></label><label>จังหวัด <select id="cuProv"><option value="">ทั้งหมด</option>${provs.map(p=>`<option ${cuProv===p?'selected':''}>${esc(p)}</option>`).join('')}</select></label>${writer()||dir()?`<button class="b" data-a="cuNew">${ico('plus')} เพิ่มลูกค้า</button>`:''}${dir()?`<button type="button" class="b gh" data-a="cuMerge">รวมชื่อลูกค้า${unl?` (${unl})`:''}</button>`:''}<span class="sp"></span>${csvBtn('cu')}</div>
${unl&&dir()?`<p class="mu">มีดีล ${unl} รายการที่ยังไม่ได้เชื่อมกับข้อมูลลูกค้า ใช้ "รวมชื่อลูกค้า" เพื่อจับคู่ชื่อที่สะกดต่างกัน</p>`:''}
${top.length?`<section class="tm"><h3>ลูกค้า 10 อันดับแรกตามยอดปิดได้</h3>${hbars(top.map(r=>({label:r.c.name,value:r.a.won,color:'var(--s1)',sub:r.a.deals+' ดีล'})))}</section>`:''}
<p class="mu">${x.length} ลูกค้า</p>${x.length?'':empty('people',customers.length?'ไม่พบลูกค้าที่ค้นหา':'ยังไม่มีข้อมูลลูกค้า ลูกค้าจะถูกเพิ่มอัตโนมัติเมื่อบันทึกดีลหรือรายงานเข้าพบ',writer()||dir()?`<button class="b" data-a="cuNew">${ico('plus')} เพิ่มลูกค้า</button>`:'')}${x.length?'':'<!--'}<table><tr><th>ลูกค้า<th>จังหวัด<th>ประเภท<th class="num">ปิดได้<th class="num">Pipeline<th class="num">ดีล<th>ปิดล่าสุด</tr>${x.map(({c,a})=>`<tr data-a="cuOpen" data-id="${c.id}"><td>${esc(c.name)}<td>${esc(c.province)}<td>${esc(CT[c.type]||'')}<td class="num">${a.won?'฿'+fmt(a.won):''}<td class="num">${a.pipeline?'฿'+fmt(a.pipeline):''}<td class="num">${a.deals||''}<td>${a.lastWon?mlab(a.lastWon):''}</tr>`).join('')}</table>${x.length?'':'-->'}`}
async function cuLoad(id){cuData[id]={loading:1};busy(1);await fileToken();const f=pb.filter('customer = {:c}',{c:id});
 const[rs,sp]=await Promise.all([pb.collection('reports').getFullList({filter:f,sort:'-date'}).catch(()=>[]),pb.collection('specrep').getFullList({filter:f}).catch(()=>[])]);
 let cm=[];if(rs.length){try{cm=await pb.collection('rcomments').getFullList({filter:rs.slice(0,80).map(r=>pb.filter('report = {:r}',{r:r.id})).join(' || ')})}catch{cm=[]}}
 cuData[id]={rs,sp,cm};busy(0);render()}
function cu360(){const c=customers.find(x=>x.id===cuSel);if(!c){cuSel='';return cu()}
 const d=cuData[c.id];if(!d){cuLoad(c.id);return'<p class="mu">กำลังโหลด...</p>'}if(d.loading)return'<p class="mu">กำลังโหลด...</p>';
 const ds=deals.filter(x=>x.customer===c.id).sort((a,b)=>a.created<b.created?1:-1),w=ds.filter(x=>x.cat==='won'),l=ds.filter(x=>x.cat==='lost');
 const ed=dir()||c.createdBy===me.id;
 const tl=[...ds.flatMap(x=>(evBy[x.id]||[]).map(e=>({t:e.created,txt:`${esc(x.title)}: ${e.from?C[e.from]?.[0]||esc(e.from):'สร้างดีล'} → ${C[e.to]?.[0]||esc(e.to)}`,by:e.by}))),...d.rs.map(r=>({t:r.date+' 00:00:00Z',txt:`${VT[r.visitType]||'เข้าพบ'}: ${esc((r.project||r.detail||'').slice(0,80))}`,by:nm(r.owner)}))].sort((a,b)=>a.t<b.t?1:-1).slice(0,40);
 const docs=ds.flatMap(x=>(x.files||[]).map(f=>`<span class="fi"><a href="${furl('deals',x,f)}" target="_blank" rel="noopener">${esc(fname(f))}</a> <small class="mu">${esc(x.title)}</small></span>`));
 return`<p><button type="button" class="lnk" data-a="cuBack">${ico('chevL')} กลับไปรายชื่อลูกค้า</button></p><h2 style="margin:6px 0">${esc(c.name)} <small class="mu">${esc(CT[c.type]||'')}${c.province?' · '+esc(c.province):''}</small></h2><p class="mu">${c.phone?ico('phone')+' '+esc(c.phone)+' · ':''}${esc(c.note||'')} ${ed?`<button type="button" class="lnk sm" data-a="cuEdit">${ico('edit')} แก้ไข</button>`:''}</p>
<div class="g">${kpi('ปิดได้',mk(sum(w)),w.length+' ดีล',{c:'var(--st-won)'})}${kpi('Pipeline เปิด','฿'+fmt(sum(ds.filter(isOpen))),'ถ่วงน้ำหนัก ฿'+fmt(fcast(ds.filter(isOpen))),{c:'var(--s1)'})}${kpi('Win rate',w.length+l.length?pctN(w.length,w.length+l.length)+'%':'-',`ปิดไม่ได้ ${l.length} ดีล`)}${kpi('เข้าพบ',String(d.rs.length),d.rs[0]?'ล่าสุด '+thD(d.rs[0].date):'')}</div>
<section class="tm"><h3>ดีล</h3>${ds.length?`<table><tr><th>โครงการ<th>เซลส์<th>สถานะ<th class="num">มูลค่า<th>เดือน</tr>${ds.map(x=>`<tr data-a="edit" data-id="${x.id}"><td>${esc(x.title)}<td>${esc(nm(x.owner))}<td>${tag(x.cat)}<td class="num">฿${fmt(val(x))}<td>${esc(x.closedMonth||x.month)}</tr>`).join('')}</table>`:'<p class="mu">ยังไม่มีดีลที่เชื่อมกับลูกค้านี้</p>'}</section>
<section class="tm"><h3>การเข้าพบ</h3>${d.rs.length?`<table class="wt"><tr><th>วันที่<th>เซลส์<th>ประเภท<th>ผล<th>รายละเอียด</tr>${d.rs.map(r=>`<tr data-a="wopen2" data-id="${r.id}"><td>${thD(r.date)}<td>${esc(nm(r.owner))}<td>${esc(VT[r.visitType]||'')}<td>${esc(OC[r.outcome]||'')}<td>${esc(r.detail).replace(/\n/g,'<br>')}${(r.photos||[]).length?`<div class="ph" style="margin-top:6px">${r.photos.slice(0,6).map(f=>`<img src="${furl('reports',r,f,{thumb:'200x200f'})}" alt="" loading="lazy" style="width:64px;height:64px">`).join('')}</div>`:''}${d.cm.filter(x=>x.report===r.id).map(x=>`<div class="cm"><b>${esc(x.by)}:</b> ${esc(x.txt)}</div>`).join('')}</tr>`).join('')}</table>`:'<p class="mu">ยังไม่มีรายงานการเข้าพบที่เชื่อมกับลูกค้านี้</p>'}</section>
${d.sp.length?`<section class="tm"><h3>Sales Spec Report</h3><table><tr><th>วันที่<th>โครงการ<th>สถานะ<th>ผู้ดูแล<th>ตร.ม.<th>สินค้า</tr>${d.sp.map(r=>`<tr><td>${fD(r.date)}<td>${esc(r.project)}<td>${esc(r.status)}<td>${esc(r.owner)}<td>${r.sqm?fmt(r.sqm):''}<td>${esc(r.product)}</tr>`).join('')}</table></section>`:''}
${docs.length?`<section class="tm"><h3>เอกสาร</h3><div class="att"><div class="fl">${docs.join('')}</div></div></section>`:''}
<section class="tm"><h3>ไทม์ไลน์</h3>${tl.length?tl.map(e=>`<div class="tl"><small class="mu">${pd(e.t).toLocaleDateString('th-TH')} · ${esc(e.by||'')}</small><div>${e.txt}</div></div>`).join(''):'<p class="mu">ยังไม่มีกิจกรรม</p>'}</section>`}
function cdlg(c){const e=!!c;c=c||{type:'owner'};const ed=!e||dir()||c.createdBy===me.id;const dis=ed?'':'disabled';
 $('#dlg').innerHTML=`<h3>${e?'ข้อมูลลูกค้า':'ลูกค้าใหม่'}</h3><div class="f2"><label>${req('ชื่อลูกค้า / บริษัท')}<input id="cn" value="${esc(c.name)}" ${dis}></label><label>จังหวัด<input id="cp" value="${esc(c.province)}" ${dis}></label><label>ประเภท<select id="ct" ${dis}>${Object.entries(CT).map(([k,l])=>`<option value="${k}" ${c.type===k?'selected':''}>${l}</option>`).join('')}</select></label><label>เบอร์โทร<input id="cph" value="${esc(c.phone)}" ${dis}></label></div><label class="mu" style="display:block;margin-top:10px">หมายเหตุ<textarea id="cno" rows="3" ${dis}>${esc(c.note)}</textarea></label><div class="er" id="fe"></div><div class="ft">${e&&dir()?`<button class="b rd" data-a="cuDel" data-id="${c.id}">ลบ</button>`:''}<button class="b gh" data-a="close">ปิด</button>${ed?`<button class="b" data-a="cuSave" data-id="${c.id||''}">บันทึก</button>`:''}</div>`;
 showDlg()}
async function cuSave(id){const g=s=>$(s).value.trim();clearErr();if(!g('#cn')){fieldErr('#cn','กรอกชื่อลูกค้า');return}
 const data={name:g('#cn'),province:g('#cp'),type:g('#ct'),phone:g('#cph'),note:g('#cno')};
 try{if(id)await pb.collection('customers').update(id,data);else await pb.collection('customers').create(data);$('#dlg').close()}catch(e){$('#fe').textContent=/nameKey/.test(emsg(e))?'มีลูกค้าชื่อนี้อยู่แล้ว':'บันทึกไม่ได้ ('+emsg(e)+')'}}
// Director: group unlinked free-text names and link them to the customer master
async function cuMergeLoad(){cuMerge={loading:1};busy(1);render();
 const f=pb.filter('customer = {:e}',{e:''});
 const[rs,sp]=await Promise.all([pb.collection('reports').getFullList({filter:f,fields:'id,company'}).catch(()=>[]),pb.collection('specrep').getFullList({filter:f,fields:'id,company'}).catch(()=>[])]);
 const g={};[...deals.filter(d=>!d.customer).map(d=>['ดีล',d.company]),...rs.map(r=>['รายงาน',r.company]),...sp.map(r=>['Spec',r.company])].forEach(([src,name])=>{const k=normKey(name);if(!k)return;const x=g[k]||(g[k]={key:k,names:{},n:0,src:{}});const t=String(name).trim();x.names[t]=(x.names[t]||0)+1;x.n++;x.src[src]=(x.src[src]||0)+1});
 cuMerge={groups:Object.values(g).sort((a,b)=>b.n-a.n)};busy(0);render()}
function cuMergeView(){if(cuMerge.loading)return'<p class="mu">กำลังรวบรวมชื่อลูกค้า...</p>';
 const G=cuMerge.groups;return`<p><button type="button" class="lnk" data-a="cuBack">${ico('chevL')} กลับไปรายชื่อลูกค้า</button></p><h2>รวมชื่อลูกค้า</h2><p class="mu">ชื่อลูกค้าที่พิมพ์ไว้ในดีล รายงาน และ Spec Report ที่ยังไม่ได้เชื่อมกับข้อมูลลูกค้า จัดกลุ่มตามชื่อที่ตัดคำว่า บริษัท/จำกัด/Co.,Ltd. ออกแล้ว</p>${custList()}${G.length?`<table><tr><th>ชื่อที่พบ<th>จำนวน<th>เชื่อมกับลูกค้า</tr>${G.map((x,i)=>{const ex=customers.find(c=>c.nameKey===x.key),best=Object.entries(x.names).sort((a,b)=>b[1]-a[1])[0][0];return`<tr><td>${Object.keys(x.names).map(esc).join('<br>')}<td>${x.n} <small class="mu">${Object.entries(x.src).map(([k,v])=>k+' '+v).join(', ')}</small><td>${ex?`<button class="b" data-a="cuLink" data-i="${i}" data-c="${ex.id}">เชื่อมกับ "${esc(ex.name)}"</button>`:`<input id="cm${i}" list="cul" value="${esc(best)}" style="max-width:260px"> <button class="b" data-a="cuLink" data-i="${i}">เชื่อม / สร้างใหม่</button>`}</tr>`}).join('')}</table>`:'<p class="mu">ทุกรายการเชื่อมกับข้อมูลลูกค้าแล้ว</p>'}<div class="er" id="fe"></div>`}
async function cuLink(i,cid){const x=cuMerge.groups[+i];if(!x)return;
 try{if(!cid){const name=$('#cm'+i).value.trim();cid=await linkCust(name,true);if(!cid)throw new Error('สร้างลูกค้าไม่ได้')}
  const r=await pb.send('/api/crm/link-customer',{method:'POST',body:{customer:cid,company:Object.keys(x.names)[0]}});
  cuData={};await cuMergeLoad();const m=$('#fe');if(m)m.textContent='เชื่อมแล้ว '+r.linked+' รายการ'}catch(e){const m=$('#fe');if(m)m.textContent=emsg(e)}}

// ===== team tab ==============================================================
const tsel=u=>!['rep','am','spec'].includes(u.role)?'-':dir()?`<select data-t="${u.id}" aria-label="ทีมของ ${esc(u.name)}" style="width:120px"><option value="">ยังไม่ระบุ</option>${TEAMS().map(t=>`<option ${u.team===t?'selected':''}>${esc(t)}</option>`).join('')}</select>`:esc(u.team||'-');
let tmTab='users';
function usersPanel(){return`<table><tr><th>ชื่อ<th>อีเมล (Google)<th>ตำแหน่ง<th>ทีม<th>เป้าตั้งต้นต่อเดือน<th>${vh('การจัดการ')}</tr>${users.map(u=>`<tr><td>${esc(u.name)}<td>${esc(u.email||'')}<td>${RL[u.role]||u.role||'<span class="er">ยังไม่กำหนด</span>'}<td>${tsel(u)}<td>${isSales(u)?'฿'+fmt(u.quota):'-'}<td class="acts">${dir()?`<button type="button" class="lnk" data-a="uedit" data-id="${u.id}">${ico('edit')} แก้ไข</button>`+(u.id!==me.id&&u.role!=='director'?`<button type="button" class="lnk rd" data-a="udel" data-id="${u.id}">${ico('trash')} ลบ</button>`:''):''}</tr>`).join('')}</table>${dir()?`<h2>เพิ่มผู้ใช้</h2><p class="mu">ผู้ใช้จะเข้าสู่ระบบด้วยบัญชี Google ที่มีอีเมลตรงกับที่กรอกไว้</p><div class="f"><label>ตำแหน่ง<select id="rr"><option value="rep">Sales</option><option value="am">Assistant Manager</option><option value="spec">Sales Spec (ไม่มีเป้า กรอกได้เฉพาะรายงาน)</option><option value="viewer">ผู้เยี่ยมชม (ดูอย่างเดียว)</option></select></label><label>ทีม<select id="rt">${TEAMS().map(t=>`<option>${esc(t)}</option>`).join('')}</select></label><label>${req('ชื่อที่แสดง')}<input id="rn" placeholder="เช่น สมชาย"></label><label>${req('อีเมล Google')}<input id="re" type="email" placeholder="somchai@gmail.com"></label><label>เป้าต่อเดือน (เฉพาะเซลส์)<input id="rq" type="number" placeholder="0"></label><button class="b" data-a="addrep" style="align-self:end">${ico('plus')} เพิ่มผู้ใช้</button></div><div class="er" id="rm" aria-live="polite"></div>`:''}`}
function tm(){const T=[['users','ผู้ใช้'],['targets','เป้ารายเดือน'],...(dir()?[['settings','ตั้งค่า']]:[]),['data','ข้อมูล']];if(!T.some(([k])=>k===tmTab))tmTab='users';
 return`<div class="seg" role="tablist" aria-label="ทีมและเป้า">${T.map(([k,l])=>`<button type="button" role="tab" aria-selected="${tmTab===k}" data-a="tmTab" data-k="${k}">${l}</button>`).join('')}</div>${tmTab==='users'?usersPanel():tmTab==='targets'?qgrid():tmTab==='settings'?cfgPanel():healthPanel()+(dir()?opsPanel():'')}`}
function qgrid(){const ms=[...Array(12)].map((_,i)=>tmY+'-'+String(i+1).padStart(2,'0')),SU=users.filter(isSales),ed=dir();
 const cell=(uid,team,m,def)=>{const x=quotas.find(q=>(q.user||'')===uid&&(q.team||'')===team&&q.month===m);return`<td><input class="qi" type="number" min="0" step="1000" data-q="${uid}|${esc(team)}|${m}" aria-label="เป้า ${esc(uid?nm(uid):'ทีม '+team)} ${mlab(m)}" value="${x?x.amount:''}" placeholder="${fmtK(def)}" title="${x?'กำหนดเฉพาะเดือนนี้':'ใช้ค่าตั้งต้น ฿'+fmt(def)}" ${ed?'':'disabled'}></td>`};
 return`<section class="tm"><h3><label>เป้ารายเดือน ปี <select id="tmY" style="width:110px;display:inline-block">${[-1,0,1].map(o=>String(new Date().getFullYear()+o)).map(y=>`<option ${tmY===y?'selected':''}>${y}</option>`).join('')}</select></label></h3><p class="mu">ช่องว่าง = ใช้เป้าตั้งต้นของคนนั้น (ตัวเลขจาง) · แถวทีมว่าง = รวมเป้าของสมาชิก${ed?' · พิมพ์แล้วกด Enter หรือออกจากช่องเพื่อบันทึก ลบตัวเลขเพื่อกลับไปใช้ค่าตั้งต้น':''}</p><div style="overflow-x:auto"><table class="qg"><tr><th>เซลส์ / ทีม${ms.map(m=>`<th>${mlab(m)}`).join('')}</tr>${SU.map(u=>`<tr><td>${esc(u.name)}${ms.map(m=>cell(u.id,'',m,+u.quota||0)).join('')}</tr>`).join('')}${TEAMS().map(t=>`<tr class="dh"><td><b>ทีม ${esc(t)}</b>${ms.map(m=>cell('',t,m,SU.filter(u=>u.team===t).reduce((s,u)=>s+qUser(u.id,m),0))).join('')}</tr>`).join('')}</table></div><div class="er" id="qm"></div></section>`}
async function qsave(key,v){const[uid,team,m]=key.split('|'),x=quotas.find(q=>(q.user||'')===uid&&(q.team||'')===team&&q.month===m);
 try{if(v===''){if(x){await pb.collection('quotas').delete(x.id);toast('ลบเป้าเฉพาะเดือนแล้ว กลับไปใช้ค่าตั้งต้น')}return}
  const data={user:uid,team,month:m,amount:Math.max(0,+v||0)};if(x)await pb.collection('quotas').update(x.id,data);else await pb.collection('quotas').create(data);toast('บันทึกเป้าแล้ว')}
 catch(e){const el=$('#qm');if(el)el.textContent='บันทึกเป้าไม่ได้ ('+emsg(e)+')'}}
function cfgPanel(){return`<section class="tm"><h3>ตั้งค่าการวิเคราะห์</h3><div class="f2"><label>โอกาสปิดของ "รอลูกค้าพิจารณา" (%)<input id="sp1" type="number" min="0" max="100" value="${cfg.pendingProb}"></label><label>ถือว่าดีลค้าง เมื่อไม่มีความเคลื่อนไหว (วัน)<input id="sp2" type="number" min="1" max="365" value="${cfg.staleDays}"></label><label>ทีม (คั่นด้วย ,)<input id="sp3" value="${esc(TEAMS().join(', '))}"></label><label>กลุ่มสินค้า (คั่นด้วย ,)<input id="sp4" value="${esc(LIST('productLines').join(', '))}"></label></div><label class="mu" style="display:block;margin-top:10px">เหตุผลที่ปิดไม่ได้ (บรรทัดละ 1 เหตุผล)<textarea id="sp5" rows="5">${esc(LIST('lostReasons').join('\n'))}</textarea></label><div class="ft"><span class="er" id="spm"></span><button class="b" data-a="cfgSave">บันทึกการตั้งค่า</button></div></section>`}
async function cfgSave(){const sp=s=>s.split(/[,\n]/).map(x=>x.trim()).filter(Boolean);
 const data={pendingProb:Math.min(100,Math.max(0,+$('#sp1').value||0)),staleDays:Math.min(365,Math.max(1,+$('#sp2').value||14)),teams:sp($('#sp3').value),productLines:sp($('#sp4').value),lostReasons:$('#sp5').value.split('\n').map(x=>x.trim()).filter(Boolean)};
 if(!data.teams.length){$('#spm').textContent='ต้องมีอย่างน้อย 1 ทีม';return}
 try{await pb.collection('crm_settings').update(cfgId,data);toast('บันทึกการตั้งค่าแล้ว')}catch(e){$('#spm').textContent=emsg(e)}}
function healthPanel(){const h=hl;if(!h)return'<section class="tm"><h3>สุขภาพข้อมูล</h3><p class="mu">กำลังตรวจ...</p></section>';if(h.error)return`<section class="tm"><h3>สุขภาพข้อมูล</h3><p class="er">${esc(h.error)}</p></section>`;
 const row=d=>`<tr data-a="edit" data-id="${d.id}"><td>${esc(d.title)}<td>${esc(d.company)}<td>${esc(nm(d.owner)||'-')}<td>${C[d.cat]?tag(d.cat):''}<td>${d.value!=null?'฿'+fmt(d.value):''}</tr>`;
 return`<section class="tm"><h3>สุขภาพข้อมูล <button type="button" class="b gh sm" data-a="hlReload">${ico('refresh')} ตรวจใหม่</button></h3><div class="g">${kpi('ดีลค้าง ≥ '+h.staleDays+' วัน',String(h.stale.length),'',h.stale.length?{warn:1}:{})}${kpi('ดีลมูลค่า 0',String(h.zeroValue.length),'',h.zeroValue.length?{warn:1}:{})}${kpi('ดีลที่อาจซ้ำ',String(h.duplicates.length)+' กลุ่ม','',h.duplicates.length?{warn:1}:{})}${kpi('ยังไม่เชื่อมลูกค้า',String(h.unlinked.deals+h.unlinked.reports+h.unlinked.specrep),`ดีล ${h.unlinked.deals} · รายงาน ${h.unlinked.reports} · Spec ${h.unlinked.specrep}`)}${kpi('ผู้ใช้ที่ยังไม่มีทีม',String(h.usersNoTeam.length),esc(h.usersNoTeam.map(u=>u.name).join(', ')))}${kpi('ดีลที่ไม่มีเจ้าของ',String(h.noOwner.length),'เจ้าของถูกลบออกจากทีม')}</div>
${h.duplicates.length?`<details><summary>ดีลที่อาจซ้ำ (${h.duplicates.length} กลุ่ม)</summary><table>${h.duplicates.map(g=>g.map(row).join('')+'<tr><td colspan="5"></tr>').join('')}</table></details>`:''}
${h.zeroValue.length?`<details><summary>ดีลมูลค่า 0 (${h.zeroValue.length})</summary><table>${h.zeroValue.map(row).join('')}</table></details>`:''}
${h.noOwner.length?`<details><summary>ดีลที่ไม่มีเจ้าของ (${h.noOwner.length})</summary><table>${h.noOwner.map(row).join('')}</table></details>`:''}</section>`}
function opsPanel(){const ch=dgInfo?.channels;return`<section class="tm"><h3>Snapshot Pipeline</h3><p class="mu">ระบบบันทึก snapshot ของเดือนปัจจุบันทุกชั่วโมงอัตโนมัติ เดือนในอดีตสร้างย้อนหลังได้จากประวัติสถานะ</p><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">${mPick('snM',addM(nowM(),-1),'เดือนของ snapshot')}<button class="b gh" data-a="snapOne">สร้าง / อัปเดต snapshot</button><span class="mu">${esc(snapMsg)}</span></div></section>
<section class="tm"><h3>การแจ้งเตือนสรุปประจำสัปดาห์</h3>${dgInfo?.error?`<p class="er">${esc(dgInfo.error)}</p>`:ch?`<p>LINE: ${ch.line?`<b>${ico('check')} พร้อม</b>`:'<span class="mu">ยังไม่ตั้งค่า (NOTIFY_LINE_TOKEN / NOTIFY_LINE_TO)</span>'} · อีเมล: ${ch.email?`<b>${ico('check')} พร้อม</b>`:'<span class="mu">ยังไม่ตั้งค่า (SMTP_HOST ...)</span>'}</p><p class="mu">ส่งอัตโนมัติทุกวันจันทร์ 08:00 น. เมื่อตั้งค่าแล้ว</p><pre class="pre">${esc(dgInfo.text)}</pre><div class="ft"><span class="mu">${esc(dgMsg)}</span><button class="b gh" data-a="dgSend" ${ch.line||ch.email?'':'disabled'}>ส่งตอนนี้</button></div>`:'<p class="mu">กำลังโหลด...</p>'}</section>`}

// ===== attachments helpers ===================================================
let ftok='';
async function fileToken(){try{ftok=await pb.files.getToken()}catch{ftok=''}return ftok}
const furl=(col,rec,name,o={})=>pb.files.getURL({collectionId:col,collectionName:col,id:rec.id},name,{...o,token:ftok});
const fname=n=>n.replace(/_[a-z0-9]{10}(\.[^.]+)$/i,'$1');
const fileList=(col,rec,edit)=>(rec.files||[]).length?`<div class="att"><span class="mu">ไฟล์แนบ</span><div class="fl">${rec.files.map(f=>`<span class="fi"><a href="${furl(col,rec,f)}" target="_blank" rel="noopener">${esc(fname(f))}</a>${edit?` <button type="button" class="lnk x" data-a="frm" data-col="${col}" data-id="${rec.id}" data-f="${esc(f)}" aria-label="ลบไฟล์ ${esc(fname(f))}">${ico('x')}</button>`:''}</span>`).join('')}</div></div>`:'';
const photoList=(rec,edit)=>(rec.photos||[]).length?`<div class="att"><span class="mu">รูปภาพ</span><div class="ph">${rec.photos.map(f=>`<figure><a href="${furl('reports',rec,f)}" target="_blank" rel="noopener"><img src="${furl('reports',rec,f,{thumb:'200x200f'})}" alt="${esc(fname(f))}" loading="lazy"></a>${edit?`<button type="button" class="x" data-a="prm" data-id="${rec.id}" data-f="${esc(f)}" aria-label="ลบรูป ${esc(fname(f))}">${ico('x')}</button>`:''}</figure>`).join('')}</div></div>`:'';
const pick=id=>{const i=$(id);return i&&i.files&&i.files.length?Array.from(i.files):[]};
const newCustBox=id=>writer()||dir()?`<label class="mu" style="display:flex;gap:6px;align-items:center;margin-top:6px"><input type="checkbox" id="${id}" checked style="width:auto"> เพิ่มเป็นลูกค้าใหม่ในฐานข้อมูลถ้ายังไม่มี</label>`:'';

// ===== deals =================================================================
async function open(d){const e=!!d;d=d||{cat:'c80',month:M};const ro=e&&!can(d);if(e)await fileToken();const dis=ro?'disabled':'';
 const ow=dir()?`<select id="fo">${users.filter(u=>!['viewer','spec'].includes(u.role)).map(u=>`<option value="${u.id}" ${(d.owner||me.id)===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select>`:`<input disabled value="${esc(e?nm(d.owner):me.name)}">`;
 const ev=e?(evBy[d.id]||[]):[],evh=ev.length?`<p class="mu" style="margin:10px 0 0">ประวัติสถานะ: ${ev.map((x,i)=>{const nx=ev[i+1],days=Math.round(((nx?pd(nx.created):new Date())-pd(x.created))/864e5);return`${C[x.to]?.[0]||esc(x.to)} <small>(${days} วัน)</small>`}).join(' → ')}</p>`:'';
 $('#dlg').innerHTML=`<h3>${e?'รายละเอียดดีล':'ดีลใหม่'}</h3>${custList()}<div class="f2"><label>${req('โครงการ')}<input id="ft" value="${esc(d.title)}" ${dis}></label><label>ลูกค้า<input id="fc" list="cul" value="${esc(d.company)}" ${dis}></label><label>เซลส์${ow}</label><label>เดือน<input id="fm" type="month" value="${d.month}" ${dis}></label><label>มูลค่าสินค้า<input id="fp" type="number" value="${d.product||''}" ${dis}></label><label>ค่าติดตั้ง<input id="fi" type="number" value="${d.install||''}" ${dis}></label><label>สถานะ<select id="fs" ${dis}>${Object.entries(C).map(([k,[l]])=>`<option value="${k}" ${d.cat===k?'selected':''}>${l}</option>`).join('')}</select></label><label>วันที่คาดว่าจะปิด<input id="fx" type="date" value="${d.expectedClose||''}" ${dis}></label><label>กลุ่มสินค้า<select id="fg" ${dis}><option value="">-</option>${LIST('productLines').map(p=>`<option ${d.productLine===p?'selected':''}>${esc(p)}</option>`).join('')}</select></label><label>จังหวัด<input id="fv" value="${esc(d.province)}" ${dis}></label><label id="lrw" style="${d.cat==='lost'?'':'display:none'}">เหตุผลที่ปิดไม่ได้<select id="fl" ${dis}><option value="">-</option>${LIST('lostReasons').map(p=>`<option ${d.lostReason===p?'selected':''}>${esc(p)}</option>`).join('')}</select></label><label>หมายเหตุ<input id="fn" value="${esc(d.note)}" ${dis}></label></div>${ro?'':newCustBox('fnc')}${e?fileList('deals',d,!ro):''}${ro?'':`<label class="mu" style="display:block;margin-top:10px">แนบไฟล์เอกสาร (PDF, Word, Excel, รูปภาพ – ไม่เกิน 10 MB/ไฟล์)<input id="ff" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,image/*"></label>`}${evh}${e?`<p>${(d.act||[]).slice().reverse().slice(0,6).map(a=>`<small class="mu">${new Date(a.t).toLocaleString('th-TH')} - ${esc(a.by)}: ${esc(a.txt)}</small>`).join('<br>')}</p>`:''}<div class="er" id="fe">${ro?'ดีลนี้เป็นของเซลส์คนอื่น แก้ไขไม่ได้':''}</div><div class="ft">${e&&!ro?`<button class="b rd" data-a="del" data-id="${d.id}">ลบ</button>`:''}<button class="b gh" data-a="close">ปิด</button>${ro?'':`<button class="b" data-a="save" data-id="${d.id||''}">บันทึก</button>`}</div>`;
 showDlg()}

async function save(id){const g=s=>$(s).value,o=dir()?users.find(u=>u.id===g('#fo')):me;
 const data={title:g('#ft').trim(),company:g('#fc').trim(),owner:o.id,month:g('#fm')||M,product:+g('#fp')||0,install:+g('#fi')||0,cat:g('#fs'),note:g('#fn'),expectedClose:g('#fx'),productLine:g('#fg'),province:g('#fv').trim(),lostReason:g('#fs')==='lost'?g('#fl'):''};
 clearErr();if(!data.title){fieldErr('#ft','กรอกชื่อโครงการ');return}
 const o0=deals.find(d=>d.id===id),cl=data.cat==='won'||data.cat==='lost';
 data.closedMonth=!cl?'':!o0?data.month:o0.cat!==data.cat?nowM():data.month!==o0.month?data.month:(o0.closedMonth||o0.month);
 const nf=pick('#ff');if(nf.length)data['files+']=nf;
 const btn=$('[data-a=save]');if(btn)btn.disabled=true;
 try{data.customer=await linkCust(data.company,$('#fnc')?.checked);
  if(!data.province&&data.customer)data.province=customers.find(c=>c.id===data.customer)?.province||'';
  if(id){const old=deals.find(d=>d.id===id);await pb.collection('deals').update(id,{...data,act:[...(old?.act||[]),log(old&&old.cat!==data.cat?'เปลี่ยนสถานะเป็น '+C[data.cat][0]:nf.length?'แก้ไขข้อมูล / แนบไฟล์':'แก้ไขข้อมูล')]})}
  else await pb.collection('deals').create({...data,act:[log('สร้างดีล')]});
  $('#dlg').close()}catch(e){$('#fe').textContent='บันทึกไม่ได้ ('+emsg(e)+')';if(btn)btn.disabled=false}}
async function fileRemove(col,id,f){try{await pb.collection(col).update(id,{[col==='reports'?'photos-':'files-']:[f]});const r=await pb.collection(col).getOne(id);if(col==='deals')open(r);else wdlg(r)}catch(e){$('#fe').textContent='ลบไฟล์ไม่ได้ ('+emsg(e)+')'}}

async function addRep(){const g=s=>$(s).value.trim();const em=g('#re').toLowerCase();clearErr('main');if(!g('#rn')){fieldErr('#rn','กรอกชื่อที่แสดง');return}if(!em||!em.includes('@')){fieldErr('#re','กรอกอีเมล Google ให้ถูกต้อง');return}
 const role=g('#rr'),pw=randPw();
 try{await pb.collection('users').create({email:em,emailVisibility:true,password:pw,passwordConfirm:pw,name:g('#rn'),role,quota:['rep','am'].includes(role)?+g('#rq')||0:0,team:role==='viewer'?'':g('#rt')});
 $('#rn').value='';$('#re').value='';$('#rq').value='';$('#rm').textContent='';toast('เพิ่มผู้ใช้แล้ว')}catch(e){$('#rm').textContent='เพิ่มไม่ได้ ('+emsg(e)+')'}}

// ===== weekly report =========================================================
function subW(){reports=[];rcom=[];wplans=[];if(!me)return;
 const own=!viewAll(),f=own?`week = "${W}" && owner = "${me.id}"`:`week = "${W}"`,t=r=>r.week===W&&(!own||r.owner===me.id),er=x=>{werr=emsg(x);render()};werr='';
 watch('reports',{filter:f,test:t},L=>{werr='';reports=L;render()}).catch(er);
 watch('rcomments',{filter:f,test:t},L=>{rcom=L;render()}).catch(er);loadWP()}
// shared week navigation bar (weekly report and digest)
const weekBar=(extra='',right='')=>`<div class="flt"><button type="button" class="b gh" data-a="wprev" aria-label="สัปดาห์ก่อน">${ico('chevL')}</button><b>สัปดาห์ ${thD(W)} – ${thD(addD(W,6))}</b><button type="button" class="b gh" data-a="wnext" aria-label="สัปดาห์ถัดไป">${ico('chevR')}</button>${W===monOf()?'':`<button type="button" class="b gh sm" data-a="wnow">สัปดาห์นี้</button>`}<label class="b gh pk" title="ไปที่วันที่">${ico('cal')}${vh('ไปที่วันที่')}<input type="date" id="wd" value="${W}"></label>${extra}<span class="sp"></span>${right}</div>`;
// visits, photos, comments and plan adherence of one person in week W
function vstat(uid){const rs=reports.filter(r=>r.owner===uid),days=new Set(rs.map(r=>r.date)),ph=rs.reduce((s,r)=>s+(r.photos||[]).length,0),cm=rs.filter(r=>rcom.some(c=>c.report===r.id)).length;
 let pln=0,hit=0;wplans.filter(p=>p.owner===uid).forEach(p=>{const ents=rs.filter(r=>r.date===p.date).map(r=>normKey(custName(r.customer)||r.company)).filter(Boolean);
  (p.lines||'').split('\n').map(x=>x.trim()).filter(Boolean).forEach(l=>{pln++;const k=normKey(l);if(k&&ents.some(e=>e.includes(k)||k.includes(e)))hit++})});
 return{n:rs.length,days:days.size,ph,cm,pln,hit}}
const vsTable=uids=>`<table class="vs"><tr><th>ชื่อ<th>เข้าพบ<th>วันที่มีรายการ<th>รูป<th>มี comment<th>แผน<th>ตรงแผน</tr>${uids.map(id=>{const v=vstat(id);return`<tr><td>${esc(nm(id))}<td>${v.n}<td>${v.days}/5<td>${v.ph}<td>${v.cm}/${v.n}<td>${v.pln}<td>${v.pln?v.hit+' ('+pctN(v.hit,v.pln)+'%)':'-'}</tr>`}).join('')}</table>`;
const wrow=(r,i,all)=>{const cs=rcom.filter(c=>c.report===r.id).sort((a,b)=>a.created<b.created?-1:1);
 return`<tr data-a="wopen" data-id="${r.id}"><td>${i}<td>${esc(r.company)}${r.visitType?`<br><small class="mu">${esc(VT[r.visitType]||'')}${r.outcome&&r.outcome!=='none'?' · '+esc(OC[r.outcome]):''}</small>`:''}<td>${esc(r.tel)}<td>${esc(r.office)}<td>${esc(r.project)}<td>${esc(r.sqm)}<td>${esc(r.detail).replace(/\n/g,'<br>')}${(r.photos||[]).length?` <small class="mu" title="รูปภาพ">${ico('cam')}${r.photos.length}${vh(' รูป')}</small>`:''}${cs.map(c=>`<div class="cm"><b>${esc(c.by)}:</b> ${esc(c.txt)}</div>`).join('')}${all?`<td>${esc(nm(r.owner))}`:''}</tr>`};
function wk(){const all=viewAll(),mine=writer(),list=reports.filter(r=>!wf||r.owner===wf);
 const owners=users.filter(u=>['rep','am','spec'].includes(u.role));
 const head=weekBar(all?`<label>เซลส์ <select id="wf"><option value="">ทุกคน</option>${owners.map(u=>`<option value="${u.id}" ${wf===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select></label>`:'',csvBtn('wk'));
 const ids=all?(wf?[wf]:owners.filter(u=>reports.some(r=>r.owner===u.id)||wplans.some(p=>p.owner===u.id)).map(u=>u.id)):[me.id];
 const summ=ids.length&&(all||mine)?`<details class="vsd" ${all?'':'open'}><summary class="mu">สรุปการเข้าพบสัปดาห์นี้ (${ids.length} คน)</summary>${vsTable(ids)}<small class="mu">"ตรงแผน" = บรรทัดในแพลนเข้าพบที่มีรายการเข้าพบลูกค้าชื่อเดียวกันในวันเดียวกัน</small></details>`:'';
 const days=DN.map((dn,i)=>{const dt=addD(W,i),rows=list.filter(r=>r.date===dt).sort((a,b)=>nm(a.owner).localeCompare(nm(b.owner))||(a.created<b.created?-1:1));
  if(!rows.length&&!mine)return'';
  const pl=wplans.filter(p=>p.date===dt&&(!wf||p.owner===wf)&&(all||p.owner===me.id)),pls=pl.flatMap(p=>(p.lines||'').split('\n').map(x=>x.trim()).filter(Boolean).map(x=>(all&&!wf?nm(p.owner)+': ':'')+x));
  return`<tbody><tr class="dh"><td colspan="${all?8:7}"><b>${dn}</b> <span class="mu">${thD(dt)}</span>${mine?` &nbsp; <button type="button" class="lnk sm" data-a="wnew" data-dt="${dt}">${ico('plus')} เพิ่มรายการ</button>`:''}${pls.length?` &nbsp; <small class="mu" title="${esc(pls.join('\n'))}">แผน: ${esc(pls.slice(0,3).join(' · '))}${pls.length>3?' …':''}</small>`:''}</tr>${rows.map((r,j)=>wrow(r,j+1,all)).join('')}</tbody>`}).join('');
 return head+summ+(werr?`<p class="er">โหลดรายงานไม่ได้ (${esc(werr)})</p>`:'')+`<table class="wt"><thead><tr><th>No.<th>ลูกค้า / บริษัท<th>เบอร์โทร<th>Office & site<th>โครงการ<th>SQM.<th>รายละเอียดและความต้องการของลูกค้า${all?'<th>เซลส์':''}</tr></thead>${days}</table>${days?'':empty('doc','ไม่มีรายการเข้าพบในสัปดาห์นี้',mine?`<button class="b" data-a="wnew" data-dt="${W}">${ico('plus')} เพิ่มรายการ</button>`:'')}`}
async function wdlg(r,dt){const e=!!r;r=r||{date:dt,visitType:'visit'};const own=!e||r.owner===me.id,cw=writer()&&own,dis=cw?'':'disabled',cm=viewAll()&&e&&!own;if(e)await fileToken();
 const cs=e?(rcom.some(c=>c.report===r.id)?rcom:Object.values(cuData).flatMap(x=>x.cm||[])).filter(c=>c.report===r.id).sort((a,b)=>a.created<b.created?-1:1):[];
 $('#dlg').innerHTML=`<h3>${e?'รายการ':'รายการใหม่'} <small class="mu">${e?esc(nm(r.owner)):esc(me.name)}</small></h3>${custList()}<div class="f2"><label>${req('วันที่')}<input id="wdt" type="date" value="${r.date||''}" ${dis}></label><label>${req('ลูกค้า / บริษัท')}<input id="wc" list="cul" value="${esc(r.company)}" ${dis}></label><label>เบอร์โทร<input id="wtl" value="${esc(r.tel)}" ${dis}></label><label>Office & site building<input id="wo" value="${esc(r.office)}" ${dis}></label><label>ชื่อโครงการ<input id="wp" value="${esc(r.project)}" ${dis}></label><label>SQM.<input id="wq" value="${esc(r.sqm)}" ${dis}></label><label>ประเภทการติดต่อ<select id="wvt" ${dis}>${Object.entries(VT).map(([k,l])=>`<option value="${k}" ${(r.visitType||'visit')===k?'selected':''}>${l}</option>`).join('')}</select></label><label>ผลการเข้าพบ<select id="woc" ${dis}><option value="">-</option>${Object.entries(OC).filter(([k])=>k!=='none').map(([k,l])=>`<option value="${k}" ${r.outcome===k?'selected':''}>${l}</option>`).join('')}</select></label></div>${cw?newCustBox('wnc'):''}<label class="mu" style="display:block;margin-top:10px">รายละเอียดและความต้องการของลูกค้า<textarea id="wde" rows="5" ${dis}>${esc(r.detail)}</textarea></label>${e?photoList(r,cw):''}${cw?`<label class="mu" style="display:block;margin-top:10px">แนบรูปภาพการเข้าพบลูกค้า (JPG/PNG/WebP ไม่เกิน 5 MB/รูป สูงสุด 10 รูป)<input id="wph" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif"></label>`:''}${cs.map(c=>`<div class="cm"><b>${esc(c.by)}:</b> ${esc(c.txt)}</div>`).join('')}${cm?'<label class="mu" style="display:block;margin-top:10px">เพิ่ม comment<textarea id="wcm" rows="2"></textarea></label>':''}<div class="er" id="fe"></div><div class="ft">${cw&&e?`<button class="b rd" data-a="wdel" data-id="${r.id}">ลบ</button>`:''}<button class="b gh" data-a="close">ปิด</button>${cw?`<button class="b" data-a="wsave" data-id="${r.id||''}">บันทึก</button>`:''}${cm?`<button class="b" data-a="wcom" data-id="${r.id}">ส่ง comment</button>`:''}</div>`;
 showDlg()}
async function wsave(id){const g=s=>$(s).value.trim(),dt=$('#wdt').value;clearErr();if(!dt){fieldErr('#wdt','กรอกวันที่');return}if(!g('#wc')){fieldErr('#wc','กรอกชื่อลูกค้า / บริษัท');return}
 const data={date:dt,week:monOf(dt),company:g('#wc'),tel:g('#wtl'),office:g('#wo'),project:g('#wp'),sqm:g('#wq'),detail:g('#wde'),visitType:g('#wvt'),outcome:g('#woc')};
 const nf=pick('#wph');if(nf.length)data['photos+']=nf;
 const btn=$('[data-a=wsave]');if(btn)btn.disabled=true;
 try{data.customer=await linkCust(data.company,$('#wnc')?.checked);
  if(id)await pb.collection('reports').update(id,data);else await pb.collection('reports').create({...data,owner:me.id});
  $('#dlg').close();if(cuSel)delete cuData[cuSel];if(data.week!==W){W=data.week;subW()}render()}catch(e){$('#fe').textContent='บันทึกไม่ได้ ('+emsg(e)+')';if(btn)btn.disabled=false}}
async function wcom(id){const r=reports.find(x=>x.id===id)||Object.values(cuData).flatMap(x=>x.rs||[]).find(x=>x.id===id),t=$('#wcm').value.trim();if(!r||!t)return;
 try{await pb.collection('rcomments').create({report:id,owner:r.owner,week:r.week,by:me.name,byId:me.id,txt:t});$('#dlg').close();if(cuSel){delete cuData[cuSel];render()}}catch(e){$('#fe').textContent='ส่งไม่ได้ ('+emsg(e)+')'}}

// ===== weekly digest (managers) ==============================================
let dgRows=[];
function dg(){const inW=s=>{const d=dayOf(s);return d>=W&&d<=addD(W,6)};
 const owners=users.filter(u=>['rep','am','spec'].includes(u.role));
 const evW=events.filter(e=>inW(e.created)).sort((a,b)=>a.created<b.created?-1:1),newD=deals.filter(d=>inW(d.created)),sl=deals.filter(stale).sort((a,b)=>daysAgo(b.updated)-daysAgo(a.updated)),noc=reports.filter(r=>!rcom.some(c=>c.report===r.id));
 const won=evW.filter(e=>e.to==='won');
 const rows=owners.map(u=>{const v=vstat(u.id);return{u,v,nd:newD.filter(d=>d.owner===u.id).length,ch:evW.filter(e=>e.owner===u.id&&e.from).length,won:won.filter(e=>e.owner===u.id).reduce((s,e)=>s+(+e.value||0),0),st:deals.filter(d=>d.owner===u.id&&stale(d)).length}});dgRows=rows;
 const dname=id=>{const d=deals.find(x=>x.id===id);return d?esc(d.title):'<span class="mu">(ลบแล้ว)</span>'};
 return`<div class="noprint">${weekBar('',`<button type="button" class="b gh sm" data-a="dgPrint">${ico('print')} พิมพ์</button>${csvBtn('dg')}`)}</div>
<h2>สรุปประจำสัปดาห์ ${thD(W)} - ${thD(addD(W,6))}</h2>
<div class="g">${kpi('เข้าพบลูกค้า',String(reports.length),`${new Set(reports.map(r=>r.owner)).size} คน`)}${kpi('ดีลใหม่',String(newD.length),'฿'+fmt(sum(newD)))}${kpi('เปลี่ยนสถานะ',String(evW.filter(e=>e.from).length),'ครั้ง')}${kpi('ปิดขายได้','฿'+fmt(won.reduce((s,e)=>s+(+e.value||0),0)),won.length+' ดีล',{c:'var(--st-won)'})}${kpi('รายงานที่ยังไม่มี comment',String(noc.length),'',noc.length?{warn:1}:{})}${kpi('ดีลค้าง',String(sl.length),'≥ '+cfg.staleDays+' วัน',sl.length?{warn:1}:{})}</div>
<section class="tm"><h3>รายบุคคล</h3><table><tr><th>ชื่อ<th class="num">เข้าพบ<th class="num">วันที่มีรายการ<th class="num">รูป<th class="num">แผน / ตรงแผน<th class="num">ดีลใหม่<th class="num">เปลี่ยนสถานะ<th class="num">ปิดได้<th class="num">ดีลค้าง</tr>${rows.map(r=>`<tr><td>${esc(r.u.name)}<td class="num">${r.v.n}<td class="num">${r.v.days}/5<td class="num">${r.v.ph}<td class="num">${r.v.pln?r.v.hit+'/'+r.v.pln:'-'}<td class="num">${r.nd||''}<td class="num">${r.ch||''}<td class="num">${r.won?'฿'+fmt(r.won):''}<td class="num">${r.st?ico('warn')+' '+r.st:''}</tr>`).join('')}</table></section>
<section class="tm"><h3>การเปลี่ยนสถานะดีล</h3>${evW.length?`<table><tr><th>เวลา<th>ดีล<th>จาก<th>เป็น<th>มูลค่า<th>โดย</tr>${evW.map(e=>`<tr data-a="edit" data-id="${e.deal}"><td>${pd(e.created).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'})}<td>${dname(e.deal)}<td>${e.from&&C[e.from]?tag(e.from):'<span class="mu">สร้างใหม่</span>'}<td>${C[e.to]?tag(e.to):esc(e.to)}<td>฿${fmt(e.value)}<td>${esc(e.by)}</tr>`).join('')}</table>`:'<p class="mu">ไม่มี</p>'}</section>
<section class="tm"><h3>รายงานเข้าพบที่ยังไม่มี comment</h3>${noc.length?`<table><tr><th>วันที่<th>เซลส์<th>ลูกค้า<th>รายละเอียด</tr>${noc.map(r=>`<tr data-a="wopen" data-id="${r.id}"><td>${thD(r.date)}<td>${esc(nm(r.owner))}<td>${esc(r.company)}<td>${esc((r.detail||'').slice(0,120))}</tr>`).join('')}</table>`:'<p class="mu">ครบทุกรายการ</p>'}</section>
<section class="tm"><h3>ดีลค้าง ≥ ${cfg.staleDays} วัน</h3>${sl.length?`<table><tr><th>โครงการ<th>ลูกค้า<th>เซลส์<th>สถานะ<th>มูลค่า<th>ไม่เคลื่อนไหว</tr>${sl.slice(0,25).map(d=>`<tr data-a="edit" data-id="${d.id}"><td>${esc(d.title)}<td>${esc(d.company)}<td>${esc(nm(d.owner))}<td>${tag(d.cat)}<td>฿${fmt(val(d))}<td>${daysAgo(d.updated)} วัน</tr>`).join('')}</table>`:'<p class="mu">ไม่มี</p>'}</section>`}

// ===== visit plan calendar ===================================================
function subP(){plans=[];perr='';if(!me||!pf)return;
 const m=PM,o=pf;
 watch('plans',{filter:`month = "${m}" && owner = "${o}"`,test:p=>p.month===PM&&p.owner===pf},L=>{perr='';plans=L;render()}).catch(x=>{perr=emsg(x);render()})}
function cal(){const all=viewAll(),[y,m]=PM.split('-').map(Number),st=new Date(y,m-1,1).getDay(),dim=new Date(y,m,0).getDate(),today=ymd(new Date());
 const owners=users.filter(u=>['am','rep','spec'].includes(u.role)).sort((a,b)=>(a.role==='am'?0:1)-(b.role==='am'?0:1)||a.name.localeCompare(b.name));
 const by={};plans.forEach(p=>by[p.date]=p);
 const cells=[];for(let i=0;i<st;i++)cells.push('<div class="cc e"></div>');
 for(let d=1;d<=dim;d++){const dt=PM+'-'+String(d).padStart(2,'0'),ls=(by[dt]?.lines||'').split('\n').map(x=>x.trim()).filter(Boolean);
  cells.push(`<div class="cc ${dt===today?'td':''}" data-a="pedit" data-dt="${dt}"><span class="dn2">${d}</span>${ls.map(l=>`<div>${esc(l)}</div>`).join('')}</div>`)}
 while(cells.length%7)cells.push('<div class="cc e"></div>');
 const title=new Date(y,m-1,1).toLocaleDateString('th-TH',{month:'long',year:'numeric'}),own=writer()&&pf===me.id;
 return`<div class="flt"><button type="button" class="b gh" data-a="pprev" aria-label="เดือนก่อน">${ico('chevL')}</button><b style="font-size:20px">${title}</b><button type="button" class="b gh" data-a="pnext" aria-label="เดือนถัดไป">${ico('chevR')}</button>${mPick('pmo',PM,'ไปที่เดือน',false)}${all?`<label>ดูแพลนของ <select id="pfs">${owners.map(u=>`<option value="${u.id}" ${pf===u.id?'selected':''}>${esc(u.name)} (${RL[u.role]})</option>`).join('')}</select></label>`:`<span class="who">${esc(me.name)}</span>`}</div>${perr?`<p class="er">โหลดแพลนไม่ได้ (${esc(perr)})</p>`:''}<p class="mu">${own?'กดที่ช่องวันที่เพื่อกรอกหรือแก้ไข (พิมพ์ทีละบรรทัด)':'กำลังดูแพลนของ '+esc(nm(pf))+' (ดูอย่างเดียว)'}</p><div class="cal">${['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'].map(x=>`<div class="ch2">${x}</div>`).join('')}${cells.join('')}</div>`}
function pdlg(dt){const p=plans.find(x=>x.date===dt),cw=writer()&&pf===me.id;
 $('#dlg').innerHTML=`<h3>แพลนเข้าพบลูกค้า <small class="mu">${thD(dt)} · ${esc(nm(pf))}</small></h3><label class="mu" style="display:block">แผนของวันนี้ พิมพ์ทีละบรรทัด (เช่น ชื่อลูกค้า, ประชุม, WFH)<textarea id="pt" rows="7" ${cw?'':'disabled'}>${esc(p?p.lines:'')}</textarea></label>${cw&&customers.length?`<label class="mu" style="display:block;margin-top:8px">${vh('แทรกชื่อลูกค้า')}<select id="plins"><option value="">+ แทรกชื่อลูกค้าจากฐานข้อมูล</option>${customers.map(c=>`<option>${esc(c.name)}</option>`).join('')}</select></label>`:''}<div class="er" id="fe"></div><div class="ft"><button class="b gh" data-a="close">ปิด</button>${cw?`<button class="b" data-a="psave" data-dt="${dt}">บันทึก</button>`:''}</div>`;
 showDlg()}
async function psave(dt){const t=$('#pt').value.trim(),ex=plans.find(x=>x.date===dt&&x.owner===me.id);
 try{if(t){if(ex)await pb.collection('plans').update(ex.id,{lines:t});else await pb.collection('plans').create({owner:me.id,date:dt,month:dt.slice(0,7),lines:t})}
 else if(ex)await pb.collection('plans').delete(ex.id);$('#dlg').close();toast('บันทึกแพลนแล้ว');loadWP()}catch(e){$('#fe').textContent='บันทึกไม่ได้ ('+emsg(e)+')'}}

// ===== sales spec report =====================================================
const fD=d=>d?d.slice(8)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'';
const SST=['Follow','Pending','Final'];
const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
function subS(){serr='';watch('specrep',{},L=>{serr='';srs=L;render()}).catch(x=>{serr=emsg(x);render()})}
let srRows=[];
function sr(){const isS=me.role==='spec',L=srs.slice().sort((a,b)=>a.created<b.created?-1:a.created>b.created?1:0),idx=new Map(L.map((r,i)=>[r.id,i+1]));
 const x=L.filter(r=>(!sst||r.status===sst)&&((r.company||'')+(r.project||'')+(r.owner||'')+(r.product||'')).toLowerCase().includes(sq.toLowerCase()));srRows=x.map(r=>[idx.get(r.id),r]);
 const bg=r=>r.status==='Pending'?'background:#fde047;color:#1b2433':r.status==='Final'?'background:#86d36b;color:#1b2433':'';
 return`<div class="flt"><label>สถานะ <select id="sst"><option value="">ทั้งหมด</option>${SST.map(t=>`<option ${sst===t?'selected':''}>${t}</option>`).join('')}</select></label><label class="grow">${vh('ค้นหา')}<input id="sq" type="search" placeholder="ค้นหาลูกค้า โครงการ ผู้ดูแล สินค้า" value="${esc(sq)}"></label>${isS?`<button class="b" data-a="snew">${ico('plus')} เพิ่มรายการ</button>`:''}<span class="sp"></span>${csvBtn('sr')}</div>${serr?`<p class="er">โหลดรายงานไม่ได้ (${esc(serr)})</p>`:''}<p class="mu">${x.length} รายการ${isS?'':' (ดูอย่างเดียว)'}</p>${x.length?'':empty('doc',sq||sst?'ไม่พบรายการที่ตรงกับตัวกรอง':isS?'ยังไม่มีรายการ เริ่มเพิ่มรายการแรกได้เลย':'ยังไม่มีรายการ Sales Spec Report',isS?`<button class="b" data-a="snew">${ico('plus')} เพิ่มรายการ</button>`:'')}${x.length?'':'<!--'}<table class="wt"><tr><th>ลำดับ<th>วันที่เข้าพบลูกค้า<th>ชื่อลูกค้า / บริษัท<th>ชื่อโครงการ<th>สถานะงาน<th>แพลนเข้าหน้างาน<th>ผู้ดูแลโปรเจค<th>พื้นที่ (ตร.ม.)<th>พื้นที่ (ชิ้น)<th>ประเภทสินค้า<th>ส่วนลดค่าสินค้า<th>ส่วนลดค่าติดตั้ง</tr>${x.map(r=>`<tr data-a="sopen" data-id="${r.id}"><td>${idx.get(r.id)}<td>${fD(r.date)}<td>${esc(r.company)}<td>${esc(r.project)}<td>${esc(r.status)}<td>${esc(r.plan)}<td style="${bg(r)}">${esc(r.owner)}<td>${r.sqm?fmt(r.sqm):''}<td>${r.pcs?fmt(r.pcs):''}<td>${esc(r.product)}<td>${esc(r.dprod)}<td>${esc(r.dinst)}</tr>`).join('')}</table>${x.length?'':'-->'}`}
function sdlg(r){const e=!!r,isS=me.role==='spec',dis=isS?'':'disabled';r=r||{date:ymd(new Date()),status:'Follow',owner:'ยังไม่ส่งต่อ'};
 const inp=(id,l,v,t='text',ph='',ls='')=>`<label>${l}<input id="${id}" type="${t}" value="${esc(v)}" placeholder="${ph}" ${ls?`list="${ls}"`:''} ${dis}></label>`;
 $('#dlg').innerHTML=`<h3>${e?'รายการ':'รายการใหม่'} <small class="mu">Sales Spec Report</small></h3>${custList()}<div class="f2">${inp('sd','วันที่เข้าพบลูกค้า',r.date,'date')}${inp('sc',req('ชื่อลูกค้า / บริษัท'),r.company,'text','','cul')}${inp('sp','ชื่อโครงการ',r.project)}<label>สถานะงาน<select id="ss" ${dis}>${SST.map(t=>`<option ${r.status===t?'selected':''}>${t}</option>`).join('')}</select></label><label>แพลนเข้าหน้างาน<select id="sm" ${dis}><option value="">-</option>${MON.map(t=>`<option ${r.plan===t?'selected':''}>${t}</option>`).join('')}</select></label>${inp('so','ผู้ดูแลโปรเจค',r.owner)}${inp('sa','จำนวนพื้นที่ (ตร.ม.)',r.sqm||'','number')}${inp('sn','จำนวนพื้นที่ (ชิ้น)',r.pcs||'','number')}${inp('sg','ประเภทสินค้า',r.product,'text','เช่น ฝ้า, ผนัง, พื้น')}${inp('sx','ส่วนลดค่าสินค้า',r.dprod,'text','เช่น 30%')}${inp('si','ส่วนลดค่าติดตั้ง',r.dinst,'text','เช่น 20%')}</div>${isS?newCustBox('snc'):''}<div class="er" id="fe"></div><div class="ft">${isS&&e?`<button class="b rd" data-a="sdel" data-id="${r.id}">ลบ</button>`:''}<button class="b gh" data-a="close">ปิด</button>${isS?`<button class="b" data-a="ssave" data-id="${r.id||''}">บันทึก</button>`:''}</div>`;
 showDlg()}
async function ssave(id){const g=s=>$(s).value.trim();clearErr();if(!g('#sc')){fieldErr('#sc','กรอกชื่อลูกค้า / บริษัท');return}
 const data={date:g('#sd'),company:g('#sc'),project:g('#sp'),status:g('#ss'),plan:g('#sm'),owner:g('#so'),sqm:+g('#sa')||0,pcs:+g('#sn')||0,product:g('#sg'),dprod:g('#sx'),dinst:g('#si'),by:me.name};
 try{data.customer=await linkCust(data.company,$('#snc')?.checked);
  if(id)await pb.collection('specrep').update(id,data);else await pb.collection('specrep').create(data);$('#dlg').close()}catch(e){$('#fe').textContent='บันทึกไม่ได้ ('+emsg(e)+')'}}

// ===== user edit =============================================================
function udlg(id){const u=users.find(x=>x.id===id);if(!u)return;const isD=u.role==='director';
 $('#dlg').innerHTML=`<h3>แก้ไขผู้ใช้ <small class="mu">${esc(u.email||'')}</small></h3><div class="f2"><label>${req('ชื่อที่แสดง')}<input id="un" value="${esc(u.name)}"></label><label>ตำแหน่ง${isD?'<input disabled value="Director">':`<select id="ur">${['rep','am','spec','viewer'].map(k=>`<option value="${k}" ${u.role===k?'selected':''}>${RL[k]}</option>`).join('')}</select>`}</label><label>ทีม<select id="ut"><option value="">ไม่ระบุ</option>${TEAMS().map(t=>`<option ${u.team===t?'selected':''}>${esc(t)}</option>`).join('')}</select></label><label>เป้าตั้งต้นต่อเดือน (฿)<input id="uq" type="number" value="${u.quota||''}"></label>${isD?'':`<label>อีเมล Google<input id="ue" type="email" value="${esc(u.email||'')}"></label>`}</div><div class="er" id="fe"></div><div class="ft"><button class="b gh" data-a="close">ปิด</button><button class="b" data-a="usave" data-id="${id}">บันทึก</button></div>`;
 showDlg()}
async function usave(id){const u=users.find(x=>x.id===id),g=s=>$(s).value.trim(),role=u.role==='director'?'director':g('#ur');clearErr();if(!g('#un')){fieldErr('#un','กรอกชื่อ');return}
 const data={name:g('#un'),role,team:role==='viewer'?'':g('#ut'),quota:['rep','am'].includes(role)?+g('#uq')||0:0};
 if($('#ue')&&g('#ue').toLowerCase()!==(u.email||'').toLowerCase())data.email=g('#ue').toLowerCase();
 try{await pb.collection('users').update(id,data);$('#dlg').close()}catch(e){$('#fe').textContent='บันทึกไม่ได้ ('+emsg(e)+')'}}

// ===== exports ===============================================================
function exportCSV(x){
 if(x==='al')csv(`commit-${M}.csv`,['โครงการ','ลูกค้า','เซลส์','ทีม','สถานะ','มูลค่าสินค้า','ค่าติดตั้ง','มูลค่ารวม','ถ่วงน้ำหนัก','เดือน','เดือนที่ปิด','คาดว่าปิด','กลุ่มสินค้า','จังหวัด','เหตุผลที่ปิดไม่ได้','อายุสถานะ (วัน)','ไม่เคลื่อนไหว (วัน)','หมายเหตุ'],alRows.map(d=>[d.title,d.company,nm(d.owner),users.find(u=>u.id===d.owner)?.team||'',C[d.cat][0],+d.product||0,+d.install||0,val(d),Math.round(val(d)*prob(d.cat)),d.month,d.closedMonth||'',d.expectedClose||'',d.productLine||'',d.province||'',d.lostReason||'',isOpen(d)?since(d):'',daysAgo(d.updated),d.note||'']));
 else if(x==='wk')csv(`weekly-report-${W}.csv`,['วันที่','เซลส์','ลูกค้า / บริษัท','ประเภท','ผล','เบอร์โทร','Office & site','โครงการ','SQM.','รายละเอียด','รูป','comment'],reports.filter(r=>!wf||r.owner===wf).sort((a,b)=>a.date<b.date?-1:1).map(r=>[r.date,nm(r.owner),r.company,VT[r.visitType]||'',OC[r.outcome]||'',r.tel,r.office,r.project,r.sqm,r.detail,(r.photos||[]).length,rcom.filter(c=>c.report===r.id).map(c=>c.by+': '+c.txt).join(' | ')]));
 else if(x==='sr')csv('sales-spec-report.csv',['ลำดับ','วันที่เข้าพบลูกค้า','ชื่อลูกค้า / บริษัท','ชื่อโครงการ','สถานะงาน','แพลนเข้าหน้างาน','ผู้ดูแลโปรเจค','พื้นที่ (ตร.ม.)','พื้นที่ (ชิ้น)','ประเภทสินค้า','ส่วนลดค่าสินค้า','ส่วนลดค่าติดตั้ง'],srRows.map(([i,r])=>[i,r.date,r.company,r.project,r.status,r.plan,r.owner,+r.sqm||0,+r.pcs||0,r.product,r.dprod,r.dinst]));
 else if(x==='cu')csv('customers.csv',['ลูกค้า','จังหวัด','ประเภท','เบอร์โทร','ปิดได้','Pipeline','จำนวนดีล','ปิดล่าสุด','หมายเหตุ'],cuRows.map(({c,a})=>[c.name,c.province,CT[c.type]||'',c.phone,a.won,a.pipeline,a.deals,a.lastWon,c.note]));
 else if(x==='lb')csv(`leaderboard-${M}.csv`,['เซลส์','ทีม','ปิดได้ ('+(anP==='ytd'?'ตั้งแต่ต้นปี':anP+' เดือน')+')','เป้า (ช่วงเดียวกัน)','% เป้า','Win rate %','เฉลี่ยต่อดีล','Pipeline เปิด','พยากรณ์เดือนนี้','เข้าพบ','เข้าพบต่อดีลที่ได้','ดีลค้าง'],anLB.map(r=>[r.u.name,r.u.team||'',r.w,r.qq,r.qq?r.att:'',r.wr==null?'':r.wr,Math.round(r.avgW),r.open,Math.round(r.fc),r.visits,r.vpw,r.stale]));
 else if(x==='dg')csv(`weekly-digest-${W}.csv`,['ชื่อ','เข้าพบ','วันที่มีรายการ','รูป','แผน','ตรงแผน','ดีลใหม่','เปลี่ยนสถานะ','ปิดได้','ดีลค้าง'],dgRows.map(r=>[r.u.name,r.v.n,r.v.days,r.v.ph,r.v.pln,r.v.hit,r.nd,r.ch,r.won,r.st]))}

// ===== events ================================================================
document.addEventListener('click',async e=>{const um=$('.um[open]');if(um&&!um.contains(e.target))um.removeAttribute('open');
 // week/month pickers are an invisible input over a button: open the native picker
 if(e.target.matches?.('.pk input')){try{e.target.showPicker()}catch{}return}
 const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a,id=b.dataset.id;
 // Google popup must be opened synchronously from the click (Safari); no await before it.
 if(a==='google'){b.disabled=true;pb.collection('users').authWithOAuth2({provider:'google'}).then(()=>boot()).catch(x=>{pb.authStore.clear();loginView(emsg(x))});return}
 try{if(a==='tab'){e.preventDefault();tab=b.dataset.k;if(tab==='cu'){cuSel='';cuMerge=null}if(location.hash!=='#'+tab)history.pushState(null,'','#'+tab);render();const m=$('main');if(m&&innerWidth<=700)m.focus({preventScroll:true})}
 else if(a==='tmTab'){tmTab=b.dataset.k;render()}
 else if(a==='plStage'){plStage=b.dataset.k;render()}
 else if(a==='wnow'){W=monOf();subW();render()}
 else if(a==='new')open();
 else if(a==='edit'){const d=deals.find(d=>d.id===id);if(d)open(d)}
 else if(a==='close')$('#dlg').close();
 else if(a==='save')await save(id);
 else if(a==='del'){if(await confirmDlg({title:'ลบดีลนี้?',text:'ดีลและไฟล์แนบจะถูกลบถาวร',ok:'ลบดีล',danger:true})){await pb.collection('deals').delete(id);$('#dlg').close();toast('ลบดีลแล้ว')}}
 else if(a==='frm')await fileRemove(b.dataset.col,id,b.dataset.f);
 else if(a==='prm')await fileRemove('reports',id,b.dataset.f);
 else if(a==='out')logout();
 else if(a==='theme'){setTh(TH==='dark'?'light':'dark');if(me)render();else{b.outerHTML=thBtn();$('.lg .thb')?.focus()}}
 else if(a==='login'){await pb.collection('users').authWithPassword($('#em').value.trim(),$('#pw').value);await boot()}
 else if(a==='addrep')await addRep();
 else if(a==='wprev'){W=addD(W,-7);subW();render()}
 else if(a==='wnext'){W=addD(W,7);subW();render()}
 else if(a==='wnew')wdlg(null,b.dataset.dt);
 else if(a==='wopen')wdlg(reports.find(r=>r.id===id));
 else if(a==='wopen2'){const r=Object.values(cuData).flatMap(x=>x.rs||[]).find(x=>x.id===id);if(r)wdlg(r)}
 else if(a==='wsave')await wsave(id);
 else if(a==='wdel'){if(await confirmDlg({title:'ลบรายการเข้าพบนี้?',text:'รูปภาพและ comment ของรายการจะถูกลบด้วย',ok:'ลบรายการ',danger:true})){await pb.collection('reports').delete(id);$('#dlg').close();toast('ลบรายการแล้ว');if(cuSel){delete cuData[cuSel];render()}}}
 else if(a==='wcom')await wcom(id);
 else if(a==='uedit')udlg(id);
 else if(a==='pprev'){PM=addM(PM,-1);subP();render()}
 else if(a==='pnext'){PM=addM(PM,1);subP();render()}
 else if(a==='pedit')pdlg(b.dataset.dt);
 else if(a==='psave')await psave(b.dataset.dt);
 else if(a==='snew')sdlg(null);
 else if(a==='sopen')sdlg(srs.find(r=>r.id===id));
 else if(a==='ssave')await ssave(id);
 else if(a==='sdel'){if(await confirmDlg({title:'ลบรายการนี้?',ok:'ลบรายการ',danger:true})){await pb.collection('specrep').delete(id);$('#dlg').close();toast('ลบรายการแล้ว')}}
 else if(a==='usave')await usave(id);
 else if(a==='udel'){const u=users.find(x=>x.id===id);if(u&&u.id!==me.id&&u.role!=='director'&&await confirmDlg({title:'ลบ '+u.name+' ออกจากรายชื่อ?',text:'ดีลและรายงานเดิมยังอยู่ แต่บัญชีนี้จะเข้าสู่ระบบไม่ได้อีก',ok:'ลบผู้ใช้',danger:true})){await pb.collection('users').delete(id);toast('ลบผู้ใช้แล้ว')}}
 // analytics / customers / digest / team tools
 else if(a==='exp')exportCSV(b.dataset.x);
 else if(a==='tv'){const c=b.dataset.c;if(TV.has(c))TV.delete(c);else TV.add(c);render()}
 else if(a==='anReload'){aggDirty=true;anInit=0;render()}
 else if(a==='snapFill'){b.disabled=true;const ms=winM().filter(m=>m<=nowM()&&!snaps.some(s=>s.month===m));let n=0;for(const m of ms){const r=await pb.send('/api/crm/snapshot/'+m,{method:'POST'});n+=r.result.written}snapMsg=`สร้าง snapshot ${ms.length} เดือน (${n} แถว)`;anInit=0;render()}
 else if(a==='snapOne'){const m=$('#snM').value;if(!m)return;const r=await pb.send('/api/crm/snapshot/'+m,{method:'POST'});snapMsg=`${m}: บันทึก ${r.result.written} · ไม่เปลี่ยน ${r.result.unchanged} · ลบ ${r.result.removed} (${r.source==='live'?'สถานะปัจจุบัน':'สร้างจากประวัติสถานะ'})`;anInit=0;render()}
 else if(a==='cuOpen'){cuSel=id;render()}
 else if(a==='cuBack'){cuSel='';cuMerge=null;render()}
 else if(a==='cuNew')cdlg(null);
 else if(a==='cuEdit')cdlg(customers.find(c=>c.id===cuSel));
 else if(a==='cuSave')await cuSave(id);
 else if(a==='cuDel'){if(await confirmDlg({title:'ลบลูกค้านี้?',text:'ดีลและรายงานที่เชื่อมไว้จะยังอยู่ แต่จะไม่ได้เชื่อมกับลูกค้า',ok:'ลบลูกค้า',danger:true})){await pb.collection('customers').delete(id);$('#dlg').close();cuSel='';toast('ลบลูกค้าแล้ว');render()}}
 else if(a==='cuMerge')await cuMergeLoad();
 else if(a==='cuLink'){b.disabled=true;await cuLink(b.dataset.i,b.dataset.c||'')}
 else if(a==='dgPrint')window.print();
 else if(a==='dgSend'){b.disabled=true;const r=await pb.send('/api/crm/digest/send',{method:'POST'});dgMsg='LINE: '+r.line+' · อีเมล: '+r.email;render()}
 else if(a==='cfgSave')await cfgSave();
 else if(a==='hlReload'){hl=null;render();await loadHealth()}}
 catch(err){const m=$('#dlg[open] .er')||$('.er');if(m)m.textContent=emsg(err);else console.error(err)}});
document.addEventListener('change',e=>{const t=e.target,i=t.id;
 const pt=t.closest?.('.pk')?.querySelector('.pkt');if(pt&&t.value)pt.textContent=mlab(t.value);
 if(i==='mo'){M=t.value||M;anInit=0;render()}if(i==='rf'){rf=t.value;render()}if(i==='tf'){tf=t.value;rf='';render()}if(i==='wd'){W=monOf(t.value||W);subW();render()}if(i==='wf'){wf=t.value;render()}if(i==='pmo'){PM=t.value||PM;subP();render()}if(i==='pfs'){pf=t.value;subP();render()}if(i==='sst'){sst=t.value;render()}
 if(i==='anTeam'){anTeam=t.value;render()}if(i==='anP'){anP=t.value;anInit=0;render()}if(i==='cuProv'){cuProv=t.value;render()}if(i==='tmY'){tmY=t.value;render()}
 if(i==='fs'){const w=$('#lrw');if(w)w.style.display=t.value==='lost'?'':'none'}
 if(i==='plins'&&t.value){const ta=$('#pt');ta.value=(ta.value.trim()?ta.value.trim()+'\n':'')+t.value;t.value=''}
 if(t.dataset.q!=null)qsave(t.dataset.q,t.value.trim());
 if(t.dataset.t)pb.collection('users').update(t.dataset.t,{team:t.value}).then(()=>toast('บันทึกทีมแล้ว')).catch(x=>toast('เปลี่ยนทีมไม่ได้: '+emsg(x)))});
document.addEventListener('input',e=>{const i=e.target.id;if(i==='q'){q=e.target.value;render()}if(i==='sq'){sq=e.target.value;render()}if(i==='cuQ'){cuQ=e.target.value;render()}});
document.addEventListener('keydown',e=>{const t=e.target;
 if(e.key==='Enter'&&t.dataset?.q!=null)t.blur();
 if((e.key==='Enter'||e.key===' ')&&t.matches?.('.pk input')){e.preventDefault();try{t.showPicker()}catch{}}
 if((e.key==='Enter'||e.key===' ')&&t.matches&&t.matches('[role=button][data-a]')){e.preventDefault();t.click()}
 if(e.key==='Escape'){const um=$('.um[open]');if(um)um.removeAttribute('open')}});
addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(me&&TABL[h]&&h!==tab){tab=h;if(tab==='cu'){cuSel='';cuMerge=null}render()}});
document.addEventListener('dragstart',e=>{const c=e.target.closest('.cd');if(c)e.dataTransfer.setData('t',c.dataset.id)});
document.addEventListener('dragover',e=>{if(e.target.closest('.col'))e.preventDefault()});
document.addEventListener('drop',async e=>{const c=e.target.closest('.col');if(!c)return;e.preventDefault();
 const d=deals.find(x=>x.id===e.dataTransfer.getData('t')),k=c.dataset.k;
 if(d&&d.cat!==k&&can(d))await pb.collection('deals').update(d.id,{cat:k,closedMonth:k==='won'||k==='lost'?nowM():'',act:[...(d.act||[]),log('เปลี่ยนสถานะเป็น '+C[k][0])]}).then(()=>toast('ย้ายไป '+C[k][0]+' แล้ว')).catch(x=>toast('ย้ายไม่ได้: '+emsg(x)))});

boot();
