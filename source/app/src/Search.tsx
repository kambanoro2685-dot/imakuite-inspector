import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useDraft } from './draft';
import { GENRES } from './data';
import { googleMapsUrl, googleRouteUrl, openUrl } from './maps';
import MapView from './MapView';
import { Go } from './nav';
import { useStore } from './store';
import { C, mono } from './theme';
import { visitedPins, pinLabel } from './pins';
import ShopReviews from './Reviews';
import { Venue, useVenues, walkMin } from './venues';
import { Btn, Card, Chip, Chips, Head, Input, Lbl, Muted, s } from './ui';

const SORTS = ['おすすめ順', '近い順', '未訪問だけ'] as const;
type Sort = (typeof SORTS)[number];

function Tag({ t, kind }: { t: string; kind?: 'new' | 'cnt' }) {
  const bg = kind === 'new' ? C.amberSoft : kind === 'cnt' ? C.goodSoft : C.surface2;
  const fg = kind === 'new' ? C.amber : kind === 'cnt' ? C.good : C.ink2;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 3, paddingHorizontal: 7, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11.5, color: fg, fontWeight: '600' }}>{t}</Text>
    </View>
  );
}

export const Credit = () => <Muted>地図・店舗データ: © OpenStreetMap contributors。情報が古い場合があります（閉店・移転など）。</Muted>;

export function Search({ go }: { go: Go }) {
  const { S } = useStore();
  const { venues, center, loading, error, locating, useMyLocation, reload, byId } = useVenues();
  const [g, setG] = useState('すべて');
  const [sort, setSort] = useState<Sort>('おすすめ順');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(30);

  const fav = (v: Venue) => (S.profile.favorites.includes(v.g) ? 1 : 0);
  const mine = (id: string) => S.posts.filter((p) => p.venue === id).length;

  const genres = useMemo(() => {
    const have = new Set(venues.map((v) => v.g));
    return ['すべて', ...GENRES.filter((x) => have.has(x)), ...(have.has('その他') ? ['その他'] : [])];
  }, [venues]);

  const list = useMemo(() => {
    const nq = q.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
    let l = venues.filter((v) => (g === 'すべて' || v.g === g) && (!nq || v.n.normalize('NFKC').toLowerCase().includes(nq)));
    if (sort === '未訪問だけ') l = l.filter((v) => !S.visited.includes(v.id));
    return [...l].sort((a, b) => (sort === '近い順' || sort === '未訪問だけ' ? a.dist - b.dist : fav(b) - fav(a) || a.dist - b.dist));
  }, [venues, g, q, sort, S.visited, S.profile.favorites]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = list.slice(0, limit);
  const pins = useMemo(() => visitedPins(S.posts, byId), [S.posts, venues]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = center.source === 'gps' ? '現在地' : '岡山駅';

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      <Head title="店をさがす" sub={loading ? '読み込み中…' : `${list.length} 件`} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Muted>基準: {base}（半径3km）</Muted>
        <Btn small kind="ghost" label={locating ? '取得中…' : center.source === 'gps' ? '📍 現在地を更新' : '📍 現在地にする'} onPress={useMyLocation} />
      </View>
      {error ? <Text selectable style={{ color: C.crit, fontWeight: '700' }}>{error}</Text> : null}
      {!loading && !error && venues.length === 0 ? (
        <Card>
          <Text style={{ color: C.ink, fontWeight: '800' }}>この周辺には、まだ店舗データがありません。</Text>
          <Muted>対応エリアは、いまは岡山市北区・中心部（岡山駅周辺）です。</Muted>
          <Btn small kind="ghost" label="岡山駅周辺にもどす" onPress={() => reload()} />
        </Card>
      ) : null}

      <Btn small kind="ghost" label={`🗺️ 地図で見る（調査 ${pins.length}か所）`} onPress={() => go('map')} style={{ alignSelf: 'flex-start' }} />

      <Input value={q} onChangeText={(t) => { setQ(t); setLimit(30); }} placeholder="店名で絞り込む（例：らーめん）" />
      <Chips>
        {genres.map((x) => (
          <Chip key={x} label={x} on={g === x} onPress={() => { setG(x); setLimit(30); }} />
        ))}
      </Chips>
      <Chips>
        {SORTS.map((x) => (
          <Chip key={x} label={x} on={sort === x} onPress={() => setSort(x)} />
        ))}
      </Chips>

      {shown.map((v) => (
        <Pressable key={v.id} onPress={() => go('venue', v.id)} style={[s.card, { gap: 6 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink, flexShrink: 1 }}>{v.n}</Text>
            <Text style={{ fontFamily: mono, fontSize: 12, color: C.ink3 }}>{base}から 徒歩{walkMin(v.dist)}分</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Tag t={v.g} />
            <Tag t={v.reviews ? `${v.reviews + mine(v.id)}人が評価` : '調査待ち'} kind={v.reviews ? 'cnt' : undefined} />
            {S.profile.favorites.includes(v.g) ? <Tag t="好みに合う" /> : null}
            {!S.visited.includes(v.id) ? <Tag t="未訪問 +30pt" kind="new" /> : null}
          </View>
        </Pressable>
      ))}
      {list.length > shown.length ? <Btn kind="ghost" label={`さらに表示（残り${list.length - shown.length}件）`} onPress={() => setLimit(limit + 30)} /> : null}
      <Credit />
    </ScrollView>
  );
}

export function VenueDetail({ id, go }: { id: string; go: Go }) {
  const { S } = useStore();
  const { setD } = useDraft();
  const { byId, center } = useVenues();
  const post0 = S.posts.find((p) => p.venue === id && p.lat != null);
  const v: Venue | undefined = byId(id) ?? (post0 ? { id, n: post0.venueName, g: post0.genre ?? 'その他', lat: post0.lat!, lng: post0.lng!, url: null, reviews: null, dist: 0 } : undefined);
  if (!v) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Btn small kind="ghost" label="← 一覧にもどる" onPress={() => go('search')} style={{ alignSelf: 'flex-start' }} />
        <Muted>店の情報が見つかりません。一覧から選び直してください。</Muted>
      </ScrollView>
    );
  }
  const mine = S.posts.filter((p) => p.venue === id);
  const base = center.source === 'gps' ? '現在地' : '岡山駅';

  const post = () => {
    setD((x) => ({ ...x, venue: id }));
    go('post');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 30 }}>
      <Btn small kind="ghost" label="← 一覧にもどる" onPress={() => go('search')} style={{ alignSelf: 'flex-start' }} />
      <Head title={v.n} sub={v.g} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Tag t={v.g} />
        <Tag t={`${base}から 徒歩${walkMin(v.dist)}分（約${v.dist.toLocaleString()}m）`} />
        <Tag t={v.reviews ? `${v.reviews + mine.length}人が評価` : '調査待ち'} kind={v.reviews ? 'cnt' : undefined} />
        {!S.visited.includes(v.id) ? <Tag t="未訪問 +30pt" kind="new" /> : null}
      </View>

      <MapView
        height={240}
        center={{ lat: v.lat, lng: v.lng }}
        markers={[
          { id: v.id, lat: v.lat, lng: v.lng, kind: 'win', label: v.n },
        ]}
      />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn small kind="ghost" label="🗺️ Googleマップで開く" onPress={() => openUrl(googleMapsUrl(v))} style={{ flex: 1 }} />
        <Btn small kind="ghost" label="🧭 徒歩ルート" onPress={() => openUrl(googleRouteUrl(v))} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {v.url ? <Btn small kind="ghost" label="🌐 公式サイト" onPress={() => openUrl(v.url!)} style={{ flex: 1 }} /> : null}
        <Btn small label="ここで投稿する" onPress={post} style={{ flex: 1 }} />
      </View>

      <View style={{ gap: 8 }}>
        <Lbl>調査状況</Lbl>
        <Card>
          <Text style={{ color: C.ink, fontWeight: '800' }}>
            {v.reviews ? `${v.reviews + mine.length}人の調査官が評価しています` : 'まだ調査待ちです（3件集まると評価が表示されます）'}
          </Text>
        </Card>
        {mine.map((p) => (
          <Card key={p.id}>
            <Text style={{ fontWeight: '800', color: C.ink }}>あなたの調査{p.sample ? '（見本）' : ''}　<Text style={{ color: C.amber }}>満足度 {p.sat}</Text></Text>
            <Text style={{ color: C.ink2 }}>{p.dish}{p.vals.price ? ` ／ ¥${Number(p.vals.price).toLocaleString()}` : ''}</Text>
            {p.photos?.length ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {p.photos.map((ph) => (
                    <Image key={ph.id} source={{ uri: ph.url }} style={{ width: 64, height: 64, borderRadius: 2, borderWidth: 3, borderColor: '#FFFFFF' }} />
                  ))}
                </View>
              ) : null}
          </Card>
        ))}
      </View>
      <ShopReviews shopId={v.id} />
      <Credit />
    </ScrollView>
  );
}
