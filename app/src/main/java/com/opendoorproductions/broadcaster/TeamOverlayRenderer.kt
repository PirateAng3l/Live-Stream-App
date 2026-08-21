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
 *
 * The small mark to the left of each team's name/score used to be a flat colour
 * block (blue for home, red for away). It's now the team's actual logo — the
 * host school's own emblem for home when the crew signed in and loaded a
 * fixture whose school has one uploaded (see MainActivity's
 * homeTeamLogoBitmap), and Open Door Live's own mark otherwise for either
 * side (no per-fixture way to know the real opposing school's emblem — see
 * README). homeTeamLogo/awayTeamLogo always carry *some* bitmap by the time
 * this renders; the flat-colour paints only remain as a last-resort
 * fallback if one is somehow still null (drawTeamMark).
 */
class TeamOverlayRenderer(private val width: Int, private val height: Int) {

    private val chrome = OverlayChrome(width, height)

    private val homeStripePaint = solid(255, "#2FA8E4")
    private val awayStripePaint = solid(255, "#E4392F")

    private val namePaint = textPaint(height * 0.028f, Paint.Align.LEFT)
    private val scorePaint = textPaint(height * 0.045f, Paint.Align.CENTER)
    private val timerPaint = textPaint(height * 0.04f, Paint.Align.CENTER)
    private val periodPaint = textPaint(height * 0.022f, Paint.Align.CENTER).apply { alpha = 210 }

    fun render(
        state: ScoreState,
        logo: OverlayAsset,
        homeTeamLogo: OverlayAsset,
        awayTeamLogo: OverlayAsset,
        periodLabel: String,
        sponsorHeadlinePrefix: String,
        sponsorHeadline: OverlayAsset,
        sponsorLeft: OverlayAsset,
        sponsorRight: OverlayAsset
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawScoreboard(canvas, state, homeTeamLogo, awayTeamLogo)
        drawTimer(canvas, state, periodLabel)
        chrome.drawLogo(canvas, logo)
        chrome.drawSponsors(canvas, sponsorHeadlinePrefix, sponsorHeadline, sponsorLeft, sponsorRight)
        return bitmap
    }

    private fun drawScoreboard(canvas: Canvas, state: ScoreState, homeTeamLogo: OverlayAsset, awayTeamLogo: OverlayAsset) {
        val left = width * 0.02f
        val top = height * 0.04f
        val boardWidth = width * 0.30f
        val rowHeight = height * 0.075f
        val stripeWidth = boardWidth * 0.06f

        canvas.drawRoundRect(
            RectF(left, top, left + boardWidth, top + rowHeight * 2), 14f, 14f, chrome.panelPaint()
        )
        drawTeamMark(canvas, homeTeamLogo, homeStripePaint, RectF(left, top, left + stripeWidth, top + rowHeight))
        drawTeamMark(
            canvas, awayTeamLogo, awayStripePaint,
            RectF(left, top + rowHeight, left + stripeWidth, top + rowHeight * 2)
        )

        val nameX = left + stripeWidth + 16f
        canvas.drawText(state.homeName.uppercase(), nameX, top + rowHeight * 0.62f, namePaint)
        canvas.drawText(state.awayName.uppercase(), nameX, top + rowHeight * 1.62f, namePaint)

        val scoreCenterX = left + boardWidth - boardWidth * 0.14f
        canvas.drawText(state.homeScore.toString(), scoreCenterX, top + rowHeight * 0.68f, scorePaint)
        canvas.drawText(state.awayScore.toString(), scoreCenterX, top + rowHeight * 1.68f, scorePaint)
    }

    private fun drawTeamMark(canvas: Canvas, logo: OverlayAsset, fallbackPaint: Paint, bounds: RectF) {
        if (logo.bitmap != null) {
            chrome.drawBitmapFit(canvas, logo.bitmap, bounds)
        } else {
            canvas.drawRect(bounds, fallbackPaint)
        }
    }

    private fun drawTimer(canvas: Canvas, state: ScoreState, periodLabel: String) {
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

        // Sits directly under the timer pill rather than inside it — sports
        // with no period concept (cricket, Clean Slate/Event) pass an empty
        // label and this just doesn't draw, no gap left behind since nothing
        // else anchors off its position.
        if (periodLabel.isNotBlank()) {
            canvas.drawText(periodLabel.uppercase(), centerX, top + pillHeight + height * 0.025f, periodPaint)
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
