# WebView + JavaScript を使うため、JavascriptInterface は保持する
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
