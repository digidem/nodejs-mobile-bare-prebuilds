// Runs before test.js. dlopen()s the addon under test out of
// NATIVE_LIB_DIR (set by the native host) and patches
// Module.prototype.require so `require('<module>')` returns the pre-loaded
// exports instead of letting the module's own loader walk
// node_modules/<module>/prebuilds/.
//
// Host-provided path:
//   android: getApplicationInfo().nativeLibraryDir  (jniLibs/<abi>/)
//   ios:     <app>.app/Frameworks                   (embedded xcframeworks)

'use strict'

const path = require('node:path')
const Module = require('node:module')

const { platform, moduleName, addonFilename } = require('./harness-config.json')

const libDir = process.env.NATIVE_LIB_DIR
if (!libDir) {
  throw new Error('NATIVE_LIB_DIR env var not set; host must export it before starting node')
}

let addonPath
if (platform === 'ios') {
  // Embed Addons build phase placed the matching slice here as
  // Frameworks/<base>.framework/<base> (the Mach-O inside the .framework
  // wrapper).
  const base = path.basename(addonFilename, '.xcframework')
  addonPath = path.join(libDir, base + '.framework', base)
} else {
  addonPath = path.join(libDir, addonFilename)
}

const addon = { exports: {} }
process.dlopen(addon, addonPath)

const origRequire = Module.prototype.require
Module.prototype.require = function patchedRequire (id) {
  if (id === moduleName) return addon.exports
  return origRequire.call(this, id)
}
