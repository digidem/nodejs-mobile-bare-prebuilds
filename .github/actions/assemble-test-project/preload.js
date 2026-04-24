// preload.js — runs before test.js. For each addon registered in
// addon-manifest.json:
//   1. process.dlopen() the native lib out of NATIVE_LIB_DIR.
//   2. Patch Module.prototype.require so require('<module>') returns the
//      pre-loaded exports instead of letting the module's own internal
//      loader (node-gyp-build / bindings / require-addon) walk
//      node_modules/<module>/prebuilds/.
//   3. Patch require.extensions['.node'] as a safety-net for any
//      direct-path loads.
//
// The host (TestActivity on android / AppDelegate on ios) sets
// NATIVE_LIB_DIR in the environment before starting node:
//   android: getApplicationInfo().nativeLibraryDir  (jniLibs/<abi>/)
//   ios:     <app>.app/Frameworks                   (embedded xcframeworks)
//
// On iOS the manifest value is '<name>.xcframework' but by the time the
// app is running, the Run Script build phase has already copied the right
// slice into Frameworks/<name>.framework; we dlopen the Mach-O directly.

'use strict'

const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')

const manifestPath = path.join(__dirname, 'addon-manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

const NATIVE_LIB_DIR = process.env.NATIVE_LIB_DIR
if (!NATIVE_LIB_DIR) {
  throw new Error('NATIVE_LIB_DIR env var not set; host must export it before starting node')
}

const preloaded = new Map()
const basenameIndex = new Map()

for (const [name, file] of Object.entries(manifest.addons)) {
  let fullPath
  let indexKey
  if (manifest.platform === 'ios') {
    const base = path.basename(file, '.xcframework')
    // Run Script build phase placed the matching slice here as
    // <base>.framework/<base>.
    fullPath = path.join(NATIVE_LIB_DIR, base + '.framework', base)
    indexKey = base
  } else {
    fullPath = path.join(NATIVE_LIB_DIR, file)
    indexKey = path.basename(file).replace(/^lib/, '').replace(/\.so$/, '')
  }
  const m = { exports: {} }
  process.dlopen(m, fullPath)
  preloaded.set(name, m.exports)
  basenameIndex.set(indexKey, m.exports)
}

const origRequire = Module.prototype.require
Module.prototype.require = function patchedRequire(id) {
  if (preloaded.has(id)) return preloaded.get(id)
  return origRequire.call(this, id)
}

const origNodeExt = require.extensions['.node']
require.extensions['.node'] = function loadNode(module, filename) {
  const base = path.basename(filename, '.node').replace(/^lib/, '')
  const hit = basenameIndex.get(base)
  if (hit) {
    module.exports = hit
    return
  }
  return origNodeExt(module, filename)
}
