import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useDraft } from './draft';
import { GENRES, VENUES } from './data';
import { Go } from './nav';
import { useStore } from './store';
import { C, mono } from './theme';
import { Btn, Card, Chip, Chips, Head, Lbl, Muted, s } from './ui';

const SORTS = ['おすすめ順', '評価順', '近い順', '安い順', '未訪問だけ'] as const;
type Sort = (typeof SORTS)[number];

function Tag({ t, kind }: { t: string; kind?: 'new' | 'cnt' }) {
  const bg = kind === 'new' ? C.amberSoft : kind === 'cnt' ? C.goodSoft : C.surface2;
  const fg = kind === 'new' ? C.amber : kind === 'cnt' ? C.good : C.ink2;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
      <Text style={{ fontSize: 11.5, color: fg, fontWeight: '600' }}>{t}</Text>
    </View>
  );
}

export function Search({ go }: { go: Go }) {
  const { S } = useStore();
  const [g, setG] = useState('すべて');
  const [sort, setSort] = useState<Sort>('おすすめ順');
  const mine = (id: number) => S.posts.filter((p) => p.venue === id).length;
  const fav = (v: (typeof VENUES)[number]) => (S.profile.favorites.includes(v.g) ? 1 : 0);

  let list = VENUES.filter((v) => g === 'すべて' || v.g === g);
  if (sort === '未訪問だけ') list = list.filter((v) => !S.visited.includes(v.id));
  list = [...list].sort((a, b) => {
    if (sort === '近い順') return a.dist - b.dist;
    if (sort === '安い順') return a.price - b.price;
    if (sort === '評価順') return b.sc - a.sc;
    return fav(b) - fav(a) || b.sc - a.sc;
  });

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 30 }}>
      <Head title="店をさがす" sub={`${list.length} 件`} />
      <Chips>
        {['すべて', ...GENRES].map((x) => (
          <Chip key={x} label={x} on={g === x} onPress={() => setG(x)} />
        ))}
      </Chips>
      <Chips>
        {SORTS.map((x) => (
          <Chip key={x} label={x} on={sort === x} onPress={() => setSort(x)} />
        ))}
      </Chips>
      {list.length === 0 ? <Muted>条件に合う店がありません。絞り込みを緩めてください。</Muted> : null}
      {list.map((v) => (
        <Pressable key={v.id} onPress={() => go('venue', v.id)} style={[s.card, { gap: 6 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink, flexShrink: 1 }}>{v.n}</Text>
            <Text style={{ fontFamily: mono, fontWeight: '800', color: C.amber }}>★ {v.sc.toFixed(1)}</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Tag t={v.g} />
            <Tag t={`徒歩${v.dist}分`} />
            <Tag t={`${v.cnt + mine(v.id)}人が評価`} kind="cnt" />
            {S.profile.favorites.includes(v.g) ? <Tag t="好みに合う" /> : null}
            {!S.visited.includes(v.id) ? <Tag t="未訪問 +30pt" kind="new" /> : null}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const Redact = ({ n = 8 }: { n?: number }) => (
  <Text style={{ color: C.ink3, letterSpacing: 1 }}>{'█'.repeat(n)}</Text>
);

export function VenueDetail({ id, go }: { id: number; go: Go }) {
  const { S, showToast } = useStore();
  const { setD } = useDraft();
  const v = VENUES.find((x) => x.id === id);
  if (!v) return null;
  const mine = S.posts.filter((p) => p.venue === id);
  const open = S.visited.includes(id) || S.pt >= 300;
  const avgOpen = S.pt >= 1200;

  const openSite = () => Linking.openURL(v.site).catch(() => showToast('公式サイトを開けませんでした。'));
  const post = () => {
    setD((x) => ({ ...x, venue: id }));
    go('post');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 30 }}>
      <Btn small kind="ghost" label="← 一覧にもどる" onPress={() => go('search')} style={{ alignSelf: 'flex-start' }} />
      <Head title={v.n} sub={`★ ${v.sc.toFixed(1)}`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Tag t={v.g} />
        <Tag t={`徒歩${v.dist}分`} />
        <Tag t={`${v.cnt + mine.length}人が評価`} kind="cnt" />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn small kind="ghost" label="🌐 公式サイトを開く" onPress={openSite} style={{ flex: 1 }} />
        <Btn small label="ここで投稿する" onPress={post} style={{ flex: 1 }} />
      </View>

      <Card>
        <Lbl>平均価格（全員の集計）</Lbl>
        {avgOpen ? <Text style={{ fontSize: 18, fontWeight: '800', color: C.ink }}>¥{v.price.toLocaleString()}</Text> : <Redact n={6} />}
        {!avgOpen ? <Muted>二等インスペクター（1,200pt）で開きます。</Muted> : null}
      </Card>

      <View style={{ gap: 8 }}>
        <Lbl>{`評価一覧（${v.cnt + mine.length}人）`}</Lbl>
        {mine.map((p) => (
          <View key={p.id} style={[s.card, { gap: 3 }]}>
            <Text style={{ fontWeight: '800', color: C.ink }}>あなた　<Text style={{ color: C.amber }}>満足度 {p.sat}</Text></Text>
            <Text style={{ color: C.ink2 }}>{p.dish}{p.vals.price ? ` ／ ¥${Number(p.vals.price).toLocaleString()}` : ''}</Text>
          </View>
        ))}
        <View style={[s.card, { gap: 3 }]}>
          <Text style={{ fontWeight: '800', color: C.ink }}>巡回インスペクター（信頼 82）　<Text style={{ color: C.amber }}>満足度 4</Text></Text>
          {open ? <Text style={{ color: C.ink2 }}>昼の混雑は12時台がピーク。回転は速い。</Text> : <Redact n={18} />}
        </View>
        <View style={[s.card, { gap: 3 }]}>
          <Text style={{ fontWeight: '800', color: C.ink }}>見習い（信頼 44）　<Text style={{ color: C.amber }}>満足度 5</Text></Text>
          {open ? <Text style={{ color: C.ink2 }}>量が多め。比較用に割り箸を一緒に撮りました。</Text> : <Redact n={16} />}
        </View>
        {!open ? <Muted>この店に投稿するか、三等インスペクター（300pt）になると本文が読めます。自分で調べた範囲だけが見える仕組みです。</Muted> : null}
        <Muted>※ 上の他人の評価はサンプル表示です。</Muted>
      </View>
    </ScrollView>
  );
}
