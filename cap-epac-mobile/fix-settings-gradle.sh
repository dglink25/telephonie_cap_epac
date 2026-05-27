#!/bin/bash
# Fix settings.gradle et app/build.gradle pour RN 0.76
# Exécuter depuis cap-epac-mobile/

GREEN='\033[0;32m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC}  $1"; }

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  CAP-EPAC — Fix settings.gradle pour RN 0.76        ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""

[ -f "package.json" ] || { echo "ERREUR: lancer depuis cap-epac-mobile/"; exit 1; }

# Détecter la version exacte de RN installée
RN_VERSION=$(node -e "console.log(require('./node_modules/react-native/package.json').version)" 2>/dev/null)
info "React Native version : $RN_VERSION"

# Détecter si cli-platform-android existe
CLI_ANDROID="node_modules/@react-native-community/cli-platform-android"
RN_GRADLE_PLUGIN="node_modules/@react-native/gradle-plugin"

info "Vérification des modules disponibles..."
ls "$CLI_ANDROID" >/dev/null 2>&1 && HAS_CLI_ANDROID=true || HAS_CLI_ANDROID=false
ls "$RN_GRADLE_PLUGIN" >/dev/null 2>&1 && HAS_GRADLE_PLUGIN=true || HAS_GRADLE_PLUGIN=false

info "cli-platform-android : $HAS_CLI_ANDROID"
info "@react-native/gradle-plugin : $HAS_GRADLE_PLUGIN"

# ── settings.gradle adapté à RN 0.76 ──────────────────────────
info "Réécriture settings.gradle (RN 0.76 style)..."

if [ "$HAS_CLI_ANDROID" = "true" ]; then
    # Ancienne méthode avec cli-platform-android
    cat > android/settings.gradle << 'GRADLE'
rootProject.name = 'CapEpacMobile'
apply from: file("../node_modules/@react-native-community/cli-platform-android/native_modules.gradle");
applyNativeModulesSettingsGradle(settings)
include ':app'
includeBuild('../node_modules/@react-native/gradle-plugin')
GRADLE
    info "settings.gradle → mode cli-platform-android ✅"
else
    # RN 0.76+ nouvelle méthode sans cli-platform-android
    cat > android/settings.gradle << 'GRADLE'
pluginManagement {
    includeBuild("../node_modules/@react-native/gradle-plugin")
}

plugins {
    id("com.facebook.react.settings")
}

extensions.configure(com.facebook.react.ReactSettingsExtension) { ex ->
    ex.autolinkLibrariesFromCommand()
}

rootProject.name = 'CapEpacMobile'
include ':app'
GRADLE
    info "settings.gradle → mode RN 0.76 autolink ✅"
fi

# ── build.gradle racine adapté ─────────────────────────────────
info "Réécriture build.gradle racine..."

if [ "$HAS_CLI_ANDROID" = "true" ]; then
    cat > android/build.gradle << 'GRADLE'
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
GRADLE
else
    # RN 0.76 — le plugin rootproject est géré via pluginManagement
    cat > android/build.gradle << 'GRADLE'
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
    }
}
allprojects {
    repositories {
        maven { url "$rootDir/../node_modules/react-native/android" }
        google()
        mavenCentral()
        maven { url 'https://www.jitpack.io' }
    }
}
GRADLE
fi
info "build.gradle racine ✅"

# ── app/build.gradle adapté ────────────────────────────────────
info "Réécriture app/build.gradle..."

if [ "$HAS_CLI_ANDROID" = "true" ]; then
    NATIVE_MODULES_BOTTOM='apply from: file("../../node_modules/@react-native-community/cli-platform-android/native_modules.gradle")
applyNativeModulesAppBuildGradle(project)'
else
    NATIVE_MODULES_BOTTOM='apply plugin: "com.facebook.react"'
fi

cat > android/app/build.gradle << GRADLE
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
GRADLE

if [ "$HAS_CLI_ANDROID" = "true" ]; then
    cat >> android/app/build.gradle << 'GRADLE'
apply from: file("../../node_modules/@react-native-community/cli-platform-android/native_modules.gradle")
applyNativeModulesAppBuildGradle(project)
GRADLE
fi
info "app/build.gradle "

# ── Nettoyer caches ────────────────────────────────────────────
info "Nettoyage des caches Gradle..."
rm -rf android/.gradle android/app/build android/build 2>/dev/null
info "Caches nettoyés "

# ── Test gradlew ───────────────────────────────────────────────
info "Test gradlew..."
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
cd android && JAVA_HOME=$JAVA_HOME ./gradlew --version 2>&1 | grep -E "^Gradle|^JVM" | head -2 && cd ..
info "gradlew OK "

# ── Lancer ────────────────────────────────────────────────────
echo ""
info "Lancement de react-native run-android..."
echo ""
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 npx react-native run-android