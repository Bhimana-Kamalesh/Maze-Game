/**
 * Neon Maze Runner
 * Core Game Logic
 */

const canvas = document.getElementById('maze-canvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startBtn = document.getElementById('start-btn');
const menuOverlay = document.getElementById('menu-overlay');

const difficultyOverlay = document.getElementById('difficulty-overlay');
const levelSelectOverlay = document.getElementById('level-select-overlay');
const levelGrid = document.getElementById('level-grid');
const backToMenuBtn = document.getElementById('back-to-menu-btn');
const backToDiffBtn = document.getElementById('back-to-diff-btn');

const levelCompleteOverlay = document.getElementById('level-complete-overlay');
const nextLevelBtn = document.getElementById('next-level-btn');
const returnMapBtn = document.getElementById('return-map-btn');

const gameOverOverlay = document.getElementById('game-over-overlay');
const restartBtn = document.getElementById('restart-btn');

const levelDisplay = document.getElementById('level-display');
const scoreDisplay = document.getElementById('score-display');
const timeDisplay = document.getElementById('time-display');
const levelSelectTitle = document.getElementById('level-select-title');

// Config
const CONFIG = {
    easy: { baseCols: 8, baseRows: 8, growth: 1 },
    medium: { baseCols: 12, baseRows: 12, growth: 2 },
    hard: { baseCols: 15, baseRows: 15, growth: 3 },
    totalLevels: 10
};

// Game State
let gameState = {
    difficulty: 'easy', // 'easy', 'medium', 'hard'
    level: 1,
    score: 0,
    startTime: 0,
    isPlaying: false,
    cols: 10,
    rows: 10,
    cellSize: 40,
    maze: [],
    particles: [],
    player: { col: 0, row: 0 },
    playerPos: { x: 0, y: 0 },
    goal: { col: 0, row: 0 },
    lastTime: 0
};

// Persistence
let progress = JSON.parse(localStorage.getItem('mazeProgress')) || {
    easy: 1,
    medium: 1,
    hard: 1
};

function saveProgress() {
    localStorage.setItem('mazeProgress', JSON.stringify(progress));
}

// Colors
const WALL_COLOR = '#0ff';
const PLAYER_COLOR_START = '#f0f';
const GOAL_COLOR = '#0f0';

// --- Particle System ---
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 1;
        this.speedX = Math.random() * 2 - 1;
        this.speedY = Math.random() * 2 - 1;
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.01;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function spawnParticles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
        gameState.particles.push(new Particle(x, y, color));
    }
}

// --- Maze Generation (Recursive Backtracker) ---

class Cell {
    constructor(col, row) {
        this.col = col;
        this.row = row;
        // top, right, bottom, left
        this.walls = [true, true, true, true];
        this.visited = false;
    }

    draw(size) {
        const x = this.col * size;
        const y = this.row * size;

        ctx.strokeStyle = WALL_COLOR;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 10;
        ctx.shadowColor = WALL_COLOR;

        ctx.beginPath();
        if (this.walls[0]) { ctx.moveTo(x, y); ctx.lineTo(x + size, y); } // Top
        if (this.walls[1]) { ctx.moveTo(x + size, y); ctx.lineTo(x + size, y + size); } // Right
        if (this.walls[2]) { ctx.moveTo(x + size, y + size); ctx.lineTo(x, y + size); } // Bottom
        if (this.walls[3]) { ctx.moveTo(x, y + size); ctx.lineTo(x, y); } // Left
        ctx.stroke();

        ctx.shadowBlur = 0; // Reset shadow for other draws
    }

    checkNeighbors() {
        const neighbors = [];
        const top = gridIndex(this.col, this.row - 1);
        const right = gridIndex(this.col + 1, this.row);
        const bottom = gridIndex(this.col, this.row + 1);
        const left = gridIndex(this.col - 1, this.row);

        if (top && !top.visited) neighbors.push(top);
        if (right && !right.visited) neighbors.push(right);
        if (bottom && !bottom.visited) neighbors.push(bottom);
        if (left && !left.visited) neighbors.push(left);

        if (neighbors.length > 0) {
            const r = Math.floor(Math.random() * neighbors.length);
            return neighbors[r];
        } else {
            return undefined;
        }
    }
}

function gridIndex(col, row) {
    if (col < 0 || row < 0 || col > gameState.cols - 1 || row > gameState.rows - 1) {
        return undefined;
    }
    return gameState.maze[col + row * gameState.cols];
}

function removeWalls(a, b) {
    const x = a.col - b.col;
    if (x === 1) {
        a.walls[3] = false;
        b.walls[1] = false;
    } else if (x === -1) {
        a.walls[1] = false;
        b.walls[3] = false;
    }
    const y = a.row - b.row;
    if (y === 1) {
        a.walls[0] = false;
        b.walls[2] = false;
    } else if (y === -1) {
        a.walls[2] = false;
        b.walls[0] = false;
    }
}

function generateMaze() {
    gameState.maze = [];
    for (let j = 0; j < gameState.rows; j++) {
        for (let i = 0; i < gameState.cols; i++) {
            const cell = new Cell(i, j);
            gameState.maze.push(cell);
        }
    }

    gameState.currentCell = gameState.maze[0];
    gameState.currentCell.visited = true;

    let stack = [];
    while (true) {
        const next = gameState.currentCell.checkNeighbors();
        if (next) {
            next.visited = true;
            stack.push(gameState.currentCell);
            removeWalls(gameState.currentCell, next);
            gameState.currentCell = next;
        } else if (stack.length > 0) {
            gameState.currentCell = stack.pop();
        } else {
            break;
        }
    }
}

// --- Player & Game Logic ---

function drawPlayer() {
    const size = gameState.cellSize;
    // Use smoothed position
    const x = gameState.playerPos.x + size / 2;
    const y = gameState.playerPos.y + size / 2;
    const r = size / 4;

    ctx.fillStyle = PLAYER_COLOR_START;
    ctx.shadowBlur = 15;
    ctx.shadowColor = PLAYER_COLOR_START;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
}

function drawGoal() {
    const size = gameState.cellSize;
    const x = gameState.goal.col * size + size / 2;
    const y = gameState.goal.row * size + size / 2;
    const r = size / 3;

    ctx.strokeStyle = GOAL_COLOR;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 15;
    ctx.shadowColor = GOAL_COLOR;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    const pulse = (Math.sin(Date.now() / 200) + 1) / 2 * (r / 2);
    ctx.fillStyle = GOAL_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, pulse, 0, Math.PI * 2);
    ctx.fill();

    // Goal Particles
    if (Math.random() < 0.1) spawnParticles(x, y, GOAL_COLOR, 1);

    ctx.shadowBlur = 0;
}

function movePlayer(dx, dy) {
    if (!gameState.isPlaying) return;

    const currentCell = gridIndex(gameState.player.col, gameState.player.row);
    let canMove = false;

    if (dx === 1) { // Right
        if (!currentCell.walls[1]) canMove = true;
    } else if (dx === -1) { // Left
        if (!currentCell.walls[3]) canMove = true;
    } else if (dy === 1) { // Down
        if (!currentCell.walls[2]) canMove = true;
    } else if (dy === -1) { // Up
        if (!currentCell.walls[0]) canMove = true;
    }

    if (canMove) {
        gameState.player.col += dx;
        gameState.player.row += dy;
        spawnParticles(
            gameState.playerPos.x + gameState.cellSize / 2,
            gameState.playerPos.y + gameState.cellSize / 2,
            PLAYER_COLOR_START,
            3
        );
        checkWin();
    }
}

function checkWin() {
    if (gameState.player.col === gameState.goal.col && gameState.player.row === gameState.goal.row) {
        levelComplete();
    }
}

// --- Game Loop & Control ---

function resizeCanvas() {
    const maxWidth = window.innerWidth - 40;
    const maxHeight = window.innerHeight - 40;

    gameState.cellSize = Math.min(
        Math.floor(maxWidth / gameState.cols),
        Math.floor(maxHeight / gameState.rows),
        50
    );

    canvas.width = gameState.cols * gameState.cellSize;
    canvas.height = gameState.rows * gameState.cellSize;

    // Snap player visual to new size instantly
    gameState.playerPos.x = gameState.player.col * gameState.cellSize;
    gameState.playerPos.y = gameState.player.row * gameState.cellSize;
}

function initLevel() {
    const conf = CONFIG[gameState.difficulty];
    // Growth formula: Base + (Level * Growth)
    gameState.cols = conf.baseCols + Math.floor(gameState.level * conf.growth);
    gameState.rows = conf.baseRows + Math.floor(gameState.level * conf.growth);

    generateMaze();

    gameState.player = { col: 0, row: 0 };
    gameState.goal = { col: gameState.cols - 1, row: gameState.rows - 1 };

    resizeCanvas();
    gameState.isPlaying = true;
    gameState.startTime = Date.now();
    gameState.particles = [];

    updateTimer();
}

function gameLoop(timestamp) {
    if (!gameState.isPlaying && gameState.particles.length === 0) {
        requestAnimationFrame(gameLoop);
        return;
    }

    const dt = timestamp - gameState.lastTime;
    gameState.lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Smooth Movement Logic
    const targetX = gameState.player.col * gameState.cellSize;
    const targetY = gameState.player.row * gameState.cellSize;

    // Lerp (Linear Interpolation) for smoothness
    gameState.playerPos.x += (targetX - gameState.playerPos.x) * 0.2;
    gameState.playerPos.y += (targetY - gameState.playerPos.y) * 0.2;

    // Draw Maze
    for (let cell of gameState.maze) {
        cell.draw(gameState.cellSize);
    }

    // Update & Draw Particles
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        const p = gameState.particles[i];
        p.update();
        p.draw(ctx);
        if (p.life <= 0) {
            gameState.particles.splice(i, 1);
        }
    }

    drawGoal();
    drawPlayer();

    requestAnimationFrame(gameLoop);
}

function updateTimer() {
    if (!gameState.isPlaying) return;

    const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
    const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    timeDisplay.textContent = `${m}:${s}`;

    requestAnimationFrame(updateTimer);
}

// --- Menu Navigation ---

function startGame() {
    menuOverlay.classList.add('hidden');
    difficultyOverlay.classList.remove('hidden');
}

function backToMenu() {
    difficultyOverlay.classList.add('hidden');
    menuOverlay.classList.remove('hidden');
}

function showLevelMap(difficulty) {
    gameState.difficulty = difficulty;
    difficultyOverlay.classList.add('hidden');

    levelSelectTitle.textContent = `${difficulty.toUpperCase()} LEVELS`;
    renderLevelGrid();

    levelSelectOverlay.classList.remove('hidden');
}

function renderLevelGrid() {
    levelGrid.innerHTML = '';
    const unlocked = progress[gameState.difficulty];

    for (let i = 1; i <= CONFIG.totalLevels; i++) {
        const btn = document.createElement('button');
        btn.classList.add('level-btn');
        btn.textContent = i;

        if (i < unlocked) {
            btn.classList.add('completed');
        }

        if (i > unlocked) {
            btn.classList.add('locked');
            btn.innerHTML = '&#128274;'; // Padlock
        } else {
            btn.onclick = () => startLevel(i);
        }

        levelGrid.appendChild(btn);
    }
}

function startLevel(lvl) {
    gameState.level = lvl;
    levelSelectOverlay.classList.add('hidden');
    levelCompleteOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');

    levelDisplay.textContent = gameState.level;
    scoreDisplay.textContent = gameState.score;

    initLevel();
}

function levelComplete() {
    gameState.isPlaying = false;

    const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
    const baseScore = 100 * gameState.level;
    const timeBonus = Math.max(0, 300 - elapsed * 5);
    const levelScore = baseScore + timeBonus;

    gameState.score += levelScore;

    // Unlock next level
    const currentUnlocked = progress[gameState.difficulty];
    if (gameState.level === currentUnlocked && currentUnlocked < CONFIG.totalLevels) {
        progress[gameState.difficulty]++;
        saveProgress();
    }

    document.getElementById('level-time-bonus').textContent = levelScore;
    scoreDisplay.textContent = gameState.score;

    levelCompleteOverlay.classList.remove('hidden');

    // Check if max level reached
    if (gameState.level >= CONFIG.totalLevels) {
        nextLevelBtn.classList.add('hidden');
    } else {
        nextLevelBtn.classList.remove('hidden');
    }
}

// Events
// Map difficulty buttons
document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        showLevelMap(btn.getAttribute('data-diff'));
    });
});

startBtn.addEventListener('click', startGame);
backToMenuBtn.addEventListener('click', backToMenu);

backToDiffBtn.addEventListener('click', () => {
    levelSelectOverlay.classList.add('hidden');
    difficultyOverlay.classList.remove('hidden');
});

nextLevelBtn.addEventListener('click', () => {
    startLevel(gameState.level + 1);
});

returnMapBtn.addEventListener('click', () => {
    levelCompleteOverlay.classList.add('hidden');
    renderLevelGrid(); // Refresh unlock status
    levelSelectOverlay.classList.remove('hidden');
});

restartBtn.addEventListener('click', () => startLevel(gameState.level));

// Input
window.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': movePlayer(0, -1); break;
        case 'ArrowRight': case 'd': case 'D': movePlayer(1, 0); break;
        case 'ArrowDown': case 's': case 'S': movePlayer(0, 1); break;
        case 'ArrowLeft': case 'a': case 'A': movePlayer(-1, 0); break;
    }
});

// Input Handling - Continuous Touch (Drag)
function setupTouchControls() {
    let touchStartX = 0;
    let touchStartY = 0;
    const MOVEMENT_THRESHOLD = 30; // Pixels to drag before moving

    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].screenX;
        touchStartY = e.touches[0].screenY;
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Prevent scrolling

        const touchCurrentX = e.touches[0].screenX;
        const touchCurrentY = e.touches[0].screenY;

        const dx = touchCurrentX - touchStartX;
        const dy = touchCurrentY - touchStartY;

        if (Math.abs(dx) > MOVEMENT_THRESHOLD || Math.abs(dy) > MOVEMENT_THRESHOLD) {
            if (Math.abs(dx) > Math.abs(dy)) {
                // Horizontal
                movePlayer(dx > 0 ? 1 : -1, 0);
            } else {
                // Vertical
                movePlayer(0, dy > 0 ? 1 : -1);
            }

            // Reset start position to current to allow continuous movement
            touchStartX = touchCurrentX;
            touchStartY = touchCurrentY;
        }
    }, { passive: false });
}

setupTouchControls();

window.addEventListener('resize', () => {
    if (gameState.isPlaying) resizeCanvas();
});

// Init Background loop (Optional: could run a demo maze in bg)
requestAnimationFrame(gameLoop);
