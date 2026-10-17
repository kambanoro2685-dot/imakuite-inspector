import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { friendly } from './account';
import { supabase } from './supabase';

export type Venue = {
  id: string; // shop.id (uuid)
  n: string;
  g: string;
  lat: number;
  lng: number;
  url: string | null;
  /** 評価件数。3件未満は null（調査待ち） */
  reviews: number | null;
  /** 基準点（現在地 or 岡山駅）からの距離[m] */
  dist: number;
};

export type Center = { lat: number; lng: number; source: 'gps' | 'default' };

// 岡山駅（第1期の対象エリア: 岡山市北区・中心部）
export const DEFAULT_CENTER: Center = { lat: 34.6666, lng: 133.9183, source: 'default' };

export const walkMin = (m: number) => Math.max(1, Math.round(m / 80));

type Ctx = {
  venues: Venue[];
  center: Center;
  loading: boolean;
  error: string;
  locating: boolean;
  reload: () => Promise<void>;
  useMyLocation: () => Promise<void>;
  byId: (id: string) => Venue | undefined;
};
const VenueCtx = createContext<Ctx>(null as unknown as Ctx);
export const useVenues = () => useContext(VenueCtx);

export function VenueProvider({ children }: { children: React.ReactNode }) {
  const [center, setCenter] = useState<Center>(DEFAULT_CENTER);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const seen = useRef(new Map<string, Venue>());

  const load = useCallback(async (c: Center) => {
    setLoading(true);
    setError('');
    const { data, error: e } = await supabase.rpc('search_shops', {
      p_lat: c.lat, p_lng: c.lng, p_radius_m: 3000, p_limit: 300,
    });
    if (e) {
      setError(friendly(e));
      setLoading(false);
      return;
    }
    const list: Venue[] = ((data as any[]) ?? []).map((r) => ({
      id: r.id, n: r.name, g: r.genre ?? 'その他', lat: r.lat, lng: r.lng, url: r.url ?? null,
      reviews: r.review_count ?? null, dist: r.distance_m ?? 0,
    }));
    list.forEach((v) => seen.current.set(v.id, v));
    setVenues(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(center); }, [center, load]);

  const reload = useCallback(() => load(center), [center, load]);

  const useMyLocation = useCallback(async () => {
    setLocating(true);
    setError('');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('位置情報が許可されていません。ブラウザの設定で許可してください。');
      const pos = await Location.getCurrentPositionAsync({});
      setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'gps' });
    } catch (e) {
      setError(e instanceof Error ? e.message : '現在地を取得できませんでした。');
    } finally {
      setLocating(false);
    }
  }, []);

  const byId = useCallback((id: string) => seen.current.get(id), []);

  return (
    <VenueCtx.Provider value={{ venues, center, loading, error, locating, reload, useMyLocation, byId }}>
      {children}
    </VenueCtx.Provider>
  );
}
