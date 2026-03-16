import React, { useState, useEffect, useMemo } from "react";
import { Routes, Route, useNavigate, useParams } from "react-router-dom"; // 🔥 라우팅 훅 추가
import {
  ChevronLeft,
  User,
  Heart,
  BarChart2,
  List,
  Award,
  MessageCircle,
  Search,
  Target,
  Shield,
  Zap,
  Clock,
  Calendar,
} from "lucide-react";
import { query, collection, where, getDocs } from "firebase/firestore";

// ==============================================================================
// 1. 선수 상세 페이지 컴포넌트 (Router로 분리됨)
// ==============================================================================
const PlayerDetail = ({
  players,
  matches = [],
  onUpdatePlayer,
  db,
  match_logs = [],
}) => {
  const { id } = useParams();
  const player = players.find((p) => p.id === id);

  const playerLogs = useMemo(() => {
    if (!player?.name || !match_logs) return [];
    return match_logs
      .filter((log) => log.name === player.name)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [player?.name, match_logs]);

  const isLoadingLogs = false;

  const handleLike = async () => {
    if (!player) return;
    const newLikes = (player.likes || 0) + 1;
    await onUpdatePlayer(player.id, { likes: newLikes });
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentInput.trim() || !player) return;
    const newC = {
      id: Date.now(),
      text: commentInput,
      date: new Date().toLocaleDateString(),
    };
    const updated = [newC, ...(player.comments || [])];
    await onUpdatePlayer(player.id, { comments: updated });
    setCommentInput("");
  };

  const getStatusLabel = (status) => {
    if (status === "graduated" || status === "alumni") return "졸업";
    if (status === "pro_joined") return "취업";
    return "OB";
  };

  const getGroupedType = (typeStr) => {
    if (typeStr.includes("U리그")) return "U리그";
    if (typeStr.includes("왕중왕전")) return "왕중왕전";
    if (typeStr.includes("춘계")) return "춘계대회";
    if (typeStr.includes("추계")) return "추계대회";
    if (typeStr.includes("저학년")) return "저학년대회";
    return "기타";
  };

  const enrichedLogs = useMemo(() => {
    return playerLogs.map((log) => {
      const match = matches.find((m) => m.id === log.matchId);
      const fullType = match ? match.type : log.type || "기타";
      const mainType = getGroupedType(fullType);
      return { ...log, mainType, fullType };
    });
  }, [playerLogs, matches]);

  const uniqueYears = [...new Set(enrichedLogs.map((l) => l.year))]
    .sort()
    .reverse();
  const displayTournaments = [
    "U리그",
    "왕중왕전",
    "춘계대회",
    "추계대회",
    "저학년대회",
  ];

  const isGK = String(player?.position || "")
    .toUpperCase()
    .startsWith("GK");

  const careerTotalApps = enrichedLogs.length;
  const careerTotalMins = enrichedLogs.reduce(
    (a, c) => a + (Number(c.minutes) || 0),
    0,
  );
  const careerTotalGoals = enrichedLogs.reduce(
    (a, c) => a + (Number(c.goals) || 0),
    0,
  );
  const careerTotalAssists = enrichedLogs.reduce(
    (a, c) => a + (Number(c.assists) || 0),
    0,
  );

  // 연도 초기값 세팅
  useEffect(() => {
    if (uniqueYears.length > 0 && !activeLogYear) {
      setActiveLogYear(uniqueYears[0]);
    }
  }, [uniqueYears, activeLogYear]);

  if (!player)
    return (
      <div className="p-10 text-center text-gray-500 font-bold">
        선수 정보를 찾을 수 없습니다.
      </div>
    );

  return (
    <div className="animate-fade-in pb-20 w-full max-w-6xl mx-auto">
      {/* 🔥 [Router 연동] 목록으로 돌아가기 버튼 */}
      <button
        onClick={handleGoBack}
        className="mb-6 flex items-center font-bold text-gray-500 hover:text-ssu-black transition"
      >
        <ChevronLeft className="mr-1" size={20} /> 목록으로 돌아가기
      </button>

      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden border border-gray-100">
        {/* 프로필 Hero 영역 */}
        <div className="flex flex-col md:flex-row bg-linear-to-br from-ssu-dark to-ssu-light text-white relative overflow-hidden">
          <div className="absolute -right-10 -top-10 text-[250px] font-black text-white/3 pointer-events-none select-none tracking-tighter leading-none">
            {player?.number || "-"}
          </div>

          <div className="w-full md:w-7/12 p-8 md:p-12 relative z-20 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-4">
              <span className="bg-ssu-black text-white font-black text-sm px-4 py-1.5 rounded-full tracking-widest">
                {player?.status !== "current"
                  ? player?.profile?.currentTeam ||
                    getStatusLabel(player.status)
                  : player?.position || "미정"}
              </span>
              <button
                onClick={handleLike}
                className="flex items-center gap-2 text-pink-200 hover:scale-110 transition-transform"
              >
                <Heart
                  size={24}
                  fill="currentColor"
                  className="drop-shadow-md"
                />
                <span className="font-black text-lg">{player?.likes || 0}</span>
              </button>
            </div>

            <h2 className="text-5xl md:text-7xl font-black tracking-tight mb-2 flex items-center gap-4">
              {player?.name || "이름 없음"}
              <span className="text-4xl md:text-6xl font-light text-white/30">
                |
              </span>
              <span className="text-ssu-black">{player?.number || "-"}</span>
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mt-8 pt-8 border-t border-white/20">
              <div>
                <p className="text-xs text-ssu-black font-bold mb-1">
                  생년월일
                </p>
                <p className="text-sm md:text-base font-black tracking-wider">
                  {player?.profile?.birthday || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-ssu-black font-bold mb-1">
                  신체조건
                </p>
                <p className="text-sm md:text-base font-black">
                  {player?.profile?.height ? `${player.profile.height}cm` : "-"}{" "}
                  /{" "}
                  {player?.profile?.weight ? `${player.profile.weight}kg` : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-ssu-black font-bold mb-1">
                  출신학교
                </p>
                <p className="text-sm md:text-base font-black">
                  {player?.profile?.highSchool || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-ssu-black font-bold mb-1">MBTI</p>
                <p className="text-sm md:text-base font-black">
                  {player?.profile?.mbti || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-ssu-black font-bold mb-1">
                  {player?.status === "current" ? "학년" : "소속"}
                </p>
                <p className="text-sm md:text-base font-black text-white">
                  {player?.status === "current"
                    ? player?.grade
                      ? `${player.grade}학년`
                      : "-"
                    : player?.profile?.currentTeam || "소속 없음"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 기록 및 정보 영역 */}
        <div className="p-6 md:p-12 space-y-16 bg-gray-50">
          {/* --- [섹션 1] 통산기록 --- */}
          <div>
            <h3 className="text-2xl font-black text-ssu-black mb-6 flex items-center">
              통산 기록{" "}
            </h3>
            <div
              className={`grid gap-4 ${isGK ? "grid-cols-2" : "grid-cols-3"}`}
            >
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                <p className="text-4xl font-black text-ssu-black">
                  {careerTotalApps}
                  <span className="text-lg text-gray-500 ml-1">경기</span>
                </p>
              </div>
              {isGK ? (
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                  <p className="text-4xl font-black text-ssu-black">
                    {careerTotalMins}
                    <span className="text-lg text-gray-500 ml-1">분</span>
                  </p>
                </div>
              ) : (
                <>
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-4xl font-black text-ssu-black">
                      {careerTotalGoals}
                      <span className="text-lg text-gray-500 ml-1">골</span>
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-4xl font-black text-green-600">
                      {careerTotalAssists}
                      <span className="text-lg text-gray-500 ml-1">도움</span>
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* --- [섹션 2] 시즌별 출전 기록 --- */}
          <div>
            <h3 className="text-2xl font-black text-ssu-black mb-6 flex items-center">
              {" "}
              시즌별 출전 기록
            </h3>
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-xs text-center whitespace-nowrap">
                  <thead className="bg-gray-100 text-gray-600 font-black border-b border-gray-200">
                    <tr>
                      <th
                        rowSpan="2"
                        className="py-4 px-5 border-r border-gray-200 sticky left-0 bg-gray-100 z-20"
                      >
                        시즌
                      </th>
                      {displayTournaments.map((t) => (
                        <th
                          colSpan={isGK ? "2" : "4"}
                          key={t}
                          className="py-2 border-r border-gray-200"
                        >
                          {t}
                        </th>
                      ))}
                      <th
                        colSpan={isGK ? "2" : "4"}
                        className="py-2 bg-ssu-black text-white"
                      >
                        통산
                      </th>
                    </tr>
                    <tr className="bg-white border-b border-gray-200 text-[10px]">
                      {displayTournaments.map((t) => (
                        <React.Fragment key={`${t}-sub`}>
                          <th className="py-3 px-2 text-gray-500">경기</th>
                          <th
                            className={`py-3 px-2 text-gray-500 ${isGK ? "border-r border-gray-200" : ""}`}
                          >
                            시간
                          </th>
                          {!isGK && (
                            <th className="py-3 px-2 text-blue-600">득점</th>
                          )}
                          {!isGK && (
                            <th className="py-3 px-2 border-r border-gray-200 text-green-600">
                              도움
                            </th>
                          )}
                        </React.Fragment>
                      ))}
                      <th className="py-3 px-2 bg-gray-50 text-gray-800 border-l border-gray-300">
                        경기
                      </th>
                      <th className="py-3 px-2 bg-gray-50 text-gray-800">
                        시간
                      </th>
                      {!isGK && (
                        <th className="py-3 px-2 bg-gray-50 text-blue-600">
                          득점
                        </th>
                      )}
                      {!isGK && (
                        <th className="py-3 px-2 bg-gray-50 text-green-600">
                          도움
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {isLoadingLogs ? (
                      <tr>
                        <td
                          colSpan="30"
                          className="py-12 text-gray-400 font-bold animate-pulse text-center"
                        >
                          데이터를 불러오는 중입니다...
                        </td>
                      </tr>
                    ) : (
                      uniqueYears.map((year) => {
                        const yearLogs = enrichedLogs.filter(
                          (l) => Number(l.year) === Number(year),
                        );
                        const yApps = yearLogs.length;
                        const yMins = yearLogs.reduce(
                          (a, c) => a + (Number(c.minutes) || 0),
                          0,
                        );
                        const yGoals = yearLogs.reduce(
                          (a, c) => a + (Number(c.goals) || 0),
                          0,
                        );
                        const yAsts = yearLogs.reduce(
                          (a, c) => a + (Number(c.assists) || 0),
                          0,
                        );

                        return (
                          <tr
                            key={year}
                            className="hover:bg-gray-50 transition"
                          >
                            <td className="py-4 px-5 font-black text-ssu-black border-r border-gray-200 sticky left-0 bg-white z-10">
                              {year}
                            </td>
                            {displayTournaments.map((t) => {
                              const tLogs = yearLogs.filter(
                                (l) => l.mainType === t,
                              );
                              const tApps = tLogs.length;
                              const tMins = tLogs.reduce(
                                (a, c) => a + (Number(c.minutes) || 0),
                                0,
                              );
                              const tGoals = tLogs.reduce(
                                (a, c) => a + (Number(c.goals) || 0),
                                0,
                              );
                              const tAsts = tLogs.reduce(
                                (a, c) => a + (Number(c.assists) || 0),
                                0,
                              );
                              return (
                                <React.Fragment key={`${year}-${t}`}>
                                  <td
                                    className={`py-3 px-2 font-bold ${tApps > 0 ? "text-gray-900" : "text-gray-300"}`}
                                  >
                                    {tApps || "-"}
                                  </td>
                                  <td
                                    className={`py-3 px-2 font-medium ${tMins > 0 ? "text-gray-600" : "text-gray-300"} ${isGK ? "border-r border-gray-100" : ""}`}
                                  >
                                    {tMins ? `${tMins}'` : "-"}
                                  </td>
                                  {!isGK && (
                                    <td
                                      className={`py-3 px-2 font-black ${tGoals > 0 ? "text-blue-600" : "text-gray-300"}`}
                                    >
                                      {tGoals || "-"}
                                    </td>
                                  )}
                                  {!isGK && (
                                    <td
                                      className={`py-3 px-2 border-r border-gray-100 font-black ${tAsts > 0 ? "text-green-600" : "text-gray-300"}`}
                                    >
                                      {tAsts || "-"}
                                    </td>
                                  )}
                                </React.Fragment>
                              );
                            })}
                            <td className="py-3 px-2 font-black text-gray-900 bg-gray-50 border-l border-gray-200">
                              {yApps}
                            </td>
                            <td className="py-3 px-2 font-bold text-gray-600 bg-gray-50">
                              {yMins}'
                            </td>
                            {!isGK && (
                              <td className="py-3 px-2 font-black text-blue-600 bg-gray-50">
                                {yGoals}
                              </td>
                            )}
                            {!isGK && (
                              <td className="py-3 px-2 font-black text-green-600 bg-gray-50">
                                {yAsts}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                    {!isLoadingLogs && uniqueYears.length === 0 && (
                      <tr>
                        <td
                          colSpan="30"
                          className="py-16 text-gray-400 font-bold text-center"
                        >
                          등록된 공식 경기 기록이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* --- [섹션 3] 경기별 출전 기록 (드롭다운 -> 상단 탭 형식으로 변경) --- */}
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h3 className="text-2xl font-black text-ssu-black flex items-center">
                {" "}
                경기별 출전 기록
              </h3>

              {/* 🔥 연도 토글 UI (상단 배치 버튼 그룹) */}
              {uniqueYears.length > 0 && (
                <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm overflow-x-auto w-full md:w-auto">
                  {uniqueYears.map((year) => (
                    <button
                      key={year}
                      onClick={() => setActiveLogYear(year)}
                      className={`flex-1 md:flex-none px-6 py-2 rounded-md font-bold text-sm transition-all whitespace-nowrap ${activeLogYear === year ? "bg-ssu-black text-white shadow-sm" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"}`}
                    >
                      {year}년
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {isLoadingLogs ? (
                <div className="text-center py-16 text-gray-400 font-bold">
                  기록을 불러오는 중입니다...
                </div>
              ) : uniqueYears.length === 0 ? (
                <div className="text-center py-16 text-gray-400 font-bold">
                  출전 기록이 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-sm text-center whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200 text-xs">
                      <tr>
                        <th className="py-4 px-6 text-left">일자</th>
                        <th className="py-4 px-4 text-left">대회</th>
                        <th className="py-4 px-4 text-left">상대팀</th>
                        <th className="py-4 px-4">출전상태</th>
                        <th className="py-4 px-4">출전시간</th>
                        {!isGK && <th className="py-4 px-4">득점</th>}
                        {!isGK && <th className="py-4 px-4">도움</th>}
                        <th className="py-4 px-6">MOM</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {enrichedLogs
                        .filter((l) => Number(l.year) === Number(activeLogYear))
                        .map((log, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-blue-50/30 transition text-gray-800"
                          >
                            <td className="py-4 px-6 text-left font-bold">
                              {log.date.slice(5).replace("-", ".")}
                            </td>
                            <td className="py-4 px-4 text-left text-xs font-medium text-gray-500">
                              {log.fullType}
                            </td>
                            <td className="py-4 px-4 text-left font-black text-ssu-black">
                              {log.opponent}
                            </td>
                            <td className="py-4 px-4">
                              <span
                                className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${log.starter === true || log.starter === "선발" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"}`}
                              >
                                {log.starter === true || log.starter === "선발"
                                  ? "선발"
                                  : "교체"}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-bold text-gray-600">
                              {log.minutes ? `${log.minutes}'` : "-"}
                            </td>
                            {!isGK && (
                              <td className="py-4 px-4 font-black text-blue-600">
                                {Number(log.goals) > 0 ? log.goals : "-"}
                              </td>
                            )}
                            {!isGK && (
                              <td className="py-4 px-4 font-black text-green-600">
                                {Number(log.assists) > 0 ? log.assists : "-"}
                              </td>
                            )}
                            <td className="py-4 px-6">
                              {log.mom ? (
                                <Award
                                  size={18}
                                  className="text-[#FFD60A] mx-auto drop-shadow-sm"
                                />
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* --- [섹션 4] 팬 응원 메시지 --- */}
          <div className="pt-8 border-t border-gray-200">
            <h3 className="text-2xl font-black text-ssu-black mb-6 flex items-center">
              응원하기
            </h3>
            <form
              onSubmit={handleComment}
              className="flex flex-row items-center gap-2 mb-8 bg-white p-1.5 md:p-2 pl-5 md:pl-6 rounded-full border border-gray-300 shadow-sm focus-within:border-ssu-black focus-within:ring-2 focus-within:ring-ssu-dark transition-all"
            >
              <input
                className="flex-1 border-none bg-transparent py-2.5 md:py-3 text-sm font-bold focus:ring-0 outline-none text-gray-800 w-full"
                placeholder={`${player?.name || "선수"} 선수에게 응원의 메시지를 남겨주세요!`}
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
              />
              <button
                type="submit"
                className="bg-ssu-dark text-white px-6 md:px-8 py-2.5 md:py-3 rounded-full font-black hover:bg-black transition shadow-md shrink-0 text-sm"
              >
                등록
              </button>
            </form>

            {/* 🔥 모바일 1열 구조 반영 (기존 디자인 유지) */}
            <div className="space-y-3 md:space-y-4 max-h-100 overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
              {(player?.comments || []).map((c) => (
                <div
                  key={c.id}
                  className="bg-white p-4 md:p-5 rounded-2xl border border-gray-100 flex flex-wrap justify-between items-baseline gap-x-4 gap-y-2 shadow-sm hover:shadow-md transition-shadow"
                >
                  <p className="text-sm md:text-base text-gray-800 font-bold leading-relaxed break-keep flex-1 min-w-[60%]">
                    {c.text}
                  </p>
                  <span className="text-[10px] md:text-xs text-gray-400 font-medium whitespace-nowrap text-right">
                    {c.date}
                  </span>
                </div>
              ))}
              {(!player?.comments || player.comments.length === 0) && (
                <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
                  <MessageCircle
                    size={40}
                    className="mx-auto text-gray-200 mb-4"
                  />
                  <p className="text-gray-500 font-bold text-sm md:text-base">
                    첫 번째 응원 메시지의 주인공이 되어보세요!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==============================================================================
// 2. 메인 선수 목록 리스트 컴포넌트
// ==============================================================================
const PlayerList = ({ players }) => {
  const navigate = useNavigate(); // 🔥 상세 페이지 이동을 위한 Router Hook
  const [searchTerm, setSearchTerm] = useState("");
  const [mainTab, setMainTab] = useState("CURRENT"); // 'CURRENT' | 'ALUMNI'
  const [activePosTab, setActivePosTab] = useState("ALL");

  const visiblePlayers = useMemo(() => {
    if (!Array.isArray(players)) return [];
    return players.filter((p) => {
      const pName = p?.name || "";
      if (!pName.includes(searchTerm)) return false;
      if (p?.isHidden) return false;
      return true;
    });
  }, [players, searchTerm]);

  const currentPlayers = visiblePlayers.filter((p) => p?.status === "current");
  const alumniPlayers = visiblePlayers.filter(
    (p) => p?.status && p.status !== "current",
  );

  const groupedCurrent = useMemo(() => {
    const groups = { GK: [], DF: [], MF: [], FW: [] };
    currentPlayers.forEach((p) => {
      const pos = String(p?.position || "MF")
        .substring(0, 2)
        .toUpperCase();
      if (groups[pos]) groups[pos].push(p);
      else groups["MF"].push(p);
    });
    Object.keys(groups).forEach((key) =>
      groups[key].sort(
        (a, b) => (Number(a.number) || 999) - (Number(b.number) || 999),
      ),
    );
    return groups;
  }, [currentPlayers]);

  const groupedByGrade = useMemo(() => {
    const groups = {
      "4학년": [],
      "3학년": [],
      "2학년": [],
      "1학년": [],
      기타: [],
    };
    currentPlayers.forEach((p) => {
      const g = String(p?.grade || "").trim();
      if (g === "4") groups["4학년"].push(p);
      else if (g === "3") groups["3학년"].push(p);
      else if (g === "2") groups["2학년"].push(p);
      else if (g === "1") groups["1학년"].push(p);
      else groups["기타"].push(p);
    });
    Object.keys(groups).forEach((key) =>
      groups[key].sort(
        (a, b) => (Number(a.number) || 999) - (Number(b.number) || 999),
      ),
    );
    return groups;
  }, [currentPlayers]);

  const getStatusLabel = (status) => {
    if (status === "graduated" || status === "alumni") return "졸업";
    if (status === "pro_joined") return "취업";
    return "OB";
  };

  const subTabs = [
    { id: "ALL", label: "전체보기" },
    { id: "FW", label: "FW" },
    { id: "MF", label: "MF" },
    { id: "DF", label: "DF" },
    { id: "GK", label: "GK" },
  ];

  // 🔥 선수 클릭 시 Router를 통해 URL 변경 (/players/선수고유ID)
  const handlePlayerClick = (playerId) => {
    navigate(`/players/${playerId}`);
  };

  const renderPlayerCard = (player) => (
    <div
      key={player.id}
      className="relative h-72 md:h-95 rounded-3xl bg-gray-50 overflow-hidden group cursor-pointer shadow-sm hover:shadow-2xl transition-all duration-500 border border-gray-200"
      onClick={() => handlePlayerClick(player.id)}
    >
      <div className="absolute inset-0 z-10 bg-gray-100">
        {player?.profile?.photo ||
        player?.["profile.photo"] ||
        player?.imageUrl ? (
          <img
            src={
              player.profile?.photo ||
              player["profile.photo"] ||
              player.imageUrl
            }
            className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
            alt={player?.name}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User size={80} className="text-gray-300" />
          </div>
        )}
      </div>

      <div className="absolute inset-0 bg-linear-to-t from-ssu-dark via-ssu-black/30 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-300 z-20"></div>

      <div className="absolute -right-4 -bottom-6 text-[150px] md:text-[220px] font-black text-white/5 group-hover:text-ssu-light/10 transition-colors duration-500 z-20 select-none pointer-events-none">
        {player?.number || "-"}
      </div>

      <div className="absolute bottom-0 left-0 w-full p-6 md:p-8 z-30 flex flex-col justify-end">
        <span className="text-white font-black text-sm md:text-base tracking-widest mb-1">
          {player?.status !== "current"
            ? player?.profile?.currentTeam || getStatusLabel(player?.status)
            : player?.position || "미정"}
        </span>
        <div className="flex items-end justify-between">
          <h4 className="text-white font-black text-3xl md:text-4xl drop-shadow-md tracking-tight">
            {player?.name || "이름 없음"}
          </h4>
          <div className="text-ssu-light font-black text-3xl md:text-4xl drop-shadow-lg">
            {player?.number || "-"}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20 w-full max-w-7xl mx-auto">
      {/* 최상단 대형 메인 탭 */}
      <div className="flex w-full border-b border-gray-200 pt-2">
        <button
          onClick={() => {
            setMainTab("CURRENT");
            setActivePosTab("ALL");
            setSearchTerm("");
          }}
          className={`flex-1 py-2 md:py-2 text-base md:text-l font-black text-center transition-all ${mainTab === "CURRENT" ? "border-b border-ssu-dark text-ssu-dark" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}
        >
          {" "}
          선수단
        </button>
        <button
          onClick={() => {
            setMainTab("ALUMNI");
            setSearchTerm("");
          }}
          className={`flex-1 py-2 md:py-2 text-base md:text-l font-black text-center transition-all ${mainTab === "ALUMNI" ? "border-b border-ssu-dark text-ssu-dark" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}
        >
          {" "}
          졸업 및 취업
        </button>
      </div>

      {/* 🔥 2) 검색 및 포지션 필터 영역 */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-4">
        {/* 검색바 */}
        <div className="relative w-full md:w-80 shrink-0">
          <Search
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            className="w-full pl-12 pr-4 py-3 bg-white rounded-full border border-gray-200 focus:border-ssu-black focus:ring-2 focus:ring-blue-100 outline-none transition text-sm font-bold text-gray-900 shadow-sm"
            placeholder="선수 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* 포지션 서브 탭 (모바일에서는 가로 스크롤) */}
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 custom-scrollbar">
          {mainTab === "CURRENT" &&
            subTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActivePosTab(tab.id)}
                className={`px-5 md:px-6 py-2 md:py-2.5 rounded-full text-xs md:text-sm font-black whitespace-nowrap transition-all duration-200 shrink-0 ${activePosTab === tab.id ? "bg-ssu-blue text-white shadow-md" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}
              >
                {tab.label}
              </button>
            ))}
        </div>
      </div>

      {/* 🔥 3) 메인 리스트 렌더링 */}
      {searchTerm.trim() !== "" ? (
        /* 검색 결과 화면 */
        <div className="animate-fade-in pt-8 border-t border-gray-100">
          <h3 className="text-2xl font-black text-ssu-black mb-6 flex items-center">
            <Search className="mr-2 text-[#FFD60A]" size={28} /> 검색 결과
          </h3>
          {visiblePlayers.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {visiblePlayers.map((player) => renderPlayerCard(player))}
            </div>
          ) : (
            <div className="text-center py-24 text-gray-400 font-bold bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
              선수를 찾을 수 없습니다.
            </div>
          )}
        </div>
      ) : mainTab === "CURRENT" ? (
        /* 재학생 (선수) 화면 */
        <div className="pt-4">
          {activePosTab === "ALL"
            ? ["4학년", "3학년", "2학년", "1학년", "기타"].map((grade) => {
                if (
                  !groupedByGrade[grade] ||
                  groupedByGrade[grade].length === 0
                )
                  return null;
                return (
                  <div key={grade} className="mb-16 animate-fade-in">
                    <h3 className="text-3xl font-black text-ssu-black mb-6 flex items-center">
                      {" "}
                      {grade}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                      {groupedByGrade[grade].map((player) =>
                        renderPlayerCard(player),
                      )}
                    </div>
                  </div>
                );
              })
            : ["FW", "MF", "DF", "GK"].map((pos) => {
                if (activePosTab !== pos) return null;
                if (!groupedCurrent[pos] || groupedCurrent[pos].length === 0)
                  return (
                    <div
                      key={pos}
                      className="text-center py-20 text-gray-400 font-bold bg-white rounded-3xl border border-dashed border-gray-200"
                    >
                      해당 포지션의 선수가 없습니다.
                    </div>
                  );
                return (
                  <div key={pos} className="animate-fade-in">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                      {groupedCurrent[pos].map((player) =>
                        renderPlayerCard(player),
                      )}
                    </div>
                  </div>
                );
              })}
        </div>
      ) : (
        /* 졸업 및 취업 (ALUMNI) 화면 */
        <div className="pt-4 animate-fade-in">
          {alumniPlayers.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {alumniPlayers.map((player) => renderPlayerCard(player))}
            </div>
          ) : (
            <div className="text-center py-24 text-gray-400 font-bold bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
              등록된 선수가 없습니다.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==============================================================================
// 3. 최상위 라우터 연결 컴포넌트
// ==============================================================================
const PlayerSection = ({
  players,
  matches = [],
  onUpdatePlayer,
  db,
  match_logs = [],
}) => {
  return (
    <Routes>
      <Route path="/" element={<PlayerList players={players} />} />
      <Route
        path="/:id"
        element={
          <PlayerDetail
            players={players}
            matches={matches}
            onUpdatePlayer={onUpdatePlayer}
            db={db}
            match_logs={match_logs}
          />
        }
      />
    </Routes>
  );
};

export default PlayerSection;
