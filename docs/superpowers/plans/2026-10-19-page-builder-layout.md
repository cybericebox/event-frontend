# Page builder layout implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task.

**Goal:** Give the shared landing/custom-page builder responsive spacing, bounded content width and positioning, mobile edge-to-edge banners, and two-column rich text.

**Architecture:** Optional structured fields on ContentBlock are validated and persisted by daemon and parsed by the frontend. The shared ContentBlocks renderer and specialized action/partner components apply the same layout styles in preview and public pages. Existing documents retain current appearance when optional fields are absent.

**Tech Stack:** React, Next.js, TypeScript, Zod, CSS container queries, Go, Vitest.

**Spec:** User-approved scope in this chat: separate top/bottom/side spacing for desktop/mobile; max width and content position; mobile full-width banner; one/two text columns collapsing on mobile. Sequential blocks remain sequential.

## Global constraints
- Separate worktrees feat/page-builder-layout in event-frontend and daemon; local commits only, no push or deployment.
- All UI messages in messages/uk.json and messages/en.json; preserve saving, validation and publication flows.
- Optional values preserve old documents; explicit zero spacing must round-trip.
- Numeric spacing 0–160 px, integer; optional max width 320–1920 px; alignment start/center/end; text columns 1/2 only.
- Mobile overrides inherit desktop custom values unless separately set, then fall back to current responsive defaults.
- Mobile banner full width removes horizontal frame padding, preserves vertical spacing and image aspect ratio.

## Review focus
- Zero and unset must remain distinct after API round trips.
- Invalid numbers and options must be rejected next to their controls, also by server.
- Long URLs, words, headings and two-column text must wrap without horizontal overflow.
- Optional settings must reach countdown, action, partner and ordinary sections equally.
- Mobile rules must match between editor preview and public pages.

## Tasks
1. Contract and tests: extend frontend schema and daemon Block with responsive spacing, maxWidth/contentAlign, textColumns and mobileFullWidth; reject invalid values and test JSON round trips and legacy documents.
2. Renderer and tests: shared layout helper and props on every rendered block including ActionBlock and PartnersBlock; responsive CSS variables and mobile banner/column rules; test explicit zero, width, alignment and specialized block forwarding.
3. Editor and tests: a reusable collapsible layout control panel shared by all block types, desktop/mobile inputs with inherit placeholders, width/alignment controls, text columns and mobile banner option; preserve content and bind errors to fields. Add uk/en messages.
4. Verify: targeted tests, complete frontend suite, typecheck, lint, Go package tests and broader applicable checks. Inspect local editor/public fixtures at desktop/mobile sizes. Review diff and report any blocked checks. Do not change the hosted event using unreleased options.

## Completion evidence
- Frontend full suite: 295 files, 2124 tests passed; final targeted regression run: 17 passed.
- Frontend typecheck passed; lint passed with 23 existing warnings and no errors. Mechanical UI detector returned no findings.
- Production build passed with `NEXT_PUBLIC_DOMAIN=cybericebox.example NEXT_PUBLIC_SUPPORT_EMAIL=support@example.com npm run build -- --webpack`. Default Turbopack cannot follow the worktree's shared node_modules symlink outside its inferred filesystem root; no production configuration was changed to work around this local setup constraint.
- Daemon full suite: 5009 tests passed in 240 packages; API documentation regenerated.
- Browser: 1280px page renders 960px text in two columns, 320px text in one column and 320px document with stacked contents. Mobile 390px and 320px have no horizontal overflow; edge banner matches viewport width; toggling it off restores side padding. Changing mobile bottom spacing updates the preview to 24px.
- Fresh review finding fixed: max-width content uses its own named query container so constrained blocks adapt independently of the page width. Re-review found no remaining confirmed issues.
- All tasks completed locally. No push, merge, deployment, or hosted event changes made for this implementation.
