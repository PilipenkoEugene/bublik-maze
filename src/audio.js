// ---------- Звук и музыка (всё синтезируется, без файлов) ----------

function mtof(n) { return 440 * Math.pow(2, (n - 69) / 12); }

function Sound(save) {
  this.save = save;
  this.ctx = null;
  this.track = null;
  this.active = true;   // false, когда игра не видна на странице
  this.step = 0;
  this.nextT = 0;
}

// AudioContext создаётся только после действия пользователя (требование браузеров).
Sound.prototype.ensure = function () {
  if (this.ctx) {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  try { this.ctx = new AC(); } catch (e) { return false; }
  var ctx = this.ctx, self = this;
  this.master = ctx.createGain();
  this.master.gain.value = 0.9;
  this.master.connect(ctx.destination);
  this.sfx = ctx.createGain();
  this.sfx.connect(this.master);
  this.mus = ctx.createGain();
  this.mus.gain.value = 0.5;
  this.mus.connect(this.master);
  var len = ctx.sampleRate;
  this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  var data = this.noiseBuf.getChannelData(0);
  for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  setInterval(function () { self.tick(); }, 60);
  return true;
};

Sound.prototype.tone = function (freq, t0, dur, type, vol, dest, slideTo) {
  var ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest || this.sfx);
  o.start(t0); o.stop(t0 + dur + 0.03);
};

Sound.prototype.noise = function (t0, dur, freq, q, vol) {
  var ctx = this.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = this.noiseBuf;
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(this.sfx);
  src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
};

Sound.prototype.meow = function (t0, pitch) {
  var ctx = this.ctx, p = pitch || 1;
  var o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(380 * p, t0);
  o.frequency.linearRampToValueAtTime(720 * p, t0 + 0.12);
  o.frequency.linearRampToValueAtTime(600 * p, t0 + 0.3);
  o.frequency.linearRampToValueAtTime(420 * p, t0 + 0.5);
  bp.type = 'bandpass'; bp.Q.value = 3;
  bp.frequency.setValueAtTime(800, t0);
  bp.frequency.linearRampToValueAtTime(1600, t0 + 0.15);
  bp.frequency.linearRampToValueAtTime(900, t0 + 0.5);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.05);
  g.gain.setValueAtTime(0.4, t0 + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
  o.connect(bp); bp.connect(g); g.connect(this.sfx);
  o.start(t0); o.stop(t0 + 0.6);
};

Sound.prototype.play = function (name) {
  if (!this.save.sound || !this.ensure()) return;
  var t = this.ctx.currentTime + 0.01, self = this;
  switch (name) {
    case 'collect':
      [0, 0.06, 0.12].forEach(function (d) { self.noise(t + d, 0.05, 2600, 1.2, 0.35); });
      this.tone(880, t + 0.05, 0.14, 'square', 0.05, null, 1320);
      break;
    case 'gold':
      [1047, 1319, 1568, 2093].forEach(function (f, i) { self.tone(f, t + i * 0.07, 0.25, 'triangle', 0.12); });
      break;
    case 'key':
      this.tone(1568, t, 0.3, 'sine', 0.15); this.tone(2093, t + 0.1, 0.4, 'sine', 0.12);
      break;
    case 'combo':
      [784, 988, 1175, 1568].forEach(function (f, i) { self.tone(f, t + i * 0.05, 0.18, 'square', 0.06); });
      break;
    case 'bump':
      this.tone(150, t, 0.12, 'triangle', 0.22, null, 90);
      break;
    case 'locked':
      [0, 0.07, 0.14].forEach(function (d) { self.noise(t + d, 0.04, 4000, 4, 0.25); });
      this.tone(220, t, 0.15, 'square', 0.05);
      break;
    case 'oops':
      this.tone(600, t, 0.35, 'triangle', 0.2, null, 200);
      this.noise(t, 0.15, 900, 1, 0.15);
      break;
    case 'meow':
      this.meow(t, 1);
      break;
    case 'start':
      this.meow(t, 1.1);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach(function (f, i) { self.tone(f, t + i * 0.12, 0.35, 'triangle', 0.18); });
      this.meow(t + 0.6, 1.15);
      break;
    case 'buy':
      [988, 1319].forEach(function (f, i) { self.tone(f, t + i * 0.09, 0.2, 'square', 0.07); });
      break;
    case 'click':
      this.tone(700, t, 0.06, 'triangle', 0.1);
      break;
  }
};

Sound.prototype.setTrack = function (music) {
  if (this.track === music) return;
  this.track = music;
  this.step = 0;
  this.nextT = 0;
};

// Планировщик музыки: заранее ставит ноты на ~0.2 с вперёд.
Sound.prototype.tick = function () {
  var ctx = this.ctx, tr = this.track;
  if (!ctx || !tr || !this.save.music || !this.active || document.hidden) { this.nextT = 0; return; }
  var stepDur = 60 / tr.tempo / 2;
  if (this.nextT < ctx.currentTime) this.nextT = ctx.currentTime + 0.05;
  while (this.nextT < ctx.currentTime + 0.25) {
    var st = this.step % tr.melody.length, n = tr.melody[st], t = this.nextT;
    if (n) {
      this.tone(mtof(n), t, stepDur * 1.6, tr.wave, tr.wave === 'square' ? 0.035 : 0.07, this.mus);
      if (tr.wave === 'sine') this.tone(mtof(n + 12), t, stepDur * 2.5, 'sine', 0.02, this.mus);
    }
    var root = tr.bass[Math.floor(st / 8) % tr.bass.length];
    if (st % 8 === 0) this.tone(mtof(root), t, stepDur * 3, 'sine', 0.12, this.mus);
    if (st % 8 === 4) this.tone(mtof(root + 7), t, stepDur * 3, 'sine', 0.08, this.mus);
    this.nextT += stepDur;
    this.step++;
  }
};
