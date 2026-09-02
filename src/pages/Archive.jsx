import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiFile, FiTrash2, FiRotateCcw, FiSearch, FiArrowLeft } from 'react-icons/fi';
import Toolbar from '../components/Toolbar';

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

export default function Archive() {
  const [archivedFiles, setArchivedFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [operatingFileId, setOperatingFileId] = useState(null);
  const userRole = localStorage.getItem('userRole') || 'user';
  const navigate = useNavigate();

  useEffect(() => {
    const fetchArchivedFiles = async () => {
      try {
        const files = await window.api.getAllScheduleFiles();
        let filteredFiles = files.filter(file => file.status === 'archived');

        if (searchTerm) {
          filteredFiles = filteredFiles.filter(file =>
            file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            file.academic_year.toLowerCase().includes(searchTerm.toLowerCase()) ||
            file.semester.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        setArchivedFiles(filteredFiles);
      } catch (error) {
        console.error('Error fetching archived files:', error);
        alert('Error loading archived files: ' + (error.message || 'Unknown error'));
      }
    };

    fetchArchivedFiles();
  }, [searchTerm]);

  const handleRestoreFile = async (e, file) => {
    e.stopPropagation();

    if (operatingFileId === file.id) return;

    try {
      setOperatingFileId(file.id);
      await window.api.unarchiveScheduleFile(file.id);
      setArchivedFiles(archivedFiles.filter(f => f.id !== file.id));
      alert('File restored successfully');
    } catch (error) {
      console.error('Error restoring file:', error);
      alert('Error restoring file: ' + (error.message || 'Unknown error'));
    } finally {
      setOperatingFileId(null);
    }
  };

  const handleDeleteFile = async (e, file) => {
    e.stopPropagation();

    if (operatingFileId === file.id) return;

    if (window.confirm('Are you sure you want to permanently delete this file? This action cannot be undone.')) {
      try {
        setOperatingFileId(file.id);
        await window.api.deleteScheduleFile(file.id);
        setArchivedFiles(archivedFiles.filter(f => f.id !== file.id));
        alert('File deleted permanently');
      } catch (error) {
        console.error('Error deleting file:', error);
        alert('Error deleting file: ' + (error.message || 'Unknown error'));
      } finally {
        setOperatingFileId(null);
      }
    }
  };

  return (
    <div className="h-full bg-white">
      <div className="sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between py-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Go back"
              >
                <FiArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="p-2 bg-gray-100 rounded-lg">
                <FiTrash2 className="w-5 h-5 text-gray-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Archive Schedule</h1>
            </div>
            <input
              type="text"
              placeholder="Search Schedule"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 w-64"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-gray-600">
            {archivedFiles.length} archived {archivedFiles.length === 1 ? 'file' : 'files'}
          </div>
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${viewMode === 'grid'
                ? 'bg-white text-teal-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4z" />
                <path d="M3 10a1 1 0 011-1h12a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${viewMode === 'list'
                ? 'bg-white text-teal-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {archivedFiles.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {archivedFiles.map((file) => (
                <div
                  key={file.id}
                  className={`bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 ${operatingFileId === file.id ? 'opacity-50' : ''}`}
                >
                  <CalendarPreview fileId={file.id} />
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex rounded-lg gap-2 flex-1 min-w-0">
                        <FiFile className="w-4 h-4 text-teal-600 flex-shrink-0" />
                        <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 break-words leading-tight">
                          {file.name}
                        </h3>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded-full">
                          {file.academic_year}
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                          {file.semester}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Archived {new Date(file.archivedAt || file.updatedAt).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={(e) => handleRestoreFile(e, file)}
                          disabled={operatingFileId !== null || userRole === 'view'}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FiRotateCcw className="w-3 h-3" />
                          Restore
                        </button>
                        <button
                          onClick={(e) => handleDeleteFile(e, file)}
                          disabled={operatingFileId !== null || userRole === 'view'}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FiTrash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#f4f4f4] rounded-xl shadow-md">
              <div className="border border-gray-400 rounded-lg overflow-hidden">
                <table className="w-full bg-white">
                  <thead className="bg-[#4c4c4c] text-white">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Academic Year</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Semester</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Archived Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {archivedFiles.map((file) => (
                      <tr key={file.id} className={`hover:bg-gray-50 transition-colors ${operatingFileId === file.id ? 'opacity-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-3">
                            <div className="bg-teal-50 p-2 rounded-lg">
                              <FiFile className="w-4 h-4 text-teal-600" />
                            </div>
                            {file.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {file.academic_year}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {file.semester}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(file.archivedAt || file.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => handleRestoreFile(e, file)}
                              disabled={operatingFileId !== null || userRole === 'view'}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Restore"
                            >
                              <FiRotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteFile(e, file)}
                              disabled={operatingFileId !== null || userRole === 'view'}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FiTrash2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No archived files</p>
            <p className="text-gray-400 text-sm mt-2">Archived schedule files will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}