import React from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useDraft } from './draft';
import { FIELDS, HUNGER, VENUES } from './data';
import { Go } from './nav';
import { uuid4 } from './supabase';
import { Post, useStore } from './store';
import { useSyncer } from './useSyncer';
import { C, mono } from './theme';
import { Btn, Chip, Chips, Faces, Head, Input, Lbl, Muted, Steps, s } from './ui';

const SAT: [string, string][] = [['😞', 'いまいち'], ['😐', 'ふつう'], ['🙂', 'good'], ['😋', 'うまい'], ['🤩', '絶品']];

export function draftPoints(
  D: ReturnType<typeof useDraft>['D'],
  palette: Record<string, boolean>,
  visited: number[],
) {
  let p = 0;
  if (D.dish.trim()) p += 10;
  if (D.sat) p += 5;
  if (D.venue) p += 10;
  if (D.stamp) p += 15;
  if (D.rouletteId) p += 15;
  for (const f of FIELDS) if (palette[f.k] && D.vals[f.k]) p += f.pt;
  if (D.venue && !visited.includes(D.venue)) p += 30;
  return p;
}

export default function PostScreen({ go }: { go: Go }) {
  const { S, signedIn, update, addPoints, showToast } = useStore();
  const { D, setD, clear } = useDraft();
  const syncer = useSyncer();
  const pts = draftPoints(D, S.palette, S.visited);
  const near = [...VENUES].sort((a, b) => a.dist - b.dist).slice(0, 5);
  const venueShown = D.venue && !near.some((v) => v.id === D.venue) ? [VENUES.find((v) => v.id === D.venue)!, ...near] : near;

  const setVal = (k: string, v: string) => setD((x) => ({ ...x, vals: { ...x.vals, [k]: v } }));

  const pickPhoto = async () => {
    if (D.vals.photo) return setVal('photo', '');
    try {
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, exif: false };
      let res: ImagePicker.ImagePickerResult;
      if (Platform.OS === 'web') {
        res = await ImagePicker.launchImageLibraryAsync(opts);
      } else {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        res = perm.granted ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      }
      if (!res.canceled && res.assets[0]) setVal('photo', res.assets[0].uri);
    } catch {
      showToast('写真を取得できませんでした。');
    }
  };

  const submit = () => {
    if (!D.venue) return showToast('店を選んでください。周辺の候補から1件タップします。');
    if (!D.dish.trim()) return showToast('「何を食べた」だけは必要です。記録の芯になります。');
    if (!D.sat) return showToast('満足度をひとつ選んでください。');
    const v = VENUES.find((x) => x.id === D.venue)!;
    const first = !S.visited.includes(v.id);
    const vals: Record<string, string> = {};
    for (const f of FIELDS) if (S.palette[f.k] && D.vals[f.k]) vals[f.k] = D.vals[f.k];
    const post: Post = {
      id: Date.now(), venue: v.id, venueName: v.n, dish: D.dish.trim(), sat: D.sat, vals,
      weather: D.stamp ? D.stamp.weather : null, enteredAt: D.stamp ? D.stamp.enteredAt : null,
      first, pts, rouletteId: D.rouletteId, t: Date.now(), edits: [],
      sync: S.account && signedIn ? { key: uuid4(), dishId: uuid4(), step: 0 } : undefined,
    };
    update((st) => ({ ...st, posts: [post, ...st.posts], visited: first ? [...st.visited, v.id] : st.visited }));
    if (post.sync) {
      // アカウントがあるときのポイントはサーバが計算する（端末では加点しない）
      showToast('提出しました。サーバでポイントを計算します…');
      syncer(post).then((r) =>
        showToast(
          r === 'done' ? '同期完了。ポイントを更新しました。'
            : r === 'pending' ? 'オフラインのため端末に保存しました。接続できたら自動で送信します。'
            : 'サーバに受理されませんでした（入力内容を確認してください）。',
        ),
      );
    } else {
      addPoints(pts, `投稿：${v.n}${first ? '（初訪問 +30）' : ''}${D.rouletteId ? '（ルーレット由来 +15）' : ''}`);
      showToast(`投稿しました。+${pts}pt${first ? ' ／ 初めての店なので +30pt 上乗せ' : ''}`);
    }
    const fromRoulette = !!D.rouletteId;
    clear();
    go(fromRoulette ? 'my' : 'home');
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <Head title="調査報告書" sub={D.stamp ? `打刻済 ${D.stamp.weather[0]} ${D.stamp.weather[1]}℃` : '未打刻'} />

        <View style={{ gap: 7 }}>
          <Lbl>① 調査対象（どこで）</Lbl>
          <Chips>
            {venueShown.map((v) => (
              <Chip
                key={v.id}
                label={`${v.n} · 徒歩${v.dist}分`}
                on={D.venue === v.id}
                onPress={() => setD((x) => ({ ...x, venue: x.venue === v.id ? null : v.id }))}
              />
            ))}
          </Chips>
        </View>

        <View style={{ gap: 7 }}>
          <Lbl>② 摂取した品目（何を食べた）</Lbl>
          <Input value={D.dish} onChangeText={(t) => setD((x) => ({ ...x, dish: t }))} placeholder="例：味噌ラーメン" />
        </View>

        <View style={{ gap: 7 }}>
          <Lbl>③ 総合所見（満足度）</Lbl>
          <Faces
            opts={SAT}
            value={D.sat ? SAT[D.sat - 1][1] : ''}
            onPick={(n) => setD((x) => ({ ...x, sat: n ? SAT.findIndex((f) => f[1] === n) + 1 : 0 }))}
          />
        </View>

        {FIELDS.filter((f) => S.palette[f.k]).map((f) => (
          <View key={f.k} style={{ gap: 7 }}>
            <Lbl>{`${f.n}　+${f.pt}pt`}</Lbl>
            {f.type === 'pick' ? (
              <Chips>
                {f.opts.map((o) => (
                  <Chip key={o} label={o} on={D.vals[f.k] === o} onPress={() => setVal(f.k, D.vals[f.k] === o ? '' : o)} />
                ))}
              </Chips>
            ) : f.type === 'faces' ? (
              <Faces opts={f.opts} value={D.vals[f.k] ?? ''} onPick={(v) => setVal(f.k, v)} />
            ) : f.type === 'range' ? (
              <View style={{ gap: 6 }}>
                <Chips>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Chip key={n} label={HUNGER[n]} on={D.vals[f.k] === String(n)} onPress={() => setVal(f.k, D.vals[f.k] === String(n) ? '' : String(n))} />
                  ))}
                </Chips>
              </View>
            ) : f.type === 'price' ? (
              <View style={{ gap: 6 }}>
                <Text style={{ fontFamily: mono, fontSize: 20, fontWeight: '800', color: C.ink }}>
                  {Number(D.vals[f.k] || 0) ? `¥${Number(D.vals[f.k]).toLocaleString()}` : '未設定'}
                </Text>
                <Steps value={Number(D.vals[f.k] || 0)} min={0} max={10000} step={100} onChange={(v) => setVal(f.k, v ? String(v) : '')} />
                <Muted>＋ / − で100円ずつ。価格ダイヤル。</Muted>
              </View>
            ) : f.type === 'photo' ? (
              <View style={{ gap: 8 }}>
                {D.vals[f.k] ? <Image source={{ uri: D.vals[f.k] }} style={{ width: '100%', height: 180, borderRadius: 10 }} /> : null}
                <Btn small kind="ghost" label={D.vals[f.k] ? '写真を外す' : '📷 写真を撮る／選ぶ'} onPress={pickPhoto} style={{ alignSelf: 'flex-start' }} />
                <Muted>※ 現段階では端末内にだけ保存されます（位置情報は付けません）。</Muted>
              </View>
            ) : (
              <Input value={D.vals[f.k] ?? ''} onChangeText={(t) => setVal(f.k, t)} placeholder="話しかけるように書いてください" multiline />
            )}
          </View>
        ))}

        <Btn kind="ghost" label="⚙️ 入力する項目を選ぶ" onPress={() => go('palette')} />
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.surface }}>
        <View>
          <Text style={{ fontFamily: mono, fontSize: 22, fontWeight: '800', color: C.good }}>+{pts}</Text>
          <Text style={{ fontFamily: mono, fontSize: 10, color: C.ink3 }}>POINT</Text>
        </View>
        <Btn label="この内容で提出" onPress={submit} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

export function Palette({ go }: { go: Go }) {
  const { S, update } = useStore();
  const { setD } = useDraft();
  const toggle = (k: string) => {
    const on = !S.palette[k];
    update((st) => ({ ...st, palette: { ...st.palette, [k]: on } }));
    if (!on) setD((x) => ({ ...x, vals: { ...x.vals, [k]: '' } }));
  };
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 30 }}>
      <Head title="項目パレット" sub="選んだ分だけ加点" />
      <Muted>最初は3項目だけ。使いたい項目をONにすると投稿画面に現れます。いつでも戻せます。</Muted>
      {FIELDS.map((f) => {
        const on = !!S.palette[f.k];
        return (
          <Pressable
            key={f.k}
            accessibilityRole="switch"
            accessibilityState={{ checked: on }}
            onPress={() => toggle(f.k)}
            style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 10 }, on && { borderColor: C.indigo, backgroundColor: C.indigoSoft }]}
          >
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: C.ink }}>{f.n}</Text>
            <Text style={{ fontFamily: mono, color: C.good, fontWeight: '800' }}>+{f.pt}pt</Text>
            <Text style={{ fontSize: 18 }}>{on ? '✅' : '⬜'}</Text>
          </Pressable>
        );
      })}
      <Btn label="投稿画面にもどる" onPress={() => go('post')} />
    </ScrollView>
  );
}
