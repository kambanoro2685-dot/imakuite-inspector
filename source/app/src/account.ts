import { Platform } from 'react-native';
import { supabase } from './supabase';

export type ServerMe = {
  public_id: string;
  codename: string;
  trust_score: number;
  ikp: number;
  rank: number;
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
  if (/anonymous.*(disabled|not allowed)|Anonymous sign-ins are disabled/i.test(msg)) return 'Supabase 側で「匿名サインイン」が有効になっていません。（設定手順を参照）';
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
 * 新規登録（1/2）: 匿名セッションを作り、調査官の行と公開IDを発行する。
 * 失敗しても匿名セッションは残すので、コードネームを変えて再試行できる。
 */
export async function startAccount(codename: string): Promise<{ publicId: string }> {
  const cur = await supabase.auth.getSession();
  if (!cur.data.session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
  }
  const { data, error } = await supabase.rpc('register_inspector', { p_codename: codename });
  if (error) throw error;
  return { publicId: (data as any).public_id as string };
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
  const { error } = await supabase.rpc('delete_account');
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' });
}
