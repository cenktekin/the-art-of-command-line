# Fork notes

This repository is a mirror fork of
[jlevy/the-art-of-command-line](https://github.com/jlevy/the-art-of-command-line)
("Master the command line, in one page").

## What this fork is

A pinned, read-only mirror of the upstream guide. The content is upstream's work;
this fork adds only infrastructure files that do not change the guide's text.

## Upstream status (verified 2026-10-25)

| Item | Value |
|------|-------|
| Upstream default branch | `master` |
| Upstream HEAD | `6b50745` — 2023-07-12 |
| Fork HEAD | `6b50745` (identical) |
| Divergence | `0` ahead / `0` behind |
| Upstream `LICENSE` file | none (license declared in `README.md` only) |

The upstream repository has not received a commit on `master` since 2023-07-12, so
this fork is **at parity, not behind**. Earlier audit notes described the fork as
"3+ years stale"; the accurate statement is that upstream itself is dormant.

## Local additions (all content-neutral)

| File | Why |
|------|-----|
| `LICENSE` | `README.md` declares CC BY-SA 4.0 but no license file existed. |
| `.gitattributes` | Pins `eol=lf` so line endings stay stable across platforms. |
| `.gitignore` | Keeps local notes and archives out of a public repository. |
| `tools/check.js` | Offline gate: relative links, code-fence balance, path/secret scan. |
| `.github/workflows/ci.yml` | Runs the gate above on every push. |
| `FORK-NOTES.md` | This file. |

## Attribution

The guide text is the work of Joshua Levy and
[the upstream contributors](https://github.com/jlevy/the-art-of-command-line/graphs/contributors),
licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
See `AUTHORS.md` for the upstream contributor list.

## What this fork deliberately does not do

- **No content edits.** Typo fixes, new sections and translations belong upstream as
  pull requests; local divergence here would turn every future sync into a conflict.
- **No Turkish translation in this fork.** `README-tr.md` does not exist upstream (19
  translations do). A translation is an L-sized effort and is only worth doing as an
  upstream contribution, so it stays deferred rather than carried here.
- **No project-management docs.** There is no build, no runtime and no dependency
  surface, so tracker/changelog/state files would be empty ceremony.

## Sync procedure

```sh
git fetch upstream
git log --oneline master..upstream/master        # expect: empty today
git merge --ff-only upstream/master
```

If the merge is **not** a fast-forward, stop: upstream history was rewritten or local
commits exist. Decide between `git rebase upstream/master` and dropping the local
commits; do not force-push over a public fork without inspecting what would be lost.

Local additions are content-neutral, so an upstream fast-forward should never conflict.
If one does, the conflict is a signal that upstream added a file this fork also owns
(`LICENSE`, `.gitignore`, `FORK-NOTES.md`) — resolve by keeping upstream's version and
re-documenting the local need in this file.

## Checks

```sh
node tools/check.js
```

Zero dependencies, zero network. It fails on: a relative link or image pointing at a
missing file, an unbalanced code fence, invalid UTF-8, and any committed absolute
developer path, credential or note identifier. External (http/https) links are not
fetched — remote rot cannot be judged deterministically from a CI run, and a flaky
network gate teaches people to ignore the gate.
