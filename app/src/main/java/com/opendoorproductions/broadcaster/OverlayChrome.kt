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
 * Each slot draws a real image when one is provided (aspect-fit, centered, then
 * resized by the asset's own scale), falling back to placeholder text when it
 * isn't — lets the app work with or without uploaded sponsor assets.
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
    private val prefixTextPaint = textPaint(height * 0.026f, Paint.Align.LEFT).apply {
        color = Color.parseColor("#D8DEE4")
    }

    fun panelPaint(): Paint = panelPaint

    fun drawLogo(canvas: Canvas, logo: OverlayAsset) {
        if (logo.bitmap != null) {
            val right = width * 0.98f
            val top = height * 0.03f
            val bounds = RectF(right - width * 0.20f, top, right, top + height * 0.09f)
            drawBitmapFit(canvas, logo.bitmap, bounds, logo.scale)
            return
        }
        if (logo.text.isBlank()) return
        canvas.drawText(logo.text.uppercase(), width * 0.98f, height * 0.08f, logoPaint)
    }

    fun drawSponsors(canvas: Canvas, headlinePrefix: String, headline: OverlayAsset, left: OverlayAsset, right: OverlayAsset) {
        drawHeadline(canvas, headlinePrefix, headline)

        val barHeight = height * 0.09f
        val cornerWidth = width * 0.11f
        val cornerHeight = barHeight * 0.72f
        val margin = height * 0.02f
        val cornerTop = height - barHeight - margin - cornerHeight

        drawCorner(canvas, left, RectF(margin, cornerTop, margin + cornerWidth, cornerTop + cornerHeight))
        drawCorner(canvas, right, RectF(width - margin - cornerWidth, cornerTop, width - margin, cornerTop + cornerHeight))
    }

    private fun drawHeadline(canvas: Canvas, prefix: String, asset: OverlayAsset) {
        val hasContent = asset.bitmap != null || asset.text.isNotBlank()
        if (!hasContent && prefix.isBlank()) return

        val barHeight = height * 0.09f
        val top = height - barHeight
        canvas.drawRect(0f, top, width.toFloat(), height.toFloat(), sponsorBarPaint)

        if (prefix.isNotBlank()) {
            canvas.drawText(prefix.uppercase(), width * 0.04f, top + barHeight * 0.65f, prefixTextPaint)
        }
        if (!hasContent) return

        val contentLeft = if (prefix.isNotBlank()) width * 0.42f else 0f
        val contentRight = width * 0.96f

        if (asset.bitmap != null) {
            val pad = barHeight * 0.12f
            val bounds = RectF(contentLeft, top + pad, contentRight, height - pad)
            drawBitmapFit(canvas, asset.bitmap, bounds, asset.scale)
        } else {
            val centerX = (contentLeft + contentRight) / 2f
            canvas.drawText(asset.text.uppercase(), centerX, top + barHeight * 0.65f, sponsorTextPaint)
        }
    }

    private fun drawCorner(canvas: Canvas, asset: OverlayAsset, rect: RectF) {
        if (asset.bitmap == null && asset.text.isBlank()) return
        canvas.drawRoundRect(rect, 10f, 10f, cornerBgPaint)
        if (asset.bitmap != null) {
            val pad = rect.height() * 0.12f
            val bounds = RectF(rect.left + pad, rect.top + pad, rect.right - pad, rect.bottom - pad)
            drawBitmapFit(canvas, asset.bitmap, bounds, asset.scale)
        } else {
            canvas.drawText(asset.text.uppercase(), rect.centerX(), rect.centerY() + cornerTextPaint.textSize * 0.35f, cornerTextPaint)
        }
    }

    private fun drawBitmapFit(canvas: Canvas, bitmap: Bitmap, bounds: RectF, scale: Float) {
        val bitmapAspect = bitmap.width.toFloat() / bitmap.height.toFloat()
        val boundsAspect = bounds.width() / bounds.height()
        val fitted = if (bitmapAspect > boundsAspect) {
            val h = bounds.width() / bitmapAspect
            RectF(bounds.left, bounds.centerY() - h / 2f, bounds.right, bounds.centerY() + h / 2f)
        } else {
            val w = bounds.height() * bitmapAspect
            RectF(bounds.centerX() - w / 2f, bounds.top, bounds.centerX() + w / 2f, bounds.bottom)
        }
        val scaledWidth = fitted.width() * scale
        val scaledHeight = fitted.height() * scale
        val dst = RectF(
            fitted.centerX() - scaledWidth / 2f,
            fitted.centerY() - scaledHeight / 2f,
            fitted.centerX() + scaledWidth / 2f,
            fitted.centerY() + scaledHeight / 2f
        )
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
