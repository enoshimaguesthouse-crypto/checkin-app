# Hotel PMS プロジェクト設定

## Git ワークフロー

- 変更後は確認なしで自動的に commit → deploy → push まで一気に実行する
- PMSは複数ファイル構成に分割済み（`<link>`/`<script src>`で相対参照。ビルド不要）。デプロイ時は下記すべてを main へコピーする：
  - `pms/hotel_v3.html`（本体）
  - `pms/hotel_v3.css`（スタイル）
  - JS（機能別・読込順に依存）：`pms/hotel_v3.cleaning.js` → `pms/hotel_v3.calendar.js` → `pms/hotel_v3.sync.js` → `pms/hotel_v3.pos.js` → `pms/hotel_v3.js`（main。定数/その他/BOOTを含み最後に読込）
  - ※HTMLの`<script>`タグ順を変えないこと（mainは必ず最後。BOOT時点で全関数が揃う必要があるため）
- デプロイ手順：
  1. `master` ブランチで commit
  2. `git show master:pms/<file> > /tmp/<file>`（html/css/js計6ファイルを取り出す）
  3. `main` ブランチに checkout して6ファイル（`hotel_v3.html`/`hotel_v3.css`/`hotel_v3.cleaning.js`/`hotel_v3.calendar.js`/`hotel_v3.sync.js`/`hotel_v3.js`）をコピー・commit
  4. `git push origin main`
  5. `master` に戻って `git push origin master`
- チェックインアプリは `checkin/checkin_app.html` → main の `checkin-app.html`（単一ファイル）。
- push 完了後に「プッシュ完了しました」と報告する
