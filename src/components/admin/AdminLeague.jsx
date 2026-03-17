import React, { useState, useMemo, useEffect } from "react";
import { Trophy, Save } from "lucide-react";

const AdminLeague = ({
  matches,
  league,
  onAddLeagueTeam,
  onUpdateLeagueTeam,
}) => {
  // 상태 관리
  const [leagueYear, setLeagueYear] = useState("2026");
  const [leagueTable, setLeagueTable] = useState([]);

  // 연도 목록 추출
  const allMatchYears = useMemo(
    () =>
      [...new Set(matches.map((m) => m.year.toString()))].sort((a, b) => b - a),
    [matches],
  );

  // 타겟 팀(같은 조) 추출
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

  // 순위표 생성 로직
  useEffect(() => {
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

    const sorted = table
      .sort((a, b) => {
        if (a.pts !== b.pts) return b.pts - a.pts;
        return b.gd - a.gd;
      })
      .map((t, idx) => ({ ...t, rank: idx + 1 }));

    setLeagueTable(sorted);
  }, [targetTeams, league, leagueYear]);

  // 폼 입력 핸들러
  const handleLeagueStatChange = (index, field, value) => {
    const newTable = [...leagueTable];
    newTable[index] = {
      ...newTable[index],
      [field]: value === "" ? "" : Number(value),
    };
    const w = Number(newTable[index].w) || 0;
    const d = Number(newTable[index].d) || 0;
    const l = Number(newTable[index].l) || 0;
    newTable[index].pts = w * 3 + d * 1;
    newTable[index].played = w + d + l;
    setLeagueTable(newTable);
  };

  // DB 저장 로직
  const handleSaveLeague = async () => {
    try {
      const promises = leagueTable.map((row) => {
        const data = {
          team: row.team,
          year: row.year,
          w: Number(row.w) || 0,
          d: Number(row.d) || 0,
          l: Number(row.l) || 0,
          gd: Number(row.gd) || 0,
        };
        if (row.id) return onUpdateLeagueTeam(row.id, data);
        else return onAddLeagueTeam(data);
      });
      await Promise.all(promises);
      alert(`${leagueYear}년도 순위표가 성공적으로 저장되었습니다!`);
    } catch (err) {
      alert("저장 실패: " + err.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="bg-white p-6 md:p-8 rounded-4xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h3 className="text-2xl font-black text-ssu-black flex items-center">
            <Trophy className="mr-2 text-ssu-blue" /> 연도별 리그 순위 수정
          </h3>
          <p className="text-sm text-slate-500 font-bold mt-2">
            표에서 직접 숫자를 수정한 후 반드시 저장 버튼을 눌러주세요.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="text-xs font-bold text-slate-500 pl-2">
            시즌 필터
          </span>
          <select
            className="bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm font-black shadow-sm outline-none cursor-pointer"
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

      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-center whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 font-black border-b border-slate-100 text-xs uppercase tracking-widest">
              <tr>
                <th className="p-4">Rank</th>
                <th className="p-4 text-left">Team</th>
                <th className="p-4">P (경기)</th>
                <th className="p-4 text-ssu-blue bg-blue-50/50">W (승)</th>
                <th className="p-4 text-ssu-blue bg-blue-50/50">D (무)</th>
                <th className="p-4 text-ssu-blue bg-blue-50/50">L (패)</th>
                <th className="p-4 text-ssu-blue bg-blue-50/50">GD (득실)</th>
                <th className="p-4 text-ssu-blue text-base">PTS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {leagueTable.map((row, index) => (
                <tr
                  key={`${row.team}-${leagueYear}`}
                  className={`hover:bg-blue-50/30 transition-colors ${String(row.team).includes("숭실") ? "bg-blue-50/50 font-black border-l-4 border-ssu-blue" : "text-slate-600"}`}
                >
                  <td className="p-4 font-black text-ssu-black">{row.rank}</td>
                  <td className="p-4 font-black text-left text-ssu-black">
                    {row.team}
                  </td>
                  <td className="p-4 font-bold text-slate-400">{row.played}</td>
                  <td className="p-3 bg-blue-50/10">
                    <input
                      type="number"
                      className="w-14 border border-slate-200 rounded-lg p-2 text-center outline-none focus:border-ssu-blue font-bold bg-white shadow-sm"
                      value={row.w}
                      onChange={(e) =>
                        handleLeagueStatChange(index, "w", e.target.value)
                      }
                    />
                  </td>
                  <td className="p-3 bg-blue-50/10">
                    <input
                      type="number"
                      className="w-14 border border-slate-200 rounded-lg p-2 text-center outline-none focus:border-ssu-blue font-bold bg-white shadow-sm"
                      value={row.d}
                      onChange={(e) =>
                        handleLeagueStatChange(index, "d", e.target.value)
                      }
                    />
                  </td>
                  <td className="p-3 bg-blue-50/10">
                    <input
                      type="number"
                      className="w-14 border border-slate-200 rounded-lg p-2 text-center outline-none focus:border-ssu-blue font-bold bg-white shadow-sm"
                      value={row.l}
                      onChange={(e) =>
                        handleLeagueStatChange(index, "l", e.target.value)
                      }
                    />
                  </td>
                  <td className="p-3 bg-blue-50/10">
                    <input
                      type="number"
                      className="w-14 border border-slate-200 rounded-lg p-2 text-center outline-none focus:border-ssu-blue font-bold bg-white shadow-sm"
                      value={row.gd}
                      onChange={(e) =>
                        handleLeagueStatChange(index, "gd", e.target.value)
                      }
                    />
                  </td>
                  <td className="p-4 font-black text-ssu-blue text-xl">
                    {row.pts}
                  </td>
                </tr>
              ))}
              {leagueTable.length === 0 && (
                <tr>
                  <td
                    colSpan="8"
                    className="py-24 text-slate-400 font-bold text-center bg-slate-50/50"
                  >
                    {leagueYear}년도 U리그 일정이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {leagueTable.length > 0 && (
          <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleSaveLeague}
              className="bg-ssu-black text-[#FFD60A] font-black px-10 py-4 rounded-xl shadow-lg hover:bg-black transition-all flex items-center gap-2"
            >
              <Save size={20} /> {leagueYear}년도 순위 DB 저장
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminLeague;
