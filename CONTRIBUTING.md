# Contributing to ScholarTap

Thanks for helping. Templates, fixes, translations and docs are all welcome.

1. Fork, branch from `main`, and keep each pull request to one change.
2. Run `npm test` (relay) and `npm run catalog` (after editing templates in `kit/themes.mjs`).
3. New template: copy an entry in `kit/themes.mjs`, run `npm run catalog`, then `node kit/screenshots.mjs <id>`.

## Contributor terms

By opening a pull request you confirm that:

- the contribution is your own work, or you have the right to submit it (the
  [Developer Certificate of Origin](https://developercertificate.org/));
- it is licensed under the project's MIT license; and
- you also grant Ankush Sharma, as project owner, and any successor organization a perpetual, worldwide,
  royalty-free, irrevocable license to use, modify, sublicense and relicense the contribution, including in a
  commercial or differently-licensed version of ScholarTap.

You keep the copyright in your contribution. The last point lets the project change license or become a company
later without tracking down every contributor. See `docs/GOVERNANCE.md`.
