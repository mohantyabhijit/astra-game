import {jump} from "./jumping.js";
import {DefaultLoadingManager} from "three";
import "./style.css";
import { createWorld } from "./world.js";
import { GameAudio } from "./audio.js";
import {
  availableCars,
  createGame,
  startGame,
  stepGame,
  togglePause,
  recoverCar,
  triggerPursuit,
  interact,
  punch,
  selectCharacter,
  COOLDOWN_SECONDS,
  clamp,
  distance,
} from "./simulation.js";
import { roads, gems, WATER, MISSIONS, POLICE_STATION, WORLD_BOUNDS } from "./district.js";
import { createCharacterPreview } from "./character-preview.js";
const $ = (id) => document.getElementById(id),
  show = (id, on) => $(id)?.classList.toggle("hidden", !on);
let stored = [];
try {
  stored = JSON.parse(localStorage.getItem("marina-getaway-gems-v2") || "[]");
} catch {}
let game = createGame(Array.isArray(stored) ? stored : []),
  world,
  view = 0,
  mapOpen = false,
  helpWasRunning = false,
  selected = "kai";
const input = {},
  held = new Set(),
  audio = new GameAudio(),
  keyMap = {
    KeyW: "forward",
    ArrowUp: "forward",
    KeyS: "reverse",
    ArrowDown: "reverse",
    KeyA: "left",
    ArrowLeft: "left",
    KeyD: "right",
    ArrowRight: "right",
    Space: "handbrake",
    ShiftLeft: "boost",
    ShiftRight: "boost",
  };
let preview;
let loadingFailed = false;
const allAssets = new Promise((resolve,reject) => {
  DefaultLoadingManager.onLoad = resolve;
  DefaultLoadingManager.onError = url => reject(new Error(`Could not load ${url}`));
});
// Attach rejection handling immediately, before starting any asset requests.
allAssets.catch(()=>{});
function loadingError(err) {
  loadingFailed = true;
  console.error("Game loading failed",err);
  $("loading-screen").style.display="none";
  $("error-copy").textContent="The city could not finish loading. Reload to try again.";
  show("error",true);
}
try {
  preview=createCharacterPreview($("character-preview"));
  preview.select(selected);
  $("start").disabled=true;
  preview.ready.catch(loadingError);
} catch(err) {loadingError(err);}
function syncInput() {
  for (const k of Object.keys(input)) input[k] = false;
  for (const code of held) if (keyMap[code]) input[keyMap[code]] = true;
}
function choose(id) {
  selected = id;
  selectCharacter(game, id);
  preview?.select(id);
  for (const b of document.querySelectorAll(".agent")) {
    const on = b.dataset.character === id;
    b.classList.toggle("active", on);
    b.setAttribute("aria-checked", on);
  }
  $("agent-name").textContent = id === "kai" ? "KAI" : "RAE";
  $("agent-role").textContent = id === "kai" ? "THE SPARK" : "THE ACE";
  $("stage-number").textContent = id === "kai" ? "01" : "02";
}
document
  .querySelectorAll(".agent")
  .forEach((b) =>
    b.addEventListener("click", () => choose(b.dataset.character)),
  );
function start() {
  if ($("start").disabled || !$("controls").classList.contains("hidden"))
    return;
  held.clear();

  syncInput();
  audio.init();
  world?.shotAudio.unlock();
  selectCharacter(game, selected);
  startGame(game);
  game.status="intro";game.introElapsed=0;
  world?.resetCamera?.();
  status();
}
function restart() {
  const kept = game.status === "won" ? [] : [...game.collected];
  held.clear();

  syncInput();
  game = createGame(kept);
  choose(selected);
  start();
}
function status() {
  const ready = game.status === "ready",
    paused = game.status === "paused",
    ended = ["won", "lost"].includes(game.status);
  document.body.classList.toggle("playing", !ready);
  document.body.classList.toggle("cinematic",game.status === "intro");
  show("intro", ready);
  show("footer", ready);
  show("hud", !ready && game.status !== "intro");
  show("pause", !ready && !ended && game.status !== "intro");
  show("result", paused || ended);
  show("resume", paused);
  $("result-title").textContent = paused
    ? "PAUSED."
    : game.status === "won"
      ? "MISSION COMPLETE."
      : "RUN OVER.";
  $("result-copy").textContent = paused
    ? "Marina Bay will wait."
    : game.outcome || "Back to the plaza.";
}
function pause() {
  if (game.status === "running" || game.status === "paused") {
    togglePause(game);
    held.clear();

    syncInput();
    status();
  }
}
function openHelp() {
  helpWasRunning = game.status === "running";
  if (helpWasRunning) pause();
  show("controls", true);
}
function closeHelp() {
  show("controls", false);
  if (helpWasRunning && game.status === "paused") pause();
  helpWasRunning = false;
}
function sound() {
  audio.toggle();
  $("sound-label").textContent = audio.muted ? "OFF" : "ON";
}
$("start").addEventListener("click", start);
$("pause").addEventListener("click", pause);
$("resume").addEventListener("click", pause);
$("restart").addEventListener("click", restart);
$("help").addEventListener("click", openHelp);
$("close-help").addEventListener("click", closeHelp);
$("sound").addEventListener("click", sound);
$("interact").addEventListener("click", () => interact(game));
function toggleMap() {
  mapOpen = !mapOpen;
  document.body.classList.toggle("map-open", mapOpen);
}
$("map-toggle").addEventListener("click", toggleMap);
addEventListener("keydown", (e) => {
  if(game.status === "intro") {if(keyMap[e.code])e.preventDefault();return;}
  if (keyMap[e.code]) {
    e.preventDefault();
    held.add(e.code);
    syncInput();
  }
  if (e.repeat) return;
  if (!$("controls").classList.contains("hidden")) {
    if (e.code === "Escape") closeHelp();
    return;
  }
  if (e.code === "ArrowLeft" && game.status === "ready") choose("kai");
  if (e.code === "ArrowRight" && game.status === "ready") choose("rae");
  if (
    e.code === "Enter" &&
    game.status === "ready" &&
    document.activeElement?.tagName !== "BUTTON"
  )
    start();
  if (e.code === "Space") jump(game);
  if (e.code === "KeyF") {e.preventDefault();punch(game);}
  if (e.code === "KeyE") interact(game);
  if (e.code === "Escape" || e.code === "KeyP") pause();
  if (e.code === "KeyR") recoverCar(game);
  if (e.code === "KeyC") view = (view + 1) % 2;
  if (e.code === "KeyM") toggleMap();
  if (e.code === "KeyH") triggerPursuit(game);
  if (e.code === "KeyN") sound();
});
addEventListener("keyup", (e) => {
  held.delete(e.code);
  syncInput();
});
addEventListener("blur", () => {
  held.clear();
  syncInput();
  if (game.status === "running") pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    held.clear();

    syncInput();
    if (game.status === "running") pause();
  }
});
const ctx = $("minimap").getContext("2d");
function drawMap() {
  const w = 420,
    h = 420,
    p = game.player,
    range = mapOpen ? 1940 : 620,
    scale = w / range,
    centre = mapOpen ? { x:(WORLD_BOUNDS.minX+WORLD_BOUNDS.maxX)/2, z:(WORLD_BOUNDS.minZ+WORLD_BOUNDS.maxZ)/2 } : p,
    pt = (q) => ({
      x: w / 2 + (q.x - centre.x) * scale,
      y: h / 2 + (q.z - centre.z) * scale,
    });
  ctx.fillStyle = "#dce9df";
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  WATER.forEach((q, i) => {
    q = pt(q);
    i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
  });
  ctx.closePath();
  ctx.fillStyle = "#76bed0";
  ctx.fill();
  for (const r of roads) {
    ctx.beginPath();
    ctx.lineWidth = Math.max(mapOpen ? 2 : 4, r.width * scale);
    ctx.strokeStyle = "#8d9d98";
    r.points.forEach((q, i) => {
      q = pt(q);
      i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
    });
    if (r.closed) ctx.closePath();
    ctx.stroke();
  }
  if (game.guidance?.points && (game.phase !== "free" || game.mission === "active")) {
    ctx.beginPath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = game.guidance.kind === "cooldown" ? "#f3a341" : "#9b57cc";
    game.guidance.points.forEach((q, i) => {
      q = pt(q);
      i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
    });
    ctx.stroke();
  }
  const permanentMarks = [];
  const marker = (q, label, color, diamond = false, edgeClamp = true) => {
    const raw = pt(q);
    if (
      !edgeClamp &&
      (raw.x < 10 || raw.x > w - 10 || raw.y < 10 || raw.y > h - 10)
    )
      return;
    const x = edgeClamp ? clamp(raw.x, 15, w - 15) : raw.x;
    let y = edgeClamp ? clamp(raw.y, 15, h - 15) : raw.y;
    if (label === "M" || label === "P") {
      for (const previous of permanentMarks) {
        if (Math.abs(x - previous.x) < 24 && Math.abs(y - previous.y) < 24)
          y = previous.y < h / 2 ? previous.y + 27 : previous.y - 27;
      }
      permanentMarks.push({ x, y });
    }
    ctx.save();
    ctx.translate(x, y);
    if (diamond) ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.fillRect(-10, -10, 20, 20);
    if (diamond) ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = "#102a32";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 1);
    ctx.restore();
  };
  if (game.guidance?.kind === "cooldown")
    marker(
      game.guidance.destination.inside || game.guidance.destination,
      "◇",
      "#63f1e2",
      true,
    );
  if (game.mission === "active")
    for (const gem of gems)
      if (!game.collected.includes(gem.id))
        marker(gem, "", "#9b57cc", true, false);
  for (const c of game.police || [])
    if (c.visible) {
      const q = pt(c);
      ctx.fillStyle = "#e94d50";
      ctx.beginPath();
      ctx.arc(q.x, q.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  // Permanent landmarks render last and remain edge-clamped, so M and P are
  // always legible even when the player is across the district.
  marker(MISSIONS[0], "M", "#ffb15c");
  marker(POLICE_STATION, "P", "#ff6e67");
  const q = pt(p);
  ctx.save();
  ctx.translate(q.x, q.y);
  ctx.rotate(p.heading);
  ctx.fillStyle = "#123844";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(8, 9);
  ctx.lineTo(0, 5);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
let toastUntil = 0;
function hud(now) {
  document.body.dataset.mode = game.mode;
  const mission = game.mission,
    hits = game.policeHits || 0,
    driving = game.mode === "driving",
    transition = game.transition,
    near = availableCars(game)
      ?.filter((v) => !v.destroyed)
      ?.map((v) => ({ v, d: distance(game.player, v) }))
      .sort((a, b) => a.d - b.d)[0];
  $("mission-label").textContent =
    mission === "available"
      ? "FREE ROAM"
      : mission === "active"
        ? "MARINA GEM RUN"
        : "MISSION COMPLETE";
  $("objective").textContent =
    mission === "available"
      ? "Explore Marina Bay"
      : mission === "active"
        ? `Collect gems · ${game.collected.length} / ${gems.length}`
        : "Marina Bay is yours";
  $("progress").textContent =
    mission === "active"
      ? `${gems.length - game.collected.length} GEMS REMAIN`
      : mission === "available"
        ? "OPTIONAL MISSION · FIND M"
        : "EXPLORE FREELY";
  const gd = game.guidance,
    d = gd?.destination;
  const directionVisible = mission === "active" || game.phase !== "free";
  document.querySelector(".destination").classList.toggle(
    "hidden",
    !directionVisible,
  );
  $("destination-name").textContent =
    game.phase === "cooldown"
      ? "HIDE FOR 5 SECONDS"
      : d?.name?.toUpperCase() || "MISSION ROUTE";
  $("destination-distance").textContent =
    game.phase === "cooldown"
      ? "Sight or movement resets the timer"
      : gd && isFinite(gd.distance)
        ? `${Math.round(gd.distance)} m by road`
        : "";
  $("turn-cue").textContent =
    game.phase === "cooldown"
      ? "Stay still · remain unseen"
      : gd?.cue || "Follow the route";
  $("direction").textContent =
    gd?.turn === "left"
      ? "↰"
      : gd?.turn === "right"
        ? "↱"
        : gd?.kind === "cooldown"
          ? "◇"
          : gd?.turn === "arrive"
            ? "◆"
            : "↑";
  $("pursuit").classList.toggle("clear", game.phase === "free");
  $("pursuit-label").textContent =
    game.phase === "free"
      ? "CITY CLEAR"
      : game.pursuitDelay > 0
        ? `SLOW PURSUIT · ${Math.ceil(game.pursuitDelay)}s`
      : game.phase === "cooldown"
        ? "COOLING DOWN"
        : game.seen
          ? "POLICE HAVE VISUAL"
          : "REACH COOLDOWN";
  [...$("impact-pips").children].forEach((x, i) =>
    x.classList.toggle("hit", i < hits),
  );
  $("heat").textContent = `${hits} / 3 HITS`;
  $("hits-text").textContent = [0, 1, 2]
    .map((i) => (i < hits ? "●" : "○"))
    .join(" ");
  $("cooldown-panel").classList.toggle("hidden", game.phase === "free");
  const cooldownRemaining = Math.max(
    0,
    COOLDOWN_SECONDS - (game.escape || 0),
  );
  $("cooldown-count").textContent = cooldownRemaining.toFixed(1);
  $("cooldown-count").classList.toggle(
    "waiting",
    game.phase !== "cooldown",
  );
  $("cooldown-fill").style.width =
    `${Math.min(100, ((game.escape || 0) / COOLDOWN_SECONDS) * 100)}%`;
  $("cooldown-state").textContent =
    game.phase === "cooldown"
      ? "STAY STILL + UNSEEN · MOVEMENT OR SIGHT RESETS"
      : "REACH ◇ · THEN HIDE STILL FOR 5 SECONDS";
  const kph = driving
    ? Math.round(Math.hypot(game.player.vx || 0, game.player.vz || 0) * 3.6)
    : 0;
  $("speed").textContent = kph;
  $("mode-label").textContent =
    game.mode === "foot"
      ? "ON FOOT"
      : game.mode === "driving"
        ? "DRIVING"
        : game.mode === "exploding"
          ? "WOBBLEHEAD WIPEOUT"
          : game.mode.toUpperCase();
  const interactable = game.mode === "foot" && near?.d < 7;
  $("interaction-copy").textContent = transition
    ? transition.phase === "approach" ? "Walking to the driver’s door" : transition.phase === "align" ? "Turning toward the handle" : `${game.mode === "boarding" ? "Getting in" : "Getting out"} · ${Math.round(transition.progress * 100)}%`
    : interactable
      ? `Enter ${near.v.name}`
      : driving
        ? "Exit vehicle"
        : "Walk closer to a vehicle";
  show("interact", interactable || driving);
  while (game.events?.length) {
    const e = game.events.shift();
    $("toast").textContent = e.text;
    $("toast").className = `${e.kind || ""} visible`;
    toastUntil = now + 2800;
    if (["gem", "reward", "escape"].includes(e.kind)) audio.chime();
    if (e.kind === "gem")
      try {
        localStorage.setItem(
          "marina-getaway-gems-v2",
          JSON.stringify(game.collected),
        );
      } catch {}
  }
  if (now > toastUntil) $("toast").classList.remove("visible");
  drawMap();
}
try {
  world = createWorld($("game"));
  Promise.all([world.prepare(game),preview?.ready,allAssets,document.fonts.ready])
    .then(async()=>{
      if(loadingFailed)return;
      $("loading-label").textContent="Ready to explore";
      // Let both canvases present their complete scene before removing the cover.
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      $("loading-screen").style.display="none";
      $("start").disabled=false;
      $("start").firstChild.textContent="EXPLORE THE BAY ";
    }).catch(loadingError);
} catch (err) {
  loadingError(err);
}
let previous = performance.now(),
  acc = 0,
  lastHud = 0;
function frame(now) {
  const dt = clamp((now - previous) / 1000, 0, 0.1);
  previous = now;
  if(game.status === "intro" && !document.hidden) {
    game.introElapsed=Math.min(6.5,game.introElapsed+dt);
    if(game.introElapsed>=6.5){game.status="running";held.clear();syncInput();status();}
  }
  if (game.status === "ready") preview?.update(dt, now / 1000);
  acc += dt;
  const before = game.status;
  while (acc >= 1 / 120) {
    stepGame(game, input, 1 / 120);
    acc -= 1 / 120;
  }
  if (before !== game.status) status();
  if(world)world.shotAudio.enabled=!audio.muted;
  world?.update(game, dt, now / 1000, view);
  if (now - lastHud > 60) {
    hud(now);
    audio.update(game);
    lastHud = now;
  }
  requestAnimationFrame(frame);
}
status();
requestAnimationFrame(frame);
if (import.meta.env.DEV)
  window.__gameTest = {
    get state() {
      return game;
    },
    get world() {
      return world;
    },
    restart,
    interact: () => interact(game),
    selectCharacter: (id) => choose(id),
    setState(v) {
      Object.assign(game, v);
      status();
    },
  };
