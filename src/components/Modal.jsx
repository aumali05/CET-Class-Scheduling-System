"use client"

import { useEffect } from "react"

export default function Modal({
  title,
  children,
  onClose,
  onSave,
  isSaving = false,
  saveText = "Save",
  type = "form",
  message,
  onConfirm,
  customButtons,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-[#070707]/60 flex items-center justify-center z-[99999] p-6"
      onClick={(e) => {
        // Close when clicking the overlay itself (outside modal) - enables fast navigation
        if (e.target === e.currentTarget) {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <div className="bg-white rounded-[18px] shadow-[0_10px_30px_rgba(0,0,0,0.18)] w-[520px] max-w-[92vw] max-h-[90vh] overflow-hidden mx-4 relative z-[100000] flex flex-col">
        <div className="px-7 pt-6">
          <h2 className="text-base font-bold text-black">{title}</h2>
        </div>
        {type === "alert" || type === "confirm" ? (
          <div className="px-7 mt-4 text-sm text-black">
            <p>{message}</p>
          </div>
        ) : (
          <div className="px-7 mt-4 flex-1 min-h-0 overflow-auto space-y-4
            [scrollbar-width:thin] [scrollbar-color:#D3D3D3_transparent]
            [::-webkit-scrollbar]:w-2
            [::-webkit-scrollbar-track]:bg-transparent
            [::-webkit-scrollbar-thumb]:bg-[#D3D3D3]
            [::-webkit-scrollbar-thumb:hover]:bg-[#A1A1A1]
            [::-webkit-scrollbar-thumb]:rounded-full"
          >
            {children}
          </div>
        )}
        <div className="px-7 pb-6 pt-4 flex justify-end gap-3 shrink-0">
          {customButtons || (
            <>
              {(type === "form" || type === "confirm") && (
                <button
                  onClick={onClose}
                  disabled={isSaving}
                  className="px-6 py-2 rounded-md bg-[#FEFEFE] text-[#3787EF] border-2 border-[#3787EF] hover:bg-[#3787EF] hover:text-[#FEFEFE] transition-colors duration-200 ease-in-out text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={type === "alert" ? onClose : type === "confirm" ? onConfirm : onSave}
                disabled={isSaving}
                className="flex items-center px-6 py-2 rounded-md bg-[#3787EF] text-white font-bold hover:bg-[#0A5AC2] transition-colors duration-200 ease-in-out text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : type === "alert" || type === "confirm" ? (
                  "OK"
                ) : (
                  saveText
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
