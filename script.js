// --- CONSTANTS & CONFIG ---
const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const PLAYER1 = 1;
const PLAYER2 = 2; // Also used for AI

// Socket Placeholder
const BACKEND_URL = "https://connect-four-production-5edd.up.railway.app";
let socket = null; // Will initialize when online mode is selected
let roomCode = "";
let isOnline = false;
let myPlayerNumber = 0;
let isWaitingForOpponent = false;

// Game State
let board = [];
let currentPlayer = PLAYER1;
let isGameOver = false;
let gameMode = 'local'; // 'local', 'ai', 'online'
let aiDifficulty = 'medium'; // 'easy', 'medium', 'hard'
let isAiThinking = false;

// Score Tracking
let scores = { p1: 0, p2: 0 };

// Stats Tracking (LocalStorage)
let stats = {
    nickname: "Player",
    totalMatches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    preferredColor: "red"
};

// --- DOM ELEMENTS ---
// Screens
const mainMenu = document.getElementById('main-menu');
const gameScreen = document.getElementById('game-screen');
const videoContainer = document.getElementById('video-container');

// Modals
const modalAiDiff = document.getElementById('modal-ai-difficulty');
const modalProfile = document.getElementById('modal-profile');
const modalOnline = document.getElementById('modal-online');
const modalGameOver = document.getElementById('modal-game-over');

// Game UI
const boardEl = document.getElementById('game-board');
const p1ScoreCard = document.getElementById('p1-score-card');
const p2ScoreCard = document.getElementById('p2-score-card');
const p1NameEl = document.getElementById('p1-name');
const p2NameEl = document.getElementById('p2-name');
const p1ScoreEl = document.getElementById('p1-score');
const p2ScoreEl = document.getElementById('p2-score');
const turnIndicator = document.getElementById('turn-indicator');
const gameModeDisplay = document.getElementById('game-mode-display');
const winnerText = document.getElementById('winner-text');

// --- INITIALIZATION ---
function init() {
    loadStats();
    setupEventListeners();
    initBoard();
}

function loadStats() {
    const saved = localStorage.getItem('connect4_stats');
    if (saved) {
        stats = JSON.parse(saved);
        document.getElementById('input-nickname').value = stats.nickname;
    }
    updateProfileUI();
}

function saveStats() {
    // Recalculate win rate
    stats.winRate = stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0;
    localStorage.setItem('connect4_stats', JSON.stringify(stats));
    updateProfileUI();
}

function updateProfileUI() {
    document.getElementById('stat-matches').textContent = stats.totalMatches;
    document.getElementById('stat-winrate').textContent = `${stats.winRate}%`;
    document.getElementById('stat-wins').textContent = stats.wins;
    document.getElementById('stat-losses').textContent = stats.losses;
    if (stats.nickname) {
        p1NameEl.textContent = stats.nickname;
    }
    
    // Update color buttons
    const btnRed = document.getElementById('btn-pref-red');
    const btnYellow = document.getElementById('btn-pref-yellow');
    
    if (stats.preferredColor === 'yellow') {
        btnYellow.className = "flex-1 py-3 rounded-xl bg-yellow-500/20 border-2 border-yellow-500 text-yellow-400 font-bold transition-all";
        btnRed.className = "flex-1 py-3 rounded-xl bg-white/5 border-2 border-transparent text-gray-400 hover:bg-white/10 font-bold transition-all";
    } else {
        btnRed.className = "flex-1 py-3 rounded-xl bg-red-500/20 border-2 border-red-500 text-red-400 font-bold transition-all";
        btnYellow.className = "flex-1 py-3 rounded-xl bg-white/5 border-2 border-transparent text-gray-400 hover:bg-white/10 font-bold transition-all";
    }
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Main Menu Buttons
    document.getElementById('btn-play-local').addEventListener('click', () => startGame('local'));
    document.getElementById('btn-play-ai').addEventListener('click', () => modalAiDiff.classList.remove('hidden'));
    document.getElementById('btn-play-online').addEventListener('click', () => modalOnline.classList.remove('hidden'));
    document.getElementById('btn-profile').addEventListener('click', () => modalProfile.classList.remove('hidden'));

    // Modal Closers
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => e.target.closest('div[id^="modal-"]').classList.add('hidden'));
    });

    // Profile Buttons
    document.getElementById('btn-pref-red').addEventListener('click', () => {
        stats.preferredColor = 'red';
        updateProfileUI();
    });
    
    document.getElementById('btn-pref-yellow').addEventListener('click', () => {
        stats.preferredColor = 'yellow';
        updateProfileUI();
    });

    // Profile Save
    document.getElementById('btn-save-profile').addEventListener('click', () => {
        stats.nickname = document.getElementById('input-nickname').value || "Player";
        saveStats();
        modalProfile.classList.add('hidden');
    });

    // AI Difficulty Selection
    document.querySelectorAll('.ai-diff-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            aiDifficulty = e.target.dataset.level;
            modalAiDiff.classList.add('hidden');
            startGame('ai');
        });
    });

    // Online Multiplayer
    document.getElementById('btn-create-room').addEventListener('click', () => initSocketAndJoin(true));
    document.getElementById('btn-join-room').addEventListener('click', () => initSocketAndJoin(false));

    // Game Actions
    document.getElementById('btn-back-menu').addEventListener('click', showMenu);
    document.getElementById('btn-restart').addEventListener('click', resetBoard);
    document.getElementById('btn-rematch').addEventListener('click', resetBoard);
    document.getElementById('btn-game-over-menu').addEventListener('click', showMenu);
}

// --- NAVIGATION & GAME SETUP ---
function startGame(mode) {
    gameMode = mode;
    isOnline = (mode === 'online');
    scores = { p1: 0, p2: 0 };
    updateScoreUI();
    
    gameModeDisplay.textContent = mode === 'local' ? 'Pass & Play' : 
                                  mode === 'ai' ? `Vs AI (${aiDifficulty})` : 
                                  'Online Match';

    p2NameEl.textContent = mode === 'local' ? 'Player 2' : 
                           mode === 'ai' ? 'Computer' : 
                           'Opponent';

    mainMenu.style.opacity = '0';
    mainMenu.style.pointerEvents = 'none';
    videoContainer.style.opacity = '0'; // Hide background

    setTimeout(() => {
        mainMenu.classList.add('hidden');
        videoContainer.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        resetBoard();
    }, 700);
}

function showMenu() {
    if (socket) socket.disconnect(); // Cleanup online if leaving
    isOnline = false;
    modalGameOver.classList.add('hidden');
    gameScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    
    // Fade back in
    videoContainer.classList.remove('hidden');
    setTimeout(() => {
        mainMenu.style.opacity = '1';
        mainMenu.style.pointerEvents = 'auto';
        videoContainer.style.opacity = '1';
    }, 50);
}

// --- CORE LOGIC ---
function initBoard() {
    boardEl.innerHTML = '';
    board = Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY));
    
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.r = r;
            cell.dataset.c = c;
            
            // Hover logic for column
            cell.addEventListener('mouseenter', () => highlightColumn(c, true));
            cell.addEventListener('mouseleave', () => highlightColumn(c, false));
            cell.addEventListener('click', () => handleColumnClick(c));

            boardEl.appendChild(cell);
        }
    }
}

function resetBoard() {
    modalGameOver.classList.add('hidden');
    board = Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY));
    currentPlayer = PLAYER1;
    isGameOver = false;
    isAiThinking = false;
    
    // Clear DOM discs
    const discs = document.querySelectorAll('.disc');
    discs.forEach(d => d.remove());

    updateTurnUI();
}

function highlightColumn(col, add) {
    if (isGameOver || (gameMode === 'ai' && currentPlayer === PLAYER2)) return;
    if (isOnline && currentPlayer !== myPlayerNumber) return;

    for (let r = 0; r < ROWS; r++) {
        const cell = getCellEl(r, col);
        if (cell) {
            if (add) cell.classList.add('cell-hover');
            else cell.classList.remove('cell-hover');
        }
    }
}

function getCellEl(r, c) {
    return document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

function handleColumnClick(col) {
    if (isGameOver || isAiThinking) return;
    
    if (isOnline) {
        if (isWaitingForOpponent) {
            alert("Please wait for your opponent to join before playing!");
            return;
        }
        if (currentPlayer !== myPlayerNumber) return;
        dropPiece(col, myPlayerNumber);
        if (socket) socket.emit('drop_piece', { roomCode, col, player: myPlayerNumber });
        return;
    }

    dropPiece(col, currentPlayer);
}

function dropPiece(col, player) {
    if (isGameOver) return;

    const row = getAvailableRow(col);
    if (row === -1) return; // Column full

    board[row][col] = player;
    animateDrop(row, col, player);

    const winData = checkWin(row, col, player, board);
    
    if (winData) {
        endGame(player, winData);
    } else if (checkDraw(board)) {
        endGame(0, null); // Draw
    } else {
        // Switch turn
        currentPlayer = player === PLAYER1 ? PLAYER2 : PLAYER1;
        updateTurnUI();

        // AI Turn
        if (gameMode === 'ai' && currentPlayer === PLAYER2 && !isGameOver) {
            isAiThinking = true;
            setTimeout(() => makeAiMove(), 500); // Small delay for realism
        }
    }
}

function getAvailableRow(col) {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === EMPTY) {
            return r;
        }
    }
    return -1;
}

function animateDrop(r, c, player) {
    const cell = getCellEl(r, c);
    const disc = document.createElement('div');
    
    // Determine color based on preference
    let colorClass = 'color-red';
    if (player === PLAYER1) {
        colorClass = stats.preferredColor === 'yellow' ? 'color-yellow' : 'color-red';
    } else {
        colorClass = stats.preferredColor === 'yellow' ? 'color-red' : 'color-yellow';
    }
    
    disc.className = `disc ${colorClass} dropped`;
    disc.id = `disc-${r}-${c}`;
    cell.appendChild(disc);
}

function updateTurnUI() {
    let p1ColorClass = stats.preferredColor === 'yellow' ? 'active-turn-yellow' : 'active-turn-red';
    let p2ColorClass = stats.preferredColor === 'yellow' ? 'active-turn-red' : 'active-turn-yellow';
    
    let p1TextColor = stats.preferredColor === 'yellow' ? 'text-yellow-400' : 'text-red-400';
    let p2TextColor = stats.preferredColor === 'yellow' ? 'text-red-400' : 'text-yellow-400';

    p1ScoreEl.className = `text-4xl font-black ${p1TextColor}`;
    p2ScoreEl.className = `text-4xl font-black ${p2TextColor}`;

    if (currentPlayer === PLAYER1) {
        p1ScoreCard.classList.add(p1ColorClass);
        p1ScoreCard.classList.remove('opacity-50', 'active-turn-red', 'active-turn-yellow');
        p1ScoreCard.classList.add(p1ColorClass); // Re-add after remove to ensure it's there
        p2ScoreCard.classList.remove('active-turn-red', 'active-turn-yellow');
        p2ScoreCard.classList.add('opacity-50');
        
        turnIndicator.textContent = "P1 Turn";
        turnIndicator.className = `text-sm font-bold ${p1TextColor} uppercase mt-2 tracking-widest animate-pulse`;
    } else {
        p2ScoreCard.classList.add(p2ColorClass);
        p2ScoreCard.classList.remove('opacity-50', 'active-turn-red', 'active-turn-yellow');
        p2ScoreCard.classList.add(p2ColorClass); // Re-add after remove to ensure it's there
        p1ScoreCard.classList.remove('active-turn-red', 'active-turn-yellow');
        p1ScoreCard.classList.add('opacity-50');

        turnIndicator.textContent = gameMode === 'ai' ? "AI Thinking" : "P2 Turn";
        turnIndicator.className = `text-sm font-bold ${p2TextColor} uppercase mt-2 tracking-widest animate-pulse`;
    }
}

function updateScoreUI() {
    p1ScoreEl.textContent = scores.p1;
    p2ScoreEl.textContent = scores.p2;
}

// --- WIN LOGIC ---
function checkWin(r, c, player, b) {
    // Check horizontal, vertical, and both diagonals
    const directions = [
        [[0, -1], [0, 1]],   // Horizontal
        [[-1, 0], [1, 0]],   // Vertical
        [[-1, -1], [1, 1]],  // Diagonal \
        [[-1, 1], [1, -1]]   // Diagonal /
    ];

    for (let dir of directions) {
        let count = 1;
        let winNodes = [{r, c}];

        for (let [dr, dc] of dir) {
            let nr = r + dr;
            let nc = c + dc;
            while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && b[nr][nc] === player) {
                count++;
                winNodes.push({r: nr, c: nc});
                nr += dr;
                nc += dc;
            }
        }

        if (count >= 4) {
            return winNodes; // Return the winning pieces to highlight
        }
    }
    return null;
}

function checkDraw(b) {
    for (let c = 0; c < COLS; c++) {
        if (b[0][c] === EMPTY) return false;
    }
    return true;
}

function endGame(winner, winNodes) {
    isGameOver = true;
    
    if (winner !== 0) {
        // Highlight winning pieces
        winNodes.forEach(node => {
            const disc = document.getElementById(`disc-${node.r}-${node.c}`);
            if (disc) disc.classList.add('winner');
        });

        // Trigger Confetti
        if (winner === PLAYER1 || (isOnline && winner === myPlayerNumber)) {
            triggerConfetti();
            scores.p1++;
            
            // Update Stats
            stats.totalMatches++;
            stats.wins++;
            saveStats();
        } else {
            scores.p2++;
            
            if (gameMode === 'ai' || isOnline) {
                stats.totalMatches++;
                stats.losses++;
                saveStats();
            }
        }
        
        let p1WinClass = stats.preferredColor === 'yellow' ? "text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200" : "text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-300";
        let p2WinClass = stats.preferredColor === 'yellow' ? "text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-300" : "text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200";

        winnerText.textContent = winner === PLAYER1 ? (stats.nickname + " Wins!") : (p2NameEl.textContent + " Wins!");
        winnerText.className = winner === PLAYER1 ? p1WinClass : p2WinClass;
    } else {
        winnerText.textContent = "It's a Draw!";
        winnerText.className = "text-4xl font-black mb-2 text-gray-300";
        
        // Update stats
        stats.totalMatches++;
        saveStats();
    }

    updateScoreUI();

    // Show modal after delay
    setTimeout(() => {
        modalGameOver.classList.remove('hidden');
    }, 1500);
}

function triggerConfetti() {
    var duration = 3000;
    var animationEnd = Date.now() + duration;
    var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    var interval = setInterval(function() {
        var timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        var particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
            colors: ['#22d3ee', '#0891b2', '#e879f9', '#c026d3']
        }));
        confetti(Object.assign({}, defaults, { particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
            colors: ['#22d3ee', '#0891b2', '#e879f9', '#c026d3']
        }));
    }, 250);
}

// --- AI LOGIC (MINIMAX + RANDOM) ---
function makeAiMove() {
    let col = -1;
    
    if (aiDifficulty === 'easy') {
        col = getRandomMove();
    } else if (aiDifficulty === 'medium') {
        // 50% random, 50% minimax depth 2
        if (Math.random() > 0.5) {
            col = getBestMove(2);
        } else {
            col = getRandomMove();
        }
    } else {
        // Hard mode: Minimax depth 5 (can adjust for performance)
        col = getBestMove(5);
    }

    if (col !== -1) {
        dropPiece(col, PLAYER2);
    }
    isAiThinking = false;
}

function getRandomMove() {
    let validCols = [];
    for (let c = 0; c < COLS; c++) {
        if (getAvailableRow(c) !== -1) validCols.push(c);
    }
    return validCols[Math.floor(Math.random() * validCols.length)];
}

// Minimax Implementation
function getBestMove(depth) {
    let bestScore = -Infinity;
    let bestCol = getRandomMove(); // Default to random valid if something goes wrong
    
    // Copy board
    let tempBoard = board.map(row => [...row]);

    for (let c = 0; c < COLS; c++) {
        let r = getAvailableRowInBoard(tempBoard, c);
        if (r !== -1) {
            tempBoard[r][c] = PLAYER2;
            let score = minimax(tempBoard, depth - 1, false, -Infinity, Infinity);
            tempBoard[r][c] = EMPTY;
            
            if (score > bestScore) {
                bestScore = score;
                bestCol = c;
            }
        }
    }
    return bestCol;
}

function minimax(b, depth, isMaximizing, alpha, beta) {
    // Check terminal states
    if (checkWinForPlayer(b, PLAYER2)) return 100000 + depth;
    if (checkWinForPlayer(b, PLAYER1)) return -100000 - depth;
    if (checkDraw(b)) return 0;
    if (depth === 0) return evaluateBoard(b, PLAYER2);

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (let c = 0; c < COLS; c++) {
            let r = getAvailableRowInBoard(b, c);
            if (r !== -1) {
                b[r][c] = PLAYER2;
                let ev = minimax(b, depth - 1, false, alpha, beta);
                b[r][c] = EMPTY;
                maxEval = Math.max(maxEval, ev);
                alpha = Math.max(alpha, ev);
                if (beta <= alpha) break;
            }
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (let c = 0; c < COLS; c++) {
            let r = getAvailableRowInBoard(b, c);
            if (r !== -1) {
                b[r][c] = PLAYER1;
                let ev = minimax(b, depth - 1, true, alpha, beta);
                b[r][c] = EMPTY;
                minEval = Math.min(minEval, ev);
                beta = Math.min(beta, ev);
                if (beta <= alpha) break;
            }
        }
        return minEval;
    }
}

// Heuristic evaluation for Minimax
function evaluateBoard(b, player) {
    let score = 0;
    const opp = player === PLAYER1 ? PLAYER2 : PLAYER1;

    // Center column preference (highly strategic in connect 4)
    let centerArray = [];
    for (let r = 0; r < ROWS; r++) centerArray.push(b[r][Math.floor(COLS/2)]);
    let centerCount = centerArray.filter(p => p === player).length;
    score += centerCount * 3;

    // Horizontal
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            let window = [b[r][c], b[r][c+1], b[r][c+2], b[r][c+3]];
            score += evaluateWindow(window, player, opp);
        }
    }
    // Vertical
    for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS - 3; r++) {
            let window = [b[r][c], b[r+1][c], b[r+2][c], b[r+3][c]];
            score += evaluateWindow(window, player, opp);
        }
    }
    // Positive Diagonal
    for (let r = 0; r < ROWS - 3; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            let window = [b[r][c], b[r+1][c+1], b[r+2][c+2], b[r+3][c+3]];
            score += evaluateWindow(window, player, opp);
        }
    }
    // Negative Diagonal
    for (let r = 0; r < ROWS - 3; r++) {
        for (let c = 0; c < COLS - 3; c++) {
            let window = [b[r+3][c], b[r+2][c+1], b[r+1][c+2], b[r][c+3]];
            score += evaluateWindow(window, player, opp);
        }
    }

    return score;
}

function evaluateWindow(window, player, opp) {
    let score = 0;
    let playerCount = window.filter(p => p === player).length;
    let emptyCount = window.filter(p => p === EMPTY).length;
    let oppCount = window.filter(p => p === opp).length;

    if (playerCount === 4) score += 100;
    else if (playerCount === 3 && emptyCount === 1) score += 5;
    else if (playerCount === 2 && emptyCount === 2) score += 2;

    if (oppCount === 3 && emptyCount === 1) score -= 4; // Block opponent

    return score;
}

// Helpers for AI
function getAvailableRowInBoard(b, col) {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (b[r][col] === EMPTY) return r;
    }
    return -1;
}

function checkWinForPlayer(b, player) {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (b[r][c] === player) {
                if (checkWin(r, c, player, b)) return true;
            }
        }
    }
    return false;
}

// --- ONLINE MULTIPLAYER (PLACEHOLDERS) ---
function initSocketAndJoin(isCreating) {
    let inputCode = document.getElementById('input-room-code').value.trim().toUpperCase();
    
    if (isCreating) {
        // If user typed a code, use it. Otherwise, generate a random one.
        roomCode = inputCode ? inputCode : Math.random().toString(36).substring(2, 8).toUpperCase();
    } else {
        roomCode = inputCode;
    }
    
    if (!isCreating && !roomCode) {
        alert("Please enter a room code.");
        return;
    }

    try {
        if (typeof io !== 'undefined') {
            // Initialize connection to your Backend
            socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
            
            socket.on('connect', () => {
                socket.emit('join_game', { roomCode });
                
                // Show waiting state (or directly start game and let UI show "Waiting for opponent...")
                modalOnline.classList.add('hidden');
                startGame('online');
            });

            // Handled when server confirms join
            socket.on('joined_successfully', (data) => {
                myPlayerNumber = data.player; // 1 if first (Creator), 2 if second (Joiner)
                
                // Update player text to show room code to share
                if (myPlayerNumber === PLAYER1) {
                    p2NameEl.textContent = `Waiting... (Code: ${roomCode})`;
                    isWaitingForOpponent = true;
                } else {
                    p2NameEl.textContent = 'Opponent';
                    isWaitingForOpponent = false;
                }
            });

            // When opponent connects
            socket.on('game_ready', (data) => {
                p2NameEl.textContent = 'Opponent';
                isWaitingForOpponent = false;
                // Game starts!
            });
            
            socket.on('board_updated', (data) => {
                if (data.player !== myPlayerNumber) {
                    dropPiece(data.col, data.player);
                }
            });

            socket.on('opponent_disconnected', (data) => {
                alert("Your opponent disconnected!");
                showMenu();
            });
            
            socket.on('room_full', (data) => {
                alert(data.message);
                socket.disconnect();
                showMenu();
            });

        } else {
            alert("Socket.io library not loaded.");
        }
    } catch(e) {
        console.error("Socket connection failed.", e);
        alert("Could not connect to the multiplayer server.");
    }
}

// Initialize application
window.onload = init;
