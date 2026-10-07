/**
 * TimeAlign - Game Logic
 * Pick random puzzles from pool, Drag & Drop, validation, sharing.
 */

import { generateShareText, copyToClipboard } from './utils/share.js';

// ─── State ───────────────────────────────────────────────
const MAX_ATTEMPTS = 3;

let puzzle = null;          // current puzzle: { events: [...] }
let currentOrder = [];      // event ids in visual order
let attemptsUsed = 0;
let attemptGrids = [];      // arrays of 'correct'/'incorrect'
let gameState = 'playing';  // 'playing' | 'won' | 'lost'
let correctSet = new Set(); // locked correct event ids
let puzzlesPool = [];       // all available puzzles

// ─── DOM ────────────────────────────────────────────────
const listEl = document.getElementById('events-grid');
const attemptsEl = document.getElementById('attempts');
const checkBtn = document.getElementById('check-btn');
const newGameBtn = document.getElementById('new-game-btn');
const modal = document.getElementById('result-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const factsList = document.getElementById('facts-list');
const puzzleIdEl = document.getElementById('puzzle-id');
const shareBtn = document.getElementById('share-btn');
const shareTextEl = document.getElementById('share-text');
const closeModalBtn = document.getElementById('close-modal');

// ─── Init ───────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('public/data/puzzle_diario.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    puzzlesPool = data.puzzles || [data]; // support both formats
  } catch (err) {
    console.error('Failed to load puzzles:', err);
    listEl.innerHTML = `
      <div style="text-align:center;padding:3rem;color:var(--muted);">
        <p style="font-size:1.1rem;margin-bottom:0.5rem;">⚠️ No se pudo cargar el juego</p>
        <p style="font-size:0.85rem;">Recarga la página.</p>
      </div>`;
    return;
  }

  startNewGame();
}

function startNewGame() {
  // Pick random puzzle from pool
  const idx = Math.floor(Math.random() * puzzlesPool.length);
  puzzle = puzzlesPool[idx];

  // Reset state
  attemptsUsed = 0;
  attemptGrids = [];
  gameState = 'playing';
  correctSet = new Set();
  currentOrder = shuffle(puzzle.events.map(e => e.id));

  checkBtn.disabled = false;
  renderAttempts();
  renderList();
}

// ─── Rendering ──────────────────────────────────────────
function renderAttempts() {
  attemptsEl.innerHTML = '';
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const div = document.createElement('div');
    div.className = 'attempt-indicator';
    if (i < attemptGrids.length) {
      const allCorrect = attemptGrids[i].every(p => p === 'correct');
      div.classList.add(allCorrect ? 'correct' : 'incorrect');
      div.textContent = allCorrect ? '✓' : '✗';
    } else {
      div.textContent = i + 1;
    }
    attemptsEl.appendChild(div);
  }
}

function renderList() {
  listEl.innerHTML = '';

  currentOrder.forEach((eventId, position) => {
    const event = puzzle.events.find(e => e.id === eventId);
    if (!event) return;

    const card = document.createElement('div');
    card.className = 'event-card';
    card.dataset.eventId = eventId;
    card.dataset.position = position;
    card.setAttribute('draggable', 'false');
    card.setAttribute('tabindex', '0');

    const isLocked = correctSet.has(eventId);

    if (isLocked) {
      card.classList.add('correct');
      card.style.cursor = 'default';
    } else if (gameState === 'playing') {
      card.setAttribute('draggable', 'true');
      setupDragDrop(card);
    }

    // Show incorrect styling on game over
    if (gameState === 'lost' && !isLocked && attemptGrids.length > 0) {
      const lastGrid = attemptGrids[attemptGrids.length - 1];
      if (lastGrid[position] === 'incorrect') {
        card.classList.add('incorrect');
      }
    }

    const positionLabel = position === 0 ? 'Más antiguo' :
                          position === currentOrder.length - 1 ? 'Más reciente' :
                          `Posición ${position + 1}`;

    card.innerHTML = `
      <span class="event-handle">☰</span>
      <span class="event-number">${positionLabel}</span>
      <span class="event-name">${escapeHtml(event.name)}</span>
    `;

    listEl.appendChild(card);
  });
}

// ─── Drag & Drop (HTML5 Native) ─────────────────────────
let draggedCard = null;

function setupDragDrop(card) {
  card.addEventListener('dragstart', (e) => {
    draggedCard = card;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.eventId);
    requestAnimationFrame(() => card.style.opacity = '0.4');
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    card.style.opacity = '';
    draggedCard = null;
    listEl.querySelectorAll('.event-card').forEach(c => {
      c.style.borderTop = '';
      c.style.borderBottom = '';
    });
  });

  card.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (card === draggedCard) return;

    const rect = card.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const isBefore = e.clientY < midpoint;

    card.style.borderTop = isBefore ? '2px solid var(--accent)' : '';
    card.style.borderBottom = !isBefore ? '2px solid var(--accent)' : '';
  });

  card.addEventListener('dragleave', () => {
    card.style.borderTop = '';
    card.style.borderBottom = '';
  });

  card.addEventListener('drop', (e) => {
    e.preventDefault();
    card.style.borderTop = '';
    card.style.borderBottom = '';
    if (!draggedCard || card === draggedCard) return;

    const fromPos = parseInt(draggedCard.dataset.position, 10);
    const toPos = parseInt(card.dataset.position, 10);

    const rect = card.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const insertAfter = e.clientY >= midpoint;

    let target = toPos;
    if (fromPos !== target) {
      moveEvent(fromPos, target);
    }
  });

  // Keyboard
  card.addEventListener('keydown', (e) => {
    const pos = parseInt(card.dataset.position, 10);
    if (e.key === 'ArrowUp' && pos > 0) {
      e.preventDefault();
      moveEvent(pos, pos - 1);
    } else if (e.key === 'ArrowDown' && pos < currentOrder.length - 1) {
      e.preventDefault();
      moveEvent(pos, pos + 1);
    }
  });
}

function moveEvent(from, to) {
  const movingId = currentOrder[from];
  if (correctSet.has(movingId)) return;

  const [item] = currentOrder.splice(from, 1);
  currentOrder.splice(to, 0, item);
  renderList();

  const movedCard = listEl.querySelector(`[data-position="${to}"]`);
  if (movedCard) movedCard.focus();
}

// ─── Validation ─────────────────────────────────────────
function checkAnswer() {
  if (gameState !== 'playing') return;

  const sortedEvents = [...puzzle.events].sort((a, b) => a.year - b.year);
  const correctOrder = sortedEvents.map(e => e.id);

  const gridResult = currentOrder.map((id, i) =>
    id === correctOrder[i] ? 'correct' : 'incorrect'
  );

  attemptGrids.push(gridResult);
  attemptsUsed++;

  const success = gridResult.every(p => p === 'correct');

  if (success) {
    gameState = 'won';
    correctSet = new Set(currentOrder);
    checkBtn.disabled = true;
    renderAttempts();
    renderList();
    setTimeout(() => showResultModal(true), 500);
    return;
  }

  recomputeCorrectSet(gridResult);

  if (attemptsUsed >= MAX_ATTEMPTS) {
    gameState = 'lost';
    checkBtn.disabled = true;
    renderAttempts();
    renderList();
    setTimeout(() => showResultModal(false), 500);
    return;
  }

  renderAttempts();
  renderList();
}

function recomputeCorrectSet(grid) {
  correctSet.clear();
  currentOrder.forEach((id, i) => {
    if (grid && grid[i] === 'correct') correctSet.add(id);
  });
}

// ─── Result Modal ───────────────────────────────────────
function showResultModal(won) {
  modalTitle.textContent = won ? '🎉 ¡Correcto!' : '😔 Sin intentos';
  modalTitle.style.color = won ? 'var(--correct)' : 'var(--incorrect)';

  modalMessage.textContent = won
    ? `Has ordenado la historia correctamente en ${attemptsUsed} intento${attemptsUsed > 1 ? 's' : ''}.`
    : `El orden correcto era: ${getCorrectOrderText()}`;

  const sorted = [...puzzle.events].sort((a, b) => a.year - b.year);
  factsList.innerHTML = `
    <h3>Curiosidades</h3>
    <ul>
      ${sorted.map(e => `
        <li>
          <strong style="color:var(--accent);">${e.year}</strong> — ${escapeHtml(e.name)}<br>
          <span style="color:var(--muted);font-size:0.8rem;">${escapeHtml(e.fact)}</span>
        </li>
      `).join('')}
    </ul>
  `;

  puzzleIdEl.textContent = `Partida ${Date.now().toString(36).slice(-5).toUpperCase()}`;
  modal.classList.add('active');
}

function getCorrectOrderText() {
  const sorted = [...puzzle.events].sort((a, b) => a.year - b.year);
  return sorted.map(e => `${e.year} ${e.name}`).join(' → ');
}

// ─── Share ──────────────────────────────────────────────
async function handleShare() {
  const text = generateShareText({
    puzzleId: puzzleIdEl.textContent,
    attemptsUsed,
    attemptsHistory: attemptGrids,
  });

  shareTextEl.value = text;
  const copied = await copyToClipboard(text);

  if (copied) {
    shareBtn.textContent = '✓ ¡Copiado!';
    setTimeout(() => { shareBtn.textContent = 'Compartir resultado'; }, 2000);
  } else {
    shareTextEl.classList.add('visible');
    shareTextEl.select();
    shareBtn.textContent = 'Selecciona y copia (Ctrl+C)';
  }
}

// ─── Utils ──────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // Ensure not already sorted
  const sorted = [...arr].sort((x, y) => {
    const ex = puzzle.events.find(e => e.id === x);
    const ey = puzzle.events.find(e => e.id === y);
    return ex.year - ey.year;
  });
  if (a.every((v, i) => v === sorted[i]) && a.length > 1) {
    [a[0], a[1]] = [a[1], a[0]];
  }
  return a;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Event Listeners ────────────────────────────────────
checkBtn.addEventListener('click', checkAnswer);
shareBtn.addEventListener('click', handleShare);
closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
newGameBtn.addEventListener('click', () => {
  modal.classList.remove('active');
  startNewGame();
});

modal.addEventListener('click', e => {
  if (e.target === modal) modal.classList.remove('active');
});

// ─── Start ──────────────────────────────────────────────
init();