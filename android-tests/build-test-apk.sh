#!/usr/bin/env bash
set -euo pipefail
script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
output_apk=$(realpath "$1")
task_dir=$(mktemp -d)
trap 'rm -rf -- "$task_dir"' EXIT
android_jar="$ANDROID_HOME/platforms/android-35/android.jar"
tools="$ANDROID_HOME/build-tools/36.0.0"
mkdir -p "$task_dir/classes" "$task_dir/dex"
javac -encoding UTF-8 -source 8 -target 8 -cp "$android_jar" -d "$task_dir/classes" "$script_dir/SyncServiceInstrumentation.java"
jar cf "$task_dir/classes.jar" -C "$task_dir/classes" .
"$tools/d8" --lib "$android_jar" --min-api 24 --output "$task_dir/dex" "$task_dir/classes.jar"
cat > "$task_dir/AndroidManifest.xml" <<'XML'
<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.kodjodevf.mangayomi.illustrations.test">
  <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="35" />
  <application android:label="Mangayomi background service test" />
  <instrumentation android:name="com.kodjodevf.mangayomi.SyncServiceInstrumentation" android:targetPackage="com.kodjodevf.mangayomi.illustrations" />
</manifest>
XML
"$tools/aapt" package -f -M "$task_dir/AndroidManifest.xml" -I "$android_jar" -F "$task_dir/unsigned.apk"
zip -j "$task_dir/unsigned.apk" "$task_dir/dex/classes.dex"
python3 - "$task_dir/test-signing.p12" <<'PY'
import base64, os, sys
from pathlib import Path
Path(sys.argv[1]).write_bytes(base64.b64decode(os.environ['SIGNING_KEYSTORE']))
PY
"$tools/apksigner" sign --ks "$task_dir/test-signing.p12" --ks-type PKCS12 --ks-key-alias illustrations --ks-pass env:SIGNING_PASSWORD --key-pass env:SIGNING_PASSWORD --out "$task_dir/signed.apk" "$task_dir/unsigned.apk"
cp "$task_dir/signed.apk" "$output_apk"
