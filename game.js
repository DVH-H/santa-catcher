"use strict";

// ============================================================
// CONFIG - everything you will want to tweak is in this section
// ============================================================

const GAME_SECONDS = 60;
const RANDOM_SEED = 2026; // same seed = every player gets the exact same drops (fair contest)
const GAME_WIDTH = 360;
const GAME_HEIGHT = 640;

// Optional images. If a file is missing the emoji is drawn instead.
const BACKGROUND_IMAGE = "img/background.png";
const SANTA_IMAGE = "img/santa.png";
const SANTA_EMOJI = "🛷";
const SANTA_DRAW_SIZE = 84;
const SANTA_CATCH_WIDTH = 70;

// points: negative = penalty. weight: how often it drops. size: draw size in px.
const ITEMS = {
  gift:      { emoji: "🎁", image: "img/gift.png",      points: 10,  weight: 30, size: 44 },
  cookie:    { emoji: "🍪", image: "img/cookie.png",    points: 5,   weight: 18, size: 38 },
  milk:      { emoji: "🥛", image: "img/milk.png",      points: 5,   weight: 18, size: 38 },
  candy:     { emoji: "🍬", image: "img/candy.png",     points: 3,   weight: 22, size: 36 },
  snowflake: { emoji: "❄️", image: "img/snowflake.png", points: 2,   weight: 14, size: 38 },
  star:      { emoji: "⭐", image: "img/star.png",      points: 25,  weight: 6,  size: 40 },
  coal:      { emoji: "🪨", image: "img/coal.png",      points: -20, weight: 16, size: 40 }
};

// A combo fires when the LAST catches match the sequence exactly.
// Catching anything else in between simply breaks the chain (not counted).
// Items that fall past Santa do NOT break the chain, only catches do.
const COMBOS = [
  { name: "Mælk & småkager", sequence: ["cookie", "milk"],             multiplier: 2, multiplierSeconds: 8 },
  { name: "Sukkerchok",      sequence: ["candy", "candy", "candy"],    multiplier: 3, multiplierSeconds: 5 },
  { name: "Ønsket opfyldt",  sequence: ["star", "gift"],               bonusPoints: 100 },
  { name: "Snemand",         sequence: ["snowflake", "snowflake"],     bonusPoints: 20, slowSeconds: 5 },
  { name: "Tilgivelse",      sequence: ["coal", "gift"],               bonusPoints: 50 }
];

const TEXT = {
  title: "Julemandens Grabber",
  intro: "Træk fingeren for at styre kane. Grib gaver, undgå kul!",
  start: "Start",
  again: "Spil igen",
  namePlaceholder: "Dit navn",
  gameOver: "Tid!",
  best: "Din bedste",
  showHost: "Vis denne skærm til Daniel"
};

// ============================================================
// Helpers
// ============================================================

function createRandomGenerator(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Storage can be blocked in private mode. The game still works without it.
  }
}

// ============================================================
// Images (emoji fallback)
// ============================================================

const imageById = {};

function loadImage(id, path) {
  const image = new Image();
  const entry = { image: image, loaded: false };
  image.onload = function () {
    entry.loaded = true;
  };
  image.src = path;
  imageById[id] = entry;
}

loadImage("background", BACKGROUND_IMAGE);
loadImage("santa", SANTA_IMAGE);
for (const itemId of Object.keys(ITEMS)) {
  loadImage(itemId, ITEMS[itemId].image);
}

function drawIcon(context, id, emoji, centerX, centerY, size) {
  const entry = imageById[id];
  if (entry && entry.loaded) {
    const ratio = entry.image.naturalWidth / entry.image.naturalHeight;
    const drawWidth = ratio >= 1 ? size : size * ratio;
    const drawHeight = ratio >= 1 ? size / ratio : size;
    context.drawImage(entry.image, centerX - drawWidth / 2, centerY - drawHeight / 2, drawWidth, drawHeight);
    return;
  }
  context.font = Math.round(size * 0.85) + "px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(emoji, centerX, centerY);
}

// ============================================================
// Game state
// ============================================================

const canvas = document.getElementById("game");
const context = canvas.getContext("2d");
const frame = document.getElementById("frame");
const overlay = document.getElementById("overlay");

const FIXED_STEP_SECONDS = 1 / 60; // fixed step = same result on 60 Hz and 120 Hz phones
const SANTA_Y = GAME_HEIGHT - 70;

let gameMode = "menu"; // menu | playing | over
let nextRandom = createRandomGenerator(RANDOM_SEED);
let score = 0;
let timeLeftSeconds = GAME_SECONDS;
let elapsedSeconds = 0;
let spawnCountdownSeconds = 0.5;
let fallingItems = [];
let recentCatches = [];
let popups = [];
let banner = null;
let multiplierValue = 1;
let multiplierSecondsLeft = 0;
let slowSecondsLeft = 0;
let santaX = GAME_WIDTH / 2;
let targetX = GAME_WIDTH / 2;
let snowflakes = [];

for (let index = 0; index < 40; index++) {
  snowflakes.push({
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT,
    radius: 1 + Math.random() * 2,
    speed: 20 + Math.random() * 30
  });
}

function startGame() {
  nextRandom = createRandomGenerator(RANDOM_SEED);
  score = 0;
  timeLeftSeconds = GAME_SECONDS;
  elapsedSeconds = 0;
  spawnCountdownSeconds = 0.5;
  fallingItems = [];
  recentCatches = [];
  popups = [];
  banner = null;
  multiplierValue = 1;
  multiplierSecondsLeft = 0;
  slowSecondsLeft = 0;
  santaX = GAME_WIDTH / 2;
  targetX = GAME_WIDTH / 2;
  gameMode = "playing";
  overlay.style.display = "none";
}

function endGame() {
  gameMode = "over";
  const finalScore = Math.round(score);
  const previousBest = Number(safeStorageGet("santaBest") || 0);
  let newBest = previousBest;
  if (finalScore > previousBest) {
    newBest = finalScore;
    safeStorageSet("santaBest", String(finalScore));
  }
  showOverlay(true, finalScore, newBest);
}

// ============================================================
// Spawning and simulation
// ============================================================

function pickItemId() {
  let totalWeight = 0;
  const itemIds = Object.keys(ITEMS);
  for (const itemId of itemIds) {
    totalWeight += ITEMS[itemId].weight;
  }
  let roll = nextRandom() * totalWeight;
  for (const itemId of itemIds) {
    roll -= ITEMS[itemId].weight;
    if (roll <= 0) {
      return itemId;
    }
  }
  return itemIds[0];
}

function spawnItem() {
  const itemId = pickItemId();
  const definition = ITEMS[itemId];
  const progress = elapsedSeconds / GAME_SECONDS; // 0 -> 1 over the round
  const baseSpeed = 140 + 150 * progress;
  const speed = baseSpeed * (0.85 + nextRandom() * 0.3);
  const margin = definition.size / 2 + 6;
  const x = margin + nextRandom() * (GAME_WIDTH - margin * 2);
  const spinPhase = nextRandom() * Math.PI * 2;
  fallingItems.push({ id: itemId, x: x, y: -definition.size, speed: speed, spinPhase: spinPhase });

  const minGap = 0.85 - 0.45 * progress;
  const maxGap = 1.2 - 0.6 * progress;
  spawnCountdownSeconds = minGap + nextRandom() * (maxGap - minGap);
}

function sequenceEndsRecent(sequence) {
  if (recentCatches.length < sequence.length) {
    return false;
  }
  const offset = recentCatches.length - sequence.length;
  for (let index = 0; index < sequence.length; index++) {
    if (recentCatches[offset + index] !== sequence[index]) {
      return false;
    }
  }
  return true;
}

// How many items of the sequence are already caught in a row (0 = not started).
function sequenceProgress(sequence) {
  const longestStart = Math.min(recentCatches.length, sequence.length - 1);
  for (let length = longestStart; length >= 1; length--) {
    const offset = recentCatches.length - length;
    let matches = true;
    for (let index = 0; index < length; index++) {
      if (recentCatches[offset + index] !== sequence[index]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return length;
    }
  }
  return 0;
}

function addPopup(text, x, y, color) {
  popups.push({ text: text, x: x, y: y, color: color, lifeSeconds: 0.9 });
}

function triggerCombo(combo) {
  let bonusText = "";
  if (combo.bonusPoints) {
    score += combo.bonusPoints;
    bonusText = "+" + combo.bonusPoints;
  }
  if (combo.multiplier) {
    multiplierValue = combo.multiplier;
    multiplierSecondsLeft = combo.multiplierSeconds;
    bonusText = "x" + combo.multiplier;
  }
  if (combo.slowSeconds) {
    slowSecondsLeft = combo.slowSeconds;
  }
  banner = { text: combo.name + " " + bonusText, lifeSeconds: 1.6 };
}

function handleCatch(itemId, x) {
  const definition = ITEMS[itemId];
  let gained = definition.points;
  if (gained > 0) {
    gained = gained * multiplierValue;
  }
  score = Math.max(0, score + gained);

  if (gained > 0) {
    addPopup("+" + gained, x, SANTA_Y - 30, "#ffe27a");
  } else {
    addPopup(String(gained), x, SANTA_Y - 30, "#ff6b6b");
  }

  if (definition.points < 0) {
    multiplierValue = 1;
    multiplierSecondsLeft = 0;
  }

  recentCatches.push(itemId);
  if (recentCatches.length > 6) {
    recentCatches.shift();
  }

  let bestCombo = null;
  for (const combo of COMBOS) {
    if (!sequenceEndsRecent(combo.sequence)) {
      continue;
    }
    if (bestCombo === null || combo.sequence.length > bestCombo.sequence.length) {
      bestCombo = combo;
    }
  }
  if (bestCombo !== null) {
    triggerCombo(bestCombo);
    recentCatches = [];
  }
}

function step(dt) {
  elapsedSeconds += dt;
  timeLeftSeconds -= dt;
  if (timeLeftSeconds <= 0) {
    timeLeftSeconds = 0;
    endGame();
    return;
  }

  if (multiplierSecondsLeft > 0) {
    multiplierSecondsLeft -= dt;
    if (multiplierSecondsLeft <= 0) {
      multiplierSecondsLeft = 0;
      multiplierValue = 1;
    }
  }
  if (slowSecondsLeft > 0) {
    slowSecondsLeft = Math.max(0, slowSecondsLeft - dt);
  }

  spawnCountdownSeconds -= dt;
  if (spawnCountdownSeconds <= 0) {
    spawnItem();
  }

  santaX += (targetX - santaX) * Math.min(1, 18 * dt);

  const speedFactor = slowSecondsLeft > 0 ? 0.5 : 1;
  const stillFalling = [];
  for (const item of fallingItems) {
    item.y += item.speed * speedFactor * dt;
    const definition = ITEMS[item.id];

    const reachedSantaHeight = item.y + definition.size / 3 >= SANTA_Y - 12 && item.y <= SANTA_Y + 16;
    const insideCatchWidth = Math.abs(item.x - santaX) <= SANTA_CATCH_WIDTH / 2 + definition.size / 3;
    if (reachedSantaHeight && insideCatchWidth) {
      handleCatch(item.id, item.x);
      continue;
    }
    if (item.y > GAME_HEIGHT + 50) {
      continue;
    }
    stillFalling.push(item);
  }
  fallingItems = stillFalling;

  for (const popup of popups) {
    popup.lifeSeconds -= dt;
    popup.y -= 40 * dt;
  }
  popups = popups.filter(function (popup) {
    return popup.lifeSeconds > 0;
  });
  if (banner !== null) {
    banner.lifeSeconds -= dt;
    if (banner.lifeSeconds <= 0) {
      banner = null;
    }
  }
}

// ============================================================
// Rendering
// ============================================================

function drawBackground(dt) {
  const background = imageById.background;
  if (background.loaded) {
    context.drawImage(background.image, 0, 0, GAME_WIDTH, GAME_HEIGHT);
  } else {
    const gradient = context.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, "#0b1d3a");
    gradient.addColorStop(1, "#27518f");
    context.fillStyle = gradient;
    context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
  context.fillStyle = "rgba(255,255,255,0.7)";
  for (const flake of snowflakes) {
    flake.y += flake.speed * dt;
    if (flake.y > GAME_HEIGHT) {
      flake.y = -4;
      flake.x = Math.random() * GAME_WIDTH;
    }
    context.beginPath();
    context.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.fillStyle = "#e8f1ff";
  context.fillRect(0, GAME_HEIGHT - 24, GAME_WIDTH, 24);
}

function drawText(text, x, y, size, color, align) {
  context.font = "bold " + size + "px system-ui, sans-serif";
  context.textAlign = align;
  context.textBaseline = "middle";
  context.lineWidth = 4;
  context.strokeStyle = "rgba(0,0,0,0.55)";
  context.strokeText(text, x, y);
  context.fillStyle = color;
  context.fillText(text, x, y);
}

function drawChainHints() {
  let row = 0;
  for (const combo of COMBOS) {
    const progress = sequenceProgress(combo.sequence);
    if (progress === 0 || row >= 2) {
      continue;
    }
    const y = 78 + row * 30;
    let x = 22;
    context.globalAlpha = 1;
    for (let index = 0; index < progress; index++) {
      const itemId = combo.sequence[index];
      drawIcon(context, itemId, ITEMS[itemId].emoji, x, y, 24);
      x += 28;
    }
    drawText("→", x, y, 18, "#ffffff", "center");
    x += 26;
    const nextId = combo.sequence[progress];
    context.globalAlpha = 0.65;
    drawIcon(context, nextId, ITEMS[nextId].emoji, x, y, 24);
    context.globalAlpha = 1;
    row++;
  }
}

function render(dt) {
  drawBackground(dt);

  for (const item of fallingItems) {
    const definition = ITEMS[item.id];
    const wobble = Math.sin(elapsedSeconds * 3 + item.spinPhase) * 0.25;
    context.save();
    context.translate(item.x, item.y);
    context.rotate(wobble);
    drawIcon(context, item.id, definition.emoji, 0, 0, definition.size);
    context.restore();
  }

  drawIcon(context, "santa", SANTA_EMOJI, santaX, SANTA_Y, SANTA_DRAW_SIZE);

  for (const popup of popups) {
    context.globalAlpha = Math.min(1, popup.lifeSeconds * 2);
    drawText(popup.text, popup.x, popup.y, 22, popup.color, "center");
    context.globalAlpha = 1;
  }

  if (gameMode === "playing") {
    drawText("Point " + Math.round(score), 14, 24, 22, "#ffffff", "left");
    drawText(String(Math.ceil(timeLeftSeconds)) + "s", GAME_WIDTH - 14, 24, 22, "#ffffff", "right");
    if (multiplierSecondsLeft > 0) {
      drawText("x" + multiplierValue + "  " + multiplierSecondsLeft.toFixed(1) + "s", GAME_WIDTH / 2, 52, 22, "#7dffa0", "center");
    }
    if (slowSecondsLeft > 0) {
      drawText("❄ langsom " + slowSecondsLeft.toFixed(1) + "s", GAME_WIDTH / 2, 78, 16, "#b8e4ff", "center");
    }
    drawChainHints();
    if (banner !== null) {
      context.globalAlpha = Math.min(1, banner.lifeSeconds * 2);
      drawText(banner.text, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 26, "#ffe27a", "center");
      context.globalAlpha = 1;
    }
  }
}

// ============================================================
// Overlay (menu and game over)
// ============================================================

function iconHtml(itemId) {
  const definition = ITEMS[itemId];
  return '<span class="icon"><img src="' + definition.image + '" alt="" onerror="this.replaceWith(document.createTextNode(\'' + definition.emoji + '\'))"></span>';
}

function describeCombo(combo) {
  const parts = [];
  if (combo.bonusPoints) {
    parts.push("+" + combo.bonusPoints);
  }
  if (combo.multiplier) {
    parts.push("x" + combo.multiplier + " i " + combo.multiplierSeconds + "s");
  }
  if (combo.slowSeconds) {
    parts.push("langsomt " + combo.slowSeconds + "s");
  }
  return parts.join(" + ");
}

function buildLegendHtml() {
  let html = "";
  for (const combo of COMBOS) {
    const icons = combo.sequence.map(iconHtml).join('<span class="arrow">→</span>');
    html += '<div class="combo"><div class="combo-icons">' + icons + '</div><div class="combo-text"><b>' +
      combo.name + "</b> " + describeCombo(combo) + "</div></div>";
  }
  return html;
}

function showOverlay(isGameOver, finalScore, bestScore) {
  const savedName = safeStorageGet("santaName") || "";
  let headline = "";
  if (isGameOver) {
    headline = '<h2>' + TEXT.gameOver + '</h2><div class="big-score" id="finalScore"></div><div class="small">' +
      TEXT.best + ": " + bestScore + "</div>";
  } else {
    headline = "<h1>" + TEXT.title + "</h1><p>" + TEXT.intro + "</p>";
  }
  overlay.innerHTML = headline +
    '<input id="nameInput" maxlength="16" placeholder="' + TEXT.namePlaceholder + '">' +
    '<button id="startButton">' + (isGameOver ? TEXT.again : TEXT.start) + "</button>" +
    (isGameOver ? '<div class="small">' + TEXT.showHost + "</div>" : "") +
    '<div class="legend">' + buildLegendHtml() +
    '<div class="combo"><div class="combo-icons">' + iconHtml("coal") + '</div><div class="combo-text"><b>Kul</b> -20 og mister multiplikator</div></div></div>';

  const nameInput = document.getElementById("nameInput");
  nameInput.value = savedName;
  nameInput.addEventListener("input", function () {
    safeStorageSet("santaName", nameInput.value);
  });
  if (isGameOver) {
    const scoreLine = document.getElementById("finalScore");
    const playerName = nameInput.value.trim();
    scoreLine.textContent = (playerName ? playerName + ": " : "") + finalScore;
    nameInput.addEventListener("input", function () {
      const updatedName = nameInput.value.trim();
      scoreLine.textContent = (updatedName ? updatedName + ": " : "") + finalScore;
    });
  }
  document.getElementById("startButton").addEventListener("click", startGame);
  overlay.style.display = "flex";
}

// ============================================================
// Input and sizing
// ============================================================

function updateTargetFromPointer(event) {
  const rectangle = canvas.getBoundingClientRect();
  const relativeX = (event.clientX - rectangle.left) / rectangle.width;
  targetX = Math.max(0, Math.min(GAME_WIDTH, relativeX * GAME_WIDTH));
}

canvas.addEventListener("pointerdown", function (event) {
  canvas.setPointerCapture(event.pointerId);
  updateTargetFromPointer(event);
});
canvas.addEventListener("pointermove", updateTargetFromPointer);

const heldKeys = { left: false, right: false };
window.addEventListener("keydown", function (event) {
  if (event.key === "ArrowLeft") {
    heldKeys.left = true;
  }
  if (event.key === "ArrowRight") {
    heldKeys.right = true;
  }
});
window.addEventListener("keyup", function (event) {
  if (event.key === "ArrowLeft") {
    heldKeys.left = false;
  }
  if (event.key === "ArrowRight") {
    heldKeys.right = false;
  }
});

let pixelScale = 1;

function resize() {
  const availableWidth = window.innerWidth;
  const availableHeight = window.innerHeight;
  pixelScale = Math.min(availableWidth / GAME_WIDTH, availableHeight / GAME_HEIGHT);
  const left = (availableWidth - GAME_WIDTH * pixelScale) / 2;
  const top = (availableHeight - GAME_HEIGHT * pixelScale) / 2;
  frame.style.transform = "translate(" + left + "px," + top + "px) scale(" + pixelScale + ")";
  const deviceRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(GAME_WIDTH * pixelScale * deviceRatio);
  canvas.height = Math.round(GAME_HEIGHT * pixelScale * deviceRatio);
  context.setTransform(pixelScale * deviceRatio, 0, 0, pixelScale * deviceRatio, 0, 0);
}
window.addEventListener("resize", resize);
resize();

// ============================================================
// Main loop
// ============================================================

let lastTimestamp = null;
let accumulatorSeconds = 0;

function frameLoop(timestamp) {
  if (lastTimestamp === null) {
    lastTimestamp = timestamp;
  }
  let frameSeconds = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;
  if (frameSeconds > 0.25) {
    frameSeconds = 0.25; // tab was in background
  }

  if (gameMode === "playing") {
    accumulatorSeconds += frameSeconds;
    while (accumulatorSeconds >= FIXED_STEP_SECONDS && gameMode === "playing") {
      if (heldKeys.left) {
        targetX = Math.max(0, targetX - 420 * FIXED_STEP_SECONDS);
      }
      if (heldKeys.right) {
        targetX = Math.min(GAME_WIDTH, targetX + 420 * FIXED_STEP_SECONDS);
      }
      step(FIXED_STEP_SECONDS);
      accumulatorSeconds -= FIXED_STEP_SECONDS;
    }
  } else {
    accumulatorSeconds = 0;
  }

  render(frameSeconds);
  requestAnimationFrame(frameLoop);
}

showOverlay(false, 0, 0);
requestAnimationFrame(frameLoop);
