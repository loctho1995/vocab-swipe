/**
 * Vocab Swipe with Sources Management - Server Version
 * Học từ vựng từ server API (auto-load từ folder sources/)
 */

// ============ API CONFIG ============
const API_BASE = window.location.origin; // Tự động detect server URL
const API_ENDPOINTS = {
    SOURCES: `${API_BASE}/api/sources`,
    SOURCE_DETAIL: (fileName) => `${API_BASE}/api/sources/${fileName}`,
    DELETE_SOURCE: (fileName) => `${API_BASE}/api/sources/${fileName}`
};

// ============ STORAGE KEYS ============
const STORAGE = {
    PROGRESS: 'vocab_progress_v1',
    CURRENT_SOURCE: 'vocab_current_source_v1'
};

// ============ STATE ============
let sources = {}; // { sourceName: { words: [], fileName: string, createdAt: timestamp } }
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

function showLoadingText(text) {
    document.getElementById('loadingText').textContent = text;
}

// ============ API FUNCTIONS ============
async function fetchSourcesFromServer() {
    try {
        showLoadingText('Đang tải danh sách sources từ server...');
        
        const response = await fetch(API_ENDPOINTS.SOURCES);
        if (!response.ok) throw new Error('Failed to fetch sources');
        
        const data = await response.json();
        
        if (data.success && data.sources) {
            // Convert array to object
            sources = {};
            data.sources.forEach(source => {
                sources[source.name] = {
                    words: source.words,
                    fileName: source.fileName,
                    createdAt: source.createdAt,
                    totalWords: source.totalWords
                };
            });
            
            console.log(`✓ Loaded ${data.count} sources from server:`, Object.keys(sources));
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error fetching sources:', error);
        return false;
    }
}

async function saveSourceToServer(name, words) {
    try {
        const response = await fetch(API_ENDPOINTS.SOURCES, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, words })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log(`✓ Saved source "${name}" to server`);
            return data.fileName;
        }
        
        return null;
    } catch (error) {
        console.error('Error saving source:', error);
        return null;
    }
}

async function deleteSourceFromServer(fileName) {
    try {
        const response = await fetch(API_ENDPOINTS.DELETE_SOURCE(fileName), {
            method: 'DELETE'
        });
        
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Error deleting source:', error);
        return false;
    }
}

// ============ SOURCES MANAGEMENT ============
async function loadSources() {
    // Load from server
    const success = await fetchSourcesFromServer();
    
    if (!success || Object.keys(sources).length === 0) {
        console.log('No sources found on server');
    }
    
    return sources;
}

function getSourceWords(sourceName) {
    return sources[sourceName]?.words || [];
}

async function deleteSource(name) {
    if (sources[name]) {
        const fileName = sources[name].fileName;
        
        // Delete from server
        const success = await deleteSourceFromServer(fileName);
        
        if (success) {
            // Delete from local state
            delete sources[name];
            
            // Delete progress
            if (progress[name]) {
                delete progress[name];
                saveProgress();
            }
            
            return true;
        }
    }
    return false;
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

function initSourceProgress(sourceName) {
    if (!progress[sourceName]) {
        progress[sourceName] = {
            learned: [],
            skipped: [],
            currentIndex: 0
        };
        saveProgress();
    }
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

function renderChips(sectionId, containerId, items) {
    const section = document.getElementById(sectionId);
    const container = document.getElementById(containerId);
    
    if (items && items.length > 0) {
        container.innerHTML = items.map(item => 
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
    
    // Clear existing options except first
    select.innerHTML = '<option value="">Chọn bộ từ vựng...</option>';
    
    // Add sources
    sourceNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = `${name} (${sources[name].totalWords} từ)`;
        select.appendChild(option);
    });
    
    // Select current source if exists
    if (currentSource && sources[currentSource]) {
        select.value = currentSource;
    } else if (sourceNames.length > 0) {
        // Auto select first source
        currentSource = sourceNames[0];
        select.value = currentSource;
        saveToStorage(STORAGE.CURRENT_SOURCE, currentSource);
        initSourceProgress(currentSource);
    }
}

function updateProgressInfo() {
    const progressInfo = document.getElementById('progressInfo');
    
    if (!currentSource || !sources[currentSource]) {
        progressInfo.innerHTML = '<span class="progress-text">—</span>';
        return;
    }
    
    const totalWords = sources[currentSource].totalWords;
    const prog = getCurrentSourceProgress();
    
    if (!prog) {
        progressInfo.innerHTML = '<span class="progress-text">—</span>';
        return;
    }
    
    const learned = prog.learned.length;
    const skipped = prog.skipped.length;
    const remaining = totalWords - learned;
    const percentage = Math.round((learned / totalWords) * 100);
    
    progressInfo.innerHTML = `
        <span class="progress-text">
            Đã học: <strong>${learned}</strong>/${totalWords} 
            (${percentage}%)
            ${skipped > 0 ? ` | Bỏ qua: ${skipped}` : ''}
        </span>
    `;
}

async function selectSource(sourceName) {
    if (!sources[sourceName]) return;
    
    currentSource = sourceName;
    saveToStorage(STORAGE.CURRENT_SOURCE, currentSource);
    
    // Initialize progress if needed
    initSourceProgress(sourceName);
    
    // Update UI
    updateProgressInfo();
    
    // Load first word
    showLoading();
    setTimeout(() => {
        loadNextWord();
    }, 300);
}

async function renderSourcesList() {
    const sourcesList = document.getElementById('sourcesList');
    const sourceNames = Object.keys(sources);
    
    if (sourceNames.length === 0) {
        sourcesList.innerHTML = '<p class="empty-message">Chưa có source nào trên server</p>';
        return;
    }
    
    sourcesList.innerHTML = sourceNames.map(name => {
        const source = sources[name];
        const prog = progress[name] || { learned: [], skipped: [] };
        const percentage = Math.round((prog.learned.length / source.totalWords) * 100) || 0;
        
        return `
            <div class="source-item">
                <div class="source-item-header">
                    <h4>${name}</h4>
                    <div class="source-item-actions">
                        <button class="btn-small-icon" onclick="selectSourceAndClose('${name}')" title="Chọn">✓</button>
                        <button class="btn-small-icon btn-danger" onclick="confirmDeleteSource('${name}')" title="Xóa">🗑️</button>
                    </div>
                </div>
                <div class="source-item-info">
                    <span>📦 ${source.totalWords} từ</span>
                    <span>✓ ${prog.learned.length} đã học</span>
                    <span>⏭️ ${prog.skipped.length} bỏ qua</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="source-item-meta">
                    <span>📁 ${source.fileName}</span>
                    <span>📅 ${formatDate(source.createdAt)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ============ MODAL FUNCTIONS ============
function showLoading() {
    document.getElementById('loadingScreen').style.display = 'flex';
    document.getElementById('mainCard').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loadingScreen').style.display = 'none';
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

function showSwipeIndicator(text, type = 'success') {
    const indicator = document.getElementById('swipeIndicator');
    indicator.textContent = text;
    indicator.className = `swipe-indicator show ${type}`;
    
    setTimeout(() => {
        indicator.classList.remove('show');
    }, 1000);
}

// ============ IMPORT/EXPORT ============
function validateJSON(jsonText) {
    try {
        const data = JSON.parse(jsonText);
        
        if (!Array.isArray(data)) {
            return { valid: false, error: 'JSON phải là một array' };
        }
        
        if (data.length === 0) {
            return { valid: false, error: 'Array không được rỗng' };
        }
        
        // Validate first item
        const firstWord = data[0];
        if (!firstWord.word) {
            return { valid: false, error: 'Mỗi từ phải có trường "word"' };
        }
        
        return {
            valid: true,
            data: data,
            count: data.length
        };
    } catch (error) {
        return {
            valid: false,
            error: 'JSON không hợp lệ: ' + error.message
        };
    }
}

function showImportStatus(message, type = 'info') {
    const statusDiv = document.getElementById('importStatus');
    statusDiv.className = `import-status ${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
}

function hideImportStatus() {
    const statusDiv = document.getElementById('importStatus');
    statusDiv.style.display = 'none';
}

// ============ AUDIO ============
function playAudio() {
    if (!currentWord) return;
    
    if (currentWord.audioURL) {
        const audio = new Audio(currentWord.audioURL);
        audio.play().catch(() => speakWord());
    } else {
        speakWord();
    }
}

function speakWord() {
    if (!currentWord || !('speechSynthesis' in window)) return;
    
    const utterance = new SpeechSynthesisUtterance(currentWord.word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
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
    
    card.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
        card.style.transition = 'none';
    });
    
    card.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        card.style.transform = `translateX(${diff}px) rotate(${diff * 0.05}deg)`;
    });
    
    card.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        
        const diff = currentX - startX;
        card.style.transition = 'transform 0.3s ease';
        
        if (diff < -100) {
            // Swiped left - learned
            card.style.transform = 'translateX(-500px) rotate(-20deg)';
            setTimeout(() => {
                card.style.transform = '';
                if (currentWord) {
                    markWordAsLearned(currentWord);
                    showSwipeIndicator('✓ Đã học', 'success');
                    loadNextWord();
                }
            }, 300);
        } else if (diff > 100) {
            // Swiped right - skip
            card.style.transform = 'translateX(500px) rotate(20deg)';
            setTimeout(() => {
                card.style.transform = '';
                if (currentWord) {
                    markWordAsSkipped(currentWord);
                    showSwipeIndicator('⏭️ Bỏ qua', 'warning');
                    loadNextWord();
                }
            }, 300);
        } else {
            card.style.transform = '';
        }
    });
}

// ============ HISTORY ============
function renderHistory() {
    const filterSelect = document.getElementById('historySourceFilter');
    const statsDiv = document.getElementById('historyStats');
    const learnedList = document.getElementById('learnedList');
    const skippedList = document.getElementById('skippedList');
    
    // Update filter options
    filterSelect.innerHTML = '<option value="">Tất cả sources</option>';
    Object.keys(sources).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        filterSelect.appendChild(option);
    });
    
    const filterValue = filterSelect.value;
    const sourcesToShow = filterValue ? [filterValue] : Object.keys(sources);
    
    // Calculate stats
    let totalLearned = 0;
    let totalSkipped = 0;
    let totalWords = 0;
    
    sourcesToShow.forEach(name => {
        if (progress[name] && sources[name]) {
            totalLearned += progress[name].learned.length;
            totalSkipped += progress[name].skipped.length;
            totalWords += sources[name].totalWords;
        }
    });
    
    const percentage = totalWords > 0 ? Math.round((totalLearned / totalWords) * 100) : 0;
    
    statsDiv.innerHTML = `
        <div class="stat-item">
            <div class="stat-value">${totalLearned}</div>
            <div class="stat-label">Đã học</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${totalSkipped}</div>
            <div class="stat-label">Bỏ qua</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${percentage}%</div>
            <div class="stat-label">Hoàn thành</div>
        </div>
    `;
    
    // Render learned list
    const learnedWords = [];
    const skippedWords = [];
    
    sourcesToShow.forEach(name => {
        if (progress[name] && sources[name]) {
            progress[name].learned.forEach(word => {
                const wordData = sources[name].words.find(w => w.word.toLowerCase() === word.toLowerCase());
                if (wordData) {
                    learnedWords.push({ ...wordData, sourceName: name });
                }
            });
            
            progress[name].skipped.forEach(word => {
                const wordData = sources[name].words.find(w => w.word.toLowerCase() === word.toLowerCase());
                if (wordData) {
                    skippedWords.push({ ...wordData, sourceName: name });
                }
            });
        }
    });
    
    learnedList.innerHTML = learnedWords.length > 0 
        ? learnedWords.map(word => `
            <div class="history-word-item">
                <div class="history-word-header">
                    <strong>${word.word}</strong>
                    <span class="history-source-tag">${word.sourceName}</span>
                </div>
                <div class="history-word-meaning">${word.translateVN}</div>
            </div>
        `).join('')
        : '<p class="empty-message">Chưa có từ nào được học</p>';
    
    skippedList.innerHTML = skippedWords.length > 0
        ? skippedWords.map(word => `
            <div class="history-word-item">
                <div class="history-word-header">
                    <strong>${word.word}</strong>
                    <span class="history-source-tag">${word.sourceName}</span>
                </div>
                <div class="history-word-meaning">${word.translateVN}</div>
            </div>
        `).join('')
        : '<p class="empty-message">Chưa có từ nào bị bỏ qua</p>';
}

// ============ GLOBAL FUNCTIONS (for onclick) ============
window.selectSourceAndClose = async function(name) {
    closeModal('sourcesModal');
    await selectSource(name);
};

window.confirmDeleteSource = async function(name) {
    if (confirm(`Bạn có chắc muốn xóa source "${name}"?`)) {
        showLoadingText('Đang xóa source...');
        const success = await deleteSource(name);
        
        if (success) {
            showSwipeIndicator('✓ Đã xóa source', 'success');
            await renderSourcesList();
            updateSourceSelector();
            
            // If deleted current source, reset
            if (currentSource === name) {
                currentSource = '';
                saveToStorage(STORAGE.CURRENT_SOURCE, '');
                document.getElementById('mainCard').style.display = 'none';
                hideLoading();
            }
        } else {
            showSwipeIndicator('✗ Không thể xóa source', 'error');
        }
    }
};

// ============ INITIALIZATION ============
async function init() {
    console.log('🚀 Initializing Vocab Swipe (Server Version)...');
    
    // Show loading
    showLoading();
    showLoadingText('Đang kết nối server...');
    
    // Load data from server
    await loadSources();
    
    // Load progress from localStorage
    loadProgress();
    currentSource = loadFromStorage(STORAGE.CURRENT_SOURCE, '');
    
    // Update UI
    updateSourceSelector();
    
    // Check if we have sources and current source
    if (Object.keys(sources).length === 0) {
        // No sources on server
        hideLoading();
        document.getElementById('mainCard').style.display = 'none';
        const emptyState = document.getElementById('emptyState');
        emptyState.style.display = 'flex';
        emptyState.innerHTML = `
            <div class="empty-icon">📚</div>
            <h2>Chưa có bộ từ vựng trên server</h2>
            <p>Hãy thêm file JSON vào folder <code>sources/</code> trên server và reload lại trang!</p>
            <button id="reloadBtn" class="btn-primary">🔄 Reload</button>
            <button id="openImportBtn2" class="btn-secondary" style="margin-top: 12px;">📥 Hoặc import thủ công</button>
        `;
        
        document.getElementById('reloadBtn')?.addEventListener('click', () => {
            window.location.reload();
        });
        
        document.getElementById('openImportBtn2')?.addEventListener('click', () => {
            hideImportStatus();
            openModal('importModal');
        });
    } else if (currentSource && sources[currentSource]) {
        // Have current source - load it
        initSourceProgress(currentSource);
        updateProgressInfo();
        loadNextWord();
    } else {
        // Have sources but no current source selected
        hideLoading();
        document.getElementById('mainCard').style.display = 'none';
        const emptyState = document.getElementById('emptyState');
        emptyState.style.display = 'flex';
        emptyState.innerHTML = `
            <div class="empty-icon">📚</div>
            <h2>Chọn bộ từ vựng để bắt đầu</h2>
            <p>Tìm thấy ${Object.keys(sources).length} bộ từ vựng trên server</p>
            <button id="openSourcesBtn" class="btn-primary">📁 Chọn bộ từ vựng</button>
        `;
        
        document.getElementById('openSourcesBtn')?.addEventListener('click', () => {
            renderSourcesList();
            openModal('sourcesModal');
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
    
    document.getElementById('refreshSourceBtn').addEventListener('click', async () => {
        showLoading();
        showLoadingText('Đang reload sources từ server...');
        await loadSources();
        updateSourceSelector();
        
        if (currentSource && sources[currentSource]) {
            loadNextWord();
        } else {
            hideLoading();
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
    
    document.getElementById('importJsonBtn').addEventListener('click', async () => {
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
        
        const result = validateJSON(jsonText);
        
        if (!result.valid) {
            showImportStatus(`✗ Lỗi: ${result.error}`, 'error');
            return;
        }
        
        // Check if source exists
        if (sources[sourceName]) {
            if (!confirm(`Source "${sourceName}" đã tồn tại. Ghi đè?`)) {
                return;
            }
        }
        
        // Save to server
        showImportStatus('Đang lưu lên server...', 'info');
        
        const fileName = await saveSourceToServer(sourceName, result.data);
        
        if (fileName) {
            showImportStatus(`✓ Đã lưu "${sourceName}" lên server với ${result.count} từ vựng!`, 'success');
            
            // Reload sources from server
            await loadSources();
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
            showImportStatus('✗ Không thể lưu source lên server!', 'error');
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
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
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
    
    console.log('✅ Initialization complete!');
}

// Start app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
