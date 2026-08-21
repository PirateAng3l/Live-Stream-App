package com.opendoorproductions.broadcaster

/**
 * Both picked from the Camera settings tab and persisted like every other
 * setup field. Applied by re-preparing the encoder (see
 * MainActivity.setupCameraQualityControls) — same "takes effect next launch
 * if changed mid-stream" rule as the dark/light theme, since resizing the
 * encoder while live would tear down the camera/RTMP session mid-broadcast.
 */
enum class StreamResolution(val label: String, val width: Int, val height: Int) {
    HD_720("720p", 1280, 720),
    FHD_1080("1080p", 1920, 1080);

    override fun toString(): String = label
}

enum class StreamBitrate(val label: String, val kbps: Int) {
    DATA_SAVER("Data saver (2.5 Mbps)", 2500),
    STANDARD("Standard (4 Mbps)", 4000),
    HIGH("High (6 Mbps)", 6000);

    override fun toString(): String = label
}
