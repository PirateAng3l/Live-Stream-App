plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.opendoorproductions.broadcaster"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.opendoorproductions.broadcaster"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0-poc"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
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
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")

    // RTMP/RTSP camera capture + encode + push. Verify latest tag on
    // https://github.com/pedroSG94/RootEncoder/releases (or JitPack) and bump
    // this version if 2.5.2 no longer resolves.
    implementation("com.github.pedroSG94.RootEncoder:library:2.5.2")
}
