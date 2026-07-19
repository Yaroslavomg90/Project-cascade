
/* =========================================================================
   PROJECT CASCADE — mini RTS
   ========================================================================= */

/* ---------------- UTIL ---------------- */
const rnd=(a,b)=>a+Math.random()*(b-a);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function lerp(a,b,t){return a+(b-a)*t;}

/* ---------------- CONSTANTS ---------------- */
const TILE=32, COLS=58, ROWS=38;
const WORLD_W=COLS*TILE, WORLD_H=ROWS*TILE;

/* ---------------- FACTIONS ---------------- */
const FACTIONS={
  UCA:{key:'UCA',name:'UCA',full:'UNITED CONTINENTAL ALLIANCE',quote:'"Steel never surrenders."',
    accent:'#4a90c2',accent2:'#1b3350',glow:'#7fc4ff',
    mult:{hp:1.3,dmg:1.15,speed:0.85,cost:1.2,range:1.0,atkSpeed:1.0},
    stats:{atk:3,arm:5,spd:2,fp:4,mob:1}},
  EBD:{key:'EBD',name:'EBD',full:'EURASIAN BIO DOMINION',quote:'"Evolution through strength."',
    accent:'#7fb547',accent2:'#233318',glow:'#b6ec7a',
    mult:{hp:0.85,dmg:1.0,speed:1.25,cost:0.8,range:0.95,atkSpeed:1.25},
    stats:{atk:5,arm:2,spd:4,fp:3,mob:5}},
  PQC:{key:'PQC',name:'PQC',full:'PACIFIC QUANTUM COLLECTIVE',quote:'"Precision is victory."',
    accent:'#34d3e0',accent2:'#123244',glow:'#8ff2fb',
    mult:{hp:0.9,dmg:1.1,speed:1.1,cost:1.05,range:1.2,atkSpeed:1.05},
    stats:{atk:4,arm:2,spd:4,fp:5,mob:4}},
};

/* ---------------- UNIT TEMPLATES (base stats before faction mult) ---------------- */
const UNIT_DEFS={
  worker:{name:'Рабочий',shape:'circle',hp:50,dmg:0,range:0,atkSpeed:1,speed:58,cost:50,build:6,pop:1,role:'econ',req:'commandCenter',prod:'commandCenter',vision:110},
  infLight:{name:'Разведчик',shape:'triangle',hp:55,dmg:7,range:95,atkSpeed:1.1,speed:70,cost:55,build:7,pop:1,role:'inf',req:'barracks',prod:'barracks',vision:150},
  infHeavy:{name:'Тяжёлый пехотинец',shape:'square',hp:110,dmg:13,range:80,atkSpeed:0.75,speed:42,cost:110,build:12,pop:2,role:'inf',req:'barracks',prod:'barracks',vision:120},
  vehLight:{name:'Лёгкая техника',shape:'diamond',hp:150,dmg:16,range:115,atkSpeed:1.0,speed:82,cost:135,build:14,pop:2,role:'veh',req:'factory',prod:'factory',vision:160},
  vehHeavy:{name:'Тяжёлая техника',shape:'hex',hp:270,dmg:28,range:120,atkSpeed:0.65,speed:46,cost:245,build:20,pop:3,role:'veh',req:'factory',prod:'factory',vision:130},
  artillery:{name:'Артиллерия',shape:'pentagon',hp:100,dmg:52,range:270,atkSpeed:0.35,speed:36,cost:225,build:20,pop:3,role:'arty',req:'factory',prod:'factory',vision:140,bldBonus:1.6,minRange:60},
  aircraft:{name:'Авиация',shape:'chevron',hp:100,dmg:22,range:150,atkSpeed:1.15,speed:150,cost:205,build:18,pop:2,role:'air',req:'airfield',prod:'airfield',vision:190,flying:true},
};
const UNIT_ORDER=['worker','infLight','infHeavy','vehLight','vehHeavy','artillery','aircraft'];

/* ---------------- BUILDING TEMPLATES ---------------- */
const BUILDING_DEFS={
  commandCenter:{name:'Командный центр',shape:'cc',hp:750,cost:0,build:0,w:3,h:3,vision:220,req:null,produces:['worker']},
  barracks:{name:'Казармы',shape:'square',hp:420,cost:150,build:16,w:2,h:2,vision:150,req:'commandCenter',produces:['infLight','infHeavy']},
  factory:{name:'Завод',shape:'hex',hp:520,cost:260,build:22,w:3,h:2,vision:150,req:'barracks',produces:['vehLight','vehHeavy','artillery']},
  airfield:{name:'Аэродром',shape:'chevron',hp:460,cost:310,build:24,w:3,h:2,vision:170,req:'factory',produces:['aircraft']},
  turret:{name:'Турель',shape:'turret',hp:320,cost:130,build:12,w:1,h:1,vision:170,req:'barracks',produces:[],turret:true,dmg:22,range:165,atkSpeed:1.0},
};
const BUILDING_ORDER=['barracks','factory','airfield','turret'];

/* ---------------- GAME STATE ---------------- */
let playerFaction=null, aiFactionKey=null;
let resources=[0,0];      // [player, ai]
let popCap=[10,10], popUsed=[0,0];
let gameTime=0;
let gameOver=false;
let units=[], buildings=[], particles=[], nodes=[];
let nextId=1;
let selection=[];         // array of entities (player-owned) currently selected
let ctrlGroups={};        // 1-9 -> array of unit ids
let cam={x:0,y:0};
let uiTab='build';
let placingType=null;     // building type currently being placed
let dragBox=null;         // {x0,y0,x1,y1} in screen coords
let mouse={x:0,y:0,down:false};
let keys={};
let rallySettingFor=null;

const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');
const mmCanvas=document.getElementById('minimap');
const mmCtx=mmCanvas.getContext('2d');

function resizeCanvas(){
  const wrap=document.getElementById('viewportWrap');
  canvas.width=wrap.clientWidth; canvas.height=wrap.clientHeight;
  mmCanvas.width=mmCanvas.clientWidth; mmCanvas.height=mmCanvas.clientHeight;
}
window.addEventListener('resize',resizeCanvas);

/* ---------------- FOG OF WAR ---------------- */
let visited=new Uint8Array(COLS*ROWS);
let visible=new Uint8Array(COLS*ROWS);
function fIdx(c,r){return r*COLS+c;}

/* =========================================================================
   FACTION SELECT SCREEN
   ========================================================================= */
function buildFactionCards(){
  const row=document.getElementById('factionRow');
  row.innerHTML='';
  Object.values(FACTIONS).forEach(f=>{
    const card=document.createElement('div');
    card.className='fCard '+f.key.toLowerCase();
    card.style.color=f.glow;
    card.innerHTML=`
      <div style="width:34px;height:34px;border:2px solid ${f.accent};border-radius:5px;display:flex;align-items:center;justify-content:center;color:${f.accent};font-weight:700;">◈</div>
      <h3 style="color:${f.accent}">${f.name}</h3>
      <div class="fSub">${f.full}</div>
      <div class="fQuote">${f.quote}</div>
      <div class="fStats">
        ${statRow('Атака',f.stats.atk,f.accent)}
        ${statRow('Броня',f.stats.arm,f.accent)}
        ${statRow('Скорость',f.stats.spd,f.accent)}
        ${statRow('Огневая мощь',f.stats.fp,f.accent)}
      </div>`;
    card.onclick=()=>startGame(f.key);
    row.appendChild(card);
  });
}
function statRow(label,v,color){
  let fill='';
  for(let i=1;i<=5;i++) fill+=`<span style="display:inline-block;width:10px;height:5px;margin-right:2px;background:${i<=v?color:'#1a2230'};border-radius:1px;"></span>`;
  return `<div><span>${label}</span><span>${fill}</span></div>`;
}
buildFactionCards();

/* =========================================================================
   GAME START
   ========================================================================= */
function startGame(key){
  playerFaction=key;
  const others=Object.keys(FACTIONS).filter(k=>k!==key);
  aiFactionKey=others[Math.floor(Math.random()*others.length)];
  document.getElementById('startOverlay').classList.add('hidden');
  applyTheme(FACTIONS[key]);
  document.getElementById('fNameTop').textContent=FACTIONS[key].name+' — '+FACTIONS[key].full;
  document.getElementById('statEnemy').textContent=FACTIONS[aiFactionKey].name;
  resizeCanvas();
  setupWorld();
  requestAnimationFrame(loop);
}
function applyTheme(f){
  const r=document.documentElement.style;
  r.setProperty('--accent',f.accent); r.setProperty('--accent2',f.accent2); r.setProperty('--accentGlow',f.glow);
  document.getElementById('fLogo').style.color=f.accent;
  document.getElementById('fLogo').style.borderColor=f.accent;
}

/* =========================================================================
   WORLD SETUP
   ========================================================================= */
function setupWorld(){
  // resource nodes
  const nodeSpots=[
    [5,30],[8,25],[3,20],           // near player (bottom-left)
    [52,7],[49,12],[54,17],         // near ai (top-right)
    [28,18],[24,22],[32,14],[20,10] // contested middle
  ];
  nodeSpots.forEach(([c,r])=>{
    nodes.push({id:nextId++,x:c*TILE+TILE/2,y:r*TILE+TILE/2,amount:1600+Math.random()*400,maxAmount:2000});
  });

  // player base
  const pCC=placeBuildingRaw('commandCenter',0,3*TILE,32*TILE,true);
  cam.x=clamp(3*TILE-canvas.width/2,0,WORLD_W-canvas.width);
  cam.y=clamp(32*TILE-canvas.height/2,0,WORLD_H-canvas.height);
  for(let i=0;i<3;i++){
    const w=spawnUnit('worker',0,pCC.rally.x+rnd(-30,30),pCC.rally.y+rnd(-10,30));
  }

  // ai base
  const aCC=placeBuildingRaw('commandCenter',1,52*TILE,3*TILE,true);
  for(let i=0;i<3;i++){
    spawnUnit('worker',1,aCC.rally.x+rnd(-30,30),aCC.rally.y+rnd(-10,30));
  }

  resources=[5000,5000];
  ai.state='build';
  refreshSidebar();
}

/* =========================================================================
   ENTITIES
   ========================================================================= */
function makeUnit(type,owner,x,y){
  const def=UNIT_DEFS[type], fac=FACTIONS[owner===0?playerFaction:aiFactionKey], m=fac.mult;
  return {
    id:nextId++,kind:'unit',type,owner,x,y,
    hp:def.hp*m.hp,maxHp:def.hp*m.hp,
    dmg:def.dmg*m.dmg,range:def.range*m.range,atkSpeed:def.atkSpeed*m.atkSpeed,
    speed:def.speed*m.speed,vision:def.vision,pop:def.pop,
    atkCd:0,target:null,moveTarget:null,path:null,
    job:null,carry:0,angle:0,selected:false,flying:!!def.flying,
    bldBonus:def.bldBonus||1,minRange:def.minRange||0,
  };
}
function spawnUnit(type,owner,x,y,free){
  const u=makeUnit(type,owner,x,y);
  units.push(u);
  popUsed[owner]+=u.pop;
  if(type==='worker') assignHarvest(u);
  return u;
}
function placeBuildingRaw(type,owner,x,y,instant){
  const def=BUILDING_DEFS[type];
  const b={id:nextId++,kind:'building',type,owner,x,y,w:def.w,h:def.h,
    hp: instant? def.hp*hpMult(owner) : def.hp*hpMult(owner)*0.1,
    maxHp:def.hp*hpMult(owner),vision:def.vision,
    constructing:!instant,buildTime:def.build,buildT:instant?def.build:0,
    queue:[],selected:false,rally:{x:x+def.w*TILE/2,y:y+def.h*TILE+40},
    atkCd:0,target:null};
  buildings.push(b);
  return b;
}
function hpMult(owner){ const fac=FACTIONS[owner===0?playerFaction:aiFactionKey]; return fac.mult.hp; }

/* grid occupancy check */
function footprintCells(x,y,w,h){
  const c0=Math.round(x/TILE), r0=Math.round(y/TILE);
  const cells=[];
  for(let c=c0;c<c0+w;c++) for(let r=r0;r<r0+h;r++) cells.push([c,r]);
  return cells;
}
function cellFree(c,r,ignoreId){
  if(c<0||r<0||c>=COLS||r>=ROWS) return false;
  for(const b of buildings){
    if(b.id===ignoreId) continue;
    const bc0=Math.round(b.x/TILE), br0=Math.round(b.y/TILE);
    if(c>=bc0&&c<bc0+b.w&&r>=br0&&r<br0+b.h) return false;
  }
  return true;
}
function nearOwnedBuilding(x,y,owner,radius){
  for(const b of buildings){ if(b.owner===owner && dist({x,y},{x:b.x+b.w*TILE/2,y:b.y+b.h*TILE/2})<radius) return true; }
  return false;
}

/* =========================================================================
   SIDEBAR / UI
   ========================================================================= */
function setTab(t){ uiTab=t; refreshSidebar(); }
function refreshSidebar(){
  document.getElementById('tabBuild').classList.toggle('active',uiTab==='build');
  document.getElementById('tabUnit').classList.toggle('active',uiTab==='unit');
  const wrap=document.getElementById('buildScroll'); wrap.innerHTML='';
  const owner=0;
  if(uiTab==='build'){
    BUILDING_ORDER.forEach(type=>{
      const def=BUILDING_DEFS[type];
      const unlocked=!def.req || buildings.some(b=>b.owner===owner&&b.type===def.req&&!b.constructing);
      const btn=document.createElement('div');
      btn.className='buildBtn'+(!unlocked?' locked':(placingType===type?' disabled':''));
      btn.innerHTML=`<div class="bIcon"><div class="shape ${def.shape}"></div></div>
        <div class="bName">${def.name}</div>
        <div class="bCost">${def.cost} кр.</div>
        ${!unlocked?`<div class="bLockTxt">нужно: ${BUILDING_DEFS[def.req]?BUILDING_DEFS[def.req].name:''}</div>`:''}`;
      if(unlocked) btn.onclick=()=>beginPlacement(type);
      wrap.appendChild(btn);
    });
  } else {
    UNIT_ORDER.forEach(type=>{
      const def=UNIT_DEFS[type];
      const unlocked=buildings.some(b=>b.owner===owner&&b.type===def.prod&&!b.constructing);
      const afford=resources[owner]>=def.cost*FACTIONS[playerFaction].mult.cost;
      const btn=document.createElement('div');
      const cost=Math.round(def.cost*FACTIONS[playerFaction].mult.cost);
      btn.className='buildBtn'+(!unlocked?' locked':(!afford?' disabled':''));
      btn.innerHTML=`<div class="bIcon"><div class="shape ${def.shape}"></div></div>
        <div class="bName">${def.name}</div>
        <div class="bCost">${cost} кр.</div>
        ${!unlocked?`<div class="bLockTxt">нужно: ${BUILDING_DEFS[def.prod].name}</div>`:''}`;
      if(unlocked&&afford) btn.onclick=()=>enqueueUnit(type,owner);
      wrap.appendChild(btn);
    });
  }
  updateSelPanel();
}
function enqueueUnit(type,owner){
  const def=UNIT_DEFS[type];
  const cost=Math.round(def.cost*FACTIONS[owner===0?playerFaction:aiFactionKey].mult.cost);
  if(resources[owner]<cost) return;
  const prods=buildings.filter(b=>b.owner===owner&&b.type===def.prod&&!b.constructing);
  if(!prods.length) return;
  prods.sort((a,b)=>queueTime(a)-queueTime(b));
  const b=prods[0];
  resources[owner]-=cost;
  b.queue.push({type,t:0,total:def.build*(0.85+Math.random()*0.3)});
  refreshSidebar();
}
function queueTime(b){ return b.queue.reduce((s,q)=>s+(q.total-q.t),0); }

function unitStatusText(u){
  if(u.job && u.job.type==='harvest'){
    if(u.job.state==='mining') return 'Добывает ресурсы';
    if(u.job.state==='toCC') return 'Везёт кристаллы на базу';
    return 'Идёт к месторождению';
  }
  if(u.target) return 'Атакует цель';
  if(u.moveTarget) return 'Движется';
  return 'Ожидает приказа';
}
function stopSelected(){
  selection.forEach(s=>{ if(s.kind==='unit'){ s.job=null; s.target=null; s.moveTarget=null; s.attackingOrder=false; } });
  updateSelPanel();
}
function actionRow(ownerIsPlayer){
  if(!ownerIsPlayer) return '';
  return `<div class="queueRow"><div class="queueItem" onclick="stopSelected()">⏹ Стоп</div></div>`;
}
function updateSelPanel(){
  const panel=document.getElementById('selPanel');
  if(selection.length===0){ panel.innerHTML='<div class="empty">Ничего не выбрано</div>'; return; }
  if(selection.length>1){
    const counts={};
    selection.forEach(u=>counts[u.type]=(counts[u.type]||0)+1);
    let rows=Object.entries(counts).map(([t,n])=>`<div class="statLine"><span>${(UNIT_DEFS[t]||{}).name||t}</span><span>x${n}</span></div>`).join('');
    const allMine=selection.every(u=>u.owner===0);
    panel.innerHTML=`<div class="selTitle">Отряд (${selection.length})</div>${rows}${actionRow(allMine)}`;
    return;
  }
  const e=selection[0];
  if(e.kind==='unit'){
    const def=UNIT_DEFS[e.type];
    const pct=Math.max(0,e.hp/e.maxHp*100);
    panel.innerHTML=`<div class="selTitle">${def.name}<span>${e.owner===0?'Вы':'Враг'}</span></div>
      <div class="hpBarOuter"><div class="hpBarInner" style="width:${pct}%;background:${hpColor(pct)}"></div></div>
      <div class="statLine"><span>HP</span><span>${Math.ceil(e.hp)}/${Math.ceil(e.maxHp)}</span></div>
      <div class="statLine"><span>Урон</span><span>${e.dmg.toFixed(0)}</span></div>
      <div class="statLine"><span>Дальность</span><span>${e.range.toFixed(0)}</span></div>
      <div class="statLine"><span>Статус</span><span>${unitStatusText(e)}</span></div>
      ${actionRow(e.owner===0)}`;
  } else {
    const def=BUILDING_DEFS[e.type];
    const pct=Math.max(0,e.hp/e.maxHp*100);
    let queueHtml='';
    if(e.owner===0 && def.produces.length){
      queueHtml='<div class="queueRow">'+(e.queue.length?e.queue.map((q,i)=>`<div class="queueItem" onclick="cancelQueue(${e.id},${i})">${UNIT_DEFS[q.type].name} ${(q.t/q.total*100)|0}% ✕</div>`).join(''):'<span class="empty">Очередь пуста</span>')+'</div>';
    }
    panel.innerHTML=`<div class="selTitle">${def.name}${e.constructing?' (стройка)':''}<span>${e.owner===0?'Вы':'Враг'}</span></div>
      <div class="hpBarOuter"><div class="hpBarInner" style="width:${pct}%;background:${hpColor(pct)}"></div></div>
      <div class="statLine"><span>HP</span><span>${Math.ceil(e.hp)}/${Math.ceil(e.maxHp)}</span></div>
      ${queueHtml}`;
  }
}
function cancelQueue(bid,idx){
  const b=buildings.find(x=>x.id===bid); if(!b) return;
  const q=b.queue[idx]; if(!q) return;
  const def=UNIT_DEFS[q.type];
  resources[b.owner]+=Math.round(def.cost*FACTIONS[b.owner===0?playerFaction:aiFactionKey].mult.cost*0.8);
  b.queue.splice(idx,1);
  refreshSidebar();
}
function hpColor(pct){ return pct>60?'#4ade80':pct>30?'#facc15':'#ef4444'; }

/* =========================================================================
   BUILDING PLACEMENT
   ========================================================================= */
function beginPlacement(type){
  placingType=type;
  document.getElementById('placeHint').classList.remove('hidden');
  refreshSidebar();
}
function cancelPlacement(){
  placingType=null;
  document.getElementById('placeHint').classList.add('hidden');
  refreshSidebar();
}
function tryConfirmPlacement(wx,wy){
  const def=BUILDING_DEFS[placingType];
  const gx=Math.round((wx-def.w*TILE/2)/TILE)*TILE, gy=Math.round((wy-def.h*TILE/2)/TILE)*TILE;
  const cells=footprintCells(gx,gy,def.w,def.h);
  const free=cells.every(([c,r])=>cellFree(c,r,null));
  const near=nearOwnedBuilding(gx+def.w*TILE/2,gy+def.h*TILE/2,0,260);
  const cost=Math.round(def.cost*FACTIONS[playerFaction].mult.cost);
  const afford=resources[0]>=cost;
  if(free&&near&&afford){
    resources[0]-=cost;
    placeBuildingRaw(placingType,0,gx,gy,false);
    cancelPlacement();
  }
}

/* =========================================================================
   COMBAT / HARVEST HELPERS
   ========================================================================= */
function assignHarvest(u){
  let best=null,bd=1e9;
  nodes.forEach(n=>{ if(n.amount<=0) return; const d=dist(u,n); if(d<bd){bd=d;best=n;} });
  if(best){ u.job={type:'harvest',nodeId:best.id,state:'toNode'}; u.moveTarget={x:best.x+rnd(-10,10),y:best.y+rnd(-10,10)}; }
}
function nearestOwnedCC(owner,x,y){
  let best=null,bd=1e9;
  buildings.forEach(b=>{ if(b.owner===owner&&b.type==='commandCenter'&&!b.constructing){ const d=dist({x,y},{x:b.x+b.w*TILE/2,y:b.y+b.h*TILE/2}); if(d<bd){bd=d;best=b;} } });
  return best;
}
function findAttackTarget(u){
  let best=null,bd=1e9;
  const scan=(list)=>list.forEach(e=>{ if(e.owner===u.owner) return; if(e.kind==='unit'&&e.hp<=0) return;
    const ex=e.kind==='building'?e.x+e.w*TILE/2:e.x, ey=e.kind==='building'?e.y+e.h*TILE/2:e.y;
    const d=dist(u,{x:ex,y:ey}); if(d<=u.range+18&&d<bd){bd=d;best=e;} });
  scan(units); scan(buildings);
  return best;
}
function dealDamage(attacker,target,dmg){
  target.hp-=dmg;
  spawnHitParticles(target.kind==='building'?target.x+target.w*TILE/2:target.x, target.kind==='building'?target.y+target.h*TILE/2:target.y);
  if(target.hp<=0) killEntity(target);
}
function killEntity(e){
  const x=e.kind==='building'?e.x+e.w*TILE/2:e.x, y=e.kind==='building'?e.y+e.h*TILE/2:e.y;
  spawnExplosion(x,y,e.kind==='building');
  if(e.kind==='unit'){
    popUsed[e.owner]-=e.pop;
    units=units.filter(u=>u!==e);
    selection=selection.filter(s=>s!==e);
  } else {
    buildings=buildings.filter(b=>b!==e);
    selection=selection.filter(s=>s!==e);
    checkVictory();
  }
}
function checkVictory(){
  if(gameOver) return;
  const pCC=buildings.some(b=>b.owner===0&&b.type==='commandCenter');
  const aCC=buildings.some(b=>b.owner===1&&b.type==='commandCenter');
  if(!aCC){ endGame(true); } else if(!pCC){ endGame(false); }
}
function endGame(won){
  gameOver=true;
  document.getElementById('endOverlay').classList.remove('hidden');
  document.getElementById('endTitle').textContent=won?'ПОБЕДА':'ПОРАЖЕНИЕ';
  document.getElementById('endTitle').style.color=won?'#4ade80':'#ef4444';
  document.getElementById('endSub').textContent=won?`Командный центр ${FACTIONS[aiFactionKey].name} уничтожен.`:`Ваш командный центр уничтожен.`;
}

/* ---------------- PARTICLES / VFX ---------------- */
function spawnHitParticles(x,y){
  for(let i=0;i<5;i++) particles.push({x,y,vx:rnd(-60,60),vy:rnd(-60,60),life:0.25,maxLife:0.25,color:'#ffd76b',size:2.5,type:'spark'});
}
function spawnExplosion(x,y,big){
  const n=big?26:14;
  for(let i=0;i<n;i++){
    const a=rnd(0,Math.PI*2), sp=rnd(40,big?220:140);
    particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rnd(.3,.7),maxLife:.7,color:i%3===0?'#ffb347':(i%3===1?'#ff5b3d':'#ffe27a'),size:rnd(2,big?6:4),type:'spark'});
  }
  for(let i=0;i<(big?14:6);i++){
    particles.push({x:x+rnd(-8,8),y:y+rnd(-8,8),vx:rnd(-8,8),vy:rnd(-38,-14),life:rnd(.6,1.3),maxLife:1.3,color:'#777d84',size:rnd(4,big?12:7),type:'smoke'});
  }
  if(big) shake=Math.max(shake,10);
}
function spawnMuzzle(x,y,ang){
  particles.push({x,y,vx:Math.cos(ang)*20,vy:Math.sin(ang)*20,life:.12,maxLife:.12,color:'#bfe8ff',size:4,type:'spark'});
}
function spawnBullet(x1,y1,x2,y2,color){
  particles.push({x:x1,y:y1,tx:x2,ty:y2,life:.14,maxLife:.14,color,type:'bullet'});
}
let shake=0;

/* =========================================================================
   MAIN UPDATE LOOP
   ========================================================================= */
let lastTs=performance.now();
function loop(ts){
  let dt=(ts-lastTs)/1000; lastTs=ts; dt=Math.min(dt,0.05);
  if(!gameOver){ update(dt); }
  render();
  requestAnimationFrame(loop);
}

function update(dt){
  gameTime+=dt;
  handleCameraKeys(dt);
  updateProduction(dt);
  updateUnits(dt);
  updateBuildingTurrets(dt);
  updateParticles(dt);
  updateVisibility();
  aiUpdate(dt);
  if(shake>0) shake=Math.max(0,shake-dt*22);
  updateTopbar();
  if(Math.floor(gameTime*2)!==Math.floor((gameTime-dt)*2)) refreshSidebar();
}

function updateProduction(dt){
  buildings.forEach(b=>{
    if(b.constructing){
      b.buildT+=dt;
      b.hp=Math.min(b.maxHp,b.maxHp*(0.1+0.9*(b.buildT/b.buildTime)));
      if(b.buildT>=b.buildTime){ b.constructing=false; b.hp=b.maxHp; }
      return;
    }
    if(b.queue.length){
      const q=b.queue[0]; q.t+=dt;
      if(q.t>=q.total){
        b.queue.shift();
        const cx=b.x+b.w*TILE/2, cy=b.y+b.h*TILE+14;
        const u=spawnUnit(q.type,b.owner,cx,cy);
        u.moveTarget={x:b.rally.x+rnd(-14,14),y:b.rally.y+rnd(-14,14)};
        if(q.type==='worker') assignHarvest(u);
      }
    }
  });
}

function updateUnits(dt){
  units.forEach(u=>{
    // combat
    if(u.job==null){
      if(!u.target || u.target.hp<=0 || (u.target.kind==='unit'&&!units.includes(u.target)) || (u.target.kind==='building'&&!buildings.includes(u.target))){
        u.target=findAttackTarget(u);
      }
    }
    u.atkCd=Math.max(0,u.atkCd-dt);
    if(u.target && u.job==null){
      const tx=u.target.kind==='building'?u.target.x+u.target.w*TILE/2:u.target.x;
      const ty=u.target.kind==='building'?u.target.y+u.target.h*TILE/2:u.target.y;
      const d=dist(u,{x:tx,y:ty});
      const minR=u.minRange||0;
      if(d<=u.range && d>=minR){
        u.angle=Math.atan2(ty-u.y,tx-u.x);
        if(u.atkCd<=0){
          u.atkCd=1/u.atkSpeed;
          const bonus=u.target.kind==='building'?u.bldBonus:1;
          spawnMuzzle(u.x+Math.cos(u.angle)*14,u.y+Math.sin(u.angle)*14,u.angle);
          spawnBullet(u.x,u.y,tx,ty, u.owner===0?'#8ff2fb':'#ff8b7a');
          dealDamage(u,u.target,u.dmg*bonus);
        }
      } else if(d<minR){
        moveToward(u,dt,{x:u.x-Math.cos(u.angle)*40,y:u.y-Math.sin(u.angle)*40});
      } else {
        moveToward(u,dt,{x:tx,y:ty});
      }
      return;
    }
    // harvesting job
    if(u.job && u.job.type==='harvest'){
      const node=nodes.find(n=>n.id===u.job.nodeId);
      if(!node || node.amount<=0){ u.job=null; assignHarvest(u); return; }
      if(u.job.state==='toNode'){
        if(dist(u,node)<16){ u.job.state='mining'; u.job.t=0; }
        else moveToward(u,dt,node);
      } else if(u.job.state==='mining'){
        u.job.t=(u.job.t||0)+dt;
        if(u.job.t>1.6){
          const take=Math.min(8,node.amount); node.amount-=take; u.carry=take;
          const cc=nearestOwnedCC(u.owner,u.x,u.y);
          if(cc){ u.job.state='toCC'; u.job.ccId=cc.id; }
          else { u.job=null; }
        }
      } else if(u.job.state==='toCC'){
        const cc=buildings.find(b=>b.id===u.job.ccId);
        if(!cc){ u.job=null; assignHarvest(u); return; }
        const cx=cc.x+cc.w*TILE/2, cy=cc.y+cc.h*TILE/2;
        if(dist(u,{x:cx,y:cy})<40){
          resources[u.owner]+=u.carry; u.carry=0;
          u.job.state='toNode';
        } else moveToward(u,dt,{x:cx,y:cy});
      }
      return;
    }
    // manual move
    if(u.moveTarget){
      if(dist(u,u.moveTarget)<6) u.moveTarget=null;
      else moveToward(u,dt,u.moveTarget);
    }
  });
  separateUnits(dt);
}

function moveToward(u,dt,target){
  const ang=Math.atan2(target.y-u.y,target.x-u.x);
  u.angle=ang;
  const step=u.speed*dt;
  const tryAngle=(a)=>{
    const nx=u.x+Math.cos(a)*step, ny=u.y+Math.sin(a)*step;
    if(u.flying || !blockedAt(nx,ny)) return {nx,ny};
    return null;
  };
  // try direct path, then progressively wider deflection angles either side, then a small pure retreat
  let res=tryAngle(ang);
  if(!res){
    const deflections=[0.5,-0.5,1.0,-1.0,Math.PI/2,-Math.PI/2,2.2,-2.2];
    for(const d of deflections){ res=tryAngle(ang+d); if(res) break; }
  }
  if(res){ u.x=clamp(res.nx,8,WORLD_W-8); u.y=clamp(res.ny,8,WORLD_H-8); }
}
function blockedAt(x,y){
  const c=Math.floor(x/TILE), r=Math.floor(y/TILE);
  return !cellFree(c,r,null);
}
function separateUnits(dt){
  for(let i=0;i<units.length;i++){
    for(let j=i+1;j<units.length;j++){
      const a=units[i],b=units[j]; const d=dist(a,b);
      if(d<16&&d>0.001){
        const push=(16-d)/2, ang=Math.atan2(a.y-b.y,a.x-b.x);
        a.x+=Math.cos(ang)*push*dt*10; a.y+=Math.sin(ang)*push*dt*10;
        b.x-=Math.cos(ang)*push*dt*10; b.y-=Math.sin(ang)*push*dt*10;
      }
    }
  }
}

function updateBuildingTurrets(dt){
  buildings.forEach(b=>{
    const def=BUILDING_DEFS[b.type];
    if(!def.turret || b.constructing) return;
    b.atkCd=Math.max(0,b.atkCd-dt);
    if(!b.target||b.target.hp<=0){ b.target=findAttackTarget({owner:b.owner,x:b.x+b.w*TILE/2,y:b.y+b.h*TILE/2,range:def.range}); }
    if(b.target){
      const cx=b.x+b.w*TILE/2, cy=b.y+b.h*TILE/2;
      const tx=b.target.kind==='building'?b.target.x+b.target.w*TILE/2:b.target.x;
      const ty=b.target.kind==='building'?b.target.y+b.target.h*TILE/2:b.target.y;
      b.aimAngle=Math.atan2(ty-cy,tx-cx);
      if(dist({x:cx,y:cy},{x:tx,y:ty})<=def.range && b.atkCd<=0){
        b.atkCd=1/def.atkSpeed;
        spawnBullet(cx,cy,tx,ty,b.owner===0?'#8ff2fb':'#ff8b7a');
        dealDamage(b,b.target,def.dmg);
      }
    }
  });
}

function updateParticles(dt){
  particles.forEach(p=>{
    if(p.type==='bullet'){ p.life-=dt; return; }
    p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
    if(p.type==='smoke'){ p.vy-=6*dt; }
    else { p.vx*=0.9; p.vy*=0.9; }
  });
  particles=particles.filter(p=>p.life>0);
}

function updateVisibility(){
  visible.fill(0);
  const reveal=(x,y,r)=>{
    const c0=Math.max(0,Math.floor((x-r)/TILE)), c1=Math.min(COLS-1,Math.floor((x+r)/TILE));
    const r0=Math.max(0,Math.floor((y-r)/TILE)), r1=Math.min(ROWS-1,Math.floor((y+r)/TILE));
    for(let c=c0;c<=c1;c++) for(let rr=r0;rr<=r1;rr++){
      if(Math.hypot(c*TILE+16-x,rr*TILE+16-y)<=r){ const idx=fIdx(c,rr); visible[idx]=1; visited[idx]=1; }
    }
  };
  units.forEach(u=>{ if(u.owner===0) reveal(u.x,u.y,u.vision); });
  buildings.forEach(b=>{ if(b.owner===0) reveal(b.x+b.w*TILE/2,b.y+b.h*TILE/2,b.vision); });
}
function tileVisible(x,y){ const c=Math.floor(x/TILE),r=Math.floor(y/TILE); if(c<0||r<0||c>=COLS||r>=ROWS) return false; return visible[fIdx(c,r)]===1; }
function tileVisited(x,y){ const c=Math.floor(x/TILE),r=Math.floor(y/TILE); if(c<0||r<0||c>=COLS||r>=ROWS) return false; return visited[fIdx(c,r)]===1; }

/* =========================================================================
   AI
   ========================================================================= */
const ai={timer:0,waveThreshold:6,army:[],state:'build'};
function aiUpdate(dt){
  ai.timer-=dt;
  if(ai.timer>0) return;
  ai.timer=2.4;
  const owner=1;
  const myBuildings=buildings.filter(b=>b.owner===owner);
  const cc=myBuildings.find(b=>b.type==='commandCenter');
  if(!cc) return;
  const workers=units.filter(u=>u.owner===owner&&u.type==='worker');
  const fac=FACTIONS[aiFactionKey];
  const cost=t=>Math.round(UNIT_DEFS[t].cost*fac.mult.cost);
  const bcost=t=>Math.round(BUILDING_DEFS[t].cost*fac.mult.cost);

  // economy
  if(workers.length<7 && resources[owner]>=cost('worker') && cc.queue.length<3){
    resources[owner]-=cost('worker'); cc.queue.push({type:'worker',t:0,total:UNIT_DEFS.worker.build});
  }
  // tech / base building progression
  const has=t=>myBuildings.some(b=>b.type===t);
  const buildOrder=['barracks','factory','turret','airfield','barracks'];
  const wanted=buildOrder.find(t=>{
    const count=myBuildings.filter(b=>b.type===t).length;
    const limit=t==='barracks'?2:1;
    return count<limit && (!BUILDING_DEFS[t].req || has(BUILDING_DEFS[t].req));
  });
  if(wanted && resources[owner]>=bcost(wanted)){
    const spot=findAiBuildSpot(cc,wanted);
    if(spot){ resources[owner]-=bcost(wanted); placeBuildingRaw(wanted,owner,spot.x,spot.y,false); }
  }
  // unit production
  const prodTypes=['infLight','infHeavy','vehLight','vehHeavy','artillery','aircraft'].filter(t=>{
    return myBuildings.some(b=>b.type===UNIT_DEFS[t].prod && !b.constructing);
  });
  if(prodTypes.length){
    const pick=prodTypes[Math.floor(Math.random()*prodTypes.length)];
    const prods=myBuildings.filter(b=>b.type===UNIT_DEFS[pick].prod && !b.constructing);
    prods.sort((a,b)=>queueTime(a)-queueTime(b));
    const b=prods[0];
    if(b && resources[owner]>=cost(pick) && queueTime(b)<40){
      resources[owner]-=cost(pick);
      b.queue.push({type:pick,t:0,total:UNIT_DEFS[pick].build});
    }
  }
  // army management
  const army=units.filter(u=>u.owner===owner&&u.type!=='worker'&&!u.attackingOrder);
  if(army.length>=ai.waveThreshold){
    const targetB=buildings.find(b=>b.owner===0&&b.type==='commandCenter')||buildings.find(b=>b.owner===0);
    if(targetB){
      const tx=targetB.x+targetB.w*TILE/2, ty=targetB.y+targetB.h*TILE/2;
      army.forEach(u=>{ u.job=null; u.target=null; u.moveTarget={x:tx+rnd(-40,40),y:ty+rnd(-40,40)}; u.attackingOrder=true; });
      ai.waveThreshold=Math.min(18,ai.waveThreshold+2);
    }
  }
  units.forEach(u=>{ if(u.owner===owner&&u.attackingOrder&&u.moveTarget===null) u.attackingOrder=false; });
}
function findAiBuildSpot(cc,type){
  const def=BUILDING_DEFS[type];
  for(let attempt=0;attempt<24;attempt++){
    const ang=rnd(0,Math.PI*2), rad=rnd(90,220);
    const cx=cc.x+cc.w*TILE/2+Math.cos(ang)*rad, cy=cc.y+cc.h*TILE/2+Math.sin(ang)*rad;
    const gx=Math.round(cx/TILE)*TILE, gy=Math.round(cy/TILE)*TILE;
    const cells=footprintCells(gx,gy,def.w,def.h);
    if(cells.every(([c,r])=>cellFree(c,r,null)) && gx>0 && gy>0 && gx<WORLD_W-def.w*TILE && gy<WORLD_H-def.h*TILE){
      return {x:gx,y:gy};
    }
  }
  return null;
}

/* =========================================================================
   RENDERING
   ========================================================================= */
/* ---- sprite cache & art generation (pre-rendered once per type+faction, then drawImage'd — lets us
   afford real shading/gradients/greebles without any per-frame cost) ---- */
const spriteCache={};
function getCachedSprite(key,w,h,drawFn){
  if(spriteCache[key]) return spriteCache[key];
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  drawFn(c.getContext('2d'),w,h);
  spriteCache[key]=c;
  return c;
}
function shade(hex,pct){
  const f=parseInt(hex.slice(1),16), t=pct<0?0:255, p=Math.abs(pct);
  const R=f>>16,G=(f>>8)&0xff,B=f&0xff;
  const nr=Math.max(0,Math.min(255,Math.round((t-R)*p)+R));
  const ng=Math.max(0,Math.min(255,Math.round((t-G)*p)+G));
  const nb=Math.max(0,Math.min(255,Math.round((t-B)*p)+B));
  return '#'+(0x1000000+nr*0x10000+ng*0x100+nb).toString(16).slice(1);
}
function roundRect(g,x,y,w,h,r){
  g.beginPath();
  g.moveTo(x+r,y); g.lineTo(x+w-r,y); g.quadraticCurveTo(x+w,y,x+w,y+r);
  g.lineTo(x+w,y+h-r); g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  g.lineTo(x+r,y+h); g.quadraticCurveTo(x,y+h,x,y+h-r);
  g.lineTo(x,y+r); g.quadraticCurveTo(x,y,x+r,y);
  g.closePath();
}
function seededRand(i){ const x=Math.sin(i*999.7)*43758.5453; return x-Math.floor(x); }

function getUnitSprite(role,facKey){
  return getCachedSprite('u_'+role+'_'+facKey,128,128,(g,w,h)=>drawUnitArt(g,w,h,role,FACTIONS[facKey]));
}
function drawUnitArt(g,W,H,role,fac){
  const cx=W/2, cy=H/2, s=W*0.42;
  const base=fac.accent, dark=fac.accent2, glow=fac.glow;
  const light=shade(base,0.4), shadow=shade(base,-0.5);
  const grad=(x0,y0,x1,y1)=>{ const gr=g.createLinearGradient(x0,y0,x1,y1); gr.addColorStop(0,light); gr.addColorStop(0.55,base); gr.addColorStop(1,shadow); return gr; };
  g.save(); g.translate(cx,cy);
  // drop shadow (offset toward "front-right" for a sense of depth)
  g.save(); g.globalAlpha=0.35; g.fillStyle='#000';
  g.beginPath(); g.ellipse(s*0.08,s*0.2,s*0.6,s*0.32,0,0,Math.PI*2); g.fill(); g.restore();
  g.lineWidth=W*0.014; g.strokeStyle='rgba(0,0,0,0.6)';

  if(role==='worker'){
    g.fillStyle=dark; g.fillRect(-s*0.5,-s*0.05,s*0.22,s*0.5); g.fillRect(s*0.28,-s*0.05,s*0.22,s*0.5);
    g.fillStyle=grad(-s*0.4,-s*0.4,s*0.4,s*0.4);
    roundRect(g,-s*0.42,-s*0.5,s*0.84,s*0.78,s*0.14); g.fill(); g.stroke();
    g.fillStyle=shade(dark,-0.3); roundRect(g,-s*0.22,-s*0.4,s*0.44,s*0.3,s*0.06); g.fill();
    g.fillStyle='rgba(255,255,255,0.25)'; roundRect(g,-s*0.18,-s*0.36,s*0.2,s*0.1,s*0.04); g.fill();
    g.fillStyle=shade(dark,0.2); g.fillRect(-s*0.1,-s*0.75,s*0.2,s*0.28);
    g.beginPath(); g.moveTo(-s*0.1,-s*0.75); g.lineTo(0,-s*0.95); g.lineTo(s*0.1,-s*0.75); g.closePath(); g.fill();
    g.fillStyle=glow; g.beginPath(); g.arc(s*0.3,-s*0.42,s*0.06,0,Math.PI*2); g.fill();
  } else if(role==='infLight'){
    g.fillStyle=dark; g.beginPath(); g.ellipse(-s*0.14,s*0.42,s*0.11,s*0.2,0,0,Math.PI*2); g.fill();
    g.beginPath(); g.ellipse(s*0.14,s*0.42,s*0.11,s*0.2,0,0,Math.PI*2); g.fill();
    g.fillStyle=grad(-s*0.3,-s*0.5,s*0.3,s*0.3);
    roundRect(g,-s*0.28,-s*0.28,s*0.56,s*0.62,s*0.18); g.fill(); g.stroke();
    g.fillStyle=shadow; roundRect(g,-s*0.16,s*0.02,s*0.32,s*0.22,s*0.05); g.fill();
    g.fillStyle=grad(-s*0.2,-s*0.65,s*0.2,-s*0.3);
    g.beginPath(); g.arc(0,-s*0.42,s*0.24,0,Math.PI*2); g.fill(); g.stroke();
    g.fillStyle=glow; g.fillRect(-s*0.16,-s*0.46,s*0.32,s*0.06);
    g.fillStyle=dark; g.fillRect(s*0.2,-s*0.5,s*0.09,s*0.65);
  } else if(role==='infHeavy'){
    g.fillStyle=dark; g.beginPath(); g.ellipse(-s*0.18,s*0.46,s*0.14,s*0.22,0,0,Math.PI*2); g.fill();
    g.beginPath(); g.ellipse(s*0.18,s*0.46,s*0.14,s*0.22,0,0,Math.PI*2); g.fill();
    g.fillStyle=shadow; roundRect(g,-s*0.2,s*0.02,s*0.4,s*0.3,s*0.08); g.fill();
    g.fillStyle=grad(-s*0.4,-s*0.5,s*0.4,s*0.35);
    roundRect(g,-s*0.4,-s*0.32,s*0.8,s*0.72,s*0.16); g.fill(); g.stroke();
    g.fillStyle=shade(base,0.15);
    g.beginPath(); g.arc(-s*0.42,-s*0.22,s*0.2,0,Math.PI*2); g.fill(); g.stroke();
    g.beginPath(); g.arc(s*0.42,-s*0.22,s*0.2,0,Math.PI*2); g.fill(); g.stroke();
    g.fillStyle=grad(-s*0.2,-s*0.68,s*0.2,-s*0.35);
    g.beginPath(); g.arc(0,-s*0.46,s*0.22,0,Math.PI*2); g.fill(); g.stroke();
    g.fillStyle=glow; g.fillRect(-s*0.14,-s*0.5,s*0.28,s*0.06);
    g.fillStyle=dark; g.fillRect(s*0.3,-s*0.55,s*0.16,s*0.75);
    g.fillStyle=shade(dark,0.2); g.fillRect(s*0.27,-s*0.6,s*0.22,s*0.14);
    g.fillStyle=glow; g.beginPath(); g.moveTo(0,-s*0.02); g.lineTo(s*0.08,s*0.08); g.lineTo(0,s*0.18); g.lineTo(-s*0.08,s*0.08); g.closePath(); g.fill();
  } else if(role==='vehLight'){
    g.fillStyle=dark;
    [[-s*0.44,-s*0.28],[-s*0.44,s*0.1],[-s*0.44,s*0.4],[s*0.44,-s*0.28],[s*0.44,s*0.1],[s*0.44,s*0.4]].forEach(([wx,wy])=>{ g.beginPath(); g.arc(wx,wy,s*0.09,0,Math.PI*2); g.fill(); });
    g.fillStyle=grad(-s*0.45,-s*0.55,s*0.45,s*0.5);
    g.beginPath(); g.moveTo(0,-s*0.58); g.lineTo(s*0.4,-s*0.2); g.lineTo(s*0.34,s*0.5); g.lineTo(-s*0.34,s*0.5); g.lineTo(-s*0.4,-s*0.2); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle=shade(dark,-0.2); g.beginPath(); g.ellipse(0,-s*0.15,s*0.16,s*0.24,0,0,Math.PI*2); g.fill();
    g.fillStyle='rgba(255,255,255,0.2)'; g.beginPath(); g.ellipse(-s*0.04,-s*0.2,s*0.06,s*0.12,0,0,Math.PI*2); g.fill();
    g.fillStyle=shade(base,-0.1); g.beginPath(); g.arc(0,s*0.1,s*0.14,0,Math.PI*2); g.fill(); g.stroke();
    g.fillStyle=dark; g.fillRect(-s*0.05,-s*0.55,s*0.1,s*0.42);
    g.fillStyle=glow; g.beginPath(); g.arc(-s*0.14,-s*0.5,s*0.05,0,Math.PI*2); g.arc(s*0.14,-s*0.5,s*0.05,0,Math.PI*2); g.fill();
  } else if(role==='vehHeavy'){
    g.fillStyle=dark; g.fillRect(-s*0.58,-s*0.55,s*0.22,s*1.15); g.fillRect(s*0.36,-s*0.55,s*0.22,s*1.15);
    for(let i=-4;i<=4;i++){ g.fillStyle=shade(dark,-0.3); g.fillRect(-s*0.58,i*s*0.13,s*0.22,s*0.05); g.fillRect(s*0.36,i*s*0.13,s*0.22,s*0.05); }
    g.fillStyle=grad(-s*0.4,-s*0.5,s*0.4,s*0.5);
    roundRect(g,-s*0.4,-s*0.5,s*0.8,s*1.0,s*0.1); g.fill(); g.stroke();
    g.fillStyle=shade(base,-0.05);
    g.beginPath(); for(let i=0;i<6;i++){const a=Math.PI/3*i-Math.PI/6;const px=Math.cos(a)*s*0.32,py=-s*0.05+Math.sin(a)*s*0.32; i===0?g.moveTo(px,py):g.lineTo(px,py);} g.closePath(); g.fill(); g.stroke();
    g.fillStyle=shadow; g.beginPath(); g.arc(0,-s*0.05,s*0.09,0,Math.PI*2); g.fill();
    g.fillStyle=dark; g.fillRect(-s*0.07,-s*0.9,s*0.14,s*0.65);
    g.fillStyle=shade(dark,0.2); g.fillRect(-s*0.09,-s*0.95,s*0.18,s*0.1);
    g.fillStyle=glow; g.beginPath(); g.arc(-s*0.2,s*0.46,s*0.05,0,Math.PI*2); g.arc(s*0.2,s*0.46,s*0.05,0,Math.PI*2); g.fill();
  } else if(role==='artillery'){
    g.fillStyle=dark; g.fillRect(-s*0.48,-s*0.3,s*0.18,s*0.75); g.fillRect(s*0.3,-s*0.3,s*0.18,s*0.75);
    g.fillStyle=grad(-s*0.35,-s*0.3,s*0.35,s*0.4);
    roundRect(g,-s*0.32,-s*0.32,s*0.64,s*0.7,s*0.1); g.fill(); g.stroke();
    g.strokeStyle=dark; g.lineWidth=s*0.09;
    g.beginPath(); g.moveTo(-s*0.2,s*0.35); g.lineTo(-s*0.42,s*0.62); g.stroke();
    g.beginPath(); g.moveTo(s*0.2,s*0.35); g.lineTo(s*0.42,s*0.62); g.stroke();
    g.lineWidth=W*0.014; g.strokeStyle='rgba(0,0,0,0.6)';
    g.fillStyle=dark; g.fillRect(-s*0.07,-s*1.05,s*0.14,s*0.85);
    g.fillStyle=shade(dark,0.25); g.fillRect(-s*0.12,-s*1.05,s*0.24,s*0.12);
    g.fillStyle=glow; g.beginPath(); g.arc(0,-s*0.12,s*0.07,0,Math.PI*2); g.fill();
  } else if(role==='aircraft'){
    g.fillStyle=shade(base,-0.15);
    g.beginPath(); g.moveTo(0,-s*0.1); g.lineTo(s*0.7,s*0.4); g.lineTo(s*0.4,s*0.46); g.lineTo(0,s*0.14); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0,-s*0.1); g.lineTo(-s*0.7,s*0.4); g.lineTo(-s*0.4,s*0.46); g.lineTo(0,s*0.14); g.closePath(); g.fill(); g.stroke();
    g.fillStyle=grad(-s*0.2,-s*0.65,s*0.2,s*0.55);
    g.beginPath(); g.moveTo(0,-s*0.65); g.lineTo(s*0.16,s*0.05); g.lineTo(s*0.1,s*0.5); g.lineTo(-s*0.1,s*0.5); g.lineTo(-s*0.16,s*0.05); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle=glow; g.beginPath(); g.ellipse(0,-s*0.32,s*0.08,s*0.16,0,0,Math.PI*2); g.fill();
    g.beginPath(); g.arc(s*0.66,s*0.4,s*0.05,0,Math.PI*2); g.arc(-s*0.66,s*0.4,s*0.05,0,Math.PI*2); g.fill();
    g.fillStyle='rgba(255,150,60,0.85)'; g.beginPath(); g.ellipse(0,s*0.52,s*0.08,s*0.14,0,0,Math.PI*2); g.fill();
  }

  // faction detailing overlay
  if(fac.key==='UCA'){
    g.strokeStyle='rgba(255,220,90,0.7)'; g.lineWidth=W*0.01;
    g.beginPath(); g.moveTo(-s*0.3,-s*0.02); g.lineTo(-s*0.18,-s*0.02); g.stroke();
    g.fillStyle='rgba(0,0,0,0.35)';
    [[-s*0.3,-s*0.35],[s*0.3,-s*0.35],[-s*0.3,s*0.3],[s*0.3,s*0.3]].forEach(([rx,ry])=>{ g.beginPath(); g.arc(rx,ry,W*0.008,0,Math.PI*2); g.fill(); });
  } else if(fac.key==='EBD'){
    g.fillStyle='rgba(0,0,0,0.18)';
    for(let i=0;i<4;i++){ g.beginPath(); g.arc(seededRand(i)*s*0.6-s*0.3, seededRand(i+9)*s*0.6-s*0.3, s*0.12, 0, Math.PI*2); g.fill(); }
    g.fillStyle=glow; g.beginPath(); g.arc(-s*0.1,-s*0.05,s*0.035,0,Math.PI*2); g.arc(s*0.1,-s*0.05,s*0.035,0,Math.PI*2); g.fill();
  } else if(fac.key==='PQC'){
    g.save(); g.shadowColor=glow; g.shadowBlur=W*0.06;
    g.strokeStyle=glow; g.lineWidth=W*0.008;
    g.beginPath(); g.moveTo(-s*0.3,-s*0.4); g.lineTo(s*0.3,-s*0.4); g.stroke();
    g.restore();
  }
  g.restore();
}

function getBuildingSprite(type,facKey){
  const def=BUILDING_DEFS[type];
  const w=def.w*TILE*2, h=def.h*TILE*2;
  return getCachedSprite('b_'+type+'_'+facKey,w,h,(g,ww,hh)=>drawBuildingArt(g,ww,hh,type,FACTIONS[facKey]));
}
function drawBuildingArt(g,W,H,type,fac){
  const base=fac.accent, dark=fac.accent2, glow=fac.glow;
  const light=shade(base,0.35), shadow=shade(base,-0.5);
  const grad=(x0,y0,x1,y1)=>{ const gr=g.createLinearGradient(x0,y0,x1,y1); gr.addColorStop(0,light); gr.addColorStop(0.6,base); gr.addColorStop(1,shadow); return gr; };
  g.save(); g.translate(W/2,H/2);
  const hw=W/2-W*0.04, hh=H/2-H*0.04;
  g.lineWidth=W*0.01; g.strokeStyle='rgba(0,0,0,0.6)';

  if(type==='commandCenter'){
    g.fillStyle=grad(-hw,-hh*0.2,hw,hh);
    roundRect(g,-hw,-hh*0.1,hw*2,hh*1.1,hw*0.06); g.fill(); g.stroke();
    g.fillStyle=shade(base,-0.1);
    roundRect(g,-hw*0.62,-hh*0.62,hw*1.24,hh*0.55,hw*0.06); g.fill(); g.stroke();
    g.fillStyle=glow;
    for(let i=-2;i<=2;i++) g.fillRect(i*hw*0.2-hw*0.03,-hh*0.02,hw*0.06,hh*0.1);
    g.strokeStyle=dark; g.lineWidth=W*0.018; g.beginPath(); g.moveTo(0,-hh*0.62); g.lineTo(0,-hh*1.1); g.stroke();
    g.fillStyle=glow; g.beginPath(); g.arc(0,-hh*1.12,W*0.018,0,Math.PI*2); g.fill();
    g.fillStyle=dark; roundRect(g,-hw*0.18,hh*0.15,hw*0.36,hh*0.28,hw*0.03); g.fill();
  } else if(type==='barracks'){
    g.fillStyle=grad(-hw,-hh,hw,hh);
    roundRect(g,-hw,-hh,hw*2,hh*2,hw*0.06); g.fill(); g.stroke();
    g.fillStyle=shade(base,-0.15); g.fillRect(-hw,-hh,hw*2,hh*0.35);
    g.fillStyle=dark; roundRect(g,-hw*0.2,hh*0.25,hw*0.4,hh*0.75,hw*0.03); g.fill();
    g.fillStyle=glow;
    g.fillRect(-hw*0.75,-hh*0.55,hw*0.14,hh*0.14); g.fillRect(hw*0.6,-hh*0.55,hw*0.14,hh*0.14);
    g.fillStyle=shadow;
    for(let i=-1;i<=1;i++){ g.beginPath(); g.ellipse(i*hw*0.5,hh*0.92,hw*0.22,hh*0.09,0,0,Math.PI*2); g.fill(); }
  } else if(type==='factory'){
    g.fillStyle=grad(-hw,-hh*0.85,hw,hh);
    roundRect(g,-hw,-hh*0.85,hw*2,hh*1.85,hw*0.05); g.fill(); g.stroke();
    g.strokeStyle=shadow; g.lineWidth=W*0.012;
    g.beginPath(); g.moveTo(-hw,-hh*0.85); g.lineTo(0,-hh*1.2); g.lineTo(hw,-hh*0.85); g.stroke();
    g.fillStyle=dark; g.fillRect(hw*0.4,-hh*1.55,hw*0.26,hh*0.7);
    g.fillStyle='rgba(160,160,170,0.5)'; g.beginPath(); g.ellipse(hw*0.53,-hh*1.6,hw*0.12,hh*0.06,0,0,Math.PI*2); g.fill();
    g.save(); g.beginPath(); g.rect(-hw,hh*0.55,hw*2,hh*0.18); g.clip();
    for(let i=-6;i<6;i++){ g.fillStyle=i%2===0?'#e8b93a':'#161616'; g.fillRect(i*hw*0.22,hh*0.5,hw*0.16,hh*0.3); }
    g.restore();
    g.fillStyle=glow; roundRect(g,-hw*0.18,-hh*0.35,hw*0.36,hh*0.5,hw*0.04); g.fill();
  } else if(type==='airfield'){
    g.fillStyle=grad(-hw,-hh*0.25,hw,hh);
    roundRect(g,-hw,-hh*0.25,hw*2,hh*1.3,hw*0.05); g.fill(); g.stroke();
    g.strokeStyle='rgba(255,255,255,0.4)'; g.lineWidth=W*0.01;
    for(let i=-2;i<=2;i++){ g.beginPath(); g.moveTo(i*hw*0.32,-hh*0.15); g.lineTo(i*hw*0.32,hh*0.95); g.stroke(); }
    g.fillStyle=shade(base,-0.1); roundRect(g,hw*0.38,-hh*1.15,hw*0.5,hh*0.95,hw*0.04); g.fill(); g.stroke();
    g.fillStyle=glow; g.fillRect(hw*0.44,-hh*1.05,hw*0.38,hh*0.2);
  } else if(type==='turret'){
    g.fillStyle=grad(-hw,-hh,hw,hh);
    g.beginPath(); g.arc(0,0,hw*0.95,0,Math.PI*2); g.fill(); g.stroke();
    g.fillStyle=shadow; g.beginPath(); g.arc(0,0,hw*0.55,0,Math.PI*2); g.fill();
    g.fillStyle=glow; g.beginPath(); g.arc(0,0,hw*0.18,0,Math.PI*2); g.fill();
  }

  if(fac.key==='UCA'){
    g.strokeStyle='rgba(255,220,90,0.55)'; g.lineWidth=W*0.008;
    g.strokeRect(-hw*0.98,-hh*0.95,hw*1.96,hh*0.12);
  } else if(fac.key==='EBD'){
    g.strokeStyle=dark; g.lineWidth=W*0.016;
    g.beginPath(); g.moveTo(-hw*0.9,-hh*0.9); g.lineTo(-hw*1.1,-hh*1.2); g.stroke();
    g.beginPath(); g.moveTo(hw*0.9,-hh*0.9); g.lineTo(hw*1.1,-hh*1.2); g.stroke();
  } else if(fac.key==='PQC'){
    g.save(); g.shadowColor=glow; g.shadowBlur=W*0.025;
    g.strokeStyle=glow; g.lineWidth=W*0.008; g.strokeRect(-hw*0.96,-hh*0.96,hw*1.92,hh*1.92);
    g.restore();
  }
  g.restore();
}
function shapePath(ctx,shape,cx,cy,s){
  ctx.beginPath();
  switch(shape){
    case 'circle': ctx.arc(cx,cy,s*0.5,0,Math.PI*2); break;
    case 'triangle': ctx.moveTo(cx,cy-s*0.55); ctx.lineTo(cx-s*0.5,cy+s*0.45); ctx.lineTo(cx+s*0.5,cy+s*0.45); ctx.closePath(); break;
    case 'square': ctx.rect(cx-s*0.4,cy-s*0.4,s*0.8,s*0.8); break;
    case 'diamond': ctx.moveTo(cx,cy-s*0.55); ctx.lineTo(cx+s*0.55,cy); ctx.lineTo(cx,cy+s*0.55); ctx.lineTo(cx-s*0.55,cy); ctx.closePath(); break;
    case 'hex': for(let i=0;i<6;i++){const a=Math.PI/3*i-Math.PI/6;const px=cx+Math.cos(a)*s*0.55,py=cy+Math.sin(a)*s*0.55; i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);} ctx.closePath(); break;
    case 'pentagon': for(let i=0;i<5;i++){const a=-Math.PI/2+Math.PI*2/5*i;const px=cx+Math.cos(a)*s*0.55,py=cy+Math.sin(a)*s*0.55; i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);} ctx.closePath(); break;
    case 'chevron': ctx.moveTo(cx,cy-s*0.5); ctx.lineTo(cx+s*0.5,cy+s*0.15); ctx.lineTo(cx+s*0.18,cy+s*0.1); ctx.lineTo(cx,cy+s*0.5); ctx.lineTo(cx-s*0.18,cy+s*0.1); ctx.lineTo(cx-s*0.5,cy+s*0.15); ctx.closePath(); break;
    case 'cc': ctx.moveTo(cx-s*0.5,cy+s*0.1); ctx.lineTo(cx-s*0.5,cy+s*0.5); ctx.lineTo(cx+s*0.5,cy+s*0.5); ctx.lineTo(cx+s*0.5,cy+s*0.1); ctx.lineTo(cx,cy-s*0.5); ctx.closePath(); break;
    case 'turret': ctx.rect(cx-s*0.12,cy-s*0.5,s*0.24,s); break;
    default: ctx.arc(cx,cy,s*0.5,0,Math.PI*2);
  }
}

function render(){
  ctx.save();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const sx=shake?rnd(-shake,shake):0, sy=shake?rnd(-shake,shake):0;
  ctx.translate(-cam.x+sx,-cam.y+sy);

  drawTerrain();
  nodes.forEach(drawNode);
  buildings.slice().sort((a,b)=>a.y-b.y).forEach(drawBuilding);
  units.slice().sort((a,b)=>a.y-b.y).forEach(drawUnit);
  drawParticles();
  drawFog();
  drawPlacementGhost();
  ctx.restore();

  drawDragBox();
  drawMinimap();
}

function drawTerrain(){
  ctx.fillStyle='#0b1119';
  ctx.fillRect(0,0,WORLD_W,WORLD_H);
  ctx.strokeStyle='rgba(120,150,180,0.05)'; ctx.lineWidth=1;
  const c0=Math.floor(cam.x/TILE), c1=Math.ceil((cam.x+canvas.width)/TILE);
  const r0=Math.floor(cam.y/TILE), r1=Math.ceil((cam.y+canvas.height)/TILE);
  for(let c=c0;c<=c1;c++){ ctx.beginPath(); ctx.moveTo(c*TILE,r0*TILE); ctx.lineTo(c*TILE,r1*TILE); ctx.stroke(); }
  for(let r=r0;r<=r1;r++){ ctx.beginPath(); ctx.moveTo(c0*TILE,r*TILE); ctx.lineTo(c1*TILE,r*TILE); ctx.stroke(); }
  // world border
  ctx.strokeStyle='rgba(120,150,180,0.25)'; ctx.strokeRect(0,0,WORLD_W,WORLD_H);
}

function drawNode(n){
  if(!tileVisited(n.x,n.y)) return;
  const pct=n.amount/n.maxAmount;
  ctx.save(); ctx.translate(n.x,n.y);
  ctx.globalAlpha=tileVisible(n.x,n.y)?1:0.45;
  for(let i=0;i<5;i++){
    const a=i*1.256, r=10+ (i%2)*4;
    ctx.fillStyle=`hsl(${190+i*8},70%,${40+pct*20}%)`;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r-8);
    ctx.lineTo(Math.cos(a)*r-4,Math.sin(a)*r+6);
    ctx.lineTo(Math.cos(a)*r+4,Math.sin(a)*r+6);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawBuilding(b){
  const visNow=tileVisible(b.x+b.w*TILE/2,b.y+b.h*TILE/2);
  const wasSeen=tileVisited(b.x+b.w*TILE/2,b.y+b.h*TILE/2);
  if(b.owner===1 && !visNow) return; // enemy hidden by fog
  if(!wasSeen && b.owner===1) return;
  const fac=FACTIONS[b.owner===0?playerFaction:aiFactionKey];
  const def=BUILDING_DEFS[b.type];
  const cx=b.x+b.w*TILE/2, cy=b.y+b.h*TILE/2;
  ctx.save();
  ctx.globalAlpha = (b.owner===0 || visNow) ? 1 : 0.5;
  // footprint
  ctx.fillStyle=b.constructing?'rgba(120,120,120,0.25)':'rgba(20,30,45,0.85)';
  ctx.strokeStyle=b.selected?'#ffffff':fac.accent2;
  ctx.lineWidth=b.selected?2:1;
  ctx.fillRect(b.x+2,b.y+2,b.w*TILE-4,b.h*TILE-4);
  ctx.strokeRect(b.x+2,b.y+2,b.w*TILE-4,b.h*TILE-4);
  // detailed cached sprite (baked art), scaled to the footprint
  const spr=getBuildingSprite(b.type,b.owner===0?playerFaction:aiFactionKey);
  ctx.drawImage(spr,b.x+3,b.y+3,b.w*TILE-6,b.h*TILE-6);
  // live dynamic overlays: turret barrel aims at target, airfield radar spins
  if(b.type==='turret' && !b.constructing){
    const bw=b.w*TILE-6;
    ctx.save(); ctx.translate(cx,cy); ctx.rotate((b.aimAngle!==undefined?b.aimAngle:-Math.PI/2)+Math.PI/2);
    ctx.fillStyle=fac.accent2; ctx.fillRect(-bw*0.08,-bw*0.85,bw*0.16,bw*0.75);
    ctx.fillStyle=shade(fac.accent2,0.25); ctx.fillRect(-bw*0.1,-bw*0.85,bw*0.2,bw*0.1);
    ctx.restore();
  }
  if(b.type==='airfield' && !b.constructing){
    const bw=b.w*TILE;
    ctx.save(); ctx.translate(cx+bw*0.15,cy-b.h*TILE*0.62); ctx.rotate(gameTime*2.2);
    ctx.strokeStyle=fac.glow; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.moveTo(-bw*0.14,0); ctx.lineTo(bw*0.14,0); ctx.stroke();
    ctx.restore();
  }
  // hp bar
  drawHpBar(cx,b.y-6,b.w*TILE-8,b.hp,b.maxHp);
  if(b.constructing){ ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.font='9px monospace'; ctx.textAlign='center'; ctx.fillText('СТРОЙКА',cx,cy+b.h*TILE/2-4); }
  ctx.restore();
}

function drawUnit(u){
  const visNow=tileVisible(u.x,u.y);
  if(u.owner===1 && !visNow) return;
  const facKey=u.owner===0?playerFaction:aiFactionKey;
  const fac=FACTIONS[facKey];
  ctx.save();
  if(u.flying){ ctx.globalAlpha=0.9; ctx.beginPath(); ctx.ellipse(u.x,u.y+10,11,4,0,0,Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.4)'; ctx.fill(); }
  ctx.translate(u.x,u.y);
  ctx.rotate(u.angle+Math.PI/2);
  const spr=getUnitSprite(u.type,facKey);
  const drawSize=u.type==='worker'?26:32;
  ctx.drawImage(spr,-drawSize/2,-drawSize/2,drawSize,drawSize);
  if(u.selected){
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.arc(0,0,17,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();
  if(u.carry>0){ ctx.fillStyle='#8ff2fb'; ctx.beginPath(); ctx.arc(u.x+8,u.y-8,3,0,Math.PI*2); ctx.fill(); }
  drawHpBar(u.x,u.y-16,22,u.hp,u.maxHp);
}

function drawHpBar(cx,topY,w,hp,maxHp){
  const pct=Math.max(0,hp/maxHp);
  ctx.fillStyle='#000'; ctx.fillRect(cx-w/2-1,topY-1,w+2,5);
  ctx.fillStyle='#1a2230'; ctx.fillRect(cx-w/2,topY,w,3);
  ctx.fillStyle=pct>0.6?'#4ade80':pct>0.3?'#facc15':'#ef4444';
  ctx.fillRect(cx-w/2,topY,w*pct,3);
}

function drawParticles(){
  particles.forEach(p=>{
    if(p.type==='bullet'){
      ctx.strokeStyle=p.color; ctx.globalAlpha=p.life/p.maxLife; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.tx,p.ty); ctx.stroke();
      ctx.globalAlpha=1; return;
    }
    ctx.globalAlpha=Math.max(0,p.life/p.maxLife);
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  });
}

function drawFog(){
  const c0=Math.floor(cam.x/TILE), c1=Math.ceil((cam.x+canvas.width)/TILE);
  const r0=Math.floor(cam.y/TILE), r1=Math.ceil((cam.y+canvas.height)/TILE);
  for(let c=c0;c<=c1;c++) for(let r=r0;r<=r1;r++){
    if(c<0||r<0||c>=COLS||r>=ROWS) continue;
    const idx=fIdx(c,r);
    if(!visited[idx]){ ctx.fillStyle='#000'; ctx.fillRect(c*TILE,r*TILE,TILE+1,TILE+1); }
    else if(!visible[idx]){ ctx.fillStyle='rgba(0,4,10,0.55)'; ctx.fillRect(c*TILE,r*TILE,TILE+1,TILE+1); }
  }
}

function drawPlacementGhost(){
  if(!placingType) return;
  const def=BUILDING_DEFS[placingType];
  const wx=mouse.wx, wy=mouse.wy;
  const gx=Math.round((wx-def.w*TILE/2)/TILE)*TILE, gy=Math.round((wy-def.h*TILE/2)/TILE)*TILE;
  const cells=footprintCells(gx,gy,def.w,def.h);
  const free=cells.every(([c,r])=>cellFree(c,r,null));
  const near=nearOwnedBuilding(gx+def.w*TILE/2,gy+def.h*TILE/2,0,260);
  const ok=free&&near;
  ctx.save();
  ctx.strokeStyle=ok?'#4ade80':'#ef4444';
  ctx.lineWidth=1;
  cells.forEach(([c,r])=>{ ctx.strokeRect(c*TILE,r*TILE,TILE,TILE); });
  ctx.fillStyle=ok?'rgba(74,222,128,0.18)':'rgba(239,68,68,0.18)';
  ctx.fillRect(gx,gy,def.w*TILE,def.h*TILE);
  ctx.fillStyle=ok?'#4ade80':'#ef4444';
  shapePath(ctx,def.shape,gx+def.w*TILE/2,gy+def.h*TILE/2,Math.min(def.w,def.h)*TILE*0.7);
  ctx.globalAlpha=0.6; ctx.fill(); ctx.globalAlpha=1;
  ctx.restore();
}

function drawDragBox(){
  if(!dragBox) return;
  const x=Math.min(dragBox.x0,dragBox.x1), y=Math.min(dragBox.y0,dragBox.y1);
  const w=Math.abs(dragBox.x1-dragBox.x0), h=Math.abs(dragBox.y1-dragBox.y0);
  ctx.strokeStyle='rgba(140,220,255,0.9)'; ctx.fillStyle='rgba(140,220,255,0.12)';
  ctx.lineWidth=1; ctx.fillRect(x,y,w,h); ctx.strokeRect(x,y,w,h);
}

function drawMinimap(){
  mmCtx.clearRect(0,0,mmCanvas.width,mmCanvas.height);
  mmCtx.fillStyle='#04070a'; mmCtx.fillRect(0,0,mmCanvas.width,mmCanvas.height);
  const sx=mmCanvas.width/WORLD_W, sy=mmCanvas.height/WORLD_H;
  // fog
  mmCtx.fillStyle='rgba(255,255,255,0.04)';
  for(let c=0;c<COLS;c++) for(let r=0;r<ROWS;r++){ if(visited[fIdx(c,r)]) mmCtx.fillRect(c*TILE*sx,r*TILE*sy,TILE*sx+1,TILE*sy+1); }
  nodes.forEach(n=>{ if(!tileVisited(n.x,n.y))return; mmCtx.fillStyle='#3ea0c9'; mmCtx.fillRect(n.x*sx-1,n.y*sy-1,3,3); });
  buildings.forEach(b=>{
    if(b.owner===1 && !tileVisited(b.x,b.y)) return;
    mmCtx.fillStyle=b.owner===0?FACTIONS[playerFaction].accent:'#e05a5a';
    mmCtx.fillRect(b.x*sx,b.y*sy,Math.max(2,b.w*TILE*sx),Math.max(2,b.h*TILE*sy));
  });
  units.forEach(u=>{
    if(u.owner===1 && !tileVisible(u.x,u.y)) return;
    mmCtx.fillStyle=u.owner===0?FACTIONS[playerFaction].glow:'#ff8b7a';
    mmCtx.fillRect(u.x*sx-1,u.y*sy-1,2,2);
  });
  mmCtx.strokeStyle='#fff'; mmCtx.lineWidth=1;
  mmCtx.strokeRect(cam.x*sx,cam.y*sy,canvas.width*sx,canvas.height*sy);
}

/* =========================================================================
   TOPBAR
   ========================================================================= */
function updateTopbar(){
  document.getElementById('statCrystal').textContent=Math.floor(resources[0]);
  document.getElementById('statPop').textContent=popUsed[0]+'/'+computePopCap(0);
  const t=Math.floor(gameTime);
  document.getElementById('statTime').textContent=String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
}
function computePopCap(owner){
  let cap=8;
  buildings.forEach(b=>{ if(b.owner===owner&&b.type==='commandCenter'&&!b.constructing) cap+=12; });
  return cap;
}

/* =========================================================================
   INPUT
   ========================================================================= */
canvas.addEventListener('mousemove',e=>{
  const r=canvas.getBoundingClientRect();
  mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top;
  mouse.wx=mouse.x+cam.x; mouse.wy=mouse.y+cam.y;
  if(mouse.down && !placingType){ dragBox.x1=mouse.x; dragBox.y1=mouse.y; }
});
canvas.addEventListener('mousedown',e=>{
  if(gameOver) return;
  const r=canvas.getBoundingClientRect();
  mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top;
  mouse.wx=mouse.x+cam.x; mouse.wy=mouse.y+cam.y;
  if(e.button===0){
    if(placingType){ tryConfirmPlacement(mouse.wx,mouse.wy); return; }
    mouse.down=true; dragBox={x0:mouse.x,y0:mouse.y,x1:mouse.x,y1:mouse.y};
  } else if(e.button===2){
    if(placingType){ cancelPlacement(); return; }
    rightClickCommand(mouse.wx,mouse.wy);
  }
});
window.addEventListener('mouseup',e=>{
  if(e.button!==0) return;
  if(mouse.down){
    mouse.down=false;
    const w=Math.abs(dragBox.x1-dragBox.x0), h=Math.abs(dragBox.y1-dragBox.y0);
    if(w<4&&h<4){ clickSelect(mouse.wx,mouse.wy,e.shiftKey); }
    else { boxSelect(dragBox,e.shiftKey); }
    dragBox=null;
  }
});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
  keys[e.key.toLowerCase()]=true;
  if(e.key==='Escape' && placingType) cancelPlacement();
  if(/^[1-9]$/.test(e.key)){
    if(e.ctrlKey||keys['control']){ ctrlGroups[e.key]=selection.filter(x=>x.kind==='unit').map(u=>u.id); }
    else {
      const ids=ctrlGroups[e.key]||[];
      selection=units.filter(u=>ids.includes(u.id));
      selection.forEach(s=>s.selected=true);
      clearOtherSel(selection);
      updateSelPanel();
    }
  }
});
window.addEventListener('keyup',e=>{ keys[e.key.toLowerCase()]=false; });

function handleCameraKeys(dt){
  const spd=520*dt;
  if(keys['w']||keys['arrowup']) cam.y-=spd;
  if(keys['s']||keys['arrowdown']) cam.y+=spd;
  if(keys['a']||keys['arrowleft']) cam.x-=spd;
  if(keys['d']||keys['arrowright']) cam.x+=spd;
  // edge scroll
  const edge=18;
  if(mouse.x<edge) cam.x-=spd; if(mouse.x>canvas.width-edge) cam.x+=spd;
  if(mouse.y<edge) cam.y-=spd; if(mouse.y>canvas.height-edge) cam.y+=spd;
  cam.x=clamp(cam.x,0,Math.max(0,WORLD_W-canvas.width));
  cam.y=clamp(cam.y,0,Math.max(0,WORLD_H-canvas.height));
}

function clearOtherSel(list){
  units.forEach(u=>u.selected=list.includes(u));
  buildings.forEach(b=>b.selected=list.includes(b));
}
function clickSelect(wx,wy,shift){
  let found=null;
  for(const u of units){ if(u.owner===0 && dist(u,{x:wx,y:wy})<14){ found=u; break; } }
  if(!found){
    for(const b of buildings){ if(b.owner===0 && wx>=b.x&&wx<=b.x+b.w*TILE&&wy>=b.y&&wy<=b.y+b.h*TILE){ found=b; break; } }
  }
  if(!found && !shift){ selection=[]; clearOtherSel(selection); updateSelPanel(); return; }
  if(found){
    if(shift){ if(!selection.includes(found)) selection.push(found); }
    else selection=[found];
  }
  clearOtherSel(selection);
  updateSelPanel();
}
function boxSelect(box,shift){
  const x0=Math.min(box.x0,box.x1)+cam.x, x1=Math.max(box.x0,box.x1)+cam.x;
  const y0=Math.min(box.y0,box.y1)+cam.y, y1=Math.max(box.y0,box.y1)+cam.y;
  const found=units.filter(u=>u.owner===0&&u.x>=x0&&u.x<=x1&&u.y>=y0&&u.y<=y1);
  if(!shift) selection=found; else found.forEach(u=>{ if(!selection.includes(u)) selection.push(u); });
  clearOtherSel(selection);
  updateSelPanel();
}
function rightClickCommand(wx,wy){
  if(selection.length===0) return;
  // if a single production building selected -> set rally
  if(selection.length===1 && selection[0].kind==='building' && BUILDING_DEFS[selection[0].type].produces.length){
    selection[0].rally={x:wx,y:wy};
    return;
  }
  const unitsSel=selection.filter(s=>s.kind==='unit');
  if(!unitsSel.length) return;
  // enemy target under cursor?
  let enemy=null;
  for(const u of units){ if(u.owner!==0 && dist(u,{x:wx,y:wy})<14 && tileVisible(u.x,u.y)){ enemy=u; break; } }
  if(!enemy){ for(const b of buildings){ if(b.owner!==0 && wx>=b.x&&wx<=b.x+b.w*TILE&&wy>=b.y&&wy<=b.y+b.h*TILE && (tileVisible(b.x+4,b.y+4)||true)){ enemy=b; break; } } }
  let node=null;
  if(!enemy) node=nodes.find(n=>dist(n,{x:wx,y:wy})<18);
  unitsSel.forEach((u,i)=>{
    u.attackingOrder=false;
    if(enemy){ u.job=null; u.moveTarget=null; u.target=enemy; }
    else if(node && u.type==='worker'){ u.job={type:'harvest',nodeId:node.id,state:'toNode'}; u.moveTarget=node; }
    else { u.job=null; u.target=null; const off=i*10; u.moveTarget={x:wx+Math.cos(i)*off,y:wy+Math.sin(i)*off}; }
  });
}
mmCanvas.addEventListener('mousedown',e=>{
  const r=mmCanvas.getBoundingClientRect();
  const mx=(e.clientX-r.left)/mmCanvas.width*WORLD_W, my=(e.clientY-r.top)/mmCanvas.height*WORLD_H;
  cam.x=clamp(mx-canvas.width/2,0,Math.max(0,WORLD_W-canvas.width));
  cam.y=clamp(my-canvas.height/2,0,Math.max(0,WORLD_H-canvas.height));
});

