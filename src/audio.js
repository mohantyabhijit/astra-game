export class GameAudio {
  constructor() { this.muted = false; this.ctx = null; }
  init() {
    if (this.ctx) { this.ctx.resume().catch(() => {}); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : .16; this.master.connect(this.ctx.destination);
      this.engine = this.ctx.createOscillator(); this.engine.type = 'sawtooth';
      const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 330;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
      this.engine.connect(filter); filter.connect(this.engineGain); this.engineGain.connect(this.master); this.engine.start();
      this.siren = this.ctx.createOscillator(); this.siren.type = 'sine';
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
      this.siren.connect(this.sirenGain); this.sirenGain.connect(this.master); this.siren.start();
    } catch { this.ctx = null; }
  }
  toggle() { this.muted = !this.muted; if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : .16, this.ctx.currentTime, .05); }
  update(g) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, running = g.status === 'running';
    this.engine.frequency.setTargetAtTime(38 + Math.abs(g.player.speed) * 2.4, t, .1);
    this.engineGain.gain.setTargetAtTime(running && g.mode === 'driving' ? .25 : 0, t, .1);
    this.siren.frequency.setTargetAtTime(660 + Math.sin(g.elapsed * 4) * 190, t, .05);
    this.sirenGain.gain.setTargetAtTime(running ? Math.max(0, 1 - g.nearestCop / 100) * .07 : 0, t, .2);
  }
  chime() {
    if (!this.ctx || this.muted) return;
    [523, 659, 784].forEach((f, i) => {
      const o = this.ctx.createOscillator(), gain = this.ctx.createGain(), t = this.ctx.currentTime + i * .075;
      o.frequency.value = f; gain.gain.setValueAtTime(.12, t); gain.gain.exponentialRampToValueAtTime(.001, t + .3);
      o.connect(gain); gain.connect(this.master); o.start(t); o.stop(t + .35);
    });
  }
}
