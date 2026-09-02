# Phase 06 – Merge Class UI

## Phase Title
**Merge Class: Full interface and user flows**

## Objective
Implement the complete Merge Class interface per the “Merge Class Interface and Functionality” document: entry from Data Management Class tab, split-panel layout, create merge (2-page modal), list and detail panels, add/edit/delete subject (modals and validation feedback), and delete merge. No logic that bypasses backend validation or atomicity.

## Architectural Purpose
- UI is the only place users create/edit/delete merge and merge subjects; all persistence and validation remain in the backend (Phases 02–05).
- Clear separation: Merge Class UI calls window.api merge APIs; no direct conflict logic in UI beyond displaying backend error messages.
- Entry point: Class tab in Data Management (ManageData) with “Merge Class” option → navigate to Merge Class page.

## Technical Scope

### Routing and entry

- **main.jsx:** Add route, e.g. `/manage/merge` or `/merge`, rendering the Merge Class page component (e.g. MergeClass).
- **ManageData.jsx:** On the “Classes” tab, add a dropdown or link “Merge Class” that navigates to that route (e.g. useNavigate to `/manage/merge`). Ensure Classes tab is clearly the “Class” tab per spec; dropdown shows “Merge Class” as option.

### Merge Class page (e.g. MergeClass.jsx)

- **Layout:** Left panel ~65% (merge list table), right panel ~35% (hidden by default; shown when a merge is selected). “Create Merge” button prominent when no merge selected or always visible as specified.
- **State:** Current file (from getCurrentFile()); merge list (from getMergeList(fileId)); selected merge id; merge details (from getMergedClassDetails(mergeId)); loading and error states.
- **Left panel – Merge Class List table:**
  - Columns: Merge Class Name, Students (sum), Classes (count), Subjects (count), Action (Remove icon).
  - Rows: one per merge for current file. Click row selects merge and opens right panel.
  - Remove icon opens delete confirmation dialog; on confirm call deleteMergeClass(mergeId).
- **Right panel – Merge Class Info:**
  - Header: Merge name, list of class names, total students.
  - “+ Add Subject” button.
  - Subject cards: each shows subject name, teacher, room, schedule (day, time). 3-dot menu: Edit, Delete. Delete shows confirmation (“Remove [Subject] from all classes in this merge?” etc.); on confirm call mergeRemoveSubject.
  - Empty state when no subjects: placeholder and prompt to add.

### Create Merge modal (2-page)

- **Page 1:** Search bar (filter classes by name). List of classes (from getAvailableClassesForMerge) with checkboxes. Min 2 classes required. “Next” (>) to go to Page 2.
- **Page 2:** Merge Class Name input. Summary of selected classes (name, program, year level, students); each with “X” to remove from selection (if remaining ≥ 2). Total students displayed. “Back” (<) to Page 1 (selections preserved). “Create” button: disabled if < 2 classes; on click call createMergedClass({ name, classIds, scheduleFileId }). On success close modal and refresh merge list; optionally select new merge.
- **Validation:** Name required; classIds.length >= 2. Backend returns error if invalid; show message.

### Assign Subject flow

- **“+ Add Subject”** opens “Assign Subject” modal: search subjects (from getSubjects), list with “+” per subject. Click “+” closes this modal and opens “Subject Info” modal for that subject.
- **Subject Info modal (create mode):** Title = subject name (read-only). Fields: Teacher (dropdown, getTeachers), Room (dropdown filtered by capacity ≥ total students of merge), Day (Mon–Sat), Start Time (e.g. 7:00 AM–6:00 PM, 30-min steps). End Time read-only = Start Time + (subject units × 1 hour). “Create” button. On submit call mergeAddSubject with chosen teacher, room, day, timeSlot (derived from start + duration), duration. On validation error from backend: keep modal open, show error message at top (red banner). On success: close modal, refresh merge details, show new subject card.
- **Subject Info modal (edit mode):** Same fields pre-filled from selected subject assignment. “Save” instead of “Create”. On submit call mergeUpdateSubject. Same error handling; on success refresh details and update card.

### Delete confirmations

- **Delete subject:** “Remove [Subject Name] from all classes in this merge?” “This will remove [N] schedule entries from [X] classes.” Buttons: Cancel, Delete. On Delete call mergeRemoveSubject; then refresh.
- **Delete merge:** “Delete Merge Class '[Name]'?” “This will remove [N] subject assignments from [X] classes.” “This action cannot be undone.” Buttons: Cancel, Delete. On Delete call deleteMergeClass; close right panel or select next merge; refresh list.

### Room capacity filter

- Total students of merge = sum of classes’ students (from merge details). In Subject Info modal, room dropdown shows only rooms where room.capacity >= totalStudents. Backend still rechecks (Phase 02).

### Time and units

- Start time options per spec (e.g. 7:00 AM to 6:00 PM, 30-min). End time = start + (subject.units × 60) minutes; display as read-only. Send timeSlot and duration to API in the format backend expects.

### Panel resize behavior

- When right panel is visible, left panel width reduces; horizontal scroll on table if needed. Right panel scrolls vertically if many subjects. Per spec.

## Files Affected

| File | Action |
|------|--------|
| `src/main.jsx` | Add route for Merge Class page. |
| `src/pages/ManageData.jsx` | Add “Merge Class” entry on Classes tab (dropdown or button) → navigate to Merge route. |
| **New** `src/pages/MergeClass.jsx` | Main page: layout, merge list, merge detail, Create Merge modal (2-page), Assign Subject modal, Subject Info modal (create/edit), subject cards, delete confirmations. Can split into subcomponents (e.g. MergeClassList.jsx, MergeClassInfo.jsx, modals) if preferred. |
| `src/components/Modal.jsx` | Reuse if API fits (title, children, onClose); otherwise use local modal markup. |

## Data Layer Impact

- None directly; all data changes via IPC (Phase 04).

## Validation Layer Impact

- UI does not implement conflict logic; it displays backend validation errors only.

## UI Layer Impact

- New page and modals; ManageData gains one entry point. No change to Home or Assigning in this phase.

## Testing Strategy

- Navigate from ManageData Classes → Merge Class; page loads with current file’s merge list (or empty).
- Create merge: select 2+ classes, name, Create; row appears; select it and right panel shows empty subjects.
- Add subject: choose subject, teacher, room, day, time; Create; subject card appears; if backend returns conflict, error shows and modal stays open.
- Edit subject: change time/room/teacher; Save; card updates; conflict error handled.
- Remove subject: Delete from 3-dot; confirm; card disappears.
- Delete merge: Remove icon; confirm; merge row and right panel update.
- Room dropdown: only rooms with capacity >= total students. No current file: show message or disable create.

## Edge Case Handling

- **No file selected:** Show message “Please select a schedule file” and disable Create Merge or show empty list.
- **Back in Create modal:** Selections and name preserved when moving Page 2 → Page 1.
- **Create button:** Disabled when class count < 2; enabled when >= 2.
- **Right panel when deleted merge was selected:** Hide right panel or auto-select next merge in list.

## Failure Scenarios

- API failure: Show toast or inline error; do not close modal on validation failure.
- Network/IPC error: Generic error message; retry or cancel.

## Completion Criteria

- [ ] Route and entry from Class tab to Merge Class page implemented.
- [ ] Merge list and detail panels match spec (columns, layout, subject cards, 3-dot menu).
- [ ] Create Merge 2-page modal works; min 2 classes; Create calls API and refreshes list.
- [ ] Assign Subject and Subject Info modals work; validation errors shown; success refreshes detail.
- [ ] Edit and Delete subject with confirmations; Delete merge with confirmation.
- [ ] Room dropdown filtered by capacity; End Time computed from units.
- [ ] All merge operations go through window.api; no direct DB or conflict logic in UI.
