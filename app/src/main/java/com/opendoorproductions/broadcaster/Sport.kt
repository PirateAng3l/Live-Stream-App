package com.opendoorproductions.broadcaster

data class ScoreIncrement(val label: String, val delta: Int)

enum class ScoreboardLayout { TWO_TEAM, CRICKET }

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
    OTHER("Other / Cultural Event", emptyList(), ScoreboardLayout.TWO_TEAM);

    override fun toString(): String = displayName
}
