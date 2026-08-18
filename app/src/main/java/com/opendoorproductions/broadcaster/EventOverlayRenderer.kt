package com.opendoorproductions.broadcaster

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface

/**
 * Draws the "clean slate" overlay used by Sport.OTHER: no scoreboard, no
 * timer — just the event's own name (a school assembly, concert, play,
 * whatever doesn't fit a team-vs-team match) plus the same logo/sponsor
 * chrome every other sport gets, via OverlayChrome.
 */
class EventOverlayRenderer(private val width: Int, private val height: Int) {

    private val chrome = OverlayChrome(width, height)
    private val titlePaint = textPaint(height * 0.036f, Paint.Align.LEFT)

    fun render(
        eventName: String,
        logo: OverlayAsset,
        sponsorHeadlinePrefix: String,
        sponsorHeadline: OverlayAsset,
        sponsorLeft: OverlayAsset,
        sponsorRight: OverlayAsset
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawTitle(canvas, eventName)
        chrome.drawLogo(canvas, logo)
        chrome.drawSponsors(canvas, sponsorHeadlinePrefix, sponsorHeadline, sponsorLeft, sponsorRight)
        return bitmap
    }

    private fun drawTitle(canvas: Canvas, eventName: String) {
        if (eventName.isBlank()) return
        val left = width * 0.02f
        val top = height * 0.04f
        val pad = height * 0.02f
        val boxHeight = height * 0.075f
        val boxWidth = titlePaint.measureText(eventName.uppercase()) + pad * 2f

        canvas.drawRoundRect(RectF(left, top, left + boxWidth, top + boxHeight), 14f, 14f, chrome.panelPaint())
        canvas.drawText(eventName.uppercase(), left + pad, top + boxHeight * 0.65f, titlePaint)
    }

    private fun textPaint(size: Float, align: Paint.Align) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = size
        textAlign = align
        typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
    }
}
