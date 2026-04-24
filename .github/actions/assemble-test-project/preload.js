// Runs before test.js. dlopen()s the addon under test and patches
// Module.prototype.require so `require('<module>')` returns the pre-loaded
// exports instead of letting the module's own loader walk
// node_modules/<module>/prebuilds/.
//
// Resolution differs per platform:
//   android: bare filename — Bionic's per-app linker namespace mmaps the
//            .so straight out of the APK (extractNativeLibs="false"),
//            and a full-path dlopen would fail because the file isn't
//            actually written to nativeLibraryDir.
//   ios:     full path into <app>.app/Frameworks (NATIVE_LIB_DIR),
//            populated by the xcframework embed phase; the Frameworks
//            dir isn't on the default dylib search path, so a bare name
//            wouldn't resolve.

'use strict'

const path = require('node:path')
const Module = require('node:module')

const { platform, moduleName, addonFilename } = require('./harness-config.json')

let addonPath
if (platform === 'ios') {
  const libDir = process.env.NATIVE_LIB_DIR
  if (!libDir) {
    throw new Error('NATIVE_LIB_DIR env var not set; host must export it before starting node')
  }
  const base = path.basename(addonFilename, '.xcframework')
  addonPath = path.join(libDir, base + '.framework', base)
} else {
  addonPath = addonFilename
}

const addon = { exports: {} }
process.dlopen(addon, addonPath)

const origRequire = Module.prototype.require
Module.prototype.require = function patchedRequire (id) {
  if (id === moduleName) return addon.exports
  return origRequire.call(this, id)
}
