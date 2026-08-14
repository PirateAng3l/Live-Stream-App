package com.opendoorproductions.broadcaster

data class CricketState(
    val teamAName: String = "TEAM A",
    val teamBName: String = "TEAM B",
    val teamABatting: Boolean = true,
    val runs: Int = 0,
    val wickets: Int = 0,
    val legalBallsInOver: Int = 0,
    val overs: Int = 0,
    val ballsPerOver: Int = 6,
    val target: Int? = null
) {
    val battingTeam: String get() = if (teamABatting) teamAName else teamBName
    val bowlingTeam: String get() = if (teamABatting) teamBName else teamAName
}

class CricketController {

    var state = CricketState()
        private set

    private val history = ArrayDeque<CricketState>()

    fun setNames(teamA: String, teamB: String) {
        state = state.copy(
            teamAName = teamA.ifBlank { "TEAM A" },
            teamBName = teamB.ifBlank { "TEAM B" }
        )
    }

    fun addRuns(runs: Int) {
        pushHistory()
        state = state.copy(runs = state.runs + runs)
        advanceLegalBall()
    }

    fun addExtra(runs: Int) {
        pushHistory()
        state = state.copy(runs = state.runs + runs)
    }

    fun addWicket() {
        if (state.wickets >= 10) return
        pushHistory()
        state = state.copy(wickets = state.wickets + 1)
        advanceLegalBall()
    }

    fun undo(): Boolean {
        val previous = history.removeLastOrNull() ?: return false
        state = previous
        return true
    }

    fun swapInnings() {
        pushHistory()
        state = state.copy(
            teamABatting = !state.teamABatting,
            runs = 0,
            wickets = 0,
            legalBallsInOver = 0,
            overs = 0,
            target = state.runs + 1
        )
    }

    fun resetInnings() {
        pushHistory()
        state = state.copy(runs = 0, wickets = 0, legalBallsInOver = 0, overs = 0, target = null)
    }

    private fun advanceLegalBall() {
        var balls = state.legalBallsInOver + 1
        var overs = state.overs
        if (balls >= state.ballsPerOver) {
            balls = 0
            overs += 1
        }
        state = state.copy(legalBallsInOver = balls, overs = overs)
    }

    private fun pushHistory() {
        history.addLast(state)
        if (history.size > 50) history.removeFirst()
    }
}
