package com.opendoorproductions.broadcaster

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

/**
 * Does no camera/RTMP work itself — MainActivity keeps owning RtmpCamera2
 * exactly as before, unchanged. This service's only job is to pin the whole
 * process at foreground importance for as long as a broadcast is in
 * progress, via startForeground()'s mandatory ongoing notification plus a
 * partial wake lock, so Android's background-camera-access restriction and
 * CPU sleep don't tear down the Activity's camera/encoder/RTMP session the
 * moment the screen locks or another app comes to the front — the same
 * trick a video-call app uses to keep a call connected with the screen off.
 * See the README's "Broadcasting through a locked screen" section.
 *
 * Started (MainActivity.startBroadcastForegroundService) the moment a Go
 * Live attempt succeeds, and stopped the moment the broadcast session
 * really ends — every site that sets autoReconnectEnabled = false, not
 * just a successful manual End Stream — so a connection drop mid-retry
 * keeps this alive instead of losing foreground priority right when the
 * reconnect logic needs it most.
 */
class BroadcastForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "OpenDoorLive:BroadcastWakeLock",
        ).apply { setReferenceCounted(false) }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        // Safety net only, not the normal stop path — MainActivity always calls
        // stopService() itself when the broadcast actually ends. This just
        // bounds how long a wake lock could survive a crash or force-kill that
        // skips that call, so a stuck lock can't drain the battery indefinitely.
        wakeLock?.acquire(MAX_WAKE_LOCK_DURATION_MS)
        return START_STICKY
    }

    override fun onDestroy() {
        wakeLock?.let { if (it.isHeld) it.release() }
        super.onDestroy()
    }

    private fun buildNotification(): android.app.Notification {
        createNotificationChannelIfNeeded()
        val openAppIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).setFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.broadcast_notification_title))
            .setContentText(getString(R.string.broadcast_notification_text))
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(openAppIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannelIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                getString(R.string.broadcast_notification_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ),
        )
    }

    private companion object {
        const val CHANNEL_ID = "broadcast_channel"
        const val NOTIFICATION_ID = 1001
        const val MAX_WAKE_LOCK_DURATION_MS = 4 * 60 * 60 * 1000L
    }
}
