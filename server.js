/**
 * Vocab Swipe Server
 * Node.js/Express server để serve files và auto-load sources từ folder
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files

// API: Lấy danh sách tất cả sources từ folder
app.get('/api/sources', async (req, res) => {
    try {
        const sourcesDir = path.join(__dirname, 'sources');
        const files = await fs.readdir(sourcesDir);
        
        // Chỉ lấy files .json
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        const sources = [];
        
        for (const file of jsonFiles) {
            try {
                const filePath = path.join(sourcesDir, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const words = JSON.parse(content);
                
                // Tạo tên source từ tên file
                const sourceName = file.replace('.json', '')
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
                
                sources.push({
                    name: sourceName,
                    fileName: file,
                    words: words,
                    totalWords: words.length,
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
        const words = JSON.parse(content);
        
        res.json({
            success: true,
            fileName: fileName,
            words: words,
            totalWords: words.length
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
        const { name, words } = req.body;
        
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
            .replace(/[^a-z0-9-]/g, '') + '.json';
        
        const filePath = path.join(__dirname, 'sources', fileName);
        
        // Ghi file
        await fs.writeFile(filePath, JSON.stringify(words, null, 2), 'utf-8');
        
        res.json({
            success: true,
            message: 'Source saved successfully',
            fileName: fileName,
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
║   GET  /api/sources                   ║
║   GET  /api/sources/:fileName         ║
║   POST /api/sources                   ║
║   DELETE /api/sources/:fileName       ║
╚═══════════════════════════════════════╝
    `);
});

module.exports = app;
