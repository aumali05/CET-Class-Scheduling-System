import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FiFile,
  FiHome,
  FiBook,
  FiHelpCircle,
  FiChevronDown,
  FiChevronUp,
  FiEye,
  FiLogOut,
  FiUsers,
  FiMenu,
} from "react-icons/fi";
import { FaHome, FaFileAlt, FaCalendar, FaEye, FaUserAlt, FaQuestion, FaCalendarAlt, FaSignOutAlt } from "react-icons/fa";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [schedulingOpen, setSchedulingOpen] = useState(false);
  const [viewToolsActive, setViewToolsActive] = useState(() => {
    try {
      const saved = localStorage.getItem('showViewTools');
      return saved ? JSON.parse(saved) : false;
    // eslint-disable-next-line no-unused-vars
    } catch (e) {
      return false;
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole') || 'user';

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const isSchedulingActive =
      location.pathname === "/manage" || location.pathname === "/assign";
    setSchedulingOpen(isSchedulingActive);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!event.ctrlKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case '1':
          event.preventDefault();
          if (['admin', 'user', 'view'].includes(userRole)) {
            handleNavigation('/file');
          }
          break;
        case '2':
          event.preventDefault();
          if (['admin', 'user', 'view'].includes(userRole)) {
            handleNavigation('/home');
          }
          break;
        case '3':
          event.preventDefault();
          if (userRole === 'admin') {
            handleNavigation('/manage');
          }
          break;
        case '4':
          event.preventDefault();
          if (['admin', 'user'].includes(userRole)) {
            handleNavigation('/assign');
          }
          break;
        case '5':
          event.preventDefault();
          if (['admin', 'user', 'view'].includes(userRole)) {
            toggleViewTools();
          }
          break;
        case '6':
          event.preventDefault();
          if (userRole === 'admin') {
            handleNavigation('/accounts');
          }
          break;
        case 'h':
          if (!event.shiftKey) {
            event.preventDefault();
            if (['admin', 'user', 'view'].includes(userRole)) {
              handleNavigation('/help');
            }
          }
          break;
        case 'l':
          event.preventDefault();
          handleLogout();
          break;
        case 'b':
          event.preventDefault();
          setCollapsed(!collapsed);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [collapsed, location.pathname, userRole]);

  const toggleViewTools = () => {
    // Toggle and broadcast the explicit next value so other components can persist
    const next = !viewToolsActive;
    try {
      localStorage.setItem('showViewTools', JSON.stringify(next));
    // eslint-disable-next-line no-unused-vars
    } catch (e) {
      // ignore
    }
    setViewToolsActive(next);
    window.dispatchEvent(new CustomEvent("toggleViewTools", { detail: { next } }));
  };

  const toggleScheduling = () => {
    if (!collapsed && ['admin', 'user'].includes(userRole)) {
      setSchedulingOpen((prev) => !prev);
    }
  };

  const handleNavigation = (path) => {
    if (path !== location.pathname) {
      setIsLoading(true);
      navigate(path);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  const handleLogout = () => {
    setIsLoading(true);
    localStorage.removeItem('userRole');
    localStorage.removeItem('username');
    localStorage.removeItem('sidebarCollapsed');
    navigate('/login');
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const menuItems = [
    { name: "Dashboard", icon: <FaFileAlt />, path: "/file", roles: ['admin', 'user', 'view'] },
    { name: "Home", icon: <FaHome />, path: "/home", roles: ['admin', 'user', 'view'] },
    {
      name: "Scheduling Tool",
      icon: <FaCalendarAlt />,
      isCollapsible: true,
      roles: ['admin', 'user'],
      submenu: [
        { name: "Data Management", path: "/manage", roles: ['admin'] },
        { name: "Assign Management", path: "/assign", roles: ['admin', 'user'] },
      ],
    },
    { name: "View", icon: <FaEye />, isButton: true, onClick: toggleViewTools, roles: ['admin', 'user', 'view'] },
    { name: "Accounts", icon: <FaUserAlt />, path: "/accounts", roles: ['admin'] },
    { name: "Help", icon: <FaQuestion />, path: "/help", roles: ['admin', 'user', 'view'] },
    { name: "Logout", icon: <FaSignOutAlt />, isButton: true, onClick: handleLogout, roles: ['admin', 'user', 'view'] },
  ];

  const topMenuItems = menuItems.filter(item =>
    ['Dashboard', 'Home', 'Scheduling Tool', 'View', 'Accounts'].includes(item.name)
  );
  const bottomMenuItems = menuItems.filter(item =>
    ['Help', 'Logout'].includes(item.name)
  );

  const isSchedulingActive =
    location.pathname === "/manage" || location.pathname === "/assign";

  useEffect(() => {
  // Broadcast sidebar width to other components
  const width = collapsed ? 64 : 288; // match your CSS width
  window.dispatchEvent(new CustomEvent("sidebarWidthChange", { detail: width }));
}, [collapsed]);

  return (
    <>
      {isLoading && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/70 z-[1001] backdrop-blur-sm"
        >
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-gray-800 text-lg font-medium">Loading...</p>
          </div>
        </div>
      )}
      <div
        className={`h-screen transition-all duration-300 ease-out ${collapsed ? "w-16" : "w-72"} flex flex-col shadow-sm ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
        style={{
          backgroundColor: collapsed ? "#FFFFFF" : "#EFF4FF",
          position: "relative",
          // zIndex: 1000,
        }}
      >
        <div className="flex items-center justify-between p-3">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full"><img src="/imgs/app-icon.png" alt="" /></div>
              <span className="text-[#3D3D3D] font-semibold text-lg">Menu</span>
            </div>
          )}
          {collapsed && (
            <div className="w-full flex justify-center">
              <button
                onClick={() => setCollapsed(false)}
                className="p-2 rounded-lg text-[#3D3D3D] hover:text-[#3D3D3D] hover:bg-transparent transition-all duration-200 active:scale-95"
                disabled={isLoading}
                title="Expand sidebar (Ctrl+B)"
              >
                <FiMenu className="w-5 h-5" />
              </button>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 rounded-lg text-[#7c7c7c] hover:bg-gray-100/50 transition-all duration-200 active:scale-95"
              disabled={isLoading}
              title="Collapse sidebar (Ctrl+B)"
            >
              <FiMenu className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="flex flex-col flex-1 p-3 gap-1">
          {topMenuItems
            .filter((item) => item.roles.includes(userRole))
            .map((item, index) => (
              <div key={index}>
                {item.isCollapsible ? (
                  <>
                    <div
                      onClick={collapsed ? () => handleNavigation("/manage") : toggleScheduling}
                      className={`
                      group w-full flex items-center px-4 py-3 text-sm font-medium
                      transition-all duration-200 cursor-pointer rounded-xl
                      ${isSchedulingActive
                          ? "text-[#446EC8] bg-white shadow-sm"
                          : "text-[#3D3D3D] hover:text-[#3D3D3D] hover:bg-[#E5E5E5]"
                        } ${collapsed ? "justify-center" : "justify-between"}
                    `}
                    >
                      {collapsed ? (
                        <div className="flex items-center justify-center">
                          <span className="text-lg flex-shrink-0">{item.icon}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <span className="text-lg flex-shrink-0">{item.icon}</span>
                            <span className="truncate">{item.name}</span>
                          </div>
                          <span className={`transition-transform duration-200 ${schedulingOpen ? "rotate-180" : ""}`}>
                            <FiChevronDown className="w-4 h-4" />
                          </span>
                        </>
                      )}
                    </div>
                    {!collapsed && schedulingOpen && (
                      <div className="mt-1 ml-4 pl-4 border-l-2" style={{ borderColor: "#374151" }}>
                        <div className="space-y-1">
                          {item.submenu
                            .filter((sub) => sub.roles.includes(userRole))
                            .map((sub, subIndex) => (
                              <Link
                                key={subIndex}
                                to={sub.path}
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleNavigation(sub.path);
                                }}
                                className={`
                              block px-4 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg
                              ${location.pathname === sub.path
                                    ? "text-[#446EC8] bg-white shadow-sm"
                                    : "text-[#3D3D3D] hover:text-[#3D3D3D] hover:bg-gray-700/30"
                                  } ${isLoading ? "pointer-events-none" : ""}
                            `}
                              >
                                {sub.name}
                              </Link>
                            ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : item.isButton ? (
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={item.onClick}
                      className={`
                      w-full flex items-center gap-3 px-4 py-3 text-sm font-medium
                      transition-all duration-200 rounded-xl
                      text-[#3D3D3D] hover:text-[#3D3D3D] hover:bg-[#E5E5E5] active:scale-95
                      ${isLoading ? "pointer-events-none" : ""}
                      ${collapsed ? "justify-center" : ""}
                    `}
                      disabled={isLoading}
                      title={collapsed ? item.name : undefined}
                    >
                      <span className="text-lg flex-shrink-0">{item.icon}</span>
                      {!collapsed && <span className="truncate">{item.name}</span>}
                    </button>
                    {collapsed && (
                      <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                        {item.name}
                        <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative group">
                    <Link
                      to={item.path}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation(item.path);
                      }}
                      className={`
                      flex items-center gap-3 px-4 py-3 text-sm font-medium
                      transition-all duration-200 rounded-xl active:scale-95
                      ${location.pathname === item.path
                          ? "text-[#446EC8] bg-white shadow-sm"
                          : "text-[#3D3D3D] hover:text-[#3D3D3D] hover:bg-[#E5E5E5]"
                        } ${isLoading ? "pointer-events-none" : ""}
                      ${collapsed ? "justify-center" : ""}
                    `}
                      title={collapsed ? item.name : undefined}
                    >
                      <span className="text-lg flex-shrink-0">{item.icon}</span>
                      {!collapsed && <span className="truncate">{item.name}</span>}
                    </Link>
                    {collapsed && (
                      <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                        {item.name}
                        <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
        </nav>

        <div className="mt-auto p-3">
          {bottomMenuItems
            .filter((item) => item.roles.includes(userRole))
            .map((item, index) => (
              <div key={index} className="relative group">
                {item.path ? (
                  <Link
                    to={item.path}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavigation(item.path);
                    }}
                    className={`
              flex items-center gap-3 px-4 py-3 text-sm font-medium
              transition-all duration-200 rounded-xl active:scale-95
              ${location.pathname === item.path
                        ? "text-[#446EC8] bg-white shadow-sm"
                        : "text-[#3D3D3D] hover:text-[#3D3D3D] hover:bg-[#E5E5E5]"
                      }
              ${isLoading ? "pointer-events-none" : ""}
              ${collapsed ? "justify-center" : ""}
            `}
                    title={collapsed ? item.name : undefined}
                  >
                    <span className="text-lg flex-shrink-0">{item.icon}</span>
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={`
              flex items-center gap-3 px-4 py-3 text-sm font-medium
              transition-all duration-200 rounded-xl active:scale-95
              text-[#3D3D3D] hover:text-[#3D3D3D] hover:bg-[#E5E5E5]
              ${isLoading ? "pointer-events-none" : ""}
              ${collapsed ? "justify-center" : ""}
            `}
                    title={collapsed ? item.name : undefined}
                  >
                    <span className="text-lg flex-shrink-0">{item.icon}</span>
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </button>
                )}
                {collapsed && (
                  <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                    {item.name}
                    <div className="absolute right-full top-1/2 transform -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </>
  );
}