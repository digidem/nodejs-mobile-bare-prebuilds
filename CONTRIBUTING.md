# Contributing

## Proposing changes

- Branch off `main` and open a pull request.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit
  messages (`feat:`, `fix:`, `feat!:` for breaking, etc.). This makes the
  release changelog cheap to generate and keeps the version bump unambiguous.
- Smoke-test your change end-to-end using the manual dispatch wrapper in
  this repo: Actions → **End-to-end test (manual dispatch)** → Run workflow,
  pick your branch. It builds a real module (defaults to `quickbit-native`),
  runs the Android + iOS test harnesses, and fails fast if anything
  regressed. The reusable workflows auto-pin internal checkouts to
  `github.workflow_sha`, so the dispatch always tests your branch as-is.

## Cutting a release

Releases are tagged and published **manually**. Three things have to happen:

1. A full semver tag (`vX.Y.Z`) is created at the release commit.
2. The floating major tag (`vX`) is force-moved to the same commit.
3. A GitHub Release is created against the semver tag, with auto-generated
   notes.

### Picking the version bump

Follow [SemVer](https://semver.org/). Since reusable workflows are consumed
by `uses:` in caller repos, the "public API" is the set of inputs, outputs,
and observable behaviour of the four reusable workflows — `prebuild.yml`,
`prebuild-all.yml`, `test-android.yml`, `test-ios.yml`, and `release.yml` —
plus the `prebuild` and `assemble-test-project` composite actions.

| Change                                                            | Bump      |
| ----------------------------------------------------------------- | --------- |
| Bug fix; no input/output/behavior change                          | **patch** |
| New optional input; new output; new default behavior              | **minor** |
| Renamed / removed / semantics-changed input/output; runner change | **major** |

For majors, also plan: update the example in the README, cut a migration
note in the release body, and keep the previous major floating tag alive
for a grace period (don't delete `v2` the day you ship `v3`).

### Release commands

From a clean `main` that already includes the release commit:

```sh
# 1. Pick the new version
NEW_VERSION=v2.1.0    # change this
MAJOR=${NEW_VERSION%%.*}   # -> v2

# 2. Make sure local is up to date
git fetch origin
git switch main
git pull --ff-only origin main

# 3. Create the immutable semver tag at the current HEAD
git tag -a "$NEW_VERSION" -m "$NEW_VERSION"
git push origin "$NEW_VERSION"

# 4. Force-move the floating major tag to the same commit
git tag -fa "$MAJOR" -m "$MAJOR" "$NEW_VERSION"
git push --force origin "$MAJOR"

# 5. Publish a GitHub Release with auto-generated notes
gh release create "$NEW_VERSION" --verify-tag --generate-notes
```

The GitHub Release is keyed on the tag name, so the existing release for
the floating major tag (e.g. the one at `releases/tag/v2`) automatically
follows the tag to the new commit — no extra step needed.

### Breaking changes (new major)

When the next release is breaking (e.g. renaming an input), the shape is:

```sh
NEW_VERSION=v3.0.0
MAJOR=v3

git tag -a "$NEW_VERSION" -m "$NEW_VERSION"
git push origin "$NEW_VERSION"

# New floating tag — create, don't move
git tag -a "$MAJOR" -m "$MAJOR" "$NEW_VERSION"
git push origin "$MAJOR"

gh release create "$NEW_VERSION" --verify-tag \
  --title "v3.0.0 — breaking: <summary>" \
  --notes-file RELEASE_NOTES.md
```

Leave the old `v2` tag pointing where it was. If a critical fix needs to
land on v2 after v3 is out, branch from the `v2` tag, cherry-pick the fix,
tag `v2.x.(y+1)`, and move `v2` to that commit.

## Self-pinning guarantee

Every reusable workflow checks out this repo at `${{ github.workflow_sha }}`
before invoking its internal composite action or the harness. That means a
caller pinning to `@v2.1.0` gets the workflow YAML, the composite action,
and the test harness all at the v2.1.0 commit — no internal `@main` drift.
Keep this property intact when editing the workflows: never hardcode
`@main` (or any other explicit ref) on a step-level `uses:` that references
this repo's own actions.
