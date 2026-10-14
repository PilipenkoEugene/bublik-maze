// Собирает игру в самодостаточные файлы (CSS, JS и картинка кота — внутри).
//   dist/index.html        — отдельная страница (для хостинга и iframe)
//   dist/tilda-block.html  — фрагмент для вставки в блок T123 «HTML-код» в Тильде
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const here = (p) => new URL(p, import.meta.url);
const css = readFileSync(here('./src/style.css'), 'utf8');
const markup = readFileSync(here('./src/markup.html'), 'utf8');
const cat = 'data:image/webp;base64,' + readFileSync(here('./assets/cat.webp')).toString('base64');
// Модули склеиваются по порядку в одну изолированную функцию — ничего не попадает в глобальную область страницы.
const modules = ['config', 'net', 'audio', 'draw', 'game']
  .map((m) => readFileSync(here(`./src/${m}.js`), 'utf8'))
  .join('\n');
// Адрес приёмника анкет можно задать при сборке: SUBMIT_URL=https://... node build.mjs
const submitUrl = process.env.SUBMIT_URL || '';
const js = `(function () {\n'use strict';\n${modules
  .replace('__CAT_SRC__', cat)
  .replace("submitUrl: ''", `submitUrl: ${JSON.stringify(submitUrl)}`)}})();\n`;

const font = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap">';
const block = `<!-- Бублики в лабиринте -->
${font}
<style>
${css}</style>
${markup}<script>
${js}</script>
`;

const page = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Бублики в лабиринте</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%A5%AF%3C/text%3E%3C/svg%3E">
<style>
html,body{margin:0;background:#fff3ea;overscroll-behavior:none;}
body{padding:16px 12px;}
/* На телефоне игра занимает весь экран, без белых полей вокруг. */
@media (max-width:600px){
  html,body{background:#fff3ea;}
  body{padding:0;}
  .bm-root{border-radius:0;min-height:100vh;min-height:100dvh;}
}
</style>
</head>
<body>
${block}</body>
</html>
`;

mkdirSync(here('./dist/'), { recursive: true });
writeFileSync(here('./dist/tilda-block.html'), block);
writeFileSync(here('./dist/index.html'), page);
console.log('ok:', (Buffer.byteLength(page) / 1024).toFixed(1) + ' KB', submitUrl ? 'анкеты → ' + submitUrl : '(демо-режим: адрес приёмника не задан)');
