#!/usr/bin/env node
// cross_promo/apps.json を唯一のデータ元として、次の2つを更新する。
//
//   1. apps.json の iconUrl … images/apps/<id>.png があれば自前ホストのURLにする
//      （App Store のアイコンに頼らないので、Android だけで出すアプリにもアイコンが付く）
//   2. index.html のアプリ一覧 … 目印の間だけを作り直す
//        <!-- APP_CATALOG:BEGIN --> … <!-- APP_CATALOG:END -->
//      目印の外（手書きのアプリカード）には一切触れない。目印が見つからなければ
//      ページは書き換えずに警告だけ出す（ページ構造を変えても壊れないように）。
//
// ストアのバッジは apps.json の値だけで出し分ける:
//   appStoreId が数字 … App Store バッジを出す（iOS で公開中）
//   androidPackage あり … Google Play バッジを出す
// 手書きカードがあるアプリ（ストアのURLが目印の外に既にあるもの）は自動生成から除く。
//
// 使い方: node tools/build_app_catalog.mjs
// 新アプリの登録はアプリ側の tools/register_cross_promo.mjs から呼ばれる。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = join(root, 'cross_promo', 'apps.json');
const htmlPath = join(root, 'index.html');
const SITE = 'https://hajimeapplab.com';
const BEGIN = '<!-- APP_CATALOG:BEGIN -->';
const END = '<!-- APP_CATALOG:END -->';

const isIosId = (v) => /^[1-9][0-9]*$/.test(v ?? '');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- 1. apps.json: アイコンを自前ホストに ----
const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
let hosted = 0;
for (const app of data.apps) {
  if (existsSync(join(root, 'images', 'apps', `${app.id}.png`))) {
    app.iconUrl = `${SITE}/images/apps/${app.id}.png`;
    hosted++;
  }
}
data.updated = new Date().toISOString().slice(0, 10);
writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
console.log(`apps.json: ${data.apps.length}件（自前ホストのアイコン ${hosted}件）`);

// ---- 2. index.html: 目印の間を作り直す ----
const html = readFileSync(htmlPath, 'utf8');
const b = html.indexOf(BEGIN);
const e = html.indexOf(END);
if (b < 0 || e < 0 || e < b) {
  console.warn(`WARN: index.html に ${BEGIN} / ${END} が見つからないため、アプリ一覧は更新しませんでした`);
  process.exit(0);
}
const outside = html.slice(0, b) + html.slice(e + END.length);
const handWritten = (app) =>
  (app.androidPackage && outside.includes(`details?id=${app.androidPackage}`)) ||
  (isIosId(app.appStoreId) && outside.includes(`/id${app.appStoreId}`));

const apps = data.apps
  .filter((a) => !handWritten(a))
  .sort((x, y) => (x.sort ?? 0) - (y.sort ?? 0));

const card = (a) => {
  const icon = a.iconUrl
    ? `<img class="catalog-icon" src="${esc(a.iconUrl)}" alt="${esc(a.name)} アイコン" loading="lazy">`
    : '<div class="catalog-icon catalog-icon--blank"></div>';
  const links = [
    isIosId(a.appStoreId)
      ? `<a href="https://apps.apple.com/jp/app/id${a.appStoreId}" target="_blank" rel="noopener noreferrer">App Store</a>`
      : '',
    a.androidPackage
      ? `<a href="https://play.google.com/store/apps/details?id=${esc(a.androidPackage)}&amp;hl=ja" target="_blank" rel="noopener noreferrer">Google Play</a>`
      : '',
  ].filter(Boolean).join('');
  return `      <div class="catalog-card">
        ${icon}
        <div class="catalog-info">
          <h3 class="catalog-name">${esc(a.name)}</h3>
          <p class="catalog-desc">${esc(a.description)}</p>
          <div class="catalog-links">${links}</div>
        </div>
      </div>`;
};

const block = `${BEGIN}
    <!-- このブロックは tools/build_app_catalog.mjs が cross_promo/apps.json から自動生成する。手で編集しない -->
    <h3 class="catalog-heading">検定・学習クイズアプリ</h3>
    <div class="catalog-grid">
${apps.map(card).join('\n')}
    </div>
    ${END}`;
writeFileSync(htmlPath, html.slice(0, b) + block + html.slice(e + END.length));
console.log(`index.html: アプリ一覧を ${apps.length}件で作り直しました（手書きカードのアプリは除外）`);
