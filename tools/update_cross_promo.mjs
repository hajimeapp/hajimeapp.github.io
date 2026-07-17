#!/usr/bin/env node
// apps/cross_promo/apps.json の各アプリに iTunes Lookup API から取得した
// ストア公式アイコンURL (artworkUrl512) を埋め込み、updated を今日に更新する。
// 使い方: node tools/update_cross_promo.mjs
// 新アプリ追加時: apps.json にエントリ（iconUrlは空でOK）を足してから実行する。

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const jsonPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'cross_promo', 'apps.json');
const data = JSON.parse(readFileSync(jsonPath, 'utf8'));

const ids = data.apps.map((a) => a.appStoreId).join(',');
const res = await fetch(`https://itunes.apple.com/lookup?id=${ids}&country=jp`);
if (!res.ok) throw new Error(`lookup failed: ${res.status}`);
const { results } = await res.json();

const artworkById = new Map(results.map((r) => [String(r.trackId), r.artworkUrl512]));

let ok = 0;
for (const app of data.apps) {
  const url = artworkById.get(app.appStoreId);
  if (url) {
    app.iconUrl = url;
    ok++;
  } else {
    console.warn(`WARN: ${app.id} (${app.appStoreId}) がストアに見つからない`);
  }
}

data.updated = new Date().toISOString().slice(0, 10);
writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
console.log(`完了: ${ok}/${data.apps.length} 件のiconUrlを更新`);
