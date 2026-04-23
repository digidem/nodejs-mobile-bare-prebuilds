// Runs the module-under-test's own test suite inside nodejs-mobile.
//
// The module's tests are populated by the assemble-test-project action
// (overlaid from the upstream git ref recorded in npm metadata, since
// tarballs usually exclude them). Two layouts are supported:
//
//   - directory:   node_modules/<module>/test/*.{js,mjs,cjs}
//   - single-file: node_modules/<module>/test.{js,mjs,cjs}
//
// DevDeps are installed into `node_modules/<module>/node_modules/` from
// the tarball's package.json, so whatever runner the module declares —
// brittle, tape, tap, etc. — is resolvable at load time.
//
// We don't invoke the runner's CLI (there's no shell in an embedded
// nodejs-mobile runtime). Most JS test runners register tests at import
// time and auto-flush on event-loop drain, so loading each test file in
// order is equivalent to running the module's own `npm test` script.
//
// Config (module name + exclude list) is read from the JSON file the
// composite action drops next to this file — no placeholder substitution,
// so this template is a plain runnable file.

const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')

const { moduleName, testExclude = [] } = require('./harness-config.json')

const moduleRoot = path.join(__dirname, 'node_modules', moduleName)
const TEST_EXTS = ['.js', '.mjs', '.cjs']
const EXCLUDE = new Set(testExclude)

function discoverTestFiles() {
  // Directory layout: node_modules/<module>/test/*.{js,mjs,cjs}
  const testDir = path.join(moduleRoot, 'test')
  if (fs.existsSync(testDir) && fs.statSync(testDir).isDirectory()) {
    const dirFiles = fs
      .readdirSync(testDir)
      .filter((f) => TEST_EXTS.some((ext) => f.endsWith(ext)))
      .filter((f) => !EXCLUDE.has(f))
      .sort()
      .map((f) => path.join(testDir, f))
    if (dirFiles.length > 0) return dirFiles
  }

  // Single-file layout: node_modules/<module>/test.{js,mjs,cjs}
  for (const ext of TEST_EXTS) {
    const name = 'test' + ext
    if (EXCLUDE.has(name)) continue
    const p = path.join(moduleRoot, name)
    if (fs.existsSync(p)) return [p]
  }

  return []
}

async function main() {
  if (EXCLUDE.size > 0) {
    // TAP comment — parsers ignore it, humans see it in the workflow log.
    console.log('# excluded: ' + [...EXCLUDE].sort().join(', '))
  }

  const files = discoverTestFiles()

  if (files.length === 0) {
    console.log('TAP version 13')
    console.log('1..1')
    console.log(
      'not ok 1 - ' +
        moduleName +
        ' has no test files (expected test/*.{js,mjs,cjs} or test.{js,mjs,cjs} at module root — overlay failed?)'
    )
    console.log('  ---')
    console.log('  moduleRoot: ' + JSON.stringify(moduleRoot))
    console.log('  ...')
    process.exit(1)
  }

  // Use dynamic `import()` so ESM (.mjs or `"type": "module"` .js) loads
  // alongside CJS. `import()` accepts a file URL reliably across Node
  // versions.
  for (const file of files) {
    await import(pathToFileURL(file).href)
  }
}

main().catch((err) => {
  console.error('Fatal error loading tests from ' + moduleName + ':')
  console.error(err && err.stack ? err.stack : err)
  process.exit(1)
})
