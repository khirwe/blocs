// ── CONFIG ──────────────────────────────────────────────────────
const CONTRACT_ADDRESS = "0x0A8Ac86a38833b66A01702d414118FEf1ee65dAe";
const RPC_URL = "https://testnet-rpc.monad.xyz";
const CHAIN_ID = 10143;
const TOTAL_CITIES = 30;
const ROUND_TIMER = 7;
const FINAL_ROUND_TIMER = 5;
const TOTAL_ROUNDS = 5;

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

const COLORS = [
  "#ef4444","#f97316","#eab308","#22c55e","#14b8a6",
  "#3b82f6","#8b5cf6","#ec4899","#f43f5e","#10b981",
  "#06b6d4","#6366f1","#84cc16","#a855f7","#0ea5e9",
  "#f59e0b","#64748b","#e11d48","#16a34a","#7c3aed",
  "#0891b2","#dc2626","#d97706","#059669","#2563eb",
  "#9333ea","#db2777","#65a30d","#0284c7","#7c3aed"
];

const REGION_MAP = {
  NA: { label: "North America", cityStart: 0 },
  SA: { label: "South America", cityStart: 5 },
  EU: { label: "Europe",        cityStart: 10 },
  AF: { label: "Africa",        cityStart: 15 },
  AS: { label: "Asia",          cityStart: 20 },
  OC: { label: "Oceania",       cityStart: 25 }
};

let provider, signer, contract, burnerWallet;
let isHost = false;
let isPlayer = false;
let myCity = null;
let playerAddressMap = {};
let timerInterval = null;
let pollInterval = null;
let moveSubmitted = false;
let selectedCityIdx = 0;

// ── INIT ─────────────────────────────────────────────────────────
window.addEventListener("load", () => {
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
async function fundBurnerIfNeeded(address) {
  try {
    document.getElementById("join-status") &&
      (document.getElementById("join-status").textContent = "Funding wallet...");
    const res = await fetch(`/api/fund?address=${address}`);
    const data = await res.json();
    console.log("Fund result:", data);
  } catch (e) {
    console.error("Funding failed:", e);
  }
}

// ── HOST SETUP ───────────────────────────────────────────────────
async function setupHost() {
  provider = new ethers.JsonRpcProvider(RPC_URL);

  let hostKey = localStorage.getItem("blocs_host_pk");
  if (!hostKey) {
    const fresh = ethers.Wallet.createRandom();
    hostKey = fresh.privateKey;
    localStorage.setItem("blocs_host_pk", hostKey);
  }

  burnerWallet = new ethers.Wallet(hostKey, provider);
  signer = burnerWallet;
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  await fundBurnerIfNeeded(burnerWallet.address);

  const joinURL = window.location.origin + window.location.pathname;
  new QRCode(document.getElementById("qr-container"), {
    text: joinURL,
    width: 180,
    height: 180,
    colorDark: "#000000",
    colorLight: "#ffffff",
  });

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
    buildMap();
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

  let privateKey = new URLSearchParams(window.location.search).get("pk");
  if (!privateKey) privateKey = localStorage.getItem("blocs_burner_pk");
  if (!privateKey) {
    const fresh = ethers.Wallet.createRandom();
    privateKey = fresh.privateKey;
    localStorage.setItem("blocs_burner_pk", privateKey);
  }

  provider = new ethers.JsonRpcProvider(RPC_URL);
  burnerWallet = new ethers.Wallet(privateKey, provider);
  signer = burnerWallet;
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  await fundBurnerIfNeeded(burnerWallet.address);

  document.getElementById("join-status").textContent = "Joining game...";

  try {
    const playerData = await contract.players(burnerWallet.address);
    if (!playerData.registered) {
      const tx = await contract.join();
      await tx.wait();
    }

    myCity = await getPlayerCity(burnerWallet.address);
    document.getElementById("join-status").textContent = "✅ Joined!";
    document.getElementById("player-city-display").textContent =
      myCity !== null ? `Your starting city: #${myCity + 1}` : "";

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
    const phase = Number(await contract.getPhase());
    if (phase === 1) {
      clearInterval(pollInterval);
      showScreen("game-screen");
      buildMap();
      buildRegionSelect();
      document.getElementById("action-panel").style.display = "flex";
      startPlayerGameLoop();
    }
  } catch (e) {}
}

// ── MAP ───────────────────────────────────────────────────────────
function buildMap() {
  const grid = document.getElementById("city-grid");
  grid.innerHTML = `
  <svg id="world-svg" viewBox="0 0 1000 500"
    style="width:100%;height:auto;background:#0d1117;border-radius:12px;">

    <!-- North America -->
    <path id="region-NA"
      d="M80,80 L200,60 L240,100 L220,180 L180,220 L120,200 L80,160 Z"
      fill="#1a1a2e" stroke="#444" stroke-width="1.5" class="region"
      onclick="selectRegion('NA')"/>
    <text x="155" y="145" fill="#666" font-size="12"
      text-anchor="middle" pointer-events="none">N.AMERICA</text>

    <!-- South America -->
    <path id="region-SA"
      d="M160,240 L220,230 L245,300 L225,385 L185,405 L145,365 L132,292 Z"
      fill="#1a1a2e" stroke="#444" stroke-width="1.5" class="region"
      onclick="selectRegion('SA')"/>
    <text x="188" y="322" fill="#666" font-size="12"
      text-anchor="middle" pointer-events="none">S.AMERICA</text>

    <!-- Europe -->
    <path id="region-EU"
      d="M415,55 L505,45 L525,105 L505,145 L440,155 L408,112 Z"
      fill="#1a1a2e" stroke="#444" stroke-width="1.5" class="region"
      onclick="selectRegion('EU')"/>
    <text x="466" y="105" fill="#666" font-size="12"
      text-anchor="middle" pointer-events="none">EUROPE</text>

    <!-- Africa -->
    <path id="region-AF"
      d="M415,172 L502,162 L524,224 L514,325 L462,362 L408,324 L398,242 Z"
      fill="#1a1a2e" stroke="#444" stroke-width="1.5" class="region"
      onclick="selectRegion('AF')"/>
    <text x="460" y="268" fill="#666" font-size="12"
      text-anchor="middle" pointer-events="none">AFRICA</text>

    <!-- Asia -->
    <path id="region-AS"
      d="M542,48 L782,38 L804,122 L762,184 L682,202 L582,182 L532,132 Z"
      fill="#1a1a2e" stroke="#444" stroke-width="1.5" class="region"
      onclick="selectRegion('AS')"/>
    <text x="660" y="122" fill="#666" font-size="12"
      text-anchor="middle" pointer-events="none">ASIA</text>

    <!-- Oceania -->
    <path id="region-OC"
      d="M722,282 L822,272 L842,342 L802,382 L722,372 L702,322 Z"
      fill="#1a1a2e" stroke="#444" stroke-width="1.5" class="region"
      onclick="selectRegion('OC')"/>
    <text x="772" y="332" fill="#666" font-size="12"
      text-anchor="middle" pointer-events="none">OCEANIA</text>

  </svg>`;
}

function selectRegion(code) {
  if (!isPlayer) return;
  const region = REGION_MAP[code];
  if (!region) return;
  selectedCityIdx = region.cityStart;
  document.getElementById("action-status").textContent =
    `Targeting: ${region.label}`;

  // Highlight selected region
  document.querySelectorAll(".region").forEach(r => {
    r.setAttribute("stroke", "#444");
    r.setAttribute("stroke-width", "1.5");
  });
  const path = document.getElementById(`region-${code}`);
  if (path) {
    path.setAttribute("stroke", "#ffffff");
    path.setAttribute("stroke-width", "3");
  }
}

function buildRegionSelect() {
  // Region select is handled by tapping the SVG map directly
  // Default target is North America
  selectedCityIdx = 0;
  document.getElementById("action-status").textContent =
    "Tap a continent to target it";
}

// ── MAP REFRESH ───────────────────────────────────────────────────
async function refreshMap() {
  try {
    const playerCount = Number(await contract.playerCount());

    for (let i = 0; i < playerCount; i++) {
      const addr = await contract.playerList(i);
      if (playerAddressMap[addr] === undefined) {
        playerAddressMap[addr] = i;
      }
    }

    // Tally dominant owner per region
    const regionOwners = {};
    for (const [code, region] of Object.entries(REGION_MAP)) {
      const tally = {};
      for (let i = region.cityStart; i < region.cityStart + 5; i++) {
        const owner = await contract.getCityOwner(i);
        if (owner !== ethers.ZeroAddress) {
          tally[owner] = (tally[owner] || 0) + 1;
        }
      }
      const dominant = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
      if (dominant) regionOwners[code] = dominant[0];
    }

    // Paint regions
    for (const [code, owner] of Object.entries(regionOwners)) {
      const path = document.getElementById(`region-${code}`);
      if (!path) continue;
      const colorIdx = playerAddressMap[owner] ?? 0;
      const color = COLORS[colorIdx % COLORS.length];
      path.setAttribute("fill", color);

      if (
        isPlayer &&
        burnerWallet &&
        owner.toLowerCase() === burnerWallet.address.toLowerCase()
      ) {
        path.setAttribute("stroke", "#ffffff");
        path.setAttribute("stroke-width", "3");
      } else {
        path.setAttribute("stroke", "#444");
        path.setAttribute("stroke-width", "1.5");
      }
    }

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

      document.getElementById("round-display").textContent = `ROUND ${round}`;
      await refreshMap();

      if (round !== lastRound) {
        lastRound = round;
        moveSubmitted = false;
        resetActionButtons();
        document.getElementById("action-status").textContent =
          "Tap a continent to target it";
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

  const attackBtn = document.querySelector(".btn-attack");
  const fortifyBtn = document.querySelector(".btn-fortify");
  const statusEl = document.getElementById("move-status");

  attackBtn.disabled = true;
  fortifyBtn.disabled = true;
  statusEl.textContent = "Submitting...";

  try {
    const tx = await contract.submitMove(isAttack, selectedCityIdx);
    await tx.wait();
    moveSubmitted = true;
    const regionLabel = Object.values(REGION_MAP).find(
      r => r.cityStart === selectedCityIdx
    )?.label ?? `City ${selectedCityIdx + 1}`;
    statusEl.textContent = isAttack
      ? `⚔️ Attacking ${regionLabel}`
      : `🛡️ Fortified ${regionLabel}`;
    document.getElementById("action-status").textContent = "Move locked ✅";
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
  if (timerInterval) clearInterval(timerInterval);

  const timerBar = document.getElementById("timer-bar");
  const timerDisplay = document.getElementById("timer-display");
  let remaining = duration;

  timerBar.style.width = "100%";
  timerBar.style.background = "#7c3aed";
  timerDisplay.textContent = remaining;

  timerInterval = setInterval(() => {
    remaining--;
    timerDisplay.textContent = remaining;
    timerBar.style.width = `${(remaining / duration) * 100}%`;
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

    const cityCount = Number(await contract.getPlayerCityCount(winnerAddr));
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
