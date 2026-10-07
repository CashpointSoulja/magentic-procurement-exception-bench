# Test plan

| Layer | What | How |
|---|---|---|
| Money | integer minor units, rejects floats and bad codes, rate parsing, half-even rounding, pack ceiling | `tests/test_money.py`, `src/engine/engine.test.ts` |
| Engine | each exception fixture blocks with its own reason and never calls the ERP. Safe fixtures write exact amounts. Unguarded unit/currency failures are flagged unsafe. Gateway blocks the mis-scoped approval with all guards off. Missing evidence and expired approval block. Provenance on every executed step. Determinism and golden equality | `tests/test_engine.py` |
| Regression | v2.5-rc regresses F06 only | pytest + vitest |
| Parity | TS engine output equals Python golden JSON for all three presets, including run digest | `src/engine/engine.test.ts` |
| UI flow | run baseline (8/8, queue of 6, export enabled). RC regression row. Guard toggle switches to Custom and invalidates. Reset restores. Reviewer decision recorded without changing outcome | `src/App.test.tsx` (Testing Library, fake timers) |
| Static | TypeScript strict, ESLint | `npm run typecheck`, `npm run lint` |
| Build | Vite production build | `npm run build` |
| Visual | 1366, 820, 390 px screenshots: idle and post-run RC with F06 selected, no horizontal scroll | Playwright script, screenshots in `docs/evidence/` |
| Live | deployed URL loads signed out, run + export work | browser check after deploy |
