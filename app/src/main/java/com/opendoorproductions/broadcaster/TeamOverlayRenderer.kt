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
 * The square mark to the left of each team's name/score used to be a flat colour
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

    private val nameBaseSize = height * 0.028f
    private val nameMinSize = height * 0.019f
    private val namePaint = textPaint(nameBaseSize, Paint.Align.LEFT)
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
        val rowHeight = height * 0.085f
        // Square — matches the row's own height instead of the old sliver
        // (6% of boardWidth) a flat colour block could get away with. A
        // normal square emblem/logo now reads clearly instead of being
        // squeezed thin; drawTeamMark/drawBitmapFit still aspect-fit within
        // these bounds, so a non-square upload is never stretched.
        val stripeWidth = rowHeight

        canvas.drawRoundRect(
            RectF(left, top, left + boardWidth, top + rowHeight * 2), 14f, 14f, chrome.panelPaint()
        )
        drawTeamMark(canvas, homeTeamLogo, homeStripePaint, RectF(left, top, left + stripeWidth, top + rowHeight))
        drawTeamMark(
            canvas, awayTeamLogo, awayStripePaint,
            RectF(left, top + rowHeight, left + stripeWidth, top + rowHeight * 2)
        )

        val nameX = left + stripeWidth + 16f
        val scoreCenterX = left + boardWidth - boardWidth * 0.14f
        // Score column reserves its own width regardless of digit count (a
        // long team name shouldn't be able to push into it) — drawFittedName
        // shrinks, then as a last resort truncates with an ellipsis, rather
        // than ever overlapping the score.
        val nameMaxWidth = scoreCenterX - height * 0.07f - nameX
        drawFittedName(canvas, state.homeName, nameX, top + rowHeight * 0.62f, nameMaxWidth)
        drawFittedName(canvas, state.awayName, nameX, top + rowHeight * 1.62f, nameMaxWidth)

        canvas.drawText(state.homeScore.toString(), scoreCenterX, top + rowHeight * 0.68f, scorePaint)
        canvas.drawText(state.awayScore.toString(), scoreCenterX, top + rowHeight * 1.68f, scorePaint)
    }

    /**
     * Shrinks namePaint down to nameMinSize before it resorts to an
     * ellipsis, so a slightly-too-long name (e.g. "Revelation High 1st
     * Team") reads in full at a smaller size rather than immediately losing
     * words — only names that don't fit even at the minimum size get cut.
     * namePaint's textSize is mutated in place and reset to nameBaseSize on
     * every call, since it's shared between the home and away rows.
     */
    private fun drawFittedName(canvas: Canvas, name: String, x: Float, y: Float, maxWidth: Float) {
        val text = name.uppercase()
        namePaint.textSize = nameBaseSize
        var size = nameBaseSize
        while (namePaint.measureText(text) > maxWidth && size > nameMinSize) {
            size = (size - height * 0.001f).coerceAtLeast(nameMinSize)
            namePaint.textSize = size
        }
        if (namePaint.measureText(text) <= maxWidth) {
            canvas.drawText(text, x, y, namePaint)
            return
        }
        val ellipsis = "…"
        val ellipsisWidth = namePaint.measureText(ellipsis)
        val fitCount = namePaint.breakText(text, true, maxWidth - ellipsisWidth, null)
        canvas.drawText(text.substring(0, fitCount) + ellipsis, x, y, namePaint)
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
