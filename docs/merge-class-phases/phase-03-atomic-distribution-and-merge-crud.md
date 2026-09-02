# Phase 03 – Atomic Distribution and Merge CRUD

## Phase Title
**Merge Class: Merge entity CRUD and atomic subject distribution**

## Objective
Implement backend logic to create/read/update/delete merge entities and to assign/update/remove subjects to a merge with **all-or-nothing** writes into time_assignments and room_assignments. Every distribution uses Phase 02 validation and a single transaction.

## Architectural Purpose
- Merge Class is a logical layer: metadata in merge_classes + merge_class_members + merge_class_assignments; physical data in time_assignments and room_assignments with merge_id and is_from_merge.
- All writes that touch multiple classes run in one transaction; on any failure, roll back entirely.
- Delete merge: remove only merge-originated rows (by merge_id); manual schedules unchanged.
- No unmerge feature: deleting the merge removes its distributed schedules and the merge record.

## Technical Scope

### Merge entity CRUD (internal helpers or direct in IPC later)

1. **Create merge**
   - Input: scheduleFileId, name, classIds (array, length ≥ 2).
   - Insert merge_classes (name, scheduleFileId); get new id.
   - Insert merge_class_members (mergeId, classId) for each classId.
   - Validate classIds exist and belong to same file context if needed.
   - No time_assignments/room_assignments written yet.

2. **Read merge list**
   - For scheduleFileId: SELECT merge_classes.*, count(members), count(assignments), sum(classes.students) as totalStudents (join merge_class_members, merge_class_assignments, classes) grouped by merge_classes.id.

3. **Read merge details**
   - By mergeId: merge name, list of classes (with program/yearLevel), total students, list of merge_class_assignments with subject/teacher/room/day/time.

4. **Update merge**
   - Allowed: change name; add/remove classes (still min 2).
   - If classes removed: optionally remove only those classes’ distributed rows (time/room_assignments for that merge_id and classId in removed set). Keep assignments for remaining classes.
   - If classes added: no automatic assignment distribution; new classes get new assignments only when user adds/edits subject (which writes to all current members).
   - Document behavior: e.g. “removing a class from merge removes that class’s merge-originated slots only.”

5. **Delete merge**
   - Delete all time_assignments WHERE merge_id = ? and is_from_merge = 1.
   - Delete all room_assignments WHERE merge_id = ? and is_from_merge = 1.
   - Delete merge_class_assignments WHERE mergeId = ?.
   - Delete merge_class_members WHERE mergeId = ?.
   - Delete merge_classes WHERE id = ?.
   - Order: assignments first (to satisfy FK if any), then merge_class_assignments, members, merge_classes. All in one transaction.

### Subject assignment to merge (atomic distribution)

6. **Add subject to merge**
   - Input: scheduleFileId, mergeId, subjectId, teacherId, roomId, day, timeSlot, duration.
   - Run Phase 02 validation; if invalid, return { success: false, message }.
   - In a single transaction:
     - Insert one row into merge_class_assignments (id, mergeId, scheduleFileId, subjectId, teacherId, roomId, day, timeSlot, duration).
     - For each classId in merge_class_members for this mergeId:
       - Insert time_assignments (id, scheduleFileId, subjectId, teacherId, classId, day, timeSlot, duration, merge_id = mergeId, is_from_merge = 1).
       - Insert room_assignments (id, scheduleFileId, subjectId, teacherId, classId, roomId, merge_id = mergeId, is_from_merge = 1).
   - If any insert fails, rollback entire transaction.
   - Return { success: true, assignmentId } (e.g. merge_class_assignments.id).

7. **Update subject in merge**
   - Input: mergeId, merge_class_assignment id, updated teacherId, roomId, day, timeSlot, duration.
   - Run Phase 02 validation (with existing assignment excluded) for the new slot/teacher/room.
   - In a single transaction:
     - Update merge_class_assignments row.
     - For each classId in merge_class_members: update corresponding time_assignments and room_assignments rows (match by merge_id, subjectId, classId or by storing assignment id in distributed rows if preferred). Alternatively delete old and insert new for each class; ensure atomic.
   - Rollback on any failure.

8. **Remove subject from merge**
   - Input: mergeId, merge_class_assignment id (or subjectId if one subject per merge).
   - In a single transaction:
     - Delete from time_assignments WHERE merge_id = mergeId and subjectId = subject and (classId in merge members). Same for room_assignments.
     - Delete merge_class_assignments row.
   - No validation needed for delete; idempotent if already missing.

### Transaction strategy

- Use `db.serialize()` and explicit BEGIN/COMMIT/ROLLBACK if supported, or run all steps in a single `db.run` chain with manual rollback on error (e.g. run deletes/inserts in order and on first error call rollback and return).
- SQLite: `db.run("BEGIN");` then run all statements; on success `db.run("COMMIT");` on failure `db.run("ROLLBACK");` and return error.

## Files Affected

| File | Action |
|------|--------|
| `electron/main.js` | Implement merge CRUD helpers and subject add/update/delete distribution; all inside transactions. Call Phase 02 validation before add and update. No IPC exposure yet (Phase 04). |

## Data Layer Impact

- Full use of merge_classes, merge_class_members, merge_class_assignments and time_assignments/room_assignments with merge_id and is_from_merge.
- All distribution writes are transactional and atomic.

## Validation Layer Impact

- Phase 02 validation is invoked before every add and update of a merge subject assignment.

## UI Layer Impact

- None. API surface (IPC) is Phase 04.

## Testing Strategy

- Create merge with 2 classes; verify merge_classes and merge_class_members rows.
- Add subject; verify one merge_class_assignments row and N time_assignments + N room_assignments (N = number of classes), all with same merge_id and is_from_merge = 1.
- Trigger validation failure (e.g. slot occupied): verify no new rows written.
- Update subject (time/room/teacher): verify all N classes’ rows updated consistently.
- Remove subject: verify all distributed rows for that subject and merge removed, merge_class_assignments row removed.
- Delete merge: verify all merge-originated time/room_assignments removed, merge_class_assignments, merge_class_members, merge_classes removed; other assignments untouched.
- Test rollback: simulate failure mid-transaction (e.g. invalid FK); verify no partial rows.

## Edge Case Handling

- **Merge has 0 assignments:** Delete merge only removes metadata and no assignment rows; safe.
- **Update with same values:** Validation may pass (no conflict with self); update is no-op or harmless.
- **Concurrent edits:** Not in scope for Phase 03; document that last-write-wins; consider locking in future if needed.

## Failure Scenarios

- Validation fails: Return immediately without opening transaction; no DB changes.
- Transaction fails: Rollback; return generic or specific error to caller.
- Merge id invalid: Return error; do not write.

## Completion Criteria

- [ ] Create/read/update/delete merge implemented and transactional.
- [ ] Add subject to merge: validation then atomic insert to merge_class_assignments + time_assignments + room_assignments for all member classes.
- [ ] Update subject: validation then atomic update of all distributed rows.
- [ ] Remove subject: atomic delete of distributed rows and merge_class_assignments row.
- [ ] Delete merge: all merge-originated data removed in one transaction.
- [ ] No partial writes under failure; rollback verified.
