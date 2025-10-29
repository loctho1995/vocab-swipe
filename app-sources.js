/**
 * Vocab Swipe with Sources Management
 * Học từ vựng từ các file JSON có cấu trúc
 */

// ============ STORAGE KEYS ============
const STORAGE = {
    SOURCES: 'vocab_sources_v1',
    PROGRESS: 'vocab_progress_v1',
    CURRENT_SOURCE: 'vocab_current_source_v1'
};

// ============ STATE ============
let sources = {}; // { sourceName: { words: [], createdAt: timestamp } }
let progress = {}; // { sourceName: { learned: [], skipped: [], currentIndex: 0 } }
let currentSource = '';
let currentWord = null;
let currentIndex = 0;

// ============ UTILS ============
function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error('Save error:', error);
        return false;
    }
}

function loadFromStorage(key, defaultValue = {}) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
        console.error('Load error:', error);
        return defaultValue;
    }
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('vi-VN');
}

// ============ SOURCES MANAGEMENT ============
function loadSources() {
    sources = loadFromStorage(STORAGE.SOURCES, {});
    return sources;
}

function saveSources() {
    return saveToStorage(STORAGE.SOURCES, sources);
}

function addSource(name, words) {
    if (!name || !Array.isArray(words) || words.length === 0) {
        return false;
    }
    
    sources[name] = {
        words: words,
        createdAt: Date.now(),
        totalWords: words.length
    };
    
    // Initialize progress for this source
    if (!progress[name]) {
        progress[name] = {
            learned: [],
            skipped: [],
            currentIndex: 0
        };
        saveProgress();
    }
    
    return saveSources();
}

function deleteSource(name) {
    if (sources[name]) {
        delete sources[name];
        if (progress[name]) {
            delete progress[name];
            saveProgress();
        }
        return saveSources();
    }
    return false;
}

function getSourceWords(sourceName) {
    return sources[sourceName]?.words || [];
}

// ============ PROGRESS MANAGEMENT ============
function loadProgress() {
    progress = loadFromStorage(STORAGE.PROGRESS, {});
    return progress;
}

function saveProgress() {
    return saveToStorage(STORAGE.PROGRESS, progress);
}

function getCurrentSourceProgress() {
    if (!currentSource || !progress[currentSource]) {
        return null;
    }
    return progress[currentSource];
}

function markWordAsLearned(word) {
    const prog = getCurrentSourceProgress();
    if (!prog) return;
    
    const wordKey = word.word.toLowerCase();
    
    // Remove from skipped if exists
    prog.skipped = prog.skipped.filter(w => w.toLowerCase() !== wordKey);
    
    // Add to learned if not exists
    if (!prog.learned.some(w => w.toLowerCase() === wordKey)) {
        prog.learned.push(word.word);
    }
    
    saveProgress();
}

function markWordAsSkipped(word) {
    const prog = getCurrentSourceProgress();
    if (!prog) return;
    
    const wordKey = word.word.toLowerCase();
    
    // Add to skipped if not in learned and not already skipped
    if (!prog.learned.some(w => w.toLowerCase() === wordKey) &&
        !prog.skipped.some(w => w.toLowerCase() === wordKey)) {
        prog.skipped.push(word.word);
    }
    
    saveProgress();
}

function resetSourceProgress(sourceName) {
    if (progress[sourceName]) {
        progress[sourceName] = {
            learned: [],
            skipped: [],
            currentIndex: 0
        };
        saveProgress();
    }
}

// ============ WORD NAVIGATION ============
function getNextUnlearnedWord() {
    if (!currentSource) return null;
    
    const words = getSourceWords(currentSource);
    const prog = getCurrentSourceProgress();
    
    if (words.length === 0) return null;
    
    // Find next unlearned word
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordKey = word.word.toLowerCase();
        
        if (!prog.learned.some(w => w.toLowerCase() === wordKey)) {
            prog.currentIndex = i;
            saveProgress();
            return word;
        }
    }
    
    // All words learned, return null
    return null;
}

function loadNextWord() {
    const word = getNextUnlearnedWord();
    
    if (!word) {
        showCompletionMessage();
        return;
    }
    
    currentWord = word;
    renderWord(word);
    updateProgressInfo();
}

function showCompletionMessage() {
    hideLoading();
    document.getElementById('mainCard').style.display = 'none';
    const emptyState = document.getElementById('emptyState');
    emptyState.style.display = 'flex';
    emptyState.innerHTML = `
        <div class="empty-icon">🎉</div>
        <h2>Chúc mừng!</h2>
        <p>Bạn đã học xong tất cả từ trong bộ "${currentSource}"</p>
        <button id="resetProgressBtn" class="btn-primary">🔄 Học lại từ đầu</button>
    `;
    
    document.getElementById('resetProgressBtn').addEventListener('click', () => {
        if (confirm('Bạn có chắc muốn học lại từ đầu?')) {
            resetSourceProgress(currentSource);
            loadNextWord();
            emptyState.style.display = 'none';
            document.getElementById('mainCard').style.display = 'flex';
        }
    });
}

// ============ UI RENDERING ============
function renderWord(word) {
    document.getElementById('mainCard').style.display = 'flex';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('loadingScreen').style.display = 'none';
    
    // Word & Type
    document.getElementById('wordText').textContent = word.word;
    document.getElementById('wordType').textContent = word.wordType || 'unknown';
    
    // Phonetic
    document.getElementById('phonetic').textContent = word.pronounce || '—';
    
    // Translation
    document.getElementById('translationText').textContent = word.translateVN || '—';
    
    // Meaning
    document.getElementById('definitionText').textContent = word.meaning || '—';
    
    // Word Forms
    const formsBox = document.getElementById('wordForms');
    const formsGrid = document.getElementById('wordFormsGrid');
    
    if (word.forms && word.forms.length > 0) {
        formsGrid.innerHTML = word.forms.map(form => `
            <div class="verb-form-item">
                <div class="verb-form-value">${form}</div>
            </div>
        `).join('');
        formsBox.style.display = 'block';
    } else {
        formsBox.style.display = 'none';
    }
    
    // Synonyms
    renderChips('synonymsSection', 'synonymsChips', word.synonyms);
    
    // Antonyms
    renderChips('antonymsSection', 'antonymsChips', word.antonyms);
    
    // Notes
    const notesBox = document.getElementById('notesBox');
    const notesText = document.getElementById('notesText');
    if (word.notes) {
        notesText.textContent = word.notes;
        notesBox.style.display = 'block';
    } else {
        notesBox.style.display = 'none';
    }
}

function renderChips(sectionId, chipsId, items) {
    const section = document.getElementById(sectionId);
    const chips = document.getElementById(chipsId);
    
    if (items && items.length > 0) {
        chips.innerHTML = items.map(item => 
            `<span class="chip">${item}</span>`
        ).join('');
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
    }
}

function updateSourceSelector() {
    const select = document.getElementById('currentSource');
    const sourceNames = Object.keys(sources);
    
    // If no current source but sources exist, select the first one
    if (!currentSource && sourceNames.length > 0) {
        currentSource = sourceNames[0];
        saveToStorage(STORAGE.CURRENT_SOURCE, currentSource);
    }
    
    select.innerHTML = '<option value="">Chọn bộ từ vựng...</option>' +
        sourceNames.map(name => 
            `<option value="${name}" ${name === currentSource ? 'selected' : ''}>${name}</option>`
        ).join('');
    
    // Update history filter
    const historyFilter = document.getElementById('historySourceFilter');
    historyFilter.innerHTML = '<option value="">Tất cả sources</option>' +
        sourceNames.map(name => 
            `<option value="${name}">${name}</option>`
        ).join('');
}

function updateProgressInfo() {
    const progressInfo = document.getElementById('progressInfo');
    
    if (!currentSource) {
        progressInfo.innerHTML = '<span class="progress-text">Chọn bộ từ vựng để bắt đầu</span>';
        return;
    }
    
    const words = getSourceWords(currentSource);
    const prog = getCurrentSourceProgress();
    
    if (!words || !prog) {
        progressInfo.innerHTML = '<span class="progress-text">—</span>';
        return;
    }
    
    const total = words.length;
    const learned = prog.learned.length;
    const percent = total > 0 ? Math.round((learned / total) * 100) : 0;
    
    progressInfo.innerHTML = `
        <span class="progress-text">${learned}/${total} từ (${percent}%)</span>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${percent}%"></div>
        </div>
    `;
}

function showSwipeIndicator(text, type = 'success') {
    const indicator = document.getElementById('swipeIndicator');
    indicator.textContent = text;
    indicator.style.background = type === 'success' 
        ? 'rgba(16, 185, 129, 0.95)' 
        : 'rgba(251, 191, 36, 0.95)';
    indicator.classList.add('show');
    
    setTimeout(() => {
        indicator.classList.remove('show');
    }, 1500);
}

// ============ SOURCES MODAL ============
function renderSourcesList() {
    const list = document.getElementById('sourcesList');
    const sourceNames = Object.keys(sources);
    
    if (sourceNames.length === 0) {
        list.innerHTML = '<p class="empty-message">Chưa có source nào. Hãy import để bắt đầu!</p>';
        return;
    }
    
    list.innerHTML = sourceNames.map(name => {
        const source = sources[name];
        const prog = progress[name] || { learned: [], skipped: [] };
        const total = source.totalWords || source.words.length;
        const learned = prog.learned.length;
        const skipped = prog.skipped.length;
        const remaining = total - learned;
        
        return `
            <div class="source-item">
                <div class="source-item-header">
                    <div>
                        <div class="source-item-title">${name}</div>
                        <div class="source-item-meta">
                            Tạo lúc: ${formatDate(source.createdAt)}
                        </div>
                    </div>
                    <div class="source-item-actions">
                        <button class="btn-small btn-success" data-action="select" data-source="${name}">
                            ✓ Chọn
                        </button>
                        <button class="btn-small btn-outline" data-action="export" data-source="${name}" title="Export file JSON">
                            📥 Export
                        </button>
                        <button class="btn-small" data-action="reset" data-source="${name}">
                            🔄
                        </button>
                        <button class="btn-small btn-danger" data-action="delete" data-source="${name}">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="source-item-stats">
                    <div class="stat-box">
                        <div class="stat-value">${total}</div>
                        <div class="stat-label">Tổng từ</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${learned}</div>
                        <div class="stat-label">Đã học</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${remaining}</div>
                        <div class="stat-label">Còn lại</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners
    list.querySelectorAll('[data-action="select"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const sourceName = btn.dataset.source;
            selectSource(sourceName);
            closeModal('sourcesModal');
        });
    });
    
    list.querySelectorAll('[data-action="export"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const sourceName = btn.dataset.source;
            const source = sources[sourceName];
            if (source && source.words) {
                downloadSourceFile(sourceName, source.words);
            }
        });
    });
    
    list.querySelectorAll('[data-action="reset"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const sourceName = btn.dataset.source;
            if (confirm(`Reset tiến độ học của "${sourceName}"?`)) {
                resetSourceProgress(sourceName);
                renderSourcesList();
                if (currentSource === sourceName) {
                    updateProgressInfo();
                }
            }
        });
    });
    
    list.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const sourceName = btn.dataset.source;
            if (confirm(`Xóa source "${sourceName}"?\nDữ liệu sẽ mất vĩnh viễn!`)) {
                deleteSource(sourceName);
                if (currentSource === sourceName) {
                    currentSource = '';
                    saveToStorage(STORAGE.CURRENT_SOURCE, '');
                    document.getElementById('mainCard').style.display = 'none';
                    document.getElementById('emptyState').style.display = 'flex';
                }
                updateSourceSelector();
                renderSourcesList();
            }
        });
    });
}

// ============ IMPORT MODAL ============
function validateJSON(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        
        if (!Array.isArray(data)) {
            return { valid: false, error: 'Dữ liệu phải là một array (mảng)' };
        }
        
        if (data.length === 0) {
            return { valid: false, error: 'Array không được rỗng' };
        }
        
        // Validate each word object
        for (let i = 0; i < data.length; i++) {
            const word = data[i];
            
            if (!word.word || typeof word.word !== 'string') {
                return { valid: false, error: `Từ thứ ${i + 1} thiếu hoặc sai trường "word"` };
            }
            
            // Optional but recommended fields
            const recommendedFields = ['wordType', 'meaning', 'translateVN'];
            const missingFields = recommendedFields.filter(field => !word[field]);
            
            if (missingFields.length > 0) {
                console.warn(`Từ "${word.word}" thiếu: ${missingFields.join(', ')}`);
            }
        }
        
        return { valid: true, data, count: data.length };
    } catch (error) {
        return { valid: false, error: 'JSON không hợp lệ: ' + error.message };
    }
}

function showImportStatus(message, type = 'info') {
    const status = document.getElementById('importStatus');
    status.textContent = message;
    status.className = 'import-status ' + type;
    status.style.display = 'block';
}

function hideImportStatus() {
    const status = document.getElementById('importStatus');
    status.style.display = 'none';
}

// Download JSON file to local
function downloadSourceFile(sourceName, wordsData) {
    try {
        // Create blob from JSON data
        const jsonString = JSON.stringify(wordsData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Sanitize filename
        const safeFilename = sourceName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        
        a.download = `${safeFilename}.json`;
        
        // Trigger download
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`Downloaded: ${a.download}`);
        return true;
    } catch (error) {
        console.error('Download error:', error);
        return false;
    }
}

// ============ HISTORY MODAL ============
function renderHistory() {
    const learnedList = document.getElementById('learnedList');
    const skippedList = document.getElementById('skippedList');
    const statsDiv = document.getElementById('historyStats');
    const filterSelect = document.getElementById('historySourceFilter');
    
    const selectedSource = filterSelect.value;
    
    // Gather all words from all sources (or filtered source)
    let allLearned = [];
    let allSkipped = [];
    let totalWords = 0;
    
    Object.entries(progress).forEach(([sourceName, prog]) => {
        if (selectedSource && sourceName !== selectedSource) return;
        
        const sourceWords = getSourceWords(sourceName);
        totalWords += sourceWords.length;
        
        // Get word details for learned
        prog.learned.forEach(wordText => {
            const word = sourceWords.find(w => w.word.toLowerCase() === wordText.toLowerCase());
            if (word) {
                allLearned.push({ ...word, sourceName });
            }
        });
        
        // Get word details for skipped
        prog.skipped.forEach(wordText => {
            const word = sourceWords.find(w => w.word.toLowerCase() === wordText.toLowerCase());
            if (word) {
                allSkipped.push({ ...word, sourceName });
            }
        });
    });
    
    // Render stats
    statsDiv.innerHTML = `
        <div class="history-stat-card">
            <div class="history-stat-value">${totalWords}</div>
            <div class="history-stat-label">Tổng từ</div>
        </div>
        <div class="history-stat-card">
            <div class="history-stat-value">${allLearned.length}</div>
            <div class="history-stat-label">Đã học</div>
        </div>
        <div class="history-stat-card">
            <div class="history-stat-value">${allSkipped.length}</div>
            <div class="history-stat-label">Đã bỏ qua</div>
        </div>
        <div class="history-stat-card">
            <div class="history-stat-value">${totalWords - allLearned.length}</div>
            <div class="history-stat-label">Còn lại</div>
        </div>
    `;
    
    // Render learned words
    if (allLearned.length > 0) {
        learnedList.innerHTML = allLearned.map(word => `
            <div class="history-word-card">
                <div class="history-word-header">
                    <div class="history-word-title">${word.word}</div>
                    <div class="history-word-type">${word.wordType || 'unknown'}</div>
                </div>
                <div class="history-word-meaning">${word.meaning || '—'}</div>
                <div class="history-word-translation">${word.translateVN || '—'}</div>
                <div class="history-word-meta">
                    <span>📁 ${word.sourceName}</span>
                    <div class="history-word-actions">
                        <button class="btn-small" data-action="unlearn" data-source="${word.sourceName}" data-word="${word.word}">
                            ↩️ Chưa học
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add unlearn handlers
        learnedList.querySelectorAll('[data-action="unlearn"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const sourceName = btn.dataset.source;
                const wordText = btn.dataset.word;
                
                if (progress[sourceName]) {
                    progress[sourceName].learned = progress[sourceName].learned.filter(
                        w => w.toLowerCase() !== wordText.toLowerCase()
                    );
                    saveProgress();
                    renderHistory();
                    if (currentSource === sourceName) {
                        updateProgressInfo();
                    }
                }
            });
        });
    } else {
        learnedList.innerHTML = '<p class="empty-message">Chưa có từ nào được đánh dấu đã học</p>';
    }
    
    // Render skipped words
    if (allSkipped.length > 0) {
        skippedList.innerHTML = allSkipped.map(word => `
            <div class="history-word-card">
                <div class="history-word-header">
                    <div class="history-word-title">${word.word}</div>
                    <div class="history-word-type">${word.wordType || 'unknown'}</div>
                </div>
                <div class="history-word-meaning">${word.meaning || '—'}</div>
                <div class="history-word-translation">${word.translateVN || '—'}</div>
                <div class="history-word-meta">
                    <span>📁 ${word.sourceName}</span>
                    <div class="history-word-actions">
                        <button class="btn-small" data-action="unskip" data-source="${word.sourceName}" data-word="${word.word}">
                            ↩️ Bỏ đánh dấu
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add unskip handlers
        skippedList.querySelectorAll('[data-action="unskip"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const sourceName = btn.dataset.source;
                const wordText = btn.dataset.word;
                
                if (progress[sourceName]) {
                    progress[sourceName].skipped = progress[sourceName].skipped.filter(
                        w => w.toLowerCase() !== wordText.toLowerCase()
                    );
                    saveProgress();
                    renderHistory();
                }
            });
        });
    } else {
        skippedList.innerHTML = '<p class="empty-message">Chưa có từ nào được bỏ qua</p>';
    }
}

// ============ MODAL HELPERS ============
function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// ============ SOURCE SELECTION ============
function selectSource(sourceName) {
    if (!sources[sourceName]) {
        alert('Source không tồn tại!');
        return;
    }
    
    currentSource = sourceName;
    saveToStorage(STORAGE.CURRENT_SOURCE, currentSource);
    
    // Initialize progress if needed
    if (!progress[currentSource]) {
        progress[currentSource] = {
            learned: [],
            skipped: [],
            currentIndex: 0
        };
        saveProgress();
    }
    
    updateSourceSelector();
    updateProgressInfo();
    loadNextWord();
}

// ============ AUDIO PLAYBACK ============
function playAudio() {
    if (!currentWord || !currentWord.audioURL) {
        // Fallback to speech synthesis
        if (currentWord && currentWord.word) {
            speakWord(currentWord.word);
        }
        return;
    }
    
    const audio = new Audio(currentWord.audioURL);
    audio.play().catch(error => {
        console.error('Audio error:', error);
        // Fallback to speech synthesis
        speakWord(currentWord.word);
    });
}

function speakWord(text) {
    try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    } catch (error) {
        console.error('Speech error:', error);
    }
}

// ============ AI ASSISTANT ============
function openAI() {
    if (!currentWord) return;
    
    const word = currentWord.word;
    const prompt = `Về từ "${word}":

1. Giải thích ý nghĩa chi tiết bằng tiếng Việt
2. Hướng dẫn cách phát âm (phiên âm và mẹo phát âm)
3. 5 đoạn hội thoại phổ biến sử dụng từ này (ngắn gọn, thực tế)
4. Các cụm từ và collocations thường gặp

Trả lời bằng tiếng Việt, dễ hiểu.`;
    
    const encodedPrompt = encodeURIComponent(prompt);
    window.open(`https://chat.openai.com/?q=${encodedPrompt}`, '_blank');
}

// ============ SWIPE GESTURE ============
function initSwipeGesture() {
    const card = document.getElementById('swipeCard');
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    
    const isInteractive = (target) => {
        return target.closest('button, a, input, textarea');
    };
    
    const handleStart = (e) => {
        if (isInteractive(e.target)) return;
        
        isDragging = true;
        const point = e.type.includes('mouse') ? e : e.touches[0];
        startX = point.clientX;
        card.classList.add('swiping');
    };
    
    const handleMove = (e) => {
        if (!isDragging) return;
        
        const point = e.type.includes('mouse') ? e : e.touches[0];
        currentX = point.clientX - startX;
        
        card.style.transform = `translateX(${currentX}px) rotate(${currentX / 20}deg)`;
        card.style.opacity = 1 - Math.abs(currentX) / 300;
    };
    
    const handleEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        card.classList.remove('swiping');
        
        // Swipe left - learned
        if (currentX < -100) {
            card.style.transform = `translateX(-${window.innerWidth}px) rotate(-30deg)`;
            card.style.opacity = '0';
            
            markWordAsLearned(currentWord);
            showSwipeIndicator('✓ Đã học', 'success');
            
            setTimeout(() => {
                card.style.transform = '';
                card.style.opacity = '';
                loadNextWord();
            }, 300);
        }
        // Swipe right - skip
        else if (currentX > 100) {
            card.style.transform = `translateX(${window.innerWidth}px) rotate(30deg)`;
            card.style.opacity = '0';
            
            markWordAsSkipped(currentWord);
            showSwipeIndicator('⏭️ Bỏ qua', 'warning');
            
            setTimeout(() => {
                card.style.transform = '';
                card.style.opacity = '';
                loadNextWord();
            }, 300);
        }
        // Reset
        else {
            card.style.transform = '';
            card.style.opacity = '';
        }
        
        currentX = 0;
    };
    
    card.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    
    card.addEventListener('touchstart', handleStart, { passive: true });
    card.addEventListener('touchmove', handleMove, { passive: true });
    card.addEventListener('touchend', handleEnd);
}

// ============ CREATE SAMPLE SOURCE ============
function createSampleSource() {
    const sampleWords = [
        {
            "word": "proactive",
            "pronounce": "/proʊˈæk.tɪv/",
            "wordType": "adjective",
            "meaning": "taking action by causing change and not only reacting to change when it happens",
            "translateVN": "chủ động, tiên phong, tích cực hành động trước",
            "synonyms": ["preventive", "anticipatory", "forward-thinking"],
            "antonyms": ["reactive", "passive", "inactive"],
            "forms": ["proactively", "proactiveness"],
            "audioURL": "",
            "notes": "Thường dùng trong môi trường công việc để mô tả người chủ động giải quyết vấn đề trước khi nó xảy ra."
        },
        {
            "word": "active",
            "pronounce": "/ˈæk.tɪv/",
            "wordType": "adjective",
            "meaning": "being involved in action; busy with a particular activity",
            "translateVN": "năng động, tích cực, hoạt động",
            "synonyms": ["energetic", "dynamic", "busy", "lively"],
            "antonyms": ["inactive", "passive", "idle", "dormant"],
            "forms": ["actively", "activeness", "activity"],
            "audioURL": "",
            "notes": "Từ cơ bản mô tả trạng thái năng động, hay hoạt động."
        },
        {
            "word": "positive",
            "pronounce": "/ˈpɑː.zə.tɪv/",
            "wordType": "adjective",
            "meaning": "full of hope and confidence, or giving cause for hope and confidence; certain and without doubt",
            "translateVN": "tích cực, lạc quan, khẳng định, chắc chắn",
            "synonyms": ["optimistic", "constructive", "affirmative", "confident"],
            "antonyms": ["negative", "pessimistic", "doubtful"],
            "forms": ["positively", "positiveness", "positivity"],
            "audioURL": "",
            "notes": "Có nhiều nghĩa: tích cực về thái độ, khẳng định về ý kiến, dương tính trong y học."
        },
        {
            "word": "negative",
            "pronounce": "/ˈneɡ.ə.tɪv/",
            "wordType": "adjective",
            "meaning": "expressing or meaning a refusal or denial; harmful, bad or not wanted",
            "translateVN": "tiêu cực, phủ định, không tốt, âm tính",
            "synonyms": ["pessimistic", "harmful", "unfavorable", "bad"],
            "antonyms": ["positive", "optimistic", "favorable", "good"],
            "forms": ["negatively", "negativeness", "negativity"],
            "audioURL": "",
            "notes": "Trái nghĩa với positive, mô tả điều không tốt hoặc thái độ bi quan."
        }
    ];
    
    addSource('Sample - Basic Words', sampleWords);
    saveSources();
}

// ============ INITIALIZATION ============
function init() {
    // Load data
    loadSources();
    loadProgress();
    currentSource = loadFromStorage(STORAGE.CURRENT_SOURCE, '');
    
    // Create sample source if no sources exist
    if (Object.keys(sources).length === 0) {
        createSampleSource();
    }
    
    // Update UI
    updateSourceSelector();
    
    // Check if we have a current source (may be auto-selected in updateSourceSelector)
    if (currentSource && sources[currentSource]) {
        updateProgressInfo();
        loadNextWord();
    } else {
        // No source selected - show empty state
        document.getElementById('loadingScreen').style.display = 'none';
        document.getElementById('mainCard').style.display = 'none';
        const emptyState = document.getElementById('emptyState');
        emptyState.style.display = 'flex';
        emptyState.innerHTML = `
            <div class="empty-icon">📚</div>
            <h2>Chưa chọn bộ từ vựng</h2>
            <p>Hãy chọn một bộ từ vựng để bắt đầu học!</p>
            <button id="openSourcesBtn" class="btn-primary">📁 Chọn bộ từ vựng</button>
            <button id="openImportBtn2" class="btn-secondary" style="margin-top: 12px;">📥 Hoặc import mới</button>
        `;
        
        // Add event listeners for empty state buttons
        document.getElementById('openSourcesBtn')?.addEventListener('click', () => {
            renderSourcesList();
            openModal('sourcesModal');
        });
        
        document.getElementById('openImportBtn2')?.addEventListener('click', () => {
            hideImportStatus();
            openModal('importModal');
        });
    }
    
    // ===== EVENT LISTENERS =====
    
    // Header buttons
    document.getElementById('sourcesBtn').addEventListener('click', () => {
        renderSourcesList();
        openModal('sourcesModal');
    });
    
    document.getElementById('importBtn').addEventListener('click', () => {
        hideImportStatus();
        openModal('importModal');
    });
    
    document.getElementById('historyBtn').addEventListener('click', () => {
        renderHistory();
        openModal('historyModal');
    });
    
    // Source selector
    document.getElementById('currentSource').addEventListener('change', (e) => {
        const sourceName = e.target.value;
        if (sourceName) {
            selectSource(sourceName);
        }
    });
    
    document.getElementById('refreshSourceBtn').addEventListener('click', () => {
        if (currentSource) {
            loadNextWord();
        }
    });
    
    // Card actions
    document.getElementById('audioBtn').addEventListener('click', playAudio);
    
    document.getElementById('aiBtn').addEventListener('click', openAI);
    
    document.getElementById('learnedBtn').addEventListener('click', () => {
        if (currentWord) {
            markWordAsLearned(currentWord);
            showSwipeIndicator('✓ Đã học', 'success');
            loadNextWord();
        }
    });
    
    document.getElementById('skipBtn').addEventListener('click', () => {
        if (currentWord) {
            markWordAsSkipped(currentWord);
            showSwipeIndicator('⏭️ Bỏ qua', 'warning');
            loadNextWord();
        }
    });
    
    // Empty state
    document.getElementById('openImportBtn')?.addEventListener('click', () => {
        hideImportStatus();
        openModal('importModal');
    });
    
    // Import modal
    document.getElementById('closeImportBtn').addEventListener('click', () => {
        closeModal('importModal');
    });
    
    document.getElementById('validateJsonBtn').addEventListener('click', () => {
        const jsonText = document.getElementById('wordsJsonInput').value.trim();
        
        if (!jsonText) {
            showImportStatus('Vui lòng nhập JSON!', 'error');
            return;
        }
        
        const result = validateJSON(jsonText);
        
        if (result.valid) {
            showImportStatus(`✓ JSON hợp lệ! Tìm thấy ${result.count} từ vựng.`, 'success');
        } else {
            showImportStatus(`✗ Lỗi: ${result.error}`, 'error');
        }
    });
    
    document.getElementById('importJsonBtn').addEventListener('click', () => {
        const sourceName = document.getElementById('sourceNameInput').value.trim();
        const jsonText = document.getElementById('wordsJsonInput').value.trim();
        
        if (!sourceName) {
            showImportStatus('Vui lòng nhập tên bộ từ vựng!', 'error');
            return;
        }
        
        if (!jsonText) {
            showImportStatus('Vui lòng nhập JSON!', 'error');
            return;
        }
        
        // Check if source name exists
        if (sources[sourceName]) {
            if (!confirm(`Source "${sourceName}" đã tồn tại. Ghi đè?`)) {
                return;
            }
        }
        
        const result = validateJSON(jsonText);
        
        if (!result.valid) {
            showImportStatus(`✗ Lỗi: ${result.error}`, 'error');
            return;
        }
        
        // Add source
        if (addSource(sourceName, result.data)) {
            // Auto download source file
            const downloaded = downloadSourceFile(sourceName, result.data);
            
            if (downloaded) {
                showImportStatus(`✓ Đã lưu "${sourceName}" với ${result.count} từ vựng!\n📥 File JSON đã được tải về. Hãy lưu vào folder sources/ để quản lý.`, 'success');
            } else {
                showImportStatus(`✓ Đã lưu "${sourceName}" với ${result.count} từ vựng!`, 'success');
            }
            
            updateSourceSelector();
            
            // Clear form
            document.getElementById('sourceNameInput').value = '';
            document.getElementById('wordsJsonInput').value = '';
            
            // Auto select the new source
            setTimeout(() => {
                closeModal('importModal');
                selectSource(sourceName);
            }, 2000);
        } else {
            showImportStatus('✗ Không thể lưu source!', 'error');
        }
    });
    
    // Sources modal
    document.getElementById('closeSourcesBtn').addEventListener('click', () => {
        closeModal('sourcesModal');
    });
    
    // History modal
    document.getElementById('closeHistoryBtn').addEventListener('click', () => {
        closeModal('historyModal');
    });
    
    document.getElementById('historySourceFilter').addEventListener('change', () => {
        renderHistory();
    });
    
    // History tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            // Update active tab
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update active list
            document.querySelectorAll('.history-list').forEach(list => list.classList.remove('active'));
            document.getElementById(tab + 'List').classList.add('active');
        });
    });
    
    // Modal backdrop close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
    
    // Init swipe gesture
    initSwipeGesture();
    
    // Load speech synthesis voices
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.addEventListener('voiceschanged', () => {
            window.speechSynthesis.getVoices();
        });
    }
}

// Start app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
