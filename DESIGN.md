---
name: Guitar Tab Editor
description: An engraved score you edit live — a dark metal plate, hairline staves, one crimson transport accent.
colors:
  plate: "#171511"
  plate-raised: "#201d18"
  plate-sunken: "#2a2620"
  ink: "#ece6d8"
  ink-soft: "#9aa7b0"
  ink-faint: "#9c9382"
  accent: "#d65a48"
  accent-ink: "#171511"
  hairline: "#3a352c"
  hairline-strong: "#4c4638"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: "1.2"
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "1.4"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.04em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "13px"
    fontWeight: 400
rounded:
  none: "0px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "8px 24px"
  button-primary-hover:
    backgroundColor: "{colors.accent}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "6px 12px"
  button-ghost-hover:
    textColor: "{colors.ink}"
  input-field:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.mono}"
    rounded: "{rounded.none}"
    padding: "4px 6px"
---

# Design System: Guitar Tab Editor

## Overview

**Creative North Star: "The Engraver's Plate"**

The song is not a spreadsheet of cells with a toolbar floating above it; it is a blackened engraving plate under a raking work light, and the tab is the score etched into it. The metal ground is near-black and warm, the staff lines are hairline scores in the plate, and note values sit in the grid like struck type. One color is allowed to move under it — crimson — reserved for the transport and for the state that is actively happening: the focused cell, the playhead, the primary action. Everything else on the plate is ink, in three weights of legibility (full, soft/slate for secondary state, faint for tertiary), never a second hue competing for attention.

This world shipped dark-only by explicit direction mid-build — it began as a light ivory-paper rendition and was deliberately flipped and committed as the sole mode, not a theme variant sitting alongside a light default. There is no light-mode fallback to design around; `color-scheme: dark` is asserted at the HTML root. Corners are square everywhere (`border-radius: 0 !important` is a project-wide reset), consistent with engraving in metal: nothing here is molded or soft-edged.

**Key Characteristics:**
- Near-black warm metal ground, light-etched ink text, one crimson accent used sparingly for transport and active-state
- One family, Inter, doing every job (display, UI, labels) through weight and size steps, plus JetBrains Mono for the grid itself and all numeric/note data — a distinct display serif was tried mid-build and rejected twice by direct feedback ("ugly", "handwriting serif"); the system is deliberately single-family now, and that decision should not be revisited without a new, equally direct request
- Square corners everywhere, hairline dividers instead of cards or shadows for structure
- A single floating corner widget (reference video) and a single fixed bottom transport bar — carrying both playback AND the add-measure/add-section actions — are the only two elements that leave the document flow
- Authored stroke-SVG icons for UI chrome; genuine music notation (repeat marks, tie mark) is drawn in literal Unicode glyphs as earned notation, not decoration
- The focused cell and the playhead share one visual language — a vertical caret line — rather than a boxed highlight; "current position" always reads as a line, never a filled rectangle

## Colors

A near-monochrome warm-dark palette carries the whole system; crimson is the only saturated color and it is reserved for meaning (transport, active/focus state), never decoration.

### Primary
- **Crimson Transport** (`#d65a48`): the one accent. Used for the play button, the focused-cell caret line and its 10%-tint fill, the playhead rule and its trailing tint, active tab underlines, focus rings, text-selection background, and destructive/danger hover states (delete, remove). Contrast-tuned to ≥4.5:1 against the plate ground. Never used for ordinary UI chrome, only for the thing currently active or the thing about to be destroyed.

### Neutral
- **Plate** (`#171511`): the base ground — body background, grid background, transport track background.
- **Plate Raised** (`#201d18`): one step up — sidebar background, active track-tab background, transport bar surface, popover/dropdown surfaces.
- **Plate Sunken** (`#2a2620`): one step down — hover fill for grid cells, a recessed feel for hover-only surfaces.
- **Ink** (`#ece6d8`): primary text, filled tab-grid values, section-bracket rule color, "Stop" button surface (inverted: ink background, plate text).
- **Ink Soft** (`#9aa7b0`, slate): secondary text — track names, body copy, textarea/comment text, hover-state UI labels.
- **Ink Faint** (`#9c9382`): tertiary text — placeholders, measure numbers, unset cell dashes, disabled/quiet labels.
- **Hairline** (`#3a352c`) / **Hairline Strong** (`#4c4638`): the only border vocabulary — dividers between toolbar rules, input underlines, panel borders, scrollbar thumb. No color other than these two ever draws a border.

### Named Rules
**The One Accent Rule.** Crimson appears only on the actively playing/selected/focused element or a destructive action's hover state — never as a static brand color splashed on chrome. If nothing is active, nothing on screen is crimson except the transport play button.

**The Three-Ink Rule.** Text uses exactly three weights of the same ink hue family (full ink, soft slate, faint) to express hierarchy — never a fourth neutral, never a tint of the accent for text color.

## Typography

**Display/UI Font:** Inter (Google Fonts CDN) — one family for everything that isn't the grid itself. Hierarchy comes from weight and size steps (semibold display, medium emphasis, regular body), not from switching typefaces. A distinct serif display face (first Bodoni Moda, then Source Serif 4) was tried and explicitly rejected twice ("ugly", "ugly handwriting serif font") — do not reintroduce a second family for identity/display without a fresh, explicit request; single-family is the committed system now.
**Label/Mono Font:** JetBrains Mono (Google Fonts CDN) — the grid's own type, since every fret number, note name, and BPM value is data, not prose.

**Character:** One workhorse grotesque carrying both identity and interface, set apart from body text purely by weight and scale, against a monospace for anything numeric or gridded — legible and calm rather than decorative; the engraved-plate identity now lives in color, structure, and the etched-line motifs (hairlines, brackets, carets), not in a display typeface.

### Hierarchy
- **Display** (600 semibold, `2.25rem`, tight leading, `-0.01em` tracking): the song title field, the largest text on the page.
- **Title** (600 semibold, `1.125–1.25rem`, Inter): section names, dialog headers ("Songs", "Tuning — {track}"), sidebar heading, current-song title in the library list (500 medium there).
- **Body** (400, 13px, Inter): toolbar/nav buttons, sidebar rows, comments/notes textareas, shortcut-help copy.
- **Label** (500, 11px, uppercase, tracked, Inter or JetBrains Mono): tuning readout under the track tabs, song metadata in the sidebar, measure-line labels, measure-annotation placeholders.
- **Mono/Grid** (400, 13px, JetBrains Mono): every tab-grid cell value, note names in the left margin, BPM input.

### Named Rules
**The Grid-Is-Mono Rule.** Anything living inside the editable tab grid (fret numbers, note names, BPM) is JetBrains Mono; nothing outside the grid is set in the mono face for body text. Monospace signals "this is data you edit," never decoration.

## Layout

Single scrolling document, not a dashboard of panels: a left sidebar (song library), a center column (the actual score, `max-w-[1100px]`, centered with `px-5` gutters), and two elements that break out of the flow into fixed/floating position — the bottom transport bar and the top-right reference-video widget.

**The pinned utility bar.** Directly below the song-title field, a `sticky top-0` strip holds the instrument TrackTabs and the SectionNav jump bar, with its own bottom hairline and matching plate background so it reads as a plate the score scrolls beneath rather than a transparent overlay, plus `mt-4` breathing room on the score body below it so scrolled content never sits flush against the pinned strip. This exists because "controls for adding shit don't move with the page" was an explicit build-time complaint — the utility bar's pinning is load-bearing UX, not decoration, and should not be treated as optional chrome in future surfaces.

**The fixed bottom transport.** A `fixed bottom-0` bar, Songsterr-style, carrying every editing/playback action in one place: a full-width click-to-seek scrub rule (2px tall, crimson fill over a plate track) sits above a genuine three-column grid (`grid-cols-[1fr_auto_1fr]`, not a centered flex row with one side pulled out via absolute positioning) — add-measure/add-section on the left, skip-to-start/play-or-stop centered (truly centered regardless of the side groups' width), BPM and shortcut-help on the right. + Measure/+ Section moved here from the top utility bar and the standalone Clear button was removed entirely (it duplicated the sidebar's "+ New," which already starts a blank song) — the bottom bar is now the single home for every action that changes the timeline or plays it back. The page body carries `pb-24` so the transport never occludes the last measures of a song.

**The floating corner widget.** The reference-video panel is `fixed top-4 right-4` on desktop (`md:` and up) — deliberately the opposite corner from the transport bar, per direction. Below the `md` breakpoint it drops out of fixed positioning and flows inline in the document instead, because the sidebar occupies that same top-right corner once it stacks full-width on mobile; this responsive fallback exists to resolve a real widget/sidebar collision found in review, not as a stylistic choice.

**Grid rhythm.** One system (one instrument track) on screen at a time, switched by the TrackTabs, never all tracks stacked simultaneously. Within a track, sections are bracketed by a 3px `hairline-strong` rule on the left edge (`border-l-[3px] border-hairline-strong`) — deliberately not full-bright ink; a thick ink-colored rule read as "bright white lines out of place" against the dark ground in review and was toned down to the muted hairline color, same for the export-panel top divider — and measures wrap at 4-per-line (`chunkMeasures`). Every track is the strings model now (no separate vocal-lane cell width); grid cells are a fixed 28px wide (`CELL_W`) and 27px tall, with a hairline bottom border per row — the closest thing this system has to a spacing token, since the grid's rhythm is defined by the cell, not by a spacing scale. A single-line annotation input sits under the measure-number row for every measure (`measureNotes[m]`, placeholder "note") — free-text, shared across tracks since it annotates a point on the timeline, not one instrument's part.

## Elevation & Depth

Flat by default: no ambient drop shadows on ordinary UI, hairline borders and tonal steps (plate / plate-raised / plate-sunken) do all the depth work between rest-state surfaces. Shadows are reserved for the small set of elements that visually float above the document — modals, popovers, and the two elements that break out of normal flow.

### Shadow Vocabulary
- **Modal/overlay** (`box-shadow: 0 10px 28px rgba(28,27,25,0.28)`): the Tuning Editor and other centered dialogs over a `bg-black/70` scrim.
- **Popover** (`box-shadow: 0 6px 16px rgba(28,27,25,0.18)`): the section-link menu, shortcut-help panel.
- **Floating widget** (`box-shadow: 0 6px 16px rgba(0,0,0,0.4)` collapsed / `0 10px 24px rgba(0,0,0,0.45)` expanded): the reference-video corner widget and the toast, whose job is specifically to read as detached from the page.

### Named Rules
**The Flat Plate Rule.** Surfaces at rest are flat; a shadow appears only when an element has actually left the document flow (modal, popover, floating widget, toast) to signal "this is above the plate," never as ambient polish on ordinary panels or cards.

## Shapes

Every corner in the system is square (`border-radius: 0 !important` applied globally) — a deliberate, load-bearing convention consistent with the metal-plate/engraving world, not an oversight. Structure is expressed entirely through hairline rules (1px `border-hairline`/`border-hairline-strong`), a heavier 2px ink rule for major dividers (toolbar top border, export-panel divider), and a 3px solid ink rule marking section brackets — never through rounded containers or card chrome. The one curved marks that exist are genuine notation glyphs (⌒ tie/link mark, 𝄆 𝄇 repeat brackets), drawn as literal characters, not as a UI shape language.

## Components

### Buttons
- **Shape:** square corners throughout (0px, global reset), no exceptions.
- **Primary:** solid crimson fill, plate-dark text (`bg-accent text-accent-ink`), `px-6 py-2`, used only for the single default Play action in the transport bar and the sidebar's Save action.
- **Inverted primary:** solid ink fill, plate text — used exclusively for the Stop button while playing, so the transport's one filled button always matches the current playback state.
- **Ghost/text (the majority case):** transparent background, `text-ink-soft` at rest, `text-ink` or `text-accent` on hover, no border until hover reveals a bottom hairline (`hover:border-hairline-strong`). This is the default button treatment everywhere outside the transport: toolbar, section nav, track tabs, sidebar actions.
- **Danger variant:** same ghost treatment but hovers to `text-accent` / `border-accent` instead of ink — used for remove-track, remove-section, delete-song. There is no standalone "Clear whole song" action; the sidebar's "+ New" already starts a blank song and the two were redundant.
- **Hover / Focus:** color and border-color transitions only (150–200ms), never a fill or shadow change on ghost buttons; `:focus-visible` gets a 2px crimson outline with 1px offset globally.

### Cards / Containers
- **Corner Style:** square (0px).
- **Background:** `plate` for the grid and export `<pre>`, `plate-raised` for the sidebar, modals, and transport bar.
- **Shadow Strategy:** none at rest; see Elevation & Depth for the overlay/floating exceptions.
- **Border:** 1px `hairline-strong` around the grid, sidebar, modals, and the floating video widget — the system's substitute for card elevation.
- **Internal Padding:** grid uses `p-5`; modals use `p-6`; sidebar uses `p-5`.

### Inputs / Fields
- **Style:** no visible box at rest — transparent background, text sits directly on the plate with only a `border-b border-hairline` (or `border-hairline-strong` for the more prominent BPM/tuning fields) beneath it. This applies to the song-title field, section-name field, comment textareas, lyric-cell inputs, BPM field, and tuning-editor selects.
- **Focus:** the underline switches to crimson (`focus:border-accent`) — the only focus signal on text fields; no glow, no background change.
- **Error / Disabled:** disabled controls drop to 30–40% opacity (`disabled:opacity-30/40`) rather than changing color; there is no distinct error state in the system (destructive confirmations use `window.confirm` instead of inline field errors).

### Navigation
- **Track tabs:** each track is a pill-less row item with a 2px bottom border — transparent at rest, crimson when active, with a `plate-raised` background wash on the active tab. Track name is an inline-editable text input, not a static label.
- **Section nav:** a wrapped row of section buttons with a 2px bottom border, colored by the section's own tie color when linked (see Signature Component) or crimson when active/playing; invisible "+"/paste affordances live in the gaps between sections and reveal on hover (`opacity-0 hover:opacity-100`) so the row stays quiet until the user is actually placing something.
- **Mobile:** the sidebar stacks full-width above the score (`flex-col md:flex-row`); the sticky utility bar and fixed transport bar behavior are unchanged at any width.

### The Playhead and the Focus Caret (signature components)
Two related but distinct markers, both drawn as vertical lines rather than boxes — one visual language for "current position," whether that's the keyboard cursor or the playback head:
- **Playhead:** a single absolutely-positioned overlay element per visible line — a 2px crimson left border with a tinted crimson fill the width of one cell — computed from the active line's geometry (`playheadLeft()` in `TabGrid.tsx`) and animated with `transition-[left] duration-150 ease-out`. It is not a per-cell class swap; the overlay itself translates, which is what makes it "glide" across the line rather than jump cell-to-cell.
- **Focus caret:** the keyboard-focused cell renders `border-l-2 border-l-accent` plus the same 10%-tint fill directly on the cell button (`cellClass` in `TabGrid.tsx`) — a caret at the cell's leading edge, not a boxed outline. This replaced an `outline`-based focus ring specifically so the "current cell" and "current playhead step" read as the same kind of mark; a multi-cell drag selection still gets the plain tint fill with no caret, since only the single focus point is "the cursor."

### Authored Icon Set
A small set of hand-authored stroke SVGs (`src/components/Icons.tsx`: Play, Stop, SkipStart, Gear, Help, Insert, Close) at a single consistent 1.6px stroke weight, no fill, sized to `1em` so they scale with surrounding text. These stand in for all generic UI chrome that would otherwise use bare Unicode glyphs (✕, ▶, ⚙). Genuine music notation — the repeat-bracket marks (𝄆 𝄇) and the section-link tie mark (⌒) — is deliberately left as literal engraved characters, not converted to the icon set, because it is earned notation belonging to the score itself, not interchangeable UI chrome.

## Do's and Don'ts

### Do:
- **Do** keep crimson to the actively-playing/focused/selected element and destructive hover states only — see The One Accent Rule.
- **Do** use JetBrains Mono for anything inside the editable grid (fret numbers, note names, BPM) and reserve it for that role.
- **Do** use square corners everywhere; the global `border-radius: 0 !important` reset is a committed identity trait of this world, not a temporary default.
- **Do** express depth with hairline borders and plate/plate-raised/plate-sunken tonal steps before reaching for a shadow; reserve shadows for elements that have actually left document flow (modal, popover, floating widget, toast).
- **Do** keep the instrument-tab/section-jump utility bar pinned/sticky above the scrolling score, and every editing/playback action (add-measure, add-section, play, seek, BPM) inside the fixed bottom transport bar — both were direct build-time fixes for controls that "don't move with the page," not optional chrome.
- **Do** author new UI iconography as consistent-stroke SVGs matching `Icons.tsx`'s 1.6px stroke convention; do not reach for bare Unicode glyphs for generic chrome.
- **Do** mark "current position" (focus, playhead) as a vertical caret line, never a boxed outline — see The Playhead and the Focus Caret.
- **Do** treat Inter-only typography (weight/size hierarchy, no second display family) as the committed system — it survived two rounds of direct user rejection of serif alternatives.

### Don't:
- **Don't** introduce a second saturated accent color; the system's entire expressive color budget is one crimson against warm neutrals.
- **Don't** round any corner; there is no exception in the shipped system, including modals and floating widgets.
- **Don't** add drop shadows to elements that stay in normal document flow (cards, panels, buttons at rest) — shadow is reserved for genuinely floating/overlay elements per The Flat Plate Rule.
- **Don't** stack more than one instrument track's grid on screen at once; the one-system-at-a-time rule (switched by track tab) is a structural invariant of the score metaphor, not a space-saving default that can be relaxed.
- **Don't** reintroduce a serif or other second display typeface, or an italic voice, without an explicit fresh request — both were tried and explicitly rejected.
- **Don't** reintroduce a vocal/lyric track type; the product removed it in favor of the shared measure-annotation row (`measureNotes`), which covers free-text notes without a dedicated pitch/lyric lane.
