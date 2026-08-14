package com.opendoorproductions.broadcaster

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
 */
class OverlayChrome(private val width: Int, private val height: Int) {

    private val panelPaint = solid(160, "#0A1018")
    private val cornerBgPaint = solid(170, "#14181E")
    private val sponsorBarPaint = solid(180, "#14181E")

    private val logoPaint = textPaint(height * 0.03f, Paint.Align.RIGHT)
    private val cornerTextPaint = textPaint(height * 0.02f, Paint.Align.CENTER)
    private val sponsorTextPaint = textPaint(height * 0.032f, Paint.Align.CENTER).apply {
        color = Color.parseColor("#F2B33D")
    }

    fun panelPaint(): Paint = panelPaint

    fun drawLogo(canvas: Canvas, businessLabel: String) {
        if (businessLabel.isBlank()) return
        canvas.drawText(businessLabel.uppercase(), width * 0.98f, height * 0.08f, logoPaint)
    }

    fun drawSponsors(canvas: Canvas, headline: String, left: String, right: String) {
        val barHeight = height * 0.09f
        if (headline.isNotBlank()) {
            val top = height - barHeight
            canvas.drawRect(0f, top, width.toFloat(), height.toFloat(), sponsorBarPaint)
            canvas.drawText(headline.uppercase(), width / 2f, top + barHeight * 0.65f, sponsorTextPaint)
        }

        val cornerWidth = width * 0.11f
        val cornerHeight = barHeight * 0.72f
        val margin = height * 0.02f
        val cornerTop = height - barHeight - margin - cornerHeight

        if (left.isNotBlank()) {
            val rect = RectF(margin, cornerTop, margin + cornerWidth, cornerTop + cornerHeight)
            canvas.drawRoundRect(rect, 10f, 10f, cornerBgPaint)
            canvas.drawText(left.uppercase(), rect.centerX(), rect.centerY() + cornerTextPaint.textSize * 0.35f, cornerTextPaint)
        }
        if (right.isNotBlank()) {
            val rect = RectF(width - margin - cornerWidth, cornerTop, width - margin, cornerTop + cornerHeight)
            canvas.drawRoundRect(rect, 10f, 10f, cornerBgPaint)
            canvas.drawText(right.uppercase(), rect.centerX(), rect.centerY() + cornerTextPaint.textSize * 0.35f, cornerTextPaint)
        }
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
