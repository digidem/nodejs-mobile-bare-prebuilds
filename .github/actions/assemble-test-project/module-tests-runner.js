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

// `err.stack` omits `cause`, so print the chain.
function formatError(err) {
  const parts = []
  let e = err
  for (let depth = 0; e && depth < 5; depth++) {
    parts.push((depth === 0 ? '' : 'caused by: ') + String(e.stack || e))
    e = e.cause
  }
  return parts.join('\n')
}

// require-addon raises "Cannot find addon" when every candidate fails to
// *load* — not only when none exist. A prebuild that is present but can't
// dlopen (built without linking libnode.so so napi_* never resolves, wrong
// ABI, …) therefore reports exactly like a missing file. Its `cause` doesn't
// settle it either: the resolver overwrites `cause` per candidate, so it ends
// up holding the last candidate's error, normally a "Cannot find module" for a
// path that never existed.
//
// The candidate list is on the error, so retry the ones actually on disk and
// report why each failed. That separates "prebuild wasn't installed for this
// target" from "prebuild is installed but broken".
function addonDiagnostics(err) {
  if (!err || err.code !== 'ADDON_NOT_FOUND') return []
  if (!Array.isArray(err.candidates)) return []

  const { fileURLToPath } = require('url')
  const lines = []

  for (const candidate of err.candidates) {
    let file
    try {
      file = fileURLToPath(candidate)
    } catch {
      continue // non-file: candidate (e.g. `linked:`)
    }
    if (!fs.existsSync(file)) continue
    try {
      process.dlopen({ exports: {} }, file)
      lines.push('  ' + file + ': loaded on retry (original failure was elsewhere)')
    } catch (e) {
      lines.push('  ' + file + ': ' + (e && e.message ? e.message : e))
    }
  }

  if (lines.length === 0) {
    return [
      'Addon diagnostics: no candidate exists on disk — no prebuild was installed for this target.'
    ]
  }
  return ['Addon diagnostics: candidate(s) present but failed to load:'].concat(lines)
}

main().catch((err) => {
  console.error('Fatal error loading tests from ' + moduleName + ':')
  console.error(formatError(err))
  for (const line of addonDiagnostics(err)) console.error(line)
  process.exit(1)
})
