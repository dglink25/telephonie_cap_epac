package com.capepacmobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * BootReceiver — Redémarre le service de notification après un reboot du téléphone
 *
 * Nécessite la permission RECEIVE_BOOT_COMPLETED dans AndroidManifest.xml
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {

            Log.d("BootReceiver", "Téléphone redémarré — tentative de relance du service")

            // Lire le token sauvegardé en SharedPreferences
            val prefs = context.getSharedPreferences("cap_epac_prefs", Context.MODE_PRIVATE)
            val token     = prefs.getString("auth_token", null)
            val serverUrl = prefs.getString("server_url", null)

            if (token != null && serverUrl != null) {
                val serviceIntent = Intent(context, CallNotificationService::class.java).apply {
                    action = CallNotificationService.ACTION_START
                    putExtra(CallNotificationService.EXTRA_TOKEN, token)
                    putExtra(CallNotificationService.EXTRA_SERVER_URL, serverUrl)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
                Log.d("BootReceiver", "Service relancé après reboot")
            } else {
                Log.d("BootReceiver", "Pas de token — service non relancé (utilisateur déconnecté)")
            }
        }
    }
}
