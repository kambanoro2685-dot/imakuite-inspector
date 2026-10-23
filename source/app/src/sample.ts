import { useCallback } from 'react';
import { Post, useStore } from './store';
import { Venue, useVenues } from './venues';

// ジャンルごとの見本の品名・価格・感想
const DISH: Record<string, [string, number, string]> = {
  ラーメン: ['醤油ラーメン', 900, 'スープがやさしい味。麺の固さがちょうどよかった。'],
  麺類: ['ざるうどん', 750, 'コシが強くて、つゆが少し甘め。'],
  寿司: ['にぎり盛り合わせ', 1500, 'ネタが新鮮。ランチは回転が早い。'],
  和食: ['日替わり定食', 950, '小鉢が多くて、ご飯がすすむ。'],
  中華: ['餃子セット', 980, '皮がパリッと焼けていた。'],
  '焼肉・焼鳥': ['焼鳥盛り合わせ', 1400, 'たれより塩がおすすめ。'],
  カレー: ['チキンカレー', 1000, 'スパイスが効いていて、あとから辛さが来る。'],
  洋食: ['ハンバーグ定食', 1200, '肉汁たっぷり。ソースは濃いめ。'],
  居酒屋: ['おまかせ三点盛り', 1800, '一品ごとの量が多め。夜は混む。'],
  カフェ: ['ブレンドとケーキ', 850, '席の間隔が広くて、落ち着く。'],
  ファストフード: ['セットメニュー', 700, '提供が早い。昼は行列。'],
  スイーツ: ['パフェ', 900, '見た目より軽い甘さ。'],
  無国籍: ['エスニックプレート', 1100, 'スパイスが重なっていて、一皿で国をまたいだ気分。'],
  その他: ['本日のおすすめ', 1000, '店の人のおすすめを選んだ。'],
};

const SAT = [5, 4, 3, 4, 5, 4];
const DAYS = [1, 2, 4, 6, 9, 12];

/** 近くの店（ジャンルが重ならないように）から、見本の調査記録と「今日の指令」を作る */
export function buildSample(venues: Venue[], exclude: string[]): { posts: Post[]; mission: Venue | null } | null {
  const pool = venues.filter((v) => !exclude.includes(v.id)).sort((a, b) => a.dist - b.dist);
  const picked: Venue[] = [];
  for (const v of pool) {
    if (picked.length >= 6) break;
    if (!picked.some((p) => p.g === v.g)) picked.push(v);
  }
  for (const v of pool) {
    if (picked.length >= 6) break;
    if (!picked.includes(v)) picked.push(v);
  }
  if (picked.length < 3) return null;
  const mission = picked.length >= 6 ? picked[5] : null;
  const now = Date.now();
  const posts: Post[] = picked.slice(0, 5).map((v, i) => {
    const [dish, price, note] = DISH[v.g] ?? DISH['その他'];
    return {
      id: now - i * 1000, // 重ならない見本用ID
      venue: v.id, venueName: v.n, lat: v.lat, lng: v.lng, genre: v.g,
      dish, sat: SAT[i], vals: { price: String(price), note, amount: 'ちょうど' },
      weather: null, enteredAt: null, first: true, pts: 0, rouletteId: null,
      t: now - DAYS[i] * 24 * 3600e3, edits: [], sample: true,
    };
  });
  return { posts, mission };
}

/** 見本データ（この端末だけ。サーバへは送らず、ポイントにも数えない）の出し入れ */
export function useSamples() {
  const { S, update, showToast } = useStore();
  const { venues, loading } = useVenues();
  const has = S.posts.some((p) => p.sample);

  const add = useCallback(() => {
    if (has) return;
    if (loading || venues.length === 0) return showToast('店のデータを読み込めていません。少し待ってからもう一度お試しください。');
    const made = buildSample(venues, S.posts.map((p) => p.venue));
    if (!made) return showToast('見本に使える店が、近くに足りません。');
    update((s) => ({
      ...s,
      posts: [...made.posts, ...s.posts],
      mission: s.mission ?? (made.mission ? { id: made.mission.id, n: made.mission.n, g: made.mission.g, lat: made.mission.lat, lng: made.mission.lng, at: Date.now() - 3600e3, sample: true } : null),
    }));
    showToast(`見本を${made.posts.length}件入れました（この端末だけ・ポイントには数えません）。`);
  }, [has, loading, venues, S.posts, update, showToast]);

  const clear = useCallback(() => {
    update((s) => ({
      ...s,
      posts: s.posts.filter((p) => !p.sample),
      mission: s.mission?.sample ? null : s.mission,
    }));
    showToast('見本を消しました。');
  }, [update, showToast]);

  return { has, add, clear };
}
