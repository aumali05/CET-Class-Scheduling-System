const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const fs = require("fs");
// const isDev = require("electron-is-dev");

const sqlite3 = require("sqlite3").verbose();
const { v4: uuidv4 } = require("uuid");

const ExcelJS = require("exceljs");

let mainWindow;
let db;
let currentFile = null;
const openFiles = new Map();

// ---------------- EXPORT / PRINT / PREVIEW STYLE ----------------
const DEFAULT_EXPORT_STYLE = Object.freeze({
  showCellBackground: true,
  cellBgOpacity: 0.3,
  headerBg: "#40C477",
  headerAltEnabled: false,
  headerBgAlt: "#FACC15",
  teacherTextColor: "#000000",
  timeTextColor: "#000000",
  roomTextColor: "#000000",
  teacherTextBold: false,
  timeTextBold: false,
  roomTextBold: false,
  gridLineWidth: 2,
  gridLineOpacity: 1,
  paperSize: "A4", // A4 | Letter | Legal
  tablesPerPage: 1, // 1 | 2
  showMergeClassLabel: true,
  preparedByName: "ENGR. REYNALDO C. DIMAYACYAC",
  preparedByRole: "Dean, College of Engineering Technology",
  approvedByName: "DR. CRISTITA B. TAN",
  approvedByRole: "VPAA",
  signatureAlign: "center", // left | center | right
  orientation: "landscape", // portrait | landscape
});

function clampNumber(n, min, max, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function normalizeExportStyle(input) {
  const s = { ...DEFAULT_EXPORT_STYLE, ...(input || {}) };
  const orientation = ["portrait", "landscape"].includes(s.orientation) ? s.orientation : DEFAULT_EXPORT_STYLE.orientation;
  const maxTables = orientation === "portrait" ? 3 : 2;
  const tablesPerPage = clampNumber(s.tablesPerPage, 1, maxTables, DEFAULT_EXPORT_STYLE.tablesPerPage);
  return {
    showCellBackground: Boolean(s.showCellBackground),
    cellBgOpacity: clampNumber(s.cellBgOpacity, 0, 1, DEFAULT_EXPORT_STYLE.cellBgOpacity),
    headerBg: typeof s.headerBg === "string" && s.headerBg.trim() ? s.headerBg.trim() : DEFAULT_EXPORT_STYLE.headerBg,
    headerAltEnabled: Boolean(s.headerAltEnabled),
    headerBgAlt: typeof s.headerBgAlt === "string" && s.headerBgAlt.trim() ? s.headerBgAlt.trim() : DEFAULT_EXPORT_STYLE.headerBgAlt,
    teacherTextColor:
      typeof s.teacherTextColor === "string" && s.teacherTextColor.trim() ? s.teacherTextColor.trim() : DEFAULT_EXPORT_STYLE.teacherTextColor,
    timeTextColor: typeof s.timeTextColor === "string" && s.timeTextColor.trim() ? s.timeTextColor.trim() : DEFAULT_EXPORT_STYLE.timeTextColor,
    roomTextColor: typeof s.roomTextColor === "string" && s.roomTextColor.trim() ? s.roomTextColor.trim() : DEFAULT_EXPORT_STYLE.roomTextColor,
    teacherTextBold: Boolean(s.teacherTextBold),
    timeTextBold: Boolean(s.timeTextBold),
    roomTextBold: Boolean(s.roomTextBold),
    gridLineWidth: clampNumber(s.gridLineWidth, 0, 6, DEFAULT_EXPORT_STYLE.gridLineWidth),
    gridLineOpacity: clampNumber(s.gridLineOpacity, 0, 1, DEFAULT_EXPORT_STYLE.gridLineOpacity),
    paperSize: ["A4", "Letter", "Legal"].includes(s.paperSize) ? s.paperSize : DEFAULT_EXPORT_STYLE.paperSize,
    tablesPerPage,
    showMergeClassLabel: Boolean(s.showMergeClassLabel),
    preparedByName: String(s.preparedByName ?? ""),
    preparedByRole: String(s.preparedByRole ?? ""),
    approvedByName: String(s.approvedByName ?? ""),
    approvedByRole: String(s.approvedByRole ?? ""),
    signatureAlign: ["left", "center", "right"].includes(s.signatureAlign) ? s.signatureAlign : DEFAULT_EXPORT_STYLE.signatureAlign,
    orientation,
  };
}

function makeNextHeaderTableClass(style) {
  let idx = 0;
  return () => {
    if (!style?.headerAltEnabled) return "";
    const isAlt = (idx % 2) === 1;
    idx += 1;
    return isAlt ? "hdr-alt" : "";
  };
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toHtmlLines(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/\r?\n/g, "<br>");
}

function signatureHtml(style) {
  const preparedName = toHtmlLines(style.preparedByName);
  const preparedRole = toHtmlLines(style.preparedByRole);
  const approvedName = toHtmlLines(style.approvedByName);
  const approvedRole = toHtmlLines(style.approvedByRole);
  const signLineMargin =
    style.signatureAlign === "left"
      ? "30px 0 5px 0"
      : style.signatureAlign === "right"
        ? "30px 0 5px auto"
        : "30px auto 5px auto";

  const preparedBlock = preparedRole
    ? `${preparedName}<br>${preparedRole}`
    : preparedName;
  const approvedBlock = approvedRole
    ? `${approvedName}<br>${approvedRole}`
    : approvedName;

  return `<div class="sign-section"><div class="sign-block">Prepared by:<div class="sign-line" style="margin:${signLineMargin};"></div><div class="sign-names">${preparedBlock}</div></div><div class="sign-block">Approved by:<div class="sign-line" style="margin:${signLineMargin};"></div><div class="sign-names">${approvedBlock}</div></div></div>`;
}

function computeDocumentZoom(style) {
  const perPage = style.tablesPerPage;
  if (style.orientation === "portrait") {
    if (perPage === 3) return 0.62;
    if (perPage === 2) return 0.72;
    return 0.92;
  }
  if (perPage === 2) return 0.78;
  return 1.0;
}

function mergeLabelHtml(style, assignment) {
  if (!style.showMergeClassLabel) return "";
  if (assignment?.is_from_merge !== 1) return "";
  return ' <span style="font-size:9px;color:#b45309">(Merge Class)</span>';
}

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

// ---------------- DATABASE ----------------
function initializeDatabase() {
  db = new sqlite3.Database(path.join(app.getPath("userData"), "app.db"), (err) => {
    if (err) console.error("DB Error:", err.message);
    else console.log("SQLite DB ready");
  });



  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      password TEXT,
      role TEXT DEFAULT 'user'
    )`);

    db.get(`SELECT * FROM users WHERE username=?`, ["admin"], (err, row) => {
      if (!row) {
        ``
        db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, ["admin", "admin123", "admin"]);
        console.log("Default admin user created");
      }
    });

    db.get(`SELECT * FROM users WHERE username=?`, ["user"], (err, row) => {
      if (!row) {
        db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, ["user", "user123", "user"]);
        console.log("Default user account created");
      }
    });

    db.get(`SELECT * FROM users WHERE username=?`, ["user"], (err, row) => {
      if (!row) {
        db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, ["userview", "view123", "view"]);
        console.log("Viewer account created");
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS schedule_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      semester TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL UNIQUE,
      honorifics TEXT,
      color TEXT NOT NULL UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS teacher_time_availability (
      id TEXT PRIMARY KEY,
      teacherId INTEGER NOT NULL,
      day TEXT NOT NULL,
      startMin INTEGER NOT NULL,
      endMin INTEGER NOT NULL,
      CHECK (endMin > startMin),
      FOREIGN KEY(teacherId) REFERENCES teachers(id)
    )`);
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_teacher_time_availability_teacher_day ON teacher_time_availability(teacherId, day)`
    );
    // Migration: older "full-day" availability ended at 7:30 PM; extend to 10:30 PM.
    // (Old UI capped availability at 7:30 PM, so 7:00 AM–7:30 PM was effectively "full day".)
    db.run(
      `UPDATE teacher_time_availability
       SET endMin = ?
       WHERE startMin = ? AND endMin = ?`,
      [22 * 60 + 30, 7 * 60, 19 * 60 + 30],
      (err) => {
        if (err) console.error("teacher_time_availability migration:", err.message);
      }
    );

    db.run(`CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      years INTEGER NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      units INTEGER NOT NULL,
      semester TEXT,
      programId INTEGER,
      yearLevel TEXT,
      FOREIGN KEY (programId) REFERENCES programs(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      students INTEGER NOT NULL,
      programId INTEGER NOT NULL,
      yearLevel TEXT NOT NULL,
      FOREIGN KEY (programId) REFERENCES programs(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS subject_assignments (
      id TEXT PRIMARY KEY,
      scheduleFileId INTEGER,
      subjectId INTEGER,
      teacherId INTEGER,
      FOREIGN KEY(scheduleFileId) REFERENCES schedule_files(id),
      FOREIGN KEY(subjectId) REFERENCES subjects(id),
      FOREIGN KEY(teacherId) REFERENCES teachers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS time_assignments (
      id TEXT PRIMARY KEY,
      scheduleFileId INTEGER,
      subjectId INTEGER,
      teacherId INTEGER,
      classId INTEGER,
      day TEXT,
      timeSlot TEXT,
      duration INTEGER,
      FOREIGN KEY(scheduleFileId) REFERENCES schedule_files(id),
      FOREIGN KEY(subjectId) REFERENCES subjects(id),
      FOREIGN KEY(teacherId) REFERENCES teachers(id),
      FOREIGN KEY(classId) REFERENCES classes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS room_assignments (
      id TEXT PRIMARY KEY,
      scheduleFileId INTEGER,
      subjectId INTEGER,
      teacherId INTEGER,
      classId INTEGER,
      roomId INTEGER,
      FOREIGN KEY(scheduleFileId) REFERENCES schedule_files(id),
      FOREIGN KEY(subjectId) REFERENCES subjects(id),
      FOREIGN KEY(teacherId) REFERENCES teachers(id),
      FOREIGN KEY(classId) REFERENCES classes(id),
      FOREIGN KEY(roomId) REFERENCES rooms(id)
    )`);

    db.run(`ALTER TABLE time_assignments ADD COLUMN teacherId INTEGER REFERENCES teachers(id)`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error("Error adding teacherId to time_assignments:", err.message);
      }
    });
    db.run(`ALTER TABLE room_assignments ADD COLUMN teacherId INTEGER REFERENCES teachers(id)`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error("Error adding teacherId to room_assignments:", err.message);
      }
    });

    // ---------------- MERGE CLASS (Phase 01) ----------------
    db.run(`CREATE TABLE IF NOT EXISTS merge_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheduleFileId INTEGER NOT NULL,
      name TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(scheduleFileId) REFERENCES schedule_files(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS merge_class_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mergeId INTEGER NOT NULL,
      classId INTEGER NOT NULL,
      UNIQUE(mergeId, classId),
      FOREIGN KEY(mergeId) REFERENCES merge_classes(id),
      FOREIGN KEY(classId) REFERENCES classes(id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS merge_class_assignments (
      id TEXT PRIMARY KEY,
      mergeId INTEGER NOT NULL,
      scheduleFileId INTEGER NOT NULL,
      subjectId INTEGER NOT NULL,
      teacherId INTEGER NOT NULL,
      roomId INTEGER NOT NULL,
      day TEXT NOT NULL,
      timeSlot TEXT NOT NULL,
      duration INTEGER NOT NULL,
      FOREIGN KEY(mergeId) REFERENCES merge_classes(id),
      FOREIGN KEY(scheduleFileId) REFERENCES schedule_files(id),
      FOREIGN KEY(subjectId) REFERENCES subjects(id),
      FOREIGN KEY(teacherId) REFERENCES teachers(id),
      FOREIGN KEY(roomId) REFERENCES rooms(id)
    )`);
    db.run(`ALTER TABLE time_assignments ADD COLUMN merge_id INTEGER REFERENCES merge_classes(id)`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error("Error adding merge_id to time_assignments:", err.message);
      }
    });
    db.run(`ALTER TABLE time_assignments ADD COLUMN is_from_merge INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error("Error adding is_from_merge to time_assignments:", err.message);
      }
    });
    db.run(`ALTER TABLE room_assignments ADD COLUMN merge_id INTEGER REFERENCES merge_classes(id)`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error("Error adding merge_id to room_assignments:", err.message);
      }
    });
    db.run(`ALTER TABLE room_assignments ADD COLUMN is_from_merge INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error("Error adding is_from_merge to room_assignments:", err.message);
      }
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_time_assignments_merge_id ON time_assignments(merge_id)`, (err) => {
      if (err) console.error("Error creating index on time_assignments(merge_id):", err.message);
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_time_assignments_schedule_class_day_slot ON time_assignments(scheduleFileId, classId, day, timeSlot)`, (err) => {
      if (err) console.error("Error creating index on time_assignments:", err.message);
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_room_assignments_merge_id ON room_assignments(merge_id)`, (err) => {
      if (err) console.error("Error creating index on room_assignments(merge_id):", err.message);
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_merge_class_members_mergeId ON merge_class_members(mergeId)`, (err) => {
      if (err) console.error("Error creating index on merge_class_members:", err.message);
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_merge_class_members_classId ON merge_class_members(classId)`, (err) => {
      if (err) console.error("Error creating index on merge_class_members:", err.message);
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_merge_class_assignments_mergeId ON merge_class_assignments(mergeId)`, (err) => {
      if (err) console.error("Error creating index on merge_class_assignments:", err.message);
    });
    db.run(`CREATE INDEX IF NOT EXISTS idx_merge_class_assignments_scheduleFileId ON merge_class_assignments(scheduleFileId)`, (err) => {
      if (err) console.error("Error creating index on merge_class_assignments:", err.message);
    });

  });
}

// ---------------- MAIN WINDOW ----------------
function createMainWindow() {
  const isDev = !app.isPackaged;
  console.log("isDev:", isDev);
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Class Scheduling System",
    icon: path.join(__dirname, "../build/app-icon.ico"), // ✅ Use the .ico inside /build for Windows
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // ✅ Correct path logic for dev and production
  const startUrl = isDev
    ? (process.env.ELECTRON_START_URL || "http://localhost:5173")
    : `file://${path.join(__dirname, "../dist/index.html")}`;

  mainWindow.loadURL(startUrl);

  // ✅ Optional hash routing fix (React Router)
  // If you use React Router’s HashRouter, no change needed
  // If you use BrowserRouter, remove "#/" completely in both cases

  // ✅ Show window only when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // ✅ Optional: open DevTools only in dev mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// ---------------- IPC HANDLERS ----------------
ipcMain.handle("login", (event, { username, password }) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM users WHERE username=? AND password=?`, [username, password], (err, row) => {
      if (err) {
        console.error("Login error:", err.message);
        reject(err.message);
      } else if (row) {
        resolve({ success: true, message: "Login success!", role: row.role, username: row.username });
      } else {
        resolve({ success: false, message: "Invalid username or password" });
      }
    });
  });
});

ipcMain.handle("unarchive-schedule-file", (event, id) => {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE schedule_files SET status='active', updatedAt=? WHERE id=?`,
      [new Date().toISOString(), id],
      (err) => {
        if (err) {
          console.error("Unarchive file error:", err.message);
          reject(err.message);
          return;
        }
        resolve({ success: true, message: "File unarchived!" });
      },
    );
  });
});

ipcMain.handle("new-schedule-file", (event, { name, academic_year, semester }) => {
  return new Promise((resolve, reject) => {
    if (!name?.trim() || !academic_year?.trim() || !semester?.trim()) {
      resolve({ success: false, message: "All fields are required" });
      return;
    }
    db.get(
      `SELECT * FROM schedule_files WHERE name=? AND academic_year=? AND semester=? AND status='active'`,
      [name.trim(), academic_year.trim(), semester.trim()],
      (err, row) => {
        if (err) {
          console.error("Database error checking for duplicates:", err.message);
          reject(err.message);
          return;
        }
        if (row) {
          resolve({ success: false, message: "Duplicate file details. Choose unique details." });
          return;
        }
        db.run(
          `INSERT INTO schedule_files (name, academic_year, semester, updatedAt) VALUES (?, ?, ?, ?)`,
          [name.trim(), academic_year.trim(), semester.trim(), new Date().toISOString()],
          function (err) {
            if (err) {
              console.error("Database error creating new file:", err.message);
              reject(err.message);
              return;
            }
            const newFile = { id: this.lastID, name: name.trim(), academic_year: academic_year.trim(), semester: semester.trim(), updatedAt: new Date().toISOString() };
            openFiles.set(this.lastID, newFile);
            resolve({ success: true, message: "New file created!", id: this.lastID, file: newFile });
          }
        );
      }
    );
  });
});

ipcMain.handle("set-current-file", (event, file) => {
  currentFile = file || null;
  console.log("Main: Current file is now:", currentFile?.name || "none");
  return { success: true };
});

ipcMain.handle("get-current-file", () => {
  const result = currentFile ? { files: [currentFile] } : { files: [] };
  // console.log("Main: get-current-file returning:", result);
  return result;
});

ipcMain.handle("close-current-file", (event, fileId) => {
  if (openFiles.has(fileId)) {
    openFiles.delete(fileId);
    return { success: true, message: "File closed" };
  }
  return { success: false, message: "File not found" };
});

ipcMain.handle("save-file", (event, { id, name, academic_year, semester }) => {
  return new Promise((resolve, reject) => {
    if (!id || !name?.trim() || !academic_year?.trim() || !semester?.trim()) {
      resolve({ success: false, message: "All fields are required" });
      return;
    }
    db.run(
      `UPDATE schedule_files SET name=?, academic_year=?, semester=?, updatedAt=? WHERE id=?`,
      [name.trim(), academic_year.trim(), semester.trim(), new Date().toISOString(), id],
      (err) => {
        if (err) {
          console.error("Save file error:", err.message);
          reject(err.message);
          return;
        }
        const updatedFile = { id, name: name.trim(), academic_year: academic_year.trim(), semester: semester.trim(), updatedAt: new Date().toISOString() };
        openFiles.set(id, updatedFile);
        resolve({ success: true, message: "File saved!", file: updatedFile });
      }
    );
  });
});

ipcMain.handle("save-as-file", (event, { fileId, name, academic_year, semester }) => {
  return new Promise((resolve, reject) => {
    if (!name?.trim() || !academic_year?.trim() || !semester?.trim()) {
      resolve({ success: false, message: "All fields are required" });
      return;
    }
    db.get(
      `SELECT * FROM schedule_files WHERE name=? AND academic_year=? AND semester=? AND status='active'`,
      [name.trim(), academic_year.trim(), semester.trim()],
      (err, row) => {
        if (err) {
          console.error("Save as file error:", err.message);
          reject(err.message);
          return;
        }
        if (row) {
          resolve({ success: false, message: "Duplicate file details. Choose unique details." });
          return;
        }
        db.run(
          `INSERT INTO schedule_files (name, academic_year, semester, updatedAt) VALUES (?, ?, ?, ?)`,
          [name.trim(), academic_year.trim(), semester.trim(), new Date().toISOString()],
          function (err) {
            if (err) {
              console.error("Database error in save-as:", err.message);
              reject(err.message);
              return;
            }
            const newId = this.lastID;
            const mergeIdMap = {};
            const insertMergeClasses = () => new Promise((res, rej) => {
              db.all(`SELECT * FROM merge_classes WHERE scheduleFileId = ?`, [fileId], (err, mergeRows) => {
                if (err) return rej(err);
                if (!mergeRows || mergeRows.length === 0) return res();
                let done = 0;
                mergeRows.forEach((row) => {
                  db.run(`INSERT INTO merge_classes (scheduleFileId, name) VALUES (?, ?)`, [newId, row.name], function (e) {
                    if (e) rej(e);
                    else mergeIdMap[row.id] = this.lastID;
                    done++;
                    if (done === mergeRows.length) res();
                  });
                });
              });
            });
            insertMergeClasses().then(() => {
              const copyMergeRest = () => {
                if (!mergeRows || mergeRows.length === 0) return Promise.resolve();
                return new Promise((res, rej) => {
                  const mergeIds = Object.keys(mergeIdMap).map(Number);
                  if (mergeIds.length === 0) return res();
                  db.all(`SELECT * FROM merge_class_members WHERE mergeId IN (${mergeIds.map(() => "?").join(",")})`, mergeIds, (err, members) => {
                    if (err) return rej(err);
                    if (!members || members.length === 0) return res();
                    const stmt = db.prepare(`INSERT INTO merge_class_members (mergeId, classId) VALUES (?, ?)`);
                    members.forEach((m) => stmt.run([mergeIdMap[m.mergeId], m.classId]));
                    stmt.finalize(res);
                  });
                }).then(() => new Promise((res, rej) => {
                  db.all(`SELECT * FROM merge_class_assignments WHERE scheduleFileId = ?`, [fileId], (err, assignRows) => {
                    if (err) return rej(err);
                    if (!assignRows || assignRows.length === 0) return res();
                    const stmt = db.prepare(`INSERT INTO merge_class_assignments (id, mergeId, scheduleFileId, subjectId, teacherId, roomId, day, timeSlot, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                    assignRows.forEach((row) => {
                      const newAssignId = uuidv4();
                      stmt.run([newAssignId, mergeIdMap[row.mergeId] || row.mergeId, newId, row.subjectId, row.teacherId, row.roomId, row.day, row.timeSlot, row.duration]);
                    });
                    stmt.finalize(res);
                  });
                }));
              };
              Promise.all([
                new Promise((res, rej) => {
                  db.all(`SELECT * FROM subject_assignments WHERE scheduleFileId = ?`, [fileId], (err, rows) => {
                    if (err) rej(err);
                    if (rows && rows.length > 0) {
                      const stmt = db.prepare(`INSERT INTO subject_assignments (id, scheduleFileId, subjectId, teacherId) VALUES (?, ?, ?, ?)`);
                      rows.forEach((row) => stmt.run([uuidv4(), newId, row.subjectId, row.teacherId]));
                      stmt.finalize(res);
                    } else res();
                  });
                }),
                new Promise((res, rej) => {
                  db.all(`SELECT * FROM time_assignments WHERE scheduleFileId = ?`, [fileId], (err, rows) => {
                    if (err) rej(err);
                    if (rows && rows.length > 0) {
                      const stmt = db.prepare(`INSERT INTO time_assignments (id, scheduleFileId, subjectId, teacherId, classId, day, timeSlot, duration, merge_id, is_from_merge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                      rows.forEach((row) => {
                        const newAssignId = uuidv4();
                        const mergeId = row.merge_id != null && mergeIdMap[row.merge_id] != null ? mergeIdMap[row.merge_id] : null;
                        stmt.run([newAssignId, newId, row.subjectId, row.teacherId || null, row.classId, row.day, row.timeSlot, row.duration, mergeId, row.is_from_merge ?? 0]);
                      });
                      stmt.finalize(res);
                    } else res();
                  });
                }),
                new Promise((res, rej) => {
                  db.all(`SELECT * FROM room_assignments WHERE scheduleFileId = ?`, [fileId], (err, rows) => {
                    if (err) rej(err);
                    if (rows && rows.length > 0) {
                      const stmt = db.prepare(`INSERT INTO room_assignments (id, scheduleFileId, subjectId, teacherId, classId, roomId, merge_id, is_from_merge) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
                      rows.forEach((row) => {
                        const newAssignId = uuidv4();
                        const mergeId = row.merge_id != null && mergeIdMap[row.merge_id] != null ? mergeIdMap[row.merge_id] : null;
                        stmt.run([newAssignId, newId, row.subjectId, row.teacherId || null, row.classId, row.roomId, mergeId, row.is_from_merge ?? 0]);
                      });
                      stmt.finalize(res);
                    } else res();
                  });
                }),
              ]).then(() => copyMergeRest()).then(() => {
                const newFile = { id: newId, name: name.trim(), academic_year: academic_year.trim(), semester: semester.trim(), updatedAt: new Date().toISOString() };
                openFiles.set(newId, newFile);
                resolve({ success: true, message: "File saved as new!", id: newId, file: newFile });
              }).catch((err) => {
                console.error("Error copying assignments:", err.message);
                reject(err.message);
              });
            }).catch((err) => {
              console.error("Error copying merge/assignments:", err.message);
              reject(err.message);
            });
          }
        );
      }
    );
  });
});

ipcMain.handle("get-teachers", () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM teachers`, (err, rows) => {
      if (err) reject(err.message);
      else resolve(rows || []);
    });
  });
});

ipcMain.handle("get-teacher-availability", (event, teacherId) => {
  return new Promise((resolve, reject) => {
    if (!teacherId) return resolve([]);
    db.all(
      `SELECT id, teacherId, day, startMin, endMin
       FROM teacher_time_availability
       WHERE teacherId = ?
       ORDER BY day ASC, startMin ASC`,
      [teacherId],
      (err, rows) => {
        if (err) reject(err.message);
        else resolve(rows || []);
      }
    );
  });
});

ipcMain.handle("add-teacher-availability", (event, payload) => {
  return new Promise((resolve) => {
    const teacherId = payload?.teacherId;
    const day = payload?.day;
    const startMin = Number(payload?.startMin);
    const endMin = Number(payload?.endMin);
    const scheduleFileId = payload?.scheduleFileId ?? null;

    const validDays = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    if (!teacherId || !validDays.has(day)) {
      return resolve({ success: false, message: "Invalid teacher or day." });
    }
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
      return resolve({ success: false, message: "Invalid availability time range." });
    }
    if (endMin - startMin <= 60) {
      return resolve({ success: false, message: "Availability must be greater than 1 hour." });
    }

    db.all(
      `SELECT startMin, endMin FROM teacher_time_availability WHERE teacherId = ? AND day = ?`,
      [teacherId, day],
      (err, existingSlots) => {
        if (err) {
          console.error("add-teacher-availability slots:", err.message);
          return resolve({ success: false, message: "Database error." });
        }

        const overlapsExisting = (existingSlots || []).some((s) =>
          timeRangesOverlap(startMin, endMin, Number(s.startMin), Number(s.endMin))
        );
        if (overlapsExisting) {
          return resolve({
            success: false,
            message: "Availability overlaps an existing availability slot.",
          });
        }

        const checkTimeAssignments = (cb) => {
          if (!scheduleFileId) return cb(null, []);
          db.all(
            `SELECT ta.id, ta.timeSlot, ta.duration, ta.classId, c.name AS className,
                    ta.subjectId, s.name AS subjectName, ta.is_from_merge, ta.merge_id, mc.name AS mergeName
             FROM time_assignments ta
             LEFT JOIN classes c ON c.id = ta.classId
             LEFT JOIN subjects s ON s.id = ta.subjectId
             LEFT JOIN merge_classes mc ON mc.id = ta.merge_id
             WHERE ta.scheduleFileId = ? AND ta.teacherId = ? AND ta.day = ?`,
            [scheduleFileId, teacherId, day],
            (err, rows) => cb(err, rows || [])
          );
        };

        checkTimeAssignments((err, timeRows) => {
          if (err) {
            console.error("add-teacher-availability time_assignments:", err.message);
            return resolve({ success: false, message: "Database error." });
          }

          const overlappingRow = (timeRows || []).find((r) => {
            const rr = timeSlotToMinutes(r.timeSlot, r.duration);
            if (rr.start == null || rr.end == null) return false;
            return timeRangesOverlap(startMin, endMin, rr.start, rr.end);
          });
          if (overlappingRow) {
            const subjectName = overlappingRow.subjectName || `Subject ${overlappingRow.subjectId}`;
            const className = overlappingRow.className || (overlappingRow.classId ? `Class ${overlappingRow.classId}` : "Unknown class");
            const origin =
              overlappingRow.is_from_merge === 1 && overlappingRow.merge_id != null
                ? ` via merge "${overlappingRow.mergeName || `Merge ${overlappingRow.merge_id}`}" for ${className}`
                : ` for ${className}`;
            return resolve({
              success: false,
              message: `Cannot add availability: it overlaps scheduled subject "${subjectName}"${origin} at ${day} ${overlappingRow.timeSlot}.`,
            });
          }

          const id = uuidv4();
          db.run(
            `INSERT INTO teacher_time_availability (id, teacherId, day, startMin, endMin) VALUES (?, ?, ?, ?, ?)`,
            [id, teacherId, day, startMin, endMin],
            (err) => {
              if (err) {
                console.error("add-teacher-availability insert:", err.message);
                return resolve({ success: false, message: "Failed to save availability." });
              }
              resolve({ success: true, id });
            }
          );
        });
      }
    );
  });
});

ipcMain.handle("set-teacher-full-day-availability", (event, payload) => {
  return new Promise((resolve) => {
    const teacherId = payload?.teacherId;
    const day = payload?.day;
    const scheduleFileId = payload?.scheduleFileId ?? null;
    const validDays = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    if (!teacherId || !validDays.has(day)) {
      return resolve({ success: false, message: "Invalid teacher or day." });
    }

    const startMin = 7 * 60; // 7:00 AM
    const endMin = 22 * 60 + 30; // 10:30 PM

    const checkTimeAssignments = (cb) => {
      if (!scheduleFileId) return cb(null, []);
      db.all(
        `SELECT ta.id, ta.timeSlot, ta.duration, ta.classId, c.name AS className,
                ta.subjectId, s.name AS subjectName, ta.is_from_merge, ta.merge_id, mc.name AS mergeName
         FROM time_assignments ta
         LEFT JOIN classes c ON c.id = ta.classId
         LEFT JOIN subjects s ON s.id = ta.subjectId
         LEFT JOIN merge_classes mc ON mc.id = ta.merge_id
         WHERE ta.scheduleFileId = ? AND ta.teacherId = ? AND ta.day = ?`,
        [scheduleFileId, teacherId, day],
        (err, rows) => cb(err, rows || [])
      );
    };

    checkTimeAssignments((err, timeRows) => {
      if (err) {
        console.error("set-teacher-full-day-availability time_assignments:", err.message);
        return resolve({ success: false, message: "Database error." });
      }

      const overlappingRow = (timeRows || []).find((r) => {
        const rr = timeSlotToMinutes(r.timeSlot, r.duration);
        if (rr.start == null || rr.end == null) return false;
        return timeRangesOverlap(startMin, endMin, rr.start, rr.end);
      });
      if (overlappingRow) {
        const subjectName = overlappingRow.subjectName || `Subject ${overlappingRow.subjectId}`;
        const className = overlappingRow.className || (overlappingRow.classId ? `Class ${overlappingRow.classId}` : "Unknown class");
        const origin =
          overlappingRow.is_from_merge === 1 && overlappingRow.merge_id != null
            ? ` via merge "${overlappingRow.mergeName || `Merge ${overlappingRow.merge_id}`}" for ${className}`
            : ` for ${className}`;
        return resolve({
          success: false,
          message: `Cannot set full-day availability: it overlaps scheduled subject "${subjectName}"${origin} at ${day} ${overlappingRow.timeSlot}.`,
        });
      }

      db.serialize(() => {
        db.run(
          `DELETE FROM teacher_time_availability WHERE teacherId = ? AND day = ?`,
          [teacherId, day]
        );
        const id = uuidv4();
        db.run(
          `INSERT INTO teacher_time_availability (id, teacherId, day, startMin, endMin) VALUES (?, ?, ?, ?, ?)`,
          [id, teacherId, day, startMin, endMin],
          (err) => {
            if (err) {
              console.error("set-teacher-full-day-availability insert:", err.message);
              return resolve({ success: false, message: "Failed to save availability." });
            }
            resolve({ success: true, id });
          }
        );
      });
    });
  });
});

ipcMain.handle("delete-teacher-availability", (event, id) => {
  return new Promise((resolve) => {
    if (!id) return resolve({ success: false, message: "Missing availability id." });
    db.run(`DELETE FROM teacher_time_availability WHERE id = ?`, [id], (err) => {
      if (err) {
        console.error("delete-teacher-availability:", err.message);
        return resolve({ success: false, message: "Failed to delete availability." });
      }
      resolve({ success: true });
    });
  });
});

ipcMain.handle("get-programs", () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM programs`, (err, rows) => {
      if (err) reject(err.message);
      else resolve(rows || []);
    });
  });
});

ipcMain.handle("get-users", () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT id, username, role FROM users`, (err, rows) => {
      if (err) reject(err.message);
      else resolve(rows || []);
    });
  });
});

function getTimeBlockIndex(timeSlot) {
  // Returns which time block (0-3) a time slot falls into
  // 0: 7:00-10:00, 1: 10:00-1:00, 2: 1:00-4:00, 3: 4:00-7:00
  if (!timeSlot) return -1;  // Safety check for undefined or null timeSlot

  let startTime = timeSlot;
  if (startTime.includes('-')) {
    startTime = startTime.split('-')[0].trim();
  }

  const mins = parseClockToMinutes(startTime);
  if (mins === null) return -1;

  if (mins < 10 * 60) return 0;      // Before 10:00
  if (mins < 13 * 60) return 1;      // 10:00 - 1:00
  if (mins < 16 * 60) return 2;      // 1:00 - 4:00
  return 3;                          // 4:00+
}

// ---------------- MERGE VALIDATION (Phase 02) ----------------
function timeSlotToMinutes(timeSlot, durationMins) {
  if (!timeSlot) return { start: null, end: null };
  const startStr = timeSlot.includes('-') ? timeSlot.split('-')[0].trim() : timeSlot.trim();
  const start = parseClockToMinutes(startStr);
  if (start === null) return { start: null, end: null };
  return { start, end: start + (durationMins || 0) };
}
function timeRangesOverlap(start1, end1, start2, end2) {
  if (start1 == null || end1 == null || start2 == null || end2 == null) return false;
  return start1 < end2 && start2 < end1;
}

function validateTeacherAvailability(scheduleFileId, teacherId, day, timeSlot, duration, excludeTimeAssignmentId = null) {
  if (!teacherId) return Promise.resolve({ valid: true });
  const ourRange = timeSlotToMinutes(timeSlot, duration);
  if (ourRange.start == null || ourRange.end == null) {
    return Promise.resolve({
      valid: false,
      message: `Invalid time slot format: "${timeSlot || ""}" (duration: ${duration || 0} mins).`,
    });
  }
  return new Promise((resolve) => {
    const params = [scheduleFileId, day, teacherId];
    let excludeSql = "";
    if (excludeTimeAssignmentId) {
      excludeSql = " AND ta.id <> ? ";
      params.push(excludeTimeAssignmentId);
    }
    db.all(
      `SELECT ta.id, ta.classId, c.name AS className, ta.subjectId, s.name AS subjectName,
              ta.day, ta.timeSlot, ta.duration, ta.is_from_merge, ta.merge_id, mc.name AS mergeName
       FROM time_assignments ta
       LEFT JOIN classes c ON c.id = ta.classId
       LEFT JOIN subjects s ON s.id = ta.subjectId
       LEFT JOIN merge_classes mc ON mc.id = ta.merge_id
       WHERE ta.scheduleFileId = ? AND ta.day = ? AND ta.teacherId = ? ${excludeSql}
      `,
      params,
      (err, rows) => {
        if (err) {
          console.error("validateTeacherAvailability time_assignments:", err.message);
          return resolve({ valid: false, message: "Validation error." });
        }
        for (const row of rows || []) {
          const rowRange = timeSlotToMinutes(row.timeSlot, row.duration);
          if (rowRange.start == null || rowRange.end == null) continue;
          if (!timeRangesOverlap(ourRange.start, ourRange.end, rowRange.start, rowRange.end)) continue;
          const className = row.className || `Class ${row.classId}`;
          const subjectName = row.subjectName || `Subject ${row.subjectId}`;
          const origin =
            row.is_from_merge === 1 && row.merge_id != null
              ? ` via merge "${row.mergeName || `Merge ${row.merge_id}`}" for ${className}`
              : ` for ${className}`;
          return resolve({
            valid: false,
            message: `Cannot assign: Teacher is already teaching ${subjectName}${origin} at ${day} ${row.timeSlot} (conflicts with ${day} ${timeSlot}).`,
          });
        }
        resolve({ valid: true });
      }
    );
  });
}

function validateTeacherTimeAvailabilityConstraint(teacherId, day, timeSlot, duration) {
  if (!teacherId) return Promise.resolve({ valid: true });
  const ourRange = timeSlotToMinutes(timeSlot, duration);
  if (ourRange.start == null || ourRange.end == null) {
    return Promise.resolve({
      valid: false,
      message: `Invalid time slot format: "${timeSlot || ""}" (duration: ${duration || 0} mins).`,
    });
  }

  return new Promise((resolve) => {
    db.get(
      `SELECT COUNT(*) AS cnt FROM teacher_time_availability WHERE teacherId = ?`,
      [teacherId],
      (err, row) => {
        if (err) {
          console.error("validateTeacherTimeAvailabilityConstraint count:", err.message);
          return resolve({ valid: false, message: "Validation error." });
        }

        const count = Number(row?.cnt || 0);
        // Default rule: no availability configured => fully available.
        if (count === 0) return resolve({ valid: true });

        db.all(
          `SELECT startMin, endMin FROM teacher_time_availability WHERE teacherId = ? AND day = ?`,
          [teacherId, day],
          (err, slots) => {
            if (err) {
              console.error("validateTeacherTimeAvailabilityConstraint slots:", err.message);
              return resolve({ valid: false, message: "Validation error." });
            }
            const ok = (slots || []).some(
              (s) => ourRange.start >= Number(s.startMin) && ourRange.end <= Number(s.endMin)
            );
            if (!ok) {
              return resolve({
                valid: false,
                message: "Teacher is not available at this time.",
              });
            }
            resolve({ valid: true });
          }
        );
      }
    );
  });
}

function validateMergeAssignment(scheduleFileId, mergeId, payload, existingAssignmentId = null) {
  const { subjectId, teacherId, roomId, day, timeSlot, duration } = payload;
  return new Promise((resolve) => {
    const ourRange = timeSlotToMinutes(timeSlot, duration);
    if (ourRange.start == null || ourRange.end == null) {
      return resolve({
        valid: false,
        message: `Invalid time slot format: "${timeSlot || ""}" (duration: ${duration || 0} mins).`,
      });
    }
    validateTeacherTimeAvailabilityConstraint(teacherId, day, timeSlot, duration).then((av) => {
      if (!av.valid) return resolve(av);

      db.all(`SELECT classId FROM merge_class_members WHERE mergeId = ?`, [mergeId], (err, members) => {
        if (err) {
          console.error("validateMergeAssignment merge members:", err.message);
          return resolve({ valid: false, message: "Validation error." });
        }
        if (!members || members.length === 0) {
          return resolve({ valid: false, message: "Merge has no classes." });
        }
        const classIds = members.map((m) => m.classId);
        db.all(`SELECT * FROM time_assignments WHERE scheduleFileId = ? AND day = ?`, [scheduleFileId, day], (err, timeRows) => {
          if (err) {
            console.error("validateMergeAssignment time_assignments:", err.message);
            return resolve({ valid: false, message: "Validation error." });
          }
          db.all(`SELECT * FROM room_assignments WHERE scheduleFileId = ?`, [scheduleFileId], (err, roomRows) => {
            if (err) {
              console.error("validateMergeAssignment room_assignments:", err.message);
              return resolve({ valid: false, message: "Validation error." });
            }
            db.get(`SELECT capacity FROM rooms WHERE id = ?`, [roomId], (err, room) => {
              if (err || !room) {
                return resolve({ valid: false, message: "Room not found." });
              }
              const uniq = (arr) => Array.from(new Set((arr || []).filter((v) => v != null)));
              const allClassIds = uniq([...classIds, ...timeRows.map((r) => r.classId)]);
              const allSubjectIds = uniq([subjectId, ...timeRows.map((r) => r.subjectId)]);
              const allMergeIds = uniq([mergeId, ...timeRows.filter((r) => r.is_from_merge === 1 && r.merge_id != null).map((r) => r.merge_id)]);

              const classSql = allClassIds.length
              ? `SELECT id, name, students FROM classes WHERE id IN (${allClassIds.map(() => '?').join(',')})`
              : null;
            const subjectSql = allSubjectIds.length
              ? `SELECT id, name FROM subjects WHERE id IN (${allSubjectIds.map(() => '?').join(',')})`
              : null;
            const mergeSql = allMergeIds.length
              ? `SELECT id, name FROM merge_classes WHERE id IN (${allMergeIds.map(() => '?').join(',')})`
              : null;

            const loadClasses = (cb) => {
              if (!classSql) return cb(null, []);
              db.all(classSql, allClassIds, (err, rows) => cb(err, rows || []));
            };
            const loadSubjects = (cb) => {
              if (!subjectSql) return cb(null, []);
              db.all(subjectSql, allSubjectIds, (err, rows) => cb(err, rows || []));
            };
            const loadMerges = (cb) => {
              if (!mergeSql) return cb(null, []);
              db.all(mergeSql, allMergeIds, (err, rows) => cb(err, rows || []));
            };

              loadClasses((err, classRows) => {
              if (err) return resolve({ valid: false, message: "Classes not found." });
              const classById = Object.fromEntries((classRows || []).map((c) => [c.id, c]));
              const mergeTotalStudents = classIds.reduce((sum, id) => sum + (classById[id]?.students || 0), 0);

              loadMerges((err, mergeRows) => {
                if (err) return resolve({ valid: false, message: "Validation error." });
                const mergeNameById = Object.fromEntries((mergeRows || []).map((m) => [m.id, m.name]));
                if (mergeTotalStudents > room.capacity) {
                  const mname = mergeNameById[mergeId] || `Merge ${mergeId}`;
                  return resolve({
                    valid: false,
                    message: `Room capacity (${room.capacity}) is less than total students (${mergeTotalStudents}) for merge "${mname}".`,
                  });
                }

                loadSubjects((err, subjRows) => {
                  if (err) return resolve({ valid: false, message: "Validation error." });
                  const subjectNameById = Object.fromEntries((subjRows || []).map((s) => [s.id, s.name]));

                  const fmtOrigin = (row) => {
                    if (row?.is_from_merge === 1 && row?.merge_id != null) {
                      const mname = mergeNameById[row.merge_id] || `Merge ${row.merge_id}`;
                      return `merge "${mname}"`;
                    }
                    return "single assignment";
                  };
                  const fmtClass = (cid) => classById[cid]?.name || `Class ${cid}`;
                  const fmtSubject = (sid) => subjectNameById[sid] || `Subject ${sid}`;

                  for (const row of timeRows) {
                    // When editing a merge assignment, the "existingAssignmentId" we receive is the
                    // merge_class_assignments.id, not the time_assignments.id. Exclude the current
                    // merge+subject's own distributed time rows to avoid self-conflict.
                    if (row.is_from_merge === 1 && row.merge_id === mergeId && row.subjectId === subjectId) continue;
                    if (existingAssignmentId && row.id === existingAssignmentId) continue;
                    const rowRange = timeSlotToMinutes(row.timeSlot, row.duration);
                    if (rowRange.start == null) continue;
                    const overlaps = timeRangesOverlap(ourRange.start, ourRange.end, rowRange.start, rowRange.end);
                    if (!overlaps || row.day !== day) continue;
                    if (classIds.includes(row.classId)) {
                      const className = fmtClass(row.classId);
                      const cause = `${fmtSubject(row.subjectId)} (${fmtOrigin(row)})`;
                      return resolve({
                        valid: false,
                        message: `Cannot assign: ${className} already has a schedule from ${cause} at ${day} ${row.timeSlot} (conflicts with ${day} ${timeSlot}).`,
                      });
                    }
                  }

                  for (const row of timeRows) {
                    if (existingAssignmentId && row.id === existingAssignmentId) continue;
                    if (row.is_from_merge === 1 && row.merge_id === mergeId && row.subjectId === subjectId) continue;
                    if (row.merge_id === mergeId) continue;
                    if (row.teacherId !== teacherId || row.day !== day) continue;
                    const rowRange = timeSlotToMinutes(row.timeSlot, row.duration);
                    if (rowRange.start == null) continue;
                    if (timeRangesOverlap(ourRange.start, ourRange.end, rowRange.start, rowRange.end)) {
                      const className = fmtClass(row.classId);
                      const cause = `${fmtSubject(row.subjectId)} for ${className} (${fmtOrigin(row)})`;
                      return resolve({
                        valid: false,
                        message: `Cannot assign: Teacher is already teaching ${cause} at ${day} ${row.timeSlot} (conflicts with ${day} ${timeSlot}).`,
                      });
                    }
                  }

                  for (const ra of roomRows) {
                    if (ra.roomId !== roomId) continue;
                    const ta = timeRows.find(
                      (t) =>
                        t.scheduleFileId === ra.scheduleFileId &&
                        t.classId === ra.classId &&
                        t.subjectId === ra.subjectId &&
                        t.teacherId === ra.teacherId
                    );
                    if (!ta || (existingAssignmentId && ta.id === existingAssignmentId)) continue;
                    // Exclude our merge+subject self rows (edit case) and our own merge in general
                    if (ta.is_from_merge === 1 && ta.merge_id === mergeId && ta.subjectId === subjectId) continue;
                    if (ta.merge_id === mergeId) continue;
                    if (ta.day !== day) continue;
                    const rowRange = timeSlotToMinutes(ta.timeSlot, ta.duration);
                    if (rowRange.start == null) continue;
                    if (timeRangesOverlap(ourRange.start, ourRange.end, rowRange.start, rowRange.end)) {
                      const className = fmtClass(ta.classId);
                      const cause = `${fmtSubject(ta.subjectId)} for ${className} (${fmtOrigin(ta)})`;
                      return resolve({
                        valid: false,
                        message: `Cannot assign: Room is already booked by ${cause} at ${day} ${ta.timeSlot} (conflicts with ${day} ${timeSlot}).`,
                      });
                    }
                  }

                  // Keep this check for clarity, but now include the merge name
                  for (const row of timeRows) {
                    if (existingAssignmentId && row.id === existingAssignmentId) continue;
                    if (row.is_from_merge !== 1 || row.merge_id === mergeId) continue;
                    if (!classIds.includes(row.classId) || row.day !== day) continue;
                    const rowRange = timeSlotToMinutes(row.timeSlot, row.duration);
                    if (rowRange.start == null) continue;
                    if (timeRangesOverlap(ourRange.start, ourRange.end, rowRange.start, rowRange.end)) {
                      const className = fmtClass(row.classId);
                      const mname = mergeNameById[row.merge_id] || `Merge ${row.merge_id}`;
                      return resolve({
                        valid: false,
                        message: `Cannot assign: ${className} is already scheduled via merge "${mname}" at ${day} ${row.timeSlot} (conflicts with ${day} ${timeSlot}).`,
                      });
                    }
                  }

                  resolve({ valid: true });
                });
              });
              });
            });
          });
        });
      });
    });
  });
}

// ---------------- MERGE CRUD & ATOMIC DISTRIBUTION (Phase 03) ----------------
function runTransaction(operations) {
  return new Promise((resolve, reject) => {
    db.run("BEGIN", (err) => {
      if (err) return reject(err);
      let index = 0;
      function next() {
        if (index >= operations.length) {
          db.run("COMMIT", (err) => (err ? (db.run("ROLLBACK", () => reject(err))) : resolve()));
          return;
        }
        const op = operations[index++];
        op((err) => {
          if (err) {
            db.run("ROLLBACK", () => reject(err));
            return;
          }
          next();
        });
      }
      next();
    });
  });
}

function mergeCreate(scheduleFileId, name, classIds) {
  if (!classIds || classIds.length < 2) {
    return Promise.reject(new Error("At least 2 classes are required."));
  }
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO merge_classes (scheduleFileId, name) VALUES (?, ?)`, [scheduleFileId, name], function (err) {
      if (err) return reject(err);
      const mergeId = this.lastID;
      const stmt = db.prepare(`INSERT INTO merge_class_members (mergeId, classId) VALUES (?, ?)`);
      for (const cid of classIds) {
        stmt.run([mergeId, cid]);
      }
      stmt.finalize((err) => {
        if (err) {
          db.run(`DELETE FROM merge_classes WHERE id = ?`, [mergeId]);
          return reject(err);
        }
        resolve(mergeId);
      });
    });
  });
}

function mergeGetList(scheduleFileId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT mc.id, mc.name, mc.scheduleFileId,
        (SELECT COUNT(*) FROM merge_class_members WHERE mergeId = mc.id) AS classCount,
        (SELECT COUNT(*) FROM merge_class_assignments WHERE mergeId = mc.id) AS subjectCount,
        (SELECT COALESCE(SUM(c.students), 0) FROM merge_class_members mcm JOIN classes c ON c.id = mcm.classId WHERE mcm.mergeId = mc.id) AS totalStudents
       FROM merge_classes mc WHERE mc.scheduleFileId = ?`,
      [scheduleFileId],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

function mergeGetDetails(mergeId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM merge_classes WHERE id = ?`, [mergeId], (err, merge) => {
      if (err) return reject(err);
      if (!merge) return resolve(null);
      db.all(`SELECT classId FROM merge_class_members WHERE mergeId = ?`, [mergeId], (err, members) => {
        if (err) return reject(err);
        const classIds = (members || []).map((m) => m.classId);
        if (classIds.length === 0) return resolve({ ...merge, classes: [], totalStudents: 0, assignments: [] });
        db.all(`SELECT id, name, students, programId, yearLevel FROM classes WHERE id IN (${classIds.map(() => "?").join(",")})`, classIds, (err, classes) => {
          if (err) return reject(err);
          const totalStudents = (classes || []).reduce((s, c) => s + (c.students || 0), 0);
          db.all(`SELECT * FROM merge_class_assignments WHERE mergeId = ?`, [mergeId], (err, assignments) => {
            if (err) return reject(err);
            resolve({
              ...merge,
              classes: classes || [],
              totalStudents,
              assignments: assignments || [],
            });
          });
        });
      });
    });
  });
}

function mergeUpdate(mergeId, name, classIds) {
  return new Promise((resolve, reject) => {
    if (classIds != null && classIds.length < 2) return reject(new Error("At least 2 classes are required."));
    const updates = [];
    if (name != null) updates.push(() => new Promise((res, rej) => db.run(`UPDATE merge_classes SET name = ? WHERE id = ?`, [name, mergeId], (e) => (e ? rej(e) : res()))));
    if (classIds != null) {
      updates.push(() => new Promise((res, rej) => {
        db.run(`DELETE FROM merge_class_members WHERE mergeId = ?`, [mergeId], (err) => {
          if (err) return rej(err);
          const stmt = db.prepare(`INSERT INTO merge_class_members (mergeId, classId) VALUES (?, ?)`);
          for (const cid of classIds) stmt.run([mergeId, cid]);
          stmt.finalize((e) => (e ? rej(e) : res()));
        });
      }));
    }
    Promise.all(updates.map((fn) => fn())).then(() => resolve()).catch(reject);
  });
}

function mergeDelete(mergeId) {
  const ops = [
    (cb) => db.run(`DELETE FROM time_assignments WHERE merge_id = ? AND is_from_merge = 1`, [mergeId], cb),
    (cb) => db.run(`DELETE FROM room_assignments WHERE merge_id = ? AND is_from_merge = 1`, [mergeId], cb),
    (cb) => db.run(`DELETE FROM merge_class_assignments WHERE mergeId = ?`, [mergeId], cb),
    (cb) => db.run(`DELETE FROM merge_class_members WHERE mergeId = ?`, [mergeId], cb),
    (cb) => db.run(`DELETE FROM merge_classes WHERE id = ?`, [mergeId], cb),
  ];
  return runTransaction(ops);
}

function mergeAddSubject(scheduleFileId, mergeId, subjectId, teacherId, roomId, day, timeSlot, duration) {
  return validateMergeAssignment(scheduleFileId, mergeId, { subjectId, teacherId, roomId, day, timeSlot, duration }, null).then((v) => {
    if (!v.valid) throw new Error(v.message);
    return new Promise((resolve, reject) => {
      db.all(`SELECT classId FROM merge_class_members WHERE mergeId = ?`, [mergeId], (err, members) => {
        if (err) return reject(err);
        const classIds = (members || []).map((m) => m.classId);
        if (classIds.length === 0) return reject(new Error("Merge has no classes."));
        const assignmentId = uuidv4();
        const ops = [
          (cb) => db.run(
            `INSERT INTO merge_class_assignments (id, mergeId, scheduleFileId, subjectId, teacherId, roomId, day, timeSlot, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [assignmentId, mergeId, scheduleFileId, subjectId, teacherId, roomId, day, timeSlot, duration],
            cb
          ),
        ];
        for (const classId of classIds) {
          const tid = uuidv4();
          const rid = uuidv4();
          ops.push((cb) => db.run(
            `INSERT INTO time_assignments (id, scheduleFileId, subjectId, teacherId, classId, day, timeSlot, duration, merge_id, is_from_merge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [tid, scheduleFileId, subjectId, teacherId, classId, day, timeSlot, duration, mergeId],
            cb
          ));
          ops.push((cb) => db.run(
            `INSERT INTO room_assignments (id, scheduleFileId, subjectId, teacherId, classId, roomId, merge_id, is_from_merge) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [rid, scheduleFileId, subjectId, teacherId, classId, roomId, mergeId],
            cb
          ));
        }
        runTransaction(ops).then(() => resolve(assignmentId)).catch(reject);
      });
    });
  });
}

function mergeUpdateSubject(mergeId, assignmentId, teacherId, roomId, day, timeSlot, duration) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM merge_class_assignments WHERE id = ? AND mergeId = ?`, [assignmentId, mergeId], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error("Assignment not found."));
      validateMergeAssignment(row.scheduleFileId, mergeId, { subjectId: row.subjectId, teacherId, roomId, day, timeSlot, duration }, assignmentId).then((v) => {
        if (!v.valid) throw new Error(v.message);
        const ops = [
          (cb) => db.run(
            `UPDATE merge_class_assignments SET teacherId=?, roomId=?, day=?, timeSlot=?, duration=? WHERE id=?`,
            [teacherId, roomId, day, timeSlot, duration, assignmentId],
            cb
          ),
          (cb) => db.run(
            `UPDATE time_assignments SET teacherId=?, day=?, timeSlot=?, duration=? WHERE merge_id=? AND scheduleFileId=? AND subjectId=?`,
            [teacherId, day, timeSlot, duration, mergeId, row.scheduleFileId, row.subjectId],
            cb
          ),
          (cb) => db.run(
            `UPDATE room_assignments SET teacherId=?, roomId=? WHERE merge_id=? AND scheduleFileId=? AND subjectId=?`,
            [teacherId, roomId, mergeId, row.scheduleFileId, row.subjectId],
            cb
          ),
        ];
        runTransaction(ops).then(() => resolve()).catch(reject);
      }).catch(reject);
    });
  });
}

function mergeRemoveSubject(mergeId, assignmentId) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM merge_class_assignments WHERE id = ? AND mergeId = ?`, [assignmentId, mergeId], (err, row) => {
      if (err) return reject(err);
      if (!row) return reject(new Error("Assignment not found."));
      const ops = [
        (cb) => db.run(`DELETE FROM time_assignments WHERE merge_id = ? AND scheduleFileId = ? AND subjectId = ?`, [mergeId, row.scheduleFileId, row.subjectId], cb),
        (cb) => db.run(`DELETE FROM room_assignments WHERE merge_id = ? AND scheduleFileId = ? AND subjectId = ?`, [mergeId, row.scheduleFileId, row.subjectId], cb),
        (cb) => db.run(`DELETE FROM merge_class_assignments WHERE id = ?`, [assignmentId], cb),
      ];
      runTransaction(ops).then(() => resolve()).catch(reject);
    });
  });
}

ipcMain.handle("export-file", async (event, args = {}) => {
  const { fileId: rawFileId, type, id, format = 'pdf', style: styleArg } = args;
  console.log("Export requested - args:", args);
  const fileId = typeof rawFileId === 'string' ? parseInt(rawFileId) : rawFileId;
  if (!fileId) {
    console.error("Export failed: No fileId provided");
    return { success: false, message: "No file selected to export." };
  }

  const file = await new Promise((res, rej) => {
    db.get(`SELECT * FROM schedule_files WHERE id=? AND status='active'`, [fileId], (err, row) => {
      if (err) {
        console.error("Error fetching file:", err.message);
        return rej(err.message);
      }
      res(row || null);
    });
  });

  if (!file) {
    console.error("Export failed: File not found for fileId:", fileId);
    return { success: false, message: "Selected file not found." };
  }

  try {
    const style = normalizeExportStyle(styleArg);
    const nextHeaderTableClass = makeNextHeaderTableClass(style);
    const pageSizeCss = `${style.paperSize} ${style.orientation}`;
    const pageMarginCss =
      style.orientation === "landscape" && style.tablesPerPage === 1
        ? "15mm 20mm 30mm 20mm"
        : "5mm 10mm";
    const isOneTableLandscape = style.orientation === "landscape" && style.tablesPerPage === 1;
    const pageFooterReservePx = isOneTableLandscape ? 120 : 170;
    const pageSignGapPx = isOneTableLandscape ? 6 : 12;
    const docZoom = computeDocumentZoom(style);
    const blockGapPx = style.tablesPerPage >= 3 ? 28 : (style.tablesPerPage === 2 ? 20 : 14);
    const perPage = style.tablesPerPage;
    const gridColor = `rgba(0,0,0,${style.gridLineOpacity})`;
    const gridBorder = `${style.gridLineWidth}px solid ${gridColor}`;
    const headerBg = style.headerBg;
    const cellAlpha = style.cellBgOpacity;

    const [
      timeAssignments,
      subjectAssignments,
      roomAssignments,
      mergeClasses,
      subjects,
      teachers,
      classes,
      rooms,
      programs
    ] = await Promise.all([
      new Promise((res, rej) => db.all(`SELECT * FROM time_assignments WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM subject_assignments WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM room_assignments WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT id, name FROM merge_classes WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM subjects`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM teachers`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM classes`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM rooms`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM programs`, (e, r) => e ? rej(e.message) : res(r))),
    ]);

    const allTimeAssignments = [...timeAssignments];

    if (format === 'json') {
      const exportData = {
        file,
        timeAssignments,
        subjectAssignments,
        roomAssignments,
        subjects,
        teachers,
        classes,
        rooms,
        programs
      };
      const defaultPath = `schedule_${fileId}.json`;
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        defaultPath,
        filters: [{ name: "JSON Files", extensions: ["json"] }]
      });
      if (canceled || !filePath) {
        console.log("Export cancelled by user");
        return { success: false, message: "Export cancelled." };
      }
      try {
        fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
        console.log("JSON file saved successfully:", filePath);
        return { success: true, message: "File exported as JSON!" };
      } catch (writeErr) {
        console.error("Error writing JSON file:", writeErr.message);
        return { success: false, message: "Failed to save JSON file: " + writeErr.message };
      }
    }

    const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const timeBlocks = ['7:00 - 10:00', '10:00 - 1:00', '1:00 - 4:00', '4:00 - 7:00'];

    const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
    const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
    const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
    const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]));
    const programMap = Object.fromEntries(programs.map(p => [p.id, p]));
    const mergeNameMap = Object.fromEntries((mergeClasses || []).map(m => [m.id, m.name]));

    const getDisplayClassName = (assignment) => {
      const base = classMap[assignment.classId]?.name || 'Unknown';
      if (assignment.is_from_merge === 1 && assignment.merge_id != null) {
        return mergeNameMap[assignment.merge_id] || base;
      }
      return base;
    };

    function hexToRgba(hex, alpha = cellAlpha) {
      if (!hex || hex.length < 7) return 'transparent';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    let html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Schedule Export</title>
        <style>
          @page { size: ${pageSizeCss}; margin: ${pageMarginCss}; }
          * { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            font-size: 14px;
            margin: 0;
            padding: 0;
            background: white;
            color: #000;
            zoom: ${docZoom};
            --block-gap: ${blockGapPx}px;
            --teacher-text-color: ${style.teacherTextColor};
            --time-text-color: ${style.timeTextColor};
            --room-text-color: ${style.roomTextColor};
            --teacher-text-weight: ${style.teacherTextBold ? "bold" : "normal"};
            --time-text-weight: ${style.timeTextBold ? "bold" : "normal"};
            --room-text-weight: ${style.roomTextBold ? "bold" : "normal"};
            --page-footer-reserve: ${pageFooterReservePx}px;
            --page-sign-gap: ${pageSignGapPx}px;
          }
          h1 {
            text-align: center;
            font-size: 16px;
            margin: 8px 0;
            color: #000;
          }
          .institution {
            text-align: center;
            font-weight: bold;
            margin-bottom: 8px;
            font-size: 14px;
            color: #000;
          }
          .year-level-title, .room-title, .teacher-title {
            text-align: center;
            font-weight: bold;
            font-size: 14px;
            margin: 20px 0 15px 0;
            color: #000;
          }
          .first-page {
            page-break-before: avoid;
            break-before: avoid;
          }
          .new-page {
            page-break-before: always;
            break-before: page;
          }
          .page {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 100vh;
            position: relative;
          }
          .page-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: var(--block-gap);
            padding-top: 86px;
            padding-bottom: var(--page-footer-reserve);
          }
          .page-header {
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            background: white;
          }
          .page-header .institution {
            margin: 8px 0 0 0;
          }
          .page-header h1 {
            margin: 4px 0 8px 0;
          }
          .page-footer {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
          }
          .schedule-block {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .page .year-level-title,
          .page .room-title {
            margin: 0 0 8px 0;
          }
          .page .sign-section {
            margin-top: var(--page-sign-gap);
          }
          .page-content table {
            margin-bottom: 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background: white;
            table-layout: fixed;
          }
          thead tr {
            background: transparent !important;
          }
          th {
            border: ${gridBorder};
            padding: 8px;
            vertical-align: middle;
            background: ${headerBg} !important;
            color: #000 !important;
            font-size: 13px;
            font-weight: bold;
            text-align: center;
            height: auto !important;
            overflow: visible !important;
          }
          ${style.headerAltEnabled ? `.hdr-alt th{background:${style.headerBgAlt} !important;}` : ""}
          td {
            border: ${gridBorder};
            padding: 6px;
            vertical-align: middle;
            word-break: break-word;
            background: white;
            color: #000;
            font-size: 12px;
            height: 70px;
            text-align: center;
          }
          .time-block {
            width: 90px !important;
            font-size: 12px;
            background: white !important;
            color: #000 !important;
            white-space: nowrap;
            font-weight: bold;
            vertical-align: middle;
          }
          .slot-cell {
            padding: 6px;
            font-size: 12px;
            white-space: normal;
            word-wrap: break-word;
            overflow-wrap: break-word;
            line-height: 1.2;
            text-align: center;
          }
          .cell-content {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100%;
            gap: 2px;
          }
          .subject-name {
            font-weight: bold;
            display: block;
            word-break: break-word;
            white-space: normal;
            color: #000;
            font-size: 11px;
            line-height: 1.2;
          }
          .time-label {
            display: block;
            font-size: 10px;
            color: var(--time-text-color);
            font-weight: var(--time-text-weight);
            line-height: 1.1;
          }
          .teacher-name {
            display: block;
            font-size: 10px;
            color: var(--teacher-text-color);
            font-weight: var(--teacher-text-weight);
            word-break: break-word;
            white-space: normal;
            line-height: 1.1;
          }
          .class-name {
            display: block;
            font-size: 10px;
            color: #000;
            word-break: break-word;
            line-height: 1.1;
          }
          .room-name {
            display: block;
            font-size: 10px;
            color: var(--room-text-color);
            font-weight: var(--room-text-weight);
            line-height: 1.1;
          }
          .sign-section {
            width: 100%;
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            page-break-inside: avoid;
            font-size: 13px;
          }
          .sign-block {
            display: inline-block;
            text-align: ${style.signatureAlign};
            flex: 1;
          }
          .sign-line {
            width: 200px;
            border-bottom: ${gridBorder};
            margin: 30px auto 5px auto;
          }
          .sign-names {
            margin-top: 5px;
            font-weight: bold;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
    `;

    if (type === 'teacher') {
      const teacherId = parseInt(id);
      const teacher = teacherMap[teacherId];
      if (!teacher) {
        console.error("Export failed: Teacher not found for id:", teacherId);
        return { success: false, message: "Teacher not found." };
      }
      const teacherTimeAssignments = allTimeAssignments.filter(a => parseInt(a.teacherId) === teacherId);
      html += `
        <div class="institution">GOLDEN GATE COLLEGES</div>
        <h1>Teacher Schedule</h1>
        <div class="teacher-title">${teacher.honorifics ? teacher.honorifics + ' ' : ''}${teacher.fullName}</div>`;

      const teacherGrid = {};
      dayOrder.forEach(day => {
        teacherGrid[day] = [null, null, null, null];
      });

      teacherTimeAssignments.forEach(assignment => {
        const blockIndex = getTimeBlockIndex(assignment.timeSlot);
        if (blockIndex !== -1) {
          if (!teacherGrid[assignment.day][blockIndex]) {
            teacherGrid[assignment.day][blockIndex] = assignment;
          }
        }
      });

      html += `<table class="${nextHeaderTableClass()}"><thead><tr><th class="time-block">Time</th>`;
      dayOrder.forEach(day => {
        html += `<th>${day}</th>`;
      });
      html += `</tr></thead><tbody>`;

      timeBlocks.forEach((block, blockIndex) => {
        html += `<tr><td class="time-block">${block}</td>`;
        dayOrder.forEach(day => {
          const assignment = teacherGrid[day][blockIndex];
          if (!assignment) {
            html += `<td class="slot-cell"></td>`;
          } else {
            const subject = subjectMap[assignment.subjectId];
            const className = getDisplayClassName(assignment);
            const roomAssignment = roomAssignments.find(ra =>
              ra.scheduleFileId === assignment.scheduleFileId &&
              ra.subjectId === assignment.subjectId &&
              ra.teacherId === assignment.teacherId &&
              ra.classId === assignment.classId
            );
            const roomName = roomAssignment ? (roomMap[roomAssignment.roomId]?.name || 'N/A') : 'N/A';
            const bgColor = style.showCellBackground ? hexToRgba(teacher.color) : 'transparent';
            html += `<td class="slot-cell" style="background-color: ${bgColor} !important;"><div class="cell-content"><span class="subject-name">${subject?.name || 'Unknown'}${mergeLabelHtml(style, assignment)}</span><span class="time-label">${assignment.timeSlot}</span><span class="class-name">${className}</span><span class="room-name">Room: ${roomName}</span></div></td>`;
          }
        });
        html += `</tr>`;
      });

      html += `</tbody></table>`;
      html += signatureHtml(style);

    } else if (type === 'program') {
      const programsToExport = (id === 'all') ? programs : programs.filter(p => p.id === parseInt(id));
      if (!programsToExport || programsToExport.length === 0) {
        console.error("Export failed: Program not found for id:", id);
        return { success: false, message: "Program not found." };
      }
      // Header will be rendered per-page via .page-header
      let isFirstYearLevel = true;
      let programBlockIndex = 0;
      let blocksInPage = 0;
      let pageIndex = 0;
      let pageOpen = false;
      const openPage = () => {
        const cls = pageIndex === 0 ? 'first-page' : 'new-page';
        html += `<div class="page ${cls}"><div class="page-header"><div class="institution">GOLDEN GATE COLLEGES</div><h1>Program Schedule</h1></div><div class="page-content">`;
        pageOpen = true;
      };
      const closePage = () => {
        html += `</div><div class="page-footer">${signatureHtml(style)}</div></div>`;
        pageOpen = false;
        blocksInPage = 0;
        pageIndex += 1;
      };
      for (const program of programsToExport) {
        const programClasses = classes.filter(c => c.programId === program.id);
        const classIds = programClasses.map(c => c.id);
        const programTimeAssignments = allTimeAssignments.filter(a => classIds.includes(a.classId));
        const yearLevels = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', '7th Year', '8th Year', '9th Year', '10th Year'];

        for (const yearLevel of yearLevels) {
          const yearClasses = programClasses.filter(c => c.yearLevel === yearLevel);
          const yearClassIds = yearClasses.map(c => c.id);
          const yearAssignments = programTimeAssignments.filter(a => yearClassIds.includes(a.classId));
          if (yearAssignments.length === 0) continue;

          // FIX: Iterate each class separately to generate one table per class
          const sortedYearClasses = [...yearClasses].sort((a, b) => a.name.localeCompare(b.name));
          for (const classObj of sortedYearClasses) {
            const classAssignments = yearAssignments.filter(a => a.classId === classObj.id);
            if (classAssignments.length === 0) continue;

            if (!pageOpen) openPage();
            html += `<div class="schedule-block"><div class="year-level-title">${yearLevel} - ${program.name} (${classObj.name})</div>`;
            isFirstYearLevel = false;
            programBlockIndex += 1;

            const scheduleGrid = {};
            dayOrder.forEach(day => {
              scheduleGrid[day] = [null, null, null, null];
            });

            classAssignments.forEach(assignment => {
              const blockIndex = getTimeBlockIndex(assignment.timeSlot);
              if (blockIndex !== -1) {
                if (!scheduleGrid[assignment.day][blockIndex]) {
                  scheduleGrid[assignment.day][blockIndex] = assignment;
                }
              }
            });

            html += `<table class="${nextHeaderTableClass()}"><thead><tr><th class="time-block">Time</th>`;
            dayOrder.forEach(day => {
              html += `<th>${day}</th>`;
            });
            html += `</tr></thead><tbody>`;

            timeBlocks.forEach((block, blockIndex) => {
              html += `<tr><td class="time-block">${block}</td>`;
              dayOrder.forEach(day => {
                const assignment = scheduleGrid[day][blockIndex];
                if (!assignment) {
                  html += `<td class="slot-cell"></td>`;
                } else {
                  const subject = subjectMap[assignment.subjectId];
                  const teacher = teacherMap[assignment.teacherId];
                  const className = classMap[assignment.classId]?.name || 'Unknown';
                  const roomAssignment = roomAssignments.find(ra =>
                    ra.scheduleFileId === assignment.scheduleFileId &&
                    ra.subjectId === assignment.subjectId &&
                    ra.teacherId === assignment.teacherId &&
                    ra.classId === assignment.classId
                  );
                  const roomName = roomAssignment ? (roomMap[roomAssignment.roomId]?.name || 'N/A') : 'N/A';
                  const bgColor = style.showCellBackground && teacher ? hexToRgba(teacher.color) : 'transparent';
                  html += `<td class="slot-cell" style="background-color: ${bgColor} !important;"><div class="cell-content"><span class="subject-name">${subject?.name || 'Unknown'}${mergeLabelHtml(style, assignment)}</span><span class="time-label">${assignment.timeSlot}</span><span class="teacher-name">${teacher?.honorifics ? teacher.honorifics + ' ' : ''}${teacher?.fullName || 'TBA'}</span><span class="room-name">Room: ${roomName}</span></div></td>`;
                }
              });
              html += `</tr>`;
            });

            html += `</tbody></table>`;
            html += `</div>`;
            blocksInPage += 1;
            if (blocksInPage >= perPage) closePage();
          }
          // END FIX
        }
      }
      if (pageOpen) closePage();
    } else if (type === 'room') {
      const roomsToExport = (id === 'all') ? rooms : rooms.filter(r => r.id === parseInt(id));
      if (!roomsToExport || roomsToExport.length === 0) {
        console.error("Export failed: Room not found for id:", id);
        return { success: false, message: "Room not found." };
      }
      // Header will be rendered per-page via .page-header
      let isFirstRoom = true;
      let roomIndex = 0;
      let blocksInPage = 0;
      let pageIndex = 0;
      let pageOpen = false;
      const openPage = () => {
        const cls = pageIndex === 0 ? 'first-page' : 'new-page';
        html += `<div class="page ${cls}"><div class="page-header"><div class="institution">GOLDEN GATE COLLEGES</div><h1>Room Schedule</h1></div><div class="page-content">`;
        pageOpen = true;
      };
      const closePage = () => {
        html += `</div><div class="page-footer">${signatureHtml(style)}</div></div>`;
        pageOpen = false;
        blocksInPage = 0;
        pageIndex += 1;
      };
      for (const room of roomsToExport) {
        const roomTimeAssignments = allTimeAssignments.filter(ta =>
          roomAssignments.some(ra =>
            ra.roomId === room.id &&
            ra.scheduleFileId === ta.scheduleFileId &&
            ra.subjectId === ta.subjectId &&
            ra.teacherId === ta.teacherId &&
            ra.classId === ta.classId
          )
        );

        if (roomTimeAssignments.length === 0) continue;

        if (!pageOpen) openPage();
        html += `<div class="schedule-block"><div class="room-title">Room: ${room.name}</div>`;
        isFirstRoom = false;
        roomIndex += 1;

        const roomGrid = {};
        dayOrder.forEach(day => {
          roomGrid[day] = [null, null, null, null];
        });

        roomTimeAssignments.forEach(assignment => {
          const blockIndex = getTimeBlockIndex(assignment.timeSlot);
          if (blockIndex !== -1) {
            if (!roomGrid[assignment.day][blockIndex]) {
              roomGrid[assignment.day][blockIndex] = assignment;
            }
          }
        });

        html += `<table class="${nextHeaderTableClass()}"><thead><tr><th class="time-block">Time</th>`;
        dayOrder.forEach(day => {
          html += `<th>${day}</th>`;
        });
        html += `</tr></thead><tbody>`;

        timeBlocks.forEach((block, blockIndex) => {
          html += `<tr><td class="time-block">${block}</td>`;
          dayOrder.forEach(day => {
            const assignment = roomGrid[day][blockIndex];
            if (!assignment) {
              html += `<td class="slot-cell"></td>`;
            } else {
              const subject = subjectMap[assignment.subjectId];
              const teacher = teacherMap[assignment.teacherId];
              const classObj = classMap[assignment.classId];
              const className = getDisplayClassName(assignment);
              const bgColor = style.showCellBackground && teacher ? hexToRgba(teacher.color) : 'transparent';
              html += `<td class="slot-cell" style="background-color: ${bgColor} !important;"><div class="cell-content"><span class="subject-name">${subject?.name || 'Unknown'}${mergeLabelHtml(style, assignment)}</span><span class="time-label">${assignment.timeSlot}</span><span class="teacher-name">${teacher?.honorifics ? teacher.honorifics + ' ' : ''}${teacher?.fullName || 'TBA'}</span><span class="class-name">Class: ${className}</span></div></td>`;
            }
          });
          html += `</tr>`;
        });

        html += `</tbody></table></div>`;
        blocksInPage += 1;
        if (blocksInPage >= perPage) closePage();
      }
      if (pageOpen) closePage();
    } else {
      console.error("Export failed: Invalid export type:", type);
      return { success: false, message: "Invalid export type. Use 'teacher', 'program', or 'room'." };
    }

    html += `</body></html>`;

    const defaultFilename = `schedule_${file.name || fileId}_${type}.pdf`;
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultFilename,
      filters: [{ name: "PDF Files", extensions: ["pdf"] }]
    });

    if (canceled || !filePath) {
      console.log("Export cancelled by user");
      return { success: false, message: "Export cancelled." };
    }

    const exportWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false
      }
    });

    try {
      const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
      await exportWindow.loadURL(dataUri);
      console.log("Export window loaded HTML content");
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log("Generating PDF...");
      const data = await exportWindow.webContents.printToPDF({
        landscape: style.orientation === 'landscape',
        marginsType: 1,
        pageSize: style.paperSize,
        printBackground: true
      });
      console.log("PDF generated successfully, writing to:", filePath);
      fs.writeFileSync(filePath, data);
      console.log("PDF file saved successfully:", filePath);
      exportWindow.close();
      return { success: true, message: "File exported as PDF!" };
    } catch (err) {
      console.error("Error in PDF generation:", err.message);
      exportWindow.close();
      return { success: false, message: "PDF generation failed: " + err.message };
    }
  } catch (err) {
    console.error("Export error:", err.message || err);
    return { success: false, message: "Export failed: " + (err.message || err) };
  }
});

ipcMain.handle("print-file", async (event, args = {}) => {
  const { fileId: rawFileId, type, id, style: styleArg } = args;
  console.log("Print requested - args:", args);

  const fileId = typeof rawFileId === 'string' ? parseInt(rawFileId) : rawFileId;
  if (!fileId) {
    console.error("Print failed: No fileId provided");
    return { success: false, message: "No file selected to print." };
  }

  const file = await new Promise((res, rej) => {
    db.get(`SELECT * FROM schedule_files WHERE id=? AND status='active'`, [fileId], (err, row) => {
      if (err) {
        console.error("Error fetching file:", err.message);
        return rej(err.message);
      }
      res(row || null);
    });
  });

  if (!file) {
    console.error("Print failed: File not found for fileId:", fileId);
    return { success: false, message: "Selected file not found." };
  }

  try {
    const style = normalizeExportStyle(styleArg);
    const nextHeaderTableClass = makeNextHeaderTableClass(style);
    const pageSizeCss = `${style.paperSize} ${style.orientation}`;
    const pageMarginCss =
      style.orientation === "landscape" && style.tablesPerPage === 1
        ? "15mm 20mm 30mm 20mm"
        : "5mm 10mm";
    const isOneTableLandscape = style.orientation === "landscape" && style.tablesPerPage === 1;
    const pageFooterReservePx = isOneTableLandscape ? 120 : 170;
    const pageSignGapPx = isOneTableLandscape ? 6 : 12;
    const docZoom = computeDocumentZoom(style);
    const blockGapPx = style.tablesPerPage >= 3 ? 28 : (style.tablesPerPage === 2 ? 20 : 14);
    const gridColor = `rgba(0,0,0,${style.gridLineOpacity})`;
    const gridBorder = `${style.gridLineWidth}px solid ${gridColor}`;
    const headerBg = style.headerBg;
    const cellAlpha = style.cellBgOpacity;

    const [
      timeAssignments,
      subjectAssignments,
      roomAssignments,
      mergeClassAssignments,
      mergeClasses,
      subjects,
      teachers,
      classes,
      rooms,
      programs
    ] = await Promise.all([
      new Promise((res, rej) => db.all(`SELECT * FROM time_assignments WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM subject_assignments WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM room_assignments WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM merge_class_assignments WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT id, name FROM merge_classes WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM subjects`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM teachers`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM classes`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM rooms`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM programs`, (e, r) => e ? rej(e.message) : res(r))),
    ]);

    const allTimeAssignments = [...timeAssignments];

    const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const timeSlots = [
      '7:00 - 10:00', '10:00 - 1:00', '1:00 - 4:00', '4:00 - 7:00'
    ];

    const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
    const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
    const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
    const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]));
    const programMap = Object.fromEntries(programs.map(p => [p.id, p]));
    const mergeNameMap = Object.fromEntries((mergeClasses || []).map(m => [m.id, m.name]));

    const getDisplayClassName = (assignment) => {
      const base = classMap[assignment.classId]?.name || 'Unknown';
      if (assignment.is_from_merge === 1 && assignment.merge_id != null) {
        return mergeNameMap[assignment.merge_id] || base;
      }
      return base;
    };

    function hexToRgba(hex, alpha = cellAlpha) {
      if (!hex || hex.length < 7) return 'transparent';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    let html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Schedule Print</title>
        <style>
          @page { size: ${pageSizeCss}; margin: ${pageMarginCss}; }
          * { box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            font-size: 14px;
            margin: 0;
            padding: 0;
            background: white;
            color: #000;
            zoom: ${docZoom};
            --block-gap: ${blockGapPx}px;
            --teacher-text-color: ${style.teacherTextColor};
            --time-text-color: ${style.timeTextColor};
            --room-text-color: ${style.roomTextColor};
            --teacher-text-weight: ${style.teacherTextBold ? "bold" : "normal"};
            --time-text-weight: ${style.timeTextBold ? "bold" : "normal"};
            --room-text-weight: ${style.roomTextBold ? "bold" : "normal"};
            --page-footer-reserve: ${pageFooterReservePx}px;
            --page-sign-gap: ${pageSignGapPx}px;
          }
          h1 {
            text-align: center;
            font-size: 16px;
            margin: 8px 0;
            color: #000;
          }
          .institution {
            text-align: center;
            font-weight: bold;
            margin-bottom: 8px;
            font-size: 14px;
            color: #000;
          }
          .year-level-title, .room-title, .teacher-title {
            text-align: center;
            font-weight: bold;
            font-size: 14px;
            margin: 20px 0 15px 0;
            color: #000;
          }
          .first-page {
            page-break-before: avoid;
            break-before: avoid;
          }
          .new-page {
            page-break-before: always;
            break-before: page;
          }
          .page {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 100vh;
            position: relative;
          }
          .page-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: var(--block-gap);
            padding-top: 86px;
            padding-bottom: var(--page-footer-reserve);
          }
          .page-header {
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            background: white;
          }
          .page-header .institution {
            margin: 8px 0 0 0;
          }
          .page-header h1 {
            margin: 4px 0 8px 0;
          }
          .page-footer {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
          }
          .schedule-block {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .page .year-level-title,
          .page .room-title {
            margin: 0 0 8px 0;
          }
          .page .sign-section {
            margin-top: var(--page-sign-gap);
          }
          .page-content table {
            margin-bottom: 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background: white;
            table-layout: fixed;
          }
          thead tr {
            background: transparent !important;
          }
          th {
            border: ${gridBorder};
            padding: 8px;
            vertical-align: middle;
            background: ${headerBg} !important;
            color: #000 !important;
            font-size: 13px;
            font-weight: bold;
            text-align: center;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          ${style.headerAltEnabled ? `.hdr-alt th{background:${style.headerBgAlt} !important;}` : ""}
          td {
            border: ${gridBorder};
            padding: 6px;
            vertical-align: middle;
            word-break: break-word;
            background: white;
            color: #000;
            font-size: 12px;
            height: 70px;
            text-align: center;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .time-block {
            width: 90px !important;
            font-size: 12px;
            background: white !important;
            color: #000 !important;
            white-space: nowrap;
            font-weight: bold;
            vertical-align: middle;
          }
          .slot-cell {
            padding: 6px;
            font-size: 12px;
            white-space: normal;
            word-wrap: break-word;
            overflow-wrap: break-word;
            line-height: 1.2;
            text-align: center;
          }
          .cell-content {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100%;
            gap: 2px;
          }
          .subject-name {
            font-weight: bold;
            display: block;
            word-break: break-word;
            white-space: normal;
            color: #000;
            font-size: 11px;
            line-height: 1.2;
          }
          .time-label {
            display: block;
            font-size: 10px;
            color: var(--time-text-color);
            font-weight: var(--time-text-weight);
            line-height: 1.1;
          }
          .teacher-name {
            display: block;
            font-size: 10px;
            color: var(--teacher-text-color);
            font-weight: var(--teacher-text-weight);
            word-break: break-word;
            white-space: normal;
            line-height: 1.1;
          }
          .class-name {
            display: block;
            font-size: 10px;
            color: #000;
            word-break: break-word;
            line-height: 1.1;
          }
          .program-name {
            display: block;
            font-size: 10px;
            color: #000;
            word-break: break-word;
            line-height: 1.1;
          }
          .room-name {
            display: block;
            font-size: 10px;
            color: var(--room-text-color);
            font-weight: var(--room-text-weight);
            line-height: 1.1;
          }
          .sign-section {
            width: 100%;
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            page-break-inside: avoid;
            font-size: 13px;
          }
          .sign-block {
            display: inline-block;
            text-align: ${style.signatureAlign};
            flex: 1;
          }
          .sign-line {
            width: 200px;
            border-bottom: ${gridBorder};
            margin: 30px auto 5px auto;
          }
          .sign-names {
            margin-top: 5px;
            font-weight: bold;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
    `;

    if (type === 'teacher') {
      const teacherId = parseInt(id);
      const teacher = teacherMap[teacherId];
      if (!teacher) {
        console.error("Print failed: Teacher not found for id:", teacherId);
        return { success: false, message: "Teacher not found." };
      }
      const teacherTimeAssignments = allTimeAssignments.filter(a => parseInt(a.teacherId) === teacherId);
      html += `
        <div class="institution">GOLDEN GATE COLLEGES</div>
        <h1>Teacher Schedule</h1>
        <div class="teacher-title">${teacher.honorifics ? teacher.honorifics + ' ' : ''}${teacher.fullName}</div>`;

      const teacherGrid = {};
      dayOrder.forEach(day => {
        teacherGrid[day] = [null, null, null, null];
      });

      teacherTimeAssignments.forEach(assignment => {
        const blockIndex = getTimeBlockIndex(assignment.timeSlot);
        if (blockIndex !== -1) {
          if (!teacherGrid[assignment.day][blockIndex]) {
            teacherGrid[assignment.day][blockIndex] = assignment;
          }
        }
      });

      html += `<table class="${nextHeaderTableClass()}"><thead><tr><th class="time-block">Time</th>`;
      dayOrder.forEach(day => {
        html += `<th>${day}</th>`;
      });
      html += `</tr></thead><tbody>`;

      timeSlots.forEach((block, blockIndex) => {
        html += `<tr><td class="time-block">${block}</td>`;
        dayOrder.forEach(day => {
          const assignment = teacherGrid[day][blockIndex];
          if (!assignment) {
            html += `<td class="slot-cell"></td>`;
          } else {
            const subject = subjectMap[assignment.subjectId];
            const className = getDisplayClassName(assignment);
            const roomAssignment = roomAssignments.find(ra =>
              ra.scheduleFileId === assignment.scheduleFileId &&
              ra.subjectId === assignment.subjectId &&
              ra.teacherId === assignment.teacherId &&
              ra.classId === assignment.classId
            );
            const roomName = roomAssignment ? (roomMap[roomAssignment.roomId]?.name || 'N/A') : 'N/A';
            const bgColor = style.showCellBackground ? hexToRgba(teacher.color) : 'transparent';
            html += `<td class="slot-cell" style="background-color: ${bgColor} !important;"><div class="cell-content"><span class="subject-name">${subject?.name || 'Unknown'}${mergeLabelHtml(style, assignment)}</span><span class="time-label">${assignment.timeSlot}</span><span class="class-name">${className}</span><span class="room-name">Room: ${roomName}</span></div></td>`;
          }
        });
        html += `</tr>`;
      });

      html += `</tbody></table>`;
      html += signatureHtml(style);

    } else if (type === 'program') {
      const programsToExport = (id === 'all') ? programs : programs.filter(p => p.id === parseInt(id));
      if (!programsToExport || programsToExport.length === 0) {
        console.error("Print failed: Program not found for id:", id);
        return { success: false, message: "Program not found." };
      }
      // Header will be rendered per-page via .page-header
      const perPage = style.tablesPerPage;
      let isFirstYearLevel = true;
      let programBlockIndex = 0;
      let blocksInPage = 0;
      let pageIndex = 0;
      let pageOpen = false;
      const openPage = () => {
        const cls = pageIndex === 0 ? 'first-page' : 'new-page';
        html += `<div class="page ${cls}"><div class="page-header"><div class="institution">GOLDEN GATE COLLEGES</div><h1>Program Schedule</h1></div><div class="page-content">`;
        pageOpen = true;
      };
      const closePage = () => {
        html += `</div><div class="page-footer">${signatureHtml(style)}</div></div>`;
        pageOpen = false;
        blocksInPage = 0;
        pageIndex += 1;
      };
      for (const program of programsToExport) {
        const programClasses = classes.filter(c => c.programId === program.id);
        const classIds = programClasses.map(c => c.id);
        const programTimeAssignments = allTimeAssignments.filter(a => classIds.includes(a.classId));
        const yearLevels = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', '7th Year', '8th Year', '9th Year', '10th Year'];

        for (const yearLevel of yearLevels) {
          const yearClasses = programClasses.filter(c => c.yearLevel === yearLevel);
          const yearClassIds = yearClasses.map(c => c.id);
          const yearAssignments = programTimeAssignments.filter(a => yearClassIds.includes(a.classId));
          if (yearAssignments.length === 0) continue;

          if (!pageOpen) openPage();
          html += `<div class="schedule-block"><div class="year-level-title">${yearLevel} - ${program.name}</div>`;
          isFirstYearLevel = false;
          programBlockIndex += 1;

          const scheduleGrid = {};
          dayOrder.forEach(day => {
            scheduleGrid[day] = [null, null, null, null];
          });

          yearAssignments.forEach(assignment => {
            const blockIndex = getTimeBlockIndex(assignment.timeSlot);
            if (blockIndex !== -1) {
              if (!scheduleGrid[assignment.day][blockIndex]) {
                scheduleGrid[assignment.day][blockIndex] = assignment;
              }
            }
          });

          html += `<table class="${nextHeaderTableClass()}"><thead><tr><th class="time-block">Time</th>`;
          dayOrder.forEach(day => {
            html += `<th>${day}</th>`;
          });
          html += `</tr></thead><tbody>`;

          timeSlots.forEach((block, blockIndex) => {
            html += `<tr><td class="time-block">${block}</td>`;
            dayOrder.forEach(day => {
              const assignment = scheduleGrid[day][blockIndex];
              if (!assignment) {
                html += `<td class="slot-cell"></td>`;
              } else {
                const subject = subjectMap[assignment.subjectId];
                const teacher = teacherMap[assignment.teacherId];
                const className = classMap[assignment.classId]?.name || 'Unknown';
                const roomAssignment = roomAssignments.find(ra =>
                  ra.scheduleFileId === assignment.scheduleFileId &&
                  ra.subjectId === assignment.subjectId &&
                  ra.teacherId === assignment.teacherId &&
                  ra.classId === assignment.classId
                );
                const roomName = roomAssignment ? (roomMap[roomAssignment.roomId]?.name || 'N/A') : 'N/A';
                const bgColor = style.showCellBackground && teacher ? hexToRgba(teacher.color) : 'transparent';
                html += `<td class="slot-cell" style="background-color: ${bgColor} !important;"><div class="cell-content"><span class="subject-name">${subject?.name || 'Unknown'}${mergeLabelHtml(style, assignment)}</span><span class="time-label">${assignment.timeSlot}</span><span class="teacher-name">${teacher?.honorifics ? teacher.honorifics + ' ' : ''}${teacher?.fullName || 'TBA'}</span><span class="room-name">Room: ${roomName}</span></div></td>`;
              }
            });
            html += `</tr>`;
          });

          html += `</tbody></table></div>`;
          blocksInPage += 1;
          if (blocksInPage >= perPage) closePage();
        }
      }
      if (pageOpen) closePage();
    } else if (type === 'room') {
      const roomsToExport = (id === 'all') ? rooms : rooms.filter(r => r.id === parseInt(id));
      if (!roomsToExport || roomsToExport.length === 0) {
        console.error("Print failed: Room not found for id:", id);
        return { success: false, message: "Room not found." };
      }
      // Header will be rendered per-page via .page-header
      const perPage = style.tablesPerPage;
      let isFirstRoom = true;
      let roomIndex = 0;
      let blocksInPage = 0;
      let pageIndex = 0;
      let pageOpen = false;
      const openPage = () => {
        const cls = pageIndex === 0 ? 'first-page' : 'new-page';
        html += `<div class="page ${cls}"><div class="page-header"><div class="institution">GOLDEN GATE COLLEGES</div><h1>Room Schedule</h1></div><div class="page-content">`;
        pageOpen = true;
      };
      const closePage = () => {
        html += `</div><div class="page-footer">${signatureHtml(style)}</div></div>`;
        pageOpen = false;
        blocksInPage = 0;
        pageIndex += 1;
      };
      for (const room of roomsToExport) {
        const roomTimeAssignments = allTimeAssignments.filter(ta =>
          roomAssignments.some(ra =>
            ra.roomId === room.id &&
            ra.scheduleFileId === ta.scheduleFileId &&
            ra.subjectId === ta.subjectId &&
            ra.teacherId === ta.teacherId &&
            ra.classId === ta.classId
          )
        );

        if (roomTimeAssignments.length === 0) continue;

        if (!pageOpen) openPage();
        html += `<div class="schedule-block"><div class="room-title">Room: ${room.name}</div>`;
        isFirstRoom = false;
        roomIndex += 1;

        const roomGrid = {};
        dayOrder.forEach(day => {
          roomGrid[day] = [null, null, null, null];
        });

        roomTimeAssignments.forEach(assignment => {
          const blockIndex = getTimeBlockIndex(assignment.timeSlot);
          if (blockIndex !== -1) {
            if (!roomGrid[assignment.day][blockIndex]) {
              roomGrid[assignment.day][blockIndex] = assignment;
            }
          }
        });

        html += `<table class="${nextHeaderTableClass()}"><thead><tr><th class="time-block">Time</th>`;
        dayOrder.forEach(day => {
          html += `<th>${day}</th>`;
        });
        html += `</tr></thead><tbody>`;

        timeSlots.forEach((block, blockIndex) => {
          html += `<tr><td class="time-block">${block}</td>`;
          dayOrder.forEach(day => {
            const assignment = roomGrid[day][blockIndex];
            if (!assignment) {
              html += `<td class="slot-cell"></td>`;
            } else {
              const subject = subjectMap[assignment.subjectId];
              const teacher = teacherMap[assignment.teacherId];
              const classObj = classMap[assignment.classId];
              const className = getDisplayClassName(assignment);
              const program = classObj ? programMap[classObj.programId] : null;
              const programName = program?.name || 'Unknown';
              const bgColor = style.showCellBackground && teacher ? hexToRgba(teacher.color) : 'transparent';
              html += `<td class="slot-cell" style="background-color: ${bgColor} !important;"><div class="cell-content"><span class="subject-name">${subject?.name || 'Unknown'}${mergeLabelHtml(style, assignment)}</span><span class="time-label">${assignment.timeSlot}</span><span class="teacher-name">${teacher?.honorifics ? teacher.honorifics + ' ' : ''}${teacher?.fullName || 'TBA'}</span><span class="class-name">Class: ${className}</span><span class="program-name">Program: ${programName}</span></div></td>`;
            }
          });
          html += `</tr>`;
        });

        html += `</tbody></table></div>`;
        blocksInPage += 1;
        if (blocksInPage >= perPage) closePage();
      }
      if (pageOpen) closePage();
    } else {
      console.error("Print failed: Invalid print type:", type);
      return { success: false, message: "Invalid print type. Use 'teacher', 'program', or 'room'." };
    }

    html += `</body></html>`;

    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false
      }
    });

    try {
      const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
      await printWindow.loadURL(dataUri);
      console.log("Print window loaded HTML content");
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log("Sending to printer...");
      return await new Promise((resolve, reject) => {
        printWindow.webContents.print({
          landscape: style.orientation === 'landscape',
          marginsType: 1,
          pageSize: style.paperSize
        }, (success, failureReason) => {
          console.log("Print operation result:", success ? "Success" : `Failed: ${failureReason}`);
          printWindow.close();
          if (success) {
            resolve({ success: true, message: "File sent to printer!" });
          } else {
            reject({ success: false, message: "Print failed: " + (failureReason || "Unknown error") });
          }
        });
      });
    } catch (err) {
      console.error("Error in print operation:", err.message);
      printWindow.close();
      return { success: false, message: "Print failed: " + err.message };
    }
  } catch (err) {
    console.error("Print error:", err.message || err);
    return { success: false, message: "Print failed: " + (err.message || err) };
  }
});

ipcMain.handle("get-all-schedule-files", () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM schedule_files ORDER BY updatedAt DESC`, (err, rows) => {
      if (err) {
        console.error("Get all files error:", err.message);
        reject(err.message);
      } else {
        resolve(rows || []);
      }
    });
  });
});

ipcMain.handle("delete-schedule-file", (event, id) => {
  return new Promise((resolve, reject) => {
    const run = (sql, params) => new Promise((res, rej) => db.run(sql, params, (err) => (err ? rej(err) : res())));
    run(`DELETE FROM time_assignments WHERE scheduleFileId=?`, [id])
      .then(() => run(`DELETE FROM room_assignments WHERE scheduleFileId=?`, [id]))
      .then(() => run(`DELETE FROM subject_assignments WHERE scheduleFileId=?`, [id]))
      .then(() => run(`DELETE FROM merge_class_assignments WHERE scheduleFileId=?`, [id]))
      .then(() => run(`DELETE FROM merge_class_members WHERE mergeId IN (SELECT id FROM merge_classes WHERE scheduleFileId=?)`, [id]))
      .then(() => run(`DELETE FROM merge_classes WHERE scheduleFileId=?`, [id]))
      .then(() => run(`DELETE FROM schedule_files WHERE id=?`, [id]))
      .then(() => {
        if (openFiles.has(id)) openFiles.delete(id);
        resolve({ success: true, message: "File deleted!" });
      })
      .catch((err) => {
        console.error("Delete file/assignments error:", err.message);
        reject(err.message);
      });
  });
});

ipcMain.handle("archive-schedule-file", (event, id) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE schedule_files SET status='archived', updatedAt=? WHERE id=?`, [new Date().toISOString(), id], (err) => {
      if (err) {
        console.error("Archive file error:", err.message);
        reject(err.message);
        return;
      }
      if (openFiles.has(id)) {
        openFiles.delete(id);
      }
      resolve({ success: true, message: "File archived!" });
    });
  });
});

ipcMain.handle("save-teacher", (event, data) => {
  return new Promise((resolve, reject) => {
    if (!data.fullName || !data.color) {
      resolve({ success: false, message: "Full name and color are required" });
      return;
    }
    if (data.id) {
      db.run(
        `UPDATE teachers SET fullName=?, honorifics=?, color=? WHERE id=?`,
        [data.fullName, data.honorifics, data.color, data.id],
        (err) => (err ? reject(err.message) : resolve({ success: true }))
      );
    } else {
      db.run(
        `INSERT INTO teachers (fullName, honorifics, color) VALUES (?, ?, ?)`,
        [data.fullName, data.honorifics, data.color],
        function (err) {
          if (err) reject(err.message);
          else resolve({ success: true, id: this.lastID });
        }
      );
    }
  });
});

ipcMain.handle("delete-teacher", (event, id) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`DELETE FROM teacher_time_availability WHERE teacherId=?`, [id], (err) => {
        if (err) console.error("delete-teacher availability cleanup:", err.message);
      });
      db.run(`DELETE FROM teachers WHERE id=?`, [id], (err) => {
        if (err) reject(err.message);
        else resolve({ success: true });
      });
    });
  });
});

ipcMain.handle("get-subjects", () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM subjects`, (err, rows) => {
      if (err) reject(err.message);
      else resolve(rows || []);
    });
  });
});

ipcMain.handle("save-subject", (event, data) => {
  return new Promise((resolve, reject) => {
    if (!data.name || !data.code || !data.units) {
      resolve({ success: false, message: "Name, code, and units are required" });
      return;
    }
    if (data.id) {
      db.run(
        `UPDATE subjects SET name=?, code=?, units=?, semester=?, programId=?, yearLevel=? WHERE id=?`,
        [data.name, data.code, data.units, data.semester, data.programId, data.yearLevel, data.id],
        (err) => (err ? reject(err.message) : resolve({ success: true }))
      );
    } else {
      db.run(
        `INSERT INTO subjects (name, code, units, semester, programId, yearLevel) VALUES (?, ?, ?, ?, ?, ?)`,
        [data.name, data.code, data.units, data.semester, data.programId, data.yearLevel],
        function (err) {
          if (err) reject(err.message);
          else resolve({ success: true, id: this.lastID });
        }
      );
    }
  });
});

ipcMain.handle("delete-subject", (event, id) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM subjects WHERE id=?`, [id], (err) => {
      if (err) reject(err.message);
      else resolve({ success: true });
    });
  });
});

ipcMain.handle("get-rooms", () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM rooms`, (err, rows) => {
      if (err) reject(err.message);
      else resolve(rows || []);
    });
  });
});

ipcMain.handle("save-room", (event, data) => {
  return new Promise((resolve, reject) => {
    if (!data.name || !data.capacity) {
      resolve({ success: false, message: "Name and capacity are required" });
      return;
    }
    if (data.id) {
      db.run(
        `UPDATE rooms SET name=?, capacity=? WHERE id=?`,
        [data.name, data.capacity, data.id],
        (err) => (err ? reject(err.message) : resolve({ success: true }))
      );
    } else {
      db.run(
        `INSERT INTO rooms (name, capacity) VALUES (?, ?)`,
        [data.name, data.capacity],
        function (err) {
          if (err) reject(err.message);
          else resolve({ success: true, id: this.lastID });
        }
      );
    }
  });
});

ipcMain.handle("delete-room", (event, id) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM rooms WHERE id=?`, [id], (err) => {
      if (err) reject(err.message);
      else resolve({ success: true });
    });
  });
});

ipcMain.handle("save-program", (event, data) => {
  return new Promise((resolve, reject) => {
    if (!data.name || !data.years) {
      resolve({ success: false, message: "Name and years are required" });
      return;
    }
    if (data.id) {
      db.run(
        `UPDATE programs SET name=?, years=? WHERE id=?`,
        [data.name, data.years, data.id],
        (err) => {
          if (err) reject(err.message);
          else resolve({ success: true });
        }
      );
    } else {
      db.run(
        `INSERT INTO programs (name, years) VALUES (?, ?)`,
        [data.name, data.years],
        function (err) {
          if (err) reject(err.message);
          else resolve({ success: true, id: this.lastID });
        }
      );
    }
  });
});

ipcMain.handle("delete-program", (event, id) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM programs WHERE id=?`, [id], (err) => {
      if (err) reject(err.message);
      else resolve({ success: true });
    });
  });
});

// ipcMain.handle("get-classes", () => {
//   return new Promise((resolve, reject) => {
//     db.all(`SELECT * FROM classes`, (err, rows) => {
//       if (err) reject(err.message);
//       else resolve(rows || []);
//     });
//   });
// });

ipcMain.handle("save-class", (event, data) => {
  return new Promise((resolve, reject) => {
    if (!data.name || !data.students || !data.programId || !data.yearLevel) {
      resolve({ success: false, message: "All fields are required" });
      return;
    }
    if (data.id) {
      db.run(
        `UPDATE classes SET name=?, students=?, programId=?, yearLevel=? WHERE id=?`,
        [data.name, data.students, data.programId, data.yearLevel, data.id],
        (err) => (err ? reject(err.message) : resolve({ success: true }))
      );
    } else {
      db.run(
        `INSERT INTO classes (name, students, programId, yearLevel) VALUES (?, ?, ?, ?)`,
        [data.name, data.students, data.programId, data.yearLevel],
        function (err) {
          if (err) reject(err.message);
          else resolve({ success: true, id: this.lastID });
        }
      );
    }
  });
});

ipcMain.handle("delete-class", (event, id) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM classes WHERE id=?`, [id], (err) => {
      if (err) reject(err.message);
      else resolve({ success: true });
    });
  });
});

ipcMain.handle("get-assignments", (event, fileId) => {
  return new Promise((resolve, reject) => {
    if (!fileId) {
      resolve({ success: false, message: "File ID is required" });
      return;
    }
    Promise.all([
      new Promise((res, rej) => {
        db.all(`SELECT *, 'subject' as type FROM subject_assignments WHERE scheduleFileId = ?`, [fileId], (err, rows) => {
          if (err) rej(err.message);
          else res(rows || []);
        });
      }),
      new Promise((res, rej) => {
        db.all(`SELECT *, 'time' as type FROM time_assignments WHERE scheduleFileId = ?`, [fileId], (err, rows) => {
          if (err) rej(err.message);
          else res(rows || []);
        });
      }),
      new Promise((res, rej) => {
        db.all(`SELECT *, 'room' as type FROM room_assignments WHERE scheduleFileId = ?`, [fileId], (err, rows) => {
          if (err) rej(err.message);
          else res(rows || []);
        });
      }),
      new Promise((res, rej) => {
        db.all(`SELECT id, name FROM merge_classes WHERE scheduleFileId = ?`, [fileId], (err, rows) => {
          if (err) rej(err.message);
          else res(rows || []);
        });
      }),
    ]).then(([subjects, times, rooms, mergeClasses]) => {
      const mergeNameMap = Object.fromEntries((mergeClasses || []).map((m) => [m.id, m.name]));
      const withMergeInfo = (row) => ({
        ...row,
        merge_id: row.merge_id ?? null,
        is_from_merge: row.is_from_merge ?? 0,
        merge_name: row.merge_id ? (mergeNameMap[row.merge_id] || null) : null,
      });
      const timesWithMerge = (times || []).map(withMergeInfo);
      const roomsWithMerge = (rooms || []).map(withMergeInfo);
      resolve([...subjects, ...timesWithMerge, ...roomsWithMerge]);
    }).catch(reject);
  });
});

ipcMain.handle("assign-teacher-to-subject", (event, data) => {
  return new Promise((resolve, reject) => {
    if (!data.scheduleFileId || !data.subjectId || !data.teacherId) {
      resolve({ success: false, message: "All fields are required" });
      return;
    }
    const id = uuidv4();
    db.run(
      `INSERT INTO subject_assignments (id, scheduleFileId, subjectId, teacherId) VALUES (?, ?, ?, ?)`,
      [id, data.scheduleFileId, data.subjectId, data.teacherId],
      (err) => {
        if (err) reject(err.message);
        else {
          db.run(
            `UPDATE schedule_files SET updatedAt=? WHERE id=?`,
            [new Date().toISOString(), data.scheduleFileId],
            (err) => {
              if (err) console.error("Update file timestamp error:", err.message);
              // Keep timetable in sync: fill missing teacherIds for this subject
              db.run(
                `UPDATE time_assignments SET teacherId=? WHERE scheduleFileId=? AND subjectId=? AND teacherId IS NULL`,
                [data.teacherId, data.scheduleFileId, data.subjectId],
                (e1) => {
                  if (e1) return reject(e1.message);
                  db.run(
                    `UPDATE room_assignments SET teacherId=? WHERE scheduleFileId=? AND subjectId=? AND teacherId IS NULL`,
                    [data.teacherId, data.scheduleFileId, data.subjectId],
                    (e2) => (e2 ? reject(e2.message) : resolve({ success: true, id }))
                  );
                }
              );
            }
          );
        }
      }
    );
  });
});

ipcMain.handle("assign-time-slot", (event, data) => {
  return new Promise((resolve, reject) => {
    // Remove teacherId from required fields check
    if (!data.scheduleFileId || !data.subjectId || !data.classId || !data.day || !data.timeSlot || !data.duration) {
      resolve({ success: false, message: "Schedule file, subject, class, day, time slot, and duration are required" });
      return;
    }
    validateTeacherAvailability(data.scheduleFileId, data.teacherId || null, data.day, data.timeSlot, data.duration, null)
      .then((v) => {
        if (!v.valid) return resolve({ success: false, message: v.message || "Teacher conflict detected." });
        return validateTeacherTimeAvailabilityConstraint(data.teacherId || null, data.day, data.timeSlot, data.duration).then((av) => {
          if (!av.valid) return resolve({ success: false, message: av.message || "Teacher is not available at this time." });
          const id = uuidv4();
          db.run(
            `INSERT INTO time_assignments (id, scheduleFileId, subjectId, teacherId, classId, day, timeSlot, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, data.scheduleFileId, data.subjectId, data.teacherId || null, data.classId, data.day, data.timeSlot, data.duration],
            (err) => {
              if (err) reject(err.message);
              else {
                db.run(
                  `UPDATE schedule_files SET updatedAt=? WHERE id=?`,
                  [new Date().toISOString(), data.scheduleFileId],
                  (err) => {
                    if (err) console.error("Update file timestamp error:", err.message);
                    // If a teacher is chosen, also record it in subject_assignments for Subject Assign screen
                    const teacherId = data.teacherId || null;
                    if (!teacherId) return resolve({ success: true, id });
                    db.get(
                      `SELECT id, teacherId FROM subject_assignments WHERE scheduleFileId=? AND subjectId=?`,
                      [data.scheduleFileId, data.subjectId],
                      (e0, row) => {
                        if (e0) return reject(e0.message);
                        if (row) {
                          if (String(row.teacherId) === String(teacherId)) return resolve({ success: true, id });
                          db.run(
                            `UPDATE subject_assignments SET teacherId=? WHERE id=?`,
                            [teacherId, row.id],
                            (e1) => (e1 ? reject(e1.message) : resolve({ success: true, id }))
                          );
                        } else {
                          const sid = uuidv4();
                          db.run(
                            `INSERT INTO subject_assignments (id, scheduleFileId, subjectId, teacherId) VALUES (?, ?, ?, ?)`,
                            [sid, data.scheduleFileId, data.subjectId, teacherId],
                            (e2) => (e2 ? reject(e2.message) : resolve({ success: true, id }))
                          );
                        }
                      }
                    );
                  }
                );
              }
            }
          );
        });
      })
      .catch(reject);
  });
});

ipcMain.handle("assign-room", (event, data) => {
  return new Promise((resolve, reject) => {
    // Remove teacherId from required fields check
    if (!data.scheduleFileId || !data.subjectId || !data.classId || !data.roomId) {
      resolve({ success: false, message: "Schedule file, subject, class, and room are required" });
      return;
    }
    const id = uuidv4();
    db.run(
      `INSERT INTO room_assignments (id, scheduleFileId, subjectId, teacherId, classId, roomId) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.scheduleFileId, data.subjectId, data.teacherId || null, data.classId, data.roomId],
      (err) => {
        if (err) reject(err.message);
        else {
          db.run(
            `UPDATE schedule_files SET updatedAt=? WHERE id=?`,
            [new Date().toISOString(), data.scheduleFileId],
            (err) => {
              if (err) console.error("Update file timestamp error:", err.message);
              resolve({ success: true, id });
            }
          );
        }
      }
    );
  });
});

ipcMain.handle("delete-assignment", (event, id) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT scheduleFileId FROM subject_assignments WHERE id = ?`, [id], (err, row) => {
      if (err) {
        reject(err.message);
        return;
      }
      if (row) {
        db.run(`DELETE FROM subject_assignments WHERE id = ?`, [id], (err) => {
          if (err) reject(err.message);
          else {
            db.run(
              `UPDATE schedule_files SET updatedAt=? WHERE id=?`,
              [new Date().toISOString(), row.scheduleFileId],
              (err) => {
                if (err) console.error("Update file timestamp error:", err.message);
                resolve({ success: true });
              }
            );
          }
        });
        return;
      }
      db.get(`SELECT scheduleFileId, is_from_merge FROM time_assignments WHERE id = ?`, [id], (err, row) => {
        if (err) {
          reject(err.message);
          return;
        }
        if (row) {
          if (row.is_from_merge === 1) {
            resolve({ success: false, message: "This schedule is managed in Merge Class. Remove it from the Merge Class interface." });
            return;
          }
          db.run(`DELETE FROM time_assignments WHERE id = ?`, [id], (err) => {
            if (err) reject(err.message);
            else {
              db.run(
                `UPDATE schedule_files SET updatedAt=? WHERE id=?`,
                [new Date().toISOString(), row.scheduleFileId],
                (err) => {
                  if (err) console.error("Update file timestamp error:", err.message);
                  resolve({ success: true });
                }
              );
            }
          });
          return;
        }
        db.get(`SELECT scheduleFileId, is_from_merge FROM room_assignments WHERE id = ?`, [id], (err, row) => {
          if (err) {
            reject(err.message);
            return;
          }
          if (row) {
            if (row.is_from_merge === 1) {
              resolve({ success: false, message: "This schedule is managed in Merge Class. Remove it from the Merge Class interface." });
              return;
            }
            db.run(`DELETE FROM room_assignments WHERE id = ?`, [id], (err) => {
              if (err) reject(err.message);
              else {
                db.run(
                  `UPDATE schedule_files SET updatedAt=? WHERE id=?`,
                  [new Date().toISOString(), row.scheduleFileId],
                  (err) => {
                    if (err) console.error("Update file timestamp error:", err.message);
                    resolve({ success: true });
                  }
                );
              }
            });
          } else {
            resolve({ success: false, message: "Assignment not found" });
          }
        });
      });
    });
  });
});

ipcMain.handle("update-teacher-subject-assignment", (event, data) => {
  return new Promise((resolve, reject) => {
    if (!data.id || !data.scheduleFileId || !data.subjectId || !data.teacherId) {
      resolve({ success: false, message: "All fields are required" });
      return;
    }
    db.run(
      `UPDATE subject_assignments SET subjectId=?, teacherId=? WHERE id=?`,
      [data.subjectId, data.teacherId, data.id],
      (err) => {
        if (err) reject(err.message);
        else {
          db.run(
            `UPDATE schedule_files SET updatedAt=? WHERE id=?`,
            [new Date().toISOString(), data.scheduleFileId],
            (err) => {
              if (err) console.error("Update file timestamp error:", err.message);
              // Keep timetable in sync: fill missing teacherIds for this subject
              db.run(
                `UPDATE time_assignments SET teacherId=? WHERE scheduleFileId=? AND subjectId=? AND teacherId IS NULL`,
                [data.teacherId, data.scheduleFileId, data.subjectId],
                (e1) => {
                  if (e1) return reject(e1.message);
                  db.run(
                    `UPDATE room_assignments SET teacherId=? WHERE scheduleFileId=? AND subjectId=? AND teacherId IS NULL`,
                    [data.teacherId, data.scheduleFileId, data.subjectId],
                    (e2) => (e2 ? reject(e2.message) : resolve({ success: true }))
                  );
                }
              );
            }
          );
        }
      }
    );
  });
});








ipcMain.handle("update-time-slot-assignment", (event, data) => {
  return new Promise((resolve, reject) => {
    // teacherId can be null/empty (subject not assigned to a teacher yet)
    if (!data.id || !data.scheduleFileId || !data.subjectId || !data.classId || !data.day || !data.timeSlot || !data.duration) {
      resolve({ success: false, message: "All fields are required" });
      return;
    }
    const teacherId = data.teacherId || null;
    db.get(`SELECT subjectId, teacherId, classId, is_from_merge FROM time_assignments WHERE id = ?`, [data.id], (err, row) => {
      if (err) return reject(err.message);
      if (!row) return resolve({ success: false, message: "Assignment not found." });
      if (row.is_from_merge === 1) {
        return resolve({ success: false, message: "This schedule is managed in Merge Class. Edit it from the Merge Class interface." });
      }
      const prevTeacherId = row.teacherId ?? null;
      const prevSubjectId = row.subjectId ?? null;
      const prevClassId = row.classId ?? null;
      validateTeacherAvailability(data.scheduleFileId, teacherId, data.day, data.timeSlot, data.duration, data.id)
        .then((v) => {
          if (!v.valid) return resolve({ success: false, message: v.message || "Teacher conflict detected." });
          return validateTeacherTimeAvailabilityConstraint(teacherId, data.day, data.timeSlot, data.duration).then((av) => {
            if (!av.valid) return resolve({ success: false, message: av.message || "Teacher is not available at this time." });
            db.run(
              `UPDATE time_assignments SET subjectId=?, teacherId=?, classId=?, day=?, timeSlot=?, duration=? WHERE id=?`,
              [data.subjectId, teacherId, data.classId, data.day, data.timeSlot, data.duration, data.id],
              (err) => {
                if (err) reject(err.message);
                else {
                  db.run(
                    `UPDATE schedule_files SET updatedAt=? WHERE id=?`,
                    [new Date().toISOString(), data.scheduleFileId],
                    (err) => {
                      if (err) console.error("Update file timestamp error:", err.message);
                      const nextTeacherId = teacherId || null;
                      if (!nextTeacherId) return resolve({ success: true });

                      // 1) Upsert subject_assignments so Assign Management reflects timetable teacher changes
                      db.get(
                        `SELECT id, teacherId FROM subject_assignments WHERE scheduleFileId=? AND subjectId=?`,
                        [data.scheduleFileId, data.subjectId],
                        (e0, srow) => {
                          if (e0) return reject(e0.message);

                          const afterSubjectUpsert = () => {
                            // 2) If a room assignment exists with the previous teacher, move it to the new teacher
                            const subjectIdForRoom = prevSubjectId ?? data.subjectId;
                            const classIdForRoom = prevClassId ?? data.classId;
                            if (prevTeacherId == null) {
                              db.run(
                                `UPDATE room_assignments SET teacherId=? WHERE scheduleFileId=? AND subjectId=? AND classId=? AND teacherId IS NULL`,
                                [nextTeacherId, data.scheduleFileId, subjectIdForRoom, classIdForRoom],
                                (eR) => (eR ? reject(eR.message) : resolve({ success: true }))
                              );
                            } else {
                              db.run(
                                `UPDATE room_assignments SET teacherId=? WHERE scheduleFileId=? AND subjectId=? AND classId=? AND teacherId=?`,
                                [nextTeacherId, data.scheduleFileId, subjectIdForRoom, classIdForRoom, prevTeacherId],
                                (eR) => (eR ? reject(eR.message) : resolve({ success: true }))
                              );
                            }
                          };

                          if (srow) {
                            if (String(srow.teacherId) === String(nextTeacherId)) return afterSubjectUpsert();
                            db.run(
                              `UPDATE subject_assignments SET teacherId=? WHERE id=?`,
                              [nextTeacherId, srow.id],
                              (e1) => (e1 ? reject(e1.message) : afterSubjectUpsert())
                            );
                          } else {
                            const sid = uuidv4();
                            db.run(
                              `INSERT INTO subject_assignments (id, scheduleFileId, subjectId, teacherId) VALUES (?, ?, ?, ?)`,
                              [sid, data.scheduleFileId, data.subjectId, nextTeacherId],
                              (e2) => (e2 ? reject(e2.message) : afterSubjectUpsert())
                            );
                          }
                        }
                      );
                    }
                  );
                }
              }
            );
          });
        })
        .catch(reject);
    });
  });
});

ipcMain.handle("update-room-assignment", (event, data) => {
  return new Promise((resolve, reject) => {
    if (!data.id || !data.scheduleFileId || !data.subjectId || !data.teacherId || !data.classId || !data.roomId) {
      resolve({ success: false, message: "All fields are required, including teacher" });
      return;
    }
    db.get(`SELECT is_from_merge FROM room_assignments WHERE id = ?`, [data.id], (err, row) => {
      if (err) return reject(err.message);
      if (!row) return resolve({ success: false, message: "Assignment not found." });
      if (row.is_from_merge === 1) {
        return resolve({ success: false, message: "This schedule is managed in Merge Class. Edit it from the Merge Class interface." });
      }
      db.run(
        `UPDATE room_assignments SET subjectId=?, teacherId=?, classId=?, roomId=? WHERE id=?`,
        [data.subjectId, data.teacherId, data.classId, data.roomId, data.id],
        (err) => {
          if (err) reject(err.message);
          else {
            db.run(
              `UPDATE schedule_files SET updatedAt=? WHERE id=?`,
              [new Date().toISOString(), data.scheduleFileId],
              (err) => {
                if (err) console.error("Update file timestamp error:", err.message);
                resolve({ success: true });
              }
            );
          }
        }
      );
    });
  });
});

ipcMain.handle("get-classes", () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM classes ORDER BY name`, (err, rows) => {
      if (err) reject(err.message);
      else resolve(rows || []);
    });
  });
});

// ---------------- MERGE CLASS IPC (Phase 04) ----------------
ipcMain.handle("get-merge-list", (event, fileId) => {
  const scheduleFileId = fileId || (currentFile && currentFile.id);
  if (!scheduleFileId) return Promise.resolve({ success: false, message: "No schedule file selected.", list: [] });
  return mergeGetList(scheduleFileId).then((list) => ({ success: true, list })).catch((err) => ({ success: false, message: err.message || "Failed to load merge list.", list: [] }));
});
ipcMain.handle("get-available-classes-for-merge", (event, fileId) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM classes ORDER BY name`, (err, rows) => {
      if (err) reject(err.message);
      else resolve(rows || []);
    });
  });
});
ipcMain.handle("create-merged-class", (event, data) => {
  const scheduleFileId = data.scheduleFileId || (currentFile && currentFile.id);
  if (!scheduleFileId) return Promise.resolve({ success: false, message: "No schedule file selected." });
  return mergeCreate(scheduleFileId, data.name, data.classIds)
    .then((mergeId) => ({ success: true, mergeId }))
    .catch((err) => ({ success: false, message: err.message || "Failed to create merge." }));
});
ipcMain.handle("get-merged-class-details", (event, mergeId) => {
  return mergeGetDetails(mergeId)
    .then((details) => (details ? { success: true, details } : { success: false, message: "Merge not found." }))
    .catch((err) => ({ success: false, message: err.message || "Failed to load merge details.", details: null }));
});
ipcMain.handle("update-merged-class", (event, data) => {
  return mergeUpdate(data.mergeId, data.name, data.classIds)
    .then(() => ({ success: true }))
    .catch((err) => ({ success: false, message: err.message || "Failed to update merge." }));
});
ipcMain.handle("delete-merge-class", (event, mergeId) => {
  return mergeDelete(mergeId)
    .then(() => ({ success: true }))
    .catch((err) => ({ success: false, message: err.message || "Failed to delete merge." }));
});
ipcMain.handle("merge-add-subject", (event, data) => {
  const scheduleFileId = data.scheduleFileId || (currentFile && currentFile.id);
  if (!scheduleFileId) return Promise.resolve({ success: false, message: "No schedule file selected.", assignmentId: null });
  return mergeAddSubject(scheduleFileId, data.mergeId, data.subjectId, data.teacherId, data.roomId, data.day, data.timeSlot, data.duration)
    .then((assignmentId) => ({ success: true, assignmentId }))
    .catch((err) => ({ success: false, message: err.message || "Failed to add subject.", assignmentId: null }));
});
ipcMain.handle("merge-update-subject", (event, data) => {
  return mergeUpdateSubject(data.mergeId, data.assignmentId, data.teacherId, data.roomId, data.day, data.timeSlot, data.duration)
    .then(() => ({ success: true }))
    .catch((err) => ({ success: false, message: err.message || "Failed to update subject." }));
});
ipcMain.handle("merge-remove-subject", (event, data) => {
  return mergeRemoveSubject(data.mergeId, data.assignmentId)
    .then(() => ({ success: true }))
    .catch((err) => ({ success: false, message: err.message || "Failed to remove subject." }));
});





ipcMain.handle("reload-window", () => {
  if (mainWindow) {
    const isDev = !app.isPackaged; // 👈 add this line
    const startUrl = isDev
      ? `${(process.env.ELECTRON_START_URL || "http://localhost:5173").replace(/\/$/, "")}/#/`
      : `file://${path.join(__dirname, "../dist/index.html")}#/`;

    console.log("isDev:", isDev);
    console.log("startUrl:", startUrl);
    mainWindow.loadURL(startUrl);
    return { success: true, message: "Window reloaded" };
  }
  return { success: false, message: "No main window available" };
});

ipcMain.handle("generate-preview", async (event, args = {}) => {
  const { fileId: rawFileId, type, id, style: styleArg } = args;
  console.log("Preview requested - args:", args);

  const fileId = typeof rawFileId === 'string' ? parseInt(rawFileId) : rawFileId;
  if (!fileId) {
    console.error("Preview failed: No fileId provided");
    return { success: false, message: "No file selected to preview." };
  }

  const file = await new Promise((res, rej) => {
    db.get(`SELECT * FROM schedule_files WHERE id=? AND status='active'`, [fileId], (err, row) => {
      if (err) {
        console.error("Error fetching file:", err.message);
        return rej(err.message);
      }
      res(row || null);
    });
  });
  if (!file) {
    console.error(" File not found for fileId:", fileId);
    return { success: false, message: "Selected file not found." };
  }

  try {
    const style = normalizeExportStyle(styleArg);
    const pageSizeCss = `${style.paperSize} ${style.orientation}`;
    const pageMarginCss =
      style.orientation === "landscape" && style.tablesPerPage === 1
        ? "15mm 20mm 30mm 20mm"
        : "5mm 10mm";
    const isOneTableLandscape = style.orientation === "landscape" && style.tablesPerPage === 1;
    const pageFooterReservePx = isOneTableLandscape ? 120 : 170;
    const pageSignGapPx = isOneTableLandscape ? 6 : 12;
    const docZoom = computeDocumentZoom(style);
    const blockGapPx = style.tablesPerPage >= 3 ? 28 : (style.tablesPerPage === 2 ? 20 : 14);
    const nextHeaderTableClass = makeNextHeaderTableClass(style);
    const gridColor = `rgba(0,0,0,${style.gridLineOpacity})`;
    const gridBorder = `${style.gridLineWidth}px solid ${gridColor}`;
    const headerBg = style.headerBg;
    const cellAlpha = style.cellBgOpacity;

    const [
      timeAssignments,
      subjectAssignments,
      roomAssignments,
      mergeClasses,
      subjects,
      teachers,
      classes,
      rooms,
      programs
    ] = await Promise.all([
      new Promise((res, rej) => db.all(`SELECT * FROM time_assignments WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM subject_assignments WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM room_assignments WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT id, name FROM merge_classes WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM subjects`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM teachers`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM classes`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM rooms`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM programs`, (e, r) => e ? rej(e.message) : res(r))),
    ]);

    const allTimeAssignments = [...timeAssignments];

    const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const timeBlocks = ['7:00 - 10:00', '10:00 - 1:00', '1:00 - 4:00', '4:00 - 7:00'];

    const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
    const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
    const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
    const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]));
    const programMap = Object.fromEntries(programs.map(p => [p.id, p]));
    const mergeNameMap = Object.fromEntries((mergeClasses || []).map(m => [m.id, m.name]));

    const getDisplayClassName = (assignment) => {
      const base = classMap[assignment.classId]?.name || 'Unknown';
      if (assignment.is_from_merge === 1 && assignment.merge_id != null) {
        return mergeNameMap[assignment.merge_id] || base;
      }
      return base;
    };

    function hexToRgba(hex, alpha = cellAlpha) {
      if (!hex || hex.length < 7) return 'transparent';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Schedule Preview</title>
<style>
@page { size: ${pageSizeCss}; margin: ${pageMarginCss}; }
* { box-sizing: border-box; }
body {
  font-family: Arial, sans-serif;
  font-size: 14px;
  margin: 0;
  padding: 0;
  background: white;
  color: #000;
  --block-gap: ${blockGapPx}px;
  --teacher-text-color: ${style.teacherTextColor};
  --time-text-color: ${style.timeTextColor};
  --room-text-color: ${style.roomTextColor};
  --teacher-text-weight: ${style.teacherTextBold ? "bold" : "normal"};
  --time-text-weight: ${style.timeTextBold ? "bold" : "normal"};
  --room-text-weight: ${style.roomTextBold ? "bold" : "normal"};
  --page-footer-reserve: ${pageFooterReservePx}px;
  --page-sign-gap: ${pageSignGapPx}px;
}
.scale-root {
  transform: scale(${docZoom});
  transform-origin: top left;
  width: calc(100% / ${docZoom});
}
h1 {
  text-align: center;
  font-size: 16px;
  margin: 8px 0;
  color: #000;
}
.institution {
  text-align: center;
  font-weight: bold;
  margin-bottom: 8px;
  font-size: 14px;
  color: #000;
}
.year-level-title, .room-title, .teacher-title {
  text-align: center;
  font-weight: bold;
  font-size: 14px;
  margin: 20px 0 15px 0;
  color: #000;
}
.first-page {
  page-break-before: avoid;
  break-before: avoid;
}
.new-page {
  page-break-before: always;
  break-before: page;
}
.page {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 100vh;
  position: relative;
}
.page-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--block-gap);
  padding-top: 86px;
  padding-bottom: var(--page-footer-reserve);
}
.page-header {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  background: white;
}
.page-header .institution {
  margin: 8px 0 0 0;
}
.page-header h1 {
  margin: 4px 0 8px 0;
}
.page-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
}
.schedule-block {
  break-inside: avoid;
  page-break-inside: avoid;
}
.page .year-level-title,
.page .room-title {
  margin: 0 0 8px 0;
}
.page .sign-section {
  margin-top: var(--page-sign-gap);
}
.page-content table {
  margin-bottom: 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
  background: white;
  table-layout: fixed;
}
thead tr {
  background: transparent !important;
}
thead th {
  border: ${gridBorder} !important;
  padding: 8px !important;
  background: ${headerBg} !important;
  color: #000 !important;
  font-size: 13px !important;
  font-weight: bold !important;
  text-align: center !important;
  height: auto !important;
}
${style.headerAltEnabled ? `.hdr-alt thead th{background:${style.headerBgAlt} !important;}` : ""}
tbody td {
  border: ${gridBorder} !important;
  padding: 6px !important;
  vertical-align: middle !important;
  word-break: break-word !important;
  background: white !important;
  color: #000 !important;
  font-size: 12px !important;
  height: 70px !important;
  text-align: center !important;
}
.time-block {
  width: 90px !important;
  font-size: 12px !important;
  background: white !important;
  color: #000 !important;
  white-space: nowrap !important;
  font-weight: bold !important;
  vertical-align: middle !important;
}
.slot-cell {
  padding: 6px !important;
  font-size: 12px !important;
  white-space: normal !important;
  word-wrap: break-word !important;
  overflow-wrap: break-word !important;
  line-height: 1.2 !important;
  text-align: center !important;
  -webkit-print-color-adjust: exact !important;
  color-adjust: exact !important;
  print-color-adjust: exact !important;
}
.cell-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  gap: 2px;
}
.subject-name {
  font-weight: bold;
  display: block;
  word-break: break-word;
  white-space: normal;
  color: #000;
  font-size: 11px;
  line-height: 1.2;
}
.time-label {
  display: block;
  font-size: 10px;
  color: var(--time-text-color);
  font-weight: var(--time-text-weight);
  line-height: 1.1;
}
.teacher-name {
  display: block;
  font-size: 10px;
  color: var(--teacher-text-color);
  font-weight: var(--teacher-text-weight);
  word-break: break-word;
  white-space: normal;
  line-height: 1.1;
}
.class-name {
  display: block;
  font-size: 10px;
  color: #000;
  word-break: break-word;
  line-height: 1.1;
}
.room-name {
  display: block;
  font-size: 10px;
  color: var(--room-text-color);
  font-weight: var(--room-text-weight);
  line-height: 1.1;
}
.sign-section {
  width: 100%;
  margin-top: 40px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  page-break-inside: avoid;
  font-size: 13px;
}
.sign-block {
  display: inline-block;
  text-align: ${style.signatureAlign};
  flex: 1;
}
.sign-line {
  width: 200px;
  border-bottom: ${gridBorder};
  margin: 30px auto 5px auto;
}
.sign-names {
  margin-top: 5px;
  font-weight: bold;
  font-size: 12px;
}
</style>
</head>
<body>
<div class="scale-root">
`;

    if (type === 'teacher') {
      const teacherId = parseInt(id);
      const teacher = teacherMap[teacherId];
      if (!teacher) {
        console.error("Preview failed: Teacher not found for id:", teacherId);
        return { success: false, message: "Teacher not found." };
      }

      const teacherTimeAssignments = allTimeAssignments.filter(a => parseInt(a.teacherId) === teacherId);

      html += `
<div class="institution">GOLDEN GATE COLLEGES</div>
<h1>Teacher Schedule</h1>
<div class="teacher-title">${teacher.honorifics ? teacher.honorifics + ' ' : ''}${teacher.fullName}</div>`;

      const teacherGrid = {};
      dayOrder.forEach(day => {
        teacherGrid[day] = [null, null, null, null];
      });

      teacherTimeAssignments.forEach(assignment => {
        const blockIndex = getTimeBlockIndex(assignment.timeSlot);
        if (blockIndex !== -1) {
          if (!teacherGrid[assignment.day][blockIndex]) {
            teacherGrid[assignment.day][blockIndex] = assignment;
          }
        }
      });

      html += `<table class="${nextHeaderTableClass()}"><thead><tr><th class="time-block">Time</th>`;
      dayOrder.forEach(day => {
        html += `<th>${day}</th>`;
      });
      html += `</tr></thead><tbody>`;

      timeBlocks.forEach((block, blockIndex) => {
        html += `<tr><td class="time-block">${block}</td>`;
        dayOrder.forEach(day => {
          const assignment = teacherGrid[day][blockIndex];
          if (!assignment) {
            html += `<td class="slot-cell"></td>`;
          } else {
            const subject = subjectMap[assignment.subjectId];
            const className = getDisplayClassName(assignment);
            const roomAssignment = roomAssignments.find(ra =>
              ra.scheduleFileId === assignment.scheduleFileId &&
              ra.subjectId === assignment.subjectId &&
              ra.teacherId === assignment.teacherId &&
              ra.classId === assignment.classId
            );
            const roomName = roomAssignment ? (roomMap[roomAssignment.roomId]?.name || 'N/A') : 'N/A';
            const bgColor = style.showCellBackground ? hexToRgba(teacher.color) : 'transparent';
            html += `<td class="slot-cell" style="background-color: ${bgColor} !important"><div class="cell-content"><span class="subject-name">${subject?.name || 'Unknown'}${mergeLabelHtml(style, assignment)}</span><span class="time-label">${assignment.timeSlot}</span><span class="class-name">${className}</span><span class="room-name">Room: ${roomName}</span></div></td>`;
          }
        });
        html += `</tr>`;
      });

      html += `</tbody></table>${signatureHtml(style)}`;

    } else if (type === 'program') {
      const programsToExport = (id === 'all') ? programs : programs.filter(p => p.id === parseInt(id));
      if (!programsToExport || programsToExport.length === 0) {
        console.error("Preview failed: Program not found for id:", id);
        return { success: false, message: "Program not found." };
      }

      // Header will be rendered per-page via .page-header

      const perPage = style.tablesPerPage;
      let isFirstYearLevel = true;
      let programBlockIndex = 0;
      let blocksInPage = 0;
      let pageIndex = 0;
      let pageOpen = false;
      const openPage = () => {
        const cls = pageIndex === 0 ? 'first-page' : 'new-page';
        html += `<div class="page ${cls}"><div class="page-header"><div class="institution">GOLDEN GATE COLLEGES</div><h1>Program Schedule</h1></div><div class="page-content">`;
        pageOpen = true;
      };
      const closePage = () => {
        html += `</div><div class="page-footer">${signatureHtml(style)}</div></div>`;
        pageOpen = false;
        blocksInPage = 0;
        pageIndex += 1;
      };
      for (const program of programsToExport) {
        const programClasses = classes.filter(c => c.programId === program.id);
        const classIds = programClasses.map(c => c.id);
        const programTimeAssignments = allTimeAssignments.filter(a => classIds.includes(a.classId));
        const yearLevels = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', '7th Year', '8th Year', '9th Year', '10th Year'];

        for (const yearLevel of yearLevels) {
          const yearClasses = programClasses.filter(c => c.yearLevel === yearLevel);
          if (yearClasses.length === 0) continue;

          // Check if any assignments exist for this year level at all
          const yearClassIds = yearClasses.map(c => c.id);
          const yearAssignments = programTimeAssignments.filter(a => yearClassIds.includes(a.classId));
          if (yearAssignments.length === 0) continue;

          // --- FIX: Iterate each class separately to generate one table per class ---
          const sortedYearClasses = [...yearClasses].sort((a, b) => a.name.localeCompare(b.name));
          for (const classObj of sortedYearClasses) {
            const classAssignments = programTimeAssignments.filter(a => a.classId === classObj.id);
            if (classAssignments.length === 0) continue;

            if (!pageOpen) openPage();
            html += `<div class="schedule-block"><div class="year-level-title">${yearLevel} - ${program.name} (${classObj.name})</div>`;
            isFirstYearLevel = false;
            programBlockIndex += 1;

            const scheduleGrid = {};
            dayOrder.forEach(day => {
              scheduleGrid[day] = [null, null, null, null];
            });

            classAssignments.forEach(assignment => {
              const blockIndex = getTimeBlockIndex(assignment.timeSlot);
              if (blockIndex !== -1) {
                if (!scheduleGrid[assignment.day][blockIndex]) {
                  scheduleGrid[assignment.day][blockIndex] = assignment;
                }
              }
            });

            html += `<table class="${nextHeaderTableClass()}"><thead><tr><th class="time-block">Time</th>`;
            dayOrder.forEach(day => {
              html += `<th>${day}</th>`;
            });
            html += `</tr></thead><tbody>`;

            timeBlocks.forEach((block, blockIndex) => {
              html += `<tr><td class="time-block">${block}</td>`;
              dayOrder.forEach(day => {
                const assignment = scheduleGrid[day][blockIndex];
                if (!assignment) {
                  html += `<td class="slot-cell"></td>`;
                } else {
                  const subject = subjectMap[assignment.subjectId];
                  const teacher = teacherMap[assignment.teacherId];
                  const className = classMap[assignment.classId]?.name || 'Unknown';
                  const roomAssignment = roomAssignments.find(ra =>
                    ra.scheduleFileId === assignment.scheduleFileId &&
                    ra.subjectId === assignment.subjectId &&
                    ra.teacherId === assignment.teacherId &&
                    ra.classId === assignment.classId
                  );
                  const roomName = roomAssignment ? (roomMap[roomAssignment.roomId]?.name || 'N/A') : 'N/A';
                  const bgColor = style.showCellBackground && teacher ? hexToRgba(teacher.color) : 'transparent';
                  html += `<td class="slot-cell" style="background-color: ${bgColor} !important"><div class="cell-content"><span class="subject-name">${subject?.name || 'Unknown'}${mergeLabelHtml(style, assignment)}</span><span class="time-label">${assignment.timeSlot}</span><span class="teacher-name">${teacher?.honorifics ? teacher.honorifics + ' ' : ''}${teacher?.fullName || 'TBA'}</span><span class="room-name">Room: ${roomName}</span></div></td>`;
                }
              });
              html += `</tr>`;
            });

            html += `</tbody></table>`;
            html += `</div>`;
            blocksInPage += 1;
            if (blocksInPage >= perPage) closePage();
          }
          // --- END FIX ---
        }
      }
      if (pageOpen) closePage();
    } else if (type === 'room') {
      const roomsToExport = (id === 'all') ? rooms : rooms.filter(r => r.id === parseInt(id));
      if (!roomsToExport || roomsToExport.length === 0) {
        console.error("Preview failed: Room not found for id:", id);
        return { success: false, message: "Room not found." };
      }

      // Header will be rendered per-page via .page-header

      const perPage = style.tablesPerPage;
      let isFirstRoom = true;
      let roomIndex = 0;
      let blocksInPage = 0;
      let pageIndex = 0;
      let pageOpen = false;
      const openPage = () => {
        const cls = pageIndex === 0 ? 'first-page' : 'new-page';
        html += `<div class="page ${cls}"><div class="page-header"><div class="institution">GOLDEN GATE COLLEGES</div><h1>Room Schedule</h1></div><div class="page-content">`;
        pageOpen = true;
      };
      const closePage = () => {
        html += `</div><div class="page-footer">${signatureHtml(style)}</div></div>`;
        pageOpen = false;
        blocksInPage = 0;
        pageIndex += 1;
      };
      for (const room of roomsToExport) {
        const roomTimeAssignments = allTimeAssignments.filter(ta =>
          roomAssignments.some(ra =>
            ra.roomId === room.id &&
            ra.scheduleFileId === ta.scheduleFileId &&
            ra.subjectId === ta.subjectId &&
            ra.teacherId === ta.teacherId &&
            ra.classId === ta.classId
          )
        );

        if (roomTimeAssignments.length === 0) continue;

        if (!pageOpen) openPage();
        html += `<div class="schedule-block"><div class="room-title">Room: ${room.name}</div>`;
        isFirstRoom = false;
        roomIndex += 1;

        const roomGrid = {};
        dayOrder.forEach(day => {
          roomGrid[day] = [null, null, null, null];
        });

        roomTimeAssignments.forEach(assignment => {
          const blockIndex = getTimeBlockIndex(assignment.timeSlot);
          if (blockIndex !== -1) {
            if (!roomGrid[assignment.day][blockIndex]) {
              roomGrid[assignment.day][blockIndex] = assignment;
            }
          }
        });

        html += `<table class="${nextHeaderTableClass()}"><thead><tr><th class="time-block">Time</th>`;
        dayOrder.forEach(day => {
          html += `<th>${day}</th>`;
        });
        html += `</tr></thead><tbody>`;

        timeBlocks.forEach((block, blockIndex) => {
          html += `<tr><td class="time-block">${block}</td>`;
          dayOrder.forEach(day => {
            const assignment = roomGrid[day][blockIndex];
            if (!assignment) {
              html += `<td class="slot-cell"></td>`;
            } else {
              const subject = subjectMap[assignment.subjectId];
              const teacher = teacherMap[assignment.teacherId];
              const classObj = classMap[assignment.classId];
              const className = getDisplayClassName(assignment);
              const bgColor = style.showCellBackground && teacher ? hexToRgba(teacher.color) : 'transparent';
              html += `<td class="slot-cell" style="background-color: ${bgColor} !important;"><div class="cell-content"><span class="subject-name">${subject?.name || 'Unknown'}${mergeLabelHtml(style, assignment)}</span><span class="time-label">${assignment.timeSlot}</span><span class="teacher-name">${teacher?.honorifics ? teacher.honorifics + ' ' : ''}${teacher?.fullName || 'TBA'}</span><span class="class-name">Class: ${className}</span></div></td>`;
            }
          });
          html += `</tr>`;
        });

        html += `</tbody></table></div>`;
        blocksInPage += 1;
        if (blocksInPage >= perPage) closePage();
      }
      if (pageOpen) closePage();
    } else {
      console.error("Preview failed: Invalid export type:", type);
      return { success: false, message: "Invalid export type. Use 'teacher', 'program', or 'room'." };
    }

    html += `</div></body></html>`;
    return { success: true, html: html };

  } catch (err) {
    console.error("Preview error:", err.message || err);
    return { success: false, message: "Preview failed: " + (err.message || err) };
  }
});



ipcMain.handle("export-excel", async (event, args = {}) => {
  const ExcelJS = require("exceljs");

  const { fileId: rawFileId, type, id, style: styleArg } = args;
  const fileId = typeof rawFileId === "string" ? parseInt(rawFileId) : rawFileId;

  if (!fileId) return { success: false, message: "No file selected." };

  // ── Confirm schedule file exists ──────────────────────────────────────────
  const file = await new Promise((res, rej) => {
    db.get(`SELECT * FROM schedule_files WHERE id=? AND status='active'`, [fileId], (err, row) => {
      if (err) return rej(err.message);
      res(row || null);
    });
  });
  if (!file) return { success: false, message: "Selected file not found." };

  try {
    const style = normalizeExportStyle(styleArg);

    // ── Fetch all data (same as generate-preview) ─────────────────────────
    const [
      timeAssignments,
      subjectAssignments,
      roomAssignments,
      mergeClasses,
      subjects,
      teachers,
      classes,
      rooms,
      programs,
    ] = await Promise.all([
      new Promise((res, rej) => db.all(`SELECT * FROM time_assignments WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM subject_assignments WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM room_assignments WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT id, name FROM merge_classes WHERE scheduleFileId=?`, [fileId], (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM subjects`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM teachers`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM classes`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM rooms`, (e, r) => e ? rej(e.message) : res(r))),
      new Promise((res, rej) => db.all(`SELECT * FROM programs`, (e, r) => e ? rej(e.message) : res(r))),
    ]);

    const allTimeAssignments = [...timeAssignments];
    const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const timeBlocks = ["7:00 - 10:00", "10:00 - 1:00", "1:00 - 4:00", "4:00 - 7:00"];

    const subjectMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
    const teacherMap = Object.fromEntries(teachers.map((t) => [t.id, t]));
    const classMap = Object.fromEntries(classes.map((c) => [c.id, c]));
    const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]));
    const programMap = Object.fromEntries(programs.map((p) => [p.id, p]));
    const mergeNameMap = Object.fromEntries((mergeClasses || []).map((m) => [m.id, m.name]));

    const getDisplayClassName = (assignment) => {
      const base = classMap[assignment.classId]?.name || "Unknown";
      if (assignment.is_from_merge === 1 && assignment.merge_id != null) {
        return mergeNameMap[assignment.merge_id] || base;
      }
      return base;
    };

    // ── Colour helpers ────────────────────────────────────────────────────
    // Strip '#' and ensure 6-char hex for ExcelJS (no alpha channel in argb prefix)
    function hexToArgb(hex) {
      if (!hex) return "FF000000";
      const clean = hex.replace("#", "");
      return "FF" + (clean.length === 3
        ? clean.split("").map((c) => c + c).join("")
        : clean
      ).toUpperCase();
    }

    // Blend teacher colour with white at the given opacity (since xlsx doesn't
    // support true alpha fills, we simulate it by blending toward white).
    function blendWithWhite(hex, alpha) {
      if (!hex || hex.length < 7) return "FFFFFFFF";
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const br = Math.round(r * alpha + 255 * (1 - alpha));
      const bg = Math.round(g * alpha + 255 * (1 - alpha));
      const bb = Math.round(b * alpha + 255 * (1 - alpha));
      return "FF" + [br, bg, bb].map((v) => v.toString(16).padStart(2, "0").toUpperCase()).join("");
    }

    // Map gridLineWidth (0-6px) → ExcelJS border style
    function borderStyle(width) {
      if (width <= 0) return { style: "none" };
      if (width <= 1) return { style: "thin" };
      if (width <= 3) return { style: "medium" };
      return { style: "thick" };
    }

    // ── Build page blocks (mirrors the page-break logic in generate-preview) ─
    // A "block" = one schedule table (teacher, class, room).
    // Pages group blocks according to style.tablesPerPage.
    // Each page becomes one Excel sheet.

    const blocks = []; // { sheetHint, title, subtitle, tableType, entity }

    if (type === "teacher") {
      const teacherId = parseInt(id);
      const teacher = teacherMap[teacherId];
      if (!teacher) return { success: false, message: "Teacher not found." };

      blocks.push({
        sheetHint: teacher.fullName,
        title: "Teacher Schedule",
        subtitle: `${teacher.honorifics ? teacher.honorifics + " " : ""}${teacher.fullName}`,
        tableType: "teacher",
        teacherId,
      });

    } else if (type === "program") {
      const programsToExport = id === "all" ? programs : programs.filter((p) => p.id === parseInt(id));
      if (!programsToExport.length) return { success: false, message: "Program not found." };

      const yearLevels = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year",
        "6th Year", "7th Year", "8th Year", "9th Year", "10th Year"];

      for (const program of programsToExport) {
        const programClasses = classes.filter((c) => c.programId === program.id);
        const programTimeAssignments = allTimeAssignments.filter((a) =>
          programClasses.some((c) => c.id === a.classId)
        );

        for (const yearLevel of yearLevels) {
          const yearClasses = programClasses.filter((c) => c.yearLevel === yearLevel);
          if (!yearClasses.length) continue;

          const yearClassIds = yearClasses.map((c) => c.id);
          if (!programTimeAssignments.some((a) => yearClassIds.includes(a.classId))) continue;

          const sortedYearClasses = [...yearClasses].sort((a, b) => a.name.localeCompare(b.name));
          for (const classObj of sortedYearClasses) {
            const classAssignments = programTimeAssignments.filter((a) => a.classId === classObj.id);
            if (!classAssignments.length) continue;

            blocks.push({
              sheetHint: `${yearLevel} ${classObj.name}`,
              title: "Program Schedule",
              subtitle: `${yearLevel} - ${program.name} (${classObj.name})`,
              tableType: "program",
              classId: classObj.id,
            });
          }
        }
      }

    } else if (type === "room") {
      const roomsToExport = id === "all" ? rooms : rooms.filter((r) => r.id === parseInt(id));
      if (!roomsToExport.length) return { success: false, message: "Room not found." };

      for (const room of roomsToExport) {
        const roomTimeAssignments = allTimeAssignments.filter((ta) =>
          roomAssignments.some(
            (ra) =>
              ra.roomId === room.id &&
              ra.scheduleFileId === ta.scheduleFileId &&
              ra.subjectId === ta.subjectId &&
              ra.teacherId === ta.teacherId &&
              ra.classId === ta.classId
          )
        );
        if (!roomTimeAssignments.length) continue;

        blocks.push({
          sheetHint: `Room ${room.name}`,
          title: "Room Schedule",
          subtitle: `Room: ${room.name}`,
          tableType: "room",
          roomId: room.id,
        });
      }

    } else {
      return { success: false, message: "Invalid export type." };
    }

    if (!blocks.length) return { success: false, message: "No schedule data found to export." };

    // ── Group blocks into pages (sheets) ──────────────────────────────────
    const perPage = style.tablesPerPage;
    const pages = [];
    for (let i = 0; i < blocks.length; i += perPage) {
      pages.push(blocks.slice(i, i + perPage));
    }

    // ── Create workbook ───────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook();
    wb.creator = "GGC-CSS";
    wb.created = new Date();

    const COLS = 7; // Time + Mon Tue Wed Thu Fri Sat
    const headerArgb = hexToArgb(style.headerBg);
    const headerAltArgb = style.headerAltEnabled ? hexToArgb(style.headerBgAlt) : null;
    const bStyle = borderStyle(style.gridLineWidth);

    function allBorder(argbColor) {
      const side = { ...bStyle, color: { argb: argbColor } };
      return { top: side, left: side, bottom: side, right: side };
    }

    const BLACK = "FF000000";
    const borderArgb = (() => {
      // Approximate grid opacity by blending black toward white
      const a = style.gridLineOpacity;
      const v = Math.round((1 - a) * 255);
      return "FF" + [v, v, v].map((x) => x.toString(16).padStart(2, "0").toUpperCase()).join("");
    })();

    // ── Write each page as one sheet ──────────────────────────────────────
    pages.forEach((pageBlocks, pageIndex) => {
      // Build a safe sheet name: "Page 1", "Page 2", …
      const sheetName = `Page ${pageIndex + 1}`;
      const ws = wb.addWorksheet(sheetName, {
        properties: { defaultRowHeight: 60 },
        views: [{ state: "normal" }],
      });

      // Set column widths: col 1 = time (18), cols 2-7 = days (22 each)
      ws.getColumn(1).width = 18;
      for (let c = 2; c <= COLS; c++) ws.getColumn(c).width = 22;

      let currentRow = 1;
      let tableIndex = 0; // for alternate header colour tracking

      for (const block of pageBlocks) {
        const useHeaderArgb = (style.headerAltEnabled && tableIndex % 2 === 1)
          ? headerAltArgb
          : headerArgb;
        tableIndex += 1;

        // ── Institution header ──────────────────────────────────────────
        const instRow = ws.getRow(currentRow++);
        const instCell = instRow.getCell(1);
        instCell.value = "GOLDEN GATE COLLEGES";
        instCell.font = { name: "Arial", bold: true, size: 12, color: { argb: BLACK } };
        instCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        ws.mergeCells(instRow.number, 1, instRow.number, COLS);
        instRow.height = 20;

        // ── Schedule type title ─────────────────────────────────────────
        const titleRow = ws.getRow(currentRow++);
        const titleCell = titleRow.getCell(1);
        titleCell.value = block.title;
        titleCell.font = { name: "Arial", bold: true, size: 11, color: { argb: BLACK } };
        titleCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        ws.mergeCells(titleRow.number, 1, titleRow.number, COLS);
        titleRow.height = 18;

        // ── Section subtitle (class/teacher/room name) ──────────────────
        const subRow = ws.getRow(currentRow++);
        const subCell = subRow.getCell(1);
        subCell.value = block.subtitle;
        subCell.font = { name: "Arial", bold: true, size: 11, color: { argb: BLACK } };
        subCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        ws.mergeCells(subRow.number, 1, subRow.number, COLS);
        subRow.height = 18;

        // ── Column header row ───────────────────────────────────────────
        const hdrRow = ws.getRow(currentRow++);
        hdrRow.height = 22;
        const headers = ["Time", ...dayOrder];
        headers.forEach((h, ci) => {
          const cell = hdrRow.getCell(ci + 1);
          cell.value = h;
          cell.font = { name: "Arial", bold: true, size: 11, color: { argb: BLACK } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: useHeaderArgb } };
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          cell.border = allBorder(borderArgb);
        });

        // ── Build grid for this block ───────────────────────────────────
        const grid = {};
        dayOrder.forEach((day) => { grid[day] = [null, null, null, null]; });

        if (block.tableType === "teacher") {
          allTimeAssignments
            .filter((a) => parseInt(a.teacherId) === block.teacherId)
            .forEach((a) => {
              const bi = getTimeBlockIndex(a.timeSlot);
              if (bi !== -1 && !grid[a.day][bi]) grid[a.day][bi] = a;
            });

        } else if (block.tableType === "program") {
          allTimeAssignments
            .filter((a) => a.classId === block.classId)
            .forEach((a) => {
              const bi = getTimeBlockIndex(a.timeSlot);
              if (bi !== -1 && !grid[a.day][bi]) grid[a.day][bi] = a;
            });

        } else if (block.tableType === "room") {
          allTimeAssignments
            .filter((ta) =>
              roomAssignments.some(
                (ra) =>
                  ra.roomId === block.roomId &&
                  ra.scheduleFileId === ta.scheduleFileId &&
                  ra.subjectId === ta.subjectId &&
                  ra.teacherId === ta.teacherId &&
                  ra.classId === ta.classId
              )
            )
            .forEach((a) => {
              const bi = getTimeBlockIndex(a.timeSlot);
              if (bi !== -1 && !grid[a.day][bi]) grid[a.day][bi] = a;
            });
        }

        // ── Data rows ───────────────────────────────────────────────────
        timeBlocks.forEach((block_label, bi) => {
          const dataRow = ws.getRow(currentRow++);
          dataRow.height = 60;

          // Time cell
          const timeCell = dataRow.getCell(1);
          timeCell.value = block_label;
          timeCell.font = { name: "Arial", bold: true, size: 10, color: { argb: BLACK } };
          timeCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          timeCell.border = allBorder(borderArgb);

          // Day cells
          dayOrder.forEach((day, di) => {
            const cell = dataRow.getCell(di + 2);
            const assignment = grid[day][bi];
            cell.border = allBorder(borderArgb);
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

            if (!assignment) {
              cell.value = "";
              return;
            }

            const subject = subjectMap[assignment.subjectId];
            const teacher = teacherMap[assignment.teacherId];
            const subjectName = subject?.name || "Unknown";
            const mergeLabel = (style.showMergeClassLabel && assignment.is_from_merge === 1)
              ? " (Merge Class)" : "";

            // Build cell text depending on view type
            let lines = [];

            if (block.tableType === "teacher") {
              const className = getDisplayClassName(assignment);
              const raMatch = roomAssignments.find(
                (ra) =>
                  ra.scheduleFileId === assignment.scheduleFileId &&
                  ra.subjectId === assignment.subjectId &&
                  ra.teacherId === assignment.teacherId &&
                  ra.classId === assignment.classId
              );
              const roomName = raMatch ? (roomMap[raMatch.roomId]?.name || "N/A") : "N/A";
              lines = [
                subjectName + mergeLabel,
                assignment.timeSlot,
                className,
                `Room: ${roomName}`,
              ];
            } else if (block.tableType === "program") {
              const teacherName = teacher
                ? `${teacher.honorifics ? teacher.honorifics + " " : ""}${teacher.fullName}`
                : "TBA";
              const raMatch = roomAssignments.find(
                (ra) =>
                  ra.scheduleFileId === assignment.scheduleFileId &&
                  ra.subjectId === assignment.subjectId &&
                  ra.teacherId === assignment.teacherId &&
                  ra.classId === assignment.classId
              );
              const roomName = raMatch ? (roomMap[raMatch.roomId]?.name || "N/A") : "N/A";
              lines = [
                subjectName + mergeLabel,
                assignment.timeSlot,
                teacherName,
                `Room: ${roomName}`,
              ];
            } else if (block.tableType === "room") {
              const teacherName = teacher
                ? `${teacher.honorifics ? teacher.honorifics + " " : ""}${teacher.fullName}`
                : "TBA";
              const className = getDisplayClassName(assignment);
              lines = [
                subjectName + mergeLabel,
                assignment.timeSlot,
                teacherName,
                `Class: ${className}`,
              ];
            }

            // Rich text: subject bold, rest styled by settings
            const timeColor = hexToArgb(style.timeTextColor).slice(2); // strip FF prefix for ExcelJS font color
            const teacherColor = hexToArgb(style.teacherTextColor).slice(2);
            const roomColor = hexToArgb(style.roomTextColor).slice(2);

            cell.value = {
              richText: [
                {
                  text: lines[0] + "\n",
                  font: { name: "Arial", bold: true, size: 10, color: { argb: BLACK } },
                },
                {
                  text: lines[1] + "\n",
                  font: {
                    name: "Arial",
                    bold: style.timeTextBold,
                    size: 9,
                    color: { argb: "FF" + timeColor },
                  },
                },
                {
                  text: lines[2] + "\n",
                  font: {
                    name: "Arial",
                    bold: style.teacherTextBold,
                    size: 9,
                    color: { argb: "FF" + teacherColor },
                  },
                },
                {
                  text: lines[3],
                  font: {
                    name: "Arial",
                    bold: style.roomTextBold,
                    size: 9,
                    color: { argb: "FF" + roomColor },
                  },
                },
              ],
            };

            // Cell background (teacher colour blended with white)
            if (style.showCellBackground && teacher?.color) {
              const bgArgb = blendWithWhite(teacher.color, style.cellBgOpacity);
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgArgb } };
            }
          });
        });

        // ── Spacer row between tables on same sheet ─────────────────────
        currentRow += 1;

        // ── Signature rows ──────────────────────────────────────────────
        // Only add signature after the LAST block on this sheet
        if (block === pageBlocks[pageBlocks.length - 1]) {
          currentRow += 1; // blank gap

          // "Prepared by:" label row
          const prepLabelRow = ws.getRow(currentRow++);
          prepLabelRow.getCell(1).value = "Prepared by:";
          prepLabelRow.getCell(1).font = { name: "Arial", size: 10, color: { argb: BLACK } };
          prepLabelRow.getCell(Math.ceil(COLS / 2) + 1).value = "Approved by:";
          prepLabelRow.getCell(Math.ceil(COLS / 2) + 1).font = { name: "Arial", size: 10, color: { argb: BLACK } };
          prepLabelRow.height = 16;

          // Blank signing line rows (3 rows of empty space)
          currentRow += 3;

          // Underline row (simulate signature line)
          const signLineRow = ws.getRow(currentRow++);
          // Prepared-by underline spanning cols 1–3
          for (let c = 1; c <= 3; c++) {
            const sc = signLineRow.getCell(c);
            sc.border = { bottom: { style: "thin", color: { argb: BLACK } } };
          }
          // Approved-by underline spanning cols 5–7
          for (let c = 5; c <= COLS; c++) {
            const sc = signLineRow.getCell(c);
            sc.border = { bottom: { style: "thin", color: { argb: BLACK } } };
          }
          signLineRow.height = 16;

          // Name & role rows
          const prepNameRow = ws.getRow(currentRow++);
          prepNameRow.getCell(1).value = style.preparedByName;
          prepNameRow.getCell(1).font = { name: "Arial", bold: true, size: 10, color: { argb: BLACK } };
          prepNameRow.getCell(5).value = style.approvedByName;
          prepNameRow.getCell(5).font = { name: "Arial", bold: true, size: 10, color: { argb: BLACK } };
          prepNameRow.height = 16;

          if (style.preparedByRole || style.approvedByRole) {
            const prepRoleRow = ws.getRow(currentRow++);
            prepRoleRow.getCell(1).value = style.preparedByRole;
            prepRoleRow.getCell(1).font = { name: "Arial", size: 9, color: { argb: BLACK } };
            prepRoleRow.getCell(5).value = style.approvedByRole;
            prepRoleRow.getCell(5).font = { name: "Arial", size: 9, color: { argb: BLACK } };
            prepRoleRow.height = 14;
          }
        }
      } // end block loop
    }); // end page loop

    // ── Save dialog ───────────────────────────────────────────────────────
    const { filePath, canceled } = await dialog.showSaveDialog({
      title: "Save Excel File",
      defaultPath: `schedule_${type}_${Date.now()}.xlsx`,
      filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
    });

    if (canceled || !filePath) return { success: false, message: "Export canceled." };

    await wb.xlsx.writeFile(filePath);
    return { success: true, message: `Excel file saved to:\n${filePath}` };

  } catch (err) {
    console.error("Excel export error:", err.message || err);
    return { success: false, message: "Excel export failed: " + (err.message || err) };
  }
});


ipcMain.handle("save-user", (event, data) => {
  return new Promise((resolve, reject) => {
    if (!data.username || !data.password) {
      resolve({ success: false, message: "Username and password are required" });
      return;
    }
    if (data.id) {
      db.run(
        `UPDATE users SET username=?, password=?, role=? WHERE id=?`,
        [data.username, data.password, data.role, data.id],
        (err) => {
          if (err) {
            console.error("Update user error:", err.message);
            reject(err.message);
          } else {
            resolve({ success: true });
          }
        }
      );
    } else {
      db.get(
        `SELECT * FROM users WHERE username=?`,
        [data.username],
        (err, row) => {
          if (err) {
            console.error("Check user error:", err.message);
            reject(err.message);
            return;
          }
          if (row) {
            resolve({ success: false, message: "Username already exists" });
            return;
          }
          db.run(
            `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
            [data.username, data.password, data.role],
            function (err) {
              if (err) {
                console.error("Insert user error:", err.message);
                reject(err.message);
              } else {
                resolve({ success: true, id: this.lastID });
              }
            }
          );
        }
      );
    }
  });
});

ipcMain.handle("delete-user", (event, id) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM users WHERE id=?`, [id], (err) => {
      if (err) {
        console.error("Delete user error:", err.message);
        reject(err.message);
      } else {
        resolve({ success: true });
      }
    });
  });
});

// ---------------- APP INIT ----------------
app.whenReady().then(() => {
  initializeDatabase();
  createMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWindow) createMainWindow();
});