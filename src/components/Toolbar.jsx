/* eslint-disable no-unused-vars */
import { FiPlus, FiLayers, FiSave, FiEdit, FiDownload, FiX, FiPrinter, FiHelpCircle, FiZoomIn, FiZoomOut, FiCalendar, FiSearch, FiArchive } from "react-icons/fi";
import { TbLayoutSidebarRightFilled } from "react-icons/tb";
import { MdOutlineAssignmentTurnedIn } from "react-icons/md";
import { GrExpand } from "react-icons/gr";
import { RiExportFill } from "react-icons/ri";
import { useState, useEffect, useRef } from "react";
import { MdPrint } from "react-icons/md";
import { useNavigate, useLocation } from "react-router-dom";
import Modal from "./Modal";
import { FaSpinner } from "react-icons/fa";

export default function Toolbar({
  searchTerm,
  setSearchTerm,
  showArchived,
  setShowArchived
}) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showViewTools, setShowViewTools] = useState(() => {
    try {
      const saved = localStorage.getItem('showViewTools');
      return saved ? JSON.parse(saved) : false;
    } catch (e) {
      return false;
    }
  });
  const [fileToCloseId, setFileToCloseId] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const MAX_OPEN_FILES = 10;
  const [formData, setFormData] = useState({
    name: "",
    academic_year: "",
    semester: "",
  });
  const [exportData, setExportData] = useState({
    fileId: "",
    type: "program",
    id: "",
    format: "pdf",
  });
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [lastActiveFileId, setLastActiveFileId] = useState(null);
  const [fullScheduleActive, setFullScheduleActive] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(new Set());
  const [teachers, setTeachers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [classes, setClasses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const userRole = localStorage.getItem('userRole') || 'user';
  const isFilePage = location.pathname === '/file';

  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedMergeClass, setSelectedMergeClass] = useState(null);

  // Refs for focusing inputs
  const newModalInputRef = useRef(null);
  const saveAsModalInputRef = useRef(null);
  const exportModalSelectRef = useRef(null);
  const printModalSelectRef = useRef(null);

  // Keyboard shortcuts effect
  useEffect(() => {
    const handleKeyDown = (event) => {
      const { ctrlKey, metaKey, key, shiftKey } = event;
      const isModifier = ctrlKey || metaKey;

      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') {
        if (key === 'Escape') closeAllModals();
        return;
      }

      if (key === 'Escape') {
        event.preventDefault();
        closeAllModals();
        return;
      }

      if (isModifier) {
        switch (key.toLowerCase()) {
          case 'n':
            event.preventDefault();
            if (userRole !== 'view' && location.pathname === '/file') handleNew();
            break;
          case 's':
            event.preventDefault();
            if (userRole !== 'view') {
              if (shiftKey) handleSaveAs();
              else handleSave();
            }
            break;
          case 'e':
            event.preventDefault();
            if (userRole !== 'view' && location.pathname === '/home') handleExport();
            break;
          case 'p':
            event.preventDefault();
            if (userRole !== 'view' && location.pathname === '/home') handlePrint();
            break;
          case 'h':
            event.preventDefault();
            navigate("/help");
            break;
          case 'w':
            event.preventDefault();
            if (userRole !== 'view' && activeFileId && location.pathname === '/home') handleCloseFile(activeFileId);
            break;
          case '=':
          case '+':
            if (showViewTools && location.pathname === '/home') {
              event.preventDefault();
              handleZoomIn();
            }
            break;
          case '-':
            if (showViewTools && location.pathname === '/home') {
              event.preventDefault();
              handleZoomOut();
            }
            break;
          case 'f':
            if (showViewTools && location.pathname === '/home') {
              event.preventDefault();
              handleFullScreen();
            } else if (location.pathname === '/file' && !showArchived) {
              event.preventDefault();
              setShowArchived(true);
            } else if (location.pathname === '/file' && showArchived) {
              event.preventDefault();
              setShowArchived(false);
            }
            break;
        }
      }

      if (key === 'F11' && showViewTools && location.pathname === '/home') {
        event.preventDefault();
        handleFullScreen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    showViewTools,
    location.pathname,
    activeFileId,
    navigate,
    showNewModal,
    showSaveAsModal,
    showCloseConfirmModal,
    showExportModal,
    showPrintModal,
    userRole,
    showArchived
  ]);

  const closeAllModals = () => {
    setShowNewModal(false);
    setShowSaveAsModal(false);
    setShowCloseConfirmModal(false);
    setShowExportModal(false);
    setShowPrintModal(false);
    setFormData({ name: "", academic_year: "", semester: "" });
    setExportData({ fileId: "", type: "program", id: "", format: "pdf" });
    setFileToCloseId(null);
    setIsExporting(false);
    setIsPrinting(false);
  };

  useEffect(() => {
    const fetchCurrentFiles = async () => {
      try {
        const { files } = await window.api.getCurrentFile();
        setOpenFiles(files || []);
        if (files && files.length > 0 && !fullScheduleActive) {
          const currentFile = files.find(f => f.id === activeFileId) || files[0];
          setActiveFileId(currentFile.id);
          setLastActiveFileId(currentFile.id);
          window.dispatchEvent(new CustomEvent('fileSelected', { detail: currentFile }));
        }
        const [teachersData, programsData, roomsData, classesData] = await Promise.all([
          window.api.getTeachers(),
          window.api.getPrograms(),
          window.api.getRooms(),
          window.api.getClasses(),
        ]);
        setTeachers(teachersData || []);
        setPrograms(programsData || []);
        setRooms(roomsData || []);
        setClasses(classesData || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        alert("Error fetching data: " + error.message);
      }
    };

    fetchCurrentFiles();

    const handleFileSelected = async (event) => {
      const file = event.detail;
      if (openFiles.length >= MAX_OPEN_FILES && !openFiles.some(f => f.id === file.id)) {
        alert(`You can only open up to ${MAX_OPEN_FILES} schedule files at a time. Please close one before opening another.`);
        return;
      }
      setLoadingFiles((prev) => new Set([...prev, file.id]));
      try {
        await window.api.setCurrentFile(file);
        const assignments = await window.api.getAssignments(file.id);
        setOpenFiles((prev) => {
          const exists = prev.some((f) => f.id === file.id);
          if (!exists) {
            return [...prev, { ...file, hasUnsavedChanges: false, assignments }];
          }
          return prev.map((f) =>
            f.id === file.id ? { ...f, assignments, hasUnsavedChanges: false } : f
          );
        });
        if (!fullScheduleActive) {
          setActiveFileId(file.id);
          window.activeFileId = file.id;
          setLastActiveFileId(file.id);
        }
      } catch (error) {
        console.error("Error loading file assignments:", error);
        alert("Error loading file assignments: " + error.message);
      } finally {
        setLoadingFiles((prev) => {
          const newSet = new Set(prev);
          newSet.delete(file.id);
          return newSet;
        });
      }
    };

    const handleToggleViewTools = (event) => {
      const explicit = event?.detail && typeof event.detail.next === 'boolean' ? event.detail.next : undefined;
      if (typeof explicit === 'boolean') {
        try {
          localStorage.setItem('showViewTools', JSON.stringify(explicit));
        } catch (e) {
          // ignore
        }
        setShowViewTools(explicit);
      } else {
        setShowViewTools((prev) => {
          const next = !prev;
          try {
            localStorage.setItem('showViewTools', JSON.stringify(next));
          } catch (e) {
            // ignore
          }
          return next;
        });
      }
    };

    const handleClassViewRestored = (event) => {
      const { classId } = event.detail;
      setSelectedClassId(classId);
      setSelectedProgramId(null);
      setSelectedMergeClass(null);
};

    window.addEventListener('fileSelected', handleFileSelected);
    window.addEventListener('toggleViewTools', handleToggleViewTools);
    window.addEventListener('classViewRestored', handleClassViewRestored); // ← inside useEffect

    return () => {
      window.removeEventListener('fileSelected', handleFileSelected);
      window.removeEventListener('toggleViewTools', handleToggleViewTools);
      window.removeEventListener('classViewRestored', handleClassViewRestored);
    };
  }, [fullScheduleActive, activeFileId]);

  const handleTabClick = (fileId) => {
    const file = openFiles.find((f) => f.id === fileId);
    if (file && !fullScheduleActive) {
      setActiveFileId(fileId);
      window.activeFileId = fileId;
      setLastActiveFileId(fileId);
      window.dispatchEvent(new CustomEvent('fileSelected', { detail: file }));
      navigate('/home');
    }
  };

  const refreshAppState = async () => {
    try {
      const { files } = await window.api.getCurrentFile();
      const updatedFiles = await Promise.all(
        (files || []).map(async (file) => {
          const assignments = await window.api.getAssignments(file.id);
          return { ...file, hasUnsavedChanges: false, assignments };
        })
      );
      setOpenFiles(updatedFiles);
      if (!fullScheduleActive && updatedFiles.length > 0) {
        const newActiveFileId = updatedFiles.find((f) => f.id === activeFileId)?.id || updatedFiles[0].id;
        setActiveFileId(newActiveFileId);
        setLastActiveFileId(newActiveFileId);
        window.dispatchEvent(
          new CustomEvent('fileSelected', { detail: updatedFiles.find((f) => f.id === newActiveFileId) })
        );
      } else if (fullScheduleActive) {
        setActiveFileId(null);
      }
      if (updatedFiles.length === 0) {
        navigate("/file");
      }
    } catch (error) {
      console.error("Error refreshing app state:", error);
      alert("Error refreshing app state: " + error.message);
    }
  };

  const handleNew = () => {
    setFormData({ name: "", academic_year: "", semester: "" });
    setShowNewModal(true);
  };

  const handleSave = async () => {
    try {
      const currentFile = openFiles.find((f) => f.id === activeFileId);
      if (!currentFile) {
        alert("No file selected. Please create or open a file first.");
        return;
      }
      const missingFields = [];
      if (!currentFile.name) missingFields.push("Name");
      if (!currentFile.academic_year) missingFields.push("Academic Year");
      if (!currentFile.semester) missingFields.push("Semester");
      if (missingFields.length > 0) {
        alert(`Please fill in all required fields: ${missingFields.join(", ")}`);
        return;
      }
      const result = await window.api.saveFile({
        id: currentFile.id,
        name: currentFile.name,
        academic_year: currentFile.academic_year,
        semester: currentFile.semester,
      });
      if (result.success) {
        alert("File saved successfully!");
        setOpenFiles((prev) =>
          prev.map((f) =>
            f.id === currentFile.id
              ? { ...f, ...result.file, hasUnsavedChanges: false }
              : f
          )
        );
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert("Error saving file: " + error.message);
    }
  };

  const handleSaveAs = () => {
    const currentFile = openFiles.find((f) => f.id === activeFileId);
    setFormData({
      name: currentFile ? `${currentFile.name} - Copy` : "",
      academic_year: currentFile ? currentFile.academic_year : "",
      semester: currentFile ? currentFile.semester : "",
    });
    setShowSaveAsModal(true);
  };

  const handleExport = () => {
    if (isExporting) return;
    const defaultFileId = activeFileId || (openFiles.length > 0 ? openFiles[0].id : "");
    const defaultType = "program";
    const defaultId = "all";
    setExportData({
      fileId: defaultFileId.toString(),
      type: defaultType,
      id: defaultId,
      format: "pdf",
    });
    setShowExportModal(true);
  };

  const handlePrint = () => {
    if (isPrinting) return;
    const defaultFileId = activeFileId || (openFiles.length > 0 ? openFiles[0].id : "");
    const defaultType = "program";
    const defaultId = programs.length > 0 ? programs[0].id.toString() : rooms.length > 0 ? rooms[0].id.toString() : "all";
    setExportData({
      fileId: defaultFileId.toString(),
      type: defaultType,
      id: defaultId,
    });
    setShowPrintModal(true);
  };

  const handleCloseFile = (fileId, event) => {
    if (event) event.stopPropagation();
    const fileToClose = openFiles.find((f) => f.id === fileId);
    if (fileToClose?.hasUnsavedChanges) {
      setFileToCloseId(fileId);
      setShowCloseConfirmModal(true);
    } else {
      confirmCloseFile(fileId);
    }
  };

  const confirmCloseFile = async (fileId) => {
    try {
      await window.api.closeCurrentFile(fileId);
      const remainingFiles = openFiles.filter((f) => f.id !== fileId);
      setOpenFiles(remainingFiles);
      if (fileId === activeFileId) {
        const newActiveFile = remainingFiles.length > 0 ? remainingFiles[0] : null;
        setActiveFileId(newActiveFile?.id || null);
        window.activeFileId = newActiveFile?.id || null;
        setLastActiveFileId(newActiveFile?.id || null);
        if (newActiveFile) {
          window.dispatchEvent(new CustomEvent('fileSelected', { detail: newActiveFile }));
        } else {
          navigate("/file");
        }
      }
      setShowCloseConfirmModal(false);
      setFileToCloseId(null);
      await refreshAppState();
    } catch (error) {
      console.error("Error closing file:", error);
      alert("Error closing file: " + error.message);
    }
  };

  const submitNewFile = async () => {
    if (!formData.name?.trim() || !formData.academic_year?.trim() || !formData.semester?.trim()) {
      alert("Please fill in all fields");
      return;
    }
    try {
      const result = await window.api.newScheduleFile(formData);
      if (result.success) {
        await window.api.setCurrentFile(result.file);
        alert("New file created successfully!");
        setShowNewModal(false);
        setOpenFiles((prev) => [
          ...prev,
          { ...result.file, hasUnsavedChanges: false, assignments: [] },
        ]);
        setActiveFileId(result.file.id);
        window.activeFileId = result.file.id;
        setLastActiveFileId(result.file.id);
        setFormData({ name: "", academic_year: "", semester: "" });
        navigate("/home");
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert("Error creating file: " + error.message);
    }
  };

  const submitSaveAs = async () => {
    if (!formData.name?.trim() || !formData.academic_year?.trim() || !formData.semester?.trim()) {
      alert("Please fill in all fields");
      return;
    }
    try {
      const result = await window.api.saveAsFile({ fileId: activeFileId, ...formData });
      if (result.success) {
        alert("File saved as new file successfully!");
        setShowSaveAsModal(false);
        setOpenFiles((prev) => [
          ...prev,
          { ...result.file, hasUnsavedChanges: false, assignments: [] },
        ]);
        setActiveFileId(result.file.id);
        setLastActiveFileId(result.file.id);
        setFormData({ name: "", academic_year: "", semester: "" });
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert("Error saving as new file: " + error.message);
    }
  };

  const submitExport = async () => {
    if (isExporting) return;
    const fileIdToUse = exportData.fileId;
    if (!fileIdToUse) {
      alert("Please select a file to export.");
      return;
    }
    if (!exportData.type || !exportData.id) {
      alert("Please select an export type and ID.");
      return;
    }
    setIsExporting(true);
    try {
      const result = await window.api.exportFile({
        fileId: fileIdToUse,
        type: exportData.type,
        id: exportData.id === "all" ? "all" : parseInt(exportData.id),
        format: exportData.format,
      });
      if (result.success) {
        alert(result.message);
        setShowExportModal(false);
        setExportData({ fileId: "", type: "program", id: "", format: "pdf" });
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert("Error exporting file: " + (error.message || "Unknown error"));
    } finally {
      setIsExporting(false);
    }
  };

  const submitPrint = async () => {
    if (isPrinting) return;
    const fileIdToUse = exportData.fileId;
    if (!fileIdToUse) {
      alert("Please select a file to print.");
      return;
    }
    if (!exportData.type || !exportData.id) {
      alert("Please select a print type and ID.");
      return;
    }
    setIsPrinting(true);
    try {
      const result = await window.api.printFile({
        fileId: fileIdToUse,
        type: exportData.type,
        id: exportData.id === "all" ? "all" : parseInt(exportData.id),
      });
      if (result.success) {
        alert(result.message);
        setShowPrintModal(false);
        setExportData({ fileId: "", type: "program", id: "", format: "pdf" });
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert("Error printing file: " + (error.message || "Unknown error"));
    } finally {
      setIsPrinting(false);
    }
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (openFiles.some((f) => f.id === activeFileId)) {
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.id === activeFileId ? { ...f, [field]: value, hasUnsavedChanges: true } : f
        )
      );
    }
  };

  const handleClassSchedule = (classId) => {
    const classIdNum = classId ? parseInt(classId) : null;
    setSelectedClassId(classIdNum);

    if (fullScheduleActive) {
      setFullScheduleActive(false);
      setActiveFileId(lastActiveFileId);
      window.activeFileId = lastActiveFileId;
      if (lastActiveFileId) {
        const file = openFiles.find((f) => f.id === lastActiveFileId);
        if (file) {
          window.dispatchEvent(new CustomEvent('fileSelected', { detail: file }));
        }
      }
      window.dispatchEvent(new CustomEvent('viewFullSchedule', { detail: { fullScheduleActive: false } }));
    }

    window.dispatchEvent(new CustomEvent('viewByClass', {
      detail: { classId: classIdNum }
    }));
  };

  const handleAllSchedule = () => {
    const newFullScheduleActive = !fullScheduleActive;
    setFullScheduleActive(newFullScheduleActive);
    setSelectedProgramId(null);
    setSelectedClassId(null);
    setSelectedMergeClass(null);

    if (newFullScheduleActive) {
      setLastActiveFileId(activeFileId);
      setActiveFileId(null);
      window.activeFileId = null;
    } else {
      setActiveFileId(lastActiveFileId);
      window.activeFileId = lastActiveFileId;
      if (lastActiveFileId) {
        const file = openFiles.find((f) => f.id === lastActiveFileId);
        if (file) {
          window.dispatchEvent(new CustomEvent('fileSelected', { detail: file }));
        }
      }
    }

    window.dispatchEvent(new CustomEvent('viewFullSchedule', {
      detail: { fullScheduleActive: newFullScheduleActive }
    }));
  };

  // Add handler for Merge Class
  const handleMergeClass = (mergeClassId) => {
    const mergeClassIdNum = mergeClassId ? parseInt(mergeClassId) : null;
    setSelectedMergeClass(mergeClassIdNum);
    setSelectedProgramId(null);
    setSelectedClassId(null);

    if (fullScheduleActive) {
      setFullScheduleActive(false);
      setActiveFileId(lastActiveFileId);
      window.activeFileId = lastActiveFileId;
      if (lastActiveFileId) {
        const file = openFiles.find((f) => f.id === lastActiveFileId);
        if (file) {
          window.dispatchEvent(new CustomEvent('fileSelected', { detail: file }));
        }
      }
      window.dispatchEvent(new CustomEvent('viewFullSchedule', { detail: { fullScheduleActive: false } }));
    }

    window.dispatchEvent(new CustomEvent('viewByMergeClass', {
      detail: { mergeClassId: mergeClassIdNum }
    }));
  };

  const handleExportChange = (field, value) => {
    setExportData((prev) => {
      const newData = { ...prev, [field]: value };
      if (field === "type") {
        newData.id = value === "program"
          ? "all"
          : value === "teacher" && teachers.length > 0
            ? teachers[0].id.toString()
            : value === "room" && rooms.length > 0
              ? rooms[0].id.toString()
              : "all";
      }
      return newData;
    });
  };

  const handleZoomIn = () => {
    window.dispatchEvent(new CustomEvent('viewZoom', { detail: { zoom: 'in' } }));
  };

  const handleZoomOut = () => {
    window.dispatchEvent(new CustomEvent('viewZoom', { detail: { zoom: 'out' } }));
  };

  const handleFullSchedule = () => {
    const newFullScheduleActive = !fullScheduleActive;
    setFullScheduleActive(newFullScheduleActive);
    if (newFullScheduleActive) {
      setLastActiveFileId(activeFileId);
      setActiveFileId(null);
      window.activeFileId = null;
    } else {
      setActiveFileId(lastActiveFileId);
      window.activeFileId = lastActiveFileId;
      if (lastActiveFileId) {
        const file = openFiles.find((f) => f.id === lastActiveFileId);
        if (file) {
          window.dispatchEvent(new CustomEvent('fileSelected', { detail: file }));
        }
      }
    }
    window.dispatchEvent(new CustomEvent('viewFullSchedule', { detail: { fullScheduleActive: newFullScheduleActive } }));
  };

  const handleScheduleByCourse = (programId) => {
    const programIdNum = programId ? parseInt(programId) : null;
    setSelectedProgramId(programIdNum);
    setSelectedClassId(null); // Reset class when program changes

    if (fullScheduleActive) {
      setFullScheduleActive(false);
      setActiveFileId(lastActiveFileId);
      window.activeFileId = lastActiveFileId;
      if (lastActiveFileId) {
        const file = openFiles.find((f) => f.id === lastActiveFileId);
        if (file) {
          window.dispatchEvent(new CustomEvent('fileSelected', { detail: file }));
        }
      }
      window.dispatchEvent(new CustomEvent('viewFullSchedule', { detail: { fullScheduleActive: false } }));
    }

    // Dispatch event with the selected program
    window.dispatchEvent(new CustomEvent('viewByCourse', {
      detail: { programId: programIdNum }
    }));
  };


  const handleYearLevelSchedule = (yearLevel) => {
    if (fullScheduleActive) {
      setFullScheduleActive(false);
      setActiveFileId(lastActiveFileId);
      window.activeFileId = lastActiveFileId;
      if (lastActiveFileId) {
        const file = openFiles.find((f) => f.id === lastActiveFileId);
        if (file) {
          window.dispatchEvent(new CustomEvent('fileSelected', { detail: file }));
        }
      }
      window.dispatchEvent(new CustomEvent('viewFullSchedule', { detail: { fullScheduleActive: false } }));
    }
    window.dispatchEvent(new CustomEvent('viewByYearLevel', { detail: { yearLevel } }));
  };

  const handleFullScreen = () => {
    window.dispatchEvent(new CustomEvent('viewFullScreen'));
  };


  const toggleAssignmentList = () => {
    // Placeholder: Dispatch a custom event to toggle the assignment list sidebar
    window.dispatchEvent(new CustomEvent('toggleAssignmentList'));
    // TODO: Implement actual toggle logic, e.g., update state to show/hide sidebar
    console.log('Toggling Assignment List');
  };

  const handlePreview = async () => {
    const fileIdToUse = exportData.fileId;
    if (!fileIdToUse || !exportData.type || !exportData.id) {
      alert("Please select all required fields for preview.");
      return;
    }
    setShowExportModal(false);
    navigate("/export", {
      state: {
        fileId: fileIdToUse,
        type: exportData.type,
        id: exportData.id,
      },
    });
  };

  // eslint-disable-next-line no-unused-vars
  const buttons = [
    {
      name: "New",
      icon: <FiPlus />,
      onClick: handleNew,
      shortcut: "Ctrl+N",
      disabled: userRole === 'view'
    },
    {
      name: "Export",
      icon: isExporting ? <FaSpinner className="animate-spin text-base" /> : <FiDownload />,
      onClick: handleExport,
      disabled: userRole === 'view' || !activeFileId || isExporting,
      shortcut: "Ctrl+E"
    },
    {
      name: "Print",
      icon: isPrinting ? <FaSpinner className="animate-spin text-base" /> : <FiPrinter />,
      onClick: handlePrint,
      disabled: userRole === 'view' || !activeFileId || isPrinting,
      shortcut: "Ctrl+P"
    },
  ];

  // Focus management effect
  useEffect(() => {
    if (showNewModal && newModalInputRef.current) {
      newModalInputRef.current.focus();
    } else if (showSaveAsModal && saveAsModalInputRef.current) {
      saveAsModalInputRef.current.focus();
    } else if (showExportModal && exportModalSelectRef.current) {
      exportModalSelectRef.current.focus();
    } else if (showPrintModal && printModalSelectRef.current) {
      printModalSelectRef.current.focus();
    }
  }, [showNewModal, showSaveAsModal, showExportModal, showPrintModal]);

  // Render File page toolbar
  if (isFilePage) {
    return (
      <>
        <div className="bg-white ">
          <div className="px-4 py-3 shadow-lg rounded-xl">
            <div className="flex items-center justify-between">
              {/* Left side - Title */}
              <div className="flex items-center border-l-4 pl-4" style={{ borderColor: "#fff" }}>
                <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
              </div>
              {/* Right side - Search and Archive */}
              <div className="flex items-center space-x-3">
                {/* Search Input */}
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400
                  focus:outline-none
                  focus:ring-2 focus:ring-blue-500
                  focus:border-blue-500"/>
                  <input
                    type="text"

                    placeholder="Search Schedule"
                    value={searchTerm || ''}
                    onChange={(e) => setSearchTerm?.(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none
                  focus:ring-2 focus:ring-blue-500
                  focus:border-blue-500 focus:border-transparent w-64"
                  />
                </div>
                {/* Archive Toggle */}
                <button
                  onClick={() => navigate('/archive')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${location.pathname === '/archive'
                    ? 'bg-gray-200 text-gray-900'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <FiArchive className="w-4 h-4" />
                  <span>Archive</span>
                </button>
              </div>
            </div>
            {/* Action Buttons - Centered on New Line */}
            {userRole !== 'view' && (
              <div className="flex items-center justify-center space-x-3 mt-3 pt-3">
                <button
                  onClick={handleNew}
                  className="flex items-center gap-2 px-4 py-2 bg-[#446EC8] text-white rounded-lg hover:bg-[#335a96] transition-colors text-sm font-medium"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>New</span>
                </button>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:border-[#335a96] hover:bg-[#f7f8ff] hover:text-[#335a96] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <FaSpinner className="w-4 h-4 animate-spin" />
                  ) : (
                    <RiExportFill className="w-4 h-4" />
                  )}
                  <span>Export</span>
                </button>
                <button
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:border-[#335a96] hover:bg-[#f7f8ff] hover:text-[#335a96] transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPrinting ? (
                    <FaSpinner className="w-4 h-4 animate-spin" />
                  ) : (
                    <MdPrint className="w-4 h-4" />
                  )}
                  <span>Print</span>
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Modals for File Page */}
        {showNewModal && (
          <Modal
            title="Create New Schedule File"
            onClose={() => {
              setShowNewModal(false);
              setFormData({ name: "", academic_year: "", semester: "" });
            }}
            onSave={submitNewFile}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                ref={newModalInputRef} // Added ref for focus
                type="text"
                value={formData.name}
                onChange={(e) => handleFormChange("name", e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter schedule name"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
              <input
                type="text"
                value={formData.academic_year}
                onChange={(e) => handleFormChange("academic_year", e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 2024-2025"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
              <select
                value={formData.semester}
                onChange={(e) => handleFormChange("semester", e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Semester</option>
                <option value="1st Semester">1st Semester</option>
                <option value="2nd Semester">2nd Semester</option>
              </select>
            </div>
          </Modal>
        )}
        {showExportModal && (
          <Modal
            title="Export Schedule"
            onClose={() => {
              setShowExportModal(false);
              setExportData({ fileId: "", type: "program", id: "", format: "pdf" });
              setIsExporting(false);
            }}
            customButtons={
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowExportModal(false);
                    setExportData({ fileId: "", type: "program", id: "", format: "pdf" });
                    setIsExporting(false);
                  }}
                  className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={userRole === 'view' || isExporting || !exportData.fileId || !exportData.type || !exportData.id}
                  className={`flex items-center px-4 py-2 rounded-md transition-colors ${userRole === 'view' || isExporting || !exportData.fileId || !exportData.type || !exportData.id
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-teal-700 text-white hover:bg-teal-900'
                    }`}
                >
                  Export
                </button>
              </div>
            }
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select File</label>
              <select
                ref={exportModalSelectRef} // Added ref for focus
                value={exportData.fileId || ""}
                onChange={(e) => handleExportChange("fileId", e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={userRole === 'view' || isExporting}
              >
                <option value="">Select Schedule File</option>
                {openFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name} ({file.semester} {file.academic_year})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Export Type</label>
              <select
                value={exportData.type}
                onChange={(e) => handleExportChange("type", e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={userRole === 'view' || isExporting}
              >
                <option value="program">Program</option>
                <option value="teacher">Teacher</option>
                <option value="room">Room</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {exportData.type === "program" ? "Program" : exportData.type === "teacher" ? "Teacher" : "Room"}
              </label>
              <select
                value={exportData.id}
                onChange={(e) => handleExportChange("id", e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={userRole === 'view' || isExporting}
              >
                <option value="">
                  Select {exportData.type === "program" ? "Program" : exportData.type === "teacher" ? "Teacher" : "Room"}
                </option>
                {(exportData.type === "program" ? programs : exportData.type === "teacher" ? teachers : rooms).map((item) => (
                  <option key={item.id} value={item.id}>
                    {exportData.type === "program" ? item.name : exportData.type === "teacher" ? item.fullName : item.name}
                  </option>
                ))}
                {["program", "room"].includes(exportData.type) && <option value="all">All {exportData.type === "program" ? "Programs" : "Rooms"}</option>}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
              <select
                value={exportData.format}
                onChange={(e) => handleExportChange("format", e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                disabled={userRole === 'view' || isExporting}
              >
                <option value="pdf">PDF</option>
              </select>
            </div>
          </Modal>
        )}
        {showPrintModal && (
          <Modal
            title="Print Schedule"
            onClose={() => {
              setShowPrintModal(false);
              setExportData({ fileId: "", type: "program", id: "", format: "pdf" });
              setIsPrinting(false);
            }}
            onSave={submitPrint}
            saveText={isPrinting ? "Printing..." : "Print"}
            saveDisabled={userRole === 'view' || isPrinting}
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select File</label>
              <select
                ref={printModalSelectRef} // Added ref for focus
                value={exportData.fileId || ""}
                onChange={(e) => handleExportChange("fileId", e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={userRole === 'view' || isPrinting}
              >
                <option value="">Select Schedule File</option>
                {openFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    {file.name} ({file.semester} {file.academic_year})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Print Type</label>
              <select
                value={exportData.type}
                onChange={(e) => handleExportChange("type", e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={userRole === 'view' || isPrinting}
              >
                <option value="program">Program</option>
                <option value="teacher">Teacher</option>
                <option value="room">Room</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {exportData.type === "program" ? "Program" : exportData.type === "teacher" ? "Teacher" : "Room"}
              </label>
              <select
                value={exportData.id}
                onChange={(e) => handleExportChange("id", e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={userRole === 'view' || isPrinting}
              >
                <option value="">
                  Select {exportData.type === "program" ? "Program" : exportData.type === "teacher" ? "Teacher" : "Room"}
                </option>
                {(exportData.type === "program" ? programs : exportData.type === "teacher" ? teachers : rooms).map((item) => (
                  <option key={item.id} value={item.id}>
                    {exportData.type === "program" ? item.name : exportData.type === "teacher" ? item.fullName : item.name}
                  </option>
                ))}
                {["program", "room"].includes(exportData.type) && <option value="all">All {exportData.type === "program" ? "Programs" : "Rooms"}</option>}
              </select>
            </div>
          </Modal>
        )}
      </>
    );
  }

  // Render default toolbar (for Home page)
  return (
    <>
      <div className="">
        <div className="">
          {/* Main toolbar row */}
          <div className="flex items-center justify-between px-4 py-3  bg-white shadow-sm rounded-xl">
            {/* Left side - Title */}
            <div className="flex items-center border-l-4 pl-4" style={{ borderColor: "#fff" }}>
              <h1 className="text-xl font-semibold text-gray-800">Home</h1>
            </div>

            {/* Right side - Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleNew}
                disabled={userRole === 'view'}
                className="flex items-center gap-2 px-4 py-2 bg-[#336785] text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title="New (Ctrl+N)"
              >
                <FiPlus className="w-4 h-4" />
                <span>New</span>
              </button>
              <button
                onClick={handleExport}
                disabled={userRole === 'view' || !activeFileId || isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export (Ctrl+E)"
              >
                {isExporting ? (
                  <FaSpinner className="w-4 h-4 animate-spin" />
                ) : (
                  <RiExportFill className="w-4 h-4" />
                )}
                <span>Export</span>
              </button>
              <button
                onClick={handlePrint}
                disabled={userRole === 'view' || !activeFileId || isPrinting}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title="Print (Ctrl+P)"
              >
                {isPrinting ? (
                  <FaSpinner className="w-4 h-4 animate-spin" />
                ) : (
                  <MdPrint className="w-4 h-4" />
                )}
                <span>Print</span>
              </button>
            </div>
          </div>

        </div>
        <div className="">
          {/* View Tools Section */}
          {showViewTools && (
            <div className="mt-1 pt-4 px-6">
              <div className="flex items-center justify-between p-2 border rounded-xl bg-white">
                <div className="flex items-center gap-3">
                  {/* All Schedule Button */}
                  <button
                    onClick={handleAllSchedule}
                    className={`flex items-center gap-2 px-4 py-1 rounded-lg text-sm font-medium transition-colors ${fullScheduleActive
                        ? 'bg-[#be90fc] text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    title="All Schedules"
                  >
                    <FiCalendar className="w-4 h-4" />
                    <span>All Schedule</span>
                  </button>

                  <p className="text-gray-200">|</p>

                  {/* Select programs dropdown */}
                  <select
                    value={selectedProgramId || ""}
                    onChange={(e) => handleScheduleByCourse(e.target.value)}
                    className="px-4 py-1 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none"
                    title="Select programs"
                  >
                    <option value="">Select programs</option>
                    {programs.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.name}
                      </option>
                    ))}
                  </select>

                  {/* Select Class dropdown */}
                  <select
                    value={selectedClassId || ""}
                    onChange={(e) => handleClassSchedule(e.target.value)}
                    className="px-4 py-1 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors outline-none"
                    title="Select Class"
                  >
                    <option value="">Select Class</option>
                    {classes.length > 0 ? (
                      classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))
                    ) : (
                      <option disabled>Loading classes...</option>
                    )}
                  </select>

                  <p className="text-gray-200">|</p>

                  {/* Merge Class dropdown */}
                  {/* <select
                    value={selectedMergeClass || ""}
                    onChange={(e) => handleMergeClass(e.target.value)}
                    className="px-4 py-1 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                    title="Merge Class"
                  >
                    <option value="">Merge Class</option>
                    {classes
                      .filter(cls => cls.isMerged) // Only show merged classes
                      .map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} (Merged)
                        </option>
                      ))
                    }
                  </select> */}
                </div>
                <div className="text-sm text-gray-600"><h3>Assignment List</h3></div>
                <button
                  onClick={toggleAssignmentList}
                  className="w-8 h-8 flex items-center justify-center bg-white text-gray-700 rounded hover:bg-gray-100 transition-colors"
                  title="Toggle Assignment List"
                >
                  <TbLayoutSidebarRightFilled className="w-5 h-5 transition-transform group-hover:scale-110" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* File Tabs Section */}
        {/* <div className="px-4 pb-0">
          {openFiles.length > 0 ? (
            <div className="flex items-start gap-2 pt-2 -mb-px overflow-x-auto">
              {openFiles.map((file) => (
                <div
                  key={file.id}
                  className={`group flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm cursor-pointer transition-all duration-200 border-b-2 relative min-w-0 flex-shrink-0 ${
                    file.id === activeFileId
                      ? 'bg-white text-gray-900 border-[#336785]'
                      : 'bg-gray-50 text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-transparent'
                  }`}
                  onClick={() => handleTabClick(file.id)}
                  style={{ maxWidth: '240px', minWidth: '140px' }}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {loadingFiles.has(file.id) && (
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-teal-500 rounded-full animate-spin flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{file.name}</div>
                    </div>
                    {file.hasUnsavedChanges && (
                      <div className="w-2 h-2 bg-orange-400 rounded-full flex-shrink-0" title="Unsaved changes" />
                    )}
                    {userRole !== 'view' && (
                      <button
                        onClick={(e) => handleCloseFile(file.id, e)}
                        className="w-5 h-5 flex items-center justify-center rounded-md transition-all duration-200 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"
                        title="Close file (Ctrl+W)"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 text-sm text-gray-500 text-center">
              <div className="flex items-center justify-center gap-2">
                <FiEdit className="w-4 h-4" />
                <span>No files open. Click "New" to create a schedule file.</span>
              </div>
            </div>
          )}
        </div> */}
      </div>

      {/* Modals for Home Page */}
      {showNewModal && (
        <Modal
          title="Create New Schedule File"
          onClose={() => {
            setShowNewModal(false);
            setFormData({ name: "", academic_year: "", semester: "" });
          }}
          onSave={submitNewFile}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              ref={newModalInputRef}
              type="text"
              value={formData.name}
              onChange={(e) => handleFormChange("name", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter schedule name"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
            <input
              type="text"
              value={formData.academic_year}
              onChange={(e) => handleFormChange("academic_year", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 2024-2025"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
            <select
              value={formData.semester}
              onChange={(e) => handleFormChange("semester", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Semester</option>
              <option value="1st Semester">1st Semester</option>
              <option value="2nd Semester">2nd Semester</option>
            </select>
          </div>
        </Modal>
      )}

      {showSaveAsModal && (
        <Modal
          title="Save As New Schedule File"
          onClose={() => {
            setShowSaveAsModal(false);
            setFormData({ name: "", academic_year: "", semester: "" });
          }}
          onSave={submitSaveAs}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              ref={saveAsModalInputRef}
              type="text"
              value={formData.name}
              onChange={(e) => handleFormChange("name", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter new schedule name"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
            <input
              type="text"
              value={formData.academic_year}
              onChange={(e) => handleFormChange("academic_year", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 2024-2025"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
            <select
              value={formData.semester}
              onChange={(e) => handleFormChange("semester", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Semester</option>
              <option value="1st Semester">1st Semester</option>
              <option value="2nd Semester">2nd Semester</option>
            </select>
          </div>
        </Modal>
      )}

      {showCloseConfirmModal && (
        <Modal
          title="Unsaved Changes"
          onClose={() => setShowCloseConfirmModal(false)}
          onSave={() => confirmCloseFile(fileToCloseId)}
          saveText="Close Anyway"
        >
          <p className="text-sm text-gray-700">
            You have unsaved changes. Are you sure you want to close this file?
          </p>
        </Modal>
      )}

      {showExportModal && (
        <Modal
          title="Export Schedule"
          onClose={() => {
            setShowExportModal(false);
            setExportData({ fileId: "", type: "program", id: "", format: "pdf" });
            setIsExporting(false);
          }}
          customButtons={
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => {
                  setShowExportModal(false);
                  setExportData({ fileId: "", type: "program", id: "", format: "pdf" });
                  setIsExporting(false);
                }}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={userRole === 'view' || isExporting || !exportData.fileId || !exportData.type || !exportData.id}
                className={`flex items-center px-4 py-2 rounded-md transition-colors ${userRole === 'view' || isExporting || !exportData.fileId || !exportData.type || !exportData.id
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-teal-700 text-white hover:bg-teal-900'
                  }`}
              >
                Export
              </button>
            </div>
          }
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select File</label>
            <select
              ref={exportModalSelectRef}
              value={exportData.fileId || ""}
              onChange={(e) => handleExportChange("fileId", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              disabled={userRole === 'view' || isExporting}
            >
              <option value="">Select Schedule File</option>
              {openFiles.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.name} ({file.semester} {file.academic_year})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Export Type</label>
            <select
              value={exportData.type}
              onChange={(e) => handleExportChange("type", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              disabled={userRole === 'view' || isExporting}
            >
              <option value="program">Program</option>
              <option value="teacher">Teacher</option>
              <option value="room">Room</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {exportData.type === "program" ? "Program" : exportData.type === "teacher" ? "Teacher" : "Room"}
            </label>
            <select
              value={exportData.id}
              onChange={(e) => handleExportChange("id", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              disabled={userRole === 'view' || isExporting}
            >
              <option value="">
                Select {exportData.type === "program" ? "Program" : exportData.type === "teacher" ? "Teacher" : "Room"}
              </option>
              {(exportData.type === "program" ? programs : exportData.type === "teacher" ? teachers : rooms).map((item) => (
                <option key={item.id} value={item.id}>
                  {exportData.type === "program" ? item.name : exportData.type === "teacher" ? item.fullName : item.name}
                </option>
              ))}
              {["program", "room"].includes(exportData.type) && (
                <option value="all">All {exportData.type === "program" ? "Programs" : "Rooms"}</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
            <select
              value={exportData.format}
              onChange={(e) => handleExportChange("format", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              disabled={userRole === 'view' || isExporting}
            >
              <option value="pdf">PDF</option>
            </select>
          </div>
        </Modal>
      )}

      {showPrintModal && (
        <Modal
          title="Print Schedule"
          onClose={() => {
            setShowPrintModal(false);
            setExportData({ fileId: "", type: "program", id: "", format: "pdf" });
            setIsPrinting(false);
          }}
          onSave={submitPrint}
          saveText={isPrinting ? "Printing..." : "Print"}
          saveDisabled={userRole === 'view' || isPrinting}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select File</label>
            <select
              ref={printModalSelectRef}
              value={exportData.fileId || ""}
              onChange={(e) => handleExportChange("fileId", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={userRole === 'view' || isPrinting}
            >
              <option value="">Select Schedule File</option>
              {openFiles.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.name} ({file.semester} {file.academic_year})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Print Type</label>
            <select
              value={exportData.type}
              onChange={(e) => handleExportChange("type", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={userRole === 'view' || isPrinting}
            >
              <option value="program">Program</option>
              <option value="teacher">Teacher</option>
              <option value="room">Room</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {exportData.type === "program" ? "Program" : exportData.type === "teacher" ? "Teacher" : "Room"}
            </label>
            <select
              value={exportData.id}
              onChange={(e) => handleExportChange("id", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={userRole === 'view' || isPrinting}
            >
              <option value="">
                Select {exportData.type === "program" ? "Program" : exportData.type === "teacher" ? "Teacher" : "Room"}
              </option>
              {(exportData.type === "program" ? programs : exportData.type === "teacher" ? teachers : rooms).map((item) => (
                <option key={item.id} value={item.id}>
                  {exportData.type === "program" ? item.name : exportData.type === "teacher" ? item.fullName : item.name}
                </option>
              ))}
              {["program", "room"].includes(exportData.type) && (
                <option value="all">All {exportData.type === "program" ? "Programs" : "Rooms"}</option>
              )}
            </select>
          </div>
        </Modal>
      )}

    </>
  );
}