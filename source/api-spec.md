# ImaKuite!Inspector! API仕様 v1.0

対象: リリース範囲（設計仕様書 第14章「ローンチから外すもの」を除く）
ベースURL: `{API_BASE_URL}/v1` — 設定値。heteml契約の既存ドメインのサブドメイン（例 `https://api.<既存ドメイン>/v1`）を割り当てる。ドメイン確定時に、この1か所を変えるだけで済むようクライアントは定数で保持する。
認証: 全エンドポイント共通で `Authorization: Bearer <session_token>`（未ログイン時のみ例外）
形式: JSON。日時はISO 8601 UTC。金額は円の整数。

---

## 0. 共通仕様

### エラー形式
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "satisfaction は必須です", "field": "satisfaction" } }
```

### べき等性
書き込み系のうち `POST /visits` は `Idempotency-Key` ヘッダ必須（クライアントが生成するUUID）。
同じキーでの再送は既存レコードを返し、新規作成しない（schema.sql `visit.idempotency_key`）。

### 可視性（第8章 Tier制御）
一覧・詳細系レスポンスは、閲覧者のTierと「本人が過去に入力したことのある項目か」の両方でフィールドをマスクする。
マスクされたフィールドは値を返さず `"masked": true` を返す（黒塗り表示に対応）。

---

## 1. 認証

### `POST /auth/register/options`
パスキー登録用のWebAuthn Challengeを発行。
```json
{ "codename": "調査官・サバの塩焼" }
```
→ WebAuthn `PublicKeyCredentialCreationOptions` を返す。同時に `public_id` を採番。

### `POST /auth/register/verify`
クライアントが作成したCredentialを検証し、`inspector` / `inspector_credential` を作成。
→ `{ "public_id": "IKI-8FQ2-K7M3", "session_token": "..." }`

### `POST /auth/login/options` → `POST /auth/login/verify`
通常ログイン。既存端末のCredentialで認証。

### `POST /auth/devices/add/options` → `verify`
2台目以降の端末追加。**要件**: 既存端末でのセッションが有効な状態で呼ぶ（新規登録経路と分離）。

### `POST /auth/recovery/redeem`
```json
{ "recovery_phrase": "24語..." }
```
→ 検証後、新しい復旧キーを自動再発行し、旧キーは失効。

---

## 2. プロフィール（任意項目）

### `GET /me`
`inspector` + `inspector_profile` + 現在のIKP残高・階級を返す。

### `PATCH /me/profile`
```json
{ "gender": "unspecified", "age_band": 30, "nationality": "JP", "height_bucket_cm": 170 }
```
すべて任意。送らなければ未回答のまま。

### `POST /me/body-log`
```json
{ "measured_at": "2026-08-29", "weight_bucket_kg": 65 }
```
体重は `inspector_profile` ではなくここに時系列で記録（#13/#17）。

### `GET /me/body-log?from=&to=`
折れ線グラフ用の推移データ。

### `PATCH /me/allergens`
```json
{ "allergen_bits": 5, "consent": true }
```
`consent: true` が無ければ更新しない。既定は端末内保持のみで、この呼び出し自体が「サーバへの送信に同意した」ことを意味する。

---

## 3. 店舗

### `GET /shops/search?lat=&lng=&radius_m=&q=&genre=`
近傍検索。`geohash` 前方一致 + 距離フィルタで絞り込み、実距離でソート。

### `GET /shops/{id}`
店舗詳細。`review_count`（#52。3件未満は `null` で「調査待ち」表示）を含む。

### `POST /shops`
```json
{ "name": "中華そば 六道", "lat": 34.6626, "lng": 133.9198, "genre": "ramen" }
```
新規登録。外観写真1枚が別途 `POST /shops/{id}/photos` で必要（審査キューに入るまでは `status: pending_review` 扱いでも良い）。
成功時、`point_ledger` に `first_visit_bonus` (自分は未踏 +30) または全体初登録なら `new_shop_bonus` (+100) を計上。

### `GET /shops/{id}/reviews?sort=&filter=`
一覧表（#65）。ランクに応じた列のみ返す。CSV書き出しは `Accept: text/csv` かつ呼び出し元が一等以上。

---

## 4. 来店・調査票

### `POST /visits`
潜入開始。ヘッダに `Idempotency-Key` 必須。
```json
{ "shop_id": "...", "entered_at": "2026-08-29T11:02:00Z" }
```
サーバ側で `weather` `temp_c` `pressure_hpa` を **Open-Meteo** から自動補完（キャッシュ優先、#20）。
APIキー・登録とも不要。`GET https://api.open-meteo.com/v1/forecast?latitude=&longitude=&current=temperature_2m,surface_pressure,weather_code`。
市区町村×時間帯単位でキャッシュし、同一エリアの投稿が増えても外部呼び出しは増やさない。取得に失敗した場合は3項目をNULLのまま保存し、投稿自体は成立させる（気象取得の失敗で投稿を落とさない）。
→ `{ "visit_id": "...", "gauge_percent": 8 }`

### `PATCH /visits/{id}`
調査票への追記。**部分更新**。呼ぶたびに `gauge_percent`（捜査進捗）を再計算して返す。
```json
{ "hunger_before": 70, "party_size": 1, "mood": "normal" }
```

### `POST /visits/{id}/dishes`
皿カード追加。1来店に複数回呼べる。
```json
{ "name": "デミカツ丼", "price_yen": 980, "volume": "just_right", "taste_umami": 4 }
```

### `PUT /visits/{id}/score`
`visit_score` の作成・更新。`satisfaction` のみ必須。

### `POST /visits/{id}/photos`
```json
{ "dish_id": "...", "storage_url": "https://<既存ドメイン>/img/2026/08/...", "ai_labels": "ramen,pork" }
```
アップロード自体は `POST /uploads/sign` で発行した短命トークン付きURLへクライアントから直接PUTし、ここではメタデータのみ登録。

### `POST /visits/{id}/leave`
離脱打刻。
```json
{ "left_at": "2026-08-29T12:10:00Z", "estimated": false }
```
`estimated: true` は90分後ローカル通知からの確認フロー（#22）。

### `POST /visits/{id}/submit`
提出。以降は原則 `PATCH` 不可（訂正は下記の訂正APIへ誘導）。
- `visit_score.satisfaction` と最低1枚の写真、`shop_id` が揃っていることを検証
- `point_ledger` に該当する加点行を一括計上（`status: pending`）
- レスポンスに獲得予定IKPの内訳を返す（提出演出用）

---

## 5. 訂正

### `POST /corrections`
```json
{
  "target_table": "dish",
  "target_id": "...",
  "field": "price_yen",
  "new_value": "1080",
  "reason": "レシート確認による訂正"
}
```
サーバ側で対象行を直接UPDATEし、同時に `revision` へ旧値・新値を追記。
`is_self_correction` と経過時間から72時間ルール（#64）を自動判定し、ペナルティの要否を決める。

### `GET /corrections?target_table=&target_id=`
訂正履歴の閲覧。本人と上位ランクのみ全履歴、それ以外は「訂正済」バッジの有無だけ。

---

## 6. 指摘・検証

### `POST /report-flags`
```json
{ "target_table": "visit_score", "target_id": "...", "reason": "価格が実際と異なる" }
```

### `POST /report-flags/{id}/verify`
独立検証の1票を投じる（特別監察官または一般調査官の合意カウント、役割は認可ミドルウェアで判定）。
`verified_by_count` が3に到達、または特別監察官2名の承認で `verdict` を自動確定。

### `GET /report-flags?status=pending&assignee=me`
検証キュー（Tier 5 / 運営専用）。

---

## 7. ポイント・階級

### `GET /me/points?status=&from=&to=`
`point_ledger` の明細。残高は `SUM(amount WHERE status IN (pending, fixed))` で都度算出。

### `GET /ranks`
階級テーブル（静的データ。第5章の表と同一値）。

---

## 8. 特命ルーレット

### `POST /missions/roulette`
```json
{ "lat": 34.6626, "lng": 133.9198, "radius_m": 1500, "budget_max": 2000, "genre": null, "hunger": 70 }
```
条件で母集団を3〜12件に絞り込んでからサーバ側で1件抽選。**クライアントでは絞り込み後の演出（ホイール回転）のみ行い、当選判定はサーバが行う**（不正防止）。
→ `{ "mission_id": "...", "shop": {...}, "expires_at": "...+24h" }`

### `POST /missions/{id}/complete`
```json
{ "visit_id": "...", "fit_score": 4 }
```
達成報告。期限内であることを検証し、`point_ledger` に `roulette_bonus` (+25) を計上。`fit_score` は推薦モデルの教師信号として別途集計。

---

## 9. 集計（ポーリング用）

### `GET /stats/live`
```json
{ "active_inspectors_today": 412, "posting_now": 17 }
```
`stat_snapshot` から読むだけ。クライアントは30秒間隔でポーリング（#51）。

### `GET /stats/shops/{id}`
`review_count`（全体・直近30日）、平均満足度（3件未満は `null`）。

---

## 10. アップロード

### `POST /uploads/sign`
```json
{ "content_type": "image/webp", "purpose": "visit_photo" }
```
→ 短命トークン付きPUT URL（5分有効）と、確定後に使う `storage_url` を返す。

**保管先（#47・#48）**: 当面は heteml 内の `/img/YYYY/MM/` に置く。ただし保存先は `PhotoStorage` インタフェース1つに閉じ込め、`HetemlStorage` / `R2Storage` の実装差し替えだけで移行できるようにする。`storage_url` は絶対URLの文字列なので、移行時もDBスキーマの変更は不要。

**アップロード前にクライアント側で必ず行う処理**:
1. EXIF除去（撮影場所・機種）　2. 顔の自動ぼかし　3. 長辺1600pxへ縮小　4. WebP変換（1枚200KB前後）

配信はPHPを通さず静的配信にする（共有サーバの実行時間・転送量を節約）。

---

## 11. アカウント管理（ストア審査必須要件）

### `DELETE /me`
アカウント削除。`inspector` は物理削除せず `status: frozen` にした上で `codename` を匿名化し、`inspector_credential` を全失効。
関連する `visit` 等の記録データは統計的価値のため匿名IDのまま残す（個人と紐づく情報は既に持っていないため、削除しても支障がない設計になっている）。

---

## エンドポイント一覧（早見表）

| メソッド | パス | 認証 | 備考 |
|---|---|---|---|
| POST | /auth/register/options | 不要 | |
| POST | /auth/register/verify | 不要 | |
| POST | /auth/login/options | 不要 | |
| POST | /auth/login/verify | 不要 | |
| POST | /auth/devices/add/options | 要 | |
| POST | /auth/recovery/redeem | 不要 | |
| GET | /me | 要 | |
| PATCH | /me/profile | 要 | |
| POST | /me/body-log | 要 | |
| GET | /me/body-log | 要 | |
| PATCH | /me/allergens | 要 | |
| DELETE | /me | 要 | |
| GET | /shops/search | 要 | |
| GET | /shops/{id} | 要 | |
| POST | /shops | 要 | |
| GET | /shops/{id}/reviews | 要 | Tier制御 |
| POST | /visits | 要 | Idempotency-Key必須 |
| PATCH | /visits/{id} | 要 | |
| POST | /visits/{id}/dishes | 要 | |
| PUT | /visits/{id}/score | 要 | |
| POST | /visits/{id}/photos | 要 | |
| POST | /visits/{id}/leave | 要 | |
| POST | /visits/{id}/submit | 要 | |
| POST | /corrections | 要 | |
| GET | /corrections | 要 | |
| POST | /report-flags | 要 | |
| POST | /report-flags/{id}/verify | 要 | |
| GET | /report-flags | 要 | Tier 5 |
| GET | /me/points | 要 | |
| GET | /ranks | 不要 | |
| POST | /missions/roulette | 要 | |
| POST | /missions/{id}/complete | 要 | |
| GET | /stats/live | 不要 | |
| GET | /stats/shops/{id} | 不要 | |
| POST | /uploads/sign | 要 | |

## v1.1以降に追加（今回スコープ外・第14章参照）

- `POST /shops/{id}/menu`（店舗アカウントからの一次情報）
- `GET /me/taste-fingerprint`（味覚指紋）
- `GET /recommendations/buddies`（相棒レーダー）
- 写真からの料理名・量のオンデバイス推論結果を使った候補提示API
