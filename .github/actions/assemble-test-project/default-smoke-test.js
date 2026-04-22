// Template for the default smoke test used by the `assemble-test-project`
// composite action when the caller does not provide a `test_script`.
// `__MODULE_NAME__` is substituted with the module name at CI time.

try {
  require('__MODULE_NAME__')
  console.log('TAP version 13')
  console.log('1..1')
  console.log('ok 1 - require(__MODULE_NAME__) succeeded')
  process.exit(0)
} catch (err) {
  console.log('TAP version 13')
  console.log('1..1')
  console.log('not ok 1 - require(__MODULE_NAME__) threw')
  console.log('  ---')
  console.log('  message: ' + JSON.stringify(err && err.message))
  console.log('  stack: |')
  for (const line of String((err && err.stack) || err).split('\n')) {
    console.log('    ' + line)
  }
  console.log('  ...')
  process.exit(1)
}
