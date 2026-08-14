package com.opendoorproductions.broadcaster

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface

/**
 * The overlay elements every sport shares regardless of scoreboard style:
 * the business logo corner and the sponsor lower-third + corner slots.
 * Shared by TeamOverlayRenderer and CricketOverlayRenderer so the sponsor
 * placement system (spec 5.5) stays identical across every sport.
 *
 * Each slot draws a real image when one is provided (aspect-fit, centered),
 * falling back to placeholder text when it isn't — lets the app work with
 * or without uploaded sponsor assets.
 */
class OverlayChrome(private val width: Int, private val height: Int) {

    private val panelPaint = solid(160, "#0A1018")
    private val cornerBgPaint = solid(170, "#14181E")
    private val sponsorBarPaint = solid(180, "#14181E")
    private val bitmapPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)

    private val logoPaint = textPaint(height * 0.03f, Paint.Align.RIGHT)
    private val cornerTextPaint = textPaint(height * 0.02f, Paint.Align.CENTER)
    private val sponsorTextPaint = textPaint(height * 0.032f, Paint.Align.CENTER).apply {
        color = Color.parseColor("#F2B33D")
    }

    fun panelPaint(): Paint = panelPaint

    fun drawLogo(canvas: Canvas, logo: OverlayAsset) {
        if (logo.bitmap != null) {
            val right = width * 0.98f
            val top = height * 0.03f
            val bounds = RectF(right - width * 0.20f, top, right, top + height * 0.09f)
            drawBitmapFit(canvas, logo.bitmap, bounds)
            return
        }
        if (logo.text.isBlank()) return
        canvas.drawText(logo.text.uppercase(), width * 0.98f, height * 0.08f, logoPaint)
    }

    fun drawSponsors(canvas: Canvas, headline: OverlayAsset, left: OverlayAsset, right: OverlayAsset) {
        val barHeight = height * 0.09f
        if (headline.bitmap != null || headline.text.isNotBlank()) {
            val top = height - barHeight
            canvas.drawRect(0f, top, width.toFloat(), height.toFloat(), sponsorBarPaint)
            if (headline.bitmap != null) {
                val pad = barHeight * 0.12f
                drawBitmapFit(canvas, headline.bitmap, RectF(width * 0.3f, top + pad, width * 0.7f, height - pad))
            } else {
                canvas.drawText(headline.text.uppercase(), width / 2f, top + barHeight * 0.65f, sponsorTextPaint)
            }
        }

        val cornerWidth = width * 0.11f
        val cornerHeight = barHeight * 0.72f
        val margin = height * 0.02f
        val cornerTop = height - barHeight - margin - cornerHeight

        drawCorner(canvas, left, RectF(margin, cornerTop, margin + cornerWidth, cornerTop + cornerHeight))
        drawCorner(canvas, right, RectF(width - margin - cornerWidth, cornerTop, width - margin, cornerTop + cornerHeight))
    }

    private fun drawCorner(canvas: Canvas, asset: OverlayAsset, rect: RectF) {
        if (asset.bitmap == null && asset.text.isBlank()) return
        canvas.drawRoundRect(rect, 10f, 10f, cornerBgPaint)
        if (asset.bitmap != null) {
            val pad = rect.height() * 0.12f
            drawBitmapFit(canvas, asset.bitmap, RectF(rect.left + pad, rect.top + pad, rect.right - pad, rect.bottom - pad))
        } else {
            canvas.drawText(asset.text.uppercase(), rect.centerX(), rect.centerY() + cornerTextPaint.textSize * 0.35f, cornerTextPaint)
        }
    }

    private fun drawBitmapFit(canvas: Canvas, bitmap: Bitmap, bounds: RectF) {
        val bitmapAspect = bitmap.width.toFloat() / bitmap.height.toFloat()
        val boundsAspect = bounds.width() / bounds.height()
        val dst = if (bitmapAspect > boundsAspect) {
            val h = bounds.width() / bitmapAspect
            val top = bounds.centerY() - h / 2f
            RectF(bounds.left, top, bounds.right, top + h)
        } else {
            val w = bounds.height() * bitmapAspect
            val left = bounds.centerX() - w / 2f
            RectF(left, bounds.top, left + w, bounds.bottom)
        }
        canvas.drawBitmap(bitmap, null, dst, bitmapPaint)
    }

    private fun solid(alpha: Int, hex: String) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.parseColor(hex)
        setAlpha(alpha)
    }

    private fun textPaint(size: Float, align: Paint.Align) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = size
        textAlign = align
        typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
    }
}
