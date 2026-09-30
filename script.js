(() => {
  "use strict";

  const canvas = document.querySelector("#game-canvas");
  const ctx = canvas.getContext("2d");
  const gridSize = 24;
  const cellSize = canvas.width / gridSize;
  const highScoreKey = "neon-snake-high-score";

  const ui = {
    score: document.querySelector("#score"),
    highScore: document.querySelector("#high-score"),
    length: document.querySelector("#length"),
    speed: document.querySelector("#speed"),
    scoreBar: document.querySelector("#score-bar-fill"),
    status: document.querySelector("#status-text"),
    mode: document.querySelector("#game-mode"),
    session: document.querySelector("#session-id"),
    overlay: document.querySelector("#game-overlay"),
    overlayKicker: document.querySelector("#overlay-kicker"),
    overlayTitle: document.querySelector("#overlay-title"),
    overlayCopy: document.querySelector("#overlay-copy"),
    overlayButton: document.querySelector("#overlay-button"),
    startButton: document.querySelector("#start-button"),
    pauseButton: document.querySelector("#pause-button"),
  };

  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const keyDirections = {
    ArrowUp: "up", w: "up", W: "up",
    ArrowDown: "down", s: "down", S: "down",
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
  };

  let snake;
  let food;
  let direction;
  let nextDirection;
  let score;
  let highScore = readHighScore();
  let state = "idle";
  let animationFrame;
  let lastTime = 0;
  let accumulator = 0;
  let sessionNumber = Math.floor(1000 + Math.random() * 9000);

  function readHighScore() {
    try {
      const saved = Number.parseInt(localStorage.getItem(highScoreKey) || "0", 10);
      return Number.isFinite(saved) && saved > 0 ? saved : 0;
    } catch {
      return 0;
    }
  }

  function saveHighScore(value) {
    try {
      localStorage.setItem(highScoreKey, String(value));
    } catch {
      // Gra działa również w trybie prywatnym, tylko bez trwałego zapisu.
    }
  }

  function createSnake() {
    const middle = Math.floor(gridSize / 2);
    return [
      { x: middle, y: middle },
      { x: middle - 1, y: middle },
      { x: middle - 2, y: middle },
    ];
  }

  function resetGame() {
    snake = createSnake();
    direction = { ...directions.right };
    nextDirection = { ...directions.right };
    score = 0;
    accumulator = 0;
    food = placeFood();
    updateUi();
    draw();
  }

  function placeFood() {
    const available = [];
    for (let y = 0; y < gridSize; y += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        if (!snake.some((segment) => segment.x === x && segment.y === y)) available.push({ x, y });
      }
    }
    return available.length ? available[Math.floor(Math.random() * available.length)] : null;
  }

  function getTickMs() {
    return Math.max(65, 145 - Math.floor(score / 4) * 7);
  }

  function getSpeedLevel() {
    return Math.min(10, 1 + Math.floor(score / 4));
  }

  function startGame() {
    if (state === "gameover" || state === "won") {
      sessionNumber = Math.floor(1000 + Math.random() * 9000);
      resetGame();
    }
    if (state === "running") return;
    state = "running";
    lastTime = performance.now();
    accumulator = 0;
    ui.overlay.classList.add("is-hidden");
    ui.pauseButton.disabled = false;
    ui.startButton.textContent = "RESTART RUN ↗";
    ui.pauseButton.innerHTML = 'PAUSE <span>Ⅱ</span>';
    ui.status.textContent = "Transmisja aktywna — prowadź węża";
    ui.mode.textContent = "LIVE / RUNNING";
    canvas.focus({ preventScroll: true });
  }

  function pauseGame() {
    if (state !== "running" && state !== "paused") return;
    if (state === "running") {
      state = "paused";
      showOverlay("SIGNAL PAUSED", "RUN SUSPENDED", "Naciśnij P lub przycisk, aby wrócić do transmisji.", "RESUME RUN");
      ui.status.textContent = "Transmisja wstrzymana";
      ui.mode.textContent = "PAUSED / HOLD";
    } else {
      startGame();
    }
    updateUi();
  }

  function endGame(won = false) {
    state = won ? "won" : "gameover";
    if (score > highScore) {
      highScore = score;
      saveHighScore(highScore);
    }
    ui.pauseButton.disabled = true;
    ui.startButton.textContent = "NEW RUN ↗";
    ui.status.textContent = won ? "Siatka przejęta — perfekcyjny run" : "Ślad utracony — kolizja wykryta";
    ui.mode.textContent = won ? "GRID CAPTURED" : "SIGNAL LOST";
    showOverlay(won ? "GRID CAPTURED" : "SIGNAL LOST", won ? "FULL CLEAR" : "RUN TERMINATED", won ? `Wynik końcowy: ${formatNumber(score)} pkt.` : `Wynik końcowy: ${formatNumber(score)} pkt. Spróbuj ponownie.`, "NEW RUN");
    updateUi();
  }

  function showOverlay(kicker, title, copy, buttonLabel) {
    ui.overlayKicker.textContent = kicker;
    ui.overlayTitle.textContent = title;
    ui.overlayCopy.textContent = copy;
    ui.overlayButton.innerHTML = `${buttonLabel} <span>↗</span>`;
    ui.overlay.classList.remove("is-hidden");
  }

  function queueDirection(name) {
    if (!directions[name] || state === "gameover" || state === "won") return;
    const candidate = directions[name];
    if (candidate.x + direction.x === 0 && candidate.y + direction.y === 0) return;
    nextDirection = { ...candidate };
    if (state === "idle") startGame();
  }

  function update() {
    direction = { ...nextDirection };
    const head = snake[0];
    const nextHead = { x: head.x + direction.x, y: head.y + direction.y };
    const hitWall = nextHead.x < 0 || nextHead.x >= gridSize || nextHead.y < 0 || nextHead.y >= gridSize;
    const eating = food && nextHead.x === food.x && nextHead.y === food.y;
    const bodyToCheck = eating ? snake : snake.slice(0, -1);
    const hitSelf = bodyToCheck.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);

    if (hitWall || hitSelf) {
      endGame(false);
      return;
    }

    snake.unshift(nextHead);
    if (eating) {
      score += 1;
      food = placeFood();
      if (!food) {
        endGame(true);
        return;
      }
    } else {
      snake.pop();
    }
    updateUi();
  }

  function frame(time) {
    const delta = Math.min(time - lastTime, 100);
    lastTime = time;
    if (state === "running") {
      accumulator += delta;
      const tickMs = getTickMs();
      while (accumulator >= tickMs) {
        update();
        accumulator -= tickMs;
        if (state !== "running") break;
      }
    }
    draw(time);
    animationFrame = requestAnimationFrame(frame);
  }

  function roundRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.roundRect(x, y, width, height, r);
    context.closePath();
  }

  function drawGrid() {
    ctx.fillStyle = "#07101b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.45, 20, canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.75);
    gradient.addColorStop(0, "rgba(21, 52, 73, .34)");
    gradient.addColorStop(1, "rgba(3, 8, 17, .65)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(113, 190, 218, .085)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridSize; i += 1) {
      const pos = i * cellSize + 0.5;
      ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(canvas.width, pos); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(99, 245, 255, .14)";
    ctx.setLineDash([2, 9]);
    ctx.strokeRect(cellSize * 0.5, cellSize * 0.5, canvas.width - cellSize, canvas.height - cellSize);
    ctx.setLineDash([]);
  }

  function drawFood(time = 0) {
    if (!food) return;
    const cx = food.x * cellSize + cellSize / 2;
    const cy = food.y * cellSize + cellSize / 2;
    const pulse = 1 + Math.sin(time / 180) * 0.13;
    ctx.save();
    ctx.shadowColor = "#ff4fb3";
    ctx.shadowBlur = 28;
    ctx.fillStyle = "rgba(255, 79, 179, .18)";
    ctx.beginPath(); ctx.arc(cx, cy, cellSize * 0.38 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 13;
    ctx.fillStyle = "#ff4fb3";
    ctx.beginPath(); ctx.arc(cx, cy, cellSize * 0.19 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffd6ef";
    ctx.beginPath(); ctx.arc(cx - 2, cy - 2, cellSize * 0.065, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawSnake() {
    ctx.save();
    snake.forEach((segment, index) => {
      const inset = index === 0 ? 3 : 4.5;
      const x = segment.x * cellSize + inset;
      const y = segment.y * cellSize + inset;
      const size = cellSize - inset * 2;
      const alpha = Math.max(0.32, 1 - index / (snake.length * 1.25));
      ctx.shadowColor = "#63f5ff";
      ctx.shadowBlur = index === 0 ? 24 : 10;
      ctx.fillStyle = index === 0 ? "#b9fbff" : `rgba(99, 245, 255, ${alpha})`;
      roundRect(ctx, x, y, size, size, 4);
      ctx.fill();
      if (index === 0) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#06202b";
        const eyeOffsetX = direction.x !== 0 ? (direction.x > 0 ? 5 : 2) : 4;
        const eyeOffsetY = direction.y !== 0 ? (direction.y > 0 ? 5 : 2) : 4;
        const eyeGap = 7;
        ctx.beginPath(); ctx.arc(x + eyeOffsetX + (direction.y === 0 ? 0 : 1), y + eyeOffsetY + (direction.x === 0 ? 0 : 1), 1.7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + eyeOffsetX + (direction.y === 0 ? 0 : eyeGap), y + eyeOffsetY + (direction.x === 0 ? eyeGap : 0), 1.7, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.restore();
  }

  function draw(time = 0) {
    drawGrid();
    drawFood(time);
    drawSnake();
  }

  function formatNumber(value) { return String(value).padStart(3, "0"); }

  function updateUi() {
    ui.score.textContent = formatNumber(score);
    ui.highScore.textContent = formatNumber(highScore);
    ui.length.textContent = String(snake.length).padStart(2, "0");
    ui.speed.textContent = String(getSpeedLevel()).padStart(2, "0");
    ui.scoreBar.style.width = `${Math.min(100, 4 + score * 6)}%`;
    ui.session.textContent = String(sessionNumber);
  }

  function handleKey(event) {
    const directionName = keyDirections[event.key];
    if (directionName) {
      event.preventDefault();
      queueDirection(directionName);
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (state === "running") pauseGame(); else startGame();
      return;
    }
    if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      pauseGame();
    }
  }

  function bindEvents() {
    window.addEventListener("keydown", handleKey, { passive: false });
    ui.startButton.addEventListener("click", () => {
      if (state === "running") { resetGame(); }
      startGame();
    });
    ui.pauseButton.addEventListener("click", pauseGame);
    ui.overlayButton.addEventListener("click", () => {
      if (state === "paused") pauseGame(); else startGame();
    });
    document.querySelectorAll("[data-direction]").forEach((button) => {
      button.addEventListener("click", () => queueDirection(button.dataset.direction));
    });
    canvas.addEventListener("click", () => canvas.focus({ preventScroll: true }));
  }

  resetGame();
  bindEvents();
  showOverlay("SYSTEM READY", "ENTER THE GRID", "Naciśnij Enter lub kliknij przycisk, aby rozpocząć.", "START RUN");
  animationFrame = requestAnimationFrame((time) => {
    lastTime = time;
    frame(time);
  });

  window.neonSnake = {
    getState: () => ({ state, score, highScore, length: snake.length, direction: { ...direction } }),
    start: startGame,
    pause: pauseGame,
  };
})();
