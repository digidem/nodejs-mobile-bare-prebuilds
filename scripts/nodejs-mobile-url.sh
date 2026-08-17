#!/usr/bin/env bash
set -euo pipefail

# Prints the release-zip URL for a nodejs-mobile tag and platform.
#
# Usage: nodejs-mobile-url.sh <tag> <android|ios>
#
# Two release lines with different conventions:
#   digidem/nodejs-mobile         v24.19.0-0  nodejs-mobile-android-24.19.0-0.zip
#   nodejs-mobile/nodejs-mobile   v18.20.4    nodejs-mobile-v18.20.4-android.zip
# The `-<rev>` mobile-revision suffix is what distinguishes them.

tag="${1:?usage: nodejs-mobile-url.sh <tag> <android|ios>}"
platform="${2:?usage: nodejs-mobile-url.sh <tag> <android|ios>}"

case "$platform" in
  android | ios) ;;
  *)
    echo "nodejs-mobile-url.sh: unknown platform '$platform'" >&2
    exit 1
    ;;
esac

[[ "$tag" == v* ]] || tag="v$tag"
version="${tag#v}"

if [[ "$version" =~ -[0-9]+$ ]]; then
  repo="digidem/nodejs-mobile"
  asset="nodejs-mobile-${platform}-${version}.zip"
else
  repo="nodejs-mobile/nodejs-mobile"
  asset="nodejs-mobile-${tag}-${platform}.zip"
fi

echo "https://github.com/${repo}/releases/download/${tag}/${asset}"
