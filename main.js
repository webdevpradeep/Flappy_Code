(function () {
  // --------- SAFE localStorage helpers ---------
  var STORAGE_KEY = 'flappy_code_best_v3';

  function safeGet(key) {
    try {
      if (window && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      // localStorage not available in this environment (SoloLearn sandbox) - fallback
    }
    return null;
  }

  function safeSet(key, value) {
    try {
      if (window && window.localStorage) {
        window.localStorage.setItem(key, value);
        return true;
      }
    } catch (e) {
      // ignore
    }
    return false;
  }

  // --------- DOM ---------
  var canvas = document.getElementById('gameCanvas');
  var ctx = canvas.getContext('2d');
  var wrapper = document.getElementById('wrapper');
  var overlay = document.getElementById('overlay');
  var startPanel = document.getElementById('startPanel');
  var gameOverPanel = document.getElementById('gameOverPanel');
  var finalScore = document.getElementById('finalScore');
  var scoreLabel = document.getElementById('scoreLabel');
  var bestLabel = document.getElementById('bestLabel');

  // --------- GAME STATE ---------
  var DPR = Math.max(1, window.devicePixelRatio || 1);
  var GAME = {
    width: 400,
    height: 600,
    running: false,
    lastTime: 0,
    score: 0,
    best: 0,
  };

  // Load best safely
  var loaded = safeGet(STORAGE_KEY);
  GAME.best = parseInt(loaded || '0', 10) || 0;

  // --------- PLAYER ---------
  var PLAYER = {
    x: 60,
    y: 240,
    size: 36,
    dy: 0,
    gravity: 1100, // px/s^2
    jumpVelocity: -340, // px/s
    rotation: 0,
    alive: true,
  };

  // --------- PIPES ---------
  var PIPES = {
    list: [],
    speed: 160, // px/s
    spawnInterval: 1500, // ms
    lastSpawn: 0,
    width: 64,
    gap: 140,
  };

  // --------- UTIL ---------
  function randRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function chooseSymbol() {
    var syms = ['{ }', '<>', '();', '==', '=>', '++'];
    return syms[Math.floor(Math.random() * syms.length)];
  }

  function resizeCanvas() {
    // choose a width based on wrapper width but keep ratio
    var rect = wrapper.getBoundingClientRect();
    var cssWidth = Math.max(320, Math.min(520, rect.width - 0));
    var cssHeight = Math.round(cssWidth * 1.35);

    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';

    // set backing store size for DPI
    canvas.width = Math.round(cssWidth * DPR);
    canvas.height = Math.round(cssHeight * DPR);

    // set transform so drawing coordinates are in CSS pixels
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    GAME.width = cssWidth;
    GAME.height = cssHeight;

    // reposition player proportionally
    PLAYER.x = Math.round(GAME.width * 0.15);
    PLAYER.y = Math.round(GAME.height * 0.45);
  }

  // --------- GAME LOGIC ---------
  function resetGame() {
    PIPES.list.length = 0;
    GAME.score = 0;
    PLAYER.dy = 0;
    PLAYER.alive = true;
    PIPES.lastSpawn = performance.now();
    GAME.lastTime = 0;
    updateLabels();
    // make sure overlay hidden
    overlay.style.display = 'none';
    startPanel.style.display = 'none';
    gameOverPanel.style.display = 'none';
  }

  function startGame() {
    resetGame();
    GAME.running = true;
    // begin loop
    requestAnimationFrame(loop);
  }

  function endGame() {
    GAME.running = false;
    PLAYER.alive = false;
    if (GAME.score > GAME.best) {
      GAME.best = GAME.score;
      safeSet(STORAGE_KEY, String(GAME.best));
    }
    finalScore.textContent = 'Score: ' + GAME.score;
    // show overlay with game over panel
    overlay.style.display = 'block';
    gameOverPanel.style.display = 'inline-block';
    startPanel.style.display = 'none';
    updateLabels();
  }

  function spawnPipe() {
    var minTop = 60;
    var maxTop = GAME.height - PIPES.gap - 80;
    var top = randRange(minTop, Math.max(minTop, Math.floor(maxTop)));
    PIPES.list.push({
      x: GAME.width + PIPES.width,
      top: top,
      bottom: GAME.height - top - PIPES.gap,
      width: PIPES.width,
      passed: false,
      symbol: chooseSymbol(),
    });
  }

  function rectIntersect(a, b) {
    return !(
      a.right < b.left ||
      a.left > b.right ||
      a.bottom < b.top ||
      a.top > b.bottom
    );
  }

  function update(dt) {
    if (!GAME.running) return;

    // physics
    PLAYER.dy += PLAYER.gravity * dt;
    PLAYER.y += PLAYER.dy * dt;
    PLAYER.rotation = Math.max(-1.0, Math.min(1.2, PLAYER.dy / 600));

    // collisions with floor/ceiling
    if (PLAYER.y + PLAYER.size / 2 >= GAME.height) {
      PLAYER.y = GAME.height - PLAYER.size / 2;
      endGame();
      return;
    }
    if (PLAYER.y - PLAYER.size / 2 <= 0) {
      PLAYER.y = PLAYER.size / 2;
      PLAYER.dy = Math.max(0, PLAYER.dy);
    }

    // update pipes
    for (var i = PIPES.list.length - 1; i >= 0; i--) {
      var p = PIPES.list[i];
      p.x -= PIPES.speed * dt;

      // score when passed
      if (!p.passed && p.x + p.width < PLAYER.x - PLAYER.size / 2) {
        p.passed = true;
        GAME.score += 1;
        updateLabels();
      }

      // collision detection
      var playerRect = {
        left: PLAYER.x - PLAYER.size / 2,
        right: PLAYER.x + PLAYER.size / 2,
        top: PLAYER.y - PLAYER.size / 2,
        bottom: PLAYER.y + PLAYER.size / 2,
      };
      var topRect = {
        left: p.x,
        right: p.x + p.width,
        top: 0,
        bottom: p.top,
      };
      var bottomRect = {
        left: p.x,
        right: p.x + p.width,
        top: GAME.height - p.bottom,
        bottom: GAME.height,
      };

      if (
        rectIntersect(playerRect, topRect) ||
        rectIntersect(playerRect, bottomRect)
      ) {
        endGame();
        return;
      }

      // cleanup off-screen
      if (p.x + p.width < -20) {
        PIPES.list.splice(i, 1);
      }
    }

    // spawn pipes
    var now = performance.now();
    if (now - PIPES.lastSpawn > PIPES.spawnInterval) {
      spawnPipe();
      PIPES.lastSpawn = now;
    }
  }

  // --------- DRAWING ---------
  function drawBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, GAME.height);
    g.addColorStop(0, '#0f3a57');
    g.addColorStop(1, '#072037');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, GAME.width, GAME.height);
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (!r) r = 6;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function draw() {
    // clear & background
    ctx.clearRect(0, 0, GAME.width, GAME.height);
    drawBackground();

    // draw pipes
    for (var i = 0; i < PIPES.list.length; i++) {
      var p = PIPES.list[i];
      // top
      ctx.fillStyle = '--pipe';
      ctx.fillStyle = '#14b8a6';
      roundRect(ctx, p.x, 0, p.width, p.top, 8);
      // bottom
      roundRect(ctx, p.x, GAME.height - p.bottom, p.width, p.bottom, 8);

      // symbol text (center)
      ctx.fillStyle = '#001f25';
      ctx.font = Math.max(12, Math.round(p.width * 0.28)) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // top area symbol
      ctx.fillText(p.symbol, p.x + p.width / 2, Math.max(12, p.top / 2));
      // bottom area symbol
      ctx.fillText(
        p.symbol,
        p.x + p.width / 2,
        GAME.height - Math.max(12, p.bottom / 2)
      );
    }

    // draw player
    ctx.save();
    ctx.translate(PLAYER.x, PLAYER.y);
    ctx.rotate(PLAYER.rotation);
    // body
    ctx.fillStyle = '#ffd166';
    roundRect(
      ctx,
      -PLAYER.size / 2,
      -PLAYER.size / 2,
      PLAYER.size,
      PLAYER.size,
      8
    );
    // screen
    ctx.fillStyle = '#083344';
    roundRect(
      ctx,
      -PLAYER.size / 2 + 6,
      -PLAYER.size / 2 + 6,
      PLAYER.size - 12,
      PLAYER.size - 12,
      6
    );
    // code symbol
    ctx.fillStyle = '#e6f0fb';
    ctx.font = Math.max(12, Math.round(PLAYER.size * 0.36)) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('< />', 0, 0);
    ctx.restore();

    // subtle ground line
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(0, GAME.height - 4, GAME.width, 4);
  }

  // --------- MAIN LOOP ---------
  function loop(timestamp) {
    if (!GAME.lastTime) GAME.lastTime = timestamp;
    var dt = (timestamp - GAME.lastTime) / 1000;
    if (dt > 0.05) dt = 0.05; // clamp large dt
    GAME.lastTime = timestamp;

    update(dt);
    draw();

    if (GAME.running) {
      requestAnimationFrame(loop);
    }
  }

  // --------- CONTROLS ---------
  function flap() {
    if (!GAME.running) {
      // if not running, start game (when user taps or presses)
      startGame();
      return;
    }
    if (!PLAYER.alive) return;
    PLAYER.dy = PLAYER.jumpVelocity;
  }

  // keyboard
  window.addEventListener(
    'keydown',
    function (e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        flap();
      }
    },
    false
  );

  // mouse / pointer
  canvas.addEventListener(
    'mousedown',
    function (e) {
      e.preventDefault();
      flap();
    },
    false
  );

  // touch
  canvas.addEventListener(
    'touchstart',
    function (e) {
      e.preventDefault();
      flap();
    },
    { passive: false }
  );

  // overlay (start / restart)
  overlay.addEventListener('click', function (e) {
    // if start panel visible -> start, else restart
    if (startPanel.style.display !== 'none') {
      startGame();
    } else if (gameOverPanel.style.display !== 'none') {
      startGame();
    }
  });

  // --------- UI helpers ---------
  function updateLabels() {
    scoreLabel.textContent = 'Score: ' + GAME.score;
    bestLabel.textContent = 'Best: ' + GAME.best;
  }

  // expose small debug API (optional)
  window.__FlappyCode = {
    start: startGame,
    end: endGame,
    getState: function () {
      return {
        score: GAME.score,
        best: GAME.best,
        running: GAME.running,
      };
    },
  };

  // --------- init ---------
  resizeCanvas();
  window.addEventListener('resize', function () {
    // avoid resizing during gameplay for stability; but still adjust canvas
    resizeCanvas();
    draw();
  });

  // initial UI
  overlay.style.display = 'block';
  startPanel.style.display = 'inline-block';
  gameOverPanel.style.display = 'none';
  updateLabels();
  draw();
})();
