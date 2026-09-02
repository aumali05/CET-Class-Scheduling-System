# Merge Class – Engineering Phases (Planning Only)

This folder contains the **systematic development phases** for the Merge Class feature. Each phase is in a separate markdown file. **No production code is written in this planning stage.**

## Execution order

Phases must be implemented **in numerical order**. Dependencies:

| Phase | Depends on | Delivers |
|-------|------------|----------|
| **01** Schema and migration | — | DB tables and columns; print-file no longer fails |
| **02** Merge validation layer | 01 | Backend conflict checks (all 5 rules) |
| **03** Atomic distribution and merge CRUD | 01, 02 | Create/read/update/delete merge + subject add/update/remove (transactional) |
| **04** IPC handlers and preload | 03 | Renderer API for merge (no unmerge; delete only) |
| **05** Assignments and file lifecycle | 01, 03 | get-assignments merge flags; save-as/delete-file merge handling |
| **06** Merge Class UI | 04, 05 | Full Merge Class page, modals, list, detail |
| **07** Home timetable merge read-only | 05 | Home shows merge slots as read-only, labeled |
| **08** Print, PDF, preview merge | 01, 03 | Merge schedules in print/PDF/preview with distinction |

## Principles

- **Backend-first, validation-first:** Schema and validation before UI.
- **Conflict-safe, atomic-safe:** All merge writes in transactions; validation before every assign/update.
- **UI after core logic:** Merge Class UI (Phase 06) comes after APIs and get-assignments behavior (04, 05).
- **No circular dependencies:** Order above avoids cycles.
- **No mixing UI with domain logic:** Conflict and distribution logic stay in main.js.

## Phase files

- [phase-01-schema-and-migration.md](./phase-01-schema-and-migration.md)
- [phase-02-merge-validation-layer.md](./phase-02-merge-validation-layer.md)
- [phase-03-atomic-distribution-and-merge-crud.md](./phase-03-atomic-distribution-and-merge-crud.md)
- [phase-04-ipc-handlers-and-preload.md](./phase-04-ipc-handlers-and-preload.md)
- [phase-05-assignments-and-file-lifecycle.md](./phase-05-assignments-and-file-lifecycle.md)
- [phase-06-merge-class-ui.md](./phase-06-merge-class-ui.md)
- [phase-07-home-timetable-merge-readonly.md](./phase-07-home-timetable-merge-readonly.md)
- [phase-08-print-pdf-preview-merge.md](./phase-08-print-pdf-preview-merge.md)

## Reference

- Requirements: PROJECT CONTEXT – MERGE CLASS FEATURE; Merge Class Interface and Functionality (PDFs).
- File impact: [MERGE_CLASS_STEP2_FILE_IMPACT_ANALYSIS.md](../MERGE_CLASS_STEP2_FILE_IMPACT_ANALYSIS.md).

---

**Waiting for approval before implementation.** Do not write production code until the phase plan is approved.
