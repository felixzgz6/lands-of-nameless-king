const STORAGE_KEYS = {
  SAVED_GAMES: "nameless_king_saved_games_v1",
  LEADERBOARDS: "nameless_king_leaderboards_v1"
};

const CELL_STATE = {
  UNDECIDED: "undecided",
  WALL: "wall",
  PROPERTY: "property",
  HOUSE: "house"
};

const LEVELS = {
  easy: {
    id: "easy",
    name: "Easy",
    rows: 5,
    cols: 5,
    houses: [
      { row: 0, col: 0, value: 1 },
      { row: 0, col: 2, value: 5 },
      { row: 2, col: 1, value: 1 },
      { row: 3, col: 3, value: 5 },
      { row: 4, col: 0, value: 1 }
    ]
  },
  medium: {
    id: "medium",
    name: "Medium",
    rows: 7,
    cols: 7,
    houses: [
      { row: 0, col: 0, value: 12 },
      { row: 0, col: 6, value: 4 },
      { row: 3, col: 0, value: 1 },
      { row: 3, col: 2, value: 1 },
      { row: 5, col: 0, value: 7 },
      { row: 5, col: 5, value: 3 }
    ]
  },
  hard: {
    id: "hard",
    name: "Hard",
    rows: 10,
    cols: 10,
    houses: [
      { row: 0, col: 0, value: 12 },
      { row: 0, col: 7, value: 7 },
      { row: 2, col: 4, value: 2 },
      { row: 4, col: 0, value: 5 },
      { row: 4, col: 4, value: 1 },
      { row: 4, col: 6, value: 2 },
      { row: 4, col: 9, value: 1 },
      { row: 6, col: 4, value: 1 },
      { row: 6, col: 6, value: 1 },
      { row: 6, col: 8, value: 1 },
      { row: 7, col: 0, value: 13 },
      { row: 7, col: 5, value: 1 },
      { row: 8, col: 7, value: 4 }
    ]
  }
};

const state = {
  playerName: "",
  selectedLevel: "easy",
  selectedLeaderboardTab: "easy",
  board: [],
  elapsedSeconds: 0,
  timerActive: false,
  timerAnchorMs: 0,
  baseElapsedSeconds: 0,
  isGameOver: false,
  dragActive: false,
  dragButton: null,
  dragTargetState: null,
  visitedInDrag: new Set()
};

/* DOM Elements via querySelector */
const startScreen = document.querySelector("#start-screen");
const gameScreen = document.querySelector("#game-screen");
const playerNameInput = document.querySelector("#player-name-input");
const nameError = document.querySelector("#name-error");
const levelSelector = document.querySelector("#level-selector");
const startGameBtn = document.querySelector("#start-game-btn");
const toggleRulesBtn = document.querySelector("#toggle-rules-btn");
const closeRulesBtn = document.querySelector("#close-rules-btn");
const rulesPanel = document.querySelector("#rules-panel");
const savedGamesList = document.querySelector("#saved-games-list");
const leaderboardTabs = document.querySelector("#leaderboard-tabs");
const leaderboardList = document.querySelector("#leaderboard-list");

const displayPlayerName = document.querySelector("#display-player-name");
const displayLevelName = document.querySelector("#display-level-name");
const displayTimer = document.querySelector("#display-timer");
const fillPropertyBtn = document.querySelector("#fill-property-btn");
const saveGameBtn = document.querySelector("#save-game-btn");
const backMenuBtn = document.querySelector("#back-menu-btn");
const statusBanner = document.querySelector("#status-banner");
const statusText = document.querySelector("#status-text");
const gameBoard = document.querySelector("#game-board");

const victoryModal = document.querySelector("#victory-modal");
const victoryPlayer = document.querySelector("#victory-player");
const victoryLevel = document.querySelector("#victory-level");
const victoryTime = document.querySelector("#victory-time");
const victoryMenuBtn = document.querySelector("#victory-menu-btn");

/* Formatting Helpers */
function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const paddedMins = String(mins).padStart(2, "0");
  const paddedSecs = String(secs).padStart(2, "0");
  return `${paddedMins}:${paddedSecs}`;
}

function getHouseAt(levelKey, row, col) {
  const level = LEVELS[levelKey];
  return level.houses.find((h) => h.row === row && h.col === col) || null;
}

/* Timer Loop using requestAnimationFrame */
function updateTimerFrame(nowMs) {
  if (state.timerActive && !state.isGameOver) {
    const deltaSeconds = Math.floor((nowMs - state.timerAnchorMs) / 1000);
    const currentTotal = state.baseElapsedSeconds + deltaSeconds;
    if (currentTotal !== state.elapsedSeconds) {
      state.elapsedSeconds = currentTotal;
      displayTimer.textContent = formatTime(state.elapsedSeconds);
    }
    requestAnimationFrame(updateTimerFrame);
  }
}

function startTimer(initialSeconds = 0) {
  state.elapsedSeconds = initialSeconds;
  state.baseElapsedSeconds = initialSeconds;
  state.timerAnchorMs = performance.now();
  state.timerActive = true;
  displayTimer.textContent = formatTime(state.elapsedSeconds);
  requestAnimationFrame(updateTimerFrame);
}

function stopTimer() {
  state.timerActive = false;
}

/* Board Creation & Rendering */
function createInitialBoard(levelKey) {
  const level = LEVELS[levelKey];
  const grid = [];
  for (let r = 0; r < level.rows; r += 1) {
    const rowArr = [];
    for (let c = 0; c < level.cols; c += 1) {
      const house = getHouseAt(levelKey, r, c);
      if (house) {
        rowArr.push(CELL_STATE.HOUSE);
      } else {
        rowArr.push(CELL_STATE.UNDECIDED);
      }
    }
    grid.push(rowArr);
  }
  return grid;
}

function renderBoard() {
  const level = LEVELS[state.selectedLevel];
  gameBoard.style.gridTemplateColumns = `repeat(${level.cols}, 1fr)`;
  gameBoard.innerHTML = "";

  const validation = evaluateBoardState();

  for (let r = 0; r < level.rows; r += 1) {
    for (let c = 0; c < level.cols; c += 1) {
      const cellState = state.board[r][c];
      const cellEl = document.createElement("div");
      cellEl.classList.add("cell", `cell-${cellState}`);
      cellEl.dataset.row = String(r);
      cellEl.dataset.col = String(c);

      const key = `${r},${c}`;
      if (validation.invalidCells.has(key)) {
        cellEl.classList.add("cell-invalid");
      }

      if (cellState === CELL_STATE.HOUSE) {
        const house = getHouseAt(state.selectedLevel, r, c);
        const shape = document.createElement("div");
        shape.classList.add("house-shape");

        const roof = document.createElement("div");
        roof.classList.add("house-roof");

        const body = document.createElement("div");
        body.classList.add("house-body");
        body.textContent = String(house.value);

        shape.appendChild(roof);
        shape.appendChild(body);
        cellEl.appendChild(shape);
      }

      gameBoard.appendChild(cellEl);
    }
  }

  updateFeedbackBanner(validation);

  if (validation.isSolved && !state.isGameOver) {
    handleVictory();
  }
}

/* Graph Traversal & Validation Logic */
function getOrthogonalNeighbors(r, c, rows, cols) {
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ];
  const result = [];
  for (const [dr, dc] of dirs) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
      result.push([nr, nc]);
    }
  }
  return result;
}

function collectConnectedComponent(startR, startC, allowedStates) {
  const level = LEVELS[state.selectedLevel];
  const visited = new Set();
  const queue = [[startR, startC]];
  const cells = [];
  const startKey = `${startR},${startC}`;
  visited.add(startKey);

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    cells.push([r, c]);

    const neighbors = getOrthogonalNeighbors(r, c, level.rows, level.cols);
    for (const [nr, nc] of neighbors) {
      const key = `${nr},${nc}`;
      if (!visited.has(key) && allowedStates.includes(state.board[nr][nc])) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }
  return cells;
}

function evaluateBoardState() {
  const level = LEVELS[state.selectedLevel];
  const invalidCells = new Set();
  const errorReasons = [];

  /* 1. Check 2x2 solid wall blocks */
  let has2x2Wall = false;
  for (let r = 0; r < level.rows - 1; r += 1) {
    for (let c = 0; c < level.cols - 1; c += 1) {
      if (
        state.board[r][c] === CELL_STATE.WALL &&
        state.board[r + 1][c] === CELL_STATE.WALL &&
        state.board[r][c + 1] === CELL_STATE.WALL &&
        state.board[r + 1][c + 1] === CELL_STATE.WALL
      ) {
        has2x2Wall = true;
        invalidCells.add(`${r},${c}`);
        invalidCells.add(`${r + 1},${c}`);
        invalidCells.add(`${r},${c + 1}`);
        invalidCells.add(`${r + 1},${c + 1}`);
      }
    }
  }
  if (has2x2Wall) {
    errorReasons.push("Invalid 2×2 solid wall block detected");
  }

  /* 2. Check Property Too Small (enclosed non-wall area < house value) */
  let hasTooSmall = false;
  const nonWallStates = [CELL_STATE.HOUSE, CELL_STATE.PROPERTY, CELL_STATE.UNDECIDED];

  for (const house of level.houses) {
    const maxPossibleArea = collectConnectedComponent(house.row, house.col, nonWallStates);
    if (maxPossibleArea.length < house.value) {
      hasTooSmall = true;
      for (const [r, c] of maxPossibleArea) {
        invalidCells.add(`${r},${c}`);
      }
    }
  }
  if (hasTooSmall) {
    errorReasons.push("Property too small (enclosed by walls with insufficient cells)");
  }

  /* 3. Check Property Too Large (connected decided property + house area > house value, or >1 house connected) */
  let hasTooLarge = false;
  let hasMultipleHousesInProperty = false;
  const decidedPropertyStates = [CELL_STATE.HOUSE, CELL_STATE.PROPERTY];

  for (const house of level.houses) {
    const decidedArea = collectConnectedComponent(house.row, house.col, decidedPropertyStates);
    const housesInArea = decidedArea.filter(
      ([r, c]) => state.board[r][c] === CELL_STATE.HOUSE
    );

    if (decidedArea.length > house.value) {
      hasTooLarge = true;
      for (const [r, c] of decidedArea) {
        invalidCells.add(`${r},${c}`);
      }
    }

    if (housesInArea.length > 1) {
      hasMultipleHousesInProperty = true;
      for (const [r, c] of decidedArea) {
        invalidCells.add(`${r},${c}`);
      }
    }
  }
  if (hasTooLarge) {
    errorReasons.push("Property too large (exceeds house inhabitants count)");
  }
  if (hasMultipleHousesInProperty) {
    errorReasons.push("Two houses cannot share the same connected property");
  }

  /* 4. Check Victory Conditions */
  let undecidedCount = 0;
  const allWallCells = [];
  for (let r = 0; r < level.rows; r += 1) {
    for (let c = 0; c < level.cols; c += 1) {
      if (state.board[r][c] === CELL_STATE.UNDECIDED) {
        undecidedCount += 1;
      } else if (state.board[r][c] === CELL_STATE.WALL) {
        allWallCells.push([r, c]);
      }
    }
  }

  /* Check if walls alone already form a valid partition (if undecided were property) */
  const wallsFormValidPartition = checkPartitionValidity(nonWallStates, allWallCells, has2x2Wall);

  /* Strict victory check: every cell decided + valid partition */
  const isSolved =
    undecidedCount === 0 &&
    invalidCells.size === 0 &&
    checkPartitionValidity(decidedPropertyStates, allWallCells, has2x2Wall);

  return {
    invalidCells,
    errorReasons,
    undecidedCount,
    wallsFormValidPartition,
    isSolved
  };
}

function checkPartitionValidity(propertyStates, allWallCells, has2x2Wall) {
  if (has2x2Wall) {
    return false;
  }

  const level = LEVELS[state.selectedLevel];
  const visitedPropertyCells = new Set();

  /* Check each house component */
  for (const house of level.houses) {
    const comp = collectConnectedComponent(house.row, house.col, propertyStates);
    if (comp.length !== house.value) {
      return false;
    }

    let houseCount = 0;
    for (const [r, c] of comp) {
      if (state.board[r][c] === CELL_STATE.HOUSE) {
        houseCount += 1;
      }
      visitedPropertyCells.add(`${r},${c}`);
    }
    if (houseCount !== 1) {
      return false;
    }
  }

  /* Ensure no orphan property cells exist outside house components */
  for (let r = 0; r < level.rows; r += 1) {
    for (let c = 0; c < level.cols; c += 1) {
      if (propertyStates.includes(state.board[r][c])) {
        if (!visitedPropertyCells.has(`${r},${c}`)) {
          return false;
        }
      }
    }
  }

  /* Check that all walls form a single connected orthogonal system */
  if (allWallCells.length > 0) {
    const [firstWallR, firstWallC] = allWallCells[0];
    const connectedWalls = collectConnectedComponent(firstWallR, firstWallC, [CELL_STATE.WALL]);
    if (connectedWalls.length !== allWallCells.length) {
      return false;
    }
  }

  return true;
}

function updateFeedbackBanner(validation) {
  statusBanner.classList.remove("status-error", "status-hint");

  if (validation.errorReasons.length > 0) {
    statusBanner.classList.add("status-error");
    statusText.textContent = `⚠️ Rule Violation: ${validation.errorReasons.join(" • ")}`;
    return;
  }

  if (validation.wallsFormValidPartition && validation.undecidedCount > 0) {
    statusBanner.classList.add("status-hint");
    statusText.textContent =
      `✨ All walls are correctly placed! Right-click the remaining ${validation.undecidedCount} undecided cell(s) or click "Mark Undecided as Property" to finish!`;
    return;
  }

  statusText.textContent =
    `Left-click/drag: build or remove walls • Right-click/drag: mark or unmark property (${validation.undecidedCount} undecided remaining)`;
}

/* Victory & Leaderboard Handling */
function handleVictory() {
  state.isGameOver = true;
  stopTimer();

  saveLeaderboardEntry(state.selectedLevel, state.playerName, state.elapsedSeconds);

  victoryPlayer.textContent = state.playerName;
  victoryLevel.textContent = LEVELS[state.selectedLevel].name;
  victoryTime.textContent = formatTime(state.elapsedSeconds);
  victoryModal.classList.remove("hidden");
}

function getLeaderboards() {
  const raw = localStorage.getItem(STORAGE_KEYS.LEADERBOARDS);
  if (!raw) {
    return { easy: [], medium: [], hard: [] };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      easy: Array.isArray(parsed.easy) ? parsed.easy : [],
      medium: Array.isArray(parsed.medium) ? parsed.medium : [],
      hard: Array.isArray(parsed.hard) ? parsed.hard : []
    };
  } catch {
    return { easy: [], medium: [], hard: [] };
  }
}

function saveLeaderboardEntry(levelKey, playerName, timeSeconds) {
  const boards = getLeaderboards();
  boards[levelKey].push({
    playerName,
    level: LEVELS[levelKey].name,
    timeSeconds,
    completedAt: new Date().toLocaleDateString()
  });

  boards[levelKey].sort((a, b) => a.timeSeconds - b.timeSeconds);
  localStorage.setItem(STORAGE_KEYS.LEADERBOARDS, JSON.stringify(boards));
}

function renderLeaderboard() {
  const boards = getLeaderboards();
  const entries = boards[state.selectedLeaderboardTab] || [];
  leaderboardList.innerHTML = "";

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.classList.add("empty-msg");
    empty.textContent = "No completed games recorded for this difficulty yet.";
    leaderboardList.appendChild(empty);
    return;
  }

  entries.forEach((entry, index) => {
    const item = document.createElement("div");
    item.classList.add("list-item");

    const details = document.createElement("div");
    details.classList.add("list-item-details");

    const title = document.createElement("strong");
    title.textContent = `#${index + 1} — ${entry.playerName}`;

    const meta = document.createElement("span");
    meta.textContent = `Level: ${entry.level} • Date: ${entry.completedAt}`;

    details.appendChild(title);
    details.appendChild(meta);

    const badge = document.createElement("span");
    badge.classList.add("timer-badge");
    badge.textContent = formatTime(entry.timeSeconds);

    item.appendChild(details);
    item.appendChild(badge);
    leaderboardList.appendChild(item);
  });
}

/* Saving and Loading Games */
function getSavedGames() {
  const raw = localStorage.getItem(STORAGE_KEYS.SAVED_GAMES);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCurrentGame() {
  if (state.isGameOver) {
    return;
  }
  const saves = getSavedGames();
  const newSave = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    playerName: state.playerName,
    levelKey: state.selectedLevel,
    board: state.board.map((row) => [...row]),
    elapsedSeconds: state.elapsedSeconds,
    savedAt: new Date().toLocaleString()
  };

  saves.unshift(newSave);
  localStorage.setItem(STORAGE_KEYS.SAVED_GAMES, JSON.stringify(saves));

  statusBanner.classList.remove("status-error");
  statusBanner.classList.add("status-hint");
  statusText.textContent = "💾 Game state saved! You can resume it anytime from the Start Screen.";
}

function renderSavedGames() {
  const saves = getSavedGames();
  savedGamesList.innerHTML = "";

  if (saves.length === 0) {
    const empty = document.createElement("p");
    empty.classList.add("empty-msg");
    empty.textContent = "No saved games found.";
    savedGamesList.appendChild(empty);
    return;
  }

  for (const save of saves) {
    const item = document.createElement("div");
    item.classList.add("list-item");

    const details = document.createElement("div");
    details.classList.add("list-item-details");

    const title = document.createElement("strong");
    const levelObj = LEVELS[save.levelKey] || LEVELS.easy;
    title.textContent = `${save.playerName} (${levelObj.name})`;

    const meta = document.createElement("span");
    meta.textContent = `Time: ${formatTime(save.elapsedSeconds)} • Saved: ${save.savedAt}`;

    details.appendChild(title);
    details.appendChild(meta);

    const actions = document.createElement("div");
    actions.classList.add("list-item-actions");

    const loadBtn = document.createElement("button");
    loadBtn.type = "button";
    loadBtn.classList.add("primary-btn", "small-btn");
    loadBtn.dataset.action = "load";
    loadBtn.dataset.id = save.id;
    loadBtn.textContent = "Resume";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.classList.add("danger-btn", "small-btn");
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.id = save.id;
    deleteBtn.textContent = "Delete";

    actions.appendChild(loadBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(details);
    item.appendChild(actions);
    savedGamesList.appendChild(item);
  }
}

/* Screen Navigation */
function launchGame(playerName, levelKey, customBoard = null, initialSeconds = 0) {
  state.playerName = playerName;
  state.selectedLevel = levelKey;
  state.board = customBoard ? customBoard.map((row) => [...row]) : createInitialBoard(levelKey);
  state.isGameOver = false;

  displayPlayerName.textContent = state.playerName;
  displayLevelName.textContent = `${LEVELS[levelKey].name} (${LEVELS[levelKey].rows}×${LEVELS[levelKey].cols})`;
  victoryModal.classList.add("hidden");

  startScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  renderBoard();
  startTimer(initialSeconds);
}

function returnToMainMenu() {
  stopTimer();
  victoryModal.classList.add("hidden");
  gameScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
  renderSavedGames();
  renderLeaderboard();
}

/* Board Interaction & Event Delegation */
function applyCellModification(row, col, targetState) {
  if (state.isGameOver) {
    return;
  }
  const current = state.board[row][col];
  if (current === CELL_STATE.HOUSE || current === targetState) {
    return;
  }
  state.board[row][col] = targetState;
  renderBoard();
}

gameBoard.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

gameBoard.addEventListener("mousedown", (event) => {
  if (state.isGameOver) {
    return;
  }
  const cellEl = event.target.closest(".cell");
  if (!cellEl) {
    return;
  }

  const row = Number(cellEl.dataset.row);
  const col = Number(cellEl.dataset.col);
  const currentState = state.board[row][col];

  if (currentState === CELL_STATE.HOUSE) {
    return;
  }

  if (event.button === 0) {
    /* Left-click: toggle Wall */
    event.preventDefault();
    state.dragActive = true;
    state.dragButton = 0;
    state.dragTargetState =
      currentState === CELL_STATE.WALL ? CELL_STATE.UNDECIDED : CELL_STATE.WALL;
    state.visitedInDrag.clear();
    state.visitedInDrag.add(`${row},${col}`);
    applyCellModification(row, col, state.dragTargetState);
  } else if (event.button === 2) {
    /* Right-click: toggle Property */
    event.preventDefault();
    state.dragActive = true;
    state.dragButton = 2;
    state.dragTargetState =
      currentState === CELL_STATE.PROPERTY ? CELL_STATE.UNDECIDED : CELL_STATE.PROPERTY;
    state.visitedInDrag.clear();
    state.visitedInDrag.add(`${row},${col}`);
    applyCellModification(row, col, state.dragTargetState);
  }
});

gameBoard.addEventListener("mouseover", (event) => {
  if (!state.dragActive || state.isGameOver) {
    return;
  }
  const cellEl = event.target.closest(".cell");
  if (!cellEl) {
    return;
  }

  const row = Number(cellEl.dataset.row);
  const col = Number(cellEl.dataset.col);
  const key = `${row},${col}`;

  if (state.visitedInDrag.has(key)) {
    return;
  }

  state.visitedInDrag.add(key);
  applyCellModification(row, col, state.dragTargetState);
});

window.addEventListener("mouseup", () => {
  if (state.dragActive) {
    state.dragActive = false;
    state.dragButton = null;
    state.dragTargetState = null;
    state.visitedInDrag.clear();
  }
});

/* UI Control Listeners */
levelSelector.addEventListener("click", (event) => {
  const btn = event.target.closest(".level-btn");
  if (!btn) {
    return;
  }
  state.selectedLevel = btn.dataset.level;
  const allBtns = document.querySelectorAll(".level-btn");
  allBtns.forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
});

startGameBtn.addEventListener("click", () => {
  const trimmedName = playerNameInput.value.trim();
  if (!trimmedName) {
    nameError.classList.remove("hidden");
    playerNameInput.focus();
    return;
  }
  nameError.classList.add("hidden");
  launchGame(trimmedName, state.selectedLevel);
});

playerNameInput.addEventListener("input", () => {
  if (playerNameInput.value.trim()) {
    nameError.classList.add("hidden");
  }
});

toggleRulesBtn.addEventListener("click", () => {
  rulesPanel.classList.toggle("hidden");
});

closeRulesBtn.addEventListener("click", () => {
  rulesPanel.classList.add("hidden");
});

leaderboardTabs.addEventListener("click", (event) => {
  const btn = event.target.closest(".tab-btn");
  if (!btn) {
    return;
  }
  state.selectedLeaderboardTab = btn.dataset.board;
  const allTabs = document.querySelectorAll(".tab-btn");
  allTabs.forEach((t) => t.classList.remove("active"));
  btn.classList.add("active");
  renderLeaderboard();
});

savedGamesList.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) {
    return;
  }
  const action = btn.dataset.action;
  const saveId = btn.dataset.id;
  const saves = getSavedGames();

  if (action === "load") {
    const found = saves.find((s) => s.id === saveId);
    if (found) {
      playerNameInput.value = found.playerName;
      launchGame(found.playerName, found.levelKey, found.board, found.elapsedSeconds);
    }
  } else if (action === "delete") {
    const filtered = saves.filter((s) => s.id !== saveId);
    localStorage.setItem(STORAGE_KEYS.SAVED_GAMES, JSON.stringify(filtered));
    renderSavedGames();
  }
});

fillPropertyBtn.addEventListener("click", () => {
  if (state.isGameOver) {
    return;
  }
  const level = LEVELS[state.selectedLevel];
  for (let r = 0; r < level.rows; r += 1) {
    for (let c = 0; c < level.cols; c += 1) {
      if (state.board[r][c] === CELL_STATE.UNDECIDED) {
        state.board[r][c] = CELL_STATE.PROPERTY;
      }
    }
  }
  renderBoard();
});

saveGameBtn.addEventListener("click", () => {
  saveCurrentGame();
});

backMenuBtn.addEventListener("click", () => {
  returnToMainMenu();
});

victoryMenuBtn.addEventListener("click", () => {
  returnToMainMenu();
});

/* Initial Screen Hydration */
renderSavedGames();
renderLeaderboard();