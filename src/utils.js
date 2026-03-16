export const parseScorers = (scorerData) => {
  if (!scorerData || scorerData === "-") return [];
  if (Array.isArray(scorerData))
    return scorerData.map((s) =>
      typeof s === "object" && s.name
        ? { name: s.name, goals: s.goals || s.count || 1 }
        : { name: String(s), goals: 1 },
    );
  const scorers = [];
  if (typeof scorerData !== "string") return [];
  const parts = scorerData.split(",").map((s) => s.trim());
  for (const part of parts) {
    const match = part.match(/^(.+?)\((\d+)\)$/);
    if (match)
      scorers.push({ name: match[1].trim(), goals: parseInt(match[2]) });
    else if (part && part !== "-")
      scorers.push({ name: part.trim(), goals: 1 });
  }
  return scorers;
};

export const parseAssists = (assistData) => {
  if (!assistData || assistData === "-") return [];
  if (Array.isArray(assistData))
    return assistData.map((a) => (typeof a === "object" ? a.name : String(a)));
  if (typeof assistData !== "string") return [];
  return assistData
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

export const compressImageToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 300;
        const scaleSize = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
        canvas.width = img.width * scaleSize;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

// utils.js 또는 별도의 로직 파일
export const calculatePlayerRankings = (match_logs, players, targetYear) => {
  if (!match_logs || !match_logs.length) return [];

  const statsMap = {};
  const year = Number(targetYear);

  // 1. 해당 연도 데이터 필터링 및 누적
  match_logs
    .filter((log) => Number(log.year) === year)
    .forEach((log) => {
      let pName = log.name;
      const pId = log.playerId || log.player_id || pName;

      if (!pName && log.playerId) {
        const pInfo = players.find((p) => p.id === log.playerId);
        if (pInfo) pName = pInfo.name;
      }
      if (!pName) return;

      if (!statsMap[pId]) {
        statsMap[pId] = {
          id: pId,
          name: pName,
          position: players.find((p) => p.name === pName)?.position || "-",
          apps: 0,
          mins: 0,
          goals: 0,
          assists: 0,
        };
      }

      statsMap[pId].apps += 1;
      statsMap[pId].mins +=
        Number(log.minutes || log.minutesPlayed || log.time) || 0;
      statsMap[pId].goals += Number(log.goals) || 0;
      statsMap[pId].assists += Number(log.assists || log.assist) || 0;
    });

  // 2. 결과 가공 및 기본 정렬 (공격포인트 순)
  return Object.values(statsMap)
    .map((p) => ({
      ...p,
      points: p.goals + p.assists,
    }))
    .filter((p) => p.apps > 0)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goals !== a.goals) return b.goals - a.goals;
      return b.assists - a.assists;
    });
};
