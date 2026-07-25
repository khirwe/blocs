// ── CONFIG ──────────────────────────────────────────────────────
const CONTRACT_ADDRESS = "0x0A8Ac86a38833b66A01702d414118FEf1ee65dAe";
const RPC_URL = "https://testnet-rpc.monad.xyz";
const CHAIN_ID = 10143;
const TOTAL_CITIES = 30;
const ROUND_TIMER = 7;       // seconds — change freely
const FINAL_ROUND_TIMER = 5; // seconds — change freely
const TOTAL_ROUNDS = 5;      // rounds — change freely

const ABI = [
  "function join() external",
  "function startGame() external",
  "function submitMove(bool isAttack, uint8 targetCity) external",
  "function resolveRound() external",
  "function getPhase() external view returns (uint8)",
  "function getCityOwner(uint8 cityId) external view returns (address)",
  "function getPlayerCityCount(address player) external view returns (uint8)",
  "function getWinner() external view returns (address)",
  "function playerCount() external view returns (uint8)",
  "function currentRound() external view returns (uint8)",
  "function playerList(uint256 index) external view returns (address)",
  "function players(address) external view returns (address addr, uint8 cityCount, bool registered)",
  "event PlayerJoined(address player, uint8 cityId)",
  "event RoundResolved(uint8 round)",
  "event GameEnded(address winner, uint8 cityCount)",
  "event CityFlipped(uint8 cityId, address newOwner)"
];

// ── PLAYER COLORS ────────────────────────────────────────────────
const COLORS = [
  "#ef4444","#f97316","#eab308","#22c55e","#14b8a6",
  "#3b82f6","#8b5cf6","#ec4899","#f43f5e","#10b981",
  "#06b6d4","#6366f1","#84cc16","#a855f7","#0ea5e9",
  "#f59e0b","#64748b","#e11d48","#16a34a","#7c3aed",
  "#0891b2","#dc2626","#d97706","#059669","#2563eb",
  "#9333ea","#db2777","#65a30d","#0284c7","#7c3aed"
];

// ── STATE ────────────────────────────────────────────────────────
let provider, signer, contract, burnerWallet;
let isHost = false;
let isPlayer = false;
let myCity = null;
let playerAddressMap = {};
let timerInterval = null;
let pollInterval = null;
let moveSubmitted = false;

// ── INIT ─────────────────────────────────────────────────────────
window.addEventListener("load", async () => {
  detectRole();
});

function detectRole() {
  const params = new URLSearchParams(window.location.search);
  const role = params.get("role");

  if (role === "host") {
    isHost = true;
    showScreen("lobby-screen");
    setupHost();
  } else {
    isPlayer = true;
    showScreen("join-screen");
    setupPlayer();
  }
}

// ── FUND BURNER ───────────────────────────────────────────────────
async function fundBurnerIfNeeded(burnerAddress) {
  try {
    document.getElementById("join-status").textContent = "Funding wallet...";
    const res = await fetch(`/api/fund?address=${burnerAddress}`);
    const data = await res.json();
    console.log("Fund result:", data);
  } catch (e) {
    console.error("Funding failed:", e);
  }
}

// ── HOST SETUP ───────────────────────────────────────────────────
async function setupHost() {
  if (!window.ethereum) {
    alert("MetaMask required on host screen");
    return;
  }

  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  // Generate QR code for player join URL
  const joinURL = window.location.origin + window.location.pathname;
  new QRCode(document.getElementById("qr-container"), {
    text: joinURL,
    width: 180,
    height: 180,
    colorDark: "#000000",
    colorLight: "#ffffff",
  });

  // Poll lobby player count
  pollInterval = setInterval(updateLobbyCount, 2000);
}

async function updateLobbyCount() {
  try {
    const count = await contract.playerCount();
    document.getElementById("player-count-display").textContent =
      `Players joined: ${count}`;
  } catch (e) {}
}

async function startGame() {
  try {
    document.getElementById("start-btn").disabled = true;
    document.getElementById("start-btn").textContent = "Starting...";
    const tx = await contract.startGame();
    await tx.wait();
    clearInterval(pollInterval);
    showScreen("game-screen");
    buildCityGrid();
    startHostGameLoop();
  } catch (e) {
    console.error(e);
    document.getElementById("start-btn").disabled = false;
    document.getElementById("start-btn").textContent = "START GAME";
    alert("Failed to start: " + e.message);
  }
}

// ── PLAYER SETUP ─────────────────────────────────────────────────
async function setupPlayer() {
  document.getElementById("join-status").textContent = "Setting up wallet...";

  // Create or load burner wallet
  let privateKey = new URLSearchParams(window.location.search).get("pk");

  if (!privateKey) {
    privateKey = localStorage.getItem("blocs_burner_pk");
  }

  if (!privateKey) {
    const fresh = ethers.Wallet.createRandom();
    privateKey = fresh.privateKey;
    localStorage.setItem("blocs_burner_pk", privateKey);
  }

  provider = new ethers.JsonRpcProvider(RPC_URL);
  burnerWallet = new ethers.Wallet(privateKey, provider);
  signer = burnerWallet;
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  // Fund burner via Vercel serverless function
  await fundBurnerIfNeeded(burnerWallet.address);

  document.getElementById("join-status").textContent = "Joining game...";

  try {
    // Check if already registered
    const playerData = await contract.players(burnerWallet.address);
    if (!playerData.registered) {
      const tx = await contract.join();
      await tx.wait();
    }

    const cityId = await getPlayerCity(burnerWallet.address);
    myCity = cityId;

    document.getElementById("join-status").textContent = "✅ Joined!";
    document.getElementById("player-city-display").textContent =
      `Your starting city: #${cityId + 1}`;

    // Wait for game to start
    pollInterval = setInterval(checkGameStart, 2000);

  } catch (e) {
    console.error(e);
    document.getElementById("join-status").textContent =
      "❌ Failed to join. Make sure game is in lobby.";
  }
}

async function getPlayerCity(address) {
  for (let i = 0; i < TOTAL_CITIES; i++) {
    const owner = await contract.getCityOwner(i);
    if (owner.toLowerCase() === address.toLowerCase()) return i;
  }
  return null;
}

async function checkGameStart() {
  try {
    const phase = await contract.getPhase();
    if (Number(phase) === 1) {
      clearInterval(pollInterval);
      showScreen("game-screen");
      buildCityGrid();
      buildCitySelect();
      document.getElementById("action-panel").style.display = "flex";
      startPlayerGameLoop();
    }
  } catch (e) {}
}

// ── CITY GRID ────────────────────────────────────────────────────
function buildCityGrid() {
  const grid = document.getElementById("city-grid");
  grid.innerHTML = "";
  for (let i = 0; i < TOTAL_CITIES; i++) {
    const cell = document.createElement("div");
    cell.className = "city-cell";
    cell.id = `city-${i}`;
    cell.textContent = `C${i + 1}`;
    grid.appendChild(cell);
  }
}

function buildCitySelect() {
  const select = document.getElementById("city-select");
  select.innerHTML = "";
  for (let i = 0; i < TOTAL_CITIES; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `City ${i + 1}`;
    select.appendChild(opt);
  }
}

// ── MAP UPDATE ───────────────────────────────────────────────────
async function refreshMap() {
  try {
    const playerCount = Number(await contract.playerCount());

    // Build address → color map
    for (let i = 0; i < playerCount; i++) {
      const addr = await contract.playerList(i);
      if (!playerAddressMap[addr]) {
        playerAddressMap[addr] = i;
      }
    }

    // Update city cells
    for (let i = 0; i < TOTAL_CITIES; i++) {
      const owner = await contract.getCityOwner(i);
      const cell = document.getElementById(`city-${i}`);
      if (!cell) continue;

      if (owner === ethers.ZeroAddress) {
        cell.style.background = "#1a1a2e";
        cell.style.borderColor = "#333";
        cell.style.borderWidth = "2px";
      } else {
        const colorIdx = playerAddressMap[owner] ?? 0;
        const color = COLORS[colorIdx % COLORS.length];
        cell.style.background = color;
        cell.style.borderColor = color;

        // Highlight your own cities
        if (
          isPlayer &&
          burnerWallet &&
          owner.toLowerCase() === burnerWallet.address.toLowerCase()
        ) {
          cell.style.borderColor = "#ffffff";
          cell.style.borderWidth = "3px";
        }
      }
    }

    // Update leaderboard
    await refreshLeaderboard(playerCount);

  } catch (e) {
    console.error("Map refresh error:", e);
  }
}

async function refreshLeaderboard(playerCount) {
  const lb = document.getElementById("leaderboard");
  if (!lb) return;
  lb.innerHTML = "";

  let entries = [];
  for (let i = 0; i < playerCount; i++) {
    const addr = await contract.playerList(i);
    const count = Number(await contract.getPlayerCityCount(addr));
    entries.push({ addr, count, colorIdx: i });
  }

  entries.sort((a, b) => b.count - a.count);

  entries.forEach((e, rank) => {
    const row = document.createElement("div");
    row.className = "lb-row";

    const dot = document.createElement("div");
    dot.className = "lb-color";
    dot.style.background = COLORS[e.colorIdx % COLORS.length];

    const name = document.createElement("span");
    name.className = "lb-name";
    name.textContent = `${rank + 1}. ${e.addr.slice(0, 6)}...`;

    const count = document.createElement("span");
    count.className = "lb-count";
    count.textContent = `${e.count} 🏙️`;

    row.appendChild(dot);
    row.appendChild(name);
    row.appendChild(count);
    lb.appendChild(row);
  });
}

// ── HOST GAME LOOP ────────────────────────────────────────────────
async function startHostGameLoop() {
  await refreshMap();
  let round = 1;

  const runRound = async () => {
    const isLast = round === TOTAL_ROUNDS;
    const duration = isLast ? FINAL_ROUND_TIMER : ROUND_TIMER;

    document.getElementById("round-display").textContent =
      `ROUND ${round}${isLast ? " — FINAL" : ""}`;

    startTimer(duration, async () => {
      try {
        const tx = await contract.resolveRound();
        await tx.wait();
        await refreshMap();

        const phase = Number(await contract.getPhase());
        if (phase === 2) {
          await showWinner();
          return;
        }

        round++;
        runRound();
      } catch (e) {
        console.error("Resolve error:", e);
      }
    });
  };

  runRound();
}

// ── PLAYER GAME LOOP ──────────────────────────────────────────────
async function startPlayerGameLoop() {
  await refreshMap();
  let lastRound = 1;

  pollInterval = setInterval(async () => {
    try {
      const round = Number(await contract.currentRound());
      const phase = Number(await contract.getPhase());

      document.getElementById("round-display").textContent =
        `ROUND ${round}`;

      await refreshMap();

      if (round !== lastRound) {
        lastRound = round;
        moveSubmitted = false;
        resetActionButtons();
        document.getElementById("action-status").textContent =
          "Choose your move";
      }

      if (phase === 2) {
        clearInterval(pollInterval);
        await showWinner();
      }
    } catch (e) {}
  }, 2000);
}

// ── SUBMIT MOVE ───────────────────────────────────────────────────
async function submitMove(isAttack) {
  if (moveSubmitted) return;

  const targetCity = parseInt(
    document.getElementById("city-select").value
  );
  const statusEl = document.getElementById("move-status");
  const attackBtn = document.querySelector(".btn-attack");
  const fortifyBtn = document.querySelector(".btn-fortify");

  attackBtn.disabled = true;
  fortifyBtn.disabled = true;
  statusEl.textContent = "Submitting...";

  try {
    const tx = await contract.submitMove(isAttack, targetCity);
    await tx.wait();
    moveSubmitted = true;
    statusEl.textContent = isAttack
      ? `⚔️ Attacking City ${targetCity + 1}`
      : `🛡️ Fortified City ${targetCity + 1}`;
    document.getElementById("action-status").textContent = "Move locked in ✅";
  } catch (e) {
    console.error(e);
    statusEl.textContent = "❌ Failed — try again";
    attackBtn.disabled = false;
    fortifyBtn.disabled = false;
  }
}

function resetActionButtons() {
  const attackBtn = document.querySelector(".btn-attack");
  const fortifyBtn = document.querySelector(".btn-fortify");
  if (attackBtn) attackBtn.disabled = false;
  if (fortifyBtn) fortifyBtn.disabled = false;
  const statusEl = document.getElementById("move-status");
  if (statusEl) statusEl.textContent = "";
}

// ── TIMER ─────────────────────────────────────────────────────────
function startTimer(duration, onComplete) {
  const timerBar = document.getElementById("timer-bar");
  const timerDisplay = document.getElementById("timer-display");
  let remaining = duration;

  if (timerInterval) clearInterval(timerInterval);

  timerBar.style.width = "100%";
  timerBar.style.background = "#7c3aed";
  timerDisplay.textContent = remaining;

  timerInterval = setInterval(() => {
    remaining--;
    timerDisplay.textContent = remaining;
    const pct = (remaining / duration) * 100;
    timerBar.style.width = pct + "%";

    if (remaining <= 3) timerBar.style.background = "#ef4444";

    if (remaining <= 0) {
      clearInterval(timerInterval);
      onComplete();
    }
  }, 1000);
}

// ── WINNER ────────────────────────────────────────────────────────
async function showWinner() {
  try {
    const winnerAddr = await contract.getWinner();
    const colorIdx = playerAddressMap[winnerAddr] ?? 0;

    document.getElementById("winner-address").textContent = winnerAddr;
    document.getElementById("winner-address").style.color =
      COLORS[colorIdx % COLORS.length];

    const cityCount = Number(
      await contract.getPlayerCityCount(winnerAddr)
    );
    document.getElementById("winner-cities").textContent =
      `Controlled ${cityCount} of ${TOTAL_CITIES} cities`;

    showScreen("winner-screen");
  } catch (e) {
    console.error("Winner error:", e);
  }
}

// ── HELPERS ───────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s =>
    s.classList.remove("active")
  );
  document.getElementById(id).classList.add("active");
}
