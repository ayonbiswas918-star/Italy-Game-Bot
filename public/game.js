/**
 * Italy Card Game — Client v6
 * Reconnect · Discard All · Round-2 fix
 */
const socket = io();

// ── Persistent session ────────────────────────
function getSessionId(){
  let sid = localStorage.getItem('italy_session');
  if(!sid){ sid = 'sid_'+Date.now()+'_'+Math.random().toString(36).substr(2,8); localStorage.setItem('italy_session',sid); }
  return sid;
}
const SESSION_ID = getSessionId();

// ── State ─────────────────────────────────────
let myPos=-1, myHand=[], validIds=[], isMyTurn=false;
let botMode='2v2', botDifficulty='medium';
let currentBid=0, currentBidder=-1;
let trumpSuit=null, trumpRevealed=false, leadSuit=null;
let scores={A:0,B:0}, roundNum=1, matchTarget=30;
let players=[], bidLog=[], handCounts={0:0,1:0,2:0,3:0};
let dealerPos=0, dragId=null, canRevTrump=false, amHost=false;
let myEmoji='🎴', playerEmojis={};
let bidTimerInterval=null;
let currentRoomCode=null;
let canDiscardAll=false;

const EMOJIS=['🎴','🃏','🦁','🐯','🦊','🐺','🦅','🦋','🌟','💎','🔥','⚡','🎭','👑','🎯','🏆'];
const SYM={spades:'♠',hearts:'♥',diamonds:'♦',clubs:'♣'};
const COL={spades:'k',hearts:'r',diamonds:'r',clubs:'k'};
const teamOf=p=>p%2===0?'A':'B';
const vslot=sp=>['bottom','right','top','left'][((sp-myPos)+4)%4];
const $=id=>document.getElementById(id);
const showScreen=n=>{document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));$(n).classList.add('active');};
const showOv=id=>$(id).classList.add('open');
const hideOv=id=>$(id).classList.remove('open');
const hideAllOv=()=>document.querySelectorAll('.ov').forEach(o=>o.classList.remove('open'));

// ── Audio ─────────────────────────────────────
let actx=null;
const aC=()=>{if(!actx)actx=new(window.AudioContext||window.webkitAudioContext)();return actx;};
function tone(f,d=.1,t='sine',v=.12){
  try{const c=aC(),o=c.createOscillator(),g=c.createGain();
    o.connect(g);g.connect(c.destination);o.type=t;o.frequency.value=f;
    g.gain.setValueAtTime(v,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+d);
    o.start();o.stop(c.currentTime+d);}catch(e){}
}
const sfxCard  =()=>tone(380,.07,'square',.09);
const sfxDeal  =()=>tone(620,.06,'sine',.08);
const sfxBid   =()=>tone(370,.09,'triangle',.12);
const sfxErr   =()=>tone(190,.14,'sawtooth',.09);
const sfxWin   =()=>{tone(500,.13,'sine',.12);setTimeout(()=>tone(630,.13,'sine',.1),105);};
const sfxTrump =()=>{[750,880,1050].forEach((f,i)=>setTimeout(()=>tone(f,.22,'sine',.15),i*95));};
const sfxGame  =()=>{[500,630,750,1000,1260].forEach((f,i)=>setTimeout(()=>tone(f,.2,'sine',.13),i*125));};
const sfxTick  =()=>tone(850,.04,'square',.07);

// ── Reconnect on disconnect ───────────────────
socket.on('disconnect', ()=>{
  if(!currentRoomCode) return;
  toast('⚠ Connection lost. Reconnecting…', 8000);
});
socket.on('connect', ()=>{
  // Auto-reconnect if we know our room
  if(currentRoomCode){
    socket.emit('reconnectGame',{ sessionId:SESSION_ID, roomCode:currentRoomCode });
  }
});

// ── Particles (lobby) ─────────────────────────
function initParticles(){
  const cv=$('bg-canvas');if(!cv)return;
  const ctx=cv.getContext('2d');
  const resize=()=>{cv.width=innerWidth;cv.height=innerHeight;};
  resize();addEventListener('resize',resize);
  const pts=[];
  for(let i=0;i<55;i++)pts.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,
    vx:(Math.random()-.5)*.28,vy:(Math.random()-.5)*.28,r:Math.random()*1.5+.4,
    a:Math.random()*.5+.1,color:Math.random()<.5?'#c8941a':'#5b9cf6'});
  (function draw(){
    ctx.clearRect(0,0,cv.width,cv.height);
    pts.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0)p.x=cv.width;if(p.x>cv.width)p.x=0;
      if(p.y<0)p.y=cv.height;if(p.y>cv.height)p.y=0;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.color;ctx.globalAlpha=p.a;ctx.fill();
    });ctx.globalAlpha=1;requestAnimationFrame(draw);
  })();
}

// ── Confetti ──────────────────────────────────
function launchConfetti(duration=3200){
  const cv=$('confetti-canvas');if(!cv)return;
  cv.style.display='block';cv.width=innerWidth;cv.height=innerHeight;
  const ctx=cv.getContext('2d');
  const cols=['#c8941a','#e5b84a','#f5e4a0','#5b9cf6','#f47a7a','#80cbc4','#ce93d8','#fff'];
  const pieces=[];
  for(let i=0;i<150;i++)pieces.push({x:Math.random()*cv.width,y:-15-Math.random()*120,
    w:5+Math.random()*8,h:7+Math.random()*7,r:Math.random()*Math.PI*2,
    dr:(Math.random()-.5)*.22,vx:(Math.random()-.5)*5,vy:2.2+Math.random()*4.5,
    col:cols[Math.floor(Math.random()*cols.length)]});
  let start=null;
  (function frame(ts){
    if(!start)start=ts;const el=ts-start;
    const fade=Math.max(0,1-(el-duration*.55)/(duration*.45));
    ctx.clearRect(0,0,cv.width,cv.height);
    pieces.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;p.r+=p.dr;p.vy+=.06;
      ctx.save();ctx.globalAlpha=fade;
      ctx.translate(p.x,p.y);ctx.rotate(p.r);
      ctx.fillStyle=p.col;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.restore();
    });
    if(el<duration)requestAnimationFrame(frame);
    else{ctx.clearRect(0,0,cv.width,cv.height);cv.style.display='none';}
  })(0);
}

// ── Trump explosion ───────────────────────────
function showTrumpExplosion(suit){
  const fx=$('trump-fx');const sf=$('tf-suit');
  if(!fx||!sf)return;
  sf.textContent=SYM[suit]||'★';$('tf-text').textContent='TRUMP REVEALED!';
  fx.classList.remove('show');void fx.offsetWidth;
  fx.classList.add('show');
  setTimeout(()=>fx.classList.remove('show'),1000);
}

// ── Bid Timer ─────────────────────────────────
const TSECS=30,CIRC=Math.PI*2*21;
function startBidTimer(onExp){
  clearInterval(bidTimerInterval);let left=TSECS;
  const update=()=>{
    const n=$('t-num'),r=$('t-ring');
    if(n){n.textContent=left;n.className='t-num'+(left<=8?' warn':'');}
    if(r){r.style.strokeDashoffset=CIRC*(1-left/TSECS);r.className='t-fg'+(left<=8?' warn':'');}
    if(left<=5&&left>0)sfxTick();
    if(left<=0){clearInterval(bidTimerInterval);if(onExp)onExp();}
    left--;
  };
  update();bidTimerInterval=setInterval(update,1000);
}
function stopBidTimer(){
  clearInterval(bidTimerInterval);
  const n=$('t-num'),r=$('t-ring');
  if(n){n.textContent=TSECS;n.className='t-num';}
  if(r){r.style.strokeDashoffset=0;r.className='t-fg';}
}

// ── Toast ─────────────────────────────────────
function toast(msg,dur=2800){
  const el=document.createElement('div');el.className='toast';el.textContent=msg;
  $('toasts').appendChild(el);setTimeout(()=>el.remove(),dur+300);
}

// ── Fullscreen ────────────────────────────────
function toggleFullscreen(){
  if(!document.fullscreenElement&&!document.webkitFullscreenElement){
    const el=document.documentElement;
    (el.requestFullscreen||el.webkitRequestFullscreen||function(){}).call(el).catch(()=>{});
    screen.orientation?.lock?.('landscape').catch(()=>{});
  }else{
    (document.exitFullscreen||document.webkitExitFullscreen||function(){}).call(document).catch(()=>{});
  }
}

// ── Card Image Builder ─────────────────────────
// Maps game rank → filename prefix
const RANK_FILE = {
  'A':'ace','2':'2','3':'3','4':'4','5':'5','6':'6',
  '7':'7','8':'8','9':'9','10':'10',
  'J':'jack','Q':'queen','K':'king'
};

function cardImgPath(card){
  return `/cards/${RANK_FILE[card.rank]}_of_${card.suit}.png`;
}

function mkCard(card, cls=''){
  const d = document.createElement('div');
  d.className = `card img-card ${cls}`;
  d.dataset.id = card.id;
  // Use the PNG image as the card face
  const img = document.createElement('img');
  img.src = cardImgPath(card);
  img.alt = `${card.rank} of ${card.suit}`;
  img.draggable = false;
  // Fallback: if image fails to load, show text
  img.onerror = () => {
    img.style.display = 'none';
    const fb = document.createElement('div');
    fb.className = 'card-fallback';
    const col = ['hearts','diamonds'].includes(card.suit) ? '#d42b2b' : '#111';
    fb.innerHTML = `<span style="color:${col};font-family:'Cinzel',serif;font-size:1rem;font-weight:700">${card.rank}</span><span style="color:${col};font-size:.8rem">${SYM[card.suit]}</span>`;
    d.appendChild(fb);
  };
  d.appendChild(img);
  return d;
}
function mkBack(cls=''){const d=document.createElement('div');d.className=`card back ${cls}`;return d;}

// ── Render hand ───────────────────────────────
function renderHand(animate=false){
  const wrap=$('my-hand');if(!wrap)return;
  wrap.innerHTML='';

  // Show discard-all button only if allowed
  setDiscardBtn(canDiscardAll);

  myHand.forEach((card,i)=>{
    const el=mkCard(card,'mc');
    const ok=isMyTurn&&validIds.includes(card.id);
    if(isMyTurn)el.classList.add(ok?'vh':'inv');
    if(animate){el.classList.add('dealing');el.style.animationDelay=`${i*55}ms`;}
    el.addEventListener('click',()=>{
      if(!isMyTurn)return;
      if(!validIds.includes(card.id)){sfxErr();toast('Cannot play that card now!');return;}
      socket.emit('playCard',{cardId:card.id});
    });
    el.draggable=true;
    el.addEventListener('dragstart',e=>{
      if(!isMyTurn||!validIds.includes(card.id)){e.preventDefault();return;}
      dragId=card.id;el.classList.add('dragging');e.dataTransfer.setData('text/plain',card.id);
    });
    el.addEventListener('dragend',()=>{el.classList.remove('dragging');dragId=null;});
    wrap.appendChild(el);
  });
}

// ── Discard All ───────────────────────────────
function setDiscardBtn(show){
  const w=$('discard-wrap');if(w)w.style.display=show?'block':'none';
}
function onDiscardAll(){
  socket.emit('discardInitialHand');
  canDiscardAll=false;
  setDiscardBtn(false);
  $('status').textContent='Discarding hand…';
}

// ── Trick display ─────────────────────────────
function setTrick(sp,card){
  const s=vslot(sp)[0];const el=$(`ts-${s}`);if(!el)return;
  el.innerHTML='';if(card)el.appendChild(mkCard(card,'tc played'));
}
function clearTricks(){['t','b','l','r'].forEach(s=>{const e=$(`ts-${s}`);if(e)e.innerHTML='';});}
function flashWinner(sp){
  const s=vslot(sp)[0];const el=$(`ts-${s}`);if(!el)return;
  const c=el.querySelector('.card');if(c)c.classList.add('winner');
}

// ── Trump panel ───────────────────────────────
function updateTrumpPanel(){
  const sl=$('tp-slot'),su=$('tp-suit');
  if(!trumpRevealed){
    if(sl){sl.innerHTML='';sl.appendChild(mkBack('sm'));}
    if(su)su.textContent='Hidden';
  }else{
    if(su)su.innerHTML=`${SYM[trumpSuit]}<br><span style="font-size:.58rem">${trumpSuit}</span>`;
  }
}
function revealTrumpPanel(card){
  const sl=$('tp-slot');if(!sl)return;
  sl.innerHTML='';
  const c=mkCard(card,'med');
  c.style.animation='tcSlide .4s cubic-bezier(.34,1.56,.64,1)';
  sl.appendChild(c);
  $('tp-suit').innerHTML=`${SYM[card.suit]}<br><span style="font-size:.58rem">${card.suit}</span>`;
}
function setRevealBtn(show){const b=$('btn-trump');if(b)b.classList.toggle('show',show);canRevTrump=show;}
function onRevealTrump(){socket.emit('revealTrump');setRevealBtn(false);}

// ── Avatars / players ─────────────────────────
function setActiveAv(sp){
  ['top','left','right'].forEach(s=>{const e=$(`av-${s}`);if(e)e.classList.remove('active');});
  const me=$('av-me');if(me)me.classList.remove('active');
  if(sp<0)return;
  const s=vslot(sp);
  const el=s==='bottom'?$('av-me'):$(`av-${s}`);
  if(el)el.classList.add('active');
}
function renderPlayers(ps){
  ps.forEach(p=>{
    const tm=teamOf(p.position);const isMe=p.position===myPos;
    const s=isMe?'bottom':vslot(p.position);
    const avEl=isMe?$('av-me'):$(`av-${s}`);
    if(avEl){
      avEl.className=`av ${tm}${isMe?' sm':''}${p.online===false?' offline':''}`;
      const inner=avEl.querySelector('.av-inner');
      if(inner)inner.textContent=playerEmojis[p.position]||p.name[0].toUpperCase();
      // Bot badge
      let badge=avEl.querySelector('.bot-badge');
      if(p.isBot){
        if(!badge){badge=document.createElement('span');badge.className='bot-badge';badge.textContent='🤖';avEl.appendChild(badge);}
      } else if(badge){ badge.remove(); }
    }
    const nn=$(`nm-${s}`);if(nn)nn.textContent=isMe?p.name+' (You)':p.name+(p.isBot?' 🤖':'')+(p.online===false?' 🔴':'');
    const nt=$(`nt-${s}`);if(nt){nt.textContent=`Team ${tm}`;nt.className=`nc-t ${tm}`;}
  });
  // Update HUD with actual player names
  const teamA=ps.filter(p=>p.position%2===0).map(p=>p.isBot?'🤖'+p.name.split(' ')[0]:p.name.split(' ')[0]);
  const teamB=ps.filter(p=>p.position%2===1).map(p=>p.isBot?'🤖'+p.name.split(' ')[0]:p.name.split(' ')[0]);
  const ha=$('hud-names-a');if(ha)ha.textContent=teamA.length?teamA.join(' + '):'Team A';
  const hb=$('hud-names-b');if(hb)hb.textContent=teamB.length?teamB.join(' + '):'Team B';
}
function markDealer(dp){
  ['top','left','right','bottom'].forEach(s=>{
    const id=s==='bottom'?'dc-bottom':`dc-${s}`;const e=$(id);if(e)e.classList.remove('on');
  });
  if(dp<0)return;
  const s=dp===myPos?'bottom':vslot(dp);
  const id=s==='bottom'?'dc-bottom':`dc-${s}`;
  const e=$(id);if(e)e.classList.add('on');
}
function updateFan(vsl,count){
  const el=$(`fan-${vsl}`);if(!el)return;el.innerHTML='';
  for(let i=0;i<Math.min(count,13);i++){const d=document.createElement('div');d.className='cb';el.appendChild(d);}
}
function updateTricks(tw){
  $('ta').textContent=tw.A;$('tb').textContent=tw.B;
  players.forEach(p=>{
    const s=p.position===myPos?'bottom':vslot(p.position);
    const e=$(`ntr-${s}`);if(e)e.textContent=`${tw[teamOf(p.position)]} tricks`;
  });
}
function updateTrickNum(num){
  const el=$('tn');if(el)el.textContent=num?`· Trick ${num}/13`:'';
}
function updateBidInfo(bidderName,bid){
  const el=$('tib-bid');
  if(el)el.textContent=bidderName?`${bidderName} bid ${bid}`:'';
}
function updateHUD(){
  $('sc-a').textContent=scores.A;$('sc-b').textContent=scores.B;
  $('h-round').textContent=`Round ${roundNum}`;$('h-target').textContent=`Target: ${matchTarget}`;
}

// ── Dealing animation ─────────────────────────
function showDealAnim(dealerName,firstActiveName){
  const ov=$('deal-ov');if(!ov)return;
  $('do-title').textContent=`${dealerName} is dealing…`;
  $('do-sub').textContent=`${firstActiveName} starts the bidding`;
  const row=$('do-row');row.innerHTML='';
  for(let i=0;i<8;i++){const d=document.createElement('div');d.className='do-c';d.style.animationDelay=`${i*70}ms`;row.appendChild(d);}
  ov.classList.add('show');setTimeout(()=>ov.classList.remove('show'),2500);
}

// ── Emoji picker ──────────────────────────────
function buildEmojiPicker(id){
  const c=$(id);if(!c)return;c.innerHTML='';
  EMOJIS.forEach(em=>{
    const btn=document.createElement('button');
    btn.type='button';btn.className='ep'+(em===myEmoji?' sel':'');btn.textContent=em;
    btn.onclick=()=>{myEmoji=em;['ep-create','ep-join'].forEach(pid=>{const pc=$(pid);if(!pc)return;pc.querySelectorAll('.ep').forEach(b=>b.classList.toggle('sel',b.textContent===em));});};
    c.appendChild(btn);
  });
}

// ── Seats grid ────────────────────────────────
function renderSeats(ps){
  const grid=$('seats-grid');if(!grid)return;grid.innerHTML='';
  for(let i=0;i<4;i++){
    const p=ps.find(pl=>pl.position===i);const isMe=p&&p.position===myPos;
    const div=document.createElement('div');
    div.className=`seat-tile${p?' full':''}${isMe?' me':''}`;
    if(p){
      const tm=teamOf(i),em=playerEmojis[i]||p.name[0].toUpperCase();
      const canKick=amHost&&!isMe&&!p.isBot;
      const botTag=p.isBot?` <span style="font-size:.6rem;opacity:.5">🤖</span>`:'';
      div.innerHTML=`<div class="s-av ${tm}">${em}</div>
        <div class="s-info"><div class="s-num">Seat ${i+1}${isMe?' ★':''}</div><div class="s-name">${p.name}${botTag}</div></div>
        <span class="s-badge ${tm}">Team ${tm}</span>
        ${canKick?`<button class="kick-btn show" title="Kick player" onclick="event.stopPropagation();kickPlayer(${i})">✕</button>`:''}`;
    }else{
      div.innerHTML=`<div class="s-av empty">＋</div>
        <div class="s-info"><div class="s-num">Seat ${i+1}</div><div class="s-name" style="opacity:.22">Empty</div></div>`;
    }
    if(!isMe)div.addEventListener('click',()=>socket.emit('swapSeat',{targetPos:i}));
    grid.appendChild(div);
  }
  $('wait-note').textContent=ps.length<4?`Waiting… (${ps.length}/4)`:'All 4 players ready!';
  const sb=$('start-btn');if(sb)sb.disabled=ps.length<4||!amHost;
  const sbox=$('sbox');if(sbox)sbox.style.display=amHost?'block':'none';
  // Start-with-bots button always available for host (even with 1 player)
  const bsb=$('bot-start-btn');if(bsb)bsb.disabled=false;
}

// ── Bid panel ─────────────────────────────────
function openBidPanel(current,canPass,hand){
  $('bid-info').textContent=current>0?`Current bid: ${current} — bid higher or pass`:'No bid yet — open the bidding!';
  [7,8,9].forEach(n=>{$(`b${n}`).disabled=n<=current;});
  const nb=$('bnil');nb.disabled=!canPass;nb.textContent=canPass?'Pass (Nil)':'You MUST bid!';
  const logEl=$('blog');logEl.innerHTML='';
  bidLog.forEach(e=>{
    const d=document.createElement('div');d.className='be';
    d.innerHTML=`${e.name}: ${e.bid==='nil'?'<span style="opacity:.4">Pass</span>':`<span class="bv">${e.bid}</span>`}`;
    logEl.appendChild(d);
  });
  const hp=$('hp-cards');hp.innerHTML='';
  if(hand)hand.forEach(c=>hp.appendChild(mkCard(c)));
  showOv('ov-bid');sfxBid();
  stopBidTimer();
  startBidTimer(()=>{if(canPass)placeBid('nil');else placeBid(current>0?current+1:7);});
}
function placeBid(bid){stopBidTimer();socket.emit('makeBid',{bid});hideOv('ov-bid');}

// ── Power card panel ──────────────────────────
function openPowerPanel(hand){
  const c=$('pwr-hand');c.innerHTML='';
  hand.forEach(card=>{
    const el=mkCard(card,'mc');el.style.marginLeft='0';
    el.addEventListener('click',()=>{socket.emit('choosePowerCard',{cardId:card.id});hideOv('ov-power');toast('Power card placed 🂠');sfxDeal();});
    c.appendChild(el);
  });
  showOv('ov-power');
}

// ── Round end ─────────────────────────────────
function openRoundEnd(data){
  const{roundScore,totalScores,message,powerCard,bidderTeam,bid,oppTarget,tricksWon}=data;
  const oppTeam=bidderTeam==='A'?'B':'A';
  $('re-title').textContent=`Round ${roundNum} Over`;
  const parts=message.split(' | ');
  $('re-msg').innerHTML=parts.map(p=>`<div>${p}</div>`).join('');
  if(powerCard){$('re-pc').innerHTML='';$('re-pc').appendChild(mkCard(powerCard));$('re-pv').style.display='flex';}
  else $('re-pv').style.display='none';
  ['a','b'].forEach(t=>{
    const T=t.toUpperCase(),v=roundScore[T];
    const isCaller=T===bidderTeam,target=isCaller?bid:(oppTarget||5),tricks=tricksWon?tricksWon[T]:'?';
    const el=$(`re-r${t}`);el.textContent=v>=0?`+${v}`:`${v}`;
    el.className=`sv ${v>0?'plus':v<0?'minus':''}`;
    const tgt=$(`re-tgt${t}`);
    if(tgt){tgt.textContent=`Target ${target} · Got ${tricks} tricks`;tgt.style.color=v>0?'rgba(128,203,196,.9)':'rgba(239,154,154,.9)';}
    $(`re-t${t}`).textContent=`Total: ${totalScores[T]}`;
  });
  $('re-ri').textContent='';showOv('ov-round');
}
function onReadyNext(){socket.emit('readyForNextRound');$('re-ri').textContent='Waiting for others…';}

// ── Lobby ─────────────────────────────────────
function onCreateRoom(){
  const n=$('inp-name').value.trim();
  if(!n){$('lerr').textContent='Please enter your name';sfxErr();return;}
  $('lerr').textContent='';
  socket.emit('createRoom',{name:n,emoji:myEmoji,sessionId:SESSION_ID});
}
function onJoinRoom(){
  const n=$('inp-namej').value.trim(),c=$('inp-code').value.trim().toUpperCase();
  if(!n){$('lerr').textContent='Please enter your name';sfxErr();return;}
  if(c.length<4){$('lerr').textContent='Enter a valid room code';sfxErr();return;}
  $('lerr').textContent='';
  socket.emit('joinRoom',{name:n,code:c,emoji:myEmoji,sessionId:SESSION_ID});
}
function onStartGame(){socket.emit('startGame');}

function setBotMode(mode){
  botMode=mode;
  ['1v3','2v2','3v1'].forEach(m=>{
    const b=$(`bm-${m}`);if(b)b.classList.toggle('sel',m===mode);
  });
}
function setBotDiff(diff){
  botDifficulty=diff;
  ['simple','medium','smart'].forEach(d=>{
    const b=$(`bd-${d}`);if(b)b.classList.toggle('sel',d===diff);
  });
}
function onStartWithBots(){
  socket.emit('startWithBots',{mode:botMode,difficulty:botDifficulty});
}
function kickPlayer(pos){
  if(!amHost)return;
  if(confirm('Kick this player?'))socket.emit('kickPlayer',{targetPos:pos});
}
function onRestartGame(){socket.emit('restartGame');}
function copyCode(){navigator.clipboard?.writeText($('disp-code').textContent).then(()=>toast('Code copied! 📋'));}
function selectTarget(v){
  socket.emit('setTarget',{target:v});$('t30').classList.toggle('sel',v===30);$('t50').classList.toggle('sel',v===50);
}
function applyEmojis(em){if(em)Object.assign(playerEmojis,em);}

// ── DOMContentLoaded ──────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  initParticles();buildEmojiPicker('ep-create');buildEmojiPicker('ep-join');
  const tbl=$('table');
  if(tbl){
    tbl.addEventListener('dragover',e=>{if(isMyTurn&&dragId)e.preventDefault();});
    tbl.addEventListener('drop',e=>{e.preventDefault();
      const cid=e.dataTransfer.getData('text/plain')||dragId;
      if(cid&&isMyTurn&&validIds.includes(cid))socket.emit('playCard',{cardId:cid});
    });
  }
  const ci=$('inp-code');if(ci)ci.addEventListener('input',e=>e.target.value=e.target.value.toUpperCase());
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;
  const a=document.querySelector('.screen.active');if(!a)return;
  if(a.id==='screen-lobby'){
    if(['inp-code','inp-namej'].includes(document.activeElement?.id))onJoinRoom();
    else onCreateRoom();
  }
});

// ══════════════════════════════════════════════
//  SOCKET EVENTS
// ══════════════════════════════════════════════

// Reconnect handlers
socket.on('reconnectOk',({position,isHost,roomCode})=>{
  myPos=position;amHost=isHost;currentRoomCode=roomCode;
  toast('✅ Reconnected!');
});
socket.on('reconnectFailed',()=>{ currentRoomCode=null; toast('Could not reconnect. Please rejoin.'); });
socket.on('playerReconnected',({position,name,players:ps})=>{
  players=ps;renderPlayers(ps);toast(`${name} reconnected!`);
});

// Lobby
socket.on('roomCreated',({code,position,players:ps,isHost,emojis})=>{
  myPos=position;amHost=isHost;players=ps;applyEmojis(emojis);currentRoomCode=code;
  $('disp-code').textContent=code;renderSeats(ps);showScreen('screen-waiting');toast(`Room: ${code}`);
});
socket.on('roomJoined',({code,position,players:ps,isHost,emojis})=>{
  myPos=position;amHost=isHost;players=ps;applyEmojis(emojis);currentRoomCode=code;
  $('disp-code').textContent=code;renderSeats(ps);showScreen('screen-waiting');toast(`Joined ${code}!`);
});
socket.on('playerJoined',({players:ps,emojis})=>{players=ps;applyEmojis(emojis);renderSeats(ps);sfxDeal();toast(`${ps[ps.length-1].name} joined!`);});
socket.on('allReady',({players:ps,emojis})=>{players=ps;applyEmojis(emojis);renderSeats(ps);toast(amHost?'All 4 ready! Start the game.':'All 4 players ready!');});
socket.on('targetSet',({target})=>{matchTarget=target;$('t30')?.classList.toggle('sel',target===30);$('t50')?.classList.toggle('sel',target===50);toast(`Target: ${target} pts`);});
socket.on('yourPosition',({position})=>{myPos=position;renderSeats(players);});
socket.on('seatsUpdated',({players:ps,emojis})=>{players=ps;applyEmojis(emojis);renderSeats(ps);toast('Seats updated!');sfxDeal();});
socket.on('gameReset',({players:ps})=>{
  players=ps;myHand=[];validIds=[];isMyTurn=false;canDiscardAll=false;
  trumpSuit=null;trumpRevealed=false;scores={A:0,B:0};bidLog=[];stopBidTimer();
  hideAllOv();showScreen('screen-waiting');renderSeats(ps);toast('Game reset');
});

// Round
socket.on('roundBegin',({roundNumber:rn,scores:sc,players:ps,matchTarget:mt,
  dealerPos:dp,dealerName,firstActiveName,firstActivePos,emojis,isReconnect})=>{
  roundNum=rn;scores=sc;matchTarget=mt;players=ps;dealerPos=dp;
  myHand=[];validIds=[];isMyTurn=false;canDiscardAll=false;
  trumpSuit=null;trumpRevealed=false;leadSuit=null;bidLog=[];handCounts={0:0,1:0,2:0,3:0};
  applyEmojis(emojis);
  // Store who gets to discard (only the first card receiver = callingStart)
  window._callingStartPos = firstActivePos;
  if(!isReconnect){
    hideAllOv();stopBidTimer();
  }
  showScreen('screen-game');
  clearTricks();updateHUD();renderPlayers(ps);markDealer(dp);
  updateTricks({A:0,B:0});updateTrumpPanel();setRevealBtn(false);setDiscardBtn(false);
  updateTrickNum(null);updateBidInfo(null,null);
  $('status').textContent='Dealing cards…';
  setActiveAv(-1);players.forEach(p=>{if(p.position!==myPos)updateFan(vslot(p.position),0);});
  if(!isReconnect){ showDealAnim(dealerName,firstActiveName);sfxDeal(); }
});

socket.on('handUpdate',({hand,dealPhase,isRedeal})=>{
  myHand=hand;handCounts[myPos]=hand.length;
  // Only the callingStart player (first card receiver) can discard, and only if no A/J/Q/K
  const isFirstReceiver=(window._callingStartPos===myPos);
  const hasFaceOrAce=hand.some(c=>['A','J','Q','K'].includes(c.rank));
  // Allow discard as long as: no ace/face, is first receiver, 5 cards in hand
  if(hand.length===5&&!hasFaceOrAce&&isFirstReceiver&&(dealPhase==='initial'||isRedeal)){
    canDiscardAll=true;
  }else{
    canDiscardAll=false;
  }
  renderHand((dealPhase==='initial'||isRedeal));
});

// Calling
socket.on('callingStarted',({callerPos,callerName})=>{setActiveAv(callerPos);$('status').textContent=`${callerName} is deciding bid…`;});
socket.on('callingTurn',({callerPos,callerName,currentBid:cb})=>{currentBid=cb;setActiveAv(callerPos);$('status').textContent=`${callerName} is deciding bid…`;});
socket.on('yourCallingTurn',({currentBid:cb,canPass,hand,afterDiscard})=>{
  currentBid=cb;
  if(hand&&hand.length>0) myHand=hand;
  openBidPanel(cb,canPass,myHand);
  if(afterDiscard){
    toast(canDiscardAll?'🔄 Still no face card — discard again or bid':'✅ Face card received — now bid!',2500);
  }
});
socket.on('bidEvent',({type,pos,name,bid})=>{
  if(type==='pass'){bidLog.push({name,bid:'nil'});toast(`${name} passed`);$('status').textContent=`${name} passed`;}
  else if(type==='bid'){bidLog.push({name,bid});currentBid=bid;currentBidder=pos;toast(`${name} bid ${bid}!`);sfxBid();$('status').textContent=`${name} bid ${bid}`;}
  else if(type==='cardReturned')toast(`${name}'s power card returned`);
  // Hide discard button once bidding starts
  canDiscardAll=false;setDiscardBtn(false);
});
socket.on('powerCardReturned',()=>toast('Your power card was returned'));
socket.on('selectPowerCard',({hand})=>{myHand=hand;renderHand();openPowerPanel(hand);});
socket.on('powerCardPlaced',({bidderPos,bidderName,bid})=>{currentBidder=bidderPos;$('status').textContent=`${bidderName} placed power card (bid:${bid})`;toast(`${bidderName} placed power card`);});
socket.on('callingDone',({bidder,bidderName,bid})=>{
  currentBidder=bidder;
  $('status').textContent=`${bidderName} wins bid at ${bid}`;
  updateBidInfo(bidderName,bid);
  toast(`${bidderName} wins bid at ${bid}!`);
});

// Discard result
socket.on('playerDiscarded',({pos,name})=>{
  if(pos!==myPos) toast(`${name} discarded their hand and got new cards`);
});
socket.on('discardResult',({newHand,hasFace})=>{
  if(hasFace) toast('New hand has a face card / Ace ✅');
  else toast('Still no face card or Ace — you can discard again!');
});

// Dealing
socket.on('fullHandDealt',({hand,bidder,bid,powerCardSuit})=>{
  myHand=hand;canDiscardAll=false;
  for(let i=0;i<4;i++)handCounts[i]=13;handCounts[bidder]=12;
  players.forEach(p=>{if(p.position!==myPos)updateFan(vslot(p.position),handCounts[p.position]);});
  renderHand(true);sfxDeal();
  if(myPos===bidder&&powerCardSuit)toast(`Power card: ${SYM[powerCardSuit]} ${powerCardSuit} — secret!`,3500);
});
socket.on('dealingComplete',({bidderName,bid})=>{$('status').textContent=`${bidderName} bid ${bid}. Game starting!`;});

// Playing
socket.on('playingStarted',({currentPlayer:cp,currentPlayerName,trickNumber})=>{
  setActiveAv(cp);
  $('status').textContent=`${currentPlayerName} leads Trick 1`;
  updateTrickNum(trickNumber);
});
socket.on('turnChanged',({currentPlayer:cp,currentPlayerName})=>{
  setActiveAv(cp);
  if(cp!==myPos){isMyTurn=false;validIds=[];setRevealBtn(false);renderHand();$('status').textContent=`${currentPlayerName}'s turn`;}
});
socket.on('yourTurn',({validCardIds:vids,leadSuit:ls,trumpSuit:ts,trumpRevealed:tr,canRevealTrump:cr})=>{
  isMyTurn=true;validIds=vids;leadSuit=ls;
  if(tr){trumpSuit=ts;trumpRevealed=tr;updateTrumpPanel();}
  setRevealBtn(!!cr);renderHand();
  if(cr){
    $('status').textContent='No running suit! Play any card, or 🔮 Reveal Trump to use it';
  } else if(ls){
    $('status').textContent=`Follow suit: ${SYM[ls]} ${ls}`;
  } else {
    $('status').textContent='Your turn — lead any card';
  }
});
socket.on('cardPlayed',({position,name,card})=>{
  setTrick(position,card);
  if(position!==myPos){handCounts[position]=Math.max(0,(handCounts[position]||0)-1);updateFan(vslot(position),handCounts[position]);}
  sfxCard();
});
socket.on('trumpRevealed',({trumpSuit:ts,powerCard,revealedByName,bidderPos})=>{
  trumpSuit=ts;trumpRevealed=true;revealTrumpPanel(powerCard);sfxTrump();showTrumpExplosion(ts);
  toast(`🔮 ${revealedByName||'Auto'} revealed Trump: ${SYM[ts]} ${ts}!`,3200);
  $('status').textContent=`Trump: ${SYM[ts]} ${ts} revealed!`;
  if(bidderPos!==undefined&&bidderPos!==myPos){
    handCounts[bidderPos]=(handCounts[bidderPos]||0)+1;
    updateFan(vslot(bidderPos),handCounts[bidderPos]);
  }
});
socket.on('trickComplete',({winnerPos,winnerName,winnerTeam,tricksWon,trickNumber})=>{
  flashWinner(winnerPos);
  setTimeout(()=>sfxWin(),120);setTimeout(()=>updateTricks(tricksWon),150);
  const dot=$('center-dot');if(dot){dot.classList.add('wflash');setTimeout(()=>dot.classList.remove('wflash'),700);}
  $('status').textContent=`${winnerName} (Team ${winnerTeam}) wins trick ${trickNumber}!`;toast(`${winnerName} wins trick ${trickNumber}! 🎉`,2000);
});
socket.on('newTrickStarting',({trickNumber,leader,leaderName})=>{
  clearTricks();leadSuit=null;
  updateTrickNum(trickNumber);
  $('status').textContent=`${leaderName} leads Trick ${trickNumber}`;setRevealBtn(false);
});
socket.on('roundEnd',data=>{
  scores=data.totalScores;updateHUD();updateTricks(data.tricksWon);
  isMyTurn=false;validIds=[];setRevealBtn(false);stopBidTimer();canDiscardAll=false;renderHand();
  const myTeam=players.find(p=>p.position===myPos);
  if(myTeam&&data.roundScore[myTeam.team]>0)launchConfetti(2200);
  openRoundEnd(data);
});
socket.on('readyCount',({ready,total})=>{const e=$('re-ri');if(e)e.textContent=`${ready}/${total} ready…`;});
socket.on('gameOver',({winner,scores:sc})=>{
  hideAllOv();scores=sc;updateHUD();$('go-a').textContent=sc.A;$('go-b').textContent=sc.B;
  const b=$('win-ban');b.textContent=`Team ${winner} Wins!`;b.className=`win-ban ${winner}`;
  sfxGame();launchConfetti(5000);showScreen('screen-gameover');
});
socket.on('playerLeft',({name,players:ps})=>{
  if(ps)players=ps;renderPlayers(players);toast(`⚠ ${name} disconnected`,3500);
});
socket.on('kicked',()=>{
  currentRoomCode=null;myPos=-1;amHost=false;
  hideAllOv();showScreen('screen-lobby');
  $('lerr').textContent='You were removed from the room by the host.';
  toast('⚠ You have been kicked from the room',4000);
});
socket.on('playerKicked',({name})=>{
  toast(`${name} was removed from the room`,3000);
});
socket.on('err',msg=>{
  sfxErr();toast(`⚠ ${msg}`,3000);
  const le=$('lerr');if(le)le.textContent=msg;const we=$('werr');if(we)we.textContent=msg;
});
