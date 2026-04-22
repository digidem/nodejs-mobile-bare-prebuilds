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

## Contributing

We welcome contributions to this repository. If you have an idea for a new
feature or have found a bug, please open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file
for more details.
