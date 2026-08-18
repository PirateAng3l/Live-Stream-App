package com.opendoorproductions.broadcaster

data class ScoreIncrement(val label: String, val delta: Int)

enum class ScoreboardLayout { TWO_TEAM, CRICKET, NONE }

enum class Sport(
    val displayName: String,
    val presets: List<ScoreIncrement>,
    val layout: ScoreboardLayout
) {
    RUGBY(
        "Rugby",
        listOf(
            ScoreIncrement("Try +5", 5),
            ScoreIncrement("Con +2", 2),
            ScoreIncrement("Pen +3", 3),
            ScoreIncrement("Drop +3", 3)
        ),
        ScoreboardLayout.TWO_TEAM
    ),
    SOCCER("Soccer", emptyList(), ScoreboardLayout.TWO_TEAM),
    NETBALL("Netball", emptyList(), ScoreboardLayout.TWO_TEAM),
    HOCKEY("Hockey", emptyList(), ScoreboardLayout.TWO_TEAM),
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
