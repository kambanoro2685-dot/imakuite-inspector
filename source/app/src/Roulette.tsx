import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useDraft } from './draft';
import { VENUES, Venue } from './data';
import { Go } from './nav';
import { today, useStore } from './store';
import { C, mono } from './theme';
import { Btn, Chip, Chips, Head, Lbl, Muted } from './ui';

const GENRE_OPTS = ['すべて', 'ラーメン', '定食', 'カレー', '居酒屋', '和食', '中華'];
const WEIGHTS = ['好みを優先', '未訪問を優先', '高評価を優先', '完全ランダム'] as const;
type W = (typeof WEIGHTS)[number];

export default function Roulette({ go }: { go: Go }) {
  const { S, update, showToast } = useStore();
  const { setD } = useDraft();
  const [g, setG] = useState('すべて');
  const [w, setW] = useState<W>('好みを優先');
  const [on, setOn] = useState(-1);
  const [win, setWin] = useState<Venue | null>(null);
  const [rid, setRid] = useState('');
  const spinning = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const spinsToday = S.spinDay === today() ? S.spins : 0;
  const unlimited = S.pt >= 300;
  const cands = (() => {
    const c = VENUES.filter((v) => g === 'すべて' || v.g === g);
    return c.length ? c : VENUES;
  })();

  const weight = (v: Venue) => {
    if (w === '完全ランダム') return 1;
    if (w === '高評価を優先') return Math.pow(v.sc, 3);
    if (w === '未訪問を優先') return S.visited.includes(v.id) ? 1 : 4;
    return (S.profile.favorites.includes(v.g) ? 4 : 1) * (S.visited.includes(v.id) ? 1 : 1.5);
  };

  const spin = () => {
    if (spinning.current) return;
    if (!unlimited && spinsToday >= 3) return showToast('今日のルーレットは3回まで。300ptで無制限になります。');
    const total = cands.reduce((a, v) => a + weight(v), 0);
    let r = Math.random() * total;
    let idx = cands.length - 1;
    for (let i = 0; i < cands.length; i++) {
      r -= weight(cands[i]);
      if (r <= 0) { idx = i; break; }
    }
    update((st) => ({ ...st, spinDay: today(), spins: (st.spinDay === today() ? st.spins : 0) + 1 }));
    setWin(null);
    spinning.current = true;
    const steps = cands.length * 3 + idx;
    let i = 0;
    let delay = 55;
    const step = () => {
      setOn(i % cands.length);
      i++;
      if (i <= steps) {
        if (i > steps - cands.length) delay += 26;
        timer.current = setTimeout(step, delay);
      } else {
        spinning.current = false;
        setWin(cands[idx]);
        setRid('R' + Date.now());
      }
    };
    step();
  };

  const goThere = () => {
    if (!win) return;
    setD((x) => ({ ...x, venue: win.id, rouletteId: rid }));
    showToast('ルーレット由来の投稿として記録します（+15pt）。');
    go('post');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 30 }}>
      <Head title="ルーレット" sub={unlimited ? '無制限（ランク特典）' : `残り${Math.max(0, 3 - spinsToday)}回`} />
      <View style={{ gap: 7 }}>
        <Lbl>条件</Lbl>
        <Chips>{GENRE_OPTS.map((x) => <Chip key={x} label={x} on={g === x} onPress={() => setG(x)} />)}</Chips>
      </View>
      <View style={{ gap: 7 }}>
        <Lbl>重みづけ</Lbl>
        <Chips>{WEIGHTS.map((x) => <Chip key={x} label={x} on={w === x} onPress={() => setW(x)} />)}</Chips>
      </View>

      <View style={{ gap: 6 }}>
        {cands.map((v, i) => {
          const isWin = win?.id === v.id && on === i && !spinning.current;
          const lit = on === i;
          return (
            <View
              key={v.id}
              style={{
                borderWidth: 1.5, borderRadius: 3, padding: 10,
                borderColor: isWin ? C.amber : lit ? C.indigo : C.line,
                backgroundColor: isWin ? C.amberSoft : lit ? C.indigoSoft : C.surface,
              }}
            >
              <Text style={{ fontWeight: '700', color: C.ink }}>{v.n}</Text>
              <Text style={{ fontSize: 11.5, color: C.ink3 }}>★{v.sc.toFixed(1)} · 徒歩{v.dist}分</Text>
            </View>
          );
        })}
      </View>

      {win ? (
        <View style={{ backgroundColor: C.amberSoft, borderRadius: 3, borderWidth: 2, borderColor: C.crit, borderStyle: "dashed", padding: 14, gap: 4 }}>
          <Text style={{ fontFamily: mono, fontSize: 11, color: C.amber, fontWeight: '800' }}>RESULT</Text>
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.ink }}>{win.n}</Text>
          <Muted>{win.g} ／ ¥{win.price.toLocaleString()} ／ 徒歩{win.dist}分{S.visited.includes(win.id) ? '' : ' ／ 未訪問'}</Muted>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Btn kind="ghost" label="引き直す" onPress={spin} style={{ flex: 1 }} />
            <Btn label="ここに行く" onPress={goThere} style={{ flex: 1 }} />
          </View>
          <Muted>「ここに行く」で +15pt。帰ってきたら事後評価で さらに +10pt。</Muted>
        </View>
      ) : null}

      <Btn kind="amber" label="🎯 回す" onPress={spin} />
    </ScrollView>
  );
}
