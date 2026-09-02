"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { FiPlus, FiEdit, FiSearch, FiFilter, FiChevronDown } from "react-icons/fi"
import { MdKeyboardArrowDown, MdOutlineKeyboardArrowUp } from "react-icons/md"
import { FaTrash, FaArrowRight } from "react-icons/fa"
import Modal from "../components/Modal"
import TeacherAvailabilityPanel from "../components/TeacherAvailabilityPanel"

const AVAILABILITY_DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function ManageData() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("Teachers")
  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [rooms, setRooms] = useState([])
  const [classes, setClasses] = useState([])
  const [programs, setPrograms] = useState([])
  const [subjectAssignedById, setSubjectAssignedById] = useState({})
  const [teacherSubjectCountById, setTeacherSubjectCountById] = useState({})
  const [teacherHasAvailabilityById, setTeacherHasAvailabilityById] = useState({})
  const [teacherAvailabilitySummaryById, setTeacherAvailabilitySummaryById] = useState({})
  const [formData, setFormData] = useState({})
  const [selectedItem, setSelectedItem] = useState(null)
  const [showAvailabilityPanel, setShowAvailabilityPanel] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAlertModal, setShowAlertModal] = useState(false)
  const [alertMessage, setAlertMessage] = useState("")
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmMessage, setConfirmMessage] = useState("")
  const [confirmCallback, setConfirmCallback] = useState(null)

  // Filter states for each tab
  const [showSubjectFilter, setShowSubjectFilter] = useState(false)
  const [showRoomFilter, setShowRoomFilter] = useState(false)
  const [showClassFilter, setShowClassFilter] = useState(false)

  // Filter options for each tab
  const [subjectFilter, setSubjectFilter] = useState({
    semester: "",
    programId: "",
    yearLevel: "",
    code: ""
  })

  const [roomFilter, setRoomFilter] = useState({
    minCapacity: "",
    maxCapacity: ""
  })

  const [classFilter, setClassFilter] = useState({
    programId: "",
    yearLevel: ""
  })

  // Classes tab dropdown: only when Classes is active; toggles on tab click, closes on outside click or tab change
  const [classesDropdownOpen, setClassesDropdownOpen] = useState(false)
  const classesTabRef = useRef(null)
  const subjectKeyByIdRef = useRef(new Map())

  // Standard table sort (MergeClass-style): one active column at a time
  const [tableSort, setTableSort] = useState({ key: null, dir: "none" }) // dir: none | asc | desc

  const handleTableSort = useCallback((key) => {
    setTableSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" }
      if (prev.dir === "asc") return { key, dir: "desc" }
      if (prev.dir === "desc") return { key: null, dir: "none" }
      return { key, dir: "asc" }
    })
  }, [])

  const presetColors = [
    "#EF4444", // Red
    "#F97316", // Orange
    "#FACC15", // Yellow
    "#22C55E", // Green
    "#3B82F6", // Blue
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#14B8A6", // Teal
    "#6B7280", // Gray
    "#A855F7", // Violet
    "#F59E0B", // Amber
    "#10B981", // Emerald
    "#D946EF", // Fuchsia
    "#06B6D4", // Cyan
    "#F43F5E", // Rose
  ]

  const tabTypes = {
    Teachers: "Teacher",
    Subjects: "Subject",
    Rooms: "Room",
    Classes: "Class",
    Programs: "Program",
  }

  const currentType = tabTypes[activeTab]

  const customAlert = (message) => {
    setAlertMessage(message)
    setShowAlertModal(true)
  }

  const customConfirm = (message, callback) => {
    setConfirmMessage(message)
    setConfirmCallback(() => callback)
    setShowConfirmModal(true)
  }

  const getProgramById = useCallback(
    (programId) => programs.find((p) => String(p.id) === String(programId)),
    [programs]
  )

  const getCourseShortName = useCallback(
    (programId) => {
      const name = getProgramById(programId)?.name || ""
      const normalized = name.trim().toLowerCase()
      if (!normalized) return "—"

      // UX request: Information Technology -> IT
      if (normalized.includes("information technology")) return "IT"
      // UX request: Chemical Engineering -> CHE
      if (normalized.includes("chemical engineering")) return "CHE"

      // Remove degree words so acronyms don't start with "B" (e.g., Bachelor of Science in ...)
      const stop = new Set([
        "of", "and", "the", "in", "for", "to", "&",
        "bachelor", "bachelors", "bachelor's", "bachelor’s",
        "bs", "b.s", "b.s.", "bsc", "b.sc", "b.sc.",
        "science", "arts",
      ])
      const words = name
        .replace(/[^a-z0-9\s]/gi, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .filter((w) => !stop.has(w.toLowerCase()))

      const acronym = words.map((w) => w[0]).join("").toUpperCase()
      return acronym || name.slice(0, 3).toUpperCase()
    },
    [getProgramById]
  )

  useEffect(() => {
    const m = new Map()
    ;(subjects || []).forEach((s) => {
      const key = String((s?.name || "").trim().toLowerCase())
      if (!key) return
      m.set(String(s.id), key)
    })
    subjectKeyByIdRef.current = m
  }, [subjects])

  const refreshSubjectAssignedStatus = useCallback(async (scheduleFileId) => {
    if (!scheduleFileId) {
      setSubjectAssignedById({})
      setTeacherSubjectCountById({})
      return
    }
    try {
      const assignmentsData = await window.api.getAssignments(scheduleFileId)
      const list = Array.isArray(assignmentsData) ? assignmentsData : []
      const next = {}
      const subjectSetByTeacher = {}
      for (const a of list) {
        if (!a?.subjectId) continue
        if (a.teacherId == null || a.teacherId === "") continue
        next[String(a.subjectId)] = true
        const tId = String(a.teacherId)
        if (!subjectSetByTeacher[tId]) subjectSetByTeacher[tId] = new Set()
        const subjectKey = subjectKeyByIdRef.current.get(String(a.subjectId)) || String(a.subjectId)
        subjectSetByTeacher[tId].add(subjectKey)
      }
      setSubjectAssignedById(next)
      const nextCounts = {}
      Object.entries(subjectSetByTeacher).forEach(([tId, set]) => {
        nextCounts[tId] = set.size
      })
      setTeacherSubjectCountById(nextCounts)
    } catch (e) {
      console.error("Failed to load assignments for subject status:", e)
      setSubjectAssignedById({})
      setTeacherSubjectCountById({})
    }
  }, [])

  const refreshTeacherHasAvailability = useCallback(async (teacherId) => {
    if (!teacherId) return
    try {
      const rows = await window.api.getTeacherAvailability(teacherId)
      const has = Array.isArray(rows) && rows.length > 0
      setTeacherHasAvailabilityById((prev) => ({ ...(prev || {}), [String(teacherId)]: has }))

      const days = Array.from(
        new Set((Array.isArray(rows) ? rows : []).map((r) => String(r?.day || "").trim()).filter(Boolean))
      ).sort((a, b) => AVAILABILITY_DAY_ORDER.indexOf(a) - AVAILABILITY_DAY_ORDER.indexOf(b))
      setTeacherAvailabilitySummaryById((prev) => ({
        ...(prev || {}),
        [String(teacherId)]: { count: Array.isArray(rows) ? rows.length : 0, days },
      }))
    } catch (e) {
      console.error("Failed to load teacher availability flag:", e)
      setTeacherHasAvailabilityById((prev) => ({ ...(prev || {}), [String(teacherId)]: false }))
      setTeacherAvailabilitySummaryById((prev) => ({
        ...(prev || {}),
        [String(teacherId)]: { count: 0, days: [] },
      }))
    }
  }, [])

  // When a teacher row is selected, determine if it already has availability configured
  useEffect(() => {
    if (activeTab !== "Teachers") return
    if (!selectedItem?.id) return
    refreshTeacherHasAvailability(selectedItem.id)
  }, [activeTab, refreshTeacherHasAvailability, selectedItem?.id])

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const [teachersData, subjectsData, roomsData, classesData, programsData] = await Promise.all([
          window.api.getTeachers(),
          window.api.getSubjects(),
          window.api.getRooms(),
          window.api.getClasses(),
          window.api.getPrograms(),
        ])

        setTeachers(teachersData)
        setSubjects(subjectsData)
        setRooms(roomsData)
        setClasses(classesData)
        setPrograms(programsData)

        // Preload teacher availability flags so the table can show status without selection
        try {
          const list = Array.isArray(teachersData) ? teachersData : []
          const nextAv = {}
          const nextSummary = {}
          await Promise.allSettled(
            list.map(async (t) => {
              if (!t?.id) return
              const rows = await window.api.getTeacherAvailability(t.id)
              const has = Array.isArray(rows) && rows.length > 0
              nextAv[String(t.id)] = has
              const days = Array.from(
                new Set((Array.isArray(rows) ? rows : []).map((r) => String(r?.day || "").trim()).filter(Boolean))
              ).sort((a, b) => AVAILABILITY_DAY_ORDER.indexOf(a) - AVAILABILITY_DAY_ORDER.indexOf(b))
              nextSummary[String(t.id)] = { count: Array.isArray(rows) ? rows.length : 0, days }
            })
          )
          setTeacherHasAvailabilityById(nextAv)
          setTeacherAvailabilitySummaryById(nextSummary)
        } catch (e) {
          console.error("Failed to preload teacher availability flags:", e)
          setTeacherHasAvailabilityById({})
          setTeacherAvailabilitySummaryById({})
        }

        // If a schedule file is active, compute Subject Status from assignments
        try {
          const fileResponse = await window.api.getCurrentFile()
          const activeFileId = fileResponse?.files?.[0]?.id
          await refreshSubjectAssignedStatus(activeFileId)
        } catch {
          // no active file is OK
          setSubjectAssignedById({})
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        customAlert("Error loading data: " + (error.message || "Unknown error"))
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [refreshSubjectAssignedStatus])

  useEffect(() => {
    const onAssignmentsUpdated = async (e) => {
      const scheduleFileId = e?.detail?.scheduleFileId
      if (!scheduleFileId) return
      await refreshSubjectAssignedStatus(scheduleFileId)
    }
    window.addEventListener("assignmentsUpdated", onAssignmentsUpdated)
    return () => window.removeEventListener("assignmentsUpdated", onAssignmentsUpdated)
  }, [refreshSubjectAssignedStatus])

  const HoverScrollText = ({ text, title = "", className = "" }) => {
    const wrapRef = useRef(null)
    const textRef = useRef(null)
    const [overflowPx, setOverflowPx] = useState(0)
    const [hovered, setHovered] = useState(false)

    useEffect(() => {
      const measure = () => {
        const wrap = wrapRef.current
        const el = textRef.current
        if (!wrap || !el) return
        const next = Math.max(0, el.scrollWidth - wrap.clientWidth)
        setOverflowPx(next)
      }

      const raf = window.requestAnimationFrame(measure)
      window.addEventListener("resize", measure)
      return () => {
        window.cancelAnimationFrame(raf)
        window.removeEventListener("resize", measure)
      }
    }, [text])

    const durationSec = Math.max(3, Math.min(14, overflowPx / 35))

    return (
      <div
        ref={wrapRef}
        className={`w-full overflow-hidden whitespace-nowrap ${className}`}
        title={title || text}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span
          ref={textRef}
          className="inline-block"
          style={
            hovered && overflowPx > 0
              ? {
                  ["--md-marquee-x"]: `-${overflowPx}px`,
                  animation: `md-hover-marquee ${durationSec}s linear infinite alternate`,
                }
              : { transform: "translateX(0)" }
          }
        >
          {text}
        </span>
      </div>
    )
  }

  // Close Classes dropdown when switching to another tab
  useEffect(() => {
    if (activeTab !== "Classes") setClassesDropdownOpen(false)
  }, [activeTab])

  // Outside-click: close dropdown when clicking outside the Classes tab + dropdown area
  useEffect(() => {
    if (!classesDropdownOpen) return
    const handleClickOutside = (e) => {
      if (classesTabRef.current && !classesTabRef.current.contains(e.target)) {
        setClassesDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [classesDropdownOpen])

  const handleAdd = () => {
    setFormData({})
    setShowAddModal(true)
  }

  const selectItem = (item) => {
    setShowAvailabilityPanel(false)
    setSelectedItem((prev) => {
      const isSame = prev?.id === item?.id
      if (isSame) {
        setFormData({})
        return null
      }
      setFormData({ ...item })
      return item
    })
  }

  const handleDelete = async (type, id) => {
    customConfirm(`Are you sure you want to delete this ${type.toLowerCase()}?`, async () => {
      setIsDeleting(true)
      try {
        const result = await window.api[`delete${type}`](id)
        if (result.success) {
          if (type === "Teacher") setTeachers((prev) => prev.filter((t) => t.id !== id))
          else if (type === "Subject") setSubjects((prev) => prev.filter((s) => s.id !== id))
          else if (type === "Room") setRooms((prev) => prev.filter((r) => r.id !== id))
          else if (type === "Class") setClasses((prev) => prev.filter((c) => c.id !== id))
          else if (type === "Program") setPrograms((prev) => prev.filter((p) => p.id !== id))

          setSelectedItem((prev) => (prev?.id === id ? null : prev))

          customAlert(`${type} deleted successfully!`)
          const fileResponse = await window.api.getCurrentFile()
          if (fileResponse?.files && fileResponse.files.length > 0) {
            const currentFile = fileResponse.files[0]
            const updatedFile = { ...currentFile, updatedAt: new Date().toISOString(), hasUnsavedChanges: true }
            await window.api.setCurrentFile(updatedFile)
          }
        } else {
          customAlert(result.message || `Failed to delete ${type.toLowerCase()}.`)
        }
      } catch (error) {
        console.error(`Error deleting ${type.toLowerCase()}:`, error)
        customAlert(`Error deleting ${type.toLowerCase()}: ${error.message || "Unknown error"}`)
      } finally {
        setIsDeleting(false)
      }
    })
  }

  const handleSave = async (isAdding = false) => {
    setIsSaving(true)
    try {
      if (activeTab === "Teachers" && (!formData.fullName || !formData.color)) {
        customAlert("Full name and color are required.")
        return
      }
      if (activeTab === "Subjects" && (!formData.name || !formData.code || !formData.units)) {
        customAlert("Name, code, and units are required.")
        return
      }
      if (activeTab === "Rooms" && (!formData.name || !formData.capacity)) {
        customAlert("Name and capacity are required.")
        return
      }
      if (
        activeTab === "Classes" &&
        (!formData.name || !formData.students || !formData.programId || !formData.yearLevel)
      ) {
        customAlert("All fields are required.")
        return
      }
      if (activeTab === "Programs" && (!formData.name || !formData.years)) {
        customAlert("Name and years are required.")
        return
      }

      let newItem
      if (activeTab === "Teachers") {
        const result = await window.api.saveTeacher(formData)
        if (result.success) {
          newItem = { ...formData, id: result.id || (isAdding ? Date.now() : formData.id) }
          setTeachers((prev) => (isAdding ? [...prev, newItem] : prev.map((t) => (t.id === formData.id ? newItem : t))))
        } else {
          customAlert(result.message || "Failed to save teacher.")
          return
        }
      } else if (activeTab === "Subjects") {
        const result = await window.api.saveSubject(formData)
        if (result.success) {
          newItem = { ...formData, id: result.id || (isAdding ? Date.now() : formData.id) }
          setSubjects((prev) => (isAdding ? [...prev, newItem] : prev.map((s) => (s.id === formData.id ? newItem : s))))
        } else {
          customAlert(result.message || "Failed to save subject.")
          return
        }
      } else if (activeTab === "Rooms") {
        const result = await window.api.saveRoom(formData)
        if (result.success) {
          newItem = { ...formData, id: result.id || (isAdding ? Date.now() : formData.id) }
          setRooms((prev) => (isAdding ? [...prev, newItem] : prev.map((r) => (r.id === formData.id ? newItem : r))))
        } else {
          customAlert(result.message || "Failed to save room.")
          return
        }
      } else if (activeTab === "Classes") {
        const result = await window.api.saveClass(formData)
        if (result.success) {
          newItem = { ...formData, id: result.id || (isAdding ? Date.now() : formData.id) }
          setClasses((prev) => (isAdding ? [...prev, newItem] : prev.map((c) => (c.id === formData.id ? newItem : c))))
        } else {
          customAlert(result.message || "Failed to save class.")
          return
        }
      } else if (activeTab === "Programs") {
        const result = await window.api.saveProgram(formData)
        if (result.success) {
          newItem = { ...formData, id: result.id || (isAdding ? Date.now() : formData.id) }
          setPrograms((prev) => (isAdding ? [...prev, newItem] : prev.map((p) => (p.id === formData.id ? newItem : p))))
        } else {
          customAlert(result.message || "Failed to save program.")
          return
        }
      }

      if (isAdding) {
        setShowAddModal(false)
        setFormData({})
      } else {
        setSelectedItem(newItem)
      }

      customAlert(`${currentType} saved successfully!`)
      const fileResponse = await window.api.getCurrentFile()
      if (fileResponse?.files && fileResponse.files.length > 0) {
        const currentFile = fileResponse.files[0]
        const updatedFile = { ...currentFile, updatedAt: new Date().toISOString(), hasUnsavedChanges: true }
        await window.api.setCurrentFile(updatedFile)
      }
    } catch (error) {
      console.error(`Error saving ${currentType.toLowerCase()}:`, error)
      if (activeTab === "Teachers" && error.message.includes("SQLITE_CONSTRAINT: UNIQUE constraint failed")) {
        customAlert("A teacher with this name or color already exists.")
      } else {
        customAlert(`Error saving ${currentType.toLowerCase()}: ${error.message || "Unknown error"}`)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const tabs = ["Teachers", "Subjects", "Rooms", "Classes", "Programs"]

  // Keep selection/panel consistent when switching tabs
  useEffect(() => {
    setSelectedItem(null)
    setFormData({})
    setTableSort({ key: null, dir: "none" })
    setShowAvailabilityPanel(false)
  }, [activeTab])

  const filterData = useCallback((data, nameKey) => {
    let filtered = Array.isArray(data) ? [...data] : []

    // Text search
    if (searchQuery) {
      filtered = filtered.filter((item) => String(item?.[nameKey] || "").toLowerCase().includes(searchQuery.toLowerCase()))
    }

    // Apply tab-specific filters (preserve existing filter logic)
    if (activeTab === "Subjects") {
      if (subjectFilter.semester) filtered = filtered.filter(item => item.semester === subjectFilter.semester)
      if (subjectFilter.programId) filtered = filtered.filter(item => String(item.programId) === String(subjectFilter.programId))
      if (subjectFilter.yearLevel) filtered = filtered.filter(item => item.yearLevel === subjectFilter.yearLevel)
      if (subjectFilter.code) filtered = filtered.filter(item => item.code?.toLowerCase().includes(subjectFilter.code.toLowerCase()))
    }

    if (activeTab === "Rooms") {
      if (roomFilter.minCapacity) filtered = filtered.filter(item => item.capacity >= parseInt(roomFilter.minCapacity))
      if (roomFilter.maxCapacity) filtered = filtered.filter(item => item.capacity <= parseInt(roomFilter.maxCapacity))
    }

    if (activeTab === "Classes") {
      if (classFilter.programId) filtered = filtered.filter(item => String(item.programId) === String(classFilter.programId))
      if (classFilter.yearLevel) filtered = filtered.filter(item => item.yearLevel === classFilter.yearLevel)
    }

    return filtered
  }, [activeTab, classFilter.programId, classFilter.yearLevel, roomFilter.maxCapacity, roomFilter.minCapacity, searchQuery, subjectFilter.code, subjectFilter.programId, subjectFilter.semester, subjectFilter.yearLevel])

  const stableSort = useCallback((data, getValue, dir) => {
    if (!dir || dir === "none") return data
    const decorated = data.map((item, idx) => ({ item, idx }))
    decorated.sort((a, b) => {
      const av = getValue(a.item)
      const bv = getValue(b.item)

      let cmp = 0
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv
      else cmp = String(av ?? "").toLowerCase().localeCompare(String(bv ?? "").toLowerCase())

      if (cmp === 0) return a.idx - b.idx
      return dir === "asc" ? cmp : -cmp
    })
    return decorated.map((d) => d.item)
  }, [])

  const renderFormContent = () => {
    return (
      <>
        {activeTab === "Teachers" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                value={formData.fullName || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                placeholder="Enter full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Honorifics</label>
              <select
                value={formData.honorifics || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, honorifics: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select honorific</option>
                <option value="Mr.">Mr.</option>
                <option value="Ms.">Ms.</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Engr.">Engr.</option>
                <option value="Dr.">Dr.</option>
                <option value="Prof.">Prof.</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Choose Color</label>
              <div className="grid grid-cols-5 gap-x-4 gap-y-2 mb-2 pl-6">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${formData.color === color ? "border-teal-500 scale-110" : "border-gray-300"
                      }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData((prev) => ({ ...prev, color }))}
                    title={`Select ${color}`}
                  />
                ))}
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600">Custom Color:</label>
                <input
                  type="color"
                  value={formData.color || "#000000"}
                  onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                  className="w-12 h-8"
                />
              </div>
            </div>
          </>
        )}
        {activeTab === "Subjects" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Subject Name</label>
              <input
                type="text"
                value={formData.name || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                placeholder="Enter subject name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Subject Code</label>
              <input
                type="text"
                value={formData.code || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                placeholder="Enter subject code"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Units</label>
              <input
                type="number"
                value={formData.units || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, units: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                placeholder="Enter units"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Semester</label>
              <select
                value={formData.semester || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, semester: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select semester</option>
                <option value="1st Semester">1st Semester</option>
                <option value="2nd Semester">2nd Semester</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Course/Program</label>
              <select
                value={formData.programId || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, programId: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select program</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Year Level</label>
              <select
                value={formData.yearLevel || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, yearLevel: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select year level</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
                <option value="5th Year">5th Year</option>
                <option value="6th Year">6th Year</option>
              </select>
            </div>
          </>
        )}
        {activeTab === "Rooms" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Room/Lab Name</label>
              <input
                type="text"
                value={formData.name || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                placeholder="Enter room name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Capacity</label>
              <input
                type="number"
                value={formData.capacity || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, capacity: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                placeholder="Enter capacity"
              />
            </div>
          </>
        )}
        {activeTab === "Classes" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Class Name</label>
              <input
                type="text"
                value={formData.name || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                placeholder="Enter class name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">No. of Students</label>
              <input
                type="number"
                value={formData.students || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, students: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                placeholder="Enter number of students"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Program</label>
              <select
                value={formData.programId || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, programId: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select program</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Year Level</label>
              <select
                value={formData.yearLevel || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, yearLevel: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select year level</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
                <option value="5th Year">5th Year</option>
                <option value="6th Year">6th Year</option>
              </select>
            </div>
          </>
        )}
        {activeTab === "Programs" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Program Name</label>
              <input
                type="text"
                value={formData.name || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                placeholder="Enter program name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Years Offered</label>
              <input
                type="number"
                value={formData.years || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, years: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                placeholder="Enter years offered"
              />
            </div>
          </>
        )}
      </>
    )
  }

  if (isLoading) {
    return <div className="p-4">Loading...</div>
  }

  return (
    <div className="p-4 h-[calc(100vh-20px)] overflow-hidden bg-[#f8f8f8]">
      <style>{`
        @keyframes md-hover-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(var(--md-marquee-x)); }
        }
      `}</style>
      <div className="-mx-4 -mt-4 px-4 py-3 bg-white shadow-sm">
        <div className="flex items-center border-l-4 pl-4" style={{ borderColor: "#fff" }}>
          <h1 className="text-xl font-semibold text-gray-800">Data Management</h1>
        </div>
      </div>
      <div className="-mx-4 px-4 bg-white border-b border-gray-200 mb-6">
        <nav className="flex space-x-6">
          {tabs.map((tab) =>
            tab === "Classes" ? (
              <div key={tab} ref={classesTabRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (activeTab === "Classes") {
                      setClassesDropdownOpen((prev) => !prev)
                    } else {
                      setActiveTab("Classes")
                      setSearchQuery("")
                      setShowSubjectFilter(false)
                      setShowRoomFilter(false)
                      setShowClassFilter(false)
                      setClassesDropdownOpen(false)
                    }
                  }}
                  className={`pb-2 px-1 text-sm font-medium transition-colors flex items-center gap-0.5
                    ${activeTab === tab ? "text-[#031844] border-b-2 border-[#031844]" : "text-gray-500 hover:text-gray-700"}`}
                  aria-expanded={activeTab === "Classes" && classesDropdownOpen}
                  aria-haspopup="true"
                >
                  {tab}
                  <FiChevronDown className="w-4 h-4 shrink-0" aria-hidden />
                </button>
                {activeTab === "Classes" && classesDropdownOpen && (
                  <div
                    className="absolute left-1/2 top-full mt-0 -translate-x-1/2 w-max rounded-md bg-white text-black shadow-[0_2px_8px_rgba(0,0,0,0.08)] z-20 py-1"
                    role="menu"
                    aria-label="Classes actions"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setClassesDropdownOpen(false)
                        navigate("/manage/merge")
                      }}
                      className="group flex items-center justify-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors duration-200 ease-in-out focus:outline-none focus:bg-gray-50"
                    >
                      <span>Merge Class</span>
                      <FaArrowRight className="w-4 h-4 shrink-0 transition-transform duration-200 ease-in-out group-hover:translate-x-1" aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab)
                  setSearchQuery("")
                  setShowSubjectFilter(false)
                  setShowRoomFilter(false)
                  setShowClassFilter(false)
                }}
                className={`pb-2 px-1 text-sm font-medium transition-colors
                  ${activeTab === tab ? "text-[#031844] border-b-2 border-[#031844]" : "text-gray-500 hover:text-gray-700"}`}
              >
                {tab}
              </button>
            )
          )}
        </nav>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleAdd}
          disabled={isSaving || isDeleting}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-zinc-900 hover:bg-[#e5e5e5] transition-colors ${isSaving || isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <FiPlus /> Add New
        </button>
      </div>
      <div className={`grid grid-cols-1 ${selectedItem ? "lg:grid-cols-[1fr_400px]" : "lg:grid-cols-1"} gap-6 h-[calc(100vh-18rem)]`}>
        <div className="bg-[#FEFEFE] border border-[#9D9D9D] rounded-lg p-6 flex flex-col overflow-hidden h-[calc(100vh-12rem)]">
          {/* Teachers Tab */}
          {activeTab === "Teachers" && (
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{activeTab} List</h2>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search teachers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-64 focus:outline-none
                  focus:ring-1 focus:ring-blue-500
                  focus:border-blue-500"
                  />
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>
              </div>
            </div>
          )}

          {/* Subjects Tab */}
          {activeTab === "Subjects" && (
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{activeTab} List</h2>
              <div className="flex items-center gap-4">
                <div className="relative flex gap-2">
                  <input
                    type="text"
                    placeholder="Search subjects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none
                  focus:ring-1 focus:ring-blue-500
                  focus:border-blue-500"
                  />
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <button
                    onClick={() => setShowSubjectFilter(!showSubjectFilter)}
                    className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                    title="Filter subjects"
                  >
                    <FiFilter className="w-5 h-5 text-[#031844]" />
                  </button>
                  {showSubjectFilter && (
                    <div className="absolute right-0 top-12 mt-2 w-64 bg-white border rounded-lg shadow-lg p-4 z-10">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                          <select
                            value={subjectFilter.semester}
                            onChange={(e) => setSubjectFilter(prev => ({ ...prev, semester: e.target.value }))}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">All Semesters</option>
                            <option value="1st Semester">1st Semester</option>
                            <option value="2nd Semester">2nd Semester</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Course/Program</label>
                          <select
                            value={subjectFilter.programId}
                            onChange={(e) => setSubjectFilter(prev => ({ ...prev, programId: e.target.value }))}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">All Programs</option>
                            {programs.map((program) => (
                              <option key={program.id} value={program.id}>
                                {program.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Year Level</label>
                          <select
                            value={subjectFilter.yearLevel}
                            onChange={(e) => setSubjectFilter(prev => ({ ...prev, yearLevel: e.target.value }))}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">All Year Levels</option>
                            <option value="1st Year">1st Year</option>
                            <option value="2nd Year">2nd Year</option>
                            <option value="3rd Year">3rd Year</option>
                            <option value="4th Year">4th Year</option>
                            <option value="5th Year">5th Year</option>
                            <option value="6th Year">6th Year</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
                          <input
                            type="text"
                            value={subjectFilter.code}
                            onChange={(e) => setSubjectFilter(prev => ({ ...prev, code: e.target.value }))}
                            placeholder="Enter code..."
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                          />
                        </div>

                        <button
                          onClick={() => setShowSubjectFilter(false)}
                          className="w-full px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 text-sm"
                        >
                          Apply Filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Rooms Tab */}
          {activeTab === "Rooms" && (
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{activeTab} List</h2>
              <div className="flex items-center gap-4">
                <div className="relative flex gap-2">
                  <input
                    type="text"
                    placeholder="Search rooms..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none
                  focus:ring-1 focus:ring-blue-500
                  focus:border-blue-500"
                  />
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <button
                    onClick={() => setShowRoomFilter(!showRoomFilter)}
                    className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                    title="Filter rooms"
                  >
                    <FiFilter className="w-5 h-5 text-[#031844]" />
                  </button>
                  {showRoomFilter && (
                    <div className="absolute right-0 top-12 mt-2 w-64 bg-white border rounded-lg shadow-lg p-4 z-10">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Min Capacity</label>
                          <input
                            type="number"
                            value={roomFilter.minCapacity}
                            onChange={(e) => setRoomFilter(prev => ({ ...prev, minCapacity: e.target.value }))}
                            placeholder="Minimum capacity"
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Max Capacity</label>
                          <input
                            type="number"
                            value={roomFilter.maxCapacity}
                            onChange={(e) => setRoomFilter(prev => ({ ...prev, maxCapacity: e.target.value }))}
                            placeholder="Maximum capacity"
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                          />
                        </div>

                        <button
                          onClick={() => setShowRoomFilter(false)}
                          className="w-full px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 text-sm"
                        >
                          Apply Filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Classes Tab */}
          {activeTab === "Classes" && (
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">{activeTab} List</h2>

              </div>
              <div className="flex items-center gap-4">
                <div className="relative flex gap-2">
                  <input
                    type="text"
                    placeholder="Search classes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none
                  focus:ring-1 focus:ring-blue-500
                  focus:border-blue-500"
                  />
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <button
                    onClick={() => setShowClassFilter(!showClassFilter)}
                    className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                    title="Filter classes"
                  >
                    <FiFilter className="w-5 h-5 text-[#031844]" />
                  </button>
                  {showClassFilter && (
                    <div className="absolute right-0 top-12 mt-2 w-64 bg-white border rounded-lg shadow-lg p-4 z-10">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Course/Program</label>
                          <select
                            value={classFilter.programId}
                            onChange={(e) => setClassFilter(prev => ({ ...prev, programId: e.target.value }))}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">All Programs</option>
                            {programs.map((program) => (
                              <option key={program.id} value={program.id}>
                                {program.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Year Level</label>
                          <select
                            value={classFilter.yearLevel}
                            onChange={(e) => setClassFilter(prev => ({ ...prev, yearLevel: e.target.value }))}
                            className="w-full p-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">All Year Levels</option>
                            <option value="1st Year">1st Year</option>
                            <option value="2nd Year">2nd Year</option>
                            <option value="3rd Year">3rd Year</option>
                            <option value="4th Year">4th Year</option>
                            <option value="5th Year">5th Year</option>
                            <option value="6th Year">6th Year</option>
                          </select>
                        </div>

                        <button
                          onClick={() => setShowClassFilter(false)}
                          className="w-full px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 text-sm"
                        >
                          Apply Filters
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}


          {/* Programs Tab */}
          {activeTab === "Programs" && (
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">{activeTab} List</h2>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search programs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none
                  focus:ring-1 focus:ring-blue-500
                  focus:border-blue-500"
                  />
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto
            [scrollbar-width:thin] [scrollbar-color:rgba(211,211,211,0.65)_transparent]
            [::-webkit-scrollbar]:w-2
            [::-webkit-scrollbar-track]:bg-transparent
            [::-webkit-scrollbar-thumb]:bg-[rgba(211,211,211,0.65)]
            [::-webkit-scrollbar-thumb:hover]:bg-[rgba(161,161,161,0.65)]
            [::-webkit-scrollbar-thumb:active]:bg-[rgba(161,161,161,0.65)]
            [::-webkit-scrollbar-thumb]:rounded-full
            [::-webkit-scrollbar-button]:hidden">
            {activeTab === "Teachers" && (
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[12%]" />
                  <col className="w-[43%]" />
                  <col className="w-[12%]" />
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#989898]">
                    {[
                      { key: "no", label: "No.", sortable: false },
                      { key: "color", label: "Color", sortable: false },
                      { key: "name", label: "Name", sortable: true, align: "left" },
                      { key: "subjects", label: "Subjects", sortable: true },
                      { key: "availability", label: "Availability status", sortable: true },
                      { key: "action", label: "Action", sortable: false },
                    ].map((col) => {
                      const isActive = tableSort.key === col.key && tableSort.dir !== "none"
                      const Icon = !isActive
                        ? MdKeyboardArrowDown
                        : tableSort.dir === "asc"
                          ? MdKeyboardArrowDown
                          : MdOutlineKeyboardArrowUp

                      return (
                        <th
                          key={col.key}
                          className={`py-3 font-medium text-[#8E8E8E] ${col.align === "left" ? "text-left" : "text-center"}`}
                        >
                          {col.sortable ? (
                            <button
                              type="button"
                              onClick={() => handleTableSort(col.key)}
                              className={`w-full flex items-center gap-1 cursor-pointer select-none hover:text-[#6f6f6f] ${col.align === "left" ? "justify-start px-4" : "justify-center"}`}
                            >
                              <span>{col.label}</span>
                              <span className="w-5 h-5 flex items-center justify-center">
                                <Icon className={`w-5 h-5 ${isActive ? "opacity-100" : "opacity-0"}`} aria-hidden />
                              </span>
                            </button>
                          ) : (
                            <div className={`w-full flex items-center ${col.align === "left" ? "justify-start px-4" : "justify-center"}`}>
                              <span>{col.label}</span>
                              <span className="w-5 h-5" />
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {stableSort(
                    filterData(teachers, "fullName"),
                    (t) => {
                      const key = (tableSort.dir === "none" ? "name" : tableSort.key)
                      if (key === "name") return `${t?.honorifics || ""} ${t?.fullName || ""}`.trim()
                      if (key === "subjects") return Number(teacherSubjectCountById?.[String(t?.id)] || 0)
                      if (key === "availability") return Number(teacherAvailabilitySummaryById?.[String(t?.id)]?.count || 0)
                      return `${t?.honorifics || ""} ${t?.fullName || ""}`.trim()
                    },
                    (tableSort.dir === "none" ? "asc" : tableSort.dir)
                  ).map((teacher, index) => {
                    const isSelected = selectedItem?.id === teacher.id
                    const subjectsCount = Number(teacherSubjectCountById?.[String(teacher.id)] || 0)
                    const hasAvailability = !!teacherHasAvailabilityById?.[String(teacher.id)]
                    const avSummary = teacherAvailabilitySummaryById?.[String(teacher.id)] || { count: 0, days: [] }
                    const slotCount = Number(avSummary.count || 0)
                    const dayText = Array.isArray(avSummary.days) && avSummary.days.length > 0 ? ` (${avSummary.days.join(", ")})` : ""
                    const tooltip = `Availability: ${slotCount} slot${slotCount === 1 ? "" : "s"}${slotCount > 0 ? dayText : ""}`
                    return (
                      <tr
                        key={teacher.id}
                        className={`border-b border-[#DFDFDF] cursor-pointer even:bg-[#F1F2FB]/65 hover:bg-[#ECEFF7] ${isSelected ? "bg-[#DFE5F6] shadow-[inset_0_0_0_2px_#ADC2E9]" : ""}`}
                        onClick={() => selectItem(teacher)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setSelectedItem(teacher)
                          setFormData({ ...teacher })
                          setShowAvailabilityPanel(true)
                        }}
                      >
                        <td className="py-3 text-center text-black/70">{index + 1}.</td>
                        <td className="py-3 text-center text-black">
                          <div className="flex items-center justify-center">
                            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: teacher.color }} />
                          </div>
                        </td>
                        <td className="py-3 text-left text-black px-4">
                          {teacher.honorifics} {teacher.fullName}
                        </td>
                        <td className="py-3 text-center text-black">{subjectsCount}</td>
                        <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={async () => {
                              // Open availability panel even without selecting row first
                              setSelectedItem(teacher)
                              setFormData({ ...teacher })
                              await refreshTeacherHasAvailability(teacher.id)
                              setShowAvailabilityPanel(true)
                            }}
                            className={`inline-flex items-center justify-center px-3 py-[2px] rounded-full text-[11px] leading-none whitespace-nowrap ${
                              hasAvailability ? "bg-[#4F7DFF] text-white font-bold" : "bg-[#D9D9D9] text-black font-normal"
                            }`}
                            title={tooltip}
                          >
                            {hasAvailability ? "Set" : "Not set"}
                          </button>
                        </td>
                        <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleDelete("Teacher", teacher.id)}
                              disabled={isDeleting}
                              className={`inline-flex items-center justify-center p-1 text-black/60 hover:text-red-700 ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}
                              aria-label={`Delete ${teacher.fullName}`}
                              title="Delete"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {activeTab === "Subjects" && (
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[31%]" />
                  <col className="w-[13%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#989898]">
                    {[
                      { key: "no", label: "No.", sortable: false },
                      { key: "name", label: "Subject Name", sortable: true, filterable: true, onFilter: () => setShowSubjectFilter((p) => !p), align: "left" },
                      { key: "code", label: "Code", sortable: true },
                      { key: "units", label: "Units", sortable: true },
                      { key: "course", label: "Course", sortable: true },
                      { key: "yearLevel", label: "Year", sortable: true },
                      { key: "status", label: "Status", sortable: true },
                      { key: "action", label: "Action", sortable: false },
                    ].map((col) => {
                      const isActive = tableSort.key === col.key && tableSort.dir !== "none"
                      const Icon = !isActive
                        ? MdKeyboardArrowDown
                        : tableSort.dir === "asc"
                          ? MdKeyboardArrowDown
                          : MdOutlineKeyboardArrowUp

                      return (
                        <th
                          key={col.key}
                          className={`py-3 font-medium text-[#8E8E8E] ${col.align === "left" ? "text-left" : "text-center"}`}
                        >
                          {col.sortable ? (
                            <div className={`w-full flex items-center gap-1 ${col.align === "left" ? "justify-start px-4" : "justify-center"}`}>
                              <button
                                type="button"
                                onClick={() => handleTableSort(col.key)}
                                className={`flex items-center gap-1 cursor-pointer select-none hover:text-[#6f6f6f] ${col.align === "left" ? "justify-start" : "justify-center"}`}
                              >
                                <span>{col.label}</span>
                                <span className="w-5 h-5 flex items-center justify-center">
                                  <Icon className={`w-5 h-5 ${isActive ? "opacity-100" : "opacity-0"}`} aria-hidden />
                                </span>
                              </button>
                              {col.filterable && (
                                <button
                                  type="button"
                                  onClick={col.onFilter}
                                  className="p-1 rounded hover:bg-black/[0.04] transition-colors"
                                  title="Filter"
                                  aria-label="Filter"
                                >
                                  <FiFilter className="w-4 h-4 text-[#8E8E8E]" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className={`w-full flex items-center ${col.align === "left" ? "justify-start px-4" : "justify-center"}`}>
                              <span>{col.label}</span>
                              <span className="w-5 h-5" />
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {stableSort(
                    filterData(subjects, "name"),
                    (s) => {
                      const key = tableSort.dir === "none" ? "name" : tableSort.key
                      if (key === "no") return 0
                      if (key === "name") return s?.name || ""
                      if (key === "code") return s?.code || ""
                      if (key === "units") return Number(s?.units ?? 0)
                      if (key === "course") return getCourseShortName(s?.programId || "")
                      if (key === "yearLevel") return s?.yearLevel || ""
                      if (key === "status") return subjectAssignedById?.[String(s?.id)] ? 1 : 0
                      return s?.name || ""
                    },
                    tableSort.dir === "none" ? "asc" : tableSort.dir
                  ).map((subject, index) => {
                    const isSelected = selectedItem?.id === subject.id
                    const program = getProgramById(subject.programId)
                    const courseShort = getCourseShortName(subject.programId)
                    const isAssigned = !!subjectAssignedById?.[String(subject.id)]
                    return (
                      <tr
                        key={subject.id}
                        className={`border-b border-[#DFDFDF] cursor-pointer even:bg-[#F1F2FB]/65 hover:bg-[#ECEFF7] ${isSelected ? "bg-[#DFE5F6] shadow-[inset_0_0_0_2px_#ADC2E9]" : ""}`}
                        onClick={() => selectItem(subject)}
                      >
                        <td className="py-3 text-center text-black/70">{index + 1}.</td>
                        <td className="py-3 text-left text-black px-4">
                          <HoverScrollText text={subject.name || ""} />
                        </td>
                        <td className="py-3 text-center text-black">{subject.code}</td>
                        <td className="py-3 text-center text-black">{subject.units}</td>
                        <td className="py-3 text-center text-black" title={program?.name || ""}>
                          {courseShort}
                        </td>
                        <td className="py-3 text-center text-black">{subject.yearLevel}</td>
                        <td className="py-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center px-2 py-[2px] rounded-full text-black text-[11px] leading-none whitespace-nowrap ${
                              isAssigned ? "bg-[#80A1FF]" : "bg-[#D9D9D9]"
                            }`}
                          >
                            {isAssigned ? "Assigned" : "Unassigned"}
                          </span>
                        </td>
                        <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDelete("Subject", subject.id)}
                            disabled={isDeleting}
                            className={`inline-flex items-center justify-center p-1 text-black/60 hover:text-red-700 ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}
                            aria-label={`Delete ${subject.name}`}
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {activeTab === "Rooms" && (
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[55%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#989898]">
                    {[
                      { key: "no", label: "No.", sortable: false },
                      { key: "name", label: "Room Name", sortable: true, align: "left" },
                      { key: "capacity", label: "Capacity", sortable: true, filterable: true, onFilter: () => setShowRoomFilter((p) => !p) },
                      { key: "action", label: "Action", sortable: false },
                    ].map((col) => {
                      const isActive = tableSort.key === col.key && tableSort.dir !== "none"
                      const Icon = !isActive
                        ? MdKeyboardArrowDown
                        : tableSort.dir === "asc"
                          ? MdKeyboardArrowDown
                          : MdOutlineKeyboardArrowUp

                      return (
                        <th
                          key={col.key}
                          className={`py-3 font-medium text-[#8E8E8E] ${col.align === "left" ? "text-left" : "text-center"}`}
                        >
                          {col.sortable ? (
                            <div className={`w-full flex items-center gap-1 ${col.align === "left" ? "justify-start px-4" : "justify-center"}`}>
                              <button
                                type="button"
                                onClick={() => handleTableSort(col.key)}
                                className="flex items-center gap-1 cursor-pointer select-none hover:text-[#6f6f6f]"
                              >
                                <span>{col.label}</span>
                                <span className="w-5 h-5 flex items-center justify-center">
                                  <Icon className={`w-5 h-5 ${isActive ? "opacity-100" : "opacity-0"}`} aria-hidden />
                                </span>
                              </button>
                              {col.filterable && (
                                <button
                                  type="button"
                                  onClick={col.onFilter}
                                  className="p-1 rounded hover:bg-black/[0.04] transition-colors"
                                  title="Filter"
                                  aria-label="Filter"
                                >
                                  <FiFilter className="w-4 h-4 text-[#8E8E8E]" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className={`w-full flex items-center ${col.align === "left" ? "justify-start px-4" : "justify-center"}`}>
                              <span>{col.label}</span>
                              <span className="w-5 h-5" />
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {stableSort(
                    filterData(rooms, "name"),
                    (r) => {
                      const key = tableSort.dir === "none" ? "name" : tableSort.key
                      if (key === "no") return 0
                      if (key === "name") return r?.name || ""
                      if (key === "capacity") return Number(r?.capacity ?? 0)
                      return r?.name || ""
                    },
                    tableSort.dir === "none" ? "asc" : tableSort.dir
                  ).map((room, index) => {
                    const isSelected = selectedItem?.id === room.id
                    return (
                      <tr
                        key={room.id}
                        className={`border-b border-[#DFDFDF] cursor-pointer even:bg-[#F1F2FB]/65 hover:bg-[#ECEFF7] ${isSelected ? "bg-[#DFE5F6] shadow-[inset_0_0_0_2px_#ADC2E9]" : ""}`}
                        onClick={() => selectItem(room)}
                      >
                        <td className="py-3 text-center text-black/70">{index + 1}.</td>
                        <td className="py-3 text-left text-black px-4">{room.name}</td>
                        <td className="py-3 text-center text-black">{room.capacity}</td>
                        <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDelete("Room", room.id)}
                            disabled={isDeleting}
                            className={`inline-flex items-center justify-center p-1 text-black/60 hover:text-red-700 ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}
                            aria-label={`Delete ${room.name}`}
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {activeTab === "Classes" && (
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[55%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#989898]">
                    {[
                      { key: "no", label: "No.", sortable: false },
                      { key: "name", label: "Class Name", sortable: true, filterable: true, onFilter: () => setShowClassFilter((p) => !p), align: "left" },
                      { key: "students", label: "No. of Students", sortable: true },
                      { key: "action", label: "Action", sortable: false },
                    ].map((col) => {
                      const isActive = tableSort.key === col.key && tableSort.dir !== "none"
                      const Icon = !isActive
                        ? MdKeyboardArrowDown
                        : tableSort.dir === "asc"
                          ? MdKeyboardArrowDown
                          : MdOutlineKeyboardArrowUp

                      return (
                        <th
                          key={col.key}
                          className={`py-3 font-medium text-[#8E8E8E] ${col.align === "left" ? "text-left" : "text-center"}`}
                        >
                          {col.sortable ? (
                            <div className={`w-full flex items-center gap-1 ${col.align === "left" ? "justify-start px-4" : "justify-center"}`}>
                              <button
                                type="button"
                                onClick={() => handleTableSort(col.key)}
                                className="flex items-center gap-1 cursor-pointer select-none hover:text-[#6f6f6f]"
                              >
                                <span>{col.label}</span>
                                <span className="w-5 h-5 flex items-center justify-center">
                                  <Icon className={`w-5 h-5 ${isActive ? "opacity-100" : "opacity-0"}`} aria-hidden />
                                </span>
                              </button>
                              {col.filterable && (
                                <button
                                  type="button"
                                  onClick={col.onFilter}
                                  className="p-1 rounded hover:bg-black/[0.04] transition-colors"
                                  title="Filter"
                                  aria-label="Filter"
                                >
                                  <FiFilter className="w-4 h-4 text-[#8E8E8E]" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className={`w-full flex items-center ${col.align === "left" ? "justify-start px-4" : "justify-center"}`}>
                              <span>{col.label}</span>
                              <span className="w-5 h-5" />
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {stableSort(
                    filterData(classes, "name"),
                    (c) => {
                      const key = tableSort.dir === "none" ? "name" : tableSort.key
                      if (key === "no") return 0
                      if (key === "name") return c?.name || ""
                      if (key === "students") return Number(c?.students ?? 0)
                      return c?.name || ""
                    },
                    tableSort.dir === "none" ? "asc" : tableSort.dir
                  ).map((cls, index) => {
                    const isSelected = selectedItem?.id === cls.id
                    return (
                      <tr
                        key={cls.id}
                        className={`border-b border-[#DFDFDF] cursor-pointer even:bg-[#F1F2FB]/65 hover:bg-[#ECEFF7] ${isSelected ? "bg-[#DFE5F6] shadow-[inset_0_0_0_2px_#ADC2E9]" : ""}`}
                        onClick={() => selectItem(cls)}
                      >
                        <td className="py-3 text-center text-black/70">{index + 1}.</td>
                        <td className="py-3 text-left text-black px-4">{cls.name}</td>
                        <td className="py-3 text-center text-black">{cls.students}</td>
                        <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDelete("Class", cls.id)}
                            disabled={isDeleting}
                            className={`inline-flex items-center justify-center p-1 text-black/60 hover:text-red-700 ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}
                            aria-label={`Delete ${cls.name}`}
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {activeTab === "Programs" && (
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[55%]" />
                  <col className="w-[20%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-[#989898]">
                    {[
                      { key: "no", label: "No.", sortable: false },
                      { key: "name", label: "Program Name", sortable: true, align: "left" },
                      { key: "years", label: "Years", sortable: true },
                      { key: "action", label: "Action", sortable: false },
                    ].map((col) => {
                      const isActive = tableSort.key === col.key && tableSort.dir !== "none"
                      const Icon = !isActive
                        ? MdKeyboardArrowDown
                        : tableSort.dir === "asc"
                          ? MdKeyboardArrowDown
                          : MdOutlineKeyboardArrowUp

                      return (
                        <th
                          key={col.key}
                          className={`py-3 font-medium text-[#8E8E8E] ${col.align === "left" ? "text-left" : "text-center"}`}
                        >
                          {col.sortable ? (
                            <button
                              type="button"
                              onClick={() => handleTableSort(col.key)}
                              className={`w-full flex items-center gap-1 cursor-pointer select-none hover:text-[#6f6f6f] ${col.align === "left" ? "justify-start px-4" : "justify-center"}`}
                            >
                              <span>{col.label}</span>
                              <span className="w-5 h-5 flex items-center justify-center">
                                <Icon className={`w-5 h-5 ${isActive ? "opacity-100" : "opacity-0"}`} aria-hidden />
                              </span>
                            </button>
                          ) : (
                            <div className={`w-full flex items-center ${col.align === "left" ? "justify-start px-4" : "justify-center"}`}>
                              <span>{col.label}</span>
                              <span className="w-5 h-5" />
                            </div>
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {stableSort(
                    filterData(programs, "name"),
                    (p) => {
                      const key = tableSort.dir === "none" ? "name" : tableSort.key
                      if (key === "no") return 0
                      if (key === "name") return p?.name || ""
                      if (key === "years") return String(p?.years ?? "")
                      return p?.name || ""
                    },
                    tableSort.dir === "none" ? "asc" : tableSort.dir
                  ).map((program, index) => {
                    const isSelected = selectedItem?.id === program.id
                    return (
                      <tr
                        key={program.id}
                        className={`border-b border-[#DFDFDF] cursor-pointer even:bg-[#F1F2FB]/65 hover:bg-[#ECEFF7] ${isSelected ? "bg-[#DFE5F6] shadow-[inset_0_0_0_2px_#ADC2E9]" : ""}`}
                        onClick={() => selectItem(program)}
                      >
                        <td className="py-3 text-center text-black/70">{index + 1}.</td>
                        <td className="py-3 text-left text-black px-4">{program.name}</td>
                        <td className="py-3 text-center text-black">{program.years}</td>
                        <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleDelete("Program", program.id)}
                            disabled={isDeleting}
                            className={`inline-flex items-center justify-center p-1 text-black/60 hover:text-red-700 ${isDeleting ? "opacity-50 cursor-not-allowed" : ""}`}
                            aria-label={`Delete ${program.name}`}
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {selectedItem && (
          <div className="bg-[#FEFEFE] border border-[#9D9D9D] rounded-lg p-6 overflow-hidden flex flex-col h-[calc(100vh-12rem)]">
            {activeTab === "Teachers" && showAvailabilityPanel ? (
              <TeacherAvailabilityPanel
                teacher={selectedItem}
                onBack={async () => {
                  // refresh button state after edits
                  await refreshTeacherHasAvailability(selectedItem?.id)
                  setShowAvailabilityPanel(false)
                }}
              />
            ) : (
              <>
                <div className="flex justify-between items-center mb-4 shrink-0">
                  <h3 className="text-base font-medium text-black">{currentType} Info</h3>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setFormData({})
                        setSelectedItem(null)
                      }}
                      className="px-6 py-2 rounded-md bg-[#FEFEFE] text-[#3787EF] border-2 border-[#3787EF] hover:bg-[#3787EF] hover:text-[#FEFEFE] transition-colors duration-200 ease-in-out text-sm font-medium"
                      disabled={isSaving || isDeleting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSave(false)}
                      disabled={isSaving || isDeleting}
                      className="px-6 py-2 rounded-md bg-[#3787EF] text-white font-bold hover:bg-[#0A5AC2] transition-colors duration-200 ease-in-out text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
                <div className="space-y-4 flex-1 min-h-0 overflow-y-auto
                  [scrollbar-width:thin] [scrollbar-color:#D3D3D3_transparent]
                  [::-webkit-scrollbar]:w-2
                  [::-webkit-scrollbar-track]:bg-transparent
                  [::-webkit-scrollbar-thumb]:bg-[#D3D3D3]
                  [::-webkit-scrollbar-thumb:hover]:bg-[#A1A1A1]
                  [::-webkit-scrollbar-thumb]:rounded-full"
                >
                  {renderFormContent()}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <div
          className="fixed inset-0 z-[99999] bg-[#070707]/60 flex items-center justify-center p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              e.stopPropagation()
              setShowAddModal(false)
              setFormData({})
            }
          }}
        >
          <div className="bg-white rounded-[18px] shadow-[0_10px_30px_rgba(0,0,0,0.18)] w-[520px] max-w-[92vw] max-h-[80vh] overflow-hidden z-[100000] flex flex-col">
            <div className="px-7 pt-6">
              <h2 className="text-base font-bold text-black">Add New {currentType}</h2>
            </div>
            <div className="px-7 mt-4 flex-1 min-h-0 overflow-auto space-y-4
              [scrollbar-width:thin] [scrollbar-color:#D3D3D3_transparent]
              [::-webkit-scrollbar]:w-2
              [::-webkit-scrollbar-track]:bg-transparent
              [::-webkit-scrollbar-thumb]:bg-[#D3D3D3]
              [::-webkit-scrollbar-thumb:hover]:bg-[#A1A1A1]
              [::-webkit-scrollbar-thumb]:rounded-full"
            >
              {renderFormContent()}
            </div>
            <div className="px-7 pb-6 pt-4 flex gap-3 justify-end shrink-0">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setFormData({})
                }}
                className="px-6 py-2 rounded-md bg-[#FEFEFE] text-[#3787EF] border-2 border-[#3787EF] hover:bg-[#3787EF] hover:text-[#FEFEFE] transition-colors duration-200 ease-in-out text-sm font-medium"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="px-6 py-2 rounded-md bg-[#3787EF] text-white font-bold hover:bg-[#0A5AC2] transition-colors duration-200 ease-in-out text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? "Saving..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}



      {showAlertModal && (
        <Modal title="Alert" type="alert" message={alertMessage} onClose={() => setShowAlertModal(false)} />
      )}
      {showConfirmModal && (
        <Modal
          title="Confirm"
          type="confirm"
          message={confirmMessage}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={() => {
            if (confirmCallback) confirmCallback()
            setShowConfirmModal(false)
          }}
          isSaving={isDeleting}
        />
      )}

    </div>

  )
}