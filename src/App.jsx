import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Vocab Swipe — English↔Vietnamese (Fresh build)
 * - Lấy từ theo chủ đề đời sống/công việc/xã hội (Datamuse)
 * - Định nghĩa + phiên âm + (ưu tiên) audio US (Free Dictionary)
 * - Dịch trực tiếp từ EN→VI (MyMemory)
 * - Nút mở ChatGPT để xem ví dụ và hội thoại
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

// Thêm danh sách động từ và tính từ phổ biến để tăng tính đa dạng
const COMMON_VERBS = [
  "make","take","give","get","keep","think","feel","become","leave","understand",
  "believe","happen","write","provide","sit","lose","pay","meet","include","continue",
  "learn","change","lead","understand","watch","follow","stop","create","speak","spend"
];

const COMMON_ADJECTIVES = [
  "good","new","first","last","long","great","little","own","other","old",
  "right","big","high","different","small","large","next","early","young","important",
  "public","bad","same","able","political","late","general","full","far","low"
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
  console.log("Phonetics data:", phonetics); // Debug log
  
  // Ưu tiên audio US
  const usAudio = phonetics.find(p => {
    const audio = p.audio || "";
    return audio && (audio.includes('-us.') || audio.includes('_us.') || /us/i.test(audio));
  });
  if (usAudio?.audio) {
    console.log("Found US audio:", usAudio.audio);
    return usAudio.audio;
  }
  
  // Nếu không có US, lấy audio đầu tiên có sẵn
  const anyAudio = phonetics.find(p => p.audio && p.audio.length > 0);
  if (anyAudio?.audio) {
    console.log("Found audio:", anyAudio.audio);
    return anyAudio.audio;
  }
  
  console.log("No audio found");
  return null;
}

async function fetchDatamuseCandidate(seenSet) {
  for (let attempt = 0; attempt < 6; attempt++) {
    let candidates = [];
    
    // Xen kẽ giữa các nguồn khác nhau để đa dạng từ loại
    const strategy = attempt % 3;
    
    if (strategy === 0) {
      // Lấy từ từ topic seeds với metadata
      const seed = TOPIC_SEEDS[Math.floor(Math.random() * TOPIC_SEEDS.length)];
      const url = `https://api.datamuse.com/words?ml=${encodeURIComponent(seed)}&md=fp&max=100`;
      const words = await fetch(url).then(r => r.json());
      
      // Ưu tiên những từ có nhiều dạng từ loại (có cả tags n, v, adj)
      const versatileWords = words.filter(w => {
        const tags = w.tags || [];
        const hasMultiplePOS = (tags.includes('n') && tags.includes('v')) ||
                               (tags.includes('v') && tags.includes('adj')) ||
                               (tags.includes('n') && tags.includes('adj'));
        return hasMultiplePOS;
      });
      
      // Nếu có từ đa năng, ưu tiên chúng
      const sourceWords = versatileWords.length > 0 ? versatileWords : words;
      
      candidates = sourceWords
        .map(w => w.word)
        .filter(w => /^[a-zA-Z]{3,}$/.test(w))
        .filter(w => !seenSet.has(w.toLowerCase()));
    } else if (strategy === 1) {
      // Lấy động từ liên quan
      const verb = COMMON_VERBS[Math.floor(Math.random() * COMMON_VERBS.length)];
      const url = `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(verb)}&md=p&max=50`;
      const words = await fetch(url).then(r => r.json());
      candidates = words
        .filter(w => {
          const tags = w.tags || [];
          return tags.includes('v'); // Chỉ lấy động từ
        })
        .map(w => w.word)
        .filter(w => /^[a-zA-Z]{3,}$/.test(w))
        .filter(w => !seenSet.has(w.toLowerCase()));
    } else {
      // Lấy tính từ liên quan
      const adj = COMMON_ADJECTIVES[Math.floor(Math.random() * COMMON_ADJECTIVES.length)];
      const url = `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(adj)}&md=p&max=50`;
      const words = await fetch(url).then(r => r.json());
      candidates = words
        .filter(w => {
          const tags = w.tags || [];
          return tags.includes('adj'); // Chỉ lấy tính từ
        })
        .map(w => w.word)
        .filter(w => /^[a-zA-Z]{3,}$/.test(w))
        .filter(w => !seenSet.has(w.toLowerCase()));
    }
    
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
    console.log("Speaking:", text, "Language:", lang); // Debug log
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.9; // Slightly slower for clearer pronunciation
    utter.pitch = 1;
    utter.volume = 1;
    
    // Try to get US voice if available
    if (lang.startsWith("en")) {
      const voices = window.speechSynthesis.getVoices();
      console.log("Available voices:", voices.length);
      
      const usVoice = voices.find(v => v.lang === "en-US" && v.default) || 
                      voices.find(v => v.lang === "en-US") ||
                      voices.find(v => v.lang.startsWith("en"));
      if (usVoice) {
        utter.voice = usVoice;
        console.log("Using voice:", usVoice.name);
      }
    }
    
    window.speechSynthesis.speak(utter);
    console.log("Speech synthesis started");
  } catch (err) {
    console.error("Lỗi phát âm:", err);
  }
}

function SmallButton({ onClick, title, children, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-xl text-sm shadow-sm border border-gray-200 hover:bg-gray-50 active:scale-[0.98] transition ${className}`}
      title={title}
      type="button"
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
  const [word, setWord] = useState(null); // {text,pos,phonetic,audioUrl,definitions,wordTranslations}
  const [related, setRelated] = useState({ n: [], v: [], adj: [], adv: [] });
  const [syns, setSyns] = useState([]);
  const [showSeen, setShowSeen] = useState(false);
  const [definitionVI, setDefinitionVI] = useState([]);
  const [showingDefinitionVI, setShowingDefinitionVI] = useState(false);
  const cardRef = useRef(null);

  usePointerSwipe(cardRef, { onSwipeLeft: handleSwipeLeft });

  const seenList = useMemo(() => Array.from(seen).sort(), [seen]);

  useEffect(() => { 
    // Load voices for speech synthesis
    if ('speechSynthesis' in window) {
      // Chrome loads voices asynchronously
      window.speechSynthesis.getVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.getVoices();
        };
      }
    }
    loadWord(); 
  }, []);

  async function loadWord() {
    setLoading(true); setError("");
    // Reset definition states when loading new word
    setDefinitionVI([]);
    setShowingDefinitionVI(false);
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
    console.log("Dictionary data for", candidate, dict); // Debug log
    
    const meanings = dict.meanings || [];
    
    // Lấy TẤT CẢ các từ loại của từ này
    const allPOS = new Set();
    const definitionsByPOS = new Map();
    
    for (const meaning of meanings) {
      const pos = meaning?.partOfSpeech || "";
      if (pos) {
        allPOS.add(pos);
        
        if (!definitionsByPOS.has(pos)) {
          definitionsByPOS.set(pos, []);
        }
        
        const defs = meaning?.definitions || [];
        for (let i = 0; i < Math.min(2, defs.length); i++) {
          if (defs[i]?.definition) {
            definitionsByPOS.get(pos).push({
              text: defs[i].definition,
              pos: pos,
              example: defs[i].example || null
            });
          }
        }
      }
    }
    
    // Tạo danh sách định nghĩa tổng hợp từ tất cả các POS
    const allDefinitions = [];
    for (const [pos, defs] of definitionsByPOS.entries()) {
      allDefinitions.push(...defs.slice(0, 2)); // Lấy tối đa 2 định nghĩa mỗi POS
    }
    
    // POS string hiển thị tất cả các từ loại
    const allPOSString = Array.from(allPOS).join(", ");
    
    const phonetic = dict.phonetic || dict.phonetics?.[0]?.text || "";
    let audioUrl = pickAudio(dict.phonetics || []);
    
    // Validate audio URL
    if (audioUrl && !audioUrl.startsWith('http')) {
      console.log("Invalid audio URL:", audioUrl);
      audioUrl = null; // Invalid URL, use Web Speech instead
    }
    
    console.log("Final audioUrl:", audioUrl); // Debug log

    // Lấy nhiều nghĩa tiếng Việt
    const wordTranslations = await fetchVietnameseMeanings(candidate, allDefinitions);
    
    // Reset definition state
    setDefinitionVI([]);
    setShowingDefinitionVI(false);
    
    setWord({ 
      text: candidate, 
      pos: allPOSString, // Hiển thị tất cả các từ loại
      allPOS: Array.from(allPOS), // Lưu danh sách các từ loại
      phonetic, 
      audioUrl, 
      definitions: allDefinitions.slice(0, 4), // Tăng lên 4 định nghĩa
      wordTranslations 
    });

    Promise.all([fetchRelatedPOS(candidate), fetchSynonyms(candidate)])
      .then(([rel, syn]) => { setRelated(rel); setSyns(syn); })
      .catch(() => { setRelated({ n: [], v: [], adj: [], adv: [] }); setSyns([]); })
  }

  async function fetchVietnameseMeanings(word, definitions) {
    try {
      // 1. Dịch trực tiếp từ để lấy các nghĩa cơ bản
      const directUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|vi`;
      const directRes = await fetch(directUrl);
      const directData = await directRes.json();
      const directTranslation = directData?.responseData?.translatedText || "";
      
      // 2. Lấy các matches khác (nếu có) để có nhiều nghĩa hơn
      const matches = directData?.matches || [];
      const uniqueMeanings = new Set();
      
      // Thêm nghĩa chính
      if (directTranslation) {
        uniqueMeanings.add(directTranslation.toLowerCase());
      }
      
      // Thêm các nghĩa từ matches (lấy tối đa 3-4 nghĩa khác nhau)
      for (const match of matches) {
        if (match?.translation && uniqueMeanings.size < 4) {
          const trans = match.translation.toLowerCase().trim();
          if (trans && trans !== directTranslation.toLowerCase()) {
            uniqueMeanings.add(trans);
          }
        }
      }
      
      // 3. Nếu chỉ có 1 nghĩa, thử tách theo dấu phẩy/chấm phẩy
      if (uniqueMeanings.size === 1 && directTranslation) {
        const parts = directTranslation.split(/[,;\/]/).map(p => p.trim()).filter(p => p);
        if (parts.length > 1) {
          uniqueMeanings.clear();
          parts.slice(0, 4).forEach(p => uniqueMeanings.add(p.toLowerCase()));
        }
      }
      
      // Chuyển về array và format lại
      const finalMeanings = Array.from(uniqueMeanings)
        .map(m => m.charAt(0).toUpperCase() + m.slice(1))
        .slice(0, 3); // Giới hạn 3 nghĩa
      
      return finalMeanings.join("; ");
    } catch (error) {
      console.error("Error fetching Vietnamese meanings:", error);
      // Fallback to simple translation
      return await translateTextENtoVI(word);
    }
  }

  async function fetchRelatedPOS(base) {
    // Lấy cả các từ liên quan và các dạng từ loại của cùng từ gốc
    const [related, forms] = await Promise.all([
      // Lấy từ liên quan
      fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(base)}&md=p&max=100`).then(r => r.json()),
      // Lấy các dạng của từ gốc (như "run" -> "running", "ran", "runner")
      fetch(`https://api.datamuse.com/words?rel_jjb=${encodeURIComponent(base)}&md=p&max=50`).then(r => r.json())
        .then(r1 => 
          fetch(`https://api.datamuse.com/words?rel_jja=${encodeURIComponent(base)}&md=p&max=50`).then(r => r.json())
            .then(r2 => [...r1, ...r2])
        )
    ]);
    
    const bucket = { n: [], v: [], adj: [], adv: [] };
    
    // Xử lý các dạng của từ gốc trước (ưu tiên cao hơn)
    for (const it of forms) {
      if (!it.word) continue;
      const w = it.word.toLowerCase();
      const b = base.toLowerCase();
      
      // Chỉ lấy các từ có liên quan đến từ gốc (cùng gốc từ)
      if (!w.includes(b.substring(0, Math.min(3, b.length))) && !b.includes(w.substring(0, Math.min(3, w.length)))) {
        continue;
      }
      
      const tags = it.tags || [];
      if (tags.includes('n') && bucket.n.length < 4) bucket.n.unshift(it.word);
      if (tags.includes('v') && bucket.v.length < 4) bucket.v.unshift(it.word);
      if (tags.includes('adj') && bucket.adj.length < 4) bucket.adj.unshift(it.word);
      if (tags.includes('adv') && bucket.adv.length < 4) bucket.adv.unshift(it.word);
    }
    
    // Sau đó thêm các từ liên quan khác
    for (const it of related) {
      if (!it.word || it.word.toLowerCase() === base.toLowerCase()) continue;
      const tags = it.tags || [];
      if (tags.includes('n') && bucket.n.length < 8) bucket.n.push(it.word);
      if (tags.includes('v') && bucket.v.length < 8) bucket.v.push(it.word);
      if (tags.includes('adj') && bucket.adj.length < 8) bucket.adj.push(it.word);
      if (tags.includes('adv') && bucket.adv.length < 8) bucket.adv.push(it.word);
    }
    
    // Loại bỏ trùng lặp
    for (const key of Object.keys(bucket)) {
      bucket[key] = [...new Set(bucket[key])];
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
    const handleAudioClick = async () => {
      console.log("Audio button clicked, audioUrl:", word?.audioUrl); // Debug log
      
      if (word?.audioUrl) {
        try {
          const audio = new Audio(word.audioUrl);
          
          // Handle errors
          audio.onerror = (e) => {
            console.error("Audio URL error, falling back to Web Speech:", e);
            speak(word.text, "en-US");
          };
          
          // Try to play
          console.log("Attempting to play audio:", word.audioUrl);
          const playPromise = audio.play();
          
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log("Audio playing successfully");
              })
              .catch((error) => {
                console.error("Play promise rejected:", error);
                // Fallback to Web Speech
                speak(word.text, "en-US");
              });
          }
        } catch (err) {
          console.error("Audio initialization error, using Web Speech:", err);
          speak(word.text, "en-US");
        }
      } else {
        console.log("No audio URL, using Web Speech");
        speak(word.text, "en-US");
      }
    };

    return (
      <SmallButton 
        title="Phát âm" 
        onClick={handleAudioClick}
      >
        {word?.audioUrl ? '🔊' : '🔈'}
      </SmallButton>
    );
  }

  async function loadSpecificWord(term) {
    if (word?.text) addToSeen(word.text);
    setLoading(true); setError("");
    // Reset definition states
    setDefinitionVI([]);
    setShowingDefinitionVI(false);
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

  async function toggleDefinition() {
    if (!word?.definitions || word.definitions.length === 0) return;
    
    if (showingDefinitionVI) {
      setShowingDefinitionVI(false);
    } else {
      if (definitionVI.length === 0) {
        // Dịch tất cả các định nghĩa
        const translations = await Promise.all(
          word.definitions.map(def => translateTextENtoVI(def.text))
        );
        setDefinitionVI(translations);
      }
      setShowingDefinitionVI(true);
    }
  }

  function openChatGPTExamples() {
    if (!word?.text) return;
    
    const prompt = `cho tôi 4 ví dụ và 4 đoạn hội thoại về từ ${word.text}`;
    const encodedPrompt = encodeURIComponent(prompt);
    const chatGPTUrl = `https://chatgpt.com/?q=${encodedPrompt}`;
    
    // Copy URL vào clipboard
    navigator.clipboard.writeText(chatGPTUrl).then(() => {
      // Thông báo đã copy (optional)
      console.log('URL đã được copy vào clipboard');
    }).catch(err => {
      console.error('Không thể copy URL:', err);
    });
    
    // Mở ChatGPT trong tab mới
    window.open(chatGPTUrl, '_blank');
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-white to-slate-50 text-slate-800">
      <div className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="font-semibold text-lg">Vocab Swipe</div>
          <div className="flex items-center gap-2">
            <SmallButton onClick={() => setShowSeen(s => !s)} title="Xem danh sách đã xem">📚 Đã xem ({seen.size})</SmallButton>
            <SmallButton onClick={() => { if (word?.text) addToSeen(word.text); loadWord(); }} title="Lấy từ mới">🔄 Từ mới</SmallButton>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {error && (<div className="mb-4 p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700">{error}</div>)}

        <div ref={cardRef} className="select-none">
          <div className={classNames("rounded-2xl shadow-sm border border-slate-200 bg-white p-6 transition will-change-transform", loading && "opacity-70")}>
            {!word && (<div className="text-center py-16"><div className="animate-pulse text-sm text-slate-500">Đang tải từ mới…</div></div>)}

            {word && (
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-3xl font-bold tracking-tight">{word.text}</div>
                    <div className="text-slate-500 mt-1">
                      {word.allPOS && word.allPOS.length > 1 ? (
                        <div className="flex flex-wrap gap-1 items-center">
                          {word.allPOS.map((pos, idx) => (
                            <span key={idx} className="px-2 py-0.5 text-xs rounded-lg bg-slate-100 border border-slate-200">
                              {pos}
                            </span>
                          ))}
                          {word.phonetic && <span className="ml-2">/{String(word.phonetic).replaceAll('/', '')}/</span>}
                        </div>
                      ) : (
                        <>
                          {word.pos} {word.phonetic && <span className="ml-2">/{String(word.phonetic).replaceAll('/', '')}/</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <AudioButton />
                    <SmallButton onClick={() => { addToSeen(word.text); }} title="Lưu vào Đã xem">⭐ Lưu</SmallButton>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div 
                    onClick={toggleDefinition}
                    data-noswipe="true"
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                      Định nghĩa {showingDefinitionVI ? "(VI)" : "(EN)"} - Tap để {showingDefinitionVI ? "xem tiếng Anh" : "dịch"}
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {showingDefinitionVI ? (
                        definitionVI.length > 0 ? (
                          definitionVI.map((def, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="font-medium text-slate-600">{idx + 1}.</span> {def}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-slate-500">Đang dịch...</div>
                        )
                      ) : (
                        word?.definitions && word.definitions.length > 0 ? (
                          word.definitions.map((def, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="text-sm">
                                <span className="font-medium text-slate-600">{idx + 1}.</span>
                                {def.pos && <span className="ml-1 text-xs text-slate-500">({def.pos})</span>}
                                <span className="ml-1">{def.text}</span>
                              </div>
                              {def.example && (
                                <div className="text-xs text-slate-500 italic ml-4">
                                  Ex: {def.example}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-slate-500">(không có định nghĩa)</div>
                        )
                      )}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                    <div className="text-xs uppercase tracking-wide text-green-700 mb-2">Nghĩa tiếng Việt</div>
                    <div className="space-y-1">
                      {word?.wordTranslations ? (
                        word.wordTranslations.split(/[;]/).map((meaning, idx) => {
                          const trimmedMeaning = meaning.trim();
                          if (!trimmedMeaning) return null;
                          return (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="text-green-600 font-medium text-sm">•</span>
                              <span className="text-sm font-medium">{trimmedMeaning}</span>
                            </div>
                          );
                        }).filter(Boolean)
                      ) : (
                        <div className="text-sm text-slate-500">(đang dịch...)</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-2">
                  <button 
                    onClick={openChatGPTExamples}
                    className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 active:scale-[0.98] transition text-sm font-medium"
                  >
                    💬 Ví dụ và hội thoại
                  </button>
                </div>

                <div className="mt-2">
                  <div className="text-sm font-medium text-slate-600 mb-2">Từ đồng nghĩa</div>
                  <SynChips syns={syns} onPick={(t) => loadSpecificWord(t)} />
                </div>

                <div className="mt-2">
                  <div className="text-sm font-medium text-slate-600 mb-2">Dạng từ loại khác</div>
                  <POSChips related={related} word={word} onPick={(t) => loadSpecificWord(t)} />
                </div>

                <div className="text-xs text-slate-500 mt-2">
                  Gợi ý: quẹt <span className="font-semibold">trái</span> để lưu từ này vào danh sách đã xem và hiện từ mới.
                </div>
              </div>
            )}
          </div>
        </div>

        {showSeen && (
          <div className="fixed inset-0 z-20">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowSeen(false)} />
            <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl border-l border-slate-200 flex flex-col">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div className="font-semibold">Danh sách đã xem ({seenList.length})</div>
                <SmallButton onClick={() => setShowSeen(false)}>Đóng</SmallButton>
              </div>
              <div className="p-3 overflow-y-auto flex-1">
                {seenList.length === 0 && (<div className="text-sm text-slate-500 p-3">Chưa có từ nào.</div>)}
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

      <footer className="py-6 text-center text-xs text-slate-500">Nguồn dữ liệu: Datamuse, Free Dictionary API, MyMemory Translate.</footer>
    </div>
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

function POSChips({ related, onPick, word }) {
  const Section = ({ label, items, highlight = false }) => (
    <div className="mb-2">
      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
        {label} {highlight && <span className="text-green-600">(cùng gốc)</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {items && items.length > 0 ? items.map(w => (
          <button 
            key={w} 
            onClick={() => onPick(w)} 
            className={`px-2 py-1 border rounded-lg text-sm hover:bg-slate-50 active:scale-[0.98] ${
              highlight ? 'border-green-300 bg-green-50' : 'border-slate-200'
            }`}
          >
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
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <span className="text-xs uppercase tracking-wide text-slate-500">Từ hiện tại:</span>
        {word?.allPOS && word.allPOS.length > 1 ? (
          word.allPOS.map((pos, idx) => (
            <span key={idx} className="px-2 py-0.5 text-sm rounded-lg border border-slate-200 bg-white">
              {viLabel(pos)}
            </span>
          ))
        ) : (
          <span className="px-2 py-0.5 text-sm rounded-lg border border-slate-200 bg-white">
            {viLabel(word?.pos)}
          </span>
        )}
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
        
        // Lấy tất cả các POS của từ hiện tại
        const currentKeys = word?.allPOS ? 
          word.allPOS.map(p => posKey(p)).filter(Boolean) : 
          [posKey(word?.pos)].filter(Boolean);
        
        // Sắp xếp: các dạng khác của từ gốc trước, sau đó là từ liên quan
        const allKeys = ['n','v','adj','adv'];
        const labels = { n: "Danh từ", v: "Động từ", adj: "Tính từ", adv: "Trạng từ" };
        const hasAny = allKeys.some(k => (related[k]||[]).length > 0);
        
        if (!hasAny) return <div className="text-xs text-slate-400">(Không có từ liên quan)</div>;
        
        // Phân loại từ theo gốc từ
        const wordRoot = word?.text ? word.text.substring(0, Math.min(4, word.text.length)).toLowerCase() : '';
        
        return (
          <div>
            <div className="text-xs text-slate-600 mb-2 font-medium">Các dạng từ loại khác:</div>
            {allKeys.map(k => {
              const items = related[k] || [];
              if (items.length === 0) return null;
              
              // Phân loại từ cùng gốc và từ liên quan
              const sameRoot = items.filter(w => 
                w.toLowerCase().includes(wordRoot) || wordRoot.includes(w.substring(0, Math.min(3, w.length)).toLowerCase())
              );
              const otherRelated = items.filter(w => !sameRoot.includes(w));
              
              return (
                <div key={k}>
                  {sameRoot.length > 0 && (
                    <Section 
                      label={`${labels[k]} ${currentKeys.includes(k) ? '(hiện tại)' : ''}`} 
                      items={sameRoot}
                      highlight={true}
                    />
                  )}
                  {otherRelated.length > 0 && (
                    <Section 
                      label={`${labels[k]} liên quan`} 
                      items={otherRelated}
                      highlight={false}
                    />
                  )}
                </div>
              );
            }).filter(Boolean)}
          </div>
        );
      })()}
    </div>
  );
}