# Phase 05 – Assignments and File Lifecycle

## Phase Title
**Merge Class: get-assignments merge flags and file copy/delete**

## Objective
(1) Have `get-assignments` return merge metadata so the Home timetable and other consumers can treat merge-originated slots as read-only. (2) Ensure save-as-file copies merge data and delete-schedule-file removes it, so file lifecycle is consistent.

## Architectural Purpose
- Single source of truth for “is this slot from a merge?” is the backend; get-assignments is the contract for Home and any other list view.
- File copy (save-as) must include merges and their distributed assignments so the new file behaves like the original. File delete must clean merge tables and merge-originated rows for that file.

## Technical Scope

### get-assignments (main.js)

- **Current behavior:** Returns subject_assignments, time_assignments, room_assignments for a fileId (with type 'subject'|'time'|'room').
- **Change:** For each time_assignment and room_assignment row, include in the returned object:
  - `merge_id` (value or null)
  - `is_from_merge` (0 or 1)
  - Optionally `merge_name` (from merge_classes.name where merge_id = merge_classes.id) for tooltip/UI.
- No change to subject_assignments structure unless they are also used for merge (per current design they are not; merge uses merge_class_assignments and distributed time/room rows).
- Backward compatibility: if columns are missing (old DB), treat as null/0 so existing clients keep working.

### Restrict non-merge edits to non-merge rows (optional but recommended in this phase)

- **update-time-slot-assignment / update-room-assignment:** If the assignment row has `is_from_merge = 1`, reject the update with a clear message (“This schedule is managed in Merge Class. Edit it from the Merge Class interface.”). Prevents Home or Assigning from changing merge-originated slots.
- **delete-assignment:** If the row is merge-originated (is_from_merge = 1), reject delete with same message. Merge subject removal is only via merge-remove-subject.
- This keeps “edit/delete only from Merge Class” enforced at the backend.

### save-as-file (main.js)

- **Current behavior:** Copies subject_assignments, time_assignments, room_assignments to the new fileId; new UUIDs for assignment ids.
- **Change:**
  - Copy merge_classes: INSERT new rows with new fileId (new id); build map oldMergeId → newMergeId.
  - Copy merge_class_members: INSERT with newMergeId and same classIds (classes are global).
  - Copy merge_class_assignments: INSERT with new merge ids and new fileId; new assignment ids; build map oldAssignmentId → newAssignmentId if needed.
  - Copy time_assignments that have is_from_merge = 1 and merge_id in the set of merged ids: new id, new scheduleFileId, new merge_id (mapped), same classId/subjectId/teacherId/roomId/day/timeSlot/duration, is_from_merge = 1.
  - Copy room_assignments similarly for merge-originated rows.
  - Order: create new file → copy subject/time/room (non-merge first or all together with merge_id preserved) then merge_classes → merge_class_members → merge_class_assignments then merge time/room rows with new merge_id. Ensure FK and merge_id mapping are consistent.
- Non-merge time/room assignments are already copied; no change to that part except ensuring merge rows are copied with correct new merge_id.

### delete-schedule-file (main.js)

- **Current behavior:** Deletes schedule_files row and deletes subject_assignments, time_assignments, room_assignments where scheduleFileId = id.
- **Change:** Before or with the same delete of assignments, delete merge-originated data for this file:
  - Delete time_assignments where scheduleFileId = id and is_from_merge = 1 (or merge_id in (SELECT id FROM merge_classes WHERE scheduleFileId = id)).
  - Delete room_assignments where scheduleFileId = id and is_from_merge = 1.
  - Delete merge_class_assignments where scheduleFileId = id (or mergeId in (SELECT id FROM merge_classes WHERE scheduleFileId = id)).
  - Delete merge_class_members where mergeId in (SELECT id FROM merge_classes WHERE scheduleFileId = id).
  - Delete merge_classes where scheduleFileId = id.
  - Then delete remaining subject_assignments, time_assignments, room_assignments (non-merge), then schedule_files.
- All in one transaction if possible so file delete is atomic.

## Files Affected

| File | Action |
|------|--------|
| `electron/main.js` | get-assignments: include merge_id, is_from_merge (and optionally merge_name). update-time-slot-assignment, update-room-assignment, delete-assignment: reject when is_from_merge = 1. save-as-file: copy merge_classes, merge_class_members, merge_class_assignments and merge-originated time/room_assignments with new merge ids. delete-schedule-file: delete merge data for file then rest. |

## Data Layer Impact

- Read: get-assignments reads existing columns. Write: save-as writes new merge and assignment rows; delete removes merge and assignment rows for the file.

## Validation Layer Impact

- Rejection of update/delete on merge-originated rows is a simple check (is_from_merge = 1); no new validation module.

## UI Layer Impact

- None in this phase. Home will consume the new fields in Phase 07.

## Testing Strategy

- get-assignments: For a file with merge and distributed slots, verify returned time/room assignments include merge_id and is_from_merge; merge_name if implemented.
- update-time-slot-assignment with id of a merge row: expect failure and message.
- delete-assignment with id of a merge row: expect failure.
- save-as-file: Create file with merge and one subject; save-as; open new file; verify merge list and subject and that time/room rows exist with is_from_merge and new merge_id.
- delete-schedule-file: Create file with merge and assignments; delete file; verify merge_classes, merge_class_assignments, and merge time/room rows for that file are gone; other files untouched.

## Edge Case Handling

- **File with no merge:** get-assignments returns same as before with merge_id null, is_from_merge 0. save-as and delete work as today for non-merge data.
- **Merge with 0 subjects:** save-as still copies merge and members; delete removes them.

## Failure Scenarios

- save-as copy fails mid-way: Use transaction; rollback new file and all copied data.
- get-assignments on old DB without columns: Use ALTER in Phase 01 so columns exist; in get-assignments if row doesn’t have property, default to null/0.

## Completion Criteria

- [ ] get-assignments returns merge_id and is_from_merge (and optionally merge_name) for time and room assignments.
- [ ] update-time-slot-assignment and update-room-assignment reject merge-originated rows with clear message.
- [ ] delete-assignment rejects merge-originated rows with clear message.
- [ ] save-as-file copies merge_classes, merge_class_members, merge_class_assignments and merge-originated time/room_assignments with correct new merge_id mapping.
- [ ] delete-schedule-file removes all merge-related data for the file in a consistent order (transaction recommended).
