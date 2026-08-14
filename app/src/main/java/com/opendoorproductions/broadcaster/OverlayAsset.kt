package com.opendoorproductions.broadcaster

import android.graphics.Bitmap

/**
 * One overlay slot's content: a fallback label plus an optional uploaded image.
 * When bitmap is set, OverlayChrome draws the image instead of the text, aspect-fit
 * within the slot's default box and then resized around its own center by [scale] —
 * different logos need different sizing since their aspect ratios and native
 * proportions vary, so a single fixed box never looks right for every asset.
 */
data class OverlayAsset(val text: String, val bitmap: Bitmap? = null, val scale: Float = 1f)
