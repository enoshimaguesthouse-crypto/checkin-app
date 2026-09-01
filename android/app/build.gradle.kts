import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.enoshima.checkin"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.enoshima.checkin"
        minSdk = 24          // Android 7.0 以上（WebView の getUserMedia が安定して動く下限）
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // リリースAPK生成時に走る lint（コード品質の自動チェック）を無効化する。
    // Android Studio 同梱のJDKが 25 系のため lint 側が
    //   :app:lintVitalAnalyzeRelease / java.lang.IllegalArgumentException: 25.0.2
    // で落ちてAPKを出力できない。lintはアプリの動作には無関係な静的チェックで、
    // 本アプリはWebViewを1枚表示するだけの薄い外殻のため、無効化して支障はない。
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

// Kotlin 2.x の書き方（旧 kotlinOptions は非推奨）
kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("androidx.webkit:webkit:1.11.0")
}
