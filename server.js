const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const LEAGUE_NAME = 'Cmentarzysko x Kasztanowa (PL53351)';
const POE_API_URL = 'https://www.pathofexile.com/api/ladders/';
const FETCH_LIMIT = 200; // Maksymalny limit na jedno zapytanie
const CACHE_DURATION = 10 * 60 * 1000; // 10 minut

app.use(cors());
app.use(express.static('public'));

let cache = null;
let lastFetchTime = 0;

async function fetchFullLeaderboard() {
    let allEntries = [];
    let offset = 0;

    while (true) {
        try {
            const url = `${POE_API_URL}${encodeURIComponent(LEAGUE_NAME)}?offset=${offset}&limit=${FETCH_LIMIT}`;
            console.log("Wysyłam zapytanie do API:", url);
            const response = await fetch(url, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
					'Accept': 'application/json'
				},
            });

            if (!response.ok) {
                console.error(`Błąd API: ${response.status} - ${response.statusText}`);
                throw new Error(`Błąd pobierania danych: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data.entries || data.entries.length === 0) break;

            allEntries = allEntries.concat(data.entries);
            offset += FETCH_LIMIT;
			await new Promise(r => setTimeout(r, 1000)); // Ograniczenie liczby zapytań
        } catch (error) {
            console.error("Błąd pobierania leaderboarda:", error);
            return [];
        }
    }

    return allEntries.map(entry => ({
        rank: entry.rank,
        accountName: entry.account?.name || 'Nieznane',
        characterName: entry.character?.name || 'Nieznane',
        level: entry.character?.level || 'Nieznane',
        class: entry.character?.class || 'Nieznane',
        experience: entry.character?.experience || 0,
        dead: entry.dead !== undefined ? entry.dead : false,
    }));
}


app.get('/leaderboard', async (req, res) => {
    const currentTime = Date.now();

    if (cache && (currentTime - lastFetchTime < CACHE_DURATION)) {
        console.log('Zwracam dane z cache');
    } else {
        cache = await fetchFullLeaderboard();
        lastFetchTime = currentTime;
    }

    let offset = parseInt(req.query.offset, 10) || 0;
    let limit = parseInt(req.query.limit, 10) || 50;
    let search = req.query.search ? req.query.search.toLowerCase() : "";

    const filteredData = cache.filter(entry =>
        entry.characterName.toLowerCase().includes(search)
    );

    const paginatedData = filteredData.slice(offset, offset + limit);

    res.json({ entries: paginatedData, total: filteredData.length });
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});
