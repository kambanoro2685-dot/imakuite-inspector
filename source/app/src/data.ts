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

export type FieldDef = { k: string; n: string; pt: number; rank: number; hint?: string } & (
  | { type: 'photo' | 'price' | 'text' }
  | { type: 'range'; labels: string[] } // labels[1..5]
  | { type: 'pick'; opts: string[] }
  | { type: 'faces'; opts: [string, string][] }
  | { type: 'rating' } // 0〜5
  | { type: 'multi'; opts: string[] } // 複数選択（"," 区切りで保存）
);

const GOOD3 = ['良い', 'ふつう', '気になる'];

/** 階級ごとの入力項目。rank は解放される階級（0=見習い … 4=主任）。上の階級ほど詳しい調査ができる */
export const FIELDS: FieldDef[] = [
  // ---- 見習い（0pt〜）: 基本項目 ----
  { k: 'photo', n: '写真', pt: 15, rank: 0, type: 'photo' },
  { k: 'price', n: '価格', pt: 10, rank: 0, type: 'price' },
  { k: 'note', n: '食べた後の感想', pt: 10, rank: 0, type: 'text' },
  { k: 'amount', n: '量', pt: 5, rank: 0, type: 'pick', opts: ['少なめ', 'ちょうど', '多め', '驚愕'] },
  { k: 'genre', n: '料理のジャンル', pt: 5, rank: 0, type: 'pick', opts: GENRES },
  { k: 'rec', n: 'おすすめ度', pt: 5, rank: 0, type: 'pick', opts: ['また行く', '気が向いたら', '行かない'] },
  { k: 'hunger', n: 'おなかの減り具合（入店前）', pt: 3, rank: 0, type: 'range', labels: ['', '平気', '少し空いた', 'そこそこ', 'かなり', '限界'] },
  { k: 'party', n: '何人で行ったか', pt: 3, rank: 0, type: 'pick', opts: ['1人', '2人', '3人', '4人', '5人以上'] },

  // ---- 三等（300pt〜）: 清掃・環境・体調 ----
  { k: 'cl_entrance', n: '清掃｜入口・外観', pt: 3, rank: 1, type: 'pick', opts: GOOD3 },
  { k: 'cl_seating', n: '清掃｜席まわり', pt: 3, rank: 1, type: 'pick', opts: GOOD3 },
  { k: 'cl_tableware', n: '清掃｜食器・箸', pt: 3, rank: 1, type: 'pick', opts: GOOD3 },
  { k: 'cl_restroom', n: '清掃｜お手洗い', pt: 3, rank: 1, type: 'pick', opts: GOOD3 },
  { k: 'cl_kitchen', n: '清掃｜厨房・カウンター', pt: 3, rank: 1, type: 'pick', opts: GOOD3, hint: '5項目そろえると +15pt' },
  { k: 'quiet', n: '静かさ', pt: 4, rank: 1, type: 'pick', opts: ['騒がしい', 'ふつう', '会話しやすい', '静か'] },
  { k: 'wait', n: '待ち時間', pt: 4, rank: 1, type: 'pick', opts: ['すぐ', '〜10分', '〜30分', '30分超'], hint: '静かさと合わせて +10pt' },
  { k: 'size', n: '店の規模', pt: 3, rank: 1, type: 'pick', opts: ['〜10席', '〜30席', '〜60席', '大型店'] },
  { k: 'mood', n: 'その時の気分', pt: 3, rank: 1, type: 'faces', opts: [['😪', '疲れ'], ['😌', '穏やか'], ['🙂', '普通'], ['😆', '上機嫌'], ['🔥', '絶好調']] },
  { k: 'full', n: '食後の満腹度', pt: 3, rank: 1, type: 'range', labels: ['', 'まだ入る', 'ほどよい', '満足', 'お腹いっぱい', '食べすぎ'], hint: '入店前の空腹と合わせて +6pt' },

  // ---- 二等（1,200pt〜）: 味の分析・接客 ----
  { k: 'ts_sweet', n: '味｜甘味', pt: 2, rank: 2, type: 'rating' },
  { k: 'ts_salty', n: '味｜塩味', pt: 2, rank: 2, type: 'rating' },
  { k: 'ts_sour', n: '味｜酸味', pt: 2, rank: 2, type: 'rating' },
  { k: 'ts_bitter', n: '味｜苦味', pt: 2, rank: 2, type: 'rating' },
  { k: 'ts_umami', n: '味｜うま味', pt: 2, rank: 2, type: 'rating' },
  { k: 'ts_hot', n: '味｜辛味', pt: 2, rank: 2, type: 'rating', hint: '3つ以上そろえると +8pt' },
  { k: 'service', n: '接客', pt: 3, rank: 2, type: 'pick', opts: ['残念', 'いまいち', 'ふつう', '良い', 'とても良い'] },
  { k: 'speed', n: '提供までの時間', pt: 3, rank: 2, type: 'pick', opts: ['すぐ', '〜5分', '〜10分', '10分超'], hint: '接客と合わせて +5pt' },

  // ---- 一等（3,000pt〜）: 品質・設備・支払い ----
  { k: 'aroma', n: '品質｜香り', pt: 3, rank: 3, type: 'pick', opts: GOOD3 },
  { k: 'texture', n: '品質｜食感', pt: 3, rank: 3, type: 'pick', opts: GOOD3 },
  { k: 'temperature', n: '品質｜温度', pt: 3, rank: 3, type: 'pick', opts: GOOD3 },
  { k: 'presentation', n: '品質｜盛り付け', pt: 3, rank: 3, type: 'pick', opts: GOOD3, hint: '4項目そろえると +10pt' },
  { k: 'crowd', n: '混み具合', pt: 2, rank: 3, type: 'pick', opts: ['空いている', 'ふつう', 'やや混み', '満席', '行列'] },
  { k: 'pay', n: '支払い方法', pt: 2, rank: 3, type: 'multi', opts: ['現金', '交通系IC', 'クレジット', 'QR'] },
  { k: 'smoke', n: '喫煙', pt: 2, rank: 3, type: 'pick', opts: ['禁煙', '喫煙可', '分煙'], hint: '混み具合・支払い・喫煙で +6pt' },
  { k: 'seats', n: '席の種類', pt: 2, rank: 3, type: 'multi', opts: ['カウンター', 'テーブル', '座敷', '個室'] },
  { k: 'facil', n: '設備・使いやすさ', pt: 2, rank: 3, type: 'multi', opts: ['バリアフリー', '子連れ向き', '一人向き', '多言語メニュー'] },

  // ---- 主任（8,000pt〜）: 計測・推し皿 ----
  { k: 'noise', n: '騒音の測定値', pt: 5, rank: 4, type: 'pick', opts: ['〜40dB', '〜55dB', '〜70dB', '70dB超'], hint: 'スマホの騒音計などで測った値。+5pt' },
  { k: 'tax', n: '価格の表記', pt: 2, rank: 4, type: 'pick', opts: ['税込', '税別'] },
  { k: 'pickdish', n: '推し皿', pt: 3, rank: 4, type: 'pick', opts: ['この皿が一押し'] },
  { k: 'tags', n: '来店の目的', pt: 2, rank: 4, type: 'multi', opts: ['疲れた', 'お祝い', '仕事', '一人', 'デート', '急ぎ'] },
];

/** 階級ごとの見出し（入力項目画面で使う） */
export const TIER_TITLES = [
  '基本項目',
  '清掃・環境・体調',
  '味の分析・接客',
  '品質・設備・支払い',
  '計測・推し皿',
];

export const DEFAULT_PALETTE: Record<string, boolean> = { price: true, note: true, amount: true };

export const RANKS = [
  { n: '見習い', at: 0, unlock: '基本の入力項目（写真・価格・感想など8項目）。ルーレットは1日3回。評価できる範囲は自分が投稿した店だけです。' },
  { n: '三等インスペクター', at: 300, unlock: '入力項目「清掃5項目・静かさ・待ち時間・満腹度」など10項目が増えます。ルーレット無制限。同じエリアの直近30日の評価が見えます。' },
  { n: '二等インスペクター', at: 1200, unlock: '入力項目「味の5味評価・接客・提供時間」の8項目が増えます。全項目の平均値が見えます。' },
  { n: '一等インスペクター', at: 3000, unlock: '入力項目「品質4項目・混み具合・支払い・設備」の9項目が増えます。全件閲覧・一覧表・並べ替えが開きます。' },
  { n: '主任インスペクター', at: 8000, unlock: '入力項目「騒音の測定・推し皿・来店の目的」が増えます。訂正履歴が閲覧できます。' },
  { n: '特別監察官', at: 20000, unlock: '指摘の検証キューに参加できます（信頼度800以上）。' },
];


export const WEATHER_CODES: Record<number, string> = {
  0: '☀️ 晴れ', 1: '🌤️ 晴れ', 2: '⛅ くもり', 3: '☁️ くもり', 45: '🌫️ 霧', 48: '🌫️ 霧',
  51: '🌦️ 小雨', 53: '🌦️ 小雨', 55: '🌧️ 雨', 61: '🌧️ 雨', 63: '🌧️ 雨', 65: '🌧️ 大雨',
  71: '🌨️ 雪', 73: '🌨️ 雪', 75: '🌨️ 大雪', 80: '🌦️ にわか雨', 81: '🌧️ にわか雨', 82: '⛈️ 激しい雨', 95: '⛈️ 雷雨',
};
