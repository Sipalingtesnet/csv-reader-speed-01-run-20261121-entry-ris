# csv-reader-speed-01-run-20261121-entry-ris

[![make.fun bounty](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Sipalingtesnet/csv-reader-speed-01-run-20261121-entry-ris/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Sipalingtesnet/csv-reader-speed-01-run-20261121-entry-ris/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's csv-reader 1.0.0 for the [make.fun bounty](https://make.fun/bounty/csv-reader-speed-01-run-20261121): `solve.js` answers exactly as csv-reader does on every case, and `main.ts` is the program the harness runs.

## How it works

`solve.js` reads the text once, left to right, with no dependencies:

- Fast path: per record, find the next LF with `indexOf`, slice the line, and if it holds no quote and no stray CR, split it on commas. Most records in a generated set take this path.
- Slow path: a `charCodeAt` scanner for lines with quotes or stray CRs. Quoted fields run to the next undoubled quote (`""` becomes one quote), CRLF and lone CR inside quotes become LF, junk after a closing quote is appended as it stands (`quote_junk`), and a quote that never closes is treated as a literal character with the text re-read as unquoted (`unterminated_quote`). A stray CR outside quotes is dropped (`stray_cr`). A U+FEFF at the very start is dropped, and empty lines are no record.
- Every row is padded with empty strings (`short_row`) or cut (`long_row`) to the first record's width, and every error is `{code, line, row}` in the order met.
- Field values are built from slices, never trimmed or converted; all values stay strings.

`main.ts` turns V8's incremental marking off (`--no-incremental-marking`) before importing `solve.js`, reads the cases from `MAKEFUN_INPUT_DIR` (else `/input`), answers each case alone with `run(input)`, and writes the answers to `MAKEFUN_OUTPUT_DIR` (else `/output`), file `answers.json`.

## Verification

- Practice set: **6/6 exact** against the kit's expected answers.
- Three freshly drawn sets with the kit generator (18 cases): **18/18 exact**.
- Speed on the practice set (rise-01, average of 3 runs of all 6 cases): **58.66 ms** per set vs **282.58 ms** for the house baseline — **4.82x faster**.

## Determinism

`solve.js` is pure: no clock, no network, no randomness, no state carried between cases. Two runs on the same input write byte-identical answers.
