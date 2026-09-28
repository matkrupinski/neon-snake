(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const titleEl = document.getElementById("title");
  const statusEl = document.getElementById("status");
  const hintEl = document.getElementById("hint");
  const startBtn = document.getElementById("startBtn");
  const scoreEl = document.getElementById("score");
  const highEl = document.getElementById("highscore");
  const speedEl = document.getElementById("speed");
  const statusLine = document.getElementById("statusLine");

  const COLS = 24;
  const ROWS = 24;
  const STORAGE_KEY = "neon-snake-highscore";

  const state = {
    snake: [],
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: { x: 12, y: 8 },
    running: false,
    paused: false,
    dead: false,
    score: 0,
    high: Number(localStorage.getItem(STORAGE_KEY) || 0),
    lastTick: 0,
    stepMs: 140,
    particles: [],
    pulse: 0
  };

  function pad(n) {
    return String(n).padStart(4, "0");
  }

  function cell() {
    return canvas.width / COLS;
  }

  function updateHud() {
    scoreEl.textContent = pad(state.score);
    highEl.textContent = pad(state.high);
    const lvl = Math.min(9, Math.floor(state.score / 50) + 1);
    speedEl.textContent = String(lvl).padStart(2, "0");
  }

  function randomEmptyCell() {
    const taken = new Set(state.snake.map((s) => `${s.x},${s.y}`));
    let x, y, guard = 0;
    do {
      x = Math.floor(Math.random() * COLS);
      y = Math.floor(Math.random() * ROWS);
      guard += 1;
    } while (taken.has(`${x},${y}`) && guard < 500);
    return { x, y };
  }

  function resetGame() {
    const midY = Math.floor(ROWS / 2);
    state.snake = [
      { x: 8, y: midY },
      { x: 7, y: midY },
      { x: 6, y: midY }
    ];
    state.dir = { x: 1, y: 0 };
    state.nextDir = { x: 1, y: 0 };
    state.food = randomEmptyCell();
    state.score = 0;
    state.dead = false;
    state.paused = false;
    state.stepMs = 140;
    state.particles = [];
    updateHud();
  }

  function showOverlay(title, status, hint, buttonLabel) {
    titleEl.textContent = title;
    statusEl.textContent = status;
    hintEl.innerHTML = hint;
    startBtn.textContent = buttonLabel;
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function spawnParticles(x, y, color) {
    const s = cell();
    for (let i = 0; i < 14; i += 1) {
      const angle = (Math.PI * 2 * i) / 14;
      state.particles.push({
        x: x * s + s / 2,
        y: y * s + s / 2,
        vx: Math.cos(angle) * (1.4 + Math.random() * 2.2),
        vy: Math.sin(angle) * (1.4 + Math.random() * 2.2),
        life: 1,
        color
      });
    }
  }

  function setDirection(x, y) {
    if (!state.running || state.paused || state.dead) return;
    if (x === -state.dir.x && y === -state.dir.y) return;
    if (x === state.nextDir.x && y === state.nextDir.y) return;
    state.nextDir = { x, y };
  }

  function tick() {
    state.dir = state.nextDir;
    const head = state.snake[0];
    const next = {
      x: head.x + state.dir.x,
      y: head.y + state.dir.y
    };

    const hitWall = next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS;
    const hitSelf = state.snake.some((seg) => seg.x === next.x && seg.y === next.y);
    if (hitWall || hitSelf) {
      state.dead = true;
      state.running = false;
      statusLine.textContent = "STAN: TRACE LOST";
      if (state.score > state.high) {
        state.high = state.score;
        localStorage.setItem(STORAGE_KEY, String(state.high));
        updateHud();
      }
      showOverlay(
        "SYSTEM FAILURE",
        state.score >= state.high ? "NOWY REKORD" : "SNAKE TERMINATED",
        `WYNIK ${pad(state.score)} • REKORD ${pad(state.high)}<br/>SPACJA / PRZYCISK — restart`,
        "REBOOT"
      );
      return;
    }

    state.snake.unshift(next);
    if (next.x === state.food.x && next.y === state.food.y) {
      state.score += 10;
      state.stepMs = Math.max(62, 140 - Math.floor(state.score / 20) * 6);
      spawnParticles(state.food.x, state.food.y, "#ff2bd6");
      state.food = randomEmptyCell();
      updateHud();
    } else {
      state.snake.pop();
    }
  }

  function drawGrid() {
    const s = cell();
    ctx.save();
    ctx.strokeStyle = "rgba(0,246,255,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= COLS; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * s + 0.5, 0);
      ctx.lineTo(i * s + 0.5, canvas.height);
      ctx.stroke();
    }
    for (let j = 0; j <= ROWS; j += 1) {
      ctx.beginPath();
      ctx.moveTo(0, j * s + 0.5);
      ctx.lineTo(canvas.width, j * s + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function glowRect(x, y, w, h, color, blur) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function drawSnake() {
    const s = cell();
    state.snake.forEach((seg, i) => {
      const t = i / Math.max(1, state.snake.length - 1);
      const color = i === 0 ? "#00f6ff" : `rgba(${Math.round(0 + 180 * t)}, ${Math.round(246 - 80 * t)}, ${Math.round(255 - 40 * t)}, ${1 - t * 0.35})`;
      const pad = i === 0 ? 2 : 3.5;
      glowRect(seg.x * s + pad, seg.y * s + pad, s - pad * 2, s - pad * 2, color, i === 0 ? 18 : 8);
      if (i === 0) {
        ctx.fillStyle = "#031018";
        const eye = 3.2;
        const ox = state.dir.x !== 0 ? state.dir.x * 5 : 0;
        const oy = state.dir.y !== 0 ? state.dir.y * 5 : 0;
        ctx.fillRect(seg.x * s + s / 2 - 6 + ox, seg.y * s + s / 2 - 3 + oy, eye, eye);
        ctx.fillRect(seg.x * s + s / 2 + 2 + ox, seg.y * s + s / 2 - 3 + oy, eye, eye);
      }
    });
  }

  function drawFood() {
    const s = cell();
    const pulse = 0.65 + Math.sin(state.pulse * 0.12) * 0.35;
    const x = state.food.x * s + s / 2;
    const y = state.food.y * s + s / 2;
    ctx.save();
    ctx.shadowColor = "#ff2bd6";
    ctx.shadowBlur = 22;
    ctx.fillStyle = `rgba(255,43,214,${0.35 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, (s * 0.22) * pulse + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff0fb";
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles() {
    state.particles = state.particles.filter((p) => p.life > 0);
    state.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.03;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
      ctx.globalAlpha = 1;
    });
  }

  function render() {
    ctx.fillStyle = "#07010f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawFood();
    drawSnake();
    drawParticles();
  }

  function loop(ts) {
    state.pulse += 1;
    if (state.running && !state.paused && !state.dead) {
      if (ts - state.lastTick >= state.stepMs) {
        state.lastTick = ts;
        tick();
      }
    }
    render();
    requestAnimationFrame(loop);
  }

  function start() {
    resetGame();
    state.running = true;
    state.lastTick = performance.now();
    hideOverlay();
    canvas.focus();
    statusLine.textContent = "STAN: LIVE TRACE";
  }

  function togglePause() {
    if (!state.running || state.dead) return;
    state.paused = !state.paused;
    if (state.paused) {
      showOverlay("PAUZA", "TRACE SUSPENDED", "SPACJA — wznów<br/>STRZAŁKI / WASD — sterowanie", "WZNÓW");
      statusLine.textContent = "STAN: PAUZA";
    } else {
      hideOverlay();
      canvas.focus();
      statusLine.textContent = "STAN: LIVE TRACE";
    }
  }

  const keymap = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    KeyW: [0, -1],
    KeyS: [0, 1],
    KeyA: [-1, 0],
    KeyD: [1, 0]
  };

  window.addEventListener("keydown", (e) => {
    const map = keymap[e.code];
    if (map) {
      e.preventDefault();
      if (!state.running && !state.dead) start();
      else if (state.dead) start();
      else setDirection(map[0], map[1]);
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      if (!state.running) start();
      else togglePause();
    }
  });

  startBtn.addEventListener("click", () => {
    if (state.paused) {
      state.paused = false;
      hideOverlay();
      canvas.focus();
      statusLine.textContent = "STAN: LIVE TRACE";
      return;
    }
    start();
  });

  canvas.addEventListener("click", () => canvas.focus());

  updateHud();
  render();
  requestAnimationFrame(loop);
  canvas.focus();
})();
