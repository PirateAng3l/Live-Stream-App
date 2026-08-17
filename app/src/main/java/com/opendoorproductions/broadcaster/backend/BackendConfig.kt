package com.opendoorproductions.broadcaster.backend

import com.opendoorproductions.broadcaster.BuildConfig

/**
 * Reads the Supabase project URL/anon key baked in at build time from
 * local.properties (see app/build.gradle.kts). Neither value is a secret
 * in the "must never leak" sense — the anon key is meant to be embedded in
 * client apps, real access control is RLS — but they're still
 * environment-specific and don't belong hardcoded or checked into git.
 */
object BackendConfig {
    val supabaseUrl: String = BuildConfig.SUPABASE_URL.trimEnd('/')
    val supabaseAnonKey: String = BuildConfig.SUPABASE_ANON_KEY

    val isConfigured: Boolean
        get() = supabaseUrl.isNotBlank() && supabaseAnonKey.isNotBlank()
}
