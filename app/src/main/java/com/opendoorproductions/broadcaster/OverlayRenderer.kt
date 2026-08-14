package com.opendoorproductions.broadcaster

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface

/**
 * Draws the broadcast HUD (scoreboard, timer, business logo, sponsor slots) onto a
 * transparent bitmap sized to the stream resolution. The bitmap is handed to
 * RootEncoder's full-frame image filter, so whatever this draws is baked into the
 * outgoing RTMP video and the live preview identically (WYSIWYG).
 */
class OverlayRenderer(private val width: Int, private val height: Int) {

    private val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    private val canvas = Canvas(bitmap)

    private val panelPaint = solid(160, "#0A1018")
    private val homeStripePaint = solid(255, "#2FA8E4")
    private val awayStripePaint = solid(255, "#E4392F")
    private val cornerBgPaint = solid(170, "#14181E")
    private val sponsorBarPaint = solid(180, "#14181E")

    private val namePaint = textPaint(height * 0.028f, Paint.Align.LEFT)
    private val scorePaint = textPaint(height * 0.045f, Paint.Align.CENTER)
    private val timerPaint = textPaint(height * 0.04f, Paint.Align.CENTER)
    private val logoPaint = textPaint(height * 0.03f, Paint.Align.RIGHT)
    private val cornerTextPaint = textPaint(height * 0.02f, Paint.Align.CENTER)
    private val sponsorTextPaint = textPaint(height * 0.032f, Paint.Align.CENTER).apply {
        color = Color.parseColor("#F2B33D")
    }

    fun render(
        state: ScoreState,
        businessLabel: String,
        sponsorHeadline: String,
        sponsorLeft: String,
        sponsorRight: String
    ): Bitmap {
        bitmap.eraseColor(Color.TRANSPARENT)
        drawScoreboard(state)
        drawTimer(state)
        drawLogo(businessLabel)
        drawSponsors(sponsorHeadline, sponsorLeft, sponsorRight)
        return bitmap
    }

    private fun drawScoreboard(state: ScoreState) {
        val left = width * 0.02f
        val top = height * 0.04f
        val boardWidth = width * 0.30f
        val rowHeight = height * 0.075f
        val stripeWidth = boardWidth * 0.06f

        canvas.drawRoundRect(
            RectF(left, top, left + boardWidth, top + rowHeight * 2), 14f, 14f, panelPaint
        )
        canvas.drawRect(left, top, left + stripeWidth, top + rowHeight, homeStripePaint)
        canvas.drawRect(left, top + rowHeight, left + stripeWidth, top + rowHeight * 2, awayStripePaint)

        val nameX = left + stripeWidth + 16f
        canvas.drawText(state.homeName.uppercase(), nameX, top + rowHeight * 0.62f, namePaint)
        canvas.drawText(state.awayName.uppercase(), nameX, top + rowHeight * 1.62f, namePaint)

        val scoreCenterX = left + boardWidth - boardWidth * 0.14f
        canvas.drawText(state.homeScore.toString(), scoreCenterX, top + rowHeight * 0.68f, scorePaint)
        canvas.drawText(state.awayScore.toString(), scoreCenterX, top + rowHeight * 1.68f, scorePaint)
    }

    private fun drawTimer(state: ScoreState) {
        val minutes = state.elapsedSeconds / 60
        val seconds = state.elapsedSeconds % 60
        val text = String.format("%02d:%02d", minutes, seconds)

        val centerX = width / 2f
        val top = height * 0.04f
        val pillWidth = width * 0.12f
        val pillHeight = height * 0.06f

        canvas.drawRoundRect(
            RectF(centerX - pillWidth / 2f, top, centerX + pillWidth / 2f, top + pillHeight),
            pillHeight / 2f, pillHeight / 2f, panelPaint
        )
        canvas.drawText(text, centerX, top + pillHeight * 0.68f, timerPaint)
    }

    private fun drawLogo(businessLabel: String) {
        if (businessLabel.isBlank()) return
        canvas.drawText(businessLabel.uppercase(), width * 0.98f, height * 0.08f, logoPaint)
    }

    private fun drawSponsors(headline: String, left: String, right: String) {
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
