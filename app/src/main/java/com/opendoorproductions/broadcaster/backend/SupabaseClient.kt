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
)

data class BroadcastCredentials(val ingestionAddress: String, val streamKey: String)

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
            "&select=id,name"
        val teams = JSONArray(request("GET", teamsUrl, authHeaders(accessToken), null))
        val teamNames = mutableMapOf<String, String>()
        for (i in 0 until teams.length()) {
            val row = teams.getJSONObject(i)
            teamNames[row.getString("id")] = row.getString("name")
        }

        return (0 until fixtures.length()).map { i ->
            val row = fixtures.getJSONObject(i)
            FixtureSummary(
                id = row.getString("id"),
                sport = row.getString("sport"),
                scheduledStart = row.getString("scheduled_start"),
                homeTeamName = teamNames[row.getString("home_team_id")] ?: "Home",
                awayTeamName = teamNames[row.getString("away_team_id")] ?: "Away",
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
            "&select=id,name"
        val teams = JSONArray(request("GET", teamsUrl, authHeaders(accessToken), null))
        val teamNames = mutableMapOf<String, String>()
        for (i in 0 until teams.length()) {
            val row = teams.getJSONObject(i)
            teamNames[row.getString("id")] = row.getString("name")
        }

        val schoolsUrl = "$baseUrl/rest/v1/schools" +
            "?id=in.(${schoolIds.joinToString(",") { encode(it) }})" +
            "&select=id,name"
        val schools = JSONArray(request("GET", schoolsUrl, authHeaders(accessToken), null))
        val schoolNames = mutableMapOf<String, String>()
        for (i in 0 until schools.length()) {
            val row = schools.getJSONObject(i)
            schoolNames[row.getString("id")] = row.getString("name")
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
            )
        }
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

    private fun request(method: String, urlStr: String, headers: Map<String, String>, body: String?): String {
        val connection = URL(urlStr).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
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
