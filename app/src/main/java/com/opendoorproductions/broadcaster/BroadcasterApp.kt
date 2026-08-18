package com.opendoorproductions.broadcaster

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate

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
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
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
    }
}
