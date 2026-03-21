// ── Chess UI ──

let selected = null;       // {r,c} of selected square
let legalMoves = [];       // legal moves for selected piece
let lastMove = null;       // {from,to} for highlighting
let stateStack = [createState()]; // for undo
let aiThinking = false;
let promotionPending = null; // {move, resolve}

// Piece Unicode map
const GLYPHS = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟'
};

function currentState() { return stateStack[stateStack.length-1]; }

// ── Render ──
function render() {
  const s = currentState();
  renderBoard(s);
  renderSidebar(s);
}

function renderBoard(s) {
  const board = document.getElementById('board');
  board.innerHTML = '';

  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const sq = document.createElement('div');
    sq.className = 'sq ' + ((r+c)%2===0 ? 'light' : 'dark');
    sq.dataset.r = r; sq.dataset.c = c;

    // Highlights
    if (selected && selected.r===r && selected.c===c)
      sq.classList.add('selected');
    if (lastMove && ((lastMove.from.r===r&&lastMove.from.c===c)||(lastMove.to.r===r&&lastMove.to.c===c)))
      sq.classList.add('last-move');

    // Legal move dots
    const lm = legalMoves.find(m=>m.to.r===r&&m.to.c===c);
    if (lm) {
      sq.classList.add(s.board[r][c] ? 'legal-capture' : 'legal');
    }

    // Check highlight
    if (s.status==='check'||s.status==='checkmate') {
      const king = findKing(s.board, s.turn);
      if (king && king.r===r && king.c===c) sq.classList.add('in-check');
    }

    // Piece
    if (s.board[r][c]) {
      const piece = document.createElement('div');
      piece.className = 'piece ' + color(s.board[r][c]);
      piece.textContent = GLYPHS[s.board[r][c]];
      sq.appendChild(piece);
    }

    sq.addEventListener('click', ()=>onSquareClick(r,c));
    board.appendChild(sq);
  }
}

function renderCoords() {
  const files = 'abcdefgh';
  const ranks = '87654321';
  ['coordsTop','coordsBottom'].forEach(id=>{
    const el=document.getElementById(id); el.innerHTML='';
    files.split('').forEach(f=>{ const d=document.createElement('div'); d.className='coord'; d.textContent=f; el.appendChild(d); });
  });
  ['coordsLeft','coordsRight'].forEach(id=>{
    const el=document.getElementById(id); el.innerHTML='';
    ranks.split('').forEach(r=>{ const d=document.createElement('div'); d.className='coord'; d.textContent=r; el.appendChild(d); });
  });
}

function renderSidebar(s) {
  // Turn
  const dot = document.querySelector('.turn-dot');
  dot.className = 'turn-dot ' + (s.turn==='w' ? 'white-dot' : 'black-dot');
  document.getElementById('turnText').textContent = s.turn==='w' ? 'White to move' : 'Black to move';
  if (aiThinking) document.getElementById('turnText').textContent = 'AI thinking…';

  // Check
  document.getElementById('checkAlert').style.display =
    (s.status==='check'||s.status==='checkmate') ? 'block' : 'none';

  // Captured
  document.getElementById('capturedWhite').textContent = s.capturedW.map(p=>GLYPHS[p]).join('');
  document.getElementById('capturedBlack').textContent = s.capturedB.map(p=>GLYPHS[p]).join('');

  // Scores
  document.getElementById('scoreWhite').textContent = s.scores.w;
  document.getElementById('scoreBlack').textContent = s.scores.b;

  // Move log
  renderMoveLog(s);
}

function renderMoveLog(s) {
  const body = document.getElementById('moveLogBody');
  body.innerHTML = '';
  for (let i=0;i<s.history.length;i+=2) {
    const row = document.createElement('div');
    row.className = 'move-entry';
    const num = document.createElement('span'); num.className='move-num'; num.textContent=(i/2+1)+'.';
    const w = document.createElement('span'); w.className='move-w'; w.textContent=s.history[i]?.notation||'';
    const b = document.createElement('span'); b.className='move-b'; b.textContent=s.history[i+1]?.notation||'';
    row.appendChild(num); row.appendChild(w); row.appendChild(b);
    body.appendChild(row);
  }
  body.scrollTop = body.scrollHeight;
}

// ── Interaction ──
function onSquareClick(r, c) {
  const s = currentState();
  if (s.status==='checkmate'||s.status==='stalemate'||s.status==='draw') return;
  if (aiThinking) return;

  const aiOn = document.getElementById('aiToggle').checked;
  if (aiOn && s.turn==='b') return; // AI's turn

  const piece = s.board[r][c];

  // If a piece is already selected
  if (selected) {
    const move = legalMoves.find(m=>m.to.r===r&&m.to.c===c);
    if (move) {
      doMove(move);
      return;
    }
    // Clicked own piece — reselect
    if (piece && color(piece)===s.turn) {
      selectSquare(r,c);
      return;
    }
    // Deselect
    selected = null; legalMoves = [];
    render(); return;
  }

  // Select a piece
  if (piece && color(piece)===s.turn) {
    selectSquare(r,c);
  }
}

function selectSquare(r,c) {
  const s = currentState();
  selected = {r,c};
  legalMoves = getLegalMovesForSquare(s,r,c);
  render();
}

async function doMove(move) {
  const s = currentState();
  const piece = s.board[move.from.r][move.from.c];
  const isPromo = type(piece)==='P' && (move.to.r===0||move.to.r===7);

  let promoType = 'Q';
  if (isPromo) {
    promoType = await askPromotion(color(piece));
  }

  selected = null; legalMoves = [];
  lastMove = {from:move.from, to:move.to};

  const ns = executeMove(s, move, promoType);
  stateStack.push(ns);
  render();

  checkGameOver(ns);

  // AI move
  const aiOn = document.getElementById('aiToggle').checked;
  if (aiOn && ns.turn==='b' && ns.status==='playing' || aiOn && ns.turn==='b' && ns.status==='check') {
    setTimeout(doAIMove, 300);
  }
}

function doAIMove() {
  const s = currentState();
  if (s.status!=='playing'&&s.status!=='check') return;
  aiThinking = true;
  renderSidebar(s);

  setTimeout(()=>{
    const depth = parseInt(document.getElementById('aiDepth').value) || 2;
    const move = getAIMove(s, depth);
    aiThinking = false;

    if (!move) return;

    const piece = s.board[move.from.r][move.from.c];
    const isPromo = type(piece)==='P' && (move.to.r===0||move.to.r===7);
    lastMove = {from:move.from,to:move.to};

    const ns = executeMove(s, move, isPromo ? 'Q' : 'Q');
    stateStack.push(ns);
    render();
    checkGameOver(ns);
  }, 10);
}

// ── Promotion ──
function askPromotion(col) {
  return new Promise(resolve=>{
    const overlay = document.getElementById('promoOverlay');
    const choices = document.getElementById('promoChoices');
    choices.innerHTML = '';
    const types = ['Q','R','B','N'];
    const names = {Q:'Queen',R:'Rook',B:'Bishop',N:'Knight'};
    types.forEach(t=>{
      const btn = document.createElement('div');
      btn.className = 'promo-choice';
      btn.innerHTML = `<span class="piece ${col==='w'?'white':'black'}">${GLYPHS[col+t]}</span>`;
      btn.title = names[t];
      btn.onclick = ()=>{ overlay.style.display='none'; resolve(t); };
      choices.appendChild(btn);
    });
    overlay.style.display='flex';
  });
}

// ── Game Over ──
function checkGameOver(s) {
  if (s.status==='checkmate'||s.status==='stalemate'||s.status==='draw') {
    setTimeout(()=>showGameOver(s), 400);
  }
}

function showGameOver(s) {
  const overlay = document.getElementById('gameOverOverlay');
  const icon = document.getElementById('gameOverIcon');
  const title = document.getElementById('gameOverTitle');
  const sub = document.getElementById('gameOverSub');

  if (s.status==='checkmate') {
    const winner = enemy(s.turn);
    icon.textContent = winner==='w' ? '♔' : '♚';
    title.textContent = 'Checkmate!';
    sub.textContent = (winner==='w' ? 'White' : 'Black') + ' wins';
  } else if (s.status==='stalemate') {
    icon.textContent = '⚖';
    title.textContent = 'Stalemate';
    sub.textContent = 'Draw by stalemate';
  } else {
    icon.textContent = '⚖';
    title.textContent = 'Draw';
    sub.textContent = '50-move rule';
  }
  overlay.style.display='flex';
}

function closeModals() {
  document.getElementById('gameOverOverlay').style.display='none';
  document.getElementById('promoOverlay').style.display='none';
}

// ── Controls ──
function newGame() {
  selected = null; legalMoves = []; lastMove = null; aiThinking = false;
  stateStack = [createState()];
  closeModals();
  render();
}

function undoMove() {
  if (aiThinking) return;
  const aiOn = document.getElementById('aiToggle').checked;
  // Undo 2 moves if vs AI (undo AI's response too)
  const steps = aiOn ? 2 : 1;
  for (let i=0;i<steps;i++) {
    if (stateStack.length>1) stateStack.pop();
  }
  selected=null; legalMoves=[];
  lastMove = stateStack.length>1 ?
    (()=>{ const h=currentState().history; return h.length>0?{from:h[h.length-1].from,to:h[h.length-1].to}:null; })()
    : null;
  render();
}

// Toggle AI difficulty visibility
document.getElementById('aiToggle').addEventListener('change', function() {
  document.getElementById('difficultyRow').style.opacity = this.checked ? '1' : '0.4';
});

// ── Init ──
renderCoords();
render();
