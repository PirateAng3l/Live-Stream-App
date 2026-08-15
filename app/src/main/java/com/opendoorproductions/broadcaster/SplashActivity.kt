package com.opendoorproductions.broadcaster

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.opendoorproductions.broadcaster.databinding.ActivitySplashBinding

/**
 * Launcher screen: full-bleed splash artwork with a "Get Started" tap target
 * baked into the image. Tapping it hands off to MainActivity and this
 * screen is removed from the back stack so the app never returns to it.
 */
class SplashActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySplashBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.getStartedBtn.setOnClickListener {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
    }
}
