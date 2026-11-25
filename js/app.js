{
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const okc=c=>/^#[0-9a-f]{6}$/i.test(c||'')?c:'';
const okId=id=>/^[A-Za-z0-9_-]{1,80}$/.test(id||'');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const COLORS=['','#ff5a3c','#f39a1e','#e2c02a','#36a86d','#2a9ec4','#4b6bff','#8f5ae8','#e0508f','#737a84'];
const TYPES=['note','heading','todo','link','image','video','audio','board','column','swatch'];
const MINW={note:150,heading:140,todo:190,link:220,image:110,video:200,audio:220,board:130,column:200,swatch:100};
const DEFW={note:260,heading:380,todo:280,link:300,image:280,video:380,audio:300,board:170,column:270,swatch:150};
const ICON={
 note:'<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>',
 heading:'<path d="M6 5v14M18 5v14M6 12h12"/>',
 todo:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12.5l2.8 2.8L16.5 9"/>',
 link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
 image:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5L20 17"/>',
 board:'<rect x="4" y="4" width="7" height="7" rx="1.6"/><rect x="13" y="4" width="7" height="7" rx="1.6"/><rect x="4" y="13" width="7" height="7" rx="1.6"/><rect x="13" y="13" width="7" height="7" rx="1.6"/>',
 column:'<rect x="4" y="4" width="6" height="16" rx="1.6"/><rect x="14" y="4" width="6" height="10" rx="1.6"/>',
 swatch:'<path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z"/>',
 line:'<path d="M5 19L19 5M11 5h8v8"/>',
 voice:'<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5"/>'};
const TOOLS=[['note','Note'],['heading','Heading'],['todo','To-do'],['link','Link'],['image','Media'],['voice','Voice'],['board','Board'],['column','Column'],['swatch','Colour'],['line','Line']];
const canvas=$('#canvas'),world=$('#world'),svg=$('#links'),ctx=$('#ctx');
const S={boards:{},images:{},cur:'home',view:{},sel:new Set(),selLink:null,linkPt:null,connect:null,undo:[],redo:[],editSnapped:false,needRender:false};
/* P.remote: what the store holds (key -> doc). P.sent: what we last saw/sent per key. P.pend: keys with writes in flight. */
const P={mode:'local',canWrite:true,remote:new Map(),sent:new Map(),pend:new Set(),localKeys:new Set(),mine:new Map(),busy:new Map(),dirty:false};
let drag=null,tdrag=null,pinch=null;const pointers=new Map();

/* ---------- documents <-> boards ---------- */
function stable(v){if(Array.isArray(v))return '['+v.map(stable).join(',')+']';if(v&&typeof v=='object')return '{'+Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';return JSON.stringify(v===undefined?null:v)}
function docsOf(boards){const m=new Map();for(const b of Object.values(boards)){m.set('b:'+b.id,{kind:'board',id:b.id,title:b.title,parent:b.parent,links:b.links,created:b.created||0});for(const c of b.cards)m.set('c:'+c.id,{...c,_b:b.id})}return m}
function buildBoards(m){const bs={};for(const[k,v]of m)if(k[0]=='b'&&v&&okId(v.id))bs[v.id]={id:v.id,title:v.title,parent:v.parent,links:v.links,created:v.created,cards:[]};
 for(const[k,v]of m)if(k[0]=='c'&&v&&bs[v._b]){const c={...v};delete c._b;bs[v._b].cards.push(c)}
 for(const id in bs){bs[id].cards.sort((a,b)=>(+a.o||0)-(+b.o||0));normalize(bs[id])}return bs}
function normalize(b){b.title=String(b.title??'Untitled board');b.parent=b.parent==null?null:String(b.parent);b.created=+b.created||0;
 b.cards=(Array.isArray(b.cards)?b.cards:[]).filter(c=>c&&TYPES.includes(c.type)).map((c,i)=>{const k={...c,id:okId(String(c.id))?String(c.id):uid(),x:+c.x||0,y:+c.y||0,w:+c.w||DEFW[c.type],text:String(c.text??''),o:Number.isFinite(+c.o)&&c.o!==null&&c.o!==''?+c.o:i};
  if(k.type=='todo')k.items=(Array.isArray(c.items)?c.items:[]).map(i=>({t:String(i&&i.t||''),d:!!(i&&i.d)}));
  if(k.type=='column')k.items=(Array.isArray(c.items)?c.items:[]).map(String);
  if(k.col!=null)k.col=String(k.col);return k});
 b.links=(Array.isArray(b.links)?b.links:[]).filter(l=>l&&l.from&&l.to).map(l=>({id:String(l.id||uid()),from:String(l.from),to:String(l.to)}));return b}
const docPath=k=>(k[0]=='b'?'boards/':'cards/')+k.slice(2);

/* ---------- saving ---------- */
const Store=window.LocalStore;
function status(t){$('#status').textContent=t}
let toastT;function toast(t){const x=$('#toast');x.textContent=t;x.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>x.hidden=true,3600)}
function savedText(){return 'Saved on this device'}
function fail(e){status('Not saved');toast(e&&e.name=='QuotaExceededError'?'This device is out of space. Free up some space or remove unused media.':'A change could not be saved. Make another edit to retry.')}
async function send(k,v){P.pend.add(k);
 const st=P.busy.get(k);if(st){st.has=true;st.next=v;return}
 const me={has:false,next:null};P.busy.set(k,me);let val=v;
 for(;;){try{if(val===null){await Store.del(k);P.remote.delete(k)}else{await Store.put(k,val);P.remote.set(k,val)}}catch(e){fail(e)}
  if(me.has){me.has=false;val=me.next;continue}break}
 P.busy.delete(k);P.pend.delete(k);settled()}
function settled(){if(!P.pend.size&&!P.dirty)status(savedText())}
let flushT;
function dirty(){if(!P.canWrite)return;P.dirty=true;status('Saving…');clearTimeout(flushT);flushT=setTimeout(flushNow,400)}
const touch=dirty;
function flushNow(){clearTimeout(flushT);if(!P.dirty)return;P.dirty=false;const want=docsOf(S.boards),t=Date.now();
 for(const[k,v]of want){const s=stable(v);if(P.sent.get(k)!==s){P.sent.set(k,s);P.mine.set(k,t);send(k,JSON.parse(s))}}
 for(const k of P.localKeys)if(!want.has(k)){P.sent.delete(k);P.mine.set(k,t);send(k,null)}
 P.localKeys=new Set(want.keys());settled()}
function adoptRemote(){const nb=buildBoards(P.remote),nd=docsOf(nb);P.sent=new Map();for(const[k,v]of nd)P.sent.set(k,stable(v));P.localKeys=new Set(nd.keys());S.boards=nb}
let mergeT;function mergeSoon(){clearTimeout(mergeT);mergeT=setTimeout(merge,120)}
function merge(){if(P.dirty)flushNow();const local=docsOf(S.boards),out=new Map(P.remote);
 for(const k of P.pend){if(local.has(k))out.set(k,local.get(k));else out.delete(k)}
 const nb=buildBoards(out),nd=docsOf(nb);
 for(const[k,v]of nd)if(!P.pend.has(k))P.sent.set(k,stable(v));
 for(const k of[...P.sent.keys()])if(!nd.has(k)&&!P.pend.has(k))P.sent.delete(k);
 P.localKeys=new Set(nd.keys());
 let changed=nd.size!=local.size;if(!changed)for(const[k,v]of nd){const l=local.get(k);if(!l||stable(l)!==stable(v)){changed=true;break}}
 if(!changed)return;S.boards=nb;if(!S.boards[S.cur]){S.cur='home';if(!S.boards.home)return}requestRender()}
function requestRender(){if(drag||tdrag||pinch||isEditing()){S.needRender=true;return}S.needRender=false;render()}
/* other tabs on this device: apply their saved changes live */
Store.onChange(changes=>{for(const[k,v]of changes){if(v===null)P.remote.delete(k);else P.remote.set(k,v)}mergeSoon()});
/* media: files are kept on this device; the page shows them through temporary local links */
function mediaTag(c){const id=c.media;if(!id)return '<div class="ph">Missing file</div>';const u=Store.cachedUrl(id);
 if(u===undefined){Store.mediaUrl(id).then(()=>{world.querySelectorAll(`.im[data-media="${CSS.escape(id)}"]`).forEach(x=>{const card=find(x.closest('.card').dataset.id);if(card)x.innerHTML=mediaTag(card)});linksSoon()});return `<div class="ph">Loading ${c.type=='video'?'video':c.type=='audio'?'voice note':'picture'}…</div>`}
 if(!u)return `<div class="ph">${c.type=='video'?'Video':c.type=='audio'?'Voice note':'Picture'} not found on this device</div>`;
 return c.type=='audio'?`<audio src="${esc(u)}" controls preload="metadata"></audio>`:c.type=='video'?`<video src="${esc(u)}" controls playsinline preload="metadata"></video>`:`<img src="${esc(u)}" alt="" draggable="false">`}

/* ---------- loading ---------- */
function setRO(){}function roleText(){}
async function load(){
 try{P.remote=await Store.loadAll()}catch(e){toast('This browser blocked local storage, so changes won’t be kept. Try a normal (not private) window.')}
 if(P.remote.size)adoptRemote();
 if(!S.boards.home)starter();
 try{S.view=JSON.parse(localStorage.getItem('mb:views')||'{}')||{}}catch(e){}
 status(savedText());
 $('#where').textContent='Everything is saved on this device. Use Share to send a board to someone.';
 if(navigator.storage&&navigator.storage.persisted){try{if(!await navigator.storage.persisted()&&P.remote.size)Store.keepSafe()}catch(e){}}}
function starter(){
 const mood='b'+uid(),plan='b'+uid(),n1=uid(),bm=uid();
 const mk=(id,title,parent,cards,links=[])=>S.boards[id]=normalize({id,title,parent,cards,links,created:Date.now()});
 mk('home','Home',null,[
  {id:uid(),type:'heading',x:60,y:40,w:460,text:'Start here'},
  {id:n1,type:'note',x:60,y:118,w:300,color:'#f39a1e',text:'Drag anything from the toolbar onto the board, then click it to type.\n\nBoards hold other boards: make as many as you like, as deep as you like.\n\n(This starter board is an example. Edit or delete anything.)'},
  {id:bm,type:'board',x:410,y:118,w:170,board:mood,color:'#e0508f'},
  {id:uid(),type:'board',x:600,y:118,w:170,board:plan,color:'#4b6bff'},
  {id:uid(),type:'todo',x:410,y:330,w:330,text:'Things to try',items:[{t:'Paste a link, some text, a picture or a video',d:false},{t:'Drop a card onto a board to move it inside',d:false},{t:'Drag a card into a column, or back out',d:false},{t:'Pick Line, then click two cards to connect them',d:false},{t:'Press Ctrl+K to search every board',d:false}]},
  {id:uid(),type:'note',x:60,y:420,w:300,text:'Scroll or drag the background to move around. Ctrl + scroll, or pinch, to zoom.\nSelect a card and press Delete to remove it, Ctrl+Z to undo.'}
 ],[{id:uid(),from:n1,to:bm}]);
 mk(mood,'Moodboard','home',[
  {id:uid(),type:'heading',x:60,y:40,w:400,text:'Moodboard'},
  {id:uid(),type:'swatch',x:60,y:110,w:150,hex:'#1f3a5f',text:'Deep sea'},
  {id:uid(),type:'swatch',x:226,y:110,w:150,hex:'#e8b04b',text:'Brass'},
  {id:uid(),type:'swatch',x:392,y:110,w:150,hex:'#d9d4c7',text:'Linen'},
  {id:uid(),type:'note',x:60,y:270,w:330,text:'Drop photos and videos straight from your computer onto the board.'}]);
 const c1=uid(),c2=uid(),k1=uid(),k2=uid(),k3=uid();
 mk(plan,'Project plan','home',[
  {id:c1,type:'column',x:60,y:50,w:270,text:'To do',items:[k1,k2]},
  {id:c2,type:'column',x:350,y:50,w:270,text:'Done',items:[k3]},
  {id:k1,type:'note',col:c1,text:'Draft the outline'},
  {id:k2,type:'link',col:c1,url:'https://en.wikipedia.org/wiki/Kanban_(development)',text:'Kanban, explained'},
  {id:k3,type:'note',col:c2,color:'#36a86d',text:'Kick-off meeting'}])}

/* ---------- helpers ---------- */
const B=()=>S.boards[S.cur];
const find=id=>B().cards.find(c=>c.id==id);
const el=id=>world.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
const V=()=>S.view[S.cur]||(S.view[S.cur]={x:40,y:30,z:1});
const isEditing=()=>{const a=document.activeElement;return!!a&&(a.isContentEditable||/INPUT|TEXTAREA/.test(a.tagName))};
const snapState=()=>({docs:Object.fromEntries([...docsOf(S.boards)].map(([k,v])=>[k,stable(v)])),t:Date.now()});
function pushUndo(st){S.undo.push(st);if(S.undo.length>60)S.undo.shift();S.redo=[]}
function snap(){if(P.canWrite){flushNow();pushUndo(snapState())}}
function worldPt(x,y){const r=canvas.getBoundingClientRect(),v=V();return{x:(x-r.left-v.x)/v.z,y:(y-r.top-v.y)/v.z}}
let addN=0;function centerPt(w=260){const r=canvas.getBoundingClientRect(),p=worldPt(r.left+r.width/2,r.top+r.height*.4);addN=(addN+1)%6;return{x:p.x-w/2+addN*22,y:p.y-40+addN*22}}
function wrect(id){const e=el(id);if(!e)return null;const r=e.getBoundingClientRect(),cr=canvas.getBoundingClientRect(),v=V();return{x:(r.left-cr.left-v.x)/v.z,y:(r.top-cr.top-v.y)/v.z,w:r.width/v.z,h:r.height/v.z}}
let viewT;function saveViewSoon(){clearTimeout(viewT);viewT=setTimeout(()=>{try{localStorage.setItem('mb:views',JSON.stringify(S.view))}catch(e){}},400)}
function titleFrom(u){try{const x=new URL(u);const seg=decodeURIComponent(x.pathname.split('/').filter(Boolean).pop()||'').replace(/[-_]+/g,' ').replace(/\.\w+$/,'');return seg?seg[0].toUpperCase()+seg.slice(1):x.hostname.replace(/^www\./,'')}catch(e){return u}}
function pathOf(id){const out=[];let b=S.boards[id],g=0;while(b&&g++<60){out.unshift(b);b=b.parent?S.boards[b.parent]:null}return out}
const mb=n=>n>=1073741824?(n/1073741824).toFixed(1)+' GB':(n/1048576).toFixed(n<10485760?1:0)+' MB';

/* ---------- render ---------- */
function ed(f,val,ph,cls='txt',extra=''){return `<div class="${cls}" contenteditable="${P.canWrite?'plaintext-only':'false'}" spellcheck="false" data-f="${f}" ${extra} data-ph="${esc(ph)}">${esc(val)}</div>`}
function inner(c){
 switch(c.type){
 case 'note':return ed('text',c.text,'Type something…');
 case 'heading':return ed('text',c.text,'Heading','txt h');
 case 'todo':return ed('text',c.text,'To-do list','txt tt')+`<ul class="todo">${c.items.map((it,i)=>`<li class="${it.d?'done':''}"><button class="ck" data-act="ck" data-i="${i}" aria-label="Tick item"><svg viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3"/></svg></button>${ed('item',it.t,'Item','txt it',`data-i="${i}"`)}</li>`).join('')}</ul><button class="add" data-act="additem">+ Add item</button>`;
 case 'link':{if(!c.url)return P.canWrite?`<form class="lf"><input name="u" placeholder="Paste a web address" autocomplete="off" aria-label="Web address"><button>Add</button></form>`:'<div class="ph" style="height:auto;padding:12px">Empty link</div>';
  let host='';try{host=new URL(c.url).hostname.replace(/^www\./,'')}catch(e){}
  return `<div class="lk"><span class="fav">${esc((host[0]||'?').toUpperCase())}</span><div class="lkm">${ed('text',c.text,host||'Link title','txt lt')}<span class="host">${esc(host||c.url)}</span></div>${/^https:\/\//i.test(c.url)?`<a class="open" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open link">↗</a>`:''}</div>`}
 case 'image':case 'video':case 'audio':return `<div class="im" data-media="${esc(c.media||'')}">${mediaTag(c)}</div>`+ed('text',c.text,'Add a caption','txt cap');
 case 'board':{const b=S.boards[c.board];const n=b?b.cards.filter(x=>!x.col).length:0;
  return `<button class="bic" data-act="open" aria-label="Open board"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg></button>`+(b?ed('btitle',b.title,'Untitled board','txt bt'):'<div class="bt">Missing board</div>')+`<div class="sub">${n} card${n==1?'':'s'}</div>`}
 case 'column':{const kids=c.items.map(id=>find(id)).filter(Boolean);return ed('text',c.text,'Column title','txt ct')+`<div class="colb" data-col="${esc(c.id)}">${kids.map(k=>cardHTML(k,true)).join('')||'<div class="empty">Drop cards here</div>'}</div>`}
 case 'swatch':{const h=okc(c.hex)||'#737a84';return `<label class="sw" style="background:${h}"><input type="color" value="${h}" data-act="hex" aria-label="Pick colour"${P.canWrite?'':' disabled'}></label>`+ed('text',c.text,h,'txt cap')}}}
function cardHTML(c,inCol){const cl=okc(c.color);const strip=cl&&!['board','swatch','heading'].includes(c.type);
 return `<div class="card t-${c.type}${S.sel.has(c.id)?' sel':''}${inCol?' inc':''}" data-id="${esc(c.id)}" style="${inCol?'':`left:${c.x}px;top:${c.y}px;width:${c.w}px;`}${cl?`--c:${cl};`:c.type=='board'?'--c:#737a84;':''}">${strip?'<i class="strip"></i>':''}${inner(c)}${inCol?'':'<span class="rs" data-act="rs"></span>'}</div>`}
function render(){S.needRender=false;const b=B();if(!b)return;world.querySelectorAll(':scope>.card').forEach(e=>e.remove());
 world.insertAdjacentHTML('beforeend',b.cards.filter(c=>!c.col||!find(c.col)).map(c=>cardHTML(c)).join(''));
 $('#empty').hidden=b.cards.length>0;crumbs();applyView();drawLinks();buildCtx();stats();setMode()}
function applyView(){const v=V();world.style.transform=`translate(${v.x}px,${v.y}px) scale(${v.z})`;canvas.style.backgroundPosition=`${v.x}px ${v.y}px`;canvas.style.backgroundSize=`${24*v.z}px ${24*v.z}px`;$('#zl').textContent=Math.round(v.z*100)+'%';placeCtx()}
function edge(a,b){const ax=a.x+a.w/2,ay=a.y+a.h/2,dx=b.x+b.w/2-ax,dy=b.y+b.h/2-ay;if(!dx&&!dy)return[ax,ay];const s=Math.min(dx?Math.abs((a.w/2+7)/dx):1e9,dy?Math.abs((a.h/2+7)/dy):1e9);return[ax+dx*s,ay+dy*s]}
function drawLinks(){const b=B();if(!b)return;svg.innerHTML=`<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs><g transform="translate(20000 20000)">`+b.links.map(l=>{const A=wrect(l.from),Z=wrect(l.to);if(!A||!Z)return'';const[x1,y1]=edge(A,Z),[x2,y2]=edge(Z,A),d=`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;return `<g class="${S.selLink==l.id?'sel':''}" data-link="${esc(l.id)}"><path class="hit" d="${d}"/><path class="vis" d="${d}" marker-end="url(#ah)"/></g>`}).join('')+'</g>'}
let lraf;function linksSoon(){cancelAnimationFrame(lraf);lraf=requestAnimationFrame(()=>{drawLinks();placeCtx()})}
function crumbs(){const p=pathOf(S.cur);$('#crumbs').innerHTML=p.map((b,i)=>i==p.length-1?`<span class="cur" contenteditable="${P.canWrite?'plaintext-only':'false'}" spellcheck="false" id="curT" aria-label="Board name">${esc(b.title)}</span>`:`<button data-go="${esc(b.id)}">${esc(b.title||'Untitled')}</button><i>›</i>`).join('')}
function stats(){const n=Object.keys(S.boards).length;$('#count').textContent=`${n} board${n==1?'':'s'}`;$('#tcount').textContent=`${n} board${n==1?'':'s'}, nested as deep as you like`;if(!$('#drawer').hidden)drawTree()}
function refreshSel(){world.querySelectorAll('.card').forEach(e=>e.classList.toggle('sel',S.sel.has(e.dataset.id)));buildCtx()}
const cb=(a,t)=>`<button class="cb" data-a="${a}">${t}</button>`;
function buildCtx(){
 if(S.selLink&&P.canWrite){ctx.innerHTML=cb('dell','Delete line');ctx.hidden=false;placeCtx();return}
 const ids=[...S.sel].filter(id=>find(id));if(!ids.length){ctx.hidden=true;return}
 const c=find(ids[0]);
 if(!P.canWrite){if(ids.length==1&&c.type=='board'){ctx.innerHTML=cb('open','Open');ctx.hidden=false;placeCtx()}else ctx.hidden=true;return}
 const colorable=ids.every(id=>!['swatch','image','video','audio'].includes(find(id).type));
 ctx.innerHTML=(colorable?COLORS.map(k=>`<button class="dot${(okc(c.color))==k?' on':''}" data-color="${k}" style="--c:${k||'transparent'}" aria-label="${k?'Colour '+k:'No colour'}"></button>`).join('')+'<i class="sep"></i>':'')+(ids.length==1&&c.type=='board'?cb('open','Open'):'')+(ids.length==1?cb('connect','Connect'):'')+cb('dup','Duplicate')+cb('del','Delete');
 ctx.hidden=false;placeCtx()}
function placeCtx(){if(ctx.hidden)return;if(drag&&drag.kind=='move'){ctx.style.visibility='hidden';return}ctx.style.visibility='';const cr=canvas.getBoundingClientRect();let r;
 if(S.selLink&&S.linkPt){r={left:S.linkPt.x-50,top:S.linkPt.y,bottom:S.linkPt.y+10}}else{const e=el([...S.sel][0]);if(!e){ctx.hidden=true;return}r=e.getBoundingClientRect()}
 let top=r.top-cr.top-54;if(top<8)top=r.bottom-cr.top+10;ctx.style.top=top+'px';ctx.style.left=clamp(r.left-cr.left,8,Math.max(8,cr.width-ctx.offsetWidth-8))+'px'}
function setMode(){const m=$('#mode');world.querySelectorAll('.from').forEach(e=>e.classList.remove('from'));$('[data-tool=line]').classList.toggle('on',!!S.connect);
 if(!S.connect){m.hidden=true;return}m.hidden=false;m.textContent=S.connect.from?'Now click the card to connect to · Esc to cancel':'Click the first card · Esc to cancel';if(S.connect.from)el(S.connect.from)?.classList.add('from')}

/* ---------- navigation ---------- */
function show(id){if(!S.boards[id])id='home';S.cur=id;S.sel.clear();S.selLink=null;S.connect=null;const fresh=!S.view[id];render();if(fresh)fit(1)}
function openBoard(id){if(!S.boards[id])return toast('That board no longer exists');show(id);try{location.hash=id}catch(e){}}
addEventListener('hashchange',()=>{const id=location.hash.slice(1)||'home';if(id!==S.cur&&S.boards[id])show(id)});
function fit(maxZ=1.25){const cs=B().cards.filter(c=>!c.col);const cr=canvas.getBoundingClientRect(),v=V();if(!cs.length){Object.assign(v,{x:40,y:30,z:1});applyView();return}
 const rs=cs.map(c=>wrect(c.id)).filter(Boolean);const x0=Math.min(...rs.map(r=>r.x)),y0=Math.min(...rs.map(r=>r.y)),x1=Math.max(...rs.map(r=>r.x+r.w)),y1=Math.max(...rs.map(r=>r.y+r.h));
 const z=clamp(Math.min((cr.width-80)/(x1-x0||1),(cr.height-80)/(y1-y0||1)),.2,maxZ);v.z=z;v.x=(cr.width-(x1-x0)*z)/2-x0*z;v.y=Math.min(40,(cr.height-(y1-y0)*z)/2)-y0*z;applyView();saveViewSoon()}
function zoomBy(f){const cr=canvas.getBoundingClientRect(),v=V(),mx=cr.width/2,my=cr.height/2,nz=clamp(v.z*f,.2,3);v.x=mx-(mx-v.x)*nz/v.z;v.y=my-(my-v.y)*nz/v.z;v.z=nz;applyView();drawLinks();saveViewSoon()}
function focusCard(id){const c=find(id);if(!c)return;const host=c.col||id;const r=wrect(host);if(!r)return;const cr=canvas.getBoundingClientRect(),v=V();v.x=cr.width/2-(r.x+r.w/2)*v.z;v.y=cr.height*.4-(r.y+Math.min(r.h,300)/2)*v.z;applyView();S.sel=new Set([id]);refreshSel();const e=el(id);e.classList.remove('flash');void e.offsetWidth;e.classList.add('flash');saveViewSoon()}

/* ---------- cards ---------- */
let oN=0;const nextO=()=>Date.now()*100+(oN=(oN+1)%100);
function newCard(type,x,y,props={}){const c={id:uid(),type,x:Math.round(x),y:Math.round(y),w:DEFW[type],text:'',o:nextO(),...props};
 if(type=='todo'&&!c.items)c.items=[{t:'',d:false}];
 if(type=='column'){c.items=c.items||[];if(!props.text)c.text='New column'}
 if(type=='swatch'&&!c.hex)c.hex=COLORS[1+Math.floor(Math.random()*9)];
 if(type=='board'&&!c.board){const nb=normalize({id:'b'+uid(),title:'Untitled board',parent:S.cur,cards:[],links:[],created:Date.now()});S.boards[nb.id]=nb;c.board=nb.id;c.color=c.color||COLORS[1+Math.floor(Math.random()*9)]}
 return c}
function addCard(type,pt,col,props){if(!P.canWrite)return null;snap();const c=newCard(type,pt.x,pt.y,props);B().cards.push(c);
 if(col){const k=find(col.id);if(k){c.col=k.id;k.items.splice(col.idx,0,c.id)}}
 S.sel=new Set([c.id]);touch();render();
 if(!props){const f=el(c.id)?.querySelector('[contenteditable],input:not([type=color])');if(f){f.focus();if(type=='board'||type=='column')selectAll(f)}}return c}
function selectAll(n){const r=document.createRange();r.selectNodeContents(n);const s=getSelection();s.removeAllRanges();s.addRange(r)}
function caretEnd(n){const r=document.createRange();r.selectNodeContents(n);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r)}
function focusItem(c,i){const f=el(c.id)?.querySelector(`[data-f="item"][data-i="${i}"]`);if(f){f.focus();caretEnd(f)}}
async function loadImg(file){const url=URL.createObjectURL(file);try{return await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url})}finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}}
async function shrink(file,maxBytes,asUrl){const img=await loadImg(file);let max=asUrl?1600:2600,q=.86,out=null;
 for(let k=0;k<14;k++){const s=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*s)),h=Math.max(1,Math.round(img.height*s));const cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(img,0,0,w,h);
  out=asUrl?cv.toDataURL('image/jpeg',q):await new Promise(r=>cv.toBlob(r,'image/jpeg',q));const size=asUrl?out.length:(out?out.size:Infinity);if(size<maxBytes)break;if(q>.62)q-=.08;else max=Math.round(max*.8)}return out}
async function addMedia(files,pt,col){if(!P.canWrite)return;files=[...files].filter(f=>f&&/^(image|video|audio)\//.test(f.type));if(!files.length)return toast('Only pictures, videos and audio can go on the board');
 for(let i=0;i<files.length;i++){const f=files[i],at={x:pt.x+i*30,y:pt.y+i*30};status(`Adding ${i+1} of ${files.length}…`);
  try{const id=await Store.putMedia(f);addCard(f.type.startsWith('video/')?'video':f.type.startsWith('audio/')?'audio':'image',at,col,{media:id})}catch(e){fail(e)}}
 settled()}
function collect(id,out){if(out.includes(id)||!S.boards[id])return;out.push(id);S.boards[id].cards.forEach(c=>{if(c.type=='board')collect(c.board,out)})}
async function delSel(){if(!P.canWrite)return;
 if(S.selLink){snap();B().links=B().links.filter(l=>l.id!=S.selLink);S.selLink=null;touch();drawLinks();buildCtx();return}
 const b=B(),ids=new Set();[...S.sel].forEach(id=>{const c=find(id);if(!c)return;ids.add(id);if(c.type=='column')c.items.forEach(k=>ids.add(k))});if(!ids.size)return;
 const gone=b.cards.filter(c=>ids.has(c.id)),subs=[];gone.forEach(c=>{if(c.type=='board')collect(c.board,subs)});
 const n=subs.reduce((m,id)=>m+S.boards[id].cards.length,0);
 if(n&&!await confirmBox(`Delete ${subs.length==1?'this board':subs.length+' boards'} and the ${n} card${n==1?'':'s'} inside, for everyone? You can undo with Ctrl+Z while this tab stays open.`,'Delete'))return;
 snap();b.cards.forEach(c=>{if(c.type=='column')c.items=c.items.filter(k=>!ids.has(k))});
 b.cards=b.cards.filter(c=>!ids.has(c.id));b.links=b.links.filter(l=>!ids.has(l.from)&&!ids.has(l.to));
 subs.forEach(id=>delete S.boards[id]);S.sel.clear();touch();render()}
function copyBoard(id,parent,suffix){const src=S.boards[id]||{title:'Untitled board',cards:[],links:[]};const nb=JSON.parse(JSON.stringify(src));nb.id='b'+uid();nb.parent=parent;nb.created=Date.now();if(suffix)nb.title=src.title+' copy';
 const map={};nb.cards.forEach(c=>map[c.id]=uid());
 nb.cards=nb.cards.map(c=>{const k={...c,id:map[c.id]};if(k.col)k.col=map[k.col];if(k.type=='column')k.items=k.items.map(x=>map[x]).filter(Boolean);if(k.type=='board')k.board=copyBoard(c.board,nb.id);return k});
 nb.links=nb.links.filter(l=>map[l.from]&&map[l.to]).map(l=>({id:uid(),from:map[l.from],to:map[l.to]}));S.boards[nb.id]=nb;return nb.id}
function dup(){if(!P.canWrite)return;const b=B(),top=[...S.sel].map(find).filter(c=>c&&!c.col);if(!top.length)return toast('Duplicate works on cards that aren’t inside a column');snap();const fresh=new Set();
 top.forEach(c=>{const k=JSON.parse(JSON.stringify(c));k.id=uid();k.x+=28;k.y+=28;k.o=nextO();if(k.type=='board')k.board=copyBoard(c.board,S.cur,true);
  if(k.type=='column'){k.items=c.items.map(id=>{const ch=find(id);if(!ch)return null;const n=JSON.parse(JSON.stringify(ch));n.id=uid();n.col=k.id;n.o=nextO();if(n.type=='board')n.board=copyBoard(ch.board,S.cur,true);b.cards.push(n);return n.id}).filter(Boolean)}
  b.cards.push(k);fresh.add(k.id)});S.sel=fresh;touch();render()}
function moveToBoard(cards,tid){const src=B(),dst=S.boards[tid];if(!dst)return;const all=[];
 cards.forEach(c=>{all.push(c);if(c.type=='column')c.items.forEach(k=>{const kc=find(k);if(kc)all.push(kc)})});
 const ids=new Set(all.map(c=>c.id));src.cards=src.cards.filter(c=>!ids.has(c.id));src.links=src.links.filter(l=>!ids.has(l.from)&&!ids.has(l.to));
 const x0=Math.min(...cards.map(c=>c.x)),y0=Math.min(...cards.map(c=>c.y)),floor=dst.cards.filter(c=>!c.col).reduce((m,c)=>Math.max(m,c.y+220),40);
 cards.forEach(c=>{c.x=c.x-x0+60;c.y=c.y-y0+floor});all.forEach(c=>{if(c.type=='board'&&S.boards[c.board])S.boards[c.board].parent=tid;dst.cards.push(c)});
 S.sel.clear();touch();toast(`Moved ${cards.length} card${cards.length>1?'s':''} into “${dst.title||'Untitled board'}”`)}
function undo(isRedo){if(!P.canWrite)return;const from=isRedo?S.redo:S.undo,to=isRedo?S.undo:S.redo;if(!from.length)return toast(isRedo?'Nothing to redo':'Nothing to undo');
 if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
 flushNow();const e=from.pop(),cur=docsOf(S.boards);to.push({docs:Object.fromEntries([...cur].map(([k,v])=>[k,stable(v)])),t:Date.now()});
 const out=new Map(cur);for(const[k,t]of P.mine)if(t>=e.t){if(e.docs[k]!=null)out.set(k,JSON.parse(e.docs[k]));else out.delete(k)}
 S.boards=buildBoards(out);if(!S.boards[S.cur])S.cur='home';S.sel.clear();S.selLink=null;P.dirty=true;flushNow();render()}
function connectClick(id){if(!S.connect.from){S.connect.from=id;setMode();return}if(id==S.connect.from)return;const b=B(),a=S.connect.from;
 if(!b.links.some(l=>l.from==a&&l.to==id||l.from==id&&l.to==a)){snap();b.links.push({id:uid(),from:a,to:id});touch()}S.connect=null;setMode();drawLinks()}

/* ---------- pointer: canvas ---------- */
function dropTarget(under,exclude,type,y){if(!under)return null;
 const bc=under.closest('.card.t-board');if(bc&&!exclude.has(bc.dataset.id))return{type:'board',el:bc,id:bc.dataset.id};
 const cc=under.closest('.card.t-column');if(cc&&!exclude.has(cc.dataset.id)&&type&&type!='column'){const body=cc.querySelector('.colb');const kids=[...body.querySelectorAll(':scope>.card')].filter(k=>!exclude.has(k.dataset.id));
  return{type:'col',el:cc,id:cc.dataset.id,idx:kids.filter(k=>{const r=k.getBoundingClientRect();return r.top+r.height/2<y}).length}}return null}
function clearDrop(){world.querySelectorAll('.drop').forEach(x=>x.classList.remove('drop'))}
let pending=null;function snap0(){if(pending){pushUndo(pending);pending=null}}
canvas.addEventListener('pointerdown',()=>{if(P.canWrite)flushNow();pending=P.canWrite?snapState():null},true);
canvas.addEventListener('pointerdown',e=>{if(e.button>0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size==2){if(drag&&drag.kind=='move'){drag.items.forEach(i=>i.e.classList.remove('dragging'));render()}drag=null;const[a,b]=[...pointers.values()];const v=V();pinch={d:Math.hypot(a.x-b.x,a.y-b.y)||1,mx:(a.x+b.x)/2,my:(a.y+b.y)/2,v:{...v}};return}
 const t=e.target,lk=t.closest('[data-link]');
 if(lk&&!S.connect){S.selLink=lk.dataset.link;S.linkPt={x:e.clientX,y:e.clientY};S.sel.clear();refreshSel();drawLinks();return}
 const card=t.closest('.card');
 if(!card){if(isEditing())document.activeElement.blur();if(S.sel.size||S.selLink){S.sel.clear();S.selLink=null;refreshSel();drawLinks()}if(S.connect){S.connect=null;setMode()}
  drag={kind:'pan',sx:e.clientX,sy:e.clientY,v:{...V()}};canvas.classList.add('pan');canvas.setPointerCapture(e.pointerId);return}
 const id=card.dataset.id;
 if(S.connect){e.preventDefault();connectClick(id);return}
 if(t.closest('[data-act=rs]')&&P.canWrite){e.preventDefault();snap();drag={kind:'rs',id,sx:e.clientX,w:find(id).w};canvas.setPointerCapture(e.pointerId);return}
 if(t.closest('input,button,a,form,label,video,audio'))return;
 const editable=P.canWrite&&t.closest('[contenteditable=plaintext-only]');if(editable&&editable===document.activeElement)return;
 e.preventDefault();if(isEditing())document.activeElement.blur();
 if(e.shiftKey){S.sel.has(id)?S.sel.delete(id):S.sel.add(id)}else if(!S.sel.has(id))S.sel=new Set([id]);
 S.selLink=null;refreshSel();drawLinks();drag={kind:'maybe',id,sx:e.clientX,sy:e.clientY,editable};canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener('pointermove',e=>{if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pinch&&pointers.size>=2){const[a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y),cr=canvas.getBoundingClientRect(),v=V(),p=pinch;const nz=clamp(p.v.z*d/p.d,.2,3),mx=p.mx-cr.left,my=p.my-cr.top,nx=(a.x+b.x)/2-cr.left,ny=(a.y+b.y)/2-cr.top;
  v.z=nz;v.x=nx-(mx-p.v.x)*nz/p.v.z;v.y=ny-(my-p.v.y)*nz/p.v.z;applyView();linksSoon();return}
 if(!drag)return;const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy,z=V().z;
 if(drag.kind=='pan'){const v=V();v.x=drag.v.x+dx;v.y=drag.v.y+dy;applyView();return}
 if(drag.kind=='rs'){const c=find(drag.id);if(!c)return;c.w=Math.max(MINW[c.type],Math.round(drag.w+dx/z));el(c.id).style.width=c.w+'px';linksSoon();return}
 if(drag.kind=='maybe'){if(Math.hypot(dx,dy)<5||!P.canWrite)return;startMove()}
 if(drag.kind=='move'){const wx=dx/z,wy=dy/z;drag.items.forEach(i=>{i.c.x=Math.round(i.x+wx);i.c.y=Math.round(i.y+wy);i.e.style.left=i.c.x+'px';i.e.style.top=i.c.y+'px'});
  const ex=new Set(drag.items.map(i=>i.c.id));const tg=dropTarget(document.elementFromPoint(e.clientX,e.clientY),ex,drag.items.length==1?drag.items[0].c.type:null,e.clientY);
  clearDrop();if(tg)tg.el.classList.add('drop');drag.tgt=tg;linksSoon()}});
function startMove(){const c=find(drag.id);if(!c){drag=null;return}
 if(c.col){const r=wrect(c.id),col=find(c.col);snap0();if(col)col.items=col.items.filter(x=>x!=c.id);c.col=null;c.x=Math.round(r.x);c.y=Math.round(r.y);c.w=Math.round(r.w);S.sel=new Set([c.id]);render()}else snap0();
 const ids=[...S.sel].filter(id=>{const k=find(id);return k&&!k.col});if(!ids.includes(c.id))ids.push(c.id);
 drag={kind:'move',id:c.id,sx:drag.sx,sy:drag.sy,items:ids.map(id=>{const k=find(id);return{c:k,x:k.x,y:k.y,e:el(id)}})};drag.items.forEach(i=>i.e.classList.add('dragging'));placeCtx()}
function endPtr(e){pointers.delete(e.pointerId);canvas.classList.remove('pan');
 if(pinch){if(pointers.size<2){pinch=null;saveViewSoon();drawLinks();if(S.needRender)render()}return}
 if(!drag)return;const d=drag;drag=null;
 if(d.kind=='pan'){saveViewSoon();if(S.needRender)render();return}
 if(d.kind=='rs'){touch();linksSoon();if(S.needRender)render();return}
 if(d.kind=='maybe'){if(S.needRender){render();return}if(d.editable&&e.type=='pointerup'){d.editable.focus();placeCaret(e.clientX,e.clientY)}return}
 if(d.kind=='move'){d.items.forEach(i=>i.e.classList.remove('dragging'));clearDrop();const t=d.tgt;
  if(t&&t.type=='board'){const bc=find(t.id);if(bc)moveToBoard(d.items.map(i=>i.c),bc.board)}
  else if(t&&t.type=='col'){const col=find(t.id),c=d.items[0].c;if(col){c.col=col.id;col.items.splice(t.idx,0,c.id);S.sel=new Set([c.id])}}
  touch();render()}}
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',endPtr);
function placeCaret(x,y){let r=null;if(document.caretRangeFromPoint)r=document.caretRangeFromPoint(x,y);else if(document.caretPositionFromPoint){const p=document.caretPositionFromPoint(x,y);if(p){r=document.createRange();r.setStart(p.offsetNode,p.offset)}}
 const a=document.activeElement;if(r&&a&&a.contains(r.startContainer)){const s=getSelection();s.removeAllRanges();s.addRange(r)}else if(a)caretEnd(a)}
canvas.addEventListener('wheel',e=>{e.preventDefault();const v=V();
 if(e.ctrlKey||e.metaKey){const cr=canvas.getBoundingClientRect(),mx=e.clientX-cr.left,my=e.clientY-cr.top,nz=clamp(v.z*Math.exp(-e.deltaY*.01),.2,3);v.x=mx-(mx-v.x)*nz/v.z;v.y=my-(my-v.y)*nz/v.z;v.z=nz;linksSoon()}
 else{v.x-=e.shiftKey&&!e.deltaX?e.deltaY:e.deltaX;v.y-=e.shiftKey&&!e.deltaX?0:e.deltaY}applyView();saveViewSoon()},{passive:false});
canvas.addEventListener('dblclick',e=>{const c=e.target.closest('.card.t-board');if(c&&!e.target.closest('[contenteditable=plaintext-only]')){const k=find(c.dataset.id);if(k)openBoard(k.board);return}
 if(!e.target.closest('.card')&&P.canWrite){const p=worldPt(e.clientX,e.clientY);addCard('note',{x:p.x-130,y:p.y-20})}});
canvas.addEventListener('dragover',e=>{e.preventDefault()});
canvas.addEventListener('drop',e=>{e.preventDefault();if(!P.canWrite)return;const p=worldPt(e.clientX,e.clientY);const fs=[...(e.dataTransfer.files||[])];const bf=fs.find(f=>/\.board$/i.test(f.name));if(bf){importBoardFile(bf);return}if(fs.length){addMedia(fs,{x:p.x-140,y:p.y-80});return}
 const u=(e.dataTransfer.getData('text/uri-list')||e.dataTransfer.getData('text/plain')||'').trim();if(/^https?:\/\/\S+$/i.test(u))addCard('link',{x:p.x-150,y:p.y-30},null,{url:u,text:titleFrom(u)});else if(u)addCard('note',{x:p.x-130,y:p.y-30},null,{text:u})});
world.addEventListener('load',linksSoon,true);
world.addEventListener('loadedmetadata',linksSoon,true);
world.addEventListener('error',e=>{const t=e.target;if(t&&(t.tagName=='IMG'||t.tagName=='VIDEO')){const ph=document.createElement('div');ph.className='ph';ph.textContent=t.tagName=='IMG'?'This picture can’t be shown':'This browser can’t play this video format';t.replaceWith(ph);linksSoon()}},true);

/* ---------- editing inside cards ---------- */
world.addEventListener('focusin',()=>{S.editSnapped=false});
world.addEventListener('focusout',()=>setTimeout(()=>{if(S.needRender&&!isEditing()&&!drag)render()},0));
world.addEventListener('input',e=>{if(!P.canWrite)return;const t=e.target,card=t.closest('.card');if(!card)return;const c=find(card.dataset.id);if(!c)return;
 if(!S.editSnapped){snap();S.editSnapped=true}
 if(t.dataset.act=='hex'){c.hex=t.value;t.parentNode.style.background=t.value;const cap=card.querySelector('.cap');if(cap)cap.dataset.ph=t.value;touch();return}
 const f=t.dataset.f,v=t.innerText.replace(/\n$/,'');if(!f)return;
 if(f=='text')c.text=v;else if(f=='item'){if(c.items[+t.dataset.i])c.items[+t.dataset.i].t=v}else if(f=='btitle'){const b=S.boards[c.board];if(b)b.title=v}
 touch();linksSoon()});
world.addEventListener('keydown',e=>{const t=e.target;if(!t.dataset||!t.dataset.f||!P.canWrite)return;
 if(e.key=='Escape'){t.blur();window.getSelection().removeAllRanges();return}
 const c=find(t.closest('.card').dataset.id);if(!c)return;
 if(t.dataset.f=='item'){const i=+t.dataset.i;
  if(e.key=='Enter'){e.preventDefault();snap();c.items.splice(i+1,0,{t:'',d:false});touch();render();focusItem(c,i+1)}
  else if(e.key=='Backspace'&&!t.innerText.trim()){e.preventDefault();snap();c.items.splice(i,1);touch();render();if(i>0)focusItem(c,i-1)}
  return}
 if(e.key=='Enter'&&!e.shiftKey&&c.type!='note'){e.preventDefault();if(c.type=='todo'&&t.dataset.f=='text'){if(!c.items.length){c.items.push({t:'',d:false});touch();render()}focusItem(c,0)}else t.blur()}});
world.addEventListener('click',e=>{const a=e.target.closest('[data-act]');if(!a)return;const card=a.closest('.card'),c=card&&find(card.dataset.id);if(!c)return;
 const k=a.dataset.act;
 if(k=='open')return openBoard(c.board);
 if(!P.canWrite)return;
 if(k=='ck'){snap();const it=c.items[+a.dataset.i];if(it)it.d=!it.d;touch();render()}
 else if(k=='additem'){snap();c.items.push({t:'',d:false});touch();render();focusItem(c,c.items.length-1)}});
world.addEventListener('submit',e=>{e.preventDefault();if(!P.canWrite)return;const f=e.target,c=find(f.closest('.card').dataset.id);let u=f.u.value.trim();if(!u||!c)return;if(!/^[a-z]+:\/\//i.test(u))u='https://'+u;snap();c.url=u;if(!c.text)c.text=titleFrom(u);touch();render()});
$('#crumbs').addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)openBoard(b.dataset.go)});
$('#crumbs').addEventListener('focusin',e=>{if(e.target.id=='curT')S.crumbSnapped=false});
$('#crumbs').addEventListener('input',e=>{if(e.target.id=='curT'&&P.canWrite){if(!S.crumbSnapped){snap();S.crumbSnapped=true}B().title=e.target.innerText.trim();touch()}});
$('#crumbs').addEventListener('keydown',e=>{if(e.target.id=='curT'&&(e.key=='Enter'||e.key=='Escape')){e.preventDefault();e.target.blur()}});
$('#crumbs').addEventListener('focusout',()=>setTimeout(()=>{if(S.needRender&&!isEditing()&&!drag)render()},0));

/* ---------- context bar ---------- */
ctx.addEventListener('pointerdown',e=>e.preventDefault());
ctx.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 const a=b.dataset.a,first=find([...S.sel][0]);
 if(a=='open'&&first)return openBoard(first.board);
 if(!P.canWrite)return;
 if(b.dataset.color!==undefined){snap();S.sel.forEach(id=>{const c=find(id);if(c)c.color=b.dataset.color});touch();render();return}
 if(a=='del'||a=='dell')delSel();else if(a=='dup')dup();
 else if(a=='connect'&&first){S.connect={from:first.id};setMode()}});

/* ---------- toolbar ---------- */
$('#tb').innerHTML=TOOLS.map(([k,l])=>`<button class="tool" data-tool="${k}" title="${k=='line'?'Line: click two cards to connect them':k=='image'?'Pictures, videos and audio: click to add, or drop files on the board':k=='voice'?'Voice note: click to record':l+': click, or drag onto the board'}"><svg viewBox="0 0 24 24">${ICON[k]}</svg>${l}</button>`).join('');
const tb=$('#tb');
const pickMedia=(pt,col)=>{S.pendingMedia={pt,col};$('#file').click()};
tb.addEventListener('pointerdown',e=>{const b=e.target.closest('[data-tool]');if(!b||e.button>0)return;const tool=b.dataset.tool;if(tool=='line')return;e.preventDefault();tdrag={tool,sx:e.clientX,sy:e.clientY,ghost:null};b.setPointerCapture(e.pointerId)});
tb.addEventListener('pointermove',e=>{if(!tdrag)return;if(!tdrag.ghost){if(Math.hypot(e.clientX-tdrag.sx,e.clientY-tdrag.sy)<6)return;const g=document.createElement('div');g.className='ghost';g.textContent=TOOLS.find(t=>t[0]==tdrag.tool)[1];document.body.append(g);tdrag.ghost=g}
 tdrag.ghost.style.left=e.clientX+'px';tdrag.ghost.style.top=e.clientY+'px';const tg=dropTarget(document.elementFromPoint(e.clientX,e.clientY),new Set(),tdrag.tool,e.clientY);clearDrop();if(tg&&tg.type=='col')tg.el.classList.add('drop');tdrag.tgt=tg});
function endTool(e){if(!tdrag)return;const d=tdrag;tdrag=null;clearDrop();
 if(d.ghost){d.ghost.remove();const cr=canvas.getBoundingClientRect();if(e.type=='pointercancel'||e.clientX<cr.left||e.clientX>cr.right||e.clientY<cr.top||e.clientY>cr.bottom)return;
  const p=worldPt(e.clientX,e.clientY),col=d.tgt&&d.tgt.type=='col'?d.tgt:null,pt={x:p.x-DEFW[d.tool]*.3,y:p.y-24};
  if(d.tool=='image')pickMedia(pt,col);else if(d.tool=='voice')recordVoice(pt,col);else addCard(d.tool,pt,col);if(S.needRender)render();return}
 if(e.type=='pointercancel')return;
 if(d.tool=='image')pickMedia(centerPt(280),null);else if(d.tool=='voice')recordVoice(centerPt(300),null);else addCard(d.tool,centerPt(DEFW[d.tool]))}
tb.addEventListener('pointerup',endTool);tb.addEventListener('pointercancel',endTool);
tb.addEventListener('click',e=>{const b=e.target.closest('[data-tool=line]');if(!b)return;S.sel.clear();refreshSel();S.connect=S.connect?null:{from:null};setMode()});
tb.addEventListener('keydown',e=>{const b=e.target.closest('[data-tool]');if(b&&(e.key=='Enter'||e.key==' ')&&b.dataset.tool!='line'){e.preventDefault();const t=b.dataset.tool;if(t=='image')pickMedia(centerPt(280),null);else if(t=='voice')recordVoice(centerPt(300),null);else addCard(t,centerPt(DEFW[t]))}});
$('#file').addEventListener('change',e=>{const p=S.pendingMedia||{pt:centerPt(280)};addMedia(e.target.files,p.pt,p.col);e.target.value=''});

/* ---------- keyboard + paste ---------- */
document.addEventListener('keydown',e=>{const mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
 if(mod&&k=='k'){e.preventDefault();openSearch();return}
 if(!$('#search').hidden||!$('#dlg').hidden){if(e.key=='Escape')closeOv();return}
 if(isEditing())return;
 if(e.key=='Escape'){S.sel.clear();S.selLink=null;S.connect=null;setMode();refreshSel();drawLinks();return}
 if(k=='/'&&!mod){e.preventDefault();openSearch();return}
 if(e.key=='Enter'&&S.sel.size==1){const c=find([...S.sel][0]);if(c&&c.type=='board')return openBoard(c.board)}
 if(!P.canWrite)return;
 if(mod&&k=='z'){e.preventDefault();undo(e.shiftKey);return}
 if(mod&&k=='y'){e.preventDefault();undo(true);return}
 if(mod&&k=='d'){e.preventDefault();dup();return}
 if(mod&&k=='a'){e.preventDefault();S.sel=new Set(B().cards.filter(c=>!c.col).map(c=>c.id));refreshSel();return}
 if(e.key=='Delete'||e.key=='Backspace'){if(S.sel.size||S.selLink){e.preventDefault();delSel()}return}
 if(mod||e.altKey)return;
 if(k=='n'){e.preventDefault();addCard('note',centerPt())}
 else if(e.key=='Enter'&&S.sel.size==1){const c=find([...S.sel][0]);const f=c&&el(c.id)?.querySelector('[contenteditable=plaintext-only]');if(f){e.preventDefault();f.focus();caretEnd(f)}}});
document.addEventListener('paste',e=>{if(!P.canWrite||isEditing()||!$('#search').hidden||!$('#dlg').hidden)return;const cd=e.clipboardData;if(!cd)return;
 const files=[...cd.items].filter(i=>i.kind=='file'&&/^(image|video|audio)\//.test(i.type)).map(i=>i.getAsFile());
 if(files.length){e.preventDefault();addMedia(files,centerPt(280));return}
 const txt=cd.getData('text/plain').trim();if(!txt)return;e.preventDefault();
 if(/^https?:\/\/\S+$/i.test(txt))addCard('link',centerPt(300),null,{url:txt,text:titleFrom(txt)});else addCard('note',centerPt(),null,{text:txt})});

/* ---------- search, drawer, dialogs ---------- */
function closeOv(){$('#search').hidden=true;$('#dlg').hidden=true;if(S.confirmRes){S.confirmRes(false);S.confirmRes=null}}
document.querySelectorAll('.ov').forEach(o=>o.addEventListener('pointerdown',e=>{if(e.target===o)closeOv()}));
const TN={note:'Note',heading:'Heading',todo:'To-do',link:'Link',image:'Picture',video:'Video',audio:'Voice note',board:'Board',column:'Column',swatch:'Colour'};
let results=[],rsel=0;
function openSearch(){$('#search').hidden=false;const q=$('#sq');q.value='';doSearch();setTimeout(()=>q.focus(),0)}
function doSearch(){const q=$('#sq').value.trim().toLowerCase();results=[];
 if(q){outer:for(const b of Object.values(S.boards)){for(const c of b.cards){const sub=c.type=='board'&&S.boards[c.board];const hay=[c.text,c.url,c.hex,sub&&sub.title,...(c.type=='todo'?c.items.map(i=>i.t):[])].filter(Boolean).join(' \n ');
  const at=hay.toLowerCase().indexOf(q);if(at<0)continue;const line=hay.slice(Math.max(0,at-30),at+70).replace(/\s+/g,' ').trim();results.push({b:b.id,c:c.id,label:line,kind:TN[c.type],path:pathOf(b.id).map(x=>x.title||'Untitled').join(' › ')});if(results.length>80)break outer}}}
 rsel=0;$('#sr').innerHTML=!q?'<div class="nores">Type to search notes, lists, links, captions and board names across every board.</div>':results.length?results.map((r,i)=>`<button class="res${i==0?' on':''}" data-i="${i}">${esc(r.label)}<small>${esc(r.kind)} · ${esc(r.path)}</small></button>`).join(''):'<div class="nores">Nothing matches that yet.</div>'}
function goResult(i){const r=results[i];if(!r)return;closeOv();openBoard(r.b);requestAnimationFrame(()=>focusCard(r.c))}
$('#sq').addEventListener('input',doSearch);
$('#sq').addEventListener('keydown',e=>{if(e.key=='Enter'){e.preventDefault();goResult(rsel)}else if(e.key=='ArrowDown'||e.key=='ArrowUp'){e.preventDefault();rsel=clamp(rsel+(e.key=='ArrowDown'?1:-1),0,Math.max(0,results.length-1));document.querySelectorAll('.res').forEach((x,i)=>x.classList.toggle('on',i==rsel));document.querySelector('.res.on')?.scrollIntoView({block:'nearest'})}});
$('#sr').addEventListener('click',e=>{const b=e.target.closest('.res');if(b)goResult(+b.dataset.i)});
$('#bSearch').onclick=openSearch;
function drawTree(){const seen=new Set();const walk=(id,d,col)=>{if(seen.has(id)||!S.boards[id])return'';seen.add(id);const b=S.boards[id];
  return `<button class="tr${id==S.cur?' on':''}" data-go="${esc(id)}" style="padding-left:${12+Math.min(d,8)*16}px"><i style="background:${col}"></i><span>${esc(b.title||'Untitled board')}</span><em>${b.cards.filter(c=>!c.col).length}</em></button>`+b.cards.filter(c=>c.type=='board').map(c=>walk(c.board,d+1,okc(c.color)||'#737a84')).join('')};
 let h=walk('home',0,'var(--ink)');const lost=Object.keys(S.boards).filter(id=>!seen.has(id));if(lost.length)h+=`<div class="nores" style="padding:12px 12px 4px">Not linked from any board</div>`+lost.map(id=>walk(id,0,'#737a84')).join('');$('#tree').innerHTML=h}
$('#bTree').onclick=()=>{const d=$('#drawer');d.hidden=!d.hidden;if(!d.hidden)drawTree()};$('#tClose').onclick=()=>$('#drawer').hidden=true;
$('#tree').addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b){openBoard(b.dataset.go);if(innerWidth<700)$('#drawer').hidden=true}});
function modal(h){$('#dlgp').innerHTML=h;$('#dlg').hidden=false;$('#dlgp').querySelectorAll('[data-close]').forEach(b=>b.onclick=closeOv);return $('#dlgp')}
function confirmBox(msg,ok){return new Promise(res=>{const m=modal(`<h2>Are you sure?</h2><p>${esc(msg)}</p><div class="row"><button class="pri" id="cOk">${esc(ok)}</button><button id="cNo">Cancel</button></div>`);S.confirmRes=res;
 m.querySelector('#cOk').onclick=()=>{S.confirmRes=null;$('#dlg').hidden=true;res(true)};m.querySelector('#cNo').onclick=closeOv;m.querySelector('#cOk').focus()})}
/* ---------- voice notes ---------- */
// Records from the microphone and saves the recording on this device as a voice-note card.
async function recordVoice(pt,col){if(!P.canWrite)return;
 if(!navigator.mediaDevices||!window.MediaRecorder)return toast('This browser can’t record audio. Try Chrome, Edge, Firefox or Safari.');
 let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){return toast('Microphone access was blocked. Allow it in the browser’s address bar and try again.')}
 const types=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg'];const mime=types.find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t))||'';
 const rec=new MediaRecorder(stream,mime?{mimeType:mime}:undefined),chunks=[];let keep=true,t0=Date.now(),iv;
 rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
 const m=modal(`<h2>Recording a voice note</h2><p><span class="recdot"></span><b id="rt">0:00</b> · speak now</p><div class="row"><button class="pri" id="rs">Stop and save</button><button id="rc">Cancel</button></div>`);
 const stop=save=>{keep=save;clearInterval(iv);if(rec.state!='inactive')rec.stop();stream.getTracks().forEach(t=>t.stop());$('#dlg').hidden=true;S.confirmRes=null};
 S.confirmRes=()=>stop(false);
 m.querySelector('#rs').onclick=()=>stop(true);m.querySelector('#rc').onclick=()=>stop(false);
 iv=setInterval(()=>{const s=Math.floor((Date.now()-t0)/1000);const el2=m.querySelector('#rt');if(el2)el2.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0')},250);
 rec.onstop=async()=>{if(!keep||!chunks.length)return;const blob=new Blob(chunks,{type:(rec.mimeType||mime||'audio/webm').split(';')[0]});
  try{const id=await Store.putMedia(blob);const s=Math.round((Date.now()-t0)/1000);addCard('audio',pt,col,{media:id,text:'Voice note · '+new Date().toLocaleString([], {dateStyle:'medium',timeStyle:'short'})+' · '+Math.floor(s/60)+':'+String(s%60).padStart(2,'0')})}catch(e){fail(e)}};
 rec.start(1000)}

/* ---------- share: board files ---------- */
// A .board file = "BRDS1" + 4-byte length + JSON (boards + media list) + the media files one after another.
const MAGIC='BRDS1';
function safeName(t){return (String(t||'board').replace(/[\\/:*?"<>|]+/g,' ').trim().slice(0,60)||'board')}
async function exportBoard(rootId){const ids=[];collect(rootId,ids);const boards={};ids.forEach(id=>boards[id]=S.boards[id]);
 const mids=[...new Set(ids.flatMap(id=>S.boards[id].cards.filter(c=>c.media).map(c=>c.media)))];status('Preparing file…');
 const media=[],parts=[];for(const id of mids){const b=await Store.getMedia(id).catch(()=>null);if(b){media.push({id,size:b.size,type:b.type||''});parts.push(b)}}
 const json=new TextEncoder().encode(JSON.stringify({app:'boards',v:1,root:rootId,boards,media}));const len=new Uint8Array(4);new DataView(len.buffer).setUint32(0,json.length,true);
 const file=new Blob([MAGIC,len,json,...parts],{type:'application/octet-stream'});const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=safeName(S.boards[rootId].title)+'.board';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000);
 settled();toast(`Downloaded “${a.download}” (${mb(file.size)})`)}
async function importBoardFile(file){if(!P.canWrite)return;try{
 const head=new Uint8Array(await file.slice(0,9).arrayBuffer());if(new TextDecoder().decode(head.slice(0,5))!==MAGIC)throw 0;
 const n=new DataView(head.buffer).getUint32(5,true);const o=JSON.parse(await file.slice(9,9+n).text());if(!o||typeof o.boards!='object'||!o.boards[o.root])throw 0;
 status('Opening file…');let off=9+n;const mediaMap={};
 for(const m of (Array.isArray(o.media)?o.media:[])){const size=+m.size||0;const blob=file.slice(off,off+size,String(m.type||''));off+=size;mediaMap[m.id]=await Store.putMedia(blob)}
 const src={};for(const[k,b]of Object.entries(o.boards))if(okId(k)&&b&&Array.isArray(b.cards))src[k]=normalize({...b,id:k});
 snap();const seen=new Set();
 const clone=(id,parent)=>{const b=src[id];if(!b||seen.has(id))return null;seen.add(id);const nb=JSON.parse(JSON.stringify(b));nb.id='b'+uid();nb.parent=parent;const map={};nb.cards.forEach(c=>map[c.id]=uid());
  nb.cards=nb.cards.map(c=>{const k={...c,id:map[c.id]};if(k.col)k.col=map[k.col]||null;if(k.type=='column')k.items=k.items.map(x=>map[x]).filter(Boolean);if(k.media)k.media=mediaMap[k.media]||k.media;if(k.type=='board')k.board=clone(c.board,nb.id)||'';return k});
  nb.links=nb.links.filter(l=>map[l.from]&&map[l.to]).map(l=>({id:uid(),from:map[l.from],to:map[l.to]}));S.boards[nb.id]=nb;return nb.id};
 const rootNew=clone(o.root,S.cur);const rb=S.boards[rootNew];if(o.root=='home'&&rb.title=='Home')rb.title='Imported boards';
 const pt=centerPt(170);const c=newCard('board',pt.x,pt.y,{board:rootNew,color:'#2a9ec4'});B().cards.push(c);S.sel=new Set([c.id]);touch();render();
 toast(`Added “${rb.title}” to this board`)}catch(e){status(savedText());toast('That file isn’t a board file from this app')}}
$('#bShare').onclick=()=>{const cur=B();const m=modal(`<h2>Share a board</h2><p>Boards are saved on this device. To share one, download it as a file and send it any way you like: WhatsApp, email, Google Drive or a USB stick. The other person opens it here with “Open a board file”. Pictures and videos travel inside the file.</p>
 <div class="row"><button class="pri" id="exCur">Download “${esc(cur.title||'Untitled board')}”</button><button id="exAll">Download everything</button><button id="imp">Open a board file</button><button data-close>Close</button></div>`);
 m.querySelector('#exCur').onclick=()=>{closeOv();exportBoard(S.cur)};m.querySelector('#exAll').onclick=()=>{closeOv();exportBoard('home')};m.querySelector('#imp').onclick=()=>{closeOv();$('#boardFile').click()}};
$('#boardFile').addEventListener('change',e=>{const f=e.target.files[0];if(f)importBoardFile(f);e.target.value=''});
$('#bStore').onclick=async()=>{const m=modal(`<h2>Storage on this device</h2><p>Checking…</p>`);let u={used:0,available:0,persisted:false},list=[];
 try{u=await Store.usage();list=await Store.listMedia()}catch(e){}
 const used=new Set();Object.values(S.boards).forEach(b=>b.cards.forEach(c=>{if(c.media)used.add(c.media)}));const unused=list.filter(x=>!used.has(x.id)),ub=unused.reduce((n,x)=>n+x.size,0);
 const pct=u.available?Math.min(100,u.used/u.available*100):0;
 m.innerHTML=`<h2>Storage on this device</h2><p>Your boards, pictures and videos are saved here on this device, not on a server, so the only limit is this device’s free space. Each browser and device keeps its own copy.</p><div class="meter"><i style="width:${pct.toFixed(1)}%"></i></div>
 <div class="kv"><span>Used</span><b>${esc(mb(u.used))}</b><span>Space this app may use</span><b>${u.available?esc(mb(u.available)):'Not reported'}</b><span>Protected from clean-up</span><b>${u.persisted?'Yes':'Not yet'}</b><span>Media not on any board</span><b>${unused.length} file${unused.length==1?'':'s'} · ${esc(mb(ub))}</b></div>
 <p style="margin-top:12px">Browsers can clear website data when a device runs low on space. “Protect my boards” asks the browser not to, and downloading everything now and then (Share → Download everything) keeps a backup.</p>
 <div class="row">${u.persisted?'':'<button class="pri" id="keep">Protect my boards</button>'}${unused.length?'<button id="clean">Remove unused media</button>':''}<button data-close>Close</button></div>`;
 m.querySelector('[data-close]').onclick=closeOv;
 const k=m.querySelector('#keep');if(k)k.onclick=async()=>{const ok=await Store.keepSafe().catch(()=>false);toast(ok?'Your boards are protected on this device':'This browser didn’t allow it. Installing the app (browser menu → Install) usually does.');closeOv()};
 const cl=m.querySelector('#clean');if(cl)cl.onclick=async()=>{closeOv();if(!await confirmBox(`Permanently remove ${unused.length} picture or video file${unused.length==1?'':'s'} that no card uses? Undo can’t bring these back.`,'Remove'))return;for(const x of unused)await Store.deleteMedia(x.id).catch(()=>{});toast(`Removed ${unused.length} file${unused.length==1?'':'s'}`)}};
$('#zi').onclick=()=>zoomBy(1.2);$('#zo').onclick=()=>zoomBy(1/1.2);$('#zl').onclick=()=>fit();
addEventListener('resize',()=>{placeCtx();linksSoon()});

/* ---------- start ---------- */
load().then(()=>{$('#load').hidden=true;const h=location.hash.slice(1);show(S.boards[h]?h:'home')});
}
