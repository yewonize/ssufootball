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
  Calendar,
  MapPin,
  Clock,
  AlertTriangle,
  Users,
  ActivitySquare,
  Flag,
} from "lucide-react";
import {
  writeBatch,
  doc,
  collection,
  increment,
  getDocs,
  query,
  where,
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
  disabled = false,
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
    (p) => p.name.includes(searchTerm) || String(p.number) === searchTerm,
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
      if (currentIndex !== -1 && currentIndex + 1 < focusableElements.length)
        focusableElements[currentIndex + 1].focus();
      else e.target.blur();
    }
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        disabled={disabled}
        className={`w-full p-2.5 border rounded-xl text-sm font-bold outline-none transition-colors ${disabled ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" : "bg-white focus:border-ssu-blue border-slate-200"}`}
        placeholder={placeholder}
        value={isOpen ? searchTerm : selectedPlayer ? selectedPlayer.name : ""}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => !disabled && setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        onKeyDown={handleKeyDown}
      />
      {isOpen && !disabled && filtered.length > 0 && (
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
              </span>
              {p.name}{" "}
              <span className="text-[10px] text-slate-400">({p.position})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// =====================================================================
// ⏱️ 유틸: 축구 정밀 시간(Absolute Minute) 계산기
// =====================================================================
const getAbsoluteMinute = (minStr, et1 = 0) => {
  if (!minStr) return 0;
  const str = String(minStr).toUpperCase().replace(/\s/g, "");
  if (str === "HT") return 45 + Number(et1);

  const match = str.match(/^(\d+)(?:\+(\d+))?$/);
  if (!match) return Number(str) || 0;

  const base = Number(match[1]);
  const added = Number(match[2] || 0);

  if (base <= 45) return base + added;
  if (base === 46 && added === 0) return 45 + Number(et1);
  return base + added + Number(et1);
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
      if (currentIndex !== -1 && currentIndex + 1 < focusableElements.length)
        focusableElements[currentIndex + 1].focus();
      else e.target.blur();
    }
  };

  const matchYear = match?.date
    ? String(match.date.split("-")[0])
    : new Date().getFullYear().toString();
  const currentSysYear = new Date().getFullYear().toString();

  const matchPlayerIds = useMemo(() => {
    const ids = new Set();
    if (match?.matchData?.startingLineup)
      match.matchData.startingLineup.forEach((p) => ids.add(p.id));
    if (match?.matchData?.substitutions)
      match.matchData.substitutions.forEach((s) => {
        if (s.inPlayerId) ids.add(s.inPlayerId);
        if (s.outPlayerId) ids.add(s.outPlayerId);
      });
    if (match?.matchData?.goals)
      match.matchData.goals.forEach((g) => {
        if (g.scorer) ids.add(g.scorer);
        if (g.assist) ids.add(g.assist);
      });
    if (match?.matchData?.cards)
      match.matchData.cards.forEach((c) => {
        if (c.playerId) ids.add(c.playerId);
      });
    if (match?.mom) {
      const mp = players?.find((p) => p.name === match.mom);
      if (mp) ids.add(mp.id);
    }
    return ids;
  }, [match, players]);

  const bulkRoster = useMemo(() => {
    if (!players) return [];
    return players
      .filter((p) => {
        if (!p || !p.id) return false;
        if (matchPlayerIds.has(p.id)) return true;
        if (p.seasons && p.seasons[matchYear]?.status === "current")
          return true;
        if (matchYear === currentSysYear && p.status === "current") return true;
        return false;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        number: p.seasons?.[matchYear]?.number || p.number || "-",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, matchYear, currentSysYear, matchPlayerIds]);

  // 🔥 [핵심 보완] useState 초기값을 0이나 빈칸이 아닌, DB 데이터로 즉시 초기화하여 화면 날림(Truncate) 현상을 원천 차단합니다.
  const initialSsuScore = match?.isHome
    ? match?.homeScore || 0
    : match?.awayScore || 0;
  const initialOppScore = match?.isHome
    ? match?.awayScore || 0
    : match?.homeScore || 0;

  const [matchMeta, setMatchMeta] = useState({
    date: match?.date || "",
    time: match?.time || "",
    venue: match?.venue || "",
    isHome: match?.isHome ?? true,
  });

  const [basicInfo, setBasicInfo] = useState({
    ssuScore: Number(initialSsuScore),
    oppScore: Number(initialOppScore),
    extraTime1: match?.matchData?.extraTime1 || 0,
    extraTime2: match?.matchData?.extraTime2 || 0,
    isPso: !!match?.pso,
    psoScore: match?.pso || "0:0",
    formation: match?.matchData?.formation || "4-4-2",
  });

  const [starters, setStarters] = useState(
    match?.matchData?.startingLineup || [],
  );

  const [subs, setSubs] = useState(() =>
    (match?.matchData?.substitutions || []).map((s) => ({
      ...s,
      id: s.id || Date.now() + Math.random(),
    })),
  );

  const [goals, setGoals] = useState(() => {
    const dbGoals = match?.matchData?.goals || [];
    const score = Number(initialSsuScore);
    const arr = dbGoals.map((g) => ({
      ...g,
      id: g.id || Date.now() + Math.random(),
    }));
    // DB 득점 수보다 점수가 높으면 모자란 만큼 빈칸 생성
    while (arr.length < score)
      arr.push({
        id: Date.now() + Math.random(),
        minute: "",
        scorer: "",
        assist: "",
        isPk: false,
        isOg: false,
      });
    return arr.slice(0, Math.max(score, arr.length));
  });

  const [concedes, setConcedes] = useState(() => {
    const dbConcedes = match?.matchData?.concedes || [];
    const score = Number(initialOppScore);
    const arr = dbConcedes.map((c) => ({
      ...c,
      id: c.id || Date.now() + Math.random(),
      gk: c.gk || "",
    }));
    while (arr.length < score)
      arr.push({ id: Date.now() + Math.random(), minute: "", gk: "" });
    return arr.slice(0, Math.max(score, arr.length));
  });

  const [cards, setCards] = useState(() =>
    (match?.matchData?.cards || []).map((c) => ({
      ...c,
      id: c.id || Date.now() + Math.random(),
    })),
  );

  const [psoData, setPsoData] = useState(
    () =>
      match?.matchData?.psoData || {
        firstKick: "us",
        ourKickers: [],
        oppKickers: [],
      },
  );

  const [selectedMomId, setSelectedMomId] = useState(() => {
    const momPlayer = players?.find((p) => p.name === match?.mom);
    return momPlayer ? momPlayer.id : null;
  });

  const [editMedia, setEditMedia] = useState({
    highlight: match?.media?.highlight || "",
    report: match?.media?.report || "",
    interview: match?.media?.interview || "",
  });

  const [openSection, setOpenSection] = useState("basic");

  // 🔥 [핵심 보완] 외부 요인(players 로드 등)에 의해 입력창이 멋대로 초기화되는 것을 막기 위해, 오직 경기(match.id)가 바뀔 때만 동기화하도록 고정!
  useEffect(() => {
    if (!match) return;

    const mData = match.matchData || {};
    const isHome = match.isHome ?? true;

    // 1. 변수를 상단에서 정의 (그래야 아래에서 공통으로 사용 가능)
    const sScore = Number(isHome ? match.homeScore || 0 : match.awayScore || 0);
    const oScore = Number(isHome ? match.awayScore || 0 : match.homeScore || 0);
    const momName = match.mom || mData.mom;
    const mediaData = match.media || mData.media || {};

    setMatchMeta({
      date: match.date || "",
      time: match.time || "",
      venue: match.venue || "",
      isHome,
    });

    setBasicInfo({
      ssuScore: sScore,
      oppScore: oScore,
      extraTime1: mData.extraTime1 || 0,
      extraTime2: mData.extraTime2 || 0,
      isPso: !!match.pso,
      psoScore: match.pso || "0:0",
      formation: mData.formation || "4-4-2",
    });

    setStarters(match.matchData?.startingLineup || []);
    setSubs(
      (match.matchData?.substitutions || []).map((s) => ({
        ...s,
        id: s.id || Date.now() + Math.random(),
      })),
    );

    let dbGoals = (match.matchData?.goals || []).map((g) => ({
      ...g,
      id: g.id || Date.now() + Math.random(),
    }));
    while (dbGoals.length < sScore)
      dbGoals.push({
        id: Date.now() + Math.random(),
        minute: "",
        scorer: "",
        assist: "",
        isPk: false,
        isOg: false,
      });
    setGoals(dbGoals.slice(0, Math.max(sScore, dbGoals.length)));

    let dbConcedes = (match.matchData?.concedes || []).map((c) => ({
      ...c,
      id: c.id || Date.now() + Math.random(),
      gk: c.gk || "",
    }));
    while (dbConcedes.length < oScore)
      dbConcedes.push({ id: Date.now() + Math.random(), minute: "", gk: "" });
    setConcedes(dbConcedes.slice(0, Math.max(oScore, dbConcedes.length)));

    setCards(
      (match.matchData?.cards || []).map((c) => ({
        ...c,
        id: c.id || Date.now() + Math.random(),
      })),
    );
    setPsoData(
      match.matchData?.psoData || {
        firstKick: "us",
        ourKickers: [],
        oppKickers: [],
      },
    );

    // 2. MOM 처리 (수정된 momName 사용)
    const momPlayer = players?.find((p) => p.name === momName);
    setSelectedMomId(momPlayer ? momPlayer.id : null);

    // 3. Media 처리 (수정된 mediaData 사용)
    setEditMedia({
      highlight: mediaData.highlight || "",
      report: mediaData.report || "",
      interview: mediaData.interview || "",
    });

    setOpenSection("basic");
  }, [match?.id, players]); // 👈 오직 match.id 가 다를 때만 1회 실행됨

  const toggleSection = (sec) =>
    setOpenSection(openSection === sec ? null : sec);

  const handleMetaChange = (field, value) => {
    setMatchMeta((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "venue" && value.trim() === "숭실대학교 대운동장")
        next.isHome = true;
      if (field === "isHome" && value === true)
        next.venue = "숭실대학교 대운동장";
      return next;
    });
  };

  // 득점/실점 입력칸 자동 연동 (이제 초기화 버그 없이 점수를 수동으로 바꿀 때만 정상 작동)
  useEffect(() => {
    setGoals((prev) => {
      const n = [...prev];
      if (n.length < basicInfo.ssuScore) {
        while (n.length < basicInfo.ssuScore)
          n.push({
            id: Date.now() + Math.random(),
            minute: "",
            scorer: "",
            assist: "",
            isPk: false,
            isOg: false,
          });
      } else if (n.length > basicInfo.ssuScore)
        return n.slice(0, basicInfo.ssuScore);
      return n;
    });
  }, [basicInfo.ssuScore]);

  useEffect(() => {
    setConcedes((prev) => {
      const n = [...prev];
      if (n.length < basicInfo.oppScore) {
        while (n.length < basicInfo.oppScore)
          n.push({ id: Date.now() + Math.random(), minute: "", gk: "" });
      } else if (n.length > basicInfo.oppScore)
        return n.slice(0, basicInfo.oppScore);
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

  const calculateGK = (minuteStr) => {
    let currentGk = starters.find((p) => p.position === "GK")?.id || "";
    if (!minuteStr || isNaN(Number(minuteStr.replace(/\D/g, ""))))
      return currentGk;

    const targetAbs = getAbsoluteMinute(minuteStr, basicInfo.extraTime1);
    const sortedSubs = [...subs].sort(
      (a, b) =>
        getAbsoluteMinute(a.minute, basicInfo.extraTime1) -
        getAbsoluteMinute(b.minute, basicInfo.extraTime1),
    );

    for (const s of sortedSubs) {
      if (
        getAbsoluteMinute(s.minute, basicInfo.extraTime1) <= targetAbs &&
        s.outPlayerId === currentGk
      ) {
        currentGk = s.inPlayerId;
      }
    }
    return currentGk;
  };

  const timelineEvents = useMemo(() => {
    const events = [];
    const et1 = basicInfo.extraTime1;
    goals.forEach((g) => {
      if (g.minute) {
        const abs = getAbsoluteMinute(g.minute, et1);
        if (g.isOg)
          events.push({
            abs,
            minStr: g.minute,
            text: `⚽ 득점: 상대 자책골 (OG)`,
          });
        else if (g.scorer)
          events.push({
            abs,
            minStr: g.minute,
            text: `⚽ 득점: ${bulkRoster.find((p) => p.id === g.scorer)?.name || "미상"} ${g.isPk ? "(PK)" : ""}`,
          });
      }
    });
    concedes.forEach((c) => {
      if (c.minute)
        events.push({
          abs: getAbsoluteMinute(c.minute, et1),
          minStr: c.minute,
          text: `🥅 실점 (GK: ${bulkRoster.find((p) => p.id === calculateGK(c.minute))?.name || "미상"})`,
        });
    });
    subs.forEach((s) => {
      if (s.minute && s.inPlayerId && s.outPlayerId)
        events.push({
          abs: getAbsoluteMinute(s.minute, et1),
          minStr: s.minute,
          text: `🔄 교체: IN ${bulkRoster.find((p) => p.id === s.inPlayerId)?.name || "미상"} / OUT ${bulkRoster.find((p) => p.id === s.outPlayerId)?.name || "미상"}`,
        });
    });
    cards.forEach((c) => {
      if (c.minute && c.playerId)
        events.push({
          abs: getAbsoluteMinute(c.minute, et1),
          minStr: c.minute,
          text: `${c.type === "Red" ? "🟥 퇴장" : "🟨 경고"}: ${bulkRoster.find((p) => p.id === c.playerId)?.name || "미상"}`,
        });
    });
    return events.sort((a, b) => a.abs - b.abs);
  }, [
    goals,
    concedes,
    subs,
    cards,
    bulkRoster,
    starters,
    basicInfo.extraTime1,
  ]);

  const handleSaveFullLogging = async () => {
    if (
      starters.length !== 11 &&
      !window.confirm("선발 라인업이 11명이 아닙니다. 그래도 저장하시겠습니까?")
    )
      return;

    try {
      const batch = writeBatch(db);
      const yr =
        String(matchMeta.date.split("-")[0]) ||
        String(new Date().getFullYear());
      const et1 = Number(basicInfo.extraTime1 || 0);
      const et2 = Number(basicInfo.extraTime2 || 0);

      const oldLogsSnap = await getDocs(
        query(collection(db, "match_logs"), where("matchId", "==", match.id)),
      );
      const oldStats = {};

      oldLogsSnap.docs.forEach((d) => {
        const log = d.data();
        let pid = log.playerId || players.find((x) => x.name === log.name)?.id;
        if (pid) {
          oldStats[pid] = {
            id: d.id,
            apps: 1,
            mins: log.minutes || 0,
            goals: log.goals || 0,
            pkGoals: log.pkGoals || 0,
            assists: log.assists || 0,
            conceded: log.conceded || 0,
            psoGoals: log.psoGoals || 0,
            psoSaves: log.psoSaves || 0,
            mom: log.mom ? 1 : 0,
            yellowCards: log.yellowCards || 0,
            redCards: log.redCards || 0,
          };
        }
        batch.delete(d.ref);
      });

      const newStats = {};
      const getS = (id) => {
        if (!newStats[id])
          newStats[id] = {
            apps: 0,
            mins: 0,
            goals: 0,
            pkGoals: 0,
            assists: 0,
            conceded: 0,
            psoGoals: 0,
            psoSaves: 0,
            mom: 0,
            yellowCards: 0,
            redCards: 0,
            isStarter: false,
          };
        return newStats[id];
      };

      goals.forEach((g) => {
        if (g.isOg) return;
        if (g.scorer) {
          getS(g.scorer).goals += 1;
          if (g.isPk) getS(g.scorer).pkGoals += 1;
        }
        if (g.assist && !g.isPk) getS(g.assist).assists += 1;
      });

      concedes.forEach((c) => {
        const gkId = calculateGK(c.minute);
        if (gkId) getS(gkId).conceded += 1;
      });

      cards.forEach((c) => {
        if (c.playerId) {
          if (c.type === "Yellow") getS(c.playerId).yellowCards += 1;
          if (c.type === "Red") getS(c.playerId).redCards += 1;
        }
      });

      if (basicInfo.isPso) {
        psoData.ourKickers.forEach((k) => {
          if (k.kickerId && k.result === "O") getS(k.kickerId).psoGoals += 1;
        });
        const finalGkId = calculateGK(120);
        const psoSaves = psoData.oppKickers.filter(
          (k) => k.result === "X",
        ).length;
        if (finalGkId && psoSaves > 0) getS(finalGkId).psoSaves += psoSaves;
      }

      if (selectedMomId) getS(selectedMomId).mom = 1;

      const matchLength = 90 + et1 + et2;
      new Set([
        ...starters.map((p) => p.id),
        ...subs.map((s) => s.inPlayerId).filter(Boolean),
      ]).forEach((pid) => {
        const isStarter = starters.some((p) => p.id === pid);
        getS(pid).isStarter = isStarter;
        getS(pid).apps = 1;

        let inMin = 0;
        if (!isStarter) {
          const subIn = subs.find((s) => s.inPlayerId === pid);
          if (subIn) inMin = getAbsoluteMinute(subIn.minute, et1);
        }

        let outMin = matchLength;
        const subOut = subs.find((s) => s.outPlayerId === pid);
        if (subOut) outMin = getAbsoluteMinute(subOut.minute, et1);

        const redCard = cards.find(
          (c) => c.playerId === pid && c.type === "Red",
        );
        if (redCard)
          outMin = Math.min(outMin, getAbsoluteMinute(redCard.minute, et1));

        getS(pid).mins = Math.max(0, outMin - inMin);
      });

      const allPids = new Set([
        ...Object.keys(oldStats),
        ...Object.keys(newStats),
      ]);
      allPids.forEach((pid) => {
        const o = oldStats[pid] || {};
        const n = newStats[pid] || {};

        if (
          (n.goals > 0 ||
            n.assists > 0 ||
            n.yellowCards > 0 ||
            n.redCards > 0 ||
            n.conceded > 0 ||
            n.psoGoals > 0 ||
            n.psoSaves > 0 ||
            n.mom > 0) &&
          !n.apps
        ) {
          n.apps = 1;
        }

        const pUpdates = {};
        const fields = [
          "apps",
          "mins",
          "goals",
          "pkGoals",
          "assists",
          "conceded",
          "mom",
          "yellowCards",
          "redCards",
          "psoGoals",
          "psoSaves",
        ];

        fields.forEach((f) => {
          const diff = (n[f] || 0) - (o[f] || 0);
          if (diff !== 0) {
            pUpdates[`stats.total.${f}`] = increment(diff);
            pUpdates[`stats.years.${yr}.${f}`] = increment(diff);
          }
        });

        if (pid && Object.keys(pUpdates).length > 0) {
          batch.update(doc(db, "players", pid), pUpdates);
        }

        if (n.apps > 0 && pid) {
          const pName = players.find((x) => x.id === pid)?.name || "Unknown";
          batch.set(doc(collection(db, "match_logs")), {
            matchId: match.id || "",
            playerId: pid || "",
            name: pName,
            date: matchMeta.date || "",
            opponent: match.opponent || "Unknown",
            year: parseInt(yr) || new Date().getFullYear(),
            starter: n.isStarter ? "선발" : "교체",
            minutes: n.mins || 0,
            goals: n.goals || 0,
            pkGoals: n.pkGoals || 0,
            assists: n.assists || 0,
            conceded: n.conceded || 0,
            psoGoals: n.psoGoals || 0,
            psoSaves: n.psoSaves || 0,
            mom: n.mom > 0,
            yellowCards: n.yellowCards || 0,
            redCards: n.redCards || 0,
          });
        }
      });

      const momPlayerName = selectedMomId
        ? players.find((p) => p.id === selectedMomId)?.name || null
        : null;

      const cleanMatchData = {
        formation: basicInfo.formation || "4-4-2",
        extraTime1: basicInfo.extraTime1 || 0,
        extraTime2: basicInfo.extraTime2 || 0,
        startingLineup: starters.map((p) => ({
          id: p.id || "",
          name: p.name || "",
          position: p.position || "",
          number: p.number || "-",
        })),
        substitutions: subs.map((s) => ({
          id: s.id,
          minute: s.minute || "",
          inPlayerId: s.inPlayerId || "",
          outPlayerId: s.outPlayerId || "",
        })),
        goals: goals.map((g) => ({
          id: g.id,
          minute: g.minute || "",
          scorer: g.isOg ? "OG" : g.scorer || "",
          assist: g.isOg ? "" : g.assist || "",
          isPk: g.isPk || false,
          isOg: g.isOg || false,
        })),
        concedes: concedes.map((c) => ({
          id: c.id,
          minute: c.minute || "",
          gk: calculateGK(c.minute) || "",
        })),
        cards: cards.map((c) => ({
          id: c.id,
          minute: c.minute || "",
          playerId: c.playerId || "",
          type: c.type || "Yellow",
        })),
        psoData: basicInfo.isPso
          ? {
              firstKick: psoData.firstKick || "us",
              ourKickers: psoData.ourKickers.map((k) => ({
                kickerId: k.kickerId || "",
                result: k.result || "O",
              })),
              oppKickers: psoData.oppKickers.map((k) => ({
                result: k.result || "O",
              })),
            }
          : null,
      };

      const finalMatchUpdates = {
        status: "Finished",
        homeScore: matchMeta.isHome
          ? basicInfo.ssuScore || 0
          : basicInfo.oppScore || 0,
        awayScore: matchMeta.isHome
          ? basicInfo.oppScore || 0
          : basicInfo.ssuScore || 0,
        date: matchMeta.date || "",
        time: matchMeta.time || "",
        venue: matchMeta.venue || "",
        isHome: matchMeta.isHome ?? true,
        pso: basicInfo.isPso ? basicInfo.psoScore || "0:0" : null,
        mom: momPlayerName,
        media: {
          highlight: editMedia.highlight || "",
          report: editMedia.report || "",
          interview: editMedia.interview || "",
        },
        matchData: cleanMatchData,
      };

      batch.update(doc(db, "matches", match.id), finalMatchUpdates);

      await batch.commit();
      onUpdateMatch(match.id, finalMatchUpdates);
      alert("✅ 변경 사항이 스탯에 완벽하게 동기화 되었습니다!");
      onClose();
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("저장 중 오류가 발생했습니다: " + error.message);
    }
  };

  const handleResetLogging = async () => {
    if (
      !window.confirm(
        "🚨 정말 이 경기의 로깅 데이터를 초기화하시겠습니까?\n\n- 해당 경기로 기록된 선수들의 스탯이 모두 차감됩니다.\n- 일정과 미디어 링크만 유지됩니다.",
      )
    )
      return;
    try {
      const batch = writeBatch(db);
      const yr = String(matchMeta.date.split("-")[0]);

      const logsSnap = await getDocs(
        query(collection(db, "match_logs"), where("matchId", "==", match.id)),
      );
      logsSnap.docs.forEach((d) => {
        const log = d.data();
        let targetPlayerId =
          log.playerId || players.find((p) => p.name === log.name)?.id;
        if (targetPlayerId) {
          const updates = {
            "stats.total.apps": increment(-1),
            [`stats.years.${yr}.apps`]: increment(-1),
            "stats.total.mins": increment(-(log.minutes || 0)),
            [`stats.years.${yr}.mins`]: increment(-(log.minutes || 0)),
            "stats.total.goals": increment(-(log.goals || 0)),
            [`stats.years.${yr}.goals`]: increment(-(log.goals || 0)),
            "stats.total.pkGoals": increment(-(log.pkGoals || 0)),
            [`stats.years.${yr}.pkGoals`]: increment(-(log.pkGoals || 0)),
            "stats.total.assists": increment(-(log.assists || 0)),
            [`stats.years.${yr}.assists`]: increment(-(log.assists || 0)),
            "stats.total.conceded": increment(-(log.conceded || 0)),
            [`stats.years.${yr}.conceded`]: increment(-(log.conceded || 0)),
            "stats.total.psoGoals": increment(-(log.psoGoals || 0)),
            "stats.total.psoSaves": increment(-(log.psoSaves || 0)),
            "stats.total.yellowCards": increment(-(log.yellowCards || 0)),
            [`stats.years.${yr}.yellowCards`]: increment(
              -(log.yellowCards || 0),
            ),
            "stats.total.redCards": increment(-(log.redCards || 0)),
            [`stats.years.${yr}.redCards`]: increment(-(log.redCards || 0)),
          };
          if (log.mom) {
            updates["stats.total.mom"] = increment(-1);
            updates[`stats.years.${yr}.mom`] = increment(-1);
          }
          batch.update(doc(db, "players", targetPlayerId), updates);
        }
        batch.delete(d.ref);
      });

      const resetData = {
        status: "Upcoming",
        homeScore: 0,
        awayScore: 0,
        pso: null,
        mom: null,
        matchData: null,
        media: {
          highlight: editMedia.highlight || "",
          report: editMedia.report || "",
          interview: editMedia.interview || "",
        },
        date: matchMeta.date || "",
        time: matchMeta.time || "",
        venue: matchMeta.venue || "",
        isHome: matchMeta.isHome ?? true,
      };

      batch.update(doc(db, "matches", match.id), resetData);
      await batch.commit();
      onUpdateMatch(match.id, resetData);
      alert("✅ 기록 초기화 완료.");
      onClose();
      window.location.reload();
    } catch (e) {
      alert("초기화 실패: " + e.message);
    }
  };

  if (!match) return null;

  return (
    <div className="fixed inset-0 z-1000 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div
        className={`bg-slate-50 rounded-[2.5rem] shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className={`p-6 flex justify-between items-center text-white shrink-0 ${match?.status === "Finished" ? "bg-ssu-blue" : "bg-ssu-black"}`}
        >
          <div>
            <h3 className="font-black text-xl flex items-center gap-2">
              <Edit3 size={20} className="text-[#FFD60A]" />
              {match?.status === "Finished"
                ? "경기 기록 및 스탯 정밀 수정"
                : "통합 경기 로깅 센터"}
            </h3>
            <p className="text-[10px] font-bold opacity-70 tracking-widest mt-1">
              [{matchMeta.date}] VS {match?.opponent}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* 🚀 통합 편집 뷰 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* 0. 일정 에디터 */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h5 className="font-black text-ssu-black flex items-center text-sm uppercase tracking-widest mb-4 border-b border-slate-100 pb-3">
                <Calendar size={16} className="mr-2 text-ssu-blue" /> 일정 및
                장소
              </h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 block mb-1">
                    날짜
                  </label>
                  <input
                    type="date"
                    className="w-full p-2.5 border rounded-xl text-sm font-bold"
                    value={matchMeta.date}
                    onChange={(e) => handleMetaChange("date", e.target.value)}
                    onKeyDown={handleEnterJump}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 block mb-1">
                    시간
                  </label>
                  <input
                    type="time"
                    className="w-full p-2.5 border rounded-xl text-sm font-bold"
                    value={matchMeta.time}
                    onChange={(e) => handleMetaChange("time", e.target.value)}
                    onKeyDown={handleEnterJump}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 block mb-1">
                    장소
                  </label>
                  <input
                    type="text"
                    className="w-full p-2.5 border rounded-xl text-sm font-bold"
                    value={matchMeta.venue}
                    onChange={(e) => handleMetaChange("venue", e.target.value)}
                    placeholder="경기장"
                    onKeyDown={handleEnterJump}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 block mb-1">
                    홈/어웨이
                  </label>
                  <select
                    className="w-full p-2.5 border rounded-xl text-sm font-black"
                    value={matchMeta.isHome}
                    onChange={(e) =>
                      handleMetaChange("isHome", e.target.value === "true")
                    }
                    onKeyDown={handleEnterJump}
                  >
                    <option value="true">홈</option>
                    <option value="false">어웨이</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 1. Basic Info */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection("basic")}
                className="w-full p-4 flex justify-between items-center bg-slate-50 text-ssu-black font-black text-xs uppercase"
              >
                <span>01. Basic Info & Score</span>{" "}
                {openSection === "basic" ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>
              {openSection === "basic" && (
                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-100">
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
                      전반 추가(분)
                    </label>
                    <input
                      type="number"
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
                      후반 추가(분)
                    </label>
                    <input
                      type="number"
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

                  <div className="col-span-full grid grid-cols-2 gap-4 mt-2">
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-xs font-black text-slate-600">
                        포메이션
                      </span>
                      <select
                        className="px-3 py-1.5 rounded-lg text-xs font-black bg-white border border-slate-200 outline-none focus:border-ssu-blue"
                        value={basicInfo.formation}
                        onChange={(e) =>
                          setBasicInfo({
                            ...basicInfo,
                            formation: e.target.value,
                          })
                        }
                      >
                        <option value="4-3-3">4-3-3</option>
                        <option value="4-4-2">4-4-2</option>
                        <option value="3-4-3">3-4-3</option>
                        <option value="3-5-2">3-5-2</option>
                        <option value="4-2-3-1">4-2-3-1</option>
                      </select>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-xs font-black text-slate-600">
                        승부차기(PSO) 여부
                      </span>
                      <div className="flex gap-2 items-center">
                        {basicInfo.isPso && (
                          <span className="bg-orange-100 px-2 py-1 rounded text-orange-600 font-black text-xs">
                            {basicInfo.psoScore}
                          </span>
                        )}
                        <button
                          onClick={() =>
                            setBasicInfo({
                              ...basicInfo,
                              isPso: !basicInfo.isPso,
                            })
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-black ${basicInfo.isPso ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-500"}`}
                        >
                          {basicInfo.isPso ? "ON" : "OFF"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Starting Lineup */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection("starters")}
                className="w-full p-4 flex justify-between bg-slate-50 font-black text-xs uppercase"
              >
                <span>02. Starting Lineup ({starters.length}/11)</span>{" "}
                {openSection === "starters" ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>
              {openSection === "starters" && (
                <div className="p-5 space-y-4">
                  {["FW", "MF", "DF", "GK"].map((pos) => (
                    <div
                      key={pos}
                      className="flex gap-3 border-b pb-3 last:border-0"
                    >
                      <span className="text-xs font-black text-slate-400 w-8">
                        {pos}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {bulkRoster
                          .filter((p) => p.position === pos)
                          .map((p) => {
                            const active = starters.some((s) => s.id === p.id);
                            return (
                              <button
                                key={p.id}
                                onClick={() =>
                                  active
                                    ? setStarters(
                                        starters.filter((s) => s.id !== p.id),
                                      )
                                    : starters.length < 11 &&
                                      setStarters([...starters, p])
                                }
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${active ? "bg-ssu-blue text-white" : "bg-white text-slate-500"}`}
                              >
                                {p.name}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Substitutions */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection("subs")}
                className="w-full p-4 flex justify-between bg-slate-50 font-black text-xs uppercase"
              >
                <span>03. Substitutions</span>{" "}
                {openSection === "subs" ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>
              {openSection === "subs" && (
                <div className="p-5 space-y-3">
                  {subs.map((s, i) => (
                    <div
                      key={s.id}
                      className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100"
                    >
                      <input
                        type="text"
                        placeholder="분 (예:45+2)"
                        className="w-20 p-2 border rounded-xl text-center text-xs font-bold"
                        value={s.minute}
                        onChange={(e) => {
                          const n = [...subs];
                          n[i].minute = e.target.value;
                          setSubs(n);
                        }}
                        onKeyDown={handleEnterJump}
                      />
                      <PlayerCombobox
                        players={bulkRoster}
                        value={s.inPlayerId}
                        placeholder="IN Player"
                        onChange={(v) => {
                          const n = [...subs];
                          n[i].inPlayerId = v;
                          setSubs(n);
                        }}
                      />
                      <PlayerCombobox
                        players={bulkRoster}
                        value={s.outPlayerId}
                        placeholder="OUT Player"
                        onChange={(v) => {
                          const n = [...subs];
                          n[i].outPlayerId = v;
                          setSubs(n);
                        }}
                      />
                      <button
                        onClick={() =>
                          setSubs(subs.filter((_, idx) => idx !== i))
                        }
                        className="p-2 text-slate-300 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setSubs([
                        ...subs,
                        {
                          id: Date.now() + Math.random(),
                          minute: "",
                          inPlayerId: "",
                          outPlayerId: "",
                        },
                      ])
                    }
                    className="w-full py-2 border-2 border-dashed rounded-xl text-xs font-black text-slate-400"
                  >
                    교체 추가
                  </button>
                </div>
              )}
            </div>

            {/* 4. Goals (자책골 OG 지원) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection("goals")}
                className="w-full p-4 flex justify-between bg-slate-50 font-black text-xs uppercase"
              >
                <span>04. Goals ({goals.length}골)</span>{" "}
                {openSection === "goals" ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>
              {openSection === "goals" && (
                <div className="p-5 space-y-3">
                  {goals.map((g, i) => (
                    <div
                      key={g.id}
                      className="grid grid-cols-12 gap-2 items-center bg-blue-50/50 p-3 rounded-xl border border-blue-100"
                    >
                      <div className="col-span-2">
                        <input
                          type="text"
                          placeholder="분 (예:45+2)"
                          className="w-full p-2 border rounded-lg text-center text-xs font-bold"
                          value={g.minute}
                          onChange={(e) => {
                            const n = [...goals];
                            n[i].minute = e.target.value;
                            setGoals(n);
                          }}
                          onKeyDown={handleEnterJump}
                        />
                      </div>
                      <div className="col-span-4">
                        <PlayerCombobox
                          players={bulkRoster}
                          placeholder="득점자"
                          value={g.scorer}
                          disabled={g.isOg}
                          onChange={(v) => {
                            const n = [...goals];
                            n[i].scorer = v;
                            setGoals(n);
                          }}
                        />
                      </div>
                      <div className="col-span-3">
                        {g.isOg ? (
                          <div className="w-full p-2.5 border rounded-xl text-center text-xs font-bold bg-slate-100 text-slate-400">
                            상대 자책골(OG)
                          </div>
                        ) : !g.isPk ? (
                          <PlayerCombobox
                            players={bulkRoster}
                            placeholder="도움자"
                            value={g.assist}
                            onChange={(v) => {
                              const n = [...goals];
                              n[i].assist = v;
                              setGoals(n);
                            }}
                          />
                        ) : (
                          <div className="w-full p-2.5 border rounded-xl text-center text-xs font-bold bg-slate-100 text-slate-400">
                            PK 득점
                          </div>
                        )}
                      </div>
                      <div className="col-span-3 flex items-center justify-around gap-1 px-2 border rounded-xl bg-white">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={g.isPk}
                            disabled={g.isOg}
                            onChange={(e) => {
                              const n = [...goals];
                              n[i].isPk = e.target.checked;
                              if (e.target.checked) n[i].assist = "";
                              setGoals(n);
                            }}
                            className="w-3 h-3"
                          />
                          <span className="text-[10px] font-black text-slate-500">
                            PK
                          </span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={g.isOg}
                            onChange={(e) => {
                              const n = [...goals];
                              n[i].isOg = e.target.checked;
                              if (e.target.checked) {
                                n[i].scorer = "";
                                n[i].assist = "";
                                n[i].isPk = false;
                              }
                              setGoals(n);
                            }}
                            className="w-3 h-3"
                          />
                          <span className="text-[10px] font-black text-red-500">
                            OG
                          </span>
                        </label>
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
                className="w-full p-4 flex justify-between bg-slate-50 font-black text-xs uppercase"
              >
                <span>05. Concedes ({concedes.length}실점)</span>{" "}
                {openSection === "concedes" ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>
              {openSection === "concedes" && (
                <div className="p-5 space-y-3">
                  {concedes.map((c, i) => {
                    const autoGkId = calculateGK(c.minute);
                    return (
                      <div
                        key={c.id}
                        className="flex gap-3 items-center bg-red-50/50 p-3 rounded-xl border border-red-100"
                      >
                        <input
                          type="text"
                          placeholder="분 (예:45+2)"
                          className="w-20 p-2 border rounded-lg text-center text-xs font-bold"
                          value={c.minute}
                          onChange={(e) => {
                            const n = [...concedes];
                            n[i].minute = e.target.value;
                            setConcedes(n);
                          }}
                          onKeyDown={handleEnterJump}
                        />
                        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white rounded-lg border text-xs font-bold text-slate-600">
                          <Shield size={14} className="text-purple-500" />{" "}
                          자동지정 GK:{" "}
                          <span className="text-ssu-black font-black">
                            {players.find((p) => p.id === autoGkId)?.name ||
                              "선발 GK 선택 필요"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 6. Cards */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection("cards")}
                className="w-full p-4 flex justify-between bg-slate-50 font-black text-xs uppercase"
              >
                <span>06. Cards ({cards.length}장)</span>{" "}
                {openSection === "cards" ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>
              {openSection === "cards" && (
                <div className="p-5 space-y-3">
                  {cards.map((c, i) => (
                    <div
                      key={c.id}
                      className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100"
                    >
                      <input
                        type="text"
                        placeholder="분 (예:45+2)"
                        className="w-20 p-2 border rounded-xl text-center text-xs font-bold"
                        value={c.minute}
                        onChange={(e) => {
                          const n = [...cards];
                          n[i].minute = e.target.value;
                          setCards(n);
                        }}
                        onKeyDown={handleEnterJump}
                      />
                      <PlayerCombobox
                        players={bulkRoster}
                        value={c.playerId}
                        placeholder="선수"
                        onChange={(v) => {
                          const n = [...cards];
                          n[i].playerId = v;
                          setCards(n);
                        }}
                      />
                      <select
                        className="p-2.5 border rounded-xl text-xs font-black bg-white outline-none focus:border-ssu-blue"
                        value={c.type}
                        onChange={(e) => {
                          const n = [...cards];
                          n[i].type = e.target.value;
                          setCards(n);
                        }}
                      >
                        <option value="Yellow">🟨 경고 (Yellow)</option>
                        <option value="Red">🟥 퇴장 (Red)</option>
                      </select>
                      <button
                        onClick={() =>
                          setCards(cards.filter((_, idx) => idx !== i))
                        }
                        className="p-2 text-slate-300 hover:text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setCards([
                        ...cards,
                        {
                          id: Date.now() + Math.random(),
                          minute: "",
                          playerId: "",
                          type: "Yellow",
                        },
                      ])
                    }
                    className="w-full py-2 border-2 border-dashed rounded-xl text-xs font-black text-slate-400"
                  >
                    카드 기록 추가
                  </button>
                </div>
              )}
            </div>

            {/* 7. PSO */}
            {basicInfo.isPso && (
              <div className="bg-white rounded-2xl border border-orange-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection("pso")}
                  className="w-full p-4 flex justify-between bg-orange-50 font-black text-xs uppercase text-orange-600"
                >
                  <span>07. Penalty Shootout</span>{" "}
                  {openSection === "pso" ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>
                {openSection === "pso" && (
                  <div className="p-5 space-y-6">
                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border">
                      <span className="text-sm font-black">선축</span>
                      <div className="flex bg-white rounded-lg border p-1">
                        <button
                          onClick={() =>
                            setPsoData({ ...psoData, firstKick: "us" })
                          }
                          className={`px-4 py-1.5 rounded-md text-xs font-black ${psoData.firstKick === "us" ? "bg-ssu-blue text-white" : "text-slate-400"}`}
                        >
                          우리팀
                        </button>
                        <button
                          onClick={() =>
                            setPsoData({ ...psoData, firstKick: "them" })
                          }
                          className={`px-4 py-1.5 rounded-md text-xs font-black ${psoData.firstKick === "them" ? "bg-red-500 text-white" : "text-slate-400"}`}
                        >
                          상대팀
                        </button>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h6 className="font-black text-ssu-blue flex items-center border-b pb-2">
                          <Shield size={16} className="mr-2" /> 우리팀 키커
                        </h6>
                        {psoData.ourKickers.map((k, i) => (
                          <div
                            key={i}
                            className="flex gap-2 items-center bg-blue-50/50 p-2 rounded-xl border border-blue-100"
                          >
                            <span className="w-6 text-center text-xs font-black text-slate-400">
                              {i + 1}
                            </span>
                            <PlayerCombobox
                              players={bulkRoster}
                              placeholder="선수"
                              value={k.kickerId}
                              onChange={(v) => {
                                const n = [...psoData.ourKickers];
                                n[i].kickerId = v;
                                setPsoData({ ...psoData, ourKickers: n });
                              }}
                            />
                            <select
                              className="p-2 border rounded-xl text-xs font-black"
                              value={k.result}
                              onChange={(e) => {
                                const n = [...psoData.ourKickers];
                                n[i].result = e.target.value;
                                setPsoData({ ...psoData, ourKickers: n });
                              }}
                            >
                              <option value="O">O</option>
                              <option value="X">X</option>
                            </select>
                            <button
                              onClick={() =>
                                setPsoData({
                                  ...psoData,
                                  ourKickers: psoData.ourKickers.filter(
                                    (_, idx) => idx !== i,
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
                          onClick={() =>
                            setPsoData({
                              ...psoData,
                              ourKickers: [
                                ...psoData.ourKickers,
                                { kickerId: "", result: "O" },
                              ],
                            })
                          }
                          className="w-full py-2 border-2 border-dashed rounded-xl text-xs font-black text-blue-400"
                        >
                          키커 추가
                        </button>
                      </div>
                      <div className="space-y-3">
                        <h6 className="font-black text-red-500 flex items-center border-b pb-2">
                          <Target size={16} className="mr-2" /> 상대팀 키커
                        </h6>
                        {psoData.oppKickers.map((k, i) => (
                          <div
                            key={i}
                            className="flex gap-2 items-center bg-red-50/50 p-2 rounded-xl border border-red-100"
                          >
                            <span className="w-6 text-center text-xs font-black text-slate-400">
                              {i + 1}
                            </span>
                            <select
                              className="w-full p-2 border rounded-xl text-xs font-black"
                              value={k.result}
                              onChange={(e) => {
                                const n = [...psoData.oppKickers];
                                n[i].result = e.target.value;
                                setPsoData({ ...psoData, oppKickers: n });
                              }}
                            >
                              <option value="O">O (성공)</option>
                              <option value="X">X (실패)</option>
                            </select>
                            <button
                              onClick={() =>
                                setPsoData({
                                  ...psoData,
                                  oppKickers: psoData.oppKickers.filter(
                                    (_, idx) => idx !== i,
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
                          onClick={() =>
                            setPsoData({
                              ...psoData,
                              oppKickers: [
                                ...psoData.oppKickers,
                                { result: "O" },
                              ],
                            })
                          }
                          className="w-full py-2 border-2 border-dashed rounded-xl text-xs font-black text-red-400"
                        >
                          키커 추가
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 8. MOM & Media */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection("media")}
                className="w-full p-4 flex justify-between bg-slate-50 font-black text-xs uppercase"
              >
                <span>08. MOM & Media Links</span>{" "}
                {openSection === "media" ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>
              {openSection === "media" && (
                <div className="p-5 space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 block mb-1">
                      Man of the Match
                    </label>
                    <PlayerCombobox
                      players={bulkRoster}
                      placeholder="MOM 선정"
                      value={selectedMomId}
                      onChange={setSelectedMomId}
                    />
                  </div>
                  <div className="pt-4 border-t space-y-3">
                    <input
                      className="w-full p-2.5 border rounded-xl text-sm"
                      placeholder="유튜브 하이라이트 링크"
                      value={editMedia.highlight}
                      onChange={(e) =>
                        setEditMedia({
                          ...editMedia,
                          highlight: e.target.value,
                        })
                      }
                    />
                    <input
                      className="w-full p-2.5 border rounded-xl text-sm"
                      placeholder="블로그 상보 링크"
                      value={editMedia.report}
                      onChange={(e) =>
                        setEditMedia({ ...editMedia, report: e.target.value })
                      }
                    />
                    <input
                      className="w-full p-2.5 border rounded-xl text-sm"
                      placeholder="인터뷰 영상 링크"
                      value={editMedia.interview}
                      onChange={(e) =>
                        setEditMedia({
                          ...editMedia,
                          interview: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Danger Zone */}
            {match?.status === "Finished" && (
              <div className="pt-6 border-t border-red-100 flex flex-col items-center mt-6">
                <button
                  onClick={handleResetLogging}
                  className="text-red-500 text-xs font-black hover:underline flex items-center gap-1"
                >
                  <AlertTriangle size={12} /> 경기 데이터 완전 초기화 (일정
                  유지)
                </button>
              </div>
            )}
          </div>

          {/* 오른쪽 타임라인 프리뷰 & 버튼 */}
          <div className="lg:col-span-1 flex flex-col h-full gap-4">
            <div className="bg-ssu-black rounded-3xl p-5 flex flex-col flex-1 max-h-[50vh] lg:max-h-none overflow-hidden shadow-xl">
              <h4 className="text-[#FFD60A] font-black text-xs uppercase mb-4 border-b border-white/10 pb-3 flex items-center gap-2">
                <Target size={14} /> Match Timeline Preview
              </h4>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {timelineEvents.map((ev, i) => (
                  <div
                    key={i}
                    className="flex gap-2 text-white text-[11px] font-medium"
                  >
                    <span className="text-[#FFD60A] font-black w-10 shrink-0">
                      {ev.minStr}'
                    </span>
                    <span>{ev.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={handleSaveFullLogging}
              className="w-full bg-ssu-blue hover:bg-[#007ba1] text-white font-black py-5 rounded-3xl shadow-lg flex items-center justify-center gap-2 text-lg transition-all active:scale-[0.98] shrink-0"
            >
              <Save size={24} />{" "}
              {match?.status === "Finished"
                ? "수정 내용 최종 저장"
                : "전체 로깅 저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchLogModal;
