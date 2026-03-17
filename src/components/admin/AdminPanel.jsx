import React, { useState } from "react";
import {
  Lock,
  LogOut,
  LayoutDashboard,
  BarChart3,
  Calendar,
  Trophy,
  Users,
} from "lucide-react";
import { useData } from "../../contexts/DataContext";

// 🔥 완벽하게 분리된 하위 컴포넌트들
import AdminDashboard from "./AdminDashboard";
import AdminLeague from "./AdminLeague";
import AdminPlayers from "./AdminPlayers";
import AdminMatches from "./AdminMatches";
import MatchLogModal from "./MatchLogModal";

const AdminPanel = ({ toggleAdmin }) => {
  const {
    matches,
    players,
    league,
    matchLogs,
    handleAddLeagueTeam: onAddLeagueTeam,
    handleUpdateLeagueTeam: onUpdateLeagueTeam,
    handleAddMatch: onAddMatch,
    handleUpdateMatch: onUpdateMatch,
    handleDeleteMatch: onDeleteMatch,
    handleUpdatePlayer: onUpdatePlayer,
  } = useData();

  // ============ 1. 시스템 상태 ============
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => sessionStorage.getItem("ssuAdmin") === "true",
  );
  const [activeMenu, setActiveMenu] = useState("dashboard");

  // 🔥 보안: 환경 변수에서 비밀번호를 가져옵니다.
  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

  // ============ 2. 로깅 모달 전용 상태 ============
  const [loggingMatch, setLoggingMatch] = useState(null);

  // ============ 3. 핸들러 함수 ============
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsLoggedIn(true);
      sessionStorage.setItem("ssuAdmin", "true");
      toggleAdmin(true);
    } else {
      alert("비밀번호가 틀렸습니다.");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    toggleAdmin(false);
    sessionStorage.removeItem("ssuAdmin");
  };

  const openLoggingModal = (match) => {
    setLoggingMatch(match);
  };

  // =========================================================
  // 렌더링 영역 - 로그인 화면
  // =========================================================
  if (!isLoggedIn) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100 w-full max-w-sm text-center animate-fade-in"
        >
          <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-100 text-ssu-blue">
            <Lock size={32} />
          </div>
          <h2 className="text-2xl font-black text-ssu-black mb-2">
            Studio Access
          </h2>
          <p className="text-slate-400 text-sm font-bold mb-6">
            시스템 접근을 위해 로그인하세요.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 border border-gray-200 rounded-2xl mb-4 text-center font-black tracking-widest outline-none focus:border-ssu-blue transition"
            placeholder="PASSWORD"
          />
          <button
            type="submit"
            className="w-full bg-ssu-black text-[#FFD60A] py-4 rounded-2xl font-black text-lg shadow-md hover:bg-black transition-all"
          >
            접속하기
          </button>
        </form>
      </div>
    );
  }

  // =========================================================
  // 렌더링 영역 - 관리자 메인 (사이드바 & 라우팅)
  // =========================================================
  return (
    <div className="studio-layout flex h-screen overflow-hidden bg-slate-50">
      {/* 🔴 데스크탑 사이드바 (YouTube Studio Style) */}
      <aside className="studio-sidebar bg-ssu-black text-white w-64 shrink-0 hidden md:flex flex-col h-full border-r border-white/5">
        <div className="p-8 border-b border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 bg-[#FFD60A] rounded-full animate-pulse"></div>
            <h2 className="text-ssu-blue font-black text-xl tracking-tighter italic">
              STUDIO
            </h2>
          </div>
          <p className="text-[10px] text-white/50 font-bold uppercase tracking-[0.2em]">
            Management System
          </p>
        </div>

        <nav className="flex-1 py-6 overflow-y-auto">
          <div className="px-6 mb-3 text-[10px] font-black text-white/40 uppercase tracking-widest">
            Dashboard
          </div>
          <button
            onClick={() => setActiveMenu("dashboard")}
            className={`w-full flex items-center gap-3 px-6 py-4 text-sm font-black transition-all border-l-4 ${activeMenu === "dashboard" ? "bg-ssu-blue/10 text-ssu-blue border-ssu-blue" : "text-white/60 border-transparent hover:bg-white/5 hover:text-white"}`}
          >
            <LayoutDashboard size={18} /> 대시보드 홈
          </button>
          <button
            onClick={() => setActiveMenu("analytics")}
            className={`w-full flex items-center gap-3 px-6 py-4 text-sm font-black transition-all border-l-4 ${activeMenu === "analytics" ? "bg-ssu-blue/10 text-ssu-blue border-ssu-blue" : "text-white/60 border-transparent hover:bg-white/5 hover:text-white"}`}
          >
            <BarChart3 size={18} /> 데이터 인사이트
          </button>

          <div className="px-6 mt-8 mb-3 text-[10px] font-black text-white/40 uppercase tracking-widest">
            Content Management
          </div>
          <button
            onClick={() => setActiveMenu("matches")}
            className={`w-full flex items-center gap-3 px-6 py-4 text-sm font-black transition-all border-l-4 ${activeMenu === "matches" ? "bg-ssu-blue/10 text-ssu-blue border-ssu-blue" : "text-white/60 border-transparent hover:bg-white/5 hover:text-white"}`}
          >
            <Calendar size={18} /> 경기 일정/로깅
          </button>
          <button
            onClick={() => setActiveMenu("league")}
            className={`w-full flex items-center gap-3 px-6 py-4 text-sm font-black transition-all border-l-4 ${activeMenu === "league" ? "bg-ssu-blue/10 text-ssu-blue border-ssu-blue" : "text-white/60 border-transparent hover:bg-white/5 hover:text-white"}`}
          >
            <Trophy size={18} /> 리그 순위 관리
          </button>
          <button
            onClick={() => setActiveMenu("players")}
            className={`w-full flex items-center gap-3 px-6 py-4 text-sm font-black transition-all border-l-4 ${activeMenu === "players" ? "bg-ssu-blue/10 text-ssu-blue border-ssu-blue" : "text-white/60 border-transparent hover:bg-white/5 hover:text-white"}`}
          >
            <Users size={18} /> 선수단/댓글 관리
          </button>
        </nav>

        <div className="p-6 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 text-red-400 font-black text-sm hover:text-red-300 transition w-full"
          >
            <LogOut size={18} /> 로그아웃
          </button>
        </div>
      </aside>

      {/* 🔴 모바일 하단 네비게이션 */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-ssu-black border-t border-white/10 flex justify-around p-3 pb-8 z-[9999] shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
        {[
          { id: "dashboard", icon: <LayoutDashboard size={20} /> },
          { id: "analytics", icon: <BarChart3 size={20} /> },
          { id: "matches", icon: <Calendar size={20} /> },
          { id: "league", icon: <Trophy size={20} /> },
          { id: "players", icon: <Users size={20} /> },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setActiveMenu(m.id)}
            className={`p-2 rounded-xl transition-all ${activeMenu === m.id ? "bg-ssu-blue text-white shadow-md" : "text-white/50 hover:text-white"}`}
          >
            {m.icon}
          </button>
        ))}
      </div>

      {/* 🔵 메인 컨텐츠 영역 (하위 컴포넌트 렌더링) */}
      <main className="flex-1 overflow-y-auto p-5 md:p-10 pb-24 md:pb-10 bg-slate-50 relative z-0">
        {(activeMenu === "dashboard" || activeMenu === "analytics") && (
          <AdminDashboard
            matches={matches}
            players={players}
            matchLogs={matchLogs}
            activeMenu={activeMenu}
            setActiveMenu={setActiveMenu}
            openLoggingModal={openLoggingModal}
          />
        )}

        {activeMenu === "matches" && (
          <AdminMatches
            matches={matches}
            onAddMatch={onAddMatch}
            onDeleteMatch={onDeleteMatch}
            openLoggingModal={openLoggingModal}
          />
        )}

        {activeMenu === "league" && (
          <AdminLeague
            matches={matches}
            league={league}
            onAddLeagueTeam={onAddLeagueTeam}
            onUpdateLeagueTeam={onUpdateLeagueTeam}
          />
        )}

        {activeMenu === "players" && (
          <AdminPlayers players={players} onUpdatePlayer={onUpdatePlayer} />
        )}
      </main>

      {/* 🔴 글로벌 모달: 경기 로깅 */}
      <MatchLogModal
        match={loggingMatch}
        onClose={() => setLoggingMatch(null)}
        players={players}
        matchLogs={matchLogs}
        onUpdateMatch={onUpdateMatch}
      />
    </div>
  );
};

export default AdminPanel;
