#!/usr/bin/env bash
set -euo pipefail

# Prints the release-zip URL for a digidem/nodejs-mobile tag and platform,
# e.g. v24.19.0-0 -> nodejs-mobile-android-24.19.0-0.zip
#
# Usage: nodejs-mobile-url.sh <tag> <android|ios>

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

# The `-<rev>` mobile-revision suffix is what marks a digidem release.
if [[ ! "$version" =~ -[0-9]+$ ]]; then
  echo "nodejs-mobile-url.sh: '$tag' is not a digidem/nodejs-mobile tag (expected vX.Y.Z-R)." >&2
  echo "nodejs-mobile v18-line releases are not supported by v3; pin these workflows @v2." >&2
  exit 1
fi

echo "https://github.com/digidem/nodejs-mobile/releases/download/${tag}/nodejs-mobile-${platform}-${version}.zip"
