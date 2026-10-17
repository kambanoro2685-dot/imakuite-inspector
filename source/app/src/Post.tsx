import React from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useDraft } from './draft';
import { FIELDS, RANKS, TIER_TITLES } from './data';
import { useVenues, walkMin } from './venues';
import { Go } from './nav';
import { uuid4 } from './supabase';
import { Post, rankIndexOf, useStore } from './store';
import { useSyncer } from './useSyncer';
import { C, mono } from './theme';
import { Btn, Chip, Chips, Faces, Head, Input, Lbl, Muted, Steps, s } from './ui';

const SAT: [string, string][] = [['😞', 'いまいち'], ['😐', 'ふつう'], ['🙂', 'good'], ['😋', 'うまい'], ['🤩', '絶品']];

export function draftPoints(
  D: ReturnType<typeof useDraft>['D'],
  palette: Record<string, boolean>,
  visited: string[],
  rankIdx: number,
) {
  let p = 0;
  if (D.dish.trim()) p += 10;
  if (D.sat) p += 5;
  if (D.venue) p += 10;
  if (D.stamp) p += 15;
  if (D.rouletteId) p += 15;
  for (const f of FIELDS) if (f.rank <= rankIdx && palette[f.k] && D.vals[f.k]) p += f.pt;
  if (D.venue && !visited.includes(D.venue)) p += 30;
  return p;
}

export default function PostScreen({ go }: { go: Go }) {
  const { S, signedIn, update, addPoints, showToast } = useStore();
  const { D, setD, clear } = useDraft();
  const syncer = useSyncer();
  const rankIdx = rankIndexOf(S.pt);
  const active = FIELDS.filter((f) => f.rank <= rankIdx && S.palette[f.k]);
  const pts = draftPoints(D, S.palette, S.visited, rankIdx);
  const { venues, byId } = useVenues();
  const [vq, setVq] = React.useState('');
  const nq = vq.normalize('NFKC').toLowerCase().replace(/s+/g, '');
  const near = (nq ? venues.filter((v) => v.n.normalize('NFKC').toLowerCase().includes(nq)) : venues).slice(0, 6);
  const picked = D.venue ? byId(D.venue) : undefined;
  const venueShown = picked && !near.some((v) => v.id === picked.id) ? [picked, ...near] : near;

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
    const v = byId(D.venue);
    if (!v) return showToast('店の情報を読み込めませんでした。もう一度選んでください。');
    const first = !S.visited.includes(v.id);
    const vals: Record<string, string> = {};
    for (const f of active) if (D.vals[f.k]) vals[f.k] = D.vals[f.k];
    const post: Post = {
      id: Date.now(), venue: v.id, venueName: v.n, lat: v.lat, lng: v.lng, genre: v.g, dish: D.dish.trim(), sat: D.sat, vals,
      weather: D.stamp ? D.stamp.weather : null, enteredAt: D.stamp ? D.stamp.enteredAt : null,
      first, pts, rouletteId: D.rouletteId, t: Date.now(), edits: [],
      sync: S.account && signedIn ? { key: uuid4(), dishId: uuid4(), step: 0 } : undefined,
    };
    update((st) => ({ ...st, posts: [post, ...st.posts], visited: first ? [...st.visited, v.id] : st.visited }));
    if (post.sync) {
      // アカウントがあるときのポイントはサーバが計算する（端末では加点しない）
      showToast('提出しました。サーバでポイントを計算します…');
      syncer(post).then(({ r, msg }) =>
        showToast(
          r === 'done' ? '同期完了。ポイントを更新しました。'
            : r === 'pending' ? `送信できなかったため端末に保存しました。接続できたら自動で再送します。（${msg ?? ''}）`
            : `サーバに受理されませんでした: ${msg ?? ''}`,
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
          <Input value={vq} onChangeText={setVq} placeholder="店名で探す（近くの店が候補に出ます）" />
          <Chips>
            {venueShown.map((v) => (
              <Chip
                key={v.id}
                label={`${v.n} · 徒歩${walkMin(v.dist)}分`}
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

        {active.map((f) => (
          <View key={f.k} style={{ gap: 7 }}>
            <Lbl>{`${f.n}　+${f.pt}pt`}</Lbl>
            {f.hint ? <Muted>{f.hint}</Muted> : null}
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
                    <Chip key={n} label={f.labels[n]} on={D.vals[f.k] === String(n)} onPress={() => setVal(f.k, D.vals[f.k] === String(n) ? '' : String(n))} />
                  ))}
                </Chips>
              </View>
            ) : f.type === 'rating' ? (
              <View style={{ gap: 4 }}>
                <Chips>
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <Chip key={n} label={String(n)} on={D.vals[f.k] === String(n)} onPress={() => setVal(f.k, D.vals[f.k] === String(n) ? '' : String(n))} />
                  ))}
                </Chips>
                <Muted>0 = 感じない ／ 5 = とても強い</Muted>
              </View>
            ) : f.type === 'multi' ? (
              <Chips>
                {f.opts.map((o) => {
                  const cur = (D.vals[f.k] ?? '').split(',').filter(Boolean);
                  const on = cur.includes(o);
                  return (
                    <Chip
                      key={o}
                      label={o}
                      on={on}
                      onPress={() => setVal(f.k, (on ? cur.filter((x) => x !== o) : [...cur, o]).join(','))}
                    />
                  );
                })}
              </Chips>
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
                {D.vals[f.k] ? <Image source={{ uri: D.vals[f.k] }} style={{ width: '100%', height: 180, borderRadius: 2, borderWidth: 6, borderColor: "#FFFFFF" }} /> : null}
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
  const rankIdx = rankIndexOf(S.pt);
  const total = FIELDS.length;
  const open = FIELDS.filter((f) => f.rank <= rankIdx).length;

  const toggle = (k: string) => {
    const on = !S.palette[k];
    update((st) => ({ ...st, palette: { ...st.palette, [k]: on } }));
    if (!on) setD((x) => ({ ...x, vals: { ...x.vals, [k]: '' } }));
  };
  const setTier = (tier: number, on: boolean) => {
    const keys = FIELDS.filter((f) => f.rank === tier).map((f) => f.k);
    update((st) => {
      const next = { ...st.palette };
      keys.forEach((k) => { next[k] = on; });
      return { ...st, palette: next };
    });
    if (!on) setD((x) => ({ ...x, vals: Object.fromEntries(Object.entries(x.vals).filter(([k]) => !keys.includes(k))) }));
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 30 }}>
      <Head title="入力項目" sub={`解放 ${open} / ${total}`} />
      <Muted>
        階級が上がると、より詳しい調査項目が使えるようになります。使いたい項目をONにすると投稿画面に現れ、入力した分だけポイントが増えます。
      </Muted>

      {TIER_TITLES.map((title, tier) => {
        const fields = FIELDS.filter((f) => f.rank === tier);
        const locked = tier > rankIdx;
        const need = RANKS[tier].at - S.pt;
        const allOn = fields.every((f) => S.palette[f.k]);
        return (
          <View key={tier} style={{ gap: 8, opacity: locked ? 0.7 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Lbl>{`${locked ? '🔒 ' : ''}${RANKS[tier].n}から｜${title}`}</Lbl>
              </View>
              {locked ? (
                <Text style={{ fontFamily: mono, fontSize: 11.5, color: C.crit, fontWeight: '800' }}>あと {need.toLocaleString()}pt</Text>
              ) : (
                <Btn small kind="ghost" label={allOn ? 'すべてOFF' : 'すべてON'} onPress={() => setTier(tier, !allOn)} />
              )}
            </View>
            {fields.map((f) => {
              const on = !locked && !!S.palette[f.k];
              return (
                <Pressable
                  key={f.k}
                  disabled={locked}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: on, disabled: locked }}
                  onPress={() => toggle(f.k)}
                  style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14 }, on && { borderColor: C.indigo, backgroundColor: C.indigoSoft }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '700', color: C.ink }}>{f.n}</Text>
                    {f.hint ? <Text style={{ fontSize: 11.5, color: C.ink3 }}>{f.hint}</Text> : null}
                  </View>
                  <Text style={{ fontFamily: mono, color: C.good, fontWeight: '800' }}>+{f.pt}pt</Text>
                  <Text style={{ fontSize: 18 }}>{locked ? '🔒' : on ? '✅' : '⬜'}</Text>
                </Pressable>
              );
            })}
          </View>
        );
      })}
      <Btn label="投稿画面にもどる" onPress={() => go('post')} />
    </ScrollView>
  );
}
