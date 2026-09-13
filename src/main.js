import './style.css';
import { createWorld } from './world.js';
import { GameAudio } from './audio.js';
import { createGame, startGame, stepGame, togglePause, recoverCar, triggerPursuit, COOLDOWN_SECONDS, distance, angleDelta, clamp } from './simulation.js';
import { roads, garages, gems, WATER, WORLD_BOUNDS, CIRCUIT_LENGTH } from './district.js';

const $ = id => document.getElementById(id);
const show = (id, visible) => $(id).classList.toggle('hidden', !visible);
let savedGems=[];try{savedGems=JSON.parse(localStorage.getItem('marina-getaway-gems-v1')||'[]');if(!Array.isArray(savedGems))savedGems=[];}catch{}
let game = createGame(savedGems), world, view = 0, helpWasRunning = false, mapOpen = false;
const input = {}, audio = new GameAudio();
let best = 0;
try { best = Number(localStorage.getItem('midnight-run-best')) || 0; } catch { /* Storage may be disabled. */ }
$('intro-best').textContent = String(Math.floor(best)).padStart(6, '0');
$('best').textContent = Math.floor(best).toLocaleString();
for (let i = 0; i < 24; i++) $('tachometer').appendChild(document.createElement('i'));
const checkpointDots = [...$('checkpoint-dots').children], tachometer = [...$('tachometer').children];
const keyMap = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'reverse', ArrowDown: 'reverse', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'handbrake', ShiftLeft: 'boost', ShiftRight: 'boost' };
const heldKeys = new Set(), heldTouches = new Map();
function updateInput() {
  for (const k of Object.keys(input)) input[k] = false;
  for (const code of heldKeys) if (keyMap[code]) input[keyMap[code]] = true;
  for (const control of heldTouches.values()) input[control] = true;
}
function releaseControls() { heldKeys.clear(); heldTouches.clear(); updateInput(); }
function start() {
  if (!$('controls').classList.contains('hidden')) return;
  audio.init(); startGame(game); world?.resetCamera(); updateStatus();
}
function pause() {
  togglePause(game); releaseControls(); updateStatus();
}
function restart() {
  const kept=game.status==='won'?[]:game.collected;
  game = createGame(kept);try{localStorage.setItem('marina-getaway-gems-v1',JSON.stringify(kept));}catch{} releaseControls(); startGame(game); audio.init(); world?.resetCamera(); updateStatus();
}
function updateStatus() {
  const ready = game.status === 'ready', ended = game.status === 'won' || game.status === 'lost', paused = game.status === 'paused';
  document.body.classList.toggle('playing', !ready);
  show('intro', ready); show('briefing', ready); show('footer', ready); show('hud', !ready);
  show('pause', !ready && !ended); show('touch-controls', !ready && !ended && !paused);
  show('result', ended || paused); show('resume', paused); show('result-stats', ended);
  $('result-eyebrow').textContent = paused ? 'TAKE A BREATHER' : game.status === 'won' ? 'ALL GEMS COLLECTED' : 'END OF THE ROAD';
  $('result-title').textContent = paused ? 'PAUSED.' : game.status === 'won' ? 'BAY COMPLETE.' : 'RUN OVER.';
  $('result-copy').textContent = paused ? 'The city can wait. Catch your breath, then make your move.' : game.outcome;
  $('pause').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game'); $('pause').textContent = paused ? '▷' : 'Ⅱ';
  if (ended) {
    $('result-stats').innerHTML = `<div>FINAL SCORE<strong>${Math.floor(game.score).toLocaleString()}</strong></div><div>GEMS<strong>${game.collected.length} / 24</strong></div><div>CLOSE CALLS<strong>${game.nearMisses}</strong></div>`;
    if (game.score > best) {
      best = Math.floor(game.score); try { localStorage.setItem('midnight-run-best', String(best)); } catch { /* No persistence is fine. */ }
      $('best').textContent = best.toLocaleString();
    }
    releaseControls(); $('restart').focus();
  }
}
function openHelp() {
  helpWasRunning = game.status === 'running';
  if (helpWasRunning) { togglePause(game); releaseControls(); updateStatus(); }
  show('controls', true); $('close-help').focus();
}
function closeHelp() {
  show('controls', false);
  if (helpWasRunning && game.status === 'paused') togglePause(game);
  helpWasRunning = false; updateStatus(); $('help').focus();
}
function toggleSound() { audio.toggle(); $('sound-label').textContent = audio.muted ? 'OFF' : 'ON'; $('sound').setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound'); }
$('map-toggle').addEventListener('click',()=>{mapOpen=!mapOpen;document.body.classList.toggle('map-open',mapOpen);});
$('start').addEventListener('click', start); $('pause').addEventListener('click', pause);
$('resume').addEventListener('click', pause); $('restart').addEventListener('click', restart);
$('help').addEventListener('click', openHelp); $('close-help').addEventListener('click', closeHelp); $('sound').addEventListener('click', toggleSound);
addEventListener('keydown', e => {
  if (keyMap[e.code]) e.preventDefault();
  if (e.repeat) return;
  if (!$('controls').classList.contains('hidden')) { if (e.code === 'Escape') closeHelp(); return; }
  if (keyMap[e.code]) { heldKeys.add(e.code); updateInput(); }
  if (e.code === 'Enter') {
    // Native focused buttons already handle Enter. Avoid two actions from one key press.
    if (document.activeElement?.tagName !== 'BUTTON') { if (game.status === 'ready') start(); else if (game.status === 'won' || game.status === 'lost') restart(); }
  }
  if (e.code === 'Escape' || e.code === 'KeyP') pause();
  if (e.code === 'KeyR') recoverCar(game);
  if (e.code === 'KeyC') view = (view + 1) % 2;
  if (e.code === 'KeyM') {mapOpen=!mapOpen;document.body.classList.toggle('map-open',mapOpen);}
  if (e.code === 'KeyH') triggerPursuit(game);
  if (e.code === 'KeyN') toggleSound();
});
addEventListener('keyup', e => { heldKeys.delete(e.code); updateInput(); });
addEventListener('blur', () => { releaseControls(); if (game.status === 'running') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { releaseControls(); if (game.status === 'running') pause(); } });
for (const button of document.querySelectorAll('[data-input]')) {
  button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); heldTouches.set(e.pointerId, button.dataset.input); updateInput(); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, e => { heldTouches.delete(e.pointerId); updateInput(); });
}
// Keep keyboard focus within whichever modal is open.
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const modal = !$('controls').classList.contains('hidden') ? $('controls') : !$('result').classList.contains('hidden') ? $('result') : null;
  if (!modal) return;
  const items = [...modal.querySelectorAll('button,a')].filter(el => !el.classList.contains('hidden'));
  const first = items[0], last = items.at(-1);
  if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
});

const map = $('minimap').getContext('2d');
function drawMap() {
  const width=420,height=420,p=game.player;
  const range=mapOpen?1900:570, scale=width/range;
  const centre=mapOpen?{x:-730,z:180}:p;
  const point=q=>({x:width/2+(q.x-centre.x)*scale,y:height/2+(q.z-centre.z)*scale});
  map.clearRect(0,0,width,height);map.fillStyle='#e4eadc';map.fillRect(0,0,width,height);
  map.beginPath();WATER.forEach((q,i)=>{const v=point(q);i?map.lineTo(v.x,v.y):map.moveTo(v.x,v.y);});map.closePath();map.fillStyle='#8bc6d0';map.fill();
  for(const road of roads){map.lineWidth=Math.max(mapOpen?2:4,road.width*scale);map.strokeStyle='#99a5a0';map.beginPath();road.points.forEach((q,i)=>{const v=point(q);i?map.lineTo(v.x,v.y):map.moveTo(v.x,v.y);});if(road.closed)map.closePath();map.stroke();}
  if(game.guidance?.points.length){map.lineWidth=mapOpen?3:5;map.strokeStyle=game.phase==='free'?'#8252c7':'#c47c11';map.beginPath();game.guidance.points.forEach((q,i)=>{const v=point(q);i?map.lineTo(v.x,v.y):map.moveTo(v.x,v.y);});map.stroke();}
  for(const gem of gems){if(game.collected.includes(gem.id))continue;const q=point(gem);map.fillStyle='#7749b4';map.save();map.translate(q.x,q.y);map.rotate(Math.PI/4);map.fillRect(-3,-3,6,6);map.restore();}
  for(const garage of garages){const q=point(garage.entrance);map.fillStyle='#c4811f';map.fillRect(q.x-5,q.y-5,10,10);if(mapOpen){map.fillStyle='#39565b';map.font='10px sans-serif';map.fillText(garage.name.split(' ')[0],q.x+8,q.y+3);}}
  for(const c of game.police){if(!c.visible)continue;const q=point(c);map.fillStyle='#d64c4c';map.beginPath();map.arc(q.x,q.y,5,0,Math.PI*2);map.fill();}
  const dest=game.guidance?.destination;if(dest){const raw=point(dest.entrance||dest),q={x:clamp(raw.x,12,width-12),y:clamp(raw.y,12,height-12)};map.strokeStyle=game.phase==='free'?'#7940bc':'#b67516';map.lineWidth=2;map.beginPath();map.arc(q.x,q.y,10,0,Math.PI*2);map.stroke();}
  const q=point(p);map.save();map.translate(q.x,q.y);map.rotate(p.heading);map.fillStyle='#173b47';map.strokeStyle='#fff';map.lineWidth=2;map.beginPath();map.moveTo(0,-11);map.lineTo(7,8);map.lineTo(0,5);map.lineTo(-7,8);map.closePath();map.fill();map.stroke();map.restore();
}
let toastUntil=0;
function updateHud(now) {
  $('score').textContent=String(Math.floor(game.score)).padStart(6,'0');
  const seconds=Math.floor(game.elapsed);$('timer').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  $('progress').textContent=`${game.collected.length} / ${gems.length}`;
  checkpointDots.forEach((el,i)=>el.className=i<game.collected.length%3?'done':'');
  $('objective').textContent=game.phase==='free'?`${3-game.gemsSinceChase} gems until the next chase`:game.phase==='cooldown'?`Cooling down · ${game.escape.toFixed(1)} / ${COOLDOWN_SECONDS}s`:'Gem collection paused during pursuit';
  const guidance=game.guidance,dest=guidance?.destination;
  $('destination-name').textContent=dest?dest.name.toUpperCase():game.collected.length===gems.length?'COLLECTION COMPLETE':'FIND AN ACCESS ROAD';
  $('destination-distance').textContent=dest?`${Math.round(guidance.distance)} m by road`:'';
  $('turn-cue').textContent=game.phase==='cooldown'?'Stay parked. Keep out of police sight.':guidance?.cue||'Follow the road';
  $('turn-distance').textContent=guidance?.turnDistance>25?`in ${Math.round(guidance.turnDistance)} m`:'';
  $('direction').textContent=game.phase==='cooldown'?'P':guidance?.turn==='left'?'↰':guidance?.turn==='right'?'↱':guidance?.turn==='arrive'?'◇':'↑';
  $('direction').style.transform='none';
  document.body.dataset.phase=game.phase;
  const kph=Math.round(Math.hypot(game.player.vx,game.player.vz)*3.6);$('speed').textContent=kph;$('gear').textContent=game.player.speed<-1?'R':kph<3?'N':String(Math.min(6,Math.floor(kph/32)+1));
  tachometer.forEach((el,i)=>el.classList.toggle('on',i<kph/184*24));
  $('boost-bar').style.width=`${game.boost}%`;$('boost-number').textContent=`${Math.round(game.boost)}%`;
  $('health-bar').style.width=`${game.health}%`;$('health-number').textContent=`${Math.ceil(game.health)}%`;$('health-bar').parentElement.classList.toggle('danger',game.health<30);
  $('pursuit-label').textContent=game.phase==='free'?'FREE ROAM · COLLECT GEMS':game.phase==='cooldown'?`COOLDOWN · ${Math.max(0,COOLDOWN_SECONDS-game.escape).toFixed(1)}s`:game.seen?'POLICE HAVE VISUAL':'SIGHT BROKEN · FIND COVER';
  $('pursuit').classList.toggle('clear',game.phase==='free');$('heat').textContent=game.phase==='free'?'◇ ◇ ◇':game.seen?'★ ★ ★':'★ ☆ ☆';
  $('cooldown-panel').classList.toggle('hidden',game.phase==='free');$('cooldown-fill').style.width=`${game.escape/COOLDOWN_SECONDS*100}%`;
  $('cooldown-state').textContent=game.phase==='cooldown'?'HOLD POSITION':game.seen?'BREAK LINE OF SIGHT':'ENTER COVER & PARK';
  $('lap-progress').textContent=`LAP ${game.laps+1} · ${Math.round(game.lapProgress*100)}%`;
  while(game.events.length){const e=game.events.shift();$('toast').textContent=e.text;$('toast').className=`${e.kind} visible`;toastUntil=now+3000;
    if(['gem','reward','escape'].includes(e.kind))audio.chime();
    if(e.kind==='gem')try{localStorage.setItem('marina-getaway-gems-v1',JSON.stringify(game.collected));}catch{}
  }
  if(now>toastUntil)$('toast').classList.remove('visible');drawMap();
}
try { world = createWorld($('game')); } catch (err) { console.error(err); show('error', true); }
$('game').addEventListener('webglcontextlost', e => { e.preventDefault(); if (game.status === 'running') pause(); $('error-copy').textContent = 'The graphics connection was interrupted. Reload to restart the engine.'; show('error', true); });
let previous = performance.now(), accumulator = 0, lastHud = 0;
function frame(now) {
  const delta = clamp((now - previous) / 1000, 0, .1); previous = now;
  accumulator += delta;
  const status = game.status;
  while (accumulator >= 1 / 120) { stepGame(game, input, 1 / 120); accumulator -= 1 / 120; }
  if (status !== game.status) updateStatus();
  world?.update(game, delta, now / 1000, view);
  if (now - lastHud > 65) { updateHud(now); audio.update(game); lastHud = now; }
  requestAnimationFrame(frame);
}
updateStatus(); requestAnimationFrame(frame);
// Development-only access for deterministic scenario setup in browser regression tests.
if (import.meta.env.DEV) window.__gameTest = {
  get state() { return game; }, get world() { return world; }, restart,
  setState(values) { Object.assign(game, values); updateStatus(); },
};
