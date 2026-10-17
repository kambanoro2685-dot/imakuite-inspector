// マイグレーションを Postgres(PGlite) に流し、RLS・列権限・RPC を検証する。 npm test
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const read = (f) => readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8');
const db = new PGlite();

// ---- Supabase の最小スタブ（auth スキーマとロール）----
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);
await db.exec(read('0001_init.sql'));
await db.exec(read('0002_seed_shops.sql'));
await db.exec(read('0003_bug_report.sql'));

let failed = 0, passed = 0;
const ok = (c, name, extra = '') => { c ? passed++ : failed++; console.log(`${c ? 'PASS' : 'FAIL'}  ${name}${c ? '' : '  ' + extra}`); };

/** ある利用者（uid）として SQL を実行。uid=null は未ログイン(anon) */
async function as(uid, fn) {
  await db.exec(uid ? `set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);` : `set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  try { return await fn(); } finally { await db.exec('reset role;'); }
}
const q = (sql, p = []) => db.query(sql, p);
const err = async (p) => { try { await p; return null; } catch (e) { return e.message ?? String(e); } };

async function newUser(codename) {
  const id = randomUUID();
  await db.query('insert into auth.users (id) values ($1)', [id]);
  const r = await as(id, () => q('select public.register_inspector($1) as r', [codename]));
  return { id, pid: r.rows[0].r.public_id };
}
const me = (u) => as(u.id, async () => (await q('select public.me() as m')).rows[0].m);

// ===== 登録 =====
const A = await newUser('調査官A');
ok(/^IKI-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(A.pid), '公開IDの形式');
const again = await as(A.id, () => q('select public.register_inspector($1) as r', ['別名']));
ok(again.rows[0].r.public_id === A.pid && again.rows[0].r.created === false, '再登録は既存IDを返す');
const B = await newUser('調査官B');
const dupName = await as((await (async () => { const id = randomUUID(); await db.query('insert into auth.users (id) values ($1)', [id]); return { id }; })()).id.toString(), async () => null);
const C0 = randomUUID(); await db.query('insert into auth.users (id) values ($1)', [C0]);
ok((await as(C0, () => err(q('select public.register_inspector($1)', ['調査官A'])))).includes('codename_taken'), 'コードネーム重複を拒否');
ok((await as(C0, () => err(q('select public.register_inspector($1)', ['<script>'])))).includes('invalid_codename'), '不正なコードネームを拒否');
ok((await as(null, () => err(q('select public.me()')))) !== null, '未ログイン(anon)は RPC を呼べない（実行権限なし）');
ok((await as(null, () => err(q('select * from public.shop')))) !== null, '未ログインは店舗を読めない');

// ===== RLS: 他人のデータ・直接書き込み =====
const m = await me(A);
ok(m.ikp === 0 && m.rank === 0 && m.trust_score === 500, 'me(): 初期状態');
ok((await as(A.id, () => q('select * from public.inspector'))).rows.length === 1, 'inspector は自分の行だけ見える');
ok((await as(A.id, () => err(q(`insert into public.point_ledger (inspector_id, amount, kind) values ('${A.id}', 9999, 'cheat')`)))) !== null, 'ポイント台帳へ直接書けない');
ok((await as(A.id, () => err(q(`update public.inspector set rank = 5, trust_score = 1000 where id = '${A.id}'`)))) !== null, '階級・信頼度を直接書き換えられない');
ok((await as(A.id, () => err(q(`insert into public.shop (name, name_norm, lat, lng) values ('x','x',0,0)`)))) !== null, '店舗を直接INSERTできない');

// プロフィール
ok(!(await as(A.id, () => err(q(`insert into public.inspector_profile (inspector_id, age_band, nationality, height_bucket_cm) values ('${A.id}', 30, 'JP', 170)`)))), 'プロフィールを保存');
ok((await as(A.id, () => err(q(`update public.inspector_profile set height_bucket_cm = 171 where inspector_id = '${A.id}'`)))) !== null, '身長の刻みを検証');
ok((await as(B.id, () => err(q(`insert into public.inspector_profile (inspector_id) values ('${A.id}')`)))) !== null, '他人のプロフィールは作れない');
ok((await as(A.id, () => err(q(`insert into public.body_log (measured_at, weight_bucket_kg) values ('2026-10-17', 65)`)))) === null, '体重ログを保存');
ok((await as(A.id, () => err(q(`insert into public.body_log (measured_at, weight_bucket_kg) values ('2026-10-17', 66)`)))) !== null, '体重の刻みを検証');

// ===== 店舗検索 =====
const SHOP = '00000000-0000-4000-8000-000000000001';
const search = await as(A.id, () => q('select * from public.search_shops(34.6667, 133.9188, 1500)'));
const dists = search.rows.map((r) => r.distance_m);
ok(search.rows.length === 8 && dists.every((x, i) => !i || dists[i - 1] <= x), '店舗検索（距離順）');
ok(search.rows.every((r) => r.review_count === null), '3件未満は review_count=null');
ok((await as(A.id, () => q(`select * from public.search_shops(34.6667, 133.9188, 1500, 'ｶﾚｰ')`))).rows.length === 1, '店名検索（半角カナ正規化）');
ok((await as(A.id, () => q(`select * from public.search_shops(34.6667, 133.9188, 1500, '%')`))).rows.length === 0, 'LIKE のワイルドカードを無害化');

// ===== 来店 → 提出 =====
const V = randomUUID(), D = randomUUID();
const ins = (sql, p) => err(q(sql, p));
ok(!(await as(A.id, () => ins(`insert into public.visit (id, shop_id, entered_at, weather, temp_c, pressure_hpa) values ($1, $2, now() - interval '40 minutes', 'wmo:0', 24.8, 1025.2)`, [V, SHOP]))), '来店を作成');
ok((await as(A.id, () => ins(`insert into public.visit (id, shop_id, entered_at, inspector_id) values ($1, $2, now(), $3)`, [randomUUID(), SHOP, B.id]))) !== null, '他人の名義で来店を作れない');
ok((await as(A.id, () => ins(`insert into public.visit (id, shop_id, entered_at, submitted_at) values ($1, $2, now(), now())`, [randomUUID(), SHOP]))) !== null, '提出済みとして直接作れない');
ok((await as(A.id, () => ins(`insert into public.visit (id, shop_id, entered_at) values ($1, $2, now())`, [V, SHOP]))) !== null, '同じ id の再INSERTは拒否（べき等）');
ok((await as(B.id, async () => (await q('select * from public.visit')).rows.length)) === 0, '他人の来店は見えない');
ok(!(await as(A.id, () => ins(`update public.visit set party_size = 2, hunger_before = 75, fullness_after = 90, mood = 'good', comment = 'うまい' where id = $1`, [V]))), '来店の追記（UPDATE）');
ok((await as(A.id, () => ins(`update public.visit set party_size = 99 where id = $1`, [V]))) !== null, '範囲外の値を拒否');
ok((await as(A.id, () => ins(`update public.visit set submitted_at = now() where id = $1`, [V]))) !== null, 'submitted_at を直接書けない');
ok(!(await as(A.id, () => ins(`insert into public.dish (id, visit_id, name, price_yen, volume) values ($1, $2, '味噌ラーメン', 850, 'just_right')`, [D, V]))), '皿カードを追加');
ok((await as(B.id, () => ins(`insert into public.dish (id, visit_id, name) values ($1, $2, 'x')`, [randomUUID(), V]))) !== null, '他人の来店に皿を足せない');
ok((await as(A.id, () => err(q('select public.submit_visit($1)', [V])))).includes('score_required'), '評価なしの提出を拒否');
ok(!(await as(A.id, () => ins(`insert into public.visit_score (visit_id, satisfaction, quietness, wait_min) values ($1, 80, 1, 5)`, [V]))), '評価を保存');

const sub = await as(A.id, async () => (await q('select public.submit_visit($1) as r', [V])).rows[0].r);
const kinds = sub.breakdown.map((x) => x.kind).sort().join(',');
ok(kinds === 'condition,dish_card,environment,first_visit_bonus,quick_report', '提出と加点内訳', kinds);
ok(sub.total === 64 && sub.ikp === 64, '加点合計 64pt');
const sub2 = await as(A.id, async () => (await q('select public.submit_visit($1) as r', [V])).rows[0].r);
ok(sub2.already_submitted === true && (await me(A)).ikp === 64, '再提出で二重加点されない');
ok((await as(A.id, () => ins(`update public.visit set party_size = 3 where id = $1`, [V]))) === null
   && (await q('select party_size from public.visit where id = $1', [V])).rows[0].party_size === 2, '提出後の UPDATE は0行（変更されない）');
ok((await as(A.id, () => ins(`insert into public.dish (id, visit_id, name) values ($1, $2, 'y')`, [randomUUID(), V]))) !== null, '提出後は皿を足せない');
ok((await as(B.id, () => err(q('select public.submit_visit($1)', [V])))).includes('not_found'), '他人の来店は提出できない');

// ===== 訂正 =====
const cor = await as(A.id, async () => (await q(`select public.correct_field('dish', $1, 'price_yen', '880', 'レシート確認') as r`, [D])).rows[0].r);
ok(cor.ok && cor.penalty === false && cor.bonus === 3, '訂正（72時間以内は減点なし +3pt）');
ok((await q('select price_yen from public.dish where id = $1', [D])).rows[0].price_yen === 880, '値が更新される');
const rev = await as(A.id, () => q('select field, old_value, new_value, reason from public.revision'));
ok(rev.rows.length === 1 && rev.rows[0].old_value === '850' && rev.rows[0].new_value === '880', '訂正履歴に旧値・新値が残る');
ok((await as(B.id, () => q('select * from public.revision'))).rows.length === 0, '他人の訂正履歴は見えない');
ok((await as(B.id, () => err(q(`select public.correct_field('dish', $1, 'price_yen', '1')`, [D])))).includes('not_found'), '他人の投稿は訂正できない');
ok((await as(A.id, () => err(q(`select public.correct_field('visit', $1, 'submitted_at', now()::text)`, [V])))).includes('invalid_field'), '訂正できない列を拒否');
ok((await as(A.id, () => err(q(`select public.correct_field('dish', $1, 'price_yen', '880')`, [D])))).includes('no_change'), '変更なしを拒否');
ok((await as(A.id, () => err(q(`select public.correct_field('dish', $1, 'price_yen', '-5')`, [D])))) !== null, '訂正でも範囲検証が効く');
ok((await as(A.id, () => err(q(`select public.correct_field('visit_score', $1, 'satisfaction', null)`, [V])))) !== null, '必須項目は空にできない');
await q(`update public.visit set submitted_at = now() - interval '100 hours' where id = $1`, [V]); // 時間経過を再現
const late = await as(A.id, async () => (await q(`select public.correct_field('dish', $1, 'name', '味噌ラーメン大盛') as r`, [D])).rows[0].r);
ok(late.penalty === true && late.bonus === 0, '72時間超の訂正は減点対象扱い・加点なし');

// ===== 再訪 / 新規店舗 =====
const V2 = randomUUID();
await as(A.id, () => q(`insert into public.visit (id, shop_id, entered_at) values ($1, $2, now())`, [V2, SHOP]));
await as(A.id, () => q(`insert into public.visit_score (visit_id, satisfaction) values ($1, 60)`, [V2]));
const sub3 = await as(A.id, async () => (await q('select public.submit_visit($1) as r', [V2])).rows[0].r);
ok(!sub3.breakdown.some((x) => x.kind === 'first_visit_bonus'), '再訪には初訪問ボーナスが付かない');
ok((await me(A)).ikp === 64 + 3 + 10, 'ポイント残高', String((await me(A)).ikp));

const ns = await as(A.id, async () => (await q(`select public.create_shop('テスト食堂', 34.67, 133.92, '定食') as r`)).rows[0].r);
ok(ns.bonus.amount === 100, '新規店舗登録 +100');
ok((await as(A.id, () => err(q(`select public.create_shop('テスト　食堂', 34.67, 133.92)`)))).includes('duplicate_shop'), '同名近接（全角空白違い）の重複を拒否');
ok((await as(null, () => err(q(`select public.create_shop('x', 1, 1)`)))) !== null, '未ログインは店舗登録できない');

// ===== 集計 =====
const live = await as(null, async () => (await q('select public.stats_live() as r')).rows[0].r);
ok(live.active_inspectors_today >= 1, '集計（stats_live）は未ログインでも見える', JSON.stringify(live));
const st = await as(A.id, async () => (await q('select public.shop_stats($1) as r', [SHOP])).rows[0].r);
ok(st.review_count === null && st.avg_satisfaction === null, '店舗統計は3件未満なら null');
for (const u of [B, C0 && { id: C0 }]) { /* 3件に到達させる */ }
// 3人目までの提出を作って集計が開くことを確認
for (let i = 0; i < 3; i++) {
  const u = await newUser(`集計用${i}`);
  const v = randomUUID();
  await as(u.id, () => q(`insert into public.visit (id, shop_id, entered_at) values ($1, $2, now())`, [v, SHOP]));
  await as(u.id, () => q(`insert into public.visit_score (visit_id, satisfaction) values ($1, 70)`, [v]));
  await as(u.id, () => q('select public.submit_visit($1)', [v]));
}
const st2 = await as(A.id, async () => (await q('select public.shop_stats($1) as r', [SHOP])).rows[0].r);
ok(st2.review_count >= 3 && st2.avg_satisfaction !== null, '3件以上で集計が開く', JSON.stringify(st2));
const s2 = await as(A.id, () => q('select * from public.search_shops(34.6667, 133.9188, 300)'));
ok(s2.rows.find((r) => r.id === SHOP)?.review_count >= 3, '検索結果にも件数が出る');

// ===== 不具合報告 =====
const rep = (u, cat, msg) => as(u, () => q('select public.submit_bug_report($1, $2, $3, $4, $5) as r', [cat, msg, 'home', 'test-build', 'UA/1.0']));
ok((await rep(null, 'bug', '押しても反応しません')).rows[0].r.ok === true, '未ログインでも不具合を報告できる');
ok((await rep(A.id, 'request', 'ダークモードが欲しい')).rows[0].r.ok === true, 'ログイン中も報告できる');
const reps = await q('select inspector_id, category, screen, build from public.bug_report order by id');
ok(reps.rows[0].inspector_id === null && reps.rows[1].inspector_id === A.id, 'ログイン中だけ調査官IDが紐づく');
ok((await as(A.id, () => err(q('select * from public.bug_report')))) !== null, '報告は直接読めない（運営だけ）');
ok((await as(null, () => err(q("insert into public.bug_report (category, message) values ('bug','x')")))) !== null, '直接INSERTできない');
ok((await rep(A.id, 'xxx', 'a').then(() => null, (e) => e.message)).includes('invalid_category'), '不正な種別を拒否');
ok((await rep(A.id, 'bug', '   ').then(() => null, (e) => e.message)).includes('invalid_message'), '空の本文を拒否');
ok((await rep(A.id, 'bug', 'あ'.repeat(2001)).then(() => null, (e) => e.message)).includes('invalid_message'), '長すぎる本文を拒否');
for (let i = 0; i < 9; i++) await rep(A.id, 'bug', 'n' + i);
ok((await rep(A.id, 'bug', '11件目').then(() => null, (e) => e.message)).includes('rate_limited'), 'ログイン中は1日10件まで');

// ===== アカウント削除 =====
await as(B.id, () => q('select public.delete_account()'));
ok((await q('select status, codename from public.inspector where id = $1', [B.id])).rows[0].status === 'frozen', '削除: 凍結・匿名化');
ok((await q('select count(*)::int as n from auth.users where id = $1', [B.id])).rows[0].n === 0, '削除: 認証情報が消える');
await q(`insert into auth.users (id) values ($1) on conflict do nothing`, [B.id]); // 同じ id で戻ってきたと仮定
ok(!(await as(B.id, async () => (await q('select public.me() as m')).rows[0].m)), '削除後は me() が null');
ok((await as(B.id, () => err(q(`insert into public.visit (id, shop_id, entered_at) values ($1, $2, now())`, [randomUUID(), SHOP])))) !== null, '凍結アカウントは来店を作れない');

console.log(failed === 0 ? `\nALL PASSED (${passed})` : `\n${failed} FAILED / ${passed} passed`);
process.exit(failed === 0 ? 0 : 1);
