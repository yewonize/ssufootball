import React, { useState, useMemo, useEffect } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Trophy,
  Star,
  Target,
  Zap,
  User,
  ChevronRight,
  ChevronLeft,
  Filter,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { calculatePlayerRankings } from "../utils";

const MatchSchedule = ({
  matches = [],
  players = [],
  league = [],
  match_logs = [],
  onMatchClick,
}) => {
  const location = useLocation();
  // 1. 상태 관리
  const [activeTab, setActiveTab] = useState("schedule"); // 'schedule' | 'rankings'
  const [rankingSubTab, setRankingSubTab] = useState("league");
  const [filterYear, setFilterYear] = useState("2026"); // 기본값을 2026으로 설정
  const [filterOpponent, setFilterOpponent] = useState("All");
  const [filterType, setFilterType] = useState("All");

  useEffect(() => {
    if (location.state) {
      if (location.state.targetTab) {
        setActiveTab(location.state.targetTab); // 'rankings' 탭으로 전환
      }
      if (location.state.targetSubTab) {
        setRankingSubTab(location.state.targetSubTab); // 'league' 또는 'player' 탭으로 전환
      }

      // 편지를 읽었으니 주소창 기록에서 편지를 지움 (새로고침 시 방지)
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // 🔴 [추가] 어떤 기준으로(key), 어떤 방향으로(direction) 정렬할지 기억하는 상태
  const [sortConfig, setSortConfig] = useState({
    key: "points",
    direction: "desc",
  });

  // 🔴 [추가] 표의 헤더를 클릭했을 때 실행되는 정렬 함수
  const requestSort = (key) => {
    let direction = "desc"; // 기본은 높은 순(내림차순)
    // 이미 누른 버튼을 또 누르면 오름차순/내림차순 반전
    if (sortConfig.key === key && sortConfig.direction === "desc") {
      direction = "asc";
    }
    setSortConfig({ key, direction });
  };

  // 탭 변경 시 '순위·기록' 탭에서 "All"이 선택되어 있다면 최신 연도로 강제 변경
  useEffect(() => {
    if (filterYear === "All") {
      setFilterYear("2026");
    }
  }, [activeTab, filterYear]);

  // 2. 공통 데이터 가공
  const allYears = useMemo(
    () =>
      [...new Set(matches.map((m) => m.year.toString()))].sort((a, b) => b - a),
    [matches],
  );

  const opponents = useMemo(
    () => [...new Set(matches.map((m) => m.opponent))].sort(),
    [matches],
  );
  const types = useMemo(
    () =>
      [
        ...new Set(
          matches.map((m) => (m.type ? m.type.split(" ")[0] : "기타")),
        ),
      ].sort(),
    [matches],
  );

  // 3. 일정/결과 필터링
  const filteredMatches = useMemo(() => {
    return matches
      .filter((m) => filterYear === "All" || m.year.toString() === filterYear)
      .filter((m) => filterOpponent === "All" || m.opponent === filterOpponent)
      .filter(
        (m) => filterType === "All" || (m.type && m.type.includes(filterType)),
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [matches, filterYear, filterOpponent, filterType]);

  // 4. 🔥 [선수 순위] 숫자형 year 타입에 맞춘 최적화 로직 + 동적 정렬 적용
  const playerRankings = useMemo(() => {
    const isAll =
      String(filterYear).toUpperCase() === "ALL" || filterYear === "전체";
    // Dashboard와 연도 로직 통일
    const targetY = isAll
      ? Math.max(...matches.map((m) => Number(m.year)))
      : Number(filterYear);

    const baseRankings = calculatePlayerRankings(match_logs, players, targetY);

    // 사용자가 선택한 정렬 기준(sortConfig) 적용
    return [...baseRankings].sort((a, b) => {
      const { key, direction } = sortConfig;
      const modifier = direction === "asc" ? 1 : -1;

      if (a[key] < b[key]) return -1 * modifier;
      if (a[key] > b[key]) return 1 * modifier;

      // 동점자 처리 로직 (공통 정렬 기준 재적용)
      return b.points - a.points || b.goals - a.goals;
    });
  }, [match_logs, players, filterYear, sortConfig, matches]);

  // 5. TOP 1 데이터 (캐러셀용)
  const topStats = useMemo(
    () => [
      {
        label: "최다 득점",
        key: "goals",
        unit: "G",
        icon: <Target size={18} />,
        color: "text-red-500",
        bg: "bg-red-50",
      },
      {
        label: "최다 도움",
        key: "assists",
        unit: "A",
        icon: <Zap size={18} />,
        color: "text-yellow-500",
        bg: "bg-yellow-50",
      },
      {
        label: "최다 출장",
        key: "apps",
        unit: "Match",
        icon: <User size={18} />,
        color: "text-blue-500",
        bg: "bg-blue-50",
      },
      {
        label: "최다 시간",
        key: "mins",
        unit: "Min",
        icon: <Clock size={18} />,
        color: "text-ssu-blue",
        bg: "bg-ssu-blue/10",
      },
    ],
    [],
  );

  // 6. 리그 순위 가공 (무적의 연도 필터링)
  const sortedLeague = useMemo(() => {
    // 🔥 'ALL', 'All', '전체' 등 필터값이 어떻게 들어오든 무조건 기본 연도로 치환합니다.
    const isAll = filterYear.toUpperCase() === "ALL" || filterYear === "전체";
    const targetY = isAll ? "2026" : String(filterYear);

    const teams = new Set(["숭실대"]);

    matches.forEach((m) => {
      const mYear = m.year
        ? String(m.year)
        : m.date
          ? m.date.split("-")[0]
          : "";
      if (m.type?.includes("U리그") && mYear === targetY && m.opponent) {
        teams.add(m.opponent.trim());
      }
    });

    const combined = Array.from(teams).map((tName) => {
      const dbRecord =
        league.find((t) => {
          // DB에 연도 값이 없는 옛날 데이터면 무조건 '2026'으로 간주
          const dbYear = t.year ? String(t.year) : "2026";
          return t.team?.trim() === tName && dbYear === targetY;
        }) || {};

      const w = Number(dbRecord.w) || 0;
      const d = Number(dbRecord.d) || 0;
      const l = Number(dbRecord.l) || 0;
      const gd = Number(dbRecord.gd) || 0;

      return {
        team: tName,
        w,
        d,
        l,
        gd,
        played: w + d + l,
        pts: w * 3 + d * 1,
      };
    });

    return combined
      .sort((a, b) => (b.pts !== a.pts ? b.pts - a.pts : b.gd - a.gd))
      .map((t, i) => ({ ...t, rank: i + 1 }));
  }, [matches, league, filterYear]);

  return (
    <div className="animate-fade-in pb-20 max-w-6xl mx-auto">
      {/* 🟢 [PART 1] 메인 탭: 헤더와 연결되는 디자인 (상단 여백 제거 및 배경 일치) */}
      <div className="flex w-full border-b border-gray-200 bg-white sticky top-16 z-40">
        <button
          onClick={() => setActiveTab("schedule")}
          className={`flex-1 py-4 text-base md:text-lg font-black text-center transition-all ${
            activeTab === "schedule"
              ? "border-b-4 border-ssu-dark text-ssu-dark bg-ssu-blue/5"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
          }`}
        >
          일정·결과
        </button>
        <button
          onClick={() => setActiveTab("rankings")}
          className={`flex-1 py-4 text-base md:text-lg font-black text-center transition-all ${
            activeTab === "rankings"
              ? "border-b-4 border-ssu-dark text-ssu-dark bg-ssu-blue/5"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
          }`}
        >
          순위·기록
        </button>
      </div>

      <div className="px-1 mt-6 space-y-6">
        {activeTab === "schedule" ? (
          /* --- 일정·결과 컨텐츠 --- */
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center sticky top-31.25 z-30">
              <select
                className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-ssu-blue"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <option value="All">전체 연도</option>
                {allYears.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
              <select
                className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-ssu-blue"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="All">대회 전체</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                className="border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-ssu-blue"
                value={filterOpponent}
                onChange={(e) => setFilterOpponent(e.target.value)}
              >
                <option value="All">상대팀 전체</option>
                {opponents.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col border-t-2 border-ssu-dark bg-white rounded-b-3xl overflow-hidden shadow-sm">
              {filteredMatches.map((match) => (
                <div
                  key={match.id}
                  onClick={() => onMatchClick(match)}
                  className="group flex flex-col md:flex-row items-center justify-between p-6 md:p-8 border-b border-gray-100 cursor-pointer hover:bg-ssu-blue/5 transition-all"
                >
                  <div className="w-full md:w-48 shrink-0 flex flex-row md:flex-col justify-between items-center md:items-start">
                    <span
                      className={`text-[10px] font-black px-3 py-1 rounded-full tracking-widest uppercase ${match.status === "Finished" ? "bg-gray-800 text-white" : "bg-ssu-blue text-white"}`}
                    >
                      {match.status === "Finished" ? "종료" : "예정"}
                    </span>
                    <div className="text-xl font-black text-ssu-dark mt-0 md:mt-2">
                      {match.date.replace(/-/g, ".")}
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-center w-full max-w-2xl py-4 md:py-0">
                    <div className="flex-1 text-right text-xl md:text-3xl font-black text-ssu-dark">
                      {match.isHome ? "숭실대" : match.opponent}
                    </div>
                    <div className="px-8 md:px-14 text-center">
                      {match.status === "Finished" ? (
                        <div className="flex items-center gap-4 text-4xl md:text-5xl font-black">
                          <span
                            className={
                              match.isHome ? "text-ssu-blue" : "text-gray-800"
                            }
                          >
                            {match.homeScore}
                          </span>
                          <span className="text-gray-200 font-light">:</span>
                          <span
                            className={
                              !match.isHome ? "text-ssu-blue" : "text-gray-800"
                            }
                          >
                            {match.awayScore}
                          </span>
                        </div>
                      ) : (
                        <span className="text-2xl font-black italic text-gray-200 tracking-widest">
                          VS
                        </span>
                      )}
                    </div>
                    <div className="flex-1 text-left text-xl md:text-3xl font-black text-ssu-dark">
                      {!match.isHome ? "숭실대" : match.opponent}
                    </div>
                  </div>
                  <div className="w-full md:w-56 text-xs font-bold text-gray-400 flex flex-row md:flex-col justify-between md:items-end">
                    <div className="flex items-center">
                      <Clock size={14} className="mr-1 text-ssu-blue" />{" "}
                      {match.time}
                    </div>
                    <div className="flex items-center">
                      <MapPin size={14} className="mr-1 text-ssu-blue" />{" "}
                      {match.venue}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* --- 순위·기록 컨텐츠 --- */
          <div className="space-y-8 animate-fade-in">
            {/* 서브 탭 (언더라인) */}
            <div className="flex w-full border-b border-gray-100 mb-6">
              <button
                onClick={() => setRankingSubTab("league")}
                className={`flex-1 py-3 text-sm font-black transition-all ${rankingSubTab === "league" ? "border-b-2 border-ssu-blue text-ssu-blue" : "text-gray-400 hover:text-gray-600"}`}
              >
                리그 순위
              </button>
              <button
                onClick={() => setRankingSubTab("player")}
                className={`flex-1 py-3 text-sm font-black transition-all ${rankingSubTab === "player" ? "border-b-2 border-ssu-blue text-ssu-blue" : "text-gray-400 hover:text-gray-600"}`}
              >
                선수 순위
              </button>
            </div>

            {/* 🔥 선수 순위일 때만 나타나는 캐러셀 */}
            {rankingSubTab === "player" && (
              <div className="relative group">
                <div
                  id="stats-carousel"
                  className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 custom-scrollbar scroll-smooth"
                >
                  {topStats.map((s, i) => {
                    const sorted = [...playerRankings].sort(
                      (a, b) => b[s.key] - a[s.key],
                    );
                    const top = sorted[0];
                    return (
                      <div
                        key={i}
                        className="min-w-[80%] md:min-w-[calc(25%-12px)] snap-center bg-white p-6 rounded-4xl border border-gray-100 shadow-sm flex items-center gap-5"
                      >
                        <div
                          className={`w-14 h-14 rounded-2xl ${s.bg} ${s.color} flex items-center justify-center shrink-0 shadow-inner`}
                        >
                          {s.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">
                            {s.label}
                          </p>
                          <p className={`text-2xl font-black ${s.color}`}>
                            {top ? top[s.key] : 0}
                            <span className="text-xs ml-0.5 opacity-60">
                              {s.unit}
                            </span>
                          </p>
                          <p className="text-xs font-bold text-gray-600 mt-1 truncate">
                            {top?.name || "기록 없음"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() =>
                    document
                      .getElementById("stats-carousel")
                      .scrollBy({ left: -300, behavior: "smooth" })
                  }
                  className="hidden md:flex absolute -left-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-white border border-gray-100 rounded-full items-center justify-center shadow-lg text-gray-400 hover:text-ssu-blue transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() =>
                    document
                      .getElementById("stats-carousel")
                      .scrollBy({ left: 300, behavior: "smooth" })
                  }
                  className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 w-10 h-10 bg-white border border-gray-100 rounded-full items-center justify-center shadow-lg text-gray-400 hover:text-ssu-blue transition-all opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}

            <div className="bg-white rounded-[2.5rem] border border-gray-100 overflow-hidden shadow-sm">
              <div className="p-6 border-b border-gray-50 flex justify-end">
                <div className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-xl">
                  <span className="text-[10px] font-black text-gray-400 uppercase">
                    Season
                  </span>
                  <select
                    className="bg-transparent border-none text-xs font-black outline-none cursor-pointer"
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                  >
                    {/* 순위 기록 탭에서는 "All"을 제외한 연도만 출력 */}
                    {allYears.map((y) => (
                      <option key={y} value={y}>
                        {y}년
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                {rankingSubTab === "league" ? (
                  <table className="w-full text-sm text-center whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-400 font-black border-b border-gray-100 uppercase tracking-tighter">
                      <tr>
                        <th className="py-4 px-2">순위</th>
                        <th className="text-left px-4">팀명</th>
                        <th>경기</th>
                        <th>승</th>
                        <th>무</th>
                        <th>패</th>
                        <th>득실차</th>
                        <th className="text-ssu-blue">승점</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sortedLeague.map((row) => (
                        <tr
                          key={row.team}
                          className={
                            row.team.includes("숭실")
                              ? "bg-ssu-blue/5 text-ssu-dark font-black border-l-4 border-ssu-blue"
                              : "text-gray-600"
                          }
                        >
                          <td className="py-5 font-black">{row.rank}</td>
                          <td className="text-left px-4 font-black">
                            {row.team}
                          </td>
                          <td className="py-5 font-bold">{row.played}</td>
                          <td className="py-5">{row.w}</td>
                          <td className="py-5">{row.d}</td>
                          <td className="py-5">{row.l}</td>
                          <td className="py-5 font-bold">
                            {row.gd > 0 ? `+${row.gd}` : row.gd}
                          </td>
                          <td className="py-5 font-black text-ssu-blue text-lg">
                            {row.pts}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-sm text-center whitespace-nowrap">
                    <thead className="bg-gray-50 text-gray-400 font-black border-b border-gray-100 uppercase tracking-tighter">
                      <tr>
                        <th className="py-4 px-2">순위</th>
                        <th className="text-left px-4">선수명</th>
                        {/* 🔴 클릭 가능한 정렬 헤더들 */}
                        <th
                          className="cursor-pointer hover:bg-gray-100 hover:text-gray-800 transition"
                          onClick={() => requestSort("apps")}
                        >
                          출장{" "}
                          {sortConfig.key === "apps" && (
                            <span className="text-ssu-blue ml-1">
                              {sortConfig.direction === "desc" ? "▼" : "▲"}
                            </span>
                          )}
                        </th>

                        <th
                          className="cursor-pointer hover:bg-gray-100 hover:text-gray-800 transition"
                          onClick={() => requestSort("mins")}
                        >
                          출전시간{" "}
                          {sortConfig.key === "mins" && (
                            <span className="text-ssu-blue ml-1">
                              {sortConfig.direction === "desc" ? "▼" : "▲"}
                            </span>
                          )}
                        </th>

                        <th
                          className="cursor-pointer hover:bg-gray-100 hover:text-gray-800 transition"
                          onClick={() => requestSort("goals")}
                        >
                          득점{" "}
                          {sortConfig.key === "goals" && (
                            <span className="text-ssu-blue ml-1">
                              {sortConfig.direction === "desc" ? "▼" : "▲"}
                            </span>
                          )}
                        </th>

                        <th
                          className="cursor-pointer hover:bg-gray-100 transition text-ssu-blue"
                          onClick={() => requestSort("points")}
                        >
                          공격포인트{" "}
                          {sortConfig.key === "points" && (
                            <span className="ml-1">
                              {sortConfig.direction === "desc" ? "▼" : "▲"}
                            </span>
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {playerRankings.map((p, idx) => (
                        <tr
                          key={p.id}
                          className="text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-5 font-black">{idx + 1}</td>
                          <td className="text-left px-4">
                            <span className="font-black text-ssu-dark text-base">
                              {p.name}
                            </span>
                            <span className="ml-1.5 text-[10px] text-gray-300 font-bold uppercase">
                              {p.position}
                            </span>
                          </td>
                          <td className="py-5 font-bold">{p.apps}</td>
                          <td className="py-5 font-medium text-gray-500">
                            {p.mins}'
                          </td>
                          <td className="py-5 font-black text-gray-800">
                            {p.goals}
                          </td>
                          <td className="py-5 font-black text-ssu-blue text-base">
                            {p.points}
                          </td>
                        </tr>
                      ))}
                      {playerRankings.length === 0 && (
                        <tr>
                          <td
                            colSpan="6"
                            className="py-20 text-gray-400 font-bold"
                          >
                            해당 연도에 기록이 있는 선수가 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchSchedule;
