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
const CACHE_DURATION = 10 * 60 * 1000; // 10 minut

app.get('/leaderboard', async (req, res) => {
    const { offset = 0, limit = 50, search = "" } = req.query;
    const currentTime = Date.now();

    if (cache && (currentTime - lastFetchTime < CACHE_DURATION)) {
        console.log('Zwracam dane z cache');
        const filteredData = cache.filter(entry =>
            entry.characterName.toLowerCase().includes(search.toLowerCase())
        );
        return res.json({ entries: filteredData.slice(offset, offset + limit), total: filteredData.length });
    }

    try {
        const url = `${POE_API_URL}${encodeURIComponent(LEAGUE_NAME)}?offset=0&limit=200`;
        console.log("Wysyłam zapytanie do API:", url); // 🔥 Debug - sprawdź URL
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json'
            },
        });

        if (!response.ok) {
            console.error(`Błąd API: ${response.status} - ${response.statusText}`); // 🔥 Debug 403
            throw new Error(`Błąd pobierania danych: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Odpowiedź API:", JSON.stringify(data, null, 2)); // 🔥 Debug API

        cache = data.entries.map(entry => ({
            rank: entry.rank,
            accountName: entry.account?.name || 'Nieznane',
            characterName: entry.character?.name || 'Nieznane',
            level: entry.character?.level || 'Nieznane',
            class: entry.character?.class || 'Nieznane',
            experience: entry.character?.experience || 0,
            dead: entry.dead !== undefined ? entry.dead : false,
        }));

        lastFetchTime = currentTime;
        console.log('Zaktualizowano cache');

        const filteredData = cache.filter(entry =>
            entry.characterName.toLowerCase().includes(search.toLowerCase())
        );

        res.json({ entries: filteredData.slice(offset, offset + limit), total: filteredData.length });

    } catch (error) {
        console.error("Błąd pobierania leaderboarda:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});

