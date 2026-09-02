"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FaArrowLeft } from "react-icons/fa"
import Modal from "./Modal"

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAY_START_MIN = 7 * 60 // 7:00 AM
const DAY_END_MIN = 22 * 60 + 30 // 10:30 PM

function formatDuration(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h <= 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function isOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

function compactClockLabel(mins) {
  return String(window.api.minutesToClock(mins) || "").replace(/\s+/g, "")
}

export default function TeacherAvailabilityPanel({ teacher, onBack }) {
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)

  const [activeDay, setActiveDay] = useState("Mon")
  const [showSetModal, setShowSetModal] = useState(false)
  const [startMin, setStartMin] = useState(DAY_START_MIN)
  const [endMin, setEndMin] = useState(DAY_START_MIN + 120)

  const [scheduleFileId, setScheduleFileId] = useState(null)

  const [alert, setAlert] = useState({ open: false, message: "" })
  const [contextMenu, setContextMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    slotId: null,
    placeAbove: true,
    areaW: 0,
    areaH: 0,
  })
  const panelRef = useRef(null)
  const cardAreaRef = useRef(null)
  const dayClickTimerRef = useRef(null)

  const refresh = useCallback(async () => {
    if (!teacher?.id) return
    setLoading(true)
    try {
      const rows = await window.api.getTeacherAvailability(teacher.id)
      setSlots(Array.isArray(rows) ? rows : [])
    } catch (e) {
      console.error("Failed to load teacher availability:", e)
      setSlots([])
      setAlert({ open: true, message: "Failed to load availability." })
    } finally {
      setLoading(false)
    }
  }, [teacher?.id])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    window.api
      .getCurrentFile()
      .then((res) => {
        const fileId = res?.files?.[0]?.id ?? null
        setScheduleFileId(fileId)
      })
      .catch(() => setScheduleFileId(null))
  }, [])

  useEffect(() => {
    const onDocClick = (e) => {
      if (!contextMenu.open) return
      if (panelRef.current && panelRef.current.contains(e.target)) {
        // Clicking inside panel but outside remove button should close menu
        setContextMenu((p) => ({ ...p, open: false, slotId: null }))
      } else {
        setContextMenu((p) => ({ ...p, open: false, slotId: null }))
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [contextMenu.open])

  const daySlots = useMemo(() => {
    const grouped = Object.fromEntries(DAYS.map((d) => [d, []]))
    for (const s of slots || []) {
      if (grouped[s.day]) grouped[s.day].push(s)
    }
    for (const d of DAYS) grouped[d].sort((a, b) => Number(a.startMin) - Number(b.startMin))
    return grouped
  }, [slots])

  const timeOptionsStart = useMemo(() => {
    const arr = []
    for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += 30) arr.push(m)
    return arr
  }, [])

  const timeOptionsEnd = useMemo(() => {
    const arr = []
    for (let m = DAY_START_MIN + 60; m <= DAY_END_MIN; m += 30) arr.push(m)
    return arr
  }, [])

  const durationMin = endMin == null ? 0 : Math.max(0, endMin - startMin)
  const isDurationValid = endMin != null && durationMin > 60

  const openSetModalForDay = (day) => {
    setActiveDay(day)
    setStartMin(DAY_START_MIN)
    setEndMin(DAY_START_MIN + 120)
    setShowSetModal(true)
  }

  const handleDayPress = (day) => {
    // Delay single-click action to allow double-click to take precedence.
    if (dayClickTimerRef.current) {
      clearTimeout(dayClickTimerRef.current)
      dayClickTimerRef.current = null
      handleFullDay(day)
      return
    }
    dayClickTimerRef.current = setTimeout(() => {
      dayClickTimerRef.current = null
      openSetModalForDay(day)
    }, 250)
  }

  useEffect(() => {
    return () => {
      if (dayClickTimerRef.current) clearTimeout(dayClickTimerRef.current)
    }
  }, [])

  const handleAdd = async () => {
    if (endMin == null) {
      setAlert({ open: true, message: "Please select an end time." })
      return
    }
    try {
      const existing = daySlots[activeDay] || []
      if (existing.some((s) => isOverlap(startMin, endMin, Number(s.startMin), Number(s.endMin)))) {
        setAlert({ open: true, message: "Availability overlaps an existing availability slot." })
        return
      }
      const res = await window.api.addTeacherAvailability({
        teacherId: teacher.id,
        day: activeDay,
        startMin,
        endMin,
        scheduleFileId,
      })
      if (!res?.success) {
        setAlert({ open: true, message: res?.message || "Failed to add availability." })
        return
      }
      setShowSetModal(false)
      await refresh()
    } catch (e) {
      console.error("Add availability error:", e)
      setAlert({ open: true, message: "Failed to add availability." })
    }
  }

  const handleFullDay = async (day) => {
    setActiveDay(day)
    try {
      const res = await window.api.setTeacherFullDayAvailability({
        teacherId: teacher.id,
        day,
        scheduleFileId,
      })
      if (!res?.success) {
        setAlert({ open: true, message: res?.message || "Failed to set full-day availability." })
        return
      }
      await refresh()
    } catch (e) {
      console.error("Set full-day availability error:", e)
      setAlert({ open: true, message: "Failed to set full-day availability." })
    }
  }

  const handleCardContextMenu = (e, slotId) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = cardAreaRef.current?.getBoundingClientRect()
    const x = rect ? e.clientX - rect.left : e.clientX
    const y = rect ? e.clientY - rect.top : e.clientY
    setContextMenu({
      open: true,
      x,
      y,
      slotId,
      placeAbove: y > 44,
      areaW: rect?.width || 0,
      areaH: rect?.height || 0,
    })
  }

  const handleRemove = async () => {
    const slotId = contextMenu.slotId
    if (!slotId) return
    try {
      await window.api.deleteTeacherAvailability(slotId)
      setContextMenu({ open: false, x: 0, y: 0, slotId: null })
      await refresh()
    } catch (e) {
      console.error("Delete availability error:", e)
      setAlert({ open: true, message: "Failed to remove availability." })
    }
  }

  const renderCardColumn = (day) => {
    const items = daySlots[day] || []
    if (items.length === 0) return null

    const isFullDay =
      items.length === 1 && Number(items[0].startMin) === DAY_START_MIN && Number(items[0].endMin) === DAY_END_MIN

    if (items.length === 1) {
      const s = items[0]
      const height = isFullDay ? "100%" : "50%"
      return (
        <div className="relative h-full flex items-center justify-center px-1">
          <div
            className="w-full rounded-lg border bg-[#B2C6FF] border-[#4677FF] flex items-center justify-center text-[10px] font-medium text-gray-900 select-none text-center leading-[1.1] tracking-tight"
            style={{ height }}
            onContextMenu={(e) => handleCardContextMenu(e, s.id)}
          >
            <div>
              <div className="whitespace-nowrap">{compactClockLabel(Number(s.startMin))}</div>
              <div className="whitespace-nowrap">- {compactClockLabel(Number(s.endMin))}</div>
            </div>
          </div>
        </div>
      )
    }

    const durations = items.map((s) => Math.max(1, Number(s.endMin) - Number(s.startMin)))
    const total = durations.reduce((a, b) => a + b, 0)

    return (
      <div className="h-full flex flex-col gap-2 px-1 py-2">
        {items.map((s, idx) => {
          const flex = durations[idx] / total
          return (
            <div
              key={s.id}
              className="rounded-lg border bg-[#B2C6FF] border-[#4677FF] flex items-center justify-center text-[10px] font-medium text-gray-900 select-none text-center leading-[1.1] tracking-tight"
              style={{ flex: `${flex} 1 0%` }}
              onContextMenu={(e) => handleCardContextMenu(e, s.id)}
            >
              <div>
                <div className="whitespace-nowrap">{compactClockLabel(Number(s.startMin))}</div>
                <div className="whitespace-nowrap">- {compactClockLabel(Number(s.endMin))}</div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const menuStyle = useMemo(() => {
    // Keep menu inside the card display container while following cursor.
    // Approximate menu size (padding + text).
    const MENU_W = 92
    const MENU_H = 36
    const PAD = 6

    const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
    const leftMax = Math.max(PAD, (contextMenu.areaW || 0) - MENU_W - PAD)
    const topMax = Math.max(PAD, (contextMenu.areaH || 0) - MENU_H - PAD)
    const left = clamp(contextMenu.x, PAD, leftMax)
    const topPreferred = contextMenu.placeAbove ? contextMenu.y - MENU_H - 8 : contextMenu.y + 8
    const top = clamp(topPreferred, PAD, topMax)
    return { left, top }
  }, [contextMenu.areaH, contextMenu.areaW, contextMenu.placeAbove, contextMenu.x, contextMenu.y])

  return (
    <div ref={panelRef} className="relative h-full flex flex-col">
      <div className="flex items-center gap-3 mb-3 shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-md hover:bg-black/[0.04] transition-colors"
          title="Back"
          aria-label="Back"
        >
          <FaArrowLeft className="w-4 h-4 text-[#031844]" />
        </button>
        <div className="text-sm font-semibold text-gray-900">
          {teacher?.honorifics ? `${teacher.honorifics} ${teacher.fullName}` : teacher?.fullName}
        </div>
      </div>

      <div className="mb-2 shrink-0">
        <div className="text-base font-bold text-black">Time & Date Availability</div>
      </div>

      <div className="shrink-0 mb-3">
        <div className="bg-[#EBEBEB] rounded-full px-2 py-1 flex items-center justify-between gap-2">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDayPress(d)}
              className="px-3 py-1.5 rounded-full text-sm font-medium text-gray-700 hover:bg-white/70 transition-colors select-none"
              title="Click to set custom availability. Double click for full availability."
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={cardAreaRef}
        className="flex-1 min-h-0 border border-[#9D9D9D] rounded-lg bg-white overflow-hidden relative"
      >
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-600">Loading availability…</div>
        ) : (
          <>
            <div className="h-full grid grid-cols-6">
              {DAYS.map((d) => (
                <div key={d} className="border-r last:border-r-0 border-gray-100">
                  {renderCardColumn(d)}
                </div>
              ))}
            </div>

            {slots.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-sm text-gray-500 px-8 pointer-events-none">
                <div>Press the date once to add custom availability.</div>
                <div>Press the date twice to add full availability.</div>
              </div>
            )}

            {contextMenu.open && (
              <div className="absolute z-50" style={menuStyle} onMouseDown={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="px-3 py-1.5 rounded-md bg-white border border-gray-200 shadow-md text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showSetModal && (
        <Modal
          title="Set Availability"
          onClose={() => setShowSetModal(false)}
          type="form"
          customButtons={
            <>
              <button
                onClick={() => setShowSetModal(false)}
                className="px-6 py-2 rounded-md bg-[#FEFEFE] text-[#3787EF] border-2 border-[#3787EF] hover:bg-[#3787EF] hover:text-[#FEFEFE] transition-colors duration-200 ease-in-out text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!isDurationValid}
                title={!isDurationValid ? "Availability must be greater than 1 hour." : "Add availability"}
                className="px-6 py-2 rounded-md bg-[#3787EF] text-white font-bold hover:bg-[#0A5AC2] transition-colors duration-200 ease-in-out text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </>
          }
        >
          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Selected Date</div>
              <div className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50">{activeDay}</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
              <select
                value={startMin}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setStartMin(v)
                  const nextEnd = timeOptionsEnd.find((m) => m > v) ?? null
                  setEndMin(nextEnd)
                }}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                {timeOptionsStart.map((m) => (
                  <option key={m} value={m}>
                    {window.api.minutesToClock(m)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
              <select
                value={endMin ?? ""}
                onChange={(e) => setEndMin(e.target.value === "" ? null : Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select end time</option>
                {timeOptionsEnd
                  .filter((m) => m > startMin)
                  .map((m) => (
                    <option key={m} value={m}>
                      {window.api.minutesToClock(m)}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-700">
            Duration: <span className="font-medium">{formatDuration(durationMin)}</span>
          </div>
        </Modal>
      )}

      {alert.open && (
        <Modal title="Alert" type="alert" message={alert.message} onClose={() => setAlert({ open: false, message: "" })} />
      )}
    </div>
  )
}

