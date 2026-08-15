package com.opendoorproductions.broadcaster

import android.graphics.Bitmap

/**
 * One overlay slot's content: a fallback label plus an optional uploaded image.
 * When bitmap is set, OverlayChrome draws the image instead of the text, aspect-fit
 * within the slot's default box, then resized around its own center by [scale] and
 * shifted vertically by [offsetY] (a fraction of the overlay's full height) — different
 * logos need different sizing AND positioning since their aspect ratios and native
 * proportions vary, so a single fixed box/anchor never looks right for every asset.
 */
data class OverlayAsset(
    val text: String,
    val bitmap: Bitmap? = null,
    val scale: Float = 1f,
    val offsetY: Float = 0f
)
