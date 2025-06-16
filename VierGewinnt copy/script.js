const webRoomsWebSocketServerAddr = 'wss://nosch.uber.space/web-rooms/';
const roomName = prompt("Raumname für gemeinsames Spiel:", "mein-viergewinnt-raum") || "vier-gewinnt-demo";
const ROWS = 6;
const COLS = 7;

let board = [];
let currentPlayer = 1;
let gameOver = false;
let myClientId = null;
let myPlayerNumber = null;
let clientCount = 0;
let semesterCount = [0, 0]; // [Spieler1, Spieler2]
let skipTurn = [false, false]; // Urlaubssemester
let eventMessage = ""; // Für Event-Anzeige

// Anzahl und Typen der Events/Ereignisfelder
const EVENT_TYPES = [
    "bafög",
    "urlaub",
    "haertefall",
    "drittversuch",
    "dekan",
];
const EVENT_COLOR = "#66ccff"; // hellblau

let eventFields = []; // [{r, c, type}]

// WebSocket Setup
const socket = new WebSocket(webRoomsWebSocketServerAddr);

socket.addEventListener('open', () => {
    sendRequest('*enter-room*', "vier gewinnt" + roomName);
    sendRequest('*subscribe-client-count*');
    setInterval(() => socket.send(''), 30000);
});

socket.addEventListener('message', (event) => {
    const data = event.data;
    if (data.length > 0) {
        const incoming = JSON.parse(data);
        const selector = incoming[0];

        switch (selector) {
            case '*client-id*':
                myClientId = incoming[1];
                assignPlayerNumber();
                break;
            case '*client-count*':
                clientCount = incoming[1];
                assignPlayerNumber();
                break;
            case 'move':
                receiveMove(incoming[1]);
                break;
            case 'restart':
                receiveRestart(incoming[1]);
                break;
        }
    }
});

function sendRequest(...message) {
    socket.send(JSON.stringify(message));
}

// Spiellogik
function initBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
        board[r] = [];
        for (let c = 0; c < COLS; c++) {
            board[r][c] = 0;
        }
    }
    currentPlayer = 1;
    gameOver = false;

    // Ereignisfelder zufällig verteilen
    eventFields = [];
    let allFields = [];
    for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
            allFields.push({ r, c });
    // Mische alle Felder
    for (let i = allFields.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allFields[i], allFields[j]] = [allFields[j], allFields[i]];
    }
    // Wähle z.B. 6 Felder aus
    let chosenFields = allFields.slice(0, EVENT_TYPES.length);
    // Mische die Events
    let shuffledEvents = EVENT_TYPES.slice();
    for (let i = shuffledEvents.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledEvents[i], shuffledEvents[j]] = [shuffledEvents[j], shuffledEvents[i]];
    }
    // Weise jedem Feld ein Event zu
    for (let i = 0; i < chosenFields.length; i++) {
        eventFields.push({
            r: chosenFields[i].r,
            c: chosenFields[i].c,
            type: shuffledEvents[i]
        });
    }
}

function assignPlayerNumber() {
    // Spieler 1: clientId 0, Spieler 2: clientId 1
    if (myClientId === 0) {
        myPlayerNumber = 1;
        showMessage("Du bist Spieler 1 (Rot)");
        if (board.length === 0) {
            initBoard();
            sendRequest('*broadcast-message*', ['restart', { board, currentPlayer, gameOver, eventFields }]);
        }
    } else if (myClientId === 1) {
        myPlayerNumber = 2;
        showMessage("Du bist Spieler 2 (Gelb)");
    } else {
        myPlayerNumber = null;
        showMessage("Nur zwei Spieler pro Raum erlaubt!");
    }
    renderBoard();
    addRestartButton();
}

function renderBoard() {
    const content = document.getElementById("content");
    content.innerHTML = "";

    // Brett-Hintergrund
    let boardBg = document.createElement("a-box");
    boardBg.setAttribute("position", `${(COLS-1)/2} ${ROWS/2-0.5} -6.2`);
    boardBg.setAttribute("depth", "0.2");
    boardBg.setAttribute("height", ROWS);
    boardBg.setAttribute("width", COLS);
    boardBg.setAttribute("color", "#2255aa");
    boardBg.setAttribute("opacity", "0.95");
    content.appendChild(boardBg);

    // Scheiben und Ereignisfelder
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let chip = document.createElement("a-cylinder");
            chip.setAttribute("radius", "0.45");
            chip.setAttribute("height", "0.15");
            chip.setAttribute("segments-radial", "32");
            chip.setAttribute("position", `${c} ${ROWS-1-r} -6`);
            chip.setAttribute("rotation", "90 0 0");

            // Prüfe, ob Ereignisfeld
            let eventField = eventFields.find(f => f.r === r && f.c === c);
            if (eventField && board[r][c] === 0) {
                chip.setAttribute("color", EVENT_COLOR);
                chip.setAttribute("opacity", "0.7");
            } else if (board[r][c] === 1) {
                chip.setAttribute("color", "#FF0000");
            } else if (board[r][c] === 2) {
                chip.setAttribute("color", "#FFFF00");
            } else {
                chip.setAttribute("color", "#eee");
            }
            content.appendChild(chip);
        }
    }

    // Klickflächen oben für jede Spalte
    if (!gameOver && myPlayerNumber === currentPlayer && myPlayerNumber !== null) {
        for (let c = 0; c < COLS; c++) {
            let clickArea = document.createElement("a-cylinder");
            clickArea.setAttribute("radius", "0.5");
            clickArea.setAttribute("height", "0.05");
            clickArea.setAttribute("segments-radial", "32");
            clickArea.setAttribute("position", `${c} ${ROWS} -6`);
            clickArea.setAttribute("rotation", "90 0 0");
            clickArea.setAttribute("color", "#0f0");
            clickArea.setAttribute("opacity", "0.15");
            clickArea.setAttribute("class", "clickable");
            clickArea.addEventListener("click", function () {
                makeMove(c);
            });
            content.appendChild(clickArea);
        }
    }

}

function getLowestEmptyRow(col) {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === 0) return r;
    }
    return -1;
}

// Hilfsfunktion für Events
function triggerRandomEvent(player) {
    // 30% Chance auf ein Event
    if (Math.random() < 0.3) {
        const events = [
            "bafög",
            "urlaub",
            "haertefall",
            "drittversuch",
            "dekan"
        ];
        const event = events[Math.floor(Math.random() * events.length)];
        switch (event) {
            case "bafög":
                // Unterste Reihe löschen
                for (let c = 0; c < COLS; c++) board[ROWS - 1][c] = 0;
                eventMessage = "📉 Bafög gestrichen! Unterste Reihe verloren.";
                break;
            case "urlaub":
                skipTurn[player - 1] = true;
                eventMessage = "🧳 Urlaubssemester! Du musst eine Runde aussetzen.";
                break;
            case "haertefall":
                // Härtefall: eigenen Stein verschieben
                let ownStones = [];
                for (let r = 0; r < ROWS; r++)
                    for (let c = 0; c < COLS; c++)
                        if (board[r][c] === player) ownStones.push({ r, c });
                if (ownStones.length > 0) {
                    let { r, c } = ownStones[Math.floor(Math.random() * ownStones.length)];
                    board[r][c] = 0;
                    let newCol = (c + 1) % COLS;
                    let newRow = getLowestEmptyRow(newCol);
                    if (newRow !== -1) board[newRow][newCol] = player;
                    eventMessage = "🔁 Härtefallantrag! Ein Stein wurde verschoben.";
                }
                break;
            case "drittversuch":
                // Spieler darf nochmal ziehen, aber bei Fehlschlag wird ein Stein entfernt
                eventMessage = "⚠️ Drittversuch! Du darfst nochmal ziehen, aber bei Fehlschlag verlierst du einen Stein.";
                skipTurn[player - 1] = "drittversuch";
                break;
            case "dekan":
                let tippCol = Math.floor(Math.random() * COLS) + 1;
                eventMessage = `🧓 Studiendekan-Tipp: "Setze in Spalte ${tippCol}" (aber ist das richtig?)`;
                break;
        }
    } else {
        eventMessage = "";
    }
}

function triggerEvent(event, player, row, col) {
    switch (event) {
        case "bafög":
            for (let c = 0; c < COLS; c++) board[ROWS - 1][c] = 0;
            eventMessage = "📉 Bafög gestrichen! Unterste Reihe verloren.";
            break;
        case "urlaub":
            skipTurn[player - 1] = true;
            eventMessage = "🧳 Urlaubssemester! Du musst eine Runde aussetzen.";
            break;
        case "haertefall":
            let ownStones = [];
            for (let r = 0; r < ROWS; r++)
                for (let c = 0; c < COLS; c++)
                    if (board[r][c] === player) ownStones.push({ r, c });
            if (ownStones.length > 0) {
                let { r, c } = ownStones[Math.floor(Math.random() * ownStones.length)];
                board[r][c] = 0;
                let newCol = (c + 1) % COLS;
                let newRow = getLowestEmptyRow(newCol);
                if (newRow !== -1) board[newRow][newCol] = player;
                eventMessage = "🔁 Härtefallantrag! Ein Stein wurde verschoben.";
            }
            break;
        case "drittversuch":
            eventMessage = "⚠️ Drittversuch! Du darfst nochmal ziehen, aber bei Fehlschlag verlierst du einen Stein.";
            skipTurn[player - 1] = "drittversuch";
            break;
        case "dekan":
            let tippCol = Math.floor(Math.random() * COLS) + 1;
            eventMessage = `🧓 Studiendekan-Tipp: "Setze in Spalte ${tippCol}" (aber ist das richtig?)`;
            break;
        default:
            eventMessage = "";
    }
}

function makeMove(col) {
    if (gameOver || myPlayerNumber !== currentPlayer) return;
    if (skipTurn[currentPlayer - 1] === true) {
        showMessage("Urlaubssemester! Du musst aussetzen.");
        skipTurn[currentPlayer - 1] = false;
        currentPlayer = 3 - currentPlayer;
        sendRequest('*broadcast-message*', ['move', { board, currentPlayer, gameOver, semesterCount, skipTurn, eventMessage, eventFields }]);
        renderBoard();
        return;
    }
    let row = getLowestEmptyRow(col);
    if (row === -1) return;
    board[row][col] = currentPlayer;
    semesterCount[currentPlayer - 1]++; // Semesterzähler erhöhen

    // Prüfe, ob Ereignisfeld getroffen wurde
    let triggeredEvent = null;
    for (let i = 0; i < eventFields.length; i++) {
        let ef = eventFields[i];
        if (ef.r === row && ef.c === col && ef.type !== "leer") {
            triggeredEvent = ef.type;
            // Entferne das Ereignisfeld nach Auslösung (optional)
            eventFields.splice(i, 1);
            break;
        }
    }
    if (triggeredEvent) {
        triggerEvent(triggeredEvent, currentPlayer, row, col);
    } else {
        eventMessage = "";
    }

    // Drittversuch-Logik
    if (skipTurn[currentPlayer - 1] === "drittversuch") {
        skipTurn[currentPlayer - 1] = false;
        if (!checkWin(row, col, currentPlayer)) {
            let ownStones = [];
            for (let r = 0; r < ROWS; r++)
                for (let c = 0; c < COLS; c++)
                    if (board[r][c] === currentPlayer) ownStones.push({ r, c });
            if (ownStones.length > 0) {
                let { r, c } = ownStones[Math.floor(Math.random() * ownStones.length)];
                board[r][c] = 0;
                eventMessage += " Dein Stein wurde entfernt!";
            }
        }
    }

    // Regelstudienzeit: 20 Semester
    if (semesterCount[currentPlayer - 1] >= 20) {
        gameOver = true;
    } else if (checkWin(row, col, currentPlayer)) {
        gameOver = true;
    } else if (isFull()) {
        gameOver = true;
    } else {
        currentPlayer = 3 - currentPlayer;
    }
    sendRequest('*broadcast-message*', ['move', { board, currentPlayer, gameOver, semesterCount, skipTurn, eventMessage, eventFields }]);
    renderBoard();
    showGameStatus();
}

function receiveMove(data) {
    board = data.board;
    currentPlayer = data.currentPlayer;
    gameOver = data.gameOver;
    semesterCount = data.semesterCount || [0, 0];
    skipTurn = data.skipTurn || [false, false];
    eventMessage = data.eventMessage || "";
    eventFields = data.eventFields || eventFields;
    renderBoard();
    showGameStatus();
}

function showGameStatus() {
    if (gameOver) {
        // Gewinner ermitteln
        let winner = null;
        if (semesterCount[0] >= 20) winner = 1;
        if (semesterCount[1] >= 20) winner = 2;
        if (checkAnyWin()) winner = currentPlayer;

        if (winner) {
            if (myPlayerNumber === winner) {
                showMessage("🎓 Bachelor erhalten! Studi-Legende!");
            } else if (myPlayerNumber === 1 || myPlayerNumber === 2) {
                showMessage("Exmatrikuliert! Zu viele Prüfungsversuche.");
            } else {
                showMessage("Spiel beendet.");
            }
        } else if (isFull()) {
            showMessage("Unentschieden! Ihr bleibt ewige Studis.");
        }
    } else {
        showMessage(
            (eventMessage ? eventMessage + "\n" : "") +
            `Semester: ${semesterCount[0]} / ${semesterCount[1]}`
        );
    }
}

// Hilfsfunktion: Gibt true zurück, wenn einer gewonnen hat
function checkAnyWin() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] !== 0 && checkWin(r, c, board[r][c])) {
                return true;
            }
        }
    }
    return false;
}

function addRestartButton() {
    let btn = document.getElementById("restartBtn");
    if (!btn) {
        btn = document.createElement("button");
        btn.id = "restartBtn";
        btn.innerText = "Neustart";
        btn.style.position = "absolute";
        btn.style.top = "60px";
        btn.style.left = "50%";
        btn.style.transform = "translateX(-50%)";
        btn.style.fontSize = "1.1em";
        btn.style.padding = "8px 18px";
        btn.style.borderRadius = "8px";
        btn.style.zIndex = "10";
        btn.onclick = function () {
            if (myPlayerNumber === 1) {
                initBoard();
                semesterCount = [0, 0]; // <--- Semesterzähler auch lokal zurücksetzen!
                skipTurn = [false, false];
                eventMessage = "";
                sendRequest('*broadcast-message*', ['restart', { board, currentPlayer, gameOver, eventFields }]);
                renderBoard();
                showMessage("Spieler 1 ist am Zug");
            }
        };
        document.body.appendChild(btn);
    }
}

function receiveRestart(data) {
    board = data.board;
    currentPlayer = data.currentPlayer;
    gameOver = data.gameOver;
    semesterCount = [0, 0]; // Semesterzähler zurücksetzen
    skipTurn = [false, false];
    eventMessage = "";
    eventFields = data.eventFields || eventFields; // Ereignisfelder synchronisieren
    renderBoard();
    showMessage("Neues Studium! Viel Erfolg!");
}

function isFull() {
    for (let c = 0; c < COLS; c++)
        if (board[0][c] === 0) return false;
    return true;
}

function checkWin(row, col, player) {
    function countDir(dr, dc) {
        let count = 0;
        let r = row + dr, c = col + dc;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
            count++; r += dr; c += dc;
        }
        return count;
    }
    return (
        1 + countDir(0, 1) + countDir(0, -1) >= 4 ||
        1 + countDir(1, 0) + countDir(-1, 0) >= 4 ||
        1 + countDir(1, 1) + countDir(-1, -1) >= 4 ||
        1 + countDir(1, -1) + countDir(-1, 1) >= 4
    );
}

function showMessage(msg) {
    let msgBox = document.getElementById("msg");
    if (!msgBox) {
        msgBox = document.createElement("div");
        msgBox.id = "msg";
        msgBox.style.position = "absolute";
        msgBox.style.top = "10px";
        msgBox.style.left = "50%";
        msgBox.style.transform = "translateX(-50%)";
        msgBox.style.background = "#222";
        msgBox.style.color = "#fff";
        msgBox.style.padding = "10px 20px";
        msgBox.style.borderRadius = "8px";
        msgBox.style.fontSize = "1.2em";
        msgBox.style.zIndex = "10";
        document.body.appendChild(msgBox);
    }
    msgBox.innerText = msg;
}

document.addEventListener("DOMContentLoaded", function () {
    renderBoard();
    addRestartButton();
});