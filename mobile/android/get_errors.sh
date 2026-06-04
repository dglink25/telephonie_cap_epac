#!/bin/bash
cd /home/houndokinnou/Documents/projets/telephonie-cap-epac/mobile/android
./gradlew assembleRelease 2>&1 | grep -A3 "error:" > /tmp/kotlin_errors.txt
echo "Errors saved to /tmp/kotlin_errors.txt"
cat /tmp/kotlin_errors.txt
