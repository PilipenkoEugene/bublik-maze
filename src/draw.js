// ---------- Рисование ----------

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.beginPath();
  for (var i = 0; i < 10; i++) {
    var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function heartPath(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.35);
  ctx.bezierCurveTo(cx - s * 0.6, cy - s * 0.05, cx - s * 0.35, cy - s * 0.55, cx, cy - s * 0.2);
  ctx.bezierCurveTo(cx + s * 0.35, cy - s * 0.55, cx + s * 0.6, cy - s * 0.05, cx, cy + s * 0.35);
  ctx.closePath();
}

// Бублик рисуется один раз в отдельный canvas нужного размера.
function makeBagelSprite(size, dpr, gold) {
  var c = document.createElement('canvas');
  c.width = Math.ceil(size * dpr); c.height = Math.ceil(size * dpr);
  var ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  var r = size / 2, cx = r, cy = r, hole = r * 0.34;
  var pal = gold
    ? ['#fff3a8', '#ffcb2e', '#c98a00', 'rgba(150, 90, 0, .55)', '#fffbe0']
    : ['#f7c978', '#e19a43', '#a95a17', 'rgba(120, 60, 10, .55)', '#fff8e8'];

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.96, 0, Math.PI * 2);
  ctx.arc(cx, cy, hole, 0, Math.PI * 2, true);
  var g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, pal[0]);
  g.addColorStop(0.55, pal[1]);
  g.addColorStop(1, pal[2]);
  ctx.fillStyle = g;
  ctx.fill('evenodd');

  ctx.beginPath();
  ctx.arc(cx, cy, hole, 0, Math.PI * 2);
  ctx.lineWidth = r * 0.08;
  ctx.strokeStyle = pal[3];
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.66, Math.PI * 1.1, Math.PI * 1.6);
  ctx.lineWidth = r * 0.14;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 245, 210, .7)';
  ctx.stroke();

  ctx.fillStyle = pal[4];
  for (var i = 0; i < 9; i++) {
    var a = i * 0.7 + 0.3, rr = r * (i % 2 ? 0.58 : 0.78);
    ctx.save();
    ctx.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    ctx.rotate(a + 1);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.09, r * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return c;
}

function drawKey(ctx, cx, cy, s, rot) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot || -0.6);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#b37400';
  ctx.fillStyle = '#ffc531';
  ctx.lineWidth = s * 0.07;
  // Ручка
  ctx.beginPath();
  ctx.arc(-s * 0.25, 0, s * 0.2, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath(); ctx.arc(-s * 0.25, 0, s * 0.08, 0, Math.PI * 2); ctx.fill();
  // Стержень и бородка
  ctx.fillStyle = '#ffc531';
  ctx.beginPath();
  ctx.rect(-s * 0.06, -s * 0.06, s * 0.5, s * 0.12);
  ctx.rect(s * 0.28, 0, s * 0.08, s * 0.16);
  ctx.rect(s * 0.38, 0, s * 0.07, s * 0.12);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawPadlock(ctx, cx, cy, s) {
  ctx.save();
  ctx.lineWidth = s * 0.13;
  ctx.strokeStyle = '#8a8fa3';
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.1, s * 0.22, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#ffb21e';
  roundRect(ctx, cx - s * 0.35, cy - s * 0.1, s * 0.7, s * 0.55, s * 0.1);
  ctx.fill();
  ctx.fillStyle = '#8a4d00';
  ctx.beginPath(); ctx.arc(cx, cy + s * 0.1, s * 0.08, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(cx - s * 0.03, cy + s * 0.1, s * 0.06, s * 0.17);
  ctx.restore();
}

// Мышка-вредина. facing: 1 — смотрит вправо.
function drawMouse(ctx, cx, cy, s, facing, t, moving) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(facing < 0 ? -1 : 1, 1);
  var bob = moving ? Math.abs(Math.sin(t * 14)) * s * 0.04 : 0;
  ctx.fillStyle = 'rgba(40, 30, 80, .18)';
  ctx.beginPath(); ctx.ellipse(0, s * 0.28, s * 0.3, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(0, -bob);
  // Хвост
  ctx.strokeStyle = '#e88aa8';
  ctx.lineWidth = s * 0.05;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.28, s * 0.12);
  ctx.quadraticCurveTo(-s * 0.55, s * 0.05 + Math.sin(t * 6) * s * 0.08, -s * 0.45, -s * 0.2);
  ctx.stroke();
  // Тело
  var g = ctx.createRadialGradient(-s * 0.05, -s * 0.05, s * 0.05, 0, 0, s * 0.4);
  g.addColorStop(0, '#c6c9d6');
  g.addColorStop(1, '#8b8fa3');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, s * 0.08, s * 0.32, s * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  // Голова
  ctx.beginPath(); ctx.ellipse(s * 0.24, -s * 0.02, s * 0.18, s * 0.15, -0.2, 0, Math.PI * 2); ctx.fill();
  // Уши
  [[s * 0.14, -s * 0.18], [s * 0.3, -s * 0.2]].forEach(function (p) {
    ctx.fillStyle = '#8b8fa3';
    ctx.beginPath(); ctx.arc(p[0], p[1], s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffb3c9';
    ctx.beginPath(); ctx.arc(p[0], p[1], s * 0.06, 0, Math.PI * 2); ctx.fill();
  });
  // Глаз, нос
  ctx.fillStyle = '#1d1630';
  ctx.beginPath(); ctx.arc(s * 0.28, -s * 0.05, s * 0.035, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff5c8a';
  ctx.beginPath(); ctx.arc(s * 0.41, 0, s * 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Вещи из гардероба. (cx, cy) — центр вещи, size — размер в пикселях.
function drawItem(ctx, id, cx, cy, size, t, stringFrom) {
  var s = size;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (id === 'crown') {
    var w = s, h = s * 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy - h * 0.25);
    ctx.lineTo(cx - w / 4, cy + h * 0.08);
    ctx.lineTo(cx, cy - h / 2);
    ctx.lineTo(cx + w / 4, cy + h * 0.08);
    ctx.lineTo(cx + w / 2, cy - h * 0.25);
    ctx.lineTo(cx + w / 2, cy + h / 2);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
    g.addColorStop(0, '#fff2a0'); g.addColorStop(1, '#f0a800');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = s * 0.06; ctx.strokeStyle = '#b87800'; ctx.stroke();
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath(); ctx.arc(cx, cy + h * 0.22, s * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2ea7f0';
    ctx.beginPath(); ctx.arc(cx - w * 0.3, cy + h * 0.25, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + w * 0.3, cy + h * 0.25, s * 0.06, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'bow') {
    ctx.fillStyle = '#ffd400';
    ctx.strokeStyle = '#e09a00';
    ctx.lineWidth = s * 0.06;
    [-1, 1].forEach(function (k) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.bezierCurveTo(cx + k * s * 0.6, cy - s * 0.5, cx + k * s * 0.65, cy + s * 0.45, cx, cy);
      ctx.fill(); ctx.stroke();
    });
    ctx.fillStyle = '#ffb000';
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (id === 'flower') {
    ctx.fillStyle = '#ffffff';
    for (var i = 0; i < 5; i++) {
      var a = i * Math.PI * 2 / 5 + 0.3;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * s * 0.28, cy + Math.sin(a) * s * 0.28, s * 0.22, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255, 46, 136, .5)'; ctx.lineWidth = s * 0.04;
    for (i = 0; i < 5; i++) {
      a = i * Math.PI * 2 / 5 + 0.3;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * s * 0.28, cy + Math.sin(a) * s * 0.28, s * 0.22, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = '#ffc531';
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.17, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'halo') {
    for (i = 0; i < 3; i++) {
      var aa = (t || 0) * 2 + i * Math.PI * 2 / 3;
      drawStar(ctx, cx + Math.cos(aa) * s * 0.55, cy + Math.sin(aa) * s * 0.18, s * (0.2 + 0.05 * Math.sin(aa)), i === 1 ? '#ff7ab8' : '#ffc531');
    }
  } else if (id === 'glasses') {
    ctx.lineWidth = s * 0.05;
    ctx.strokeStyle = '#c4005a';
    ctx.beginPath(); ctx.moveTo(cx - s * 0.08, cy - s * 0.04); ctx.quadraticCurveTo(cx, cy - s * 0.12, cx + s * 0.08, cy - s * 0.04); ctx.stroke();
    [-1, 1].forEach(function (k) {
      heartPath(ctx, cx + k * s * 0.27, cy, s * 0.5);
      ctx.fillStyle = 'rgba(255, 46, 136, .82)'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, .7)';
      ctx.beginPath(); ctx.ellipse(cx + k * s * 0.27 - s * 0.09, cy - s * 0.07, s * 0.05, s * 0.03, -0.6, 0, Math.PI * 2); ctx.fill();
    });
  } else if (id === 'balloon') {
    var by = cy + Math.sin((t || 0) * 2) * s * 0.06;
    if (stringFrom) {
      ctx.strokeStyle = '#7a6a8c'; ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath(); ctx.moveTo(cx, by + s * 0.58);
      ctx.quadraticCurveTo(cx + s * 0.2, (by + stringFrom[1]) / 2, stringFrom[0], stringFrom[1]); ctx.stroke();
    }
    var bg = ctx.createRadialGradient(cx - s * 0.15, by - s * 0.18, s * 0.05, cx, by, s * 0.5);
    bg.addColorStop(0, '#ff9ccb'); bg.addColorStop(1, '#e8146f');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(cx, by, s * 0.4, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, by + s * 0.46); ctx.lineTo(cx - s * 0.07, by + s * 0.58); ctx.lineTo(cx + s * 0.07, by + s * 0.58); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, .55)';
    ctx.beginPath(); ctx.ellipse(cx - s * 0.15, by - s * 0.2, s * 0.08, s * 0.13, -0.5, 0, Math.PI * 2); ctx.fill();
  } else if (id === 'cape') {
    var wave = Math.sin((t || 0) * 4) * s * 0.05;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.25, cy - s * 0.55);
    ctx.lineTo(cx + s * 0.25, cy - s * 0.55);
    ctx.quadraticCurveTo(cx + s * 0.55, cy, cx + s * 0.62 + wave, cy + s * 0.6);
    ctx.quadraticCurveTo(cx + s * 0.3, cy + s * 0.5 - wave, cx, cy + s * 0.62);
    ctx.quadraticCurveTo(cx - s * 0.3, cy + s * 0.5 + wave, cx - s * 0.62 - wave, cy + s * 0.6);
    ctx.quadraticCurveTo(cx - s * 0.55, cy, cx - s * 0.25, cy - s * 0.55);
    ctx.closePath();
    var cg = ctx.createLinearGradient(cx - s * 0.6, 0, cx + s * 0.6, 0);
    cg.addColorStop(0, '#a3122f'); cg.addColorStop(0.5, '#ee2c55'); cg.addColorStop(1, '#a3122f');
    ctx.fillStyle = cg; ctx.fill();
    drawStar(ctx, cx, cy + s * 0.15, s * 0.18, '#ffc531');
  }
  ctx.restore();
}

// Кот со всеми надетыми вещами. Начало координат — точка между ног, рисует вверх.
function drawCatFigure(ctx, img, h, wear, t) {
  var w = img.naturalWidth ? h * img.naturalWidth / img.naturalHeight : h * 0.63;
  var x0 = -w / 2, y0 = -h;
  function at(id) { var a = ANCHORS[id]; return [x0 + a[0] * w, y0 + a[1] * h, a[2] * h]; }
  var p;
  if (wear.extra === 'cape') { p = at('cape'); drawItem(ctx, 'cape', p[0], p[1], p[2], t); }
  if (img.complete && img.naturalWidth) ctx.drawImage(img, x0, y0, w, h);
  else { ctx.fillStyle = '#f28c28'; ctx.beginPath(); ctx.arc(0, -h / 2, w / 2, 0, Math.PI * 2); ctx.fill(); }
  if (wear.face) { p = at(wear.face); drawItem(ctx, wear.face, p[0], p[1], p[2], t); }
  if (wear.head) { p = at(wear.head); drawItem(ctx, wear.head, p[0], p[1], p[2], t); }
  if (wear.extra === 'balloon') {
    p = at('balloon');
    drawItem(ctx, 'balloon', p[0], p[1], p[2], t, [x0 + FIST[0] * w, y0 + FIST[1] * h]);
  }
  return w;
}

// Облачко над головой с иконкой внутри.
function drawBubble(ctx, x, y, s, icon) {
  ctx.save();
  ctx.shadowColor = 'rgba(40, 30, 80, .2)';
  ctx.shadowBlur = s * 0.15;
  ctx.fillStyle = '#fff';
  roundRect(ctx, x - s * 0.42, y - s * 0.38, s * 0.84, s * 0.68, s * 0.3);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.22, y + s * 0.22); ctx.lineTo(x - s * 0.4, y + s * 0.5); ctx.lineTo(x - s * 0.02, y + s * 0.26);
  ctx.fill();
  ctx.restore();
  icon(x, y - s * 0.04, s * 0.5);
}
