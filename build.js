import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import isNativeModule from 'is-native-module'

const MODULES_TO_EXCLUDE = [
  'napi-build-utils',
  // TODO: Currently not working (and we also have two versions listed, which we want to dedupe)
  'sodium-native',
]

try {
  await main()
} catch (err) {
  console.error(err)
  process.exit(1)
}

/// ------------------------------------------------------------------------------------------

async function main() {
  const nativeModulesToPrebuild = (
    await listNativeModules('node_modules')
  ).filter(({ name }) => !MODULES_TO_EXCLUDE.includes(name))

  // Start creating prebuilds for all relevant modules concurrently
  // The actual prebuilds are built sequentially by target
  await Promise.all(
    nativeModulesToPrebuild.map(({ name, path }) =>
      createPrebuilds(name, path, [
        'android-arm',
        'android-arm64',
        'android-x64',
        // TODO: Add iOS targets
      ]),
    ),
  )

  // Copy the prebuild assets to the top-level directory (mostly out of convenience)
  await Promise.all(
    nativeModulesToPrebuild.map(async ({ name, path }) =>
      copyPrebuilds(name, path),
    ),
  )

  console.log('\nBuilt the following modules:')
  console.log(
    nativeModulesToPrebuild.map(({ name, version }) => `${name}@${version}`),
  )
}

/**
 * @param {string} module
 * @param {string} dir
 * @param {Array<'ios-arm64' | 'ios-x64' | 'android-arm' | 'android-arm64' | 'android-x64'>} targets
 * @returns {Promise<void>}
 */
async function createPrebuilds(module, dir, targets) {
  // Unfortunately has to be run sequentially because of race conditions in the way prebuild-for-nodejs-mobile works (e.g. accessing shared built files)
  for (const target of targets) {
    console.log(`[${module}] Building for ${target} in ${dir}...`)
    await runPrebuildCommand(module, dir, target)
  }
}

/**
 * @param {string} module
 * @param {Target} target
 */
async function runPrebuildCommand(module, dir, target) {
  return new Promise((res, rej) => {
    const prebuildProcess = spawn(
      'npx',
      // TODO: Which Android SDK should we specify here? (defaults to 21)
      ['prebuild-for-nodejs-mobile', target],
      {
        stdio: 'inherit',
        env: process.env,
        cwd: dir,
      },
    )

    prebuildProcess.on('error', (error) => {
      rej(error)
    })

    prebuildProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`[${module}] Finished building for ${target}`)
        res()
      } else {
        rej(
          new Error(
            `[${module}] Prebuild for ${target} failed. Process exited with code ${code}`,
          ),
        )
      }
    })
  })
}

/**
 * @param {string} module
 * @param {string} dir
 * @param {string} [to]
 *
 */
async function copyPrebuilds(module, dir, to = path.resolve('assets', module)) {
  const nodejsMobilePrebuildsPath = path.resolve(dir, 'prebuilds')
  await fs.cp(nodejsMobilePrebuildsPath, to, { recursive: true })
  console.log(`[${module}] Prebuild assets for copied to ${to}`)
}

/**
 * @param {string} initialDir
 * @returns {Promise<Array<{path: string, name: string, version: string}>>}
 */
async function listNativeModules(initialDir) {
  const nativeModules = []
  await findNativeModules(initialDir)
  return nativeModules

  // Adapted version of https://github.com/juliangruber/native-modules
  async function findNativeModules(dir) {
    async function scanFiles() {
      let files
      try {
        files = await fs.readdir(dir)
      } catch (_) {
        return
      }
      await Promise.all(
        files
          .filter((f) => !/^\./.test(f))
          .map((f) => findNativeModules(`${dir}/${f}`)),
      )
    }

    async function getNativeModuleInfo() {
      let pkg
      try {
        const json = await fs.readFile(`${dir}/package.json`)
        pkg = JSON.parse(json.toString('utf8'))
      } catch (_) {
        return
      }

      if (isNativeModule(pkg)) {
        nativeModules.push({
          path: path.resolve(dir),
          name: pkg.name,
          version: pkg.version,
        })
      }
    }

    return Promise.all([scanFiles(), getNativeModuleInfo()])
  }
}
