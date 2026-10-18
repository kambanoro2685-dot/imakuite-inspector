import { Platform } from 'react-native';
import { deleteAllMyPhotos } from './storage';
import { supabase, uuid4 } from './supabase';

export type ServerMe = {
  public_id: string;
  codename: string;
  trust_score: number;
  ikp: number;
  rank: number;
  terms_version: string | null;
};

/** パスキーは現在 Web 版のみ対応（ネイティブは専用モジュールと関連ドメインの設定が要る） */
export const passkeySupported = (): boolean =>
  Platform.OS === 'web' && typeof PublicKeyCredential !== 'undefined' && !!navigator.credentials;

/** Supabase / Postgres / WebAuthn のエラーを、利用者向けの日本語にする */
export function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as any).message) : String(e);
  const name = e instanceof Error ? e.name : '';
  if (name === 'NotAllowedError' || /ERROR_CEREMONY_ABORTED|cancel/i.test(msg)) return 'パスキーの操作がキャンセルされました。';
  if (/codename_taken/.test(msg)) return 'そのコードネームは使われています。別の名前にしてください。';
  if (/invalid_codename/.test(msg)) return 'コードネームは1〜16文字で、使えない文字があります。';
  if (/Anonymous user not allowed/i.test(msg)) return '匿名アカウントにはパスキーを付けられません。いったんログアウトして登録し直してください。';
  if (/Signups not allowed|signup.*disabled/i.test(msg)) return 'Supabase 側で新規登録が無効になっています。（設定手順を参照）';
  if (/passkey|webauthn/i.test(msg) && /disabled|not enabled|not_enabled/i.test(msg)) return 'Supabase 側でパスキーが有効になっていません。（設定手順を参照）';
  if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) return 'サーバに接続できません。';
  if (/score_required/.test(msg)) return '満足度が未入力です。';
  if (/duplicate_shop/.test(msg)) return 'すでに登録されている店です。';
  return msg;
}

export async function fetchMe(): Promise<ServerMe | null> {
  const { data, error } = await supabase.rpc('me');
  if (error) throw error;
  return data as ServerMe | null;
}

/**
 * 新規登録（1/2）: 調査官のアカウントを作り、公開IDを発行する。
 * Supabase は匿名ユーザーにパスキーを付けられないため、使い捨ての合成メール + ランダムなパスワードの
 * 通常アカウントを作る。メールは実在せず（.invalid）、個人情報は入らない。ログインはパスキーだけで行う。
 * ※ Supabase 側で「Confirm email」をオフにしておく必要がある。
 * 失敗してもログイン状態は残すので、コードネームを変えて再試行できる。
 */
export async function startAccount(codename: string): Promise<{ publicId: string }> {
  const cur = await supabase.auth.getSession();
  let session = cur.data.session;
  if (session?.user.is_anonymous) {
    await supabase.auth.signOut({ scope: 'local' });
    session = null;
  }
  if (!session) {
    const email = `${uuid4().replace(/-/g, '')}@users.imakuite.invalid`;
    const { data, error } = await supabase.auth.signUp({ email, password: randomPassword() });
    if (error) throw error;
    if (!data.session) throw new Error('Supabase のメール確認(Confirm email)がオンのため登録できません。（設定手順を参照）');
  }
  const { data, error } = await supabase.rpc('register_inspector', { p_codename: codename });
  if (error) throw error;
  return { publicId: (data as any).public_id as string };
}

function randomPassword(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 新規登録（2/2）／パスキーの追加: ログイン中のアカウントにこの端末のパスキーを登録する */
export async function addPasskey(): Promise<void> {
  const { error } = await supabase.auth.registerPasskey();
  if (error) throw error;
}

/** 登録済みの端末パスキーでログイン */
export async function loginWithPasskey(): Promise<ServerMe> {
  const { error } = await supabase.auth.signInWithPasskey();
  if (error) throw error;
  const me = await fetchMe();
  if (!me) throw new Error('このアカウントは削除されています。');
  return me;
}

export async function hasPasskey(): Promise<boolean> {
  const { data, error } = await supabase.auth.passkey.list();
  return !error && Array.isArray(data) && data.length > 0;
}

export const logout = () => supabase.auth.signOut({ scope: 'local' });

export async function deleteAccount(): Promise<void> {
  await deleteAllMyPhotos().catch(() => {}); // 画像ファイルを先に消す（記録の削除は delete_account）
  const { error } = await supabase.rpc('delete_account');
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' });
}

/** 同意した規約の版をサーバに記録する（ログイン中のアカウントのみ） */
export async function recordTerms(version: string): Promise<void> {
  const { error } = await supabase.rpc('accept_terms', { p_version: version });
  if (error) throw error;
}
