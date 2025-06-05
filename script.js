document.addEventListener("DOMContentLoaded", function () {
    var BallPosition = { x: 0, y: 3.6, z: -10 };
    var score = 0;
    var highscore = 0;
    var mode = "easy";
    var modusIndex = 0; 
    var intervalId;

    function addSign() {
        var signEntity = document.createElement("a-entity");
        signEntity.setAttribute("class", "btn");
        signEntity.setAttribute("position", "0 3.6 -10");

        var textEntity = document.createElement("a-text");
        textEntity.setAttribute("value", "Start");
        textEntity.setAttribute("class", "btn-text");
        textEntity.setAttribute("color", "#FFFFFF");
        textEntity.setAttribute("align", "center");
        textEntity.setAttribute("scale", "2 2 2");

        var planeEntity = document.createElement("a-plane");
        planeEntity.setAttribute("class", "btn-plane");
        planeEntity.setAttribute("geometry", "primitive: plane; height: 3; width: 5");
        planeEntity.setAttribute("material", "color: #777");


        signEntity.appendChild(textEntity);
        signEntity.appendChild(planeEntity);
        document.querySelector("a-scene").appendChild(signEntity);

        var button = document.querySelector(".btn");
        button.addEventListener("click", function () {
            var interval = getInterval();

            this.remove();
            document.getElementById("content").innerHTML = "";
            score = 0;
            createScoreboard();
            intervalId = setInterval(function () {
                createBall();
            }, interval);
            TheEnd = setTimeout(function () {
                endgame();
            }, 30000);
        });
    }

    function createScoreboard() {
        var scoreboardEntity = document.createElement("a-entity");
        scoreboardEntity.setAttribute("position", "0 -0.6 -1");

        var scoreboardPlane = document.createElement("a-plane");
        scoreboardPlane.setAttribute("id", "scoreboard-plane");
        scoreboardPlane.setAttribute("color", "#333");
        scoreboardPlane.setAttribute("height", "0.1");
        scoreboardPlane.setAttribute("width", "0.2");
        document.getElementById("content").appendChild(scoreboardPlane);

        var scoreboard = document.createElement("a-text");
        scoreboard.setAttribute("id", "scoreboard");
        scoreboard.setAttribute("value", "Score");
        scoreboard.setAttribute("color", "#FFF");
        scoreboard.setAttribute("align", "center");
        scoreboard.setAttribute("scale", "0.17 0.17 0.17");

        scoreboardEntity.appendChild(scoreboard);
        scoreboardEntity.appendChild(scoreboardPlane);

        document.querySelector("a-camera").appendChild(scoreboardEntity);

        updateScoreboard();
    }

    function highlightScoreboard(color) {
        var scoreboardPlane = document.querySelector("#scoreboard-plane");
        scoreboardPlane.setAttribute("color", color);
        setTimeout(function () {
            scoreboardPlane.setAttribute("color", "#333333");
        }, 250);
    }


    function createBall() {
        var ball = document.createElement("a-sphere");
        var newPosition = getPosition();
        var ballSize = getBallSize();
        var overlap = checkOverlap(newPosition);

        while (overlap) {
            newPosition = getPosition();
            overlap = checkOverlap(newPosition);
        }

        var interval = getInterval();

        ball.setAttribute("position", `${newPosition.x} ${newPosition.y} ${newPosition.z}`);
        ball.setAttribute("radius", ballSize);
        ball.setAttribute("color", getRandomColor());

        ball.addEventListener('mouseenter', function () {
            var color = this.getAttribute("color");
            if (color === "#00FF00") {
                highlightScoreboard("#00FF00");
                score += 1;
            } else if (color === "#FF0000") {
                highlightScoreboard("#FF0000");
                score -= 1;
                if (score == -1) {
                    score = 0;
                    endgame();
                }
            } else if (color === "#000000") {
                score = 0;
                endgame();
            }
            updateScoreboard();
            this.remove();
        })

        document.getElementById("content").appendChild(ball);
        BallPosition = newPosition;
        setTimeout(function () {
            ball.remove();
        }, interval * 4);
    }

    function updateScoreboard() {
        document.getElementById("scoreboard").setAttribute("value", "Score: " + score);
    }

    function getPosition() {
        var maxLimit = 5;

        var offsetX = Math.round(Math.random()) * 2 - 1;
        var offsetY = Math.round(Math.random()) * 2 - 1;
        var offsetZ = Math.round(Math.random()) * 2 - 1;

        var newPosition = {
            x: clamp(BallPosition.x + offsetX, -maxLimit, maxLimit),
            y: clamp(BallPosition.y + offsetY, 0, maxLimit * 0.5),
            z: clamp(BallPosition.z + offsetZ, -maxLimit, maxLimit),
        };

        return newPosition;
    }

    function checkOverlap(newPosition) {
        var balls = document.querySelectorAll("a-sphere");
        for (var i = 0; i < balls.length; i++) {
            var ballPosition = balls[i].getAttribute("position");
            var ballX = parseFloat(ballPosition.x);
            var ballY = parseFloat(ballPosition.y);
            var ballZ = parseFloat(ballPosition.z);

            var distance = Math.sqrt(Math.pow(newPosition.x - ballX, 2) + Math.pow(newPosition.y - ballY, 2) + Math.pow(newPosition.z - ballZ, 2));
            if (distance < 0.4) {
                return true;
            }
        }
        return false;
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function getBallSize() {
        switch (mode) {
            case "easy":
                return 0.2;
            case "medium":
                return 0.15;
            case "hard":
                return 0.1;
        }
    }

    function getInterval() {
        switch (mode) {
            case "easy":
                return 500;
            case "medium":
                return 350;
            case "hard":
                return 200;
        }
    }

    function getRandomColor() {
        const randomNumber = Math.random() * 100;

        if (randomNumber < 10) {
            return '#000000';
        } else if (randomNumber < 50) {
            return '#FF0000';
        } else {
            return '#00FF00';
        }
    }

    function createScoreDisplay() {
        if (score > highscore) {
            highscore = score;
        }
        var scoreDisplayEntity = document.createElement("a-entity");
        scoreDisplayEntity.setAttribute("position", "-4.5 3.6 -10");

        var scoreDisplayPlane = document.createElement("a-plane");
        scoreDisplayPlane.setAttribute("color", "#444");
        scoreDisplayPlane.setAttribute("height", "2");
        scoreDisplayPlane.setAttribute("width", "3");
        scoreDisplayPlane.setAttribute("opacity", "0.8");

        var scoreDisplayText = document.createElement("a-text");
        scoreDisplayText.setAttribute("value", "Last Score: " + score + "\nHigh Score: " + highscore);
        scoreDisplayText.setAttribute("color", "#FFF");
        scoreDisplayText.setAttribute("scale", "1.5 1.5 1.5");
        scoreDisplayText.setAttribute("position", "-1 0 0");

        scoreDisplayEntity.appendChild(scoreDisplayPlane);
        scoreDisplayEntity.appendChild(scoreDisplayText);
        document.getElementById("content").appendChild(scoreDisplayEntity);
    }

    function createDiffSign() {
        var diffEntity = document.createElement("a-entity");
        diffEntity.setAttribute("position", "4.5 3.6 -10");

        var diffPlane = document.createElement("a-plane");
        diffPlane.setAttribute("color", "#444");
        diffPlane.setAttribute("height", "2");
        diffPlane.setAttribute("width", "3");
        diffPlane.setAttribute("opacity", "0.8");

        var diffText = document.createElement("a-text");
        diffText.setAttribute("value", "Schwierigkeit:" + "\n" + mode);
        diffText.setAttribute("align", "center");
        diffText.setAttribute("color", "#FFF");
        diffText.setAttribute("scale", "1.5 1.5 1.5");
        diffText.setAttribute("position", "0 0 0");

        diffEntity.appendChild(diffPlane);
        diffEntity.appendChild(diffText);
        diffEntity.addEventListener("click", function () {
            document.getElementById("content").innerHTML = "";
            document.querySelector(".btn").remove();
            showDifficultyOptions();
        });
        document.getElementById("content").appendChild(diffEntity);
    }

    function showDifficultyOptions() {
        document.getElementById("content").innerHTML = "";
        createDifficultyOption("easy");
        createDifficultyOption("medium");
        createDifficultyOption("hard");
        modusIndex = 0;
    }

    function createDifficultyOption(modus) {
        var optionEntity = document.createElement("a-entity");
        optionEntity.setAttribute("class", "btn");
        optionEntity.setAttribute("position", "0 " + (5.6 - modusIndex * 2.5) + " -10"); 

        var textEntity = document.createElement("a-text");
        textEntity.setAttribute("value", modus.charAt(0).toUpperCase() + modus.slice(1));
        textEntity.setAttribute("class", "btn-text");
        textEntity.setAttribute("color", "#FFFFFF");
        textEntity.setAttribute("align", "center");
        textEntity.setAttribute("scale", "2 2 2");

        var planeEntity = document.createElement("a-plane");
        planeEntity.setAttribute("class", "btn-plane");
        planeEntity.setAttribute("geometry", "primitive: plane; height: 3; width: 5");
        planeEntity.setAttribute("material", "color: #777");

        optionEntity.appendChild(textEntity);
        optionEntity.appendChild(planeEntity);

        document.getElementById("content").appendChild(optionEntity);

        optionEntity.addEventListener("click", function () {
            mode = modus;
            document.getElementById("content").innerHTML = "";
            startgame();
        })

        modusIndex++;

    }

    function endgame() {
        clearTimeout(TheEnd);
        clearInterval(intervalId);
        BallPosition = { x: 0, y: 3.6, z: -10 };

        document.getElementById("content").innerHTML = "";
        document.querySelector("a-camera").innerHTML = "<a-cursor></a-cursor>"
        startgame();
    }

    function startgame() {
        addSign();
        createScoreDisplay();
        createDiffSign();
    }

    startgame();
});