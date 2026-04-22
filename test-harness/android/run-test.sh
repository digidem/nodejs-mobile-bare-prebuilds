#!/usr/bin/env bash
# Runs inside reactivecircus/android-emulator-runner's `script:` input.
# That action runs each LINE of its `script:` input as a separate
# `sh -c` invocation, which loses variable state (and `set` flags)
# across lines. Putting the logic in this committed file keeps it a
# single line in the workflow and a single bash process at runtime.

set -euo pipefail

APK="${GITHUB_WORKSPACE}/.nodejs-mobile-bare-prebuilds/test-harness/android/app/build/outputs/apk/debug/app-debug.apk"

adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed) ]]; do sleep 1; done'
adb install -r -g "$APK"
adb logcat -c

# Launch the activity. The app pumps node's stdout/stderr to logcat
# tag NODEJS-MOBILE and emits __NODE_EXIT__:<code> when done.
adb shell am start -W -n com.digidem.nodejstest/.TestActivity

# Stream logcat; awk echoes each line (so TAP lands in the workflow
# log) and captures the exit code from the sentinel.
: > /tmp/node_exit
set +e
timeout 1200 adb logcat -v raw -s NODEJS-MOBILE:V | awk '
  { print }
  /__NODE_EXIT__:/ {
    if (match($0, /__NODE_EXIT__:-?[0-9]+/)) {
      s = substr($0, RSTART, RLENGTH)
      sub(/^__NODE_EXIT__:/, "", s)
      print "NODE_EXIT_CODE=" s > "/tmp/node_exit"
      close("/tmp/node_exit")
      exit
    }
  }
'
set -e

if [ ! -s /tmp/node_exit ]; then
  echo "::error::Did not observe __NODE_EXIT__ sentinel within timeout"
  exit 1
fi
# shellcheck disable=SC1091
. /tmp/node_exit
echo "Node process exited with code ${NODE_EXIT_CODE}"
exit "${NODE_EXIT_CODE}"
