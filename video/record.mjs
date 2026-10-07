import {chromium} from 'playwright';
import fs from 'node:fs';
const URL_ = process.env.URL || 'http://localhost:4173/';
const dur = Object.fromEntries(fs.readFileSync('video/out/durations.txt','utf8').trim().split('\n').map(l=>{const [k,v]=l.split(' ');return [k,+v];}));
const W=1366,H=768;
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:W,height:H},recordVideo:{dir:'video/out/raw',size:{width:W,height:H}},acceptDownloads:true});
await ctx.addInitScript(()=>{window.addEventListener('DOMContentLoaded',()=>{const c=document.createElement('div');c.id='__cur';
c.style.cssText='position:fixed;left:683px;top:420px;width:22px;height:22px;z-index:99999;pointer-events:none;transition:left .7s cubic-bezier(.4,0,.2,1),top .7s cubic-bezier(.4,0,.2,1);';
c.innerHTML='<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 2 L2 18 L6.5 13.8 L9.6 20.5 L12.4 19.2 L9.4 12.6 L15.5 12.6 Z" fill="#000" stroke="#fff" stroke-width="1.4"/></svg>';
document.body.appendChild(c);
const ring=document.createElement('div');ring.id='__ring';ring.style.cssText='position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border:2px solid #0099ff;border-radius:50%;z-index:99998;pointer-events:none;opacity:0;transition:opacity .35s,transform .35s;transform:scale(.5)';document.body.appendChild(ring);const mk=document.createElement('div');mk.id='__mk';mk.style.cssText='position:fixed;left:0;bottom:0;width:8px;height:8px;z-index:99999;pointer-events:none;background:rgb(0,0,255)';document.body.appendChild(mk);});});
const t00=Date.now();
const p=await ctx.newPage();
await p.goto(URL_,{waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);
await p.waitForTimeout(600);
const t0=Date.now(); const lead=(t0-t00)/1000;
const marks=[]; const sleep=ms=>p.waitForTimeout(ms);
async function moveTo(loc){const bb=await loc.boundingBox();const x=bb.x+Math.min(bb.width/2,60),y=bb.y+bb.height/2;
  await p.evaluate(([x,y])=>{const c=document.getElementById('__cur');c.style.left=x+'px';c.style.top=y+'px';},[x,y]);await sleep(750);return [x,y];}
async function click(loc){await scrollInto(loc);const [x,y]=await moveTo(loc);
  await p.evaluate(([x,y])=>{const r=document.getElementById('__ring');r.style.left=x+'px';r.style.top=y+'px';r.style.opacity='1';r.style.transform='scale(1)';setTimeout(()=>{r.style.opacity='0';r.style.transform='scale(.5)';},380);},[x,y]);
  await loc.click();await sleep(300);}
async function scrollY(y,ms=900){await p.evaluate(([y,ms])=>new Promise(res=>{const s=window.scrollY,d=y-s,t=performance.now();function f(n){const k=Math.min(1,(n-t)/ms),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;window.scrollTo(0,s+d*e);k<1?requestAnimationFrame(f):res();}requestAnimationFrame(f);}),[y,ms]);await sleep(150);}
async function scrollInto(loc,pad=140){const bb=await loc.boundingBox();if(bb.y<70||bb.y+bb.height>H-20){const cur=await p.evaluate(()=>window.scrollY);await scrollY(Math.max(0,cur+bb.y-pad));}}
async function scrollTo(loc,pad=90){const bb=await loc.boundingBox();const cur=await p.evaluate(()=>window.scrollY);await scrollY(Math.max(0,cur+bb.y-pad));}
let segN=0;async function seg(id,fn){segN++;await p.evaluate(n=>{document.getElementById('__mk').style.background=`rgb(${n*25},${n%2?255:0},0)`;},segN);const start=(Date.now()-t0)/1000;marks.push([id,start]);await fn();const el=(Date.now()-t0)/1000-start;const rest=dur[id]+0.45-el;if(rest>0)await sleep(rest*1000);else console.error('overrun',id,-rest);}

await seg('s1',async()=>{await moveTo(p.locator('.affil'));await sleep(1800);await moveTo(p.locator('.intro-copy strong'));await sleep(1500);await moveTo(p.locator('.fx-list li').first());});
await seg('s2',async()=>{await click(p.getByRole('radio',{name:/v2.4 baseline/i}));await sleep(900);await moveTo(p.locator('.guards li').nth(0));await sleep(500);await moveTo(p.locator('.guards li').nth(3));await sleep(500);await moveTo(p.locator('.guards li').nth(5));await sleep(900);await moveTo(p.locator('.guards p'));});
await seg('s3',async()=>{await click(p.getByRole('button',{name:/run bench/i}));await sleep(2600);await moveTo(p.locator('.scores'));await sleep(600);await scrollTo(p.locator('.bench'),80);});
await seg('s4',async()=>{await click(p.locator('.fx-list .fx').filter({hasText:'F01'}));await sleep(500);await moveTo(p.locator('.eva'));await sleep(1200);
  await scrollTo(p.locator('.step').nth(2),90);await moveTo(p.locator('.step').nth(2).locator('.check').nth(3));await sleep(900);
  await scrollTo(p.locator('.step').nth(3),90);await moveTo(p.locator('.step').nth(3).locator('.check').nth(1));await sleep(600);await moveTo(p.locator('.step').nth(3).locator('.prov li').first());});
await seg('s5',async()=>{await scrollTo(p.locator('.bench'),80);await click(p.locator('.fx-list .fx').filter({hasText:'F07'}));await sleep(400);await moveTo(p.locator('.eva'));await sleep(900);
  await scrollTo(p.locator('.step').nth(2),90);await moveTo(p.locator('.step').nth(2).locator('.check-fail').first());await sleep(1200);await moveTo(p.locator('.step').nth(3));await sleep(600);
  await scrollTo(p.locator('.q-item').last(),120);await moveTo(p.locator('.q-item').last().locator('.q-reason').first());});
await seg('s6',async()=>{await scrollY(0,1000);await click(p.getByRole('radio',{name:/v2.5 release candidate/i}));await sleep(500);await moveTo(p.getByLabel(/quote freshness/i));await sleep(1200);await click(p.getByRole('button',{name:/run bench/i}));});
await seg('s7',async()=>{await sleep(1800);await scrollTo(p.locator('.bench'),80);await click(p.locator('.fx-list .fx').filter({hasText:'F06'}));await sleep(500);await moveTo(p.locator('.eva > div').nth(2));await sleep(900);
  await moveTo(p.locator('.row-bad'));await sleep(900);await scrollTo(p.locator('.step').nth(2),90);await moveTo(p.locator('.step').nth(2).locator('.check-skipped').first());});
await seg('s8',async()=>{const item=p.locator('.q-item').filter({hasText:'F07'});await scrollTo(item,150);await sleep(300);
  const sel=item.locator('select');await moveTo(sel);await sel.selectOption('REQUEST_EVIDENCE');await sleep(500);
  const inp=item.locator('input');await click(inp);await inp.pressSequentially('Need approval scoped to PR-30185',{delay:45});await sleep(300);
  await click(item.getByRole('button',{name:/record decision/i}));await sleep(400);await moveTo(item.locator('.reviewed'));});
await seg('s9',async()=>{await scrollY(260,1000);const d1=p.waitForEvent('download');await click(p.getByRole('button',{name:/export json/i}));await (await d1).saveAs('video/out/export.json');await sleep(1200);
  const d2=p.waitForEvent('download');await click(p.getByRole('button',{name:/decision memo/i}));await (await d2).saveAs('video/out/memo.md');await sleep(700);await moveTo(p.locator('.saved'));await sleep(800);await moveTo(p.locator('.scores'));});
await p.evaluate(()=>{document.getElementById('__mk').style.background='rgb(255,255,255)';});const tEnd=(Date.now()-t0)/1000;await sleep(1200);
const total=(Date.now()-t0)/1000;
const vp=await p.video().path();
await ctx.close();await b.close();
fs.writeFileSync('video/out/marks.json',JSON.stringify({lead,total,tEnd,video:vp,marks},null,1));
console.log(JSON.stringify({lead,total,marks}));
