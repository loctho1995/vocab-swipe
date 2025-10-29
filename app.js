/**
 * Vocab Swipe - Random Mode
 * Học từ vựng ngẫu nhiên từ các API
 */

// ============ CONSTANTS ============
const API_ENDPOINTS = {
    RANDOM_WORD: 'https://random-word-api.herokuapp.com/word',
    DICTIONARY: 'https://api.dictionaryapi.dev/api/v2/entries/en/',
    TRANSLATE: 'https://api.mymemory.translated.net/get',
    DATAMUSE: 'https://api.datamuse.com/words'
};

const STORAGE_KEY = 'vocab_history_v1';

// Common English words for suggestions
const COMMON_WORDS = [
    'happy', 'beautiful', 'important', 'different', 'interesting',
    'necessary', 'available', 'possible', 'popular', 'natural',
    'special', 'simple', 'difficult', 'excellent', 'amazing'
];

// ============ STATE ============
let currentWord = null;
let viewedWords = [];
let isLoading = false;

// ============ UTILITY FUNCTIONS ============
function saveHistory() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(viewedWords));
    } catch (error) {
        console.error('Error saving history:', error);
    }
}

function loadHistory() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        viewedWords = data ? JSON.parse(data) : [];
        return viewedWords;
    } catch (error) {
        console.error('Error loading history:', error);
        return [];
    }
}

function addToHistory(word) {
    // Check if word already exists (case insensitive)
    const exists = viewedWords.some(w => w.word.toLowerCase() === word.word.toLowerCase());
    
    if (!exists) {
        viewedWords.unshift({
            ...word,
            viewedAt: Date.now()
        });
        
        // Keep only last 100 words
        if (viewedWords.length > 100) {
            viewedWords = viewedWords.slice(0, 100);
        }
        
        saveHistory();
    }
}

function clearHistory() {
    if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử?')) {
        viewedWords = [];
        saveHistory();
        renderHistory();
        showToast('Đã xóa lịch sử');
    }
}

// ============ API FUNCTIONS ============
async function getRandomWord() {
    try {
        const response = await fetch(API_ENDPOINTS.RANDOM_WORD);
        if (!response.ok) throw new Error('Failed to fetch random word');
        const words = await response.json();
        return words[0];
    } catch (error) {
        console.error('Error getting random word:', error);
        // Fallback to common words
        return COMMON_WORDS[Math.floor(Math.random() * COMMON_WORDS.length)];
    }
}

async function getWordDefinition(word) {
    try {
        const response = await fetch(API_ENDPOINTS.DICTIONARY + word);
        if (!response.ok) throw new Error('Word not found');
        const data = await response.json();
        return data[0];
    } catch (error) {
        console.error('Error getting definition:', error);
        return null;
    }
}

async function translateWord(word) {
    try {
        const url = `${API_ENDPOINTS.TRANSLATE}?q=${encodeURIComponent(word)}&langpair=en|vi`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Translation failed');
        const data = await response.json();
        return data.responseData.translatedText;
    } catch (error) {
        console.error('Error translating:', error);
        return '—';
    }
}

async function getRelatedWords(word) {
    try {
        const response = await fetch(`${API_ENDPOINTS.DATAMUSE}?ml=${word}&max=10`);
        if (!response.ok) throw new Error('Failed to get related words');
        const data = await response.json();
        return data.map(item => item.word);
    } catch (error) {
        console.error('Error getting related words:', error);
        return [];
    }
}

async function getSynonyms(word) {
    try {
        const response = await fetch(`${API_ENDPOINTS.DATAMUSE}?rel_syn=${word}&max=8`);
        if (!response.ok) throw new Error('Failed to get synonyms');
        const data = await response.json();
        return data.map(item => item.word);
    } catch (error) {
        console.error('Error getting synonyms:', error);
        return [];
    }
}

// ============ WORD LOADING ============
async function loadRandomWord() {
    if (isLoading) return;
    
    try {
        isLoading = true;
        showLoading();
        
        // Get random word
        const word = await getRandomWord();
        console.log('Random word:', word);
        
        // Get word details
        const [definition, translation, synonyms] = await Promise.all([
            getWordDefinition(word),
            translateWord(word),
            getSynonyms(word)
        ]);
        
        if (!definition) {
            // If word not found, try another one
            console.log('Word not found, trying another...');
            isLoading = false;
            return loadRandomWord();
        }
        
        // Process word data
        const wordData = processWordData(word, definition, translation, synonyms);
        
        // Save to history
        addToHistory(wordData);
        
        // Display word
        currentWord = wordData;
        renderWord(wordData);
        
    } catch (error) {
        console.error('Error loading word:', error);
        showError('Không thể tải từ vựng. Vui lòng thử lại.');
    } finally {
        isLoading = false;
        hideLoading();
    }
}

async function searchWord(searchTerm) {
    if (isLoading || !searchTerm) return;
    
    try {
        isLoading = true;
        showLoading();
        
        const word = searchTerm.toLowerCase().trim();
        
        // Get word details
        const [definition, translation, synonyms] = await Promise.all([
            getWordDefinition(word),
            translateWord(word),
            getSynonyms(word)
        ]);
        
        if (!definition) {
            showError(`Không tìm thấy từ "${word}"`);
            hideLoading();
            isLoading = false;
            return;
        }
        
        // Process word data
        const wordData = processWordData(word, definition, translation, synonyms);
        
        // Save to history
        addToHistory(wordData);
        
        // Display word
        currentWord = wordData;
        renderWord(wordData);
        
        // Close search modal
        closeModal('searchModal');
        
    } catch (error) {
        console.error('Error searching word:', error);
        showError('Không thể tìm từ. Vui lòng thử lại.');
    } finally {
        isLoading = false;
        hideLoading();
    }
}

function processWordData(word, definition, translation, synonyms) {
    const meanings = definition.meanings || [];
    const phonetic = definition.phonetic || definition.phonetics?.[0]?.text || '';
    
    // Get first meaning
    const firstMeaning = meanings[0] || {};
    const partOfSpeech = firstMeaning.partOfSpeech || 'unknown';
    const definitions = firstMeaning.definitions || [];
    const firstDef = definitions[0] || {};
    
    // Collect all parts of speech
    const allPos = meanings.map(m => m.partOfSpeech).filter(Boolean);
    
    // Get example
    const example = firstDef.example || '';
    
    // Get synonyms from definition if not provided
    if (synonyms.length === 0) {
        synonyms = firstDef.synonyms || [];
    }
    
    // Get audio URL
    const audioObj = definition.phonetics?.find(p => p.audio) || {};
    const audioUrl = audioObj.audio || '';
    
    // Get verb forms if verb
    let verbForms = [];
    if (partOfSpeech === 'verb' && meanings[0]?.definitions) {
        // Try to extract forms from definitions
        meanings[0].definitions.forEach(def => {
            if (def.example) {
                const words = def.example.match(/\b\w+ed\b|\b\w+ing\b|\b\w+s\b/gi);
                if (words) verbForms.push(...words);
            }
        });
        verbForms = [...new Set(verbForms)].slice(0, 4);
    }
    
    // Get related words by POS
    const relatedByPos = {};
    meanings.forEach(m => {
        const pos = m.partOfSpeech;
        if (pos && pos !== partOfSpeech) {
            relatedByPos[pos] = m.definitions?.[0]?.definition || '';
        }
    });
    
    return {
        word: word,
        phonetic: phonetic,
        partOfSpeech: allPos,
        definition: firstDef.definition || '—',
        translation: translation,
        example: example,
        synonyms: synonyms.slice(0, 8),
        verbForms: verbForms,
        relatedByPos: relatedByPos,
        audioUrl: audioUrl
    };
}

// ============ UI RENDERING ============
function showLoading() {
    document.getElementById('loadingScreen').style.display = 'flex';
    document.getElementById('mainCard').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('mainCard').style.display = 'flex';
}

function showError(message) {
    showToast(message, 'error');
}

function showToast(message, type = 'info') {
    const indicator = document.getElementById('swipeIndicator');
    indicator.textContent = message;
    indicator.className = 'swipe-indicator show';
    
    if (type === 'error') {
        indicator.style.background = '#ef4444';
    } else if (type === 'success') {
        indicator.style.background = '#10b981';
    } else {
        indicator.style.background = '#3b82f6';
    }
    
    setTimeout(() => {
        indicator.classList.remove('show');
    }, 2000);
}

function renderWord(word) {
    // Word text
    document.getElementById('wordText').textContent = word.word;
    
    // Phonetic
    document.getElementById('phonetic').textContent = word.phonetic || '—';
    
    // Part of speech badges
    const posBadges = document.getElementById('posBadges');
    if (word.partOfSpeech && word.partOfSpeech.length > 0) {
        posBadges.innerHTML = word.partOfSpeech.map(pos => 
            `<span class="pos-badge">${pos}</span>`
        ).join('');
        posBadges.style.display = 'flex';
    } else {
        posBadges.style.display = 'none';
    }
    
    // Translation
    document.getElementById('translationText').textContent = word.translation || '—';
    
    // Definition
    document.getElementById('definitionText').textContent = word.definition || '—';
    
    // Example
    const exampleBox = document.getElementById('exampleBox');
    const exampleText = document.getElementById('exampleText');
    if (word.example) {
        exampleText.textContent = word.example;
        exampleBox.style.display = 'block';
    } else {
        exampleBox.style.display = 'none';
    }
    
    // Verb forms
    const verbFormsBox = document.getElementById('verbForms');
    const verbFormsGrid = document.getElementById('verbFormsGrid');
    if (word.verbForms && word.verbForms.length > 0) {
        verbFormsGrid.innerHTML = word.verbForms.map(form => 
            `<div class="verb-form-item">
                <div class="verb-form-value">${form}</div>
            </div>`
        ).join('');
        verbFormsBox.style.display = 'block';
    } else {
        verbFormsBox.style.display = 'none';
    }
    
    // Related words by POS
    const relatedSection = document.getElementById('relatedSection');
    const relatedContent = document.getElementById('relatedContent');
    if (word.relatedByPos && Object.keys(word.relatedByPos).length > 0) {
        relatedContent.innerHTML = Object.entries(word.relatedByPos).map(([pos, def]) => 
            `<div class="related-pos">
                <span class="pos-badge">${pos}</span>
                <p class="related-def">${def}</p>
            </div>`
        ).join('');
        relatedSection.style.display = 'block';
    } else {
        relatedSection.style.display = 'none';
    }
    
    // Synonyms
    const synonymsSection = document.getElementById('synonymsSection');
    const synonymsChips = document.getElementById('synonymsChips');
    if (word.synonyms && word.synonyms.length > 0) {
        synonymsChips.innerHTML = word.synonyms.map(syn => 
            `<span class="chip" onclick="searchAndShow('${syn}')">${syn}</span>`
        ).join('');
        synonymsSection.style.display = 'block';
    } else {
        synonymsSection.style.display = 'none';
    }
    
    // Store audio URL for playback
    currentWord.audioUrl = word.audioUrl;
}

function renderHistory() {
    const historyList = document.getElementById('historyList');
    const historyCount = document.getElementById('historyCount');
    
    historyCount.textContent = viewedWords.length;
    
    if (viewedWords.length === 0) {
        historyList.innerHTML = '<p class="empty-message">Chưa có từ nào được lưu</p>';
        return;
    }
    
    historyList.innerHTML = viewedWords.map(word => `
        <div class="history-item" onclick="loadHistoryWord('${word.word}')">
            <div class="history-word">
                <strong>${word.word}</strong>
                <span class="history-pos">${word.partOfSpeech?.[0] || ''}</span>
            </div>
            <div class="history-translation">${word.translation}</div>
            <div class="history-time">${formatTimeAgo(word.viewedAt)}</div>
        </div>
    `).join('');
}

function renderSearchSuggestions() {
    const suggestionsChips = document.getElementById('suggestionsChips');
    const randomSuggestions = COMMON_WORDS
        .sort(() => Math.random() - 0.5)
        .slice(0, 8);
    
    suggestionsChips.innerHTML = randomSuggestions.map(word => 
        `<span class="chip" onclick="searchAndShow('${word}')">${word}</span>`
    ).join('');
}

function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'Vừa xong';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
    return `${Math.floor(seconds / 86400)} ngày trước`;
}

// ============ AUDIO PLAYBACK ============
function playAudio() {
    if (!currentWord) return;
    
    // Try to play from URL first
    if (currentWord.audioUrl) {
        const audio = new Audio(currentWord.audioUrl);
        audio.play().catch(err => {
            console.log('Audio playback failed, using speech synthesis');
            speakWord();
        });
    } else {
        speakWord();
    }
}

function speakWord() {
    if (!currentWord) return;
    
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(currentWord.word);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }
}

// ============ MODAL FUNCTIONS ============
function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
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
        
        if (Math.abs(diff) > 100) {
            // Swiped
            if (diff < 0) {
                // Swiped left - save and next
                card.style.transform = 'translateX(-500px) rotate(-20deg)';
                setTimeout(() => {
                    card.style.transform = '';
                    loadRandomWord();
                }, 300);
            }
        } else {
            // Not enough swipe - reset
            card.style.transform = '';
        }
    });
}

// ============ EVENT HANDLERS ============
function searchAndShow(word) {
    closeModal('searchModal');
    searchWord(word);
}

function loadHistoryWord(word) {
    closeModal('historyModal');
    searchWord(word);
}

function openChatGPT() {
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

// ============ INITIALIZATION ============
function init() {
    // Load history
    loadHistory();
    
    // Render initial suggestions
    renderSearchSuggestions();
    
    // Load first word
    loadRandomWord();
    
    // Event listeners
    document.getElementById('searchBtn').addEventListener('click', () => {
        renderSearchSuggestions();
        openModal('searchModal');
        document.getElementById('searchInput').focus();
    });
    
    document.getElementById('historyBtn').addEventListener('click', () => {
        renderHistory();
        openModal('historyModal');
    });
    
    document.getElementById('closeSearchBtn').addEventListener('click', () => {
        closeModal('searchModal');
    });
    
    document.getElementById('closeHistoryBtn').addEventListener('click', () => {
        closeModal('historyModal');
    });
    
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
    
    document.getElementById('searchForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const searchTerm = document.getElementById('searchInput').value.trim();
        if (searchTerm) {
            searchWord(searchTerm);
            document.getElementById('searchInput').value = '';
        }
    });
    
    document.getElementById('audioBtn').addEventListener('click', playAudio);
    
    document.getElementById('aiBtn').addEventListener('click', openChatGPT);
    
    document.getElementById('nextWordBtn').addEventListener('click', () => {
        loadRandomWord();
    });
    
    // Modal backdrop close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
    
    // Initialize swipe gesture
    initSwipeGesture();
}

// Start app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
