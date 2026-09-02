import { useState, useMemo } from "react";

export default function SplitScheduleModal({
  open,
  assignment,
  editFormData,
  onClose,
  onConfirm,
  days,
  timeSlots,
  getTeacherName,
  getSubjectName,
  getRoomName,
  getTimeSlotRange,
  getTeacherColor,
}) {
  const [numSplits, setNumSplits] = useState(2);
  const [splitForm, setSplitForm] = useState({
    split1: {
      day: editFormData?.day || "Mon",
      startTime: editFormData?.startTime || "7:00 AM",
    },
    split2: {
      day: editFormData?.day || "Mon",
      startTime: editFormData?.startTime || "7:00 AM",
    },
    split3: {
      day: editFormData?.day || "Mon",
      startTime: editFormData?.startTime || "7:00 AM",
    },
  });

  // Calculate split durations
  const originalDuration = assignment?.duration || 0;
  const splitDuration = useMemo(() => Math.round(originalDuration / numSplits), [originalDuration, numSplits]);

  // Get darker color for display
  const getDarkerColor = (hexColor) => {
    if (!hexColor || hexColor === "#e5e7eb") return "#9ca3af";
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
    if (!result) return "#9ca3af";
    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);
    r = Math.max(0, r - 40);
    g = Math.max(0, g - 40);
    b = Math.max(0, b - 40);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const formatDuration = (mins) => {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const handleNumSplitsChange = (value) => {
    setNumSplits(value);
  };

  const handleSplit2Change = (field, value) => {
    setSplitForm((prev) => ({
      ...prev,
      split2: { ...prev.split2, [field]: value },
    }));
  };

  const handleSplit3Change = (field, value) => {
    setSplitForm((prev) => ({
      ...prev,
      split3: { ...prev.split3, [field]: value },
    }));
  };

  const handleConfirm = () => {
    if (numSplits === 2) {
      onConfirm({
        numSplits: 2,
        split1: editFormData,
        split2: splitForm.split2,
        splitDuration,
      });
    } else {
      onConfirm({
        numSplits: 3,
        split1: editFormData,
        split2: splitForm.split2,
        split3: splitForm.split3,
        splitDuration,
      });
    }
  };

  if (!open || !assignment) return null;

  const subjectName = getSubjectName(assignment.subjectId);
  const teacherName = getTeacherName(assignment.teacherId);
  const roomName = getRoomName(editFormData?.roomId) || "N/A";
  const color = getTeacherColor(assignment.teacherId);

  return (
    <div className="fixed inset-0 bg-[#070707]/60 flex items-center justify-center z-[99999] p-6">
      <div className="bg-white rounded-[18px] shadow-[0_10px_30px_rgba(0,0,0,0.18)] w-[620px] max-w-[92vw] max-h-[90vh] overflow-hidden mx-4 relative z-[100000] flex flex-col">
        {/* Header */}
        <div className="px-7 pt-6 pb-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-black">Split Schedule</h2>
          <p className="text-sm text-gray-600 mt-1">
            {subjectName} - {formatDuration(originalDuration)} total
          </p>
        </div>

        {/* Content */}
        <div
          className="px-7 mt-4 flex-1 min-h-0 overflow-auto space-y-6
          [scrollbar-width:thin] [scrollbar-color:#D3D3D3_transparent]
          [::-webkit-scrollbar]:w-2
          [::-webkit-scrollbar-track]:bg-transparent
          [::-webkit-scrollbar-thumb]:bg-[#D3D3D3]
          [::-webkit-scrollbar-thumb:hover]:bg-[#A1A1A1]
          [::-webkit-scrollbar-thumb]:rounded-full"
        >
          {/* Split Count Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Number of Splits</label>
            <div className="flex gap-3">
              <button
                onClick={() => handleNumSplitsChange(2)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${numSplits === 2
                    ? "bg-[#3787EF] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
              >
                2 Splits
              </button>
              <button
                onClick={() => handleNumSplitsChange(3)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${numSplits === 3
                    ? "bg-[#3787EF] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
              >
                3 Splits
              </button>
            </div>
          </div>

          {/* Visual Preview */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-600 font-medium mb-3">Duration Breakdown</p>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="text-xs font-medium text-gray-600 min-w-12">Split 1:</div>
                <div className="flex-1 bg-white border border-gray-300 p-2 rounded text-xs">
                  <span style={{ color: getDarkerColor(color), fontWeight: 500 }}>
                    {formatDuration(splitDuration)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs font-medium text-gray-600 min-w-12">Split 2:</div>
                <div className="flex-1 bg-white border border-gray-300 p-2 rounded text-xs">
                  <span style={{ color: getDarkerColor(color), fontWeight: 500 }}>
                    {formatDuration(splitDuration)}
                  </span>
                </div>
              </div>
              {numSplits === 3 && (
                <div className="flex items-center gap-3">
                  <div className="text-xs font-medium text-gray-600 min-w-12">Split 3:</div>
                  <div className="flex-1 bg-white border border-gray-300 p-2 rounded text-xs">
                    <span style={{ color: getDarkerColor(color), fontWeight: 500 }}>
                      {formatDuration(splitDuration)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Baseline Schedule (Split 1) */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-xs font-medium text-gray-700 mb-2">Split 1 (Baseline - Current Schedule)</p>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-gray-600">Subject:</span>{" "}
                <span className="font-medium" style={{ color: getDarkerColor(color) }}>
                  {subjectName}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Teacher:</span> <span className="font-medium">{teacherName}</span>
              </div>
              <div>
                <span className="text-gray-600">Day:</span> <span className="font-medium">{editFormData?.day}</span>
              </div>
              <div>
                <span className="text-gray-600">Time:</span>{" "}
                <span className="font-medium">
                  {getTimeSlotRange(editFormData?.startTime, splitDuration)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Room:</span> <span className="font-medium">{roomName}</span>
              </div>
            </div>
          </div>

          {/* Split 2 Configuration */}
          <div className="border-2 border-gray-200 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-700 mb-3">Split 2 Schedule</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Day</label>
                <select
                  value={splitForm.split2.day}
                  onChange={(e) => handleSplit2Change("day", e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                >
                  {days.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
                <select
                  value={splitForm.split2.startTime}
                  onChange={(e) => handleSplit2Change("startTime", e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                >
                  {timeSlots.map((slot) => {
                    const startTime = slot.split("-")[0].trim();
                    return (
                      <option key={startTime} value={startTime}>
                        {startTime}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="bg-gray-50 p-2 rounded text-xs">
                <p className="text-gray-600">
                  Time Range:{" "}
                  <span className="font-medium text-gray-800">
                    {getTimeSlotRange(splitForm.split2.startTime, splitDuration)}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Split 3 Configuration (Conditional) */}
          {numSplits === 3 && (
            <div className="border-2 border-gray-200 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-3">Split 3 Schedule</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Day</label>
                  <select
                    value={splitForm.split3.day}
                    onChange={(e) => handleSplit3Change("day", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  >
                    {days.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
                  <select
                    value={splitForm.split3.startTime}
                    onChange={(e) => handleSplit3Change("startTime", e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  >
                    {timeSlots.map((slot) => {
                      const startTime = slot.split("-")[0].trim();
                      return (
                        <option key={startTime} value={startTime}>
                          {startTime}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="bg-gray-50 p-2 rounded text-xs">
                  <p className="text-gray-600">
                    Time Range:{" "}
                    <span className="font-medium text-gray-800">
                      {getTimeSlotRange(splitForm.split3.startTime, splitDuration)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 pb-6 pt-4 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-md bg-[#FEFEFE] text-[#3787EF] border-2 border-[#3787EF] hover:bg-[#3787EF] hover:text-[#FEFEFE] transition-colors duration-200 ease-in-out text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 rounded-md bg-[#3787EF] text-white font-bold hover:bg-[#0A5AC2] transition-colors duration-200 ease-in-out text-sm"
          >
            Split
          </button>
        </div>
      </div>
    </div>
  );
}
