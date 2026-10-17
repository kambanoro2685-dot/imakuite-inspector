// Overpass の取得結果 (overpass.json) を、shop テーブルへの投入SQL (migrations/0006_osm_shops.sql) に変換する。
// 取得: tools/fetch_overpass.sh   変換: node tools/gen_osm_shops.mjs
// 出典: © OpenStreetMap contributors (ODbL)
import { readFileSync, writeFileSync } from 'node:fs';

const j = JSON.parse(readFileSync(new URL('./overpass.json', import.meta.url), 'utf8'));

const CUISINE = {
  ramen: 'ラーメン', noodle: '麺類', udon: '麺類', soba: '麺類', sushi: '寿司',
  japanese: '和食', seafood: '和食', fish: '和食', beef_bowl: '和食', savory_pancakes: '和食', okonomiyaki: '和食',
  chinese: '中華', barbecue: '焼肉・焼鳥', korean: '焼肉・焼鳥', chicken: '焼肉・焼鳥', yakiniku: '焼肉・焼鳥',
  curry: 'カレー', indian: 'カレー',
  italian: '洋食', pizza: '洋食', french: '洋食', spanish: '洋食', steak_house: '洋食', burger: '洋食', western: '洋食',
  coffee_shop: 'カフェ', cafe: 'カフェ',
};
const AMENITY = { cafe: 'カフェ', bar: '居酒屋', pub: '居酒屋', fast_food: 'ファストフード', ice_cream: 'スイーツ', restaurant: 'その他', food_court: 'その他' };

const genreOf = (t) => {
  for (const c of String(t.cuisine ?? '').split(/[;,]/).map((x) => x.trim())) if (CUISINE[c]) return CUISINE[c];
  return AMENITY[t.amenity] ?? 'その他';
};
const norm = (s) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const seen = [];
const rows = [];
for (const e of j.elements) {
  const t = e.tags ?? {};
  const name = (t['name:ja'] ?? t.name ?? '').trim().slice(0, 80);
  const lat = e.lat ?? e.center?.lat;
  const lng = e.lon ?? e.center?.lon;
  if (!name || lat == null || lng == null) continue;
  const nn = norm(name);
  // 同名・約50m以内は重複とみなして最初の1件だけ残す
  if (seen.some((s) => s.nn === nn && Math.abs(s.lat - lat) < 0.0005 && Math.abs(s.lng - lng) < 0.0005)) continue;
  seen.push({ nn, lat, lng });
  let url = (t.website ?? t['contact:website'] ?? '').trim();
  if (!/^https?:\/\//i.test(url)) url = '';
  rows.push(
    `  (${q(name)}, ${q(nn.slice(0, 80))}, ${lat.toFixed(6)}, ${lng.toFixed(6)}, ${q(genreOf(t))}, ${url && url.length <= 255 ? q(url) : 'null'}, 'osm', ${q(e.type + '/' + e.id)})`,
  );
}

const sql = `-- 実在の飲食店（OpenStreetMap / Overpass API から取得）。岡山市北区・中心部。
-- 取得日時(OSMデータ基準): ${j.osm3s?.timestamp_osm_base ?? '不明'}  件数: ${rows.length}
-- 出典: © OpenStreetMap contributors（ODbL）。アプリ内の地図にも必ず表示すること。
-- 注意: OSM の情報は古い場合がある（閉店済み・移転など）。投稿のたびに調査官が確認する運用。

insert into public.shop (name, name_norm, lat, lng, genre, url, source, osm_id) values
${rows.join(',\n')}
on conflict (osm_id) do nothing;

-- 試作用の架空サンプル店舗（0002）は無効にする（履歴は残る）
update public.shop set status = 'closed'
 where id in (
   '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004',
   '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006',
   '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000008');
`;
writeFileSync(new URL('../migrations/0006_osm_shops.sql', import.meta.url), sql);
const byGenre = {};
rows.forEach((r) => { const g = r.match(/, '([^']*)', (?:null|'http[^']*'), 'osm'/)?.[1]; byGenre[g] = (byGenre[g] ?? 0) + 1; });
console.log(rows.length, 'shops written;', JSON.stringify(byGenre));
