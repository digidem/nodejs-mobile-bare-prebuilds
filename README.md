# nodejs-mobile-bare-prebuilds

This repository contains shared workflows for building native modules maintained
by the Holepunch team. These modules are built using
[`bare-make`](https://github.com/holepunchto/bare-make).

## Table of Contents

- [Introduction](#introduction)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Introduction

The `nodejs-mobile-bare-prebuilds` repository provides a set of workflows and
tools to streamline the process of building native modules for Node.js mobile
applications. These workflows are designed to be used with the `bare-make` build
system.

## Usage

The prebuild step is published as a composite action. Call it from a job in your
own repository, typically inside a matrix so each architecture builds in
parallel. The `release.yml` reusable workflow collects the uploaded artifacts
and creates a GitHub Release.

```yaml
name: Generate prebuilds

on:
  workflow_dispatch:
    inputs:
      module_version:
        description: "Module version"
        required: true
        default: "latest"
        type: string
      publish_release:
        description: "Publish release"
        required: false
        default: true
        type: boolean

jobs:
  build:
    strategy:
      matrix:
        platform: [android]
        arch: [arm64, x64, arm]
    runs-on: ubuntu-22.04
    outputs:
      module_version: ${{ steps.prebuild.outputs.module_version }}
    steps:
      - uses: actions/checkout@v6
      - id: prebuild
        uses: digidem/nodejs-mobile-bare-prebuilds/.github/actions/prebuild@main
        with:
          module_name: quickbit-native
          module_version: ${{ inputs.module_version }}
          platform: ${{ matrix.platform }}
          arch: ${{ matrix.arch }}
          patch_file: CMakeLists.txt.patch

  release:
    if: ${{ inputs.publish_release }}
    needs: build
    uses: digidem/nodejs-mobile-bare-prebuilds/.github/workflows/release.yml@main
    with:
      module_version: ${{ needs.build.outputs.module_version }}
```

### Inputs

| Input            | Required | Default   | Description                                                          |
| ---------------- | -------- | --------- | -------------------------------------------------------------------- |
| `module_name`    | yes      | —         | Name of the npm module to prebuild                                   |
| `platform`       | yes      | `android` | Target platform                                                      |
| `arch`           | yes      | `arm64`   | Target architecture (`arm64`, `x64`, `arm`)                          |
| `module_version` | no       | `latest`  | Version of the module to pull from npm                               |
| `patch_file`     | no       | —         | Path to a patch file in the caller's workspace to apply to `package` |
| `node_version`   | no       | `18`      | Node.js version used to run `bare-make`                              |

### Outputs

| Output           | Description                                   |
| ---------------- | --------------------------------------------- |
| `module_version` | The resolved version read from `package.json` |

### Manual dispatch

The `.github/workflows/prebuild.yml` workflow in this repository is kept as a
thin wrapper around the composite action so the build can be triggered manually
from the Actions tab for debugging.

## Testing prebuilds on an emulator / simulator

Two reusable workflows run the built `.node` file inside nodejs-mobile on a
real emulator / simulator to catch runtime issues the prebuild step cannot
(wrong page size, missing symbols, `require-addon` not finding the binary,
etc.).

The caller's repo provides a `test.js` that outputs TAP; the workflow bundles
it with the artifact and the module-under-test into a minimal native app,
installs it on an emulator / simulator, streams the app's stdout into the
workflow log, and passes/fails on the Node exit code.

If `test_script` is omitted, a minimal smoke test is generated that just does
`require('<module_name>')` and exits non-zero if it throws — enough to catch
linker / load-time breakage without the caller needing to write any JS.

```yaml
jobs:
  build-android-x64:
    uses: digidem/nodejs-mobile-bare-prebuilds/.github/workflows/prebuild.yml@main
    with:
      module_name: sodium-native
      platform: android
      arch: x64

  test-android:
    needs: build-android-x64
    uses: digidem/nodejs-mobile-bare-prebuilds/.github/workflows/test-android.yml@main
    with:
      module_name: sodium-native
      module_version: ${{ needs.build-android-x64.outputs.module_version }}
      artifact_name: sodium-native-${{ needs.build-android-x64.outputs.module_version }}-android-x64
      target: android-x64    # the prebuilds/<dir>/ to install into
      # test_script: test.js   # omit to get a default require() smoke test   # caller-repo path; outputs TAP on stdout

  build-ios-sim-arm64:
    uses: digidem/nodejs-mobile-bare-prebuilds/.github/workflows/prebuild.yml@main
    with:
      module_name: sodium-native
      platform: ios
      arch: arm64
      simulator: true

  test-ios:
    needs: build-ios-sim-arm64
    uses: digidem/nodejs-mobile-bare-prebuilds/.github/workflows/test-ios.yml@main
    with:
      module_name: sodium-native
      module_version: ${{ needs.build-ios-sim-arm64.outputs.module_version }}
      artifact_name: sodium-native-${{ needs.build-ios-sim-arm64.outputs.module_version }}-ios-arm64-simulator
      # At runtime on the simulator nodejs-mobile reports platform+arch as
      # 'ios-arm64' (no -simulator suffix), so the .node file is installed
      # under prebuilds/ios-arm64/. Leave `target` at its default.
      # test_script: test.js   # omit to get a default require() smoke test
```

The native shells used by the test workflows live under
[test-harness/android/](test-harness/android/) and
[test-harness/ios/](test-harness/ios/). They each load the module-under-test,
run `test.js` as the main script, pipe stdout/stderr back to the workflow log
(logcat on Android, `simctl launch --console-pty` on iOS), and emit a
`__NODE_EXIT__:<code>` sentinel the workflow parses to set pass/fail.

### Manual dispatch

The [.github/workflows/test.yml](.github/workflows/test.yml) workflow chains
`prebuild.yml` → `test-*.yml` behind a `workflow_dispatch` trigger so the whole
pipeline can be exercised from the Actions tab without a caller repo. The
harness is checked out at the same commit as the dispatch run, so in-flight
changes on a branch are tested as-is. Platforms can be selected individually
or together.

## Contributing

We welcome contributions to this repository. If you have an idea for a new
feature or have found a bug, please open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file
for more details.
