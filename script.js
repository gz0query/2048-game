const boardElement = document.querySelector('#board');
const cellLayer = document.querySelector('#cell-layer');
const tileLayer = document.querySelector('#tile-layer');
const scoreElement = document.querySelector('#score');
const bestScoreElement = document.querySelector('#best-score');
const scoreGainElement = document.querySelector('#score-gain');
const moveCountElement = document.querySelector('#move-count');
const levelCountElement = document.querySelector('#level-count');
const timerCountElement = document.querySelector('#timer-count');
const overlay = document.querySelector('#game-overlay');
const overlayKicker = document.querySelector('#overlay-kicker');
const overlayTitle = document.querySelector('#overlay-title');
const overlayMessage = document.querySelector('#overlay-message');
const continueButton = document.querySelector('#continue-button');
const restartButton = document.querySelector('#restart');
const overlayRestartButton = document.querySelector('#overlay-restart');
const resultsButton = document.querySelector('#view-results');
const onboardingModal = document.querySelector('#onboarding-modal');
const onboardingForm = document.querySelector('#onboarding-form');
const playerNameInput = document.querySelector('#player-name');
const playerGreeting = document.querySelector('#player-greeting');
const resultsModal = document.querySelector('#results-modal');
const closeResultsButton = document.querySelector('#close-results');
const historyList = document.querySelector('#history-list');
const emptyHistory = document.querySelector('#empty-history');
const historyHigh = document.querySelector('#history-high');
const historyLow = document.querySelector('#history-low');
const resultsCloseButton = document.querySelector('#results-close-button');

const STORAGE_KEYS = {
  best: 'number-garden-best',
  player: 'number-garden-player',
  lastLogin: 'lastLogin',
  history: 'number-garden-history',
};
const INITIAL_SECONDS = 60;
const LEVEL_BONUS_SECONDS = 45;
const INITIAL_TARGET_SCORE = 500;
const SESSION_DURATION_MS = 6 * 60 * 60 * 1000;

const gridSize = 4;
let grid = [];
let score = 0;
let bestScore = Number(localStorage.getItem(STORAGE_KEYS.best) || 0);
let moveCount = 0;
let nextTileId = 0;
let gameEnded = false;
let level = 1;
let targetScore = INITIAL_TARGET_SCORE;
let timeRemaining = INITIAL_SECONDS;
let timerInterval = null;
let cellSize = 0;
let cellGap = 0;
let playerName = localStorage.getItem(STORAGE_KEYS.player) || '';
const lastLogin = Number(localStorage.getItem(STORAGE_KEYS.lastLogin));
let sessionIsValid = Boolean(
  playerName
  && Number.isFinite(lastLogin)
  && Date.now() >= lastLogin
  && Date.now() - lastLogin < SESSION_DURATION_MS,
);
let touchStartX = 0;
let touchStartY = 0;

bestScoreElement.textContent = bestScore;

function getHistory() {
  const rawHistory = localStorage.getItem(STORAGE_KEYS.history);
  if (!rawHistory) return [];

  try {
    const parsed = JSON.parse(rawHistory);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((entry) => {
      if (typeof entry === 'number' && Number.isFinite(entry)) {
        return { name: '', score: entry, level: 1, date: '—' };
      }

      if (
        entry
        && Number.isFinite(Number(entry.score))
        && Number.isFinite(Number(entry.level))
        && typeof entry.date === 'string'
      ) {
        return {
          name: typeof entry.name === 'string' ? entry.name : '',
          score: Number(entry.score),
          level: Number(entry.level),
          date: entry.date,
        };
      }

      return null;
    }).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function saveHistory(result) {
  const history = getHistory();
  history.push(result);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history.slice(-10)));
}

function updatePlayerGreeting() {
  if (!playerName || !sessionIsValid) {
    playerGreeting.textContent = '';
    return;
  }

  playerGreeting.textContent = `Good luck, ${playerName}! Here is your score.`;
}

function openOnboarding() {
  onboardingModal.hidden = false;
  playerNameInput.value = playerName;
  window.setTimeout(() => playerNameInput.focus(), 60);
}

function closeOnboarding() {
  onboardingModal.hidden = true;
}

function savePlayerName(name) {
  const trimmedName = name.trim();
  if (!trimmedName) return;
  playerName = trimmedName;
  sessionIsValid = true;
  localStorage.setItem(STORAGE_KEYS.player, trimmedName);
  localStorage.setItem(STORAGE_KEYS.lastLogin, String(Date.now()));
  updatePlayerGreeting();
  closeOnboarding();
  startTimer();
}

function renderHistory() {
  const history = getHistory();
  if (!history.length) {
    historyList.innerHTML = '';
    emptyHistory.hidden = false;
    historyHigh.textContent = '—';
    historyLow.textContent = '—';
    return;
  }

  emptyHistory.hidden = true;
  const scores = history.map((entry) => entry.score);
  historyHigh.textContent = String(Math.max(...scores));
  historyLow.textContent = String(Math.min(...scores));

  historyList.replaceChildren();
  history.slice(-10).reverse().forEach((result) => {
    const item = document.createElement('li');
    item.className = 'history-item';

    const date = document.createElement('span');
    date.className = 'history-date';
    date.textContent = result.date;

    const levelReached = document.createElement('span');
    levelReached.className = 'history-level';
    levelReached.textContent = `Level ${result.level}`;

    const resultScore = document.createElement('strong');
    resultScore.className = 'history-score';
    resultScore.textContent = String(result.score);

    item.append(date, levelReached, resultScore);
    historyList.append(item);
  });
}

function openResults() {
  renderHistory();
  resultsModal.hidden = false;
}

function closeResults() {
  resultsModal.hidden = true;
}

function updateLevelDisplay() {
  levelCountElement.textContent = `LEVEL ${level} · TARGET ${targetScore}`;
}

function updateTimerDisplay() {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  timerCountElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  timerCountElement.classList.toggle('timer-warning', timeRemaining <= 10);
}

function stopTimer() {
  if (timerInterval !== null) {
    window.clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startTimer() {
  stopTimer();
  timerInterval = window.setInterval(() => {
    if (gameEnded || !overlay.hidden || !onboardingModal.hidden || !resultsModal.hidden) return;
    timeRemaining = Math.max(0, timeRemaining - 1);
    updateTimerDisplay();
    if (timeRemaining === 0) endGame('time');
  }, 1000);
}

function endGame(reason) {
  if (gameEnded) return;

  gameEnded = true;
  stopTimer();
  saveHistory({
    name: playerName,
    score,
    level,
    date: new Date().toLocaleString(),
  });
  renderHistory();

  showOverlay({
    kicker: reason === 'time' ? 'TIME IS UP' : 'THAT’S A FULL BOARD',
    title: playerName ? `Well played, ${playerName}.` : 'Well played.',
    message: reason === 'time'
      ? `Time ran out at level ${level}. You finished with ${score} points${playerName ? `, ${playerName}` : ''}.`
      : `No more moves at level ${level}. You finished with ${score} points${playerName ? `, ${playerName}` : ''}.`,
    canContinue: false,
  });
}

function createEmptyGrid() {
  return Array.from({ length: gridSize }, () => Array(gridSize).fill(null));
}

function makeTile(value) {
  return { id: nextTileId++, value, merged: false, isNew: true };
}

function createCells() {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < gridSize * gridSize; index += 1) {
    const cell = document.createElement('div');
    cell.className = 'empty-cell';
    cell.setAttribute('role', 'presentation');
    fragment.append(cell);
  }
  cellLayer.append(fragment);
}

function updateTilePositions() {
  const layerWidth = tileLayer.clientWidth;
  if (!layerWidth) return;

  const styles = getComputedStyle(cellLayer);
  cellGap = Number.parseFloat(styles.columnGap) || 0;
  cellSize = (layerWidth - cellGap * (gridSize - 1)) / gridSize;

  tileLayer.querySelectorAll('.tile').forEach((tileElement) => {
    const row = Number(tileElement.dataset.row);
    const column = Number(tileElement.dataset.column);
    tileElement.style.width = `${cellSize}px`;
    tileElement.style.height = `${cellSize}px`;
    tileElement.style.left = `${column * (cellSize + cellGap)}px`;
    tileElement.style.top = `${row * (cellSize + cellGap)}px`;
  });
}

function renderGrid() {
  const existingTiles = new Map(
    [...tileLayer.children].map((tileElement) => [Number(tileElement.dataset.id), tileElement]),
  );
  const visibleIds = new Set();

  grid.forEach((row, rowIndex) => {
    row.forEach((tile, columnIndex) => {
      if (!tile) return;
      visibleIds.add(tile.id);

      let tileElement = existingTiles.get(tile.id);
      if (!tileElement) {
        tileElement = document.createElement('div');
        tileElement.className = 'tile';
        tileElement.dataset.id = tile.id;
        tileElement.setAttribute('role', 'gridcell');
        tileLayer.append(tileElement);
      }

      tileElement.className = `tile tile-${tile.value <= 2048 ? tile.value : 'super'}`;
      if (tile.isNew) tileElement.classList.add('tile-new');
      if (tile.merged) tileElement.classList.add('tile-merged');
      tileElement.textContent = tile.value;
      tileElement.setAttribute('aria-label', String(tile.value));
      tileElement.dataset.row = rowIndex;
      tileElement.dataset.column = columnIndex;
      tile.isNew = false;
      tile.merged = false;
    });
  });

  existingTiles.forEach((tileElement, id) => {
    if (!visibleIds.has(id)) tileElement.remove();
  });

  updateTilePositions();
}

function addRandomTile() {
  const emptyCells = [];
  grid.forEach((row, rowIndex) => {
    row.forEach((tile, columnIndex) => {
      if (!tile) emptyCells.push({ row: rowIndex, column: columnIndex });
    });
  });

  if (!emptyCells.length) return;

  const { row, column } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  grid[row][column] = makeTile(Math.random() < 0.9 ? 2 : 4);
}

function updateScore(points = 0) {
  score += points;
  scoreElement.textContent = score;

  if (score > bestScore) {
    bestScore = score;
    bestScoreElement.textContent = bestScore;
    localStorage.setItem('number-garden-best', String(bestScore));
  }

  if (points > 0) {
    scoreGainElement.textContent = `+${points}`;
    scoreGainElement.classList.remove('show');
    void scoreGainElement.offsetWidth;
    scoreGainElement.classList.add('show');
  }
}

function showOverlay({ kicker, title, message, canContinue }) {
  overlayKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlayMessage.textContent = message;
  continueButton.hidden = !canContinue;
  overlay.hidden = false;
}

function resetGame() {
  stopTimer();
  grid = createEmptyGrid();
  score = 0;
  moveCount = 0;
  nextTileId = 0;
  gameEnded = false;
  level = 1;
  targetScore = INITIAL_TARGET_SCORE;
  timeRemaining = INITIAL_SECONDS;
  scoreElement.textContent = '0';
  moveCountElement.textContent = 'MOVE 01';
  scoreGainElement.classList.remove('show');
  overlay.hidden = true;
  updateLevelDisplay();
  updateTimerDisplay();
  addRandomTile();
  addRandomTile();
  renderGrid();
  startTimer();
}

function readLine(direction, lineIndex) {
  return Array.from({ length: gridSize }, (_, offset) => {
    if (direction === 'left') return grid[lineIndex][offset];
    if (direction === 'right') return grid[lineIndex][gridSize - 1 - offset];
    if (direction === 'up') return grid[offset][lineIndex];
    return grid[gridSize - 1 - offset][lineIndex];
  });
}

function writeLine(direction, lineIndex, line) {
  line.forEach((tile, offset) => {
    if (direction === 'left') grid[lineIndex][offset] = tile;
    else if (direction === 'right') grid[lineIndex][gridSize - 1 - offset] = tile;
    else if (direction === 'up') grid[offset][lineIndex] = tile;
    else grid[gridSize - 1 - offset][lineIndex] = tile;
  });
}

function move(direction) {
  if (gameEnded || !overlay.hidden || !onboardingModal.hidden || !resultsModal.hidden) return;

  let changed = false;
  let gainedPoints = 0;

  for (let lineIndex = 0; lineIndex < gridSize; lineIndex += 1) {
    const originalLine = readLine(direction, lineIndex);
    const compactLine = originalLine.filter(Boolean);
    const mergedLine = [];

    for (let index = 0; index < compactLine.length; index += 1) {
      const currentTile = compactLine[index];
      const nextTile = compactLine[index + 1];
      if (nextTile && currentTile.value === nextTile.value) {
        currentTile.value *= 2;
        currentTile.merged = true;
        currentTile.isNew = false;
        gainedPoints += currentTile.value;
        mergedLine.push(currentTile);
        index += 1;
      } else {
        mergedLine.push(currentTile);
      }
    }

    while (mergedLine.length < gridSize) mergedLine.push(null);
    if (originalLine.some((tile, index) => tile !== mergedLine[index])) changed = true;
    writeLine(direction, lineIndex, mergedLine);
  }

  if (!changed) return;

  moveCount += 1;
  moveCountElement.textContent = `MOVE ${String(moveCount).padStart(2, '0')}`;
  updateScore(gainedPoints);
  addRandomTile();
  renderGrid();

  if (score >= targetScore) {
    level += 1;
    targetScore += INITIAL_TARGET_SCORE;
    timeRemaining += LEVEL_BONUS_SECONDS;
    updateLevelDisplay();
    updateTimerDisplay();
    showOverlay({
      kicker: `LEVEL ${level} UNLOCKED`,
      title: 'Level Up!',
      message: `Target reached! Your next target is ${targetScore} points. You earned ${LEVEL_BONUS_SECONDS} bonus seconds.`,
      canContinue: true,
    });
    return;
  }

  if (!hasMovesLeft()) {
    endGame('gridlock');
  }
}

function hasMovesLeft() {
  for (let row = 0; row < gridSize; row += 1) {
    for (let column = 0; column < gridSize; column += 1) {
      const tile = grid[row][column];
      if (!tile) return true;
      if (column < gridSize - 1 && tile.value === grid[row][column + 1]?.value) return true;
      if (row < gridSize - 1 && tile.value === grid[row + 1][column]?.value) return true;
    }
  }
  return false;
}

document.addEventListener('keydown', (event) => {
  if (!onboardingModal.hidden || !resultsModal.hidden || event.target instanceof HTMLInputElement) return;
  const key = event.key.toLowerCase();
  const directions = {
    w: 'up', arrowup: 'up',
    a: 'left', arrowleft: 'left',
    s: 'down', arrowdown: 'down',
    d: 'right', arrowright: 'right',
  };
  const direction = directions[key];
  if (!direction) return;
  event.preventDefault();
  move(direction);
});

boardElement.addEventListener('touchstart', (event) => {
  const touch = event.changedTouches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}, { passive: true });

boardElement.addEventListener('touchend', (event) => {
  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (Math.max(absX, absY) < 26) return;

  if (absX > absY) {
    move(deltaX > 0 ? 'right' : 'left');
    return;
  }

  move(deltaY > 0 ? 'down' : 'up');
}, { passive: true });

restartButton.addEventListener('click', resetGame);
resultsButton.addEventListener('click', openResults);
closeResultsButton.addEventListener('click', closeResults);
resultsCloseButton.addEventListener('click', closeResults);
overlayRestartButton.addEventListener('click', resetGame);
continueButton.addEventListener('click', () => {
  overlay.hidden = true;
  if (!hasMovesLeft()) endGame('gridlock');
});
onboardingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  savePlayerName(playerNameInput.value);
});
window.addEventListener('resize', updateTilePositions);
window.addEventListener('click', (event) => {
  if (event.target === resultsModal) closeResults();
});

createCells();
updatePlayerGreeting();
if (!sessionIsValid) {
  openOnboarding();
}
resetGame();