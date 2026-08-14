package com.opendoorproductions.broadcaster

import android.graphics.Bitmap

/**
 * One overlay slot's content: a fallback label plus an optional uploaded image.
 * When bitmap is set, OverlayChrome draws the image instead of the text.
 */
data class OverlayAsset(val text: String, val bitmap: Bitmap? = null)
