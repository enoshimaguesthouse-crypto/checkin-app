# Hotel PMS プロジェクト設定

## Git ワークフロー

- 変更後は確認なしで自動的に commit → deploy → push まで一気に実行する
- PMSは3ファイル構成に分割済み：`pms/hotel_v3.html` + `pms/hotel_v3.css` + `pms/hotel_v3.js`（`<link>`/`<script src>`で相対参照。ビルド不要）。デプロイ時は3ファイルすべてを main へコピーする。
- デプロイ手順：
  1. `master` ブランチで commit
  2. `git show master:pms/hotel_v3.html > /tmp/hotel_v3.html`（css/js も同様に取り出す）
  3. `main` ブランチに checkout して `hotel_v3.html` / `hotel_v3.css` / `hotel_v3.js` をコピー・commit
  4. `git push origin main`
  5. `master` に戻って `git push origin master`
- チェックインアプリは `checkin/checkin_app.html` → main の `checkin-app.html`（単一ファイル）。
- push 完了後に「プッシュ完了しました」と報告する
