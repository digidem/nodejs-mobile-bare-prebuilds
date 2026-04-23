# nodejs-mobile-bare-prebuilds

This repository contains shared workflows for building native modules maintained
by the Holepunch team. These modules are built using
[`bare-make`](https://github.com/holepunchto/bare-make).

## Table of Contents

- [Introduction](#introduction)
- [Usage](#usage)
  - [Inputs](#inputs)
  - [Outputs](#outputs)
  - [Manual dispatch](#manual-dispatch)
- [Testing prebuilds on an emulator / simulator](#testing-prebuilds-on-an-emulator--simulator)
  - [Running the module's own test suite](#running-the-modules-own-test-suite)
- [Patching the module before build](#patching-the-module-before-build)
- [Contributing](#contributing)
- [License](#license)

## Introduction

The `nodejs-mobile-bare-prebuilds` repository provides a set of workflows and
tools to streamline the process of building native modules for Node.js mobile
applications. These workflows are designed to be used with the `bare-make` build
system.

The build input is always the **npm tarball** (`npm pack <module>@<version>`),
so the published prebuild corresponds exactly to what users get from
`npm install`. The test input is the **upstream git repo** at the commit the
tarball was published from — needed because the `test/` folder is almost always
excluded from npm tarballs.

## Usage

The most common entry point is `prebuild-all.yml`, which builds the standard
target set (three Android ABIs + iOS device + two iOS simulator slices),
optionally runs the module's own test suite on an emulator/simulator, and
publishes a GitHub Release with the artifacts.

```yaml
name: Build, test, and release prebuilds

on:
  workflow_dispatch:
    inputs:
      module_version:
        description: "Exact version or dist-tag"
        required: false
        default: "latest"
        type: string

jobs:
  build:
    uses: digidem/nodejs-mobile-bare-prebuilds/.github/workflows/prebuild-all.yml@v2
    with:
      module_name: sodium-native
      module_version: ${{ inputs.module_version }}

  test-android:
    needs: build
    uses: digidem/nodejs-mobile-bare-prebuilds/.github/workflows/test-android.yml@v2
    with:
      module_spec: ${{ needs.build.outputs.module_spec }}
      test_runner: module
      git_repo_slug: ${{ needs.build.outputs.git_repo_slug }}
      git_ref: ${{ needs.build.outputs.git_ref }}

  test-ios:
    needs: build
    uses: digidem/nodejs-mobile-bare-prebuilds/.github/workflows/test-ios.yml@v2
    with:
      module_spec: ${{ needs.build.outputs.module_spec }}
      test_runner: module
      git_repo_slug: ${{ needs.build.outputs.git_repo_slug }}
      git_ref: ${{ needs.build.outputs.git_ref }}

  release:
    needs: [ build, test-android, test-ios ]
    permissions:
      contents: write
    uses: digidem/nodejs-mobile-bare-prebuilds/.github/workflows/release.yml@v2
    with:
      module_spec: ${{ needs.build.outputs.module_spec }}
```

### Inputs

**`prebuild-all.yml` / `prebuild.yml`**

| Input            | Required | Default    | Description                                                                       |
| ---------------- | -------- | ---------- | --------------------------------------------------------------------------------- |
| `module_name`    | yes      | —          | npm module to build                                                               |
| `module_version` | no       | `latest`   | Exact version or dist-tag. Resolved against npm before the matrix runs.           |
| `patches_dir`    | no       | `patches`  | Directory in the caller repo holding `<module>+<version>.patch` files (see below) |

### Outputs

**`prebuild-all.yml`**

| Output           | Description                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `module_version` | The exact version resolved and used for all builds                                            |
| `module_spec`    | `<module>@<version>` — pass to `test-*.yml` / `release.yml`                                   |
| `git_repo_slug`  | `owner/repo` of the upstream GitHub repo, or empty if not on GitHub / no `repository.url`    |
| `git_ref`        | Commit SHA (from `gitHead`) or `v<version>` tag, or empty if neither resolves                |

### Manual dispatch

`prebuild.yml` is a thin wrapper around the composite action for single-target
builds, triggerable from the Actions tab for debugging. `test.yml` chains
`prebuild → test-*` for end-to-end debugging on a branch.

## Testing prebuilds on an emulator / simulator

Two reusable workflows run the built `.node` file inside nodejs-mobile on a
real emulator / simulator to catch runtime issues the prebuild step cannot
(wrong page size, missing symbols, `require-addon` not finding the binary,
etc.). The workflow bundles a `test.js` and the installed module into a
minimal native app, installs it on an emulator / simulator, streams the app's
stdout into the workflow log, and passes/fails on the Node exit code.

Three `test_runner` modes, selected per test workflow:

- **`smoke`** (default): generated test that just `require()`s the module.
  Enough to catch linker / load-time breakage without caller JS.
- **`module`**: runs the module's own `test/*.js` via `brittle`. See below.
- **`custom`**: uses the file at `test_script` (caller-repo path).

### Running the module's own test suite

The `test/` folder is usually excluded from npm tarballs (via `.npmignore` or
the package's `files` field), so the test workflows check out the upstream
GitHub repo separately and overlay its `test/` into
`node_modules/<module>/test/` before running.

The git ref is resolved in `prebuild-all.yml`'s `resolve` job:

1. **`gitHead` from npm metadata** — recorded by `npm publish` and usually
   reliable for modern publishes. This is a commit SHA; `actions/checkout`
   accepts bare SHAs even when the commit isn't reachable from a branch
   (e.g. after a force-push).
2. **`v<version>` tag** — checked via the GitHub API (authenticated with
   `GITHUB_TOKEN`). Fallback for older tarballs with missing `gitHead`.
3. **Empty** — no git source available. `test_runner: module` will fail
   loudly at test time; use `smoke` instead.

Pass both `git_repo_slug` and `git_ref` from `prebuild-all.yml`'s outputs into
the test workflows when using `test_runner: module`. Non-GitHub upstreams are
not supported in v2.

**Note:** the build always uses the npm tarball as its source. The git
checkout is only used to populate the `test/` folder for the `module` test
runner.

## Patching the module before build

Some modules need small patches to build for nodejs-mobile — e.g. fixing an
include path in `CMakeLists.txt`. Patches use the
[patch-package](https://github.com/ds300/patch-package) filename convention:

```
<caller-repo>/
└── patches/
    ├── quickbit-native+2.4.1.patch
    └── quickbit-native+2.4.2.patch
```

The prebuild step picks `patches/<module_name>+<resolved_version>.patch` and
applies it with `patch -p1 --forward --no-backup-if-mismatch` after `npm pack`
unpack and before `npm install`.

**Failure modes:**
- Patch applies cleanly → build proceeds.
- No `<module>+*.patch` files exist → no-op, build proceeds.
- A matching file is missing but siblings for other versions exist → **fail
  loudly**. This catches the usual error of forgetting to rename the patch
  after bumping `module_version`.
- Patch applies but with fuzz/rejects → **fail loudly** (`--forward`
  suppresses the interactive prompt and surfaces rejects as a non-zero exit).

To use a different directory name, pass `patches_dir:` to
`prebuild-all.yml` / `prebuild.yml`.

## Contributing

We welcome contributions to this repository. If you have an idea for a new
feature or have found a bug, please open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file
for more details.
