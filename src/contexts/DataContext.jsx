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

  // 필요한 곳에서 데이터를 수정할 수 있도록 함수들도 다 모아줍니다. (App.jsx에서 쓰던 것들)
  // ... (여기에 기존 App.jsx에 있던 handleAddMatch, handleUpdatePlayer 등의 함수를 그대로 복사해 넣어도 됩니다. 일단은 상태 데이터만 공유하도록 설정했습니다.)

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
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

// 3. 쉽게 꺼내 쓰기 위한 커스텀 훅 생성!
export const useData = () => useContext(DataContext);
