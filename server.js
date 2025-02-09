const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;
const LEAGUE_NAME = 'Cmentarzysko x Kasztanowa (PL53351)';
const POE_API_URL = 'https://www.pathofexile.com/api/ladders/';
const FETCH_LIMIT = 200; // Maksymalny limit na jedno zapytanie
const CACHE_DURATION = 3* 60 * 1000; // 3 minuty
const CACHE_REFRESH_BEFORE = 1 * 60 * 1000; // Odświeżanie na minutę przed wygaśnięciem cache

// Ochrona przed XSS, sniffingiem i clickjackingiem
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"] // 🔥 NIEBEZPIECZNE, ale działa
        }
    }
}));
app.use(cors());
app.use(express.static('public'));

let isFetching = false;
let cache = null;
let lastFetchTime = 0;
let previousData = []; // Zmienna do przechowywania poprzednich danych (w tym doświadczenia)

function formatNumber(num) {
    if (num >= 1e9) { // Jeśli liczba >= 1 miliard
        return (num / 1e9).toFixed(2) + 'B'; // "B" dla miliarda
    } else if (num >= 1e6) { // Jeśli liczba >= 1 milion
        return (num / 1e6).toFixed(2) + 'M'; // "M" dla miliona
    } else if (num >= 1e3) { // Jeśli liczba >= 1000
        return (num / 1e3).toFixed(2) + 'K'; // "K" dla tysiąca
    } else {
        return num.toString(); // Jeśli liczba jest mniejsza niż 1000, po prostu zwracamy ją jako tekst
    }
}

// Funkcja do pobrania leaderboarda
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

    // Teraz zapisujemy poprzednią wartość doświadczenia, jeśli istnieje
    const currentData = allEntries.map(entry => {
        const currentExp = entry.character?.experience || 0;
        const previousExp = previousData.find(prev => prev.rank === entry.rank)?.experience || currentExp;
        const expGained = currentExp - previousExp; // Różnica w XP

        // Jeśli XP zostało zdobyte, obliczamy XPH
        const timeDiff = (Date.now() - lastFetchTime) / (1000 * 60 * 60); // Czas w godzinach od ostatniego odświeżenia
        const expPerHour = timeDiff > 0 ? (expGained / timeDiff).toFixed(2) : 0;

        return {
            rank: entry.rank,
            accountName: entry.account?.name || 'Nieznane',
            characterName: entry.character?.name || 'Nieznane',
            level: entry.character?.level || 'Nieznane',
            class: entry.character?.class || 'Nieznane',
            experience: currentExp,
            expPerHour: formatNumber(expPerHour), // Formatowanie XPH
            dead: entry.dead !== undefined ? entry.dead : false,
            score: entry.score, // Dodanie score
            progress: entry.progress, // Dodanie progress
			depth: entry.depth, //deepest Delve depth completed
			previousExp: previousExp,
			expGained: expGained,
        };
    });

    // Zapisujemy dane do previousData, by mieć je do porównań przy następnym odświeżeniu
    previousData = currentData;

    return currentData;
}

async function refreshCache() {
    if (isFetching) return;
    isFetching = true;

    console.log('Odświeżam cache leaderboarda...');
    const newData = await fetchFullLeaderboard();
    if (JSON.stringify(newData) !== JSON.stringify(cache)) {
        cache = newData;
        lastFetchTime = Date.now();
    }
    isFetching = false;
}

// Uruchamiamy pobieranie leaderboarda przy starcie serwera
refreshCache();

// Ustawienie interwału do odświeżania cache przed wygaśnięciem
setInterval(() => {
    const timeLeft = lastFetchTime + CACHE_DURATION - Date.now();
    if (timeLeft <= CACHE_REFRESH_BEFORE) {
        refreshCache(); // Odświeżamy cache 1 minutę przed wygaśnięciem
    }
}, 60 * 1000); // Sprawdzamy co minutę

app.get('/leaderboard', (req, res) => {
    const currentTime = Date.now();

    // Zwracamy dane z cache jeśli są aktualne
    if (cache && (currentTime - lastFetchTime < CACHE_DURATION)) {
        console.log('Zwracam dane z cache');
    } else {
        // W razie potrzeby odświeżamy cache
        refreshCache();
    }

    let offset = parseInt(req.query.offset, 10) || 0;
    let limit = parseInt(req.query.limit, 10) || 50;
    let search = req.query.search ? req.query.search.toLowerCase() : "";

    const filteredData = cache.filter(entry =>
        entry.characterName.toLowerCase().includes(search)
    );

    const paginatedData = filteredData.slice(offset, offset + limit);

    // Zwracamy dane, w tym score i progress
    res.json({ entries: paginatedData, total: filteredData.length });
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});