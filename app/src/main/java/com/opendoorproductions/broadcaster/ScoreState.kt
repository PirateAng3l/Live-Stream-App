package com.opendoorproductions.broadcaster

data class ScoreState(
    val homeName: String = "HOME",
    val awayName: String = "AWAY",
    val homeScore: Int = 0,
    val awayScore: Int = 0,
    val elapsedSeconds: Int = 0,
    val timerRunning: Boolean = false
)

class ScoreController {

    var state = ScoreState()
        private set

    private val history = ArrayDeque<ScoreState>()

    fun setNames(home: String, away: String) {
        state = state.copy(
            homeName = home.ifBlank { "HOME" },
            awayName = away.ifBlank { "AWAY" }
        )
    }

    fun adjustHome(delta: Int) {
        pushHistory()
        state = state.copy(homeScore = (state.homeScore + delta).coerceAtLeast(0))
    }

    fun adjustAway(delta: Int) {
        pushHistory()
        state = state.copy(awayScore = (state.awayScore + delta).coerceAtLeast(0))
    }

    fun swapSides() {
        pushHistory()
        state = state.copy(
            homeName = state.awayName,
            awayName = state.homeName,
            homeScore = state.awayScore,
            awayScore = state.homeScore
        )
    }

    fun resetScore() {
        pushHistory()
        state = state.copy(homeScore = 0, awayScore = 0)
    }

    fun undo(): Boolean {
        val previous = history.removeLastOrNull() ?: return false
        state = previous
        return true
    }

    fun toggleTimer() {
        state = state.copy(timerRunning = !state.timerRunning)
    }

    fun resetTimer() {
        state = state.copy(elapsedSeconds = 0, timerRunning = false)
    }

    fun tickTimerIfRunning() {
        if (state.timerRunning) {
            state = state.copy(elapsedSeconds = state.elapsedSeconds + 1)
        }
    }

    private fun pushHistory() {
        history.addLast(state)
        if (history.size > 50) history.removeFirst()
    }
}
