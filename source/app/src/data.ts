export type Venue = {
  id: number;
  n: string;
  g: string;
  price: number;
  sc: number;
  cnt: number;
  dist: number;
  site: string;
  lat: number;
  lon: number;
};

// 岡山市北区・中心部のサンプル店舗（本番は OpenStreetMap / Overpass から取り込む）
export const VENUES: Venue[] = [
  { id: 1, n: '麺屋 こだま', g: 'ラーメン', price: 850, sc: 4.3, cnt: 12, dist: 4, site: 'https://example.jp/kodama', lat: 34.6667, lon: 133.9188 },
  { id: 2, n: '大衆食堂 みなみ', g: '定食', price: 780, sc: 4.1, cnt: 31, dist: 6, site: 'https://example.jp/minami', lat: 34.6651, lon: 133.9201 },
  { id: 3, n: 'カレー研究所 ボンベイ通り', g: 'カレー', price: 1100, sc: 4.6, cnt: 8, dist: 9, site: 'https://example.jp/bombay', lat: 34.6689, lon: 133.9166 },
  { id: 4, n: '焼鳥 とりいち', g: '居酒屋', price: 2800, sc: 3.9, cnt: 19, dist: 3, site: 'https://example.jp/toriichi', lat: 34.6659, lon: 133.9174 },
  { id: 5, n: 'パスタ食堂 ノルド', g: '洋食', price: 1300, sc: 4.4, cnt: 5, dist: 12, site: 'https://example.jp/nord', lat: 34.6702, lon: 133.9215 },
  { id: 6, n: '天ぷら 一二三', g: '和食', price: 1600, sc: 4.0, cnt: 23, dist: 7, site: 'https://example.jp/hifumi', lat: 34.6644, lon: 133.9152 },
  { id: 7, n: '餃子酒場 チャオ', g: '中華', price: 950, sc: 3.7, cnt: 14, dist: 5, site: 'https://example.jp/ciao', lat: 34.6671, lon: 133.9143 },
  { id: 8, n: 'カフェ 木漏れ日', g: 'カフェ', price: 700, sc: 4.2, cnt: 27, dist: 8, site: 'https://example.jp/komorebi', lat: 34.6695, lon: 133.9192 },
];

export const GENRES = ['ラーメン', '定食', 'カレー', '居酒屋', '洋食', '和食', '中華', 'カフェ'];

export type FieldDef =
  | { k: string; n: string; pt: number; type: 'photo' | 'price' | 'text' | 'range' }
  | { k: string; n: string; pt: number; type: 'pick'; opts: string[] }
  | { k: string; n: string; pt: number; type: 'faces'; opts: [string, string][] };

export const FIELDS: FieldDef[] = [
  { k: 'photo', n: '写真', pt: 15, type: 'photo' },
  { k: 'price', n: '価格', pt: 10, type: 'price' },
  { k: 'note', n: '食べた後の感想', pt: 10, type: 'text' },
  { k: 'amount', n: '量', pt: 5, type: 'pick', opts: ['少なめ', 'ちょうど', '多め', '驚愕'] },
  { k: 'genre', n: '料理のジャンル', pt: 5, type: 'pick', opts: GENRES },
  { k: 'rec', n: 'おすすめ度', pt: 5, type: 'pick', opts: ['また行く', '気が向いたら', '行かない'] },
  { k: 'clean', n: '清掃状態', pt: 5, type: 'pick', opts: ['気になる', 'ふつう', '清潔', 'ピカピカ'] },
  { k: 'quiet', n: '静かさ', pt: 4, type: 'pick', opts: ['騒がしい', 'ふつう', '静か', '会話しやすい'] },
  { k: 'size', n: '店の規模', pt: 3, type: 'pick', opts: ['〜10席', '〜30席', '〜60席', '大型店'] },
  { k: 'hunger', n: 'おなかの減り具合', pt: 3, type: 'range' },
  { k: 'mood', n: 'その時の気分', pt: 3, type: 'faces', opts: [['😪', '疲れ'], ['😌', '穏やか'], ['🙂', '普通'], ['😆', '上機嫌'], ['🔥', '絶好調']] },
  { k: 'party', n: '何人で行ったか', pt: 3, type: 'pick', opts: ['1人', '2人', '3人', '4人', '5人以上'] },
];

export const DEFAULT_PALETTE: Record<string, boolean> = { price: true, note: true, amount: true };

export const RANKS = [
  { n: '見習い', at: 0, unlock: 'クイック投稿とルーレット（1日3回）が使えます。評価できる範囲は自分が投稿した店だけです。' },
  { n: '三等インスペクター', at: 300, unlock: 'ルーレット無制限。同じエリアの直近30日の評価が見えます。' },
  { n: '二等インスペクター', at: 1200, unlock: '全項目の平均値が見えます。' },
  { n: '一等インスペクター', at: 3000, unlock: '全件閲覧・一覧表・並べ替えが開きます。' },
  { n: '主任インスペクター', at: 8000, unlock: '訂正履歴が閲覧できます。' },
  { n: '特別監察官', at: 20000, unlock: '指摘の検証キューに参加できます（信頼度800以上）。' },
];

export const HUNGER = ['', '平気', '少し空いた', 'そこそこ', 'かなり', '限界'];

export const WEATHER_CODES: Record<number, string> = {
  0: '☀️ 晴れ', 1: '🌤️ 晴れ', 2: '⛅ くもり', 3: '☁️ くもり', 45: '🌫️ 霧', 48: '🌫️ 霧',
  51: '🌦️ 小雨', 53: '🌦️ 小雨', 55: '🌧️ 雨', 61: '🌧️ 雨', 63: '🌧️ 雨', 65: '🌧️ 大雨',
  71: '🌨️ 雪', 73: '🌨️ 雪', 75: '🌨️ 大雪', 80: '🌦️ にわか雨', 81: '🌧️ にわか雨', 82: '⛈️ 激しい雨', 95: '⛈️ 雷雨',
};
