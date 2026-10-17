import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { fetchMe } from './src/account';
import { supabase } from './src/supabase';
import { SYNC_DONE } from './src/sync';
import { useSyncer } from './src/useSyncer';
import { ActivityIndicator, Pressable, SafeAreaView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DraftProvider } from './src/draft';
import Home from './src/Home';
import { Go, Screen } from './src/nav';
import Onboarding from './src/Onboarding';
import PostScreen, { Palette } from './src/Post';
import Roulette from './src/Roulette';
import { Search, VenueDetail } from './src/Search';
import My from './src/My';
import { rankOf, StoreProvider, useStore } from './src/store';
import { C, mono } from './src/theme';

const TABS: { k: Screen; icon: string; label: string }[] = [
  { k: 'home', icon: '🏠', label: 'ホーム' },
  { k: 'post', icon: '✍️', label: '投稿' },
  { k: 'search', icon: '🔍', label: 'さがす' },
  { k: 'roulette', icon: '🎯', label: 'ルーレット' },
  { k: 'my', icon: '🎖️', label: 'マイページ' },
];

function Shell() {
  const { S, ready, toast, signedIn, update, showToast } = useStore();
  const syncer = useSyncer();
  const [scr, setScr] = useState<Screen>('home');

  // アプリが前面に戻ったときだけトークンを自動更新する（Supabase の推奨）
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') supabase.auth.startAutoRefresh(); else supabase.auth.stopAutoRefresh();
    });
    supabase.auth.startAutoRefresh();
    return () => { sub.remove(); supabase.auth.stopAutoRefresh(); };
  }, []);

  // アカウントがあるのにログアウト状態（セッション切れ）になったら知らせる
  useEffect(() => {
    if (ready && S.account && !signedIn) showToast('ログインの有効期限が切れました。パスキーで再ログインしてください。');
  }, [ready, signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // 起動時・復帰時: 未送信の投稿を順に再送し、サーバのポイントを反映する
  useEffect(() => {
    if (!ready || !signedIn || !S.account) return;
    let cancelled = false;
    (async () => {
      for (const p of S.posts.filter((x) => x.sync && x.sync.step < SYNC_DONE).reverse()) {
        if (cancelled) return;
        await syncer(p);
      }
      try {
        const me = await fetchMe();
        if (me && !cancelled) update((s) => ({ ...s, pt: me.ikp, trust: Math.round(me.trust_score / 10) }));
      } catch { /* オフライン時は端末の値のまま */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signedIn]);
  const [venueId, setVenueId] = useState(1);
  const go: Go = (to, id) => {
    if (id !== undefined) setVenueId(id);
    setScr(to);
  };
  const tab = scr === 'palette' ? 'post' : scr === 'venue' ? 'search' : scr;

  if (!ready) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.indigo} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.ground, alignItems: 'center' }}>
      <SafeAreaView style={{ flex: 1, width: '100%', maxWidth: 520, backgroundColor: C.ground }}>
        {S.onboarded ? (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 9, backgroundColor: C.indigo }}>
              <Text style={{ fontFamily: mono, color: '#fff', fontWeight: '700', fontSize: 12 }}>{S.uid}</Text>
              <Text style={{ fontFamily: mono, color: '#fff', fontSize: 12 }}>{rankOf(S.pt).n} · {S.pt.toLocaleString()}pt</Text>
            </View>
            <View style={{ flex: 1 }}>
              {scr === 'home' && <Home go={go} />}
              {scr === 'post' && <PostScreen go={go} />}
              {scr === 'palette' && <Palette go={go} />}
              {scr === 'search' && <Search go={go} />}
              {scr === 'venue' && <VenueDetail id={venueId} go={go} />}
              {scr === 'roulette' && <Roulette go={go} />}
              {scr === 'my' && <My />}
            </View>
            <View style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: C.line, backgroundColor: C.surface }}>
              {TABS.map((t) => (
                <Pressable
                  key={t.k}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === t.k }}
                  onPress={() => go(t.k)}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 8, gap: 1 }}
                >
                  <Text style={{ fontSize: 20, opacity: tab === t.k ? 1 : 0.5 }}>{t.icon}</Text>
                  <Text style={{ fontSize: 10.5, fontWeight: tab === t.k ? '800' : '500', color: tab === t.k ? C.indigo : C.ink3 }}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <Onboarding />
        )}
        {toast ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 14, right: 14, bottom: S.onboarded ? 84 : 24, backgroundColor: C.ink, borderRadius: 10, padding: 12 }}>
            <Text style={{ color: '#fff', fontSize: 13, lineHeight: 19 }}>{toast}</Text>
          </View>
        ) : null}
      </SafeAreaView>
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <DraftProvider>
        <Shell />
      </DraftProvider>
    </StoreProvider>
  );
}
