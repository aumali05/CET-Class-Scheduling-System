import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate("/login"), 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex h-screen text-white bg-zinc-900">
      <div className="flex flex-col flex-1 p-8">
        <img src="./imgs/app-icon.png" alt="Logo" className="w-24 mb-8" />
        <div className="flex flex-col justify-center flex-1">
          <h1 className="text-3xl font-bold mb-2">Golden Gate Colleges</h1>
          <h2 className="text-xl mb-6">College of Engineering and Technology</h2>
          <h3 className="text-2xl font-bold text-tealgreen">
            Class Scheduling System
          </h3>
        </div>
      </div>
      <div
        className="flex-1 bg-cover bg-center"
        style={{ backgroundImage: "url('./imgs/Online calendar-bro.png')" }}
      ></div>
    </div>
  );
}
