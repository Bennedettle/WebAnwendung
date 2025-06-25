const webRoomsWebSocketServerAddr = 'wss://nosch.uber.space/web-rooms/';
const ROOM_PREFIX = "vier gewinnt" + Math.floor(Math.random() * 10000) + "-";
const ROWS = 6;
const COLS = 7;
const EVENT_TYPES = [
    "bafoeg", "urlaub", "haertefall", "drittversuch", "dekan"
];
const EVENT_COLOR = "#66ccff";

// Globale Variablen für Spielstatus und Netzwerk
let roomIndex = 1;
let roomName = roomIndex.toString();
let joined = false;
let clientCount = 0;
let myClientId = null;
let myPlayerNumber = null;

let board = []; // 2D-Array für das Spielfeld
let currentPlayer = 1; // 1 = Rot, 2 = Gelb
let gameOver = false;
let semesterCount = [0, 0]; // Zähler für die Züge/Semester pro Spieler
let skipTurn = [false, false]; // Speichert, ob ein Spieler aussetzen muss
let eventMessage = ""; // Aktuelle Eventnachricht
let eventFields = []; // Positionen und Typen der Ereignisfelder

let socket = null;
let selectedCol = null; // Aktuell ausgewählte Spalte für den nächsten Zug

startRoomSearch(); // Starte die Suche nach einem freien Raum (Multiplayer)

// Verbindungsaufbau und Raumverwaltung
function startRoomSearch() {
    roomName = roomIndex.toString();
    joined = false;
    clientCount = 0;
    if (socket) {
        socket.close();
    }
    socket = new WebSocket(webRoomsWebSocketServerAddr);

    socket.addEventListener('open', () => {
        tryJoinRoom();
        setInterval(() => socket.send(''), 30000); // Halteverbindung
    });

    socket.addEventListener('message', (event) => {
        const data = event.data;
        if (data.length > 0) {
            const incoming = JSON.parse(data);
            const selector = incoming[0];

            switch (selector) {
                case '*client-id*':
                    myClientId = incoming[1];
                    break;
                case '*client-count*':
                    clientCount = incoming[1];
                    if (clientCount > 2 && !joined) {
                        // Wenn Raum voll, nächsten Raum probieren
                        roomIndex++;
                        startRoomSearch();
                    } else if (clientCount <= 2 && !joined) {
                        joined = true;
                        assignPlayerNumber();
                    }
                    break;
                case 'restart':
                    receiveRestart(incoming[1]);
                    break;
                case 'move':
                    receiveMove(incoming[1]);
                    break;
            }
        }
    });
}

// Versuche, dem Raum beizutreten
function tryJoinRoom() {
    sendRequest('*enter-room*', "vier gewinnt" + roomName);
    sendRequest('*subscribe-client-count*');
}

// Sende eine Nachricht an den Server
function sendRequest(...message) {
    socket.send(JSON.stringify(message));
}

// Initialisiere das Spielfeld und verteile Ereignisfelder
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
    // Felder mischen und Events zuweisen
    for (let i = allFields.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allFields[i], allFields[j]] = [allFields[j], allFields[i]];
    }
    let chosenFields = allFields.slice(0, EVENT_TYPES.length);
    let shuffledEvents = EVENT_TYPES.slice();
    for (let i = shuffledEvents.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledEvents[i], shuffledEvents[j]] = [shuffledEvents[j], shuffledEvents[i]];
    }
    for (let i = 0; i < chosenFields.length; i++) {
        eventFields.push({
            r: chosenFields[i].r,
            c: chosenFields[i].c,
            type: shuffledEvents[i]
        });
    }
}

// Weise Spielernummer zu und initialisiere ggf. das Spielfeld
function assignPlayerNumber() {
    if (myClientId === 0) {
        myPlayerNumber = 1;
        showMessage(`Du bist Spieler 1 (Rot) – Raum: ${roomName}`);
        initBoard();
        sendRequest('*broadcast-message*', ['restart', { board, currentPlayer, gameOver, eventFields }]);
    } else if (myClientId === 1) {
        myPlayerNumber = 2;
        showMessage(`Du bist Spieler 2 (Gelb) – Raum: ${roomName}`);
    }
    renderBoard();
    addRestartButton();
}

// Zeichnet das Spielfeld und alle Elemente neu
function renderBoard() {
    const content = document.getElementById("content");
    content.innerHTML = "";

    // Entferne alten Info-Text und Hintergrund
    let oldInfo = document.getElementById("info-text");
    if (oldInfo) oldInfo.parentNode.removeChild(oldInfo);
    let oldInfoBg = document.getElementById("info-text-bg");
    if (oldInfoBg) oldInfoBg.parentNode.removeChild(oldInfoBg);

    // Zeige Info-Text nur am Anfang der Runde
    let firstMove = board.flat().every(cell => cell === 0);
    if (firstMove) {
        let infoBg = document.createElement("a-plane");
        infoBg.setAttribute("id", "info-text-bg");
        infoBg.setAttribute("width", "8.5");
        infoBg.setAttribute("height", "8");
        infoBg.setAttribute("color", "#20D91A");
        infoBg.setAttribute("opacity", "0.8");
        infoBg.setAttribute("position", `-5 ${ROWS / 2.3} -6.01`);
        let scene = document.querySelector("a-scene");
        scene.appendChild(infoBg);

        let infoText = document.createElement("a-text");
        infoText.setAttribute("id", "info-text");
        infoText.setAttribute("value",
            "Willkommen bei\n" +
            "Regelstudienzeit gewinnt!\n\n" +
            "Jeder Zug ist ein Semester.\n\n" +
            "Brauchst du mehr als 20 Semester,\n" +
            "hast du verloren!\n\n" +
            "Wer zuerst 4 in einer Reihe hat,\n" +
            "bekommt den Bachelor!\n\n" +
            "Ereignisfelder (hellblau):\n" +
            "loesen verschiedene\n" +
            "Studienereignisse aus"
        );
        infoText.setAttribute("color", "#011126");
        infoText.setAttribute("align", "center");
        infoText.setAttribute("width", "6");
        infoText.setAttribute("position", `-5 ${ROWS / 2.3} -6`);
        infoText.setAttribute("scale", "2 2 2");
        scene.appendChild(infoText);
    }

    // Erzeuge das Brett als unsichtbare Box für die Platzierung
    let boardBg = document.createElement("a-box");
    boardBg.setAttribute("position", `${(COLS-1)/2} ${ROWS/2-0.5} -6.2`);
    boardBg.setAttribute("depth", "0.2");
    boardBg.setAttribute("height", ROWS);
    boardBg.setAttribute("width", COLS);
    boardBg.setAttribute("color", "#2255aa");
    boardBg.setAttribute("opacity", "0");
    content.appendChild(boardBg);

    // Erzeuge alle Chips und Ereignisfelder
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let chip = document.createElement("a-cylinder");
            chip.setAttribute("radius", "0.45");
            chip.setAttribute("height", "0.15");
            chip.setAttribute("segments-radial", "32");
            chip.setAttribute("position", `${c} ${ROWS-1-r} -6`);
            chip.setAttribute("rotation", "90 0 0");

            // Ereignisfeld anzeigen, falls vorhanden und Feld leer
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
                chip.setAttribute("opacity", "0");
            }
            content.appendChild(chip);
        }
    }

    // Entferne alten Hover-Chip, falls vorhanden
    let oldHoverChip = document.getElementById("hover-chip");
    if (oldHoverChip) oldHoverChip.parentNode.removeChild(oldHoverChip);

    // Zeige Hover-Chip, wenn Spieler am Zug ist
    if (!gameOver && myPlayerNumber === currentPlayer && myPlayerNumber !== null) {
        let hoverChip = document.createElement("a-cylinder");
        hoverChip.setAttribute("id", "hover-chip");
        hoverChip.setAttribute("radius", "0.45");
        hoverChip.setAttribute("height", "0.18");
        hoverChip.setAttribute("segments-radial", "32");
        hoverChip.setAttribute("rotation", "90 0 0");
        hoverChip.setAttribute("color", myPlayerNumber === 1 ? "#FF0000" : "#FFFF00");
        hoverChip.setAttribute("opacity", "0.85");
        hoverChip.setAttribute("position", `${Math.floor(COLS/2)} ${ROWS + 0.3} -6`);
        let scene = document.querySelector("a-scene");
        scene.appendChild(hoverChip);
    }

    // Entferne alte Fangflächen für Klicks
    for (let c = 0; c < COLS; c++) {
        let old = document.getElementById("col-hover-" + c);
        if (old) old.parentNode.removeChild(old);
    }

    // Erzeuge Fangflächen für Klicks auf Spalten
    if (!gameOver && myPlayerNumber === currentPlayer && myPlayerNumber !== null) {
        for (let c = 0; c < COLS; c++) {
            let colPlane = document.createElement("a-plane");
            colPlane.setAttribute("id", "col-hover-" + c);
            colPlane.setAttribute("width", "1");
            colPlane.setAttribute("height", ROWS + 1);
            colPlane.setAttribute("color", "#fff");
            colPlane.setAttribute("opacity", "0.001");
            colPlane.setAttribute("position", `${c} ${(ROWS - 1) / 2} -6`);
            colPlane.setAttribute("side", "double");
            colPlane.setAttribute("class", "clickable");
            let scene = document.querySelector("a-scene");
            scene.appendChild(colPlane);

            colPlane.addEventListener("mouseenter", function () {
                let hoverChip = document.getElementById("hover-chip");
                if (hoverChip) {
                    hoverChip.setAttribute("position", `${c} ${ROWS + 0.3} -6`);
                }
                selectedCol = c;
            });

            colPlane.addEventListener("click", function () {
                if (selectedCol !== null) {
                    makeMove(selectedCol);
                    selectedCol = null;
                }
            });
        }
    }

    // Setze MouseUp-Handler nur einmal
    if (!window._hasMouseUpHandler) {
        window.onmouseup = function (e) {
            if ((!e.button || e.button === 0) && selectedCol !== null) {
                makeMove(selectedCol);
                selectedCol = null;
            }
        };
        window._hasMouseUpHandler = true;
    }
}

// Hilfsfunktion: Finde die unterste freie Zeile in einer Spalte
function getLowestEmptyRow(col) {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === 0) return r;
    }
    return -1;
}

// Event-Logik: Löst das entsprechende Ereignis aus
function triggerEvent(event, player, row, col) {
    switch (event) {
        case "bafoeg":
            for (let c = 0; c < COLS; c++) board[ROWS - 1][c] = 0;
            eventMessage = "Bafoeg gestrichen! Unterste Reihe verloren.";
            break;
        case "urlaub":
            skipTurn[player - 1] = true;
            eventMessage = "Urlaubssemester! Du musst eine Runde aussetzen.";
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
                eventMessage = "Haertefallantrag! Ein Stein wurde verschoben.";
            }
            break;
        case "drittversuch":
            eventMessage = "Drittversuch! Du darfst nochmal ziehen, aber dein erster Stein wurde entfernt.";
            skipTurn[player - 1] = "drittversuch";
            break;
        case "dekan":
            let tippCol = Math.floor(Math.random() * COLS) + 1;
            eventMessage = `Studiendekan-Tipp: "Setze in Spalte ${tippCol}"`;
            break;
        default:
            eventMessage = "";
    }
}

// Spiellogik für das Setzen eines Steins
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
    semesterCount[currentPlayer - 1]++; // Erhöhe Semesterzähler

    // Spiele Sound beim Setzen eines Chips
    let chipSound = document.querySelector('#chip-sound');
    if (chipSound && chipSound.components.sound) {
        chipSound.components.sound.playSound();
    }

    // Prüfe, ob ein Ereignisfeld getroffen wurde
    let triggeredEvent = null;
    for (let i = 0; i < eventFields.length; i++) {
        let ef = eventFields[i];
        if (ef.r === row && ef.c === col && ef.type !== "leer") {
            triggeredEvent = ef.type;
            eventFields.splice(i, 1);
            break;
        }
    }
    if (triggeredEvent) {
        let eventSound = document.querySelector('#event-sound');
        if (eventSound && eventSound.components.sound) {
            eventSound.components.sound.stopSound();
            eventSound.components.sound.playSound();
        }
        if (triggeredEvent === "drittversuch") {
            // Drittversuch: Entferne einen eigenen Stein
            let removed = false;
            for (let r = ROWS - 1; r >= 0; r--) {
                for (let c2 = 0; c2 < COLS; c2++) {
                    if (board[r][c2] === currentPlayer) {
                        board[r][c2] = 0;
                        removed = true;
                        break;
                    }
                }
                if (removed) break;
            }
            eventMessage = "Drittversuch! Du darfst nochmal ziehen, aber dein erster Stein wurde entfernt.";
            sendRequest('*broadcast-message*', ['move', { board, currentPlayer, gameOver, semesterCount, skipTurn, eventMessage, eventFields }]);
            renderBoard();
            showGameStatus();
            return;
        } else {
            triggerEvent(triggeredEvent, currentPlayer, row, col);
        }
    } else {
        eventMessage = "";
    }

    // Drittversuch-Logik: Spieler darf nochmal ziehen
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
            }
        }
        sendRequest('*broadcast-message*', ['move', { board, currentPlayer, gameOver, semesterCount, skipTurn, eventMessage, eventFields }]);
        renderBoard();
        showGameStatus();
        return;
    }

    // Prüfe auf Sieg, Unentschieden oder Regelstudienzeit
    if (semesterCount[currentPlayer - 1] >= 20) {
        gameOver = true;
    } else if (checkWin(row, col, currentPlayer)) {
        gameOver = true;
    } else if (isFull()) {
        gameOver = true;
    } else {
        currentPlayer = 3 - currentPlayer; // Spielerwechsel
    }
    sendRequest('*broadcast-message*', ['move', { board, currentPlayer, gameOver, semesterCount, skipTurn, eventMessage, eventFields }]);
    renderBoard();
    showGameStatus();
}

// Empfange einen Spielzug vom Server
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

// Zeigt die aktuelle Spielerinfo an
function getPlayerInfoText() {
    let farbe = myPlayerNumber === 1 ? "Rot" : myPlayerNumber === 2 ? "Gelb" : "-";
    return `Du bist Spieler ${myPlayerNumber || "-"} (${farbe}) | Raum: ${roomName}`;
}

// Zeigt den aktuellen Spielstatus und Event-Text an
function showGameStatus() {
    let info = getPlayerInfoText();
    if (gameOver) {
        let winner = null;
        if (semesterCount[0] >= 20) winner = 1;
        if (semesterCount[1] >= 20) winner = 2;
        if (checkAnyWin()) winner = currentPlayer;

        if (winner) {
            if (myPlayerNumber === winner) {
                showMessage(`Bachelor erhalten! Studi-Legende!\n${info}`);
            } else if (myPlayerNumber === 1 || myPlayerNumber === 2) {
                showMessage(`Exmatrikuliert! Zu viele Pruefungsversuche.\n${info}`);
            } else {
                showMessage(`Spiel beendet.\n${info}`);
            }
        } else if (isFull()) {
            showMessage(`Unentschieden! Ihr bleibt ewige Studis.\n${info}`);
        }
    } else {
        showMessage(
            `Semester: ${semesterCount[0]} / ${semesterCount[1]}\n${info}`
        );
    }

    // Entferne alten Event-Text und Hintergrund
    let oldEventText = document.getElementById("event-message");
    if (oldEventText) oldEventText.parentNode.removeChild(oldEventText);
    let oldEventBg = document.getElementById("event-message-bg");
    if (oldEventBg) oldEventBg.parentNode.removeChild(oldEventBg);

    // Zeige Event-Text rechts neben dem Board
    if (eventMessage && !gameOver) {
        let eventBg = document.createElement("a-plane");
        eventBg.setAttribute("id", "event-message-bg");
        eventBg.setAttribute("width", "12");
        eventBg.setAttribute("height", "1.2");
        eventBg.setAttribute("color", "#111");
        eventBg.setAttribute("opacity", "0.7");
        eventBg.setAttribute("position", `13 4 -6.01`);
        let scene = document.querySelector("a-scene");
        scene.appendChild(eventBg);

        let eventText = document.createElement("a-text");
        eventText.setAttribute("id", "event-message");
        eventText.setAttribute("value", eventMessage);
        eventText.setAttribute("color", "#66ccff");
        eventText.setAttribute("width", "6");
        eventText.setAttribute("align", "center");
        eventText.setAttribute("position", `13 4 -6`);
        eventText.setAttribute("scale", "2 2 2");
        scene.appendChild(eventText);
    }
}

// Prüft, ob einer der Spieler gewonnen hat
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

// Fügt einen Neustart-Button hinzu
function addRestartButton() {
    let btn = document.getElementById("restartBtn");
    if (!btn) {
        btn = document.createElement("button");
        btn.id = "restartBtn";
        btn.innerText = "Neustart";
        btn.style.position = "absolute";
        btn.style.top = "30px";
        btn.style.left = "50%";
        btn.style.transform = "translateX(-50%)";
        btn.style.fontSize = "1.2em";
        btn.style.padding = "12px 32px";
        btn.style.borderRadius = "24px";
        btn.style.border = "none";
        btn.style.background = "linear-gradient(90deg,rgb(255, 255, 0) 100%)";
        btn.style.fontWeight = "bold";
        btn.style.boxShadow = "0 4px 16px rgba(0,0,0,0.18)";
        btn.style.cursor = "pointer";
        btn.style.transition = "background 0.2s, transform 0.2s";
        btn.onmouseenter = () => {
            btn.style.background = "linear-gradient(90deg,  rgb(255, 0, 0) 100%)";
            btn.style.transform = "translateX(-50%) scale(1.07)";
            btn.style.color = "#ffffff";
        };
        btn.onmouseleave = () => {
            btn.style.background = "linear-gradient(90deg,  rgb(255, 255, 0) 100%)";
            btn.style.transform = "translateX(-50%) scale(1)";
            btn.style.color = "#000000";
        };
        btn.onclick = function () {
            if (myPlayerNumber === 1) {
                initBoard();
                semesterCount = [0, 0];
                skipTurn = [false, false];
                eventMessage = "";
                sendRequest('*broadcast-message*', ['restart', { board, currentPlayer, gameOver, eventFields }]);
                renderBoard();
                showGameStatus();
            }
        };
        document.body.appendChild(btn);
    }
}

// Empfange Neustart vom Server
function receiveRestart(data) {
    let startSound = document.querySelector('#start-sound');
    if (startSound && startSound.components.sound) {
        startSound.components.sound.stopSound();
        startSound.setAttribute('sound', 'volume', 4);
        startSound.components.sound.playSound();
    }

    board = data.board;
    currentPlayer = data.currentPlayer;
    gameOver = data.gameOver;
    semesterCount = [0, 0];
    skipTurn = [false, false];
    eventMessage = "";
    eventFields = data.eventFields || eventFields;
    renderBoard();
    showMessage("Neues Studium! Viel Erfolg!");
}

// Prüft, ob das Spielfeld voll ist
function isFull() {
    for (let c = 0; c < COLS; c++)
        if (board[0][c] === 0) return false;
    return true;
}

// Prüft, ob ein Spieler ab gegebener Position gewonnen hat
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
        countDir(0, 1) + countDir(0, -1) >= 3 ||
        countDir(1, 0) + countDir(-1, 0) >= 3 ||
        countDir(1, 1) + countDir(-1, -1) >= 3 ||
        countDir(1, -1) + countDir(-1, 1) >= 3
    );
}

// Zeigt eine Nachricht als 3D-Text mit Hintergrund an
function showMessage(msg) {
    let oldMsg = document.getElementById("aframe-message");
    if (oldMsg) oldMsg.parentNode.removeChild(oldMsg);
    let oldBg = document.getElementById("aframe-message-bg");
    if (oldBg) oldBg.parentNode.removeChild(oldBg);

    let bg = document.createElement("a-plane");
    bg.setAttribute("id", "aframe-message-bg");
    bg.setAttribute("width", "8");
    bg.setAttribute("height", "1.2");
    bg.setAttribute("color", "#222");
    bg.setAttribute("opacity", "0.7");
    bg.setAttribute("position", `${COLS / 2 - 0.5} ${ROWS + 2} -6.01`);
    let scene = document.querySelector("a-scene");
    scene.appendChild(bg);

    let textEntity = document.createElement("a-text");
    textEntity.setAttribute("id", "aframe-message");
    textEntity.setAttribute("value", msg);
    textEntity.setAttribute("color", "#FFFFFF");
    textEntity.setAttribute("width", "6");
    textEntity.setAttribute("align", "center");
    textEntity.setAttribute("position", `${COLS / 2 - 0.5} ${ROWS + 2} -6`);
    textEntity.setAttribute("scale", "2 2 2");
    scene.appendChild(textEntity);
}

// Initialisiere Board und Button beim Laden der Seite
document.addEventListener("DOMContentLoaded", function () {
    renderBoard();
    addRestartButton();
});