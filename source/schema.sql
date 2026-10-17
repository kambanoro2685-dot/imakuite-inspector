-- ImaKuite!Inspector! — DBスキーマ v1.0
-- 対象: MySQL 8.0 (heteml)
-- 文字コード: utf8mb4 / InnoDB
--
-- 設計原則（設計仕様書 第2章・第4章に準拠）:
--   ・inspector / inspector_profile に氏名・住所・電話・メールは持たない
--   ・体重は inspector_profile ではなく body_log（時系列）に持つ
--   ・すべての訂正は revision に追記し、対象行を直接書き換えない
--   ・ポイント残高は point_ledger の合計から算出する（残高カラムを直接持たない）

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
-- 識別層 — サーバは公開IDと認証情報のみを持つ
-- =====================================================================

CREATE TABLE inspector (
  id            CHAR(36)     NOT NULL COMMENT 'UUIDv7 内部ID',
  public_id     CHAR(13)     NOT NULL COMMENT '例: IKI-8FQ2-K7M3（チェックディジット込み）',
  codename      VARCHAR(16)  NOT NULL COMMENT '調査官コードネーム。本名は禁止（アプリ側で検知）',
  rank          TINYINT      NOT NULL DEFAULT 0 COMMENT '0=見習い 1=三等 2=二等 3=一等 4=主任 5=特別',
  trust_score   SMALLINT     NOT NULL DEFAULT 500 COMMENT '0-1000。第6章の信頼度',
  status        ENUM('active','restricted','frozen') NOT NULL DEFAULT 'active',
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_inspector_public_id (public_id),
  UNIQUE KEY uq_inspector_codename (codename)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='調査官。個人情報を一切保持しない';

CREATE TABLE inspector_credential (
  id              CHAR(36)     NOT NULL COMMENT 'UUIDv7',
  inspector_id    CHAR(36)     NOT NULL,
  public_key      TEXT         NOT NULL COMMENT 'WebAuthn公開鍵（Base64）',
  device_label    VARCHAR(40)  NULL COMMENT '本人にのみ表示する端末メモ（例: iPhone）',
  sign_count      INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'リプレイ検知用カウンタ',
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_used_at    DATETIME(3)  NULL,
  revoked_at      DATETIME(3)  NULL,
  PRIMARY KEY (id),
  KEY idx_cred_inspector (inspector_id),
  CONSTRAINT fk_cred_inspector FOREIGN KEY (inspector_id) REFERENCES inspector(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='端末ごとのパスキー（複数端末に対応）';

CREATE TABLE recovery_key (
  id              CHAR(36)     NOT NULL,
  inspector_id    CHAR(36)     NOT NULL,
  key_hash        CHAR(64)     NOT NULL COMMENT '24語ニーモニックのSHA-256。平文は保存しない',
  used_at         DATETIME(3)  NULL COMMENT '使用済みなら自動失効',
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_recovery_inspector (inspector_id),
  CONSTRAINT fk_recovery_inspector FOREIGN KEY (inspector_id) REFERENCES inspector(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 属性層 — 任意・丸め値のみ。要配慮情報（アレルギー等）は原則クライアント保持
-- =====================================================================

CREATE TABLE inspector_profile (
  inspector_id     CHAR(36)     NOT NULL,
  gender           ENUM('female','male','other','unspecified') NOT NULL DEFAULT 'unspecified',
  age_band         TINYINT      NULL COMMENT '10=10代 20=20代 ... NULLは未回答',
  nationality      CHAR(2)      NULL COMMENT 'ISO 3166-1 alpha-2。NULLは未回答',
  height_bucket_cm SMALLINT     NULL COMMENT '5cm刻みの丸め値',
  allergen_bits    INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '特定原材料28品目のビットフラグ。任意送信',
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (inspector_id),
  CONSTRAINT fk_profile_inspector FOREIGN KEY (inspector_id) REFERENCES inspector(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任意属性。病名・診断名・氏名・住所は持たない';

CREATE TABLE body_log (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  inspector_id    CHAR(36)     NOT NULL,
  measured_at     DATE         NOT NULL,
  weight_bucket_kg SMALLINT    NOT NULL COMMENT '5kg刻みの丸め値',
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_bodylog_inspector_date (inspector_id, measured_at),
  CONSTRAINT fk_bodylog_inspector FOREIGN KEY (inspector_id) REFERENCES inspector(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='体重の時系列ログ（固定プロフィールに置かない: #13/#17）';

-- =====================================================================
-- 記録層 — 店舗・来店・皿・評価。公開前提のデータ
-- =====================================================================

CREATE TABLE shop (
  id                CHAR(36)     NOT NULL,
  name              VARCHAR(80)  NOT NULL,
  name_norm         VARCHAR(80)  NOT NULL COMMENT '表記ゆれ吸収用の正規化名（全角半角統一・空白除去）',
  lat               DECIMAL(9,6) NOT NULL,
  lng               DECIMAL(9,6) NOT NULL,
  geohash           CHAR(9)      NOT NULL COMMENT '近傍検索用。第10章: SPATIAL INDEX不可時のフォールバック',
  genre             VARCHAR(30)  NULL,
  url               VARCHAR(255) NULL,
  seats_range       ENUM('~10','~30','~60','60~') NULL,
  shop_type         ENUM('counter','table','tatami','private_room','food_court') NULL,
  floors            TINYINT      NULL,
  source            ENUM('osm','inspector','shop_account') NOT NULL DEFAULT 'inspector',
  status            ENUM('active','merged','closed') NOT NULL DEFAULT 'active',
  merged_into       CHAR(36)     NULL COMMENT '重複統合時の統合先shop.id',
  created_by        CHAR(36)     NULL COMMENT '新規登録者。#63の初登録ボーナス判定に使用',
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_shop_geohash (geohash),
  KEY idx_shop_name_norm (name_norm),
  CONSTRAINT fk_shop_creator FOREIGN KEY (created_by) REFERENCES inspector(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='店舗マスタ。第1期は岡山市北区・中心部をOSMから初期投入';

CREATE TABLE visit (
  id                CHAR(36)     NOT NULL,
  inspector_id      CHAR(36)     NOT NULL,
  shop_id           CHAR(36)     NOT NULL,
  idempotency_key   CHAR(36)     NOT NULL COMMENT '再送しても重複投稿にならないためのキー',
  entered_at        DATETIME(3)  NOT NULL,
  left_at           DATETIME(3)  NULL,
  left_at_estimated TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '90分後ローカル通知経由の推定値フラグ（#22）',
  party_size        TINYINT      NULL COMMENT '1-20。同行者の氏名・IDは持たない',
  hunger_before     TINYINT      NULL COMMENT '0-100',
  fullness_after    TINYINT      NULL COMMENT '0-100',
  mood              ENUM('great','good','normal','tired','bad') NULL,
  mood_tags         VARCHAR(120) NULL COMMENT 'カンマ区切り: tired,celebration,business,solo,date,rush',
  weather            VARCHAR(20)  NULL COMMENT '気象APIから自動取得',
  temp_c            DECIMAL(4,1) NULL,
  pressure_hpa      DECIMAL(6,1) NULL,
  nearby_count      SMALLINT     NULL COMMENT 'k-匿名性 k>=3。3未満は算出時にNULL扱い(#23)',
  gps_accuracy_m    SMALLINT     NULL,
  comment           TEXT         NULL,
  visibility_scope  ENUM('public','area_recent','nationwide') NOT NULL DEFAULT 'public' COMMENT '第8章Tier制御の元データ',
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_visit_idempotency (idempotency_key),
  KEY idx_visit_inspector (inspector_id, entered_at),
  KEY idx_visit_shop (shop_id, entered_at),
  CONSTRAINT fk_visit_inspector FOREIGN KEY (inspector_id) REFERENCES inspector(id) ON DELETE CASCADE,
  CONSTRAINT fk_visit_shop FOREIGN KEY (shop_id) REFERENCES shop(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='1回の来店=1調査（調査票のヘッダ）';

CREATE TABLE dish (
  id            CHAR(36)     NOT NULL,
  visit_id      CHAR(36)     NOT NULL,
  name          VARCHAR(60)  NULL,
  genre         VARCHAR(30)  NULL,
  price_yen     INT UNSIGNED NULL,
  tax_included  TINYINT(1)   NULL,
  volume        ENUM('less','just_right','more','huge') NULL,
  is_pick       TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '#35の「推し皿」。1来店につき最大1件で運用',
  taste_sweet   TINYINT      NULL COMMENT '0-5',
  taste_salty   TINYINT      NULL,
  taste_sour    TINYINT      NULL,
  taste_bitter  TINYINT      NULL,
  taste_umami   TINYINT      NULL,
  taste_hot     TINYINT      NULL,
  sort_order    TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_dish_visit (visit_id),
  CONSTRAINT fk_dish_visit FOREIGN KEY (visit_id) REFERENCES visit(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='皿カード。1来店に複数枚';

CREATE TABLE visit_score (
  visit_id        CHAR(36)     NOT NULL,
  clean_entrance  TINYINT      NULL COMMENT '0-2 (良/普通/気になる)',
  clean_seating   TINYINT      NULL,
  clean_tableware TINYINT      NULL,
  clean_restroom  TINYINT      NULL,
  clean_kitchen   TINYINT      NULL,
  quietness       TINYINT      NULL COMMENT '0-4（静か〜賑やか）',
  noise_db        SMALLINT     NULL COMMENT '任意計測。録音データは保存しない',
  aroma           TINYINT      NULL COMMENT '0-2',
  texture         TINYINT      NULL,
  temperature     TINYINT      NULL,
  presentation    TINYINT      NULL,
  service         TINYINT      NULL COMMENT '0-4',
  serve_speed_min SMALLINT     NULL,
  wait_min        SMALLINT     NULL,
  crowdedness     TINYINT      NULL COMMENT '0-4',
  payment_methods VARCHAR(80)  NULL COMMENT 'カンマ区切り: cash,ic,credit,qr',
  smoking         ENUM('no','yes','separated') NULL,
  seat_types      VARCHAR(60)  NULL,
  accessibility   TINYINT(1)   NULL,
  multilingual_menu TINYINT(1) NULL,
  kids_friendly   TINYINT(1)   NULL,
  solo_friendly   TINYINT(1)   NULL,
  satisfaction    TINYINT      NOT NULL COMMENT '0-100。必須3項目のひとつ',
  would_return    TINYINT(1)   NULL,
  would_recommend TINYINT(1)   NULL,
  cospa_index     DECIMAL(4,2) NULL COMMENT '相場との比較から自動算出',
  PRIMARY KEY (visit_id),
  CONSTRAINT fk_score_visit FOREIGN KEY (visit_id) REFERENCES visit(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='第9章 店舗評価軸';

CREATE TABLE photo (
  id              CHAR(36)     NOT NULL,
  visit_id        CHAR(36)     NOT NULL,
  dish_id         CHAR(36)     NULL COMMENT 'NULLなら来店全体の写真（外観等）',
  storage_url     VARCHAR(255) NOT NULL COMMENT '画像の絶対URL。保管先非依存（当面はheteml内 /img/YYYY/MM/、逼迫時は外部ストレージへ。移行してもこのカラムは変えない）',
  ai_labels       VARCHAR(200) NULL COMMENT 'オンデバイス推論結果（カンマ区切り）',
  exif_stripped   TINYINT(1)   NOT NULL DEFAULT 1,
  face_blurred    TINYINT(1)   NOT NULL DEFAULT 1,
  sort_order      TINYINT      NOT NULL DEFAULT 0,
  created_at      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_photo_visit (visit_id),
  KEY idx_photo_dish (dish_id),
  CONSTRAINT fk_photo_visit FOREIGN KEY (visit_id) REFERENCES visit(id) ON DELETE CASCADE,
  CONSTRAINT fk_photo_dish FOREIGN KEY (dish_id) REFERENCES dish(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='画像本体は外部（当面はheteml内の静的領域）。ここはURLのみ保持';

-- =====================================================================
-- 訂正履歴 — 上書き禁止。全項目の変更はここに追記する
-- =====================================================================

CREATE TABLE revision (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  target_table  VARCHAR(30)  NOT NULL COMMENT '例: visit, dish, visit_score',
  target_id     CHAR(36)     NOT NULL,
  field         VARCHAR(40)  NOT NULL,
  old_value     TEXT         NULL,
  new_value     TEXT         NULL,
  reason        VARCHAR(120) NULL,
  is_self_correction TINYINT(1) NOT NULL DEFAULT 1 COMMENT '本人による訂正か。72時間以内は減点なし判定に使用',
  changed_by    CHAR(36)     NOT NULL,
  changed_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_revision_target (target_table, target_id),
  KEY idx_revision_changed_by (changed_by, changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='#16/#64 訂正履歴。UPDATE/DELETEでの直接書き換えは禁止運用';

-- =====================================================================
-- ポイント・信頼度
-- =====================================================================

CREATE TABLE point_ledger (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  inspector_id  CHAR(36)     NOT NULL,
  amount        INT          NOT NULL COMMENT '正負両方。残高はSUM(amount)で算出',
  kind          VARCHAR(30)  NOT NULL COMMENT '例: quick_report, clean_5, first_visit_bonus, penalty_wrong_info',
  ref_table     VARCHAR(30)  NULL,
  ref_id        CHAR(36)     NULL,
  status        ENUM('pending','fixed','revoked') NOT NULL DEFAULT 'pending',
  fixed_at      DATETIME(3)  NULL COMMENT '仮→確定になった日時（7日経過 or 検証完了）',
  created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_ledger_inspector (inspector_id, created_at),
  KEY idx_ledger_status (status),
  CONSTRAINT fk_ledger_inspector FOREIGN KEY (inspector_id) REFERENCES inspector(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='ポイント元帳。残高カラムを直接持たない（不正調査のため）';

-- =====================================================================
-- 信憑性検証・指摘
-- =====================================================================

CREATE TABLE report_flag (
  id                CHAR(36)     NOT NULL,
  target_table      VARCHAR(30)  NOT NULL,
  target_id         CHAR(36)     NOT NULL,
  reporter_id       CHAR(36)     NOT NULL,
  reason            VARCHAR(200) NOT NULL,
  verdict           ENUM('pending','upheld','rejected') NOT NULL DEFAULT 'pending',
  verified_by_count TINYINT      NOT NULL DEFAULT 0 COMMENT '独立検証の合意数。3で確定',
  resolved_by       CHAR(36)     NULL COMMENT '特別監察官または運営',
  resolved_at       DATETIME(3)  NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_flag_target (target_table, target_id),
  KEY idx_flag_reporter (reporter_id),
  CONSTRAINT fk_flag_reporter FOREIGN KEY (reporter_id) REFERENCES inspector(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='#28-#32 誤情報の指摘と検証';

-- =====================================================================
-- 特命ルーレット
-- =====================================================================

CREATE TABLE mission (
  id            CHAR(36)     NOT NULL,
  inspector_id  CHAR(36)     NOT NULL,
  kind          ENUM('roulette','seasonal') NOT NULL DEFAULT 'roulette',
  shop_id       CHAR(36)     NOT NULL,
  issued_at     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at    DATETIME(3)  NOT NULL,
  visit_id      CHAR(36)     NULL COMMENT '達成報告と紐付いたvisit',
  fit_score     TINYINT      NULL COMMENT '#57 指令適合度 1-5',
  status        ENUM('open','completed','expired') NOT NULL DEFAULT 'open',
  PRIMARY KEY (id),
  KEY idx_mission_inspector (inspector_id, status),
  CONSTRAINT fk_mission_inspector FOREIGN KEY (inspector_id) REFERENCES inspector(id) ON DELETE CASCADE,
  CONSTRAINT fk_mission_shop FOREIGN KEY (shop_id) REFERENCES shop(id) ON DELETE RESTRICT,
  CONSTRAINT fk_mission_visit FOREIGN KEY (visit_id) REFERENCES visit(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- 事前集計（#51/#52。WebSocket不可のためポーリング用に用意）
-- =====================================================================

CREATE TABLE stat_snapshot (
  stat_key      VARCHAR(60)  NOT NULL COMMENT '例: active_inspectors_today, shop:<id>:review_count',
  window_label  VARCHAR(20)  NOT NULL DEFAULT 'default',
  value         BIGINT       NOT NULL,
  computed_at   DATETIME(3)  NOT NULL,
  PRIMARY KEY (stat_key, window_label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='cronで5分毎に再計算。WebSocketの代替';

SET FOREIGN_KEY_CHECKS = 1;
