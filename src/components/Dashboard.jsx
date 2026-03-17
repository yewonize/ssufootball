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
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { calculatePlayerRankings } from "../utils";
import { useData } from "../contexts/DataContext";

const Dashboard = ({ setActiveTab }) => {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [standingsTab, setStandingsTab] = useState("league");

  // 🔥 이제 데이터를 전역 보관소에서 알아서 쏙 빼옵니다!
  const { matches, league, matchLogs: match_logs, players } = useData();

  // 🔴 1. 가장 먼저 'currentYear'를 선언해야 아래쪽에서 쓸 수 있습니다!
  const currentYear = useMemo(() => {
    if (matches.length > 0) {
      return Math.max(...matches.map((m) => Number(m.year)));
    }
    return new Date().getFullYear();
  }, [matches]);

  const [selectedDate, setSelectedDate] = useState(null);

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

      <section className="relative -mx-5 md:mx-0 -mt-6 md:mt-0 md:rounded-[2.5rem] overflow-hidden shadow-lg">
        <div className="bg-linear-to-br from-ssu-light via-ssu-blue to-ssu-dark px-6 py-12 md:py-24 text-white relative">
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

        {/* 🟢 4. Calendar */}
        <div className="lg:col-span-5 bg-white rounded-4xl border border-gray-100 p-6 shadow-sm relative">
          {/* 헤더 */}
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-black text-ssu-black flex items-center text-xl tracking-tight">
              <CalendarIcon className="mr-2 text-ssu-blue" size={24} />
              {currentMonth.getFullYear()}.
              {String(currentMonth.getMonth() + 1).padStart(2, "0")}
            </h3>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedDate(null);
                  const prevMonth = new Date(currentMonth);
                  prevMonth.setMonth(prevMonth.getMonth() - 1);
                  setCurrentMonth(prevMonth);
                }}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-2xl transition border border-transparent hover:border-slate-200"
              >
                <ChevronLeft size={18} />
              </button>

              <button
                onClick={() => {
                  setSelectedDate(null);
                  const nextMonth = new Date(currentMonth);
                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                  setCurrentMonth(nextMonth);
                }}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-2xl transition border border-transparent hover:border-slate-200"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* 요일 */}
          <div className="grid grid-cols-7 gap-1 text-center mb-4">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div
                key={i}
                className={`text-[10px] font-black uppercase tracking-[0.18em] ${
                  i === 0
                    ? "text-red-400"
                    : i === 6
                      ? "text-ssu-blue"
                      : "text-slate-300"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-2 relative">
            {calendarData.map((day, i) => {
              if (!day) return <div key={i} className="aspect-square" />;

              const fullDate = `${currentMonth.getFullYear()}-${String(
                currentMonth.getMonth() + 1,
              ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

              const dateKey = `${String(currentMonth.getMonth() + 1).padStart(
                2,
                "0",
              )}-${String(day).padStart(2, "0")}`;

              const dayMatches = matches.filter((m) => m.date === fullDate);
              const birthdayPlayers = birthdaysByDate[dateKey] || [];
              const isSelected = selectedDate === fullDate;

              // 오른쪽 끝 잘림 방지
              const isRightSide = i % 7 > 3;

              return (
                <div key={i} className="relative">
                  {/* 날짜 버튼 */}
                  <button
                    onClick={() =>
                      setSelectedDate(isSelected ? null : fullDate)
                    }
                    className={`w-full aspect-square rounded-[22px] flex flex-col items-center justify-center relative transition-all border
              ${
                isSelected
                  ? "border-slate-300 bg-white ring-4 ring-slate-100 shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
                  : "border-transparent bg-slate-50/70 hover:bg-white hover:border-slate-200"
              }
            `}
                  >
                    <span
                      className={`text-sm font-black tracking-tight ${
                        isSelected ? "text-slate-900" : "text-slate-600"
                      }`}
                    >
                      {day}
                    </span>

                    <div className="flex gap-1 mt-1.5">
                      {dayMatches.length > 0 && (
                        <div className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
                      )}
                      {birthdayPlayers.length > 0 && (
                        <div className="w-1.5 h-1.5 bg-pink-400 rounded-full" />
                      )}
                    </div>
                  </button>

                  {/* 상세 카드 */}
                  {isSelected && (
                    <div
                      className={`absolute bottom-full mb-3 z-50 animate-calendar-pop
                ${isRightSide ? "right-0" : "left-0"}
                w-65 md:w-75
              `}
                    >
                      <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.14)] overflow-hidden">
                        {/* 상단 메타 */}
                        <div className="px-4 pt-4 pb-3 border-b border-slate-100 bg-white">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                                Selected date
                              </p>
                              <h4 className="mt-1 text-base font-black text-slate-900 tracking-tight">
                                {fullDate.replace(/-/g, ".")}
                              </h4>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(null);
                              }}
                              className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            {dayMatches.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                                경기 {dayMatches.length}
                              </span>
                            )}

                            {birthdayPlayers.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-1 text-[10px] font-bold text-pink-600 border border-pink-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                                생일 {birthdayPlayers.length}
                              </span>
                            )}

                            {dayMatches.length === 0 &&
                              birthdayPlayers.length === 0 && (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                                  일정 없음
                                </span>
                              )}
                          </div>
                        </div>

                        {/* 내용 */}
                        <div className="p-3 space-y-2 max-h-64 overflow-y-auto custom-scrollbar bg-white">
                          {dayMatches.map((m) => (
                            <button
                              key={m.id}
                              onClick={() => {
                                setActiveTab("matches");
                                setSelectedDate(null);
                                // 필요하면 아래 같은 식으로 확장 가능
                                // setSelectedMatchId?.(m.id);
                              }}
                              className="w-full text-left rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:shadow-sm transition p-3 group"
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 h-9 w-9 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                                  <Trophy size={14} />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                    Match
                                  </p>
                                  <p className="mt-1 text-sm font-black text-slate-900 truncate">
                                    vs {m.opponent}
                                  </p>
                                  <p className="mt-1 text-[11px] text-slate-500 truncate">
                                    {m.type}
                                  </p>
                                </div>

                                <ChevronRight
                                  size={14}
                                  className="text-slate-300 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all"
                                />
                              </div>
                            </button>
                          ))}

                          {birthdayPlayers.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setActiveTab("players");
                                setSelectedDate(null);
                                // 필요하면 아래 같은 식으로 확장 가능
                                // setSelectedPlayerId?.(p.id);
                              }}
                              className="w-full text-left rounded-2xl border border-pink-100 bg-pink-50 hover:bg-pink-100/60 transition p-3 group"
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 h-9 w-9 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm text-sm">
                                  🎂
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-pink-400">
                                    Birthday
                                  </p>
                                  <p className="mt-1 text-sm font-black text-pink-700 truncate">
                                    {p.name} 선수
                                  </p>
                                </div>

                                <ChevronRight
                                  size={14}
                                  className="text-pink-200 group-hover:text-pink-500 group-hover:translate-x-0.5 transition-all"
                                />
                              </div>
                            </button>
                          ))}

                          {dayMatches.length === 0 &&
                            birthdayPlayers.length === 0 && (
                              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                                <p className="text-sm font-bold text-slate-400">
                                  일정이 없습니다
                                </p>
                                <p className="mt-1 text-[11px] text-slate-300">
                                  이 날짜에는 등록된 경기나 생일 정보가 없어요.
                                </p>
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 하단 범례 */}
          <div className="mt-8 flex justify-center gap-4 text-[10px] font-bold text-slate-400">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-slate-900 rounded-full"></div>
              경기 일정
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-pink-400 rounded-full"></div>
              선수 생일
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
