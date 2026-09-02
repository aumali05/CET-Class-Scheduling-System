# Phase 02 – Merge Validation Layer

## Phase Title
**Merge Class: Backend validation for conflict-free assignment**

## Objective
Implement the full set of conflict checks required before any merge subject assignment (create or update). All checks run server-side; no assignment is written until validation passes.

## Architectural Purpose
- Centralize merge conflict logic in the backend so UI and future callers cannot bypass rules.
- Support atomic “assign subject to merge” in Phase 03 by providing a clear pass/fail and user-facing error message.
- Enforce: time slot free in every class, teacher available, room available, room capacity ≥ total students, no multi-merge same-slot conflict.

## Technical Scope

### Validation inputs (per assignment attempt)

- scheduleFileId, mergeId, subjectId, teacherId, roomId, day, timeSlot, duration (or start time + duration).
- List of classIds in the merge (from merge_class_members).
- For update: optional existing merge_class_assignment id to exclude from “same slot” checks (same merge, same subject).

### Validation rules (all must pass)

1. **Time slot free in every class**
   - For each classId in the merge, ensure no row in time_assignments for that scheduleFileId, classId, day, and overlapping time (consider timeSlot + duration).
   - Include both non-merge and merge-originated rows (any existing assignment blocks the slot).
   - Overlap logic: use existing time parsing (e.g. parseClockToMinutes) and compare ranges.

2. **Teacher availability (school-wide)**
   - No other time_assignment (any class, any merge) in the same schedule file with same teacherId, same day, overlapping time.
   - Same overlap logic as above.

3. **Room availability (school-wide)**
   - No other assignment using the same roomId in the same schedule file at same day and overlapping time (via room_assignments joined with time_assignments or equivalent).

4. **Room capacity ≥ total students**
   - Total students = SUM(classes.students) for all classes in the merge.
   - Fetch room capacity; if totalStudents > room.capacity, fail with clear message.
   - (UI will pre-filter rooms by capacity; this is the backend recheck.)

5. **Multi-merge same-slot**
   - For each classId in the merge, check if that class has any other merge’s assignment (time_assignments where is_from_merge = 1 and merge_id != current mergeId) at the same day and overlapping time.
   - If any class is already in another merge at that slot, block and return a message like “Class X already has [subject] scheduled at [day time] (from another merge).”

### Implementation shape

- One or more functions in `electron/main.js` (e.g. `validateMergeAssignment(fileId, mergeId, payload, existingAssignmentId?)`).
- Function is async/callback-based; performs all DB reads needed (merge members, time_assignments, room_assignments, rooms, classes, teachers).
- Returns `{ valid: boolean, message?: string }`. Message should be user-facing (e.g. “Cannot assign: Class 10A already has English scheduled at Mon 8:00-11:00”).
- No writes in this phase; validation only.

### Duplicate teacher/room within same merge

- Per requirements: same teacher and same room used for multiple classes in the same merge at the same time must **not** be treated as conflict. No extra check needed for “teacher already in this merge at this time” or “room already in this merge at this time” for the same assignment.

## Files Affected

| File | Action |
|------|--------|
| `electron/main.js` | Add validation helper(s). No new IPC handlers yet; validation will be called from Phase 03 handlers. |

## Data Layer Impact

- Read-only: queries merge_classes, merge_class_members, time_assignments, room_assignments, rooms, classes, subjects (for units if needed). No schema change.

## Validation Layer Impact

- This phase **is** the validation layer for merge. All five conflict types implemented and tested.

## UI Layer Impact

- None. UI will call IPC that uses this validation in Phase 04/06.

## Testing Strategy

- Unit-style tests (or manual test harness): Call validation with various payloads.
  - Valid case: empty slots, free teacher, free room, capacity OK, no other merge on those classes at that time → valid.
  - Time slot occupied in one class → invalid, message identifies class and slot.
  - Teacher busy at that time → invalid.
  - Room busy at that time → invalid.
  - Room capacity < total students → invalid.
  - One class in another merge at same slot → invalid, message mentions “another merge.”
- Edge: same merge, same subject, same slot (update case) – exclude current assignment from conflict check.

## Edge Case Handling

- **Update:** When editing an existing merge subject, exclude the current assignment’s time slot from “teacher/room already used” and “time slot in class” checks (otherwise update would always conflict with itself).
- **Time format:** Align with existing app (e.g. “8:00 AM - 11:00 AM” and duration in minutes); handle all day values (Mon–Sat).
- **Empty merge:** If merge has no classes (should not happen after create), validation can short-circuit to invalid.

## Failure Scenarios

- DB error during validation: Return { valid: false, message: generic “Validation error” } and log details; do not throw unhandled to renderer.
- Missing merge or classes: Return invalid with clear message.

## Completion Criteria

- [ ] All five conflict types implemented and return correct valid/false and user-facing messages.
- [ ] Update scenario (exclude current assignment) works.
- [ ] No writes performed; validation is side-effect free except for reads.
- [ ] Validation function(s) are ready to be called from merge assignment handler in Phase 03.
