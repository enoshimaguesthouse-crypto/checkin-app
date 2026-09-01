package com.enoshima.checkin

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * チェックインアプリの外殻（WebViewラッパー）。
 *
 * 中身は GitHub Pages 上の checkin-app.html をそのまま読み込む。
 * このActivityは「WebViewを1枚全画面で出す」以上のUIを持たない。
 * 機能追加・修正は HTML/CSS/JS 側で行い、APKの再ビルドは不要。
 */
class MainActivity : ComponentActivity() {

    companion object {
        private const val APP_URL =
            "https://enoshimaguesthouse-crypto.github.io/checkin-app/checkin-app.html"

        /** アプリ内で開いてよいホスト。これ以外は外部ブラウザに委ねる */
        private val ALLOWED_HOSTS = setOf(
            "enoshimaguesthouse-crypto.github.io",
            "script.google.com",       // GAS（データ送信先）
            "script.googleusercontent.com",
            "cdn.jsdelivr.net"         // jsQR の CDN
        )
    }

    private lateinit var webView: WebView

    /** input[type=file] のコールバック保持（カメラ／ギャラリー選択のフォールバック経路用） */
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    /** カメラアプリで撮影した一時ファイルのURI */
    private var cameraImageUri: Uri? = null

    // ── ランタイム権限 ─────────────────────────────────────────────
    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            if (result[Manifest.permission.CAMERA] == false) {
                Toast.makeText(
                    this,
                    "カメラ権限が許可されていません。QRスキャン・本人確認写真が使えません。",
                    Toast.LENGTH_LONG
                ).show()
            }
        }

    // ── ファイル選択（input[type=file] のフォールバック）────────────
    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePathCallback
            filePathCallback = null
            if (callback == null) return@registerForActivityResult

            if (result.resultCode != Activity.RESULT_OK) {
                // キャンセル時は必ず null を返す。返さないと以降 input が反応しなくなる
                callback.onReceiveValue(null)
                cameraImageUri = null
                return@registerForActivityResult
            }

            // カメラアプリは data を返さないので、事前に用意した URI を使う
            val dataUri = result.data?.data
            val uris: Array<Uri>? = when {
                dataUri != null -> arrayOf(dataUri)
                cameraImageUri != null -> arrayOf(cameraImageUri!!)
                else -> null
            }
            callback.onReceiveValue(uris)
            cameraImageUri = null
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 画面を常時点灯（チェックイン端末として置きっぱなしにするため）
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // 起動時にカメラ権限をまとめて要求しておく（WebView側の要求時に即 grant できるように）
        requestRuntimePermissions()

        webView = WebView(this)
        setContentView(webView)

        configureWebView()
        setupImmersiveMode()
        setupBackHandling()

        if (savedInstanceState == null) {
            webView.loadUrl(APP_URL)
        } else {
            webView.restoreState(savedInstanceState)
        }
    }

    // ══════════════════════════════════════════════════════════════
    // WebView 設定
    // ══════════════════════════════════════════════════════════════
    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true                 // localStorage（下書き保存等）
            databaseEnabled = true

            // 音声案内をユーザー操作なしで再生できるようにする
            mediaPlaybackRequiresUserGesture = false

            // ファイルアップロード／端末内ファイルアクセス
            allowFileAccess = true
            allowContentAccess = true

            // オンラインなら最新、オフラインならキャッシュを使う
            cacheMode = if (isOnline()) WebSettings.LOAD_DEFAULT else WebSettings.LOAD_CACHE_ELSE_NETWORK

            // HTTPS ページ内の HTTP リソースを許可（混在コンテンツ）
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

            // タブレットで意図せぬ縮小表示にならないようにする
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)

            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(false)

            // 端末のフォントサイズ設定に引きずられてレイアウトが崩れるのを防ぐ
            textZoom = 100
        }

        // Cookie（GAS のセッション等）
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.webViewClient = AppWebViewClient()
        webView.webChromeClient = AppWebChromeClient()

        // 端末の「戻る」以外でアプリから抜けにくくする（長押しの選択メニュー抑止）
        webView.setOnLongClickListener { true }
        webView.isLongClickable = false
        webView.isHapticFeedbackEnabled = false
        webView.overScrollMode = View.OVER_SCROLL_NEVER
    }

    private inner class AppWebViewClient : WebViewClient() {

        /**
         * 原則すべての遷移を WebView 内で完結させる。
         * 想定外の外部サイト（お客様が誤ってリンクを踏んだ場合など）だけ
         * 外部ブラウザに逃がし、チェックイン画面を汚さないようにする。
         */
        override fun shouldOverrideUrlLoading(
            view: WebView,
            request: WebResourceRequest
        ): Boolean {
            val url = request.url
            val scheme = url.scheme?.lowercase()

            // tel: / mailto: など特殊スキームは対応アプリへ
            if (scheme != null && scheme != "http" && scheme != "https") {
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                    true
                } catch (e: ActivityNotFoundException) {
                    true // 対応アプリが無ければ何もしない（WebViewで開こうとしない）
                }
            }

            val host = url.host ?: return false
            val allowed = ALLOWED_HOSTS.any { host == it || host.endsWith(".$it") }
            return if (allowed) {
                false // WebView 内で読み込む
            } else {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                } catch (e: ActivityNotFoundException) {
                    // 開けないなら何もしない
                }
                true
            }
        }

        override fun onPageFinished(view: WebView, url: String) {
            super.onPageFinished(view, url)
            // 画面読み込み後もフルスクリーンを維持
            setupImmersiveMode()
        }
    }

    private inner class AppWebChromeClient : WebChromeClient() {

        /**
         * 【最重要】HTML 側の navigator.mediaDevices.getUserMedia() に対する
         * WebView の権限要求を自動的に許可する。
         * これを実装しないと、QRスキャン・パスポート撮影が
         * 「カメラを利用できません」で必ず失敗する。
         */
        override fun onPermissionRequest(request: PermissionRequest) {
            runOnUiThread {
                // Android 側のカメラ権限が無い状態で grant しても失敗するため、
                // 未許可なら要求し直した上で拒否する（次回の起動で通るようになる）
                val hasCamera = ContextCompat.checkSelfPermission(
                    this@MainActivity, Manifest.permission.CAMERA
                ) == PackageManager.PERMISSION_GRANTED

                val wantsVideo = request.resources.contains(
                    PermissionRequest.RESOURCE_VIDEO_CAPTURE
                )

                if (wantsVideo && !hasCamera) {
                    requestRuntimePermissions()
                    request.deny()
                    return@runOnUiThread
                }
                // 要求されたリソースをそのまま許可する
                request.grant(request.resources)
            }
        }

        /**
         * input[type=file][capture] のフォールバック経路。
         * getUserMedia が使えない端末でも撮影できるよう、
         * カメラアプリとギャラリーの選択チューザーを出す。
         */
        override fun onShowFileChooser(
            webView: WebView,
            callback: ValueCallback<Array<Uri>>,
            params: FileChooserParams
        ): Boolean {
            // 直前の未完了コールバックが残っていたら解放しておく
            filePathCallback?.onReceiveValue(null)
            filePathCallback = callback

            val cameraIntent = createCameraIntent()

            val galleryIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "image/*"
                addCategory(Intent.CATEGORY_OPENABLE)
            }

            val chooser = Intent(Intent.ACTION_CHOOSER).apply {
                putExtra(Intent.EXTRA_INTENT, galleryIntent)
                putExtra(Intent.EXTRA_TITLE, "写真を選択")
                if (cameraIntent != null) {
                    putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
                }
            }

            return try {
                fileChooserLauncher.launch(chooser)
                true
            } catch (e: ActivityNotFoundException) {
                filePathCallback = null
                callback.onReceiveValue(null)
                false
            }
        }
    }

    /** カメラアプリ起動用 Intent（一時ファイルの URI つき） */
    private fun createCameraIntent(): Intent? {
        return try {
            val dir = File(cacheDir, "captures").apply { mkdirs() }
            val stamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.JAPAN).format(Date())
            val file = File(dir, "checkin_$stamp.jpg")
            val uri = FileProvider.getUriForFile(
                this, "$packageName.fileprovider", file
            )
            cameraImageUri = uri
            Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, uri)
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            }
        } catch (e: Exception) {
            cameraImageUri = null
            null
        }
    }

    // ══════════════════════════════════════════════════════════════
    // 権限
    // ══════════════════════════════════════════════════════════════
    private fun requestRuntimePermissions() {
        val needed = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED
        ) needed.add(Manifest.permission.CAMERA)

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) needed.add(Manifest.permission.RECORD_AUDIO)

        // 画像選択用（Android 13 以降と以前で権限名が違う）
        val mediaPerm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Manifest.permission.READ_MEDIA_IMAGES
        } else {
            Manifest.permission.READ_EXTERNAL_STORAGE
        }
        if (ContextCompat.checkSelfPermission(this, mediaPerm)
            != PackageManager.PERMISSION_GRANTED
        ) needed.add(mediaPerm)

        if (needed.isNotEmpty()) {
            permissionLauncher.launch(needed.toTypedArray())
        }
    }

    // ══════════════════════════════════════════════════════════════
    // フルスクリーン（Immersive Sticky）
    // ══════════════════════════════════════════════════════════════
    private fun setupImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // 通知やダイアログでバーが出た後、再びフルスクリーンへ戻す
        if (hasFocus) setupImmersiveMode()
    }

    override fun onResume() {
        super.onResume()
        setupImmersiveMode()
        webView.onResume()
        webView.resumeTimers()
    }

    override fun onPause() {
        webView.onPause()
        super.onPause()
    }

    // ══════════════════════════════════════════════════════════════
    // 戻る操作
    // ══════════════════════════════════════════════════════════════
    private fun setupBackHandling() {
        onBackPressedDispatcher.addCallback(this) {
            if (webView.canGoBack()) {
                webView.goBack()
            } else {
                // 履歴が無い場合はアプリを終了させない（キオスク運用のため）。
                // 終了させたい場合は下の行を finish() に変更する。
                Toast.makeText(
                    this@MainActivity,
                    "最初の画面です",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }

    /** 音量キー等はそのまま通し、それ以外の意図せぬ端末キーは無視する */
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP,
            KeyEvent.KEYCODE_VOLUME_DOWN,
            KeyEvent.KEYCODE_BACK -> super.onKeyDown(keyCode, event)
            else -> true
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }

    // ══════════════════════════════════════════════════════════════
    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}
