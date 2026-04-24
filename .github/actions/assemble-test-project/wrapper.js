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
require('./preload.js')
require('./test.js')
