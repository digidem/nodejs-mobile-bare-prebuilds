# NodeJS Mobile Prebuilds

## Description

Repo for generating Node prebuilds for [NodeJS Mobile](https://github.com/nodejs-mobile/nodejs-mobile) intended for usage with Mapeo Mobile.

## Development

### Requirements

- **npm < 9 is strictly required**. As a result, we suggest using Node 16 (which comes with npm 8 by default), although you can install Node 18 and manually downgrade the global npm version as well.
- You most likely also need **Python 2** installed and available on your `PATH`

### Working locally

1. To get started, clone the repo and install the dependencies.

   ```sh
   git clone https://github.com/digidem/mapeo-nodejs-mobile-prebuilds.git
   npm install
   ```

2. Run the build script. Note that you will need to either export the `ANDROID_NDK_HOME` environment variable or set it when running, which is required by the [`prebuild-for-nodejs-mobile`](https://github.com/staltz/prebuild-for-nodejs-mobile/) tool that we use.

   ```sh
   ANDROID_NDK_HOME=$ANDROID_HOME/ndk/24.0.8215888/ npm run build
   ```

   The build script will find the native modules used by `@mapeo/core` and then run the build tool on each one. Note that while we build for all modules concurrently, each target within each module is built sequentially to avoid race conditions related to the filesystem (due to how the build tool works). As a result, it may be a little bit of time for the whole process to finish, depending on the nature of the module.

   Once the prebuilds are done, they are copied to the `assets/` directory. The end result for each module follows the same directory structure: `assets/{MODULE_NAME}/{TARGET}/...`

## LICENSE

[MIT](./LICENSE)
