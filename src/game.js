// ---------- Лабиринт ----------

function genMaze(cols, rows, loops) {
  var walls = new Uint8Array(cols * rows).fill(15);
  var seen = new Uint8Array(cols * rows);
  var stack = [0];
  seen[0] = 1;
  while (stack.length) {
    var cur = stack[stack.length - 1], cx = cur % cols, cy = (cur / cols) | 0;
    var opts = DIRS.filter(function (d) {
      var nx = cx + d.dx, ny = cy + d.dy;
      return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[ny * cols + nx];
    });
    if (!opts.length) { stack.pop(); continue; }
    var d = opts[(Math.random() * opts.length) | 0];
    var ni = (cy + d.dy) * cols + cx + d.dx;
    walls[cur] &= ~d.b;
    walls[ni] &= ~d.o;
    seen[ni] = 1;
    stack.push(ni);
  }
  // Немного дополнительных проходов, чтобы детям было не так много тупиков.
  var extra = Math.round(cols * rows * loops), guard = 0;
  while (extra > 0 && guard++ < 2000) {
    var i = (Math.random() * cols * rows) | 0, x = i % cols, y = (i / cols) | 0;
    var dd = DIRS[(Math.random() * 4) | 0], nx2 = x + dd.dx, ny2 = y + dd.dy;
    if (nx2 < 0 || ny2 < 0 || nx2 >= cols || ny2 >= rows || !(walls[i] & dd.b)) continue;
    walls[i] &= ~dd.b;
    walls[ny2 * cols + nx2] &= ~dd.o;
    extra--;
  }
  return walls;
}

function bitCount(v) { var n = 0; while (v) { n += v & 1; v >>= 1; } return n; }

function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function pick(a) { return a[(Math.random() * a.length) | 0]; }

// ---------- Сохранение ----------

function loadSave() {
  var s = { stars: [], wallet: 0, owned: [], wear: {}, sound: true, music: true, profile: null, gift: null };
  try {
    var raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (raw) for (var k in s) if (raw[k] !== undefined) s[k] = raw[k];
  } catch (e) { /* хранилище недоступно — играем без сохранения */ }
  return s;
}

function storeSave(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* нет доступа */ }
}

// ---------- Игра ----------

function Game(root) {
  var self = this;
  this.root = root;
  this.ref = {};
  root.querySelectorAll('[data-ref]').forEach(function (el) { self.ref[el.getAttribute('data-ref')] = el; });
  this.canvas = this.ref.canvas;
  this.ctx = this.canvas.getContext('2d');
  this.layer = document.createElement('canvas');
  this.fogLayer = document.createElement('canvas');
  this.save = loadSave();
  this.sound = new Sound(this.save);
  this.state = 'start';
  this.particles = [];
  this.ambient = [];
  this.path = [];
  this.held = null;
  this.hint = null;
  this.bumpCooldown = 0;
  this.lockShake = 0;
  this.time = 0;
  this.visible = true;

  this.catImg = new Image();
  this.catImg.src = CAT_SRC;
  this.ref.hero.src = CAT_SRC;

  this.updateAudioIcons();
  this.initForm();
  this.updatePlayerUI();
  this.bindUI();
  flushQueue();
  this.newLevel(this.firstOpenLevel());

  if (window.ResizeObserver) new ResizeObserver(function () { self.resize(); }).observe(root);
  window.addEventListener('resize', function () { self.resize(); });
  // Когда игра прокручена за экран — не тратим батарею и выключаем музыку.
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      self.visible = entries[0].isIntersecting;
      self.sound.active = self.visible;
    }).observe(root);
  }

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (self.visible) {
      self.update(dt);
      self.render();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

Game.prototype.isUnlocked = function (i) { return i === 0 || this.save.stars[i - 1] > 0; };

Game.prototype.firstOpenLevel = function () {
  for (var i = 0; i < LEVELS.length; i++) if (!this.save.stars[i]) return i;
  return 0;
};

Game.prototype.newLevel = function (index) {
  var cfg = LEVELS[index], world = WORLDS[cfg.w];
  var cols = cfg.size, rows = cfg.size, self = this;
  this.levelIndex = index;
  this.cfg = cfg;
  this.world = world;
  this.cols = cols; this.rows = rows;
  this.walls = genMaze(cols, rows, cfg.loops);
  this.exit = { x: cols - 1, y: rows - 1 };
  var exitIdx = this.exit.y * cols + this.exit.x;
  var dist = this.bfsDistances(0, 0);
  this.decorSeed = Math.random() * 1000;

  // Свободные клетки: тупики (там интереснее искать) и все остальные.
  var dead = [], rest = [], used = {};
  for (var i = 1; i < cols * rows; i++) {
    if (i === exitIdx || dist[i] < 2) continue;
    (bitCount(this.walls[i]) === 3 ? dead : rest).push(i);
  }
  shuffle(dead); shuffle(rest);
  function take(far) {
    var pool = dead.length ? dead : rest;
    if (!pool.length) return null;
    var k = 0;
    if (far) {
      var sorted = pool.slice().sort(function (a, b) { return dist[b] - dist[a]; });
      k = pool.indexOf(pick(sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 3)))));
    }
    var idx = pool.splice(k, 1)[0];
    used[idx] = true;
    return { x: idx % cols, y: (idx / cols) | 0 };
  }

  this.key = cfg.key ? take(true) : null;
  this.hasKey = false;
  this.bagels = [];
  if (cfg.gold) { var g = take(true); if (g) this.bagels.push({ x: g.x, y: g.y, gold: true }); }
  for (i = 0; i < cfg.bagels; i++) {
    var b = take(false);
    if (b) this.bagels.push({ x: b.x, y: b.y, gold: false });
  }
  this.bagels.forEach(function (bb, k) { bb.phase = k * 1.3; bb.taken = false; });
  this.regularTotal = this.bagels.filter(function (bb) { return !bb.gold; }).length;

  // Мышки ходят туда-сюда по отрезку пути в 3–4 клетки, подальше от старта.
  this.mice = [];
  var busy = {};
  for (var m = 0; m < (cfg.mice || 0); m++) {
    for (var tries = 0; tries < 60; tries++) {
      var c0 = (Math.random() * cols * rows) | 0;
      if (dist[c0] < 3 || c0 === exitIdx || busy[c0]) continue;
      var x0 = c0 % cols, y0 = (c0 / cols) | 0, d0 = this.bfsDistances(x0, y0), ends = [];
      for (var j = 0; j < cols * rows; j++) if ((d0[j] === 3 || d0[j] === 4) && dist[j] >= 2 && j !== exitIdx) ends.push(j);
      if (!ends.length) continue;
      var e = pick(ends);
      var cells = [{ x: x0, y: y0 }].concat(this.findPath(x0, y0, e % cols, (e / cols) | 0));
      if (cells.some(function (p) { return dist[p.y * cols + p.x] < 2 || busy[p.y * cols + p.x]; })) continue;
      cells.forEach(function (p) { busy[p.y * cols + p.x] = true; });
      this.mice.push({ cells: cells, pos: 0, dir: 1, pause: 0.5, facing: 1 });
      break;
    }
  }

  // Выход — проход в правой внешней стене последней клетки.
  this.walls[exitIdx] &= ~E;

  this.fog = cfg.fog ? new Uint8Array(cols * rows) : null;
  this.cat = { x: 0, y: 0, tx: 0, ty: 0, t: 0, moving: false, facing: 1, bump: 0, out: 0,
    spin: 0, dizzy: 0, invuln: 0, idle: 0, wave: 0, emote: null };
  this.reveal(0, 0);
  this.path = [];
  this.held = null;
  this.hint = null;
  this.particles = [];
  this.ambient = [];
  this.score = 0;
  this.goldGot = 0;
  this.combo = 0;
  this.lastCollect = -10;

  var st = this.root.style;
  st.setProperty('--bm-bg1', world.bg[0]);
  st.setProperty('--bm-bg2', world.bg[1]);
  this.ref.level.textContent = index + 1;
  this.ref.total.textContent = this.regularTotal;
  this.ref.score.textContent = 0;
  this.ref.keyPill.hidden = !this.key;
  this.ref.keyPill.classList.remove('bm-got');
  this.sound.setTrack(world.music);
  this.resize(true);
};

Game.prototype.bfsDistances = function (sx, sy) {
  var cols = this.cols, rows = this.rows, dist = new Int32Array(cols * rows).fill(-1);
  var q = [sy * cols + sx];
  dist[q[0]] = 0;
  for (var h = 0; h < q.length; h++) {
    var i = q[h], x = i % cols, y = (i / cols) | 0;
    for (var k = 0; k < 4; k++) {
      var d = DIRS[k], nx = x + d.dx, ny = y + d.dy, ni = ny * cols + nx;
      if (this.walls[i] & d.b || nx < 0 || ny < 0 || nx >= cols || ny >= rows || dist[ni] >= 0) continue;
      dist[ni] = dist[i] + 1;
      q.push(ni);
    }
  }
  return dist;
};

// Путь из клетки (sx,sy) в (gx,gy) — список клеток без стартовой.
Game.prototype.findPath = function (sx, sy, gx, gy) {
  var dist = this.bfsDistances(gx, gy), cols = this.cols, rows = this.rows;
  if (dist[sy * cols + sx] < 0) return [];
  var path = [], x = sx, y = sy;
  while (x !== gx || y !== gy) {
    var i = y * cols + x;
    for (var k = 0; k < 4; k++) {
      var d = DIRS[k], nx = x + d.dx, ny = y + d.dy;
      if (this.walls[i] & d.b || nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (dist[ny * cols + nx] === dist[i] - 1) { x = nx; y = ny; break; }
    }
    path.push({ x: x, y: y });
  }
  return path;
};

Game.prototype.isLockedExit = function (x, y, d) {
  return d === DIRS[1] && x === this.exit.x && y === this.exit.y && this.key && !this.hasKey;
};

Game.prototype.canMove = function (x, y, d) {
  if (x < 0 || x >= this.cols) return false;
  if (this.isLockedExit(x, y, d)) return false;
  return !(this.walls[y * this.cols + x] & d.b);
};

// Клетка, в которой кот окажется после текущего шага.
Game.prototype.catTarget = function () {
  return this.cat.moving ? { x: this.cat.tx, y: this.cat.ty } : { x: this.cat.x, y: this.cat.y };
};

Game.prototype.catPos = function () {
  var c = this.cat, k = c.moving ? c.t : 0, e = k * k * (3 - 2 * k);
  return { x: c.x + (c.tx - c.x) * e, y: c.y + (c.ty - c.y) * e };
};

Game.prototype.reveal = function (x, y) {
  if (!this.fog) return;
  var changed = false;
  for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
    var nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
    var i = ny * this.cols + nx;
    if (!this.fog[i]) { this.fog[i] = 1; changed = true; }
  }
  if (changed && this.cell) this.drawFog();
};

// ---------- Размеры и статичные слои ----------

Game.prototype.resize = function (force) {
  var stage = this.ref.stage;
  var availW = stage.clientWidth || 320;
  var maxH = Math.max(300, Math.min(window.innerHeight - 170, 680));
  var m = { l: 0.35, t: 0.95, r: 1.0, b: 0.35 };
  var cell = Math.floor(Math.min(availW / (this.cols + m.l + m.r), maxH / (this.rows + m.t + m.b)));
  cell = Math.max(24, Math.min(cell, 84));
  var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  if (!force && cell === this.cell && dpr === this.dpr) return;
  this.cell = cell;
  this.dpr = dpr;
  var w = Math.round(cell * (this.cols + m.l + m.r)), h = Math.round(cell * (this.rows + m.t + m.b));
  this.cssW = w; this.cssH = h;
  this.ox = cell * m.l; this.oy = cell * m.t;
  [this.canvas, this.layer, this.fogLayer].forEach(function (c) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); });
  this.canvas.style.width = w + 'px';
  this.canvas.style.height = h + 'px';
  this.bagelSize = Math.ceil(cell * 0.72);
  this.bagelSprite = makeBagelSprite(this.bagelSize, dpr, false);
  this.goldSprite = makeBagelSprite(this.bagelSize, dpr, true);
  this.drawLayer();
  this.drawFog();
};

Game.prototype.drawLayer = function () {
  var ctx = this.layer.getContext('2d'), s = this.cell, ox = this.ox, oy = this.oy;
  var cols = this.cols, rows = this.rows, wd = this.world;
  ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  ctx.clearRect(0, 0, this.cssW, this.cssH);

  // Поле
  ctx.save();
  ctx.shadowColor = 'rgba(22, 60, 120, .22)';
  ctx.shadowBlur = s * 0.3;
  ctx.shadowOffsetY = s * 0.08;
  roundRect(ctx, ox - s * 0.2, oy - s * 0.2, cols * s + s * 0.4, rows * s + s * 0.4, s * 0.35);
  ctx.fillStyle = wd.floor;
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = wd.floorAlt;
  for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
    if ((x + y) % 2) ctx.fillRect(ox + x * s, oy + y * s, s, s);
  }

  // Мелкие украшения пола: травинки, крошки, снежинки
  var seed = this.decorSeed;
  function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  ctx.fillStyle = ctx.strokeStyle = wd.decor;
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.lineCap = 'round';
  for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
    if (rnd() > 0.35 || (x === 0 && y === 0)) continue;
    var px = ox + (x + 0.2 + rnd() * 0.6) * s, py = oy + (y + 0.25 + rnd() * 0.55) * s;
    if (wd.ambient === 'leaves') {
      ctx.beginPath();
      ctx.moveTo(px - s * 0.06, py); ctx.lineTo(px - s * 0.09, py - s * 0.1);
      ctx.moveTo(px, py); ctx.lineTo(px, py - s * 0.13);
      ctx.moveTo(px + s * 0.06, py); ctx.lineTo(px + s * 0.09, py - s * 0.1);
      ctx.stroke();
    } else if (wd.ambient === 'snow') {
      for (var k = 0; k < 3; k++) {
        var a = k * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(px - Math.cos(a) * s * 0.07, py - Math.sin(a) * s * 0.07);
        ctx.lineTo(px + Math.cos(a) * s * 0.07, py + Math.sin(a) * s * 0.07);
        ctx.stroke();
      }
    } else {
      for (k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(px + (k - 1) * s * 0.07, py + (k % 2) * s * 0.04, s * 0.03, s * 0.018, k, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Старт — розовый коврик
  ctx.fillStyle = 'rgba(255, 46, 136, .18)';
  ctx.beginPath();
  ctx.ellipse(ox + s / 2, oy + s * 0.86, s * 0.38, s * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Стены
  ctx.beginPath();
  for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
    var w = this.walls[y * cols + x], qx = ox + x * s, qy = oy + y * s;
    if (w & N) { ctx.moveTo(qx, qy); ctx.lineTo(qx + s, qy); }
    if (w & W) { ctx.moveTo(qx, qy); ctx.lineTo(qx, qy + s); }
    if (x === cols - 1 && (w & E)) { ctx.moveTo(qx + s, qy); ctx.lineTo(qx + s, qy + s); }
    if (y === rows - 1 && (w & S)) { ctx.moveTo(qx, qy + s); ctx.lineTo(qx + s, qy + s); }
  }
  var lw = Math.max(4, s * 0.17);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.save();
  ctx.translate(0, s * 0.06);
  ctx.strokeStyle = wd.wallShadow;
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = wd.wall;
  ctx.stroke();
  ctx.save();
  ctx.strokeStyle = wd.wallTop;
  if (wd.wallStyle === 'snow') {
    ctx.translate(0, -lw * 0.3);
    ctx.lineWidth = lw * 0.42;
  } else if (wd.wallStyle === 'leafy') {
    ctx.lineWidth = lw * 0.38;
    ctx.setLineDash([lw * 0.15, lw * 0.75]);
  } else {
    ctx.translate(-lw * 0.12, -lw * 0.18);
    ctx.lineWidth = lw * 0.25;
    ctx.globalAlpha = 0.8;
  }
  ctx.stroke();
  ctx.restore();
};

Game.prototype.drawFog = function () {
  var ctx = this.fogLayer.getContext('2d'), s = this.cell;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, this.fogLayer.width, this.fogLayer.height);
  if (!this.fog) return;
  ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  var x0 = this.ox - s * 0.25, y0 = this.oy - s * 0.25;
  roundRect(ctx, x0, y0, this.cols * s + s * 0.5, this.rows * s + s * 0.5, s * 0.35);
  ctx.fillStyle = this.world.fog;
  ctx.fill();
  // Пушистые облачка в случайных местах
  var seed = this.decorSeed + 7;
  function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  ctx.fillStyle = 'rgba(255, 255, 255, .22)';
  for (var y = 0; y < this.rows; y++) for (var x = 0; x < this.cols; x++) {
    for (var k = 0; k < 2; k++) {
      ctx.beginPath();
      ctx.arc(this.ox + (x + rnd()) * s, this.oy + (y + rnd()) * s, s * (0.3 + rnd() * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'destination-out';
  for (y = 0; y < this.rows; y++) for (x = 0; x < this.cols; x++) {
    if (!this.fog[y * this.cols + x]) continue;
    var cx = this.ox + (x + 0.5) * s, cy = this.oy + (y + 0.5) * s;
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.6, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
};

// ---------- Экраны ----------

Game.prototype.showScreen = function (name) {
  var screens = { start: 'startScreen', form: 'formScreen', map: 'mapScreen', wardrobe: 'wardrobeScreen', won: 'winScreen', gift: 'giftScreen' };
  for (var k in screens) this.ref[screens[k]].classList.toggle('bm-show', k === name);
  this.ref.toast.classList.remove('bm-show');
  this.root.classList.toggle('bm-menu', !!name);
  this.root.setAttribute('data-screen', name || 'game');
  // Если верх игры уехал за экран (длинная анкета, карта) — возвращаем его в видимую область.
  var top = this.root.getBoundingClientRect().top;
  if (top < 0) this.root.scrollIntoView({ block: 'start', behavior: 'smooth' });
};

Game.prototype.openMap = function () {
  this.state = 'map';
  this.held = null;
  this.path = [];
  this.renderMap();
  this.showScreen('map');
};

Game.prototype.renderMap = function () {
  var html = '', self = this, current = this.firstOpenLevel();
  WORLDS.forEach(function (wd, wi) {
    html += '<div class="bm-world" style="--bm-w:' + wd.wall + ';--bm-ws:' + wd.wallShadow + '">' +
      '<div class="bm-world-title"><span>' + wd.emoji + '</span>' + wd.name + '</div><div class="bm-levels">';
    LEVELS.forEach(function (lv, i) {
      if (lv.w !== wi) return;
      var open = self.isUnlocked(i), stars = self.save.stars[i] || 0, starsHtml = '';
      for (var k = 0; k < 3; k++) starsHtml += '<i class="' + (k < stars ? 'bm-on' : '') + '">★</i>';
      html += '<button type="button" class="bm-lvl' + (open ? '' : ' bm-locked') + (open && i === current && !stars ? ' bm-current' : '') +
        '" data-level="' + i + '"' + (open ? '' : ' disabled') + '>' +
        '<span class="bm-lvl-n">' + (open ? i + 1 : '🔒') + '</span><span class="bm-lvl-stars">' + starsHtml + '</span></button>';
    });
    html += '</div></div>';
  });
  this.ref.worlds.innerHTML = html;
  this.ref.giftBtn.hidden = !(this.save.gift && !this.save.gift.claimedAt);
  this.updateWallet();
};

Game.prototype.updateWallet = function () {
  var v = this.save.wallet;
  this.root.querySelectorAll('.bm-wallet').forEach(function (el) { el.textContent = v; });
};

Game.prototype.openWardrobe = function () {
  this.state = 'wardrobe';
  this.renderWardrobe();
  this.showScreen('wardrobe');
};

Game.prototype.renderWardrobe = function () {
  var save = this.save, html = '';
  ITEMS.forEach(function (it) {
    var owned = save.owned.indexOf(it.id) >= 0, worn = save.wear[it.slot] === it.id;
    var btn = owned
      ? '<span class="bm-item-btn' + (worn ? ' bm-worn' : '') + '">' + (worn ? 'Снять' : 'Надеть') + '</span>'
      : '<span class="bm-item-btn bm-price' + (save.wallet < it.price ? ' bm-poor' : '') + '"><span class="bm-bagel-ico"></span>' + it.price + '</span>';
    html += '<button type="button" class="bm-item' + (worn ? ' bm-worn' : '') + '" data-item="' + it.id + '">' +
      '<canvas width="128" height="128"></canvas><span class="bm-item-name">' + it.name + '</span>' + btn + '</button>';
  });
  this.ref.items.innerHTML = html;
  var self = this;
  this.ref.items.querySelectorAll('.bm-item').forEach(function (el) {
    var cv = el.querySelector('canvas'), ctx = cv.getContext('2d'), id = el.getAttribute('data-item');
    var big = { crown: 92, bow: 88, flower: 84, glasses: 118, halo: 78, balloon: 84, cape: 76 }[id] || 70;
    drawItem(ctx, id, 64, id === 'balloon' ? 54 : 64, big, 0.4, id === 'balloon' ? [60, 124] : null);
  });
  this.updateWallet();
  self.drawPreview();
};

Game.prototype.drawPreview = function () {
  var cv = this.ref.preview, dpr = this.dpr || 1, w = 160, h = 200;
  if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  var ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(40, 30, 80, .15)';
  ctx.beginPath(); ctx.ellipse(w / 2, h - 14, 46, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(w / 2 + 6, h - 14 - Math.abs(Math.sin(this.time * 2.5)) * 6);
  drawCatFigure(ctx, this.catImg, 150, this.save.wear, this.time);
  ctx.restore();
};

Game.prototype.toggleItem = function (id) {
  var it = ITEMS.filter(function (x) { return x.id === id; })[0], save = this.save;
  if (!it) return;
  if (save.owned.indexOf(id) < 0) {
    if (save.wallet < it.price) {
      this.toast('Нужно ещё ' + (it.price - save.wallet) + ' бубл. — собирай в лабиринте!');
      this.sound.play('bump');
      return;
    }
    save.wallet -= it.price;
    save.owned.push(id);
    save.wear[it.slot] = id;
    this.sound.play('buy');
    this.sound.play('meow');
  } else {
    save.wear[it.slot] = save.wear[it.slot] === id ? null : id;
    this.sound.play('click');
  }
  storeSave(save);
  this.renderWardrobe();
};

Game.prototype.toast = function (text) {
  var el = this.ref.toast;
  el.textContent = text;
  el.classList.remove('bm-show');
  void el.offsetWidth;
  el.classList.add('bm-show');
  clearTimeout(this.toastTimer);
  this.toastTimer = setTimeout(function () { el.classList.remove('bm-show'); }, 3800);
};

Game.prototype.playLevel = function (i) {
  if (!this.save.profile) { this.openForm(); return; }
  if (!this.isUnlocked(i)) return;
  var firstTime = !this.save.stars[i];
  this.newLevel(i);
  this.state = 'play';
  this.showScreen(null);
  this.sound.ensure();
  this.sound.play('start');
  if (this.cfg.intro && firstTime) this.toast(this.cfg.intro);
  this.root.focus({ preventScroll: true });
};

Game.prototype.nextLevel = function () {
  if (this.levelIndex + 1 < LEVELS.length && this.isUnlocked(this.levelIndex + 1)) this.playLevel(this.levelIndex + 1);
  else this.openMap();
};

Game.prototype.startGame = function () {
  this.sound.ensure();
  if (!this.save.profile) { this.openForm(); return; }
  if (this.save.stars.length) this.openMap();
  else this.playLevel(0);
};

// ---------- Анкета, подарок, смена игрока ----------

Game.prototype.initForm = function () {
  var self = this, form = this.ref.form, ref = this.ref;
  if (FORM.privacyUrl) { ref.privacyLink.href = FORM.privacyUrl; ref.privacyWrap.hidden = false; }

  // Маски ввода. При стирании не переформатируем, иначе не удалить точку, скобку или дефис.
  function mask(el, fmt) {
    el.addEventListener('input', function (e) {
      if (e.inputType && e.inputType.indexOf('delete') === 0) return;
      el.value = fmt(el.value);
    });
  }
  var phone = form.elements.parent_phone, birth = form.elements.child_birthdate;
  mask(phone, formatPhone);
  mask(birth, formatDate);
  // В пустое поле телефона сразу подставляем «+7 » — видно, что дальше набирать номер.
  phone.addEventListener('focus', function () { if (!phone.value) phone.value = '+7 '; });
  phone.addEventListener('blur', function () {
    phone.value = formatPhone(phone.value);
    if (phone.value === '+7 ') phone.value = '';
  });
  birth.addEventListener('blur', function () { birth.value = formatDate(birth.value).replace(/\.$/, ''); });
  form.addEventListener('input', function (e) { e.target.classList.remove('bm-bad'); ref.formError.textContent = ''; });
  form.addEventListener('submit', function (e) { e.preventDefault(); self.submitForm(); });

  // Кнопка для сотрудника: нужно удерживать, чтобы ребёнок не нажал случайно.
  var btn = ref.staffBtn, timer = null;
  btn.style.setProperty('--bm-hold', GIFT.holdSeconds + 's');
  function cancel() { clearTimeout(timer); btn.classList.remove('bm-holding'); }
  btn.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    btn.classList.add('bm-holding');
    timer = setTimeout(function () { cancel(); self.claimGift(); }, GIFT.holdSeconds * 1000);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { btn.addEventListener(ev, cancel); });
  btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
};

Game.prototype.openForm = function () {
  this.state = 'form';
  this.ref.form.reset();
  this.ref.formError.textContent = '';
  this.ref.formSubmit.disabled = false;
  this.ref.formSubmit.textContent = 'Начать игру';
  this.showScreen('form');
};

Game.prototype.submitForm = function () {
  var f = this.ref.form.elements, self = this, bad = [];
  var v = {
    child_name: f.child_name.value.trim(),
    child_birthdate: formatDate(f.child_birthdate.value).replace(/\.$/, ''),
    parent_name: f.parent_name.value.trim(),
    parent_phone: formatPhone(f.parent_phone.value),
    parent_email: f.parent_email.value.trim(),
    consent_pd: f.consent_pd.checked,
    consent_ads: f.consent_ads.checked
  };
  if (v.child_name.length < 2) bad.push(['child_name', 'Напишите имя ребёнка']);
  var age = ageFromDate(v.child_birthdate);
  if (!v.child_birthdate) bad.push(['child_birthdate', 'Укажите дату рождения ребёнка']);
  else if (age === null) bad.push(['child_birthdate', 'Проверьте дату рождения: ДД.ММ.ГГГГ']);
  else if (age < 0) bad.push(['child_birthdate', 'Дата рождения не может быть в будущем']);
  else if (age > FORM.maxChildAge) bad.push(['child_birthdate', 'Проверьте год рождения ребёнка']);
  if (v.parent_name.length < 2) bad.push(['parent_name', 'Напишите ваше имя']);
  if (v.parent_phone.replace(/\D/g, '').length !== 11) bad.push(['parent_phone', 'Проверьте номер телефона']);
  if (v.parent_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.parent_email)) bad.push(['parent_email', 'Проверьте e-mail']);
  if (!v.consent_pd) bad.push(['consent_pd', 'Нужно согласие на обработку данных']);
  ['child_name', 'child_birthdate', 'parent_name', 'parent_phone', 'parent_email', 'consent_pd'].forEach(function (n) {
    var el = f[n], isBad = bad.some(function (b) { return b[0] === n; });
    (el.type === 'checkbox' ? el.parentNode : el).classList.toggle('bm-bad', isBad);
  });
  if (bad.length) {
    this.ref.formError.textContent = bad[0][1];
    // Подводим к первому неверному полю, чтобы не искать его глазами.
    var first = f[bad[0][0]];
    first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (first.type !== 'checkbox') first.focus({ preventScroll: true });
    this.sound.play('bump');
    return;
  }

  var profile = {
    player_id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    gift_code: randomCode(),
    child_name: v.child_name, child_birthdate: v.child_birthdate, child_age: age,
    parent_name: v.parent_name, parent_phone: v.parent_phone, parent_email: v.parent_email,
    consent_pd: v.consent_pd ? 'да' : 'нет', consent_ads: v.consent_ads ? 'да' : 'нет'
  };
  this.ref.formSubmit.disabled = true;
  this.ref.formSubmit.textContent = 'Отправляем…';
  // Даже без сети игру не задерживаем: анкета останется в очереди и уйдёт позже.
  sendEvent('registration', profile).then(function () {
    self.save.profile = profile;
    storeSave(self.save);
    self.updatePlayerUI();
    self.root.dispatchEvent(new CustomEvent('bublikmaze:register', { bubbles: true, detail: { age: profile.child_age } }));
    self.sound.ensure();
    self.playLevel(0);
  });
};

// Данные, которые прикладываются к событиям о подарке (чтобы найти анкету в таблице).
Game.prototype.profileData = function () {
  var p = this.save.profile || {};
  return { player_id: p.player_id, gift_code: p.gift_code, child_name: p.child_name, parent_phone: p.parent_phone };
};

Game.prototype.updatePlayerUI = function () {
  var p = this.save.profile;
  this.ref.startText.textContent = p
    ? 'Привет, ' + p.child_name + '! Котик ждёт тебя в лабиринте!'
    : 'Помоги котику собрать все бублики и найти выход!';
  this.ref.startNewPlayer.hidden = !p;
  this.ref.playerName.textContent = p ? p.child_name : '';
};

Game.prototype.showGift = function (fromMap) {
  var p = this.save.profile || {}, claimed = !!(this.save.gift && this.save.gift.claimedAt);
  this.state = 'gift';
  this.giftFromMap = fromMap;
  this.ref.giftTitle.textContent = p.child_name ? p.child_name + ', ты молодец!' : 'Ты молодец!';
  this.ref.giftText.textContent = GIFT.title + ' ' + GIFT.text;
  this.ref.giftCode.textContent = p.gift_code || '';
  var a = p.child_birthdate ? ageFromDate(p.child_birthdate) : p.child_age;
  this.ref.giftName.textContent = p.child_name ? p.child_name + ', ' + a + ' ' + yearsWord(a) + (p.child_birthdate ? ' (' + p.child_birthdate + ')' : '') : '';
  this.ref.staffBtn.hidden = claimed;
  this.ref.giftClaimed.hidden = !claimed;
  this.ref.giftContinue.textContent = fromMap ? 'К уровням' : 'Играть дальше';
  this.showScreen('gift');
  if (!fromMap) {
    this.sound.play('win');
    this.spawnConfetti(60);
  }
};

Game.prototype.claimGift = function () {
  if (!this.save.gift || this.save.gift.claimedAt) return;
  this.save.gift.claimedAt = localTime();
  storeSave(this.save);
  sendEvent('gift_claimed', this.profileData());
  this.root.dispatchEvent(new CustomEvent('bublikmaze:gift', { bubbles: true, detail: { code: this.save.profile && this.save.profile.gift_code } }));
  this.sound.play('key');
  this.ref.staffBtn.hidden = true;
  this.ref.giftClaimed.hidden = false;
};

// Для общего планшета: сбрасываем всё, кроме настроек звука.
Game.prototype.newPlayer = function () {
  if (this.save.profile && !window.confirm('Начать заново для нового игрока? Прогресс и наряды текущего игрока будут сброшены.')) return;
  var s = this.save;
  s.stars = []; s.wallet = 0; s.owned = []; s.wear = {}; s.profile = null; s.gift = null;
  storeSave(s);
  this.updatePlayerUI();
  this.newLevel(0);
  this.state = 'start';
  this.showScreen('start');
};

// ---------- Управление ----------

Game.prototype.bindUI = function () {
  var self = this, root = this.root;

  root.addEventListener('click', function (e) {
    var lvl = e.target.closest('[data-level]');
    if (lvl && root.contains(lvl)) { self.playLevel(+lvl.getAttribute('data-level')); return; }
    var item = e.target.closest('[data-item]');
    if (item && root.contains(item)) { self.toggleItem(item.getAttribute('data-item')); return; }
    var btn = e.target.closest('[data-act]');
    if (!btn || !root.contains(btn)) return;
    var act = btn.getAttribute('data-act');
    if (act === 'play') self.startGame();
    else if (act === 'map') { self.sound.play('click'); self.openMap(); }
    else if (act === 'wardrobe') { self.sound.play('click'); self.openWardrobe(); }
    else if (act === 'again') self.playLevel(self.levelIndex);
    else if (act === 'next') self.nextLevel();
    else if (act === 'hint') self.showHint();
    else if (act === 'toStart') { self.state = 'start'; self.showScreen('start'); }
    else if (act === 'newPlayer') { self.newPlayer(); return; }
    else if (act === 'gift') { self.sound.play('click'); self.showGift(true); }
    else if (act === 'giftContinue') { if (self.giftFromMap) self.openMap(); else self.nextLevel(); }
    else if (act === 'sound') { self.save.sound = !self.save.sound; storeSave(self.save); self.updateAudioIcons(); self.sound.play('click'); }
    else if (act === 'music') { self.save.music = !self.save.music; storeSave(self.save); self.updateAudioIcons(); self.sound.ensure(); }
    root.focus({ preventScroll: true });
  });

  // Клавиатура — только когда игра в фокусе, чтобы не мешать прокрутке страницы.
  root.addEventListener('keydown', function (e) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.code === 'Escape' && self.state === 'play') { self.openMap(); return; }
    if ((e.code === 'Enter' || e.code === 'Space') && self.state !== 'play') {
      if (e.target.tagName === 'BUTTON' && e.target !== root) return;
      e.preventDefault();
      if (self.state === 'start') self.startGame();
      else if (self.state === 'won') self.nextLevel();
      return;
    }
    var name = KEY_DIRS[e.code];
    if (!name || self.state !== 'play') return;
    e.preventDefault();
    if (e.repeat) return;
    self.path = [];
    self.held = DIR_BY_NAME[name];
    self.heldKey = e.code;
    self.stepHeld(true);
  });
  root.addEventListener('keyup', function (e) {
    if (e.code === self.heldKey) self.held = null;
  });
  root.addEventListener('blur', function () { self.held = null; });

  // Касание/мышь по полю: короткое нажатие — идти в клетку, свайп — бежать в сторону.
  var down = null;
  this.canvas.addEventListener('pointerdown', function (e) {
    down = { x: e.clientX, y: e.clientY };
    root.focus({ preventScroll: true });
  });
  this.canvas.addEventListener('pointerup', function (e) {
    if (!down || self.state !== 'play') { down = null; return; }
    var dx = e.clientX - down.x, dy = e.clientY - down.y;
    down = null;
    if (Math.hypot(dx, dy) > 24) {
      var name = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      self.runDirection(DIR_BY_NAME[name]);
    } else {
      var r = self.canvas.getBoundingClientRect();
      self.goToPoint(e.clientX - r.left, e.clientY - r.top);
    }
  });
  this.canvas.addEventListener('pointercancel', function () { down = null; });

  // Экранный джойстик
  root.querySelectorAll('.bm-dpad [data-dir]').forEach(function (btn) {
    var d = DIR_BY_NAME[btn.getAttribute('data-dir')];
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (self.state !== 'play') return;
      btn.classList.add('bm-pressed');
      self.path = [];
      self.held = d;
      self.stepHeld(true);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      btn.addEventListener(ev, function () {
        btn.classList.remove('bm-pressed');
        if (self.held === d) self.held = null;
      });
    });
  });
};

Game.prototype.updateAudioIcons = function () {
  var s = this.save;
  this.ref.sndOn.style.display = s.sound ? '' : 'none';
  this.ref.sndOff.style.display = s.sound ? 'none' : '';
  this.ref.musOn.style.display = s.music ? '' : 'none';
  this.ref.musOff.style.display = s.music ? 'none' : '';
};

Game.prototype.goToPoint = function (px, py) {
  var s = this.cell, gx = Math.floor((px - this.ox) / s), gy = Math.floor((py - this.oy) / s);
  var out = false;
  if (gx >= this.cols && gx <= this.cols + 1 && gy === this.exit.y) { gx = this.exit.x; out = true; }
  if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) return;
  var from = this.catTarget();
  this.path = this.findPath(from.x, from.y, gx, gy);
  if (out) this.path.push({ x: this.cols, y: this.exit.y });
};

// Бежим в направлении до стены или развилки.
Game.prototype.runDirection = function (d) {
  var p = this.catTarget(), x = p.x, y = p.y, path = [];
  if (!this.canMove(x, y, d)) { this.bump(d, x, y); return; }
  while (this.canMove(x, y, d)) {
    x += d.dx; y += d.dy;
    path.push({ x: x, y: y });
    if (x >= this.cols) break;
    if (4 - bitCount(this.walls[y * this.cols + x]) > 2) break;
  }
  this.path = path;
};

Game.prototype.stepHeld = function (fromPress) {
  var c = this.cat;
  if (this.state !== 'play' || c.moving || c.dizzy > 0 || !this.held) return;
  if (this.canMove(c.x, c.y, this.held)) this.startMove(this.held);
  else if (fromPress) this.bump(this.held, c.x, c.y);
};

Game.prototype.bump = function (d, x, y) {
  if (this.bumpCooldown > 0) return;
  this.bumpCooldown = 0.35;
  var c = this.cat;
  c.bump = 1;
  c.bumpDir = d;
  if (d.dx) c.facing = d.dx;
  if (this.isLockedExit(x, y, d)) {
    this.lockShake = 1;
    c.emote = { type: 'key', t: 1.8 };
    this.sound.play('locked');
    if (!this.lockToastShown) { this.lockToastShown = true; this.toast('Дверь закрыта — найди ключ!'); }
  } else {
    c.emote = { type: 'sweat', t: 0.8 };
    this.sound.play('bump');
  }
};

Game.prototype.startMove = function (d) {
  var c = this.cat;
  c.tx = c.x + d.dx; c.ty = c.y + d.dy; c.t = 0; c.moving = true; c.idle = 0;
  if (d.dx) c.facing = d.dx;
  if (c.tx < this.cols) this.reveal(c.tx, c.ty);
};

Game.prototype.showHint = function () {
  if (this.state !== 'play') return;
  var p = this.catTarget();
  var path = this.findPath(p.x, p.y, this.exit.x, this.exit.y);
  // С закрытой дверью подсказка ведёт сначала к ключу.
  if (this.key && !this.hasKey) path = this.findPath(p.x, p.y, this.key.x, this.key.y);
  path.unshift({ x: p.x, y: p.y });
  this.hint = { path: path, until: this.time + HINT_SECONDS };
  this.sound.play('click');
};

// ---------- Цикл ----------

Game.prototype.update = function (dt) {
  this.time += dt;
  this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
  this.lockShake = Math.max(0, this.lockShake - dt * 2.5);
  var c = this.cat, self = this;
  c.bump = Math.max(0, c.bump - dt * 4);
  c.spin = Math.max(0, c.spin - dt * 2.2);
  c.dizzy = Math.max(0, c.dizzy - dt);
  c.invuln = Math.max(0, c.invuln - dt);
  c.wave = Math.max(0, c.wave - dt);
  if (c.emote && (c.emote.t -= dt) <= 0) c.emote = null;

  if (c.moving) {
    c.t += dt * SPEED;
    if (c.t >= 1) {
      c.x = c.tx; c.y = c.ty; c.moving = false; c.t = 0;
      this.arrive();
    }
  }
  if (this.state === 'play' && !c.moving && c.dizzy <= 0) {
    if (this.path.length) {
      var nxt = this.path.shift();
      var d = DIRS.filter(function (dd) { return c.x + dd.dx === nxt.x && c.y + dd.dy === nxt.y; })[0];
      if (d && this.canMove(c.x, c.y, d)) this.startMove(d);
      else { this.path = []; if (d) this.bump(d, c.x, c.y); }
    } else if (this.held) {
      this.stepHeld(false);
    }
  }

  // Кот скучает — подсказывает, что делать дальше.
  if (this.state === 'play' && !c.moving) {
    c.idle += dt;
    if (c.idle > 7) {
      c.idle = 0;
      c.wave = 1.2;
      var left = this.bagels.some(function (b) { return !b.taken && !b.gold; });
      c.emote = { type: this.key && !this.hasKey ? 'key' : left ? 'bagel' : 'door', t: 2.4 };
      this.sound.play('meow');
    }
  }

  // Мышки
  this.mice.forEach(function (m) {
    var last = m.cells.length - 1;
    if (m.pause > 0) m.pause -= dt;
    else {
      m.pos += m.dir * MOUSE_SPEED * dt;
      if (m.pos >= last) { m.pos = last; m.dir = -1; m.pause = 0.6; }
      if (m.pos <= 0) { m.pos = 0; m.dir = 1; m.pause = 0.6; }
    }
    var i = Math.min(Math.floor(m.pos), last - 1), f = m.pos - i, a = m.cells[i], b = m.cells[i + 1];
    m.x = a.x + (b.x - a.x) * f;
    m.y = a.y + (b.y - a.y) * f;
    var fx = (b.x - a.x) * m.dir;
    if (fx) m.facing = fx;
    if (self.state === 'play' && c.invuln <= 0) {
      var cp = self.catPos();
      if (Math.hypot(cp.x - m.x, cp.y - m.y) < 0.55) self.hitByMouse(m);
    }
  });

  if (this.state === 'exiting') {
    c.out += dt * 1.6;
    if (c.out >= 1) this.win();
  }

  this.updateParticles(this.particles, dt);
  this.updateParticles(this.ambient, dt);
  if (this.state === 'won' && this.particles.length < 140 && Math.random() < 0.6) this.spawnConfetti(2);
  this.spawnAmbient(dt);
};

Game.prototype.updateParticles = function (list, dt) {
  for (var i = list.length - 1; i >= 0; i--) {
    var p = list[i];
    p.life -= dt;
    if (p.life <= 0) { list.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += (p.g || 0) * dt;
    if (p.spin) p.rot += p.spin * dt;
    if (p.sway) p.x += Math.sin(p.life * 2 + p.sway) * 12 * dt;
  }
};

Game.prototype.hitByMouse = function (m) {
  var c = this.cat;
  c.dizzy = 1.2;
  c.invuln = 2.6;
  c.emote = null;
  this.path = [];
  if (c.moving) {
    // Отскакиваем назад в клетку, откуда шли.
    var ox = c.x, oy = c.y;
    c.x = c.tx; c.y = c.ty; c.tx = ox; c.ty = oy; c.t = 1 - c.t;
  }
  m.dir *= -1;
  m.pause = 0.4;
  this.combo = 0;
  this.sound.play('oops');
  if (!this.mouseToastShown) { this.mouseToastShown = true; this.toast('Ой! Мышка напугала котика. Обходи её!'); }
};

Game.prototype.arrive = function () {
  var c = this.cat, self = this;
  if (c.x >= this.cols) {
    this.state = 'exiting';
    c.spin = 1;
    this.path = [];
    this.held = null;
    return;
  }
  if (this.key && !this.hasKey && this.key.x === c.x && this.key.y === c.y) {
    this.hasKey = true;
    this.sound.play('key');
    this.textPop(c.x, c.y, 'Ключ!');
    c.spin = 1;
    this.flyToHud(c.x, c.y, 'key', function () { self.ref.keyPill.classList.add('bm-got'); });
  }
  this.bagels.forEach(function (b) {
    if (b.taken || b.x !== c.x || b.y !== c.y) return;
    b.taken = true;
    c.spin = 1;
    self.burst(b.x, b.y, b.gold);
    if (b.gold) {
      self.goldGot++;
      self.sound.play('gold');
      self.textPop(b.x, b.y, '+' + GOLD_VALUE);
      self.flyToHud(b.x, b.y, 'gold', function () { self.bumpHud(); });
      return;
    }
    self.score++;
    self.combo = self.time - self.lastCollect < 4 ? self.combo + 1 : 1;
    self.lastCollect = self.time;
    self.sound.play('collect');
    if (self.combo >= 3) {
      self.textPop(b.x, b.y, 'Супер! ×' + self.combo, true);
      self.sound.play('combo');
      self.spawnConfetti(18);
    } else {
      self.textPop(b.x, b.y, pick(PRAISE));
    }
    self.flyToHud(b.x, b.y, 'bagel', function () {
      self.ref.score.textContent = self.score;
      self.bumpHud();
    });
  });
};

Game.prototype.bumpHud = function () {
  var el = this.ref.scorePill;
  el.classList.remove('bm-bump');
  void el.offsetWidth;
  el.classList.add('bm-bump');
};

// Бублик (или ключ) летит из клетки в счётчик наверху.
Game.prototype.flyToHud = function (gx, gy, kind, done) {
  var target = kind === 'key' ? this.ref.keyPill : this.ref.scoreIco;
  var rr = this.root.getBoundingClientRect(), cr = this.canvas.getBoundingClientRect(), tr = target.getBoundingClientRect();
  var sx = cr.left - rr.left + this.ox + (gx + 0.5) * this.cell;
  var sy = cr.top - rr.top + this.oy + (gy + 0.5) * this.cell;
  var dx = tr.left - rr.left + tr.width / 2 - sx, dy = tr.top - rr.top + tr.height / 2 - sy;
  var el = document.createElement('div');
  el.className = 'bm-fly bm-fly-' + kind;
  el.style.left = sx + 'px';
  el.style.top = sy + 'px';
  var size = Math.round(this.cell * 0.6);
  el.style.width = el.style.height = size + 'px';
  this.root.appendChild(el);
  if (!el.animate) { el.remove(); done(); return; }
  var anim = el.animate([
    { transform: 'translate(-50%, -50%) scale(1)' },
    { transform: 'translate(calc(-50% + ' + dx * 0.25 + 'px), calc(-50% + ' + (dy * 0.25 - 50) + 'px)) scale(1.3)', offset: 0.35 },
    { transform: 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px)) scale(.5)' }
  ], { duration: 700, easing: 'ease-in' });
  anim.onfinish = function () { el.remove(); done(); };
};

Game.prototype.textPop = function (gx, gy, text, big) {
  var s = this.cell;
  this.particles.push({
    kind: 'text', text: text, big: big, x: this.ox + (gx + 0.5) * s, y: this.oy + (gy + 0.1) * s,
    vx: 0, vy: -s * 1.4, life: big ? 1.3 : 0.9, max: big ? 1.3 : 0.9
  });
};

Game.prototype.burst = function (gx, gy, gold) {
  var s = this.cell, x = this.ox + (gx + 0.5) * s, y = this.oy + (gy + 0.5) * s;
  for (var i = 0; i < 12; i++) {
    var a = (i / 12) * Math.PI * 2, v = s * (2 + Math.random() * 2);
    this.particles.push({
      kind: i % 3 === 0 ? 'heart' : 'dot', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - s, g: s * 6,
      life: 0.7, max: 0.7, r: s * 0.07, color: gold ? '#ffd23f' : i % 2 ? '#ffc531' : '#ff2e88'
    });
  }
};

Game.prototype.spawnConfetti = function (n) {
  var colors = ['#ff2e88', '#2ea7f0', '#ffc531', '#7ed957', '#ff8a3d'];
  for (var i = 0; i < n; i++) {
    this.particles.push({
      kind: 'confetti', x: Math.random() * this.cssW, y: -10,
      vx: (Math.random() - 0.5) * 60, vy: 80 + Math.random() * 120, g: 30,
      rot: Math.random() * 6, spin: (Math.random() - 0.5) * 10,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 4,
      life: 4, max: 4, color: pick(colors)
    });
  }
};

// Частицы мира: снег, листья, искорки.
Game.prototype.spawnAmbient = function (dt) {
  var kind = this.world.ambient, W2 = this.cssW, H2 = this.cssH;
  if (this.ambient.length > 30 || Math.random() > dt * (kind === 'snow' ? 9 : 3)) return;
  if (kind === 'snow') {
    this.ambient.push({ kind: 'snow', x: Math.random() * W2, y: -6, vx: -6, vy: 22 + Math.random() * 22, r: 1.5 + Math.random() * 2.5, life: 20, max: 20, sway: Math.random() * 6 });
  } else if (kind === 'leaves') {
    this.ambient.push({ kind: 'leaf', x: Math.random() * W2, y: -8, vx: 10, vy: 18 + Math.random() * 14, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 3,
      r: 4 + Math.random() * 3, life: 20, max: 20, sway: Math.random() * 6, color: pick(['#7ed957', '#f4b63f', '#5cc46a']) });
  } else {
    this.ambient.push({ kind: 'sparkle', x: Math.random() * W2, y: Math.random() * H2, vx: 0, vy: -4, r: 3 + Math.random() * 3, life: 1.6, max: 1.6 });
  }
};

Game.prototype.win = function () {
  this.state = 'won';
  this.sound.play('win');
  var total = this.regularTotal, got = this.score;
  var stars = got === total ? 3 : got >= Math.ceil(total / 2) ? 2 : 1;
  var earned = got + this.goldGot * GOLD_VALUE, save = this.save;
  save.stars[this.levelIndex] = Math.max(save.stars[this.levelIndex] || 0, stars);
  save.wallet += earned;
  // Подарок — один раз, после нужного уровня.
  var giftNow = this.levelIndex + 1 === GIFT.afterLevel && !save.gift;
  if (giftNow) {
    save.gift = { earnedAt: localTime(), claimedAt: null };
    var giftData = this.profileData();
    giftData.level = this.levelIndex + 1;
    sendEvent('gift_earned', giftData);
  }
  storeSave(save);
  this.root.dispatchEvent(new CustomEvent('bublikmaze:win', {
    bubbles: true, detail: { level: this.levelIndex + 1, bagels: got, total: total, stars: stars, gold: this.goldGot }
  }));
  if (giftNow) {
    this.showGift(false);
    return;
  }

  this.ref.stars.querySelectorAll('.bm-star').forEach(function (el, i) { el.classList.toggle('bm-on', i < stars); });
  this.ref.winText.textContent = got === total
    ? 'Все бублики собраны!'
    : 'Бубликов собрано: ' + got + ' из ' + total;
  this.ref.winEarned.innerHTML = '+' + earned + ' <span class="bm-bagel-ico"></span> в копилку' + (this.goldGot ? ' <small>(с золотым!)</small>' : '');
  var last = this.levelIndex + 1 >= LEVELS.length;
  this.ref.winTitle.textContent = last ? 'Все уровни пройдены!' : 'Ура! Выход найден!';
  this.ref.nextBtn.textContent = last ? 'Карта' : 'Дальше';
  this.showScreen('won');
  this.spawnConfetti(40);
};

// ---------- Отрисовка кадра ----------

Game.prototype.render = function () {
  var ctx = this.ctx, s = this.cell, t = this.time, dpr = this.dpr, self = this, i;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  ctx.drawImage(this.layer, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  this.drawDoor(ctx);

  // Бублики и ключ
  var bs = this.bagelSize;
  this.bagels.forEach(function (b) {
    if (b.taken) return;
    var bx = self.ox + (b.x + 0.5) * s, by = self.oy + (b.y + 0.5) * s, bob = Math.sin(t * 3 + b.phase) * s * 0.05;
    if (b.gold) {
      var gl = ctx.createRadialGradient(bx, by, 0, bx, by, s * 0.6);
      gl.addColorStop(0, 'rgba(255, 220, 80, ' + (0.45 + 0.2 * Math.sin(t * 4)) + ')');
      gl.addColorStop(1, 'rgba(255, 220, 80, 0)');
      ctx.fillStyle = gl;
      ctx.fillRect(bx - s * 0.6, by - s * 0.6, s * 1.2, s * 1.2);
    }
    ctx.fillStyle = 'rgba(120, 70, 20, .18)';
    ctx.beginPath();
    ctx.ellipse(bx, by + bs * 0.45, bs * 0.38 - bob, bs * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(b.gold ? self.goldSprite : self.bagelSprite, bx - bs / 2, by - bs / 2 - s * 0.05 + bob, bs, bs);
    if (b.gold && Math.sin(t * 5 + b.phase) > 0.7) drawStar(ctx, bx + bs * 0.35, by - bs * 0.35 + bob, s * 0.08, '#fff');
  });
  if (this.key && !this.hasKey) {
    var kx = this.ox + (this.key.x + 0.5) * s, ky = this.oy + (this.key.y + 0.45) * s + Math.sin(t * 3) * s * 0.05;
    ctx.fillStyle = 'rgba(120, 70, 20, .15)';
    ctx.beginPath(); ctx.ellipse(kx, this.oy + (this.key.y + 0.82) * s, s * 0.22, s * 0.06, 0, 0, Math.PI * 2); ctx.fill();
    drawKey(ctx, kx, ky, s * 0.7, -0.5 + Math.sin(t * 2) * 0.15);
  }

  this.mice.forEach(function (m) {
    drawMouse(ctx, self.ox + (m.x + 0.5) * s, self.oy + (m.y + 0.55) * s, s * 0.85, m.facing, t, m.pause <= 0);
  });

  if (this.fog) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.fogLayer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Подсказка
  if (this.hint && this.hint.until > t) {
    ctx.fillStyle = '#ff2e88';
    ctx.globalAlpha = Math.min(1, this.hint.until - t);
    this.hint.path.forEach(function (p, k) {
      var pulse = 0.5 + 0.5 * Math.sin(t * 8 - k * 0.6);
      ctx.beginPath();
      ctx.arc(self.ox + (p.x + 0.5) * s, self.oy + (p.y + 0.5) * s, s * (0.07 + 0.04 * pulse), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  this.drawCat(ctx);

  // Частицы
  var list = this.particles.concat(this.ambient);
  for (i = 0; i < list.length; i++) {
    var p = list[i], a = Math.min(1, p.life / (p.max * 0.5));
    ctx.globalAlpha = a;
    if (p.kind === 'dot') {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'heart') {
      heartPath(ctx, p.x, p.y, p.r * 3.2);
      ctx.fillStyle = '#ff2e88'; ctx.fill();
    } else if (p.kind === 'text') {
      var fs = Math.round(s * (p.big ? 0.6 : 0.42));
      ctx.font = '900 ' + fs + 'px Nunito, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = s * 0.1;
      ctx.strokeStyle = '#fff';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.big ? '#ff8a00' : '#ff2e88';
      ctx.fillText(p.text, p.x, p.y);
    } else if (p.kind === 'confetti') {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    } else if (p.kind === 'snow') {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === 'leaf') {
      ctx.globalAlpha = 0.8;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (p.kind === 'sparkle') {
      ctx.globalAlpha = Math.sin(Math.PI * p.life / p.max) * 0.8;
      drawStar(ctx, p.x, p.y, p.r, '#ffd86b');
    }
  }
  ctx.globalAlpha = 1;

  if (this.state === 'wardrobe') this.drawPreview();
};

Game.prototype.drawDoor = function (ctx) {
  var s = this.cell, t = this.time;
  var ex = this.ox + this.cols * s, ey = this.oy + this.exit.y * s;
  var dw = s * 0.62, dh = s * 0.9, dx = ex + s * 0.18, dy = ey + (s - dh) / 2;
  var locked = this.key && !this.hasKey;
  var shake = Math.sin(this.lockShake * 30) * this.lockShake * s * 0.05;

  if (!locked) {
    var glow = ctx.createRadialGradient(dx + dw / 2, dy + dh / 2, 0, dx + dw / 2, dy + dh / 2, s);
    glow.addColorStop(0, 'rgba(255, 214, 64, ' + (0.45 + 0.15 * Math.sin(t * 3)) + ')');
    glow.addColorStop(1, 'rgba(255, 214, 64, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(ex - s * 0.5, ey - s * 0.6, s * 1.6, s * 2.2);
  }
  ctx.fillStyle = locked ? '#b06a9a' : '#ff2e88';
  roundRect(ctx, dx - s * 0.07 + shake, dy - s * 0.07, dw + s * 0.14, dh + s * 0.1, dw * 0.45);
  ctx.fill();
  var dg = ctx.createLinearGradient(0, dy, 0, dy + dh);
  dg.addColorStop(0, locked ? '#c9b8d6' : '#fffbe0');
  dg.addColorStop(1, locked ? '#9f8db3' : '#ffe27a');
  ctx.fillStyle = dg;
  roundRect(ctx, dx + shake, dy, dw, dh, dw * 0.4);
  ctx.fill();
  if (locked) drawPadlock(ctx, dx + dw / 2 + shake, dy + dh * 0.45, s * 0.5);
  else drawStar(ctx, dx + dw / 2, dy - s * 0.2, s * (0.15 + 0.02 * Math.sin(t * 4)), '#ffc531');

  // Стрелка в клетке выхода
  if (!locked) {
    var ax = this.ox + (this.exit.x + 0.5) * s, ay = ey + s / 2;
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 4);
    ctx.fillStyle = '#ff2e88';
    ctx.translate(ax + s * 0.1 + Math.sin(t * 4) * s * 0.05, ay);
    ctx.beginPath();
    ctx.moveTo(s * 0.18, 0); ctx.lineTo(-s * 0.1, -s * 0.2); ctx.lineTo(-s * 0.1, s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
};

Game.prototype.drawCat = function (ctx) {
  var c = this.cat, s = this.cell, t = this.time, self = this;
  var k = c.moving ? c.t : 0;
  var pos = this.catPos();
  var cx = this.ox + (pos.x + 0.5) * s, footY = this.oy + (pos.y + 0.5) * s + s * 0.36;
  if (c.bump > 0 && c.bumpDir) {
    var sh = Math.sin(c.bump * Math.PI) * s * 0.08;
    cx += c.bumpDir.dx * sh; footY += c.bumpDir.dy * sh;
  }
  var hop = c.moving ? Math.sin(k * Math.PI) * s * 0.16 : 0;
  hop += Math.sin(c.spin * Math.PI) * s * 0.3;
  var breathe = c.moving ? 1 : 1 + Math.sin(t * 3) * 0.02;
  var alpha = 1, scale = 1, rot = c.moving ? Math.sin(k * Math.PI * 2) * 0.08 : 0;
  if (c.dizzy > 0) rot = Math.sin(t * 12) * 0.12;
  if (c.wave > 0) rot += Math.sin(t * 14) * 0.1 * Math.min(1, c.wave);
  if (c.invuln > 0 && c.dizzy <= 0 && Math.sin(t * 30) > 0) alpha = 0.45;
  if (this.state === 'exiting' || this.state === 'won') {
    var o = Math.min(1, c.out);
    cx += o * s * 0.3; alpha = 1 - o; scale = 1 - o * 0.4;
  }
  if (alpha <= 0) return;

  var h = s * 1.3 * scale, img = this.catImg;
  var w = img.naturalWidth ? h * img.naturalWidth / img.naturalHeight : h * 0.63;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(40, 30, 80, .2)';
  ctx.beginPath();
  ctx.ellipse(cx, footY, w * 0.42 * Math.max(0.5, 1 - hop / s), s * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(cx, footY - hop);
  var flip = (c.facing < 0 ? -1 : 1) * (c.spin > 0 ? Math.cos(c.spin * Math.PI * 2) : 1);
  ctx.scale(flip, 1);
  ctx.rotate(rot);
  ctx.scale(1 / breathe, breathe);
  drawCatFigure(ctx, img, h, this.save.wear, t);
  ctx.restore();

  // Эмоции поверх, без отражения
  var headX = cx, headY = footY - hop - h * 0.85;
  if (c.dizzy > 0) {
    for (var i = 0; i < 3; i++) {
      var a = t * 6 + i * Math.PI * 2 / 3;
      drawStar(ctx, headX + Math.cos(a) * w * 0.4, headY - s * 0.05 + Math.sin(a) * s * 0.1, s * 0.09, '#ffc531');
    }
  }
  if (c.emote) {
    var e = c.emote, ea = Math.min(1, e.t * 3);
    ctx.save();
    ctx.globalAlpha = ea;
    if (e.type === 'sweat') {
      ctx.fillStyle = '#5ec8ff';
      var sx = headX + w * 0.35, sy = headY + s * 0.1 + (1 - e.t) * s * 0.1;
      ctx.beginPath();
      ctx.moveTo(sx, sy - s * 0.12);
      ctx.quadraticCurveTo(sx + s * 0.08, sy, sx, sy + s * 0.04);
      ctx.quadraticCurveTo(sx - s * 0.08, sy, sx, sy - s * 0.12);
      ctx.fill();
    } else {
      var bx = headX + w * 0.55 + s * 0.2, by = headY + s * 0.05;
      drawBubble(ctx, bx, by, s * 0.75, function (ix, iy, isz) {
        if (e.type === 'key') drawKey(ctx, ix, iy, isz * 1.1, -0.5);
        else if (e.type === 'bagel') ctx.drawImage(self.bagelSprite, ix - isz / 2, iy - isz / 2, isz, isz);
        else drawStar(ctx, ix, iy, isz * 0.5, '#ffc531');
      });
    }
    ctx.restore();
  }
};

function boot() {
  document.querySelectorAll('[data-bublik-maze]').forEach(function (el) {
    if (el.__bublikMaze) return;
    el.__bublikMaze = new Game(el);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
