// Entry point placed as `main.js` inside the test-harness's nodejs-project.
// Installs a process `exit` handler that prints the `__NODE_EXIT__:<code>`
// sentinel the CI workflow greps for, then hands off to the test script.
//
// The handler is needed because `process.exit()` inside node calls libc
// `exit()` directly, which terminates the whole app/process without the
// native harness's post-`node_start` code ever running. `process.on('exit')`
// fires synchronously before the exit, so the sentinel still lands in stdout
// (streamed through `simctl launch --console-pty` on iOS, or through the
// stdout-to-logcat pump on Android).

process.on('exit', (code) => {
  process.stdout.write('__NODE_EXIT__:' + code + '\n')
})

// preload.js installs the require() patch that makes require('<module>')
// return a pre-dlopen'd handle. Must run before test.js — which loads the
// module under test — so the patch is in place when that require() fires.
//
// Errors are routed through stdout instead of stderr: on Android the
// native host pipes stdout→logcat(INFO) and stderr→logcat(ERROR) via
// separate pump threads, and then calls System.exit() immediately after
// node::Start() returns. The `__NODE_EXIT__:` sentinel (written through
// stdout in the exit handler above) is known to survive that race; the
// stderr pump sometimes loses its tail. Writing errors to stdout here
// guarantees they show up before the sentinel.
try {
  require('./preload.js')
  require('./test.js')
} catch (err) {
  const msg = err && (err.stack || err.message) || String(err)
  process.stdout.write('HARNESS_ERROR: ' + msg + '\n')
  process.exit(1)
}
