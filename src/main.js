import './style.css';
import { createWorld } from './world.js';
import { GameAudio } from './audio.js';
import { createGame, startGame, stepGame, togglePause, recoverCar, CHECKPOINTS, STREETS, BUILDINGS, nearestStreet, distance, angleDelta, clamp } from './simulation.js';

const $ = id => document.getElementById(id);
const show = (id, visible) => $(id).classList.toggle('hidden', !visible);
let game = createGame(), world, view = 0, helpWasRunning = false;
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
  game = createGame(); releaseControls(); startGame(game); audio.init(); world?.resetCamera(); updateStatus();
}
function updateStatus() {
  const ready = game.status === 'ready', ended = game.status === 'won' || game.status === 'lost', paused = game.status === 'paused';
  document.body.classList.toggle('playing', !ready);
  show('intro', ready); show('briefing', ready); show('footer', ready); show('hud', !ready);
  show('pause', !ready && !ended); show('touch-controls', !ready && !ended && !paused);
  show('result', ended || paused); show('resume', paused); show('result-stats', ended);
  $('result-eyebrow').textContent = paused ? 'TAKE A BREATHER' : game.status === 'won' ? 'PURSUIT ENDED · CLEAN GETAWAY' : 'END OF THE ROAD';
  $('result-title').textContent = paused ? 'PAUSED.' : game.status === 'won' ? 'YOU VANISHED.' : 'RUN OVER.';
  $('result-copy').textContent = paused ? 'The city can wait. Catch your breath, then make your move.' : game.outcome;
  $('pause').setAttribute('aria-label', paused ? 'Resume game' : 'Pause game'); $('pause').textContent = paused ? '▷' : 'Ⅱ';
  if (ended) {
    $('result-stats').innerHTML = `<div>FINAL SCORE<strong>${Math.floor(game.score).toLocaleString()}</strong></div><div>GATES<strong>${game.checkpoint} / 5</strong></div><div>CLOSE CALLS<strong>${game.nearMisses}</strong></div>`;
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
  if (e.code === 'KeyM') toggleSound();
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
  const size = 420, scale = .89, mapX = x => size / 2 + x * scale, mapY = z => size / 2 + z * scale;
  map.clearRect(0, 0, size, size); map.fillStyle = '#102931'; map.fillRect(0, 0, size, size);
  map.strokeStyle = '#547077'; map.lineWidth = 15;
  for (const s of STREETS) {
    map.beginPath(); map.moveTo(mapX(s), mapY(-219)); map.lineTo(mapX(s), mapY(219)); map.stroke();
    map.beginPath(); map.moveTo(mapX(-219), mapY(s)); map.lineTo(mapX(219), mapY(s)); map.stroke();
  }
  map.fillStyle = '#233f46';
  for (const b of BUILDINGS) map.fillRect(mapX(b.x - b.w / 2), mapY(b.z - b.d / 2), b.w * scale, b.d * scale);
  const cp = CHECKPOINTS[game.checkpoint], p = game.player;
  if (cp) {
    const sx = nearestStreet(p.x), sz = nearestStreet(p.z), tx = nearestStreet(cp.x), tz = nearestStreet(cp.z);
    map.strokeStyle = '#7feecd'; map.lineWidth = 3; map.setLineDash([6, 4]); map.beginPath(); map.moveTo(mapX(p.x), mapY(p.z));
    if (Math.abs(p.x - cp.x) < 12 || Math.abs(p.z - cp.z) < 12) map.lineTo(mapX(cp.x), mapY(cp.z));
    else {
      map.lineTo(mapX(sx), mapY(sz));
      if (cp.axis === 'z') { map.lineTo(mapX(tx), mapY(sz)); map.lineTo(mapX(tx), mapY(cp.z)); }
      else { map.lineTo(mapX(sx), mapY(tz)); map.lineTo(mapX(cp.x), mapY(tz)); }
      map.lineTo(mapX(cp.x), mapY(cp.z));
    }
    map.stroke(); map.setLineDash([]);
  }
  CHECKPOINTS.forEach((c, i) => {
    if (i < game.checkpoint) return;
    map.beginPath(); map.arc(mapX(c.x), mapY(c.z), i === game.checkpoint ? 10 : 6, 0, Math.PI * 2);
    map.fillStyle = i === game.checkpoint ? '#7fefcf' : '#526e70'; map.fill();
    if (i === game.checkpoint) { map.strokeStyle = '#7fefcf60'; map.lineWidth = 3; map.beginPath(); map.arc(mapX(c.x), mapY(c.z), 16, 0, Math.PI * 2); map.stroke(); }
  });
  for (const c of game.police) { map.fillStyle = '#ff7a86'; map.beginPath(); map.arc(mapX(c.x), mapY(c.z), 5.5, 0, Math.PI * 2); map.fill(); }
  map.save(); map.translate(mapX(p.x), mapY(p.z)); map.rotate(p.heading);
  map.fillStyle = '#f9f7e6'; map.strokeStyle = '#163638'; map.lineWidth = 2;
  map.beginPath(); map.moveTo(0, -11); map.lineTo(7, 8); map.lineTo(0, 5); map.lineTo(-7, 8); map.closePath(); map.fill(); map.stroke(); map.restore();
}
let toastUntil = 0;
function updateHud(now) {
  $('score').textContent = String(Math.floor(game.score)).padStart(6, '0');
  const seconds = Math.max(0, Math.ceil(game.time)); $('timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  $('timer').parentElement.classList.toggle('danger', seconds < 25);
  $('progress').textContent = `${game.checkpoint} / 5`;
  checkpointDots.forEach((el, i) => { el.className = i < game.checkpoint ? 'done' : i === game.checkpoint ? 'next' : ''; });
  const cp = CHECKPOINTS[game.checkpoint];
  $('objective').textContent = cp ? `Reach ${cp.name}` : `Lose the police · ${game.escape.toFixed(1)} / 5 sec`;
  $('destination-name').textContent = cp ? cp.name.toUpperCase() : 'LOSE THE TAIL';
  $('destination-distance').textContent = cp ? `${Math.round(distance(game.player, cp))} m` : `${Math.round(game.nearestCop)} m from nearest police`;
  $('direction').style.transform = cp ? `rotate(${angleDelta(Math.atan2(cp.x - game.player.x, -(cp.z - game.player.z)), game.player.heading)}rad)` : 'none';
  $('direction').textContent = cp ? '↑' : '↗';
  const kph = Math.round(Math.hypot(game.player.vx, game.player.vz) * 3.6);
  $('speed').textContent = kph; $('gear').textContent = game.player.speed < -1 ? 'R' : kph < 3 ? 'N' : String(Math.min(6, Math.floor(kph / 32) + 1));
  tachometer.forEach((el, i) => el.classList.toggle('on', i < kph / 184 * 24));
  $('boost-bar').style.width = `${game.boost}%`; $('boost-number').textContent = `${Math.round(game.boost)}%`;
  $('health-bar').style.width = `${game.health}%`; $('health-number').textContent = `${Math.ceil(game.health)}%`;
  $('health-bar').parentElement.classList.toggle('danger', game.health < 30);
  $('pursuit-label').textContent = game.busted > .3 ? `BOXED IN · ${Math.max(0, 5 - game.busted).toFixed(1)}s` : game.nearestCop > 48 ? 'OPENING A GAP' : 'PURSUIT ACTIVE';
  $('pursuit').classList.toggle('clear', game.nearestCop > 48);
  $('heat').textContent = game.nearestCop < 20 ? '★ ★ ★' : game.nearestCop < 65 ? '★ ★ ☆' : '★ ☆ ☆';
  while (game.events.length) {
    const event = game.events.shift(); $('toast').textContent = event.text; $('toast').className = `${event.kind} visible`; toastUntil = now + 2600;
    if (event.kind === 'checkpoint' || event.kind === 'reward') audio.chime();
  }
  if (now > toastUntil) $('toast').classList.remove('visible');
  drawMap();
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
