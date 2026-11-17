# Tower of Hanoi

A browser-based Tower of Hanoi game with a SWI-Prolog HTTP backend. Prolog owns each game's peg state and validates every move; the HTML, CSS, and JavaScript provide the interactive interface.

## Requirements

- SWI-Prolog 8.4 or newer

## Run

From this directory, start the server:

```powershell
swipl -q -s main.pl
```

Then open [http://localhost:8080](http://localhost:8080). Stop the server with `Ctrl+C`.

If you open `index.html` with VS Code Live Server instead, the puzzle still works in local practice mode. For Prolog-backed play, open the game at `http://localhost:8080`.

Choose 3–8 disks and move the tower from the first peg to the last. Select a peg to pick up its top disk, then select a destination peg. The server rejects moves that violate the puzzle rules.

## API

- `POST /api/new` with `{"disks": 4}` creates a game.
- `POST /api/move` with `{"game_id":"hanoi-0","from":0,"to":1}` makes a validated move.

Peg indices are zero-based. Each response includes the updated game state or an `ok: false` error.
