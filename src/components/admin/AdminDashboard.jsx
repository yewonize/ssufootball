import React, { useState, useMemo } from "react";
import {
  Zap,
  Target,
  Users,
  Clock,
  Award,
  MessageSquare,
  Heart,
  ChevronRight,
  Flame,
  Activity,
  Shield,
  Crosshair,
  TrendingUp,
  BarChart3,
  Calendar,
  Filter,
} from "lucide-react";

const AdminDashboard = ({ matches, players, matchLogs, openLoggingModal }) => {
  // 🕒 현재 연도 및 가용한 연도 목록 계산
  const currentYear = new Date().getFullYear().toString();

  const availableYears = useMemo(() => {
    const years = matches.map((m) => m.date?.substring(0, 4)).filter(Boolean);
    const unique = [...new Set(years)].sort().reverse();
    return unique.length > 0 ? unique : [currentYear];
  }, [matches, currentYear]);

  const [selectedYear, setSelectedYear] = useState(currentYear);

  // =====================================================================
  // 🚀 1. 상단 퀵 뷰 대시보드 (무조건 '올해' 기준)
  // =====================================================================
  const currentYearStats = useMemo(() => {
    const finishedThisYear = matches.filter(
      (m) => m.status === "Finished" && m.date?.startsWith(currentYear),
    );
    const count = finishedThisYear.length;

    let wins = 0,
      scored = 0,
      conceded = 0;

    finishedThisYear.forEach((m) => {
      const ssu = m.isHome ? m.homeScore : m.awayScore;
      const opp = m.isHome ? m.awayScore : m.homeScore;
      scored += ssu;
      conceded += opp;
      if (ssu > opp) wins++;
    });

    return {
      winRate: count ? ((wins / count) * 100).toFixed(1) : "0.0",
      avgScored: count ? (scored / count).toFixed(1) : "0.0",
      avgConceded: count ? (conceded / count).toFixed(1) : "0.0",
    };
  }, [matches, currentYear]);

  // =====================================================================
  // 📊 2. 경기 관련 인사이트 (선택한 연도 기준 필터링)
  // =====================================================================
  const selectedYearMatchStats = useMemo(() => {
    const finished = matches.filter(
      (m) => m.status === "Finished" && m.date?.startsWith(selectedYear),
    );
    const count = finished.length;

    let scored = 0,
      cleanSheets = 0,
      comebackWins = 0;
    const timeSlots = {
      "0-15": 0,
      "16-30": 0,
      "31-45": 0,
      "46-60": 0,
      "61-75": 0,
      "76-90": 0,
      "90+": 0,
    };

    finished.forEach((m) => {
      const ssu = m.isHome ? m.homeScore : m.awayScore;
      const opp = m.isHome ? m.awayScore : m.homeScore;
      scored += ssu;
      if (opp === 0) cleanSheets++;

      // 역전승 도출
      const ssuGoals = m.matchData?.goals || [];
      const oppConcedes = m.matchData?.concedes || [];
      if (ssu > opp && oppConcedes.length > 0) {
        const firstOppGoal = Math.min(
          ...oppConcedes.map((c) => Number(c.minute)),
        );
        const hasGoalAfterBeingDown = ssuGoals.some(
          (g) => Number(g.minute) > firstOppGoal,
        );
        if (hasGoalAfterBeingDown) comebackWins++;
      }

      // 득점 시간대 분류
      ssuGoals.forEach((g) => {
        const min = Number(g.minute);
        if (min <= 15) timeSlots["0-15"]++;
        else if (min <= 30) timeSlots["16-30"]++;
        else if (min <= 45) timeSlots["31-45"]++;
        else if (min <= 60) timeSlots["46-60"]++;
        else if (min <= 75) timeSlots["61-75"]++;
        else if (min <= 90) timeSlots["76-90"]++;
        else timeSlots["90+"]++;
      });
    });

    return { scored, cleanSheets, comebackWins, timeSlots };
  }, [matches, selectedYear]);

  // =====================================================================
  // 🌟 3. 선수 스페셜 지표 (선택한 연도 기준 필터링)
  // =====================================================================
  const selectedYearPlayerInsights = useMemo(() => {
    let psoSpecialist = null;
    let winContributor = null;

    const calculateContribution = (p) => {
      const stats = p.stats?.years?.[selectedYear] || {};
      return (
        (stats.goals || 0) * 3 + (stats.assists || 0) * 2 + (stats.mom || 0) * 5
      );
    };

    const activePlayers = players.filter(
      (p) => p.status === "current" || p.stats?.years?.[selectedYear]?.apps > 0,
    );

    // 🔥 [버그 픽스] 선수 DB의 누락된 연도별 스탯에 의존하지 않고,
    // match_logs 원본에서 직접 해당 연도의 승부차기(PSO) 기록을 집계합니다.
    const psoStatsByPlayer = {};
    matchLogs.forEach((log) => {
      if (String(log.year) === String(selectedYear)) {
        if (!psoStatsByPlayer[log.playerId])
          psoStatsByPlayer[log.playerId] = { goals: 0, saves: 0 };
        psoStatsByPlayer[log.playerId].goals += log.psoGoals || 0;
        psoStatsByPlayer[log.playerId].saves += log.psoSaves || 0;
      }
    });

    // 1) 승부차기(PSO) 스페셜리스트
    const psoSorted = [...activePlayers].sort((a, b) => {
      const aTotal =
        (psoStatsByPlayer[a.id]?.goals || 0) +
        (psoStatsByPlayer[a.id]?.saves || 0);
      const bTotal =
        (psoStatsByPlayer[b.id]?.goals || 0) +
        (psoStatsByPlayer[b.id]?.saves || 0);
      return bTotal - aTotal;
    });

    if (psoSorted.length > 0) {
      const topTotal =
        (psoStatsByPlayer[psoSorted[0].id]?.goals || 0) +
        (psoStatsByPlayer[psoSorted[0].id]?.saves || 0);
      if (topTotal > 0) {
        psoSpecialist = {
          ...psoSorted[0],
          psoDataText: `득점 ${psoStatsByPlayer[psoSorted[0].id].goals} / 선방 ${psoStatsByPlayer[psoSorted[0].id].saves}`,
        };
      }
    }

    // 2) 승리 기여도 1위
    const contribSorted = [...activePlayers].sort(
      (a, b) => calculateContribution(b) - calculateContribution(a),
    );
    if (contribSorted[0] && calculateContribution(contribSorted[0]) > 0) {
      winContributor = contribSorted[0];
    }

    // 3) 최다 MOM
    const momSorted = [...activePlayers].sort(
      (a, b) =>
        (b.stats?.years?.[selectedYear]?.mom || 0) -
        (a.stats?.years?.[selectedYear]?.mom || 0),
    );

    return {
      psoSpecialist,
      winContributor,
      contribScore: winContributor ? calculateContribution(winContributor) : 0,
      topMomPlayer:
        momSorted[0]?.stats?.years?.[selectedYear]?.mom > 0
          ? momSorted[0]
          : null,
    };
  }, [players, matchLogs, selectedYear]);

  // =====================================================================
  // 👥 4. CRM 인사이트 (전체 누적 팬심)
  // =====================================================================
  const crmStats = useMemo(() => {
    const totalLikes = players.reduce((acc, p) => acc + (p.likes || 0), 0);
    const topLikedPlayers = [...players]
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, 5);
    return { totalLikes, topLikedPlayers };
  }, [players]);

  return (
    <div className="space-y-12 pb-10 animate-fade-in">
      {/* ===================================================================== */}
      {/* 🚀 상단 퀵 뷰 대시보드 (현재 연도 고정) */}
      {/* ===================================================================== */}
      <section>
        <h2 className="text-lg font-black text-ssu-black mb-4 px-1">
          {currentYear} 시즌 숭실대 현황
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-ssu-blue text-white p-5 md:p-6 rounded-3xl shadow-lg shadow-blue-100 flex flex-col justify-between h-32 md:h-40 relative overflow-hidden">
            <Zap
              size={100}
              className="absolute -right-4 -bottom-4 text-white/10"
            />
            <Zap size={24} className="mb-2 opacity-80" />
            <div className="relative z-10">
              <p className="text-[10px] md:text-xs font-bold opacity-70 uppercase tracking-widest">
                Season Win Rate
              </p>
              <h4 className="text-3xl md:text-4xl font-black">
                {currentYearStats.winRate}%
              </h4>
            </div>
          </div>
          <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-32 md:h-40">
            <Target size={24} className="mb-2 text-blue-500" />
            <div>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
                Avg Scored
              </p>
              <h4 className="text-3xl md:text-4xl font-black text-ssu-black">
                {currentYearStats.avgScored}{" "}
                <span className="text-sm text-slate-400 font-bold">골</span>
              </h4>
            </div>
          </div>
          <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between h-32 md:h-40">
            <Shield size={24} className="mb-2 text-purple-500" />
            <div>
              <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">
                Avg Conceded
              </p>
              <h4 className="text-3xl md:text-4xl font-black text-ssu-black">
                {currentYearStats.avgConceded}{" "}
                <span className="text-sm text-slate-400 font-bold">실점</span>
              </h4>
            </div>
          </div>
          <div className="bg-ssu-black text-[#FFD60A] p-5 md:p-6 rounded-3xl shadow-xl flex flex-col justify-between h-32 md:h-40 relative overflow-hidden">
            <Heart
              size={100}
              className="absolute -right-4 -bottom-4 text-white/5"
            />
            <Heart size={24} className="mb-2" />
            <div className="relative z-10">
              <p className="text-[10px] md:text-xs font-bold opacity-70 uppercase tracking-widest">
                Total Fan Likes
              </p>
              <h4 className="text-3xl md:text-4xl font-black">
                {crmStats.totalLikes.toLocaleString()}
              </h4>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* ⚽ 파트 A. 경기 데이터 기반 인사이트 (연도 선택 가능) */}
      {/* ===================================================================== */}
      <section className="space-y-6 bg-slate-50 -mx-6 md:-mx-10 px-6 md:px-10 py-10 rounded-[3rem] border border-slate-200/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-ssu-blue" size={24} />
            <h3 className="text-2xl font-black text-ssu-black">
              경기 데이터 인사이트
            </h3>
          </div>

          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
            <Filter size={16} className="text-slate-400" />
            <select
              className="bg-transparent text-sm font-black text-ssu-black outline-none cursor-pointer"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}년 시즌
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-8 rounded-4xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-8">
              <div>
                <p className="text-sm font-black text-slate-500 flex items-center gap-2 mb-1">
                  <Clock size={16} className="text-ssu-blue" /> Scoring Time
                  Distribution
                </p>
                <h4 className="text-xl font-black text-ssu-black">
                  시간대별 득점 집중도
                </h4>
              </div>
              <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-black">
                {selectedYear}년 총 {selectedYearMatchStats.scored}골
              </div>
            </div>

            <div className="flex items-end justify-between gap-2 h-40 mt-4">
              {Object.entries(selectedYearMatchStats.timeSlots).map(
                ([slot, count]) => {
                  const max = Math.max(
                    ...Object.values(selectedYearMatchStats.timeSlots),
                    1,
                  );
                  const height = (count / max) * 100;
                  return (
                    <div
                      key={slot}
                      className="flex-1 flex flex-col items-center gap-2 group h-full justify-end"
                    >
                      <span
                        className={`text-xs font-black ${count > 0 ? "text-ssu-black" : "text-transparent"}`}
                      >
                        {count}
                      </span>
                      <div className="w-full bg-slate-100 rounded-t-xl relative flex items-end overflow-hidden h-[80%]">
                        <div
                          className="w-full bg-ssu-blue transition-all duration-1000 group-hover:bg-indigo-600"
                          style={{ height: `${height}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                        {slot}
                      </span>
                    </div>
                  );
                },
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-linear-to-br from-slate-100 to-white p-6 rounded-4xl border border-slate-200 shadow-sm h-full flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                  <Flame size={24} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Comeback Wins
                  </p>
                  <p className="text-xl font-black text-ssu-black">
                    역전승{" "}
                    <span className="text-2xl text-orange-500 ml-1">
                      {selectedYearMatchStats.comebackWins}
                    </span>
                    회
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <Activity size={24} className="text-green-500" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Clean Sheets
                  </p>
                  <p className="text-xl font-black text-ssu-black">
                    무실점{" "}
                    <span className="text-2xl text-green-500 ml-1">
                      {selectedYearMatchStats.cleanSheets}
                    </span>
                    경기
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <TrendingUp size={28} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Key Contributor
              </p>
              <h5 className="font-black text-ssu-black text-lg">
                {selectedYearPlayerInsights.winContributor
                  ? selectedYearPlayerInsights.winContributor.name
                  : "데이터 없음"}
              </h5>
              <p className="text-xs font-bold text-blue-600 mt-1">
                {selectedYearPlayerInsights.winContributor
                  ? `팀 승리기여도 ${selectedYearPlayerInsights.contribScore}pt`
                  : "-"}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
              <Crosshair size={28} className="text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                PSO Specialist
              </p>
              <h5 className="font-black text-ssu-black text-lg">
                {selectedYearPlayerInsights.psoSpecialist
                  ? selectedYearPlayerInsights.psoSpecialist.name
                  : "데이터 없음"}
              </h5>
              <p className="text-xs font-bold text-orange-500 mt-1">
                {selectedYearPlayerInsights.psoSpecialist
                  ? `승부차기 ${selectedYearPlayerInsights.psoSpecialist.psoDataText}`
                  : "-"}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-yellow-50 border border-yellow-100 flex items-center justify-center shrink-0">
              <Award size={28} className="text-yellow-600" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                MVP (Most MOMs)
              </p>
              <h5 className="font-black text-ssu-black text-lg">
                {selectedYearPlayerInsights.topMomPlayer
                  ? selectedYearPlayerInsights.topMomPlayer.name
                  : "데이터 없음"}
              </h5>
              <p className="text-xs font-bold text-yellow-600 mt-1">
                {selectedYearPlayerInsights.topMomPlayer
                  ? `MOM 선정 ${selectedYearPlayerInsights.topMomPlayer.stats?.years?.[selectedYear]?.mom}회`
                  : "-"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 👥 파트 B. CRM 및 팬 인게이지먼트 (누적) */}
      {/* ===================================================================== */}
      <section className="space-y-6 pt-8">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Users className="text-[#FFD60A]" size={24} />
          <h3 className="text-2xl font-black text-ssu-black">CRM 인사이트</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <p className="text-sm font-black text-slate-500 mb-6 flex items-center gap-2">
              <Heart size={16} className="text-pink-500" /> Most Loved Players
              (팬 선호도 Top 5)
            </p>
            <div className="space-y-4">
              {crmStats.topLikedPlayers.map((player, idx) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between group cursor-default"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black ${idx === 0 ? "bg-[#FFD60A] text-ssu-black shadow-md" : "bg-slate-50 text-slate-400 border border-slate-100"}`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-base font-black text-ssu-black">
                        {player.name}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {player.position} · No.{player.number}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-pink-50 border border-pink-100 px-4 py-1.5 rounded-full">
                    <Heart size={14} className="text-pink-500 fill-pink-500" />
                    <span className="text-sm font-black text-pink-600">
                      {player.likes || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-linear-to-r from-ssu-black to-slate-800 p-8 rounded-4xl text-white relative overflow-hidden flex-1 flex flex-col justify-center">
              <MessageSquare className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5 rotate-12" />
              <div className="relative z-10">
                <p className="text-xs font-bold text-white/60 mb-2 tracking-widest uppercase">
                  Admin Action Needed
                </p>
                <h5 className="text-2xl font-black leading-tight mb-4">
                  선수단 응원 댓글
                  <br />
                  실시간 모니터링이 필요합니다.
                </h5>
                <p className="text-sm font-medium text-white/70 mb-6">
                  팬들의 악성 댓글이나 스팸 메시지가 없는지 주기적으로 확인해
                  주세요.
                </p>
                <button className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[#FFD60A] hover:gap-4 transition-all">
                  Go to Player Management <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 📅 파트 C. 최근 경기 요약 (로깅 바로가기) */}
      {/* ===================================================================== */}
      <section className="space-y-6 pt-8 border-t border-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Calendar className="text-ssu-blue" size={24} />
          <h3 className="text-2xl font-black text-ssu-black">
            최근 경기 요약 및 로깅
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.slice(0, 3).map((m) => (
            <div
              key={m.id}
              onClick={() => openLoggingModal(m)}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {m.date}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${m.status === "Finished" ? "bg-slate-100 text-slate-500" : "bg-blue-100 text-ssu-blue"}`}
                >
                  {m.status}
                </span>
              </div>
              <h5 className="font-black text-lg text-ssu-black group-hover:text-ssu-blue transition-colors truncate">
                vs {m.opponent}
              </h5>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-3xl font-black">
                  {m.homeScore} : {m.awayScore}
                </p>
                <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-ssu-blue group-hover:text-white group-hover:border-ssu-blue transition-all">
                  <ChevronRight size={20} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
