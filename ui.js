// ── Regis Chess UI ──

let selected    = null;   // {r, c} of selected square
let legalMoves  = [];     // legal moves for selected piece
let pendingPromo = null;  // pending promotion move
let snapshots   = [];     // state snapshots for undo

// ── New Game ─────────────────────────────────────────────────

function newGame() {
  state        = createState();
  selected     = null;
  legalMoves   = [];
  pendingPromo = null;
  snapshots    = [];
  closeModals();
  renderAll();
  maybeTriggerAI();
}

function closeModals() {
  document.getElementById('promoOverlay').style.display   = 'none';
  document.getElementById('gameOverOverlay').style.display = 'none';
}

// ── Render ───────────────────────────────────────────────────

function renderAll() {
  renderBoard();
  renderSidebar();
}

function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';

  const legalSet  = new Set(legalMoves.map(m => m.to.r + ',' + m.to.c));
  const lastMove  = state.history.length ? state.history[state.history.length - 1] : null;
  const kingCheck = (state.status === 'check' || state.status === 'checkmate')
                    ? findKing(state.board, state.turn) : null;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');

      // matches CSS: .sq.light / .sq.dark
      sq.className = 'sq ' + ((r + c) % 2 === 1 ? 'light' : 'dark');

      // Last move highlight
      if (lastMove &&
          ((lastMove.from.r === r && lastMove.from.c === c) ||
           (lastMove.to.r   === r && lastMove.to.c   === c))) {
        sq.classList.add('last-move');
      }

      // Selected square
      if (selected && selected.r === r && selected.c === c) {
        sq.classList.add('selected');
      }

      // Legal move dots / capture rings — matches CSS: .sq.legal / .sq.legal-capture
      if (legalSet.has(r + ',' + c)) {
        sq.classList.add(state.board[r][c] ? 'legal-capture' : 'legal');
      }

      // King in check
      if (kingCheck && kingCheck.r === r && kingCheck.c === c) {
        sq.classList.add('in-check');
      }

      // Piece — matches CSS: .piece.white / .piece.black
      const piece = state.board[r][c];
      if (piece) {
        const pieceEl = document.createElement('div');
        pieceEl.className   = 'piece ' + (piece[0] === 'w' ? 'white' : 'black');
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
  tops.innerHTML = bottoms.innerHTML = lefts.innerHTML = rights.innerHTML = '';

  files.forEach(f => {
    [tops, bottoms].forEach(el => {
      const d = document.createElement('div');
      d.className = 'coord'; d.textContent = f; el.appendChild(d);
    });
  });
  ranks.forEach(rk => {
    [lefts, rights].forEach(el => {
      const d = document.createElement('div');
      d.className = 'coord'; d.textContent = rk; el.appendChild(d);
    });
  });
}

function renderSidebar() {
  const dot        = document.querySelector('.turn-dot');
  const turnText   = document.getElementById('turnText');
  const checkAlert = document.getElementById('checkAlert');

  if (state.status === 'checkmate') {
    const winner = state.turn === 'w' ? 'Black' : 'White';
    turnText.textContent = winner + ' wins!';
    if (dot) dot.className = 'turn-dot ' + (state.turn === 'w' ? 'black-dot' : 'white-dot');
    checkAlert.style.display = 'none';
  } else if (state.status === 'stalemate' || state.status === 'draw') {
    turnText.textContent = 'Draw';
    checkAlert.style.display = 'none';
  } else {
    const isWhite = state.turn === 'w';
    turnText.textContent = isWhite ? 'White to move' : 'Black to move';
    if (dot) dot.className = 'turn-dot ' + (isWhite ? 'white-dot' : 'black-dot');
    checkAlert.style.display = state.status === 'check' ? 'block' : 'none';
  }

  // Scores
  document.getElementById('scoreWhite').textContent = state.scores.w;
  document.getElementById('scoreBlack').textContent = state.scores.b;

  // Captured pieces
  const capW = document.getElementById('capturedWhite');
  const capB = document.getElementById('capturedBlack');
  if (capW) capW.textContent = state.capturedW.map(p => PIECES[p]).join('');
  if (capB) capB.textContent = state.capturedB.map(p => PIECES[p]).join('');

  // Move history
  const logBody = document.getElementById('moveLogBody');
  if (logBody) {
    logBody.innerHTML = '';
    const hist = state.history;
    for (let i = 0; i < hist.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'move-entry';

      const numEl = document.createElement('span');
      numEl.className = 'move-num';
      numEl.textContent = (Math.floor(i / 2) + 1) + '.';

      const wEl = document.createElement('span');
      wEl.className = 'move-w';
      wEl.textContent = hist[i] ? hist[i].notation : '';

      const bEl = document.createElement('span');
      bEl.className = 'move-b';
      bEl.textContent = hist[i + 1] ? hist[i + 1].notation : '';

      row.appendChild(numEl);
      row.appendChild(wEl);
      row.appendChild(bEl);
      logBody.appendChild(row);
    }
    logBody.scrollTop = logBody.scrollHeight;
  }

  // Show game over modal if needed
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

// ── Click Handling ────────────────────────────────────────────

function onSquareClick(r, c) {
  if (state.status === 'checkmate' || state.status === 'stalemate' || state.status === 'draw') return;

  const aiOn = document.getElementById('aiToggle').checked;
  if (aiOn && state.turn === 'b') return;

  const piece = state.board[r][c];

  if (selected) {
    const move = legalMoves.find(m => m.to.r === r && m.to.c === c);

    if (move) {
      if (isPromotion(move)) {
        pendingPromo = move;
        showPromoModal(state.turn);
        return;
      }
      doMove(move);
      return;
    }

    // Reselect own piece
    if (piece && piece[0] === state.turn) {
      selected   = { r, c };
      legalMoves = getLegalMovesForSquare(state, r, c);
      renderBoard();
      return;
    }

    // Deselect
    selected   = null;
    legalMoves = [];
    renderBoard();
    return;
  }

  // Select own piece
  if (piece && piece[0] === state.turn) {
    selected   = { r, c };
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
  state      = executeMove(state, move, promoType);
  selected   = null;
  legalMoves = [];
  renderAll();
  maybeTriggerAI();
}

// ── Promotion Modal ───────────────────────────────────────────

function showPromoModal(col) {
  const overlay = document.getElementById('promoOverlay');
  const choices = document.getElementById('promoChoices');
  choices.innerHTML = '';

  ['Q', 'R', 'B', 'N'].forEach(t => {
    const btn = document.createElement('div');
    btn.className   = 'promo-choice';
    btn.textContent = PIECES[col + t];
    btn.onclick = () => {
      overlay.style.display = 'none';
      doMove(pendingPromo, t);
      pendingPromo = null;
    };
    choices.appendChild(btn);
  });

  overlay.style.display = 'flex';
}

// ── Undo ──────────────────────────────────────────────────────

function undoMove() {
  if (snapshots.length === 0) return;
  const aiOn = document.getElementById('aiToggle').checked;

  // Undo 2 half-moves when playing vs AI (AI reply + player move)
  if (aiOn && snapshots.length >= 2) {
    snapshots.pop();
    state = snapshots.pop();
  } else {
    state = snapshots.pop();
  }

  selected   = null;
  legalMoves = [];
  closeModals();
  renderAll();
}

// ── AI ────────────────────────────────────────────────────────

function maybeTriggerAI() {
  const aiOn = document.getElementById('aiToggle').checked;
  if (!aiOn) return;
  if (state.turn !== 'b') return;
  if (state.status === 'checkmate' || state.status === 'stalemate' || state.status === 'draw') return;

  const depth = parseInt(document.getElementById('aiDepth').value) || 2;

  // Show thinking state
  const turnText = document.getElementById("turnText");
  if (turnText) turnText.textContent = "AI thinking...";

  setTimeout(() => {
    const move = getBestMove(state, depth);
    if (!move) return;
    snapshots.push(cloneState(state));
    state      = executeMove(state, move, 'Q');
    selected   = null;
    legalMoves = [];
    renderAll();
  }, 150);
}

// ── Boot ──────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('aiToggle').addEventListener('change', () => {
    maybeTriggerAI();
  });
  newGame();
});
