export const parseScorers = (scorerData) => {
  if (!scorerData || scorerData === "-") return [];

  const normalized = [];

  // 1) 입력 형태를 먼저 통일
  if (Array.isArray(scorerData)) {
    for (const s of scorerData) {
      if (typeof s === "object" && s?.name) {
        normalized.push({
          name: String(s.name).trim(),
          goals: Number(s.goals ?? s.count ?? 1) || 1,
        });
      } else if (s != null) {
        normalized.push({
          name: String(s).trim(),
          goals: 1,
        });
      }
    }
  } else if (typeof scorerData === "string") {
    const parts = scorerData.split(",").map((s) => s.trim());

    for (const part of parts) {
      const match = part.match(/^(.+?)\((\d+)\)$/);

      if (match) {
        normalized.push({
          name: match[1].trim(),
          goals: parseInt(match[2], 10),
        });
      } else if (part && part !== "-") {
        normalized.push({
          name: part.trim(),
          goals: 1,
        });
      }
    }
  } else {
    return [];
  }

  // 2) 같은 이름 병합
  const merged = new Map();

  for (const scorer of normalized) {
    const key = scorer.name;
    if (!key) continue;

    if (!merged.has(key)) {
      merged.set(key, {
        name: key,
        goals: 0,
      });
    }

    merged.get(key).goals += Number(scorer.goals) || 0;
  }

  return [...merged.values()];
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
