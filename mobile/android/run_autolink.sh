#!/bin/bash
set -e
cd /home/houndokinnou/Documents/projets/telephonie-cap-epac/mobile/android
./gradlew generateAutolinkingPackageList
echo "AUTOLINK_DONE"
