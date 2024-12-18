# nodejs-mobile-bare-prebuilds

This repository contains shared workflows for building native modules maintained by the Holepunch team. These modules are built using [`bare-make`](https://github.com/holepunchto/bare-make).

## Table of Contents

- [Introduction](#introduction)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Introduction

The `nodejs-mobile-bare-prebuilds` repository provides a set of workflows and tools to streamline the process of building native modules for Node.js mobile applications. These workflows are designed to be used with the `bare-make` build system.

## Usage

To use the workflows in this repository, you need to reference them in your workflow job as follows:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: digidem/nodejs-mobile-bare-prebuilds/.github/workflows/prebuild.yml
        with:
          module_name: <module-name>
          module_version: <module-version>
          platform: android
          arch: arm64 | arm | x64
```

## Contributing

We welcome contributions to this repository. If you have an idea for a new feature or have found a bug, please open an issue or submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
