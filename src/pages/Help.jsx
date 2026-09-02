import { useState } from "react";
import { FiBook, FiInfo, FiZoomIn, FiZoomOut, FiMaximize, FiX, FiSave, FiFileText, FiPrinter, FiPlus, FiDownload, FiHome, FiFile, FiHelpCircle, FiEye, FiLogOut, FiSidebar, FiUser } from "react-icons/fi";
import { FaRegKeyboard } from "react-icons/fa";

export default function Help() {
  const [activeTab, setActiveTab] = useState("User Guide");

  const tabs = ["User Guide", "Shortcut Keys and Commands", "About"];

  const shortcuts = [
    {
      category: "Main Actions Shortcuts",
      icon: <FiFileText className="text-teal-600" />,
      description: "These commands let you quickly perform essential file operations:",
      items: [
        { key: "Ctrl+N", action: "Create a New file", icon: <FiPlus /> },
        // { key: "Ctrl+S", action: "Save the current file", icon: <FiSave /> },
        // { key: "Ctrl+Shift+S", action: "Save As a new file name or location", icon: <FiSave /> },
        { key: "Ctrl+E", action: "Export the current file", icon: <FiFileText /> },
        { key: "Ctrl+P", action: "Print the current document", icon: <FiPrinter /> },
        { key: "Ctrl+H", action: "Open the Help page", icon: <FiInfo /> },
        { key: "Ctrl+W", action: "Close the current file", icon: <FiX /> }
      ]
    },
    {
      category: "Navigation Shortcuts",
      icon: <FiSidebar className="text-teal-600" />,
      description: "Use these shortcuts to quickly navigate between pages and features:",
      items: [
        { key: "Ctrl+1", action: "Navigate to File page", icon: <FiFile /> },
        { key: "Ctrl+2", action: "Navigate to Home page", icon: <FiHome /> },
        { key: "Ctrl+3", action: "Navigate to Manage Data (Scheduling)", icon: <FiBook /> },
        { key: "Ctrl+4", action: "Navigate to Assigning (Scheduling)", icon: <FiBook /> },
        { key: "Ctrl+5", action: "Toggle View Tools", icon: <FiEye /> },
        { key: "Ctrl+6", action: "Navigate to Accounts page", icon: <FiUser /> },
        { key: "Ctrl+H", action: "Navigate to Help page", icon: <FiHelpCircle /> },
        { key: "Ctrl+L", action: "Logout / Navigate to Login", icon: <FiLogOut /> },
        { key: "Ctrl+B", action: "Toggle Sidebar collapse/expand", icon: <FiSidebar /> }
      ]
    },
    {
      category: "View Tools Shortcuts",
      icon: <FiZoomIn className="text-teal-600" />,
      description: "Use these when working with view tools (zooming and full screen):",
      items: [
        { key: "Ctrl++ or Ctrl+=", action: "Zoom In", icon: <FiZoomIn /> },
        { key: "Ctrl+-", action: "Zoom Out", icon: <FiZoomOut /> },
        { key: "Ctrl+F or F11", action: "Toggle Full Screen mode", icon: <FiMaximize /> }
      ]
    },
    {
      category: "General Shortcuts",
      icon: <FaRegKeyboard className="text-teal-600" />,
      description: "",
      items: [
        { key: "Escape", action: "Close any open modal, dialog, or pop-up window", icon: <FiX /> }
      ]
    }
  ];

  const developers = [
    {
      name: "Umali, Allan Joseph R.",
      role: "Lead Developer",
      program: "BS Information Technology",
      contact:"umalia500@gmail.com",
      Github:"https://github.com/aumali05",
      image: "imgs/allan.jpg"
    },
    {
      name: "Mendoza, Angelo R.",
      role: "Developer",
      program: "BS Information Technology",
      contact:"angeloramosmendoza27@gmail.com",
      image: "imgs/gelo.jpg"
    },
    {
      name: "Rementilla, Tai Lee D.",
      role: "Developer",
      program: "BS Information Technology",
      contact:"lee33223311@gmail.com",
      image: "imgs/thai.jpg"
    }
  ];

  return (
    <div className="p-4">
      <div className="border-b border-gray-200 mb-4">
        <nav className="flex space-x-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 px-1 text-sm font-medium transition-colors
          ${activeTab === tab
                  ? "text-teal-600 border-b-2 border-teal-600"
                  : "text-gray-500 hover:text-gray-700"
                }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        {activeTab === "User Guide" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <FiBook className="text-2xl text-teal-600" />
                <h2 className="text-2xl font-bold text-gray-800">User Manual</h2>
              </div>
              <a
                href="./imgs/User_Manual.pdf"
                download
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                title="Download User Manual"
              >
                <FiDownload className="w-4 h-4" />
                Download PDF
              </a>
            </div>

            <div className="flex justify-center border border-gray-200 rounded-lg overflow-hidden">
              <iframe src="./imgs/User_Manual.pdf#view=FitH&toolbar=1&navpanes=0" className="w-[800px] h-[600px]" title="User Manual PDF" frameBorder="0" >
                <div className="p-8 text-center bg-gray-50">
                  <FiFileText className="mx-auto mb-4 text-6xl text-gray-400" />
                  <p className="text-gray-600 mb-4">
                    Your browser doesn't support PDF viewing. Please download the file to view it.
                  </p>
                  <a
                    href="./imgs/User_Manual.pdf"
                    download
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <FiDownload className="w-4 h-4" />
                    Download User Manual
                  </a>
                </div>
              </iframe>
            </div>


            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <FiInfo className="text-blue-600 mt-1" />
                <div>
                  <p className="text-blue-800 font-medium mb-1">PDF Viewing Tips:</p>
                  <ul className="text-blue-700 text-sm space-y-1">
                    <li>• Use the PDF controls to navigate pages</li>
                    <li>• You can zoom in/out using the PDF viewer controls</li>
                    <li>• Click the download button to save a copy locally</li>
                    <li>• If the PDF doesn't load, try refreshing the page or downloading it directly</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Shortcut Keys and Commands" && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <FaRegKeyboard className="text-2xl text-teal-600" />
              <h2 className="text-2xl font-bold text-gray-800">Shortcut Keys and Commands</h2>
            </div>
            <p className="text-gray-600 mb-8">
              To make your workflow faster and more efficient, here's a list of supported shortcut keys and commands you can use within the application.
            </p>

            <div className="space-y-8">
              {shortcuts.map((section, index) => (
                <div key={index} className="border-l-4 border-teal-500 pl-6">
                  <div className="flex items-center gap-3 mb-3">
                    {section.icon}
                    <h3 className="text-xl font-semibold text-gray-800">{section.category}</h3>
                  </div>
                  {section.description && (
                    <p className="text-gray-600 mb-4">{section.description}</p>
                  )}
                  <div className="grid gap-3">
                    {section.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className="text-teal-600">{item.icon}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <kbd className="px-3 py-1 bg-gray-200 border border-gray-300 rounded text-sm font-mono font-semibold">
                              {item.key}
                            </kbd>
                            <span className="text-gray-700">{item.action}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-teal-50 border border-teal-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-teal-600 font-bold">💡 Tip:</span>
              </div>
              <p className="text-teal-800">
                Practice using these shortcuts regularly to improve your efficiency and navigate the application seamlessly.
              </p>
            </div>
          </div>
        )}

        {activeTab === "About" && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <FiInfo className="text-2xl text-teal-600" />
              <h2 className="text-2xl font-bold text-gray-800">About</h2>
            </div>

            <div className="prose max-w-none text-gray-700 leading-relaxed space-y-4 mb-8">
              <p>
                The <strong>Class Scheduling System for Golden Gate Colleges</strong> is a capstone project designed to address the challenges of managing class schedules within the institution. Scheduling plays a crucial role in organizing academic activities, ensuring efficient use of resources, and avoiding conflicts between faculty, students, and classrooms. Traditionally, this process at Golden Gate Colleges (GGC) has been handled manually using tools such as Microsoft Word and Excel. While effective to some extent, this approach is time-consuming, prone to errors, and often results in delays in posting final schedules.
              </p>

              <p>
                Golden Gate Colleges, established in November 1946, is the first private higher education institution in Batangas. Over the years, GGC has continued to provide quality education through its various departments, including Teacher Education, Accountancy and Business Administration, Nursing, and Engineering and Technology. Despite its growth and modernization, the college continues to face challenges with its manual scheduling system, especially in the <strong>Engineering and Technology Department</strong> where scheduling conflicts, overlapping class times, and classroom shortages frequently occur.
              </p>

              <p>
                The proposed Class Scheduling System aims to streamline this process by providing an automated solution tailored to the needs of the college. By integrating technology, the system reduces administrative workload, minimizes scheduling conflicts, and ensures timely release of class schedules. This not only improves efficiency for administrators but also provides faculty and students with a more reliable and accessible schedule, enhancing the overall academic experience.
              </p>

              <p>
                This project demonstrates the potential of automation in addressing long-standing challenges, paving the way for a more organized, accurate, and user-friendly scheduling process for Golden Gate Colleges.
              </p>
            </div>

            <div className="border-t pt-8">
              <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">Development Team</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {developers.map((developer, index) => (
                  <div key={index} className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-lg p-6 text-center border border-teal-100 shadow-sm">
                    <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden bg-gray-200">
                      <img
                        src={developer.image}
                        alt={developer.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <h4 className="font-semibold text-gray-800 mb-2">{developer.name}</h4>
                    <p className="text-teal-600 font-medium">{developer.role}</p>
                    <p className="text-teal-950 font-medium">{developer.program}</p>

                    <p className=" text-teal-950 font-medium">{developer.contact}</p>
                    <p className="text-teal-600 font-medium">
                      <a href={developer.Github} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                        GitHub
                      </a>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}