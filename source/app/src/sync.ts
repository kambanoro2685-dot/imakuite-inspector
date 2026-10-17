import { shopUuid } from './config';
import { Post, Profile } from './store';
import { supabase } from './supabase';

/** step: 0=未 1=来店を保存 2=皿を保存 3=評価を保存 4=提出済み */
export const SYNC_DONE = 4;
type Sync = NonNullable<Post['sync']>;

const MOOD: Record<string, string> = { 疲れ: 'tired', 穏やか: 'good', 普通: 'normal', 上機嫌: 'good', 絶好調: 'great' };
const VOLUME: Record<string, string> = { 少なめ: 'less', ちょうど: 'just_right', 多め: 'more', 驚愕: 'huge' };
// 調査票の「静かさ」: 0=静か 〜 4=賑やか
const QUIET: Record<string, number> = { 静か: 0, 会話しやすい: 1, ふつう: 2, 騒がしい: 4 };

const partyNum = (s?: string) => (s ? Math.min(20, parseInt(s, 10) || 0) || undefined : undefined);
/** 同じ id の再送は「保存済み」として成功扱いにする（べき等） */
const dupOk = (e: { code?: string } | null) => (e && e.code !== '23505' ? e : null);

/**
 * 投稿を Supabase へ送る。id は端末で採番済みなので、途中で失敗しても何度でも再送できる。
 * ステップごとに進捗を保存し、続きから送る。
 * 端末の調査票とDBの評価項目にはまだ差があり、対応できる項目だけ送る
 * （清掃・店の規模などは端末内のみ。調査票UIをDB項目に合わせるまでの暫定）。
 */
export async function syncPost(post: Post, save: (s: Sync) => void): Promise<void> {
  let sy: Sync = post.sync ?? { key: '', dishId: '', step: 0 };
  const persist = (step: number) => {
    sy = { ...sy, step };
    save(sy);
  };
  const v = post.vals;
  const visitId = sy.key;

  if (sy.step < 1) {
    const row: Record<string, unknown> = {
      id: visitId,
      shop_id: shopUuid(post.venue),
      entered_at: new Date(post.enteredAt ?? post.t).toISOString(),
    };
    if (post.weather && post.weather[2] > 0) {
      [row.weather, row.temp_c, row.pressure_hpa] = post.weather;
    }
    const party = partyNum(v.party);
    if (party) row.party_size = party;
    if (v.hunger) row.hunger_before = (Number(v.hunger) - 1) * 25;
    if (v.mood && MOOD[v.mood]) row.mood = MOOD[v.mood];
    if (v.note) row.comment = v.note;
    const e = dupOk((await supabase.from('visit').insert(row)).error);
    if (e) throw e;
    persist(1);
  }
  if (sy.step < 2) {
    const row: Record<string, unknown> = { id: sy.dishId, visit_id: visitId, name: post.dish };
    if (v.price) row.price_yen = Number(v.price);
    if (v.amount && VOLUME[v.amount]) row.volume = VOLUME[v.amount];
    if (v.genre) row.genre = v.genre;
    const e = dupOk((await supabase.from('dish').insert(row)).error);
    if (e) throw e;
    persist(2);
  }
  if (sy.step < 3) {
    const row: Record<string, unknown> = { visit_id: visitId, satisfaction: post.sat * 20 };
    if (v.rec === 'また行く') { row.would_return = true; row.would_recommend = true; }
    if (v.rec === '行かない') row.would_return = false;
    if (v.quiet && QUIET[v.quiet] !== undefined) row.quietness = QUIET[v.quiet];
    const { error } = await supabase.from('visit_score').upsert(row);
    if (error) throw error;
    persist(3);
  }
  if (sy.step < 4) {
    const { error } = await supabase.rpc('submit_visit', { p_visit: visitId });
    if (error) throw error;
    persist(4);
  }
}

const NATIONS: Record<string, string> = { 日本: 'JP', アメリカ: 'US', 中国: 'CN', 韓国: 'KR', 台湾: 'TW', ベトナム: 'VN', フィリピン: 'PH', ブラジル: 'BR', タイ: 'TH' };

/** 端末のプロフィール → DBの丸め値形式に変換して保存（わからない項目は送らない。失敗しても登録は止めない） */
export async function pushProfile(p: Profile): Promise<void> {
  const row: Record<string, unknown> = {};
  const g = { 女性: 'female', 男性: 'male', その他: 'other', 回答しない: 'unspecified' }[p.gender];
  if (g) row.gender = g;
  const age = parseInt(p.age, 10);
  if (p.age === '〜19') row.age_band = 10;
  else if (age >= 20) row.age_band = Math.min(100, Math.floor(age / 10) * 10);
  const nat = NATIONS[p.nationality.trim()] ?? (/^[A-Za-z]{2}$/.test(p.nationality.trim()) ? p.nationality.trim().toUpperCase() : null);
  if (nat) row.nationality = nat;
  if (!Object.keys(row).length) return;
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return;
  await supabase.from('inspector_profile').upsert({ inspector_id: uid, ...row, updated_at: new Date().toISOString() });
}
