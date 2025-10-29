/**
 * Vocab Swipe Server
 * Node.js/Express server để serve files và auto-load sources từ folder
 * Hỗ trợ file .data với dòng đầu tiên là #link: <url>
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files

/**
 * Parse nội dung file .data
 * Dòng đầu tiên có thể là: #link: <url>
 * Các dòng còn lại là JSON array của words
 */
function parseDataFile(content) {
    const lines = content.split('\n');
    let link = '';
    let jsonContent = content;
    
    // Kiểm tra dòng đầu tiên có phải #link: không
    if (lines[0].trim().startsWith('#link:')) {
        link = lines[0].trim().substring(6).trim(); // Lấy phần sau "#link:"
        jsonContent = lines.slice(1).join('\n'); // Phần còn lại là JSON
    }
    
    const words = JSON.parse(jsonContent);
    
    return {
        link: link,
        words: words
    };
}

/**
 * Tạo nội dung file .data từ link và words
 */
function createDataFileContent(link, words) {
    let content = '';
    
    // Thêm dòng #link: nếu có link
    if (link && link.trim()) {
        content = `#link: ${link.trim()}\n`;
    }
    
    // Thêm JSON array của words
    content += JSON.stringify(words, null, 2);
    
    return content;
}

// API: Lấy danh sách tất cả sources từ folder
app.get('/api/sources', async (req, res) => {
    try {
        const sourcesDir = path.join(__dirname, 'sources');
        const files = await fs.readdir(sourcesDir);
        
        // Chỉ lấy files .data
        const dataFiles = files.filter(file => file.endsWith('.data'));
        
        const sources = [];
        
        for (const file of dataFiles) {
            try {
                const filePath = path.join(sourcesDir, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const parsed = parseDataFile(content);
                
                // Tạo tên source từ tên file
                const sourceName = file.replace('.data', '')
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
                
                sources.push({
                    name: sourceName,
                    fileName: file,
                    link: parsed.link,
                    words: parsed.words,
                    totalWords: parsed.words.length,
                    createdAt: Date.now()
                });
            } catch (err) {
                console.error(`Error reading ${file}:`, err.message);
            }
        }
        
        res.json({
            success: true,
            sources: sources,
            count: sources.length
        });
        
    } catch (error) {
        console.error('Error loading sources:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load sources',
            message: error.message
        });
    }
});

// API: Lấy chi tiết 1 source cụ thể
app.get('/api/sources/:fileName', async (req, res) => {
    try {
        const fileName = req.params.fileName;
        const filePath = path.join(__dirname, 'sources', fileName);
        
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = parseDataFile(content);
        
        res.json({
            success: true,
            fileName: fileName,
            link: parsed.link,
            words: parsed.words,
            totalWords: parsed.words.length
        });
        
    } catch (error) {
        console.error('Error loading source:', error);
        res.status(404).json({
            success: false,
            error: 'Source not found',
            message: error.message
        });
    }
});

// API: Lưu source mới vào folder
app.post('/api/sources', async (req, res) => {
    try {
        const { name, link, words } = req.body;
        
        if (!name || !words || !Array.isArray(words)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid data',
                message: 'Name and words array are required'
            });
        }
        
        // Tạo tên file từ name
        const fileName = name.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '') + '.data';
        
        const filePath = path.join(__dirname, 'sources', fileName);
        
        // Tạo nội dung file với link (optional)
        const fileContent = createDataFileContent(link || '', words);
        
        // Ghi file
        await fs.writeFile(filePath, fileContent, 'utf-8');
        
        res.json({
            success: true,
            message: 'Source saved successfully',
            fileName: fileName,
            link: link || '',
            totalWords: words.length
        });
        
    } catch (error) {
        console.error('Error saving source:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save source',
            message: error.message
        });
    }
});

// API: Cập nhật source (bao gồm cả link)
app.put('/api/sources/:fileName', async (req, res) => {
    try {
        const fileName = req.params.fileName;
        const { link, words } = req.body;
        
        if (!words || !Array.isArray(words)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid data',
                message: 'Words array is required'
            });
        }
        
        const filePath = path.join(__dirname, 'sources', fileName);
        
        // Tạo nội dung file với link (optional)
        const fileContent = createDataFileContent(link || '', words);
        
        // Ghi file
        await fs.writeFile(filePath, fileContent, 'utf-8');
        
        res.json({
            success: true,
            message: 'Source updated successfully',
            fileName: fileName,
            link: link || '',
            totalWords: words.length
        });
        
    } catch (error) {
        console.error('Error updating source:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update source',
            message: error.message
        });
    }
});

// API: Xóa source
app.delete('/api/sources/:fileName', async (req, res) => {
    try {
        const fileName = req.params.fileName;
        const filePath = path.join(__dirname, 'sources', fileName);
        
        await fs.unlink(filePath);
        
        res.json({
            success: true,
            message: 'Source deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting source:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete source',
            message: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Vocab Swipe Server is running',
        timestamp: new Date().toISOString()
    });
});

// Serve index.html cho root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║   📚 Vocab Swipe Server Started      ║
╠═══════════════════════════════════════╣
║   Port: ${PORT}                       
║   URL:  http://localhost:${PORT}      
║                                       ║
║   API Endpoints:                      ║
║   GET    /api/sources                 ║
║   GET    /api/sources/:fileName       ║
║   POST   /api/sources                 ║
║   PUT    /api/sources/:fileName       ║
║   DELETE /api/sources/:fileName       ║
║                                       ║
║   📝 File format: .data               ║
║   First line: #link: <url> (optional) ║
╚═══════════════════════════════════════╝
    `);
});

module.exports = app;
