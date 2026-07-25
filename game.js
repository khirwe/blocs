// ── CONFIG ──────────────────────────────────────────────────────
const CONTRACT_ADDRESS = "0x6B35346e6AeFEEb85D812dd12EDD5C2969e64DC3";
const RPC_URL = "https://testnet-rpc.monad.xyz";
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

const COUNTRY_TO_CITY = {
  // North America (0-4)
  "us": 0, "ca": 1, "mx": 2, "gt": 3, "bz": 3, "hn": 3,
  "sv": 3, "ni": 3, "cr": 3, "pa": 3, "cu": 4, "jm": 4,
  "ht": 4, "do": 4, "pr": 4, "tt": 4, "bs": 4, "bb": 4,
  "lc": 4, "vc": 4, "gd": 4, "ag": 4, "dm": 4, "kn": 4,
  "gl": 1, "pm": 1,

  // South America (5-9)
  "br": 5, "ar": 6, "co": 7, "ve": 7, "pe": 8, "cl": 8,
  "ec": 8, "bo": 8, "py": 9, "uy": 9, "gy": 9, "sr": 9,
  "gf": 9, "fk": 9,

  // Europe (10-14)
  "de": 10, "fr": 10, "gb": 11, "it": 11, "es": 12,
  "pt": 12, "nl": 12, "be": 12, "ch": 12, "at": 12,
  "pl": 13, "cz": 13, "sk": 13, "hu": 13, "ro": 13,
  "bg": 13, "rs": 13, "hr": 13, "si": 13, "ba": 13,
  "me": 13, "mk": 13, "al": 13, "gr": 13, "cy": 13,
  "se": 11, "no": 11, "dk": 11, "fi": 11, "is": 11,
  "ie": 11, "lu": 12, "li": 12, "mc": 12, "ad": 12,
  "sm": 12, "va": 12, "mt": 12, "ee": 13, "lv": 13,
  "lt": 13, "by": 13, "ua": 13, "md": 13, "ru": 14,
  "tr": 14, "ge": 14, "am": 14, "az": 14,

  // Africa (15-19)
  "ng": 15, "et": 15, "eg": 16, "cd": 15, "tz": 17,
  "ke": 17, "za": 18, "ug": 17, "dz": 16, "sd": 16,
  "ma": 16, "ao": 18, "mz": 18, "gh": 15, "mg": 19,
  "cm": 15, "ci": 15, "ne": 16, "bf": 15, "ml": 16,
  "mw": 18, "zm": 18, "sn": 15, "so": 17, "td": 16,
  "gn": 15, "rw": 17, "bj": 15, "tn": 16, "bi": 17,
  "ss": 16, "tg": 15, "sl": 15, "ly": 16, "cg": 15,
  "lr": 15, "cf": 15, "mr": 16, "er": 17, "gm": 15,
  "bw": 18, "na": 18, "ga": 15, "ls": 18, "gq": 15,
  "gw": 15, "mu": 19, "sz": 18, "dj": 17, "km": 19,
  "cv": 15, "st": 15, "sc": 19, "eh": 16,

  // Asia (20-24)
  "cn": 20, "in": 21, "id": 22, "pk": 21, "bd": 21,
  "jp": 20, "ph": 22, "vn": 22, "ir": 23, "th": 22,
  "mm": 22, "kr": 20, "iq": 23, "af": 23, "sa": 23,
  "uz": 24, "my": 22, "ye": 23, "np": 21, "kp": 20,
  "tw": 20, "sy": 23, "lk": 21, "kz": 24, "kh": 22,
  "jo": 23, "ae": 23, "tj": 24, "la": 22, "il": 23,
  "lb": 23, "kg": 24, "tm": 24, "sg": 22, "om": 23,
  "ps": 23, "kw": 23, "mn": 20, "qa": 23, "bh": 23,
  "tl": 22, "bn": 22, "bt": 21, "mv": 21, "mo": 20,
  "hk": 20,

  // Oceania (25-29)
  "au": 25, "pg": 26, "nz": 27, "fj": 28, "sb": 26,
  "vu": 28, "ws": 28, "ki": 28, "to": 28, "fm": 26,
  "pw": 26, "mh": 28, "nr": 28, "tv": 28, "ck": 29,
  "nu": 29, "wf": 28, "as": 28, "pf": 29, "nc": 26,
  "gu": 26, "mp": 26,
};

// ── STATE ────────────────────────────────────────────────────────
let provider, signer, contract, burnerWallet;
let isHost = false;
let isPlayer = false;
let myCity = null;
let playerAddressMap = {};
let timerInterval = null;
let pollInterval = null;
let moveSubmitted = false;
let selectedCityIdx = 0;
let selectedCountryName = "None";
let cityOwnerCache = {};

// ── INIT ─────────────────────────────────────────────────────────
window.addEventListener("load", () => detectRole());

async function detectRole() {
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
    const statusEl = document.getElementById("join-status");
    if (statusEl) statusEl.textContent = "Funding wallet...";

    await fetch(`/api/fund?address=${address}`);
    await new Promise(resolve => setTimeout(resolve, 5000));

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

  const phase = Number(await contract.getPhase());
  if (phase === 1) {
    clearInterval(pollInterval);
    showScreen("game-screen");
    await buildMap();
    startHostGameLoop();
    return;
  }

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
    await buildMap();
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
  const statusEl = document.getElementById("join-status");
  statusEl.textContent = "Setting up wallet...";

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

  const phase = Number(await contract.getPhase());
  if (phase === 1) {
    statusEl.textContent = "Game in progress...";
    try {
      const playerData = await contract.players(burnerWallet.address);
      if (!playerData.registered) {
        statusEl.textContent = "❌ Game already started. Wait for next game.";
        return;
      }
      myCity = await getPlayerCity(burnerWallet.address);
      showScreen("game-screen");
      await buildMap();
      document.getElementById("action-panel").style.display = "flex";
      startPlayerGameLoop();
      return;
    } catch (e) {
      console.error(e);
    }
  }

  statusEl.textContent = "Joining game...";

  try {
    const playerData = await contract.players(burnerWallet.address);
    if (!playerData.registered) {
      const tx = await contract.join();
      await tx.wait();
    }

    myCity = await getPlayerCity(burnerWallet.address);
    statusEl.textContent = "✅ Joined! Waiting for host...";
    document.getElementById("player-city-display").textContent =
      myCity !== null ? `Your starting city: #${myCity + 1}` : "";

    pollInterval = setInterval(checkGameStart, 2000);
  } catch (e) {
    console.error(e);
    statusEl.textContent = "❌ Failed to join. Make sure game is in lobby.";
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
      await buildMap();
      document.getElementById("action-panel").style.display = "flex";
      startPlayerGameLoop();
    }
  } catch (e) {}
}

// ── MAP ───────────────────────────────────────────────────────────
async function buildMap() {
  const grid = document.getElementById("city-grid");
  grid.innerHTML = `<p style="color:#666;text-align:center;padding:20px;">
    Loading map...</p>`;

  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"
    );
    const geojson = await res.json();

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 1000 500");
    svg.setAttribute("id", "world-svg");
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.background = "#0d1117";
    svg.style.borderRadius = "12px";
    svg.style.cursor = "pointer";

    geojson.features.forEach(feature => {
      const code = feature.properties.iso_a2?.toLowerCase();
      if (!code) return;

      const cityIdx = COUNTRY_TO_CITY[code];
      const paths = geoToPaths(feature.geometry);

      paths.forEach(d => {
        if (!d) return;
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", d);
        path.setAttribute("fill", "#1a1a2e");
        path.setAttribute("stroke", "#2a2a4a");
        path.setAttribute("stroke-width", "0.5");
        path.setAttribute("id", `country-${code}`);
        path.setAttribute("data-code", code);
        path.setAttribute("data-city", cityIdx ?? -1);
        path.setAttribute("data-name", feature.properties.name ?? code);
        path.style.transition = "fill 0.3s ease";

        if (isPlayer && cityIdx !== undefined) {
          path.style.cursor = "pointer";
          path.addEventListener("click", () => {
            selectCountry(code, feature.properties.name, cityIdx);
          });
          path.addEventListener("touchend", (e) => {
            e.preventDefault();
            selectCountry(code, feature.properties.name, cityIdx);
          });
        }

        svg.appendChild(path);
      });
    });

    grid.innerHTML = "";
    grid.appendChild(svg);

  } catch (e) {
    console.error("Map load error:", e);
    grid.innerHTML = `<p style="color:#ef4444;text-align:center;">
      Map failed to load.</p>`;
  }
}

function project(lon, lat) {
  const x = (lon + 180) * (1000 / 360);
  const y = (90 - lat) * (500 / 180);
  return [x, y];
}

function geoToPaths(geometry) {
  const rings = [];

  const processRing = (coords) => {
    if (!coords || coords.length === 0) return null;
    const points = coords.map(([lon, lat]) => project(lon, lat));
    return "M" + points.map(([x, y]) =>
      `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z";
  };

  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach(ring => rings.push(processRing(ring)));
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach(poly =>
      poly.forEach(ring => rings.push(processRing(ring)))
    );
  }

  return rings;
}

function selectCountry(code, name, cityIdx) {
  if (!isPlayer || moveSubmitted) return;
  selectedCityIdx = cityIdx;
  selectedCountryName = name;

  document.querySelectorAll("[data-code]").forEach(p => {
    p.setAttribute("stroke", "#2a2a4a");
    p.setAttribute("stroke-width", "0.5");
  });

  document.querySelectorAll(`[data-city="${cityIdx}"]`).forEach(p => {
    p.setAttribute("stroke", "#ffffff");
    p.setAttribute("stroke-width", "1.5");
  });

  document.getElementById("action-status").textContent =
    `Targeting: ${name}`;
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

    for (let i = 0; i < TOTAL_CITIES; i++) {
      cityOwnerCache[i] = await contract.getCityOwner(i);
    }

    document.querySelectorAll("[data-code]").forEach(path => {
      const cityIdx = parseInt(path.getAttribute("data-city"));
      if (isNaN(cityIdx) || cityIdx < 0) return;

      const owner = cityOwnerCache[cityIdx];
      if (!owner || owner === ethers.ZeroAddress) {
        path.setAttribute("fill", "#1a1a2e");
        return;
      }

      const colorIdx = playerAddressMap[owner] ?? 0;
      const color = COLORS[colorIdx % COLORS.length];
      path.setAttribute("fill", color);

      if (
        isPlayer &&
        burnerWallet &&
        owner.toLowerCase() === burnerWallet.address.toLowerCase()
      ) {
        path.setAttribute("stroke", "#ffffff");
        path.setAttribute("stroke-width", "1.5");
      }
    });

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
          "Tap a country to target it";
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
  if (selectedCityIdx === undefined || selectedCityIdx === null) {
    document.getElementById("move-status").textContent =
      "❌ Tap a country first";
    return;
  }

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
    statusEl.textContent = isAttack
      ? `⚔️ Attacking ${selectedCountryName}`
      : `🛡️ Fortified ${selectedCountryName}`;
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

    const cityCount = Number(
      await contract.getPlayerCityCount(winnerAddr)
    );
    document.getElementById("winner-cities").textContent =
      `Controlled ${cityCount} of ${TOTAL_CITIES} territories`;

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
