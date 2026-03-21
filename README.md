# ♔ Regis Chess

A beautiful, fully-featured chess game built with vanilla HTML, CSS, and JavaScript. No dependencies, no build tools — just open `index.html` and play.

![Chess screenshot](screenshot.png)

## Features

- ♟ **Full chess rules** — castling, en passant, pawn promotion, check/checkmate/stalemate detection
- 🤖 **AI opponent** powered by Minimax with Alpha-Beta pruning and piece-square tables
- 🎚 **3 difficulty levels** — Easy, Medium, Hard
- ↩ **Undo** — step back one move (or two when playing vs AI)
- 📜 **Move history** in algebraic notation
- ⚖ **Score tracking** based on captured pieces
- 🎨 **Luxury dark marble aesthetic** with animated highlights and smooth interactions
- 📱 **Responsive** — works on desktop and mobile

## How to Play

```bash
# Clone the repo
git clone https://github.com/bgl761915-debug/Chess.git
cd Chess

# Just open index.html in your browser!
xdg-open index.html       # Linux
open index.html           # macOS
start index.html          # Windows
```

No server needed. No npm install. No build step. Just open and play.

## Controls

| Action | How |
|--------|-----|
| Select piece | Click on it |
| Move piece | Click destination square |
| Undo move | Click ↩ Undo button |
| New game | Click New Game button |
| Toggle AI | Use the vs AI toggle |
| Change difficulty | Use the Depth dropdown |

## AI

The AI uses **Minimax with Alpha-Beta pruning**:

- **Easy** (depth 1) — looks 1 move ahead
- **Medium** (depth 2) — looks 2 moves ahead  
- **Hard** (depth 3) — looks 3 moves ahead, much stronger

Evaluation uses material values + piece-square tables for positional awareness.

## File Structure

```
regis-chess/
├── index.html   — App shell and layout
├── style.css    — All styles (dark marble theme)
├── chess.js     — Chess rules engine (moves, check, state)
├── ai.js        — Minimax AI with alpha-beta pruning
├── ui.js        — UI rendering and interaction
└── README.md    — This file
```

## License

MIT — do whatever you want with it.
