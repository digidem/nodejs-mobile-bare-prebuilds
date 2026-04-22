// Runs the module-under-test's own test suite inside nodejs-mobile.
//
// Holepunch-style modules ship their `test/` folder in the npm tarball and
// use `brittle` as their test runner (`scripts.test` is typically something
// like `brittle test/*.js`). Brittle's "CLI" just requires each file; the
// test() calls register globally and brittle auto-flushes on event-loop
// drain, printing TAP to stdout. So we do the same here.
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
  console.log("not ok 1 - __MODULE_NAME__'s npm tarball has no test/ directory")
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
