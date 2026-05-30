#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# CAP-EPAC Mobile — Fix Java + Gradle + Build
# Copier-coller dans le terminal depuis cap-epac-mobile/
# ═══════════════════════════════════════════════════════════════

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERREUR]${NC} $1"; exit 1; }

echo -e "\n${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   CAP-EPAC Mobile — Fix Java + Gradle               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}\n"

[ -f "package.json" ] || error "Lancer depuis le dossier cap-epac-mobile/"
[ -d "node_modules/react-native" ] || error "Lancer npm install d'abord"

# ── 1. Corriger JAVA_HOME — Java 21 est installé, pas Java 17 ──
info "Correction de JAVA_HOME..."

JAVA21="/usr/lib/jvm/java-21-openjdk-amd64"
if [ -x "$JAVA21/bin/java" ]; then
    export JAVA_HOME="$JAVA21"
    info "JAVA_HOME → $JAVA21 ✅"
else
    # Trouver Java automatiquement
    JAVACMD=$(which java 2>/dev/null)
    [ -n "$JAVACMD" ] || error "Java introuvable. Installer : sudo apt install openjdk-21-jdk"
    export JAVA_HOME=$(dirname $(dirname $(readlink -f "$JAVACMD")))
    info "JAVA_HOME → $JAVA_HOME ✅"
fi

# Mettre à jour ~/.bashrc pour les prochaines sessions
if grep -q "java-17-openjdk" ~/.bashrc 2>/dev/null; then
    sed -i 's|JAVA_HOME=.*java-17.*|JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64|g' ~/.bashrc
    info "~/.bashrc mis à jour (java-17 → java-21) ✅"
fi

# Vider les variables parasites
unset JAVA_TOOL_OPTIONS GRADLE_OPTS _JAVA_OPTIONS
info "Variables JVM parasites vidées ✅"

# Vérification
java_ver=$("$JAVA_HOME/bin/java" -version 2>&1 | head -1)
info "Java actif : $java_ver"

# ── 2. Réécrire gradlew proprement ─────────────────────────────
info "Réécriture de android/gradlew..."
cat > android/gradlew << 'GRADLEW'
#!/usr/bin/env sh
PRG="$0"
while [ -h "$PRG" ]; do
  ls=`ls -ld "$PRG"`
  link=`expr "$ls" : '.*-> \(.*\)$'`
  if expr "$link" : '/.*' > /dev/null; then
    PRG="$link"
  else
    PRG=`dirname "$PRG"`"/$link"
  fi
done
cd "`dirname \"$PRG\"`/" >/dev/null
APP_HOME="`pwd -P`"
CLASSPATH="$APP_HOME/gradle/wrapper/gradle-wrapper.jar"
if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    JAVACMD="$JAVA_HOME/bin/java"
else
    JAVACMD="java"
fi
exec "$JAVACMD" -Xmx4096m -XX:MaxMetaspaceSize=512m \
    -classpath "$CLASSPATH" \
    org.gradle.wrapper.GradleWrapperMain "$@"
GRADLEW
chmod +x android/gradlew
info "gradlew réécrit ✅"

# ── 3. Corriger gradle-wrapper.properties ──────────────────────
info "Correction gradle-wrapper.properties..."
mkdir -p android/gradle/wrapper
cat > android/gradle/wrapper/gradle-wrapper.properties << 'EOF'
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.10.2-all.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
EOF
info "gradle-wrapper.properties OK ✅"

# ── 4. Corriger build.gradle racine ────────────────────────────
info "Correction android/build.gradle..."
cat > android/build.gradle << 'EOF'
buildscript {
    ext {
        buildToolsVersion = "35.0.0"
        minSdkVersion = 24
        compileSdkVersion = 35
        targetSdkVersion = 35
        ndkVersion = "27.1.12297006"
        kotlinVersion = "2.0.21"
    }
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.6.1")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")
        classpath("com.facebook.react:react-native-gradle-plugin")
    }
}

allprojects {
    repositories {
        maven { url "$rootDir/../node_modules/react-native/android" }
        maven { url "$rootDir/../node_modules/jsc-android/dist" }
        google()
        mavenCentral()
        maven { url 'https://www.jitpack.io' }
    }
}
EOF
info "build.gradle ✅"

# ── 5. Corriger settings.gradle ────────────────────────────────
info "Correction android/settings.gradle..."
cat > android/settings.gradle << 'EOF'
rootProject.name = 'CapEpacMobile'
apply from: file("../node_modules/@react-native-community/cli-platform-android/native_modules.gradle");
applyNativeModulesSettingsGradle(settings)
include ':app'
includeBuild('../node_modules/@react-native/gradle-plugin')
EOF
info "settings.gradle "

# ── 6. Corriger app/build.gradle ───────────────────────────────
info "Correction android/app/build.gradle..."
cat > android/app/build.gradle << 'EOF'
apply plugin: "com.android.application"
apply plugin: "org.jetbrains.kotlin.android"
apply plugin: "com.facebook.react"

react {
    hermesEnabled = true
}

android {
    ndkVersion rootProject.ext.ndkVersion
    buildToolsVersion rootProject.ext.buildToolsVersion
    compileSdk rootProject.ext.compileSdkVersion
    namespace "com.capepacmobile"

    defaultConfig {
        applicationId "com.capepacmobile"
        minSdk rootProject.ext.minSdkVersion
        targetSdk rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0.0"
    }

    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }

    buildTypes {
        debug { signingConfig signingConfigs.debug }
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("com.facebook.react:react-android")
    implementation("com.facebook.react:hermes-android")
}

apply from: file("../../node_modules/@react-native-community/cli-platform-android/native_modules.gradle")
applyNativeModulesAppBuildGradle(project)
EOF
info "app/build.gradle ✅"

# ── 7. Corriger gradle.properties ──────────────────────────────
info "Correction android/gradle.properties..."
cat > android/gradle.properties << 'EOF'
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m
org.gradle.parallel=true
org.gradle.daemon=true
android.useAndroidX=true
android.enableJetifier=true
hermesEnabled=true
newArchEnabled=false
EOF
info "gradle.properties ✅"

# ── 8. Corriger MainApplication.kt ─────────────────────────────
info "Correction MainApplication.kt..."
mkdir -p android/app/src/main/java/com/capepacmobile
cat > android/app/src/main/java/com/capepacmobile/MainApplication.kt << 'EOF'
package com.capepacmobile

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> = PackageList(this).packages
            override fun getJSMainModuleName(): String = "index"
            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG
            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, false)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) { load() }
    }
}
EOF
info "MainApplication.kt ✅"

# ── 9. Corriger MainActivity.kt ─────────────────────────────────
info "Correction MainActivity.kt..."
cat > android/app/src/main/java/com/capepacmobile/MainActivity.kt << 'EOF'
package com.capepacmobile

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String = "CapEpacMobile"
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
EOF
info "MainActivity.kt ✅"

# ── 10. Keystore debug ──────────────────────────────────────────
if [ ! -f "android/app/debug.keystore" ]; then
    info "Génération keystore debug..."
    keytool -genkey -v \
        -keystore android/app/debug.keystore \
        -storepass android -alias androiddebugkey -keypass android \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -dname "CN=Android Debug,O=Android,C=US" 2>/dev/null \
    && info "Keystore ✅" || warn "Keystore non généré (keytool absent)"
fi

# ── 11. Nettoyer tous les caches ────────────────────────────────
info "Nettoyage des caches..."
rm -rf android/.gradle android/app/build android/build 2>/dev/null || true
# Nettoyer aussi le cache Gradle utilisateur lié à ce projet
rm -rf ~/.gradle/caches/*/scripts* 2>/dev/null || true
info "Caches nettoyés ✅"

# ── 12. Test rapide gradlew ─────────────────────────────────────
info "Test de gradlew..."
cd android
JAVA_HOME="$JAVA_HOME" ./gradlew --version 2>&1 | grep -E "Gradle|JVM" | head -3
if [ $? -ne 0 ]; then
    error "gradlew toujours en erreur — voir message ci-dessus"
fi
cd ..
info "gradlew fonctionne ✅"

# ── 13. Vérifier appareil Android ──────────────────────────────
echo ""
info "Appareils Android connectés :"
adb devices

DEVICES=$(adb devices 2>/dev/null | grep -v "List of" | grep "device$" | wc -l)
if [ "$DEVICES" -eq 0 ]; then
    warn "Aucun appareil détecté — brancher le TECNO KI5k et autoriser le débogage"
    warn "Puis relancer : JAVA_HOME=$JAVA_HOME npx react-native run-android"
    exit 0
fi

# ── 14. Lancer l'app ────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Tout est prêt — Compilation en cours...            ║${NC}"
echo -e "${GREEN}║  (première fois : 5-15 min selon connexion)         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

JAVA_HOME="$JAVA_HOME" npx react-native run-android