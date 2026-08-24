package com.opendoorproductions.broadcaster.backend

import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

data class CrewSession(
    val accessToken: String,
    val refreshToken: String,
    val expiresAtEpochSeconds: Long
)

data class CrewProfile(val role: String, val schoolId: String?)

data class FixtureSummary(
    val id: String,
    val sport: String,
    val scheduledStart: String,
    val homeTeamName: String,
    val awayTeamName: String,
    /**
     * Only populated by getAllUpcomingFixtures (the platform_admin,
     * every-school path) — a school_operator only ever sees their own
     * school's fixtures, so there's nothing to disambiguate and the label
     * doesn't need it. Null here means "don't show a school prefix."
     */
    val schoolName: String? = null,
    /**
     * The host school's uploaded emblem (schools.logo_url, migration 0006's
     * Storage bucket) — null when that school hasn't uploaded one, in
     * which case the app falls back to Open Door Live's own mark. Always
     * the *host* school's logo, drawn in the home slot only; there's no
     * equivalent for the away side (see README's crew sign-in section).
     */
    val homeLogoUrl: String? = null,
)

data class BroadcastCredentials(val ingestionAddress: String, val streamKey: String)

/**
 * One school-uploaded sponsor logo, baked into this fixture's overlay —
 * mirrors web/lib/sponsors-server.ts's loadFixtureSponsors, but filtered
 * to layer='baked_in' server-side (web_overlay assignments are that
 * site's own territory, not this app's). `position` is always one of
 * TeamOverlayRenderer's four sponsor slot names (lower_third/bottom_left/
 * bottom_right/top_right) — the sponsor_position Postgres enum (migration
 * 0001, extended by 0010 for top_right)
 * guarantees that at the source, so it's read as a plain String rather
 * than re-validated here.
 */
data class FixtureSponsor(val position: String, val logoUrl: String)

/**
 * Minimal blocking client for the two Supabase APIs the app needs: Auth
 * (email/password sign-in + refresh) and PostgREST (reading fixtures and
 * broadcast credentials, both scoped by RLS to whoever's signed in — see
 * backend/supabase/migrations). Every method here does real network I/O
 * and must be called off the main thread.
 *
 * Plain HttpURLConnection + org.json rather than a networking library:
 * the app's needs are a handful of simple JSON requests, not enough to
 * justify a new Gradle dependency.
 */
class SupabaseClient(private val baseUrl: String, private val anonKey: String) {

    fun signIn(email: String, password: String): CrewSession {
        val body = JSONObject().put("email", email).put("password", password)
        val response = request(
            "POST",
            "$baseUrl/auth/v1/token?grant_type=password",
            mapOf("Content-Type" to "application/json", "apikey" to anonKey),
            body.toString(),
        )
        return parseSession(JSONObject(response))
    }

    fun refreshSession(refreshToken: String): CrewSession {
        val body = JSONObject().put("refresh_token", refreshToken)
        val response = request(
            "POST",
            "$baseUrl/auth/v1/token?grant_type=refresh_token",
            mapOf("Content-Type" to "application/json", "apikey" to anonKey),
            body.toString(),
        )
        return parseSession(JSONObject(response))
    }

    /** RLS (profiles_read_own) means this always returns exactly the caller's own row. */
    fun getMyProfile(accessToken: String): CrewProfile {
        val response = request(
            "GET",
            "$baseUrl/rest/v1/profiles?select=role,school_id",
            authHeaders(accessToken),
            null,
        )
        val rows = JSONArray(response)
        if (rows.length() == 0) throw IOException("No profile found for this account")
        val row = rows.getJSONObject(0)
        return CrewProfile(role = row.getString("role"), schoolId = row.optNullableString("school_id"))
    }

    /**
     * Two flat queries (fixtures, then teams by id) rather than a
     * PostgREST embedded-relation select — same reasoning as db.ts on the
     * backend: simpler to reason about and doesn't depend on foreign-key
     * constraint names staying stable.
     */
    fun getUpcomingFixtures(accessToken: String, schoolId: String): List<FixtureSummary> {
        val fixturesUrl = "$baseUrl/rest/v1/fixtures" +
            "?host_school_id=eq.${encode(schoolId)}" +
            "&status=eq.scheduled" +
            "&order=scheduled_start.asc" +
            "&select=id,sport,scheduled_start,home_team_id,away_team_id"
        val fixtures = JSONArray(request("GET", fixturesUrl, authHeaders(accessToken), null))
        if (fixtures.length() == 0) return emptyList()

        val teamIds = LinkedHashSet<String>()
        for (i in 0 until fixtures.length()) {
            val row = fixtures.getJSONObject(i)
            teamIds.add(row.getString("home_team_id"))
            teamIds.add(row.getString("away_team_id"))
        }
        val teamsUrl = "$baseUrl/rest/v1/teams" +
            "?id=in.(${teamIds.joinToString(",") { encode(it) }})" +
            "&select=id,name,short_name"
        val teams = JSONArray(request("GET", teamsUrl, authHeaders(accessToken), null))
        val teamNames = mutableMapOf<String, String>()
        for (i in 0 until teams.length()) {
            val row = teams.getJSONObject(i)
            // A school's own preferred scoreboard abbreviation, if it set
            // one (web /admin/teams) — falls back to the full name, same as
            // when short_name is left unset entirely.
            val shortName = row.optNullableString("short_name")
            teamNames[row.getString("id")] = if (shortName.isNullOrBlank()) row.getString("name") else shortName
        }

        // Every fixture here shares the same schoolId (the caller's own),
        // so this is one extra request total, not one per fixture.
        val schoolUrl = "$baseUrl/rest/v1/schools" +
            "?id=eq.${encode(schoolId)}" +
            "&select=logo_url"
        val schoolRows = JSONArray(request("GET", schoolUrl, authHeaders(accessToken), null))
        val homeLogoUrl = if (schoolRows.length() > 0) {
            schoolRows.getJSONObject(0).optNullableString("logo_url")
        } else {
            null
        }

        return (0 until fixtures.length()).map { i ->
            val row = fixtures.getJSONObject(i)
            FixtureSummary(
                id = row.getString("id"),
                sport = row.getString("sport"),
                scheduledStart = row.getString("scheduled_start"),
                homeTeamName = teamNames[row.getString("home_team_id")] ?: "Home",
                awayTeamName = teamNames[row.getString("away_team_id")] ?: "Away",
                homeLogoUrl = homeLogoUrl,
            )
        }
    }

    /**
     * A platform_admin has no single school (see the `profiles` table's
     * shape constraint) — this is their equivalent of getUpcomingFixtures,
     * across every school rather than one. fixtures_read_all (RLS) already
     * makes every fixture publicly readable regardless of role, so there's
     * no server-side check to bypass here; this just drops the
     * host_school_id filter and joins school names in too, since a plain
     * "Team A vs Team B" label would be ambiguous once fixtures from
     * different schools are mixed together in one list.
     */
    fun getAllUpcomingFixtures(accessToken: String): List<FixtureSummary> {
        val fixturesUrl = "$baseUrl/rest/v1/fixtures" +
            "?status=eq.scheduled" +
            "&order=scheduled_start.asc" +
            "&select=id,sport,scheduled_start,home_team_id,away_team_id,host_school_id"
        val fixtures = JSONArray(request("GET", fixturesUrl, authHeaders(accessToken), null))
        if (fixtures.length() == 0) return emptyList()

        val teamIds = LinkedHashSet<String>()
        val schoolIds = LinkedHashSet<String>()
        for (i in 0 until fixtures.length()) {
            val row = fixtures.getJSONObject(i)
            teamIds.add(row.getString("home_team_id"))
            teamIds.add(row.getString("away_team_id"))
            schoolIds.add(row.getString("host_school_id"))
        }

        val teamsUrl = "$baseUrl/rest/v1/teams" +
            "?id=in.(${teamIds.joinToString(",") { encode(it) }})" +
            "&select=id,name,short_name"
        val teams = JSONArray(request("GET", teamsUrl, authHeaders(accessToken), null))
        val teamNames = mutableMapOf<String, String>()
        for (i in 0 until teams.length()) {
            val row = teams.getJSONObject(i)
            // A school's own preferred scoreboard abbreviation, if it set
            // one (web /admin/teams) — falls back to the full name, same as
            // when short_name is left unset entirely.
            val shortName = row.optNullableString("short_name")
            teamNames[row.getString("id")] = if (shortName.isNullOrBlank()) row.getString("name") else shortName
        }

        val schoolsUrl = "$baseUrl/rest/v1/schools" +
            "?id=in.(${schoolIds.joinToString(",") { encode(it) }})" +
            "&select=id,name,logo_url"
        val schools = JSONArray(request("GET", schoolsUrl, authHeaders(accessToken), null))
        val schoolNames = mutableMapOf<String, String>()
        val schoolLogoUrls = mutableMapOf<String, String?>()
        for (i in 0 until schools.length()) {
            val row = schools.getJSONObject(i)
            schoolNames[row.getString("id")] = row.getString("name")
            schoolLogoUrls[row.getString("id")] = row.optNullableString("logo_url")
        }

        return (0 until fixtures.length()).map { i ->
            val row = fixtures.getJSONObject(i)
            FixtureSummary(
                id = row.getString("id"),
                sport = row.getString("sport"),
                scheduledStart = row.getString("scheduled_start"),
                homeTeamName = teamNames[row.getString("home_team_id")] ?: "Home",
                awayTeamName = teamNames[row.getString("away_team_id")] ?: "Away",
                schoolName = schoolNames[row.getString("host_school_id")] ?: "Unknown school",
                homeLogoUrl = schoolLogoUrls[row.getString("host_school_id")],
            )
        }
    }

    /**
     * Flips a fixture to status='live' the moment the RTMP connection
     * actually succeeds (MainActivity.onConnectionSuccess) — nothing else
     * in the system ever sets this, so without it the schedule page shows
     * every fixture as "Scheduled" right up until a school_operator visits
     * /admin and manually marks it completed. RLS's fixtures_update_own_school
     * (migration 0005) is what allows this: a school_operator can update any
     * column, including status, on their own school's fixtures — the same
     * policy that already lets them enter a final score.
     *
     * Deliberately one-way: nothing here ever reverts status back to
     * 'scheduled' on disconnect. A dropped connection triggers this app's
     * own reconnect logic (not a real end of broadcast), and a deliberate
     * stop still isn't the same as the match actually finishing — same
     * "nothing does this automatically" reasoning as why completing a
     * fixture stays a manual admin action (see web's completeFixtureAction).
     */
    fun markFixtureLive(accessToken: String, fixtureId: String) {
        val body = JSONObject().put("status", "live")
        request(
            "PATCH",
            "$baseUrl/rest/v1/fixtures?id=eq.${encode(fixtureId)}",
            authHeaders(accessToken) + ("Content-Type" to "application/json"),
            body.toString(),
        )
    }

    fun getBroadcastCredentials(accessToken: String, fixtureId: String): BroadcastCredentials {
        val url = "$baseUrl/rest/v1/fixture_broadcast_credentials" +
            "?fixture_id=eq.${encode(fixtureId)}" +
            "&select=youtube_ingestion_address,youtube_stream_key"
        val rows = JSONArray(request("GET", url, authHeaders(accessToken), null))
        if (rows.length() == 0) {
            throw IOException("No broadcast credentials found for this fixture yet — it may still be provisioning")
        }
        val row = rows.getJSONObject(0)
        val ingestionAddress = row.optNullableString("youtube_ingestion_address")
        val streamKey = row.optNullableString("youtube_stream_key")
        if (ingestionAddress.isNullOrBlank() || streamKey.isNullOrBlank()) {
            throw IOException("This fixture hasn't finished provisioning yet — try again shortly")
        }
        return BroadcastCredentials(ingestionAddress, streamKey)
    }

    /**
     * Two flat queries (fixture_sponsors, then sponsors by id), same
     * reasoning as getUpcomingFixtures' team lookup and this project's
     * web-side loadFixtureSponsors: simpler than an embedded-relation
     * select and doesn't depend on a foreign-key constraint name staying
     * stable. Rows with no logo_url set (a sponsor added but never
     * uploaded a logo) are skipped — nothing useful to bake into the
     * overlay yet, same as a fixture with no baked_in sponsors at all.
     */
    fun getFixtureSponsors(accessToken: String, fixtureId: String): List<FixtureSponsor> {
        val assignmentsUrl = "$baseUrl/rest/v1/fixture_sponsors" +
            "?fixture_id=eq.${encode(fixtureId)}" +
            "&layer=eq.baked_in" +
            "&select=sponsor_id,position"
        val assignments = JSONArray(request("GET", assignmentsUrl, authHeaders(accessToken), null))
        if (assignments.length() == 0) return emptyList()

        val sponsorIds = LinkedHashSet<String>()
        for (i in 0 until assignments.length()) {
            sponsorIds.add(assignments.getJSONObject(i).getString("sponsor_id"))
        }
        val sponsorsUrl = "$baseUrl/rest/v1/sponsors" +
            "?id=in.(${sponsorIds.joinToString(",") { encode(it) }})" +
            "&select=id,logo_url"
        val sponsors = JSONArray(request("GET", sponsorsUrl, authHeaders(accessToken), null))
        val logoUrlById = mutableMapOf<String, String?>()
        for (i in 0 until sponsors.length()) {
            val row = sponsors.getJSONObject(i)
            logoUrlById[row.getString("id")] = row.optNullableString("logo_url")
        }

        return (0 until assignments.length()).mapNotNull { i ->
            val row = assignments.getJSONObject(i)
            val logoUrl = logoUrlById[row.getString("sponsor_id")]
            if (logoUrl.isNullOrBlank()) null else FixtureSponsor(position = row.getString("position"), logoUrl = logoUrl)
        }
    }

    private fun authHeaders(accessToken: String) = mapOf(
        "apikey" to anonKey,
        "Authorization" to "Bearer $accessToken",
        "Accept" to "application/json",
    )

    private fun parseSession(json: JSONObject): CrewSession {
        val errorMessage = json.optNullableString("error_description") ?: json.optNullableString("error")
        if (errorMessage != null) throw IOException(errorMessage)
        val expiresIn = if (json.has("expires_in")) json.getLong("expires_in") else 3600L
        return CrewSession(
            accessToken = json.getString("access_token"),
            refreshToken = json.getString("refresh_token"),
            expiresAtEpochSeconds = System.currentTimeMillis() / 1000 + expiresIn,
        )
    }

    private fun encode(value: String) = URLEncoder.encode(value, StandardCharsets.UTF_8.name())

    /**
     * HttpURLConnection.setRequestMethod() only accepts a hardcoded list
     * (GET/POST/HEAD/OPTIONS/PUT/DELETE/TRACE) and throws ProtocolException
     * for anything else, PATCH included — true on both the JDK and Android's
     * implementation. PostgREST update requests need a real PATCH (PUT has
     * different, row-replacement semantics that would require sending every
     * column), so this is the standard workaround: reflectively overwrite
     * the `method` field that java.net.HttpURLConnection declares, bypassing
     * setRequestMethod's whitelist rather than actually calling it.
     */
    private fun setPatchMethod(connection: HttpURLConnection) {
        val methodField = HttpURLConnection::class.java.getDeclaredField("method")
        methodField.isAccessible = true
        methodField.set(connection, "PATCH")
    }

    private fun request(method: String, urlStr: String, headers: Map<String, String>, body: String?): String {
        val connection = URL(urlStr).openConnection() as HttpURLConnection
        try {
            if (method == "PATCH") setPatchMethod(connection) else connection.requestMethod = method
            connection.connectTimeout = 15_000
            connection.readTimeout = 15_000
            headers.forEach { (key, value) -> connection.setRequestProperty(key, value) }
            if (body != null) {
                connection.doOutput = true
                connection.outputStream.use { it.write(body.toByteArray(StandardCharsets.UTF_8)) }
            }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader(StandardCharsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                throw IOException(extractErrorMessage(text, status))
            }
            return text
        } finally {
            connection.disconnect()
        }
    }

    private fun extractErrorMessage(body: String, status: Int): String {
        return try {
            val json = JSONObject(body)
            json.optNullableString("error_description")
                ?: json.optNullableString("msg")
                ?: json.optNullableString("message")
                ?: "HTTP $status"
        } catch (error: Exception) {
            "HTTP $status"
        }
    }
}

private fun JSONObject.optNullableString(key: String): String? =
    if (has(key) && !isNull(key)) getString(key) else null
