import React, { useState, useMemo } from "react";
import {
  Trophy,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Calendar as CalendarIcon,
  User,
  Star,
  Target,
  Zap,
  Clock,
  ChevronRight as MoreIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { calculatePlayerRankings } from "../utils";

const Dashboard = ({
  matches = [],
  league = [],
  setActiveTab,
  match_logs = [],
  players = [],
}) => {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [standingsTab, setStandingsTab] = useState("league");

  // --- 데이터 가공 ---
  const calendarData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= lastDate; i++) days.push(i);
    return days;
  }, [currentMonth]);

  const birthdaysByDate = useMemo(() => {
    const map = {};
    players
      .filter((p) => p.status === "current" && !p.isHidden)
      .forEach((p) => {
        const birthStr =
          p.birthday || p.profile?.birthday || p["profile.birthday"];
        if (!birthStr) return;
        const numbers = String(birthStr).match(/\d+/g);
        if (numbers && numbers.length >= 2) {
          const dateKey = `${numbers[numbers.length - 2].padStart(2, "0")}-${numbers[numbers.length - 1].padStart(2, "0")}`;
          if (!map[dateKey]) map[dateKey] = [];
          map[dateKey].push(p);
        }
      });
    return map;
  }, [players]);

  const upcomingMatches = useMemo(
    () =>
      matches
        .filter((m) => m.status === "Upcoming")
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(0, 3),
    [matches],
  );

  const uLeagueTeams = useMemo(() => {
    const teams = new Set(["숭실대"]);
    matches.forEach((m) => {
      // 2026년 U리그 상대팀만 추출
      if (
        m.type &&
        m.type.includes("U리그") &&
        Number(m.year) === 2026 &&
        m.opponent
      ) {
        teams.add(m.opponent);
      }
    });
    return Array.from(teams);
  }, [matches]);

  // 🔥 이 부분을 수정해야 Dashboard에도 점수가 제대로 반영됩니다!
  const sortedLeague = useMemo(() => {
    const combined = uLeagueTeams.map((teamName) => {
      const dbRecord =
        league.find(
          (t) => t.team === teamName && Number(t.year) === currentYear,
        ) || {};

      const w = Number(dbRecord.w) || 0;
      const d = Number(dbRecord.d) || 0;
      const l = Number(dbRecord.l) || 0;
      const gd = Number(dbRecord.gd) || 0;

      return {
        id: dbRecord.id || null,
        team: teamName,
        w,
        d,
        l,
        gd,
        played: w + d + l,
        pts: w * 3 + d * 1,
      };
    });

    return combined
      .sort((a, b) => {
        if (a.pts !== b.pts) return b.pts - a.pts;
        return b.gd - a.gd;
      })
      .map((t, idx) => ({ ...t, rank: idx + 1 }));
  }, [uLeagueTeams, league]);

  // 🔥 동적 연도 설정 (현재 연도 혹은 데이터 상의 최신 연도)
  const currentYear = useMemo(() => {
    if (matches.length > 0) {
      return Math.max(...matches.map((m) => Number(m.year)));
    }
    return new Date().getFullYear();
  }, [matches]);

  // 🔥 공통 함수 사용하여 상위 5명 추출
  const topPlayers = useMemo(() => {
    const allRankings = calculatePlayerRankings(
      match_logs,
      players,
      currentYear,
    );
    return allRankings.slice(0, 5);
  }, [match_logs, players, currentYear]);

  return (
    <div className="space-y-10 md:space-y-14 pb-10 max-w-7xl mx-auto px-1">
      {/* 🟢 1. Hero Section (기존 유지) */}
      {/* 🔥 1. Hero Section (브랜드 그라디언트 적용) */}

      <section className="relative -mx-4 md:mx-0 md:rounded-4xl overflow-hidden">
        <div className="bg-linear-to-br from-ssu-light via-ssu-blue to-ssu-dark px-6 py-12 md:py-20 text-white relative">
          <div className="relative z-10 max-w-4xl">
            <span className="inline-block px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] md:text-xs font-black tracking-widest mb-4">
              SOONGSIL UNIVERSITY FOOTBALL TEAM
            </span>

            <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tighter mb-6 break-keep">
              ON OUR WAY BACK
              <br />
              다시, 우리의 길로
            </h1>
          </div>
        </div>
      </section>

      {/* 🟢 2. Match Carousel (디자인 수정 & 전체보기 추가) */}
      <section className="space-y-6">
        <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-8 bg-ssu-blue rounded-full"></div>
            <h3 className="text-2xl md:text-3xl font-black text-ssu-dark tracking-tight">
              Next Matches
            </h3>
          </div>
          <button
            onClick={() => setActiveTab("matches")}
            className="group flex items-center gap-1 text-ssu-blue font-black text-xs md:text-sm hover:opacity-70 transition-all"
          >
            경기 전체 바로가기{" "}
            <MoreIcon
              size={16}
              className="group-hover:translate-x-1 transition-transform"
            />
          </button>
        </div>

        <div className="flex md:grid md:grid-cols-3 gap-5 overflow-x-auto snap-x snap-mandatory pb-4 px-2 custom-scrollbar">
          {upcomingMatches.length > 0 ? (
            upcomingMatches.map((m, idx) => (
              <div
                key={idx}
                className="min-w-[85%] md:min-w-0 snap-center bg-white rounded-3xl border border-gray-100 p-7 flex flex-col justify-between shadow-sm hover:shadow-xl transition-all duration-300 group border-b-4 border-b-transparent hover:border-b-ssu-blue"
              >
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[10px] font-black bg-ssu-dark text-[#FFD60A] px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm">
                      {m.type}
                    </span>
                    <div
                      className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-widest ${m.isHome ? "text-ssu-blue" : "text-gray-400"}`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${m.isHome ? "bg-ssu-blue" : "bg-gray-300"}`}
                      ></div>
                      {m.isHome ? "Home Game" : "Away Game"}
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-8 px-2">
                    <div className="text-center flex-1 font-black text-xl text-ssu-dark group-hover:scale-105 transition-transform">
                      숭실대
                    </div>
                    <div className="px-4 font-black text-gray-200 italic text-xl">
                      VS
                    </div>
                    <div className="text-center flex-1 font-black text-xl text-ssu-dark truncate group-hover:scale-105 transition-transform">
                      {m.opponent}
                    </div>
                  </div>
                </div>
                <div className="space-y-3 pt-6 border-t border-gray-50">
                  <div className="flex items-center gap-3 text-sm font-bold text-gray-700">
                    <Clock size={16} className="text-ssu-blue" />
                    <span>{m.date.replace(/-/g, ".")}</span>
                    <span className="text-ssu-blue">{m.time}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold text-gray-400">
                    <MapPin size={16} className="text-gray-300" />
                    <span className="truncate">{m.venue || "경기장 미정"}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="w-full col-span-3 py-16 text-center text-gray-400 font-bold bg-white rounded-3xl border border-dashed border-gray-200">
              현재 예정된 공식 경기가 없습니다.
            </div>
          )}
        </div>
      </section>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* 🟢 3. Standing Tab (디자인 수정 & 전체보기 추가) */}
        <div className="lg:col-span-7 bg-white rounded-4xl border border-gray-100 overflow-hidden shadow-sm flex flex-col">
          {/* 상단 탭 메뉴 */}
          <div className="flex bg-gray-50/50 p-2 gap-2">
            <button
              onClick={() => setStandingsTab("league")}
              className={`flex-1 py-3.5 text-xs md:text-sm font-black rounded-2xl transition-all ${
                standingsTab === "league"
                  ? "bg-ssu-dark text-white shadow-lg"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              리그 순위
            </button>
            <button
              onClick={() => setStandingsTab("player")}
              className={`flex-1 py-3.5 text-xs md:text-sm font-black rounded-2xl transition-all ${
                standingsTab === "player"
                  ? "bg-ssu-dark text-white shadow-lg"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              선수 순위
            </button>
          </div>

          <div className="p-6">
            <div className="flex justify-end items-center mb-4">
              {standingsTab === "league" ? (
                // 리그 순위일 때의 버튼
                <button
                  onClick={() =>
                    navigate("/matches", {
                      state: { targetTab: "rankings", targetSubTab: "league" },
                    })
                  }
                  className="text-xs text-gray-500 font-bold hover:text-ssu-blue transition flex items-center"
                >
                  전체 보기 <ChevronRight size={14} />
                </button>
              ) : (
                // 선수 순위일 때의 버튼
                <button
                  onClick={() =>
                    navigate("/matches", {
                      state: { targetTab: "rankings", targetSubTab: "player" },
                    })
                  }
                  className="text-xs text-gray-500 font-bold hover:text-ssu-blue transition flex items-center"
                >
                  전체 보기 <ChevronRight size={14} />
                </button>
              )}
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              {standingsTab === "league" ? (
                /* 리그 순위 테이블 (승/무/패 컬럼 추가) */
                <table className="w-full text-xs md:text-sm text-center whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-400 font-black border-b border-gray-100 uppercase tracking-tighter">
                    <tr>
                      <th className="py-3 px-2">순위</th>
                      <th className="text-left px-4">팀명</th>
                      <th className="px-2">경기</th>
                      <th className="px-2">승</th>
                      <th className="px-2">무</th>
                      <th className="px-2">패</th>
                      <th className="px-2">득실차</th>
                      <th className="px-2 text-ssu-blue">승점</th>
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
                        <td className="py-4.5 font-black">{row.rank}</td>
                        <td className="text-left px-4 font-black">
                          {row.team}
                        </td>
                        <td className="py-4.5 font-bold">{row.played}</td>
                        <td className="py-4.5">{row.w}</td>
                        <td className="py-4.5">{row.d}</td>
                        <td className="py-4.5">{row.l}</td>
                        <td className="py-4.5 font-bold">
                          {row.gd > 0 ? `+${row.gd}` : row.gd}
                        </td>
                        <td className="py-4.5 font-black text-ssu-blue text-base">
                          {row.pts}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                /* 선수 순위 테이블 (한글 레이블 수정) */
                <table className="w-full text-xs md:text-sm text-center whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-400 font-black border-b border-gray-100 uppercase tracking-tighter">
                    <tr>
                      <th className="py-3 px-2">순위</th>
                      <th className="text-left px-4">선수명</th>
                      <th className="px-2">출장</th>
                      <th className="px-2">출전시간</th>
                      <th className="px-2">득점</th>
                      <th className="px-2 text-ssu-blue">공격포인트</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {topPlayers.map((p, idx) => (
                      <tr
                        key={p.id}
                        className="text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-4.5 font-black text-[#001D3D]">
                          {idx + 1}
                        </td>
                        <td className="text-left px-4">
                          <span className="font-black text-gray-900">
                            {p.name}
                          </span>
                          <span className="ml-2 text-[10px] text-gray-400 font-bold uppercase">
                            {p.position}
                          </span>
                        </td>
                        <td className="py-4.5 font-bold">{p.apps}</td>
                        <td className="py-4.5 font-bold">{p.mins}</td>
                        <td className="py-4.5 font-black">{p.goals}</td>
                        <td className="py-4.5 font-black text-ssu-blue text-base">
                          {p.goals + p.assists}
                        </td>
                      </tr>
                    ))}
                    {topPlayers.length === 0 && (
                      <tr>
                        <td
                          colSpan="6"
                          className="py-10 text-gray-400 font-bold text-center"
                        >
                          기록된 선수가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* 🟢 4. Calendar (기존 개선안 유지) */}
        <div className="lg:col-span-5 bg-white rounded-4xl border border-gray-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-ssu-dark flex items-center text-xl">
              <CalendarIcon className="mr-2 text-ssu-blue" size={24} />
              {currentMonth.getFullYear()}.
              {String(currentMonth.getMonth() + 1).padStart(2, "0")}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.setMonth(currentMonth.getMonth() - 1),
                    ),
                  )
                }
                className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.setMonth(currentMonth.getMonth() + 1),
                    ),
                  )
                }
                className="p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl transition"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 md:gap-2 text-center mb-4">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div
                key={d}
                className={`text-[10px] md:text-xs font-black py-1 ${i === 0 ? "text-red-400" : i === 6 ? "text-ssu-blue" : "text-gray-300"}`}
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5 md:gap-2">
            {calendarData.map((day, i) => {
              const dateKey = day
                ? `${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                : "";
              const birthdayPlayers = birthdaysByDate[dateKey] || [];
              const dayMatches = matches.filter(
                (m) => m.date === `${currentMonth.getFullYear()}-${dateKey}`,
              );

              return (
                <div
                  key={i}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center relative border transition-all ${day ? "bg-gray-50/50 border-gray-100 hover:border-ssu-blue/30" : "border-transparent"}`}
                >
                  {day && (
                    <>
                      <span className="text-[11px] md:text-sm font-black text-gray-600">
                        {day}
                      </span>
                      <div className="flex gap-0.5 mt-1">
                        {dayMatches.length > 0 && (
                          <div className="w-1 h-1 bg-ssu-blue rounded-full"></div>
                        )}
                        {birthdayPlayers.length > 0 && (
                          <div className="w-1 h-1 bg-pink-400 rounded-full animate-pulse"></div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 space-y-3 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
            {calendarData.map((day) => {
              if (!day) return null;
              const dateKey = `${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const births = birthdaysByDate[dateKey] || [];
              const ms = matches.filter(
                (m) => m.date === `${currentMonth.getFullYear()}-${dateKey}`,
              );

              return (
                <React.Fragment key={day}>
                  {ms.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 p-3 bg-ssu-dark text-white rounded-2xl shadow-sm transform hover:scale-[1.02] transition-transform cursor-pointer"
                      onClick={() => setActiveTab("matches")}
                    >
                      <div className="text-[10px] font-black w-8 h-8 flex items-center justify-center bg-white/10 rounded-lg">
                        {day}
                      </div>
                      <div className="flex-1 text-xs font-bold truncate">
                        {m.time} vs {m.opponent}
                      </div>
                      <MoreIcon size={12} className="text-white/30" />
                    </div>
                  ))}
                  {births.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-3 bg-pink-50 text-pink-600 rounded-2xl border border-pink-100 cursor-pointer"
                      onClick={() => setActiveTab("players")}
                    >
                      <div className="text-[10px] font-black w-8 h-8 flex items-center justify-center bg-pink-200/30 rounded-lg">
                        {day}
                      </div>
                      <div className="flex-1 text-xs font-black">
                        🎂 {p.name} 생일
                      </div>
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
