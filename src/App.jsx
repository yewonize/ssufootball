import React, { useState, Suspense, lazy } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import MatchSchedule from "./components/MatchSchedule";
import PlayerSection from "./components/PlayerSection";
import MatchDetailModal from "./components/MatchDetailModal";
const AdminPanel = lazy(() => import("./components/admin/AdminPanel"));

// 🔥 1. 방금 만든 DataProvider와 db 불러오기
import { DataProvider, useData } from "./contexts/DataContext";
import { db } from "./firebase";

// 실제 앱 화면을 그리는 메인 컴포넌트 (DataProvider 안쪽에 위치해야 데이터를 쓸 수 있음)
const MainApp = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 🔥 2. 이제 컴포넌트 내부에서 엄청 길었던 데이터 로직 대신 useData() 한 줄이면 끝!
  const { isLoading, matches, players, matchLogs } = useData();
  const [selectedMatch, setSelectedMatch] = useState(null);

  const [isAdmin, setIsAdmin] = useState(
    () => sessionStorage.getItem("ssuAdmin") === "true",
  );

  const toggleAdmin = (status) => {
    setIsAdmin(status);
    if (status) sessionStorage.setItem("ssuAdmin", "true");
    else {
      sessionStorage.removeItem("ssuAdmin");
      navigate("/");
    }
  };
  let activeTab = "home";
  if (location.pathname.includes("/matches")) activeTab = "matches";
  if (location.pathname.includes("/players")) activeTab = "players";
  if (location.pathname.includes("/admin")) activeTab = "admin";

  const setActiveTab = (tab) => {
    if (tab === "home") navigate("/");
    else if (tab === "matches") navigate("/matches");
    else if (tab === "players") navigate("/players");
    else if (tab === "admin") navigate("/admin-login");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white text-[#001D3D] font-black text-xl tracking-widest">
        LOADING DATA...
      </div>
    );
  }

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isAdmin={isAdmin}
      toggleAdmin={toggleAdmin}
    >
      {/* 🔥 여기에 Suspense를 씌워줍니다! */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full py-20 text-[#001D3D] font-black text-xl">
            페이지를 불러오는 중입니다...
          </div>
        }
      >
        <Routes>
          {/* 더 이상 데이터를 주렁주렁 달아서 넘겨줄(Props) 필요가 없습니다! (대시보드는 내부에서 알아서 꺼내 씁니다) */}
          <Route path="/" element={<Dashboard setActiveTab={setActiveTab} />} />

          {/* 아직 리팩토링 안 된 컴포넌트들을 위해 일단 기존 방식대로 Props를 넘겨놓습니다 */}
          <Route
            path="/matches"
            element={
              <MatchSchedule
                matches={matches}
                players={players}
                match_logs={matchLogs}
                onMatchClick={setSelectedMatch}
                isAdmin={isAdmin}
                db={db}
              />
            }
          />
          <Route
            path="/players/*"
            element={
              <PlayerSection
                players={players}
                matches={matches}
                match_logs={matchLogs}
                isAdmin={isAdmin}
                db={db}
              />
            }
          />
          <Route
            path="/admin-login"
            element={<AdminPanel isAdmin={isAdmin} toggleAdmin={toggleAdmin} />}
          />
        </Routes>
      </Suspense>{" "}
      {/* 🔥 Suspense 닫기! */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </Layout>
  );
};

// 최상위를 DataProvider로 감싸줍니다.
const App = () => {
  return (
    <DataProvider>
      <MainApp />
    </DataProvider>
  );
};

export default App;
