const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("api", {
  login: (data) => ipcRenderer.invoke("login", data),
  newScheduleFile: (data) => ipcRenderer.invoke("new-schedule-file", data),
  getCurrentFile: () => ipcRenderer.invoke("get-current-file"),
  saveFile: (data) => ipcRenderer.invoke("save-file", data),
  saveAsFile: (data) => ipcRenderer.invoke("save-as-file", data),
  exportFile: (args) => ipcRenderer.invoke("export-file", args),
  exportExcel: (args) => ipcRenderer.invoke("export-excel", args),
  printFile: (args) => ipcRenderer.invoke("print-file", args),
  generatePreview: (data) => ipcRenderer.invoke("generate-preview", data),
  getAllScheduleFiles: () => ipcRenderer.invoke("get-all-schedule-files"),
  deleteScheduleFile: (id) => ipcRenderer.invoke("delete-schedule-file", id),
  archiveScheduleFile: (id) => ipcRenderer.invoke("archive-schedule-file", id),
  unarchiveScheduleFile: (id) => ipcRenderer.invoke("unarchive-schedule-file", id),
  setCurrentFile: (file) => ipcRenderer.invoke("set-current-file", file),
  closeCurrentFile: (fileId) => ipcRenderer.invoke("close-current-file", fileId),

  getTeachers: () => ipcRenderer.invoke("get-teachers"),
  saveTeacher: (data) => ipcRenderer.invoke("save-teacher", data),
  deleteTeacher: (id) => ipcRenderer.invoke("delete-teacher", id),

  getTeacherAvailability: (teacherId) => ipcRenderer.invoke("get-teacher-availability", teacherId),
  addTeacherAvailability: (payload) => ipcRenderer.invoke("add-teacher-availability", payload),
  setTeacherFullDayAvailability: (payload) => ipcRenderer.invoke("set-teacher-full-day-availability", payload),
  deleteTeacherAvailability: (id) => ipcRenderer.invoke("delete-teacher-availability", id),

  getSubjects: () => ipcRenderer.invoke("get-subjects"),
  saveSubject: (data) => ipcRenderer.invoke("save-subject", data),
  deleteSubject: (id) => ipcRenderer.invoke("delete-subject", id),

  getRooms: () => ipcRenderer.invoke("get-rooms"),
  saveRoom: (data) => ipcRenderer.invoke("save-room", data),
  deleteRoom: (id) => ipcRenderer.invoke("delete-room", id),

  getClasses: () => ipcRenderer.invoke("get-classes"),
  saveClass: (data) => ipcRenderer.invoke("save-class", data),
  deleteClass: (id) => ipcRenderer.invoke("delete-class", id),

  getPrograms: () => ipcRenderer.invoke("get-programs"),
  saveProgram: (data) => ipcRenderer.invoke("save-program", data),
  deleteProgram: (id) => ipcRenderer.invoke("delete-program", id),

  getAssignments: (fileId) => ipcRenderer.invoke("get-assignments", fileId),
  assignTeacherToSubject: (data) => ipcRenderer.invoke("assign-teacher-to-subject", data),
  assignTimeSlot: (data) => ipcRenderer.invoke("assign-time-slot", data),
  assignRoom: (data) => ipcRenderer.invoke("assign-room", data),
  deleteAssignment: (id) => ipcRenderer.invoke("delete-assignment", id),
  updateTeacherSubjectAssignment: (data) => ipcRenderer.invoke("update-teacher-subject-assignment", data),
  updateTimeSlotAssignment: (data) => ipcRenderer.invoke("update-time-slot-assignment", data),
  updateRoomAssignment: (data) => ipcRenderer.invoke("update-room-assignment", data),

  getUsers: () => ipcRenderer.invoke("get-users"),
  saveUser: (data) => ipcRenderer.invoke("save-user", data),
  deleteUser: (id) => ipcRenderer.invoke("delete-user", id),

  reloadWindow: () => ipcRenderer.invoke("reload-window"),

  getMergeList: (fileId) => ipcRenderer.invoke("get-merge-list", fileId),
  getAvailableClassesForMerge: () => ipcRenderer.invoke("get-available-classes-for-merge"),
  createMergedClass: (data) => ipcRenderer.invoke("create-merged-class", data),
  getMergedClassDetails: (mergeId) => ipcRenderer.invoke("get-merged-class-details", mergeId),
  updateMergedClass: (data) => ipcRenderer.invoke("update-merged-class", data),
  deleteMergeClass: (mergeId) => ipcRenderer.invoke("delete-merge-class", mergeId),
  mergeAddSubject: (data) => ipcRenderer.invoke("merge-add-subject", data),
  mergeUpdateSubject: (data) => ipcRenderer.invoke("merge-update-subject", data),
  mergeRemoveSubject: (data) => ipcRenderer.invoke("merge-remove-subject", data),

  // Expose utility functions
  parseClockToMinutes: (clock) => parseClockToMinutes(clock),
  minutesToClock: (mins) => minutesToClock(mins),
})

function parseClockToMinutes(clock) {
  if (!clock) return null;
  const m = clock.trim().match(/^(\d{1,2}):?(\d{2})?\s*([AaPp][Mm])$/);
  if (!m) return null;
  let hh = Number.parseInt(m[1], 10);
  const mm = Number.parseInt(m[2] || "00", 10);
  const ampm = m[3].toUpperCase();
  if (hh === 12) hh = 0;
  if (ampm === "PM") hh += 12;
  return hh * 60 + mm;
}

function minutesToClock(mins) {
  mins = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  let hh = Math.floor(mins / 60);
  const mm = mins % 60;
  const ampm = hh >= 12 ? "PM" : "AM";
  if (hh === 0) hh = 12;
  else if (hh > 12) hh -= 12;
  return `${hh}:${mm.toString().padStart(2, "0")} ${ampm}`;
}