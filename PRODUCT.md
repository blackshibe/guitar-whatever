# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solo guitarists writing or transcribing their own tabs for personal practice and reference. Single-user; no sharing, collaboration, or multi-account use is implied.

## Product Purpose

A guitar tab editor that lets a player get a song's structure down fast: multiple instrument tracks (strings + vocal) over a shared measure timeline, organized into sections, with playback and ASCII export.

## Positioning

Fast, minimal, and browser-native — no install, no account, opens instantly. Keyboard-driven grid editing (not mouse-driven note placement) is the core mechanism that differentiates it from heavier tools like Guitar Pro or from writing tabs as plain text.

## Operating Context

Runs entirely in the browser as a single-page app. A song is edited as a grid of measures/columns per track, with sections marking structure over the shared timeline. Playback uses Web Audio. Songs are saved to and loaded from a local song library (browser storage) — there is no server round-trip in the editing loop.

## Capabilities and Constraints

- No accounts or backend, by design — the app stays local-only (browser storage), not a future gap to fill.
- Loaded/exported song data must stay backwards compatible: old saved/exported songs must keep loading correctly (see `migrateSong` in `lib/storage.ts`).
- The internal song format itself is free to change over time — compatibility is about reading old data, not freezing the schema.
- Keyboard-first editing (grid navigation, shortcuts, undo/redo) is a load-bearing part of the workflow, not incidental.

## Product Principles

- Speed and low friction beat feature completeness — every addition should keep "open and start tabbing immediately" true.
- Keyboard-driven interaction is the primary interface, not an accessibility add-on; mouse interaction supports it but shouldn't be required for core editing.
- Local-only and durable: nothing here depends on a network or account, and old work must never break on load even as the format evolves.
- Structure (tracks, sections, shared timeline) is a first-class editing concept, not just an export-time concern.
