import React from "react";
import {
  Shield,
  Calendar,
  Users,
  Home,
  Settings,
  Instagram,
  Youtube,
  BookOpen,
} from "lucide-react";

const Layout = ({
  children,
  activeTab,
  setActiveTab,
  isAdmin,
  toggleAdmin,
}) => {
  // 네비게이션 아이템
  const navItems = [
    { id: "home", label: "HOME", icon: <Home size={18} /> },
    { id: "matches", label: "MATCH", icon: <Calendar size={18} /> },
    { id: "players", label: "PLAYER", icon: <Users size={18} /> },
  ];

  return (
    <div className="min-h-dvh bg-[#f9fafb] font-sans text-gray-900 flex flex-col">
      {/* ==========================================
          1. Header (상단바)
      ========================================== */}
      <header className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100">
        {/* 관리자 모드 경고 띠 */}
        {isAdmin && (
          <div className="bg-red-600 text-white text-center py-1 text-[10px] font-black tracking-widest animate-pulse">
            ADMIN MODE ACTIVE
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 h-14 md:h-16 flex items-center relative">
          {/* 🔥 1. 로고 (모바일: 정중앙 / PC: 좌측) */}
          <div
            className="flex items-center gap-2 cursor-pointer select-none absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0"
            onClick={(e) => {
              if (e.detail === 5) {
                toggleAdmin(!isAdmin);
                if (!isAdmin) setActiveTab("admin");
                else setActiveTab("home");
              }
            }}
          >
            <img
              src="logo.png"
              alt="Logo"
              className="h-10 md:h-20 w-auto object-contain"
            />
          </div>

          {/* 🔥 2. PC 메뉴 (무조건 화면 정중앙 고정) */}
          <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            {!isAdmin &&
              navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full transition-all font-bold text-sm ${activeTab === item.id ? "bg-ssu-dark text-white shadow-md" : "hover:bg-gray-100 text-gray-500"}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
          </nav>

          {/* 3. 우측 (관리자 메뉴 버튼 - PC 전용) */}
          <div className="hidden md:flex ml-auto items-center">
            {isAdmin && (
              <button
                onClick={() => setActiveTab("admin")}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full font-black bg-red-600 text-white shadow-md hover:bg-red-700 transition-all text-sm"
              >
                <Settings size={16} />
                <span>관리 센터</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ==========================================
          2. Main Content (메인 화면 영역)
      ========================================== */}
      {/* 모바일에서는 플로팅 탭바에 가려지지 않도록 하단 패딩(pb-28) 부여 */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-2 md:px-8 md:py-10">
        {children}
      </main>

      {/* ==========================================
          3. Footer (하단 구단 정보)
      ========================================== */}
      <footer className="bg-ssu-dark text-white/70 py-10 pb-28 md:pb-10 w-full mt-auto">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center md:items-end gap-8">
          {/* 구단 주소 정보 */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <h2 className="text-xl font-black text-white mb-2 tracking-tight">
              숭실대학교 축구단
            </h2>
            <p className="text-xs mb-1 font-medium">
              서울특별시 동작구 상도로 369 숭실대학교 대운동장
            </p>
          </div>

          {/* SNS 링크 (나중에 href 속성에 실제 링크를 넣으세요!) */}
          <div className="flex gap-4">
            <a
              href="https://instagram.com/ssu.football"
              target="_blank"
              rel="noreferrer"
              className="bg-white/10 p-3 rounded-full hover:bg-[#FFD60A] hover:text-ssu-dark transition-all"
            >
              <Instagram size={20} />
            </a>
            <a
              href="https://youtube.com/@ssu.football"
              target="_blank"
              rel="noreferrer"
              className="bg-white/10 p-3 rounded-full hover:bg-[#FFD60A] hover:text-ssu-dark transition-all"
            >
              <Youtube size={20} />
            </a>
            <a
              href="https://blog.naver.com/ssufootball1918"
              target="_blank"
              rel="noreferrer"
              className="bg-white/10 p-3 rounded-full hover:bg-[#FFD60A] hover:text-ssu-dark transition-all"
            >
              <BookOpen size={20} />
            </a>
          </div>
        </div>
      </footer>

      {/* ==========================================
          4. Mobile Segmented Control (모바일 플로팅 탭바)
      ========================================== */}
      {!isAdmin && (
        <div className="md:hidden fixed bottom-6 left-4 right-4 z-50 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom)]">
          {/* 🔥 배경을 회색(gray-200)으로 깔고, 선택된 버튼만 흰색 바탕이 되는 Segmented Control 스타일 */}
          <div className="bg-gray-200/90 backdrop-blur-xl border border-white/50 p-1.5 rounded-full flex w-full max-w-[320px] shadow-[0_10px_40px_rgba(0,0,0,0.15)] pointer-events-auto">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 py-2 sm:py-2.5 rounded-full transition-all duration-300 ${isActive ? "bg-white text-ssu-dark shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
                >
                  {React.cloneElement(item.icon, {
                    size: isActive ? 20 : 18,
                    className: isActive ? "text-ssu-blue" : "",
                  })}
                  <span
                    className={`text-[10px] md:text-xs font-black tracking-wider ${isActive ? "text-ssu-dark" : ""}`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 모바일 하단 탭바 - 관리자 전용 */}
      {isAdmin && (
        <div className="md:hidden fixed bottom-6 left-4 right-4 z-50 flex justify-center pointer-events-none pb-[env(safe-area-inset-bottom)]">
          <button
            onClick={() => setActiveTab("admin")}
            className="flex items-center justify-center gap-2 w-full max-w-[320px] h-14 bg-red-600 rounded-full text-white font-black text-sm shadow-[0_10px_30px_rgba(220,38,38,0.4)] pointer-events-auto hover:scale-105 transition-transform"
          >
            <Settings size={20} /> 관리 센터로 이동
          </button>
        </div>
      )}
    </div>
  );
};

export default Layout;
