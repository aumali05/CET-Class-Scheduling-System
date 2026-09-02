# STEP 2 – Full Project File Analysis  
## Merge Class Feature – File Impact Map, Dependency Tree, Risk Analysis

**Scope:** Project source only (`src/`, `electron/`). Excludes `node_modules/`, `dist/`, build artifacts.

---

## 1. IDENTIFIED LAYERS AND FILES

### 1.1 Database layer

| File | Role | Merge impact |
|------|------|--------------|
| `electron/main.js` | SQLite init, `CREATE TABLE`, all DB access | **Central:** Schema changes (merge tables + columns on time/room assignments), all merge IPC handlers, transaction/atomic logic |

**Current state:**
- Tables created in `initializeDatabase()`: `users`, `schedule_files`, `teachers`, `programs`, `subjects`, `rooms`, `classes`, `subject_assignments`, `time_assignments`, `room_assignments`.
- **No** `merge_classes` or `merge_class_assignments` table creation.
- **No** `merge_id` or `is_from_merge` on `time_assignments` / `room_assignments`.
- `print-file` already queries `merge_class_assignments` and `merge_classes` → will fail with "no such table" if tables are missing.

### 1.2 Model / data shape (implicit)

- No separate model files. Data shape is implied by DB schema and IPC payloads in `main.js` and by frontend usage in `src/`.
- Merge entities: merge metadata (name, class IDs), merge subject assignments (subject, teacher, room, day, time, merge_id). Distribution writes into existing `time_assignments` / `room_assignments` with `merge_id` + `is_from_merge`.

### 1.3 Schedule / assignment logic

| File | Role | Merge impact |
|------|------|--------------|
| `electron/main.js` | `assign-time-slot`, `assign-room`, `update-time-slot-assignment`, `update-room-assignment`, `delete-assignment`, `get-assignments` | **Must Modify:** get-assignments must return merge-origin flag; assign/update/delete must respect `is_from_merge` (block edit/delete of merge rows from Home path); optional conflict checks here or in dedicated validators. |
| `electron/main.js` | `save-as-file` copy logic | **Must Modify:** Copy merge_classes + merge_class_assignments and, if distributed rows are in time/room_assignments, copy those with same merge_id. |
| `electron/main.js` | `delete-schedule-file` | **Must Modify:** Delete merge_class_assignments and merge_classes (and any merge rows in time/room_assignments) for that file. |

### 1.4 Conflict detection

| File | Role | Merge impact |
|------|------|--------------|
| `electron/main.js` | `assign-time-slot` / `assign-room` | **Currently no conflict checks** (direct INSERT). Merge assignment will need backend validation. |
| `src/pages/Home.jsx` | `conflictModal`, drop logic | Conflict handling exists for UI; backend must enforce merge conflict rules. |
| **New** | Merge validation service / helpers | **Must Create:** Central validation: time slot free in all classes, teacher/room availability, room capacity, multi-merge same-slot. |

### 1.5 UI components

| File | Role | Merge impact |
|------|------|--------------|
| `src/pages/ManageData.jsx` | Tabs: Teachers, Subjects, Rooms, **Classes**, Programs | **Must Modify:** Add “Class” tab dropdown (or equivalent) with “Merge Class” entry → navigate to Merge Class interface. |
| **New** | `src/pages/MergeClass.jsx` (or equivalent) | **Must Create:** Main Merge Class interface (split panel: list + detail). |
| **New** | Merge list / Merge info / Create modal / Assign Subject modal / Subject Info modal / Subject card | **Must Create:** Per spec (MergeClassList, MergeClassInfo, modals, cards). Can be components or sections inside MergeClass.jsx. |
| `src/components/Sidebar.jsx` | Navigation (Data Management → /manage) | **Safe/Unaffected** if entry to Merge is from ManageData Class tab only. Optional: add “Merge Class” under Scheduling Tool. |
| `src/components/Layout.jsx` | Layout wrapper | **Safe/Unaffected** unless Merge needs special layout. |
| `src/components/Modal.jsx` | Generic modal | **Might Refactor:** Reuse for Merge modals if API fits. |
| `src/components/Toolbar.jsx` | Toolbar (file, export, print, etc.) | **Safe/Unaffected** unless Merge needs toolbar actions. |
| `src/components/AssignmentList.jsx` | Assignment list (Assigning) | **Safe/Unaffected** for Merge; Merge has its own list/panel. |

### 1.6 Home timetable (drag-and-drop and read-only merge)

| File | Role | Merge impact |
|------|------|--------------|
| `src/pages/Home.jsx` | Timetable grid, cells, tooltip, edit/remove, drag/drop (pan/drag), `getAssignments` → time/room/subject assignments | **Must Modify:** (1) Load merge flag per assignment (from get-assignments or merged view). (2) For entries with `is_from_merge`: show “Merge Class” label, cursor not-allowed, no click edit/remove, no drag. (3) Optional tooltip: “This schedule is managed in Merge Class [Name]”. |
| `electron/main.js` | `get-assignments` | **Must Modify:** Return time/room rows with `merge_id` / `is_from_merge` (and optionally merge name) so Home can treat them read-only. |

### 1.7 Print / PDF / Preview

| File | Role | Merge impact |
|------|------|--------------|
| `electron/main.js` | `print-file` | **Must Modify:** Already loads merge_class_assignments + merge_classes; use them so merge-originated slots appear in print with optional visual distinction. |
| `electron/main.js` | `export-file` (PDF path) | **Must Modify:** Load merge data and include merge schedules in PDF output with same rules as print. |
| `electron/main.js` | `generate-preview` | **Must Modify:** Load merge data; include merge schedules in preview HTML with visual distinction. |
| `src/pages/View.jsx` | Placeholder “View Page” | **Might Refactor:** If preview is shown here, ensure it receives data that includes merge (backend already returns HTML/data with merge). |
| `src/pages/File.jsx` | File list, export/print triggers | **Safe/Unaffected** unless export/print API contract changes. |

### 1.8 Data services (IPC)

| File | Role | Merge impact |
|------|------|--------------|
| `electron/preload.js` | Exposes `window.api` (merge APIs already stubbed) | **Must Modify:** Align with backend: remove or replace `unmergeClass` (requirements: no unmerge; delete merge only). Add any new channels (e.g. delete-merge-class, merge-subject CRUD). |
| `electron/main.js` | IPC handlers | **Must Create:** Implement: get-all-classes-with-merge-status, get-available-classes-for-merge, create-merged-class, get-merged-class-details, update-merged-class, delete-merge-class (not unmerge). **Must Create:** Merge subject: add/update/delete subject to merge (atomic write to all classes + validation). |

### 1.9 Routing and entry

| File | Role | Merge impact |
|------|------|--------------|
| `src/main.jsx` | Routes (/, /login, /home, /file, /manage, /assign, /view, /accounts, /help, /archive) | **Must Modify:** Add route for Merge Class (e.g. `/manage/merge` or `/merge`) and render Merge Class page. |
| `src/pages/ManageData.jsx` | Class tab, tabs array | **Must Modify:** Class tab → dropdown or button “Merge Class” → navigate to Merge route. |

---

## 2. FILE IMPACT MAP (CATEGORIZED)

### Must Modify

| File | Changes |
|------|--------|
| `electron/main.js` | Schema: create `merge_classes`, `merge_class_assignments`; add `merge_id`, `is_from_merge` to `time_assignments` and `room_assignments`. Implement all merge IPC handlers. Merge validation (time slot, teacher, room, capacity, multi-merge). Atomic distribution (write to all classes in merge). Delete merge: remove only merge-originated rows. get-assignments to return merge flags. save-as-file and delete-schedule-file to handle merge data. export-file and generate-preview to load and output merge. print-file to use merge data correctly. |
| `electron/preload.js` | Replace/remove unmergeClass; expose delete-merge-class and merge subject APIs to match main.js. |
| `src/pages/Home.jsx` | Use merge flags from assignments; render merge slots as read-only with “Merge Class” label, not-allowed cursor, no edit/drag/drop. |
| `src/pages/ManageData.jsx` | Add Class tab dropdown (or link) “Merge Class” → navigate to Merge Class route. |
| `src/main.jsx` | Add route for Merge Class page. |

### Must Create

| File / artifact | Purpose |
|----------------|--------|
| `src/pages/MergeClass.jsx` | Main Merge Class UI: left list, right detail, Create Merge, Add Subject, Subject Info, subject cards, delete confirmations. |
| Merge list component (or section) | Table: Merge Class Name, Students, Classes, Subjects, Action (Remove). |
| Merge detail component (or section) | Merge name, class list, total students, “+ Add Subject”, subject cards with 3-dot (Edit/Delete). |
| Create Merge modal (2-page) | Page 1: class search + checkboxes (min 2). Page 2: merge name, review, Create. |
| Assign Subject modal | Subject search + list with “+” per subject. |
| Subject Info modal | Teacher, Room, Day, Start Time (End Time read-only); Create/Save; validation errors. |
| Backend: merge validation helper | Time slot free in all classes, teacher/room availability, room capacity, multi-merge same-slot. |
| Backend: merge distribution + transaction | Atomic insert/update/delete of time_assignments + room_assignments for all classes in merge with merge_id and is_from_merge. |

### Might Refactor

| File | Reason |
|------|--------|
| `src/components/Modal.jsx` | Reuse for Merge modals if structure fits. |
| `src/pages/View.jsx` | If it becomes the Preview UI, ensure it can show merge (data comes from generate-preview). |
| Conflict checks in `Home.jsx` | If conflict logic is duplicated, consider sharing with backend or a shared validation module (refactor only if needed). |

### Safe / Unaffected

- `src/App.jsx` (default Vite shell; real app is main.jsx).
- `src/pages/Login.jsx`, `Accounts.jsx`, `Help.jsx`, `Archive.jsx`, `File.jsx`, `Splash.jsx`.
- `src/components/Sidebar.jsx`, `Layout.jsx`, `Toolbar.jsx`, `AssignmentList.jsx`.
- `src/pages/Assigning.jsx` (no direct Merge UI; backend merge validation protects overlaps).
- `src/main.jsx` (only add one route).
- `src/index.css`, `App.css`.

---

## 3. DEPENDENCY TREE (LOGICAL)

```
Schema (main.js)
  ├── merge_classes (new)
  ├── merge_class_assignments (new)
  └── time_assignments / room_assignments (+ merge_id, is_from_merge)

Merge validation (main.js)
  └── Depends on: classes, teachers, rooms, subjects, time_assignments, room_assignments, merge_classes, merge_class_assignments

Merge IPC handlers (main.js)
  ├── Depends on: Schema, Merge validation, atomic write
  └── get-assignments depends on: time_assignments, room_assignments (with merge flags)

preload.js
  └── Exposes merge APIs → depends on main.js handlers

MergeClass.jsx (+ subcomponents/modals)
  └── Depends on: window.api (merge + getClasses, getSubjects, getTeachers, getRooms, getCurrentFile, etc.)

ManageData.jsx
  └── Adds “Merge Class” entry → navigates to Merge route (no data dependency on Merge API for initial load)

Home.jsx
  └── Depends on: getAssignments (must include merge_id / is_from_merge)

main.jsx
  └── Adds route → MergeClass.jsx

Print / PDF / Preview (main.js)
  └── Depends on: merge_classes, merge_class_assignments + time/room_assignments (merge_id) to render merge slots
```

**Critical path:** Schema → Merge validation + atomic write → Merge IPC handlers → preload → MergeClass UI. Then get-assignments + Home.jsx for read-only merge; export/print/preview for output.

---

## 4. RISK ANALYSIS

### 4.1 High risk

| Risk | Mitigation |
|------|------------|
| **print-file** (and possibly export) queries non-existent tables today | Create merge tables and optional migration; or guard queries (e.g. try/catch or check table exists) and return empty merge data until feature is implemented. Prefer creating tables in Phase 1. |
| Atomicity: partial write across many classes | Use a single DB transaction for “assign subject to merge” (insert time_assignments + room_assignments for all classes); rollback on any failure or validation failure. |
| Conflict detection incomplete or wrong | Implement all five conflict checks in one place (backend); run before any insert/update; return clear error messages. |
| Home allows editing/deleting merge-originated slots | Backend: reject update/delete of rows with is_from_merge from non-merge callers; frontend: hide edit/remove/drag for those slots. |
| Multi-merge same-slot not blocked | Include in validation: for each class in the merge, check if that class has any other merge’s assignment in the same slot. |

### 4.2 Medium risk

| Risk | Mitigation |
|------|------------|
| save-as-file doesn’t copy merge data | Extend copy logic to merge_classes, merge_class_assignments, and any distributed rows (by merge_id) so copied file has same merge setup. |
| delete-schedule-file leaves merge tables inconsistent | Delete merge_class_assignments and merge_classes for that fileId; delete time_assignments/room_assignments where scheduleFileId = id and is_from_merge = 1 (if stored per-file) or by merge_id linked to that file. |
| Room capacity = sum of class students | Compute total students for merge from class list; filter rooms in Subject Info modal; recheck in backend. |
| Preload exposes unmergeClass but requirement is “no unmerge” | Remove or repurpose: e.g. deleteMergeClass (delete merge entity and all its distributed schedules). |

### 4.3 Lower risk

| Risk | Mitigation |
|------|------------|
| End time = start + (units × 1h) | Subject has `units`; use it in Subject Info modal and in validation. |
| Saturday in day dropdown | Already in spec; ensure backend and UI support Sat. |
| Merge name uniqueness | Decide if required; if yes, add unique check on create/update. |
| Performance with many classes per merge | Batch inserts in one transaction; index merge_id (and scheduleFileId, classId, day, timeSlot) for conflict queries. |

### 4.4 Dependency / integration risks

- **Order of implementation:** Schema and merge handlers must be in place before MergeClass UI; get-assignments and Home changes after backend returns merge flags; print/export/preview after merge data model is stable.
- **Current file context:** Merge is per schedule file (merge_classes / merge_class_assignments tied to scheduleFileId). Ensure current file is set and passed where needed (Create Merge, Add Subject, etc.).

---

## 5. SCHEMA SUMMARY (FOR IMPLEMENTATION)

Recommended additions (to be confirmed in phases):

- **merge_classes:** id, scheduleFileId, name, created_at (and optionally class IDs as JSON or separate table).
- **merge_class_members:** merge_id, class_id (or merge_classes stores class IDs; either way, min 2 classes).
- **merge_class_assignments:** id, merge_id, scheduleFileId, subject_id, teacher_id, room_id, day, time_slot, duration (or equivalent); one row per “subject assignment to merge” (distribution writes to time_assignments/room_assignments).
- **time_assignments:** add `merge_id` (nullable), `is_from_merge` (integer 0/1).
- **room_assignments:** add `merge_id` (nullable), `is_from_merge` (integer 0/1).

Indexes: merge_id on time_assignments and room_assignments; (scheduleFileId, classId, day, timeSlot) for conflict checks.

---

## 6. SUMMARY TABLE

| Category | Count | Files / artifacts |
|----------|--------|--------------------|
| **Must Modify** | 5 | main.js, preload.js, Home.jsx, ManageData.jsx, main.jsx |
| **Must Create** | 8+ | MergeClass.jsx, list/detail/modal components or sections, merge validation, atomic distribution, new IPC handlers |
| **Might Refactor** | 3 | Modal.jsx, View.jsx, conflict logic (if shared) |
| **Safe / Unaffected** | 12+ | Login, Accounts, Help, Archive, File, Splash, Sidebar, Layout, Toolbar, AssignmentList, Assigning, index/App.css, App.jsx |

---

**STEP 2 complete.** No phases created; no code written. Ready for your confirmation to proceed to **STEP 3 – Generate Systematic Engineering Phases** (markdown phase files only).
