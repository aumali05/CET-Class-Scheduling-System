"use client";

import { useEffect, useMemo, useState } from "react";
import { IoIosClose } from "react-icons/io";

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

function normalizeId(val) {
  if (val == null || val === "") return "";
  // Keep as string for <select> values
  return String(val);
}

export default function MergeSubjectInfoModal({
  open,
  mode, // "create" | "edit"
  subjectId,
  subjects = [],
  teachers = [],
  rooms = [],
  totalStudents = 0,
  initialTeacherId = "",
  initialRoomId = "",
  initialDay = "Mon",
  initialStartTime = "7:00 AM",
  onClose,
  onSave,
}) {
  const subject = useMemo(
    () => subjects.find((s) => String(s.id) === String(subjectId)) || {},
    [subjects, subjectId]
  );

  const units = useMemo(() => {
    const raw = subject?.units ?? 1;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [subject?.units]);

  const duration = units * 60;

  const [teacherId, setTeacherId] = useState(normalizeId(initialTeacherId));
  const [roomId, setRoomId] = useState(normalizeId(initialRoomId));
  const [day, setDay] = useState(initialDay || "Mon");
  const [startTime, setStartTime] = useState(initialStartTime || "7:00 AM");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTeacherId(normalizeId(initialTeacherId));
    setRoomId(normalizeId(initialRoomId));
    setDay(initialDay || "Mon");
    setStartTime(initialStartTime || "7:00 AM");
    setError("");
  }, [open, subjectId, initialTeacherId, initialRoomId, initialDay, initialStartTime]);

  const roomsByCapacity = useMemo(
    () => (rooms || []).filter((r) => (r.capacity || 0) >= (totalStudents || 0)),
    [rooms, totalStudents]
  );

  const endTime = useMemo(() => {
    const idx = TIME_SLOTS_30.indexOf(startTime);
    if (idx === -1) return startTime;
    const endIdx = Math.min(idx + duration / 30, TIME_SLOTS_30.length - 1);
    return TIME_SLOTS_30[endIdx] || startTime;
  }, [startTime, duration]);

  const timeSlotString = `${startTime} - ${endTime}`;

  if (!open || !subjectId) return null;

  const handleSave = async () => {
    setError("");
    if (!teacherId || !roomId) {
      setError("Please select teacher and room.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await onSave?.({
        teacherId: Number.parseInt(teacherId, 10),
        roomId: Number.parseInt(roomId, 10),
        day,
        timeSlot: timeSlotString,
        duration,
      });
      if (result?.success === false) {
        setError(result?.message || "Save failed");
        return;
      }
      onClose?.();
    } catch (e) {
      setError(e?.message || "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#070707]/60 flex items-center justify-center p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation()
          onClose?.()
        }
      }}
    >
      <div className="bg-white rounded-[18px] shadow-[0_10px_30px_rgba(0,0,0,0.18)] w-[520px] max-w-[92vw] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header Area */}
        <div className="px-7 pt-6 flex items-center justify-between">
          <h2 className="text-base font-bold text-black">{subject?.name || "Subject"}</h2>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="w-9 h-9 flex items-center justify-center text-black/70 hover:text-black transition-colors duration-200 cursor-pointer"
            aria-label="Close"
            title="Close"
            disabled={isSaving}
          >
            <IoIosClose className="w-8 h-8" aria-hidden />
          </button>
        </div>

        {/* Form Area */}
        <div
          className="px-7 mt-4 flex-1 min-h-0 overflow-auto space-y-4
            [scrollbar-width:thin] [scrollbar-color:#D3D3D3_transparent]
            [::-webkit-scrollbar]:w-2
            [::-webkit-scrollbar-track]:bg-transparent
            [::-webkit-scrollbar-thumb]:bg-[#D3D3D3]
            [::-webkit-scrollbar-thumb:hover]:bg-[#A1A1A1]
            [::-webkit-scrollbar-thumb]:rounded-full"
        >
          {error && (
            <div className="border border-red-200 bg-red-50 text-red-700 rounded-[10px] px-4 py-2 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2 text-black">Teacher</label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full bg-white border border-[#DEDEDE] rounded-[10px] px-4 py-2.5 text-sm outline-none"
              disabled={isSaving}
            >
              <option value="">Select teacher</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.honorifics} {t.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-black">
              Room (capacity ≥ {totalStudents || 0})
            </label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full bg-white border border-[#DEDEDE] rounded-[10px] px-4 py-2.5 text-sm outline-none"
              disabled={isSaving}
            >
              <option value="">Select room</option>
              {roomsByCapacity.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.capacity})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-black">Day</label>
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-full bg-white border border-[#DEDEDE] rounded-[10px] px-4 py-2.5 text-sm outline-none"
              disabled={isSaving}
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-black">Start Time</label>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-white border border-[#DEDEDE] rounded-[10px] px-4 py-2.5 text-sm outline-none"
              disabled={isSaving}
            >
              {TIME_SLOTS_30.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-[#6E6D6D]">End Time: {endTime} (from {units} units)</div>
        </div>

        {/* Bottom Area */}
        <div className="px-7 pb-6 pt-4 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onClose?.()}
            className="px-6 py-2 rounded-md bg-[#FEFEFE] text-[#3787EF] border-2 border-[#3787EF] hover:bg-[#3787EF] hover:text-[#FEFEFE] transition-colors duration-200 ease-in-out text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 rounded-md bg-[#3787EF] text-white font-bold hover:bg-[#0A5AC2] transition-colors duration-200 ease-in-out text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : mode === "edit" ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

