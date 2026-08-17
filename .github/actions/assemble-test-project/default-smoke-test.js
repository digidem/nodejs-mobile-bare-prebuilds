// Default smoke test used by the `assemble-test-project` composite action
// when `test_runner` is 'smoke'. Reads the module name from the JSON config
// file the action drops next to this file at CI time, so this template is
// a plain, runnable file — no placeholder substitution.

const fs = require('fs')

const { moduleName } = require('./harness-config.json')

// `err.stack` omits `cause`, so print the chain.
function errorChain(err) {
  const lines = []
  let e = err
  for (let depth = 0; e && depth < 5; depth++) {
    if (depth > 0) lines.push('caused by:')
    for (const line of String(e.stack || e).split('\n')) lines.push(line)
    e = e.cause
  }
  return lines
}

// require-addon raises "Cannot find addon" when every candidate fails to
// *load* — not only when none exist. A prebuild that is present but can't
// dlopen (built without linking libnode.so so napi_* never resolves, wrong
// ABI, …) therefore reports exactly like a missing file, which is precisely
// the failure this smoke test exists to catch. Its `cause` doesn't settle it
// either: the resolver overwrites `cause` per candidate, so it ends up holding
// the last candidate's error, normally a "Cannot find module" for a path that
// never existed.
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
      lines.push(file + ': loaded on retry (original failure was elsewhere)')
    } catch (e) {
      lines.push(file + ': ' + (e && e.message ? e.message : e))
    }
  }

  if (lines.length === 0) {
    return ['no candidate exists on disk — no prebuild was installed for this target']
  }
  return ['candidate(s) present but failed to load:'].concat(lines)
}

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
  const diagnostics = addonDiagnostics(err)
  if (diagnostics.length > 0) {
    console.log('  addon_diagnostics: |')
    for (const line of diagnostics) console.log('    ' + line)
  }
  console.log('  stack: |')
  for (const line of errorChain(err)) {
    console.log('    ' + line)
  }
  console.log('  ...')
  process.exit(1)
}
