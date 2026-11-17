const board = document.querySelector("#board");
const moveCount = document.querySelector("#move-count");
const optimalCount = document.querySelector("#optimal-count");
const diskCount = document.querySelector("#disk-count");
const message = document.querySelector("#game-message");
const gameCard = document.querySelector(".game-card");
const newGameButton = document.querySelector("#new-game");
const backendStatus = document.querySelector("#backend-status");
const backendLabel = document.querySelector("#backend-label");

let gameId = null;
let selectedPeg = null;
let currentState = null;
let busy = false;
let localMode = false;

async function request(path, body) {
  let response;
  try {
    response = await fetch(`/api/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    throw Object.assign(new Error("The Prolog server is unavailable."), { offline: true });
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw Object.assign(
      new Error("The server returned an invalid response. Start the game with SWI-Prolog for backend play."),
      { offline: true }
    );
  }
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "The game server could not complete that request.");
  }
  return result;
}

function setBackendMode(isLocal) {
  localMode = isLocal;
  backendStatus.classList.toggle("local", isLocal);
  backendLabel.textContent = isLocal ? "LOCAL PRACTICE" : "PROLOG POWERED";
  backendStatus.title = isLocal
    ? "Prolog is not connected. Moves are being validated in this browser."
    : "Game state and moves are validated by the Prolog server.";
}

function setMessage(text, kind = "") {
  message.textContent = text;
  message.className = kind;
}

function setBusy(value) {
  busy = value;
  gameCard.classList.toggle("busy", value);
}

function drawBoard() {
  board.replaceChildren();
  currentState.pegs.forEach((disks, pegIndex) => {
    const zone = document.createElement("button");
    zone.type = "button";
    zone.className = `peg-zone${selectedPeg === pegIndex ? " selected" : ""}`;
    zone.setAttribute("aria-label", `Peg ${pegIndex + 1}, ${disks.length} ${disks.length === 1 ? "disk" : "disks"}${selectedPeg === pegIndex ? ", selected" : ""}`);
    zone.addEventListener("click", () => selectPeg(pegIndex));

    const stack = document.createElement("span");
    stack.className = "disk-stack";
    disks.forEach((disk) => {
      const element = document.createElement("span");
      element.className = `disk disk-${disk}`;
      element.style.width = `${28 + disk * 8}%`;
      element.setAttribute("aria-hidden", "true");
      stack.append(element);
    });

    const peg = document.createElement("span");
    peg.className = "peg";
    peg.setAttribute("aria-hidden", "true");
    const base = document.createElement("span");
    base.className = "base";
    base.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "peg-label";
    label.textContent = `PEG 0${pegIndex + 1}`;
    label.setAttribute("aria-hidden", "true");

    zone.append(peg, stack, base, label);
    board.append(zone);
  });

  moveCount.textContent = currentState.moves;
  const optimal = 2 ** currentState.disks - 1;
  optimalCount.textContent = optimal;
  if (currentState.won) {
    selectedPeg = null;
    setMessage(`Puzzle solved in ${currentState.moves} moves${currentState.moves === optimal ? " — perfect!" : "."}`, "success");
  }
}

async function selectPeg(pegIndex) {
  if (busy || currentState.won) return;
  const peg = currentState.pegs[pegIndex];

  if (selectedPeg === null) {
    if (peg.length === 0) {
      setMessage("That peg is empty. Choose a peg with a disk.", "error");
      return;
    }
    selectedPeg = pegIndex;
    setMessage(`Top disk selected. Choose where to place it.`);
    drawBoard();
    return;
  }

  if (selectedPeg === pegIndex) {
    selectedPeg = null;
    setMessage("Selection cleared. Choose a peg to pick up its top disk.");
    drawBoard();
    return;
  }

  setBusy(true);
  try {
    if (localMode) {
      currentState = makeLocalMove(selectedPeg, pegIndex);
    } else {
      currentState = await request("move", { game_id: gameId, from: selectedPeg, to: pegIndex });
    }
    selectedPeg = null;
    drawBoard();
    if (!currentState.won) setMessage("Good move. Select another peg to continue.");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    setBusy(false);
  }
}

function makeLocalMove(from, to) {
  const pegs = currentState.pegs.map((peg) => [...peg]);
  const [disk] = pegs[from];
  if (disk === undefined) throw new Error("That peg is empty.");
  if (pegs[to].length > 0 && disk > pegs[to][0]) {
    throw new Error("Illegal move. A larger disk cannot sit on a smaller disk.");
  }

  pegs[from].shift();
  pegs[to].unshift(disk);
  const moves = currentState.moves + 1;
  return {
    ...currentState,
    pegs,
    moves,
    won: pegs[2].length === currentState.disks
  };
}

async function startNewGame() {
  setBusy(true);
  selectedPeg = null;
  setMessage("Setting up your puzzle...");
  try {
    currentState = await request("new", { disks: Number(diskCount.value) });
    gameId = currentState.game_id;
    setBackendMode(false);
    drawBoard();
    setMessage("Select a peg to pick up its top disk.");
  } catch (error) {
    if (!error.offline) {
      setMessage(error.message, "error");
      return;
    }
    const disks = Number(diskCount.value);
    gameId = null;
    currentState = {
      disks,
      pegs: [Array.from({ length: disks }, (_, index) => index + 1), [], []],
      moves: 0,
      won: false
    };
    setBackendMode(true);
    drawBoard();
    setMessage(`Local practice mode — Prolog server unavailable. ${error.message}`, "info");
  } finally {
    setBusy(false);
  }
}

newGameButton.addEventListener("click", startNewGame);
diskCount.addEventListener("change", startNewGame);

startNewGame();
