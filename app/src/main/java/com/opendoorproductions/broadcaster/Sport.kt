package com.opendoorproductions.broadcaster

data class ScoreIncrement(val label: String, val delta: Int)

enum class ScoreboardLayout { TWO_TEAM, CRICKET, NONE }

enum class Sport(
    val displayName: String,
    val presets: List<ScoreIncrement>,
    val layout: ScoreboardLayout,
    /**
     * In display order, e.g. "1st Half", "2nd Half" — shown next to the
     * timer so viewers know how far into the match they're watching, and
     * advanced manually by crew (a "Next Period" button, same manual-control
     * philosophy as the score/timer) rather than any timer-driven guess at
     * when a half or quarter actually starts. Empty means no period
     * indicator at all — cricket already shows its own overs/innings state
     * and OTHER (Clean Slate/Event) has no scoreboard to attach one to.
     */
    val periodLabels: List<String> = emptyList()
) {
    RUGBY(
        "Rugby",
        listOf(
            ScoreIncrement("Try +5", 5),
            ScoreIncrement("Con +2", 2),
            ScoreIncrement("Pen +3", 3),
            ScoreIncrement("Drop +3", 3)
        ),
        ScoreboardLayout.TWO_TEAM,
        periodLabels = listOf("1st Half", "2nd Half")
    ),
    SOCCER("Soccer", emptyList(), ScoreboardLayout.TWO_TEAM, periodLabels = listOf("1st Half", "2nd Half")),
    NETBALL(
        "Netball", emptyList(), ScoreboardLayout.TWO_TEAM,
        periodLabels = listOf("1st Quarter", "2nd Quarter", "3rd Quarter", "4th Quarter")
    ),
    HOCKEY("Hockey", emptyList(), ScoreboardLayout.TWO_TEAM, periodLabels = listOf("1st Half", "2nd Half")),
    // Sets won, not goals/points — same plain +/-1 scoreboard as soccer/hockey since a set
    // is just a running tally, no different from any other TWO_TEAM sport's score. No period
    // labels: "Set 1"/"Set 2" would need its own crew-advanced indicator like rugby's
    // half/quarter labels, not asked for here — the running score already says how many
    // sets each side has taken.
    TENNIS("Tennis", emptyList(), ScoreboardLayout.TWO_TEAM),
    CRICKET("Cricket", emptyList(), ScoreboardLayout.CRICKET),

    // No scoreboard at all — for a broadcast that isn't a team-vs-team match:
    // a school assembly, concert, play, or other cultural event. The overlay
    // shows just the event's own name (typed in where a team name normally
    // goes) plus the usual logo/sponsor chrome. Enum name stays OTHER so a
    // fixture's `sport` string ("other") created before this change, or by
    // the web admin panel, still matches correctly (see loadCrewFixture).
    OTHER("Clean Slate / Event", emptyList(), ScoreboardLayout.NONE);

    override fun toString(): String = displayName
}
