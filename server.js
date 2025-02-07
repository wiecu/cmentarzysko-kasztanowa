const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const LEAGUE_NAME = 'Cmentarzysko x Kasztanowa (PL53351)';
const POE_API_URL = 'https://www.pathofexile.com/api/ladders/';

app.use(cors());
app.use(express.static('public'));

let cache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minut w milisekundach

app.get('/leaderboard', async (req, res) => {
    const { offset = 0, limit = 50 } = req.query;
    const currentTime = Date.now();
    
    if (cache && (currentTime - lastFetchTime < CACHE_DURATION)) {
        console.log('Zwracam dane z cache');
        return res.json({ entries: cache.slice(offset, offset + limit), total: cache.length });
    }
    
    try {
        const url = `${POE_API_URL}${encodeURIComponent(LEAGUE_NAME)}?offset=0&limit=200`; // Pobieramy więcej, by cache było kompletne
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });
        if (!response.ok) throw new Error(`Błąd pobierania danych: ${response.statusText}`);
        const data = await response.json();
        
        cache = data.entries.map(entry => ({
            rank: entry.rank,
            accountName: entry.account ? entry.account.name : 'Nieznane',
            characterName: entry.character ? entry.character.name : 'Nieznane',
            level: entry.character ? entry.character.level : 'Nieznane',
            class: entry.character ? entry.character.class : 'Nieznane',
        }));
        lastFetchTime = currentTime;
        console.log('Zaktualizowano cache');
        
        res.json({ entries: cache.slice(offset, offset + limit), total: cache.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});
