/**
 * Vocab Swipe Mobile - Random Learning with Learned Words Management
 */

// ============ CONFIG ============
const API_BASE = window.location.origin;
const API_ENDPOINTS = {
    SOURCES: `${API_BASE}/api/sources`,
    SOURCE_DETAIL: (fileName) => `${API_BASE}/api/sources/${fileName}`,
    DELETE_SOURCE: (fileName) => `${API_BASE}/api/sources/${fileName}`
};

const STORAGE = {
    LEARNED: 'vocab_learned_v2', // { sourceName: [word1, word2, ...] }
    CURRENT_SOURCE: 'vocab_current_source_v2'
};

// ============ STATE ============
let sources = {}; // { sourceName: { words: [], fileName: string } }
let learnedWords = {}; // { sourceName: [word1, word2, ...] }
let currentSource = '';
let currentWord = null;
let availableWords = []; // Words không có trong learned list

// ============ STORAGE UTILS ============
function saveToStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error('Save error:', error);
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

function saveLearned() {
    saveToStorage(STORAGE.LEARNED, learnedWords);
}

function loadLearned() {
    learnedWords = loadFromStorage(STORAGE.LEARNED, {});
}

// ============ API FUNCTIONS ============
async function fetchSourcesFromServer() {
    try {
        showLoadingText('Đang tải sources...');
        const response = await fetch(API_ENDPOINTS.SOURCES);
        
        if (!response.ok) throw new Error('Failed to fetch sources');
        
        const data = await response.json();
        
        if (data.success && data.sources) {
            sources = {};
            data.sources.forEach(source => {
                sources[source.name] = {
                    words: source.words,
                    fileName: source.fileName,
                    totalWords: source.totalWords
                };
            });
            
            console.log(`✓ Loaded ${data.count} sources`);
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, words })
        });
        
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('Error saving source:', error);
        return false;
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

// ============ LEARNED WORDS MANAGEMENT ============
function initLearnedForSource(sourceName) {
    if (!learnedWords[sourceName]) {
        learnedWords[sourceName] = [];
        saveLearned();
    }
}

function markWordAsLearned(sourceName, word) {
    initLearnedForSource(sourceName);
    
    const wordKey = word.word.toLowerCase();
    const learned = learnedWords[sourceName];
    
    if (!learned.some(w => w.toLowerCase() === wordKey)) {
        learned.push(word.word);
        saveLearned();
    }
}

function unmarkWordAsLearned(sourceName, word) {
    if (!learnedWords[sourceName]) return;
    
    const wordKey = word.toLowerCase();
    learnedWords[sourceName] = learnedWords[sourceName].filter(
        w => w.toLowerCase() !== wordKey
    );
    saveLearned();
}

function isWordLearned(sourceName, word) {
    if (!learnedWords[sourceName]) return false;
    
    const wordKey = word.toLowerCase();
    return learnedWords[sourceName].some(w => w.toLowerCase() === wordKey);
}

function getLearnedCount(sourceName) {
    return learnedWords[sourceName] ? learnedWords[sourceName].length : 0;
}

function getTotalWords(sourceName) {
    return sources[sourceName] ? sources[sourceName].totalWords : 0;
}

// ============ WORD SELECTION ============
function updateAvailableWords() {
    if (!currentSource || !sources[currentSource]) {
        availableWords = [];
        return;
    }
    
    const allWords = sources[currentSource].words;
    const learned = learnedWords[currentSource] || [];
    
    // Filter out learned words
    availableWords = allWords.filter(word => {
        const wordKey = word.word.toLowerCase();
        return !learned.some(w => w.toLowerCase() === wordKey);
    });
}

function getRandomWord() {
    updateAvailableWords();
    
    // If no available words, check if we need to reset
    if (availableWords.length === 0) {
        const totalWords = getTotalWords(currentSource);
        if (totalWords > 0) {
            // All words learned, offer to reset
            return null;
        }
        return null;
    }
    
    // Pick random word
    const randomIndex = Math.floor(Math.random() * availableWords.length);
    return availableWords[randomIndex];
}

function loadNextWord() {
    const word = getRandomWord();
    
    if (!word) {
        showCompletionScreen();
        return;
    }
    
    currentWord = word;
    renderWord(word);
}

function showCompletionScreen() {
    hideLoading();
    document.getElementById('mainCard').style.display = 'none';
    
    const completion = document.getElementById('completionState');
    const text = document.getElementById('completionText');
    
    text.textContent = `Bạn đã học xong ${getTotalWords(currentSource)} từ trong bộ "${currentSource}"!`;
    completion.style.display = 'flex';
}

// ============ UI RENDERING ============
function renderWord(word) {
    document.getElementById('mainCard').style.display = 'flex';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('completionState').style.display = 'none';
    document.getElementById('loadingScreen').style.display = 'none';
    
    // Word & Type
    document.getElementById('wordText').textContent = word.word;
    document.getElementById('wordType').textContent = word.wordType || '—';
    document.getElementById('phonetic').textContent = word.pronounce || '';
    
    // Translation
    document.getElementById('translationText').textContent = word.translateVN || '—';
    
    // Meaning
    document.getElementById('definitionText').textContent = word.meaning || '—';
    
    // Word Forms
    renderChips('wordForms', 'wordFormsChips', word.forms);
    
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
    
    select.innerHTML = '<option value="">Chọn bộ từ...</option>';
    
    sourceNames.forEach(name => {
        const option = document.createElement('option');
        const learned = getLearnedCount(name);
        const total = getTotalWords(name);
        option.value = name;
        option.textContent = `${name} (${learned}/${total})`;
        select.appendChild(option);
    });
    
    if (currentSource && sources[currentSource]) {
        select.value = currentSource;
    }
}

function showLoading() {
    document.getElementById('loadingScreen').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingScreen').style.display = 'none';
}

function showLoadingText(text) {
    document.getElementById('loadingText').textContent = text;
}

// ============ SWIPE GESTURES ============
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

function handleSwipe() {
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    
    // Check if horizontal swipe (ignore if vertical)
    if (Math.abs(diffX) < 80 || Math.abs(diffY) > Math.abs(diffX)) return;
    
    const card = document.getElementById('swipeCard');
    const indicator = document.getElementById('swipeIndicator');
    
    if (diffX < 0) {
        // Swipe left = Learned
        card.style.transform = 'translateX(-100%)';
        indicator.textContent = '✓ Đã học';
        indicator.classList.add('show');
        
        setTimeout(() => {
            markWordAsLearned(currentSource, currentWord);
            card.style.transform = '';
            indicator.classList.remove('show');
            loadNextWord();
        }, 300);
    }
}

function setupSwipeGestures() {
    const card = document.getElementById('swipeCard');
    
    card.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    });
    
    card.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    });
}

// ============ AUDIO ============
function playAudio() {
    if (!currentWord) return;
    
    const text = currentWord.word;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

// ============ MODALS ============
function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// ============ MENU HANDLERS ============
document.getElementById('menuBtn').addEventListener('click', () => {
    showModal('menuModal');
});

document.getElementById('closeMenuBtn').addEventListener('click', () => {
    hideModal('menuModal');
});

document.getElementById('menuImport').addEventListener('click', () => {
    hideModal('menuModal');
    showModal('importModal');
});

document.getElementById('menuSources').addEventListener('click', () => {
    hideModal('menuModal');
    renderSourcesList();
    showModal('sourcesModal');
});

document.getElementById('menuLearned').addEventListener('click', () => {
    hideModal('menuModal');
    renderLearnedList();
    showModal('learnedModal');
});

document.getElementById('menuHome').addEventListener('click', () => {
    window.location.href = 'index.html';
});

// ============ LEARNED WORDS MODAL ============
document.getElementById('learnedMenuBtn').addEventListener('click', () => {
    renderLearnedList();
    showModal('learnedModal');
});

document.getElementById('closeLearnedBtn').addEventListener('click', () => {
    hideModal('learnedModal');
});

function renderLearnedList(filterSource = '') {
    const list = document.getElementById('learnedList');
    const filter = document.getElementById('learnedSourceFilter');
    const count = document.getElementById('learnedCount');
    
    // Update filter dropdown
    filter.innerHTML = '<option value="">Tất cả sources</option>';
    Object.keys(sources).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        filter.appendChild(option);
    });
    
    if (filterSource) {
        filter.value = filterSource;
    }
    
    // Get all learned words
    let allLearned = [];
    Object.keys(learnedWords).forEach(sourceName => {
        if (!filterSource || filterSource === sourceName) {
            learnedWords[sourceName].forEach(word => {
                allLearned.push({ word, source: sourceName });
            });
        }
    });
    
    count.textContent = allLearned.length;
    
    if (allLearned.length === 0) {
        list.innerHTML = '<p class="empty-message">Chưa có từ nào được đánh dấu đã học</p>';
        return;
    }
    
    list.innerHTML = allLearned.map(item => `
        <div class="learned-item">
            <div>
                <div class="learned-word">${item.word}</div>
                <div class="learned-source">${item.source}</div>
            </div>
            <button class="btn-unlearn" data-word="${item.word}" data-source="${item.source}">
                Xóa
            </button>
        </div>
    `).join('');
    
    // Add unlearn handlers
    list.querySelectorAll('.btn-unlearn').forEach(btn => {
        btn.addEventListener('click', () => {
            const word = btn.dataset.word;
            const source = btn.dataset.source;
            
            if (confirm(`Xóa "${word}" khỏi danh sách đã học?`)) {
                unmarkWordAsLearned(source, word);
                renderLearnedList(filterSource);
                
                // Reload if current source
                if (source === currentSource) {
                    updateAvailableWords();
                    updateSourceSelector();
                }
            }
        });
    });
}

document.getElementById('learnedSourceFilter').addEventListener('change', (e) => {
    renderLearnedList(e.target.value);
});

// ============ SOURCES MANAGEMENT ============
document.getElementById('closeSourcesBtn').addEventListener('click', () => {
    hideModal('sourcesModal');
});

function renderSourcesList() {
    const list = document.getElementById('sourcesList');
    const sourceNames = Object.keys(sources);
    
    if (sourceNames.length === 0) {
        list.innerHTML = '<p class="empty-message">Chưa có source nào</p>';
        return;
    }
    
    list.innerHTML = sourceNames.map(name => {
        const source = sources[name];
        const learned = getLearnedCount(name);
        const total = getTotalWords(name);
        
        return `
            <div class="source-card">
                <div class="source-card-header">
                    <div>
                        <div class="source-name">${name}</div>
                        <div class="source-info">${learned}/${total} từ đã học</div>
                    </div>
                </div>
                <div class="source-actions">
                    <button class="btn-small btn-select" data-source="${name}">Chọn</button>
                    <button class="btn-small btn-delete" data-file="${source.fileName}">Xóa</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners
    list.querySelectorAll('.btn-select').forEach(btn => {
        btn.addEventListener('click', () => {
            const sourceName = btn.dataset.source;
            currentSource = sourceName;
            saveToStorage(STORAGE.CURRENT_SOURCE, currentSource);
            initLearnedForSource(currentSource);
            updateSourceSelector();
            hideModal('sourcesModal');
            loadNextWord();
        });
    });
    
    list.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
            const fileName = btn.dataset.file;
            const sourceName = Object.keys(sources).find(
                name => sources[name].fileName === fileName
            );
            
            if (confirm(`Xóa source "${sourceName}"?`)) {
                const success = await deleteSourceFromServer(fileName);
                if (success) {
                    delete sources[sourceName];
                    if (currentSource === sourceName) {
                        currentSource = '';
                    }
                    renderSourcesList();
                    updateSourceSelector();
                }
            }
        });
    });
}

// ============ IMPORT ============
document.getElementById('closeImportBtn').addEventListener('click', () => {
    hideModal('importModal');
});

document.getElementById('openImportBtn').addEventListener('click', () => {
    showModal('importModal');
});

document.getElementById('validateJsonBtn').addEventListener('click', () => {
    const jsonInput = document.getElementById('wordsJsonInput').value.trim();
    const status = document.getElementById('importStatus');
    
    if (!jsonInput) {
        status.className = 'import-status error';
        status.textContent = '⚠️ Vui lòng nhập JSON';
        return;
    }
    
    try {
        const words = JSON.parse(jsonInput);
        
        if (!Array.isArray(words)) {
            throw new Error('JSON phải là một array');
        }
        
        if (words.length === 0) {
            throw new Error('Array không được rỗng');
        }
        
        // Validate structure
        const requiredFields = ['word', 'wordType', 'meaning', 'translateVN'];
        const firstWord = words[0];
        
        for (const field of requiredFields) {
            if (!firstWord[field]) {
                throw new Error(`Thiếu field bắt buộc: ${field}`);
            }
        }
        
        status.className = 'import-status success';
        status.textContent = `✓ Hợp lệ! ${words.length} từ`;
    } catch (error) {
        status.className = 'import-status error';
        status.textContent = `⚠️ Lỗi: ${error.message}`;
    }
});

document.getElementById('importJsonBtn').addEventListener('click', async () => {
    const name = document.getElementById('sourceNameInput').value.trim();
    const jsonInput = document.getElementById('wordsJsonInput').value.trim();
    const status = document.getElementById('importStatus');
    
    if (!name) {
        status.className = 'import-status error';
        status.textContent = '⚠️ Vui lòng nhập tên';
        return;
    }
    
    try {
        const words = JSON.parse(jsonInput);
        
        const success = await saveSourceToServer(name, words);
        
        if (success) {
            status.className = 'import-status success';
            status.textContent = `✓ Đã lưu "${name}"!`;
            
            // Reload sources
            await fetchSourcesFromServer();
            updateSourceSelector();
            
            // Clear form
            setTimeout(() => {
                document.getElementById('sourceNameInput').value = '';
                document.getElementById('wordsJsonInput').value = '';
                status.textContent = '';
                hideModal('importModal');
            }, 1500);
        } else {
            throw new Error('Lưu thất bại');
        }
    } catch (error) {
        status.className = 'import-status error';
        status.textContent = `⚠️ Lỗi: ${error.message}`;
    }
});

// ============ ACTIONS ============
document.getElementById('learnedBtn').addEventListener('click', () => {
    if (!currentWord) return;
    
    markWordAsLearned(currentSource, currentWord);
    
    const indicator = document.getElementById('swipeIndicator');
    indicator.textContent = '✓ Đã học';
    indicator.classList.add('show');
    
    setTimeout(() => {
        indicator.classList.remove('show');
        loadNextWord();
    }, 500);
});

document.getElementById('audioBtn').addEventListener('click', playAudio);

document.getElementById('resetBtn').addEventListener('click', () => {
    if (!currentSource) return;
    
    if (confirm(`Xóa tất cả từ đã học trong "${currentSource}" và học lại?`)) {
        learnedWords[currentSource] = [];
        saveLearned();
        document.getElementById('completionState').style.display = 'none';
        loadNextWord();
    }
});

// ============ SOURCE SELECTOR ============
document.getElementById('currentSource').addEventListener('change', (e) => {
    const sourceName = e.target.value;
    
    if (!sourceName) return;
    
    currentSource = sourceName;
    saveToStorage(STORAGE.CURRENT_SOURCE, currentSource);
    initLearnedForSource(currentSource);
    loadNextWord();
});

// ============ INIT ============
async function init() {
    showLoading();
    loadLearned();
    
    const success = await fetchSourcesFromServer();
    
    if (!success || Object.keys(sources).length === 0) {
        hideLoading();
        document.getElementById('emptyState').style.display = 'flex';
        return;
    }
    
    // Load last source or first available
    currentSource = loadFromStorage(STORAGE.CURRENT_SOURCE, '');
    if (!sources[currentSource]) {
        currentSource = Object.keys(sources)[0];
    }
    
    saveToStorage(STORAGE.CURRENT_SOURCE, currentSource);
    initLearnedForSource(currentSource);
    
    updateSourceSelector();
    setupSwipeGestures();
    loadNextWord();
}

// Start app
init();
