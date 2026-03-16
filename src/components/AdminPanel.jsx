import React, { useState, useMemo, useEffect } from "react";
import {
  Database,
  Users,
  Calendar,
  Trophy,
  Lock,
  LogOut,
  Edit3,
  Search,
  Eye,
  EyeOff,
  X,
  Save,
  Image as ImageIcon,
  RefreshCw,
  Plus,
  Upload,
  Check,
  Trash2,
  Settings,
  Target,
  Award,
  Youtube,
  BookOpen,
  Mic,
  PlayCircle,
  MessageSquare,
} from "lucide-react";
import { compressImageToBase64 } from "../utils";
import {
  query,
  collection,
  getDocs,
  writeBatch,
  doc,
  where,
} from "firebase/firestore";
import { increment } from "firebase/firestore";
import { useData } from "../contexts/DataContext";

const AdminPanel = ({ toggleAdmin }) => {
  const {
    matches,
    players,
    league,
    db,
    matchLogs,
    handleAddLeagueTeam: onAddLeagueTeam,
    handleUpdateLeagueTeam: onUpdateLeagueTeam,
    handleAddMatch: onAddMatch,
    handleUpdateMatch: onUpdateMatch,
    handleDeleteMatch: onDeleteMatch,
    handleUpdatePlayer: onUpdatePlayer,
  } = useData();
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => sessionStorage.getItem("ssuAdmin") === "true",
  );
  const [activeSubTab, setActiveSubTab] = useState("matches");

  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

  // ============ 1. 리그 순위용 상태 ============
  const [leagueYear, setLeagueYear] = useState("2026");
  const [leagueTable, setLeagueTable] = useState([]);

  // ============ 2. 선수 관리용 상태 ============
  const [playerSearchTerm, setPlayerSearchTerm] = useState("");
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [managingCommentsPlayer, setManagingCommentsPlayer] = useState(null);

  // ============ 3. 경기 로깅용 상태 ============
  const [showAddSingle, setShowAddSingle] = useState(false);
  const [showAddCSV, setShowAddCSV] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState([]);

  const [loggingMatch, setLoggingMatch] = useState(null);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [editingMom, setEditingMom] = useState(false);

  const [recordScore, setRecordScore] = useState({ home: 0, away: 0 });
  const [recordPso, setRecordPso] = useState("");
  const [matchDuration, setMatchDuration] = useState(90);
  const [startingLineup, setStartingLineup] = useState([]);
  const [substitutions, setSubstitutions] = useState([]);
  const [scorers, setScorers] = useState([]);

  const [momId, setMomId] = useState(null);
  const [selectedMomId, setSelectedMomId] = useState(null);
  const [editMedia, setEditMedia] = useState({
    highlight: "",
    report: "",
    interview: "",
  });

  const matchTypes = [
    "U리그",
    "춘계대회",
    "추계대회",
    "저학년대회",
    "전국체전",
    "왕중왕전",
    "기타",
  ];
  const roundOptions = {
    U리그: ["1R", "2R", "3R", "4R", "5R", "6R", "7R", "8R", "9R", "10R"],
    춘계대회: ["조별리그", "22강", "16강", "8강", "4강", "결승"],
    추계대회: ["조별리그", "20강", "16강", "8강", "4강", "결승"],
    저학년대회: ["조별리그", "20강", "16강", "8강", "4강", "결승"],
    전국체전: ["예선", "16강", "8강", "4강", "결승"],
    왕중왕전: ["32강", "16강", "8강", "4강", "결승"],
    기타: ["연습경기", "친선경기", "이벤트매치"],
  };
  const [newMatch, setNewMatch] = useState({
    date: "",
    time: "",
    opponent: "",
    type: "U리그",
    round: "1R",
    isHome: true,
    venue: "",
  });

  // ============ 공통 기능 ============
  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsLoggedIn(true);
      sessionStorage.setItem("ssuAdmin", "true");
      toggleAdmin(true);
    } else {
      alert("비밀번호가 틀렸습니다.");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    toggleAdmin(false);
    sessionStorage.removeItem("ssuAdmin");
  };

  const allMatchYears = useMemo(
    () =>
      [...new Set(matches.map((m) => m.year.toString()))].sort((a, b) => b - a),
    [matches],
  );

  // ============ 🔥 [리그 순위] 최적화된 연도 분리 로직 ============

  // 1. 선택된 연도의 U리그 참가팀 목록을 먼저 추출 (matches가 바뀔 때만 실행)
  const targetTeams = useMemo(() => {
    const teams = new Set(["숭실대"]);
    matches.forEach((m) => {
      const matchYear = m.year
        ? String(m.year)
        : m.date
          ? m.date.split("-")[0]
          : "";
      if (
        m.type?.includes("U리그") &&
        matchYear === String(leagueYear) &&
        m.opponent
      ) {
        teams.add(m.opponent.trim());
      }
    });
    return Array.from(teams);
  }, [matches, leagueYear]);

  // 2. 추출된 팀 리스트와 DB 기록 매칭 (Map을 활용하여 검색 속도 극대화)
  useEffect(() => {
    // 현재 연도에 해당하는 DB 기록만 모아 Map 생성 (조회 성능 최적화)
    const currentLeagueRecords = league.filter(
      (t) => String(t.year) === String(leagueYear),
    );
    const leagueMap = new Map(
      currentLeagueRecords.map((record) => [record.team?.trim(), record]),
    );

    const table = targetTeams.map((teamName) => {
      const dbRecord = leagueMap.get(teamName) || {};

      const w = Number(dbRecord.w) || 0;
      const d = Number(dbRecord.d) || 0;
      const l = Number(dbRecord.l) || 0;
      const gd = Number(dbRecord.gd) || 0;

      return {
        id: dbRecord.id || null,
        team: teamName,
        year: leagueYear,
        w,
        d,
        l,
        gd,
        played: w + d + l,
        pts: w * 3 + d * 1,
      };
    });

    // 정렬 로직
    const sorted = table
      .sort((a, b) => {
        if (a.pts !== b.pts) return b.pts - a.pts;
        return b.gd - a.gd;
      })
      .map((t, idx) => ({ ...t, rank: idx + 1 }));

    setLeagueTable(sorted);
  }, [targetTeams, league, leagueYear]);

  // 4. 표 안에서 숫자 변경 시 화면의 숫자만 먼저 바꿈 (타이핑 버벅임 방지)
  const handleLeagueStatChange = (index, field, value) => {
    const newTable = [...leagueTable];
    newTable[index] = {
      ...newTable[index],
      [field]: value === "" ? "" : Number(value),
    };

    // 승점 및 경기수 자동 재계산
    const w = Number(newTable[index].w) || 0;
    const d = Number(newTable[index].d) || 0;
    const l = Number(newTable[index].l) || 0;
    newTable[index].pts = w * 3 + d * 1;
    newTable[index].played = w + d + l;

    setLeagueTable(newTable);
  };

  // 5. 🔥 [저장 버튼] 클릭 시에만 DB로 일괄 전송
  const handleSaveLeague = async () => {
    try {
      const promises = leagueTable.map((row) => {
        const data = {
          team: row.team,
          year: row.year, // 연도 필수 포함
          w: Number(row.w) || 0,
          d: Number(row.d) || 0,
          l: Number(row.l) || 0,
          gd: Number(row.gd) || 0,
        };
        // id가 있으면 업데이트, 없으면 신규 추가
        if (row.id) return onUpdateLeagueTeam(row.id, data);
        else return onAddLeagueTeam(data);
      });
      await Promise.all(promises);
      alert(`${leagueYear}년도 순위표가 성공적으로 저장되었습니다!`);
    } catch (err) {
      alert("저장 실패: " + err.message);
    }
  };

  // ============ 🔥 [선수 관리 (드래그 앤 드롭)] ============
  const searchedPlayers = useMemo(() => {
    return players
      .filter((p) => (p.name ? p.name.includes(playerSearchTerm) : false))
      .sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999));
  }, [players, playerSearchTerm]);

  const PLAYER_STATUSES = [
    {
      key: "current",
      label: "재학생",
      color: "bg-blue-50 border-blue-200 text-blue-800",
    },
    {
      key: "graduated",
      label: "졸업생",
      color: "bg-green-50 border-green-200 text-green-800",
    },
    {
      key: "pro_joined",
      label: "프로/취업",
      color: "bg-purple-50 border-purple-200 text-purple-800",
    },
    {
      key: "left",
      label: "퇴단",
      color: "bg-red-50 border-red-200 text-red-800",
    },
  ];

  // 드래그 시작 이벤트
  const handleDragStart = (e, playerId) => {
    e.dataTransfer.setData("playerId", playerId);
  };

  // 드래그 중 영역 진입 (기본 이벤트를 막아야 드롭 가능)
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // 드롭(놓기) 이벤트
  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData("playerId");
    if (!playerId) return;

    const player = players.find((p) => p.id === playerId);
    if (player && player.status !== newStatus) {
      await onUpdatePlayer(playerId, { status: newStatus });
    }
  };

  // 프로필, 댓글 삭제 등 기존 로직 (생략 없이 원본 유지)
  const openEditModal = (player) => {
    setEditingPlayer(player);
    setEditForm({
      name: player.name || "",
      number: player.number || "",
      position: player.position || "MF",
      grade: player.grade || "",
      status: player.status || "current",
      profile: {
        birthday: player.profile?.birthday || "",
        height: player.profile?.height || "",
        weight: player.profile?.weight || "",
        highSchool: player.profile?.highSchool || "",
        currentTeam: player.profile?.currentTeam || "",
        photo:
          player.profile?.photo ||
          player["profile.photo"] ||
          player.imageUrl ||
          "",
      },
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const base64Data = await compressImageToBase64(file);
      setEditForm((prev) => ({
        ...prev,
        profile: { ...prev.profile, photo: base64Data },
      }));
    } catch (error) {
      const reader = new FileReader();
      reader.onloadend = () =>
        setEditForm((prev) => ({
          ...prev,
          profile: { ...prev.profile, photo: reader.result },
        }));
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const updates = {
        name: editForm.name,
        number: Number(editForm.number),
        position: editForm.position,
        grade: editForm.status === "current" ? editForm.grade : "",
        status: editForm.status,
        profile: editForm.profile,
      };
      await onUpdatePlayer(editingPlayer.id, updates);
      setEditingPlayer(null);
      alert("선수 정보가 수정되었습니다.");
    } catch (error) {
      alert("수정 실패: " + error.message);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("이 댓글을 완전히 삭제하시겠습니까?")) return;
    const newComments = (managingCommentsPlayer.comments || []).filter(
      (c) => c.id !== commentId,
    );
    try {
      await onUpdatePlayer(managingCommentsPlayer.id, {
        comments: newComments,
      });
      setManagingCommentsPlayer((prev) => ({ ...prev, comments: newComments }));
    } catch (e) {
      alert("댓글 삭제 실패");
    }
  };

  // ============ [경기 로깅] ============
  const handleTypeChange = (e) =>
    setNewMatch({
      ...newMatch,
      type: e.target.value,
      round: roundOptions[e.target.value][0],
    });
  const handleAddSingleMatch = (e) => {
    e.preventDefault();
    if (!newMatch.date || !newMatch.opponent)
      return alert("날짜와 상대팀을 입력하세요.");
    onAddMatch({
      ...newMatch,
      year: parseInt(newMatch.date.split("-")[0]),
      status: "Upcoming",
      homeScore: 0,
      awayScore: 0,
      pso: null,
    });
    setNewMatch({
      date: "",
      time: "",
      opponent: "",
      type: "U리그",
      round: "1R",
      isHome: true,
      venue: "",
    });
    setShowAddSingle(false);
    alert("등록 완료");
  };
  const handleCSVParse = () => {
    if (!csvText.trim()) return;
    const lines = csvText.trim().split("\n");
    const parsed = [];
    let startIndex =
      lines[0].includes("날짜") || lines[0].includes("date") ? 1 : 0;
    for (let i = startIndex; i < lines.length; i++) {
      const cols = lines[i].split(",");
      if (cols.length >= 4)
        parsed.push({
          date: cols[0]?.trim(),
          time: cols[1]?.trim() || "",
          type: cols[2]?.trim(),
          round: cols[3]?.trim() || "",
          opponent: cols[4]?.trim(),
          venue: cols[5]?.trim() || "",
          isHome: true,
        });
    }
    if (parsed.length === 0) alert("데이터가 없습니다.");
    else setCsvPreview(parsed);
  };
  const handleCSVImport = () => {
    if (csvPreview.length === 0) return;
    csvPreview.forEach((match) =>
      onAddMatch({
        ...match,
        year: parseInt(match.date.split("-")[0]),
        status: "Upcoming",
        homeScore: 0,
        awayScore: 0,
        pso: null,
      }),
    );
    setCsvText("");
    setCsvPreview([]);
    setShowAddCSV(false);
    alert(`${csvPreview.length}개 일괄 등록 완료`);
  };

  const currentRoster = useMemo(
    () =>
      players
        .filter((p) => p.status === "current")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  );
  const bulkRoster = useMemo(
    () =>
      currentRoster.map((p) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        number: p.number,
      })),
    [currentRoster],
  );

  const openLoggingModal = (match) => {
    setLoggingMatch(match);
    setEditingMom(false);
    if (match.status === "Finished") {
      setEditMedia({
        highlight: match.media?.highlight || "",
        report: match.media?.report || "",
        interview: match.media?.interview || "",
      });
      setSelectedMomId(null);
    } else {
      setRecordScore({
        home: match.homeScore || 0,
        away: match.awayScore || 0,
      });
      setRecordPso(match.pso || "");
      setMatchDuration(match.matchData?.duration || 90);
      setStartingLineup(match.matchData?.startingLineup || []);
      setSubstitutions(match.matchData?.substitutions || []);
      setScorers(match.matchData?.scorers || []);
      setMomId(null);
    }
  };

  const loggingMatchId = loggingMatch?.id;
  const loggingMatchStatus = loggingMatch?.status;

  const loggingMatchLogs = useMemo(() => {
    if (!loggingMatchId || loggingMatchStatus !== "Finished" || !matchLogs)
      return [];
    return matchLogs.filter((log) => log.matchId === loggingMatchId);
  }, [loggingMatchId, loggingMatchStatus, matchLogs]);

  const participants = useMemo(() => {
    if (!loggingMatch) return [];
    if (loggingMatch.matchData && loggingMatch.matchData.startingLineup) {
      const ids = [...loggingMatch.matchData.startingLineup.map((p) => p.id)];
      (loggingMatch.matchData.substitutions || []).forEach((s) => {
        if (!ids.includes(s.inPlayerId)) ids.push(s.inPlayerId);
        if (!ids.includes(s.outPlayerId)) ids.push(s.outPlayerId);
      });
      return Array.from(new Set(ids));
    }
    const ids = loggingMatchLogs
      .map((l) => players.find((p) => p.name === l.name)?.id)
      .filter(Boolean);
    return Array.from(new Set(ids));
  }, [loggingMatch, loggingMatchLogs, players]);

  const displayMom = useMemo(() => {
    if (!loggingMatch) return null;
    if (loggingMatch.mom && loggingMatch.mom !== "-") return loggingMatch.mom;
    if (loggingMatchLogs.length > 0) {
      const logMom = loggingMatchLogs.find((l) => l.mom);
      if (logMom) return logMom.name;
    }
    return null;
  }, [loggingMatch, loggingMatchLogs]);

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

  const getPlayerName = (playerId) =>
    players.find((p) => p.id === playerId)?.name || "";
  const handleAddStartingPlayer = (playerId) => {
    if (!startingLineup.find((p) => p.id === playerId))
      setStartingLineup([
        ...startingLineup,
        bulkRoster.find((p) => p.id === playerId),
      ]);
  };
  const handleRemoveStartingPlayer = (playerId) =>
    setStartingLineup(startingLineup.filter((p) => p.id !== playerId));
  const handleAddSubstitution = (outPlayerId, inPlayerId, minute) => {
    if (outPlayerId && inPlayerId && minute)
      setSubstitutions([
        ...substitutions,
        { outPlayerId, inPlayerId, minute: Number(minute) },
      ]);
  };
  const handleRemoveSubstitution = (idx) =>
    setSubstitutions(substitutions.filter((_, i) => i !== idx));
  const handleUpdateScorer = (playerId, goals, assists) => {
    const existing = scorers.find((s) => s.playerId === playerId);
    if (existing)
      setScorers(
        scorers.map((s) =>
          s.playerId === playerId
            ? { ...s, goals: Number(goals) || 0, assists: Number(assists) || 0 }
            : s,
        ),
      );
    else
      setScorers([
        ...scorers,
        { playerId, goals: Number(goals) || 0, assists: Number(assists) || 0 },
      ]);
  };

  const handleSaveFullLogging = async () => {
    if (!loggingMatch) return;
    try {
      const batch = writeBatch(db);
      const matchRef = doc(db, "matches", loggingMatch.id);
      const scorerList = scorers
        .filter((s) => s.goals > 0)
        .map((s) => ({
          name: bulkRoster.find((p) => p.id === s.playerId).name,
          count: s.goals,
        }));
      const assistsList = scorers
        .filter((s) => s.assists > 0)
        .flatMap((s) =>
          Array(s.assists).fill(
            bulkRoster.find((p) => p.id === s.playerId).name,
          ),
        );
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

      const oldLogsSnap = await getDocs(
        query(
          collection(db, "match_logs"),
          where("matchId", "==", loggingMatch.id),
        ),
      );
      oldLogsSnap.docs.forEach((d) =>
        batch.delete(doc(db, "match_logs", d.id)),
      );

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
          const minutes = isStarter
            ? isSubOut
              ? isSubOut.minute
              : matchDuration
            : isSubIn
              ? isSubOut
                ? isSubOut.minute - isSubIn.minute
                : matchDuration - isSubIn.minute
              : 0;
          batch.set(doc(collection(db, "match_logs")), {
            matchId: loggingMatch.id,
            name: player.name,
            date: loggingMatch.date,
            opponent: loggingMatch.opponent,
            year: parseInt(loggingMatch.date.split("-")[0]),
            starter: isStarter ? "선발" : "교체",
            minutes: minutes,
            goals: scorer?.goals || 0,
            assists: scorer?.assists || 0,
            mom: momId === playerId,
          });

          const playerRef = doc(db, "players", playerId);
          const yr = String(loggingMatch.date.split("-")[0]);

          batch.update(playerRef, {
            [`stats.total.goals`]: increment(scorer?.goals || 0),
            [`stats.total.assists`]: increment(scorer?.assists || 0),
            [`stats.total.apps`]: increment(1),
            [`stats.total.mins`]: increment(minutes),
            [`stats.years.${yr}.goals`]: increment(scorer?.goals || 0),
            [`stats.years.${yr}.assists`]: increment(scorer?.assists || 0),
            [`stats.years.${yr}.apps`]: increment(1),
            [`stats.years.${yr}.mins`]: increment(minutes),
          });
        }
      });
      await batch.commit();
      onUpdateMatch(loggingMatch.id, matchUpdates);
      alert("기록이 성공적으로 저장되었습니다!");
      setLoggingMatch(null);
    } catch (e) {
      alert("저장 실패: " + e.message);
    }
  };

  const handleSaveSimpleEdit = async () => {
    if (!loggingMatch) return;
    try {
      const momPlayer = players.find((p) => p.id === selectedMomId);
      const finalMomName = editingMom
        ? momPlayer
          ? momPlayer.name
          : ""
        : displayMom || "";
      const updates = { media: editMedia };
      if (editingMom || (!loggingMatch.mom && finalMomName))
        updates.mom = finalMomName;

      const batch = writeBatch(db);
      batch.update(doc(db, "matches", loggingMatch.id), updates);

      if (editingMom) {
        const logsSnap = await getDocs(
          query(
            collection(db, "match_logs"),
            where("matchId", "==", loggingMatch.id),
          ),
        );
        logsSnap.docs.forEach((d) => {
          const isMom = finalMomName ? d.data().name === finalMomName : false;
          batch.update(doc(db, "match_logs", d.id), { mom: isMom });
        });
      }

      await batch.commit();
      onUpdateMatch(loggingMatch.id, updates);
      alert("성공적으로 업데이트되었습니다!");
      setLoggingMatch(null);
    } catch (e) {
      alert("수정 실패: " + e.message);
    }
  };

  // =========================================================
  // 렌더링 영역
  // =========================================================
  if (!isLoggedIn) {
    return (
      <div className="min-h-100x items-center justify-center animate-fade-in p-4">
        <form
          onSubmit={handleLogin}
          className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200 w-full max-w-sm text-center"
        >
          <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 border border-blue-100">
            <Lock className="text-blue-900" size={28} />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">
            Admin Center
          </h2>
          <p className="text-gray-500 text-sm mb-6 font-bold">
            관리자 비밀번호를 입력해주세요.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3.5 border border-gray-300 rounded-xl mb-4 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-center font-bold tracking-widest transition"
            placeholder="PASSWORD"
          />
          <button
            type="submit"
            className="w-full bg-ssu-black text-[#FFD60A] py-3.5 rounded-xl font-black hover:bg-black transition shadow-md text-lg"
          >
            접속하기
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white md:rounded-2xl shadow-xl min-h-175 flex flex-col md:flex-row overflow-hidden border-0 md:border border-gray-200 animate-fade-in max-w-7xl mx-auto">
      {/* 사이드바 */}
      <div className="w-full md:w-64 bg-ssu-black text-white p-4 md:p-6 flex flex-row md:flex-col gap-2 md:gap-4 shrink-0 overflow-x-auto md:overflow-visible z-10 custom-scrollbar sticky top-0 md:static">
        <h2 className="hidden md:flex text-xl font-black mb-6 items-center gap-2 tracking-tight text-[#FFD60A] border-b border-white/10 pb-4">
          <Database size={20} /> 관리자 센터
        </h2>
        <button
          onClick={() => setActiveSubTab("matches")}
          className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold transition whitespace-nowrap ${activeSubTab === "matches" ? "bg-[#FFD60A] text-ssu-black shadow-md" : "text-gray-300 hover:bg-white/10"}`}
        >
          <Calendar size={18} />
          <span className="md:inline">경기 일정 로깅</span>
        </button>
        <button
          onClick={() => setActiveSubTab("league")}
          className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold transition whitespace-nowrap ${activeSubTab === "league" ? "bg-[#FFD60A] text-ssu-black shadow-md" : "text-gray-300 hover:bg-white/10"}`}
        >
          <Trophy size={18} />
          <span className="md:inline">리그 순위표 수정</span>
        </button>
        <button
          onClick={() => setActiveSubTab("players")}
          className={`flex items-center justify-center md:justify-start gap-3 p-3 rounded-xl font-bold transition whitespace-nowrap ${activeSubTab === "players" ? "bg-[#FFD60A] text-ssu-black shadow-md" : "text-gray-300 hover:bg-white/10"}`}
        >
          <Users size={18} />
          <span className="md:inline">선수단 관리</span>
        </button>
        <div className="ml-auto md:ml-0 md:mt-auto pt-0 md:pt-6 md:border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center md:justify-start gap-2 p-3 rounded-xl text-red-400 font-bold hover:bg-red-500 hover:text-white transition whitespace-nowrap"
          >
            <LogOut size={18} />
            <span className="hidden md:inline">로그아웃</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-50 relative w-full overflow-x-hidden">
        {/* ========================================================= */}
        {/* 1. 경기 일정 로깅 탭 (변경 없음) */}
        {/* ========================================================= */}
        {activeSubTab === "matches" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
              <div>
                <h3 className="text-xl md:text-2xl font-black text-ssu-black flex items-center">
                  <Calendar className="mr-2 text-blue-600" /> 경기 데이터 로깅실
                </h3>
                <p className="text-xs text-gray-500 font-bold mt-1">
                  예정 경기는 결과를 입력하고, 종료된 경기는 부가 기록을
                  수정합니다.
                </p>
              </div>
              <div className="flex gap-2 w-full lg:w-auto">
                <button
                  onClick={() => {
                    setShowAddSingle(!showAddSingle);
                    setShowAddCSV(false);
                  }}
                  className={`flex-1 lg:flex-none justify-center items-center text-sm px-4 py-2.5 rounded-lg font-bold transition shadow-sm flex ${showAddSingle ? "bg-ssu-black text-[#FFD60A]" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  <Plus size={16} className="mr-1.5" /> 개별 등록
                </button>
                <button
                  onClick={() => {
                    setShowAddCSV(!showAddCSV);
                    setShowAddSingle(false);
                  }}
                  className={`flex-1 lg:flex-none justify-center items-center text-sm px-4 py-2.5 rounded-lg font-bold transition shadow-sm flex ${showAddCSV ? "bg-ssu-black text-[#FFD60A]" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  <Upload size={16} className="mr-1.5" /> CSV 등록
                </button>
              </div>
            </div>

            {showAddSingle && (
              <form
                onSubmit={handleAddSingleMatch}
                className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm animate-fade-in"
              >
                <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">
                  새 경기 등록
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">
                      날짜
                    </label>
                    <input
                      type="date"
                      required
                      className="w-full p-2.5 rounded border border-gray-300 text-sm outline-none"
                      value={newMatch.date}
                      onChange={(e) =>
                        setNewMatch({ ...newMatch, date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">
                      시간
                    </label>
                    <input
                      type="time"
                      className="w-full p-2.5 rounded border border-gray-300 text-sm outline-none"
                      value={newMatch.time}
                      onChange={(e) =>
                        setNewMatch({ ...newMatch, time: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">
                      상대팀
                    </label>
                    <input
                      type="text"
                      placeholder="예: 동국대"
                      required
                      className="w-full p-2.5 rounded border border-gray-300 text-sm outline-none"
                      value={newMatch.opponent}
                      onChange={(e) =>
                        setNewMatch({ ...newMatch, opponent: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2 md:col-span-2">
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">
                      경기장
                    </label>
                    <input
                      type="text"
                      className="w-full p-2.5 rounded border border-gray-300 text-sm outline-none"
                      value={newMatch.venue}
                      onChange={(e) =>
                        setNewMatch({ ...newMatch, venue: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">
                      대회명
                    </label>
                    <select
                      className="w-full p-2.5 rounded border border-gray-300 text-sm outline-none"
                      value={newMatch.type}
                      onChange={handleTypeChange}
                    >
                      {matchTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">
                      라운드
                    </label>
                    <select
                      className="w-full p-2.5 rounded border border-gray-300 text-sm outline-none"
                      value={newMatch.round}
                      onChange={(e) =>
                        setNewMatch({ ...newMatch, round: e.target.value })
                      }
                    >
                      {roundOptions[newMatch.type]?.map((round) => (
                        <option key={round} value={round}>
                          {round}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6 mt-2 border-t border-gray-100">
                  <div className="flex bg-gray-100 p-1 rounded-lg w-full md:w-auto">
                    <button
                      type="button"
                      onClick={() => setNewMatch({ ...newMatch, isHome: true })}
                      className={`flex-1 md:px-8 py-2 text-sm font-bold rounded-md ${newMatch.isHome ? "bg-white text-blue-600 shadow" : "text-gray-500"}`}
                    >
                      HOME
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewMatch({ ...newMatch, isHome: false })
                      }
                      className={`flex-1 md:px-8 py-2 text-sm font-bold rounded-md ${!newMatch.isHome ? "bg-white text-blue-600 shadow" : "text-gray-500"}`}
                    >
                      AWAY
                    </button>
                  </div>
                  <button
                    type="submit"
                    className="w-full md:w-auto bg-ssu-black text-[#FFD60A] font-black rounded-lg px-10 py-3"
                  >
                    경기 등록완료
                  </button>
                </div>
              </form>
            )}

            {showAddCSV && (
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm animate-fade-in">
                <div className="text-xs text-blue-800 bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                  <p className="font-bold mb-1">
                    <Settings size={14} className="inline mr-1" />
                    CSV 등록 가이드
                  </p>
                  <p>
                    날짜,시간,대회명,라운드,상대팀,경기장 순서대로 작성하세요.
                  </p>
                </div>
                <textarea
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:border-blue-500"
                  placeholder="2026-03-14,14:00,U리그,1R,고려대,고려대녹지구장"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                />
                <div className="flex gap-2 justify-end mt-4">
                  <button
                    type="button"
                    onClick={handleCSVParse}
                    className="bg-gray-100 text-gray-700 font-bold px-6 py-2.5 rounded-lg text-sm hover:bg-gray-200 transition"
                  >
                    미리보기
                  </button>
                  {csvPreview.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCSVImport}
                      className="bg-ssu-black text-[#FFD60A] font-bold px-6 py-2.5 rounded-lg text-sm shadow-md hover:bg-black transition"
                    >
                      <Check size={16} className="mr-1 inline" />
                      {csvPreview.length}개 일괄 등록
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 font-bold text-gray-600 text-sm flex justify-between">
                <span>등록된 경기 목록 (클릭 시 로깅)</span>
                <span className="text-blue-600">{matches.length}개</span>
              </div>
              <ul className="divide-y divide-gray-100 max-h-150 overflow-y-auto custom-scrollbar">
                {matches
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .map((match) => (
                    <li
                      key={match.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 hover:bg-blue-50/50 transition cursor-pointer group"
                      onClick={() => openLoggingModal(match)}
                    >
                      <div className="flex items-center gap-4 w-full mb-3 md:mb-0">
                        <span
                          className={`px-2.5 py-1 rounded text-[10px] font-black tracking-widest uppercase shrink-0 ${match.status === "Finished" ? "bg-gray-800 text-white" : "bg-blue-100 text-blue-700"}`}
                        >
                          {match.status === "Finished" ? "종료" : "예정"}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-gray-500 text-xs font-bold">
                            {match.date.replace(/-/g, ".")} | {match.type}
                          </span>
                          <span className="font-black text-gray-900 text-base">
                            vs {match.opponent}
                          </span>
                        </div>
                        <div className="hidden md:flex ml-auto items-center gap-6 mr-4">
                          {match.status === "Finished" ? (
                            <>
                              <span className="font-black text-xl tracking-widest text-ssu-black">
                                {match.homeScore} : {match.awayScore}
                              </span>
                              <span className="text-xs font-bold text-green-600 flex items-center group-hover:underline bg-green-50 px-2 py-1 rounded-md">
                                <Edit3 size={14} className="mr-1" /> 수정
                              </span>
                            </>
                          ) : (
                            <span className="text-xs font-bold text-blue-600 flex items-center group-hover:underline bg-blue-50 px-2 py-1 rounded-md">
                              <Edit3 size={14} className="mr-1" /> 결과 입력
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteMatch(match.id);
                        }}
                        className="w-full md:w-auto p-2 bg-gray-50 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-lg md:rounded-full transition border border-gray-200 flex justify-center items-center"
                      >
                        <Trash2 size={16} className="mr-1 md:mr-0" />
                        <span className="md:hidden text-xs">삭제</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        )}
        {/* ========================================================= */}
        {/* 🔥 2. 리그 순위 탭 (저장 버튼 및 연도분리 완벽 적용) */}
        {/* ========================================================= */}
        {activeSubTab === "league" && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <h3 className="text-xl md:text-2xl font-black text-ssu-black flex items-center">
                  <Trophy className="mr-2 text-blue-600" /> 연도별 리그 순위
                  입력
                </h3>
                <p className="text-xs text-gray-500 font-bold mt-1">
                  입력하신 데이터는 '저장하기' 버튼을 눌러야 DB에 반영됩니다.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-gray-100 p-2 rounded-xl">
                <span className="text-xs font-bold text-gray-500 ml-2">
                  시즌 선택
                </span>
                <select
                  className="bg-white border-none rounded-lg px-4 py-2 text-sm font-bold shadow-sm outline-none cursor-pointer"
                  value={leagueYear}
                  onChange={(e) => setLeagueYear(e.target.value)}
                >
                  {allMatchYears.map((y) => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm text-center whitespace-nowrap">
                  <thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-4">순위</th>
                      <th className="p-4 text-left">팀명</th>
                      <th className="p-4">경기</th>
                      <th className="p-4 text-blue-800 bg-blue-50/30">
                        승 (W)
                      </th>
                      <th className="p-4 text-blue-800 bg-blue-50/30">
                        무 (D)
                      </th>
                      <th className="p-4 text-blue-800 bg-blue-50/30">
                        패 (L)
                      </th>
                      <th className="p-4 text-blue-800 bg-blue-50/30">
                        득실차
                      </th>
                      <th className="p-4 text-blue-600 font-black">승점</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leagueTable.map((row, index) => (
                      <tr
                        key={`${row.team}-${leagueYear}`}
                        className={`hover:bg-blue-50/20 transition ${String(row.team).includes("숭실") ? "bg-blue-50/50 font-black border-l-4 border-ssu-black" : ""}`}
                      >
                        <td className="p-4 font-black">{row.rank}</td>
                        <td className="p-4 font-bold text-left">{row.team}</td>
                        <td className="p-4 font-bold text-gray-500">
                          {row.played}
                        </td>
                        {/* onChange와 index를 사용하도록 변경됨 */}
                        <td className="p-4 bg-blue-50/10">
                          <input
                            type="number"
                            className="w-16 border rounded p-1 text-center outline-none focus:border-blue-500 font-bold bg-white"
                            value={row.w}
                            onChange={(e) =>
                              handleLeagueStatChange(index, "w", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-4 bg-blue-50/10">
                          <input
                            type="number"
                            className="w-16 border rounded p-1 text-center outline-none focus:border-blue-500 font-bold bg-white"
                            value={row.d}
                            onChange={(e) =>
                              handleLeagueStatChange(index, "d", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-4 bg-blue-50/10">
                          <input
                            type="number"
                            className="w-16 border rounded p-1 text-center outline-none focus:border-blue-500 font-bold bg-white"
                            value={row.l}
                            onChange={(e) =>
                              handleLeagueStatChange(index, "l", e.target.value)
                            }
                          />
                        </td>
                        <td className="p-4 bg-blue-50/10">
                          <input
                            type="number"
                            className="w-16 border rounded p-1 text-center outline-none focus:border-blue-500 font-bold bg-white"
                            value={row.gd}
                            onChange={(e) =>
                              handleLeagueStatChange(
                                index,
                                "gd",
                                e.target.value,
                              )
                            }
                          />
                        </td>
                        <td className="p-4 font-black text-blue-600 text-lg">
                          {row.pts}
                        </td>
                      </tr>
                    ))}
                    {leagueTable.length === 0 && (
                      <tr>
                        <td
                          colSpan="8"
                          className="py-20 text-gray-400 font-bold text-center"
                        >
                          {leagueYear}년도 U리그 일정이 없습니다. 일정 탭에서
                          U리그 경기를 등록해주세요.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* 저장 버튼 영역 */}
              {leagueTable.length > 0 && (
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={handleSaveLeague}
                    className="bg-ssu-black text-[#FFD60A] font-black px-8 py-3 rounded-xl shadow-md hover:bg-black transition flex items-center gap-2"
                  >
                    <Save size={18} /> {leagueYear}년도 순위표 저장하기
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ========================================================= */}
        {/* 🔥 3. 선수단 관리 (칸반 보드 스타일, 드래그 앤 드롭 지원) */}
        {/* ========================================================= */}
        {activeSubTab === "players" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
              <h3 className="text-xl md:text-2xl font-black text-ssu-black flex items-center">
                <Users className="mr-2 text-blue-600" /> 선수단 관리
              </h3>
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-48">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="선수 검색"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500"
                    value={playerSearchTerm}
                    onChange={(e) => setPlayerSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 4분할 드래그 앤 드롭 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
              {PLAYER_STATUSES.map((statusCol) => (
                <div
                  key={statusCol.key}
                  className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[70vh]"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, statusCol.key)}
                >
                  <div
                    className={`p-4 border-b border-gray-200 font-black text-sm flex justify-between items-center ${statusCol.color}`}
                  >
                    {statusCol.label}
                    <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs border border-black/5">
                      {
                        searchedPlayers.filter(
                          (p) => (p.status || "current") === statusCol.key,
                        ).length
                      }
                      명
                    </span>
                  </div>
                  <div className="p-3 overflow-y-auto custom-scrollbar flex-1 space-y-3 bg-gray-50/50">
                    {searchedPlayers
                      .filter((p) => (p.status || "current") === statusCol.key)
                      .map((p) => (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, p.id)}
                          className={`bg-white p-3 rounded-xl border shadow-sm transition-all relative group cursor-grab active:cursor-grabbing ${p.isHidden ? "opacity-50 grayscale" : ""} border-gray-200 hover:border-blue-400 hover:shadow-md`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-ssu-black bg-gray-100 px-1.5 py-0.5 rounded">
                                {p.number}
                              </span>
                              <span className="font-black text-gray-900">
                                {p.name}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-3">
                            <button
                              onClick={() =>
                                onUpdatePlayer(p.id, { isHidden: !p.isHidden })
                              }
                              className={`flex-1 py-1.5 rounded text-[10px] font-bold flex items-center justify-center border transition ${p.isHidden ? "bg-red-50 text-red-600 border-red-200" : "bg-green-50 text-green-600 border-green-200"}`}
                            >
                              {p.isHidden ? (
                                <EyeOff size={12} className="mr-1" />
                              ) : (
                                <Eye size={12} className="mr-1" />
                              )}
                              {p.isHidden ? "숨김" : "노출"}
                            </button>
                            <button
                              onClick={() => openEditModal(p)}
                              className="flex-1 py-1.5 bg-gray-100 border border-gray-200 text-gray-600 rounded text-[10px] font-bold hover:bg-gray-200 flex items-center justify-center"
                            >
                              <Edit3 size={12} className="mr-1" /> 프로필
                            </button>
                            <button
                              onClick={() => setManagingCommentsPlayer(p)}
                              className="flex-1 py-1.5 bg-blue-50 border border-blue-200 text-blue-600 rounded text-[10px] font-bold hover:bg-blue-100 flex items-center justify-center"
                            >
                              <MessageSquare size={12} className="mr-1" /> 댓글(
                              {p.comments?.length || 0})
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        ﻿{/* ========================================================= */}     
          {/* 🔥 로깅 전용 팝업 모달 */}       
        {/* ========================================================= */}       
        {loggingMatch && (
          <div
            className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
            onClick={() => setLoggingMatch(null)}
          >
                       
            <div
              className={`bg-gray-50 rounded-2xl shadow-2xl w-full ${loggingMatch.status === "Finished" ? "max-w-2xl" : "max-w-4xl"} max-h-[90vh] overflow-y-auto flex flex-col`}
              onClick={(e) => e.stopPropagation()}
            >
                           
              <div
                className={`text-white p-5 md:p-6 flex justify-between items-center sticky top-0 z-20 shadow-md ${loggingMatch.status === "Finished" ? "bg-green-700" : "bg-ssu-black"}`}
              >
                               
                <div>
                                   
                  <h3 className="font-black text-xl flex items-center mb-1">
                    <Edit3 size={20} className="mr-2 text-white" />
                    {loggingMatch.status === "Finished"
                      ? "경기 부가 기록 수정 (MOM / 미디어)"
                      : "경기 데이터 종합 로깅실"}
                  </h3>
                                   
                  <p className="text-xs font-bold text-white/80">
                    [{loggingMatch.date}] vs {loggingMatch.opponent} (
                    {loggingMatch.type})
                  </p>
                                 
                </div>
                               
                <button
                  onClick={() => setLoggingMatch(null)}
                  className="text-white/50 hover:text-white bg-white/10 p-2 rounded-full transition"
                >
                  <X size={24} />
                </button>
                             
              </div>
                                          
              <div className="p-4 md:p-8 space-y-6">
                                                
                {/* 🟢 종료된 경기 수정폼 (MOM 드롭다운) */}               
                {loggingMatch.status === "Finished" ? (
                  <div className="space-y-6">
                                       
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col">
                                           
                      <h5 className="font-black text-gray-900 border-b border-gray-100 pb-3 mb-4 flex items-center text-lg">
                        <Award className="mr-2 text-yellow-500" size={20} /> Man
                        of the Match
                      </h5>
                                                                  
                      <div className="flex-1 flex flex-col">
                                               
                        {/* 기존 MOM이 존재할 때의 뷰어 UI */}                 
                             
                        {displayMom && !editingMom ? (
                          <div className="animate-fade-in">
                                                       
                            <div className="flex items-center space-x-4 bg-linear-to-r from-yellow-50 to-white p-5 rounded-xl border border-yellow-200 shadow-sm flex-1">
                                                           
                              <div className="bg-[#FFD60A] text-ssu-black p-3 rounded-full shadow-md">
                                <Award size={28} />
                              </div>
                                                           
                              <div>
                                                               
                                <div className="text-[10px] text-yellow-600 font-bold uppercase tracking-widest mb-0.5">
                                  현재 지정된 MOM
                                </div>
                                                               
                                <div className="font-black text-2xl text-gray-900">
                                  {displayMom}
                                </div>
                                                             
                              </div>
                                                         
                            </div>
                                                       
                            <button
                              onClick={() => {
                                setEditingMom(true);
                              }}
                              className="mt-4 w-full text-xs text-gray-600 font-bold hover:text-ssu-black transition flex items-center justify-center bg-gray-50 hover:bg-gray-100 py-3 rounded-xl border border-gray-200"
                            >
                                                           
                              <Edit3 size={14} className="mr-1.5" /> MOM 다시
                              선택하기                            
                            </button>
                                                     
                          </div>
                        ) : (
                          /* MOM 수정 모드 (MatchDetailModal 로직 100% 반영) */
                          <div className="animate-fade-in">
                                                       
                            {isLoadingLogs ? (
                              <div className="text-sm font-bold text-gray-500 py-6 text-center animate-pulse bg-gray-50 rounded-xl border border-gray-100">
                                출전 선수 명단을 불러오는 중입니다...
                              </div>
                            ) : participants.length > 0 ? (
                              <div className="flex flex-col gap-3">
                                                                 
                                <select
                                  className="w-full border border-gray-300 rounded-xl px-4 py-3.5 text-sm font-bold bg-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100 outline-none transition shadow-sm"
                                  value={selectedMomId || ""}
                                  onChange={(e) =>
                                    setSelectedMomId(e.target.value)
                                  }
                                >
                                                                     
                                  <option value="">선수 선택</option>           
                                                         
                                  {participants.map((id) => {
                                    const p = players.find((x) => x.id === id);
                                    if (!p) return null;
                                    return (
                                      <option key={id} value={id}>
                                        {p.name}
                                        {p.status !== "current" ? "" : ""}
                                      </option>
                                    );
                                  })}
                                                                   
                                </select>
                                                                 
                                {displayMom && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingMom(false)}
                                    className="text-xs text-gray-500 hover:text-gray-800 text-right underline font-bold mt-1"
                                  >
                                                                         변경
                                    취소                                    
                                  </button>
                                )}
                                                               
                              </div>
                            ) : (
                              <div className="text-sm font-bold text-red-500 bg-red-50 p-6 text-center rounded-xl border border-red-100">
                                                                 이 경기에
                                기록된 출전 선수가 없습니다.                    
                                           
                              </div>
                            )}
                                                     
                          </div>
                        )}
                                             
                      </div>
                                         
                    </div>
                                        {/* 미디어 수정 폼 */}                 
                     
                    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                                           
                      <h5 className="font-black text-gray-900 mb-5 flex items-center border-b border-gray-100 pb-3">
                        <Youtube className="mr-2 text-red-500" /> 관련 미디어
                        링크 수정
                      </h5>
                                           
                      <div className="space-y-4">
                                               
                        <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1.5 items-center">
                            <PlayCircle size={14} className="mr-1" /> 유튜브
                            하이라이트
                          </label>
                          <input
                            className="w-full p-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-red-500"
                            placeholder="URL 입력"
                            value={editMedia.highlight}
                            onChange={(e) =>
                              setEditMedia({
                                ...editMedia,
                                highlight: e.target.value,
                              })
                            }
                          />
                        </div>
                                               
                        <div>
                          <label className="text-xs font-bold text-gray-500 mb-1.5 flex items-center">
                            <BookOpen size={14} className="mr-1" /> 네이버
                            블로그 리뷰
                          </label>
                          <input
                            className="w-full p-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-green-500"
                            placeholder="URL 입력"
                            value={editMedia.report}
                            onChange={(e) =>
                              setEditMedia({
                                ...editMedia,
                                report: e.target.value,
                              })
                            }
                          />
                        </div>
                                               
                        <div>
                          <label className="text-xs font-bold text-gray-500 mb-1.5 flex items-center">
                            <Mic size={14} className="mr-1" /> 선수 인터뷰
                            영상/기사
                          </label>
                          <input
                            className="w-full p-3 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500"
                            placeholder="URL 입력"
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
                                         
                    </div>
                                       
                    <button
                      onClick={handleSaveSimpleEdit}
                      className="w-full bg-green-600 text-white py-4 rounded-xl font-black shadow-lg hover:bg-green-700 transition-all text-lg flex items-center justify-center gap-2"
                    >
                      <Save size={20} /> 수정사항 최종 저장
                    </button>
                                     
                  </div>
                ) : (
                  /* 🔵 예정된 경기 (풀 로깅 폼) */
                  <div className="space-y-6">
                                       
                    <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm">
                                           
                      <h5 className="font-black text-gray-900 mb-5 flex items-center border-b border-gray-100 pb-3">
                        <span className="w-6 h-6 rounded bg-ssu-black text-white flex items-center justify-center text-xs mr-2 shadow-sm">
                          1
                        </span>
                        스코어 및 경기 시간
                      </h5>
                                           
                      <div className="grid md:grid-cols-2 gap-6">
                                               
                        <div className="flex items-center justify-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                                                   
                          <div className="text-center w-24">
                            <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase block mb-1">
                              HOME
                            </label>
                            <input
                              type="number"
                              className="w-full text-4xl font-black text-center text-blue-700 bg-transparent border-b-2 border-gray-300 focus:border-blue-600 outline-none"
                              value={recordScore.home}
                              onChange={(e) =>
                                setRecordScore({
                                  ...recordScore,
                                  home: parseInt(e.target.value),
                                })
                              }
                            />
                          </div>
                          <span className="text-2xl font-light text-gray-300 pt-3">
                            :
                          </span>
                                                   
                          <div className="text-center w-24">
                            <label className="text-[10px] font-black tracking-widest text-gray-400 uppercase block mb-1">
                              AWAY
                            </label>
                            <input
                              type="number"
                              className="w-full text-4xl font-black text-center text-gray-800 bg-transparent border-b-2 border-gray-300 focus:border-blue-600 outline-none"
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
                                               
                        <div className="space-y-4">
                                                   
                          <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">
                              승부차기 결과
                            </label>
                            <input
                              type="text"
                              placeholder="예: 4:3"
                              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-bold outline-none focus:border-blue-500"
                              value={recordPso}
                              onChange={(e) => setRecordPso(e.target.value)}
                            />
                          </div>
                                                   
                          <div>
                            <label className="text-xs font-bold text-gray-500 block mb-1">
                              경기 시간
                            </label>
                            <div className="flex items-center">
                              <input
                                type="number"
                                value={matchDuration}
                                onChange={(e) =>
                                  setMatchDuration(Number(e.target.value))
                                }
                                className="w-24 p-2.5 border border-gray-300 rounded-l-lg text-sm font-bold text-blue-600 outline-none focus:border-blue-500 bg-blue-50/30 text-center"
                              />
                              <span className="bg-gray-100 border border-l-0 border-gray-300 px-4 py-2.5 rounded-r-lg text-sm font-bold text-gray-500">
                                분
                              </span>
                            </div>
                          </div>
                                                 
                        </div>
                                             
                      </div>
                                         
                    </div>
                                       
                    <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm">
                                           
                      <h5 className="font-black text-gray-900 mb-5 flex items-center border-b border-gray-100 pb-3">
                        <span className="w-6 h-6 rounded bg-ssu-black text-white flex items-center justify-center text-xs mr-2 shadow-sm">
                          2
                        </span>
                        선발 라인업 구성
                      </h5>
                                           
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                                               
                        <div className="grid grid-cols-1 gap-3">
                                                   
                          {["FW", "MF", "DF", "GK"].map((pos) => (
                            <div
                              key={pos}
                              className="flex flex-col md:flex-row md:items-center gap-2 border-b border-gray-200/60 pb-2 last:border-0 last:pb-0"
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
                                        onClick={() =>
                                          handleAddStartingPlayer(p.id)
                                        }
                                        disabled={isSelected}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-all ${isSelected ? "bg-blue-600 text-white border-blue-600 shadow-sm opacity-50" : "bg-white text-gray-700 border-gray-300 hover:border-blue-500 hover:text-blue-600"}`}
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
                      <div className="min-h-12.5 bg-white border-2 border-dashed border-gray-200 rounded-xl p-3 flex flex-wrap gap-2">
                        {startingLineup.length === 0 ? (
                          <span className="text-xs text-gray-400 font-bold m-auto">
                            위에서 선발 선수를 클릭하세요.
                          </span>
                        ) : (
                          startingLineup.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center gap-1.5 bg-ssu-black text-white rounded-md pl-2.5 pr-1 py-1 shadow-sm"
                            >
                              <span className="text-[11px] font-bold">
                                {p.name}
                              </span>
                              <button
                                onClick={() => handleRemoveStartingPlayer(p.id)}
                                className="p-1 hover:bg-white/20 rounded transition text-red-400"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))
                        )}
                                             
                      </div>
                                         
                    </div>
                                       
                    <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm">
                                           
                      <h5 className="font-black text-gray-900 mb-5 flex items-center border-b border-gray-100 pb-3">
                        <span className="w-6 h-6 rounded bg-ssu-black text-white flex items-center justify-center text-xs mr-2 shadow-sm">
                          3
                        </span>
                        교체 로깅
                      </h5>
                      <div className="flex flex-col md:flex-row gap-2 mb-4">
                        <select
                          id="outPlayer"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold outline-none"
                          defaultValue=""
                        >
                          <option value="" disabled>
                            ⬇️ OUT
                          </option>
                          {currentOnField.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                                               
                        <select
                          id="inPlayer"
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold outline-none"
                          defaultValue=""
                        >
                          <option value="" disabled>
                            ⬆️ IN
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
                          placeholder="시간(분)"
                          min="0"
                          max={matchDuration}
                          className="w-full md:w-24 border border-gray-300 rounded-lg px-2 py-2 text-xs font-bold text-center outline-none"
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
                          className="bg-gray-800 text-white font-bold rounded-lg px-5 py-2 text-xs hover:bg-black transition"
                        >
                          추가
                        </button>
                                             
                      </div>
                                           
                      <div className="space-y-2">
                                               
                        {substitutions.map((sub, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-gray-50 border border-gray-200 p-2.5 rounded-lg text-xs font-bold"
                          >
                                                       
                            <div className="flex items-center gap-3">
                                                           
                              <span className="bg-white border border-gray-200 text-gray-500 px-2 py-0.5 rounded">
                                {sub.minute}분
                              </span>
                                                           
                              <span className="text-red-600">
                                OUT {getPlayerName(sub.outPlayerId)}
                              </span>
                              <span>▶</span>
                              <span className="text-green-600">
                                IN {getPlayerName(sub.inPlayerId)}
                              </span>
                                                         
                            </div>
                                                       
                            <button
                              onClick={() => handleRemoveSubstitution(idx)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded bg-white border border-gray-200 shadow-sm"
                            >
                              <Trash2 size={12} />
                            </button>
                                                     
                          </div>
                        ))}
                                             
                      </div>
                                         
                    </div>
                                       
                    <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-sm">
                                           
                      <h5 className="font-black text-gray-900 mb-5 flex items-center border-b border-gray-100 pb-3">
                        <span className="w-6 h-6 rounded bg-ssu-black text-white flex items-center justify-center text-xs mr-2 shadow-sm">
                          4
                        </span>
                        공격 스탯 & MOM
                      </h5>
                                           
                      <div className="overflow-x-auto border border-gray-200 rounded-xl custom-scrollbar">
                                               
                        <table className="w-full text-xs text-center whitespace-nowrap">
                                                   
                          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                                                       
                            <tr>
                              <th className="px-3 py-2 text-left">선수</th>
                              <th className="px-3 py-2 text-blue-600">득점</th>
                              <th className="px-3 py-2 text-green-600">도움</th>
                              <th className="px-3 py-2 text-yellow-600">
                                MOM 지정
                              </th>
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
                                  className={isMom ? "bg-yellow-50/30" : ""}
                                >
                                                                   
                                  <td className="px-3 py-2 font-bold text-gray-800 text-left">
                                    {player.name}
                                  </td>
                                                                   
                                  <td className="px-3 py-2">
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
                                      className="w-12 text-center border rounded py-1 font-bold text-blue-600 outline-none"
                                    />
                                  </td>
                                                                   
                                  <td className="px-3 py-2">
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
                                      className="w-12 text-center border rounded py-1 font-bold text-green-600 outline-none"
                                    />
                                  </td>
                                                                   
                                  <td className="px-3 py-2">
                                    <button
                                      onClick={() =>
                                        setMomId(isMom ? null : playerId)
                                      }
                                      className={`p-1.5 rounded-full transition-all ${isMom ? "bg-[#FFD60A] text-ssu-black shadow-md scale-110" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                                    >
                                      <Award size={14} />
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
                                  먼저 선발 라인업을 구성하세요.
                                </td>
                              </tr>
                            )}
                                                     
                          </tbody>
                                                 
                        </table>
                                             
                      </div>
                                         
                    </div>
                                       
                    <button
                      onClick={handleSaveFullLogging}
                      className="w-full bg-ssu-black text-[#FFD60A] py-4 rounded-xl font-black shadow-lg hover:bg-black transition-all text-lg flex items-center justify-center gap-2 border-2 border-ssu-black"
                    >
                                            <Save size={20} /> 경기 결과 전체 DB
                      최종 반영                    
                    </button>
                                     
                  </div>
                )}
                             
              </div>
                         
            </div>
                     
          </div>
        )}
        {/* 프로필 수정 모달 */}
        {editingPlayer && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                       
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
                           
              <div className="bg-ssu-black text-white p-5 flex justify-between items-center sticky top-0 z-10">
                <h3 className="font-black text-lg flex items-center">
                  <Edit3 size={18} className="mr-2 text-[#FFD60A]" /> [
                  {editingPlayer.name}] 상세 프로필 수정
                </h3>
                <button
                  onClick={() => setEditingPlayer(null)}
                  className="text-white/50 hover:text-white transition"
                >
                  <X size={24} />
                </button>
              </div>
                           
              <div className="p-6 md:p-8 space-y-6">
                               
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                                   
                  <p className="text-xs font-black text-blue-800 mb-4 border-b border-blue-200 pb-2">
                    기본 정보
                  </p>
                                   
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                       
                    <div className="col-span-2 md:col-span-1">
                      <label className="text-[10px] text-gray-500 font-bold block mb-1">
                        이름
                      </label>
                      <input
                        className="w-full p-2.5 border rounded-lg text-sm font-bold outline-none focus:border-blue-500"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                    </div>
                                       
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold block mb-1">
                        등번호
                      </label>
                      <input
                        type="number"
                        className="w-full p-2.5 border rounded-lg text-sm font-bold outline-none focus:border-blue-500 text-center"
                        value={editForm.number}
                        onChange={(e) =>
                          setEditForm({ ...editForm, number: e.target.value })
                        }
                      />
                    </div>
                                       
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold block mb-1">
                        포지션
                      </label>
                      <select
                        className="w-full p-2.5 border rounded-lg text-sm font-bold outline-none focus:border-blue-500 bg-white"
                        value={editForm.position}
                        onChange={(e) =>
                          setEditForm({ ...editForm, position: e.target.value })
                        }
                      >
                        <option value="FW">FW</option>
                        <option value="MF">MF</option>
                        <option value="DF">DF</option>
                        <option value="GK">GK</option>
                      </select>
                    </div>
                                       
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold block mb-1">
                        소속 상태
                      </label>
                      <select
                        className="w-full p-2.5 border rounded-lg text-sm font-bold outline-none focus:border-blue-500 bg-white"
                        value={editForm.status}
                        onChange={(e) =>
                          setEditForm({ ...editForm, status: e.target.value })
                        }
                      >
                        <option value="current">재학생</option>
                        <option value="graduated">졸업생</option>
                        <option value="pro_joined">취업</option>
                        <option value="left">퇴단</option>
                      </select>
                    </div>
                                       
                    {editForm.status === "current" ? (
                      <div>
                        <label className="text-[10px] text-gray-500 font-bold block mb-1">
                          학년 (숫자)
                        </label>
                        <input
                          type="number"
                          className="w-full p-2.5 border rounded-lg text-sm font-bold outline-none focus:border-blue-500 text-center"
                          value={editForm.grade}
                          onChange={(e) =>
                            setEditForm({ ...editForm, grade: e.target.value })
                          }
                        />
                      </div>
                    ) : (
                      <div className="col-span-3">
                        <label className="text-[10px] text-gray-500 font-bold block mb-1">
                          현 소속 구단
                        </label>
                        <input
                          className="w-full p-2.5 border rounded-lg text-sm font-bold outline-none focus:border-blue-500"
                          value={editForm.profile.currentTeam}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              profile: {
                                ...editForm.profile,
                                currentTeam: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    )}
                                     
                  </div>
                                 
                </div>
                               
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                                   
                  <p className="text-xs font-black text-green-800 mb-4 border-b border-green-200 pb-2">
                    상세 프로필
                  </p>
                                   
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                       
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold block mb-1">
                        생년월일
                      </label>
                      <input
                        placeholder="YY.MM.DD"
                        className="w-full p-2.5 border rounded-lg text-sm font-bold outline-none focus:border-green-500"
                        value={editForm.profile.birthday}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            profile: {
                              ...editForm.profile,
                              birthday: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                                       
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold block mb-1">
                        신장 (cm)
                      </label>
                      <input
                        type="number"
                        className="w-full p-2.5 border rounded-lg text-sm font-bold outline-none focus:border-green-500 text-center"
                        value={editForm.profile.height}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            profile: {
                              ...editForm.profile,
                              height: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                                       
                    <div>
                      <label className="text-[10px] text-gray-500 font-bold block mb-1">
                        체중 (kg)
                      </label>
                      <input
                        type="number"
                        className="w-full p-2.5 border rounded-lg text-sm font-bold outline-none focus:border-green-500 text-center"
                        value={editForm.profile.weight}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            profile: {
                              ...editForm.profile,
                              weight: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                                       
                    <div className="col-span-2 md:col-span-3">
                      <label className="text-[10px] text-gray-500 font-bold block mb-1">
                        출신 고등학교
                      </label>
                      <input
                        className="w-full p-2.5 border rounded-lg text-sm font-bold outline-none focus:border-green-500"
                        value={editForm.profile.highSchool}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            profile: {
                              ...editForm.profile,
                              highSchool: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                                     
                  </div>
                                 
                </div>
                               
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                                   
                  <p className="text-xs font-black text-pink-800 mb-4 border-b border-pink-200 pb-2">
                    선수 사진 등록
                  </p>
                                   
                  <div className="flex items-center gap-4">
                                       
                    <div className="w-24 h-24 rounded-full border-4 border-white shadow-md bg-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                      {editForm.profile.photo ? (
                        <img
                          src={editForm.profile.photo}
                          className="w-full h-full object-cover object-top"
                          alt="preview"
                        />
                      ) : (
                        <ImageIcon size={32} className="text-gray-400" />
                      )}
                    </div>
                                       
                    <div className="flex-1">
                      <label className="text-[10px] text-gray-500 font-bold block mb-2">
                        파일 선택
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-ssu-black file:text-[#FFD60A] hover:file:bg-black transition cursor-pointer"
                      />
                    </div>
                                     
                  </div>
                                 
                </div>
                             
              </div>
                           
              <div className="p-5 border-t border-gray-200 bg-white flex justify-end gap-3 sticky bottom-0 z-10 rounded-b-2xl">
                               
                <button
                  onClick={() => setEditingPlayer(null)}
                  className="px-6 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
                >
                  취소하기
                </button>
                               
                <button
                  onClick={handleSaveProfile}
                  className="px-8 py-3 rounded-xl font-black text-[#FFD60A] bg-ssu-black hover:bg-black transition shadow-lg flex items-center gap-2"
                >
                  <Save size={18} /> 수정사항 최종 저장
                </button>
                             
              </div>
                         
            </div>
                     
          </div>
        )}
        {/* ========================================================= */}
        {/* 🔥 선수 댓글 관리 모달 (FIXED) */}
        {/* ========================================================= */}
        {managingCommentsPlayer && (
          <div
            className="fixed inset-0 z-999 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
            onClick={() => setManagingCommentsPlayer(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-blue-600 text-white p-4 flex justify-between items-center sticky top-0 z-10 rounded-t-2xl">
                <h3 className="font-black text-lg flex items-center">
                  <MessageSquare size={18} className="mr-2" />
                  {managingCommentsPlayer.name} 응원댓글 관리
                </h3>
                <button
                  onClick={() => setManagingCommentsPlayer(null)}
                  className="text-white/50 hover:text-white transition"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-gray-50">
                {managingCommentsPlayer.comments &&
                managingCommentsPlayer.comments.length > 0 ? (
                  <ul className="space-y-3">
                    {managingCommentsPlayer.comments.map((c) => (
                      <li
                        key={c.id}
                        className="bg-white border border-gray-200 p-4 rounded-xl flex justify-between items-start gap-4 group hover:border-red-200 transition shadow-sm"
                      >
                        <div className="text-sm flex-1">
                          <p className="font-black text-ssu-black mb-1">
                            {c.author}
                          </p>
                          <p className="text-gray-700 leading-relaxed">
                            {c.text}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-2 font-bold">
                            {new Date(c.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="bg-gray-50 text-gray-400 border border-gray-200 hover:text-white hover:bg-red-500 hover:border-red-500 p-2.5 rounded-lg transition shadow-sm"
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-center py-10 text-gray-400 font-bold bg-white rounded-xl border border-dashed border-gray-200">
                    등록된 응원 댓글이 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
