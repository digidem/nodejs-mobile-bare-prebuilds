// Default smoke test used by the `assemble-test-project` composite action
// when `test_runner` is 'smoke'. Reads the module name from the JSON config
// file the action drops next to this file at CI time, so this template is
// a plain, runnable file — no placeholder substitution.

const { moduleName } = require('./harness-config.json')

try {
  require(moduleName)
  console.log('TAP version 13')
  console.log('1..1')
  console.log('ok 1 - require(' + moduleName + ') succeeded')
  process.exit(0)
} catch (err) {
  console.log('TAP version 13')
  console.log('1..1')
  console.log('not ok 1 - require(' + moduleName + ') threw')
  console.log('  ---')
  console.log('  message: ' + JSON.stringify(err && err.message))
  console.log('  stack: |')
  for (const line of String((err && err.stack) || err).split('\n')) {
    console.log('    ' + line)
  }
  console.log('  ...')
  process.exit(1)
}
