# Phase 07 – Home Timetable Merge Read-Only

## Phase Title
**Merge Class: Home timetable shows merge slots as read-only**

## Objective
In the Home timetable view, every schedule entry that originates from a merge (is_from_merge = 1) is visible but not editable or draggable. Show a “Merge Class” label, cursor not-allowed on hover, and optionally a tooltip that editing is done in Merge Class.

## Architectural Purpose
- Source of truth for “merge or not” is get-assignments (Phase 05); Home consumes that and applies read-only behavior so users cannot accidentally edit merge-originated slots from Home.
- Aligns with requirement: “Schedules from merge: must be visible in Home timetable; cannot be edited or drag-dropped there; editable ONLY inside Merge Class interface.”

## Technical Scope

### Data

- Home already loads assignments via getAssignments(fileId). After Phase 05, each time and room assignment object includes `merge_id` and `is_from_merge` (and optionally `merge_name`).
- No change to how assignments are fetched; only usage of the new fields.

### Visual and interaction

1. **Label**
   - For each slot/card that represents a time_assignment with is_from_merge === 1 (or truthy), display a “Merge Class” label (text or badge) on or near the slot. Placement per existing grid/card design (e.g. small label at top or bottom of cell).

2. **Cursor**
   - When the user hovers over a merge-originated slot, set cursor to `not-allowed` (or equivalent CSS). Apply to the same element that would normally be draggable or clickable for non-merge slots.

3. **Click**
   - For merge slots: do not open the edit/tooltip panel that allows Remove/Edit (ScheduleCellTooltip with onRemove, onEdit). Either:
     - Do not set clickedCell for merge slots (so no tooltip/actions), or
     - Show a read-only tooltip with subject/teacher/room/time and message “This schedule is managed in Merge Class [Name]. Edit it from the Merge Class interface.” No Edit/Remove buttons.
   - Ensure click handler checks is_from_merge and branches accordingly.

4. **Drag/drop**
   - Disable drag for merge-originated entries. If the timetable uses drag to move slots, the draggable source for a cell with is_from_merge should not start a drag (e.g. omit draggable or use pointer-events / condition in onDragStart). Do not allow dropping onto merge slots if that would imply edit (or allow drop only for non-merge slots as today).
   - Pan/drag of the canvas itself is unchanged; only the “drag a schedule block” interaction is disabled for merge blocks.

### Implementation points (Home.jsx)

- Where timeAssignments (or combined assignments) are rendered, each item may already have type, id, classId, etc. After Phase 05 they also have is_from_merge and merge_id (and optionally merge_name).
- In the cell render: if assignment.is_from_merge, render label “Merge Class”, add class or style for cursor not-allowed, and do not pass onEdit/onRemove or disable the click that opens edit tooltip.
- In tooltip/popover: if assignment.is_from_merge, show info only and tooltip text about Merge Class; no Edit/Remove.
- In drag logic: if the dragged item has is_from_merge, prevent drag start (return or don’t set drag state).

## Files Affected

| File | Action |
|------|--------|
| `src/pages/Home.jsx` | Use merge_id and is_from_merge from assignments. For merge slots: add “Merge Class” label, cursor not-allowed, read-only click/tooltip (no Edit/Remove), disable drag for merge blocks. |

## Data Layer Impact

- None. Home only reads data already provided by get-assignments (Phase 05).

## Validation Layer Impact

- None. Backend already rejects edit/delete of merge rows (Phase 05); this phase only enforces read-only in the UI.

## UI Layer Impact

- Home timetable: visual and interaction changes only for merge-originated slots. Non-merge slots unchanged.

## Testing Strategy

- Load Home with a file that has at least one merge with one subject assigned. Verify merge slots appear in the grid.
- Verify “Merge Class” label visible on those slots.
- Hover: cursor is not-allowed.
- Click merge slot: no Edit/Remove; either no tooltip or read-only tooltip with message.
- Attempt to drag a merge slot: drag does not start (or slot is not draggable).
- Non-merge slots: still editable/removable and draggable as before.

## Edge Case Handling

- **Old data without is_from_merge:** Treat missing or falsy as non-merge; no label, normal edit/drag.
- **merge_name missing:** Tooltip can say “Merge Class” only, or “managed in Merge Class” without name.

## Failure Scenarios

- If getAssignments does not return merge fields (e.g. old backend), fallback to non-merge behavior so Home does not break.

## Completion Criteria

- [ ] Merge-originated slots show “Merge Class” label.
- [ ] Cursor is not-allowed when hovering merge slots.
- [ ] Click on merge slot does not open Edit/Remove; at most read-only tooltip with Merge Class message.
- [ ] Dragging a merge slot is disabled (drag does not start).
- [ ] Non-merge slots behave as before (editable, removable, draggable where applicable).
