/* eslint-disable no-unused-vars */
"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import toast, { Toaster } from "react-hot-toast"
import { FaEye, FaEyeSlash } from "react-icons/fa"

export default function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const res = await window.api.login({ username, password })
      if (res.success) {
        localStorage.setItem("userRole", res.role)
        localStorage.setItem("username", username)
        toast.success(res.message)
        navigate("/file")
      } else {
        toast.error(res.message)
      }
    } catch (err) {
      console.error(err)
      toast.error("Something went wrong")
    }
  }

  // Determine greeting based on time of day
  const hour = new Date().getHours()
  const greeting =
    hour >= 6 && hour < 12
      ? "Good Morning!"
      : hour >= 12 && hour < 18
      ? "Good Afternoon!"
      : "Good Evening!"

  return (
    <div className="flex min-h-screen bg-white">
      <Toaster position="top-center" />

      {/* LEFT SIDE - Phase 1 Design */}
      <div className="relative flex-[7.5] flex items-center justify-center overflow-hidden">
        {/* Back Layer - Large image filling the entire left side */}
        <img
          src="./imgs/Online calendar-bro.png?v=2"
          alt="Calendar Background"
          className="absolute inset-0 w-full h-full object-cover background-image"
        />

        {/* Mid Layer - Dark overlay box with 93% transparency */}
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: '#161724',
            opacity: 0.95
          }}
        />

        {/* Front Layer Content */}
        <div className="relative z-10 flex flex-col items-center justify-between w-full h-full py-10 px-8">

          {/* Center — Illustration + Title */}
          <div className="flex-1 flex items-center justify-center w-full">
            {/* Left Side - Calendar Image */}
            <div className="flex-shrink-0 animate-float calendar-image-container">
              <img
                src="./imgs/Online calendar-bro.png?v=2"
                alt="Calendar Illustration"
                className="calendar-image"
              />
            </div>

            {/* Right Side - Text Content */}
            <div className="text-content">
              {/* Header Text */}
              <h1
                className="font-bold leading-tight mb-4 animate-slideDown header-text"
                style={{ color: '#F3F3F3', textAlign: 'left' }}
              >
                Class Scheduling<br />System
              </h1>

              {/* Sub Header Text */}
              <p
                className="font-medium animate-slideDown subheader-text"
                style={{ color: '#B9B9B9', textAlign: 'left', animationDelay: '0.2s' }}
              >
                Golden Gate Colleges
              </p>
            </div>
          </div>

          {/* Bottom — Tip + Developer Credit */}
          <div className="w-full text-left">
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontStyle: 'italic', marginBottom: '4px' }}>
              💡 Tip: Visit the <strong>Help</strong> page if you have any questions.
            </p>

            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontStyle: 'italic' }}>
              *Developed by: <strong>CET BSIT 4th year – AU, AM, TR </strong> | A.Y. 2025 - 2026
            </p>
          </div>

        </div>
      </div>

      {/* RIGHT SIDE - Login Form (Original) */}
      <div className="flex-[3.5] flex items-center justify-center bg-white p-8">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">

  {/* ===== BLOCK A ===== */}
  <div className="text-left">

    {/* LOGO */}
    <div
      className="flex justify-start mb-3 opacity-0 animate-fadeIn"
      style={{ animationDelay: "0.1s", animationFillMode: "both" }}
    >
      <img src="./imgs/app-icon.png" alt="Logo" className="w-16 h-16 object-contain" />
    </div>

    {/* GREETING */}
    <h2
      className="text-xl font-bold text-gray-900 opacity-0 animate-fadeIn"
      style={{ animationDelay: "0.2s", animationFillMode: "both" }}
    >
      Good to see you! Ready to plan ahead?
    </h2>

    {/* SUB GREETING */}
    <p
      className="text-xs text-gray-600 italic opacity-0 animate-fadeIn"
      style={{ animationDelay: "0.25s", animationFillMode: "both" }}
    >
      Sign in to manage your schedule.
    </p>
  </div>

  {/* ===== 64PX ===== */}
  <div style={{ height: "64px" }} />

  {/* ===== BLOCK B ===== */}
  <div>

    {/* USERNAME */}
    <div
      className="opacity-0 animate-fadeIn"
      style={{ animationDelay: "0.3s", animationFillMode: "both" }}
    >
      <label className="block text-xs font-medium text-gray-700 mb-1">
        Username
      </label>

      <input
        type="text"
        className="
          w-full px-3 py-2 text-sm
          bg-white border border-gray-300 rounded-lg
          transition duration-200

          focus:outline-none
          focus:ring-2 focus:ring-blue-500
          focus:border-blue-500
        "
        placeholder="Enter your username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
    </div>

    {/* PASSWORD */}
    <div
      className="mt-4 opacity-0 animate-fadeIn"
      style={{ animationDelay: "0.4s", animationFillMode: "both" }}
    >
      <label className="block text-xs font-medium text-gray-700 mb-1">
        Password
      </label>

      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          className="
            w-full px-3 py-2 text-sm
            bg-white border border-gray-300 rounded-lg
            transition duration-200

            focus:outline-none
            focus:ring-2 focus:ring-blue-500
            focus:border-blue-500
          "
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="button"
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
        </button>
      </div>
    </div>

  </div>

  {/* ===== 86PX ===== */}
  <div style={{ height: "86px" }} />

  {/* ===== BLOCK C ===== */}
  <button
    type="submit"
    className="
      w-full px-3 py-2 text-sm
      bg-[#0E1133] text-white font-semibold rounded-lg

      transition duration-200
      hover:bg-[#161a4a]
      active:scale-[0.99]

      opacity-0 animate-fadeIn
    "
    style={{ animationDelay: "0.5s", animationFillMode: "both" }}
  >
    Login
  </button>

</form>



      </div>

      <style jsx>{`
        /* BACKGROUND IMAGE SIZE CONTROL */
        /* Change the scale value to make background bigger or smaller */
        .background-image {
          transform: scale(1.2); /* 1.0 = normal, 1.5 = 150% bigger, 0.8 = 80% smaller */
          transform-origin: center center;
        }

        /* Reset for Electron - prevent zoom issues */
        * {
          -webkit-user-select: none;
          user-select: none;
        }

        /* Container for image - NO left margin */
        .calendar-image-container {
          margin-left: 0 !important;
          margin-right: 2rem;
          flex-shrink: 0;
        }

        /* Calendar Image Sizing - SMALLER for Electron */
        .calendar-image {
          width: 220px;
          height: 248px;
          object-fit: cover; /* Changed from contain to cover for cropping */
          object-position: left center; /* Show only the left side of the image */
          max-width: 100%;
          max-height: 100%;
        }

        /* Text Content Spacing - minimal left margin */
        .text-content {
          margin-left: 0 !important;
          text-align: left;
          max-width: 500px;
        }

        /* Header Text - SMALLER */
        .header-text {
          font-size: 34px;
          line-height: 1.2;
        }

        /* Subheader Text - SMALLER */
        .subheader-text {
          font-size: 20px;
        }

        /* Larger screens */
        @media (min-width: 1600px) {
          .calendar-image-container {
            margin-right: 2.5rem;
          }
          .calendar-image {
            width: 260px;
            height: 294px;
            object-fit: cover;
            object-position: left center;
          }
          .header-text {
            font-size: 38px;
          }
          .subheader-text {
            font-size: 22px;
          }
        }

        /* Standard desktop (most Electron windows) */
        @media (max-width: 1599px) and (min-width: 1200px) {
          .calendar-image-container {
            margin-right: 2rem;
          }
          .calendar-image {
            width: 220px;
            height: 248px;
            object-fit: cover;
            object-position: left center;
          }
          .header-text {
            font-size: 34px;
          }
          .subheader-text {
            font-size: 20px;
          }
        }

        @media (max-width: 1199px) and (min-width: 1024px) {
          .calendar-image-container {
            margin-right: 1.5rem;
          }
          .calendar-image {
            width: 200px;
            height: 226px;
            object-fit: cover;
            object-position: left center;
          }
          .header-text {
            font-size: 30px;
          }
          .subheader-text {
            font-size: 18px;
          }
        }

        @media (max-width: 1023px) and (min-width: 768px) {
          .calendar-image-container {
            margin-right: 1.5rem;
          }
          .calendar-image {
            width: 180px;
            height: 203px;
            object-fit: cover;
            object-position: left center;
          }
          .header-text {
            font-size: 28px;
          }
          .subheader-text {
            font-size: 16px;
          }
        }

        @media (max-width: 767px) {
          .calendar-image-container {
            margin-right: 0;
            margin-bottom: 1.5rem;
          }
          .calendar-image {
            width: 160px;
            height: 181px;
            object-fit: cover;
            object-position: left center;
          }
          .text-content {
            text-align: center !important;
            max-width: 100%;
          }
          .header-text {
            font-size: 24px;
            text-align: center !important;
          }
          .subheader-text {
            font-size: 16px;
            text-align: center !important;
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .animate-slideDown {
          animation: slideDown 0.8s ease-out forwards;
        }

        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  )
}