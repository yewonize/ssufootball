import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom"; // 🔥 라우팅 훅 추가
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  writeBatch,
  query,
  where,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { Settings } from "lucide-react";
// firebase 설정 파일에서 활성화
import { enableIndexedDbPersistence } from "firebase/firestore";

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    // 여러 탭이 열려있을 때
  } else if (err.code === "unimplemented") {
    // 브라우저가 지원하지 않을 때
  }
});

import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import MatchSchedule from "./components/MatchSchedule";
import PlayerSection from "./components/PlayerSection";
import MatchDetailModal from "./components/MatchDetailModal";
import AdminPanel from "./components/AdminPanel";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBxZjJlReQMIUDgEnW7V8ZX3KA3lhr4BnI",
  authDomain: "ssufootball.firebaseapp.com",
  projectId: "ssufootball",
  storageBucket: "ssufootball.firebasestorage.app",
  messagingSenderId: "448182371519",
  appId: "1:448182371519:web:ba0acffe4f676278e7320a",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const App = () => {
  // 🔥 라우팅을 위한 네비게이션 훅
  const navigate = useNavigate();
  const location = useLocation();

  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [league, setLeague] = useState([]);
  const [matchLogs, setMatchLogs] = useState([]); // 🔥 이 줄 추가!
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 관리자 인증 상태 (세션 유지)
  const [isAdmin, setIsAdmin] = useState(
    () => sessionStorage.getItem("ssuAdmin") === "true",
  );

  const toggleAdmin = (status) => {
    setIsAdmin(status);
    if (status) sessionStorage.setItem("ssuAdmin", "true");
    else {
      sessionStorage.removeItem("ssuAdmin");
      navigate("/"); // 로그아웃 시 무조건 홈으로 이동!
    }
  };

  // 🔥 기존 Layout.jsx가 에러 나지 않도록 URL 기반으로 activeTab을 가짜로 만들어줍니다.
  // (이후 Layout.jsx를 수정하면 이 부분은 더 깔끔하게 제거될 예정입니다)
  let activeTab = "home";
  if (location.pathname.includes("/matches")) activeTab = "matches";
  if (location.pathname.includes("/players")) activeTab = "players";
  if (location.pathname.includes("/admin")) activeTab = "admin";

  const setActiveTab = (tab) => {
    if (tab === "home") navigate("/");
    else if (tab === "matches") navigate("/matches");
    else if (tab === "players") navigate("/players");
    else if (tab === "admin") navigate("/admin-login"); // 🔥 관리자 전용 숨김 URL
  };

  // 데이터 불러오기
  // App.jsx
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // 1. 로컬 스토리지에서 먼저 확인 (개발 모드에서 특히 유용)
        const cachedMatches = localStorage.getItem("cache_matches");
        const cachedPlayers = localStorage.getItem("cache_players");
        const cachedLeague = localStorage.getItem("cache_league");
        const cachedLogs = localStorage.getItem("cache_logs");

        if (cachedMatches && cachedPlayers && cachedLeague && cachedLogs) {
          setMatches(JSON.parse(cachedMatches));
          setPlayers(JSON.parse(cachedPlayers));
          setLeague(JSON.parse(cachedLeague));
          setMatchLogs(JSON.parse(cachedLogs));
          setIsLoading(false);
          return; // 캐시가 있으면 DB 요청 안 함!
        }

        // 2. 캐시가 없을 때만 DB에서 가져오기
        const [matchSnaps, playerSnaps, leagueSnaps, logsSnap] =
          await Promise.all([
            getDocs(collection(db, "matches")),
            getDocs(collection(db, "players")),
            getDocs(collection(db, "league")),
            getDocs(collection(db, "match_logs")),
          ]);

        const matchData = matchSnaps.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        }));
        const playerData = playerSnaps.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        }));
        const leagueData = leagueSnaps.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        }));
        const logData = logsSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // 3. 상태에 저장하고 로컬 스토리지에도 저장
        setMatches(matchData);
        setPlayers(playerData);
        setLeague(leagueData);
        setMatchLogs(logData);

        localStorage.setItem("cache_matches", JSON.stringify(matchData));
        localStorage.setItem("cache_players", JSON.stringify(playerData));
        localStorage.setItem("cache_league", JSON.stringify(leagueData));
        localStorage.setItem("cache_logs", JSON.stringify(logData));
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- 데이터 조작 함수들 (유지) ---
  const handleAddLeagueTeam = async (teamData) => {
    try {
      const docRef = await addDoc(collection(db, "league"), teamData);
      setLeague((prev) => [...prev, { id: docRef.id, ...teamData }]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateLeagueTeam = async (id, updates) => {
    try {
      await updateDoc(doc(db, "league", id), updates);
      setLeague((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteLeagueTeam = async (id) => {
    if (!window.confirm("해당 팀을 순위표에서 삭제하시겠습니까?")) return;
    try {
      await deleteDoc(doc(db, "league", id));
      setLeague((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddMatch = async (matchData) => {
    const docId = `${matchData.date}_${matchData.opponent}`.replace(/\s/g, "_");
    const combinedType = matchData.round
      ? `${matchData.type} ${matchData.round}`
      : matchData.type;
    const payload = {
      ...matchData,
      type: combinedType,
      docId: docId,
      homeScore: 0,
      awayScore: 0,
      pso: null,
      scorers: "",
      assists: "",
      mom: "",
    };
    delete payload.round;
    try {
      await setDoc(doc(db, "matches", docId), payload);
      setMatches((prev) =>
        [...prev, { ...payload, id: docId }].sort(
          (a, b) => new Date(a.date) - new Date(b.date),
        ),
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateMatch = async (id, updates) => {
    try {
      await updateDoc(doc(db, "matches", id), updates);
      setMatches((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMatch = async (id) => {
    if (!window.confirm("삭제하시겠습니까?")) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, "matches", id));
      const logSnaps = await getDocs(
        query(collection(db, "match_logs"), where("matchId", "==", id)),
      );
      logSnaps.forEach((logDoc) => batch.delete(logDoc.ref));
      await batch.commit();
      setMatches((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddPlayer = async (newPlayerData) => {
    try {
      const docRef = await addDoc(collection(db, "players"), newPlayerData);
      setPlayers((prev) => [...prev, { id: docRef.id, ...newPlayerData }]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdatePlayer = async (id, updates) => {
    try {
      await updateDoc(doc(db, "players", id), updates);
      setPlayers((prev) =>
        prev.map((p) => {
          if (p.id === id) {
            const newP = { ...p };
            for (const [key, value] of Object.entries(updates)) {
              if (key.includes(".")) {
                const [obj, prop] = key.split(".");
                newP[obj] = { ...newP[obj], [prop]: value };
              } else newP[key] = value;
            }
            return newP;
          }
          return p;
        }),
      );
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 text-ssu-blue font-bold text-xl">
        데이터 로딩 중...
      </div>
    );

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      isAdmin={isAdmin}
      toggleAdmin={toggleAdmin}
    >
      {/* 🔥 이제 상태가 아닌 실제 URL 주소에 따라 화면을 그립니다 (뒤로가기 완벽 지원) */}
      <Routes>
        <Route
          path="/"
          element={
            <Dashboard
              matches={matches}
              league={league}
              match_logs={matchLogs}
              setActiveTab={setActiveTab}
              players={players}
              isAdmin={isAdmin}
            />
          }
        />

        <Route
          path="/matches"
          element={
            <MatchSchedule
              matches={matches}
              players={players}
              isAdmin={isAdmin}
              league={league}
              match_logs={matchLogs}
              onDeleteMatch={handleDeleteMatch}
              onAddMatch={handleAddMatch}
              onMatchClick={setSelectedMatch}
              db={db}
            />
          }
        />

        {/* /players 뒤에 어떤 글자가 오든 PlayerSection이 담당하도록 와일드카드(*) 처리 */}
        <Route
          path="/players/*"
          element={
            <PlayerSection
              players={players}
              matches={matches}
              isAdmin={isAdmin}
              onAddPlayer={handleAddPlayer}
              onUpdatePlayer={handleUpdatePlayer}
              db={db}
            />
          }
        />

        {/* 완전히 분리된 관리자 전용 URL (아무나 버튼으로 누를 수 없음) */}
        <Route
          path="/admin-login"
          element={
            <AdminPanel
              matches={matches}
              players={players}
              league={league}
              db={db}
              onAddLeagueTeam={handleAddLeagueTeam}
              onUpdateMatch={handleUpdateMatch}
              onUpdatePlayer={handleUpdatePlayer}
              onUpdateLeagueTeam={handleUpdateLeagueTeam}
              toggleAdmin={toggleAdmin}
            />
          }
        />
      </Routes>

      {/* 팝업 모달은 모든 화면 위에 떠야하므로 유지 */}
      {selectedMatch && (
        <MatchDetailModal
          match={selectedMatch}
          allMatches={matches}
          players={players}
          onClose={() => setSelectedMatch(null)}
          isAdmin={isAdmin}
          onUpdateMatch={handleUpdateMatch}
          db={db}
        />
      )}
    </Layout>
  );
};

export default App;
