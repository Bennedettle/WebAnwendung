const webRoomsWebSocketServerAddr = 'wss://nosch.uber.space/web-rooms/';
const ROOM_PREFIX = "vier gewinnt" + Math.floor(Math.random() * 10000) + "-"; // Zufälliger Raumname
const ROWS = 6;
const COLS = 7;
const EVENT_TYPES = [
    "bafög", "urlaub", "haertefall", "drittversuch", "dekan"
];
const EVENT_COLOR = "#66ccff";

let roomIndex = 1;
let roomName = roomIndex.toString();
let joined = false;
let clientCount = 0;
let myClientId = null;
let myPlayerNumber = null;

let board = [];
let currentPlayer = 1;
let gameOver = false;
let semesterCount = [0, 0];
let skipTurn = [false, false];
let eventMessage = "";
let eventFields = [];

let socket = null;
let selectedCol = null; // Am Anfang der Datei
startRoomSearch();

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
                    break;
                case '*client-count*':
                    clientCount = incoming[1];
                    if (clientCount > 2 && !joined) {
                        // Raum ist voll, versuche nächsten Raum mit neuer Verbindung!
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
                // ...weitere Fälle...
            }
        }
    });
}

function tryJoinRoom() {
    sendRequest('*enter-room*', "vier gewinnt" + roomName);
    sendRequest('*subscribe-client-count*');
}

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
    if (myClientId === 0) {
        myPlayerNumber = 1;
        showMessage(`Du bist Spieler 1 (Rot) – Raum: ${roomName}`);
        // Nur Spieler 1 initialisiert das Spielfeld!
        initBoard();
        sendRequest('*broadcast-message*', ['restart', { board, currentPlayer, gameOver, eventFields }]);
    } else if (myClientId === 1) {
        myPlayerNumber = 2;
        showMessage(`Du bist Spieler 2 (Gelb) – Raum: ${roomName}`);
    }
    renderBoard();
    addRestartButton();
}

function renderBoard() {
    const content = document.getElementById("content");
    content.innerHTML = "";

    // --- Infotext links neben dem Board ---
    // Entferne alten Info-Text, falls vorhanden
    let oldInfo = document.getElementById("info-text");
    if (oldInfo) oldInfo.parentNode.removeChild(oldInfo);

    // Nur am Anfang der Runde anzeigen (z.B. wenn noch kein Stein gesetzt wurde)
    let firstMove = board.flat().every(cell => cell === 0);
    if (firstMove) {
        let infoText = document.createElement("a-text");
        infoText.setAttribute("id", "info-text");
        infoText.setAttribute("value",
            "Vier Gewinnt\n" +
            "Setze abwechselnd Steine.\n" +
            "Wer zuerst 4 in einer Reihe hat, gewinnt!\n\n" +
            "Ereignisfelder (blau):\n" +
            eventFields.map(f => `(${f.r + 1},${f.c + 1}): ${f.type}`).join("\n")
        );
        infoText.setAttribute("color", "#fff");
        infoText.setAttribute("align", "left");
        infoText.setAttribute("width", "6");
        infoText.setAttribute("position", `-2 ${ROWS / 2} -6`);
        infoText.setAttribute("font", "fonts/custom-msdf.json");
        infoText.setAttribute("font-image", "fonts/custom.png");
        infoText.setAttribute("scale", "1 1 1");

        let scene = document.querySelector("a-scene");
        scene.appendChild(infoText);
    }

    // Brett-Hintergrund
    let boardBg = document.createElement("a-box");
    boardBg.setAttribute("position", `${(COLS-1)/2} ${ROWS/2-0.5} -6.2`);
    boardBg.setAttribute("depth", "0.2");
    boardBg.setAttribute("height", ROWS);
    boardBg.setAttribute("width", COLS);
    boardBg.setAttribute("color", "#2255aa");
    boardBg.setAttribute("opacity", "0");
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
                chip.setAttribute("opacity", "0");
            }
            content.appendChild(chip);
        }
    }

    // Entferne alten Hover-Chip, falls vorhanden
    let oldHoverChip = document.getElementById("hover-chip");
    if (oldHoverChip) oldHoverChip.parentNode.removeChild(oldHoverChip);

    // Nur anzeigen, wenn Spieler am Zug ist und das Spiel läuft
    if (!gameOver && myPlayerNumber === currentPlayer && myPlayerNumber !== null) {
        let hoverChip = document.createElement("a-cylinder");
        hoverChip.setAttribute("id", "hover-chip");
        hoverChip.setAttribute("radius", "0.45");
        hoverChip.setAttribute("height", "0.18");
        hoverChip.setAttribute("segments-radial", "32");
        hoverChip.setAttribute("rotation", "90 0 0");
        hoverChip.setAttribute("color", myPlayerNumber === 1 ? "#FF0000" : "#FFFF00");
        hoverChip.setAttribute("opacity", "0.85");
        // Standard-Position: Mitte
        hoverChip.setAttribute("position", `${Math.floor(COLS/2)} ${ROWS + 0.3} -6`);
        let scene = document.querySelector("a-scene");
        scene.appendChild(hoverChip);

    } 
    // Entferne alte Fangflächen
    for (let c = 0; c < COLS; c++) {
        let old = document.getElementById("col-hover-" + c);
        if (old) old.parentNode.removeChild(old);
    }

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

    // window.onmouseup nur einmal global setzen!
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
                eventMessage = "Bafög gestrichen! Unterste Reihe verloren.";
                break;
            case "urlaub":
                skipTurn[player - 1] = true;
                eventMessage = "Urlaubssemester! Du musst eine Runde aussetzen.";
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
                    eventMessage = "Härtefallantrag! Ein Stein wurde verschoben.";
                }
                break;
            case "drittversuch":
                // Spieler darf nochmal ziehen, aber bei Fehlschlag wird ein Stein entfernt
                eventMessage = "Drittversuch! Du darfst nochmal ziehen, aber du hast einen Stein verloren.";
                skipTurn[player - 1] = "drittversuch";
                break;
            case "dekan":
                let tippCol = Math.floor(Math.random() * COLS) + 1;
                eventMessage = `Studiendekan-Tipp: "Setze in Spalte ${tippCol}" (aber ist das richtig?)`;
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
            eventMessage = "Bafög gestrichen! Unterste Reihe verloren.";
            break;
        case "urlaub":
            skipTurn[player - 1] = true;
            eventMessage = "Urlaubssemester! Du musst eine Runde aussetzen.";
            break;
        case "härtefall":
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
                eventMessage = "Härtefallantrag! Ein Stein wurde verschoben.";
            }
            break;
        case "drittversuch":
            eventMessage = "Drittversuch! Du darfst nochmal ziehen, aber du hast einen Stein verloren.";
            skipTurn[player - 1] = "drittversuch";
            break;
        case "dekan":
            let tippCol = Math.floor(Math.random() * COLS) + 1;
            eventMessage = `Studiendekan-Tipp: "Setze in Spalte ${tippCol}" (aber ist das richtig?)`;
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

let chipSound = document.querySelector('#chip-sound');
if (chipSound && chipSound.components.sound) {
    chipSound.components.sound.playSound();
}
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
        let eventSound = document.querySelector('#event-sound');
        if (eventSound && eventSound.components.sound) {
            eventSound.components.sound.stopSound();
            eventSound.components.sound.playSound();
        }
        if (triggeredEvent === "drittversuch") {
            // Entferne den zuletzt gesetzten Stein
            // Entferne den allerersten eigenen Stein (am weitesten unten)
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
            // NICHT Spieler wechseln, sondern return: Spieler darf nochmal!
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

    // Drittversuch-Logik
    if (skipTurn[currentPlayer - 1] === "drittversuch") {
        skipTurn[currentPlayer - 1] = false;
        if (!checkWin(row, col, currentPlayer)) {
            // Kein Gewinn: Entferne einen eigenen Stein
            let ownStones = [];
            for (let r = 0; r < ROWS; r++)
                for (let c = 0; c < COLS; c++)
                    if (board[r][c] === currentPlayer) ownStones.push({ r, c });
            if (ownStones.length > 0) {
                let { r, c } = ownStones[Math.floor(Math.random() * ownStones.length)];
                board[r][c] = 0;
            }
        }
        // *** Spielerwechsel erst nach dem zweiten Zug! ***
        // Also: return hier, damit currentPlayer NICHT gewechselt wird
        sendRequest('*broadcast-message*', ['move', { board, currentPlayer, gameOver, semesterCount, skipTurn, eventMessage, eventFields }]);
        renderBoard();
        showGameStatus();
        return;
    }

    // Regelstudienzeit: 20 Semester
    if (semesterCount[currentPlayer - 1] >= 20) {
        gameOver = true;
    } else if (checkWin(row, col, currentPlayer)) {
        gameOver = true;
    } else if (isFull()) {
        gameOver = true;
    } else {
        currentPlayer = 3 - currentPlayer; // Spielerwechsel nur hier!
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

function getPlayerInfoText() {
    let farbe = myPlayerNumber === 1 ? "Rot" : myPlayerNumber === 2 ? "Gelb" : "-";
    return `Du bist Spieler ${myPlayerNumber || "-"} (${farbe}) | Raum: ${roomName}`;
}

function showGameStatus() {
    let info = getPlayerInfoText();
    if (gameOver) {
        // Gewinner ermitteln
        let winner = null;
        if (semesterCount[0] >= 20) winner = 1;
        if (semesterCount[1] >= 20) winner = 2;
        if (checkAnyWin()) winner = currentPlayer;

        if (winner) {
            if (myPlayerNumber === winner) {
                showMessage(`Bachelor erhalten! Studi-Legende!\n${info}`);
            } else if (myPlayerNumber === 1 || myPlayerNumber === 2) {
                showMessage(`Exmatrikuliert! Zu viele Prüfungsversuche.\n${info}`);
            } else {
                showMessage(`Spiel beendet.\n${info}`);
            }
        } else if (isFull()) {
            showMessage(`Unentschieden! Ihr bleibt ewige Studis.\n${info}`);
        }
    } else {
        showMessage(
            (eventMessage ? eventMessage + "\n" : "") +
            `Semester: ${semesterCount[0]} / ${semesterCount[1]}\n${info}`
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
        btn.style.top = "30px";
        btn.style.left = "50%";
        btn.style.transform = "translateX(-50%)";
        btn.style.fontSize = "1.2em";
        btn.style.padding = "12px 32px";
        btn.style.borderRadius = "24px";
        btn.style.border = "none";
        btn.style.background = "linear-gradient(90deg,rgb(255, 0, 0) 0%,rgb(255, 255, 0) 100%)";
        btn.style.color = "#fff";
        btn.style.fontWeight = "bold";
        btn.style.boxShadow = "0 4px 16px rgba(0,0,0,0.18)";
        btn.style.cursor = "pointer";
        btn.style.transition = "background 0.2s, transform 0.2s";
        btn.onmouseenter = () => {
            btn.style.background = "linear-gradient(90deg, rgb(255, 255, 0) 0%, rgb(255, 0, 0) 100%)";
            btn.style.transform = "translateX(-50%) scale(1.07)";
        };
        btn.onmouseleave = () => {
            btn.style.background = "linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(255, 255, 0) 100%)";
            btn.style.transform = "translateX(-50%) scale(1)";
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

function receiveRestart(data) {
    // Sound für neue Runde abspielen
    let startSound = document.querySelector('#start-sound');
    if (startSound && startSound.components.sound) {
        startSound.components.sound.stopSound();
        startSound.setAttribute('sound', 'volume', 4); // Lautstärke explizit setzen
        startSound.components.sound.playSound();
    }

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
    // Entferne alten Nachrichtentext, falls vorhanden
    let oldMsg = document.getElementById("aframe-message");
    if (oldMsg) oldMsg.parentNode.removeChild(oldMsg);

    // Erstelle neuen 3D-Text als <a-text>
    let textEntity = document.createElement("a-text");
    textEntity.setAttribute("id", "aframe-message");
    textEntity.setAttribute("value", msg);
    textEntity.setAttribute("font", "fonts/custom-msdf.json"); // Passe ggf. den Namen an
    textEntity.setAttribute("font-image", "fonts/custom.png"); // Passe ggf. den Namen an
    textEntity.setAttribute("color", "#FFFFFF");
    textEntity.setAttribute("width", "10");
    textEntity.setAttribute("align", "center");
    textEntity.setAttribute("position", `${COLS / 2 - 0.5} ${ROWS + 3} -6`);
    textEntity.setAttribute("scale", "1 1 1");

    // Füge den Text zur Szene hinzu
    let scene = document.querySelector("a-scene");
    scene.appendChild(textEntity);
}

document.addEventListener("DOMContentLoaded", function () {
    renderBoard();
    addRestartButton();
});