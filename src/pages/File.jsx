import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiFile, FiFolder, FiSearch, FiArchive, FiTrash2 } from "react-icons/fi";
import Toolbar from "../components/Toolbar";

const generateCalendarGrid = (fileId) => {
  const days = Array.from({ length: 35 }, (_, i) => i + 1);
  const colors = ['bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500'];

  const seed = typeof fileId === 'string' ? fileId.charCodeAt(0) : fileId;

  return days.map((day, index) => {
    const hasEvent = (seed + index) % 4 === 0;
    const colorIndex = (seed + index) % colors.length;
    const dayNumber = ((seed + index) % 31) + 1;

    return {
      day: dayNumber,
      hasEvent,
      color: hasEvent ? colors[colorIndex] : null
    };
  });
};

const CalendarPreview = ({ fileId }) => {
  const calendarData = generateCalendarGrid(fileId);

  return (
    <div className="h-32 bg-gray-800 rounded-t-lg p-3 flex flex-col overflow-hidden relative">
      <div className="flex justify-between items-center mb-2 z-10">
        <div className="text-white text-xs font-medium opacity-80">Schedule</div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 h-full relative z-10">
        {calendarData.slice(0, 21).map((item, index) => (
          <div
            key={index}
            className={`aspect-square rounded-sm flex items-center justify-center text-xs font-medium relative ${item.hasEvent
              ? `${item.color} text-white shadow-sm`
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              } transition-colors`}
          >
            {item.day}
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gray-900/80 rounded-t-lg pointer-events-none z-20"></div>
    </div>
  );
};

export default function File() {
  const [scheduleFiles, setScheduleFiles] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  const [operatingFileId, setOperatingFileId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole') || 'user';

  useEffect(() => {
    const fetchScheduleFiles = async () => {
      try {
        const files = await window.api.getAllScheduleFiles();
        let filteredFiles = files;

        // Apply archive filter
        if (showArchived) {
          filteredFiles = files.filter(file => file.status === 'archived');
        } else {
          filteredFiles = files.filter(file => file.status === 'active');
        }

        // Apply search filter
        if (searchTerm) {
          filteredFiles = filteredFiles.filter(file =>
            file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            file.academic_year.toLowerCase().includes(searchTerm.toLowerCase()) ||
            file.semester.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        setScheduleFiles(filteredFiles);

        // Update recent files - only from active files
        const activeFiles = files.filter(file => file.status === 'active');
        const sortedFiles = activeFiles.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        setRecentFiles(sortedFiles.slice(0, 5));
      } catch (error) {
        console.error("Error fetching schedule files:", error);
        alert("Error loading schedule files: " + (error.message || "Unknown error"));
      }
    };

    fetchScheduleFiles();
  }, [searchTerm, showArchived]);

  const [sidebarWidth, setSidebarWidth] = useState(
    JSON.parse(localStorage.getItem('sidebarCollapsed')) ? 64 : 288
  );

  useEffect(() => {
    const handleSidebarResize = (e) => setSidebarWidth(e.detail);
    window.addEventListener("sidebarWidthChange", handleSidebarResize);
    return () => window.removeEventListener("sidebarWidthChange", handleSidebarResize);
  }, []);

  const handleSelectFile = async (file) => {
    if (operatingFileId !== null) return;

    try {
      setOperatingFileId(file.id);
      await window.api.setCurrentFile(file);

      window.dispatchEvent(new CustomEvent('fileSelected', { detail: file }));

      navigate(userRole === 'user' ? "/home" : "/home");
    } catch (error) {
      console.error("Error selecting file:", error);
      alert("Error opening file: " + (error.message || "Unknown error"));
    } finally {
      setOperatingFileId(null);
    }
  };

  const handleArchiveFile = async (e, file) => {
    e.stopPropagation();

    if (operatingFileId === file.id) return;

    try {
      setOperatingFileId(file.id);
      await window.api.archiveScheduleFile(file.id);

      // Refresh the file list
      const files = await window.api.getAllScheduleFiles();
      let filteredFiles = files.filter(f => f.status === 'active');

      if (searchTerm) {
        filteredFiles = filteredFiles.filter(f =>
          f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.academic_year.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.semester.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      setScheduleFiles(filteredFiles);

      const activeFiles = files.filter(f => f.status === 'active');
      const sortedFiles = activeFiles.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      setRecentFiles(sortedFiles.slice(0, 5));

      alert("File archived successfully!");
    } catch (error) {
      console.error("Error archiving file:", error);
      alert("Error archiving file: " + (error.message || "Unknown error"));
    } finally {
      setOperatingFileId(null);
    }
  };

  const handleDeleteFile = async (e, file) => {
    e.stopPropagation();

    if (operatingFileId === file.id) return;

    if (window.confirm(`Are you sure you want to permanently delete "${file.name}"? This action cannot be undone.`)) {
      try {
        setOperatingFileId(file.id);
        await window.api.deleteScheduleFile(file.id);

        // Refresh the file list
        const files = await window.api.getAllScheduleFiles();
        let filteredFiles = files.filter(f => f.status === 'active');

        if (searchTerm) {
          filteredFiles = filteredFiles.filter(f =>
            f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.academic_year.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.semester.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        setScheduleFiles(filteredFiles);

        const activeFiles = files.filter(f => f.status === 'active');
        const sortedFiles = activeFiles.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        setRecentFiles(sortedFiles.slice(0, 5));

        alert("File deleted permanently!");
      } catch (error) {
        console.error("Error deleting file:", error);
        alert("Error deleting file: " + (error.message || "Unknown error"));
      } finally {
        setOperatingFileId(null);
      }
    }
  };

  return (
    <div className="h-full bg-white">

      <div className="sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6">
          <Toolbar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            showArchived={showArchived}
            setShowArchived={setShowArchived}
          />
        </div>
      </div>

      <div className="h-6" />

      {/* Main Page Content */}
      <div className="max-w-7xl mx-auto px-6">

        <div>
          <div
            className="mb-6 overflow-x-auto whitespace-nowrap p-6 border rounded-xl"
            style={{ width: `calc(95vw - ${sidebarWidth}px)` }}
          >
            <div className="flex items-center space-x-3 mb-2"> <h1 className="text-md font-bold text-gray-900">Recent Schedule</h1> </div>
            <div className="inline-flex space-x-4">
              {recentFiles.length > 0 ? (
                recentFiles.map((file) => (
                  <div
                    key={file.id}
                    className={`p-1 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-teal-300 ${operatingFileId === file.id ? "opacity-50" : ""}`}
                    onClick={() => operatingFileId === null && handleSelectFile(file)}
                  >
                    <CalendarPreview fileId={file.id} />
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className=" flex rounded-lg gap-2">
                          <FiFile className="w-4 h-4 text-teal-600" />
                          <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 break-words leading-tight">
                            {file.name}
                          </h3>
                        </div>
                      </div>
                      <div className="min-w-0">

                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded-full">
                              {file.academic_year}
                            </span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                              {file.semester}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 flex items-center">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2"></span>
                            Updated {new Date(file.updatedAt || new Date()).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                  <FiFile className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No recent files found</p>
                  <p className="text-gray-400 text-sm mt-1">Create a new schedule file to get started</p>
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="p-4 mb-6 bg-[#f4f4f4] rounded-xl shadow-md">
            <div className="border border-gray-400 rounded-lg">
              <div className="overflow-y-auto h-72">
                <table className="w-full bg-white">
                  <thead className="bg-[#4c4c4c] text-white sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Academic Year</th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Semester</th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Last Updated</th>
                      <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {scheduleFiles.length > 0 ? (
                      scheduleFiles.map((file) => (
                        <tr
                          key={file.id}
                          className={`hover:bg-gray-50 transition-colors cursor-pointer ${operatingFileId === file.id ? 'opacity-50' : ''}`}
                          onClick={() => operatingFileId === null && handleSelectFile(file)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-b border-gray-500">
                            <div className="flex items-center">
                              <div className="bg-teal-50 p-2 rounded-lg mr-3">
                                <FiFile className="w-4 h-4 text-teal-600" />
                              </div>
                              {file.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-b border-gray-500 text-center">
                            {file.academic_year}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-b border-gray-500 text-center">
                            {file.semester}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-b border-gray-500 text-center">
                            {new Date(file.updatedAt || new Date()).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium border-b border-gray-500">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={(e) => handleArchiveFile(e, file)}
                                className={`p-2 rounded-md text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors ${userRole === 'view' || operatingFileId !== null ? 'cursor-not-allowed opacity-50' : ''
                                  }`}
                                disabled={userRole === 'view' || operatingFileId !== null}
                                title="Archive"
                              >
                                <FiArchive className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteFile(e, file)}
                                className={`p-2 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors ${userRole === 'view' || operatingFileId !== null ? 'cursor-not-allowed opacity-50' : ''
                                  }`}
                                disabled={userRole === 'view' || operatingFileId !== null}
                                title="Delete permanently"
                              >
                                <FiTrash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 border-b border-gray-500">
                          No schedule files available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
        <div className="mt-12">
          <div className="p-1"></div>
        </div>
      </div>
    </div>
  );
}