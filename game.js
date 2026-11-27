"use strict";

// ============================================================
// CONFIG - everything you will want to tweak is in this section
// ============================================================

// Round order. "catch" rounds come first (upgrade pick before each catch round after the first),
// then the dodge course, then the boss shooter as the finale.
const ROUND_TYPES = ["catch", "catch", "catch", "catch", "catch", "dodge", "boss"];
const ROUND_COUNT = ROUND_TYPES.length;
const SECONDS_BY_TYPE = { catch: 30, dodge: 25, boss: 30 };
const COUNTDOWN_SECONDS_BY_TYPE = { catch: 2, dodge: 3, boss: 3 };

function countRoundsOfType(roundType) {
  let count = 0;
  for (const type of ROUND_TYPES) {
    if (type === roundType) {
      count++;
    }
  }
  return count;
}
const CATCH_ROUND_COUNT = countRoundsOfType("catch");

// Dodge course: stay inside the icy corridor, steer around the coal. Walls and coal cost points.
const DODGE_SCORE_PER_SECOND = 10;
const DODGE_HIT_PENALTY = 30;
const DODGE_COURSE_LENGTH = 5500; // world px until the corridor is at its narrowest
const SLEIGH_HALF_HITBOX = 26;

// Boss shooter: you are your own photo and fire automatically. Friends' photos are the asteroids.
const BOSS_FIRE_INTERVAL_SECONDS = 0.28;
const BOSS_BULLET_SPEED = 520;
const BOSS_BIG_SIZE = 72;
const BOSS_SMALL_SIZE = 44;
const BOSS_HIT_POINTS = 2;
const BOSS_DESTROY_BIG_POINTS = 8;
const BOSS_DESTROY_SMALL_POINTS = 6;
const BOSS_COLLISION_PENALTY = 30;
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

// Friends: the photo <id>.jpg in the same folder as index.html is drawn as a circle. Same points for everyone.
// emoji = the letter shown until the photo exists. color = circle colour for that fallback.
// Props: img/<id>.png (emoji until then). coal is the only bad item.
// points: negative = penalty. weight: how often it drops. size: draw size in px.
const FRIEND_POINTS = 10;
const PROP_POINTS = 5;
const ITEMS = {
  jennis:     { label: "Jennis", emoji: "J",  image: "jennis.jpg", round: true, color: "#c0392b", points: FRIEND_POINTS, weight: 20, size: 54 },
  talla:      { label: "Talla",  emoji: "T",  image: "talla.jpg",  round: true, color: "#8e44ad", points: FRIEND_POINTS, weight: 20, size: 54 },
  jaras:      { label: "Jaras",  emoji: "Ja", image: "jaras.jpg",  round: true, color: "#16a085", points: FRIEND_POINTS, weight: 20, size: 54 },
  daniel:     { label: "Daniel", emoji: "D",  image: "daniel.jpg", round: true, color: "#2980b9", points: FRIEND_POINTS, weight: 20, size: 54 },
  kendama:    { emoji: "🪀", image: "img/kendama.png",    points: PROP_POINTS, weight: 10, size: 40 },
  microphone: { emoji: "🎤", image: "img/microphone.png", points: PROP_POINTS, weight: 10, size: 40 },
  gloves:     { emoji: "🥊", image: "img/gloves.png",     points: PROP_POINTS, weight: 10, size: 40 },
  pc:         { emoji: "💻", image: "img/pc.png",         points: PROP_POINTS, weight: 10, size: 40 },
  coal:       { emoji: "🪨", image: "img/coal.png",       points: -20, weight: 14, size: 40 }
};

// Upgrades the player can pick between rounds.
//
// kind "combo": fires when the LAST catches match the sequence exactly.
//   Catching anything else in between breaks the chain. Items that fall past Santa do NOT break it.
//   Optional fields: bonusPoints, multiplier + multiplierSeconds, slowSeconds.
// kind "perk": a permanent effect, the code for each id is in the helper functions below.
// conflictsWith: never offered together (coal combo is useless without coal).
const UPGRADES = [
  { id: "jennis-kendama",  kind: "combo", name: "Jennis' kendama", sequence: ["jennis", "kendama"],     bonusPoints: 50, multiplier: 2, multiplierSeconds: 5 },
  { id: "talla-mic",       kind: "combo", name: "Tallas mikrofon", sequence: ["talla", "microphone"],   bonusPoints: 50, multiplier: 2, multiplierSeconds: 5 },
  { id: "daniel-pc",       kind: "combo", name: "Daniels PC",      sequence: ["daniel", "pc"],          bonusPoints: 50, multiplier: 2, multiplierSeconds: 5 },
  { id: "jaras-gloves",    kind: "combo", name: "Jaras' bokse",    sequence: ["jaras", "gloves"],       bonusPoints: 50, multiplier: 2, multiplierSeconds: 5 },

  { id: "train",     kind: "perk", icon: "🚂", name: "Polarekspressen", description: "Al kul forsvinder" },
  { id: "bigsleigh", kind: "perk", icon: "🛷", name: "Stor kane",       description: "Bredere kane (+45%)" },
  { id: "slowfall",  kind: "perk", icon: "🪂", name: "Faldskærm",       description: "Alt falder 15% langsommere" }
];

const TEXT = {
  title: "Julemandens Grabber",
  intro: ROUND_COUNT + " runder. Træk fingeren for at styre. Vælg opgraderinger mellem runderne - til sidst venter en dodge-bane og en boss!",
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

// Round "Instagram style" photo with a white ring. Falls back to a coloured circle with a letter.
function drawRoundIcon(context, id, centerX, centerY, size) {
  const definition = ITEMS[id];
  const entry = imageById[id];
  const radius = size / 2;

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.closePath();
  if (entry && entry.loaded) {
    context.clip();
    const sourceWidth = entry.image.naturalWidth;
    const sourceHeight = entry.image.naturalHeight;
    const squareSize = Math.min(sourceWidth, sourceHeight);
    const sourceX = (sourceWidth - squareSize) / 2;
    const sourceY = (sourceHeight - squareSize) * 0.2; // faces are usually in the upper part
    context.drawImage(entry.image, sourceX, sourceY, squareSize, squareSize, centerX - radius, centerY - radius, size, size);
  } else {
    context.fillStyle = definition.color;
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "bold " + Math.round(size * 0.45) + "px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(definition.emoji, centerX, centerY);
  }
  context.restore();

  context.save();
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.lineWidth = 3;
  context.strokeStyle = "#ffffff";
  context.stroke();
  context.restore();
}

function drawIcon(context, id, emoji, centerX, centerY, size) {
  if (ITEMS[id] && ITEMS[id].round) {
    drawRoundIcon(context, id, centerX, centerY, size);
    return;
  }
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
let lockedFriendId = null; // the first friend photo you catch = who you are for the rest of the run

// Current round
let roundDurationSeconds = SECONDS_BY_TYPE.catch;
let roundSecondsLeft = SECONDS_BY_TYPE.catch;
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
let invulnerableSecondsLeft = 0; // after a hit in dodge/boss
let dodgeDistance = 0;
let dodgeObstacles = [];
let dodgeNextObstacleWorldY = 0;
let bossBullets = [];
let bossEnemies = [];
let fireCooldownSeconds = 0;
let chooseSpawnCountdownSeconds = 0;
let announceSecondsLeft = 0;
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
  return ITEMS[itemId].points;
}

function getSpawnWeight(itemId) {
  if (itemId === "coal" && hasUpgrade("train")) {
    return 0;
  }
  return ITEMS[itemId].weight;
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
  lockedFriendId = null;
  startChoosePhase();
}

// Catching a friend's photo "locks you in" as that friend:
// your own photo is worth x2 and your own combo starts in your deck for free.
function lockInAsFriend(friendId) {
  lockedFriendId = friendId;
  for (const upgrade of UPGRADES) {
    if (upgrade.kind === "combo" && upgrade.sequence[0] === friendId) {
      ownedUpgradeIds.add(upgrade.id);
    }
  }
  banner = { text: "Du er " + ITEMS[friendId].label + "! Eget foto x2", lifeSeconds: 2.2 };
}

function startRound() {
  // Each round has its own seed, so every player sees the same drops in round N.
  nextRandom = createRandomGenerator(RANDOM_SEED + roundIndex * 1009);
  roundStartScore = score;
  const roundType = ROUND_TYPES[roundIndex];
  roundDurationSeconds = SECONDS_BY_TYPE[roundType];
  roundSecondsLeft = roundDurationSeconds;
  roundElapsedSeconds = 0;
  invulnerableSecondsLeft = 0;
  dodgeDistance = 0;
  dodgeObstacles = [];
  dodgeNextObstacleWorldY = 450;
  bossBullets = [];
  bossEnemies = [];
  fireCooldownSeconds = 0;
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
  countdownSecondsLeft = COUNTDOWN_SECONDS_BY_TYPE[roundType];
  gameMode = "countdown";
  overlay.style.display = "none";
}

function endRound() {
  const isLastRound = roundIndex >= ROUND_COUNT - 1;
  if (isLastRound) {
    endRun();
    return;
  }
  const nextRoundType = ROUND_TYPES[roundIndex + 1];
  if (nextRoundType === "catch") {
    gameMode = "pick";
    showPickOverlay();
    return;
  }
  // Dodge course and boss follow directly, no upgrade pick.
  roundIndex++;
  startRound();
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
  return "jennis";
}

function spawnItem() {
  const itemId = pickItemId();
  const definition = ITEMS[itemId];
  // Difficulty ramps over the whole run, not per round.
  const catchSeconds = SECONDS_BY_TYPE.catch;
  const runProgress = (roundIndex * catchSeconds + roundElapsedSeconds) / (CATCH_ROUND_COUNT * catchSeconds);
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
  let basePoints = getItemPoints(itemId);
  if (itemId === lockedFriendId) {
    basePoints *= 2;
  }
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

// ---------- round 0: choose who you are ----------
// The four friend photos fall in parallel lanes. The one you catch is you for the whole run.

const CHOOSE_FALL_SPEED = 130;
const CHOOSE_ROW_SECONDS = 2.4;
const ANNOUNCE_SECONDS = 3.4;

function getFriendIds() {
  const friendIds = [];
  for (const itemId of Object.keys(ITEMS)) {
    if (ITEMS[itemId].round) {
      friendIds.push(itemId);
    }
  }
  return friendIds;
}

function findStarterCombo(friendId) {
  for (const upgrade of UPGRADES) {
    if (upgrade.kind === "combo" && upgrade.sequence[0] === friendId) {
      return upgrade;
    }
  }
  return null;
}

function startChoosePhase() {
  roundIndex = 0;
  score = 0;
  fallingItems = [];
  recentCatches = [];
  popups = [];
  banner = null;
  multiplierValue = 1;
  multiplierSecondsLeft = 0;
  slowSecondsLeft = 0;
  invulnerableSecondsLeft = 0;
  santaX = GAME_WIDTH / 2;
  targetX = GAME_WIDTH / 2;
  roundElapsedSeconds = 0;
  chooseSpawnCountdownSeconds = 0.4;
  gameMode = "choose";
  overlay.style.display = "none";
}

function spawnFriendRow() {
  const friendIds = getFriendIds();
  const laneWidth = GAME_WIDTH / friendIds.length;
  for (let laneIndex = 0; laneIndex < friendIds.length; laneIndex++) {
    fallingItems.push({
      id: friendIds[laneIndex],
      x: laneWidth * (laneIndex + 0.5),
      y: -30,
      speed: CHOOSE_FALL_SPEED,
      spinPhase: laneIndex
    });
  }
}

function stepChoose(dt) {
  roundElapsedSeconds += dt;
  santaX += (targetX - santaX) * Math.min(1, 18 * dt);

  chooseSpawnCountdownSeconds -= dt;
  if (chooseSpawnCountdownSeconds <= 0) {
    spawnFriendRow();
    chooseSpawnCountdownSeconds = CHOOSE_ROW_SECONDS;
  }

  let caughtItem = null;
  let caughtDistance = Infinity;
  const stillFalling = [];
  for (const item of fallingItems) {
    item.y += item.speed * dt;
    const definition = ITEMS[item.id];
    const reachedSantaHeight = item.y + definition.size / 3 >= SANTA_Y - 12 && item.y <= SANTA_Y + 16;
    const distance = Math.abs(item.x - santaX);
    const insideCatchWidth = distance <= SANTA_CATCH_WIDTH / 2 + definition.size / 3;
    if (reachedSantaHeight && insideCatchWidth && distance < caughtDistance) {
      caughtItem = item;
      caughtDistance = distance;
    }
    if (item.y <= GAME_HEIGHT + 50) {
      stillFalling.push(item);
    }
  }
  fallingItems = stillFalling;

  if (caughtItem !== null) {
    lockInAsFriend(caughtItem.id);
    banner = null;
    fallingItems = [];
    announceSecondsLeft = ANNOUNCE_SECONDS;
    gameMode = "announce";
  }
}

// ---------- dodge course and boss shooter ----------

function getRoundType() {
  return ROUND_TYPES[roundIndex];
}

function updatePopupsAndBanner(dt) {
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

function loseScore(amount, x, y) {
  score = Math.max(0, score - amount);
  addPopup("-" + amount, x, y, "#ff6b6b");
}

function courseProgress(worldY) {
  return Math.max(0, Math.min(1, worldY / DODGE_COURSE_LENGTH));
}

// The course is a fixed function of distance, so every player runs the exact same track.
function getCorridorCenter(worldY) {
  const swing = 40 + 70 * courseProgress(worldY);
  const wave = Math.sin(worldY * 0.011) * 0.6 + Math.sin(worldY * 0.027 + 1.3) * 0.4;
  return GAME_WIDTH / 2 + swing * wave;
}

function getCorridorHalfWidth(worldY) {
  return 140 - 55 * courseProgress(worldY);
}

function stepDodge(dt) {
  const timeProgress = roundElapsedSeconds / roundDurationSeconds;
  dodgeDistance += (170 + 120 * timeProgress) * dt;
  score += DODGE_SCORE_PER_SECOND * dt;
  if (invulnerableSecondsLeft > 0) {
    invulnerableSecondsLeft = Math.max(0, invulnerableSecondsLeft - dt);
  }

  // Walls are solid: you are pushed back inside, and it costs points if you are not invulnerable.
  santaX += (targetX - santaX) * Math.min(1, 18 * dt);
  const corridorCenter = getCorridorCenter(dodgeDistance);
  const corridorHalfWidth = getCorridorHalfWidth(dodgeDistance);
  const minimumX = corridorCenter - corridorHalfWidth + SLEIGH_HALF_HITBOX;
  const maximumX = corridorCenter + corridorHalfWidth - SLEIGH_HALF_HITBOX;
  if (santaX < minimumX || santaX > maximumX) {
    santaX = Math.max(minimumX, Math.min(maximumX, santaX));
    if (invulnerableSecondsLeft === 0) {
      loseScore(DODGE_HIT_PENALTY, santaX, SANTA_Y - 30);
      invulnerableSecondsLeft = 1.0;
    }
  }

  while (dodgeNextObstacleWorldY < dodgeDistance + SANTA_Y + 80) {
    const worldY = dodgeNextObstacleWorldY;
    const centerX = getCorridorCenter(worldY);
    const halfWidth = getCorridorHalfWidth(worldY);
    const maximumOffset = halfWidth - 36;
    const x = centerX + (nextRandom() * 2 - 1) * maximumOffset;
    dodgeObstacles.push({ x: x, worldY: worldY });
    const progress = courseProgress(worldY);
    dodgeNextObstacleWorldY += (250 - 90 * progress) * (0.8 + nextRandom() * 0.4);
  }

  const remainingObstacles = [];
  for (const obstacle of dodgeObstacles) {
    const screenY = SANTA_Y - (obstacle.worldY - dodgeDistance);
    if (screenY > GAME_HEIGHT + 40) {
      continue;
    }
    const closeVertically = Math.abs(screenY - SANTA_Y) < 34;
    const closeHorizontally = Math.abs(obstacle.x - santaX) < 44;
    if (closeVertically && closeHorizontally && invulnerableSecondsLeft === 0) {
      loseScore(DODGE_HIT_PENALTY, santaX, SANTA_Y - 30);
      invulnerableSecondsLeft = 1.0;
      continue;
    }
    remainingObstacles.push(obstacle);
  }
  dodgeObstacles = remainingObstacles;

  updatePopupsAndBanner(dt);
}

function getPlayerFriendId() {
  return lockedFriendId !== null ? lockedFriendId : "daniel";
}

function getBossEnemyIds() {
  const playerId = getPlayerFriendId();
  const enemyIds = [];
  for (const itemId of Object.keys(ITEMS)) {
    if (ITEMS[itemId].round && itemId !== playerId) {
      enemyIds.push(itemId);
    }
  }
  return enemyIds;
}

function spawnBossEnemy() {
  const enemyIds = getBossEnemyIds();
  const friendId = enemyIds[Math.floor(nextRandom() * enemyIds.length)];
  const progress = roundElapsedSeconds / roundDurationSeconds;
  const x = BOSS_BIG_SIZE / 2 + nextRandom() * (GAME_WIDTH - BOSS_BIG_SIZE);
  const driftSpeed = (nextRandom() * 2 - 1) * 50;
  const fallSpeed = (70 + 60 * progress) * (0.8 + nextRandom() * 0.4);
  bossEnemies.push({
    id: friendId, x: x, y: -BOSS_BIG_SIZE, vx: driftSpeed, vy: fallSpeed,
    size: BOSS_BIG_SIZE, hitPoints: 3, isBig: true
  });
  spawnCountdownSeconds = (1.3 - 0.5 * progress) * (0.8 + nextRandom() * 0.4);
}

// Like classic Asteroids: a big photo splits into two small ones.
function addSplitEnemies(parent, targetList) {
  const directions = [-1, 1];
  for (const direction of directions) {
    const driftSpeed = (60 + nextRandom() * 50) * direction;
    targetList.push({
      id: parent.id, x: parent.x, y: parent.y, vx: driftSpeed, vy: parent.vy * 1.15,
      size: BOSS_SMALL_SIZE, hitPoints: 1, isBig: false
    });
  }
}

function stepBoss(dt) {
  if (invulnerableSecondsLeft > 0) {
    invulnerableSecondsLeft = Math.max(0, invulnerableSecondsLeft - dt);
  }

  santaX += (targetX - santaX) * Math.min(1, 18 * dt);
  santaX = Math.max(30, Math.min(GAME_WIDTH - 30, santaX));

  fireCooldownSeconds -= dt;
  while (fireCooldownSeconds <= 0) {
    bossBullets.push({ x: santaX, y: SANTA_Y - 34 });
    fireCooldownSeconds += BOSS_FIRE_INTERVAL_SECONDS;
  }

  spawnCountdownSeconds -= dt;
  if (spawnCountdownSeconds <= 0) {
    spawnBossEnemy();
  }

  const fallFactor = hasUpgrade("slowfall") ? 0.85 : 1;
  for (const enemy of bossEnemies) {
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * fallFactor * dt;
    const halfSize = enemy.size / 2;
    if (enemy.x < halfSize) {
      enemy.x = halfSize;
      enemy.vx = Math.abs(enemy.vx);
    } else if (enemy.x > GAME_WIDTH - halfSize) {
      enemy.x = GAME_WIDTH - halfSize;
      enemy.vx = -Math.abs(enemy.vx);
    }
  }

  const flyingBullets = [];
  for (const bullet of bossBullets) {
    bullet.y -= BOSS_BULLET_SPEED * dt;
    if (bullet.y > -20) {
      flyingBullets.push(bullet);
    }
  }

  const survivingBullets = [];
  const splitEnemies = [];
  for (const bullet of flyingBullets) {
    let bulletUsed = false;
    for (const enemy of bossEnemies) {
      if (enemy.hitPoints <= 0) {
        continue;
      }
      const distanceX = bullet.x - enemy.x;
      const distanceY = bullet.y - enemy.y;
      const hitRadius = enemy.size / 2 + 4;
      if (distanceX * distanceX + distanceY * distanceY > hitRadius * hitRadius) {
        continue;
      }
      bulletUsed = true;
      enemy.hitPoints--;
      score += BOSS_HIT_POINTS;
      if (enemy.hitPoints <= 0) {
        const destroyPoints = enemy.isBig ? BOSS_DESTROY_BIG_POINTS : BOSS_DESTROY_SMALL_POINTS;
        score += destroyPoints;
        addPopup("+" + (destroyPoints + BOSS_HIT_POINTS), enemy.x, enemy.y, "#ffe27a");
        if (enemy.isBig) {
          addSplitEnemies(enemy, splitEnemies);
        }
      }
      break;
    }
    if (!bulletUsed) {
      survivingBullets.push(bullet);
    }
  }
  bossBullets = survivingBullets;

  const remainingEnemies = [];
  for (const enemy of bossEnemies) {
    if (enemy.hitPoints <= 0 || enemy.y > GAME_HEIGHT + 60) {
      continue;
    }
    const distanceX = enemy.x - santaX;
    const distanceY = enemy.y - SANTA_Y;
    const collisionRadius = enemy.size / 2 + 20;
    const touchesPlayer = distanceX * distanceX + distanceY * distanceY < collisionRadius * collisionRadius;
    if (touchesPlayer && invulnerableSecondsLeft === 0) {
      loseScore(BOSS_COLLISION_PENALTY, santaX, SANTA_Y - 40);
      invulnerableSecondsLeft = 1.5;
      continue;
    }
    remainingEnemies.push(enemy);
  }
  bossEnemies = remainingEnemies.concat(splitEnemies);

  updatePopupsAndBanner(dt);
}

function step(dt) {
  roundElapsedSeconds += dt;
  roundSecondsLeft -= dt;
  if (roundSecondsLeft <= 0) {
    roundSecondsLeft = 0;
    endRound();
    return;
  }

  const currentRoundType = getRoundType();
  if (currentRoundType === "dodge") {
    stepDodge(dt);
    return;
  }
  if (currentRoundType === "boss") {
    stepBoss(dt);
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

function drawDodgeWorld() {
  const rowHeight = 8;
  context.fillStyle = "#cfe3ff";
  context.strokeStyle = "#7fb0f0";
  context.lineWidth = 3;

  context.beginPath();
  context.moveTo(-10, -rowHeight);
  for (let y = -rowHeight; y <= GAME_HEIGHT + rowHeight; y += rowHeight) {
    const worldY = dodgeDistance + SANTA_Y - y;
    context.lineTo(getCorridorCenter(worldY) - getCorridorHalfWidth(worldY), y);
  }
  context.lineTo(-10, GAME_HEIGHT + rowHeight);
  context.closePath();
  context.fill();
  context.stroke();

  context.beginPath();
  context.moveTo(GAME_WIDTH + 10, -rowHeight);
  for (let y = -rowHeight; y <= GAME_HEIGHT + rowHeight; y += rowHeight) {
    const worldY = dodgeDistance + SANTA_Y - y;
    context.lineTo(getCorridorCenter(worldY) + getCorridorHalfWidth(worldY), y);
  }
  context.lineTo(GAME_WIDTH + 10, GAME_HEIGHT + rowHeight);
  context.closePath();
  context.fill();
  context.stroke();

  for (const obstacle of dodgeObstacles) {
    const screenY = SANTA_Y - (obstacle.worldY - dodgeDistance);
    drawIcon(context, "coal", ITEMS.coal.emoji, obstacle.x, screenY, 46);
  }
}

function isBlinking() {
  return invulnerableSecondsLeft > 0 && Math.floor(roundElapsedSeconds * 10) % 2 === 0;
}

function drawSantaSprite() {
  if (isBlinking()) {
    return;
  }
  const santaScale = hasUpgrade("bigsleigh") && getRoundType() === "catch" ? 1.25 : 1;
  drawIcon(context, "santa", SANTA_EMOJI, santaX, SANTA_Y, SANTA_DRAW_SIZE * santaScale);
}

function drawBossWorld() {
  context.fillStyle = "#ffe27a";
  for (const bullet of bossBullets) {
    context.beginPath();
    context.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
    context.fill();
  }
  for (const enemy of bossEnemies) {
    drawIcon(context, enemy.id, ITEMS[enemy.id].emoji, enemy.x, enemy.y, enemy.size);
  }
  if (isBlinking()) {
    return;
  }
  const playerId = getPlayerFriendId();
  drawIcon(context, playerId, ITEMS[playerId].emoji, santaX, SANTA_Y, 58);
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.moveTo(santaX, SANTA_Y - 46);
  context.lineTo(santaX - 8, SANTA_Y - 33);
  context.lineTo(santaX + 8, SANTA_Y - 33);
  context.closePath();
  context.fill();
}

function getRoundSubtitleLines() {
  const roundType = getRoundType();
  if (roundType === "dodge") {
    return ["DODGE-BANE", "Hold dig mellem væggene", "og styr udenom kullet!"];
  }
  if (roundType === "boss") {
    const playerId = getPlayerFriendId();
    return ["BOSS", "Du er " + ITEMS[playerId].label + " - du skyder automatisk", "Skyd de andres fotos!"];
  }
  return [];
}

function getRoundLabel() {
  const roundType = getRoundType();
  let suffix = "";
  if (roundType === "dodge") {
    suffix = " · DODGE";
  }
  if (roundType === "boss") {
    suffix = " · BOSS";
  }
  return "Runde " + (roundIndex + 1) + "/" + ROUND_COUNT + suffix;
}

function drawAnnouncement() {
  context.fillStyle = "rgba(6, 16, 31, 0.8)";
  context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  const friendId = lockedFriendId;
  const friend = ITEMS[friendId];
  drawIcon(context, friendId, friend.emoji, GAME_WIDTH / 2, 150, 120);
  drawText("Du er " + friend.label + "!", GAME_WIDTH / 2, 250, 34, "#ffffff", "center");
  drawText("Dit eget foto giver x2", GAME_WIDTH / 2, 288, 18, "#7dffa0", "center");

  const combo = findStarterCombo(friendId);
  if (combo !== null) {
    drawText("KOMBO AKTIVERET", GAME_WIDTH / 2, 350, 20, "#ffe27a", "center");
    drawText(combo.name, GAME_WIDTH / 2, 382, 22, "#ffffff", "center");
    const firstId = combo.sequence[0];
    const secondId = combo.sequence[1];
    drawIcon(context, firstId, ITEMS[firstId].emoji, GAME_WIDTH / 2 - 50, 438, 48);
    drawText("→", GAME_WIDTH / 2, 438, 28, "#ffffff", "center");
    drawIcon(context, secondId, ITEMS[secondId].emoji, GAME_WIDTH / 2 + 50, 438, 48);
    drawText(describeCombo(combo), GAME_WIDTH / 2, 490, 18, "#b8e4ff", "center");
  }
  drawText("Runde 1 starter...", GAME_WIDTH / 2, 560, 16, "#b8e4ff", "center");
}

function render(dt) {
  drawBackground(dt);
  const roundType = getRoundType();
  if (roundType === "dodge") {
    drawDodgeWorld();
  }

  for (const item of fallingItems) {
    const definition = ITEMS[item.id];
    const wobble = Math.sin(roundElapsedSeconds * 3 + item.spinPhase) * 0.25;
    context.save();
    context.translate(item.x, item.y);
    context.rotate(wobble);
    drawIcon(context, item.id, definition.emoji, 0, 0, definition.size);
    context.restore();
  }

  if (roundType === "boss") {
    drawBossWorld();
  } else {
    drawSantaSprite();
  }

  for (const popup of popups) {
    context.globalAlpha = Math.min(1, popup.lifeSeconds * 2);
    drawText(popup.text, popup.x, popup.y, 22, popup.color, "center");
    context.globalAlpha = 1;
  }

  if (gameMode === "playing" || gameMode === "countdown") {
    drawText("Point " + Math.round(score), 14, 24, 22, "#ffffff", "left");
    drawText(String(Math.ceil(roundSecondsLeft)) + "s", GAME_WIDTH - 14, 24, 22, "#ffffff", "right");
    drawText(getRoundLabel(), GAME_WIDTH / 2, 24, 16, roundType === "catch" ? "#b8e4ff" : "#ff9a8a", "center");
  }

  if (gameMode === "playing" && lockedFriendId !== null) {
    drawIcon(context, lockedFriendId, ITEMS[lockedFriendId].emoji, GAME_WIDTH - 26, 58, 30);
  }

  if (gameMode === "playing" && roundType === "catch") {
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

  if (gameMode === "choose") {
    drawText("Grib dit eget foto", GAME_WIDTH / 2, 40, 24, "#ffe27a", "center");
    drawText("Det er dig resten af spillet", GAME_WIDTH / 2, 70, 16, "#ffffff", "center");
  }

  if (gameMode === "announce") {
    drawAnnouncement();
  }

  if (gameMode === "countdown") {
    drawText("Runde " + (roundIndex + 1), GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 40, "#ffe27a", "center");
    drawText(String(Math.ceil(countdownSecondsLeft)), GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, 48, "#ffffff", "center");
    let subtitleY = GAME_HEIGHT / 2 + 90;
    for (const line of getRoundSubtitleLines()) {
      drawText(line, GAME_WIDTH / 2, subtitleY, 18, "#b8e4ff", "center");
      subtitleY += 26;
    }
  }
}

// ============================================================
// Overlays (intro, pick upgrade, final)
// ============================================================

function iconHtml(itemId) {
  const definition = ITEMS[itemId];
  if (definition.round) {
    // Letter sits behind the photo, so it shows only while the photo is missing.
    return '<span class="icon round" style="background:' + definition.color + '">' + definition.emoji +
      '<img src="' + definition.image + '" alt="" onerror="this.remove()"></span>';
  }
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

function showIntroOverlay() {
  overlay.innerHTML =
    "<h1>" + TEXT.title + "</h1>" +
    "<p>" + TEXT.intro + "</p>" +
    buildItemTableHtml() +
    "<p class=\"small\">Først vælger du dig selv: grib dit eget foto. Så er det dig resten af spillet, og dit eget foto giver x2.</p>" +
    '<button id="startButton">' + TEXT.start + "</button>";
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
    (lockedFriendId !== null ? '<div class="small">Du er ' + iconHtml(lockedFriendId) + " " + ITEMS[lockedFriendId].label + " · eget foto x2</div>" : "") +
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
    '<div class="big-score">' + finalScore + "</div>" +
    '<div class="small">' + TEXT.best + ": " + bestScore + "</div>" +
    '<button id="startButton">' + TEXT.again + "</button>" +
    '<div class="small">' + TEXT.showHost + "</div>";

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
  } else if (gameMode === "choose") {
    stepChoose(frameSeconds);
  } else if (gameMode === "announce") {
    announceSecondsLeft -= frameSeconds;
    if (announceSecondsLeft <= 0) {
      roundIndex = 0;
      startRound();
    }
  } else {
    accumulatorSeconds = 0;
  }

  render(frameSeconds);
  requestAnimationFrame(frameLoop);
}

showIntroOverlay();
requestAnimationFrame(frameLoop);
