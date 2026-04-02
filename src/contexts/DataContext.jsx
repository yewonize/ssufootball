import React, { createContext, useContext, useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  writeBatch,
  query,
  where,
  setDoc,
  increment,
  onSnapshot,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// 1. Context(보관소) 생성
const DataContext = createContext();

// 2. Provider(보급소) 컴포넌트 생성
export const DataProvider = ({ children }) => {
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [league, setLeague] = useState([]);
  const [matchLogs, setMatchLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🔥 [핵심 추가] 데이터 변경 시 캐시를 비워주는 헬퍼 함수
  const clearCache = () => {
    sessionStorage.removeItem("cache_matches");
    sessionStorage.removeItem("cache_players");
    sessionStorage.removeItem("cache_league");
    sessionStorage.removeItem("cache_logs");
  };

  // 데이터 불러오기 로직 (캐싱 적용)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // 1. Session Storage에서 캐시된 데이터 확인
        const cacheMatches = sessionStorage.getItem("cache_matches");
        const cachePlayers = sessionStorage.getItem("cache_players");
        const cacheLeague = sessionStorage.getItem("cache_league");
        const cacheLogs = sessionStorage.getItem("cache_logs");

        // 2. 캐시가 모두 존재하면 DB 안 찌르고 캐시에서 바로 렌더링 (요금 0원!)
        if (cacheMatches && cachePlayers && cacheLeague && cacheLogs) {
          setMatches(JSON.parse(cacheMatches));
          setPlayers(JSON.parse(cachePlayers));
          setLeague(JSON.parse(cacheLeague));
          setMatchLogs(JSON.parse(cacheLogs));
          setIsLoading(false);
          return;
        }

        // 3. 캐시가 없으면 그때만 Firebase에서 읽어옴
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

        setMatches(matchData);
        setPlayers(playerData);
        setLeague(leagueData);
        setMatchLogs(logData);

        // 4. 불러온 데이터를 다음 새로고침을 위해 캐시에 저장
        sessionStorage.setItem("cache_matches", JSON.stringify(matchData));
        sessionStorage.setItem("cache_players", JSON.stringify(playerData));
        sessionStorage.setItem("cache_league", JSON.stringify(leagueData));
        sessionStorage.setItem("cache_logs", JSON.stringify(logData));
      } catch (err) {
        console.error("데이터 로딩 실패:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleUpdatePlayer = async (id, updates) => {
    try {
      const playerRef = doc(db, "players", id);
      await updateDoc(playerRef, updates);

      setPlayers((prevPlayers) =>
        prevPlayers.map((player) =>
          player.id === id ? { ...player, ...updates } : player,
        ),
      );
      clearCache(); // 데이터가 바뀌었으니 캐시 초기화
    } catch (error) {
      console.error("선수 상태 업데이트 실패:", error);
      throw error;
    }
  };

  const handleAddMatch = async (matchData) => {
    try {
      const customId = `${matchData.date}_${matchData.opponent.trim()}`;
      await setDoc(doc(db, "matches", customId), {
        ...matchData,
        id: customId,
        year: parseInt(matchData.date.split("-")[0]),
      });

      setMatches((prev) => [{ id: customId, ...matchData }, ...prev]);
      clearCache(); // 데이터가 바뀌었으니 캐시 초기화
      return customId;
    } catch (e) {
      console.error("경기 등록 실패:", e);
      throw e;
    }
  };

  const handleDeleteMatch = async (matchId) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    const isConfirmed = window.confirm(
      "⚠️ 경고: 완전 삭제 및 스탯 롤백\n\n이 경기를 삭제하면 선수들의 누적 스탯(득점, 출전 등)이 자동으로 차감됩니다.\n정말 삭제하시겠습니까?",
    );
    if (!isConfirmed) return;

    try {
      const batch = writeBatch(db);
      const logsQuery = query(
        collection(db, "match_logs"),
        where("matchId", "==", matchId),
      );
      const logsSnap = await getDocs(logsQuery);
      const yr = String(match.date.split("-")[0]);

      logsSnap.docs.forEach((docSnap) => {
        const logData = docSnap.data();
        let targetPlayerId = logData.playerId;

        // 이름으로 역추적 (안전장치)
        if (!targetPlayerId && logData.name) {
          const foundPlayer = players.find((p) => p.name === logData.name);
          if (foundPlayer) targetPlayerId = foundPlayer.id;
        }

        if (targetPlayerId) {
          const playerRef = doc(db, "players", targetPlayerId);
          batch.update(playerRef, {
            "stats.total.goals": increment(-(logData.goals || 0)),
            "stats.total.assists": increment(-(logData.assists || 0)),
            "stats.total.conceded": increment(-(logData.conceded || 0)),
            "stats.total.pkGoals": increment(-(logData.pkGoals || 0)),
            "stats.total.apps": increment(-1),
            "stats.total.mins": increment(-(logData.minutes || 0)),
            "stats.total.psoGoals": increment(-(logData.psoGoals || 0)),
            "stats.total.psoSaves": increment(-(logData.psoSaves || 0)),
            [`stats.years.${yr}.goals`]: increment(-(logData.goals || 0)),
            [`stats.years.${yr}.assists`]: increment(-(logData.assists || 0)),
            [`stats.years.${yr}.conceded`]: increment(-(logData.conceded || 0)),
            [`stats.years.${yr}.pkGoals`]: increment(-(logData.pkGoals || 0)),
            [`stats.years.${yr}.apps`]: increment(-1),
            [`stats.years.${yr}.mins`]: increment(-(logData.minutes || 0)),
          });
        }
        batch.delete(docSnap.ref);
      });

      batch.delete(doc(db, "matches", matchId));
      await batch.commit();

      setMatches((prev) => prev.filter((m) => m.id !== matchId));
      setMatchLogs((prev) => prev.filter((log) => log.matchId !== matchId));

      clearCache(); // 대규모 업데이트 후 캐시 초기화
      alert("경기 삭제 및 선수 스탯 롤백이 완벽하게 완료되었습니다.");
    } catch (error) {
      console.error("완전 삭제 실패:", error);
      alert("삭제 중 오류가 발생했습니다: " + error.message);
    }
  };

  const handleUpdateMatch = async (id, updates) => {
    try {
      const matchRef = doc(db, "matches", id);
      await updateDoc(matchRef, updates);
      setMatches((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      );
      clearCache(); // 데이터가 바뀌었으니 캐시 초기화
    } catch (e) {
      console.error("경기 업데이트 실패:", e);
    }
  };

  const handleLikePlayer = async (playerId) => {
    await updateDoc(doc(db, "players", playerId), { likes: increment(1) });
    // 좋아요는 너무 빈번하므로 캐시를 굳이 날리지 않고 상태만 업데이트 할 수도 있습니다.
    // 여기서는 확실한 일치를 위해 캐시 초기화 진행
    clearCache();
  };

  const handleAddPlayerComment = async (playerId, text) => {
    await addDoc(collection(db, "players", playerId, "comments"), {
      text,
      author: "익명 팬",
      createdAt: serverTimestamp(),
      date: new Date().toLocaleDateString(),
    });
  };

  const subscribeToPlayerComments = (playerId, callback) => {
    const q = query(
      collection(db, "players", playerId, "comments"),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
  };

  return (
    <DataContext.Provider
      value={{
        matches,
        setMatches,
        players,
        setPlayers,
        league,
        setLeague,
        matchLogs,
        setMatchLogs,
        isLoading,
        handleUpdatePlayer,
        handleAddMatch,
        handleUpdateMatch,
        handleDeleteMatch,
        handleLikePlayer,
        handleAddPlayerComment,
        subscribeToPlayerComments,
        clearCache, // 🔥 명시적 캐시 초기화 함수 제공
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export default DataContext;
export const useData = () => useContext(DataContext);
