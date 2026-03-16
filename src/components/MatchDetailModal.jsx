import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  BarChart2,
  Edit3,
  Target,
  Award,
  Youtube,
  BookOpen,
  Mic,
  Settings,
  Save,
  Plus,
  Trash2,
  Check,
  Users,
  FileText,
} from "lucide-react";
import {
  doc,
  writeBatch,
  query,
  collection,
  where,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { parseScorers, parseAssists } from "../utils";

const MatchDetailModal = ({
  match,
  onClose,
  allMatches = [],
  db,
  players = [],
  match_logs = [],
}) => {
  const currentcurrentMatchLogs = useMemo(() => {
    return match_logs.filter((log) => log.matchId === match.id);
  }, [match.id, match_logs]);
  const [recordPso, setRecordPso] = useState(match?.pso || "");
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editInfo, setEditInfo] = useState({
    time: match?.time || "",
    venue: match?.venue || "",
    youtube: match?.media?.highlight || "",
    blog1: match?.media?.report || "",
    blog2: match?.media?.interview || "",
  });

  const [matchDuration, setMatchDuration] = useState(90);
  const [startingLineup, setStartingLineup] = useState([]);
  const [substitutions, setSubstitutions] = useState([]);
  const [scorers, setScorers] = useState([]);
  const [momId, setMomId] = useState(null);
  const [editingMom, setEditingMom] = useState(false);
  const [selectedMomId, setSelectedMomId] = useState(null);

  // 🔥 [디자인용 추가 상태] 탭 네비게이션용
  const [activeTab, setActiveTab] = useState("summary"); // 'summary', 'lineup', 'admin'

  // ============ 기존 useMemo (수정 안 함) ============
  const currentPlayers = useMemo(
    () =>
      players
        .filter((p) => p.status === "current")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  );

  const bulkRoster = useMemo(() => {
    return currentPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position,
      number: p.number,
    }));
  }, [currentPlayers]);

  const h2h = useMemo(() => {
    const history = allMatches.filter(
      (m) => m.opponent === match.opponent && m.status === "Finished",
    );
    let w = 0,
      d = 0,
      l = 0;
    history.forEach((h) => {
      if (h.homeScore > h.awayScore) w++;
      else if (h.awayScore > h.homeScore) l++;
      else d++;
    });
    return { w, d, l };
  }, [match, allMatches]);

  const currentOnField = useMemo(() => {
    const outIds = substitutions.map((s) => s.outPlayerId);
    const inIds = substitutions.map((s) => s.inPlayerId);
    const startersStill = startingLineup.filter((p) => !outIds.includes(p.id));
    const subsStill = inIds
      .filter((id) => !outIds.includes(id))
      .map((id) => bulkRoster.find((p) => p.id === id))
      .filter(Boolean);
    return [...startersStill, ...subsStill];
  }, [startingLineup, substitutions, bulkRoster]);

  const availableInPlayers = useMemo(() => {
    const onIds = currentOnField.map((p) => p.id);
    return bulkRoster.filter((p) => !onIds.includes(p.id));
  }, [bulkRoster, currentOnField]);

  const participants = useMemo(() => {
    if (match.matchData && match.matchData.startingLineup) {
      const ids = [...match.matchData.startingLineup.map((p) => p.id)];
      (match.matchData.substitutions || []).forEach((s) => {
        if (!ids.includes(s.inPlayerId)) ids.push(s.inPlayerId);
        if (!ids.includes(s.outPlayerId)) ids.push(s.outPlayerId);
      });
      return Array.from(new Set(ids));
    }
    const ids = currentMatchLogs
      .map((l) => players.find((p) => p.name === l.name)?.id)
      .filter(Boolean);
    return Array.from(new Set(ids));
  }, [match, currentMatchLogs, players]);

  // ============ 기존 헬퍼 함수 (수정 안 함) ============
  const getPlayerName = (playerId) =>
    players.find((p) => p.id === playerId)?.name || "";

  const handleAddStartingPlayer = (playerId) => {
    if (!startingLineup.find((p) => p.id === playerId)) {
      const player = bulkRoster.find((p) => p.id === playerId);
      setStartingLineup([...startingLineup, player]);
    }
  };

  const handleRemoveStartingPlayer = (playerId) => {
    setStartingLineup(startingLineup.filter((p) => p.id !== playerId));
  };

  const handleAddSubstitution = (outPlayerId, inPlayerId, minute) => {
    if (outPlayerId && inPlayerId && minute) {
      setSubstitutions([
        ...substitutions,
        { outPlayerId, inPlayerId, minute: Number(minute) },
      ]);
    }
  };

  const handleRemoveSubstitution = (idx) => {
    setSubstitutions(substitutions.filter((_, i) => i !== idx));
  };

  const handleUpdateScorer = (playerId, goals, assists) => {
    const existing = scorers.find((s) => s.playerId === playerId);
    if (existing) {
      setScorers(
        scorers.map((s) =>
          s.playerId === playerId
            ? { ...s, goals: Number(goals) || 0, assists: Number(assists) || 0 }
            : s,
        ),
      );
    } else {
      setScorers([
        ...scorers,
        { playerId, goals: Number(goals) || 0, assists: Number(assists) || 0 },
      ]);
    }
  };

  const handleSaveInfo = async () => {
    const updates = {
      time: editInfo.time,
      venue: editInfo.venue,
      media: {
        highlight: editInfo.youtube,
        report: editInfo.blog1,
        interview: editInfo.blog2,
      },
    };
    await updateDoc(doc(db, "matches", match.id), updates);
    onUpdateMatch(match.id, updates);
    setIsEditingInfo(false);
    alert("수정완료");
  };

  const handleSaveMom = async () => {
    try {
      const momPlayer = players.find((p) => p.id === selectedMomId);
      if (!momPlayer) return;
      await updateDoc(doc(db, "matches", match.id), { mom: momPlayer.name });
      onUpdateMatch(match.id, { mom: momPlayer.name });

      const q = query(
        collection(db, "match_logs"),
        where("matchId", "==", match.id),
      );
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => {
        const data = d.data();
        const isMom = data.name === momPlayer.name;
        batch.update(doc(db, "match_logs", d.id), { mom: isMom });
      });
      await batch.commit();

      setEditingMom(false);
      setSelectedMomId(null);
      alert("MOM 정보가 업데이트되었습니다!");
    } catch (e) {
      alert("MOM 업데이트 실패: " + e.message);
    }
  };

  const handleSaveMatchResult = async () => {
    if (!match) return;
    try {
      const batch = writeBatch(db);
      const matchRef = doc(db, "matches", match.id);

      const scorerList = scorers
        .filter((s) => s.goals > 0)
        .map((s) => {
          const player = bulkRoster.find((p) => p.id === s.playerId);
          return { name: player.name, count: s.goals };
        });

      const assistsList = scorers
        .filter((s) => s.assists > 0)
        .flatMap((s) => {
          const player = bulkRoster.find((p) => p.id === s.playerId);
          return Array(s.assists).fill(player.name);
        });

      const momPlayer = momId ? bulkRoster.find((p) => p.id === momId) : null;

      const matchUpdates = {
        status: "Finished",
        homeScore: recordScore.home,
        awayScore: recordScore.away,
        pso: recordPso.trim() || null,
        scorers: scorerList,
        assists: assistsList,
        mom: momPlayer?.name || "",
        matchData: {
          duration: matchDuration,
          startingLineup: startingLineup.map((p) => ({
            id: p.id,
            name: p.name,
            number: p.number,
            position: p.position,
          })),
          substitutions: substitutions,
          scorers: scorers,
        },
      };

      batch.update(matchRef, matchUpdates);

      const allParticipants = Array.from(
        new Set([
          ...startingLineup.map((p) => p.id),
          ...substitutions.flatMap((s) => [s.inPlayerId, s.outPlayerId]),
        ]),
      );

      allParticipants.forEach((playerId) => {
        const player = bulkRoster.find((p) => p.id === playerId);
        const isStarter = startingLineup.find((p) => p.id === playerId);
        const isSubOut = substitutions.find((s) => s.outPlayerId === playerId);
        const isSubIn = substitutions.find((s) => s.inPlayerId === playerId);

        if (isStarter || isSubIn) {
          const scorer = scorers.find((s) => s.playerId === playerId);
          const logRef = doc(collection(db, "match_logs"));
          const minutes = isStarter
            ? isSubOut
              ? isSubOut.minute
              : matchDuration
            : isSubIn
              ? isSubOut
                ? isSubOut.minute - isSubIn.minute
                : matchDuration - isSubIn.minute
              : 0;

          batch.set(logRef, {
            matchId: match.id,
            name: player.name,
            date: match.date,
            opponent: match.opponent,
            year: parseInt(match.date.split("-")[0]),
            starter: isStarter ? "선발" : "교체",
            minutes: minutes,
            goals: scorer?.goals || 0,
            assists: scorer?.assists || 0,
            mom: momId === playerId,
          });
        }
      });

      await batch.commit();
      onUpdateMatch(match.id, matchUpdates);
      alert("경기 데이터가 저장되었습니다!");
      window.location.reload();
    } catch (e) {
      alert("저장 실패: " + e.message);
    }
  };

  useEffect(() => {
    if (!match?.id) return;
    const fetchLogs = async () => {
      setIsLoadingLogs(true);
      const q = query(
        collection(db, "match_logs"),
        where("matchId", "==", match.id),
      );
      const snap = await getDocs(q);
      setcurrentMatchLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setIsLoadingLogs(false);
    };
    fetchLogs();
  }, [match?.id, db]);

  if (!match) return null;

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 🔥 1. 매치 센터 히어로 배너 (FC서울/경남FC 스타일) */}
        <div className="relative bg-[#001D3D] text-white pt-10 pb-8 px-6 shrink-0 border-b-4 border-[#FFD60A]">
          {/* 백그라운드 워터마크 */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[150px] md:text-[200px] font-black text-white/3 pointer-events-none select-none tracking-tighter w-full text-center">
            MATCH
          </div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/50 hover:text-white bg-black/20 p-2 rounded-full transition-colors z-20"
          >
            <X size={20} />
          </button>

          <div className="relative z-10 flex flex-col items-center">
            <div className="text-[10px] md:text-xs font-bold text-[#FFD60A] tracking-widest border border-[#FFD60A]/30 px-3 py-1 rounded-full mb-6 bg-black/10">
              {match.type}
            </div>

            <div className="flex items-center justify-center w-full max-w-2xl mx-auto">
              {/* Home */}
              <div className="flex flex-col items-center flex-1">
                <span className="text-xl md:text-3xl font-black tracking-tight">
                  숭실대
                </span>
              </div>

              {/* Score */}
              <div className="shrink-0 flex flex-col items-center px-4 md:px-12">
                {match.status === "Finished" ? (
                  <div className="flex items-center gap-3 md:gap-5">
                    <span className="text-5xl md:text-7xl font-black text-white drop-shadow-md">
                      {match.homeScore}
                    </span>
                    <span className="text-2xl md:text-4xl text-[#FFD60A] font-light">
                      :
                    </span>
                    <span className="text-5xl md:text-7xl font-black text-white drop-shadow-md">
                      {match.awayScore}
                    </span>
                  </div>
                ) : (
                  <span className="text-3xl md:text-5xl font-black italic text-gray-400 drop-shadow-sm">
                    VS
                  </span>
                )}
                {match.pso && (
                  <div className="mt-3 text-xs font-bold bg-red-600 text-white px-3 py-1 rounded shadow-sm">
                    PSO {match.pso}
                  </div>
                )}
              </div>

              {/* Away */}
              <div className="flex flex-col items-center flex-1">
                <span className="text-xl md:text-3xl font-black tracking-tight">
                  {match.opponent}
                </span>
              </div>
            </div>

            {/* Meta Info */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 md:gap-8 text-xs font-bold text-blue-200">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} /> {match.date.replace(/-/g, ".")}
              </span>
              {match.time && (
                <span className="flex items-center gap-1.5">
                  <Clock size={14} /> {match.time}
                </span>
              )}
              {match.venue && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} /> {match.venue}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 🔥 2. 탭 네비게이션 */}
        <div className="flex border-b border-gray-200 bg-white shrink-0 shadow-sm relative z-20">
          <button
            onClick={() => setActiveTab("summary")}
            className={`flex-1 py-4 text-sm font-black transition-colors border-b-2 ${activeTab === "summary" ? "text-[#001D3D] border-[#001D3D]" : "text-gray-400 border-transparent hover:text-gray-700"}`}
          >
            MATCH SUMMARY
          </button>
          <button
            onClick={() => setActiveTab("lineup")}
            className={`flex-1 py-4 text-sm font-black transition-colors border-b-2 ${activeTab === "lineup" ? "text-[#001D3D] border-[#001D3D]" : "text-gray-400 border-transparent hover:text-gray-700"}`}
          >
            LINE-UP & RECORDS
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`px-6 py-4 text-sm font-black flex items-center justify-center gap-1.5 transition-colors border-b-2 ${activeTab === "admin" ? "text-red-600 border-red-600 bg-red-50" : "text-blue-600 border-transparent hover:bg-blue-50"}`}
            >
              <Edit3 size={16} /> 관리자 로깅
            </button>
          )}
        </div>

        {/* 🔥 3. 탭별 컨텐츠 영역 */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50 custom-scrollbar relative">
          {/* ======================================================== */}
          {/* TAB 1: SUMMARY (요약 정보) */}
          {/* ======================================================== */}
          {activeTab === "summary" && (
            <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
              {match.status === "Upcoming" ? (
                /* 예정된 경기: 상대 전적 */
                <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm text-center">
                  <h4 className="font-bold text-gray-500 mb-6 text-sm uppercase tracking-widest flex items-center justify-center">
                    <BarChart2 size={18} className="mr-2 text-blue-600" />
                    vs {match.opponent} 상대 전적
                  </h4>
                  <div className="flex justify-center space-x-12 md:space-x-20">
                    <div>
                      <div className="text-5xl font-black text-blue-600 mb-1">
                        {h2h.w}
                      </div>
                      <div className="text-xs font-bold text-gray-400 uppercase">
                        WIN
                      </div>
                    </div>
                    <div>
                      <div className="text-5xl font-black text-gray-300 mb-1">
                        {h2h.d}
                      </div>
                      <div className="text-xs font-bold text-gray-400 uppercase">
                        DRAW
                      </div>
                    </div>
                    <div>
                      <div className="text-5xl font-black text-red-500 mb-1">
                        {h2h.l}
                      </div>
                      <div className="text-xs font-bold text-gray-400 uppercase">
                        LOSS
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* 종료된 경기: 득점 및 MOM */
                <div className="grid md:grid-cols-2 gap-6">
                  {/* 득점자 */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h4 className="font-black text-gray-900 border-b border-gray-100 pb-3 mb-4 flex items-center text-lg">
                      <Target className="mr-2 text-blue-600" size={20} /> 득점
                      정보
                    </h4>
                    {(() => {
                      const scorers_parsed = parseScorers(match.scorers);
                      const assistsList = parseAssists(match.assists);
                      return scorers_parsed.length > 0 ? (
                        <div className="space-y-3">
                          {scorers_parsed.map((scorer, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between items-center bg-blue-50/50 p-3 rounded-xl border border-blue-100/50"
                            >
                              <span className="font-bold text-gray-800">
                                {scorer.name}
                              </span>
                              <span className="text-sm font-black text-white bg-blue-600 px-2.5 py-1 rounded shadow-sm">
                                {scorer.goals} GOAL
                              </span>
                            </div>
                          ))}
                          {assistsList.length > 0 && (
                            <div className="text-xs font-bold text-gray-500 pt-3 mt-3 border-t border-gray-100 flex items-center">
                              <span className="text-green-600 mr-2 bg-green-50 px-2 py-0.5 rounded">
                                도움
                              </span>{" "}
                              {assistsList.join(", ")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm font-bold text-center py-6">
                          득점 기록이 없습니다.
                        </p>
                      );
                    })()}
                  </div>

                  {/* MOM */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col">
                    <h4 className="font-black text-gray-900 border-b border-gray-100 pb-3 mb-4 flex items-center text-lg">
                      <Award className="mr-2 text-yellow-500" size={20} /> Man
                      of the Match
                    </h4>
                    {(() => {
                      const displayMom =
                        match.mom && match.mom !== "-"
                          ? match.mom
                          : currentMatchLogs.find((log) => log.mom)?.name;
                      return (
                        <div className="flex-1 flex flex-col">
                          {displayMom ? (
                            <div className="flex items-center space-x-4 bg-linear-to-r from-yellow-50 to-white p-5 rounded-xl border border-yellow-200 shadow-sm flex-1">
                              <div className="bg-[#FFD60A] text-[#001D3D] p-3 rounded-full shadow-md">
                                <Award size={28} />
                              </div>
                              <div>
                                <div className="text-[10px] text-yellow-600 font-bold uppercase tracking-widest mb-0.5">
                                  최우수 선수
                                </div>
                                <div className="font-black text-2xl text-gray-900">
                                  {displayMom}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm font-bold italic py-6 bg-gray-50 rounded-xl border border-gray-100">
                              MOM 정보가 없습니다.
                            </div>
                          )}

                          {isAdmin && match.status === "Finished" && (
                            <div className="mt-4 pt-4 border-t border-gray-100">
                              <button
                                onClick={() => {
                                  setEditingMom(!editingMom);
                                  setSelectedMomId(null);
                                }}
                                className="w-full text-xs text-gray-600 font-bold hover:text-[#001D3D] transition flex items-center justify-center bg-gray-50 hover:bg-gray-100 py-2.5 rounded-lg border border-gray-200"
                              >
                                {editingMom ? (
                                  "✕ 변경 취소"
                                ) : (
                                  <>
                                    <Edit3 size={14} className="mr-1.5" /> MOM
                                    다시 선택하기
                                  </>
                                )}
                              </button>
                              {editingMom && (
                                <div className="mt-3 flex gap-2 animate-fade-in">
                                  <select
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold bg-white focus:border-yellow-500 outline-none"
                                    value={selectedMomId || ""}
                                    onChange={(e) =>
                                      setSelectedMomId(e.target.value)
                                    }
                                  >
                                    <option value="">선수 선택</option>
                                    {participants.map((id) => {
                                      const p = players.find(
                                        (x) => x.id === id,
                                      );
                                      if (!p) return null;
                                      return (
                                        <option key={id} value={id}>
                                          {p.name}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  <button
                                    disabled={!selectedMomId}
                                    onClick={handleSaveMom}
                                    className="bg-[#001D3D] text-[#FFD60A] px-5 py-2 rounded-lg font-bold hover:bg-black transition disabled:opacity-50"
                                  >
                                    저장
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* 미디어 링크 */}
              {(match.media?.highlight ||
                match.media?.report ||
                match.media?.interview) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  {match.media?.highlight && (
                    <a
                      href={match.media.highlight}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 bg-white text-red-600 p-4 rounded-xl font-bold border border-gray-200 hover:border-red-300 hover:shadow-md transition"
                    >
                      <Youtube size={20} /> 하이라이트 보기
                    </a>
                  )}
                  {match.media?.report && (
                    <a
                      href={match.media.report}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 bg-white text-green-600 p-4 rounded-xl font-bold border border-gray-200 hover:border-green-300 hover:shadow-md transition"
                    >
                      <BookOpen size={20} /> 경기 리뷰 읽기
                    </a>
                  )}
                  {match.media?.interview && (
                    <a
                      href={match.media.interview}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 bg-white text-blue-600 p-4 rounded-xl font-bold border border-gray-200 hover:border-blue-300 hover:shadow-md transition"
                    >
                      <Mic size={20} /> 선수 인터뷰
                    </a>
                  )}
                </div>
              )}

              {/* 관리자: 정보 수정 (기본 정보 및 미디어 링크) */}
              {isAdmin && (
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm mt-8">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-black text-gray-800 flex items-center">
                      <Settings className="mr-2 text-gray-500" size={18} /> 부가
                      정보 및 링크 설정
                    </h4>
                    <button
                      onClick={() => setIsEditingInfo(!isEditingInfo)}
                      className="text-xs bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 transition"
                    >
                      {isEditingInfo ? "닫기" : "수정하기"}
                    </button>
                  </div>
                  {isEditingInfo && (
                    <div className="space-y-5 animate-fade-in border-t border-gray-100 pt-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1.5">
                            킥오프 시간
                          </label>
                          <input
                            type="time"
                            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500"
                            value={editInfo.time}
                            onChange={(e) =>
                              setEditInfo({ ...editInfo, time: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1.5">
                            경기장 장소
                          </label>
                          <input
                            type="text"
                            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500"
                            value={editInfo.venue}
                            onChange={(e) =>
                              setEditInfo({
                                ...editInfo,
                                venue: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1.5">
                            유튜브 하이라이트 URL
                          </label>
                          <input
                            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-red-500"
                            placeholder="https://youtube.com/..."
                            value={editInfo.youtube}
                            onChange={(e) =>
                              setEditInfo({
                                ...editInfo,
                                youtube: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1.5">
                            네이버 블로그 리뷰 URL
                          </label>
                          <input
                            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-green-500"
                            placeholder="https://blog.naver.com/..."
                            value={editInfo.blog1}
                            onChange={(e) =>
                              setEditInfo({
                                ...editInfo,
                                blog1: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1.5">
                            선수 인터뷰 기사 URL
                          </label>
                          <input
                            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500"
                            placeholder="URL 입력"
                            value={editInfo.blog2}
                            onChange={(e) =>
                              setEditInfo({
                                ...editInfo,
                                blog2: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleSaveInfo}
                        className="w-full bg-[#001D3D] text-white font-bold py-3 rounded-lg shadow mt-2 hover:bg-black transition flex items-center justify-center gap-2"
                      >
                        <Save size={18} /> 변경된 정보 저장
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: LINE-UP & RECORDS (명단 및 기록) */}
          {/* ======================================================== */}
          {activeTab === "lineup" && (
            <div className="max-w-5xl mx-auto animate-fade-in">
              {isLoadingLogs ? (
                <div className="text-center py-20 text-gray-400 font-bold">
                  기록을 불러오는 중입니다...
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                    <h4 className="font-black text-gray-900 flex items-center text-lg">
                      <FileText className="mr-2 text-blue-600" size={20} />{" "}
                      선수별 상세 출전 기록
                    </h4>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-center whitespace-nowrap">
                      <thead className="bg-white border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-4 font-bold text-gray-500 text-left">
                            선수명
                          </th>
                          <th className="px-4 py-4 font-bold text-gray-500">
                            구분
                          </th>
                          <th className="px-4 py-4 font-bold text-gray-500">
                            출전시간
                          </th>
                          <th className="px-4 py-4 font-black text-blue-600">
                            득점
                          </th>
                          <th className="px-4 py-4 font-black text-green-600">
                            도움
                          </th>
                          <th className="px-4 py-4 font-black text-yellow-500">
                            MOM
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {currentMatchLogs
                          .sort((a, b) =>
                            a.starter === "선발" || a.starter === true ? -1 : 1,
                          )
                          .map((p, idx) => (
                            <tr
                              key={idx}
                              className={`hover:bg-gray-50 transition-colors ${p.mom ? "bg-yellow-50/20" : ""}`}
                            >
                              <td className="px-6 py-4 font-bold text-gray-900 text-left text-base">
                                {p.name}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`px-3 py-1.5 rounded-md text-[11px] font-black tracking-widest uppercase border ${p.starter === "선발" || p.starter === true ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-gray-500 border-gray-200"}`}
                                >
                                  {p.starter === "선발" || p.starter === true
                                    ? "선발"
                                    : "교체"}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-gray-600 font-medium">
                                {p.minutes}'
                              </td>
                              <td className="px-4 py-4 font-black text-blue-600 text-lg">
                                {p.goals > 0 ? p.goals : "-"}
                              </td>
                              <td className="px-4 py-4 font-black text-green-600 text-lg">
                                {p.assists > 0 ? p.assists : "-"}
                              </td>
                              <td className="px-4 py-4">
                                {p.mom ? (
                                  <Award
                                    size={20}
                                    className="text-yellow-500 mx-auto drop-shadow-sm"
                                  />
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          ))}
                        {currentMatchLogs.length === 0 && (
                          <tr>
                            <td
                              colSpan="6"
                              className="py-20 text-center text-gray-400 font-bold bg-gray-50/50"
                            >
                              등록된 출전 명단이 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: ADMIN RECORD FORM (통합 관리자 폼) */}
          {/* ======================================================== */}
          {activeTab === "admin" && isAdmin && (
            <div className="max-w-4xl mx-auto animate-fade-in space-y-6 pb-10">
              <div className="bg-red-50/50 border border-red-200 p-4 rounded-xl text-red-800 text-sm font-bold flex items-center mb-6">
                <Settings className="mr-2" size={18} /> 관리자 전용 경기 기록
                모드입니다. 1번부터 순서대로 입력 후 맨 아래 저장 버튼을
                눌러주세요.
              </div>

              {/* 1. 최종 스코어 및 시간 */}
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                <h5 className="font-black text-gray-900 mb-6 flex items-center text-lg border-b border-gray-100 pb-3">
                  <span className="w-7 h-7 rounded-lg bg-[#001D3D] text-white flex items-center justify-center text-sm mr-3 shadow-md">
                    1
                  </span>{" "}
                  경기 결과 및 시간
                </h5>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="flex items-center justify-center gap-6 bg-gray-50 p-6 rounded-xl border border-gray-100">
                    <div className="text-center w-24">
                      <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase block mb-2">
                        HOME (숭실)
                      </label>
                      <input
                        type="number"
                        className="w-full text-5xl font-black text-center text-[#001D3D] bg-transparent border-b-2 border-gray-300 focus:border-blue-600 outline-none pb-1 transition"
                        value={recordScore.home}
                        onChange={(e) =>
                          setRecordScore({
                            ...recordScore,
                            home: parseInt(e.target.value),
                          })
                        }
                      />
                    </div>
                    <span className="text-2xl font-light text-gray-300 pt-4">
                      :
                    </span>
                    <div className="text-center w-24">
                      <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase block mb-2">
                        AWAY (상대)
                      </label>
                      <input
                        type="number"
                        className="w-full text-5xl font-black text-center text-gray-800 bg-transparent border-b-2 border-gray-300 focus:border-blue-600 outline-none pb-1 transition"
                        value={recordScore.away}
                        onChange={(e) =>
                          setRecordScore({
                            ...recordScore,
                            away: parseInt(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-2">
                        승부차기 (PSO) 결과
                      </label>
                      <input
                        type="text"
                        placeholder="예: 4:3 (없으면 비워두세요)"
                        className="w-full p-3 border border-gray-300 rounded-xl text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                        value={recordPso}
                        onChange={(e) => setRecordPso(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-2">
                        전체 경기 시간 (기본 90분)
                      </label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          value={matchDuration}
                          onChange={(e) =>
                            setMatchDuration(Number(e.target.value))
                          }
                          className="w-full p-3 border border-gray-300 rounded-l-xl text-sm font-bold text-blue-600 outline-none focus:border-blue-500 bg-blue-50/30"
                        />
                        <span className="bg-gray-100 border border-l-0 border-gray-300 px-4 py-3 rounded-r-xl text-sm font-bold text-gray-500">
                          분
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. 선발 명단 */}
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                <h5 className="font-black text-gray-900 mb-6 flex items-center text-lg border-b border-gray-100 pb-3">
                  <span className="w-7 h-7 rounded-lg bg-[#001D3D] text-white flex items-center justify-center text-sm mr-3 shadow-md">
                    2
                  </span>{" "}
                  선발 라인업 구성
                </h5>

                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 mb-6">
                  <div className="grid grid-cols-1 gap-4">
                    {["FW", "MF", "DF", "GK"].map((pos) => (
                      <div
                        key={pos}
                        className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 border-b border-gray-200/60 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="text-xs font-black text-gray-400 uppercase w-8 shrink-0">
                          {pos}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {bulkRoster
                            .filter((p) => p.position === pos)
                            .map((p) => {
                              const isSelected = startingLineup.find(
                                (s) => s.id === p.id,
                              );
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => handleAddStartingPlayer(p.id)}
                                  disabled={isSelected}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${isSelected ? "bg-blue-600 text-white border-blue-600 shadow-sm opacity-50" : "bg-white text-gray-700 border-gray-300 hover:border-blue-500 hover:text-blue-600"}`}
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

                {/* 선택된 선발 명단 태그 */}
                <div className="min-h-15 bg-white border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-wrap gap-2">
                  {startingLineup.length === 0 ? (
                    <span className="text-sm text-gray-400 font-bold m-auto">
                      위에서 선발 선수를 클릭하여 추가하세요.
                    </span>
                  ) : (
                    startingLineup.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 bg-[#001D3D] text-white rounded-lg pl-3 pr-1 py-1.5 shadow-sm animate-fade-in"
                      >
                        <span className="text-xs font-bold">{p.name}</span>
                        <button
                          onClick={() => handleRemoveStartingPlayer(p.id)}
                          className="p-1 hover:bg-white/20 rounded-md transition text-red-400 hover:text-red-300"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 3. 교체 내역 */}
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                <h5 className="font-black text-gray-900 mb-6 flex items-center text-lg border-b border-gray-100 pb-3">
                  <span className="w-7 h-7 rounded-lg bg-[#001D3D] text-white flex items-center justify-center text-sm mr-3 shadow-md">
                    3
                  </span>{" "}
                  선수 교체 로깅
                </h5>

                <div className="bg-gray-50 p-4 md:p-5 rounded-xl border border-gray-200 mb-6 flex flex-col md:flex-row gap-3">
                  <select
                    id="outPlayer"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      ⬇️ OUT (나간 선수)
                    </option>
                    {currentOnField.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    id="inPlayer"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-green-100 focus:border-green-400"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      ⬆️ IN (들어온 선수)
                    </option>
                    {availableInPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    id="subMinute"
                    placeholder="교체 시간(분)"
                    min="0"
                    max={matchDuration}
                    className="w-full md:w-32 border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-bold text-center outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                  />
                  <button
                    onClick={() => {
                      const outEl = document.getElementById("outPlayer");
                      const inEl = document.getElementById("inPlayer");
                      const minEl = document.getElementById("subMinute");
                      if (outEl.value && inEl.value && minEl.value) {
                        handleAddSubstitution(
                          outEl.value,
                          inEl.value,
                          minEl.value,
                        );
                        outEl.value = "";
                        inEl.value = "";
                        minEl.value = "";
                      }
                    }}
                    className="bg-gray-800 text-white font-bold rounded-lg px-6 py-2.5 text-sm hover:bg-black transition shadow-sm whitespace-nowrap"
                  >
                    추가
                  </button>
                </div>

                <div className="space-y-2">
                  {substitutions.map((sub, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-white border border-gray-200 p-3 md:p-4 rounded-xl shadow-sm animate-fade-in"
                    >
                      <div className="flex items-center flex-wrap gap-2 md:gap-4 text-sm font-bold">
                        <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-md text-xs">
                          {sub.minute}분
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-red-500 flex items-center">
                            <span className="text-[10px] mr-1 border border-red-200 bg-red-50 rounded px-1 text-red-600">
                              OUT
                            </span>
                            {getPlayerName(sub.outPlayerId)}
                          </span>
                          <span className="text-gray-300">▶</span>
                          <span className="text-green-600 flex items-center">
                            <span className="text-[10px] mr-1 border border-green-200 bg-green-50 rounded px-1 text-green-700">
                              IN
                            </span>
                            {getPlayerName(sub.inPlayerId)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveSubstitution(idx)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {substitutions.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">
                      등록된 교체 내역이 없습니다.
                    </p>
                  )}
                </div>
              </div>

              {/* 4. 득점/도움/MOM (통합 카드) */}
              <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm">
                <h5 className="font-black text-gray-900 mb-6 flex items-center text-lg border-b border-gray-100 pb-3">
                  <span className="w-7 h-7 rounded-lg bg-[#001D3D] text-white flex items-center justify-center text-sm mr-3 shadow-md">
                    4
                  </span>{" "}
                  공격 포인트 & MOM
                </h5>

                <div className="overflow-x-auto border border-gray-200 rounded-xl custom-scrollbar">
                  <table className="w-full text-sm text-center whitespace-nowrap">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          선수 (출전 명단)
                        </th>
                        <th className="px-4 py-3 text-blue-600">득점 (골)</th>
                        <th className="px-4 py-3 text-green-600">
                          도움 (어시스트)
                        </th>
                        <th className="px-4 py-3 text-yellow-600">MOM 지정</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {Array.from(
                        new Set([
                          ...startingLineup.map((p) => p.id),
                          ...substitutions.flatMap((s) => [s.inPlayerId]),
                        ]),
                      ).map((playerId) => {
                        const player = bulkRoster.find(
                          (p) => p.id === playerId,
                        );
                        const scorer = scorers.find(
                          (s) => s.playerId === playerId,
                        );
                        const isMom = momId === playerId;
                        return (
                          <tr
                            key={playerId}
                            className={`transition-colors ${isMom ? "bg-yellow-50/30" : "hover:bg-gray-50"}`}
                          >
                            <td className="px-4 py-3 font-bold text-gray-800 text-left">
                              {player.name}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                value={scorer?.goals || ""}
                                onChange={(e) =>
                                  handleUpdateScorer(
                                    playerId,
                                    e.target.value,
                                    scorer?.assists,
                                  )
                                }
                                className="w-16 text-center border border-gray-300 rounded-md py-1.5 font-black text-blue-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                value={scorer?.assists || ""}
                                onChange={(e) =>
                                  handleUpdateScorer(
                                    playerId,
                                    scorer?.goals,
                                    e.target.value,
                                  )
                                }
                                className="w-16 text-center border border-gray-300 rounded-md py-1.5 font-black text-green-600 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-200"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() =>
                                  setMomId(isMom ? null : playerId)
                                }
                                className={`p-2 rounded-full transition-all ${isMom ? "bg-[#FFD60A] text-[#001D3D] shadow-md scale-110" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                              >
                                <Award size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {startingLineup.length === 0 && (
                        <tr>
                          <td
                            colSpan="4"
                            className="py-10 text-gray-400 font-bold bg-gray-50/50"
                          >
                            먼저 선발 라인업을 구성해야 기록을 입력할 수
                            있습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 최종 저장 버튼 */}
              <button
                onClick={handleSaveMatchResult}
                className="w-full bg-[#001D3D] text-[#FFD60A] py-5 rounded-2xl font-black shadow-xl hover:bg-black hover:-translate-y-1 transition-all text-xl flex items-center justify-center gap-2 mt-4 border-2 border-[#001D3D]"
              >
                <Save size={24} /> 입력한 모든 데이터 최종 저장 및 DB 반영
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchDetailModal;
