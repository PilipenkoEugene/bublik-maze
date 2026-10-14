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

function randomCode() {
  var letters = 'АБВГДЕКМНПРСТ', s = '';
  for (var i = 0; i < 2; i++) s += letters[(Math.random() * letters.length) | 0];
  return s + '-' + String(1000 + ((Math.random() * 9000) | 0));
}

function formatPhone(raw) {
  var d = raw.replace(/\D/g, '');
  if (d[0] === '8' || d[0] === '7') d = d.slice(1);
  d = d.slice(0, 10);
  if (!d) return '';
  var out = '+7 (' + d.slice(0, 3);
  if (d.length >= 3) out += ') ' + d.slice(3, 6);
  if (d.length >= 6) out += '-' + d.slice(6, 8);
  if (d.length >= 8) out += '-' + d.slice(8, 10);
  return out;
}
