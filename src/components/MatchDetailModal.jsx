import React, { useState, useMemo } from "react";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  BarChart2,
  Target,
  Award,
  Youtube,
  BookOpen,
  Mic,
  FileText,
  ChevronRight,
} from "lucide-react";
import { useData } from "../contexts/DataContext";

const MatchDetailModal = ({ match, onClose }) => {
  const { matches, matchLogs } = useData();
  const [activeTab, setActiveTab] = useState("summary");

  const currentMatchLogs = useMemo(() => {
    if (!match?.id || !matchLogs?.length) return [];
    return matchLogs.filter(
      (log) => (log.matchId || log.match_id) === match.id,
    );
  }, [match?.id, matchLogs]);

  const h2h = useMemo(() => {
    if (!match?.opponent) return { w: 0, d: 0, l: 0 };
    const history = (matches || []).filter(
      (m) => m.opponent === match.opponent && m.status === "Finished",
    );
    let w = 0,
      d = 0,
      l = 0;
    history.forEach((h) => {
      const hScore = Number(h.homeScore) || 0;
      const aScore = Number(h.awayScore) || 0;
      if (hScore > aScore) w++;
      else if (aScore > hScore) l++;
      else d++;
    });
    return { w, d, l };
  }, [match, matches]);

  if (!match) return null;

  const safeScorers = Array.isArray(match.scorers) ? match.scorers : [];
  const safeAssists = Array.isArray(match.assists) ? match.assists : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* 1. 히어로 배너 */}
        <div className="modal-hero-bright">
          <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none select-none">
            <span className="text-[180px] font-black tracking-tighter whitespace-nowrap">
              SOONGSIL
            </span>
          </div>

          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-white/70 hover:text-ssu-black bg-white/10 hover:bg-[#FFD60A] p-2.5 rounded-full transition-all duration-300 z-20"
          >
            <X size={20} strokeWidth={2.5} />
          </button>

          <div className="relative z-10 flex flex-col items-center">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full mb-6 bg-[#FFD60A] text-ssu-black shadow-sm text-[10px] md:text-xs font-black tracking-widest uppercase">
              {match.type || "대회"}
            </div>

            <div className="flex items-center justify-center w-full max-w-2xl mx-auto">
              <div className="flex flex-col items-center flex-1">
                <span className="text-2xl md:text-4xl font-black tracking-tight drop-shadow-md">
                  숭실대
                </span>
              </div>

              <div className="shrink-0 flex flex-col items-center px-6 md:px-12">
                {match.status === "Finished" ? (
                  <div className="flex items-center gap-3 md:gap-6">
                    <span className="text-5xl md:text-7xl font-black text-white drop-shadow-lg">
                      {match.homeScore || 0}
                    </span>
                    <span className="text-2xl md:text-4xl text-[#FFD60A] font-light -translate-y-1">
                      :
                    </span>
                    <span className="text-5xl md:text-7xl font-black text-white drop-shadow-lg">
                      {match.awayScore || 0}
                    </span>
                  </div>
                ) : (
                  <span className="text-3xl md:text-5xl font-black italic text-white/50 drop-shadow-sm px-4">
                    VS
                  </span>
                )}
                {match.pso && (
                  <div className="mt-4 text-[10px] font-black bg-red-500 text-white px-3 py-1.5 rounded-md shadow-sm tracking-widest">
                    PSO {match.pso}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center flex-1">
                <span className="text-2xl md:text-4xl font-black tracking-tight drop-shadow-md text-white">
                  {match.opponent || "상대팀"}
                </span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:gap-6 text-xs font-bold text-white/90">
              <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                <Calendar size={14} className="text-[#FFD60A]" />{" "}
                {match.date?.replace(/-/g, ".") || "일정 미정"}
              </span>
              {match.time && (
                <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                  <Clock size={14} className="text-[#FFD60A]" /> {match.time}
                </span>
              )}
              {match.venue && (
                <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
                  <MapPin size={14} className="text-[#FFD60A]" /> {match.venue}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. 탭 네비게이션 */}
        <div className="flex bg-white shrink-0 border-b border-gray-100 shadow-sm relative z-20">
          <button
            onClick={() => setActiveTab("summary")}
            className={
              activeTab === "summary" ? "tab-btn-active" : "tab-btn-inactive"
            }
          >
            MATCH SUMMARY
          </button>
          <button
            onClick={() => setActiveTab("lineup")}
            className={
              activeTab === "lineup" ? "tab-btn-active" : "tab-btn-inactive"
            }
          >
            LINE-UP & RECORDS
          </button>
        </div>

        {/* 3. 컨텐츠 영역 */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50/50 custom-scrollbar relative">
          {/* TAB 1: SUMMARY */}
          {activeTab === "summary" && (
            <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
              {/* Upcoming: 상대 전적 */}
              {match.status === "Upcoming" && (
                <div className="modal-card-white text-center rounded-3xl!">
                  <h4 className="font-black text-ssu-black mb-8 text-sm uppercase tracking-widest flex items-center justify-center">
                    <BarChart2 size={18} className="mr-2 text-ssu-blue" /> vs{" "}
                    {match.opponent} 상대 전적
                  </h4>
                  <div className="flex justify-center items-center gap-6 md:gap-12">
                    <div className="flex flex-col items-center w-24">
                      <div className="text-4xl md:text-5xl font-black text-ssu-blue mb-2">
                        {h2h.w}
                      </div>
                      <div className="text-[10px] font-black text-ssu-dark bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100">
                        WIN
                      </div>
                    </div>
                    <div className="h-12 w-px bg-gray-200"></div>
                    <div className="flex flex-col items-center w-24">
                      <div className="text-4xl md:text-5xl font-black text-gray-400 mb-2">
                        {h2h.d}
                      </div>
                      <div className="text-[10px] font-black text-gray-600 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-widest border border-gray-200">
                        DRAW
                      </div>
                    </div>
                    <div className="h-12 w-px bg-gray-200"></div>
                    <div className="flex flex-col items-center w-24">
                      <div className="text-4xl md:text-5xl font-black text-red-500 mb-2">
                        {h2h.l}
                      </div>
                      <div className="text-[10px] font-black text-red-700 bg-red-50 px-3 py-1 rounded-full uppercase tracking-widest border border-red-100">
                        LOSS
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Finished: 득점 정보 & MOM */}
              {match.status === "Finished" && (
                <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                  {/* 득점 카드 */}
                  <div className="modal-card-white rounded-3xl!">
                    <h4 className="font-black text-ssu-black border-b border-gray-100 pb-4 mb-4 flex items-center text-sm tracking-widest uppercase">
                      <Target className="mr-2 text-ssu-blue" size={18} /> Goals
                      & Assists
                    </h4>
                    {safeScorers.length > 0 ? (
                      <div className="space-y-3 flex-1">
                        {safeScorers.map((scorer, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100"
                          >
                            <span className="font-bold text-ssu-black pl-2">
                              {scorer.name}
                            </span>
                            <span className="text-[11px] font-black text-ssu-black bg-[#FFD60A] px-3 py-1.5 rounded-xl shadow-sm tracking-widest">
                              {scorer.count || scorer.goals} GOAL
                            </span>
                          </div>
                        ))}
                        {safeAssists.length > 0 && (
                          <div className="text-xs font-bold text-gray-600 pt-3 mt-4 border-t border-dashed border-gray-200 flex items-center">
                            <span className="text-green-700 bg-green-100 px-2.5 py-1 rounded-lg mr-3 text-[10px] uppercase tracking-widest font-black">
                              Assist
                            </span>
                            {safeAssists.join(", ")}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm font-bold bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        득점 기록이 없습니다.
                      </div>
                    )}
                  </div>

                  {/* MOM 카드 */}
                  <div className="modal-card-white rounded-3xl! border-yellow-300 shadow-[0_4px_20px_rgba(255,214,10,0.15)] relative overflow-hidden">
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-yellow-50 rounded-full blur-2xl pointer-events-none"></div>
                    <h4 className="font-black text-ssu-black border-b border-gray-100 pb-4 mb-4 flex items-center text-sm tracking-widest uppercase relative z-10">
                      <Award className="mr-2 text-yellow-500" size={18} /> Man
                      of the Match
                    </h4>
                    {(() => {
                      const displayMom =
                        match.mom && match.mom !== "-"
                          ? match.mom
                          : currentMatchLogs.find((log) => log.mom)?.name;
                      return (
                        <div className="flex-1 flex flex-col justify-center relative z-10">
                          {displayMom ? (
                            <div className="flex items-center gap-5 p-3 bg-linear-to-r from-yellow-50 to-white rounded-2xl border border-yellow-100">
                              <div className="bg-[#FFD60A] text-ssu-black p-4 rounded-2xl shadow-md">
                                <Award size={32} strokeWidth={2.5} />
                              </div>
                              <div>
                                <div className="text-[10px] text-yellow-600 font-black uppercase tracking-[0.2em] mb-1">
                                  최우수 선수
                                </div>
                                <div className="font-black text-3xl text-ssu-black tracking-tight">
                                  {displayMom}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm font-bold bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                              MOM 정보가 없습니다.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* 미디어 링크 버튼들 */}
              {(match.media?.highlight ||
                match.media?.report ||
                match.media?.interview) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  {match.media?.highlight && (
                    <a
                      href={match.media.highlight}
                      target="_blank"
                      rel="noreferrer"
                      className="group media-btn hover:border-red-200 hover:text-red-600"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-red-50 text-red-500 p-2 rounded-xl group-hover:bg-red-500 group-hover:text-white transition-colors">
                          <Youtube size={20} />
                        </div>
                        <span className="text-sm">하이라이트</span>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-gray-300 group-hover:text-red-400 group-hover:translate-x-1 transition-all"
                      />
                    </a>
                  )}
                  {match.media?.report && (
                    <a
                      href={match.media.report}
                      target="_blank"
                      rel="noreferrer"
                      className="group media-btn hover:border-green-200 hover:text-green-600"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-green-50 text-green-500 p-2 rounded-xl group-hover:bg-green-500 group-hover:text-white transition-colors">
                          <BookOpen size={20} />
                        </div>
                        <span className="text-sm">경기 리뷰</span>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-gray-300 group-hover:text-green-400 group-hover:translate-x-1 transition-all"
                      />
                    </a>
                  )}
                  {match.media?.interview && (
                    <a
                      href={match.media.interview}
                      target="_blank"
                      rel="noreferrer"
                      className="group media-btn hover:border-blue-200 hover:text-blue-600"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-50 text-ssu-blue p-2 rounded-xl group-hover:bg-ssu-blue group-hover:text-white transition-colors">
                          <Mic size={20} />
                        </div>
                        <span className="text-sm">선수 인터뷰</span>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-gray-300 group-hover:text-blue-400 group-hover:translate-x-1 transition-all"
                      />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LINE-UP & RECORDS */}
          {activeTab === "lineup" && (
            <div className="max-w-4xl mx-auto animate-fade-in pb-4">
              <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-white flex items-center justify-between">
                  <h4 className="font-black text-ssu-black flex items-center text-sm tracking-widest uppercase">
                    <FileText className="mr-2 text-ssu-blue" size={18} /> 출전
                    기록 명단
                  </h4>
                  <div className="text-xs font-bold text-ssu-black bg-blue-50 px-3 py-1 rounded-full">
                    Total:{" "}
                    <span className="text-ssu-blue">
                      {currentMatchLogs.length}
                    </span>{" "}
                    Players
                  </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-sm text-center whitespace-nowrap">
                    <thead className="bg-ssu-black/5 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4 font-black text-ssu-black text-left text-[11px] uppercase tracking-widest">
                          선수명
                        </th>
                        <th className="px-4 py-4 font-black text-ssu-black text-[11px] uppercase tracking-widest">
                          구분
                        </th>
                        <th className="px-4 py-4 font-black text-ssu-black text-[11px] uppercase tracking-widest">
                          출전시간
                        </th>
                        <th className="px-4 py-4 font-black text-ssu-blue text-[11px] uppercase tracking-widest">
                          득점
                        </th>
                        <th className="px-4 py-4 font-black text-green-600 text-[11px] uppercase tracking-widest">
                          도움
                        </th>
                        <th className="px-4 py-4 font-black text-yellow-600 text-[11px] uppercase tracking-widest">
                          MOM
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[...currentMatchLogs]
                        .sort((a, b) =>
                          a.starter === "선발" || a.starter === true ? -1 : 1,
                        )
                        .map((p, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-blue-50/50 transition-colors bg-white"
                          >
                            <td className="px-6 py-4 text-left">
                              <span className="font-bold text-ssu-black text-base">
                                {p.name}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={
                                  p.starter === "선발" || p.starter === true
                                    ? "badge-ssu"
                                    : "badge-outline"
                                }
                              >
                                {p.starter === "선발" || p.starter === true
                                  ? "선발"
                                  : "교체"}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-gray-700 font-bold bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                {p.minutes}'
                              </span>
                            </td>
                            <td className="px-4 py-4 font-black text-ssu-blue text-lg">
                              {p.goals > 0 ? (
                                p.goals
                              ) : (
                                <span className="text-gray-300 font-normal">
                                  -
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 font-black text-green-600 text-lg">
                              {p.assists > 0 ? (
                                p.assists
                              ) : (
                                <span className="text-gray-300 font-normal">
                                  -
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {p.mom ? (
                                <div className="bg-[#FFD60A]/10 inline-flex p-1.5 rounded-full border border-[#FFD60A]/30">
                                  <Award
                                    size={18}
                                    className="text-yellow-500"
                                  />
                                </div>
                              ) : (
                                <span className="text-gray-300 font-normal">
                                  -
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      {currentMatchLogs.length === 0 && (
                        <tr>
                          <td
                            colSpan="6"
                            className="py-24 text-center bg-gray-50/50"
                          >
                            <div className="inline-flex flex-col items-center justify-center text-gray-400 space-y-3">
                              <FileText size={32} className="text-gray-300" />
                              <span className="font-bold text-sm">
                                등록된 출전 명단이 없습니다.
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchDetailModal;
