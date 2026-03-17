// src/contexts/DataContext.jsx
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
import { db } from "../firebase"; // 방금 만든 파일 불러오기

// 1. Context(보관소) 생성
const DataContext = createContext();

// 2. Provider(보급소) 컴포넌트 생성
export const DataProvider = ({ children }) => {
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [league, setLeague] = useState([]);
  const [matchLogs, setMatchLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 데이터 불러오기 로직 (App.jsx에서 가져옴)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

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

        localStorage.setItem("cache_matches", JSON.stringify(matchData));
        localStorage.setItem("cache_players", JSON.stringify(playerData));
        localStorage.setItem("cache_league", JSON.stringify(leagueData));
        localStorage.setItem("cache_logs", JSON.stringify(logData));
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
      // 1. Firebase 데이터베이스 업데이트
      const playerRef = doc(db, "players", id);
      await updateDoc(playerRef, updates);

      // 🔥 2. 여기가 핵심! 화면(UI)에 즉시 반영되도록 로컬 상태 업데이트
      setPlayers((prevPlayers) =>
        prevPlayers.map((player) =>
          player.id === id ? { ...player, ...updates } : player,
        ),
      );
    } catch (error) {
      console.error("선수 상태 업데이트 실패:", error);
      throw error;
    }
  };

  const handleAddMatch = async (matchData) => {
    try {
      // 1. 문서 ID 생성: "2026-03-16_상대팀명" (공백 제거)
      const customId = `${matchData.date}_${matchData.opponent.trim()}`;

      // 2. setDoc을 사용하여 문서 ID를 직접 지정하여 저장
      await setDoc(doc(db, "matches", customId), {
        ...matchData,
        id: customId, // 문서 내부 필드에도 동일한 ID 저장
        year: parseInt(matchData.date.split("-")[0]),
      });

      setMatches((prev) => [{ id: customId, ...matchData }, ...prev]);
      return customId;
    } catch (e) {
      console.error("경기 등록 실패:", e);
      throw e;
    }
  };
  // DataContext.jsx 내부
  const handleDeleteMatch = async (matchId) => {
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    const isConfirmed = window.confirm(
      "⚠️ 경고: 완전 삭제 및 스탯 롤백\n\n" +
        "이 경기를 삭제하면 선수들의 누적 스탯(득점, 출전 등)이 자동으로 차감됩니다.\n" +
        "정말 삭제하시겠습니까?",
    );
    if (!isConfirmed) return;

    try {
      const batch = writeBatch(db);

      // 1. 해당 경기에 딸린 모든 로그(match_logs) 가져오기
      const logsQuery = query(
        collection(db, "match_logs"),
        where("matchId", "==", matchId),
      );
      const logsSnap = await getDocs(logsQuery);
      const yr = String(match.date.split("-")[0]);

      // 2. 각 로그를 돌며 선수들의 누적 스탯을 반대로 깎기 (마이너스 increment)
      logsSnap.docs.forEach((docSnap) => {
        const logData = docSnap.data();
        const player = players.find((p) => p.name === logData.name);

        if (player) {
          const playerRef = doc(db, "players", player.id);
          batch.update(playerRef, {
            // 통산 스탯 차감
            "stats.total.goals": increment(-(logData.goals || 0)),
            "stats.total.assists": increment(-(logData.assists || 0)),
            "stats.total.conceded": increment(-(logData.conceded || 0)),
            "stats.total.pkGoals": increment(-(logData.pkGoals || 0)),
            "stats.total.apps": increment(-1),
            "stats.total.mins": increment(-(logData.minutes || 0)),

            // 해당 연도 스탯 차감
            [`stats.years.${yr}.goals`]: increment(-(logData.goals || 0)),
            [`stats.years.${yr}.assists`]: increment(-(logData.assists || 0)),
            [`stats.years.${yr}.conceded`]: increment(-(logData.conceded || 0)),
            [`stats.years.${yr}.pkGoals`]: increment(-(logData.pkGoals || 0)),
            [`stats.years.${yr}.apps`]: increment(-1),
            [`stats.years.${yr}.mins`]: increment(-(logData.minutes || 0)),
          });
        }
        // 3. 로그 문서 삭제 대기에 추가
        batch.delete(docSnap.ref);
      });

      // 4. 경기(matches) 문서 삭제 대기에 추가
      batch.delete(doc(db, "matches", matchId));

      // 🔥 5. 모든 작업을 원자적(Atomic)으로 한 번에 실행
      // 이 중 하나라도 실패하면 아무것도 삭제되지 않아 데이터 안전 보장
      await batch.commit();

      // 6. 리액트 상태 업데이트 (새로고침 없이 UI 반영)
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
      if (setMatchLogs) {
        setMatchLogs((prev) => prev.filter((log) => log.matchId !== matchId));
      }

      alert("경기 삭제 및 선수 스탯 롤백이 완벽하게 완료되었습니다.");
    } catch (error) {
      console.error("완전 삭제 실패:", error);
      alert("삭제 중 오류가 발생했습니다: " + error.message);
    }
  };

  // DataContext.jsx 내부
  const handleUpdateMatch = async (id, updates) => {
    try {
      const matchRef = doc(db, "matches", id);
      await updateDoc(matchRef, updates);
      // 화면 상태 즉시 반영
      setMatches((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      );
    } catch (e) {
      console.error("경기 업데이트 실패:", e);
    }
  };

  // --- PlayerSection 전용 함수들 ---
  const handleLikePlayer = async (playerId) => {
    await updateDoc(doc(db, "players", playerId), { likes: increment(1) });
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
    // 하위 컴포넌트들에게 공유할 데이터 목록
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
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

// 3. 쉽게 꺼내 쓰기 위한 커스텀 훅 생성!
export const useData = () => useContext(DataContext);
