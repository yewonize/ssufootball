import React, { useState, useMemo, useEffect } from "react";
import {
  Edit3,
  X,
  Award,
  Save,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Shield,
  Target,
  Youtube,
  PlayCircle,
  BookOpen,
  Mic,
} from "lucide-react";
import {
  writeBatch,
  doc,
  collection,
  query,
  where,
  getDocs,
  increment,
} from "firebase/firestore";
import { db } from "../../firebase";

// =====================================================================
// 🧩 하위 컴포넌트: Player Combobox
// =====================================================================
const PlayerCombobox = ({
  players,
  allPlayers,
  value,
  onChange,
  placeholder = "선수 검색...",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const sourceForName = allPlayers || players;
  const selectedPlayer = sourceForName.find((p) => p.id === value);

  useEffect(() => {
    if (selectedPlayer) setSearchTerm(selectedPlayer.name);
    else setSearchTerm("");
  }, [selectedPlayer, value]);

  const filtered = players.filter(
    (p) =>
      p.name.includes(searchTerm) ||
      String(p.number) === searchTerm ||
      String(p.backNumber) === searchTerm,
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();

      if (isOpen && filtered.length > 0) {
        onChange(filtered[0].id);
        setSearchTerm(filtered[0].name);
        setIsOpen(false);
      }

      const focusableElements = Array.from(
        document.querySelectorAll(
          "input:not([disabled]), select:not([disabled]), button.jump-btn",
        ),
      );
      const currentIndex = focusableElements.indexOf(e.target);
      if (currentIndex !== -1 && currentIndex + 1 < focusableElements.length) {
        focusableElements[currentIndex + 1].focus();
      } else {
        e.target.blur();
      }
    }
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold bg-white focus:border-ssu-blue outline-none"
        placeholder={placeholder}
        value={isOpen ? searchTerm : selectedPlayer ? selectedPlayer.name : ""}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        onKeyDown={handleKeyDown}
      />
      {isOpen && filtered.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto custom-scrollbar">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="p-2.5 hover:bg-slate-50 cursor-pointer text-sm font-bold flex items-center gap-2"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(p.id);
                setSearchTerm(p.name);
                setIsOpen(false);
              }}
            >
              <span className="bg-ssu-black text-white text-[10px] px-1.5 py-0.5 rounded">
                {p.number}
              </span>{" "}
              {p.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// =====================================================================
// 🚀 메인 컴포넌트: MatchLogModal
// =====================================================================
const MatchLogModal = ({
  match,
  onClose,
  players,
  matchLogs,
  onUpdateMatch,
}) => {
  const handleEnterJump = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const focusableElements = Array.from(
        document.querySelectorAll(
          "input:not([disabled]), select:not([disabled]), button.jump-btn",
        ),
      );
      const currentIndex = focusableElements.indexOf(e.target);
      if (currentIndex !== -1 && currentIndex + 1 < focusableElements.length) {
        focusableElements[currentIndex + 1].focus();
      } else {
        e.target.blur();
      }
    }
  };

  const currentRoster = useMemo(
    () =>
      players
        .filter((p) => p.status === "current")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  );
  const bulkRoster = useMemo(
    () =>
      currentRoster.map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        number: p.number,
      })),
    [currentRoster],
  );

  const [editingMom, setEditingMom] = useState(false);
  const [selectedMomId, setSelectedMomId] = useState(null);
  const [editMedia, setEditMedia] = useState({
    highlight: "",
    report: "",
    interview: "",
  });

  const [basicInfo, setBasicInfo] = useState({
    ssuScore: match?.homeScore || 0,
    oppScore: match?.awayScore || 0,
    extraTime1: 0,
    extraTime2: 0,
    isPso: !!match?.pso,
    psoScore: match?.pso || "0:0",
  });
  const [starters, setStarters] = useState(
    match?.matchData?.startingLineup || [],
  );
  const [subs, setSubs] = useState(match?.matchData?.substitutions || []);
  const [goals, setGoals] = useState([]);
  const [concedes, setConcedes] = useState([]);
  const [psoData, setPsoData] = useState(
    match?.matchData?.psoData || {
      firstKick: "us",
      ourKickers: [],
      oppKickers: [],
    },
  );
  const [openSection, setOpenSection] = useState("basic");

  useEffect(() => {
    if (!match) return;
    if (match.status === "Finished") {
      setEditMedia({
        highlight: match.media?.highlight || "",
        report: match.media?.report || "",
        interview: match.media?.interview || "",
      });
      setEditingMom(false);
      setSelectedMomId(null);
    } else {
      setBasicInfo({
        ssuScore: match.isHome ? match.homeScore : match.awayScore,
        oppScore: match.isHome ? match.awayScore : match.homeScore,
        extraTime1: 0,
        extraTime2: 0,
        isPso: false,
        psoScore: "0:0",
      });
      setStarters([]);
      setSubs([]);
      setGoals([]);
      setConcedes([]);
      setPsoData({ firstKick: "us", ourKickers: [], oppKickers: [] });
      setOpenSection("basic");
    }
  }, [match]);

  useEffect(() => {
    setGoals((prev) => {
      const n = [...prev];
      while (n.length < basicInfo.ssuScore)
        n.push({
          id: Date.now() + Math.random(),
          minute: "",
          scorer: "",
          assist: "",
          isPk: false,
        });
      if (n.length > basicInfo.ssuScore) n.length = basicInfo.ssuScore;
      return n;
    });
  }, [basicInfo.ssuScore]);

  useEffect(() => {
    setConcedes((prev) => {
      const n = [...prev];
      while (n.length < basicInfo.oppScore)
        n.push({ id: Date.now() + Math.random(), minute: "", gk: "" });
      if (n.length > basicInfo.oppScore) n.length = basicInfo.oppScore;
      return n;
    });
  }, [basicInfo.oppScore]);

  useEffect(() => {
    if (basicInfo.isPso) {
      const ourScore = psoData.ourKickers.filter(
        (k) => k.result === "O",
      ).length;
      const oppScore = psoData.oppKickers.filter(
        (k) => k.result === "O",
      ).length;
      setBasicInfo((prev) => ({
        ...prev,
        psoScore: `${ourScore}:${oppScore}`,
      }));
    }
  }, [psoData, basicInfo.isPso]);

  const toggleSection = (sec) =>
    setOpenSection(openSection === sec ? null : sec);

  const calculateGK = (minute) => {
    if (!minute) return "";
    let currentGk = starters.find((p) => p.position === "GK")?.id || "";
    const sortedSubs = [...subs].sort(
      (a, b) => Number(a.minute) - Number(b.minute),
    );
    for (const s of sortedSubs) {
      if (Number(s.minute) <= Number(minute) && s.outPlayerId === currentGk)
        currentGk = s.inPlayerId;
    }
    return currentGk;
  };

  const outCandidates = useMemo(
    () =>
      bulkRoster.filter(
        (p) =>
          starters.some((s) => s.id === p.id) ||
          subs.some((s) => s.inPlayerId === p.id),
      ),
    [bulkRoster, starters, subs],
  );
  const inCandidates = useMemo(
    () =>
      bulkRoster.filter(
        (p) =>
          !starters.some((s) => s.id === p.id) &&
          !subs.some((s) => s.inPlayerId === p.id),
      ),
    [bulkRoster, starters, subs],
  );

  const participantPlayers = useMemo(() => {
    if (!match) return [];
    const ids = new Set();
    if (match.matchData?.startingLineup) {
      match.matchData.startingLineup.forEach((p) => ids.add(p.id));
      (match.matchData.substitutions || []).forEach((s) => {
        if (s.inPlayerId) ids.add(s.inPlayerId);
        if (s.outPlayerId) ids.add(s.outPlayerId);
      });
    } else if (matchLogs) {
      matchLogs
        .filter((l) => l.matchId === match.id)
        .forEach((l) => {
          const p = players.find((x) => x.name === l.name);
          if (p) ids.add(p.id);
        });
    }
    return Array.from(ids)
      .map((id) => players.find((p) => p.id === id))
      .filter(Boolean);
  }, [match, matchLogs, players]);

  const timelineEvents = useMemo(() => {
    const events = [];
    goals.forEach((g) => {
      if (g.minute && g.scorer)
        events.push({
          min: Number(g.minute),
          type: "goal",
          text: `⚽ 득점: ${bulkRoster.find((p) => p.id === g.scorer)?.name} ${g.isPk ? "(PK)" : ""}`,
        });
    });
    concedes.forEach((c) => {
      if (c.minute)
        events.push({
          min: Number(c.minute),
          type: "concede",
          text: `🥅 실점 (GK: ${bulkRoster.find((p) => p.id === calculateGK(c.minute))?.name || "미상"})`,
        });
    });
    subs.forEach((s) => {
      if (s.minute && s.inPlayerId && s.outPlayerId)
        events.push({
          min: Number(s.minute),
          type: "sub",
          text: `🔄 교체: IN ${bulkRoster.find((p) => p.id === s.inPlayerId)?.name} / OUT ${bulkRoster.find((p) => p.id === s.outPlayerId)?.name}`,
        });
    });
    return events.sort((a, b) => a.min - b.min);
  }, [goals, concedes, subs, bulkRoster, starters]);

  const displayMom = useMemo(() => {
    if (!match) return null;
    if (match.mom && match.mom !== "-") return match.mom;
    const logMom = matchLogs?.find((l) => l.matchId === match.id && l.mom);
    return logMom ? logMom.name : null;
  }, [match, matchLogs]);

  const handleSaveSimpleEdit = async () => {
    try {
      const isMomUpdating = editingMom || !displayMom;
      const newMomPlayer =
        isMomUpdating && selectedMomId
          ? players.find((p) => p.id === selectedMomId)
          : null;

      const finalMomName = newMomPlayer ? newMomPlayer.name : displayMom || "";
      const updates = { media: editMedia };

      if (isMomUpdating) updates.mom = finalMomName;

      const batch = writeBatch(db);
      batch.update(doc(db, "matches", match.id), updates);

      if (isMomUpdating && finalMomName) {
        const yr = String(match.date.split("-")[0]);
        const logsSnap = await getDocs(
          query(collection(db, "match_logs"), where("matchId", "==", match.id)),
        );
        let oldMomPlayerId = null;

        logsSnap.docs.forEach((d) => {
          const logData = d.data();
          const isNewMom = logData.name === finalMomName;
          if (logData.mom === true && !isNewMom)
            oldMomPlayerId = logData.playerId;
          batch.update(doc(db, "match_logs", d.id), { mom: isNewMom });
        });

        if (oldMomPlayerId) {
          batch.update(doc(db, "players", oldMomPlayerId), {
            [`stats.total.mom`]: increment(-1),
            [`stats.years.${yr}.mom`]: increment(-1),
          });
        }
        if (newMomPlayer) {
          batch.update(doc(db, "players", newMomPlayer.id), {
            [`stats.total.mom`]: increment(1),
            [`stats.years.${yr}.mom`]: increment(1),
          });
        }
      }

      await batch.commit();
      onUpdateMatch(match.id, updates);
      alert("성공적으로 업데이트되었습니다!");
      onClose();
    } catch (e) {
      alert("수정 실패: " + e.message);
    }
  };

  const handleSaveFullLogging = async () => {
    if (starters.length !== 11)
      if (
        !window.confirm(
          "선발 라인업이 11명이 아닙니다. 그래도 저장하시겠습니까?",
        )
      )
        return;

    try {
      const batch = writeBatch(db);
      const oldLogsSnap = await getDocs(
        query(collection(db, "match_logs"), where("matchId", "==", match.id)),
      );
      oldLogsSnap.docs.forEach((d) =>
        batch.delete(doc(db, "match_logs", d.id)),
      );

      const playerStats = {};
      const getStats = (id) => {
        if (!playerStats[id])
          playerStats[id] = {
            goals: 0,
            pkGoals: 0,
            assists: 0,
            conceded: 0,
            psoGoals: 0,
            psoSaves: 0,
            minutes: 0,
            isStarter: false,
          };
        return playerStats[id];
      };

      goals.forEach((g) => {
        if (g.scorer) {
          getStats(g.scorer).goals += 1;
          if (g.isPk) getStats(g.scorer).pkGoals += 1;
        }
        if (g.assist && !g.isPk) getStats(g.assist).assists += 1;
      });
      concedes.forEach((c) => {
        const gkId = calculateGK(c.minute);
        if (gkId) getStats(gkId).conceded += 1;
      });

      if (basicInfo.isPso) {
        psoData.ourKickers.forEach((k) => {
          if (k.kickerId && k.result === "O")
            getStats(k.kickerId).psoGoals += 1;
        });
        const finalGkId = calculateGK(120);
        const psoSaves = psoData.oppKickers.filter(
          (k) => k.result === "X",
        ).length;
        if (finalGkId && psoSaves > 0) getStats(finalGkId).psoSaves += psoSaves;
      }

      const matchLength =
        90 +
        Number(basicInfo.extraTime1 || 0) +
        Number(basicInfo.extraTime2 || 0);
      new Set([
        ...starters.map((p) => p.id),
        ...subs.map((s) => s.inPlayerId).filter(Boolean),
      ]).forEach((playerId) => {
        const isStarter = starters.some((p) => p.id === playerId);
        getStats(playerId).isStarter = isStarter;
        let minIn = isStarter ? 0 : null;
        let minOut = matchLength;
        if (!isStarter) {
          const subIn = subs.find((s) => s.inPlayerId === playerId);
          if (subIn) minIn = Number(subIn.minute);
        }
        const subOut = subs.find((s) => s.outPlayerId === playerId);
        if (subOut) minOut = Number(subOut.minute);
        if (minIn !== null)
          getStats(playerId).minutes = Math.max(0, minOut - minIn);
      });

      const matchRef = doc(db, "matches", match.id);
      const matchUpdates = {
        status: "Finished",
        homeScore: match.isHome ? basicInfo.ssuScore : basicInfo.oppScore,
        awayScore: match.isHome ? basicInfo.oppScore : basicInfo.ssuScore,
        pso: basicInfo.isPso ? basicInfo.psoScore : null,
        matchData: {
          extraTime1: basicInfo.extraTime1,
          extraTime2: basicInfo.extraTime2,
          startingLineup: starters,
          substitutions: subs,
          goals,
          concedes,
          psoData: basicInfo.isPso ? psoData : null,
        },
      };
      batch.update(matchRef, matchUpdates);

      const yr = String(match.date.split("-")[0]);
      Object.keys(playerStats).forEach((playerId) => {
        const stats = playerStats[playerId];
        if (stats.minutes === 0 && !stats.isStarter) return;
        const player = players.find((p) => p.id === playerId);
        if (!player) return;

        batch.set(doc(collection(db, "match_logs")), {
          matchId: match.id,
          playerId,
          name: player.name,
          date: match.date,
          opponent: match.opponent,
          year: parseInt(yr),
          starter: stats.isStarter ? "선발" : "교체",
          minutes: stats.minutes,
          goals: stats.goals,
          pkGoals: stats.pkGoals,
          assists: stats.assists,
          conceded: stats.conceded,
        });

        batch.update(doc(db, "players", playerId), {
          [`stats.total.apps`]: increment(1),
          [`stats.total.mins`]: increment(stats.minutes),
          [`stats.total.goals`]: increment(stats.goals),
          [`stats.total.pkGoals`]: increment(stats.pkGoals),
          [`stats.total.assists`]: increment(stats.assists),
          [`stats.total.conceded`]: increment(stats.conceded),
          [`stats.total.psoGoals`]: increment(stats.psoGoals),
          [`stats.total.psoSaves`]: increment(stats.psoSaves),
          [`stats.years.${yr}.apps`]: increment(1),
          [`stats.years.${yr}.mins`]: increment(stats.minutes),
          [`stats.years.${yr}.goals`]: increment(stats.goals),
          [`stats.years.${yr}.pkGoals`]: increment(stats.pkGoals),
          [`stats.years.${yr}.assists`]: increment(stats.assists),
          [`stats.years.${yr}.conceded`]: increment(stats.conceded),
        });
      });

      await batch.commit();
      onUpdateMatch(match.id, matchUpdates);
      alert("경기 데이터가 완벽하게 로깅되었습니다!");
      onClose();
    } catch (error) {
      console.error(error);
      alert("저장 중 오류가 발생했습니다: " + error.message);
    }
  };

  if (!match) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div
        className={`bg-slate-50 rounded-[2rem] shadow-2xl w-full ${match.status === "Finished" ? "max-w-2xl" : "max-w-5xl"} flex flex-col max-h-[90vh] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 공통 헤더 */}
        <div
          className={`text-white p-5 flex justify-between items-center shrink-0 ${match.status === "Finished" ? "bg-green-700" : "bg-ssu-black"}`}
        >
          <div>
            <h3 className="font-black text-xl flex items-center">
              <Edit3 size={20} className="mr-3 text-[#FFD60A]" />
              {match.status === "Finished"
                ? "경기 부가 기록 수정"
                : "경기 로깅 고도화 센터"}
            </h3>
            <p className="text-xs text-white/70 font-bold mt-1 tracking-widest">
              [{match.date}] vs {match.opponent}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white p-2"
          >
            <X size={24} />
          </button>
        </div>

        {match.status === "Finished" ? (
          /* ================= [ 종료된 경기 뷰: MOM / 미디어만 수정 ] ================= */
          <div className="p-6 md:p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
              <h5 className="font-black text-ssu-black border-b border-slate-100 pb-4 mb-6 flex items-center text-lg uppercase tracking-widest">
                <Award className="mr-2 text-[#FFD60A]" size={24} /> Man of the
                Match
              </h5>
              {displayMom && !editingMom ? (
                <div className="animate-fade-in">
                  <div className="flex items-center space-x-6 bg-gradient-to-r from-yellow-50 to-white p-6 rounded-2xl border border-yellow-200 shadow-sm flex-1">
                    <div className="bg-[#FFD60A] text-ssu-black p-4 rounded-2xl shadow-md">
                      <Award size={32} />
                    </div>
                    <div>
                      <div className="text-xs text-yellow-600 font-black uppercase tracking-widest mb-1">
                        현재 지정된 MOM
                      </div>
                      <div className="font-black text-3xl text-ssu-black">
                        {displayMom}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingMom(true)}
                    className="mt-4 w-full text-sm text-slate-500 font-black hover:text-ssu-black transition flex items-center justify-center bg-slate-100 hover:bg-slate-200 py-4 rounded-2xl border border-slate-200"
                  >
                    <Edit3 size={16} className="mr-2" /> MOM 다시 선택하기
                  </button>
                </div>
              ) : (
                <div className="animate-fade-in">
                  {participantPlayers.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      <PlayerCombobox
                        players={participantPlayers}
                        allPlayers={players}
                        placeholder="출전 선수 중 검색 (이름/등번호)"
                        value={selectedMomId}
                        onChange={setSelectedMomId}
                      />
                      {displayMom && (
                        <button
                          type="button"
                          onClick={() => setEditingMom(false)}
                          className="text-xs text-slate-400 hover:text-ssu-black text-right underline font-bold mt-2"
                        >
                          변경 취소
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm font-bold text-red-500 bg-red-50 py-8 text-center rounded-2xl border border-red-100">
                      이 경기에 기록된 출전 선수가 없습니다.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h5 className="font-black text-ssu-black mb-6 flex items-center border-b border-slate-100 pb-4 text-lg uppercase tracking-widest">
                <Youtube className="mr-2 text-red-500" size={24} /> 관련 미디어
                링크 수정
              </h5>
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-black text-slate-500 block mb-2 items-center">
                    <PlayCircle size={16} className="mr-1.5 inline" /> 유튜브
                    하이라이트
                  </label>
                  <input
                    className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-red-500 bg-slate-50 focus:bg-white transition"
                    placeholder="URL 입력"
                    value={editMedia.highlight}
                    onChange={(e) =>
                      setEditMedia({ ...editMedia, highlight: e.target.value })
                    }
                    onKeyDown={handleEnterJump}
                  />
                </div>
                <div>
                  <label className="text-sm font-black text-slate-500 mb-2 flex items-center">
                    <BookOpen size={16} className="mr-1.5 inline" /> 네이버
                    블로그 리뷰
                  </label>
                  <input
                    className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-green-500 bg-slate-50 focus:bg-white transition"
                    placeholder="URL 입력"
                    value={editMedia.report}
                    onChange={(e) =>
                      setEditMedia({ ...editMedia, report: e.target.value })
                    }
                    onKeyDown={handleEnterJump}
                  />
                </div>
                <div>
                  <label className="text-sm font-black text-slate-500 mb-2 flex items-center">
                    <Mic size={16} className="mr-1.5 inline" /> 선수 인터뷰
                    영상/기사
                  </label>
                  <input
                    className="w-full p-4 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-ssu-blue bg-slate-50 focus:bg-white transition"
                    placeholder="URL 입력"
                    value={editMedia.interview}
                    onChange={(e) =>
                      setEditMedia({ ...editMedia, interview: e.target.value })
                    }
                    onKeyDown={handleEnterJump}
                  />
                </div>
              </div>
            </div>
            <button
              onClick={handleSaveSimpleEdit}
              className="w-full bg-green-600 text-white py-5 rounded-2xl font-black shadow-lg hover:bg-green-700 transition-all text-xl flex items-center justify-center gap-2"
            >
              <Save size={24} /> 부가 정보 최종 저장
            </button>
          </div>
        ) : (
          /* ================= [ 예정된 경기 뷰: 풀 로깅 폼 ] ================= */
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* 1. Basic Info */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection("basic")}
                  className="w-full p-4 flex justify-between items-center bg-slate-100/50 hover:bg-slate-100 text-ssu-black font-black text-sm uppercase tracking-widest transition-colors"
                >
                  <span>01. Basic Info</span>{" "}
                  {openSection === "basic" ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </button>
                {openSection === "basic" && (
                  <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 bg-white border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 block mb-1">
                        숭실대 득점
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={basicInfo.ssuScore}
                        onChange={(e) =>
                          setBasicInfo({
                            ...basicInfo,
                            ssuScore: Number(e.target.value),
                          })
                        }
                        className="w-full p-2.5 border rounded-xl text-center font-black text-ssu-blue text-lg outline-none focus:border-ssu-blue"
                        onKeyDown={handleEnterJump}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 block mb-1">
                        상대팀 득점
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={basicInfo.oppScore}
                        onChange={(e) =>
                          setBasicInfo({
                            ...basicInfo,
                            oppScore: Number(e.target.value),
                          })
                        }
                        className="w-full p-2.5 border rounded-xl text-center font-black text-red-500 text-lg outline-none focus:border-red-500"
                        onKeyDown={handleEnterJump}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 block mb-1">
                        전반 추가시간(분)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={basicInfo.extraTime1}
                        onChange={(e) =>
                          setBasicInfo({
                            ...basicInfo,
                            extraTime1: Number(e.target.value),
                          })
                        }
                        className="w-full p-2.5 border rounded-xl text-center font-bold outline-none focus:border-slate-400"
                        onKeyDown={handleEnterJump}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 block mb-1">
                        후반 추가시간(분)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={basicInfo.extraTime2}
                        onChange={(e) =>
                          setBasicInfo({
                            ...basicInfo,
                            extraTime2: Number(e.target.value),
                          })
                        }
                        className="w-full p-2.5 border rounded-xl text-center font-bold outline-none focus:border-slate-400"
                        onKeyDown={handleEnterJump}
                      />
                    </div>

                    <div className="col-span-2 md:col-span-4 flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2">
                      <span className="text-xs font-black text-slate-600">
                        승부차기(PSO) 여부
                      </span>
                      <div className="flex gap-3 items-center">
                        {basicInfo.isPso && (
                          <div className="flex items-center gap-1.5 bg-orange-100/50 px-3 py-1.5 rounded-lg border border-orange-200">
                            <span className="text-[10px] text-orange-500 font-bold uppercase tracking-widest">
                              자동 계산 점수
                            </span>
                            <span className="text-sm font-black text-orange-600">
                              {basicInfo.psoScore}
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() =>
                            setBasicInfo({
                              ...basicInfo,
                              isPso: !basicInfo.isPso,
                            })
                          }
                          className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${basicInfo.isPso ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-500"}`}
                        >
                          {basicInfo.isPso ? "ON" : "OFF"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Starting Lineup */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection("starters")}
                  className="w-full p-4 flex justify-between items-center bg-slate-100/50 hover:bg-slate-100 text-ssu-black font-black text-sm uppercase tracking-widest transition-colors"
                >
                  <span>02. Starting Lineup ({starters.length}/11)</span>{" "}
                  {openSection === "starters" ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </button>
                {openSection === "starters" && (
                  <div className="p-5 bg-white border-t border-slate-100 space-y-4">
                    <div className="grid grid-cols-1 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {["FW", "MF", "DF", "GK"].map((pos) => (
                        <div
                          key={pos}
                          className="flex flex-col md:flex-row md:items-center gap-4 border-b border-slate-200/60 pb-4 last:border-0 last:pb-0"
                        >
                          <div className="text-sm font-black text-slate-400 uppercase w-10 shrink-0">
                            {pos}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {bulkRoster
                              .filter((p) => p.position === pos)
                              .map((p) => {
                                const isSelected = starters.find(
                                  (s) => s.id === p.id,
                                );
                                return (
                                  <button
                                    key={p.id}
                                    onClick={() => {
                                      if (isSelected)
                                        setStarters(
                                          starters.filter((s) => s.id !== p.id),
                                        );
                                      else if (starters.length < 11)
                                        setStarters([...starters, p]);
                                      else
                                        alert(
                                          "선발 라인업은 11명까지만 선택 가능합니다.",
                                        );
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${isSelected ? "bg-ssu-blue text-white border-ssu-blue shadow-md" : "bg-white text-slate-500 border-slate-200 hover:border-ssu-blue"}`}
                                  >
                                    {p.name}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Substitutions */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection("subs")}
                  className="w-full p-4 flex justify-between items-center bg-slate-100/50 hover:bg-slate-100 text-ssu-black font-black text-sm uppercase tracking-widest transition-colors"
                >
                  <span>03. Substitutions</span>{" "}
                  {openSection === "subs" ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </button>
                {openSection === "subs" && (
                  <div className="p-5 bg-white border-t border-slate-100 space-y-4">
                    {subs.map((sub, idx) => (
                      <div
                        key={idx}
                        className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100"
                      >
                        <input
                          type="number"
                          placeholder="Min"
                          className="sub-min-input w-16 p-2.5 border rounded-xl text-center text-xs font-bold outline-none focus:border-ssu-blue"
                          value={sub.minute}
                          onChange={(e) => {
                            const newSubs = [...subs];
                            newSubs[idx].minute = e.target.value;
                            setSubs(newSubs);
                          }}
                          onKeyDown={handleEnterJump}
                        />
                        <PlayerCombobox
                          players={inCandidates}
                          allPlayers={bulkRoster}
                          placeholder="IN Player"
                          value={sub.inPlayerId}
                          onChange={(val) => {
                            const newSubs = [...subs];
                            newSubs[idx].inPlayerId = val;
                            setSubs(newSubs);
                          }}
                        />
                        <PlayerCombobox
                          players={outCandidates}
                          allPlayers={bulkRoster}
                          placeholder="OUT Player"
                          value={sub.outPlayerId}
                          onChange={(val) => {
                            const newSubs = [...subs];
                            newSubs[idx].outPlayerId = val;
                            setSubs(newSubs);
                          }}
                        />
                        <button
                          onClick={() =>
                            setSubs(subs.filter((_, i) => i !== idx))
                          }
                          className="p-2 text-slate-300 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}

                    <button
                      className="jump-btn w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-xs font-black text-slate-400 hover:text-ssu-blue hover:border-ssu-blue transition flex items-center justify-center gap-2 outline-none focus:border-ssu-blue focus:text-ssu-blue focus:bg-blue-50"
                      onClick={() => {
                        setSubs([
                          ...subs,
                          {
                            id: Date.now(),
                            minute: "",
                            inPlayerId: "",
                            outPlayerId: "",
                          },
                        ]);
                        setTimeout(() => {
                          const minInputs =
                            document.querySelectorAll(".sub-min-input");
                          if (minInputs.length > 0)
                            minInputs[minInputs.length - 1].focus();
                        }, 50);
                      }}
                    >
                      <Plus size={16} /> Add Substitution
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Goals */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection("goals")}
                  className="w-full p-4 flex justify-between items-center bg-slate-100/50 hover:bg-slate-100 text-ssu-black font-black text-sm uppercase tracking-widest transition-colors"
                >
                  <span>04. Goals ({goals.length}골)</span>{" "}
                  {openSection === "goals" ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </button>
                {openSection === "goals" && (
                  <div className="p-5 bg-white border-t border-slate-100 space-y-3">
                    {goals.length === 0 && (
                      <p className="text-xs font-bold text-slate-400 text-center py-4">
                        Basic Info에서 숭실대 득점을 올리면 자동으로 생성됩니다.
                      </p>
                    )}
                    {goals.map((g, idx) => (
                      <div
                        key={g.id}
                        className="grid grid-cols-12 gap-2 items-center bg-blue-50/30 p-3 rounded-xl border border-blue-100"
                      >
                        <div className="col-span-2">
                          <input
                            type="number"
                            placeholder="분"
                            className="w-full p-2 border rounded-lg text-center text-xs font-bold outline-none focus:border-ssu-blue"
                            value={g.minute}
                            onChange={(e) => {
                              const n = [...goals];
                              n[idx].minute = e.target.value;
                              setGoals(n);
                            }}
                            onKeyDown={handleEnterJump}
                          />
                        </div>
                        <div className="col-span-4">
                          <PlayerCombobox
                            players={bulkRoster}
                            allPlayers={bulkRoster}
                            placeholder="득점자"
                            value={g.scorer}
                            onChange={(val) => {
                              const n = [...goals];
                              n[idx].scorer = val;
                              setGoals(n);
                            }}
                          />
                        </div>
                        <div className="col-span-4">
                          {!g.isPk ? (
                            <PlayerCombobox
                              players={bulkRoster}
                              allPlayers={bulkRoster}
                              placeholder="도움자"
                              value={g.assist}
                              onChange={(val) => {
                                const n = [...goals];
                                n[idx].assist = val;
                                setGoals(n);
                              }}
                            />
                          ) : (
                            <div className="w-full p-2.5 border rounded-xl text-center text-xs font-bold bg-slate-100 text-slate-400 cursor-not-allowed">
                              PK 득점
                            </div>
                          )}
                        </div>
                        <div className="col-span-2 flex items-center justify-center gap-1">
                          <input
                            type="checkbox"
                            checked={g.isPk}
                            onChange={(e) => {
                              const n = [...goals];
                              n[idx].isPk = e.target.checked;
                              if (e.target.checked) n[idx].assist = "";
                              setGoals(n);
                            }}
                            className="w-4 h-4 cursor-pointer"
                          />
                          <span className="text-[10px] font-black text-slate-500">
                            PK
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Concedes */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection("concedes")}
                  className="w-full p-4 flex justify-between items-center bg-slate-100/50 hover:bg-slate-100 text-ssu-black font-black text-sm uppercase tracking-widest transition-colors"
                >
                  <span>05. Concedes ({concedes.length}실점)</span>{" "}
                  {openSection === "concedes" ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </button>
                {openSection === "concedes" && (
                  <div className="p-5 bg-white border-t border-slate-100 space-y-3">
                    {concedes.length === 0 && (
                      <p className="text-xs font-bold text-slate-400 text-center py-4">
                        상대팀 득점을 올리면 자동으로 생성됩니다.
                      </p>
                    )}
                    {concedes.map((c, idx) => {
                      const autoGkId = calculateGK(c.minute);
                      const autoGkName =
                        bulkRoster.find((p) => p.id === autoGkId)?.name ||
                        "입력필요";
                      return (
                        <div
                          key={c.id}
                          className="flex gap-3 items-center bg-red-50/30 p-3 rounded-xl border border-red-100"
                        >
                          <input
                            type="number"
                            placeholder="실점 분"
                            className="w-20 p-2 border rounded-lg text-center text-xs font-bold outline-none focus:border-red-500"
                            value={c.minute}
                            onChange={(e) => {
                              const n = [...concedes];
                              n[idx].minute = e.target.value;
                              setConcedes(n);
                            }}
                            onKeyDown={handleEnterJump}
                          />
                          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-600">
                            <Shield size={14} className="text-purple-500" />{" "}
                            자동지정 GK:{" "}
                            <span className="text-ssu-black font-black">
                              {autoGkName}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 6. Penalty Shootout (PSO) */}
              {basicInfo.isPso && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden border-orange-200">
                  <button
                    onClick={() => toggleSection("pso")}
                    className="w-full p-4 flex justify-between items-center bg-orange-50 text-orange-600 font-black text-sm uppercase tracking-widest transition-colors"
                  >
                    <span>06. 승부차기</span>{" "}
                    {openSection === "pso" ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </button>
                  {openSection === "pso" && (
                    <div className="p-5 bg-white border-t border-orange-100 space-y-6">
                      <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <span className="text-sm font-black text-ssu-black">
                          선축
                        </span>
                        <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                          <button
                            onClick={() =>
                              setPsoData({ ...psoData, firstKick: "us" })
                            }
                            className={`px-4 py-1.5 rounded-md text-xs font-black transition ${psoData.firstKick === "us" ? "bg-ssu-blue text-white shadow-sm" : "text-slate-400 hover:text-ssu-black"}`}
                          >
                            숭실대
                          </button>
                          <button
                            onClick={() =>
                              setPsoData({ ...psoData, firstKick: "them" })
                            }
                            className={`px-4 py-1.5 rounded-md text-xs font-black transition ${psoData.firstKick === "them" ? "bg-red-500 text-white shadow-sm" : "text-slate-400 hover:text-ssu-black"}`}
                          >
                            상대팀
                          </button>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h6 className="font-black text-ssu-blue flex items-center border-b border-slate-100 pb-2">
                            <Shield size={16} className="mr-2" />
                            숭실대
                          </h6>
                          {psoData.ourKickers.map((k, idx) => (
                            <div
                              key={idx}
                              className="flex gap-2 items-center bg-blue-50/30 p-2 rounded-xl border border-blue-100"
                            >
                              <span className="w-6 text-center text-xs font-black text-slate-400">
                                {idx + 1}
                              </span>
                              <PlayerCombobox
                                players={bulkRoster}
                                allPlayers={bulkRoster}
                                placeholder="선수 검색"
                                value={k.kickerId}
                                onChange={(val) => {
                                  const n = [...psoData.ourKickers];
                                  n[idx].kickerId = val;
                                  setPsoData({ ...psoData, ourKickers: n });
                                }}
                              />
                              <select
                                className="p-2.5 border rounded-xl text-xs font-black bg-white outline-none focus:border-ssu-blue"
                                value={k.result}
                                onChange={(e) => {
                                  const n = [...psoData.ourKickers];
                                  n[idx].result = e.target.value;
                                  setPsoData({ ...psoData, ourKickers: n });
                                }}
                                onKeyDown={handleEnterJump}
                              >
                                <option value="O">성공</option>
                                <option value="X">실패</option>
                              </select>
                              <button
                                onClick={() =>
                                  setPsoData({
                                    ...psoData,
                                    ourKickers: psoData.ourKickers.filter(
                                      (_, i) => i !== idx,
                                    ),
                                  })
                                }
                                className="p-2 text-slate-300 hover:text-red-500"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                          <button
                            className="jump-btn w-full py-2.5 border border-dashed border-blue-200 rounded-xl text-xs font-black text-blue-400 hover:bg-blue-50 transition flex items-center justify-center gap-1 outline-none focus:border-ssu-blue focus:text-ssu-blue"
                            onClick={() =>
                              setPsoData({
                                ...psoData,
                                ourKickers: [
                                  ...psoData.ourKickers,
                                  { kickerId: "", result: "O" },
                                ],
                              })
                            }
                          >
                            <Plus size={14} />
                            추가
                          </button>
                        </div>

                        <div className="space-y-3">
                          <h6 className="font-black text-red-500 flex items-center border-b border-slate-100 pb-2">
                            <Target size={16} className="mr-2" />
                            상대팀
                          </h6>
                          {psoData.oppKickers.map((k, idx) => (
                            <div
                              key={idx}
                              className="flex gap-2 items-center bg-red-50/30 p-2 rounded-xl border border-red-100"
                            >
                              <span className="w-6 text-center text-xs font-black text-slate-400">
                                {idx + 1}
                              </span>
                              <select
                                className="w-full p-2.5 border rounded-xl text-xs font-black bg-white outline-none focus:border-red-500"
                                value={k.result}
                                onChange={(e) => {
                                  const n = [...psoData.oppKickers];
                                  n[idx].result = e.target.value;
                                  setPsoData({ ...psoData, oppKickers: n });
                                }}
                                onKeyDown={handleEnterJump}
                              >
                                <option value="O">실점</option>
                                <option value="X">선방</option>
                              </select>
                              <button
                                onClick={() =>
                                  setPsoData({
                                    ...psoData,
                                    oppKickers: psoData.oppKickers.filter(
                                      (_, i) => i !== idx,
                                    ),
                                  })
                                }
                                className="p-2 text-slate-300 hover:text-red-500"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                          <button
                            className="jump-btn w-full py-2.5 border border-dashed border-red-200 rounded-xl text-xs font-black text-red-400 hover:bg-red-50 transition flex items-center justify-center gap-1 outline-none focus:border-red-500 focus:text-red-500"
                            onClick={() =>
                              setPsoData({
                                ...psoData,
                                oppKickers: [
                                  ...psoData.oppKickers,
                                  { result: "O" },
                                ],
                              })
                            }
                          >
                            <Plus size={14} /> 추가
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 오른쪽: 타임라인 프리뷰 & 저장 */}
            <div className="lg:col-span-1 space-y-4 flex flex-col h-full">
              <div className="bg-ssu-black rounded-2xl p-5 flex flex-col flex-1 max-h-[60vh] overflow-hidden shadow-lg">
                <h4 className="text-[#FFD60A] font-black text-sm uppercase tracking-widest flex items-center gap-2 mb-4 pb-4 border-b border-white/10 shrink-0">
                  <Target size={16} /> 07. Timeline Preview
                </h4>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                  {timelineEvents.length === 0 ? (
                    <p className="text-xs text-white/40 text-center mt-10 font-bold">
                      기록된 이벤트가 없습니다.
                    </p>
                  ) : (
                    timelineEvents.map((ev, i) => (
                      <div key={i} className="flex gap-3 text-white text-sm">
                        <span className="font-black text-[#FFD60A] w-6 shrink-0 text-right">
                          {ev.min}'
                        </span>
                        <span className="font-medium text-white/90">
                          {ev.text}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <button
                onClick={handleSaveFullLogging}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-black py-5 rounded-2xl shadow-xl transition-colors flex justify-center items-center gap-2 text-lg shrink-0"
              >
                <Save size={24} /> 최종 기록 저장
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchLogModal;
