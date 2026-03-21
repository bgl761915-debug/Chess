// ── Chess Engine ──
// Full chess rules: castling, en passant, promotion, check/checkmate/stalemate

const PIECES = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟'
};

const PIECE_VALUES = { K:0, Q:9, R:5, B:3, N:3, P:1 };

// Initial board state (8x8 array, null = empty)
function initialBoard() {
  const b = Array(8).fill(null).map(()=>Array(8).fill(null));
  const backRow = ['R','N','B','Q','K','B','N','R'];
  for (let c=0;c<8;c++) {
    b[0][c] = 'b'+backRow[c];
    b[1][c] = 'bP';
    b[6][c] = 'wP';
    b[7][c] = 'w'+backRow[c];
  }
  return b;
}

// Game state
let state = createState();

function createState() {
  return {
    board: initialBoard(),
    turn: 'w',           // 'w' or 'b'
    castling: { wK:true, wQ:true, bK:true, bQ:true }, // rights
    enPassant: null,     // target square {r,c} or null
    halfMove: 0,
    fullMove: 1,
    history: [],         // array of {from,to,piece,captured,special,notation}
    capturedW: [],       // pieces captured by white
    capturedB: [],       // pieces captured by black
    scores: { w:0, b:0 },
    status: 'playing',   // 'playing','check','checkmate','stalemate','draw'
  };
}

function cloneState(s) {
  return {
    board: s.board.map(r=>[...r]),
    turn: s.turn,
    castling: {...s.castling},
    enPassant: s.enPassant ? {...s.enPassant} : null,
    halfMove: s.halfMove,
    fullMove: s.fullMove,
    history: s.history.map(h=>({...h})),
    capturedW: [...s.capturedW],
    capturedB: [...s.capturedB],
    scores: {...s.scores},
    status: s.status,
  };
}

// Piece helpers
function color(piece) { return piece ? piece[0] : null; }
function type(piece)  { return piece ? piece[1] : null; }
function enemy(col)   { return col==='w' ? 'b' : 'w'; }
function inBounds(r,c){ return r>=0&&r<8&&c>=0&&c<8; }

// Get all pseudo-legal moves for a piece (ignores check)
function pseudoMoves(board, r, c, castling, enPassant) {
  const piece = board[r][c];
  if (!piece) return [];
  const col = color(piece);
  const t = type(piece);
  const moves = [];

  const add = (tr,tc,special=null) => {
    if (inBounds(tr,tc) && color(board[tr][tc])!==col)
      moves.push({from:{r,c}, to:{r:tr,c:tc}, special});
  };

  const slide = (drs, dcs) => {
    for (let i=0;i<drs.length;i++) {
      for (let d=1;d<8;d++) {
        const tr=r+drs[i]*d, tc=c+dcs[i]*d;
        if (!inBounds(tr,tc)) break;
        if (board[tr][tc]) { if (color(board[tr][tc])!==col) moves.push({from:{r,c},to:{r:tr,c:tc}}); break; }
        moves.push({from:{r,c},to:{r:tr,c:tc}});
      }
    }
  };

  if (t==='P') {
    const dir = col==='w' ? -1 : 1;
    const startRow = col==='w' ? 6 : 1;
    // Forward
    if (inBounds(r+dir,c) && !board[r+dir][c]) {
      moves.push({from:{r,c},to:{r:r+dir,c}});
      if (r===startRow && !board[r+2*dir][c])
        moves.push({from:{r,c},to:{r:r+2*dir,c},special:'double'});
    }
    // Captures
    for (const dc of [-1,1]) {
      const tr=r+dir,tc=c+dc;
      if (!inBounds(tr,tc)) continue;
      if (board[tr][tc] && color(board[tr][tc])!==col)
        moves.push({from:{r,c},to:{r:tr,c:tc}});
      if (enPassant && tr===enPassant.r && tc===enPassant.c)
        moves.push({from:{r,c},to:{r:tr,c:tc},special:'enpassant'});
    }
  }

  if (t==='N') {
    for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
      add(r+dr,c+dc);
  }

  if (t==='B' || t==='Q') slide([-1,-1,1,1],[-1,1,-1,1]);
  if (t==='R' || t==='Q') slide([-1,1,0,0],[0,0,-1,1]);

  if (t==='K') {
    for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
      add(r+dr,c+dc);
    // Castling
    const row = col==='w' ? 7 : 0;
    if (r===row && c===4) {
      if (castling[col+'K'] && !board[row][5] && !board[row][6] &&
          board[row][7]===col+'R' && !isSquareAttacked(board,row,4,enemy(col)) &&
          !isSquareAttacked(board,row,5,enemy(col)) && !isSquareAttacked(board,row,6,enemy(col)))
        moves.push({from:{r,c},to:{r:row,c:6},special:'castleK'});
      if (castling[col+'Q'] && !board[row][3] && !board[row][2] && !board[row][1] &&
          board[row][0]===col+'R' && !isSquareAttacked(board,row,4,enemy(col)) &&
          !isSquareAttacked(board,row,3,enemy(col)) && !isSquareAttacked(board,row,2,enemy(col)))
        moves.push({from:{r,c},to:{r:row,c:2},special:'castleQ'});
    }
  }

  return moves;
}

// Check if a square is attacked by 'byColor'
function isSquareAttacked(board, r, c, byColor) {
  // Check all enemy pieces
  for (let rr=0;rr<8;rr++) for (let cc=0;cc<8;cc++) {
    if (color(board[rr][cc])!==byColor) continue;
    const moves = pseudoMoves(board,rr,cc,{wK:false,wQ:false,bK:false,bQ:false},null);
    if (moves.some(m=>m.to.r===r&&m.to.c===c)) return true;
  }
  return false;
}

// Find king position
function findKing(board, col) {
  for (let r=0;r<8;r++) for (let c=0;c<8;c++)
    if (board[r][c]===col+'K') return {r,c};
  return null;
}

// Is 'col' in check?
function isInCheck(board, col) {
  const king = findKing(board, col);
  if (!king) return false;
  return isSquareAttacked(board, king.r, king.c, enemy(col));
}

// Apply a move to a board (returns new board), no state side effects
function applyMoveToBoard(board, move, turn) {
  const b = board.map(r=>[...r]);
  const {from,to,special} = move;
  const piece = b[from.r][from.c];
  const col = color(piece);

  b[to.r][to.c] = piece;
  b[from.r][from.c] = null;

  if (special==='enpassant') {
    const dir = col==='w' ? 1 : -1;
    b[to.r+dir][to.c] = null;
  }
  if (special==='castleK') {
    const row = col==='w' ? 7 : 0;
    b[row][5] = b[row][7]; b[row][7] = null;
  }
  if (special==='castleQ') {
    const row = col==='w' ? 7 : 0;
    b[row][3] = b[row][0]; b[row][0] = null;
  }
  return b;
}

// Get all legal moves for 'col' in current state
function getLegalMoves(s, col) {
  const legal = [];
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    if (color(s.board[r][c])!==col) continue;
    const pseudo = pseudoMoves(s.board,r,c,s.castling,s.enPassant);
    for (const move of pseudo) {
      const nb = applyMoveToBoard(s.board, move, col);
      if (!isInCheck(nb, col)) legal.push(move);
    }
  }
  return legal;
}

// Get legal moves for a specific square
function getLegalMovesForSquare(s, r, c) {
  const piece = s.board[r][c];
  if (!piece || color(piece)!==s.turn) return [];
  const pseudo = pseudoMoves(s.board,r,c,s.castling,s.enPassant);
  return pseudo.filter(move => {
    const nb = applyMoveToBoard(s.board, move, s.turn);
    return !isInCheck(nb, s.turn);
  });
}

// Execute a move on the full game state
function executeMove(s, move, promoType='Q') {
  const ns = cloneState(s);
  const {from,to,special} = move;
  const piece = ns.board[from.r][from.c];
  const col = color(piece);
  const t = type(piece);
  const captured = ns.board[to.r][to.c];

  // En passant capture
  let epCapture = null;
  if (special==='enpassant') {
    const dir = col==='w' ? 1 : -1;
    epCapture = ns.board[to.r+dir][to.c];
    ns.board[to.r+dir][to.c] = null;
  }

  // Castling rook
  if (special==='castleK') {
    const row = col==='w' ? 7 : 0;
    ns.board[row][5] = ns.board[row][7]; ns.board[row][7] = null;
  }
  if (special==='castleQ') {
    const row = col==='w' ? 7 : 0;
    ns.board[row][3] = ns.board[row][0]; ns.board[row][0] = null;
  }

  // Move piece
  ns.board[to.r][to.c] = piece;
  ns.board[from.r][from.c] = null;

  // Promotion
  let promoted = false;
  if (t==='P' && (to.r===0||to.r===7)) {
    ns.board[to.r][to.c] = col+promoType;
    promoted = true;
  }

  // Update castling rights
  if (t==='K') { ns.castling[col+'K']=false; ns.castling[col+'Q']=false; }
  if (t==='R') {
    if (from.c===0) ns.castling[col+'Q']=false;
    if (from.c===7) ns.castling[col+'K']=false;
  }
  // If rook captured
  const eRow = col==='w'?0:7;
  if (to.r===eRow&&to.c===0) ns.castling[enemy(col)+'Q']=false;
  if (to.r===eRow&&to.c===7) ns.castling[enemy(col)+'K']=false;

  // En passant target
  ns.enPassant = special==='double' ? {r:(from.r+to.r)/2, c:from.c} : null;

  // Captures
  const cap = captured || epCapture;
  if (cap) {
    const v = PIECE_VALUES[type(cap)] || 0;
    if (col==='w') { ns.capturedW.push(cap); ns.scores.w+=v; }
    else           { ns.capturedB.push(cap); ns.scores.b+=v; }
  }

  // Half move clock
  ns.halfMove = (t==='P'||cap) ? 0 : ns.halfMove+1;
  if (col==='b') ns.fullMove++;

  // Notation
  const notation = buildNotation(s, move, captured||epCapture, promoted, promoType);
  ns.history.push({from,to,piece,captured:cap,special,notation,promoted,promoType});

  // Switch turn
  ns.turn = enemy(col);

  // Update status
  const oppLegal = getLegalMoves(ns, ns.turn);
  const inCheck = isInCheck(ns.board, ns.turn);
  if (oppLegal.length===0) {
    ns.status = inCheck ? 'checkmate' : 'stalemate';
  } else if (inCheck) {
    ns.status = 'check';
  } else if (ns.halfMove>=100) {
    ns.status = 'draw';
  } else {
    ns.status = 'playing';
  }

  return ns;
}

// Simple algebraic notation
function buildNotation(s, move, captured, promoted, promoType) {
  const {from,to,special} = move;
  const piece = s.board[from.r][from.c];
  const t = type(piece);
  const files = 'abcdefgh';
  const ranks = '87654321';

  if (special==='castleK') return 'O-O';
  if (special==='castleQ') return 'O-O-O';

  let n = '';
  if (t!=='P') n += t;
  else if (captured) n += files[from.c];
  if (captured) n += 'x';
  n += files[to.c]+ranks[to.r];
  if (promoted) n += '='+promoType;
  return n;
}

// Undo last move
function undoLastMove(s) {
  if (s.history.length===0) return s;
  // Rebuild from scratch
  const ns = createState();
  const hist = s.history.slice(0,-1);
  let cur = ns;
  // We need to replay — store initial then replay all but last
  // For simplicity, store a snapshot stack in UI
  return null; // handled in ui.js with snapshot stack
}
