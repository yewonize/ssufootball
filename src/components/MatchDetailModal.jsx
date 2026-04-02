import React, { useMemo } from "react";
import {
  X,
  MapPin,
  Calendar,
  Activity,
  Star,
  Target,
  Users,
  Swords,
  PlayCircle,
  BookOpen,
  Mic,
  ActivitySquare,
  User,
} from "lucide-react";
import { useData } from "../contexts/DataContext";

const MatchDetailModal = ({ match, onClose }) => {
  const { players, matches } = useData();

  if (!match) return null;

  // 1. 경기 연도 추출 및 기본 데이터 가공
  const matchYear = match?.date
    ? String(match.date.split("-")[0])
    : new Date().getFullYear().toString();
  const isHome = match?.isHome;

  const getPlayer = (playerIdOrName) => {
    if (!playerIdOrName) return null;
    return (
      players.find(
        (p) => p.id === playerIdOrName || p.name === playerIdOrName,
      ) || null
    );
  };

  const getPlayerNum = (player) => {
    if (!player) return "-";
    if (
      player.seasons &&
      player.seasons[matchYear] &&
      player.seasons[matchYear].number
    ) {
      return player.seasons[matchYear].number;
    }
    return player.number || "-";
  };

  const ssuGoals = useMemo(() => {
    if (!match?.matchData?.goals) return [];
    return match.matchData.goals
      .map((g) => ({ ...g, player: getPlayer(g.scorer) }))
      .sort((a, b) => Number(a.minute) - Number(b.minute));
  }, [match, players]);

  // 2. 선발 선수 및 교체 선수 목록
  const flatStarters = useMemo(() => {
    if (!match?.matchData?.startingLineup) return [];
    return match.matchData.startingLineup
      .map((pData) => getPlayer(pData.id))
      .filter(Boolean);
  }, [match, players]);

  const subsList = useMemo(() => {
    if (!match?.matchData?.substitutions) return [];
    return match.matchData.substitutions
      .filter((s) => s.inPlayerId)
      .map((s) => ({
        player: getPlayer(s.inPlayerId),
        outPlayer: getPlayer(s.outPlayerId),
        minute: s.minute,
      }))
      .filter((s) => s.player)
      .sort((a, b) => Number(a.minute) - Number(b.minute));
  }, [match, players]);

  // 3. 승부차기 담당 골키퍼
  const finalGk = useMemo(() => {
    if (!match?.matchData?.startingLineup) return null;
    let currentGkId = match.matchData.startingLineup.find(
      (p) => getPlayer(p.id)?.position === "GK",
    )?.id;

    if (match.matchData.substitutions) {
      const sortedSubs = [...match.matchData.substitutions].sort(
        (a, b) => Number(a.minute) - Number(b.minute),
      );
      sortedSubs.forEach((s) => {
        if (s.outPlayerId === currentGkId) currentGkId = s.inPlayerId;
      });
    }
    return getPlayer(currentGkId);
  }, [match, players]);

  const parseMatchTime = (minStr) => {
    const str = String(minStr || "0");

    // 1. 표시용: 입력받은 그대로 혹은 뒤에 '를 붙임
    const display = str;

    // 2. 위치 계산용 (Position): 45+n은 45로, 90+n은 90으로 고정
    let position = 0;
    // 3. 정렬용 (Sort): 45 < 45+1 < 45+2 < 46 순서가 되도록 소수점 활용
    let sort = 0;

    if (str.includes("+")) {
      const [base, extra] = str.split("+").map(Number);
      position = base; // 45+1 -> 45분 지점, 90+5 -> 90분 지점
      sort = base + extra * 0.01; // 45.01, 45.02 등으로 정렬순서만 뒤로 밀어냄
    } else {
      const num = Number(str);
      position = num;
      sort = num;
    }

    return { display, position, sort };
  };

  // 4. 타임라인 이벤트 계산
  const timelineEvents = useMemo(() => {
    if (!match?.matchData) return [];
    const events = [];

    const processEvent = (rawEv, type, isSsu) => {
      const { display, position, sort } = parseMatchTime(rawEv.minute);

      const eventObj = {
        type,
        isSsu,
        display, // "45+2"
        positionValue: position, // 45
        sortValue: sort, // 45.02
        min: position, // 기존 코드와 호환성을 위해 유지
      };

      if (type === "goal") {
        const p = getPlayer(rawEv.scorer);
        eventObj.playerName = p ? p.name : "미상";
      } else if (type === "sub") {
        const inP = getPlayer(rawEv.inPlayerId);
        const outP = getPlayer(rawEv.outPlayerId);
        eventObj.playerName = inP ? inP.name : "미상";
        eventObj.outName = outP ? outP.name : "미상";
      }

      return eventObj;
    };

    // 득점, 실점, 교체 데이터 처리
    match.matchData.goals?.forEach((g) =>
      events.push(processEvent(g, "goal", true)),
    );
    match.matchData.concedes?.forEach((c) =>
      events.push(processEvent(c, "concede", false)),
    );
    match.matchData.substitutions?.forEach((s) =>
      events.push(processEvent(s, "sub", true)),
    );

    return events
      .sort((a, b) => a.sortValue - b.sortValue) // 45 -> 45.01 -> 45.02 순으로 정렬
      .map((ev) => ({
        ...ev,
        // 90분 고정 타임라인에서 위치 계산 (최대 100%)
        position: `${Math.min((ev.positionValue / 90) * 100, 100)}%`,
      }));
  }, [match, players]);

  // 5. 상대전적(H2H) 계산
  const h2hStats = useMemo(() => {
    const history = matches
      .filter((m) => m.opponent === match.opponent && m.status === "Finished")
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    let wins = 0,
      draws = 0,
      losses = 0;
    history.forEach((m) => {
      const ssu = m.isHome ? m.homeScore : m.awayScore;
      const opp = m.isHome ? m.awayScore : m.homeScore;
      if (ssu > opp) wins++;
      else if (ssu === opp) draws++;
      else losses++;
    });
    return { wins, draws, losses, history };
  }, [matches, match]);

  // MOM 선수
  const momPlayer = useMemo(() => {
    if (!match?.mom || match.mom === "-") return null;
    return players.find((p) => p.name === match.mom);
  }, [match, players]);

  return (
    <div
      className="fixed inset-0 z-1000 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#f8f9fa] rounded-4xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden relative font-['Pretendard'] text-[#191c1d]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 md:top-6 right-4 md:right-6 z-50 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-full p-2 transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <section className="flex flex-col gap-6 md:gap-8 p-4 md:p-8 animate-fade-in">
            {/* 🏆 Hero Score Section */}
            <div className="relative rounded-2xl overflow-hidden min-h-50 md:min-h-75 flex flex-col items-center justify-center p-6 bg-ssu-black shadow-2xl pt-10 md:pt-20">
              <div className="absolute inset-0 w-full h-full bg-linear-to-br from-ssu-black to-ssu-dark opacity-90"></div>
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at center, rgba(255,255,255,0.2) 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }}
              ></div>

              <div className="relative z-20 mb-6 md:mb-8 flex items-center gap-2 md:gap-3 bg-white/10 backdrop-blur-md px-4 md:px-6 py-2 md:py-2.5 rounded-full text-white/90 text-[10px] md:text-sm font-bold shadow-sm border border-white/5 whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-ssu-light" /> {match.date}{" "}
                  <span className="hidden sm:inline">{match.time}</span>
                </div>
                <span className="text-white/30 mx-1 md:mx-2">|</span>
                <div className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-ssu-light" />{" "}
                  <span className="truncate max-w-30 sm:max-w-none">
                    {match.venue || "장소 미정"}
                  </span>
                </div>
              </div>

              <div className="relative z-10 w-full flex flex-col items-center gap-6 md:gap-8 text-white">
                <div className="flex items-center justify-between w-full max-w-4xl gap-2 md:gap-4">
                  {/* Home Team */}
                  <div className="flex flex-col items-center gap-2 text-center flex-1 min-w-0">
                    <div className="w-full">
                      {/* 🔥 모바일 텍스트 겹침/잘림 방지: whitespace-nowrap & 사이즈 최적화 */}
                      <h3 className="font-black text-xs sm:text-sm md:text-3xl tracking-tight whitespace-nowrap">
                        {isHome ? "숭실대" : match.opponent}
                      </h3>
                      <p className="text-[10px] md:text-sm font-medium text-ssu-light mt-0.5 md:mt-1">
                        Home
                      </p>
                    </div>
                  </div>

                  {/* Main Score */}
                  <div className="flex flex-col items-center shrink-0">
                    <div className="flex items-baseline gap-2 sm:gap-4 md:gap-6 mb-2 md:mb-3">
                      {/* 🔥 모바일 점수 크기 최적화 (text-5xl) */}
                      <span
                        className={`text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter ${isHome ? "text-ssu-light" : "text-white"}`}
                      >
                        {match.homeScore}
                      </span>
                      <span className="text-2xl sm:text-3xl md:text-8xl font-medium text-white/40">
                        -
                      </span>
                      <span
                        className={`text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter ${!isHome ? "text-ssu-light" : "text-white"}`}
                      >
                        {match.awayScore}
                      </span>
                    </div>

                    {match.pso && (
                      <div className="bg-black/30 border border-white/10 text-[#FFD60A] px-3 py-1 md:px-4 md:py-1.5 rounded-lg text-xs md:text-base font-black tracking-widest mb-3 flex items-center gap-1.5 md:gap-2">
                        PSO {match.pso}
                      </div>
                    )}

                    <div className="bg-ssu-blue text-white px-4 py-1 md:px-6 md:py-1.5 rounded-full text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase shadow-lg whitespace-nowrap">
                      {match.status === "Finished" ? "Full Time" : "Upcoming"}
                    </div>
                  </div>

                  {/* Away Team */}
                  <div className="flex flex-col items-center gap-2 text-center flex-1 min-w-0">
                    <div className="w-full">
                      {/* 🔥 모바일 텍스트 겹침/잘림 방지 */}
                      <h3 className="font-black text-xs sm:text-sm md:text-3xl tracking-tight whitespace-nowrap">
                        {!isHome ? "숭실대" : match.opponent}
                      </h3>
                      <p className="text-[10px] md:text-sm font-medium text-slate-300 mt-0.5 md:mt-1">
                        Away
                      </p>
                    </div>
                  </div>
                </div>

                {/* ⚽ Scorers Grid */}
                {match.status === "Finished" && ssuGoals.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:gap-4 md:gap-20 w-full max-w-2xl border-t border-white/10 pt-4 md:pt-6 mt-2 z-20">
                    <div className="flex flex-col gap-1.5 md:gap-2 text-right">
                      {isHome &&
                        ssuGoals.map((g, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-end gap-1.5 md:gap-2 text-[11px] md:text-sm font-medium whitespace-nowrap"
                          >
                            <span className="truncate">
                              {g.player?.name || "미상"} {g.minute}'{" "}
                              {g.isPk && "(PK)"}
                            </span>
                            <ActivitySquare
                              size={14}
                              className="text-ssu-light shrink-0"
                            />
                          </div>
                        ))}
                    </div>
                    <div className="flex flex-col gap-1.5 md:gap-2 text-left">
                      {!isHome &&
                        ssuGoals.map((g, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-start gap-1.5 md:gap-2 text-[11px] md:text-sm font-medium whitespace-nowrap"
                          >
                            <ActivitySquare
                              size={14}
                              className="text-ssu-light shrink-0"
                            />
                            <span className="truncate">
                              {g.player?.name || "미상"} {g.minute}'{" "}
                              {g.isPk && "(PK)"}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Media Links in Hero Section */}
                {match.status === "Finished" &&
                  (match.media?.highlight ||
                    match.media?.report ||
                    match.media?.interview) && (
                    <div className="w-full max-w-3xl flex justify-center md:mt-6 z-20">
                      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
                        {match.media.highlight && (
                          <a
                            href={match.media.highlight}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-red-500/20 hover:bg-red-500/40 text-red-100 border border-red-500/30 rounded-full font-bold text-[10px] md:text-xs transition backdrop-blur-md"
                          >
                            <PlayCircle size={14} className="md:w-4 md:h-4" />{" "}
                            하이라이트
                          </a>
                        )}
                        {match.media.report && (
                          <a
                            href={match.media.report}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-green-500/20 hover:bg-green-500/40 text-green-100 border border-green-500/30 rounded-full font-bold text-[10px] md:text-xs transition backdrop-blur-md"
                          >
                            <BookOpen size={14} className="md:w-4 md:h-4" />{" "}
                            경기 상보
                          </a>
                        )}
                        {match.media.interview && (
                          <a
                            href={match.media.interview}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-ssu-blue/30 hover:bg-ssu-blue/50 text-ssu-light border border-ssu-blue/40 rounded-full font-bold text-[10px] md:text-xs transition backdrop-blur-md"
                          >
                            <Mic size={14} className="md:w-4 md:h-4" /> MOM
                            인터뷰
                          </a>
                        )}
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* 🍱 Bento Grid: Analytics Details */}
            {match.status === "Finished" ? (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* ⏱️ Match Timeline */}
                <div className="xl:col-span-12 bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
                  <h4 className="font-black text-base md:text-lg text-ssu-black mb-6 md:mb-10 flex items-center gap-2 uppercase tracking-tight">
                    <Activity size={18} className="text-ssu-blue" /> Match
                    Timeline
                  </h4>

                  {/* 🔥 PC 화면 (가로형 타임라인) */}
                  <div className="hidden md:flex relative h-3 bg-slate-100 rounded-full w-full items-center mb-4">
                    <div className="absolute inset-0 flex justify-between items-center px-2 -top-6 pointer-events-none">
                      <span className="text-xs font-black text-slate-400">
                        0'
                      </span>
                      <span className="text-xs font-black text-slate-400">
                        HT
                      </span>
                      <span className="text-xs font-black text-slate-400">
                        90'
                      </span>
                    </div>
                    <div className="relative w-full h-full">
                      {timelineEvents.map((ev, i) => (
                        <div
                          key={i}
                          className="absolute top-1/2 group"
                          style={{ left: ev.position }}
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md transform -translate-x-1/2 -translate-y-1/2 border-2 cursor-default
                            ${
                              ev.type === "goal"
                                ? ev.isSsu
                                  ? "bg-[#FFD60A] border-white z-20"
                                  : "bg-red-500 border-white z-10"
                                : ev.type === "sub"
                                  ? "bg-slate-100 border-slate-300 z-0"
                                  : "bg-white border-red-500 z-10"
                            }`}
                          >
                            <span className="text-[10px] font-black">
                              {ev.display}'
                            </span>
                          </div>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-[11px] font-bold py-1 px-2.5 rounded whitespace-nowrap z-30 shadow-lg">
                            {ev.type === "goal"
                              ? `⚽ ${ev.playerName} 득점`
                              : ev.type === "sub"
                                ? `🔄 IN ${ev.playerName} / OUT ${ev.outName}`
                                : "🥅 실점"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 🔥 모바일 화면 (세로형 타임라인 - UX 대폭 상향) */}
                  <div className="block md:hidden relative pl-6 border-l-2 border-slate-100 space-y-4 my-2">
                    {timelineEvents.map((ev, i) => (
                      <div key={i} className="relative flex items-center gap-3">
                        <div
                          className={`absolute -left-8.75 w-7 h-7 rounded-full flex items-center justify-center shadow-sm border-2 
                          ${
                            ev.type === "goal"
                              ? ev.isSsu
                                ? "bg-[#FFD60A] border-white"
                                : "bg-red-500 border-white text-white"
                              : ev.type === "sub"
                                ? "bg-slate-100 border-slate-300"
                                : "bg-white border-red-500"
                          }`}
                        >
                          <span className="text-[9px] font-black">
                            {ev.display}'
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl flex-1 border border-slate-100 shadow-sm">
                          <span className="text-[11px] font-bold text-ssu-black">
                            {ev.type === "goal"
                              ? `⚽ ${ev.playerName} 득점`
                              : ev.type === "sub"
                                ? `🔄 IN ${ev.playerName} / OUT ${ev.outName}`
                                : "🥅 실점"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {timelineEvents.length === 0 && (
                      <p className="text-xs text-slate-400 font-bold py-4 text-center border border-dashed border-slate-200 rounded-xl">
                        기록된 이벤트가 없습니다.
                      </p>
                    )}
                  </div>

                  {/* 🎯 승부차기 타임라인 */}
                  {match.matchData?.psoData &&
                    (match.matchData.psoData.ourKickers?.length > 0 ||
                      match.matchData.psoData.oppKickers?.length > 0) && (
                      <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-slate-100">
                        <h5 className="font-black text-sm md:text-md text-ssu-black mb-4 flex items-center gap-2 uppercase tracking-tight">
                          <Target size={16} className="text-ssu-blue" /> Penalty
                          Shootout
                        </h5>
                        <div className="overflow-x-auto custom-scrollbar pb-2">
                          <div className="flex gap-3 md:gap-4 min-w-max">
                            <div className="flex flex-col gap-2 md:gap-3 min-w-25 md:min-w-30 justify-end pb-2">
                              <div className="h-4"></div>
                              <div className="h-8 md:h-10 flex items-center font-black text-ssu-blue text-xs md:text-sm">
                                숭실대{" "}
                                {match.matchData.psoData.firstKick === "us" && (
                                  <span className="ml-1 text-[9px] md:text-[10px] bg-blue-50 px-1 rounded">
                                    (선축)
                                  </span>
                                )}
                              </div>
                              <div className="h-8 md:h-10 flex items-center font-black text-slate-600 text-xs md:text-sm">
                                {match.opponent}{" "}
                                {match.matchData.psoData.firstKick ===
                                  "them" && (
                                  <span className="ml-1 text-[9px] md:text-[10px] bg-slate-100 px-1 rounded">
                                    (선축)
                                  </span>
                                )}
                              </div>
                            </div>

                            {Array.from({
                              length: Math.max(
                                match.matchData.psoData.ourKickers?.length || 0,
                                match.matchData.psoData.oppKickers?.length || 0,
                              ),
                            }).map((_, i) => {
                              const ourKicker =
                                match.matchData.psoData.ourKickers?.[i];
                              const oppKicker =
                                match.matchData.psoData.oppKickers?.[i];
                              const ourPlayer = ourKicker
                                ? getPlayer(ourKicker.kickerId)
                                : null;

                              return (
                                <div
                                  key={i}
                                  className="flex flex-col gap-2 md:gap-3 items-center w-14 md:w-16 shrink-0 pb-2"
                                >
                                  <div className="h-4 flex items-center font-black text-slate-400 text-[9px] md:text-[10px] uppercase">
                                    R {i + 1}
                                  </div>

                                  <div className="h-8 md:h-10 flex flex-col items-center justify-center w-full">
                                    {ourKicker ? (
                                      <>
                                        <div
                                          className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-white text-[10px] md:text-[11px] font-black shadow-sm ${ourKicker.result === "O" ? "bg-green-500" : "bg-red-500"}`}
                                        >
                                          {ourKicker.result}
                                        </div>
                                        <span className="text-[8px] md:text-[9px] font-bold text-slate-500 mt-1 truncate w-14 md:w-16 text-center">
                                          {ourPlayer?.name || "미상"}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </div>

                                  <div className="h-8 md:h-10 flex flex-col items-center justify-center w-full">
                                    {oppKicker ? (
                                      <div
                                        className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-white text-[10px] md:text-[11px] font-black shadow-sm ${oppKicker.result === "O" ? "bg-green-500" : "bg-red-500"}`}
                                      >
                                        {oppKicker.result}
                                      </div>
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* 골키퍼 정보 */}
                        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3 md:p-4 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-2">
                            <User size={16} className="text-purple-500" />
                            <span className="text-[11px] md:text-sm font-bold text-slate-600">
                              골키퍼:
                            </span>
                            <span className="text-xs md:text-base font-black text-ssu-black">
                              {finalGk ? finalGk.name : "미상"}
                            </span>
                          </div>
                          <div className="text-[11px] md:text-sm font-bold text-slate-500">
                            선방:{" "}
                            <span className="text-red-500 font-black text-base md:text-lg ml-1">
                              {match.matchData.psoData.oppKickers?.filter(
                                (k) => k.result === "X",
                              ).length || 0}
                            </span>
                            회
                          </div>
                        </div>
                      </div>
                    )}
                </div>

                {/* 📋 Match Squad (목록형 명단) */}
                <div className="xl:col-span-7 bg-ssu-black p-6 md:p-8 rounded-2xl relative overflow-hidden flex flex-col">
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at center, rgba(255,255,255,0.4) 1px, transparent 1px)",
                      backgroundSize: "30px 30px",
                    }}
                  ></div>

                  <div className="relative z-10 w-full flex flex-col h-full">
                    <h4 className="font-black text-base md:text-lg text-white mb-6 flex items-center gap-2 uppercase tracking-tight">
                      <Users size={18} className="text-ssu-light" /> Match Squad
                    </h4>

                    {/* 선발 라인업 리스트 */}
                    <div className="mb-6 md:mb-8">
                      <h5 className="text-ssu-light font-bold text-xs md:text-sm mb-3 md:mb-4 border-b border-white/20 pb-2">
                        Starting XI
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                        {flatStarters.map((p, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 md:gap-3 bg-white/5 rounded-xl p-2 md:p-3 border border-white/10 hover:bg-white/10 transition-colors"
                          >
                            <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] md:text-xs font-black text-white shrink-0">
                              {getPlayerNum(p)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs md:text-sm font-bold text-white truncate">
                                {p.name}
                              </p>
                              <p className="text-[9px] md:text-[10px] text-ssu-light font-bold">
                                {p.position}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 교체 선수 명단 */}
                    {subsList.length > 0 && (
                      <div>
                        <h5 className="text-[#FFD60A] font-bold text-xs md:text-sm mb-3 md:mb-4 border-b border-white/20 pb-2">
                          Substitutes
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                          {subsList.map((sub, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 md:gap-3 bg-white/5 rounded-xl p-2 md:p-3 border border-white/10 hover:bg-white/10 transition-colors"
                            >
                              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] md:text-xs font-black text-white shrink-0">
                                {getPlayerNum(sub.player)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs md:text-sm font-bold text-white truncate">
                                  {sub.player.name}
                                </p>
                                <p className="text-[9px] md:text-[10px] text-slate-400 font-bold">
                                  {sub.player.position}
                                </p>
                              </div>
                              <div className="text-[9px] md:text-[10px] font-black bg-white/10 px-1.5 md:px-2 py-0.5 md:py-1 rounded text-[#FFD60A] shrink-0">
                                {sub.minute}' IN
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 👑 Key Performers */}
                <div className="xl:col-span-5 flex flex-col gap-6">
                  <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200 flex-1">
                    <h4 className="font-black text-base md:text-lg text-ssu-black mb-4 md:mb-6 uppercase tracking-tight flex items-center gap-2">
                      <Star
                        size={18}
                        className="text-[#FFD60A] fill-[#FFD60A]"
                      />{" "}
                      Key Performers
                    </h4>
                    <div className="flex flex-col gap-3 md:gap-4">
                      {momPlayer && (
                        <div className="flex items-center justify-between p-3 md:p-4 rounded-xl bg-blue-50 border border-blue-200 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white border-2 border-ssu-blue flex items-center justify-center overflow-hidden shrink-0">
                              <span className="text-lg md:text-xl font-black text-ssu-black">
                                {getPlayerNum(momPlayer)}
                              </span>
                            </div>
                            <div>
                              <p className="text-xs md:text-sm font-black text-ssu-black">
                                {match.mom}
                              </p>
                              <p className="text-[10px] md:text-xs font-bold text-ssu-blue flex items-center gap-1 mt-0.5">
                                <Star size={10} className="fill-ssu-blue" /> Man
                                of the Match
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {ssuGoals.map((g, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 md:p-4 rounded-xl bg-slate-50 border border-slate-100"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                              <span className="text-[10px] md:text-xs font-black text-slate-500">
                                {getPlayerNum(g.player)}
                              </span>
                            </div>
                            <div>
                              <p className="text-xs md:text-sm font-bold text-ssu-black">
                                {g.player?.name || "미상"}
                              </p>
                              <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">
                                {g.player?.position || "Player"} • 득점{" "}
                                {g.minute}' {g.isPk && "(PK)"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}

                      {ssuGoals.length === 0 && !match.mom && (
                        <p className="text-xs md:text-sm text-slate-400 text-center py-4 font-bold">
                          기록된 우수 선수가 없습니다.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // ====================================================================
              // ⏳ Upcoming Match View (예정된 경기일 때 H2H 상대전적 표시)
              // ====================================================================
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* 1. 상대전적 통계 요약 */}
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                  <h4 className="font-black text-base md:text-lg text-ssu-black mb-6 md:mb-8 flex items-center gap-2 uppercase tracking-tight">
                    <Swords size={18} className="text-ssu-blue" /> 상대 전적 (vs{" "}
                    {match.opponent})
                  </h4>

                  <div className="flex items-center justify-between px-2 md:px-4 mb-4 md:mb-6">
                    <div className="flex flex-col items-center gap-1 md:gap-2">
                      <span className="text-4xl md:text-5xl font-black text-ssu-blue">
                        {h2hStats.wins}
                      </span>
                      <span className="text-[10px] md:text-xs font-bold text-slate-400">
                        승리
                      </span>
                    </div>
                    <span className="text-xl md:text-2xl font-light text-slate-300">
                      :
                    </span>
                    <div className="flex flex-col items-center gap-1 md:gap-2">
                      <span className="text-4xl md:text-5xl font-black text-slate-600">
                        {h2hStats.draws}
                      </span>
                      <span className="text-[10px] md:text-xs font-bold text-slate-400">
                        무승부
                      </span>
                    </div>
                    <span className="text-xl md:text-2xl font-light text-slate-300">
                      :
                    </span>
                    <div className="flex flex-col items-center gap-1 md:gap-2">
                      <span className="text-4xl md:text-5xl font-black text-red-500">
                        {h2hStats.losses}
                      </span>
                      <span className="text-[10px] md:text-xs font-bold text-slate-400">
                        패배
                      </span>
                    </div>
                  </div>

                  {h2hStats.history.length > 0 ? (
                    <p className="text-center text-[11px] md:text-sm font-bold text-slate-500 mt-2 md:mt-4 bg-slate-50 py-2.5 md:py-3 rounded-xl border border-slate-100">
                      숭실대학교 기준 역대{" "}
                      <span className="text-ssu-black font-black">
                        {h2hStats.history.length}전 {h2hStats.wins}승{" "}
                        {h2hStats.draws}무 {h2hStats.losses}패
                      </span>
                    </p>
                  ) : (
                    <p className="text-center text-[11px] md:text-sm font-bold text-slate-400 mt-2 md:mt-4 bg-slate-50 py-2.5 md:py-3 rounded-xl border border-slate-100">
                      아직 맞대결 기록이 없습니다.
                    </p>
                  )}
                </div>

                {/* 2. 과거 맞대결 히스토리 목록 */}
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-75 md:h-100">
                  <h4 className="font-black text-base md:text-lg text-ssu-black mb-4 md:mb-6 flex items-center gap-2 uppercase tracking-tight shrink-0">
                    <Calendar size={18} className="text-ssu-blue" /> Previous
                    Encounters
                  </h4>

                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 md:pr-2 space-y-2 md:space-y-3">
                    {h2hStats.history.length > 0 ? (
                      h2hStats.history.map((m) => {
                        const mIsHome = m.isHome;
                        const ssu = mIsHome ? m.homeScore : m.awayScore;
                        const opp = mIsHome ? m.awayScore : m.homeScore;
                        const isWin = ssu > opp;
                        const isDraw = ssu === opp;

                        return (
                          <div
                            key={m.id}
                            className="flex justify-between items-center bg-slate-50 p-3 md:p-4 rounded-xl border border-slate-100 hover:border-slate-300 transition cursor-default"
                          >
                            <div className="flex flex-col gap-0.5 md:gap-1">
                              <span className="text-[9px] md:text-[10px] font-bold text-slate-400 tracking-widest">
                                {m.date}
                              </span>
                              <span className="text-xs md:text-sm font-black text-ssu-black">
                                {mIsHome ? "HOME" : "AWAY"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 md:gap-4">
                              <span
                                className={`text-base md:text-xl font-black ${isWin ? "text-ssu-blue" : isDraw ? "text-slate-600" : "text-red-500"}`}
                              >
                                {m.homeScore} : {m.awayScore}
                              </span>
                              <div
                                className={`w-8 md:w-10 text-center py-0.5 md:py-1 rounded text-[9px] md:text-[10px] font-black
                                ${isWin ? "bg-blue-100 text-blue-600" : isDraw ? "bg-slate-200 text-slate-600" : "bg-red-100 text-red-600"}
                              `}
                              >
                                {isWin ? "승" : isDraw ? "무" : "패"}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <Users
                          size={28}
                          className="mb-2 opacity-50 md:w-8 md:h-8"
                        />
                        <p className="text-xs md:text-sm font-bold">
                          첫 맞대결입니다.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default MatchDetailModal;
