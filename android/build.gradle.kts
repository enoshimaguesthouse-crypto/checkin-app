// Android Studio 同梱の JDK が 25 系のため、それを解釈できる Kotlin 2.x を使う。
// Kotlin 1.9 系だとビルド時に
//   Daemon compilation failed / java.lang.IllegalArgumentException: 25.0.2
// で失敗する（JDKのバージョン文字列をパースできないため）。
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.2.20" apply false
}
