import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiRefreshCw, FiDownload, FiPrinter } from "react-icons/fi";
import { PiMicrosoftExcelLogoFill } from "react-icons/pi";

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

const HEADER_PRESETS = [
  { label: "Green (Default)", value: "#40C477" },
  { label: "Blue", value: "#3B82F6" },
  { label: "Teal", value: "#14B8A6" },
  { label: "Purple", value: "#8B5CF6" },
  { label: "Yellow", value: "#FACC15" },
  { label: "Gold", value: "#FFD700" },
  { label: "Gray", value: "#9CA3AF" },
  { label: "Black", value: "#111827" },
];

const TEXT_COLOR_PRESETS = [
  { label: "Default (Black)", value: "#000000" },
  { label: "Blue", value: "#2563EB" },
  { label: "Red", value: "#DC2626" },
  { label: "Green", value: "#16A34A" },
];

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function normalizeStyle(input) {
  const s = { ...DEFAULT_EXPORT_STYLE, ...(input || {}) };
  const orientation = ["portrait", "landscape"].includes(s.orientation) ? s.orientation : DEFAULT_EXPORT_STYLE.orientation;
  const maxTables = orientation === "portrait" ? 3 : 2;
  const tablesPerPage = clamp(Number(s.tablesPerPage), 1, maxTables);
  return {
    ...s,
    showCellBackground: Boolean(s.showCellBackground),
    cellBgOpacity: clamp(Number(s.cellBgOpacity), 0, 1),
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
    gridLineWidth: clamp(Number(s.gridLineWidth), 0, 6),
    gridLineOpacity: clamp(Number(s.gridLineOpacity), 0, 1),
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

function storageKey(type) {
  return `exportStyle:${type || "program"}`;
}

export default function ExportPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const fileId = state.fileId;
  const type = state.type;
  const id = state.id;

  const [style, setStyle] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey(type));
      return normalizeStyle(raw ? JSON.parse(raw) : null);
    } catch {
      return normalizeStyle(null);
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(type), JSON.stringify(style));
    } catch {
      // ignore
    }
  }, [style, type]);

  const [previewHtml, setPreviewHtml] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const debounceRef = useRef(null);

  const canRender = Boolean(fileId && type && id);

  const args = useMemo(() => {
    if (!canRender) return null;
    return {
      fileId,
      type,
      id: id === "all" ? "all" : Number.parseInt(id, 10),
      style,
    };
  }, [canRender, fileId, type, id, style]);

  useEffect(() => {
    if (!args) return;
    setPreviewError("");

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setIsLoadingPreview(true);
      try {
        const result = await window.api.generatePreview(args);
        if (result?.success) {
          setPreviewHtml(result.html || "");
        } else {
          setPreviewError(result?.message || "Failed to generate preview.");
        }
      } catch (err) {
        setPreviewError(err?.message || "Failed to generate preview.");
      } finally {
        setIsLoadingPreview(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [args]);

  const resetToDefault = () => {
    const next = normalizeStyle(null);
    setStyle(next);
    try {
      localStorage.removeItem(storageKey(type));
    } catch {
      // ignore
    }
  };

  const doExportPdf = async () => {
    if (!canRender) return;
    const result = await window.api.exportFile({
      fileId,
      type,
      id: id === "all" ? "all" : Number.parseInt(id, 10),
      format: "pdf",
      style,
    });
    if (result?.success) alert(result.message || "Exported.");
    else alert(result?.message || "Export failed.");
  };

  const doPrint = async () => {
    if (!canRender) return;
    const result = await window.api.printFile({
      fileId,
      type,
      id: id === "all" ? "all" : Number.parseInt(id, 10),
      style,
    });
    if (result?.success) alert(result.message || "Sent to printer.");
    else alert(result?.message || "Print failed.");
  };

  // ── NEW: Excel export ──────────────────────────────────────────────────────
  const doExportExcel = async () => {
    if (!canRender) return;
    const result = await window.api.exportExcel({
      fileId,
      type,
      id: id === "all" ? "all" : Number.parseInt(id, 10),
      style,
    });
    if (result?.success) alert(result.message || "Exported to Excel.");
    else alert(result?.message || "Excel export failed.");
  };
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      <div className="sticky top-0 z-30 bg-[#f8f8f8] border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FiArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <div className="text-lg font-semibold text-gray-900">Export</div>
              <div className="text-xs text-gray-600">
                {type ? `${type.toUpperCase()} schedule` : "No selection"} {isLoadingPreview ? "• Updating preview…" : ""}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={resetToDefault}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              title="Reset to default"
            >
              <FiRefreshCw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={doPrint}
              disabled={!canRender}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Print"
            >
              <FiPrinter className="w-4 h-4" />
              Print
            </button>
            {/* ── NEW: Excel export button ── */}
            <button
              onClick={doExportExcel}
              disabled={!canRender}
              className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export Excel"
            >
              <PiMicrosoftExcelLogoFill className="w-4 h-4" />
              Export Excel
            </button>
            {/* ─────────────────────────────── */}
            <button
              onClick={doExportPdf}
              disabled={!canRender}
              className="inline-flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export PDF"
            >
              <FiDownload className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {!canRender ? (
        <div className="p-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="text-sm text-gray-700">
              No export selection was provided. Please open Export from the toolbar first.
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 px-6 py-4">
          <div className="h-full min-h-0 flex gap-4">
            {/* Left: customization (≈ 18%) */}
            <div className="w-[18%] min-w-[260px] max-w-[360px] bg-white border border-gray-200 rounded-xl p-4 overflow-auto">
              <div className="text-sm font-semibold text-gray-900 mb-3">Customization</div>

              <div className="space-y-4">
                <div className="border rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Cell background</div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={style.showCellBackground}
                      onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, showCellBackground: e.target.checked }))}
                    />
                    Enable background
                  </label>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Opacity</span>
                      <span>{Math.round(style.cellBgOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={style.cellBgOpacity}
                      onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, cellBgOpacity: Number(e.target.value) }))}
                      className="w-full"
                      disabled={!style.showCellBackground}
                    />
                  </div>
                </div>

                <div className="border rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Header background</div>
                  <select
                    value={style.headerBg}
                    onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, headerBg: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  >
                    {HEADER_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={style.headerAltEnabled}
                      onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, headerAltEnabled: e.target.checked }))}
                    />
                    Alternate header colors (per table)
                  </label>
                  {style.headerAltEnabled && (
                    <div className="mt-2">
                      <div className="text-[11px] text-gray-600 mb-1">Alternate color</div>
                      <select
                        value={style.headerBgAlt}
                        onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, headerBgAlt: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      >
                        {HEADER_PRESETS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="border rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Text colors</div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[11px] text-gray-600 mb-1">Teacher</div>
                      <div className="flex items-center gap-2">
                        <select
                          value={style.teacherTextColor}
                          onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, teacherTextColor: e.target.value }))}
                          className="flex-1 min-w-0 p-2 border border-gray-300 rounded-md text-sm"
                        >
                          {TEXT_COLOR_PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm text-gray-700 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={style.teacherTextBold}
                            onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, teacherTextBold: e.target.checked }))}
                          />
                          Bold
                        </label>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-600 mb-1">Time</div>
                      <div className="flex items-center gap-2">
                        <select
                          value={style.timeTextColor}
                          onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, timeTextColor: e.target.value }))}
                          className="flex-1 min-w-0 p-2 border border-gray-300 rounded-md text-sm"
                        >
                          {TEXT_COLOR_PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm text-gray-700 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={style.timeTextBold}
                            onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, timeTextBold: e.target.checked }))}
                          />
                          Bold
                        </label>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-600 mb-1">Room</div>
                      <div className="flex items-center gap-2">
                        <select
                          value={style.roomTextColor}
                          onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, roomTextColor: e.target.value }))}
                          className="flex-1 min-w-0 p-2 border border-gray-300 rounded-md text-sm"
                        >
                          {TEXT_COLOR_PRESETS.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm text-gray-700 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={style.roomTextBold}
                            onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, roomTextBold: e.target.checked }))}
                          />
                          Bold
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Grid lines</div>
                  <div className="mt-1">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Thickness</span>
                      <span>{style.gridLineWidth}px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="6"
                      step="1"
                      value={style.gridLineWidth}
                      onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, gridLineWidth: Number(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Opacity</span>
                      <span>{Math.round(style.gridLineOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={style.gridLineOpacity}
                      onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, gridLineOpacity: Number(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="border rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Layout</div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[11px] text-gray-600 mb-1">Tables per page</div>
                      <select
                        value={style.tablesPerPage}
                        onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, tablesPerPage: Number(e.target.value) }))}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value={1}>1 table / page (larger)</option>
                        <option value={2}>2 tables / page (smaller)</option>
                        {style.orientation === "portrait" && <option value={3}>3 tables / page (smallest)</option>}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={style.showMergeClassLabel}
                        onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, showMergeClassLabel: e.target.checked }))}
                      />
                      Show "Merge Class" label
                    </label>
                  </div>
                </div>

                <div className="border rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Signature</div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-[11px] text-gray-600 mb-1">Prepared by</div>
                      <input
                        value={style.preparedByName}
                        onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, preparedByName: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                        placeholder="Name"
                      />
                      <input
                        value={style.preparedByRole}
                        onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, preparedByRole: e.target.value }))}
                        className="w-full mt-2 p-2 border border-gray-300 rounded-md text-sm"
                        placeholder="Role / Position"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-600 mb-1">Approved by</div>
                      <input
                        value={style.approvedByName}
                        onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, approvedByName: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                        placeholder="Name"
                      />
                      <input
                        value={style.approvedByRole}
                        onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, approvedByRole: e.target.value }))}
                        className="w-full mt-2 p-2 border border-gray-300 rounded-md text-sm"
                        placeholder="Role / Position"
                      />
                    </div>
                    <div className="pt-1">
                      <div className="text-[11px] text-gray-600 mb-1">Alignment</div>
                      <select
                        value={style.signatureAlign}
                        onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, signatureAlign: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-3">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Paper</div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-[11px] text-gray-600 mb-1">Size</div>
                      <select
                        value={style.paperSize}
                        onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, paperSize: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="Letter">Letter (8.5" × 11")</option>
                        <option value="A4">A4 (210 × 297 mm)</option>
                        <option value="Legal">Legal (8.5" × 13")</option>
                      </select>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-600 mb-1">Orientation</div>
                      <select
                        value={style.orientation}
                        onChange={(e) => setStyle((prev) => normalizeStyle({ ...prev, orientation: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="portrait">Vertical (Portrait)</option>
                        <option value="landscape">Horizontal (Landscape)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: preview */}
            <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
              {previewError ? (
                <div className="p-6 text-sm text-red-600">{previewError}</div>
              ) : (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  title="Export Preview"
                  style={{ backgroundColor: "white" }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}