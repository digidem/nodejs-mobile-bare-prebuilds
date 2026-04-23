// Runs the module-under-test's own test suite inside nodejs-mobile.
//
// The module's `test/` folder is populated by the assemble-test-project
// action (overlaid from the upstream git ref recorded in npm metadata,
// since tarballs usually exclude test/). DevDeps are installed into
// `node_modules/<module>/node_modules/` from the tarball's package.json,
// so whatever runner the module declares — brittle, tape, tap, etc. —
// is resolvable at require() time.
//
// We don't invoke the runner's CLI (there's no shell in an embedded
// nodejs-mobile runtime). Most JS test runners register tests at import
// time and auto-flush on event-loop drain, so requiring each test file
// in order is equivalent to running the module's own `npm test` script.
//
// __MODULE_NAME__ is substituted at CI time by the assemble-test-project
// composite action.

const fs = require('fs')
const path = require('path')

const moduleRoot = path.join(__dirname, 'node_modules', '__MODULE_NAME__')
const testDir = path.join(moduleRoot, 'test')

if (!fs.existsSync(testDir)) {
  console.log('TAP version 13')
  console.log('1..1')
  console.log("not ok 1 - __MODULE_NAME__ has no test/ directory (overlay failed?)")
  console.log('  ---')
  console.log('  moduleRoot: ' + JSON.stringify(moduleRoot))
  console.log('  ...')
  process.exit(1)
}

const files = fs
  .readdirSync(testDir)
  .filter((f) => f.endsWith('.js'))
  .sort()

if (files.length === 0) {
  console.log('TAP version 13')
  console.log('1..1')
  console.log("not ok 1 - __MODULE_NAME__'s test/ directory has no .js files")
  process.exit(1)
}

for (const f of files) {
  require(path.join(testDir, f))
}
