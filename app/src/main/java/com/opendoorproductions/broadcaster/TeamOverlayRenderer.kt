package com.opendoorproductions.broadcaster

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface

/**
 * Draws the two-team HUD (scoreboard, timer, business logo, sponsor slots) onto a
 * transparent bitmap sized to the stream resolution. Used by every sport whose score
 * is a simple home/away point count (rugby, soccer, netball, hockey, other) — cricket
 * uses CricketOverlayRenderer instead since its scoreboard doesn't fit this shape.
 */
class TeamOverlayRenderer(private val width: Int, private val height: Int) {

    private val chrome = OverlayChrome(width, height)

    private val homeStripePaint = solid(255, "#2FA8E4")
    private val awayStripePaint = solid(255, "#E4392F")

    private val namePaint = textPaint(height * 0.028f, Paint.Align.LEFT)
    private val scorePaint = textPaint(height * 0.045f, Paint.Align.CENTER)
    private val timerPaint = textPaint(height * 0.04f, Paint.Align.CENTER)

    fun render(
        state: ScoreState,
        logo: OverlayAsset,
        sponsorHeadlinePrefix: String,
        sponsorHeadline: OverlayAsset,
        sponsorLeft: OverlayAsset,
        sponsorRight: OverlayAsset
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawScoreboard(canvas, state)
        drawTimer(canvas, state)
        chrome.drawLogo(canvas, logo)
        chrome.drawSponsors(canvas, sponsorHeadlinePrefix, sponsorHeadline, sponsorLeft, sponsorRight)
        return bitmap
    }

    private fun drawScoreboard(canvas: Canvas, state: ScoreState) {
        val left = width * 0.02f
        val top = height * 0.04f
        val boardWidth = width * 0.30f
        val rowHeight = height * 0.075f
        val stripeWidth = boardWidth * 0.06f

        canvas.drawRoundRect(
            RectF(left, top, left + boardWidth, top + rowHeight * 2), 14f, 14f, chrome.panelPaint()
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

    private fun drawTimer(canvas: Canvas, state: ScoreState) {
        val minutes = state.elapsedSeconds / 60
        val seconds = state.elapsedSeconds % 60
        val text = String.format("%02d:%02d", minutes, seconds)

        val centerX = width / 2f
        val top = height * 0.04f
        val pillWidth = width * 0.12f
        val pillHeight = height * 0.06f

        canvas.drawRoundRect(
            RectF(centerX - pillWidth / 2f, top, centerX + pillWidth / 2f, top + pillHeight),
            pillHeight / 2f, pillHeight / 2f, chrome.panelPaint()
        )
        canvas.drawText(text, centerX, top + pillHeight * 0.68f, timerPaint)
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
