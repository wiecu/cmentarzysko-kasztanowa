document.addEventListener('DOMContentLoaded', async () => {
    let currentPage = 0;
    const limit = 50;
    const tableBody = document.querySelector('#leaderboard tbody');
    const prevButton = document.querySelector('#prevPage');
    const nextButton = document.querySelector('#nextPage');

    // Funkcja do aktualizacji tabeli
    const updateTable = async () => {
        const response = await fetch(`/leaderboard?offset=${currentPage * limit}&limit=${limit}`);
        const data = await response.json();
        tableBody.innerHTML = '';  // Wyczyść poprzednią zawartość

        // Logowanie danych, które otrzymujemy z serwera
        console.log(data.entries);

        // Dodaj nowe dane
        data.entries.forEach(entry => {
            const isDead = entry.dead === true || entry.dead === 'true' || entry.dead === 1; // Sprawdzamy różne możliwe wartości
            console.log(`Dead status for ${entry.characterName}: ${isDead}`);  // Logowanie statusu 'dead' każdej postaci

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${isDead ? '💀' : ''} ${entry.rank}</td>
                <td>${entry.accountName}</td>
                <td ${isDead ? 'style="text-decoration: line-through; color: red;"' : ''}>${entry.characterName}</td>
                <td>${entry.level}</td>
                <td>${entry.class}</td>
            `;
            tableBody.appendChild(row);
        });

        // Obsługa przycisków "Previous" i "Next"
        prevButton.disabled = currentPage === 0;
        nextButton.disabled = (currentPage + 1) * limit >= data.total;
    };

    // Event listeners do przycisków
    prevButton.addEventListener('click', () => {
        if (currentPage > 0) {
            currentPage--;
            updateTable();
        }
    });

    nextButton.addEventListener('click', () => {
        currentPage++;
        updateTable();
    });

    updateTable();  // Początkowe załadowanie tabeli
});
