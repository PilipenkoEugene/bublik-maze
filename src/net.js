// ---------- Отправка анкет и событий ----------

var QUEUE_KEY = 'bublikMaze.queue';

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch (e) { return []; }
}

function writeQueue(q) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) { /* нет доступа */ }
}

function utmParams() {
  var out = {};
  try {
    new URLSearchParams(location.search).forEach(function (v, k) { if (k.indexOf('utm_') === 0) out[k] = v; });
  } catch (e) { /* старый браузер */ }
  return out;
}

function localTime() {
  var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

function postOne(item) {
  // text/plain без лишних заголовков — запрос уходит без CORS-предзапроса (так принимает Google Apps Script).
  var req = fetch(FORM.submitUrl, {
    method: 'POST', mode: 'no-cors', keepalive: true,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(item)
  });
  var timeout = new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, 6000); });
  return Promise.race([req, timeout]);
}

// Отправляет всё, что накопилось. Не отправленное (нет сети) остаётся в очереди до следующего раза.
function flushQueue() {
  var q = readQueue();
  if (!q.length || !FORM.submitUrl || !window.fetch) return Promise.resolve();
  return Promise.all(q.map(function (item) {
    return postOne(item).then(function () { return null; }, function () { return item; });
  })).then(function (left) {
    // За время отправки могли добавиться новые события — сохраняем и их.
    var sent = q.filter(function (item, i) { return !left[i]; }).map(function (item) { return item.uid; });
    writeQueue(readQueue().filter(function (item) { return sent.indexOf(item.uid) < 0; }));
  });
}

function sendEvent(type, data) {
  var item = { event: type, created_at: localTime(), page: location.href.split('#')[0] };
  for (var k in data) item[k] = data[k];
  var utm = utmParams();
  for (k in utm) item[k] = utm[k];
  if (!FORM.submitUrl) {
    console.info('[Бублики в лабиринте] демо-режим, FORM.submitUrl не задан. Данные не отправлены:', item);
    return Promise.resolve();
  }
  item.uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  var q = readQueue();
  q.push(item);
  writeQueue(q);
  return flushQueue();
}

// Дата рождения в виде ДД.ММ.ГГГГ; точки ставятся сами, «5» в начале дня или «2» в начале месяца дополняются нулём.
function formatDate(raw) {
  var d = raw.replace(/\D/g, '');
  if (/^[4-9]/.test(d)) d = '0' + d;
  if (/^\d\d[2-9]/.test(d)) d = d.slice(0, 2) + '0' + d.slice(2);
  d = d.slice(0, 8);
  if (d.length < 2) return d;
  if (d.length < 4) return d.slice(0, 2) + '.' + d.slice(2);
  return d.slice(0, 2) + '.' + d.slice(2, 4) + '.' + d.slice(4);
}

// Возраст в полных годах по дате ДД.ММ.ГГГГ; null — если даты не существует.
function ageFromDate(s) {
  var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (!m) return null;
  var day = +m[1], mon = +m[2], year = +m[3], b = new Date(year, mon - 1, day), now = new Date();
  if (b.getFullYear() !== year || b.getMonth() !== mon - 1 || b.getDate() !== day) return null;
  var age = now.getFullYear() - year;
  if (now.getMonth() < mon - 1 || (now.getMonth() === mon - 1 && now.getDate() < day)) age--;
  return b > now ? -1 : age;
}

function yearsWord(a) {
  return a % 10 >= 2 && a % 10 <= 4 && (a % 100 < 12 || a % 100 > 14) ? 'года' : a % 10 === 1 && a % 100 !== 11 ? 'год' : 'лет';
}

function randomCode() {
  var letters = 'АБВГДЕКМНПРСТ', s = '';
  for (var i = 0; i < 2; i++) s += letters[(Math.random() * letters.length) | 0];
  return s + '-' + String(1000 + ((Math.random() * 9000) | 0));
}

// Телефон всегда в виде +7 (XXX) XXX-XX-XX. Начать можно с 8, 7, +7 или сразу с 9.
function formatPhone(raw) {
  // После подставленного «+7 » по привычке набрали 8 или 7 — это код страны, не часть номера.
  if (/^\+7\s?[78]$/.test(raw)) return '+7 ';
  var d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (d[0] === '8' || d[0] === '7') d = d.slice(1);
  d = d.slice(0, 10);
  if (!d) return '+7 ';
  var out = '+7 (' + d.slice(0, 3);
  if (d.length >= 3) out += ') ' + d.slice(3, 6);
  if (d.length >= 6) out += '-' + d.slice(6, 8);
  if (d.length >= 8) out += '-' + d.slice(8, 10);
  return out;
}
