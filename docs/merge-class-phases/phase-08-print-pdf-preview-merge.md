# Phase 08 – Print, PDF, and Preview with Merge

## Phase Title
**Merge Class: Include merge schedules in print, PDF export, and preview**

## Objective
Ensure merge-originated schedules are included in (1) print output, (2) PDF export, and (3) preview HTML, with a clear visual distinction (e.g. label “Merge Class” or footnote) so they are recognizable. Each class’s timetable shows both manual and merge entries; merge entries are read-only in the app but appear normally in output.

## Architectural Purpose
- Print, PDF, and preview are generated in the main process (main.js) and must use the same data model: time_assignments and room_assignments (with merge_id/is_from_merge) plus merge_classes/merge_class_assignments for context. Merge slots are already in time_assignments/room_assignments per Phase 01–03, so builders should iterate over those rows and mark merge ones for styling.
- Consistency: same logic for “what appears in a class’s timetable” (manual + merge) across print, PDF, and preview.

## Technical Scope

### Data loading

- **print-file:** Already loads merge_class_assignments and merge_classes (Phase 01 ensures tables exist). Ensure allTimeAssignments (or the list used to fill the grid) includes time_assignments that have is_from_merge = 1 and merge_id set. If current code builds “allTimeAssignments” only from time_assignments, it already gets merge rows (they live in the same table). Add merge_id/is_from_merge to the row or use merge_classes/merge_class_assignments to know which entries are merge; use this only for styling (e.g. add a label in the cell).
- **export-file (PDF path):** Today it loads time_assignments, room_assignments, etc., but not merge_classes/merge_class_assignments. Add the same merge table loads as print-file. When building per-class or per-teacher or per-room tables, include time_assignments and room_assignments rows regardless of is_from_merge; for cells that correspond to merge rows, add visual distinction (label “Merge Class” or class name / footnote).
- **generate-preview:** Same as export-file: load merge_classes and merge_class_assignments if needed for names; ensure time_assignments and room_assignments used for preview HTML include merge rows. Add visual distinction for merge slots in the generated HTML.

### Visual distinction

- **Option A:** In the cell HTML, add a small label or span “Merge Class” (e.g. next to subject name or in a second line).
- **Option B:** Different background color or border for merge cells (e.g. light tint or dashed border).
- **Option C:** Footnote: “* Merge Class” and mark merge cells with *.
- Requirement allows “label, color, or footnote”; choose one or two and apply consistently in print, PDF, and preview.

### Logic consistency

- For each class timetable view: include all time_assignments where classId = that class (and scheduleFileId = file), including rows with is_from_merge = 1. Match room_assignments the same way (by scheduleFileId, classId, subjectId, teacherId). No filtering out merge rows.
- For teacher/room views: include all assignments (merge and non-merge) that reference that teacher or room; add same visual distinction for merge rows so readers know they are merge-originated.

## Files Affected

| File | Action |
|------|--------|
| `electron/main.js` | **print-file:** Ensure merge time/room rows included in allTimeAssignments (or equivalent); when building table cells, if row has is_from_merge/merge_id, add chosen visual distinction (label/color/footnote). **export-file:** Load merge_classes and merge_class_assignments; when building PDF HTML, include merge rows in assignment lists and add same visual distinction. **generate-preview:** Load merge data; include merge rows in preview HTML; add same visual distinction. |

## Data Layer Impact

- Read-only: same tables as today plus merge tables for context. No schema change.

## Validation Layer Impact

- None.

## UI Layer Impact

- None in renderer; only main process output (print window, PDF file, preview HTML). View.jsx or wherever preview is shown will display whatever HTML the backend returns; no change needed if backend includes merge in that HTML.

## Testing Strategy

- Create a merge with one subject; open a class that is in the merge. Print: that class’s timetable should show the subject in the correct slot with “Merge Class” (or chosen) distinction. PDF export (class view): same. Preview: same.
- Class not in merge: no merge slot. Class in merge: merge slot visible and marked.
- Teacher view: if teacher has a merge assignment, it appears and is marked. Room view: same.
- Compare print, PDF, and preview for same file: merge slots appear consistently with same distinction.

## Edge Case Handling

- **File with no merge:** No merge rows; output unchanged from current behavior.
- **Merge with 0 subjects:** No merge assignment rows; only manual slots.

## Failure Scenarios

- Missing merge tables (should not happen after Phase 01): If queries are guarded, return empty arrays and proceed without merge distinction.
- Merge rows missing is_from_merge: Treat as non-merge for styling (no label).

## Completion Criteria

- [ ] print-file includes merge-originated time/room assignments in the printed tables and applies the chosen visual distinction (label/color/footnote).
- [ ] export-file (PDF) loads merge data and includes merge slots in PDF output with same distinction.
- [ ] generate-preview includes merge slots in preview HTML with same distinction.
- [ ] Per-class, per-teacher, and per-room views (where applicable) show merge slots consistently across print, PDF, and preview.
