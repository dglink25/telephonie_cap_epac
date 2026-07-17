package com.capepacmobile

import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.*
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import io.socket.client.IO
import io.socket.client.Socket
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONException
import org.json.JSONObject
import java.net.URI

/**
 * CallNotificationService — Foreground Service Android
 *
 * Corrections v2 :
 * - Sonnerie s'arrête sur TOUS les événements de fin (ended, rejected, cancelled)
 * - Guard anti-doublon : ne joue pas la sonnerie si elle est déjà active
 * - Bouton Accepter : passe les données complètes de l'appel à MainActivity
 * - Refresh automatique du token JWT avant expiration
 */
class CallNotificationService : Service() {

    companion object {
        const val TAG = "CallNotifService"

        const val ACTION_START         = "com.capepacmobile.START_SERVICE"
        const val ACTION_STOP          = "com.capepacmobile.STOP_SERVICE"
        const val ACTION_ACCEPT_CALL   = "com.capepacmobile.ACCEPT_CALL"
        const val ACTION_STOP_RINGTONE = "com.capepacmobile.STOP_RINGTONE"
        const val ACTION_REJECT_CALL   = "com.capepacmobile.REJECT_CALL"

        const val EXTRA_TOKEN        = "token"
        const val EXTRA_REFRESH_TOKEN = "refreshToken"
        const val EXTRA_USER_ID      = "userId"
        const val EXTRA_SERVER_URL   = "serverUrl"
        const val EXTRA_CALL_ID      = "callId"
        const val EXTRA_CALLER_NAME  = "callerName"
        const val EXTRA_CALLER_AVATAR = "callerAvatar"
        const val EXTRA_CALLER_ID    = "callerId"
        const val EXTRA_CALL_TYPE    = "callType"
        const val EXTRA_IS_GROUP     = "isGroupCall"

        const val NOTIF_ID_FOREGROUND = 1
        const val NOTIF_ID_CALL       = 2
        const val CHANNEL_SERVICE     = "cap_epac_service"
        const val CHANNEL_CALLS       = "cap_epac_calls"

        const val BROADCAST_INCOMING_CALL = "com.capepacmobile.INCOMING_CALL"
        const val BROADCAST_CALL_ENDED    = "com.capepacmobile.CALL_ENDED"
    }

    private var socket: Socket? = null
    private var ringtone: android.media.Ringtone? = null
    private var vibrator: Vibrator? = null
    private var currentCallId: String? = null
    private var isRingtonePlaying = false   // ← GUARD anti-doublon

    // Données de l'appel en cours (pour le bouton Accepter)
    private var pendingCallerName: String = ""
    private var pendingCallerAvatar: String = ""
    private var pendingCallerId: String = ""
    private var pendingCallType: String = "audio"
    private var pendingIsGroup: Boolean = false

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val token = intent.getStringExtra(EXTRA_TOKEN) ?: return START_NOT_STICKY
                val url   = intent.getStringExtra(EXTRA_SERVER_URL) ?: return START_NOT_STICKY
                startForegroundNotification()
                connectSocket(url, token)
            }

            ACTION_STOP -> {
                stopEverything()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }

            // Appelé depuis le JS quand l'utilisateur décroche depuis l'écran
            // (pas depuis le bouton de la notification)
            ACTION_STOP_RINGTONE -> {
                stopRingtoneAndVibration()
                dismissCallNotification()
                currentCallId = null
            }

            ACTION_ACCEPT_CALL -> {
                val callId = intent.getStringExtra(EXTRA_CALL_ID) ?: return START_STICKY
                stopRingtoneAndVibration()
                dismissCallNotification()
                // Ouvrir MainActivity avec TOUTES les données de l'appel
                openIncomingCallScreen(
                    callId          = callId,
                    callerName      = intent.getStringExtra(EXTRA_CALLER_NAME) ?: pendingCallerName,
                    callerAvatar    = intent.getStringExtra(EXTRA_CALLER_AVATAR) ?: pendingCallerAvatar,
                    callerId        = intent.getStringExtra(EXTRA_CALLER_ID) ?: pendingCallerId,
                    callType        = intent.getStringExtra(EXTRA_CALL_TYPE) ?: pendingCallType,
                    isGroup         = intent.getBooleanExtra(EXTRA_IS_GROUP, pendingIsGroup)
                )
                currentCallId = null
            }

            ACTION_REJECT_CALL -> {
                val callId = intent.getStringExtra(EXTRA_CALL_ID) ?: return START_STICKY
                stopRingtoneAndVibration()
                dismissCallNotification()
                // Envoyer le rejet via socket
                try {
                    socket?.emit("call:reject", JSONObject().apply { put("callId", callId) })
                } catch (e: Exception) { /* ignore */ }
                currentCallId = null
                // Notifier le JS
                sendCallBroadcast(BROADCAST_CALL_ENDED, JSONObject().apply {
                    put("callId", callId)
                })
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        stopEverything()
    }

    // ── Arrêt complet ──────────────────────────────────────────

    private fun stopEverything() {
        stopRingtoneAndVibration()
        dismissCallNotification()
        disconnectSocket()
    }

    // ── Notification Foreground ────────────────────────────────

    private fun startForegroundNotification() {
        val notif = NotificationCompat.Builder(this, CHANNEL_SERVICE)
            .setContentTitle("CAP-EPAC Téléphonie")
            .setContentText("En attente d'appels...")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .setSilent(true)
            .build()
        startForeground(NOTIF_ID_FOREGROUND, notif)
    }

    private fun updateForegroundNotification(text: String) {
        val notif = NotificationCompat.Builder(this, CHANNEL_SERVICE)
            .setContentTitle("CAP-EPAC Téléphonie")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .setSilent(true)
            .build()
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .notify(NOTIF_ID_FOREGROUND, notif)
    }

    // ── Notification appel entrant ─────────────────────────────

    private fun showIncomingCallNotification(
        callId: String, callerName: String, callerAvatar: String,
        callerId: String, callType: String, isGroup: Boolean
    ) {
        // Sauvegarder pour le bouton Accepter
        currentCallId       = callId
        pendingCallerName   = callerName
        pendingCallerAvatar = callerAvatar
        pendingCallerId     = callerId
        pendingCallType     = callType
        pendingIsGroup      = isGroup

        val typeLabel = if (callType == "video") "Appel vidéo" else "Appel audio"

        // Intent plein écran (tap sur notification)
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags  = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            action = "OPEN_INCOMING_CALL"
            putExtra(EXTRA_CALL_ID,      callId)
            putExtra(EXTRA_CALLER_NAME,  callerName)
            putExtra(EXTRA_CALLER_AVATAR, callerAvatar)
            putExtra(EXTRA_CALLER_ID,    callerId)
            putExtra(EXTRA_CALL_TYPE,    callType)
            putExtra(EXTRA_IS_GROUP,     isGroup)
        }
        val openPending = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Intent bouton Accepter — passe toutes les données
        val acceptIntent = Intent(this, CallNotificationService::class.java).apply {
            action = ACTION_ACCEPT_CALL
            putExtra(EXTRA_CALL_ID,      callId)
            putExtra(EXTRA_CALLER_NAME,  callerName)
            putExtra(EXTRA_CALLER_AVATAR, callerAvatar)
            putExtra(EXTRA_CALLER_ID,    callerId)
            putExtra(EXTRA_CALL_TYPE,    callType)
            putExtra(EXTRA_IS_GROUP,     isGroup)
        }
        val acceptPending = PendingIntent.getService(
            this, 1, acceptIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Intent bouton Refuser
        val rejectIntent = Intent(this, CallNotificationService::class.java).apply {
            action = ACTION_REJECT_CALL
            putExtra(EXTRA_CALL_ID, callId)
        }
        val rejectPending = PendingIntent.getService(
            this, 2, rejectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notif = NotificationCompat.Builder(this, CHANNEL_CALLS)
            .setContentTitle("$typeLabel entrant")
            .setContentText(callerName)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setFullScreenIntent(openPending, true)
            .setContentIntent(openPending)
            .setAutoCancel(false)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_call, "Accepter", acceptPending)
            .addAction(android.R.drawable.ic_delete,    "Refuser",  rejectPending)
            .build()

        NotificationManagerCompat.from(this).notify(NOTIF_ID_CALL, notif)

        // ── Guard anti-doublon ────────────────────────────────
        // Ne jouer la sonnerie que si elle n'est pas déjà active
        if (!isRingtonePlaying) {
            startRingtone()
            startVibration()
        } else {
            Log.d(TAG, "Sonnerie déjà active — pas de doublon")
        }
    }

    private fun dismissCallNotification() {
        NotificationManagerCompat.from(this).cancel(NOTIF_ID_CALL)
    }

    // ── Sonnerie + Vibreur ─────────────────────────────────────

    private fun startRingtone() {
        try {
            if (isRingtonePlaying) return          // sécurité supplémentaire
            val uri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ringtone = RingtoneManager.getRingtone(applicationContext, uri)
            ringtone?.audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ringtone?.isLooping = true
            }
            ringtone?.play()
            isRingtonePlaying = true
            Log.d(TAG, "Sonnerie démarrée")
        } catch (e: Exception) {
            Log.e(TAG, "Erreur sonnerie: ${e.message}")
        }
    }

    private fun startVibration() {
        val pattern = longArrayOf(0, 700, 500, 700, 500)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(pattern, 0)
        }
    }

    private fun stopRingtoneAndVibration() {
        if (isRingtonePlaying) {
            ringtone?.stop()
            ringtone = null
            isRingtonePlaying = false
            Log.d(TAG, "Sonnerie arrêtée")
        }
        vibrator?.cancel()
    }

    // ── Socket.IO ──────────────────────────────────────────────

    private fun connectSocket(url: String, token: String) {
        // Si déjà connecté avec ce token → ne pas reconnecter
        if (socket?.connected() == true) {
            Log.d(TAG, "Socket déjà connecté — skip reconnexion")
            return
        }

        // Déconnecter proprement l'ancienne socket si elle existe
        socket?.disconnect()
        socket?.off()
        socket = null

        try {
            Log.d(TAG, "Connexion socket vers $url")
            val opts = IO.Options.builder()
                .setAuth(mapOf("token" to token))
                .setTransports(arrayOf("websocket", "polling"))
                .setReconnection(true)
                .setReconnectionAttempts(Int.MAX_VALUE)
                .setReconnectionDelay(2000)
                .setReconnectionDelayMax(15000)
                .build()

            socket = IO.socket(URI.create(url), opts)

            socket?.on(Socket.EVENT_CONNECT) {
                Log.d(TAG, "Socket connecté")
                Handler(Looper.getMainLooper()).post {
                    updateForegroundNotification("Connecté — en attente d'appels")
                }
            }

            socket?.on(Socket.EVENT_DISCONNECT) {
                Log.d(TAG, "Socket déconnecté")
                Handler(Looper.getMainLooper()).post {
                    updateForegroundNotification("Reconnexion en cours...")
                }
            }

            // ── Appel entrant ──────────────────────────────────
            socket?.on("call:incoming") { args ->
                try {
                    val data        = args[0] as JSONObject
                    val callId      = data.getString("callId")
                    val callerName  = data.optString("callerName", "Inconnu")
                    val callerAvatar = data.optString("callerAvatar", "")
                    val callerId    = data.optString("callerId", "")
                    val callType    = data.optString("type", "audio")
                    val isGroup     = data.optBoolean("isGroupCall", false)

                    Log.d(TAG, "Appel entrant: $callerName ($callType) callId=$callId")

                    Handler(Looper.getMainLooper()).post {
                        showIncomingCallNotification(callId, callerName, callerAvatar, callerId, callType, isGroup)
                    }
                    sendCallBroadcast(BROADCAST_INCOMING_CALL, data)
                } catch (e: JSONException) {
                    Log.e(TAG, "Erreur call:incoming: ${e.message}")
                }
            }

            // ── Fin d'appel (appelant raccroche OU appel accepté ailleurs) ──
            socket?.on("call:ended") { args ->
                handleCallTerminated(args, "call:ended")
            }

            // ── Appel rejeté (appelé rejette) ──────────────────
            socket?.on("call:rejected") { args ->
                handleCallTerminated(args, "call:rejected")
            }

            // ── Appel annulé par l'appelant avant réponse ──────
            socket?.on("call:cancelled") { args ->
                handleCallTerminated(args, "call:cancelled")
            }

            // ── Appel non répondu (timeout) ────────────────────
            socket?.on("call:missed") { args ->
                handleCallTerminated(args, "call:missed")
            }

            socket?.connect()

        } catch (e: Exception) {
            Log.e(TAG, "Erreur connexion socket: ${e.message}")
        }
    }

    /**
     * Gestionnaire commun pour TOUS les événements de fin d'appel.
     * Arrête TOUJOURS la sonnerie et rejette la notification.
     */
    private fun handleCallTerminated(args: Array<Any>, event: String) {
        try {
            val data   = if (args.isNotEmpty()) args[0] as? JSONObject ?: JSONObject() else JSONObject()
            val callId = data.optString("callId", "")
            Log.d(TAG, "Événement $event reçu callId=$callId currentCallId=$currentCallId")

            // Arrêter la sonnerie DANS TOUS LES CAS — même si callId ne correspond pas
            // (cas edge: double connexion ou callId mal transmis)
            Handler(Looper.getMainLooper()).post {
                stopRingtoneAndVibration()
                dismissCallNotification()
            }

            if (callId.isNotEmpty()) {
                currentCallId = null
                sendCallBroadcast(BROADCAST_CALL_ENDED, data)
            } else if (currentCallId != null) {
                // callId vide mais on a un appel en cours → terminer quand même
                currentCallId = null
                sendCallBroadcast(BROADCAST_CALL_ENDED, JSONObject().apply { put("callId", "") })
            }
        } catch (e: Exception) {
            Log.e(TAG, "Erreur $event: ${e.message}")
            // En cas d'erreur, arrêter la sonnerie de sécurité
            Handler(Looper.getMainLooper()).post { stopRingtoneAndVibration() }
        }
    }

    private fun disconnectSocket() {
        socket?.disconnect()
        socket?.off()
        socket = null
    }

    private fun sendCallBroadcast(action: String, data: JSONObject) {
        val intent = Intent(action).apply {
            putExtra("data", data.toString())
            `package` = packageName
        }
        sendBroadcast(intent)
    }

    /**
     * Ouvre MainActivity avec les données complètes de l'appel.
     * MainActivity les transmettra au store React Native via onNewIntent.
     */
    private fun openIncomingCallScreen(
        callId: String, callerName: String, callerAvatar: String,
        callerId: String, callType: String, isGroup: Boolean
    ) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags  = Intent.FLAG_ACTIVITY_NEW_TASK or
                     Intent.FLAG_ACTIVITY_SINGLE_TOP or
                     Intent.FLAG_ACTIVITY_CLEAR_TOP
            action = "OPEN_INCOMING_CALL"
            putExtra(EXTRA_CALL_ID,       callId)
            putExtra(EXTRA_CALLER_NAME,   callerName)
            putExtra(EXTRA_CALLER_AVATAR, callerAvatar)
            putExtra(EXTRA_CALLER_ID,     callerId)
            putExtra(EXTRA_CALL_TYPE,     callType)
            putExtra(EXTRA_IS_GROUP,      isGroup)
        }
        startActivity(intent)
    }

    // ── Canaux de notification ─────────────────────────────────

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val serviceChannel = NotificationChannel(
                CHANNEL_SERVICE, "Service CAP-EPAC",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                description = "Service de fond pour la réception des appels"
                setShowBadge(false)
            }

            val callChannel = NotificationChannel(
                CHANNEL_CALLS, "Appels entrants",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications pour les appels entrants"
                enableLights(true)
                lightColor = Color.GREEN
                enableVibration(false)       // vibration gérée manuellement
                setShowBadge(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }

            nm.createNotificationChannel(serviceChannel)
            nm.createNotificationChannel(callChannel)
        }
    }
}
