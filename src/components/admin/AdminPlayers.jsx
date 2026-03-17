import React, { useState, useMemo, useEffect } from "react";
import {
  Users,
  Search,
  Edit3,
  MessageSquare,
  Eye,
  EyeOff,
  X,
  Save,
  Image as ImageIcon,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  query,
  collection,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { compressImageToBase64 } from "../../utils";

const AdminPlayers = ({ players, onUpdatePlayer }) => {
  // --- 상태 관리 ---
  const [playerSearchTerm, setPlayerSearchTerm] = useState("");
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [activeSection, setActiveSection] = useState("basic"); // 모달 아코디언 상태: 'basic' | 'detail' | 'photo'
  const [managingCommentsPlayer, setManagingCommentsPlayer] = useState(null);
  const [adminRealtimeComments, setAdminRealtimeComments] = useState([]);
  const [isDragDisabled, setIsDragDisabled] = useState(false);

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

  // --- 1. 드래그 앤 드롭 로직 (실제 데이터 업데이트 보강) ---
  const handleDragStart = (e, playerId) => {
    if (isDragDisabled) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", playerId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData("text/plain");
    if (!playerId) return;

    // 데이터 변경 사항 적용
    const updates = { status: newStatus };
    if (newStatus === "left") updates.isHidden = true;

    try {
      await onUpdatePlayer(playerId, updates);
    } catch (err) {
      console.error("드롭 업데이트 실패:", err);
    }
  };

  // --- 2. 선수 수정 모달 로직 ---
  const openEditModal = (player) => {
    setEditingPlayer(player);
    setActiveSection("basic"); // 열 때 항상 기본 정보부터
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
        mbti: player.profile?.mbti || "",
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

  // --- 3. 댓글 날짜 표시 해결 ---
  useEffect(() => {
    if (!managingCommentsPlayer?.id) return;
    const q = query(
      collection(db, "players", managingCommentsPlayer.id, "comments"),
      orderBy("createdAt", "desc"),
    );
    return onSnapshot(q, (snapshot) => {
      setAdminRealtimeComments(
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
      );
    });
  }, [managingCommentsPlayer]);

  const formatDate = (createdAt) => {
    if (!createdAt) return "날짜 정보 없음";
    // Firestore Timestamp 객체인지 확인 후 처리
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return isNaN(date.getTime()) ? "날짜 형식 오류" : date.toLocaleDateString();
  };

  const searchedPlayers = useMemo(() => {
    return players
      .filter((p) => (p.name ? p.name.includes(playerSearchTerm) : false))
      .sort((a, b) => (Number(a.number) || 999) - (Number(b.number) || 999));
  }, [players, playerSearchTerm]);

  return (
    <div className="space-y-6 animate-fade-in max-w-full mx-auto relative z-10">
      {/* 검색 바 */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-4xl shadow-sm border border-slate-100">
        <h3 className="text-2xl font-black text-ssu-black flex items-center shrink-0">
          <Users className="mr-2 text-ssu-blue" /> 선수단 관리
        </h3>
        <div className="relative w-full md:w-72">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="선수 이름 검색..."
            className="w-full pl-11 pr-4 py-3 text-sm font-bold border border-slate-200 rounded-xl outline-none focus:border-ssu-blue bg-slate-50 focus:bg-white transition-all"
            value={playerSearchTerm}
            onChange={(e) => setPlayerSearchTerm(e.target.value)}
          />
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
                          <EyeOff size={8} className="mr-1" />
                        ) : (
                          <Eye size={10} className="mr-1" />
                        )}
                        {p.isHidden ? "숨김" : "노출"}
                      </button>
                      <button
                        onClick={() => openEditModal(p)}
                        className="flex-1 py-1.5 bg-gray-100 border border-gray-200 text-gray-600 rounded text-[10px] font-bold hover:bg-gray-200 flex items-center justify-center"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => setManagingCommentsPlayer(p)}
                        className="flex-1 py-1.5 bg-blue-50 border border-blue-200 text-blue-600 rounded text-[10px] font-bold hover:bg-blue-100 flex items-center justify-center"
                      >
                        댓글({p.comments?.length || 0})
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {editingPlayer && (
        <div className="fixed left-0 right-0 bottom-0 top-[60px] md:top-[80px] z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-6 animate-fade-in">
          {/* max-h-full을 줘서 지정된 구역(헤더 아래)을 절대 벗어나지 않게 만듭니다 */}
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl flex flex-col max-h-full overflow-hidden">
            {/* 1. 고정 헤더 */}
            <div className="bg-ssu-black text-white p-5 md:p-6 flex justify-between items-center shrink-0">
              <h3 className="font-black text-lg md:text-xl flex items-center truncate">
                <Edit3 size={20} className="mr-3 text-[#FFD60A]" /> [
                {editingPlayer.name}] 프로필 수정
              </h3>
              <button
                onClick={() => setEditingPlayer(null)}
                className="text-white/50 hover:text-white p-1 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* 2. 스크롤 가능한 본문 (아코디언 영역) */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4 bg-slate-50">
              {/* 섹션 1: 기본 정보 */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <button
                  onClick={() =>
                    setActiveSection(activeSection === "basic" ? null : "basic")
                  }
                  className="w-full px-6 py-4 flex justify-between items-center font-black text-ssu-blue bg-white hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-2 uppercase tracking-widest text-xs">
                    01. 기본 정보
                  </span>
                  {activeSection === "basic" ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </button>
                {activeSection === "basic" && (
                  <div className="p-6 border-t border-slate-100 grid grid-cols-2 gap-4 animate-slide-down">
                    <div className="col-span-2 md:col-span-1">
                      <label className="text-[10px] text-slate-400 font-black block mb-1">
                        이름
                      </label>
                      <input
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 outline-none focus:border-ssu-blue focus:bg-white"
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-black block mb-1">
                        등번호
                      </label>
                      <input
                        type="number"
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm font-black text-center bg-slate-50 outline-none focus:border-ssu-blue focus:bg-white"
                        value={editForm.number}
                        onChange={(e) =>
                          setEditForm({ ...editForm, number: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-black block mb-1">
                        포지션
                      </label>
                      <select
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm font-black bg-slate-50 outline-none focus:border-ssu-blue"
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
                      <label className="text-[10px] text-slate-400 font-black block mb-1">
                        상태
                      </label>
                      <select
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm font-black bg-slate-50 outline-none focus:border-ssu-blue"
                        value={editForm.status}
                        onChange={(e) =>
                          setEditForm({ ...editForm, status: e.target.value })
                        }
                      >
                        <option value="current">재학생</option>
                        <option value="graduated">졸업생</option>
                        <option value="pro_joined">프로/취업</option>
                        <option value="left">퇴단</option>
                      </select>
                    </div>

                    {/* 상태에 따른 동적 필드 (기본 정보에 배치) */}
                    {editForm.status === "current" ? (
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 font-black block mb-1">
                          학년 (숫자)
                        </label>
                        <input
                          type="number"
                          className="w-full p-3 border border-slate-200 rounded-xl text-sm font-black text-center bg-slate-50 outline-none focus:border-ssu-blue focus:bg-white"
                          value={editForm.grade}
                          onChange={(e) =>
                            setEditForm({ ...editForm, grade: e.target.value })
                          }
                        />
                      </div>
                    ) : (
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 font-black block mb-1">
                          현 소속 구단
                        </label>
                        <input
                          placeholder="소속 팀 입력"
                          className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 outline-none focus:border-ssu-blue focus:bg-white"
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
                )}
              </div>

              {/* 섹션 2: 상세 정보 */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <button
                  onClick={() =>
                    setActiveSection(
                      activeSection === "detail" ? null : "detail",
                    )
                  }
                  className="w-full px-6 py-4 flex justify-between items-center font-black text-green-600 bg-white hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-2 uppercase tracking-widest text-xs">
                    02. 상세 정보
                  </span>
                  {activeSection === "detail" ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </button>
                {activeSection === "detail" && (
                  <div className="p-6 border-t border-slate-100 grid grid-cols-2 gap-4 animate-slide-down">
                    <div className="col-span-2 md:col-span-1">
                      <label className="text-[10px] text-slate-400 font-black block mb-1">
                        생년월일 (YY.MM.DD)
                      </label>
                      <input
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 outline-none focus:border-green-500 focus:bg-white"
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
                      <label className="text-[10px] text-slate-400 font-black block mb-1">
                        MBTI
                      </label>
                      <input
                        placeholder="예: ENFP"
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold text-center uppercase bg-slate-50 outline-none focus:border-green-500 focus:bg-white"
                        value={editForm.profile.mbti}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            profile: {
                              ...editForm.profile,
                              mbti: e.target.value.toUpperCase(),
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-black block mb-1">
                        신장 (cm)
                      </label>
                      <input
                        type="number"
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm text-center bg-slate-50 outline-none focus:border-green-500 focus:bg-white"
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
                      <label className="text-[10px] text-slate-400 font-black block mb-1">
                        체중 (kg)
                      </label>
                      <input
                        type="number"
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm text-center bg-slate-50 outline-none focus:border-green-500 focus:bg-white"
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
                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 font-black block mb-1">
                        출신 고교
                      </label>
                      <input
                        className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold bg-slate-50 outline-none focus:border-green-500 focus:bg-white"
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
                )}
              </div>

              {/* 섹션 3: 사진 관리 */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <button
                  onClick={() =>
                    setActiveSection(activeSection === "photo" ? null : "photo")
                  }
                  className="w-full px-6 py-4 flex justify-between items-center font-black text-pink-500 bg-white hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-2 uppercase tracking-widest text-xs">
                    03. 사진 등록
                  </span>
                  {activeSection === "photo" ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </button>
                {activeSection === "photo" && (
                  <div className="p-6 border-t border-slate-100 flex flex-col items-center gap-4 animate-slide-down">
                    <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                      {editForm.profile.photo ? (
                        <img
                          src={editForm.profile.photo}
                          className="w-full h-full object-cover object-top"
                          alt="preview"
                        />
                      ) : (
                        <ImageIcon size={40} className="text-slate-300" />
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const base64 = await compressImageToBase64(file);
                        setEditForm((prev) => ({
                          ...prev,
                          profile: { ...prev.profile, photo: base64 },
                        }));
                      }}
                      className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-ssu-black file:text-[#FFD60A] cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 3. 고정 하단 푸터 (절대 아래로 안 내려감) */}
            <div className="p-6 border-t border-slate-100 bg-white flex gap-3 shrink-0 rounded-b-4xl">
              <button
                onClick={() => setEditingPlayer(null)}
                className="flex-1 py-4 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition"
              >
                취소
              </button>
              <button
                onClick={handleSaveProfile}
                className="flex-2 py-4 rounded-2xl font-black text-[#FFD60A] bg-ssu-black shadow-xl flex items-center justify-center gap-2"
              >
                <Save size={20} /> 저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔴 댓글 관리 모달 (헤더 아래에서만 정렬) */}
      {managingCommentsPlayer && (
        <div
          className="fixed left-0 right-0 bottom-0 top-[60px] md:top-[80px] z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-6 animate-fade-in"
          onClick={() => setManagingCommentsPlayer(null)}
        >
          <div
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg flex flex-col max-h-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-blue-600 text-white p-5 md:p-6 flex justify-between items-center shrink-0">
              <h3 className="font-black text-lg md:text-xl flex items-center truncate">
                <MessageSquare size={24} className="mr-3 shrink-0" /> [
                {managingCommentsPlayer.name}] 댓글 관리
              </h3>
              <button
                onClick={() => setManagingCommentsPlayer(null)}
                className="text-white/50 hover:text-white p-1"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
              {adminRealtimeComments.length > 0 ? (
                <ul className="space-y-4">
                  {adminRealtimeComments.map((c) => (
                    <li
                      key={c.id}
                      className="bg-white border border-slate-200 p-5 rounded-2xl flex justify-between items-start gap-4 shadow-sm"
                    >
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-sm text-ssu-black">
                            {c.nickname}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {formatDate(c.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">
                          {c.text}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-20 text-slate-400 font-bold bg-white rounded-3xl border border-dashed border-slate-200">
                  등록된 응원 댓글이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPlayers;
