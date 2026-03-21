// ── Chess AI — Minimax with Alpha-Beta Pruning ──

// Piece-square tables for positional evaluation (from white's perspective)
const PST = {
  P: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 25, 25, 10,  5,  5],
    [ 0,  0,  0, 20, 20,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-20,-20, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0]
  ],
  N: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ],
  B: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ],
  R: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0]
  ],
  Q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
  ],
  K: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20]
  ]
};

// Evaluate board from white's perspective
function evaluateBoard(s) {
  if (s.status==='checkmate') return s.turn==='w' ? -99999 : 99999;
  if (s.status==='stalemate'||s.status==='draw') return 0;

  let score = 0;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const p = s.board[r][c];
    if (!p) continue;
    const col = color(p);
    const t = type(p);
    const val = (PIECE_VALUES[t]||0) * 100;
    const pstRow = col==='w' ? r : 7-r;
    const pst = PST[t] ? PST[t][pstRow][c] : 0;
    score += col==='w' ? (val+pst) : -(val+pst);
  }
  return score;
}

// Order moves for better pruning (captures first)
function orderMoves(s, moves) {
  return moves.sort((a,b) => {
    const ca = s.board[a.to.r][a.to.c] ? (PIECE_VALUES[type(s.board[a.to.r][a.to.c])]||0) : 0;
    const cb = s.board[b.to.r][b.to.c] ? (PIECE_VALUES[type(s.board[b.to.r][b.to.c])]||0) : 0;
    return cb - ca;
  });
}

// Minimax with alpha-beta pruning
function minimax(s, depth, alpha, beta, maximizing) {
  if (depth===0 || s.status==='checkmate' || s.status==='stalemate' || s.status==='draw')
    return { score: evaluateBoard(s), move: null };

  const moves = getLegalMoves(s, s.turn);
  const ordered = orderMoves(s, moves);

  let best = { score: maximizing ? -Infinity : Infinity, move: null };

  for (const move of ordered) {
    // Check if pawn promotion
    const piece = s.board[move.from.r][move.from.c];
    const isPromo = type(piece)==='P' && (move.to.r===0||move.to.r===7);
    const ns = executeMove(s, move, isPromo ? 'Q' : 'Q');
    const result = minimax(ns, depth-1, alpha, beta, !maximizing);

    if (maximizing) {
      if (result.score > best.score) { best.score=result.score; best.move=move; }
      alpha = Math.max(alpha, best.score);
    } else {
      if (result.score < best.score) { best.score=result.score; best.move=move; }
      beta = Math.min(beta, best.score);
    }
    if (beta <= alpha) break; // pruning
  }
  return best;
}

// Get best move for AI (black)
function getAIMove(s, depth=2) {
  const result = minimax(s, depth, -Infinity, Infinity, s.turn==='w');
  return result.move;
}
