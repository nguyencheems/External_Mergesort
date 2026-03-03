const $ = id => document.getElementById(id);
const H = (id,h) => { const e=$(id); if(e) e.innerHTML=h; };
const ns = 'http://www.w3.org/2000/svg';

let steps=[], i=0, chunks=[], cs=4, k=2;
let timer=null, playing=false, snaps=[], sorted=[];

// snap/restore lưu toàn bộ DOM thay vì từng field
const snap    = () => snaps[i] = {i, chunks:chunks.map(c=>[...c]), heap:$('zoneRam').classList.contains('hm'), ram:$('ramBody').innerHTML, hdd:$('hddGrid').innerHTML, out:$('outputNums').innerHTML, save:$('btnSave').disabled};
const restore = s => { chunks=s.chunks.map(c=>[...c]); i=s.i; $('zoneRam').classList.toggle('hm',s.heap); H('ramBody',s.ram); H('hddGrid',s.hdd); H('outputNums',s.out); $('btnSave').disabled=s.save; nav(); };
const nav     = () => { const ok=steps.length>0; $('btnBack').disabled=!ok||i===0; $('btnStep').disabled=$('btnAuto').disabled=!ok||i>=steps.length; };

const ramChunk = () => { $('zoneRam').classList.remove('hm'); $('ramIcon').textContent=''; $('ramZoneTitle').textContent='RAM'; H('ramBody','<div class="slots" id="ramSlots"></div>'); };
const ramHeap  = () => { $('zoneRam').classList.add('hm'); $('ramIcon').textContent=''; $('ramZoneTitle').textContent='RAM — MinHeap'; H('ramBody',`<div class="hip"><div class="hl">Tree View</div><svg id="svg" viewBox="0 0 340 190" style="height:190px;overflow:visible"></svg><div id="xb"></div><div class="hl" style="margin-top:8px">Array [ idx : val (file) ]</div><div class="har" id="ha"></div></div>`); };

const slots      = (a=[],c='on') => H('ramSlots', a.map((v,j)=>`<div class="cell ${c}"><div class="v">${v}</div><div class="i">[${j}]</div></div>`).join(''));
const clearSlots = (sz=cs)       => H('ramSlots', Array.from({length:sz},(_,j)=>`<div class="cell mt"><div class="v">—</div><div class="i">[${j}]</div></div>`).join(''));
const renderHDD  = (cks=[],act=-1,ptrs) => H('hddGrid', cks.map((ck,ci)=>`<div class="df ${ci===act?'rd':''}"><div class="fn">tmp_${ci}.dat</div>${ck.map((n,ni)=>`<div class="fv${ptrs&&ni<ptrs[ci]-1?' cs':ptrs&&ni===ptrs[ci]-1&&ci===act?' pt':''}">${n}</div>`).join('')}</div>`).join(''));
const renderOut  = (out=[])      => H('outputNums', out.map(n=>`<div class="ov">${n}</div>`).join(''));

const svgEl = (tag,a,txt) => { const e=document.createElementNS(ns,tag); Object.entries(a).forEach(([k,v])=>e.setAttribute(k,v)); if(txt!=null) e.textContent=txt; return e; };
const drawHeap = (heap=[]) => {
  const sv=$('svg'); if(!sv) return; sv.innerHTML=''; if(!heap.length) return;
  const W=340,R=16,lv=Math.ceil(Math.log2(heap.length+1)),Hh=Math.max(50,~~(160/lv))*lv;
  sv.setAttribute('viewBox',`0 0 ${W} ${Hh}`); sv.style.height=Hh+'px';
  const pos=heap.map((_,j)=>{ const l=~~Math.log2(j+1),p=j-(2**l-1),t=2**l; return{x:((p+.5)/t)*W,y:(l+.5)/lv*Hh}; });
  heap.forEach((_,j)=>{ if(j) sv.append(svgEl('line',{x1:pos[~~((j-1)/2)].x,y1:pos[~~((j-1)/2)].y,x2:pos[j].x,y2:pos[j].y,stroke:'rgba(167,139,250,.3)','stroke-width':1.5})); });
  heap.forEach(({val,fi},j)=>{ const r=j===0,g=document.createElementNS(ns,'g'); g.append(svgEl('circle',{cx:pos[j].x,cy:pos[j].y,r:R,fill:r?'rgba(251,191,36,.18)':'rgba(167,139,250,.1)',stroke:r?'#fbbf24':'rgba(167,139,250,.6)','stroke-width':r?2:1.5}),svgEl('text',{x:pos[j].x,y:pos[j].y,'text-anchor':'middle','dominant-baseline':'middle','font-family':'JetBrains Mono,monospace','font-size':10,'font-weight':700,fill:r?'#fbbf24':'#a78bfa'},val),svgEl('text',{x:pos[j].x,y:pos[j].y+R+6,'text-anchor':'middle','font-family':'JetBrains Mono,monospace','font-size':7,fill:'#f97316'},`f${fi}`)); sv.append(g); });
};
const drawArr = (heap=[],extr) => { H('ha',heap.map(({val,fi},j)=>`<div class="hac ${j?'':'mn'}"><div class="hv">${val}</div><div class="hi">[${j}]</div><div class="hf">f${fi}</div></div>`).join('')); H('xb',extr!=null?`<div class="xb">⬇ ${extr}</div>`:''); };

const STEPS = {
  'load-ram':  st => { ramChunk(); slots(st.chunk); },
  'sort-ram':  st =>   slots(st.chunk,'ok2'),
  'write-hdd': st => { chunks=st.chunks; renderHDD(chunks); clearSlots(); },
  'phase3':    ()  => { ramHeap(); renderHDD(chunks); },
  'init-heap': st => { renderHDD(st.chunks||chunks,-1,st.ptrs); drawHeap(st.heap); drawArr(st.heap); },
  'extract':   st => { renderHDD(st.chunks||chunks,st.fromFile,st.ptrs); drawHeap(st.heap); drawArr(st.heap,st.extracted); renderOut(st.output); },
  'done':      st => { ['ha','xb','svg'].forEach(id=>H(id,'')); renderOut(st.output); sorted=st.output||[]; if(sorted.length) $('btnSave').disabled=false; if(playing) stopAuto(); },
};
const execStep = st => { snap(); (STEPS[st.type]||(() => console.warn(st.type)))(st); nav(); };

const stopAuto  = () => { clearInterval(timer); playing=false; Object.assign($('btnAuto'),{textContent:'Auto'}); Object.assign($('btnAuto').style,{borderColor:'',color:''}); };
const startAuto = () => { playing=true; Object.assign($('btnAuto'),{textContent:'⏸ Pause'}); Object.assign($('btnAuto').style,{borderColor:'var(--hp)',color:'var(--hp)'}); timer=setInterval(()=>i>=steps.length?stopAuto():(execStep(steps[i]),i++),+$('speed').value); };

const post = (url,body) => fetch(url,{method:'POST',...(body instanceof FormData?{body}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}).then(r=>r.json());
const download = async blob => { const url=URL.createObjectURL(blob); Object.assign(document.createElement('a'),{href:url,download:'sorted_output.txt'}).click(); URL.revokeObjectURL(url); };

$('speed').oninput    = function(){ $('spL').textContent=this.value+'ms'; if(playing){stopAuto();$('btnAuto').click();} };
$('fileInput').onchange = async function(){ const f=this.files[0]; if(!f) return; $('fileNameLabel').textContent=f.name; try{ const fd=new FormData(); fd.append('file',f); const d=await fetch('/api/upload-bin',{method:'POST',body:fd}).then(r=>r.json()); if(d.error) return alert(d.error); $('inputNums').value=d.nums.join(' '); alert(`✅ ${d.count} số — nhấn ▶`); }catch(e){alert(e.message);} };
$('btnSave').onclick  = async ()=>{ if(!sorted.length) return; try{ const r=await fetch('/api/download-txt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nums:sorted})}); if(r.ok) download(await r.blob()); }catch(e){alert(e.message);} };
$('btnStart').onclick = async ()=>{ const raw=$('inputNums').value.trim().split(/[\s,]+/).map(Number).filter(n=>!isNaN(n)); cs=+$('chunkSize').value||4; k=Math.max(2,+$('kWay').value||2); if(raw.length<2||playing&&stopAuto()) return; steps=[]; i=0; chunks=[]; snaps=[]; sorted=[]; H('outputNums',''); H('hddGrid',''); $('btnSave').disabled=true; try{ const d=await post('/api/build-steps',{nums:raw,chunkSize:cs,k}); if(d.error) return alert(d.error); steps=d.steps; }catch(e){return alert(e.message);} ramChunk(); clearSlots(); nav(); };
$('btnStep').onclick  = ()=>{ if(i<steps.length){execStep(steps[i]);i++;} };
$('btnBack').onclick  = ()=>{ if(playing) stopAuto(); if(i>0) restore(snaps[i-1]); };
$('btnAuto').onclick  = ()=>{ playing?stopAuto():startAuto(); };
$('btnReset').onclick = ()=>{ if(playing) stopAuto(); steps=[]; i=0; chunks=[]; snaps=[]; sorted=[]; H('outputNums',''); H('hddGrid',''); $('btnAuto').textContent='Auto'; $('btnSave').disabled=true; ramChunk(); clearSlots(); nav(); };

ramChunk(); clearSlots(); nav();
