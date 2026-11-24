// Rewrites an unpacked module's package.json so its build-time packages
// resolve to the versions in this directory's lockfile, directly and
// transitively. Fails if the module's declared range rejects a pinned version,
// so a too-old pin surfaces as a toolchain bump instead of a quiet downgrade.
//
//   node pin-module-deps.mjs <path/to/package.json>

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";

const PINNED = [
  "bare-compat-napi",
  "cmake-bare",
  "cmake-fetch",
  "cmake-napi",
  "cmake-npm",
];
// Our fork stands in for npm's cmake-napi, so the module's range doesn't apply.
const FORK = "cmake-napi";

const here = dirname(fileURLToPath(import.meta.url));
const lock = JSON.parse(readFileSync(join(here, "package-lock.json"), "utf8"));
const toolchain = JSON.parse(readFileSync(join(here, "package.json"), "utf8"));

const pkgPath = process.argv[2];
if (!pkgPath) {
  console.error("usage: pin-module-deps.mjs <package.json>");
  process.exit(2);
}
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const specs = Object.fromEntries(
  PINNED.map((name) => {
    const spec = toolchain.dependencies[name];
    if (spec.startsWith("https:")) return [name, spec];
    return [name, lock.packages[`node_modules/${name}`].version];
  }),
);

const errors = [];
pkg.devDependencies ??= {};
for (const name of PINNED) {
  let declared = false;
  for (const field of ["dependencies", "devDependencies"]) {
    const range = pkg[field]?.[name];
    if (range === undefined) continue;
    declared = true;
    if (
      name !== FORK &&
      !semver.satisfies(specs[name], range, { includePrerelease: true })
    ) {
      errors.push(
        `${pkg.name} wants ${name}@${range}, toolchain pins ${specs[name]}`,
      );
    }
    pkg[field][name] = specs[name];
  }
  if (name === FORK && !declared) pkg.devDependencies[name] = specs[name];
}

if (errors.length) {
  for (const e of errors) console.error(`::error::${e}`);
  console.error(
    "Bump the pin in .github/actions/prebuild/toolchain/package.json.",
  );
  process.exit(1);
}

pkg.overrides = { ...pkg.overrides, ...specs };
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

for (const name of PINNED) console.log(`pinned ${name} -> ${specs[name]}`);
