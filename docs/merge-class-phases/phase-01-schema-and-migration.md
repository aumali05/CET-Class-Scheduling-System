# Phase 01 – Schema and Migration

## Phase Title
**Merge Class: Database schema and safe migration**

## Objective
Introduce all database structures required for Merge Class without breaking existing flows. Ensure `print-file` and any code that references merge tables no longer fails when tables are missing.

## Architectural Purpose
- Establish source of truth for merge metadata and merge–class membership.
- Add columns to existing assignment tables so distributed merge schedules are identifiable and deletable without touching manual schedules.
- Keep schema backward-compatible: existing rows get default values for new columns; new columns nullable where appropriate.

## Technical Scope

### New tables (in `initializeDatabase()` or equivalent migration block)

1. **merge_classes**
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT
   - `scheduleFileId` INTEGER NOT NULL REFERENCES schedule_files(id)
   - `name` TEXT NOT NULL
   - `createdAt` TEXT (optional, for auditing)
   - Purpose: One row per merge group; name and file scope.

2. **merge_class_members**
   - `id` INTEGER PRIMARY KEY AUTOINCREMENT (or composite PK)
   - `mergeId` INTEGER NOT NULL REFERENCES merge_classes(id)
   - `classId` INTEGER NOT NULL REFERENCES classes(id)
   - UNIQUE(mergeId, classId)
   - Purpose: Which classes belong to which merge (min 2 per merge).

3. **merge_class_assignments**
   - `id` TEXT PRIMARY KEY (e.g. UUID)
   - `mergeId` INTEGER NOT NULL REFERENCES merge_classes(id)
   - `scheduleFileId` INTEGER NOT NULL REFERENCES schedule_files(id)
   - `subjectId` INTEGER NOT NULL REFERENCES subjects(id)
   - `teacherId` INTEGER NOT NULL REFERENCES teachers(id)
   - `roomId` INTEGER NOT NULL REFERENCES rooms(id)
   - `day` TEXT NOT NULL (e.g. Mon, Tue, … Sat)
   - `timeSlot` TEXT NOT NULL (e.g. "8:00 AM - 11:00 AM")
   - `duration` INTEGER NOT NULL (minutes)
   - Purpose: One row per “subject assigned to this merge”; physical distribution is in time_assignments/room_assignments.

### Alter existing tables

4. **time_assignments**
   - ADD COLUMN `merge_id` INTEGER NULL REFERENCES merge_classes(id)
   - ADD COLUMN `is_from_merge` INTEGER DEFAULT 0 (0 = false, 1 = true)
   - Use `ALTER TABLE ... ADD COLUMN` with ignore for “duplicate column” so existing DBs stay valid.

5. **room_assignments**
   - ADD COLUMN `merge_id` INTEGER NULL REFERENCES merge_classes(id)
   - ADD COLUMN `is_from_merge` INTEGER DEFAULT 0

### Indexes (for performance and conflict checks)

- `time_assignments`: index on (scheduleFileId, classId, day, timeSlot); index on merge_id.
- `room_assignments`: index on (scheduleFileId, classId); index on merge_id.
- `merge_class_members`: index on mergeId; index on classId (for “which merges include this class”).
- `merge_class_assignments`: index on mergeId; index on scheduleFileId.

### Defensive handling for existing code

- **print-file:** If it currently queries `merge_class_assignments` and `merge_classes`, either:
  - Ensure tables exist before that code path runs (this phase), or
  - Wrap those queries in a check/try that returns empty arrays when tables do not exist (short-term guard only; Phase 01 should make tables exist).

## Files Affected

| File | Action |
|------|--------|
| `electron/main.js` | Add CREATE TABLE for merge_classes, merge_class_members, merge_class_assignments; add ALTER TABLE for time_assignments and room_assignments; add indexes. Run in same serialized init or migration block as existing schema. |

## Data Layer Impact

- New tables: merge_classes, merge_class_members, merge_class_assignments.
- time_assignments and room_assignments gain merge_id and is_from_merge; all existing rows remain valid (nullable/default).
- No change to existing CRUD for non-merge assignments in this phase; only schema is added.

## Validation Layer Impact

- None in this phase. Validation logic is Phase 02.

## UI Layer Impact

- None. No UI changes in this phase.

## Testing Strategy

- Unit/integration: After app start, verify all new tables exist and new columns exist on time_assignments and room_assignments.
- Verify existing get-assignments, assign-time-slot, assign-room, print-file (if it already queried merge tables) run without error on a DB that had no merge tables before (migration path).
- Verify existing schedule file with time/room assignments still loads and displays.

## Edge Case Handling

- **Existing SQLite DB:** Use ALTER TABLE with error handling for “duplicate column name”; ignore that error so re-run is safe.
- **Fresh install:** All CREATE TABLE and ALTER TABLE run; no merge data yet.
- **print-file:** Once tables exist, queries return [] until merge feature is used; print output should remain correct for non-merge schedules.

## Failure Scenarios

- Migration fails mid-way: Document rollback (e.g. drop new tables, remove new columns if supported). Prefer running schema in a single serialized block so partial state is avoided.
- Disk full during ALTER: Handle DB errors; do not leave app in broken state (log and surface error).

## Completion Criteria

- [ ] merge_classes, merge_class_members, merge_class_assignments tables exist after app init.
- [ ] time_assignments has merge_id and is_from_merge; room_assignments has merge_id and is_from_merge.
- [ ] Indexes created as specified.
- [ ] Existing flows (open file, view assignments, print without merge data) work unchanged.
- [ ] print-file runs without “no such table” errors.
