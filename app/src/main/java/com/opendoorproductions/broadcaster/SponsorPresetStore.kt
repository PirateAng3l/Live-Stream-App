package com.opendoorproductions.broadcaster

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

data class SponsorPresetSummary(val id: String, val name: String)

data class SponsorPresetData(
    val name: String,
    val logoBitmap: Bitmap?,
    val sponsorHeadlineBitmap: Bitmap?,
    val sponsorLeftBitmap: Bitmap?,
    val sponsorRightBitmap: Bitmap?,
    val logoScale: Float,
    val sponsorHeadlineScale: Float,
    val sponsorLeftScale: Float,
    val sponsorRightScale: Float,
    val sponsorHeadlineOffsetY: Float,
    val sponsorHeadlinePrefix: String
)

/**
 * Named snapshots of the sponsor setup — the 4 logo/sponsor images plus their
 * size/position and the headline prefix text — so an operator running matches
 * for multiple schools/events isn't re-uploading the same logos every time.
 * Each preset gets its own image files under filesDir/presets/<id>/ (separate
 * from the live logoBitmap/etc. files MainActivity persists) plus a small JSON
 * metadata blob in a dedicated SharedPreferences file.
 */
class SponsorPresetStore(context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val presetsDir = File(appContext.filesDir, "presets")

    fun list(): List<SponsorPresetSummary> =
        idOrder().mapNotNull { id -> readMeta(id)?.let { SponsorPresetSummary(id, it.optString("name")) } }

    fun save(
        name: String,
        logoBitmap: Bitmap?,
        sponsorHeadlineBitmap: Bitmap?,
        sponsorLeftBitmap: Bitmap?,
        sponsorRightBitmap: Bitmap?,
        logoScale: Float,
        sponsorHeadlineScale: Float,
        sponsorLeftScale: Float,
        sponsorRightScale: Float,
        sponsorHeadlineOffsetY: Float,
        sponsorHeadlinePrefix: String
    ): String {
        val id = System.currentTimeMillis().toString()
        val dir = File(presetsDir, id).apply { mkdirs() }
        writeImage(logoBitmap, File(dir, LOGO_FILE))
        writeImage(sponsorHeadlineBitmap, File(dir, HEADLINE_FILE))
        writeImage(sponsorLeftBitmap, File(dir, LEFT_FILE))
        writeImage(sponsorRightBitmap, File(dir, RIGHT_FILE))

        val meta = JSONObject().apply {
            put("name", name)
            put("logoScale", logoScale)
            put("sponsorHeadlineScale", sponsorHeadlineScale)
            put("sponsorLeftScale", sponsorLeftScale)
            put("sponsorRightScale", sponsorRightScale)
            put("sponsorHeadlineOffsetY", sponsorHeadlineOffsetY)
            put("sponsorHeadlinePrefix", sponsorHeadlinePrefix)
        }
        prefs.edit().putString(metaKey(id), meta.toString()).apply()
        saveIdOrder(idOrder() + id)
        return id
    }

    fun load(id: String): SponsorPresetData? {
        val meta = readMeta(id) ?: return null
        val dir = File(presetsDir, id)
        return SponsorPresetData(
            name = meta.optString("name"),
            logoBitmap = readImage(File(dir, LOGO_FILE)),
            sponsorHeadlineBitmap = readImage(File(dir, HEADLINE_FILE)),
            sponsorLeftBitmap = readImage(File(dir, LEFT_FILE)),
            sponsorRightBitmap = readImage(File(dir, RIGHT_FILE)),
            logoScale = meta.optDouble("logoScale", 1.0).toFloat(),
            sponsorHeadlineScale = meta.optDouble("sponsorHeadlineScale", 1.0).toFloat(),
            sponsorLeftScale = meta.optDouble("sponsorLeftScale", 1.0).toFloat(),
            sponsorRightScale = meta.optDouble("sponsorRightScale", 1.0).toFloat(),
            sponsorHeadlineOffsetY = meta.optDouble("sponsorHeadlineOffsetY", 0.0).toFloat(),
            sponsorHeadlinePrefix = meta.optString("sponsorHeadlinePrefix", "")
        )
    }

    fun delete(id: String) {
        File(presetsDir, id).deleteRecursively()
        prefs.edit().remove(metaKey(id)).apply()
        saveIdOrder(idOrder().filterNot { it == id })
    }

    private fun writeImage(bitmap: Bitmap?, file: File) {
        if (bitmap == null) {
            file.delete()
            return
        }
        FileOutputStream(file).use { out -> bitmap.compress(Bitmap.CompressFormat.PNG, 100, out) }
    }

    private fun readImage(file: File): Bitmap? {
        if (!file.exists()) return null
        return BitmapFactory.decodeFile(file.absolutePath)
    }

    private fun readMeta(id: String): JSONObject? {
        val raw = prefs.getString(metaKey(id), null) ?: return null
        return try {
            JSONObject(raw)
        } catch (error: Exception) {
            null
        }
    }

    private fun metaKey(id: String) = "preset_meta_$id"

    private fun idOrder(): List<String> {
        val raw = prefs.getString(KEY_ORDER, null) ?: return emptyList()
        val array = try {
            JSONArray(raw)
        } catch (error: Exception) {
            return emptyList()
        }
        return (0 until array.length()).map { array.getString(it) }
    }

    private fun saveIdOrder(ids: List<String>) {
        val array = JSONArray()
        ids.forEach { array.put(it) }
        prefs.edit().putString(KEY_ORDER, array.toString()).apply()
    }

    private companion object {
        const val PREFS_NAME = "sponsor_presets"
        const val KEY_ORDER = "preset_id_order"
        const val LOGO_FILE = "logo.png"
        const val HEADLINE_FILE = "sponsor_headline.png"
        const val LEFT_FILE = "sponsor_left.png"
        const val RIGHT_FILE = "sponsor_right.png"
    }
}
