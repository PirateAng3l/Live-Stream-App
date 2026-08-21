package com.opendoorproductions.broadcaster

import android.app.Application
import android.content.Context
import android.content.SharedPreferences
import androidx.appcompat.app.AppCompatDelegate
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Applies the saved dark/light preference before any Activity (including
 * SplashActivity) inflates — Application.onCreate always runs first, so
 * this is the one place that's guaranteed to be early enough. Defaults to
 * dark, matching the app's original always-dark look, so an install that
 * never touches the new theme switch behaves exactly as it always did.
 *
 * The switch itself (MainActivity's darkModeSwitch) calls
 * AppCompatDelegate.setDefaultNightMode() directly for an immediate
 * runtime change; this class only handles the cold-start case.
 */
class BroadcasterApp : Application() {

    override fun onCreate() {
        super.onCreate()
        val prefs = encryptedPrefs(this)
        val darkMode = prefs.getBoolean(PREF_DARK_MODE, true)
        AppCompatDelegate.setDefaultNightMode(
            if (darkMode) AppCompatDelegate.MODE_NIGHT_YES else AppCompatDelegate.MODE_NIGHT_NO
        )
    }

    companion object {
        // Same file MainActivity already uses for every other saved field
        // (RTMP URL, team names, sponsor picks, ...) — one prefs file for
        // the whole app, not a second one just for this.
        const val PREFS_NAME = "broadcaster_prefs"
        const val PREF_DARK_MODE = "dark_mode"

        /**
         * The RTMP stream key and crew sign-in tokens saved into this same
         * file (see MainActivity) are real credentials, not just UI
         * convenience state — a lost or shared device shouldn't leak them
         * from a plain-text XML file, so this backs the whole prefs file
         * with AndroidX Security's EncryptedSharedPreferences instead (key
         * held in the Android Keystore, never on disk itself). Every read
         * site (this class's cold-start theme check, MainActivity's `prefs`)
         * calls this same function rather than building its own
         * EncryptedSharedPreferences — the master key scheme has to match
         * exactly on both ends or neither side can decrypt what the other
         * wrote.
         *
         * No migration from the old plain-text file: this app hasn't shipped
         * to a real device outside testing yet, so there's no saved state
         * worth preserving — an existing test install just starts fresh
         * once.
         */
        fun encryptedPrefs(context: Context): SharedPreferences {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            return EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        }
    }
}
