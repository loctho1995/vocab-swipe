/**
 * Vocab Swipe Mobile Optimized
 * - Random learning (no progress tracking)
 * - Learned words management
 * - Compact UI for mobile
 */

// ============ CONFIG ============
const API_BASE = window.location.origin;
const API_ENDPOINTS = {
    SOURCES: `${API_BASE}/api/sources`,
    SOURCE_DETAIL: (fileName) => `${API_BASE}/api/sources/${fileName}`,
    DELETE_SOURCE: (fileName) => `${API_BASE}/api/sources/${fileName}`
};

const STORAGE = {
    LEARNED: 'vocab_learned_v3', // { sourceName: [word1, word2, ...] }
    CURRENT_SOURCE: 'vocab_current_source_v3'
};

// ============ STATE ============
let sources = {}; // { sourceName: { words: [], fileName: string } }
let learnedWords = {}; // { sourceName: [word1, word2, ...] }
let currentSourceName = '';
let currentWord = null;
let currentEditingSource = ''; // Source đang được edit

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

// ============ WORD SELECTION - RANDOM WITHOUT LEARNED ============
function getRandomWord() {
    if (!currentSourceName || !sources[currentSourceName]) {
        return null;
    }
    
    const allWords = sources[currentSourceName].words;
    const learned = learnedWords[currentSourceName] || [];
    
    // Filter out learned words
    const availableWords = allWords.filter(word => {
        const wordKey = word.word.toLowerCase();
        return !learned.some(w => w.toLowerCase() === wordKey);
    });
    
    // If all words learned, reset
    if (availableWords.length === 0 && allWords.length > 0) {
        return null; // Show completion screen
    }
    
    if (availableWords.length === 0) {
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
    
    text.textContent = `Bạn đã học xong ${getTotalWords(currentSourceName)} từ trong bộ "${currentSourceName}"!`;
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
    renderChips('formsSection', 'formsChips', word.forms);
    
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

function updateSourceButton() {
    const label = document.getElementById('sourceLabel');
    
    if (currentSourceName) {
        const learned = getLearnedCount(currentSourceName);
        const total = getTotalWords(currentSourceName);
        label.textContent = `${currentSourceName} (${learned}/${total})`;
    } else {
        label.textContent = 'Chọn bộ từ...';
    }
}

// ============ LOADING/MODAL HELPERS ============
function showLoading() {
    document.getElementById('loadingScreen').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingScreen').style.display = 'none';
}

function showLoadingText(text) {
    document.getElementById('loadingText').textContent = text;
    showLoading();
}

function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// ============ AUDIO ============
function playAudio() {
    if (!currentWord) return;
    
    const word = currentWord.word;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
}

// ============ SWIPE GESTURES ============
function setupSwipeGestures() {
    const card = document.getElementById('swipeCard');
    const indicator = document.getElementById('swipeIndicator');
    
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    
    // Detect if target is interactive element
    function isInteractiveElement(target) {
        return target.tagName === 'BUTTON' || 
               target.tagName === 'A' ||
               target.closest('button') ||
               target.closest('a');
    }
    
    card.addEventListener('touchstart', (e) => {
        if (isInteractiveElement(e.target)) return;
        
        startX = e.touches[0].clientX;
        isDragging = true;
    }, { passive: true });
    
    card.addEventListener('touchmove', (e) => {
        if (!isDragging || isInteractiveElement(e.target)) return;
        
        currentX = e.touches[0].clientX;
        const diffX = currentX - startX;
        
        // Only allow left swipe
        if (diffX < 0) {
            card.style.transform = `translateX(${diffX}px) rotate(${diffX / 20}deg)`;
        }
    }, { passive: true });
    
    card.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        
        isDragging = false;
        const diffX = currentX - startX;
        
        // Left swipe - Mark as learned
        if (diffX < -80) {
            card.style.transform = 'translateX(-500px) rotate(-30deg)';
            
            indicator.textContent = '✓ Đã học';
            indicator.classList.add('show');
            
            markWordAsLearned(currentSourceName, currentWord);
            
            setTimeout(() => {
                card.style.transform = '';
                indicator.classList.remove('show');
                loadNextWord();
            }, 300);
        } else {
            // Reset
            card.style.transform = '';
        }
        
        startX = 0;
        currentX = 0;
    }, { passive: true });
}

// ============ HEADER ACTIONS ============
document.getElementById('menuBtn').addEventListener('click', () => {
    showModal('menuModal');
});

document.getElementById('closeMenuBtn').addEventListener('click', () => {
    hideModal('menuModal');
});

document.getElementById('sourceBtn').addEventListener('click', () => {
    showModal('sourceModal');
    renderSourceSelection();
});

document.getElementById('closeSourceBtn').addEventListener('click', () => {
    hideModal('sourceModal');
});

document.getElementById('learnedBtn').addEventListener('click', () => {
    showModal('learnedModal');
    updateLearnedFilter();
    renderLearnedList();
});

document.getElementById('closeLearnedBtn').addEventListener('click', () => {
    hideModal('learnedModal');
});

// ============ SOURCE SELECTION ============
function renderSourceSelection() {
    const list = document.getElementById('sourceList');
    const sourceNames = Object.keys(sources);
    
    if (sourceNames.length === 0) {
        list.innerHTML = '<p class="empty-message">Chưa có source nào</p>';
        return;
    }
    
    list.innerHTML = sourceNames.map(name => {
        const learned = getLearnedCount(name);
        const total = getTotalWords(name);
        const isActive = name === currentSourceName;
        
        return `
            <div class="source-item ${isActive ? 'active' : ''}" data-source="${name}">
                <div class="source-name-info">
                    <div class="source-name">${name}</div>
                    <div class="source-stats">${learned}/${total} từ đã học</div>
                </div>
                ${isActive ? '<span class="source-check">✓</span>' : ''}
            </div>
        `;
    }).join('');
    
    // Add event listeners
    list.querySelectorAll('.source-item').forEach(item => {
        item.addEventListener('click', () => {
            const sourceName = item.dataset.source;
            currentSourceName = sourceName;
            saveToStorage(STORAGE.CURRENT_SOURCE, currentSourceName);
            initLearnedForSource(currentSourceName);
            updateSourceButton();
            hideModal('sourceModal');
            loadNextWord();
        });
    });
}

// ============ MENU ACTIONS ============
document.getElementById('manageSourcesBtn').addEventListener('click', () => {
    hideModal('menuModal');
    showModal('sourcesModal');
    renderSourcesList();
});

document.getElementById('importBtn').addEventListener('click', () => {
    hideModal('menuModal');
    showModal('importModal');
});

document.getElementById('viewLearnedBtn').addEventListener('click', () => {
    hideModal('menuModal');
    showModal('learnedModal');
    updateLearnedFilter();
    renderLearnedList();
});

document.getElementById('homeBtn').addEventListener('click', () => {
    window.location.href = 'index.html';
});

// ============ LEARNED WORDS LIST ============
function updateLearnedFilter() {
    const filter = document.getElementById('learnedSourceFilter');
    const sourceNames = Object.keys(sources);
    
    filter.innerHTML = '<option value="">Tất cả sources</option>' +
        sourceNames.map(name => `<option value="${name}">${name}</option>`).join('');
}

function renderLearnedList(filterSource = '') {
    const list = document.getElementById('learnedList');
    
    // Collect all learned words
    let allLearned = [];
    
    Object.keys(learnedWords).forEach(sourceName => {
        const words = learnedWords[sourceName] || [];
        words.forEach(word => {
            allLearned.push({ word, source: sourceName });
        });
    });
    
    // Filter if needed
    if (filterSource) {
        allLearned = allLearned.filter(item => item.source === filterSource);
    }
    
    if (allLearned.length === 0) {
        list.innerHTML = '<p class="empty-message">Chưa có từ nào được đánh dấu đã học</p>';
        return;
    }
    
    list.innerHTML = allLearned.map(item => `
        <div class="learned-item">
            <div class="learned-word-info">
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
                
                // Update button if current source
                if (source === currentSourceName) {
                    updateSourceButton();
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
                    <button class="btn-small" style="background: #f59e0b; color: white;" data-edit="${name}">✏️ Sửa</button>
                    <button class="btn-small btn-delete" data-file="${source.fileName}">Xóa</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners
    list.querySelectorAll('.btn-select').forEach(btn => {
        btn.addEventListener('click', () => {
            const sourceName = btn.dataset.source;
            currentSourceName = sourceName;
            saveToStorage(STORAGE.CURRENT_SOURCE, currentSourceName);
            initLearnedForSource(currentSourceName);
            updateSourceButton();
            hideModal('sourcesModal');
            loadNextWord();
        });
    });
    
    // Edit button
    list.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
            const sourceName = btn.dataset.edit;
            openEditSourceModal(sourceName);
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
                    if (currentSourceName === sourceName) {
                        currentSourceName = '';
                    }
                    renderSourcesList();
                    updateSourceButton();
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
            updateSourceButton();
            
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
document.getElementById('markLearnedBtn').addEventListener('click', () => {
    if (!currentWord) return;
    
    markWordAsLearned(currentSourceName, currentWord);
    
    const indicator = document.getElementById('swipeIndicator');
    indicator.textContent = '✓ Đã học';
    indicator.classList.add('show');
    
    setTimeout(() => {
        indicator.classList.remove('show');
        loadNextWord();
    }, 500);
});

document.getElementById('aiBtn').addEventListener('click', () => {
    if (!currentWord) return;
    
    const word = currentWord.word;
    const url = `https://chatgpt.com/?q=${encodeURIComponent(`Về từ "${word}" \n1. Giải thích ý nghĩa chi tiết bằng tiếng Việt \n2. Hướng dẫn cách phát âm (phiên âm và mẹo phát âm) \n3. 5 đoạn hội thoại phổ biến sử dụng từ này (ngắn gọn, thực tế) \n4. Các cụm từ và collocations thường gặp`)}`;
    window.open(url, '_blank');
});

document.getElementById('audioBtn').addEventListener('click', playAudio);

document.getElementById('resetBtn').addEventListener('click', () => {
    if (!currentSourceName) return;
    
    if (confirm(`Xóa tất cả từ đã học trong "${currentSourceName}" và học lại?`)) {
        learnedWords[currentSourceName] = [];
        saveLearned();
        document.getElementById('completionState').style.display = 'none';
        loadNextWord();
    }
});

// ============ EDIT SOURCE FUNCTIONS ============
function openEditSourceModal(sourceName) {
    currentEditingSource = sourceName;
    const source = sources[sourceName];
    
    if (!source) return;
    
    // Update header
    document.getElementById('editSourceName').textContent = sourceName;
    document.getElementById('editSourceCount').textContent = `${source.totalWords} từ`;
    
    // Clear forms
    document.getElementById('newWord').value = '';
    document.getElementById('newWordType').value = '';
    document.getElementById('newPronounce').value = '';
    document.getElementById('newMeaning').value = '';
    document.getElementById('newTranslateVN').value = '';
    document.getElementById('bulkJsonInput').value = '';
    document.getElementById('bulkImportStatus').textContent = '';
    
    // Reset to manual tab
    document.querySelectorAll('.edit-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.edit-tab-content').forEach(content => content.classList.remove('active'));
    document.querySelector('[data-tab="manual"]').classList.add('active');
    document.getElementById('manualTab').classList.add('active');
    
    // Render words list
    renderEditWordsList();
    
    // Show modal
    hideModal('sourcesModal');
    showModal('editSourceModal');
}

function renderEditWordsList() {
    const list = document.getElementById('editWordsList');
    const source = sources[currentEditingSource];
    
    if (!source || !source.words || source.words.length === 0) {
        list.innerHTML = '<p class="empty-message">Chưa có từ nào</p>';
        return;
    }
    
    list.innerHTML = source.words.map((word, index) => `
        <div class="edit-word-item">
            <div class="edit-word-header">
                <div class="edit-word-title">
                    <div class="edit-word-name">${word.word}</div>
                    <span class="edit-word-type">${word.wordType}</span>
                </div>
                <button class="btn-delete-word" data-index="${index}">🗑️</button>
            </div>
            <div class="edit-word-content">
                <div class="edit-word-meaning">${word.meaning || '—'}</div>
                <div class="edit-word-translation">🇻🇳 ${word.translateVN || '—'}</div>
            </div>
        </div>
    `).join('');
    
    // Add delete handlers
    list.querySelectorAll('.btn-delete-word').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            deleteWordFromSource(index);
        });
    });
}

async function deleteWordFromSource(index) {
    const source = sources[currentEditingSource];
    const word = source.words[index];
    
    if (!confirm(`Xóa từ "${word.word}" khỏi source?`)) return;
    
    // Remove word
    source.words.splice(index, 1);
    source.totalWords = source.words.length;
    
    // Save to server
    const success = await saveSourceToServer(currentEditingSource, source.words);
    
    if (success) {
        // Update count
        document.getElementById('editSourceCount').textContent = `${source.totalWords} từ`;
        renderEditWordsList();
    } else {
        alert('Xóa thất bại!');
    }
}

async function addWordToSource() {
    const word = document.getElementById('newWord').value.trim();
    const wordType = document.getElementById('newWordType').value.trim();
    const pronounce = document.getElementById('newPronounce').value.trim();
    const meaning = document.getElementById('newMeaning').value.trim();
    const translateVN = document.getElementById('newTranslateVN').value.trim();
    
    // Validate
    if (!word || !wordType || !meaning || !translateVN) {
        alert('Vui lòng điền đầy đủ các trường bắt buộc (*)');
        return;
    }
    
    const source = sources[currentEditingSource];
    
    // Create new word object
    const newWord = {
        word: word,
        wordType: wordType,
        pronounce: pronounce,
        meaning: meaning,
        translateVN: translateVN,
        synonyms: [],
        antonyms: [],
        forms: [],
        notes: ''
    };
    
    // Add to source
    source.words.push(newWord);
    source.totalWords = source.words.length;
    
    // Save to server
    const success = await saveSourceToServer(currentEditingSource, source.words);
    
    if (success) {
        // Clear form
        document.getElementById('newWord').value = '';
        document.getElementById('newWordType').value = '';
        document.getElementById('newPronounce').value = '';
        document.getElementById('newMeaning').value = '';
        document.getElementById('newTranslateVN').value = '';
        
        // Update count
        document.getElementById('editSourceCount').textContent = `${source.totalWords} từ`;
        
        // Refresh list
        renderEditWordsList();
        
        alert('✓ Đã thêm từ mới!');
    } else {
        alert('Thêm từ thất bại!');
    }
}

// Bulk import JSON
function validateBulkJson() {
    const jsonInput = document.getElementById('bulkJsonInput').value.trim();
    const status = document.getElementById('bulkImportStatus');
    
    if (!jsonInput) {
        status.className = 'import-status error';
        status.textContent = '⚠️ Vui lòng nhập JSON';
        return false;
    }
    
    try {
        let data = JSON.parse(jsonInput);
        let words = [];
        
        // Nếu là object đơn, chuyển thành array
        if (!Array.isArray(data)) {
            if (typeof data === 'object' && data !== null) {
                words = [data];
            } else {
                throw new Error('JSON phải là object hoặc array');
            }
        } else {
            words = data;
        }
        
        if (words.length === 0) {
            throw new Error('Không có từ nào để thêm');
        }
        
        // Validate structure
        const requiredFields = ['word', 'wordType', 'meaning', 'translateVN'];
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            for (const field of requiredFields) {
                if (!word[field]) {
                    throw new Error(`Từ thứ ${i + 1}: Thiếu field bắt buộc "${field}"`);
                }
            }
        }
        
        status.className = 'import-status success';
        status.textContent = `✓ Hợp lệ! ${words.length} từ`;
        return true;
    } catch (error) {
        status.className = 'import-status error';
        status.textContent = `⚠️ Lỗi: ${error.message}`;
        return false;
    }
}

async function importBulkJson() {
    const jsonInput = document.getElementById('bulkJsonInput').value.trim();
    const status = document.getElementById('bulkImportStatus');
    
    if (!validateBulkJson()) return;
    
    try {
        let data = JSON.parse(jsonInput);
        let words = [];
        
        // Nếu là object đơn, chuyển thành array
        if (!Array.isArray(data)) {
            words = [data];
        } else {
            words = data;
        }
        
        const source = sources[currentEditingSource];
        
        // Add all words to source
        words.forEach(word => {
            const newWord = {
                word: word.word,
                wordType: word.wordType,
                pronounce: word.pronounce || '',
                meaning: word.meaning,
                translateVN: word.translateVN,
                synonyms: word.synonyms || [],
                antonyms: word.antonyms || [],
                forms: word.forms || [],
                notes: word.notes || ''
            };
            source.words.push(newWord);
        });
        
        source.totalWords = source.words.length;
        
        // Save to server
        const success = await saveSourceToServer(currentEditingSource, source.words);
        
        if (success) {
            status.className = 'import-status success';
            status.textContent = `✓ Đã thêm ${words.length} từ!`;
            
            // Update count
            document.getElementById('editSourceCount').textContent = `${source.totalWords} từ`;
            
            // Clear form
            document.getElementById('bulkJsonInput').value = '';
            
            // Refresh list
            renderEditWordsList();
            
            setTimeout(() => {
                status.textContent = '';
            }, 3000);
        } else {
            throw new Error('Lưu thất bại');
        }
    } catch (error) {
        status.className = 'import-status error';
        status.textContent = `⚠️ Lỗi: ${error.message}`;
    }
}

// ============ EDIT SOURCE EVENT LISTENERS ============
document.getElementById('closeEditSourceBtn').addEventListener('click', () => {
    hideModal('editSourceModal');
    showModal('sourcesModal');
    renderSourcesList();
});

document.getElementById('addWordBtn').addEventListener('click', addWordToSource);

document.getElementById('validateBulkBtn').addEventListener('click', validateBulkJson);

document.getElementById('importBulkBtn').addEventListener('click', importBulkJson);

// Tab switching
document.querySelectorAll('.edit-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        
        // Update tabs
        document.querySelectorAll('.edit-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // Update content
        document.querySelectorAll('.edit-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        if (tabName === 'manual') {
            document.getElementById('manualTab').classList.add('active');
        } else if (tabName === 'json') {
            document.getElementById('jsonTab').classList.add('active');
        }
    });
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
    currentSourceName = loadFromStorage(STORAGE.CURRENT_SOURCE, '');
    if (!sources[currentSourceName]) {
        currentSourceName = Object.keys(sources)[0];
    }
    
    saveToStorage(STORAGE.CURRENT_SOURCE, currentSourceName);
    initLearnedForSource(currentSourceName);
    
    updateSourceButton();
    setupSwipeGestures();
    loadNextWord();
}

// Start app
init();
