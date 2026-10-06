# Event Lexical Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace formatted Markdown editing and rendering with the current admin Lexical editor on event pages, participant forms and surveys, and use the same read-only rendering path for challenge descriptions.

**Architecture:** Copy the required Lexical implementation into `event-frontend` so the frontends remain independent. Store Lexical JSON in the three formatted page fields, validate it in AP Backend, and render it through a single read-only component. Keep event-specific variable and link selection, bindings, and date formatting at the integration boundary.

**Tech Stack:** Next.js 16.3.6, React 19.3, Lexical 0.51, TypeScript 6, Zod 4, Go 1.27.

**Spec:** `docs/superpowers/specs/2026-09-27-event-lexical-editor-design.md`

## Global Constraints

- Work in the already approved branches: `redesign/event-frontend` and `feature/superadmin-infrastructure-read`.
- Copy code locally from `admin-frontend`; no cross-frontend imports or shared package.
- Formatted content uses Lexical JSON `richText`; no Markdown compatibility reader, migration, or HTML storage.
- Preserve the event variable picker, filtering, date display control, link destination picker, and Ukrainian UI copy.
- Commit each independently verified stage and leave both worktrees clean.
- Read the relevant `event-frontend/node_modules/next/dist/docs/` guide before changing Next.js code.

## Review Focus

- A variable alone counts as nonempty rich text and displays its current event value.
- A selected variable stays atomic when bold, italic, underline, strike, or code is toggled.
- A malicious link or unknown serialized node is rejected by the server and never becomes a live link in preview.
- A date variable's field-specific format survives save/reload, while deleting its node removes its stale format entry.
- A saved FAQ or document section renders identically in sidebar preview and the public/moderator page.

---

### Task 1: Establish the Lexical JSON contract and server validation

**Files:**
- Modify: `AP Backend/internal/model/eventContent/document.go`
- Modify: `AP Backend/internal/model/eventContent/document_test.go`
- Modify: `AP Backend/internal/model/eventContent/page_test.go`
- Modify: `AP Backend/internal/useCase/event/content_variables_test.go`
- Modify: `AP Backend/internal/delivery/repository/postgres/event_pages_integration_test.go`
- Modify: `AP Backend/internal/delivery/repository/eventContentRepo/repository_test.go`
- Modify: `AP Backend/internal/useCase/event/forms_delivery_version_test.go`
- Create: `AP Backend/internal/model/eventContent/rich_text.go`
- Modify: `event-frontend/src/types/eventContent.ts`
- Create: `event-frontend/src/components/event/content/richTextState.ts`

**Interfaces:**
- Go block and item fields: `RichText json.RawMessage` with JSON name `richText`.
- Go validator: `validateRichText(raw json.RawMessage, declared map[string]struct{}) (names map[string]struct{}, err error)`.
- TypeScript: `ContentRichText` is a Lexical root object; `richTextVariableNames(value)` and `richTextHasContent(value)` inspect validated data.

- [ ] **Step 1: Add failing Go table tests.** Test a paragraph with text, a variable-only paragraph, empty root, invalid JSON, excessive size/depth, unknown node, dangerous link, undeclared variable, and `dateDisplays` referring to a removed variable. Assert `Document.Validate()` accepts only the two valid samples and returns an error for each invalid sample. Use `json.RawMessage` literals such as:

```go
json.RawMessage(`{"root":{"type":"root","version":1,"children":[{"type":"paragraph","version":1,"children":[{"type":"variable","version":1,"varName":"event.name"}]}]}}`)
```

- [ ] **Step 2: Run `go test ./internal/model/eventContent -count=1` in `AP Backend` and confirm the new contract tests fail.**
- [ ] **Step 3: Replace `Block.Markdown` and formatted `BlockItem.Value` use with `RichText`, leaving `Value` for other item types.** In `rich_text.go`, decode into a node shape that contains Lexical's serialized fields, cap raw bytes at 256 KiB and recursion at 32 levels, allow `root`, `paragraph`, `heading` (h1–h6), `quote`, `code`, `list`, `listitem`, `text`, `linebreak`, `link`, and `variable`; reject unsupported node types, formatting flags and unsafe `url` with `validContentHref`. Collect variable node names and check them against `EventContentVariables` and block bindings. In `Document.Validate`, validate `richText` for every text block and FAQ/doc answer item; check `dateDisplays` for `richText` or `item:N:richText` against collected names. Keep other text-field and item `value` validation unchanged. Update the listed Go test fixtures to use the new wire contract; no Markdown compatibility branch remains.
- [ ] **Step 4: Replace the frontend Zod fields and add a small pure helper.** The helper must count nonempty `text` or `variable` nodes, extract variable names from `richText.root.children`, and not interpret arbitrary HTML. Keep backend rejection authoritative.
- [ ] **Step 5: Run Go package tests and `npx tsc --noEmit` in `event-frontend`; correct only contract-related failures, then commit the backend and frontend contract changes separately.**

### Task 2: Port the admin Lexical editor into the event frontend

**Files:**
- Modify: `event-frontend/package.json`, `event-frontend/package-lock.json`
- Create: `event-frontend/src/components/event/manage/EventRichTextEditor.tsx`
- Create: `event-frontend/src/components/event/manage/EventVariableNode.tsx`
- Modify: `event-frontend/src/components/event/manage/RichMarkdownField.tsx` (replace its implementation or remove it after all call sites move)
- Modify: `event-frontend/src/styles/event.css`

**Interfaces:**
- `EventRichTextEditor({value, onChange, variables, values, onInsertVariable, onEditLink, dateDisplays, disabled})` consumes `ContentRichText | null` and emits `ContentRichText`.
- `EventVariableNode` keeps admin's serialized `type: "variable", version: 1, varName, formats` shape.

- [ ] **Step 1: Install the same Lexical 0.51 packages imported by `admin-frontend/src/components/notifications/editor/RichTextEditor.tsx`.** Use `npm install` from `event-frontend`; do not import admin source directly.
- [ ] **Step 2: Copy the admin editor's Lexical composer, toolbar commands, History/List/Link plugins, Markdown paste transformer, external state synchronization, and `VariableNode` locally.** Replace admin translation, styles, and placeholder menu imports with event UI components. Preserve the admin command order and paragraph-level alignment behavior. Use the existing event variable picker for the right-edge button, yellow pills with actual event values, and the existing event link destination picker.
- [ ] **Step 3: Verify in the browser that typing, selection, bold toggle twice, H1–H6, lists, quote, inline/block code, link editing, alignment, clear formatting, undo/redo, Markdown paste, and atomic variable formatting work.** Check mouse and keyboard selection, especially a variable alone.
- [ ] **Step 4: Run `npx tsc --noEmit`, `npm run lint`, and `npm run build`; commit editor dependencies and local editor implementation together.**

### Task 3: Integrate the editor into all three page fields

**Files:**
- Modify: `event-frontend/src/components/event/manage/PageBlockEditor.tsx`
- Modify: `event-frontend/src/components/event/manage/blockPalette.ts`
- Modify: `event-frontend/src/components/event/manage/validatePageBlocks.ts`
- Modify: `event-frontend/src/components/event/manage/participantFormEditor.ts`
- Modify: `event-frontend/src/components/event/manage/DateVariableFormatControls.tsx`
- Modify: `event-frontend/src/app/manage/participant-form/page.tsx`
- Modify: `event-frontend/src/app/manage/surveys/page.tsx`
- Modify: `event-frontend/src/api/eventContent.ts`
- Modify: `event-frontend/src/api/manage.ts`
- Modify: `event-frontend/src/api/mockLanding.ts`
- Modify: `event-frontend/src/components/event/manage/RichMarkdownField.tsx` (delete when no longer referenced)

**Interfaces:**
- Text block: `block.richText`; FAQ/doc item: `item.richText`.
- Field keys: `richText` and `item:N:richText`; date-display maps use those same keys.

- [ ] **Step 1: Replace default `markdown: ""` and formatted item `value: ""` with an empty Lexical root state.** This includes page mock fixtures and text blocks created in participant forms and surveys. Leave facts, timeline, hero and other item values as strings.
- [ ] **Step 2: Wire `EventRichTextEditor` into text, FAQ and doc editing.** Update `fieldValue`/`changeField` or separate rich state accessors so JSON is never treated as a string. Derive the collapsed block summary from plain text and current variable values in the Lexical tree. On variable insertion, add the block binding. On node removal, derive active variable names and prune only obsolete date display mappings for that rich field. Preserve the current floating picker placement and per-field date controls.
- [ ] **Step 3: Replace the participant-form and survey text `<textarea>` with `EventRichTextEditor` without event variables.** Their `validateParticipantForm` path checks `richTextHasContent`. Keep question labels, answer inputs and field conditions as ordinary strings; only their text block changes.
- [ ] **Step 4: Update client validation and error targeting.** `richTextHasContent` accepts a variable-only page field, reports an error beneath the empty editor, and outlines its block and field. Other item types continue to validate `value`.
- [ ] **Step 5: In the browser, edit the three page fields plus participant-form and survey text blocks, insert a date variable with custom seconds in its page field, save, reload, and confirm content and date format persist.** Check variable option filtering, links to built-in/custom pages and external HTTPS, and visible Ukrainian help text. Confirm form and survey editors do not offer event variables.
- [ ] **Step 6: Run typecheck, lint, build and focused Go tests; commit the verified integration.**

### Task 4: Render saved Lexical content consistently

**Files:**
- Create: `event-frontend/src/components/event/content/EventRichTextView.tsx`
- Modify: `event-frontend/src/components/event/content/ContentBlocks.tsx`
- Modify: `event-frontend/src/components/event/challenges/ChallengeDescription.tsx`
- Modify: `event-frontend/src/app/join/page.tsx`
- Modify: `event-frontend/src/app/forms/page.tsx`
- Modify: `event-frontend/src/app/manage/participant-form/page.tsx`
- Modify: `event-frontend/src/app/manage/surveys/page.tsx`
- Modify: `event-frontend/src/styles/event.css`

**Interfaces:**
- `EventRichTextView({value, variables, bindings, dateDisplays, emptyFallback})` renders saved Lexical JSON without editor controls.
- `ChallengeDescription` passes the task's Lexical JSON to the same read-only view, with only task-approved variable definitions and no event-only values.

- [ ] **Step 1: Use the same registered Lexical nodes and theme in a read-only composer.** Render text, headings, lists, quotes, code, links, alignment, and variable pills. Format dates through the existing `formatDateTime`; reject unsafe link destinations even if malformed input reaches the client. Keep variable values as literal text, never parsed as markup.
- [ ] **Step 2: Replace `AlignedMarkdown` only in text, FAQ and doc branches of `ContentBlocks`.** Keep other string token replacement unchanged. Use `EventRichTextView` for text blocks in join, forms, participant-form preview and surveys preview. Replace the custom traversal in `ChallengeDescription` with the same view in read-only mode; preserve its no-description fallback.
- [ ] **Step 3: Compare sidebar preview, moderator page and public page for paragraph spacing, links, lists, quote, code, alignment, and formatted variable; check participant forms and surveys in preview and attendee view, and check a challenge description shows no toolbar.** Include a malformed link and unknown node case in a pure rendering test or manual fixture.
- [ ] **Step 4: Run `npx tsc --noEmit`, `npm run lint`, `npm run build`, and the focused Go model, repository and event use-case tests; commit the rendering stage.**

### Task 5: Final end-to-end editor verification

**Files:**
- Modify: `event-frontend/docs/page-constructor-audit.md` (verification evidence only)

- [ ] **Step 1: In the running app, check new event pages for text, FAQ and doc, and new form and survey text blocks: edit → preview → save → reload → moderator view → participant/public view.** Verify dates in minutes and seconds on pages, variable pills, Markdown paste, selected-variable formatting, undo/redo, and safe links. Existing Markdown content is outside the no-migration contract.
- [ ] **Step 2: Check backend rejects malformed Lexical JSON and an undeclared variable at the API boundary; check a valid JSON document round-trips unchanged.** Avoid creating persistent test content; restore the page after the check.
- [ ] **Step 3: Record exactly what passed and any browser-only limits in the audit doc. Run the final targeted checks once, commit the evidence, and verify `git status --short` is empty in both repositories.**

After this plan, investigate the separate landing-banner flicker reported by the user. Trace the post-save data flow and image source, then fix and verify it in a separate commit.
