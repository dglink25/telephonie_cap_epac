#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Patch Android — corrige tous les fichiers Gradle
# Exécuter depuis le dossier mobile : bash patch-android.sh
# ═══════════════════════════════════════════════════════════════
set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   CAP-EPAC Mobile — Patch Gradle Android            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Vérifier qu'on est dans le bon dossier
[ -f "package.json" ] || { echo "ERREUR: Lancer depuis le dossier mobile"; exit 1; }
[ -d "node_modules/react-native" ] || { echo "ERREUR: Lancer npm install d'abord"; exit 1; }

# ── 1. Corriger gradlew ───────────────────────────────────────
info "Correction gradlew..."
cat > android/gradlew << 'GRADLEW'
#!/usr/bin/env sh
PRG="$0"
while [ -h "$PRG" ] ; do
    ls=`ls -ld "$PRG"`
    link=`expr "$ls" : '.*-> \(.*\)$'`
    if expr "$link" : '/.*' > /dev/null; then
        PRG="$link"
    else
        PRG=`dirname "$PRG"`"/$link"
    fi
done
SAVED="`pwd`"
cd "`dirname \"$PRG\"`/" >/dev/null
APP_HOME="`pwd -P`"
cd "$SAVED" >/dev/null
APP_NAME="Gradle"
APP_BASE_NAME=`basename "$0"`
DEFAULT_JVM_OPTS='"-Xmx64m" "-Xms64m"'
CLASSPATH=$APP_HOME/gradle/wrapper/gradle-wrapper.jar
if [ -n "$JAVA_HOME" ] ; then
    JAVACMD="$JAVA_HOME/bin/java"
else
    JAVACMD="java"
fi
APP_ARGS=""
for i do printf '%s\n' "$i" | sed "s/'/'\\\\''/g;1s/^/'/;\$s/\$/' \\\\/" ; APP_ARGS="$APP_ARGS$i " ; done
exec "$JAVACMD" $DEFAULT_JVM_OPTS $JAVA_OPTS $GRADLE_OPTS \
    "-classpath" "$CLASSPATH" \
    org.gradle.wrapper.GradleWrapperMain "$@"
GRADLEW
chmod +x android/gradlew
info "gradlew corrigé ✅"

# ── 2. Corriger build.gradle racine ──────────────────────────
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
info "build.gradle corrigé ✅"

# ── 3. Corriger settings.gradle ───────────────────────────────
info "Correction android/settings.gradle..."
cat > android/settings.gradle << 'EOF'
rootProject.name = 'CapEpacMobile'
apply from: file("../node_modules/@react-native-community/cli-platform-android/native_modules.gradle");
applyNativeModulesSettingsGradle(settings)
include ':app'
includeBuild('../node_modules/@react-native/gradle-plugin')
EOF
info "settings.gradle corrigé ✅"

# ── 4. Corriger app/build.gradle ──────────────────────────────
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
info "app/build.gradle corrigé ✅"

# ── 5. Corriger gradle.properties ─────────────────────────────
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
info "gradle.properties corrigé ✅"

# ── 6. Corriger MainApplication.kt ────────────────────────────
info "Correction MainApplication.kt..."
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
info "MainApplication.kt corrigé ✅"

# ── 7. Keystore debug ─────────────────────────────────────────
if [ ! -f "android/app/debug.keystore" ]; then
    info "Génération du keystore debug..."
    keytool -genkey -v \
        -keystore android/app/debug.keystore \
        -storepass android \
        -alias androiddebugkey \
        -keypass android \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -dname "CN=Android Debug,O=Android,C=US" \
        2>/dev/null && info "Keystore créé ✅" || warn "keytool non disponible, utiliser le keystore système"
fi

# ── 8. Nettoyer le cache Gradle ───────────────────────────────
info "Nettoyage du cache Gradle..."
rm -rf android/.gradle android/app/build 2>/dev/null || true
info "Cache nettoyé ✅"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Patch terminé — Lancement de l'app               ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
info "Compilation en cours (première fois ~5-10 min)..."
echo ""
npx react-native run-android
