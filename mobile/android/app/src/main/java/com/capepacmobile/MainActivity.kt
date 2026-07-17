package com.capepacmobile

import android.content.Intent
import android.os.Bundle
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule

class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "CapEpacMobile"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    /**
     * Appelé au premier lancement de l'activité.
     * Traite l'Intent si l'app était fermée.
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleIncomingCallIntent(intent)
    }

    /**
     * Appelé quand l'activité est déjà ouverte et reçoit un nouvel Intent
     * (cas : app en arrière-plan, bouton Accepter tapé dans la notification).
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingCallIntent(intent)
    }

    /**
     * Traite l'Intent "OPEN_INCOMING_CALL" envoyé par le service.
     * Envoie un événement React Native avec les données de l'appel.
     * React Native naviguera ensuite vers IncomingCallScreen.
     */
    private fun handleIncomingCallIntent(intent: Intent?) {
        if (intent?.action != "OPEN_INCOMING_CALL") return

        val callId       = intent.getStringExtra(CallNotificationService.EXTRA_CALL_ID) ?: return
        val callerName   = intent.getStringExtra(CallNotificationService.EXTRA_CALLER_NAME) ?: ""
        val callerAvatar = intent.getStringExtra(CallNotificationService.EXTRA_CALLER_AVATAR) ?: ""
        val callerId     = intent.getStringExtra(CallNotificationService.EXTRA_CALLER_ID) ?: ""
        val callType     = intent.getStringExtra(CallNotificationService.EXTRA_CALL_TYPE) ?: "audio"
        val isGroup      = intent.getBooleanExtra(CallNotificationService.EXTRA_IS_GROUP, false)

        Log.d("MainActivity", "handleIncomingCallIntent callId=$callId callerName=$callerName")

        // Poster l'événement vers React Native
        // Le ReactContext est peut-être pas encore prêt si l'app était fermée →
        // on réessaie jusqu'à ce qu'il soit disponible
        sendEventWhenReady(callId, callerName, callerAvatar, callerId, callType, isGroup)
    }

    private fun sendEventWhenReady(
        callId: String, callerName: String, callerAvatar: String,
        callerId: String, callType: String, isGroup: Boolean,
        retries: Int = 0
    ) {
        val context = reactInstanceManager?.currentReactContext
        if (context != null && context.hasActiveReactInstance()) {
            val params: WritableMap = Arguments.createMap().apply {
                putString("callId",       callId)
                putString("callerName",   callerName)
                putString("callerAvatar", callerAvatar)
                putString("callerId",     callerId)
                putString("type",         callType)
                putBoolean("isGroupCall", isGroup)
            }
            context
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("incomingCall", params)
            Log.d("MainActivity", "Événement incomingCall envoyé au JS")
        } else if (retries < 30) {
            // Réessayer après 200ms (React Native met ~2-4s à démarrer)
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                sendEventWhenReady(callId, callerName, callerAvatar, callerId, callType, isGroup, retries + 1)
            }, 200)
        } else {
            Log.w("MainActivity", "React context non disponible après 6s — abandon")
        }
    }
}
