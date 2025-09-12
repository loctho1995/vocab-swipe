import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Vocab Swipe — English↔Vietnamese (Fresh build)
 * - Lấy từ theo chủ đề đời sống/công việc/xã hội (Datamuse)
 * - Định nghĩa + phiên âm + (ưu tiên) audio US (Free Dictionary)
 * - Dịch EN→VI (MyMemory)
 * - 3 ví dụ: chạm để EN⇄VI, nút đọc câu ví dụ
 * - Quẹt trái: lưu vào "Đã xem" + lấy từ mới (không trùng)
 * - Drawer danh sách đã xem: allow remove
 * - Chip các loại từ liên quan: noun/verb/adj/adv; tap mở card mới
 */

// ---------------- Utilities ----------------
const TOPIC_SEEDS = [
  "life","work","career","office","meeting","deadline","society","community",
  "health","finance","technology","communication","relationship","education",
  "travel","environment","productivity","management","negotiation","teamwork",
];

const STORAGE_KEYS = { SEEN: "vocab_seen_words_v1" };

function loadSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.SEEN) || "[]")); } catch { return new Set(); }
}
function saveSeen(set) {
  localStorage.setItem(STORAGE_KEYS.SEEN, JSON.stringify(Array.from(set)));
}

function classNames(...xs) { return xs.filter(Boolean).join(" "); }

// Prefer US audio if available
function pickAudio(phonetics = []) {
  const hasUS = phonetics.find(p => /us|american/i.test(p.audio || ""));
  if (hasUS?.audio) return hasUS.audio;
  const first = phonetics.find(p => p.audio);
  return first?.audio || null;
}

async function fetchDatamuseCandidate(seenSet) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const seed = TOPIC_SEEDS[Math.floor(Math.random() * TOPIC_SEEDS.length)];
    const url = `https://api.datamuse.com/words?ml=${encodeURIComponent(seed)}&md=f&max=50`;
    const words = await fetch(url).then(r => r.json());
    const candidates = words
      .map(w => w.word)
      .filter(w => /^[a-zA-Z]{3,}$/.test(w))
      .filter(w => !seenSet.has(w.toLowerCase()));
    if (candidates.length) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      return pick.toLowerCase();
    }
  }
  return null;
}

async function fetchDictionary(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0];
}

async function translateTextENtoVI(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|vi`;
  const res = await fetch(url);
  const data = await res.json();
  return data?.responseData?.translatedText || text;
}

function speak(text, lang = "en-US") {
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    if (lang.startsWith("en")) {
      const voices = window.speechSynthesis.getVoices();
      const usVoice = voices.find(v => /en-US/i.test(v.lang));
      if (usVoice) utter.voice = usVoice;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch {}
}

function SmallButton({ onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-xl text-sm shadow-sm border border-gray-200 hover:bg-gray-50 active:scale-[0.98] transition"
      title={title}
    >{children}</button>
  );
}

function usePointerSwipe(ref, { onSwipeLeft }) {
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let startX = 0, startY = 0, dx = 0, dy = 0, active = false, pointerId = null, swiping = false;

    const isInteractive = (t) => !!(t && (t.closest('button, a, input, textarea, select, [role="button"], [data-noswipe]')));
    const getXY = (e) => {
      const p = e.touches?.[0] || e;
      return { x: p.clientX, y: p.clientY };
    };

    const down = (e) => {
      if (isInteractive(e.target)) return; // ignore clicks on controls
      active = true; swiping = false; const { x, y } = getXY(e); startX = x; startY = y; dx = 0; dy = 0;
      if (e.pointerId != null && el.setPointerCapture) { pointerId = e.pointerId; try { el.setPointerCapture(pointerId); } catch {}
      }
    };

    const move = (e) => {
      if (!active) return;
      const { x, y } = getXY(e); dx = x - startX; dy = y - startY;
      if (!swiping) {
        if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return; // ignore micro moves
        if (Math.abs(dx) < Math.abs(dy) * 1.2) return; // mostly vertical -> ignore
        swiping = true;
      }
      el.style.transform = `translateX(${dx}px) rotate(${dx / 40}deg)`;
      el.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 300));
    };

    const resetStyle = () => { el.style.transition = ""; el.style.transform = ""; el.style.opacity = ""; };

    const up = () => {
      if (!active) return; active = false;
      if (!swiping) { resetStyle(); return; }
      el.style.transition = "transform .2s, opacity .2s";
      const isLeftSwipe = dx < -120 && Math.abs(dy) < 120;
      if (isLeftSwipe) {
        el.style.transform = `translateX(-120%) rotate(-12deg)`; el.style.opacity = "0";
        setTimeout(() => { onSwipeLeft?.(); resetStyle(); }, 220);
      } else {
        resetStyle();
      }
      dx = 0; dy = 0; swiping = false;
      if (pointerId != null && el.releasePointerCapture) { try { el.releasePointerCapture(pointerId); } catch {} pointerId = null; }
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("touchstart", down, { passive: true });
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", up);

    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("touchstart", down);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", up);
    };
  }, [ref, onSwipeLeft]);
}

// ---------------- App ----------------
export default function App() {
  const [seen, setSeen] = useState(() => loadSeen());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [word, setWord] = useState(null); // {text,pos,phonetic,audioUrl,definitionEN,definitionVI,examples}
  const [related, setRelated] = useState({ n: [], v: [], adj: [], adv: [] });
  const [syns, setSyns] = useState([]);
  const [showSeen, setShowSeen] = useState(false);
  const cardRef = useRef(null);

  usePointerSwipe(cardRef, { onSwipeLeft: handleSwipeLeft });

  const seenList = useMemo(() => Array.from(seen).sort(), [seen]);

  useEffect(() => { loadWord(); }, []);

  async function loadWord() {
    setLoading(true); setError("");
    try {
      for (let i = 0; i < 8; i++) {
        const candidate = await fetchDatamuseCandidate(seen);
        if (!candidate) throw new Error("Không tìm được từ phù hợp, thử lại.");
        const dict = await fetchDictionary(candidate);
        if (!dict) continue;
        await setFromDictionary(candidate, dict);
        setLoading(false);
        return;
      }
      throw new Error("Không tìm thấy từ nào có dữ liệu từ điển phù hợp.");
    } catch (e) {
      setError(e.message || "Lỗi tải dữ liệu.");
    } finally {
      setLoading(false);
    }
  }

  async function setFromDictionary(candidate, dict) {
    const meanings = dict.meanings || [];
    const firstMeaning = meanings.find(m => m?.definitions?.length) || meanings[0];
    const pos = firstMeaning?.partOfSpeech || "";
    const definitionEN = firstMeaning?.definitions?.[0]?.definition || "";
    const phonetic = dict.phonetic || dict.phonetics?.[0]?.text || "";
    const audioUrl = pickAudio(dict.phonetics || []);

    // Examples up to 3
    const examples = [];
    for (const m of meanings) {
      for (const d of (m.definitions || [])) {
        if (d.example) examples.push({ en: d.example });
        if (examples.length >= 3) break;
      }
      if (examples.length >= 3) break;
    }
    const synthPool = [
      `Could you explain the word "${candidate}" in this ${pos || "context"}?`,
      `We discussed "${candidate}" during the meeting yesterday.`,
      `This ${pos || "term"} "${candidate}" often appears in daily life.`,
      `Do you use "${candidate}" at work?`,
    ];
    let k = 0; while (examples.length < 3 && k < synthPool.length) { examples.push({ en: synthPool[k++] }); }

    const definitionVI = definitionEN ? await translateTextENtoVI(definitionEN) : "";
    setWord({ text: candidate, pos, phonetic, audioUrl, definitionEN, definitionVI, examples });

    // Related POS chips
    Promise.all([fetchRelatedPOS(candidate), fetchSynonyms(candidate)])
      .then(([rel, syn]) => { setRelated(rel); setSyns(syn); })
      .catch(() => { setRelated({ n: [], v: [], adj: [], adv: [] }); setSyns([]); })
  }

  async function fetchRelatedPOS(base) {
    const url = `https://api.datamuse.com/words?ml=${encodeURIComponent(base)}&md=p&max=100`;
    const res = await fetch(url).then(r => r.json());
    const bucket = { n: [], v: [], adj: [], adv: [] };
    for (const it of res) {
      if (!it.word || it.word.toLowerCase() === base.toLowerCase()) continue;
      const tags = it.tags || [];
      if (tags.includes('n') && bucket.n.length < 8) bucket.n.push(it.word);
      if (tags.includes('v') && bucket.v.length < 8) bucket.v.push(it.word);
      if (tags.includes('adj') && bucket.adj.length < 8) bucket.adj.push(it.word);
      if (tags.includes('adv') && bucket.adv.length < 8) bucket.adv.push(it.word);
    }
    return bucket;
  }

  async function fetchSynonyms(base) {
    const url = `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(base)}&md=p&max=50`;
    const res = await fetch(url).then(r => r.json());
    const out = [];
    const seenW = new Set();
    for (const it of res) {
      const w = (it.word || '').toLowerCase();
      if (!w || seenW.has(w)) continue;
      if (!/^[a-zA-Z]+$/.test(w)) continue;
      if (w === base.toLowerCase()) continue;
      seenW.add(w);
      out.push(w);
      if (out.length >= 16) break;
    }
    return out;
  }

  function addToSeen(w) {
    if (!w) return;
    const lower = w.toLowerCase();
    if (!seen.has(lower)) {
      const next = new Set(seen);
      next.add(lower);
      setSeen(next);
      saveSeen(next);
    }
  }

  async function handleSwipeLeft() {
    if (!word) return;
    addToSeen(word.text);
    await new Promise(r => setTimeout(r, 120));
    loadWord();
  }

  function handleRemoveSeen(item) {
    const next = new Set(seen);
    next.delete(item);
    setSeen(next);
    saveSeen(next);
  }

  function AudioButton() {
    if (word?.audioUrl) {
      return (
        <SmallButton title="Phát âm (audio)">
          <span onClick={() => { const a = new Audio(word.audioUrl); a.play(); }}>🔊</span>
        </SmallButton>
      );
    }
    return (
      <SmallButton title="Phát âm (Web Speech)" onClick={() => speak(word.text, "en-US")}>
        🔈
      </SmallButton>
    );
  }

  async function loadSpecificWord(term) {
    // Khi mở từ mới từ chips/đồng nghĩa → tự lưu từ hiện tại vào "Đã xem"
    if (word?.text) addToSeen(word.text);
    setLoading(true); setError("");
    try {
      const dict = await fetchDictionary(term);
      if (!dict) throw new Error("Không tìm thấy từ: " + term);
      await setFromDictionary(term, dict);
    } catch (e) {
      setError(e.message || "Lỗi tải từ.");
    } finally {
      setLoading(false);
    }
  }

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-slate-50 text-slate-800">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="font-semibold text-lg">Vocab Swipe</div>
          <div className="flex items-center gap-2">
            <SmallButton onClick={() => setShowSeen(s => !s)} title="Xem danh sách đã xem">📚 Đã xem ({seen.size})</SmallButton>
            <SmallButton onClick={() => { if (word?.text) addToSeen(word.text); loadWord(); }} title="Lấy từ mới">🔄 Từ mới</SmallButton>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700">{error}</div>
        )}

        {/* Word Card */}
        <div ref={cardRef} className="select-none">
          <div className={classNames(
            "rounded-2xl shadow-sm border border-slate-200 bg-white p-6 transition will-change-transform",
            loading && "opacity-70"
          )}>
            {!word && (
              <div className="text-center py-16">
                <div className="animate-pulse text-sm text-slate-500">Đang tải từ mới…</div>
              </div>
            )}

            {word && (
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-3xl font-bold tracking-tight">{word.text}</div>
                    <div className="text-slate-500 mt-1">{word.pos} {word.phonetic && <span className="ml-2">/{String(word.phonetic).replace(/\//g, "")}/</span>}</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <AudioButton />
                    <SmallButton onClick={() => { addToSeen(word.text); }} title="Lưu vào Đã xem">⭐ Lưu</SmallButton>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Định nghĩa (EN)</div>
                    <div className="mt-1">{word.definitionEN || "(không có)"}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                    <div className="text-xs uppercase tracking-wide text-green-700">Nghĩa tiếng Việt</div>
                    <div className="mt-1">{word.definitionVI || "(đang dịch / không có)"}</div>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="text-sm font-medium text-slate-600 mb-2">Ví dụ hội thoại</div>
                  <ExamplesList key={word.text} word={word.text} examples={word.examples} />
                </div>

                

                {/* Synonyms */}
                <div className="mt-2">
                  <div className="text-sm font-medium text-slate-600 mb-2">Từ đồng nghĩa</div>
                  <SynChips syns={syns} onPick={(t) => loadSpecificWord(t)} />
                </div>

                {/* Other POS forms */}
                <div className="mt-2">
                  <div className="text-sm font-medium text-slate-600 mb-2">Dạng từ loại khác</div>
                  <POSChips related={related} currentPos={word.pos} onPick={(t) => loadSpecificWord(t)} />
                </div>

                <div className="text-xs text-slate-500 mt-2">
                  Gợi ý: quẹt <span className="font-semibold">trái</span> để lưu từ này vào danh sách đã xem và hiện từ mới.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Seen Drawer */}
        {showSeen && (
          <div className="fixed inset-0 z-20">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowSeen(false)} />
            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl border-l border-slate-200 flex flex-col">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="font-semibold">Danh sách đã xem ({seenList.length})</div>
                <SmallButton onClick={() => setShowSeen(false)}>Đóng</SmallButton>
              </div>
              <div className="p-3 overflow-y-auto flex-1">
                {seenList.length === 0 && (
                  <div className="text-sm text-slate-500 p-3">Chưa có từ nào.</div>
                )}
                <ul className="space-y-2">
                  {seenList.map(it => (
                    <li key={it} className="flex items-center justify-between gap-3 border border-slate-200 rounded-xl px-3 py-2">
                      <button className="font-medium underline hover:no-underline" onClick={() => { loadSpecificWord(it); setShowSeen(false); }} title="Mở từ này">{it}</button>
                      <div className="flex items-center gap-2">
                        <SmallButton title="Xoá khỏi Đã xem" onClick={() => handleRemoveSeen(it)}>🗑️ Xoá</SmallButton>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="py-6 text-center text-xs text-slate-500">
        Nguồn dữ liệu: Datamuse, Free Dictionary API, MyMemory Translate.
      </footer>
    </div>
  );
}

// ---------------- Subcomponents ----------------
function ExamplesList({ word, examples }) {
  const [state, setState] = useState(() => examples.map(e => ({ en: e.en, vi: null, showing: "en" })));
  // Ensure examples reset when the main word changes
  useEffect(() => {
    setState(examples.map(e => ({ en: e.en, vi: null, showing: "en" })));
  }, [word, examples]);

  async function toggle(i) {
    setState(prev => prev.map((ex, idx) => {
      if (idx !== i) return ex;
      if (ex.showing === "en") {
        if (!ex.vi) {
          translateTextENtoVI(ex.en).then(t => {
            setState(p => p.map((ex2, j) => j === i ? { ...ex2, vi: t, showing: "vi" } : ex2));
          });
          return { ...ex };
        }
        return { ...ex, showing: "vi" };
      } else {
        return { ...ex, showing: "en" };
      }
    }));
  }

  function speakExample(i) {
    const ex = state[i];
    const text = ex.showing === "en" ? ex.en : ex.vi || ex.en;
    const lang = ex.showing === "en" ? "en-US" : "vi-VN";
    speak(text, lang);
  }

  return (
    <ul className="space-y-2">
      {state.map((ex, i) => (
        <li key={i} className="group border border-slate-200 rounded-xl p-3 bg-white flex items-start justify-between gap-3">
          <button onClick={() => toggle(i)} className="text-left flex-1">
            <div className="text-sm leading-relaxed">
              {ex.showing === "en" ? ex.en : (ex.vi || "(đang dịch…)")}
            </div>
          </button>
          <SmallButton onClick={() => speakExample(i)} title="Đọc câu ví dụ">🗣️</SmallButton>
        </li>
      ))}
    </ul>
  );
}

function SynChips({ syns, onPick }){
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
      {syns && syns.length ? (
        <div className="flex flex-wrap gap-2">
          {syns.map(w => (
            <button key={w} onClick={()=>onPick(w)} className="px-2 py-1 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 active:scale-[0.98]">
              {w}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-xs text-slate-400">(Không có từ đồng nghĩa phù hợp)</div>
      )}
    </div>
  );
}

function POSChips({ related, onPick, currentPos }) {
  const Section = ({ label, items }) => (
    <div className="mb-2">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      <div className="flex flex-wrap gap-2">
        {items && items.length > 0 ? items.map(w => (
          <button key={w} onClick={() => onPick(w)} className="px-2 py-1 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 active:scale-[0.98]">
            {w}
          </button>
        )) : <span className="text-xs text-slate-400">(không có)</span>}
      </div>
    </div>
  );

  const viLabel = (pos) => {
    if (!pos) return "(không rõ)";
    const p = String(pos).toLowerCase();
    if (p.includes("noun")) return "Danh từ (noun)";
    if (p.includes("verb")) return "Động từ (verb)";
    if (p.includes("adjective") || p === "adj") return "Tính từ (adjective)";
    if (p.includes("adverb") || p === "adv") return "Trạng từ (adverb)";
    return pos;
  };

  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
      {/* Current word POS */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-slate-500">Từ hiện tại:</span>
        <span className="px-2 py-0.5 text-sm rounded-lg border border-slate-200 bg-white">
          {viLabel(currentPos)}
        </span>
      </div>
      {(() => {
        const posKey = (pos) => {
          if (!pos) return null;
          const p = String(pos).toLowerCase();
          if (p.includes("noun")) return 'n';
          if (p.includes("verb")) return 'v';
          if (p.includes("adjective") || p === 'adj') return 'adj';
          if (p.includes("adverb") || p === 'adv') return 'adv';
          return null;
        };
        const currentKey = posKey(currentPos);
        const order = ['n','v','adj','adv'].filter(k => k !== currentKey);
        const labels = { n: "Danh từ (noun)", v: "Động từ (verb)", adj: "Tính từ (adjective)", adv: "Trạng từ (adverb)" };
        const hasAny = order.some(k => (related[k]||[]).length > 0);
        if (!hasAny) return <div className="text-xs text-slate-400">(Không có loại từ khác liên quan)</div>;
        return order.map(k => (
          <Section key={k} label={labels[k]} items={related[k]} />
        ));
      })()}
    </div>
  );
}
