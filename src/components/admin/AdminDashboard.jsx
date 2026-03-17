import React, { useMemo } from "react";
import {
  Zap,
  Target,
  Users,
  TrendingUp,
  Clock,
  ShieldAlert,
  Award,
  MessageSquare,
  Heart,
  ChevronRight,
  Flame,
  Activity,
  Calendar,
} from "lucide-react";

const AdminDashboard = ({ matches, players, matchLogs, openLoggingModal }) => {
  // =====================================================================
  // 📊 1. 경기 관련 인사이트 (Match Insights Logic)
  // =====================================================================
  const matchStats = useMemo(() => {
    const finishedMatches = matches.filter((m) => m.status === "Finished");

    let comebackWins = 0; // 역전승
    let cleanSheets = 0; // 무실점 경기
    let totalGoals = 0; // 총 득점
    let totalConceded = 0; // 총 실점
    let pkGoals = 0; // PK 득점

    // 시간대별 득점 분포 (15분 단위)
    const timeSlots = {
      "0-15": 0,
      "16-30": 0,
      "31-45": 0,
      "46-60": 0,
      "61-75": 0,
      "76-90": 0,
      "90+": 0,
    };

    finishedMatches.forEach((m) => {
      const isHome = m.isHome;
      const ssuScore = isHome ? m.homeScore : m.awayScore;
      const oppScore = isHome ? m.awayScore : m.homeScore;

      totalGoals += ssuScore;
      totalConceded += oppScore;
      if (oppScore === 0) cleanSheets++;

      // 역전승 판단 (단순 스코어로는 한계가 있으나 로깅된 goals의 순서/시간으로 판단 가능)
      // 여기서는 숭실대 실점이 먼저 있고 최종 승리한 케이스를 역전승으로 간주 (간이 로직)
      const ssuGoals = m.matchData?.goals || [];
      const oppConcedes = m.matchData?.concedes || [];
      if (ssuScore > oppScore && oppConcedes.length > 0) {
        const firstOppGoal = Math.min(
          ...oppConcedes.map((c) => Number(c.minute)),
        );
        const hasGoalAfterBeingDown = ssuGoals.some(
          (g) => Number(g.minute) > firstOppGoal,
        );
        if (hasGoalAfterBeingDown) comebackWins++;
      }

      // 시간대별 득점 및 PK 집계
      ssuGoals.forEach((g) => {
        if (g.isPk) pkGoals++;
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

    return {
      finishedCount: finishedMatches.length,
      totalGoals,
      totalConceded,
      cleanSheets,
      comebackWins,
      pkGoals,
      timeSlots,
      winRate: finishedMatches.length
        ? (
            (finishedMatches.filter((m) =>
              m.isHome ? m.homeScore > m.awayScore : m.awayScore > m.homeScore,
            ).length /
              finishedMatches.length) *
            100
          ).toFixed(1)
        : 0,
    };
  }, [matches]);

  // =====================================================================
  // 👥 2. CRM 인사이트 (팬 참여도 및 선수 인기 Logic)
  // =====================================================================
  const crmStats = useMemo(() => {
    const totalLikes = players.reduce((acc, p) => acc + (p.likes || 0), 0);
    const topLikedPlayers = [...players]
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, 5);

    // 이 부분은 실시간 댓글 컬렉션을 가져와야 하므로,
    // 여기서는 match_logs나 players의 기본 메타데이터로 대체하거나 샘플링합니다.
    return { totalLikes, topLikedPlayers };
  }, [players]);

  return (
    <div className="space-y-10 pb-10">
      {/* 🚀 상단 헤더: 핵심 지표 (Quick View) */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-ssu-blue text-white p-6 rounded-3xl shadow-lg shadow-blue-100 flex flex-col justify-between">
          <Zap size={24} className="mb-4 opacity-80" />
          <div>
            <p className="text-xs font-bold opacity-70 uppercase tracking-widest">
              Season Win Rate
            </p>
            <h4 className="text-4xl font-black">{matchStats.winRate}%</h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <Activity size={24} className="mb-4 text-ssu-blue" />
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Clean Sheets
            </p>
            <h4 className="text-4xl font-black text-ssu-black">
              {matchStats.cleanSheets}
            </h4>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <Flame size={24} className="mb-4 text-orange-500" />
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Comeback Wins
            </p>
            <h4 className="text-4xl font-black text-ssu-black">
              {matchStats.comebackWins}
            </h4>
          </div>
        </div>
        <div className="bg-ssu-black text-[#FFD60A] p-6 rounded-3xl shadow-xl flex flex-col justify-between">
          <Heart size={24} className="mb-4" />
          <div>
            <p className="text-xs font-bold opacity-70 uppercase tracking-widest">
              Total Fan Likes
            </p>
            <h4 className="text-4xl font-black">
              {crmStats.totalLikes.toLocaleString()}
            </h4>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ⚽ SECTION A: 경기 관련 인사이트 */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-ssu-black flex items-center gap-2">
              <Target className="text-ssu-blue" /> Match Technical Insights
            </h3>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
            {/* 시간대별 득점분포 바 차트 */}
            <div>
              <p className="text-sm font-black text-slate-500 mb-6 flex items-center gap-2">
                <Clock size={16} /> Scoring Time Distribution (득점 집중 시간대)
              </p>
              <div className="flex items-end justify-between gap-2 h-32">
                {Object.entries(matchStats.timeSlots).map(([slot, count]) => {
                  const max = Math.max(
                    ...Object.values(matchStats.timeSlots),
                    1,
                  );
                  const height = (count / max) * 100;
                  return (
                    <div
                      key={slot}
                      className="flex-1 flex flex-col items-center gap-2 group"
                    >
                      <div className="w-full bg-slate-100 rounded-t-lg relative flex items-end overflow-hidden h-full">
                        <div
                          className="w-full bg-ssu-blue transition-all duration-1000 group-hover:bg-ssu-black"
                          style={{ height: `${height}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">
                        {slot}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
                  Penalty Kick Goals
                </p>
                <p className="text-2xl font-black text-ssu-black">
                  {matchStats.pkGoals}{" "}
                  <span className="text-sm text-slate-400">골</span>
                </p>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
                  Avg. Goals per Match
                </p>
                <p className="text-2xl font-black text-ssu-black">
                  {matchStats.finishedCount
                    ? (
                        matchStats.totalGoals / matchStats.finishedCount
                      ).toFixed(1)
                    : 0}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 👥 SECTION B: CRM 인사이트 */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-ssu-black flex items-center gap-2">
              <Users className="text-[#FFD60A]" /> Fan Engagement & CRM
            </h3>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-full">
            <p className="text-sm font-black text-slate-500 mb-6 flex items-center gap-2">
              <Award size={16} /> Most Loved Players (팬 선호도 순위)
            </p>
            <div className="space-y-4">
              {crmStats.topLikedPlayers.map((player, idx) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between group cursor-default"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${idx === 0 ? "bg-[#FFD60A] text-ssu-black" : "bg-slate-100 text-slate-400"}`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-black text-ssu-black">
                        {player.name}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400">
                        {player.position} · No.{player.number}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-pink-50 px-3 py-1 rounded-full">
                    <Heart size={12} className="text-pink-500 fill-pink-500" />
                    <span className="text-xs font-black text-pink-600">
                      {player.likes || 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100">
              <div className="bg-linear-to-r from-ssu-black to-slate-800 p-6 rounded-3xl text-white relative overflow-hidden">
                <MessageSquare className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 rotate-12" />
                <p className="text-xs font-bold text-white/60 mb-1">
                  Admin Action Needed
                </p>
                <h5 className="text-lg font-black leading-tight">
                  선수단 응원 댓글
                  <br />
                  모니터링이 필요합니다.
                </h5>
                <button className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#FFD60A] hover:gap-3 transition-all">
                  Go to Player Management <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 📅 최근 경기 요약 (로깅 바로가기) */}
      <section className="space-y-6">
        <h3 className="text-xl font-black text-ssu-black flex items-center gap-2">
          <Calendar className="text-ssu-blue" /> Recent Match Action
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.slice(0, 3).map((m) => (
            <div
              key={m.id}
              onClick={() => openLoggingModal(m)}
              className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
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
              <h5 className="font-black text-ssu-black group-hover:text-ssu-blue transition-colors">
                vs {m.opponent}
              </h5>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-2xl font-black">
                  {m.homeScore} : {m.awayScore}
                </p>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-ssu-blue group-hover:text-white transition-all">
                  <ChevronRight size={16} />
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
