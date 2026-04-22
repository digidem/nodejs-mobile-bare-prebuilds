#!/usr/bin/env bash
# Runs inside reactivecircus/android-emulator-runner's `script:` input.
# That action runs each LINE of its `script:` input as a separate
# `sh -c` invocation, which loses variable state (and `set` flags)
# across lines. Putting the logic in this committed file keeps it a
# single line in the workflow and a single bash process at runtime.

set -euo pipefail

APK="${GITHUB_WORKSPACE}/.nodejs-mobile-bare-prebuilds/test-harness/android/app/build/outputs/apk/debug/app-debug.apk"
TIMEOUT_SECONDS=1200

adb wait-for-device shell 'while [[ -z $(getprop sys.boot_completed) ]]; do sleep 1; done'
adb install -r -g "$APK"
adb logcat -c

# Launch the activity. The app pumps node's stdout/stderr to logcat tag
# NODEJS-MOBILE and emits __NODE_EXIT__:<code> when done.
adb shell am start -W -n com.digidem.nodejstest/.TestActivity

# Run logcat as a coprocess so we can kill it explicitly once the sentinel
# is seen. (A plain `adb logcat | awk` pipeline hangs because adb only
# notices the pipe has closed when it next tries to write, and no further
# lines are coming once the app has exited.)
coproc LOGCAT { adb logcat -v raw -s NODEJS-MOBILE:V; }

EXIT_CODE=""
SECONDS=0
while (( SECONDS < TIMEOUT_SECONDS )); do
  # Per-read timeout keeps the outer timeout check live even when logcat
  # is silent (app crashed without emitting the sentinel, etc.).
  if IFS= read -r -u "${LOGCAT[0]}" -t 10 line; then
    printf '%s\n' "$line"
    case "$line" in
      *__NODE_EXIT__:*)
        EXIT_CODE="${line##*__NODE_EXIT__:}"
        break
        ;;
    esac
  fi
done

kill "${LOGCAT_PID}" 2>/dev/null || true
wait "${LOGCAT_PID}" 2>/dev/null || true

if [ -z "$EXIT_CODE" ]; then
  echo "::error::Did not observe __NODE_EXIT__ sentinel within ${TIMEOUT_SECONDS}s"
  exit 1
fi

echo "Node process exited with code ${EXIT_CODE}"
exit "${EXIT_CODE}"
