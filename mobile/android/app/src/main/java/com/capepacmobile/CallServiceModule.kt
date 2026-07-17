package com.capepacmobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject

/**
 * CallServiceModule — Module React Native natif
 *
 * Expose les méthodes suivantes au JavaScript :
 *   - startService(token, serverUrl)  : démarre le Foreground Service
 *   - stopService()                   : arrête le service
 *
 * Émet les événements suivants vers le JS :
 *   - "incomingCall"  : appel reçu quand l'app est fermée/arrière-plan
 *   - "callEnded"     : appel terminé
 */
class CallServiceModule(reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val TAG = "CallServiceModule"
        const val MODULE_NAME = "CallServiceModule"
    }

    private var broadcastReceiver: BroadcastReceiver? = null

    override fun getName(): String = MODULE_NAME

    override fun initialize() {
        super.initialize()
        registerBroadcastReceiver()
    }

    override fun invalidate() {
        unregisterBroadcastReceiver()
        super.invalidate()
    }

    // ── Méthodes exposées au JS ───────────────────────────────

    @ReactMethod
    fun startService(token: String, serverUrl: String) {
        Log.d(TAG, "Démarrage du service avec serverUrl=$serverUrl")

        // Sauvegarder pour le BootReceiver (redémarrage après reboot)
        val prefs = reactApplicationContext.getSharedPreferences("cap_epac_prefs", Context.MODE_PRIVATE)
        prefs.edit()
            .putString("auth_token", token)
            .putString("server_url", serverUrl)
            .apply()

        val intent = Intent(reactApplicationContext, CallNotificationService::class.java).apply {
            action = CallNotificationService.ACTION_START
            putExtra(CallNotificationService.EXTRA_TOKEN, token)
            putExtra(CallNotificationService.EXTRA_SERVER_URL, serverUrl)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactApplicationContext.startForegroundService(intent)
        } else {
            reactApplicationContext.startService(intent)
        }
    }

    @ReactMethod
    fun stopService() {
        Log.d(TAG, "Arrêt du service")

        // Effacer les credentials sauvegardés
        val prefs = reactApplicationContext.getSharedPreferences("cap_epac_prefs", Context.MODE_PRIVATE)
        prefs.edit().remove("auth_token").apply()

        val intent = Intent(reactApplicationContext, CallNotificationService::class.java).apply {
            action = CallNotificationService.ACTION_STOP
        }
        reactApplicationContext.startService(intent)
    }

    @ReactMethod
    fun stopRingtone() {
        Log.d(TAG, "Arrêt sonnerie depuis JS")
        val intent = Intent(reactApplicationContext, CallNotificationService::class.java).apply {
            action = CallNotificationService.ACTION_STOP_RINGTONE
        }
        reactApplicationContext.startService(intent)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Requis par React Native pour les EventEmitter — ne rien faire
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Requis par React Native pour les EventEmitter — ne rien faire
    }

    // ── Réception des broadcasts du service ──────────────────

    private fun registerBroadcastReceiver() {
        broadcastReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val dataStr = intent.getStringExtra("data") ?: return
                try {
                    val json = JSONObject(dataStr)
                    val params = Arguments.createMap()

                    when (intent.action) {
                        CallNotificationService.BROADCAST_INCOMING_CALL -> {
                            params.putString("callId",     json.optString("callId"))
                            params.putString("callerId",   json.optString("callerId"))
                            params.putString("callerName", json.optString("callerName"))
                            params.putString("callerAvatar", json.optString("callerAvatar", ""))
                            params.putString("type",       json.optString("type", "audio"))
                            params.putBoolean("isGroupCall", json.optBoolean("isGroupCall", false))
                            sendEvent("incomingCall", params)
                        }
                        CallNotificationService.BROADCAST_CALL_ENDED -> {
                            params.putString("callId", json.optString("callId"))
                            sendEvent("callEnded", params)
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Erreur parsing broadcast: ${e.message}")
                }
            }
        }

        val filter = IntentFilter().apply {
            addAction(CallNotificationService.BROADCAST_INCOMING_CALL)
            addAction(CallNotificationService.BROADCAST_CALL_ENDED)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactApplicationContext.registerReceiver(
                broadcastReceiver, filter, Context.RECEIVER_NOT_EXPORTED
            )
        } else {
            reactApplicationContext.registerReceiver(broadcastReceiver, filter)
        }

        Log.d(TAG, "BroadcastReceiver enregistré")
    }

    private fun unregisterBroadcastReceiver() {
        broadcastReceiver?.let {
            try {
                reactApplicationContext.unregisterReceiver(it)
                Log.d(TAG, "BroadcastReceiver désenregistré")
            } catch (e: Exception) {
                Log.w(TAG, "Erreur désenregistrement: ${e.message}")
            }
        }
        broadcastReceiver = null
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.w(TAG, "Impossible d'envoyer l'événement $eventName: ${e.message}")
        }
    }
}
