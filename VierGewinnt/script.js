// 3D Vier Gewinnt (4x4x4) mit A-Frame
document.addEventListener("DOMContentLoaded", function () {
    const ROWS = 6;
    const COLS = 7;
    let board = [];
    let currentPlayer = 1;
    let gameOver = false;

    function initBoard() {
        board = [];
        for (let r = 0; r < ROWS; r++) {
            board[r] = [];
            for (let c = 0; c < COLS; c++) {
                board[r][c] = 0;
            }
        }
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

        // Scheiben und Klickflächen
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                let chip = document.createElement("a-cylinder");
                chip.setAttribute("radius", "0.45");
                chip.setAttribute("height", "0.15");
                chip.setAttribute("segments-radial", "32");
                chip.setAttribute("position", `${c} ${ROWS-1-r} -6`);
                chip.setAttribute("rotation", "90 0 0");
                if (board[r][c] === 1) chip.setAttribute("color", "#FF0000");
                else if (board[r][c] === 2) chip.setAttribute("color", "#FFFF00");
                else chip.setAttribute("color", "#eee");
                content.appendChild(chip);
            }
        }

        // Klickflächen oben für jede Spalte
        if (!gameOver) {
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

    function makeMove(col) {
        if (gameOver) return;
        let row = getLowestEmptyRow(col);
        if (row === -1) return;
        board[row][col] = currentPlayer;
        if (checkWin(row, col, currentPlayer)) {
            gameOver = true;
            showMessage(`Spieler ${currentPlayer} gewinnt!`);
        } else if (isFull()) {
            gameOver = true;
            showMessage("Unentschieden!");
        } else {
            currentPlayer = 3 - currentPlayer;
            showMessage(`Spieler ${currentPlayer} ist am Zug`);
        }
        renderBoard();
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
        // 4 Richtungen prüfen
        return (
            1 + countDir(0, 1) + countDir(0, -1) >= 4 || // horizontal
            1 + countDir(1, 0) + countDir(-1, 0) >= 4 || // vertikal
            1 + countDir(1, 1) + countDir(-1, -1) >= 4 || // diagonal /
            1 + countDir(1, -1) + countDir(-1, 1) >= 4    // diagonal \
        );
    }

    function isFull() {
        for (let c = 0; c < COLS; c++)
            if (board[0][c] === 0) return false;
        return true;
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
                gameOver = false;
                currentPlayer = 1;
                initBoard();
                renderBoard();
                showMessage("Spieler 1 ist am Zug");
            };
            document.body.appendChild(btn);
        }
    }

    function startGame() {
        initBoard();
        renderBoard();
        showMessage("Spieler 1 ist am Zug");
        addRestartButton();
    }

    startGame();
});