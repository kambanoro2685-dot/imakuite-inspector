import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useDraft } from './draft';
import { VENUES } from './data';
import { Go } from './nav';
import { useStore } from './store';
import { C, mono } from './theme';
import { Btn, Card, Head, Lbl, Muted } from './ui';
import { stampNow } from './weather';

// 同時投稿人数は仮の数値（サーバ接続後に実測値へ置き換える）
function liveBase() {
  const h = new Date().getHours();
  return h >= 11 && h <= 13 ? 840 : h >= 18 && h <= 21 ? 1120 : 260;
}

export default function Home({ go }: { go: Go }) {
  const { S, showToast } = useStore();
  const { D, setD } = useDraft();
  const [live, setLive] = useState(liveBase() + 20);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setLive(liveBase() + Math.floor(Math.random() * 60)), 10000);
    return () => clearInterval(t);
  }, []);

  const d = new Date();
  const last = S.posts[0];
  const pick = VENUES.filter((v) => S.profile.favorites.includes(v.g) && !S.visited.includes(v.id))[0];

  const enter = async () => {
    if (busy) return;
    setBusy(true);
    const st = await stampNow();
    setD((x) => ({ ...x, stamp: st }));
    setBusy(false);
    showToast(
      st.real
        ? `入店を記録：現在地・時刻・${st.weather[0]} ${st.weather[1]}℃・${st.weather[2]}hPa を封入しました`
        : '入店を記録しました（位置情報が使えないため岡山駅周辺の天気で代用）',
    );
    go('post');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 30 }}>
      <Head title={`調査官 ${S.profile.nickname}`} sub={`${d.getMonth() + 1}月${d.getDate()}日`} />
      <Text style={{ color: C.amber, fontWeight: '700', fontSize: 13 }}>
        今日のあなたの投稿が、未来のあなたの「食べたい」を支えます。
      </Text>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={statBox}>
          <Text style={statV}>{live.toLocaleString()} 人</Text>
          <Muted>今この時間に投稿中（仮の数値）</Muted>
        </View>
        <View style={statBox}>
          <Text style={statV}>{S.posts.length} 件</Text>
          <Muted>あなたの投稿</Muted>
        </View>
      </View>

      <Btn label={D.stamp ? '✅ 入店記録済み（投稿へ）' : busy ? '記録中…' : '🚪 入店を記録する'} onPress={D.stamp ? () => go('post') : enter} />
      <Muted>押した瞬間に、座標・時刻・天気・気温・気圧をまとめて封入します。位置情報はこの操作のときだけ使います。</Muted>

      {last ? (
        <Card>
          <Lbl>直近の調査記録</Lbl>
          <Text style={{ fontSize: 14, color: C.ink, lineHeight: 22 }}>
            <Text style={{ fontWeight: '800' }}>{last.venueName}</Text> で <Text style={{ fontWeight: '800' }}>{last.dish}</Text>。満足度は {last.sat}。
          </Text>
        </Card>
      ) : null}

      {pick ? (
        <Card>
          <Lbl>あなたの好みに合う未訪問の店</Lbl>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.ink }}>{pick.n}</Text>
          <Muted>{pick.g} ／ ¥{pick.price.toLocaleString()} ／ 徒歩{pick.dist}分 ／ 初訪問で +30pt</Muted>
          <Btn small kind="ghost" label="この店を見る" onPress={() => go('venue', pick.id)} style={{ alignSelf: 'flex-start' }} />
        </Card>
      ) : null}

      <Card flat>
        <Lbl>迷っているなら</Lbl>
        <Btn kind="amber" label="🎯 ルーレットで決める" onPress={() => go('roulette')} />
      </Card>

      <Text style={{ fontFamily: mono, fontSize: 11, color: C.ink3, textAlign: 'center' }}>今日からあなたも、インスペクター。</Text>
    </ScrollView>
  );
}

const statBox = { flex: 1, backgroundColor: C.surface, borderColor: C.line, borderWidth: 1, borderRadius: 12, padding: 12, gap: 2 } as const;
const statV = { fontSize: 20, fontWeight: '800', color: C.indigo } as const;
