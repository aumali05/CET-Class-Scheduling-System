/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiChevronLeft, FiTrash2 } from "react-icons/fi";
import { HiOutlineDotsVertical, HiOutlinePlus } from "react-icons/hi";
import { FaRegArrowAltCircleLeft } from "react-icons/fa";
import { CiSearch } from "react-icons/ci";
import { MdKeyboardArrowDown, MdOutlineKeyboardArrowUp } from "react-icons/md";
import { IoIosClose } from "react-icons/io";
import { IoCheckbox, IoCheckboxOutline } from "react-icons/io5";
import { SlArrowRight } from "react-icons/sl";
import MergeSubjectInfoModal from "../components/MergeSubjectInfoModal";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_SLOTS_30 = (() => {
  const out = [];
  for (let h = 7; h <= 18; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === 18 && m > 0) break;
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      out.push(`${h12}:${m.toString().padStart(2, "0")} ${ampm}`);
    }
  }
  return out;
})();

export default function MergeClass() {
  const navigate = useNavigate();
  const [currentFile, setCurrentFile] = useState(null);
  const [mergeList, setMergeList] = useState([]);
  const [selectedMergeId, setSelectedMergeId] = useState(null);
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [classes, setClasses] = useState([]);

  const [createStep, setCreateStep] = useState(1);
  const [createName, setCreateName] = useState("");
  const [createClassIds, setCreateClassIds] = useState([]);
  const [createClassSearch, setCreateClassSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [showAssignSubjectModal, setShowAssignSubjectModal] = useState(false);
  const [assignSubjectSearch, setAssignSubjectSearch] = useState("");

  const [subjectModal, setSubjectModal] = useState({
    open: false,
    mode: "create", // create | edit
    subjectId: null,
    assignmentId: null,
    initialTeacherId: "",
    initialRoomId: "",
    initialDay: "Mon",
    initialStartTime: "7:00 AM",
  });

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);

  const [hoveredAssignmentId, setHoveredAssignmentId] = useState(null);

  const [mergeSearch, setMergeSearch] = useState("");
  const [sortState, setSortState] = useState({ key: null, dir: "none" }); // dir: none | asc | desc

  const handleSort = useCallback((key) => {
    setSortState((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      if (prev.dir === "desc") return { key: null, dir: "none" };
      return { key, dir: "asc" };
    });
  }, []);

  const withAlpha = useCallback((color, alpha) => {
    if (!color) return null;

    const c = String(color).trim();
    // Hex (#RGB or #RRGGBB)
    if (c[0] === "#") {
      let hex = c.slice(1);
      if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
      if (hex.length !== 6) return null;
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some((v) => Number.isNaN(v))) return null;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // rgb(...) / rgba(...)
    if (c.startsWith("rgb(") || c.startsWith("rgba(")) {
      const nums = c.replace(/rgba?\(/, "").replace(")", "").split(",").map((p) => p.trim());
      if (nums.length < 3) return null;
      const r = Number(nums[0]);
      const g = Number(nums[1]);
      const b = Number(nums[2]);
      if ([r, g, b].some((v) => Number.isNaN(v))) return null;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    return null;
  }, []);

  const filteredMergeList = useMemo(() => {
    const q = mergeSearch.trim().toLowerCase();
    if (!q) return mergeList;
    return mergeList.filter((m) => String(m?.name || "").toLowerCase().includes(q));
  }, [mergeList, mergeSearch]);

  const sortedMergeList = useMemo(() => {
    const { key, dir } = sortState;
    if (!key || dir === "none") return filteredMergeList;

    const getValue = (m) => {
      if (key === "name") return String(m?.name || "");
      if (key === "students") return Number(m?.totalStudents ?? m?.students ?? 0);
      if (key === "classes") return Number(m?.classCount ?? (Array.isArray(m?.classes) ? m.classes.length : 0));
      if (key === "subjects") return Number(m?.subjectCount ?? (Array.isArray(m?.subjects) ? m.subjects.length : 0));
      return "";
    };

    const decorated = filteredMergeList.map((item, idx) => ({ item, idx }));
    decorated.sort((a, b) => {
      const av = getValue(a.item);
      const bv = getValue(b.item);

      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).toLowerCase().localeCompare(String(bv).toLowerCase());
      }

      if (cmp === 0) return a.idx - b.idx; // stable
      return dir === "asc" ? cmp : -cmp;
    });
    return decorated.map((d) => d.item);
  }, [filteredMergeList, sortState]);

  useEffect(() => {
    (async () => {
      try {
        const fileRes = await window.api.getCurrentFile();
        const file = fileRes?.files?.[0];
        setCurrentFile(file || null);
        if (!file?.id) {
          setMergeList([]);
          setLoading(false);
          return;
        }
        const res = await window.api.getMergeList(file.id);
        setMergeList(res.success ? res.list || [] : []);
      } catch (e) {
        setError(e.message || "Failed to load");
        setMergeList([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!currentFile?.id) return;
    window.api.getMergeList(currentFile.id).then((res) => {
      setMergeList(res.success ? res.list || [] : []);
    });
  }, [currentFile?.id]);

  useEffect(() => {
    (async () => {
      try {
        const [t, s, r, p, c] = await Promise.all([
          window.api.getTeachers(),
          window.api.getSubjects(),
          window.api.getRooms(),
          window.api.getPrograms(),
          window.api.getAvailableClassesForMerge(),
        ]);
        setTeachers(t || []);
        setSubjects(s || []);
        setRooms(r || []);
        setPrograms(p || []);
        setClasses(c || []);
      } catch (_) {}
    })();
  }, []);

  useEffect(() => {
    if (!selectedMergeId) {
      setDetails(null);
      return;
    }
    window.api.getMergedClassDetails(selectedMergeId).then((res) => {
      setDetails(res.success ? res.details : null);
    });
  }, [selectedMergeId]);

  const getSubjectById = (id) => subjects.find((s) => s.id === id) || {};
  const getTeacherById = (id) => teachers.find((t) => t.id === id) || {};
  const getRoomById = (id) => rooms.find((r) => r.id === id) || {};
  const getProgramById = (id) => programs.find((p) => p.id === id) || {};
  const totalStudents = details?.classes?.reduce((s, c) => s + (c.students || 0), 0) ?? 0;
  const subjectUnits = (subjectId) => getSubjectById(subjectId).units ?? 1;

  const filteredCreateClasses = classes.filter((c) =>
    !createClassSearch.trim() ? true : (c.name || "").toLowerCase().includes(createClassSearch.toLowerCase())
  );
  const filteredAssignSubjects = subjects.filter((s) =>
    !assignSubjectSearch.trim() ? true : (s.name || "").toLowerCase().includes(assignSubjectSearch.toLowerCase())
  );

  const handleCreateMerge = async () => {
    if (createClassIds.length < 2) return;
    setError("");
    const result = await window.api.createMergedClass({
      name: createName.trim() || "Merge",
      classIds: createClassIds,
      scheduleFileId: currentFile?.id,
    });
    if (result.success) {
      setShowCreateModal(false);
      setCreateStep(1);
      setCreateName("");
      setCreateClassIds([]);
      setMergeList((prev) => [...prev, { id: result.mergeId, name: createName.trim() || "Merge", classCount: createClassIds.length, subjectCount: 0, totalStudents: createClassIds.reduce((s, id) => s + (classes.find((c) => c.id === id)?.students || 0), 0) }]);
      setSelectedMergeId(result.mergeId);
    } else {
      setError(result.message || "Failed to create merge");
    }
  };

  const handleDeleteMerge = async (mergeId) => {
    const result = await window.api.deleteMergeClass(mergeId);
    if (result.success) {
      setMergeList((prev) => prev.filter((m) => m.id !== mergeId));
      if (selectedMergeId === mergeId) setSelectedMergeId(null);
      setDeleteTarget(null);
    } else {
      setError(result.message || "Failed to delete");
    }
  };

  const openSubjectInfo = (subjectId, assignment = null) => {
    const rawTimeSlot = String(assignment?.timeSlot || "");
    const initialStartTime =
      rawTimeSlot
        ? rawTimeSlot.split("-")[0]?.trim() || "7:00 AM"
        : "7:00 AM";

    setSubjectModal({
      open: true,
      mode: assignment ? "edit" : "create",
      subjectId,
      assignmentId: assignment?.id ?? null,
      initialTeacherId: assignment?.teacherId ?? "",
      initialRoomId: assignment?.roomId ?? "",
      initialDay: assignment?.day ?? "Mon",
      initialStartTime,
    });

    setShowAssignSubjectModal(false);
  };

  const saveSubjectFromModal = async ({ teacherId, roomId, day, timeSlot, duration }) => {
    if (!selectedMergeId) return { success: false, message: "No merge class selected." };

    if (subjectModal.mode === "edit") {
      if (!subjectModal.assignmentId) return { success: false, message: "Assignment not found." };
      const result = await window.api.mergeUpdateSubject({
        mergeId: selectedMergeId,
        assignmentId: subjectModal.assignmentId,
        teacherId,
        roomId,
        day,
        timeSlot,
        duration,
      });
      if (!result?.success) return { success: false, message: result?.message || "Update failed" };
      const r = await window.api.getMergedClassDetails(selectedMergeId);
      setDetails(r.success ? r.details : null);
      return { success: true };
    }

    const result = await window.api.mergeAddSubject({
      mergeId: selectedMergeId,
      subjectId: subjectModal.subjectId,
      teacherId,
      roomId,
      day,
      timeSlot,
      duration,
      scheduleFileId: currentFile?.id,
    });
    if (!result?.success) return { success: false, message: result?.message || "Assignment failed" };
    const [detailsRes, listRes] = await Promise.all([
      window.api.getMergedClassDetails(selectedMergeId),
      window.api.getMergeList(currentFile?.id),
    ]);
    setDetails(detailsRes.success ? detailsRes.details : null);
    setMergeList(listRes.success ? listRes.list : []);
    return { success: true };
  };

  const handleRemoveSubject = async (assignmentId) => {
    const result = await window.api.mergeRemoveSubject({ mergeId: selectedMergeId, assignmentId });
    if (result.success) {
      setDeleteTarget(null);
      window.api.getMergedClassDetails(selectedMergeId).then((r) => setDetails(r.success ? r.details : null));
      window.api.getMergeList(currentFile?.id).then((r) => setMergeList(r.success ? r.list : []));
    } else {
      setError(result.message || "Failed to remove subject");
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!currentFile?.id) {
    return (
      <div className="p-6">
        <p className="text-amber-600">Please select a schedule file from the Dashboard first.</p>
        <button type="button" onClick={() => navigate("/file")} className="mt-2 text-teal-600 hover:underline">
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-20px)] p-4 bg-white overflow-hidden">
      {error && (
        <div className="mb-2 px-3 py-2 bg-red-100 text-red-700 rounded text-sm flex justify-between items-center">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>×</button>
        </div>
      )}
      {/* Header Area */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="cursor-pointer"
            aria-label="Back"
          >
            <FaRegArrowAltCircleLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">Merge Class</h1>
        </div>

        <div className="relative w-[320px]">
          <CiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B1B1B1] w-5 h-5" aria-hidden />
          <input
            value={mergeSearch}
            onChange={(e) => setMergeSearch(e.target.value)}
            placeholder="Search Merge Class"
            className="w-full bg-[#FEFEFE] border border-[#858585] rounded-md pl-10 pr-3 py-2 text-sm placeholder:text-[#B1B1B1] outline-none"
          />
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Table Container (Left) */}
        <div
          className={`min-h-0 bg-[#FEFEFE] border border-[#9D9D9D] rounded-lg p-6 overflow-hidden flex flex-col ${selectedMergeId ? "w-[65%]" : "flex-1"}`}
        >
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h2 className="text-base font-medium">Merge Class List</h2>
            <button
              type="button"
              onClick={() => { setShowCreateModal(true); setCreateStep(1); setCreateName(""); setCreateClassIds([]); }}
              className="px-4 py-2 rounded-md bg-[#FEFEFE] text-[#3787EF] border-2 border-[#3787EF] hover:bg-[#3787EF] hover:text-[#FEFEFE] transition-colors duration-200 ease-in-out text-sm font-medium"
            >
              Create Merge
            </button>
          </div>

          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[30%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-[#989898]">
                  {[
                    { key: "no", label: "", sortable: false },
                    { key: "name", label: "Merge Class List", sortable: true },
                    { key: "students", label: "Student", sortable: true },
                    { key: "classes", label: "Classes", sortable: true },
                    { key: "subjects", label: "Subjects", sortable: true },
                    { key: "action", label: "Action", sortable: false },
                  ].map((col) => {
                    const isActive = sortState.key === col.key && sortState.dir !== "none";
                    const Icon = !isActive
                      ? MdKeyboardArrowDown
                      : sortState.dir === "asc"
                        ? MdKeyboardArrowDown
                        : MdOutlineKeyboardArrowUp;

                    return (
                      <th key={col.key} className="py-3 text-center font-medium text-[#8E8E8E]">
                        {col.sortable ? (
                          <button
                            type="button"
                            onClick={() => handleSort(col.key)}
                            className="w-full flex items-center justify-center gap-1 cursor-pointer select-none hover:text-[#6f6f6f]"
                          >
                            <span>{col.label}</span>
                            <span className="w-5 h-5 flex items-center justify-center">
                              <Icon className={`w-5 h-5 ${isActive ? "opacity-100" : "opacity-0"}`} aria-hidden />
                            </span>
                          </button>
                        ) : (
                          <div className="w-full flex items-center justify-center">
                            <span>{col.label}</span>
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedMergeList.length === 0 ? (
                  <tr className="border-b border-[#DFDFDF]">
                    <td colSpan={6} className="py-10 text-center text-sm text-[#8E8E8E]">
                      No merge classes found.
                    </td>
                  </tr>
                ) : (
                  sortedMergeList.map((m, idx) => {
                    const isSelected = selectedMergeId === m.id;
                    return (
                      <tr
                        key={m.id}
                        onClick={() => setSelectedMergeId((prev) => (prev === m.id ? null : m.id))}
                        className={`border-b border-[#DFDFDF] cursor-pointer even:bg-[#F1F2FB]/65 hover:bg-[#ECEFF7] ${isSelected ? "bg-[#DFE5F6] shadow-[inset_0_0_0_2px_#ADC2E9]" : ""}`}
                      >
                        <td className="py-4 text-center text-[#8E8E8E]">{idx + 1}.</td>
                        <td className="py-4 text-center text-black">{m.name}</td>
                        <td className="py-4 text-center text-black">{m.totalStudents ?? 0}</td>
                        <td className="py-4 text-center text-black">{m.classCount ?? 0}</td>
                        <td className="py-4 text-center text-black">{m.subjectCount ?? 0}</td>
                        <td className="py-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ type: "merge", id: m.id, name: m.name })}
                            className="inline-flex items-center justify-center p-1 text-black/60 hover:text-red-700 cursor-pointer"
                            title="Delete merge"
                            aria-label={`Delete ${m.name}`}
                          >
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Details Panel (Right) */}
        {selectedMergeId && (
          <div className="w-[35%] min-h-0 bg-[#FEFEFE] border border-[#9D9D9D] rounded-lg p-6 overflow-hidden flex flex-col">
            {!details ? (
              <div className="flex-1 flex items-center justify-center text-sm text-[#8E8E8E]">
                Loading…
              </div>
            ) : (
              <>
                <div className="shrink-0">
                  {/* Header Area */}
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-black truncate">{details.name}</h3>
                    <button
                      type="button"
                      onClick={() => { setShowAssignSubjectModal(true); setAssignSubjectSearch(""); }}
                      className="px-6 py-2 rounded-md bg-[#FEFEFE] text-[#3787EF] border-2 border-[#3787EF] hover:bg-[#3787EF] hover:text-[#FEFEFE] transition-colors duration-200 ease-in-out text-sm font-medium"
                    >
                      Add
                    </button>
                  </div>

                  {/* Classes Name Container */}
                  <div className="mt-4 bg-[#FEFEFE] shadow-[0_2px_8px_rgba(0,0,0,0.10)] rounded-md px-4 py-2 overflow-x-auto whitespace-nowrap">
                    <span className="text-[#5C5C5C] text-lg font-medium">
                      {(details.classes || []).map((c) => c.name).join(" • ")}
                    </span>
                  </div>

                  {/* Total Students Count */}
                  <div className="mt-2 text-[#858585] text-sm">
                    Total Students: {details.totalStudents ?? 0}
                  </div>
                </div>

                <div className="mt-6 flex-1 min-h-0 overflow-auto space-y-4">
                  {(!details.assignments || details.assignments.length === 0) && (
                    <p className="text-[#8E8E8E] text-sm">No subjects assigned. Click Add Subject.</p>
                  )}
                  {details.assignments?.map((a) => (
                    (() => {
                      const teacherColor = getTeacherById(a.teacherId)?.color || "#9D9D9D";
                      const hoverBg = withAlpha(teacherColor, 0.07);
                      const isHovered = hoveredAssignmentId === a.id;
                      const teacher = getTeacherById(a.teacherId) || {};
                      const teacherPrefix = String(teacher.honorifics || "").trim();
                      const teacherName = [teacherPrefix, teacher.fullName].filter(Boolean).join(" ");

                      return (
                    <div
                      key={a.id}
                      className="rounded-[18px] border bg-white p-4 relative transition-all duration-200 hover:shadow-sm"
                      onMouseEnter={() => setHoveredAssignmentId(a.id)}
                      onMouseLeave={() => setHoveredAssignmentId((prev) => (prev === a.id ? null : prev))}
                      style={{
                        borderColor: teacherColor,
                        backgroundColor: isHovered && hoverBg ? hoverBg : "#FFFFFF",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-lg font-semibold text-[#3F3F3F]">
                          {getSubjectById(a.subjectId).name}
                        </p>
                        {/* Three dots menu (unchanged logic/placement) */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setMenuOpen(menuOpen === a.id ? null : a.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                            aria-label="Assignment menu"
                          >
                            <HiOutlineDotsVertical />
                          </button>
                          {menuOpen === a.id && (
                            <div className="absolute right-0 mt-1 bg-white border rounded shadow-lg py-1 z-10 min-w-[100px]">
                              <button
                                type="button"
                                className="block w-full text-left px-3 py-1 hover:bg-gray-100 text-sm"
                                onClick={() => { setMenuOpen(null); openSubjectInfo(a.subjectId, a); }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="block w-full text-left px-3 py-1 hover:bg-gray-100 text-sm text-red-600"
                                onClick={() => { setMenuOpen(null); setDeleteTarget({ type: "subject", assignmentId: a.id, name: getSubjectById(a.subjectId).name }); }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 border-t border-[#3F3F3F]" />

                      <div className="mt-3 space-y-1">
                        <p
                          className="text-sm font-medium"
                          style={{ color: teacherColor || "#3F3F3F", opacity: 0.65 }}
                        >
                          {teacherName}
                        </p>
                        <p className="text-sm text-black" style={{ opacity: 0.65 }}>
                          {getRoomById(a.roomId).name}
                        </p>
                        <p className="text-sm text-black" style={{ opacity: 0.65 }}>
                          {a.day} {a.timeSlot}
                        </p>
                      </div>
                    </div>
                      );
                    })()
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Create Merge Modal - 2 pages */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-[9999] bg-[#070707]/60 flex items-center justify-center p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              e.stopPropagation()
              setShowCreateModal(false)
            }
          }}
        >
          <div className="bg-white rounded-[18px] shadow-[0_10px_30px_rgba(0,0,0,0.18)] w-[520px] max-w-[92vw] max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header Area */}
            <div className="px-7 pt-6 flex items-center justify-between">
              <h2 className="text-base font-bold text-black">Create Merge Class</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-9 h-9 flex items-center justify-center text-black/70 hover:text-black transition-colors duration-200 cursor-pointer"
                aria-label="Close"
                title="Close"
              >
                <IoIosClose className="w-8 h-8" aria-hidden />
              </button>
            </div>

            {/* Search Container */}
            <div className="px-7 mt-4">
              <div className="relative">
                <CiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6E6D6D] w-5 h-5" aria-hidden />
                <input
                  type="text"
                  placeholder="Search Class Name"
                  value={createClassSearch}
                  onChange={(e) => setCreateClassSearch(e.target.value)}
                  className="w-full bg-white border border-[#DEDEDE] rounded-[10px] pl-11 pr-4 py-2.5 text-sm placeholder:text-[#6E6D6D] outline-none"
                />
              </div>
            </div>

            {/* Content / Class List Area */}
            <div className="px-7 mt-4 flex-1 min-h-0 flex flex-col">
              <div
                className="bg-white border border-[#DEDEDE] rounded-[10px] overflow-y-auto flex-1 min-h-0 py-2
                [scrollbar-width:thin] [scrollbar-color:#D3D3D3_transparent]
                [::-webkit-scrollbar]:w-2
                [::-webkit-scrollbar-track]:bg-transparent
                [::-webkit-scrollbar-thumb]:bg-[#D3D3D3]
                [::-webkit-scrollbar-thumb:hover]:bg-[#A1A1A1]
                [::-webkit-scrollbar-thumb]:rounded-full"
              >
                {createStep === 1 && (
                  <ul className="px-2">
                    {filteredCreateClasses.map((c) => {
                      const checked = createClassIds.includes(c.id);
                      return (
                        <li key={c.id}>
                          <label className="group flex items-center gap-3 px-4 py-2 rounded-[8px] cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setCreateClassIds((prev) => checked ? prev.filter((id) => id !== c.id) : [...prev, c.id])}
                              className="sr-only"
                            />

                            <span className="w-5 h-5 rounded-[4px] flex items-center justify-center transition-colors duration-200 group-hover:bg-[#EBE8E8]">
                              {checked ? (
                                <IoCheckbox className="w-5 h-5" aria-hidden />
                              ) : (
                                <IoCheckboxOutline className="w-5 h-5" aria-hidden />
                              )}
                            </span>

                            <span className="text-sm text-black truncate">{c.name}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {createStep === 2 && (
                  <div className="px-4 pb-2">
                    <label className="block text-sm font-medium mb-2 text-black">Merge Class Name</label>
                    <input
                      type="text"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      placeholder="e.g. 10A-10B Merge"
                      className="w-full bg-white border border-[#DEDEDE] rounded-[10px] px-4 py-2.5 text-sm outline-none mb-3"
                    />
                    <p className="text-sm text-[#6E6D6D] mb-2">Selected: {createClassIds.length} classes</p>
                    <ul className="list-disc list-inside text-sm text-black space-y-1">
                      {createClassIds.map((id) => {
                        const c = classes.find((x) => x.id === id);
                        return c ? <li key={id}>{c.name}</li> : null;
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Area */}
            <div className="px-7 pb-6 pt-4 flex items-center shrink-0">
              <div className="min-w-[96px] flex justify-start">
                {createStep === 2 ? (
                  <button
                    type="button"
                    onClick={() => setCreateStep(1)}
                    className="w-10 h-10 flex items-center justify-center text-[#656565] hover:text-black transition-colors duration-200 cursor-pointer"
                    aria-label="Back"
                    title="Back"
                  >
                    <FiChevronLeft className="w-6 h-6" aria-hidden />
                  </button>
                ) : null}
              </div>

              <div className="flex-1 flex items-center justify-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${createStep === 1 ? "bg-[#575757]" : "bg-[#D9D9D9]"}`} />
                <span className={`w-2.5 h-2.5 rounded-full ${createStep === 2 ? "bg-[#575757]" : "bg-[#D9D9D9]"}`} />
              </div>

              <div className="min-w-[96px] flex justify-end">
                {createStep === 1 ? (
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={() => {
                        if (createClassIds.length < 2) return;
                        setCreateStep(2);
                      }}
                      className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors duration-200 cursor-pointer ${createClassIds.length < 2 ? "opacity-40" : "hover:bg-[#CBAAFF]"}`}
                      aria-label="Next"
                    >
                      <SlArrowRight className="w-4 h-4 text-[#656565] group-hover:text-black" aria-hidden />
                    </button>

                    {/* Instant tooltip (no OS delay) */}
                    <div
                      className="pointer-events-none absolute right-0 -top-2 -translate-y-full whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity duration-0"
                      role="tooltip"
                    >
                      {createClassIds.length < 2 ? "select at least 2 classes" : "Next"}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateMerge}
                    className="px-6 py-2 rounded-md bg-[#3787EF] text-white font-bold hover:bg-[#0A5AC2] transition-colors duration-200 ease-in-out"
                    aria-label="Create"
                    title="Create"
                  >
                    Create
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Subject Modal */}
      {showAssignSubjectModal && (
        <div
          className="fixed inset-0 z-[9999] bg-[#070707]/60 flex items-center justify-center p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              e.stopPropagation()
              setShowAssignSubjectModal(false)
            }
          }}
        >
          <div className="bg-white rounded-[18px] shadow-[0_10px_30px_rgba(0,0,0,0.18)] w-[520px] max-w-[92vw] max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header Area */}
            <div className="px-7 pt-6 flex items-center justify-between">
              <h2 className="text-base font-bold text-black">Assign Subjects</h2>
              <button
                type="button"
                onClick={() => setShowAssignSubjectModal(false)}
                className="w-9 h-9 flex items-center justify-center text-black/70 hover:text-black transition-colors duration-200 cursor-pointer"
                aria-label="Close"
                title="Close"
              >
                <IoIosClose className="w-8 h-8" aria-hidden />
              </button>
            </div>

            {/* Search Container */}
            <div className="px-7 mt-4">
              <div className="relative">
                <CiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6E6D6D] w-5 h-5" aria-hidden />
                <input
                  type="text"
                  placeholder="Search Subject Name"
                  value={assignSubjectSearch}
                  onChange={(e) => setAssignSubjectSearch(e.target.value)}
                  className="w-full bg-white border border-[#DEDEDE] rounded-[10px] pl-11 pr-4 py-2.5 text-sm placeholder:text-[#6E6D6D] outline-none"
                />
              </div>
            </div>

            {/* Content / Subject List Area */}
            <div className="px-7 mt-4 flex-1 min-h-0 flex flex-col">
              <div
                className="bg-white border border-[#DEDEDE] rounded-[10px] overflow-y-auto flex-1 min-h-0 py-2
                [scrollbar-width:thin] [scrollbar-color:#D3D3D3_transparent]
                [::-webkit-scrollbar]:w-2
                [::-webkit-scrollbar-track]:bg-transparent
                [::-webkit-scrollbar-thumb]:bg-[#D3D3D3]
                [::-webkit-scrollbar-thumb:hover]:bg-[#A1A1A1]
                [::-webkit-scrollbar-thumb]:rounded-full"
              >
                <ul className="px-2">
                  {filteredAssignSubjects.map((s) => (
                    <li key={s.id}>
                      <div className="flex items-center justify-between gap-3 px-4 py-2 rounded-[8px]">
                        <span className="text-sm text-black truncate">{s.name}</span>
                        <button
                          type="button"
                          onClick={() => openSubjectInfo(s.id)}
                          className="group w-9 h-9 flex items-center justify-center rounded-full transition-colors duration-200 hover:bg-[#CBAAFF] cursor-pointer"
                          title="Add"
                          aria-label={`Add ${s.name}`}
                        >
                          <HiOutlinePlus className="w-5 h-5 text-[#656565] group-hover:text-black" aria-hidden />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom Area */}
            <div className="px-7 pb-6 pt-4 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowAssignSubjectModal(false)}
                className="px-6 py-2 rounded-md bg-[#FEFEFE] text-[#3787EF] border-2 border-[#3787EF] hover:bg-[#3787EF] hover:text-[#FEFEFE] transition-colors duration-200 ease-in-out text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <MergeSubjectInfoModal
        open={subjectModal.open}
        mode={subjectModal.mode}
        subjectId={subjectModal.subjectId}
        subjects={subjects}
        teachers={teachers}
        rooms={rooms}
        totalStudents={totalStudents}
        initialTeacherId={subjectModal.initialTeacherId}
        initialRoomId={subjectModal.initialRoomId}
        initialDay={subjectModal.initialDay}
        initialStartTime={subjectModal.initialStartTime}
        onClose={() => setSubjectModal((prev) => ({ ...prev, open: false }))}
        onSave={saveSubjectFromModal}
      />

      {/* Delete Merge confirmation */}
      {deleteTarget?.type === "merge" && (
        <div
          className="fixed inset-0 z-[9999] bg-[#070707]/60 flex items-center justify-center p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              e.stopPropagation()
              setDeleteTarget(null)
            }
          }}
        >
          <div className="bg-white rounded-[18px] shadow-[0_10px_30px_rgba(0,0,0,0.18)] w-[520px] max-w-[92vw] overflow-hidden">
            <div className="px-7 pt-6">
              <h2 className="text-base font-bold text-black">Delete Merge Class</h2>
            </div>
            <div className="px-7 mt-4 text-sm text-black">
              <p className="font-semibold">Delete Merge Class &apos;{deleteTarget.name}&apos;?</p>
              <p className="text-sm text-[#6E6D6D] mt-2">
                This will remove all subject assignments from the merged classes. This action cannot be undone.
              </p>
            </div>
            <div className="px-7 pb-6 pt-4 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-6 py-2 rounded-md bg-[#FEFEFE] text-[#3787EF] border-2 border-[#3787EF] hover:bg-[#3787EF] hover:text-[#FEFEFE] transition-colors duration-200 ease-in-out text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteMerge(deleteTarget.id)}
                className="px-6 py-2 rounded-md bg-red-600 text-white font-bold hover:bg-red-700 transition-colors duration-200 ease-in-out text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Subject confirmation */}
      {deleteTarget?.type === "subject" && (
        <div
          className="fixed inset-0 z-[9999] bg-[#070707]/60 flex items-center justify-center p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              e.stopPropagation()
              setDeleteTarget(null)
            }
          }}
        >
          <div className="bg-white rounded-[18px] shadow-[0_10px_30px_rgba(0,0,0,0.18)] w-[520px] max-w-[92vw] overflow-hidden">
            <div className="px-7 pt-6">
              <h2 className="text-base font-bold text-black">Remove Subject</h2>
            </div>
            <div className="px-7 mt-4 text-sm text-black">
              <p className="font-semibold">Remove &apos;{deleteTarget.name}&apos; from all classes in this merge?</p>
              <p className="text-sm text-[#6E6D6D] mt-2">This will remove the schedule entries from all classes.</p>
            </div>
            <div className="px-7 pb-6 pt-4 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-6 py-2 rounded-md bg-[#FEFEFE] text-[#3787EF] border-2 border-[#3787EF] hover:bg-[#3787EF] hover:text-[#FEFEFE] transition-colors duration-200 ease-in-out text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRemoveSubject(deleteTarget.assignmentId)}
                className="px-6 py-2 rounded-md bg-red-600 text-white font-bold hover:bg-red-700 transition-colors duration-200 ease-in-out text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
