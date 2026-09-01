# ENOSHIMA CHECK-IN（Androidアプリ版）

チェックインアプリ（`checkin-app.html`）を、Androidタブレット上で
「アプリ」として起動するための外殻（WebViewラッパー）です。

## 構成の考え方

- **中身はWeb、外側だけAndroid**。チェックインのロジックは一切Kotlinに移植していません。
- アプリは起動すると以下のURLをフルスクリーンのWebViewで開くだけです。
  ```
  https://enoshimaguesthouse-crypto.github.io/checkin-app/checkin-app.html
  ```
- **今後の機能追加・修正は、これまで通り `checkin/checkin_app.html` を編集して
  mainブランチへデプロイするだけで反映されます。APKの再ビルドは不要です。**
- APKの再ビルドが必要になるのは、次の場合だけです。
  - 読み込み先URLを変える（`MainActivity.kt` の `APP_URL`）
  - アプリ名・アイコンを変える
  - 画面の向きや権限まわりの挙動を変える

## ビルド手順

1. **Android Studio**（Ladybug 以降推奨）をインストールする。
2. Android Studio で `android/` フォルダを開く（`hotel-pms` ではなく `android` を直接開く）。
3. 初回はGradleの同期が走るので、完了まで待つ。
4. タブレットをUSB接続し、開発者オプション →「USBデバッグ」をON。
5. Android Studio の ▶ ボタンで実行。端末にインストールされます。

### 配布用APKを作る場合

```
Build → Generate Signed Bundle / APK → APK → 新しいキーストアを作成 → release
```

生成された `app-release.apk` をタブレットに転送してインストールします。
（初回は「提供元不明のアプリ」のインストール許可が必要です）

## 仕様（実装済みの要件）

| 要件 | 実装箇所 |
|---|---|
| WebViewのみのフルスクリーンActivity | `MainActivity.kt` |
| JavaScript / DOM Storage / Cookie 有効化 | `configureWebView()` |
| メディア自動再生許可（音声案内用） | `mediaPlaybackRequiresUserGesture = false` |
| 混在コンテンツ許可 | `MIXED_CONTENT_ALWAYS_ALLOW` |
| オフライン時のキャッシュ利用 | `cacheMode`（オンライン=`LOAD_DEFAULT` / オフライン=`LOAD_CACHE_ELSE_NETWORK`） |
| **カメラ権限のブリッジ** | `onPermissionRequest()` で `request.grant()` |
| ランタイム権限要求 | `requestRuntimePermissions()`（起動時） |
| ファイル選択・撮影フォールバック | `onShowFileChooser()` + FileProvider |
| 没入モード（バー完全非表示） | `setupImmersiveMode()` |
| 横向き固定 | Manifest `screenOrientation="sensorLandscape"` |
| 戻るキーで `goBack()` | `setupBackHandling()` |
| 外部ブラウザ起動の抑止 | `shouldOverrideUrlLoading()` |

## 運用上の注意

### 画面の向きについて
`sensorLandscape` にしてあります。「横向き固定」ですが、タブレットを
180度ひっくり返した場合だけ追従します（スタンドの向きに関係なく正しく表示されるため）。
完全に一方向へ固定したい場合は Manifest を `landscape` に変更してください。

### 「戻る」キーの挙動
履歴が無い状態で戻るキーを押しても**アプリは終了しません**（キオスク運用のため）。
終了できるようにしたい場合は `setupBackHandling()` 内の `Toast` を `finish()` に変更してください。

### キオスクモード（お客様が他アプリを触れないようにする）
このアプリ単体では、画面を下から強くスワイプするとナビゲーションバーが一時的に出ます。
完全に固定したい場合は、Androidの標準機能を併用してください。

- **画面のピン留め**：設定 → セキュリティ → 画面のピン留め をON
- または、Manifestに `CATEGORY_HOME` を入れてあるので、
  設定 → アプリ → デフォルトのアプリ → ホームアプリ で本アプリを選ぶと、
  ホームボタンでも他の画面へ抜けられなくなります。

### オフライン時の制限
QRコード読み取りに使っている `jsQR` は外部CDN（jsdelivr）から読み込んでいます。
WebViewのキャッシュが効いている間は動きますが、**完全なオフライン動作は保証されません**。
現地のWi-Fiが不安定で困る場合は、jsQRを `checkin-app.html` と同じリポジトリに
同梱する（CDN参照をやめる）改修を別途行うのが確実です。
