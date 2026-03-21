// ── Regis Chess UI ──

let selected = null;       // {r, c} of selected square
let legalMoves = [];       // legal moves for selected piece
let pendingPromo = null;   // pending promotion move
let snapshots = [];        // state snapshots for undo

// ── Initialisation ──────────────────────────────────────────

function newGame() {
  state = createState();
  selected = null;
  legalMoves = [];
  pendingPromo = null;
  snapshots = [];
  closeModals();
  renderAll();
  // If AI goes first (shouldn't normally happen), trigger it
  maybeTriggerAI();
}

function closeModals() {
  document.getElementById('promoOverlay').style.display = 'none';
  document.getElementById('gameOverOverlay').style.display = 'none';
}

// ── Rendering ───────────────────────────────────────────────

function renderAll() {
  renderBoard();
  renderSidebar();
}

function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';

  const highlightFrom = selected;
  const highlightMoves = new Set(legalMoves.map(m => m.to.r + ',' + m.to.c));
  const lastMove = state.history.length > 0 ? state.history[state.history.length - 1] : null;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      sq.dataset.r = r;
      sq.dataset.c = c;

      // Highlight last move
      if (lastMove) {
        if ((lastMove.from.r === r && lastMove.from.c === c) ||
            (lastMove.to.r === r && lastMove.to.c === c)) {
          sq.classList.add('last-move');
        }
      }

      // Highlight selected square
      if (highlightFrom && highlightFrom.r === r && highlightFrom.c === c) {
        sq.classList.add('selected');
      }

      // Highlight legal move targets
      if (highlightMoves.has(r + ',' + c)) {
        sq.classList.add(state.board[r][c] ? 'capture-hint' : 'move-hint');
      }

      // Check highlight on king
      if (state.status === 'check' || state.status === 'checkmate') {
        const king = findKing(state.board, state.turn);
        if (king && king.r === r && king.c === c) {
          sq.classList.add('in-check');
        }
      }

      // Piece
      const piece = state.board[r][c];
      if (piece) {
        const pieceEl = document.createElement('div');
        pieceEl.className = 'piece ' + (piece[0] === 'w' ? 'piece-white' : 'piece-black');
        pieceEl.textContent = PIECES[piece];
        sq.appendChild(pieceEl);
      }

      sq.addEventListener('click', () => onSquareClick(r, c));
      boardEl.appendChild(sq);
    }
  }

  renderCoords();
}

function renderCoords() {
  const files = ['A','B','C','D','E','F','G','H'];
  const ranks = ['8','7','6','5','4','3','2','1'];

  const tops    = document.getElementById('coordsTop');
  const bottoms = document.getElementById('coordsBottom');
  const lefts   = document.getElementById('coordsLeft');
  const rights  = document.getElementById('coordsRight');

  if (!tops) return;

  tops.innerHTML = '';
  bottoms.innerHTML = '';
  lefts.innerHTML = '';
  rights.innerHTML = '';

  files.forEach(f => {
    let el = document.createElement('div'); el.className = 'coord'; el.textContent = f; tops.appendChild(el);
    el = document.createElement('div'); el.className = 'coord'; el.textContent = f; bottoms.appendChild(el);
  });
  ranks.forEach(rk => {
    let el = document.createElement('div'); el.className = 'coord'; el.textContent = rk; lefts.appendChild(el);
    el = document.createElement('div'); el.className = 'coord'; el.textContent = rk; rights.appendChild(el);
  });
}

function renderSidebar() {
  // Turn indicator
  const dot  = document.querySelector('.turn-dot');
  const text = document.getElementById('turnText');
  const checkAlert = document.getElementById('checkAlert');

  if (state.status === 'checkmate') {
    const winner = state.turn === 'w' ? 'Black' : 'White';
    text.textContent = winner + ' wins!';
    checkAlert.style.display = 'none';
  } else if (state.status === 'stalemate' || state.status === 'draw') {
    text.textContent = 'Draw';
    checkAlert.style.display = 'none';
  } else {
    const turnName = state.turn === 'w' ? 'White' : 'Black';
    text.textContent = turnName + ' to move';
    if (dot) {
      dot.className = 'turn-dot ' + (state.turn === 'w' ? 'white-dot' : 'black-dot');
    }
    if (state.status === 'check') {
      checkAlert.style.display = 'block';
    } else {
      checkAlert.style.display = 'none';
    }
  }

  // Scores
  document.getElementById('scoreWhite').textContent = state.scores.w;
  document.getElementById('scoreBlack').textContent = state.scores.b;

  // Captured pieces
  const capW = document.getElementById('capturedWhite');
  const capB = document.getElementById('capturedBlack');
  if (capW) capW.textContent = state.capturedW.map(p => PIECES[p]).join(' ');
  if (capB) capB.textContent = state.capturedB.map(p => PIECES[p]).join(' ');

  // Move history
  const logBody = document.getElementById('moveLogBody');
  if (logBody) {
    logBody.innerHTML = '';
    const hist = state.history;
    for (let i = 0; i < hist.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const row = document.createElement('div');
      row.className = 'move-row';
      const numSpan = document.createElement('span');
      numSpan.className = 'move-num';
      numSpan.textContent = moveNum + '.';
      const whiteSpan = document.createElement('span');
      whiteSpan.className = 'move-notation';
      whiteSpan.textContent = hist[i] ? hist[i].notation : '';
      const blackSpan = document.createElement('span');
      blackSpan.className = 'move-notation';
      blackSpan.textContent = hist[i + 1] ? hist[i + 1].notation : '';
      row.appendChild(numSpan);
      row.appendChild(whiteSpan);
      row.appendChild(blackSpan);
      logBody.appendChild(row);
    }
    logBody.scrollTop = logBody.scrollHeight;
  }

  // Game over modal
  if (state.status === 'checkmate' || state.status === 'stalemate' || state.status === 'draw') {
    showGameOver();
  }
}

function showGameOver() {
  const overlay = document.getElementById('gameOverOverlay');
  const title   = document.getElementById('gameOverTitle');
  const sub     = document.getElementById('gameOverSub');
  const icon    = document.getElementById('gameOverIcon');

  if (state.status === 'checkmate') {
    const winner = state.turn === 'w' ? 'Black' : 'White';
    title.textContent = 'Checkmate!';
    sub.textContent   = winner + ' wins';
    icon.textContent  = winner === 'White' ? '♔' : '♚';
  } else if (state.status === 'stalemate') {
    title.textContent = 'Stalemate!';
    sub.textContent   = 'Draw by stalemate';
    icon.textContent  = '½';
  } else {
    title.textContent = 'Draw!';
    sub.textContent   = 'Fifty-move rule';
    icon.textContent  = '½';
  }

  overlay.style.display = 'flex';
}

// ── Click Handling ──────────────────────────────────────────

function onSquareClick(r, c) {
  if (state.status === 'checkmate' || state.status === 'stalemate' || state.status === 'draw') return;

  const aiOn = document.getElementById('aiToggle').checked;
  // If AI is on and it's black's turn, ignore human clicks
  if (aiOn && state.turn === 'b') return;

  const piece = state.board[r][c];

  // If a piece is already selected
  if (selected) {
    const move = legalMoves.find(m => m.to.r === r && m.to.c === c);

    if (move) {
      // Check for promotion
      if (isPromotion(move)) {
        pendingPromo = move;
        showPromoModal(state.turn);
        return;
      }
      doMove(move);
      return;
    }

    // Clicked own piece — reselect
    if (piece && piece[0] === state.turn) {
      selected = {r, c};
      legalMoves = getLegalMovesForSquare(state, r, c);
      renderBoard();
      return;
    }

    // Clicked empty / enemy with no move — deselect
    selected = null;
    legalMoves = [];
    renderBoard();
    return;
  }

  // Nothing selected yet — select own piece
  if (piece && piece[0] === state.turn) {
    selected = {r, c};
    legalMoves = getLegalMovesForSquare(state, r, c);
    renderBoard();
  }
}

function isPromotion(move) {
  const piece = state.board[move.from.r][move.from.c];
  return piece && piece[1] === 'P' && (move.to.r === 0 || move.to.r === 7);
}

function doMove(move, promoType = 'Q') {
  snapshots.push(cloneState(state));
  state = executeMove(state, move, promoType);
  selected = null;
  legalMoves = [];
  renderAll();
  maybeTriggerAI();
}

// ── Promotion Modal ─────────────────────────────────────────

function showPromoModal(col) {
  const overlay  = document.getElementById('promoOverlay');
  const choices  = document.getElementById('promoChoices');
  choices.innerHTML = '';
  const promoTypes = ['Q','R','B','N'];
  promoTypes.forEach(t => {
    const btn = document.createElement('button');
    btn.className = 'promo-btn';
    const pieceKey = col + t;
    btn.textContent = PIECES[pieceKey];
    btn.onclick = () => {
      overlay.style.display = 'none';
      doMove(pendingPromo, t);
      pendingPromo = null;
    };
    choices.appendChild(btn);
  });
  overlay.style.display = 'flex';
}

// ── Undo ────────────────────────────────────────────────────

function undoMove() {
  if (snapshots.length === 0) return;
  const aiOn = document.getElementById('aiToggle').checked;
  // Undo twice when vs AI (undo AI move + player move)
  if (aiOn && snapshots.length >= 2) {
    snapshots.pop(); // remove AI move snapshot
    state = snapshots.pop();
  } else {
    state = snapshots.pop();
  }
  selected = null;
  legalMoves = [];
  closeModals();
  renderAll();
}

// ── AI Integration ──────────────────────────────────────────

function maybeTriggerAI() {
  const aiOn = document.getElementById('aiToggle').checked;
  if (!aiOn) return;
  if (state.turn !== 'b') return;
  if (state.status === 'checkmate' || state.status === 'stalemate' || state.status === 'draw') return;

  const depth = parseInt(document.getElementById('aiDepth').value) || 2;

  // Small delay so UI renders before AI thinks
  setTimeout(() => {
    const move = getBestMove(state, depth);
    if (move) {
      // Check AI promotion (always promote to Queen)
      const promoType = isPromotionMove(move) ? 'Q' : 'Q';
      snapshots.push(cloneState(state));
      state = executeMove(state, move, promoType);
      selected = null;
      legalMoves = [];
      renderAll();
    }
  }, 150);
}

function isPromotionMove(move) {
  const piece = state.board[move.from.r][move.from.c];
  return piece && piece[1] === 'P' && (move.to.r === 0 || move.to.r === 7);
}

// ── Boot ────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Wire up AI toggle to re-trigger AI if it's black's turn
  document.getElementById('aiToggle').addEventListener('change', () => {
    maybeTriggerAI();
  });
  newGame();
});
