package com.opendoorproductions.broadcaster

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface

/**
 * Draws the cricket-style HUD: one batting team's runs/wickets and the over count,
 * plus a target/chase line when a second innings is in progress. Cricket doesn't fit
 * the two-team simultaneous scoreboard (TeamOverlayRenderer) since only one side bats
 * at a time, so it gets its own layout while still sharing the logo/sponsor chrome.
 */
class CricketOverlayRenderer(private val width: Int, private val height: Int) {

    private val chrome = OverlayChrome(width, height)

    private val teamPaint = textPaint(height * 0.032f, Paint.Align.LEFT)
    private val scorePaint = textPaint(height * 0.052f, Paint.Align.LEFT)
    private val oversPaint = textPaint(height * 0.026f, Paint.Align.LEFT).apply { alpha = 210 }
    private val targetPaint = textPaint(height * 0.024f, Paint.Align.LEFT).apply {
        color = android.graphics.Color.parseColor("#F2B33D")
    }

    fun render(
        state: CricketState,
        logo: OverlayAsset,
        sponsorHeadline: OverlayAsset,
        sponsorLeft: OverlayAsset,
        sponsorRight: OverlayAsset
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawScoreboard(canvas, state)
        chrome.drawLogo(canvas, logo)
        chrome.drawSponsors(canvas, sponsorHeadline, sponsorLeft, sponsorRight)
        return bitmap
    }

    private fun drawScoreboard(canvas: Canvas, state: CricketState) {
        val left = width * 0.02f
        val top = height * 0.04f
        val boardWidth = width * 0.34f
        val hasTarget = state.target != null
        val boardHeight = height * (if (hasTarget) 0.185f else 0.145f)

        canvas.drawRoundRect(
            RectF(left, top, left + boardWidth, top + boardHeight), 14f, 14f, chrome.panelPaint()
        )

        val padding = boardWidth * 0.06f
        val textX = left + padding

        canvas.drawText(state.battingTeam.uppercase(), textX, top + boardHeight * 0.28f, teamPaint)

        val oversText = String.format("%d.%d ov", state.overs, state.legalBallsInOver)
        val scoreLine = "${state.runs}/${state.wickets}"
        canvas.drawText(scoreLine, textX, top + boardHeight * 0.62f, scorePaint)

        val scoreWidth = scorePaint.measureText(scoreLine)
        canvas.drawText(oversText, textX + scoreWidth + 18f, top + boardHeight * 0.62f, oversPaint)

        if (hasTarget) {
            val runsNeeded = (state.target!! - state.runs).coerceAtLeast(0)
            canvas.drawText("Target ${state.target}  ·  need $runsNeeded", textX, top + boardHeight * 0.87f, targetPaint)
        }
    }

    private fun textPaint(size: Float, align: Paint.Align) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.WHITE
        textSize = size
        textAlign = align
        typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
    }
}
