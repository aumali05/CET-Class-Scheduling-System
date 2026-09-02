/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlus, FiEdit, FiTrash2, FiChevronDown, FiChevronUp, FiFilter } from "react-icons/fi";
import { FaTrash } from "react-icons/fa";
import { FaPenToSquare } from "react-icons/fa6";
import Modal from "../components/Modal";
import { MdOutlineSort } from "react-icons/md";

export default function Assigning() {
  const teacherSearchRef = useRef(null);
  const subjectSearchRef = useRef(null);
  const navigate = useNavigate();

  // State for alert and confirm modals
  const [alertModal, setAlertModal] = useState({ show: false, message: "", onConfirm: null });
  const [confirmModal, setConfirmModal] = useState({ show: false, message: "", onConfirm: null });

  // Update modal onClose
  const handleModalClose = () => {
    setShowModal(false);
    setFormData({});
    setEditingId(null);
    setTimeout(() => {
      if (activeTab === "Subject Assign") {
        subjectSearchRef.current?.focus();
      } else {
        teacherSearchRef.current?.focus();
      }
    }, 100);
  };

  const [currentFile, setCurrentFile] = useState(null);
  const [activeTab, setActiveTab] = useState("Subject Assign");
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("");
  const [formData, setFormData] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    sortAZ: true,
    showWithTeachers: true,
    showWithoutTeachers: true,
    programId: "",
    yearLevel: "",
  });
  const [expandedPrograms, setExpandedPrograms] = useState({});
  const [expandedYears, setExpandedYears] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteModalData, setDeleteModalData] = useState({ assignment: null, type: "" });
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherSortOrder, setTeacherSortOrder] = useState("A-Z");

  const handleFileSelected = (e) => {
    setCurrentFile(e.detail);
  };

  const toggleTeacherSortOrder = () => {
    setTeacherSortOrder((prev) => (prev === "A-Z" ? "Z-A" : "A-Z"));
  };

  useEffect(() => {
    window.addEventListener('fileSelected', handleFileSelected);
    return () => window.removeEventListener('fileSelected', handleFileSelected);
  }, []);

  useEffect(() => {
    if (currentFile?.id) {
      setIsLoading(true);
      window.api.getAssignments(currentFile.id)
        .then((assignmentsData) => {
          // Ensure assignmentsData is always an array
          setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
        })
        .catch((error) => {
          console.error("Error loading assignments:", error);
          setAssignments([]); // Set to empty array on error
        })
        .finally(() => setIsLoading(false));
    }
  }, [currentFile]);

  useEffect(() => {
  const checkCurrentFile = async () => {
    setIsLoading(true);
    try {
      const fileResponse = await window.api.getCurrentFile();
      if (!fileResponse.files || fileResponse.files.length === 0) {
        setAlertModal({
          show: true,
          message: "No active file selected. Please select a file first.",
          onConfirm: () => navigate("/file"),
        });
      } else {
        setCurrentFile(fileResponse.files[0]);
        const [teachersData, subjectsData, roomsData, classesData, programsData, assignmentsData] = await Promise.all([
          window.api.getTeachers(),
          window.api.getSubjects(),
          window.api.getRooms(),
          window.api.getClasses(),
          window.api.getPrograms(),
          window.api.getAssignments(fileResponse.files[0].id),
        ]);

        setTeachers(teachersData || []);
        setSubjects(subjectsData || []);
        setRooms(roomsData || []);
        setClasses(classesData || []);
        setPrograms(programsData || []);
        // Ensure assignments is always an array
        setAssignments(Array.isArray(assignmentsData) ? assignmentsData : []);
      }
    } catch (error) {
      console.error("Error checking current file:", error);
      setAlertModal({ show: true, message: `Error loading data: ${error.message}` });
      setAssignments([]); // Set to empty array on error
    } finally {
      setIsLoading(false);
    }
  };
  checkCurrentFile();
}, [navigate]);

  const handleDelete = (assignment, type) => {
    setConfirmModal({
      show: true,
      message: `Are you sure you want to delete this ${type} assignment?`,
      onConfirm: async () => {
        setIsDeleting(true);
        const tableMap = {
          "Subject": "subject_assignments",
          "Room": "room_assignments",
        };
        const table = tableMap[type] || "assignments";
        try {
          const result = await window.api.deleteAssignment(assignment.id, table);
          if (result.success) {
            setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
            setAlertModal({ show: true, message: `Assignment deleted successfully!` });
            const updatedFile = { ...currentFile, updatedAt: new Date().toISOString(), hasUnsavedChanges: true };
            await window.api.setCurrentFile(updatedFile);
            setCurrentFile(updatedFile);
          } else {
            setAlertModal({ show: true, message: result.message });
          }
        } catch (error) {
          console.error(`Error deleting ${type} assignment:`, error);
          setAlertModal({ show: true, message: `Error deleting ${type} assignment: ${error.message}` });
        } finally {
          setIsDeleting(false);
        }
      },
    });
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const { assignment, type } = deleteModalData;
      const result = await window.api.deleteAssignment(assignment.id);
      if (!result.success) {
        setAlertModal({
          show: true,
          message: `Error deleting assignment: ${result.message}`,
        });
        setIsDeleting(false);
        return;
      }

      setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
      setAlertModal({ show: true, message: `${type} assignment deleted successfully!` });
      const updatedFile = { ...currentFile, updatedAt: new Date().toISOString(), hasUnsavedChanges: true };
      await window.api.setCurrentFile(updatedFile);
      setCurrentFile(updatedFile);
    } catch (error) {
      console.error(`Error deleting assignment:`, error);
      setAlertModal({ show: true, message: `Error deleting assignment: ${error.message}` });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeleteModalData({ assignment: null, type: "" });
    }
  };

  // Add this function right after your state declarations or before handleSave
  const checkRoomCapacity = (roomId, classId) => {
    const room = rooms.find(r => r.id === Number(roomId));
    const classData = classes.find(c => c.id === Number(classId));

    if (!room || !classData) return { isValid: false, message: "Room or class not found" };

    if (room.capacity < classData.students) {
      return {
        isValid: false,
        message: `Room "${room.name}" (capacity: ${room.capacity}) cannot accommodate class "${classData.name}" (students: ${classData.students})`
      };
    }

    return { isValid: true };
  };

  // Replace your entire handleSave function with this:
  const handleSave = async () => {
    setIsSaving(true);
    try {
      console.log("handleSave: formData =", JSON.stringify(formData, null, 2));
      console.log("handleSave: currentFile =", JSON.stringify(currentFile, null, 2));
      if (!formData.subjectId) {
        setAlertModal({ show: true, message: "Please select a subject." });
        return;
      }
      if (modalType === "Subject Assign" && !formData.teacherId) {
        setAlertModal({ show: true, message: "Please select a teacher." });
        return;
      }
      if (modalType === "Room Assign" && (
        !formData.teacherId || formData.teacherId === "" ||
        !formData.roomId || formData.roomId === "" ||
        !formData.classId || formData.classId === "" ||
        !formData.subjectId || formData.subjectId === ""
      )) {
        setAlertModal({ show: true, message: "Please select a teacher, subject, room, and class." });
        return;
      }

      // ROOM CAPACITY VALIDATION - ADD THIS BLOCK
      if (modalType === "Room Assign") {
        const capacityCheck = checkRoomCapacity(formData.roomId, formData.classId);
        if (!capacityCheck.isValid) {
          setAlertModal({
            show: true,
            message: capacityCheck.message
          });
          setIsSaving(false);
          return;
        }
      }

      if (!currentFile?.id) {
        setAlertModal({ show: true, message: "No active schedule file selected." });
        return;
      }

      const assignmentData = {
        subjectId: Number(formData.subjectId),
        teacherId: Number(formData.teacherId),
        classId: Number(formData.classId),
        scheduleFileId: Number(currentFile.id),
      };

      if (modalType === "Room Assign") {
        assignmentData.roomId = Number(formData.roomId);
      }

      console.log("handleSave: assignmentData =", JSON.stringify(assignmentData, null, 2));

      let updatedAssignment;

      if (editingId) {
        assignmentData.id = editingId;
        let result;
        if (modalType === "Subject Assign") {
          result = await window.api.updateTeacherSubjectAssignment(assignmentData);
          if (result.success) {
            updatedAssignment = { ...assignmentData, id: editingId, type: "subject" };
          }
        } else if (modalType === "Room Assign") {
          console.log(`Updating room assignment:`, JSON.stringify(assignmentData, null, 2));
          result = await window.api.updateRoomAssignment(assignmentData);
          console.log(`Update result:`, JSON.stringify(result, null, 2));
          if (result.success) {
            updatedAssignment = { ...assignmentData, id: editingId, type: "room" };
          }
        }
        if (!result.success) {
          console.error("API error:", result.message);
          setAlertModal({ show: true, message: result.message });
          return;
        }
        setAssignments((prev) =>
          prev.map((a) => (a.id === editingId ? updatedAssignment : a))
        );
        // Notify other components to refresh assignment lists
        try {
          window.dispatchEvent(new CustomEvent('assignmentsUpdated', { detail: { scheduleFileId: currentFile?.id } }));
        } catch (err) {
          // ignore
        }
        setAlertModal({ show: true, message: `${modalType} updated successfully!` });
      } else {
        let result;
        let newAssignment;
        if (modalType === "Subject Assign") {
          result = await window.api.assignTeacherToSubject(assignmentData);
          if (result.success) {
            newAssignment = { ...assignmentData, id: result.id, type: "subject" };
          }
        } else if (modalType === "Room Assign") {
          console.log(`Saving new room assignment:`, JSON.stringify(assignmentData, null, 2));
          result = await window.api.assignRoom(assignmentData);
          console.log(`Save result:`, JSON.stringify(result, null, 2));
          if (result.success) {
            newAssignment = { ...assignmentData, id: result.id, type: "room" };
          }
        }
        if (!result.success) {
          console.error("API error:", result.message);
          setAlertModal({ show: true, message: result.message });
          return;
        }
        setAssignments((prev) => [...prev, newAssignment]);
        // Notify other components (e.g., Home) to refresh their assignment lists
        try {
          window.dispatchEvent(new CustomEvent('assignmentsUpdated', { detail: { scheduleFileId: currentFile?.id } }));
        } catch (e) {
          // ignore
        }
        setAlertModal({ show: true, message: `${modalType} saved successfully!` });
      }

      setShowModal(false);
      setFormData({});
      setEditingId(null);
      const updatedFile = { ...currentFile, updatedAt: new Date().toISOString(), hasUnsavedChanges: true };
      await window.api.setCurrentFile(updatedFile);
      setCurrentFile(updatedFile);
    } catch (error) {
      console.error(`Error saving ${modalType.toLowerCase()}:`, error);
      setAlertModal({ show: true, message: `Error saving ${modalType.toLowerCase()}: ${error.message}` });
    } finally {
      setIsSaving(false);
    }
  };
  const getTeacherSubjectCount = (teacherId) => {
    if (!assignments || !Array.isArray(assignments)) {
      console.warn('Assignments is not an array:', assignments);
      return 0;
    }
    return assignments.filter((a) => a.type === "subject" && a.teacherId === teacherId).length;
  };

  const getFilteredSubjects = () => {
    let filteredSubjects = [...subjects];
    if (subjectSearch) {
      filteredSubjects = filteredSubjects.filter((subject) =>
        subject.name.toLowerCase().includes(subjectSearch.toLowerCase())
      );
    }
    if (filterOptions.programId) {
      filteredSubjects = filteredSubjects.filter(
        (subject) => String(subject.programId) === String(filterOptions.programId)
      );
    }
    if (filterOptions.yearLevel) {
      filteredSubjects = filteredSubjects.filter(
        (subject) => subject.yearLevel === filterOptions.yearLevel
      );
    }
    if (!filterOptions.showWithTeachers || !filterOptions.showWithoutTeachers) {
      filteredSubjects = filteredSubjects.filter((subject) => {
        const hasTeacher = assignments.some(
          (a) => a.type === "subject" && String(a.subjectId) === String(subject.id) && a.teacherId
        );
        return (filterOptions.showWithTeachers && hasTeacher) || (filterOptions.showWithoutTeachers && !hasTeacher);
      });
    }
    if (filterOptions.sortAZ) {
      filteredSubjects.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      filteredSubjects.sort((a, b) => b.name.localeCompare(a.name));
    }
    return filteredSubjects;
  };

  const getFilteredTeachers = () => {
    let filteredTeachers = [...teachers];
    if (teacherSearch) {
      filteredTeachers = filteredTeachers.filter((teacher) =>
        teacher.fullName.toLowerCase().includes(teacherSearch.toLowerCase())
      );
    }
    if (teacherSortOrder === "A-Z") {
      filteredTeachers.sort((a, b) => a.fullName.localeCompare(b.fullName));
    } else {
      filteredTeachers.sort((a, b) => b.fullName.localeCompare(b.fullName));
    }
    return filteredTeachers;
  };

  const toggleProgram = (programId) => {
    setExpandedPrograms((prev) => ({
      ...prev,
      [programId]: !prev[programId],
    }));
  };

  const toggleYear = (programId, year) => {
    setExpandedYears((prev) => ({
      ...prev,
      [`${programId}-${year}`]: !prev[`${programId}-${year}`],
    }));
  };

  const generateYearLevels = (years) => {
    const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
    return Array.from({ length: Math.min(years, 10) }, (_, i) => `${ordinals[i]} Year`);
  };

  const getSortedClasses = () => {
    return [...classes].sort((a, b) => {
      const programA = programs.find((p) => p.id === a.programId)?.name || "";
      const programB = programs.find((p) => p.id === b.programId)?.name || "";
      return programA.localeCompare(programB) || a.name.localeCompare(b.name);
    });
  };

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!currentFile) {
    return <div className="p-4">No file selected.</div>;
  }

  const tabs = ["Subject Assign", "Teacher Time Availability", "Room Assign"];

  return (
    <div className="p-4 h-screen overflow-hidden bg-[#f8f8f8] border-b border-gray-200">
      <div className="">
        <div className="-mx-4 -mt-4 px-4 py-3 bg-white shadow-sm">
          <div className="flex items-center border-l-4 pl-4" style={{ borderColor: "#fff" }}>
            <h1 className="text-xl font-semibold text-gray-800">Assign Management</h1>
          </div>
        </div>
        <div className="-mx-4 px-4 bg-white border-b border-gray-200 mb-6">
          <nav className="flex space-x-6">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2 px-1 text-sm font-medium transition-colors
                  ${activeTab === tab
                    ? "text-[#031844] border-b-2 border-[#031844]"
                    : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>
      {activeTab === "Subject Assign" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-[calc(100vh-8rem)]">
          <div className="bg-white rounded-lg p-6 shadow-sm border flex flex-col h-[calc(100vh-8rem)] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#cfcfcf_transparent]">
            <h2 className="text-lg font-semibold mb-4">Teachers</h2>
            <div className="flex gap-2 mb-4">
              <input
                ref={teacherSearchRef}
                type="text"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                placeholder="Search teachers..."
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none
                  focus:ring-1 focus:ring-blue-500
                  focus:border-blue-500"
              />
              <button
                onClick={toggleTeacherSortOrder}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                title={`Sort ${teacherSortOrder === "A-Z" ? "Z-A" : "A-Z"}`}
              >
                <MdOutlineSort className="w-5 h-5 text-[#031844]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {getFilteredTeachers().map((teacher) => (
                <div
                  key={teacher.id}
                  onClick={() => setSelectedTeacherId(teacher.id)}
                  className={`p-2 rounded-md cursor-pointer flex items-center justify-between ${selectedTeacherId === teacher.id ? "bg-teal-100" : "hover:bg-gray-100"}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: teacher.color }}
                    ></div>
                    <span>
                      {teacher.honorifics} {teacher.fullName}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {getTeacherSubjectCount(teacher.id)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border flex flex-col h-[calc(100vh-8rem)] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#cfcfcf_transparent]">
            <h2 className="text-lg font-semibold mb-4">
              Assigned Subjects {selectedTeacherId && `for ${teachers.find((t) => t.id === selectedTeacherId)?.fullName}`}
            </h2>
            <div className="flex-1 overflow-y-auto">
              {selectedTeacherId ? (
                assignments
                  .filter((a) => a.type === "subject" && a.teacherId === selectedTeacherId)
                  .map((assignment) => {
                    const subjectData = subjects.find((s) => s.id === assignment.subjectId);
                    return (
                      <div
                        key={assignment.id}
                        className="p-2 flex justify-between items-center hover:bg-gray-50 rounded-md"
                      >
                        <span>{subjectData?.name || "Unknown"}</span>
                        <button
                          onClick={() => handleDelete(assignment, "Subject")}
                          disabled={isDeleting}
                          className={`p-2 text-zinc-500 hover:text-red-700 ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}
                          aria-label="Delete assignment"
                        >
                          <FaTrash size={16} />
                        </button>
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Select a teacher to view assigned subjects</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border flex flex-col h-[calc(100vh-8rem)] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#cfcfcf_transparent]">
            <h2 className="text-lg font-semibold mb-4">Subjects</h2>
            <div className="flex gap-2 mb-4 relative">
              <input
                ref={subjectSearchRef}
                type="text"
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                placeholder="s..."
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none
                  focus:ring-1 focus:ring-blue-500
                  focus:border-blue-500"
              />
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                title="Filter subjects"
              >
                <FiFilter className="w-5 h-5 text-[#031844]" />
              </button>
              {showFilterDropdown && (
                <div className="absolute right-0 top-12 mt-2 w-64 bg-white border rounded-lg shadow-lg p-4 z-10">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filterOptions.sortAZ}
                        onChange={() =>
                          setFilterOptions((prev) => ({ ...prev, sortAZ: !prev.sortAZ }))
                        }
                        className="h-4 w-4 text-teal-600"
                      />
                      Sort A-Z
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filterOptions.showWithTeachers}
                        onChange={() =>
                          setFilterOptions((prev) => ({
                            ...prev,
                            showWithTeachers: !prev.showWithTeachers,
                          }))
                        }
                        className="h-4 w-4 text-teal-600"
                      />
                      Show subjects with teachers
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filterOptions.showWithoutTeachers}
                        onChange={() =>
                          setFilterOptions((prev) => ({
                            ...prev,
                            showWithoutTeachers: !prev.showWithoutTeachers,
                          }))
                        }
                        className="h-4 w-4 text-teal-600"
                      />
                      Show subjects without teachers
                    </label>
                    <select
                      value={filterOptions.programId}
                      onChange={(e) =>
                        setFilterOptions((prev) => ({ ...prev, programId: e.target.value }))
                      }
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="">All Programs</option>
                      {programs.map((program) => (
                        <option key={program.id} value={program.id}>
                          {program.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={filterOptions.yearLevel}
                      onChange={(e) =>
                        setFilterOptions((prev) => ({ ...prev, yearLevel: e.target.value }))
                      }
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="">All Year Levels</option>
                      {["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "6th Year"].map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowFilterDropdown(false)}
                      className="w-full px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {getFilteredSubjects().map((subject) => (
                <div
                  key={subject.id}
                  className="p-2 flex justify-between items-center hover:bg-gray-50 rounded-md"
                >
                  <span>{subject.name}</span>
                  <button
                    onClick={() => {
                      setModalType("Subject Assign");
                      setFormData({ subjectId: subject.id, teacherId: selectedTeacherId || "" });
                      setShowModal(true);
                    }}
                    className="p-2 text-teal-600 hover:text-teal-700"
                    aria-label="Assign subject"
                  >
                    <FiPlus size={16} />
                  </button>
                </div>
              ))}
              {getFilteredSubjects().length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">No subjects found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "Teacher Time Availability" && (
        <div className="bg-white rounded-lg p-6 shadow-sm border h-[calc(100vh-14rem)] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#cfcfcf_transparent]">
          <h2 className="text-lg font-semibold mb-2">Teacher Availability</h2>
          <p className="text-sm text-gray-600">
            This section is cleared and ready for the new Teacher Availability logic.
          </p>
        </div>
      )}

      {activeTab === "Room Assign" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-14rem)]">
          <div className="bg-white rounded-lg p-6 shadow-sm border flex flex-col h-[calc(100vh-8rem)] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#cfcfcf_transparent]">
            <h2 className="text-lg font-semibold mb-4">Programs & Classes</h2>
            <div className="flex-1 overflow-y-auto">
              {programs.map((program) => (
                <div key={program.id}>
                  <div
                    className="flex justify-between items-center p-2 cursor-pointer hover:bg-gray-100 rounded-md"
                    onClick={() => toggleProgram(program.id)}
                  >
                    <span>{program.name}</span>
                    {expandedPrograms[program.id] ? <FiChevronUp /> : <FiChevronDown />}
                  </div>
                  {expandedPrograms[program.id] && (
                    <div className="ml-4 space-y-2">
                      {generateYearLevels(program.years).map((year) => (
                        <div key={year}>
                          <div
                            className="flex justify-between items-center p-2 cursor-pointer hover:bg-gray-100 rounded-md"
                            onClick={() => toggleYear(program.id, year)}
                          >
                            <span>{year}</span>
                            {expandedYears[`${program.id}-${year}`] ? <FiChevronUp /> : <FiChevronDown />}
                          </div>
                          {expandedYears[`${program.id}-${year}`] && (
                            <div className="ml-4 space-y-2">
                              {classes
                                .filter((c) => String(c.programId) === String(program.id) && c.yearLevel === year)
                                .map((cls) => (
                                  <div
                                    key={cls.id}
                                    onClick={() => setSelectedClassId(cls.id)}
                                    className={`p-2 rounded-md cursor-pointer ${selectedClassId === cls.id ? "bg-teal-100" : "hover:bg-gray-100"}`}
                                  >
                                    {cls.name}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border flex flex-col h-[calc(100vh-8rem)] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#cfcfcf_transparent]">
            <h2 className="text-lg font-semibold mb-4">Class Room Assignments</h2>
            {selectedClassId ? (
              <>
                <div className="mb-6 pb-4 border-b">
                  <h3 className="text-md font-medium text-gray-900">
                    {classes.find((c) => c.id === selectedClassId)?.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {classes.find((c) => c.id === selectedClassId)?.students || 0} Students
                  </p>
                </div>
                <div className="space-y-5 flex-1 overflow-y-auto p-4 [scrollbar-width:thin] [scrollbar-color:#cfcfcf_transparent]">
                  {assignments
                    .filter((a) => a.type === "room" && a.classId === selectedClassId)
                    .map((assignment) => {
                      const timeAssignment = assignments.find(
                        (t) => t.type === "time" && t.subjectId === assignment.subjectId && t.classId === assignment.classId && t.teacherId === assignment.teacherId
                      );
                      const subjectData = subjects.find((s) => s.id === assignment.subjectId);
                      const classData = classes.find((c) => c.id === assignment.classId);
                      const programName = classData
                        ? programs.find((p) => p.id === classData.programId)?.name || "N/A"
                        : subjectData?.programId
                          ? programs.find((p) => p.id === subjectData.programId)?.name || "N/A"
                          : "N/A";
                      const yearLevel = classData ? classData.yearLevel : subjectData?.yearLevel || "N/A";
                      const isNoTeacher = !assignment.teacherId;
                      const color = assignment.teacherId
                        ? teachers.find((t) => t.id === assignment.teacherId)?.color || "#e0f7fa"
                        : "#f0efeb";
                      const lightBg = isNoTeacher ? "#f5f5f5" : `${color}20`;
                      return (
                        <div
                          key={assignment.id}
                          className="p-3 rounded-lg border-2 shadow-sm hover:shadow-md transition-all duration-200 cursor-default"
                          style={{
                            backgroundColor: lightBg,
                            borderColor: isNoTeacher ? "#f0efeb" : `${color}40`,
                          }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-gray-800 mb-1">
                                {subjectData?.name || "Unknown"}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-full font-medium"
                                  style={{ backgroundColor: `${color}20`, color }}
                                >
                                  {assignment.teacherId
                                    ? teachers.find((t) => t.id === assignment.teacherId)?.fullName || "No teacher"
                                    : "No Teacher"}
                                </span>
                              </div>
                            </div>
                            {!timeAssignment && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                                Unscheduled
                              </span>
                            )}
                            <button
                              onClick={() => handleDelete(assignment, "Room")}
                              disabled={isDeleting}
                              className={`ml-3 p-2 text-zinc-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}
                              aria-label="Delete assignment"
                            >
                              <FaTrash size={18} />
                            </button>
                          </div>
                          <div className="space-y-1 mt-2 pt-2 border-t border-gray-200">
                            {timeAssignment && (
                              <div className="items-center gap-1.5 text-xs text-gray-600">
                                <span className="font-medium mr-5">{timeAssignment.day}</span>
                                <span className="font-medium mr-5">{timeAssignment.timeSlot}</span>
                                <span className="text-gray-400"></span>
                                <span>{classData?.name || "Unknown"}</span>
                              </div>
                            )}
                            {assignment.roomId && (
                              <div className="items-center gap-1.5 text-xs text-gray-600">
                                <span>{rooms.find((r) => r.id === assignment.roomId)?.name || "No room"}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <span>{programName}</span>
                              </div>
                              <span className="text-gray-300">|</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {assignments.filter((a) => a.type === "room" && a.classId === selectedClassId).length === 0 && (
                    <div className="text-center py-12">
                      <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm text-gray-500 font-medium">No assignments found</p>
                      <p className="text-xs text-gray-400 mt-1">Try assigning a room</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">Select a class to view room assignments</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border flex flex-col h-[calc(100vh-8rem)] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#cfcfcf_transparent]">
            <h2 className="text-lg font-semibold mb-4">Rooms</h2>
            <div className="flex-1 overflow-y-auto">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-md"
                >
                  <span>{room.name}</span>
                  <button
                    onClick={() => {
                      setModalType("Room Assign");
                      setFormData({ roomId: room.id, classId: selectedClassId || "", teacherId: selectedTeacherId || "" });
                      setShowModal(true);
                    }}
                    className="text-teal-600 hover:text-teal-700"
                  >
                    <FiPlus />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <Modal
          title={editingId ? `Edit ${modalType}` : modalType}
          onClose={handleModalClose}
          onSave={handleSave}
          isSaving={isSaving}
        >
          {modalType === "Subject Assign" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Teacher</label>
                <select
                  value={formData.teacherId || selectedTeacherId || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, teacherId: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select a teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.honorifics} {teacher.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Subject</label>
                <select
                  value={formData.subjectId || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subjectId: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select a subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          {modalType === "Room Assign" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Teacher</label>
                <select
                  value={formData.teacherId || selectedTeacherId || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, teacherId: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.honorifics} {teacher.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Subject</label>
                <select
                  value={formData.subjectId || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subjectId: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select subject</option>
                  {subjects
                    .filter((subject) => {
                      if (!formData.teacherId) return true;
                      const matchingAssignments = assignments.filter(
                        (a) =>
                          a.type === "subject" &&
                          String(a.subjectId) === String(subject.id) &&
                          String(a.teacherId) === String(formData.teacherId)
                      );
                      return matchingAssignments.length > 0;
                    })
                    .map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  {formData.teacherId &&
                    assignments.filter(
                      (a) =>
                        a.type === "subject" &&
                        String(a.teacherId) === String(formData.teacherId)
                    ).length === 0 && (
                      <>
                        <option disabled>--- No assigned subjects, showing all ---</option>
                        {subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name} (Unassigned)
                          </option>
                        ))}
                      </>
                    )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Room</label>
                <select
                  value={formData.roomId || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, roomId: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select room</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Class</label>
                <select
                  value={formData.classId || selectedClassId || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, classId: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select class</option>
                  {getSortedClasses().map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} - {programs.find((p) => p.id === cls.programId)?.name || "Unknown"}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </Modal>
      )}

      {showDeleteModal && (
        <Modal
          title={`Delete ${deleteModalData.type} Assignment`}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedClassesToDelete([]);
            setDeleteModalData({ assignment: null, type: "" });
          }}
          onSave={handleDeleteConfirm}
          isSaving={isDeleting}
          saveButtonText="Delete"
        >
          <div>
            <p className="text-sm text-gray-700">
              Are you sure you want to delete this assignment?
            </p>
          </div>
        </Modal>
      )}

      {alertModal.show && (
        <Modal
          title="Alert"
          type="alert"
          message={alertModal.message}
          onClose={() => {
            setAlertModal({ show: false, message: "", onConfirm: null });
            if (alertModal.onConfirm) alertModal.onConfirm();
          }}
        />
      )}

      {confirmModal.show && (
        <Modal
          title="Confirm"
          type="confirm"
          message={confirmModal.message}
          onClose={() => setConfirmModal({ show: false, message: "", onConfirm: null })}
          onConfirm={() => {
            confirmModal.onConfirm();
            setConfirmModal({ show: false, message: "", onConfirm: null });
          }}
        />
      )}
    </div>
  );
}