# Phase 04 – IPC Handlers and Preload

## Phase Title
**Merge Class: Expose merge APIs to renderer**

## Objective
Wire the merge and merge-subject operations from Phase 03 to the renderer via IPC. Align preload with requirements (no unmerge; delete merge only) and ensure a single, clear API for the Merge Class UI.

## Architectural Purpose
- All merge operations go through main process; renderer cannot bypass validation or atomicity.
- Preload defines the contract (window.api) that the UI will use in Phase 06.
- Current file (scheduleFileId) is the scope for merge; handlers must receive or resolve fileId where needed.

## Technical Scope

### IPC handlers to implement in main.js

1. **get-merge-list** (or get-merges-for-file)
   - Args: `{ fileId }` or use current file.
   - Returns: list of merges for that schedule file (name, id, class count, subject count, total students). Resolve fileId from args or currentFile.

2. **get-available-classes-for-merge** (already in preload name)
   - Args: optional fileId.
   - Returns: list of classes (id, name, program, yearLevel, students) for class picker. May optionally include “already in merges” for UI display; no restriction on selection (multi-merge allowed).

3. **create-merged-class**
   - Args: `{ scheduleFileId?, name, classIds }`. If scheduleFileId omitted, use current file.
   - Validates: classIds length ≥ 2; classes exist.
   - Calls Phase 03 create merge. Returns { success, mergeId?, message }.

4. **get-merged-class-details**
   - Args: `mergeId` (and optionally fileId for consistency).
   - Returns: merge name, classes (with details), total students, list of subject assignments (subject, teacher, room, day, timeSlot, duration, id). From Phase 03 read merge details.

5. **update-merged-class**
   - Args: `{ mergeId, name?, classIds? }`. At least one of name or classIds.
   - If classIds provided: still min 2; apply add/remove members per Phase 03 update merge (remove distributed slots for removed classes).
   - Returns { success, message }.

6. **delete-merge-class**
   - Args: `mergeId`.
   - Calls Phase 03 delete merge (all merge-originated rows + metadata). No “unmerge”—merge is deleted.
   - Returns { success, message }.

7. **merge-add-subject**
   - Args: `{ scheduleFileId?, mergeId, subjectId, teacherId, roomId, day, timeSlot, duration }`.
   - Resolve fileId; run Phase 02 validation then Phase 03 add subject. Return { success, assignmentId?, message }.

8. **merge-update-subject**
   - Args: `{ mergeId, assignmentId, teacherId, roomId, day, timeSlot, duration }`.
   - Run Phase 02 validation (excluding current assignment) then Phase 03 update subject. Return { success, message }.

9. **merge-remove-subject**
   - Args: `{ mergeId, assignmentId }`.
   - Calls Phase 03 remove subject. Return { success, message }.

### Preload changes (preload.js)

- **Remove** `unmergeClass` (requirements: no unmerge).
- **Add** `deleteMergeClass(mergeId)` → invoke `delete-merge-class`.
- **Keep** `getAllClassesWithMergeStatus` only if needed: can return classes with a flag “inMergeIds” or similar for UI. Otherwise rename/align to `getAvailableClassesForMerge` and `getMergeList(fileId)` etc.
- Expose:
  - getMergeList(fileId?)
  - getAvailableClassesForMerge(fileId?)
  - createMergedClass({ name, classIds, scheduleFileId? })
  - getMergedClassDetails(mergeId)
  - updateMergedClass({ mergeId, name?, classIds? })
  - deleteMergeClass(mergeId)
  - mergeAddSubject({ mergeId, subjectId, teacherId, roomId, day, timeSlot, duration, scheduleFileId? })
  - mergeUpdateSubject({ mergeId, assignmentId, teacherId, roomId, day, timeSlot, duration })
  - mergeRemoveSubject({ mergeId, assignmentId })
- Ensure scheduleFileId is passed when UI has current file (e.g. from getCurrentFile()); main can fallback to currentFile if not provided.

## Files Affected

| File | Action |
|------|--------|
| `electron/main.js` | Implement all ipcMain.handle for the channels above; each handler calls Phase 03 logic and returns structured result. |
| `electron/preload.js` | Remove unmergeClass; add deleteMergeClass and merge subject APIs; align names with main handlers. |

## Data Layer Impact

- No new schema; handlers only call Phase 03 and Phase 02. Data layer impact is as in Phase 03.

## Validation Layer Impact

- Phase 02 validation is used by merge-add-subject and merge-update-subject handlers.

## UI Layer Impact

- None in this phase. UI will be built in Phase 06 against this API.

## Testing Strategy

- From renderer or test script: call each API with valid/invalid args.
- createMergedClass with < 2 classes → failure.
- mergeAddSubject with conflicting slot → failure with message.
- mergeAddSubject with valid data → success; verify DB state.
- deleteMergeClass → merge and its distributed schedules gone.
- getMergedClassDetails after add/update/remove subject → consistent list.

## Edge Case Handling

- **No current file:** If merge operations require fileId, return clear error “No schedule file selected” when fileId and currentFile are both missing.
- **Invalid mergeId:** Return { success: false, message: "Merge not found" }.
- **Invalid assignmentId:** Same for merge-update-subject / merge-remove-subject.

## Failure Scenarios

- Main process throws: Catch in handler; return { success: false, message: error.message } so renderer does not crash.
- Validation or Phase 03 returns error: Forward message to renderer.

## Completion Criteria

- [ ] All merge and merge-subject operations exposed via IPC and preload.
- [ ] unmergeClass removed; deleteMergeClass implemented.
- [ ] Handlers return { success, message?, ... } consistently.
- [ ] Current file / scheduleFileId resolved correctly where needed.
- [ ] No production UI code in this phase; API ready for Phase 06.
