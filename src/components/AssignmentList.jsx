// src/components/AssignmentList.jsx
import { useState, useEffect } from "react";
import { FiClock, FiHome, FiFilter, FiSearch } from "react-icons/fi";

export default function AssignmentList({
  filteredAssignments,
  searchTerm,
  setSearchTerm,
  filterOptions,
  setFilterOptions,
  setSelectedTeacherId,
  teachers,
  classes,
  subjects,
  getSubjectName,
  getTeacherName,
  getTeacherColor,
  getLightBackgroundColor,
  getClassName,
  getRoomName,
  getProgramName,
  userRole,
}) {
  const [showFilter, setShowFilter] = useState(false);
  const [localFilters, setLocalFilters] = useState({
    teacherId: filterOptions.teacherId || "",
    showWithSchedule: !!filterOptions.showWithSchedule,
    showWithoutSchedule: filterOptions.showWithoutSchedule ?? true,
    semester: filterOptions.semester || "",
  });

  // When the filter modal opens, sync localFilters with current global filterOptions
  useEffect(() => {
    if (showFilter) {
      setLocalFilters({
        teacherId: filterOptions.teacherId || "",
        showWithSchedule: !!filterOptions.showWithSchedule,
        showWithoutSchedule: filterOptions.showWithoutSchedule ?? true,
        semester: filterOptions.semester || "",
      });
    }
  }, [showFilter, filterOptions]);
  const isNoTeacher = (teacherId) => getTeacherName(teacherId) === "No Teacher";

  return (
    <div className="w-80 bg-white rounded-lg shadow-lg border fixed right-4 top-36 bottom-4 flex flex-col" style={{ zIndex: 500 }}>
      <div className="bg-zinc-900 rounded-t-lg p-3 text-white">
        <h2 className="text-md font-semibold mb-2">Assignment List</h2>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Subject or Teacher"
              className="w-full pl-10 pr-12 py-2 rounded-md border bg-zinc-800 border-gray-700 text-white text-sm focus:outline-none
                  focus:ring-1 focus:ring-blue-500
                  focus:border-blue-500"
            />
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowFilter((s) => !s)}
              className="w-10 h-10 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 transition-colors"
              title="Filters"
            >
              <FiFilter className="w-5 h-5 text-white" />
            </button>

            {showFilter && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow p-3 z-[9999] overflow-visible text-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">Filter</h4>
                  <button className="text-sm text-gray-500" onClick={() => setShowFilter(false)}>Close</button>
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Semester</label>
                    <select
                      value={localFilters.semester}
                      onChange={(e) => setLocalFilters(prev => ({ ...prev, semester: e.target.value }))}
                      className="w-full p-2 border border-gray-200 rounded text-sm bg-gray-50 text-gray-800"
                    >
                      <option value="">All Semesters</option>
                      <option value="1st Semester">1st Semester</option>
                      <option value="2nd Semester">2nd Semester</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Teacher</label>
                    <select
                      value={localFilters.teacherId}
                      onChange={(e) => setLocalFilters(prev => ({ ...prev, teacherId: e.target.value ? parseInt(e.target.value) : "" }))}
                      className="w-full p-2 border border-gray-200 rounded text-sm bg-gray-50 text-gray-800"
                    >
                      <option value="">All Teachers</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.honorifics} {teacher.fullName}
                        </option>
                      ))}
                    </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localFilters.showWithSchedule}
                        onChange={(e) => setLocalFilters(prev => ({ ...prev, showWithSchedule: e.target.checked }))}
                        className="h-4 w-4 accent-[#7c3aed] rounded"
                      />
                      <span className="text-sm text-gray-700">Show with schedule</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={localFilters.showWithoutSchedule}
                        onChange={(e) => setLocalFilters(prev => ({ ...prev, showWithoutSchedule: e.target.checked }))}
                        className="h-4 w-4 accent-[#7c3aed] rounded"
                      />
                      <span className="text-sm text-gray-700">Show without schedule</span>
                    </div>

                  <button
                    onClick={() => {
                      setFilterOptions((prev) => ({
                        ...prev,
                        teacherId: localFilters.teacherId || "",
                        showWithSchedule: !!localFilters.showWithSchedule,
                        showWithoutSchedule: !!localFilters.showWithoutSchedule,
                        semester: localFilters.semester || "",
                      }));
                      setSelectedTeacherId(localFilters.teacherId || null);
                      setShowFilter(false);
                    }}
                    className="w-full px-3 py-2 bg-white border border-cyan-700  text-cyan-700 rounded text-sm font-medium disabled:opacity-50 hover:bg-cyan-700 hover:text-white transition-colors mt-2"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>



      <div className="flex-1 overflow-y-auto p-4 space-y-3 [scrollbar-width:thin]">
        {filteredAssignments.map((assignment) => {
          const classData = assignment.classId ? classes.find((c) => c.id === assignment.classId) : null;
          const subjectData = subjects.find((s) => s.id === assignment.subjectId);
          const programName = classData
            ? getProgramName(classData.programId)
            : subjectData?.programId
              ? getProgramName(subjectData.programId)
              : "N/A";
          // When no explicit class is assigned, show the subject's year level to avoid guessing
          const classDisplay = assignment.classId
            ? getClassName(assignment.classId)
            : subjectData?.yearLevel || "No Class";

          const color = getTeacherColor(assignment.teacherId);
          const lightBg = getLightBackgroundColor(color);

          return (
            <div
              key={assignment.id}
              draggable={userRole !== "view"}
              onDragStart={(e) => userRole !== "view" && e.dataTransfer.setData("text/plain", assignment.id)}
              className={`p-3 rounded-lg border-2 shadow-sm hover:shadow-md transition-all ${userRole !== "view" ? "cursor-move hover:border-gray-400" : ""
                }`}
              style={{
                backgroundColor: lightBg,
                borderColor: isNoTeacher ? '#f0efeb' : color + '40'
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-800">
                    {getSubjectName(assignment.subjectId)}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-1">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: color + "20", color }}
                    >
                      {getTeacherName(assignment.teacherId)}
                    </span>
                  </div>
                </div>
                {!assignment.timeSlot && (
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                    Unscheduled
                  </span>
                )}
              </div>

              <div className="space-y-1 mt-2 pt-2 border-t border-gray-200 text-xs text-gray-600">
                {assignment.timeSlot && (
                  <div className="flex items-center gap-2">
                    <FiClock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-medium">{assignment.day}</span>
                    <span>{assignment.timeSlot}</span>
                    <span className="text-gray-400">•</span>
                    <span>{classDisplay}</span>
                  </div>
                )}
                {assignment.roomId && (
                  <div className="flex items-center gap-2">
                    <FiHome className="w-3.5 h-3.5 text-gray-400" />
                    <span>{getRoomName(assignment.roomId)}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{programName}</span>
                  <span className="text-gray-300">|</span>
                  <span>{classDisplay}</span>
                </div>
              </div>
            </div>
          );
        })}

        {filteredAssignments.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p className="font-medium">No assignments found</p>
            <p className="text-xs mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}