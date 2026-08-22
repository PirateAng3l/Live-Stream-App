import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// SUPABASE_URL / SUPABASE_ANON_KEY come from local.properties (gitignored,
// never committed) rather than being hardcoded, same reasoning as the
// Android SDK path Android Studio already puts there. Missing values just
// build empty strings — BackendConfig.isConfigured checks for that so the
// crew sign-in feature degrades to "unavailable" instead of crashing when
// nobody's set up a Supabase project yet. See backend/README.md.
val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) {
        file.inputStream().use { load(it) }
    }
}

// Release signing. The keystore itself is never committed (gitignored,
// see .gitignore) — this just looks for one at a fixed local path so a
// release build works the same way whether it's run here or in CI:
// build-release-apk.yml decodes its RELEASE_KEYSTORE_BASE64 secret to
// exactly this path before calling assembleRelease. Passwords come from
// env vars first (how CI provides them) falling back to local.properties
// (how a dev machine that actually holds the keystore would), same
// fallback shape as SUPABASE_URL/SUPABASE_ANON_KEY above.
//
// Deliberately conditional rather than a hard requirement: assembleDebug
// (what CI builds on every push, build-apk.yml) and a plain local
// assembleRelease with no keystore configured both still need to work —
// this only wires signing in when there's actually something to sign
// with, leaving `release` unsigned otherwise exactly as it always was.
val releaseKeystoreFile = rootProject.file("app/release-keystore.jks")
fun releaseSigningProperty(envName: String, propertyName: String): String? =
    System.getenv(envName)?.takeIf { it.isNotBlank() } ?: localProperties.getProperty(propertyName)?.takeIf { it.isNotBlank() }

android {
    namespace = "com.opendoorproductions.broadcaster"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.opendoorproductions.broadcaster"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0-poc"

        buildConfigField("String", "SUPABASE_URL", "\"${localProperties.getProperty("SUPABASE_URL", "")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${localProperties.getProperty("SUPABASE_ANON_KEY", "")}\"")
    }

    signingConfigs {
        if (releaseKeystoreFile.exists()) {
            create("release") {
                storeFile = releaseKeystoreFile
                storePassword = releaseSigningProperty("RELEASE_KEYSTORE_PASSWORD", "RELEASE_KEYSTORE_PASSWORD")
                keyAlias = releaseSigningProperty("RELEASE_KEY_ALIAS", "RELEASE_KEY_ALIAS")
                keyPassword = releaseSigningProperty("RELEASE_KEY_PASSWORD", "RELEASE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (releaseKeystoreFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")

    // EncryptedSharedPreferences (BroadcasterApp.encryptedPrefs) — the RTMP
    // stream key and crew sign-in tokens are real credentials, not just UI
    // state, so they're encrypted at rest instead of sitting in a plain XML
    // file. Still on a 1.1.0-alpha version because AndroidX Security's
    // Jetifier-era API (MasterKey.Builder) never shipped a stable release
    // past 1.0.0's now-deprecated MasterKeys — alpha06 is the version
    // Google's own EncryptedSharedPreferences docs currently point to.
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // RTMP/RTSP camera capture + encode + push. Verify latest tag on
    // https://github.com/pedroSG94/RootEncoder/releases (or JitPack) and bump
    // this version if 2.5.2 no longer resolves.
    implementation("com.github.pedroSG94.RootEncoder:library:2.5.2")
}
