# Film 1 baseline (text copy)

These are the small text files of the film 1 reference that `scripts/kb/verify-film1.mjs --capture` wrote to
`out/kb-plan/baseline/` at HEAD `8b9cd21` (see `HEAD` and `meta.json`). `out/` is gitignored, so this
folder is the committed copy. `--capture` of the default baseline refreshes it.

Not copied: `bundle-a/` (the reference bundle) and `stills/` (the 35 reference PNGs, about 198 MB).
Both can be rebuilt from a checkout of `8b9cd21`, because the capture proved the bundle and the stills
byte-deterministic.

`node scripts/kb/verify-film1.mjs --baseline=docs/kb/baseline` runs every gate except 9 (the stills).
Gate 3 (`voice.stat`) and gate 4 (`mix.stat`) compare mtimes, which hold only on the machine that made
the capture.
