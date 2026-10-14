// ---------- Настройки игры ----------

// Заменяется при сборке на data:URI картинки кота.
var CAT_SRC = '__CAT_SRC__';

var SPEED = 5.5;          // скорость кота, клеток в секунду
var MOUSE_SPEED = 1.7;    // скорость мышки
var HINT_SECONDS = 3;
var GOLD_VALUE = 5;       // сколько бубликов в копилку даёт золотой
var SAVE_KEY = 'bublikMaze.v1';

// Анкета перед игрой.
var FORM = {
  // Куда отправлять анкеты и события (POST, JSON). Пусто — демо-режим: данные только пишутся в консоль.
  // Готовый приёмник в Google Таблицу — см. README.
  submitUrl: '',
  // Ссылка на политику обработки персональных данных (показывается рядом с галочкой согласия).
  privacyUrl: '',
  maxChildAge: 17   // дата рождения старше этого возраста считается опечаткой
};

// Подарок за прохождение уровней.
var GIFT = {
  afterLevel: 5,
  title: '5 уровней пройдено!',   // имя ребёнка подставится в заголовок «Маша, ты молодец!»
  text: 'Подойди к нашей стойке и покажи этот экран — тебя ждёт подарок!',
  holdSeconds: 2   // сколько сотруднику удерживать кнопку «Подарок выдан»
};

// Миры: палитра, частицы в воздухе и музыка.
// melody — 32 восьмые (MIDI-ноты, 0 — пауза), bass — по одной ноте на такт.
var WORLDS = [
  {
    name: 'Пекарня', emoji: '🥯',
    bg: ['#fff1dc', '#ffe0ee'],
    floor: '#fff6e5', floorAlt: '#fdecd0', decor: 'rgba(214, 150, 80, .35)',
    wall: '#2ea7f0', wallShadow: '#1676c2', wallTop: '#9fdcff', wallStyle: 'gloss',
    fog: '#f1dcc2', ambient: 'sparkle',
    music: {
      tempo: 116, wave: 'triangle',
      melody: [72, 0, 76, 79, 76, 0, 72, 74, 76, 0, 74, 72, 69, 0, 72, 0, 72, 0, 76, 79, 81, 0, 79, 76, 74, 0, 76, 74, 72, 0, 0, 0],
      bass: [48, 45, 53, 55]
    }
  },
  {
    name: 'Парк', emoji: '🌳',
    bg: ['#dff6ff', '#e6ffd9'],
    floor: '#effbe3', floorAlt: '#e1f4cd', decor: 'rgba(60, 160, 70, .4)',
    wall: '#3bb85a', wallShadow: '#23803c', wallTop: '#86e08f', wallStyle: 'leafy',
    fog: '#d6ecd0', ambient: 'leaves',
    music: {
      tempo: 124, wave: 'square',
      melody: [67, 0, 71, 74, 71, 0, 67, 0, 69, 0, 72, 76, 74, 0, 72, 0, 71, 0, 74, 79, 76, 0, 74, 71, 72, 0, 71, 69, 67, 0, 0, 0],
      bass: [43, 45, 40, 48]
    }
  },
  {
    name: 'Зима', emoji: '❄️',
    bg: ['#e2efff', '#f0e8ff'],
    floor: '#f6fbff', floorAlt: '#e8f3fb', decor: 'rgba(120, 180, 230, .45)',
    wall: '#4fa7e3', wallShadow: '#2a6fa8', wallTop: '#ffffff', wallStyle: 'snow',
    fog: '#dfe9f5', ambient: 'snow',
    music: {
      tempo: 100, wave: 'sine',
      melody: [76, 0, 72, 0, 74, 76, 0, 0, 77, 0, 76, 74, 72, 0, 0, 0, 74, 0, 71, 0, 72, 74, 0, 0, 76, 0, 74, 72, 69, 0, 0, 0],
      bass: [48, 53, 55, 45]
    }
  }
];

// Уровни: w — мир, size — размер поля, loops — доля лишних проходов (чем больше, тем проще),
// gold — золотой бублик, key — дверь закрыта на ключ, mice — сколько мышек, fog — туман.
// intro — подсказка при первом запуске уровня.
var LEVELS = [
  { w: 0, size: 5, bagels: 3, loops: 0.15, intro: 'Собери бублики и найди дверь!' },
  { w: 0, size: 6, bagels: 4, loops: 0.12 },
  { w: 0, size: 6, bagels: 4, loops: 0.12, gold: true, intro: 'Золотой бублик — это сразу 5 бубликов в копилку!' },
  { w: 0, size: 7, bagels: 4, loops: 0.1, key: true, intro: 'Дверь закрыта! Сначала найди ключ.' },
  { w: 0, size: 7, bagels: 5, loops: 0.1, key: true, gold: true },
  { w: 0, size: 8, bagels: 5, loops: 0.1, mice: 1, intro: 'Осторожно, мышка! Обходи её стороной.' },
  { w: 1, size: 7, bagels: 5, loops: 0.1, mice: 1, intro: 'Новый мир — Парк!' },
  { w: 1, size: 8, bagels: 5, loops: 0.09, key: true, mice: 1 },
  { w: 1, size: 8, bagels: 6, loops: 0.09, gold: true, mice: 2 },
  { w: 1, size: 9, bagels: 6, loops: 0.08, key: true, mice: 2 },
  { w: 1, size: 8, bagels: 5, loops: 0.1, fog: true, intro: 'Туман! Иди вперёд — и он рассеется.' },
  { w: 1, size: 9, bagels: 6, loops: 0.08, key: true, gold: true, mice: 2 },
  { w: 2, size: 7, bagels: 5, loops: 0.1, fog: true, intro: 'Новый мир — Зима!' },
  { w: 2, size: 8, bagels: 5, loops: 0.09, fog: true, key: true },
  { w: 2, size: 8, bagels: 6, loops: 0.09, fog: true, mice: 1 },
  { w: 2, size: 9, bagels: 6, loops: 0.08, fog: true, key: true, mice: 1, gold: true },
  { w: 2, size: 9, bagels: 7, loops: 0.08, fog: true, gold: true, mice: 2 },
  { w: 2, size: 10, bagels: 8, loops: 0.07, fog: true, key: true, mice: 2, gold: true }
];

// Гардероб. slot: head — на голову, face — на лицо, extra — шарик/плащ (по одной вещи на слот).
var ITEMS = [
  { id: 'flower', slot: 'head', name: 'Цветочек', price: 8 },
  { id: 'balloon', slot: 'extra', name: 'Шарик', price: 12 },
  { id: 'bow', slot: 'head', name: 'Бантик', price: 15 },
  { id: 'glasses', slot: 'face', name: 'Очки-сердечки', price: 20 },
  { id: 'crown', slot: 'head', name: 'Корона', price: 30 },
  { id: 'cape', slot: 'extra', name: 'Плащ героя', price: 40 },
  { id: 'halo', slot: 'head', name: 'Звёздочки', price: 50 }
];

// Где на картинке кота крепятся вещи: [x, y] — доли ширины/высоты спрайта, s — размер в долях высоты.
var ANCHORS = {
  crown: [0.6, 0.04, 0.18], bow: [0.3, 0.15, 0.15], flower: [0.8, 0.11, 0.13],
  halo: [0.6, -0.03, 0.2], glasses: [0.575, 0.31, 0.29],
  balloon: [0.02, -0.16, 0.17], cape: [0.57, 0.68, 0.36]
};
var FIST = [0.1, 0.22];

var PRAISE = ['Ням!', 'Вкусно!', 'Ура!', 'Класс!', 'Ещё!'];

var N = 1, E = 2, S = 4, W = 8;
var DIRS = [
  { b: N, dx: 0, dy: -1, o: S },
  { b: E, dx: 1, dy: 0, o: W },
  { b: S, dx: 0, dy: 1, o: N },
  { b: W, dx: -1, dy: 0, o: E }
];
var DIR_BY_NAME = { up: DIRS[0], right: DIRS[1], down: DIRS[2], left: DIRS[3] };
var KEY_DIRS = {
  ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left',
  KeyW: 'up', KeyD: 'right', KeyS: 'down', KeyA: 'left'
};
