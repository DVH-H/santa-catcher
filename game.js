"use strict";

// ============================================================
// CONFIG - everything you will want to tweak is in this section
// ============================================================

const ROUND_COUNT = 5;
const ROUND_SECONDS = 30;
const COUNTDOWN_SECONDS = 2;
const OFFER_COUNT = 3; // upgrades to choose between after each round
const RANDOM_SEED = 2026; // same seed = same drops for every player (fair contest)
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

// Upgrades the player can pick between rounds.
//
// kind "combo": fires when the LAST catches match the sequence exactly.
//   Catching anything else in between breaks the chain. Items that fall past Santa do NOT break it.
//   Optional fields: bonusPoints, multiplier + multiplierSeconds, slowSeconds.
// kind "perk": a permanent effect, the code for each id is in the helper functions below.
// conflictsWith: never offered together (coal combo is useless without coal).
const UPGRADES = [
  { id: "milk-cookies", kind: "combo", name: "Mælk & småkager", sequence: ["cookie", "milk"],          multiplier: 3, multiplierSeconds: 8 },
  { id: "sugar-rush",   kind: "combo", name: "Sukkerchok",      sequence: ["candy", "candy", "candy"], multiplier: 4, multiplierSeconds: 6 },
  { id: "wish",         kind: "combo", name: "Ønsket opfyldt",  sequence: ["star", "gift"],            bonusPoints: 100 },
  { id: "snowman",      kind: "combo", name: "Snemand",         sequence: ["snowflake", "snowflake"],  bonusPoints: 40, slowSeconds: 5 },
  { id: "forgiven",     kind: "combo", name: "Tilgivelse",      sequence: ["coal", "gift"],            bonusPoints: 75, conflictsWith: "train" },

  { id: "train",     kind: "perk", icon: "🚂", name: "Polarekspressen", description: "Al kul forsvinder", conflictsWith: "forgiven" },
  { id: "stars2",    kind: "perk", icon: "⭐", name: "Stjernehimmel",   description: "Dobbelt så mange stjerner" },
  { id: "gifts2",    kind: "perk", icon: "🎁", name: "Gaveregn",        description: "Dobbelt så mange gaver" },
  { id: "giftwrap",  kind: "perk", icon: "🎀", name: "Fin indpakning",  description: "Gaver giver +10 ekstra" },
  { id: "goldstar",  kind: "perk", icon: "🌟", name: "Guldstjerne",     description: "Stjerner giver +25 ekstra" },
  { id: "bakery",    kind: "perk", icon: "🧁", name: "Bageriet",        description: "Småkager og mælk giver dobbelt" },
  { id: "bigsleigh", kind: "perk", icon: "🛷", name: "Stor kane",       description: "Bredere kane (+45%)" },
  { id: "slowfall",  kind: "perk", icon: "🪂", name: "Faldskærm",       description: "Alt falder 15% langsommere" }
];

const TEXT = {
  title: "Julemandens Grabber",
  intro: ROUND_COUNT + " runder à " + ROUND_SECONDS + " sek. Træk fingeren for at styre kanen. Mellem runderne vælger du en opgradering.",
  start: "Start",
  again: "Spil igen",
  namePlaceholder: "Dit navn",
  gameOver: "Færdig!",
  best: "Din bedste",
  showHost: "Vis denne skærm til Daniel",
  pickTitle: "Vælg en opgradering",
  yourDeck: "Dit dæk"
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

function findUpgrade(upgradeId) {
  for (const upgrade of UPGRADES) {
    if (upgrade.id === upgradeId) {
      return upgrade;
    }
  }
  return null;
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

let gameMode = "intro"; // intro | countdown | playing | pick | over
let nextRandom = createRandomGenerator(RANDOM_SEED);

// Whole run
let roundIndex = 0; // 0-based
let score = 0;
let roundStartScore = 0;
let ownedUpgradeIds = new Set();

// Current round
let roundSecondsLeft = ROUND_SECONDS;
let roundElapsedSeconds = 0;
let countdownSecondsLeft = 0;
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

// ---------- upgrade effects (perks) ----------

function hasUpgrade(upgradeId) {
  return ownedUpgradeIds.has(upgradeId);
}

function getOwnedCombos() {
  const combos = [];
  for (const upgrade of UPGRADES) {
    if (upgrade.kind === "combo" && hasUpgrade(upgrade.id)) {
      combos.push(upgrade);
    }
  }
  return combos;
}

function getItemPoints(itemId) {
  let points = ITEMS[itemId].points;
  if (itemId === "gift" && hasUpgrade("giftwrap")) {
    points += 10;
  }
  if (itemId === "star" && hasUpgrade("goldstar")) {
    points += 25;
  }
  if ((itemId === "cookie" || itemId === "milk") && hasUpgrade("bakery")) {
    points *= 2;
  }
  return points;
}

function getSpawnWeight(itemId) {
  let weight = ITEMS[itemId].weight;
  if (itemId === "coal" && hasUpgrade("train")) {
    weight = 0;
  }
  if (itemId === "star" && hasUpgrade("stars2")) {
    weight *= 2;
  }
  if (itemId === "gift" && hasUpgrade("gifts2")) {
    weight *= 2;
  }
  return weight;
}

function getCatchWidth() {
  return hasUpgrade("bigsleigh") ? SANTA_CATCH_WIDTH * 1.45 : SANTA_CATCH_WIDTH;
}

function getFallSpeedFactor() {
  let factor = slowSecondsLeft > 0 ? 0.5 : 1;
  if (hasUpgrade("slowfall")) {
    factor *= 0.85;
  }
  return factor;
}

// ---------- run and round flow ----------

function startRun() {
  roundIndex = 0;
  score = 0;
  ownedUpgradeIds = new Set();
  startRound();
}

function startRound() {
  // Each round has its own seed, so every player sees the same drops in round N.
  nextRandom = createRandomGenerator(RANDOM_SEED + roundIndex * 1009);
  roundStartScore = score;
  roundSecondsLeft = ROUND_SECONDS;
  roundElapsedSeconds = 0;
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
  countdownSecondsLeft = COUNTDOWN_SECONDS;
  gameMode = "countdown";
  overlay.style.display = "none";
}

function endRound() {
  const isLastRound = roundIndex >= ROUND_COUNT - 1;
  if (isLastRound) {
    endRun();
    return;
  }
  gameMode = "pick";
  showPickOverlay();
}

function endRun() {
  gameMode = "over";
  const finalScore = Math.round(score);
  const previousBest = Number(safeStorageGet("santaBest") || 0);
  let newBest = previousBest;
  if (finalScore > previousBest) {
    newBest = finalScore;
    safeStorageSet("santaBest", String(finalScore));
  }
  showFinalOverlay(finalScore, newBest);
}

function chooseUpgrade(upgradeId) {
  ownedUpgradeIds.add(upgradeId);
  roundIndex++;
  startRound();
}

function buildOffers() {
  const available = [];
  for (const upgrade of UPGRADES) {
    if (hasUpgrade(upgrade.id)) {
      continue;
    }
    if (upgrade.conflictsWith && hasUpgrade(upgrade.conflictsWith)) {
      continue;
    }
    available.push(upgrade);
  }

  // Seeded shuffle: players in the same situation get the same offers.
  const offerRandom = createRandomGenerator(RANDOM_SEED + 777 + roundIndex * 31);
  for (let index = available.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(offerRandom() * (index + 1));
    const held = available[index];
    available[index] = available[swapIndex];
    available[swapIndex] = held;
  }
  return available.slice(0, OFFER_COUNT);
}

// ============================================================
// Spawning and simulation
// ============================================================

function pickItemId() {
  let totalWeight = 0;
  const itemIds = Object.keys(ITEMS);
  for (const itemId of itemIds) {
    totalWeight += getSpawnWeight(itemId);
  }
  let roll = nextRandom() * totalWeight;
  for (const itemId of itemIds) {
    const weight = getSpawnWeight(itemId);
    if (weight === 0) {
      continue;
    }
    roll -= weight;
    if (roll <= 0) {
      return itemId;
    }
  }
  return "gift";
}

function spawnItem() {
  const itemId = pickItemId();
  const definition = ITEMS[itemId];
  // Difficulty ramps over the whole run, not per round.
  const runProgress = (roundIndex * ROUND_SECONDS + roundElapsedSeconds) / (ROUND_COUNT * ROUND_SECONDS);
  const baseSpeed = 140 + 150 * runProgress;
  const speed = baseSpeed * (0.85 + nextRandom() * 0.3);
  const margin = definition.size / 2 + 6;
  const x = margin + nextRandom() * (GAME_WIDTH - margin * 2);
  const spinPhase = nextRandom() * Math.PI * 2;
  fallingItems.push({ id: itemId, x: x, y: -definition.size, speed: speed, spinPhase: spinPhase });

  const minGap = 0.85 - 0.45 * runProgress;
  const maxGap = 1.2 - 0.6 * runProgress;
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
  const basePoints = getItemPoints(itemId);
  let gained = basePoints;
  if (gained > 0) {
    gained = gained * multiplierValue;
  }
  score = Math.max(0, score + gained);

  if (gained > 0) {
    addPopup("+" + gained, x, SANTA_Y - 30, "#ffe27a");
  } else {
    addPopup(String(gained), x, SANTA_Y - 30, "#ff6b6b");
  }

  if (basePoints < 0) {
    multiplierValue = 1;
    multiplierSecondsLeft = 0;
  }

  recentCatches.push(itemId);
  if (recentCatches.length > 6) {
    recentCatches.shift();
  }

  let bestCombo = null;
  for (const combo of getOwnedCombos()) {
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
  roundElapsedSeconds += dt;
  roundSecondsLeft -= dt;
  if (roundSecondsLeft <= 0) {
    roundSecondsLeft = 0;
    endRound();
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

  const speedFactor = getFallSpeedFactor();
  const catchWidth = getCatchWidth();
  const stillFalling = [];
  for (const item of fallingItems) {
    item.y += item.speed * speedFactor * dt;
    const definition = ITEMS[item.id];

    const reachedSantaHeight = item.y + definition.size / 3 >= SANTA_Y - 12 && item.y <= SANTA_Y + 16;
    const insideCatchWidth = Math.abs(item.x - santaX) <= catchWidth / 2 + definition.size / 3;
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
  for (const combo of getOwnedCombos()) {
    const progress = sequenceProgress(combo.sequence);
    if (progress === 0 || row >= 2) {
      continue;
    }
    const y = 84 + row * 30;
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
    const wobble = Math.sin(roundElapsedSeconds * 3 + item.spinPhase) * 0.25;
    context.save();
    context.translate(item.x, item.y);
    context.rotate(wobble);
    drawIcon(context, item.id, definition.emoji, 0, 0, definition.size);
    context.restore();
  }

  const santaScale = hasUpgrade("bigsleigh") ? 1.25 : 1;
  drawIcon(context, "santa", SANTA_EMOJI, santaX, SANTA_Y, SANTA_DRAW_SIZE * santaScale);

  for (const popup of popups) {
    context.globalAlpha = Math.min(1, popup.lifeSeconds * 2);
    drawText(popup.text, popup.x, popup.y, 22, popup.color, "center");
    context.globalAlpha = 1;
  }

  if (gameMode === "playing" || gameMode === "countdown") {
    drawText("Point " + Math.round(score), 14, 24, 22, "#ffffff", "left");
    drawText(String(Math.ceil(roundSecondsLeft)) + "s", GAME_WIDTH - 14, 24, 22, "#ffffff", "right");
    drawText("Runde " + (roundIndex + 1) + "/" + ROUND_COUNT, GAME_WIDTH / 2, 24, 16, "#b8e4ff", "center");
  }

  if (gameMode === "playing") {
    if (multiplierSecondsLeft > 0) {
      drawText("x" + multiplierValue + "  " + multiplierSecondsLeft.toFixed(1) + "s", GAME_WIDTH / 2, 54, 22, "#7dffa0", "center");
    }
    if (slowSecondsLeft > 0) {
      drawText("❄ langsom " + slowSecondsLeft.toFixed(1) + "s", GAME_WIDTH / 2, 160, 16, "#b8e4ff", "center");
    }
    drawChainHints();
    if (banner !== null) {
      context.globalAlpha = Math.min(1, banner.lifeSeconds * 2);
      drawText(banner.text, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 26, "#ffe27a", "center");
      context.globalAlpha = 1;
    }
  }

  if (gameMode === "countdown") {
    drawText("Runde " + (roundIndex + 1), GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 40, "#ffe27a", "center");
    drawText(String(Math.ceil(countdownSecondsLeft)), GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, 48, "#ffffff", "center");
  }
}

// ============================================================
// Overlays (intro, pick upgrade, final)
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

function buildItemTableHtml() {
  let html = '<div class="items">';
  for (const itemId of Object.keys(ITEMS)) {
    const points = ITEMS[itemId].points;
    const label = points > 0 ? "+" + points : String(points);
    const cssClass = points > 0 ? "good" : "bad";
    html += '<div class="item-cell">' + iconHtml(itemId) + '<span class="' + cssClass + '">' + label + "</span></div>";
  }
  html += "</div>";
  return html;
}

function buildNameInputHtml() {
  return '<input id="nameInput" maxlength="16" placeholder="' + TEXT.namePlaceholder + '">';
}

function wireNameInput(onChange) {
  const nameInput = document.getElementById("nameInput");
  nameInput.value = safeStorageGet("santaName") || "";
  nameInput.addEventListener("input", function () {
    safeStorageSet("santaName", nameInput.value);
    if (onChange) {
      onChange(nameInput.value.trim());
    }
  });
  return nameInput.value.trim();
}

function showIntroOverlay() {
  overlay.innerHTML =
    "<h1>" + TEXT.title + "</h1>" +
    "<p>" + TEXT.intro + "</p>" +
    buildItemTableHtml() +
    "<p class=\"small\">Grib det gode, undgå kul. Runde 1 er øveren - lær symbolerne at kende.</p>" +
    buildNameInputHtml() +
    '<button id="startButton">' + TEXT.start + "</button>";
  wireNameInput(null);
  document.getElementById("startButton").addEventListener("click", startRun);
  overlay.style.display = "flex";
}

function buildOfferCardHtml(upgrade) {
  let iconPart = "";
  let descriptionPart = "";
  if (upgrade.kind === "combo") {
    const icons = upgrade.sequence.map(iconHtml).join('<span class="arrow">→</span>');
    iconPart = icons;
    descriptionPart = describeCombo(upgrade);
  } else {
    iconPart = '<span class="icon big">' + upgrade.icon + "</span>";
    descriptionPart = upgrade.description;
  }
  const tag = upgrade.kind === "combo" ? "Kombo" : "Perk";
  return '<button class="card" data-upgrade="' + upgrade.id + '">' +
    '<div class="card-icons">' + iconPart + "</div>" +
    '<div class="card-body"><div class="card-title">' + upgrade.name + ' <span class="tag">' + tag + "</span></div>" +
    '<div class="card-text">' + descriptionPart + "</div></div></button>";
}

function showPickOverlay() {
  const roundGain = Math.round(score - roundStartScore);
  const offers = buildOffers();
  let cardsHtml = "";
  for (const upgrade of offers) {
    cardsHtml += buildOfferCardHtml(upgrade);
  }

  const ownedNames = [];
  for (const upgrade of UPGRADES) {
    if (hasUpgrade(upgrade.id)) {
      ownedNames.push(upgrade.name);
    }
  }
  const deckLine = ownedNames.length > 0 ? TEXT.yourDeck + ": " + ownedNames.join(", ") : "";

  overlay.innerHTML =
    "<h2>Runde " + (roundIndex + 1) + " færdig</h2>" +
    '<div class="small">+' + roundGain + " denne runde · i alt " + Math.round(score) + "</div>" +
    "<h3>" + TEXT.pickTitle + "</h3>" +
    '<div class="cards">' + cardsHtml + "</div>" +
    '<div class="small">' + deckLine + "</div>";

  const cardButtons = overlay.querySelectorAll(".card");
  for (const cardButton of cardButtons) {
    cardButton.addEventListener("click", function () {
      chooseUpgrade(cardButton.getAttribute("data-upgrade"));
    });
  }
  overlay.style.display = "flex";
}

function showFinalOverlay(finalScore, bestScore) {
  overlay.innerHTML =
    "<h2>" + TEXT.gameOver + "</h2>" +
    '<div class="big-score" id="finalScore"></div>' +
    '<div class="small">' + TEXT.best + ": " + bestScore + "</div>" +
    buildNameInputHtml() +
    '<button id="startButton">' + TEXT.again + "</button>" +
    '<div class="small">' + TEXT.showHost + "</div>";

  const scoreLine = document.getElementById("finalScore");
  function updateScoreLine(playerName) {
    scoreLine.textContent = (playerName ? playerName + ": " : "") + finalScore;
  }
  const initialName = wireNameInput(updateScoreLine);
  updateScoreLine(initialName);
  document.getElementById("startButton").addEventListener("click", startRun);
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

  if (gameMode === "countdown") {
    // Santa can already move during the countdown.
    countdownSecondsLeft -= frameSeconds;
    santaX += (targetX - santaX) * Math.min(1, 18 * frameSeconds);
    if (countdownSecondsLeft <= 0) {
      gameMode = "playing";
      accumulatorSeconds = 0;
    }
  } else if (gameMode === "playing") {
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

showIntroOverlay();
requestAnimationFrame(frameLoop);
