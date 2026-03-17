import React, { useState } from "react";
import {
  Calendar,
  Plus,
  Upload,
  Check,
  Trash2,
  Settings,
  Edit3,
} from "lucide-react";

const AdminMatches = ({
  matches,
  onAddMatch,
  onDeleteMatch,
  openLoggingModal,
}) => {
  const [showAddSingle, setShowAddSingle] = useState(false);
  const [showAddCSV, setShowAddCSV] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState([]);

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
    U리그: [
      "1라운드",
      "2라운드",
      "3라운드",
      "4라운드",
      "5라운드",
      "6라운드",
      "7라운드",
      "8라운드",
      "9라운드",
      "10라운드",
    ],
    춘계대회: ["조별리그", "20강", "16강", "8강", "4강", "결승"],
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
    round: "1라운드",
    isHome: true,
    venue: "",
  });

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
      round: "1라운드",
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

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* 헤더 및 등록 버튼 그룹 */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 bg-white p-6 md:p-8 rounded-4xl shadow-sm border border-slate-100">
        <div>
          <h3 className="text-2xl font-black text-ssu-black flex items-center">
            <Calendar className="mr-2 text-ssu-blue" /> 경기 데이터 로깅실
          </h3>
          <p className="text-sm text-slate-500 font-bold mt-2">
            예정 경기를 등록하고 종료된 경기의 상세 데이터를 기록합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowAddSingle(!showAddSingle);
              setShowAddCSV(false);
            }}
            className={`flex items-center text-sm px-5 py-3 rounded-xl font-bold transition shadow-sm ${showAddSingle ? "bg-ssu-black text-[#FFD60A]" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            <Plus size={16} className="mr-1.5" /> 개별 등록
          </button>
          <button
            onClick={() => {
              setShowAddCSV(!showAddCSV);
              setShowAddSingle(false);
            }}
            className={`flex items-center text-sm px-5 py-3 rounded-xl font-bold transition shadow-sm ${showAddCSV ? "bg-ssu-black text-[#FFD60A]" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            <Upload size={16} className="mr-1.5" /> CSV 등록
          </button>
        </div>
      </div>

      {/* 개별 등록 폼 */}
      {showAddSingle && (
        <form
          onSubmit={handleAddSingleMatch}
          className="bg-white p-6 md:p-8 rounded-4xl border border-slate-100 shadow-sm animate-fade-in"
        >
          <h4 className="font-black text-ssu-black mb-6 text-lg">
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
                className="w-full p-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-ssu-blue"
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
                className="w-full p-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-ssu-blue"
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
                className="w-full p-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-ssu-blue"
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
                className="w-full p-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-ssu-blue"
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
                className="w-full p-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-ssu-blue bg-white"
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
                className="w-full p-3 rounded-xl border border-gray-300 text-sm outline-none focus:border-ssu-blue bg-white"
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
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-6 mt-6 border-t border-gray-100">
            <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
              <button
                type="button"
                onClick={() => setNewMatch({ ...newMatch, isHome: true })}
                className={`flex-1 md:px-10 py-2.5 text-sm font-bold rounded-lg transition-all ${newMatch.isHome ? "bg-white text-ssu-blue shadow-sm" : "text-gray-500"}`}
              >
                HOME
              </button>
              <button
                type="button"
                onClick={() => setNewMatch({ ...newMatch, isHome: false })}
                className={`flex-1 md:px-10 py-2.5 text-sm font-bold rounded-lg transition-all ${!newMatch.isHome ? "bg-white text-ssu-blue shadow-sm" : "text-gray-500"}`}
              >
                AWAY
              </button>
            </div>
            <button
              type="submit"
              className="w-full md:w-auto bg-ssu-black text-[#FFD60A] font-black rounded-xl px-10 py-3.5 hover:bg-black transition-all"
            >
              경기 등록완료
            </button>
          </div>
        </form>
      )}

      {/* CSV 등록 폼 */}
      {showAddCSV && (
        <div className="bg-white p-6 md:p-8 rounded-4xl border border-slate-100 shadow-sm animate-fade-in">
          <div className="text-xs text-blue-800 bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
            <p className="font-bold mb-1">
              <Settings size={14} className="inline mr-1" /> CSV 등록 가이드
            </p>
            <p>날짜,시간,대회명,라운드,상대팀,경기장 순서대로 작성하세요.</p>
          </div>
          <textarea
            className="w-full h-32 p-4 border border-gray-300 rounded-xl text-sm font-mono focus:outline-none focus:border-ssu-blue custom-scrollbar"
            placeholder="2026-03-14,14:00,U리그,1라운드,고려대,고려대녹지구장"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <div className="flex gap-2 justify-end mt-4">
            <button
              type="button"
              onClick={handleCSVParse}
              className="bg-slate-100 text-slate-700 font-bold px-6 py-3 rounded-xl text-sm hover:bg-slate-200 transition"
            >
              미리보기
            </button>
            {csvPreview.length > 0 && (
              <button
                type="button"
                onClick={handleCSVImport}
                className="bg-ssu-black text-[#FFD60A] font-bold px-6 py-3 rounded-xl text-sm shadow-md hover:bg-black transition"
              >
                <Check size={16} className="mr-1 inline" /> {csvPreview.length}
                개 일괄 등록
              </button>
            )}
          </div>
        </div>
      )}

      {/* 등록된 경기 리스트 */}
      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 font-black text-slate-600 text-sm flex justify-between items-center">
          <span>등록된 경기 목록 (클릭 시 상세 로깅)</span>
          <span className="bg-blue-100 text-ssu-blue px-3 py-1 rounded-full text-xs">
            {matches.length}개
          </span>
        </div>
        <ul className="divide-y divide-slate-100 max-h-150 overflow-y-auto custom-scrollbar">
          {matches
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map((match) => (
              <li
                key={match.id}
                className="flex flex-col md:flex-row md:items-center justify-between p-5 hover:bg-blue-50/50 transition cursor-pointer group"
                onClick={() => openLoggingModal(match)}
              >
                <div className="flex items-center gap-5 w-full mb-3 md:mb-0">
                  <span
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase shrink-0 ${match.status === "Finished" ? "bg-ssu-black text-white" : "bg-blue-100 text-ssu-blue"}`}
                  >
                    {match.status === "Finished" ? "종료" : "예정"}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-xs font-bold mb-0.5">
                      {match.date.replace(/-/g, ".")} | {match.type}
                    </span>
                    <span className="font-black text-ssu-black text-lg">
                      vs {match.opponent}
                    </span>
                  </div>
                  <div className="hidden md:flex ml-auto items-center gap-6 mr-4">
                    {match.status === "Finished" ? (
                      <>
                        <span className="font-black text-2xl tracking-widest text-ssu-black">
                          {match.homeScore} : {match.awayScore}
                        </span>
                        <span className="text-xs font-bold text-green-600 flex items-center bg-green-50 px-3 py-1.5 rounded-lg group-hover:bg-green-100 transition">
                          <Edit3 size={14} className="mr-1" /> 부가 수정
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-ssu-blue flex items-center bg-blue-50 px-3 py-1.5 rounded-lg group-hover:bg-blue-100 transition">
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
                  className="w-full md:w-auto p-3 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition border border-slate-100 flex justify-center items-center"
                >
                  <Trash2 size={16} className="mr-1 md:mr-0" />
                  <span className="md:hidden text-xs font-bold">삭제</span>
                </button>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
};

export default AdminMatches;
