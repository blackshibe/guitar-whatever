# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server (typically port 5173)
- `npm run build` — `tsc -b` type-check then Vite build; run this to verify changes
- `npm run lint` — oxlint

No test suite exists.

## Architecture

Single-page guitar tab editor: React 19 + TypeScript, Vite, Tailwind CSS v4 (via `@tailwindcss/vite` plugin — no tailwind.config; global styles in `src/index.css`, which force-disables `border-radius` everywhere by design).

All state lives in `src/App.tsx` (no state library). Child components in `src/components/` are purely presentational and receive state + callbacks as props. Pure logic lives in `src/lib/`:

- `types.ts` — core model: a `Song` has `tracks` (instruments) and `sections`; a `Track` has a `tuning` (array of `{noteIndex, octave}`, row 0 = top string as drawn) and `measures`; a `Measure` is 8 columns (`COLS_PER_MEASURE`) of per-string fret values (`string | null`).
- `lib/instruments.ts` — measure/track factories, `MEASURES_PER_LINE` (4) grid wrapping, id counter (call `advanceIdCounter` after loading persisted songs so new ids don't collide).
- `lib/tunings.ts` — MIDI/note-name conversion, preset tunings.
- `lib/audio.ts` — Web Audio playback (lazy singleton `AudioContext`).
- `lib/storage.ts` — localStorage song library plus last-opened song id.

Key invariants:

- Every track has exactly `measureCount` measures; every column has exactly `tuning.length` entries. Any operation that adds/removes measures or changes string count must update all tracks together (see `insertMeasureAfter`, `setTrackTuning`).
- Sections are markers (`startMeasure`) over the shared measure timeline; ranges are derived (`sectionRangesFor`). The first section (sorted) must start at measure 0, section starts must be unique and in range — measure deletion re-clamps/dedupes them.
- Playback runs the timeline start-to-end and mixes all tracks; the on-screen grid shows only the active track. Looping is per-track: `Track.loops` maps sectionId → loop-unit bars, and a looping track cycles that unit across the section while others play through (unit clamped to span at use sites via `loopLenFor`). The grid shows a looping track's unit only — hidden span bars are skipped by keyboard nav (`isGhostMeasure`). The section-header `×N` control is per-track and derived (`ceil(span/unit)`); changing it resizes the section timeline for all tracks (`setTrackRepeat`; shrink only when no track loses content). Inserting/deleting a bar inside a track's unit adjusts its stored loop length. The legacy global `Section.repeat` is migrated to written-out measures + per-track loops in `storage.migrateSong` on load.
- Linked sections (`Section.linkTo`, "+ link" in the section header) mirror a source section: they occupy real timeline bars but own no content — reads/writes resolve to the source (`resolveRange`, `srcMeasureIndex`; the grid renders `viewTrack`). Linked spans must always equal the source span: structural edits apply at every copy (`linkedPositions` in insert/delete measure, multi-copy resize in `setTrackRepeat`), placing a marker inside a linked group is disallowed (`addSectionAt`), a copy's ×N/loops delegate to the source id. Deleting a copy's marker removes its bars; deleting a source marker materializes its copies first.
- The grid's keydown handler must ignore events originating from `INPUT`/`TEXTAREA` (section name/notes/loop fields live inside the grid). Cell buttons carry `data-cell`; a document-level mousedown listener deselects on clicks outside them.

UI copy style: keep labels terse — no explanatory placeholder text or hint paragraphs.
