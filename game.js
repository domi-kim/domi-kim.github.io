// ============================================================
// Dino Runner - Chrome 공룡 게임 클론
// ============================================================

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// --- 캔버스 크기 ---
function resizeCanvas() {
    const maxWidth = 800;
    const w = Math.min(window.innerWidth - 4, maxWidth);
    canvas.width = w;
    canvas.height = 250;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// --- 게임 상태 ---
const STATE = { IDLE: 0, PLAYING: 1, OVER: 2 };
let state = STATE.IDLE;
let score = 0;
let highScore = parseInt(localStorage.getItem('dinoHighScore')) || 0;
let frameCount = 0;
let gameSpeed = 5;

// --- UI 요소 ---
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const finalScoreEl = document.getElementById('final-score');

// --- 색상 ---
const COLOR = '#535353';

// ============================================================
// 공룡 (Dino)
// ============================================================
const dino = {
    x: 50,
    y: 0,
    width: 44,
    height: 48,
    duckHeight: 30,
    vy: 0,
    gravity: 0.6,
    jumpForce: -12,
    grounded: true,
    ducking: false,
    legFrame: 0,

    get currentHeight() {
        return this.ducking ? this.duckHeight : this.height;
    },

    get groundY() {
        return canvas.height - 40 - this.currentHeight;
    },

    reset() {
        this.y = this.groundY;
        this.vy = 0;
        this.grounded = true;
        this.ducking = false;
    },

    jump() {
        if (this.grounded) {
            this.vy = this.jumpForce;
            this.grounded = false;
            this.ducking = false;
        }
    },

    duck(active) {
        if (this.grounded) {
            this.ducking = active;
            this.y = this.groundY;
        }
    },

    update() {
        // 중력 적용
        if (!this.grounded) {
            this.vy += this.gravity;
            this.y += this.vy;
            if (this.y >= this.groundY) {
                this.y = this.groundY;
                this.vy = 0;
                this.grounded = true;
            }
        } else {
            this.y = this.groundY;
        }

        // 다리 애니메이션
        if (frameCount % 6 === 0) {
            this.legFrame = this.legFrame === 0 ? 1 : 0;
        }
    },

    draw() {
        ctx.fillStyle = COLOR;

        if (this.ducking) {
            // 숙인 자세 - 넓고 낮은 몸
            const bx = this.x;
            const by = this.y;
            // 몸통
            ctx.fillRect(bx, by, 54, 20);
            // 머리
            ctx.fillRect(bx + 40, by - 8, 16, 14);
            // 눈
            ctx.fillStyle = '#fff';
            ctx.fillRect(bx + 50, by - 5, 4, 4);
            ctx.fillStyle = COLOR;
            // 다리
            if (this.legFrame === 0) {
                ctx.fillRect(bx + 8, by + 20, 6, 10);
                ctx.fillRect(bx + 24, by + 20, 6, 10);
            } else {
                ctx.fillRect(bx + 14, by + 20, 6, 10);
                ctx.fillRect(bx + 30, by + 20, 6, 10);
            }
        } else {
            // 기본 자세
            const bx = this.x;
            const by = this.y;
            // 머리
            ctx.fillRect(bx + 14, by, 30, 22);
            // 눈
            ctx.fillStyle = '#fff';
            ctx.fillRect(bx + 34, by + 4, 5, 5);
            ctx.fillStyle = COLOR;
            // 입
            ctx.fillRect(bx + 30, by + 16, 14, 3);
            // 몸통
            ctx.fillRect(bx + 6, by + 18, 28, 22);
            // 팔
            ctx.fillRect(bx + 28, by + 24, 10, 4);
            // 꼬리
            ctx.fillRect(bx, by + 18, 8, 6);
            ctx.fillRect(bx - 4, by + 16, 6, 4);
            // 다리
            if (!this.grounded) {
                // 점프 중
                ctx.fillRect(bx + 10, by + 40, 6, 8);
                ctx.fillRect(bx + 22, by + 40, 6, 8);
            } else if (this.legFrame === 0) {
                ctx.fillRect(bx + 10, by + 40, 6, 8);
                ctx.fillRect(bx + 24, by + 38, 6, 6);
            } else {
                ctx.fillRect(bx + 10, by + 38, 6, 6);
                ctx.fillRect(bx + 24, by + 40, 6, 8);
            }
        }
    },

    getHitbox() {
        if (this.ducking) {
            return { x: this.x + 4, y: this.y + 2, w: 48, h: 26 };
        }
        return { x: this.x + 6, y: this.y + 4, w: 30, h: 42 };
    }
};

// ============================================================
// 장애물 (Obstacles)
// ============================================================
let obstacles = [];
let spawnTimer = 0;

function createCactus() {
    const types = [
        // 작은 선인장
        { width: 16, height: 36 },
        // 큰 선인장
        { width: 20, height: 48 },
        // 선인장 그룹
        { width: 36, height: 36 },
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    return {
        x: canvas.width + 20,
        y: canvas.height - 40 - type.height,
        width: type.width,
        height: type.height,
        kind: 'cactus'
    };
}

function createBird() {
    const heights = [
        canvas.height - 40 - 60,  // 높이 나는 새 (숙여서 통과)
        canvas.height - 40 - 36,  // 중간 높이 새
        canvas.height - 40 - 20,  // 낮게 나는 새 (점프로 통과)
    ];
    return {
        x: canvas.width + 20,
        y: heights[Math.floor(Math.random() * heights.length)],
        width: 30,
        height: 20,
        kind: 'bird',
        wingFrame: 0
    };
}

function spawnObstacle() {
    // 점수가 200 이상이면 새도 등장
    if (score > 200 && Math.random() < 0.3) {
        obstacles.push(createBird());
    } else {
        obstacles.push(createCactus());
    }
}

function drawCactus(ob) {
    ctx.fillStyle = '#2d6b22';

    if (ob.width > 30) {
        // 선인장 그룹 (3개)
        ctx.fillRect(ob.x + 2, ob.y + 6, 8, ob.height - 6);
        ctx.fillRect(ob.x + 14, ob.y, 8, ob.height);
        ctx.fillRect(ob.x + 26, ob.y + 10, 8, ob.height - 10);
        // 가시 (작은 돌기)
        ctx.fillRect(ob.x - 1, ob.y + 14, 3, 3);
        ctx.fillRect(ob.x + 11, ob.y + 8, 3, 3);
        ctx.fillRect(ob.x + 23, ob.y + 18, 3, 3);
    } else if (ob.height > 40) {
        // 큰 선인장
        ctx.fillRect(ob.x + 4, ob.y, ob.width - 8, ob.height);
        // 팔
        ctx.fillRect(ob.x, ob.y + 12, 6, 4);
        ctx.fillRect(ob.x, ob.y + 12, 4, 14);
        ctx.fillRect(ob.x + ob.width - 6, ob.y + 20, 6, 4);
        ctx.fillRect(ob.x + ob.width - 4, ob.y + 20, 4, 10);
    } else {
        // 작은 선인장
        ctx.fillRect(ob.x + 3, ob.y, ob.width - 6, ob.height);
        ctx.fillRect(ob.x, ob.y + 10, 4, 3);
        ctx.fillRect(ob.x + ob.width - 4, ob.y + 16, 4, 3);
    }
}

function drawBird(ob) {
    ctx.fillStyle = COLOR;
    const bx = ob.x;
    const by = ob.y;

    // 몸통
    ctx.fillRect(bx + 4, by + 6, 22, 8);
    // 부리
    ctx.fillRect(bx + 26, by + 8, 6, 4);

    // 날개 애니메이션
    if (ob.wingFrame === 0) {
        ctx.fillRect(bx + 8, by, 12, 6);   // 날개 위
    } else {
        ctx.fillRect(bx + 8, by + 14, 12, 6); // 날개 아래
    }

    // 꼬리
    ctx.fillRect(bx, by + 4, 6, 4);
}

// ============================================================
// 땅 (Ground)
// ============================================================
let groundOffset = 0;

function drawGround() {
    const groundY = canvas.height - 40;

    ctx.strokeStyle = COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.stroke();

    // 지면 텍스처 (작은 점과 선)
    ctx.fillStyle = '#999';
    for (let i = 0; i < canvas.width + 20; i += 30) {
        const x = ((i - groundOffset) % (canvas.width + 20) + canvas.width + 20) % (canvas.width + 20);
        ctx.fillRect(x, groundY + 4, 8, 1);
        ctx.fillRect(x + 15, groundY + 8, 5, 1);
        ctx.fillRect(x + 7, groundY + 14, 3, 1);
    }
}

// ============================================================
// 구름 (Clouds)
// ============================================================
let clouds = [];

function spawnCloud() {
    clouds.push({
        x: canvas.width + 50,
        y: 20 + Math.random() * 60,
        width: 40 + Math.random() * 30,
    });
}

function drawClouds() {
    ctx.fillStyle = '#e8e8e8';
    clouds.forEach(c => {
        const w = c.width;
        const h = w * 0.4;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(c.x - w * 0.25, c.y + 2, w * 0.3, h * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(c.x + w * 0.2, c.y + 1, w * 0.25, h * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
    });
}

// ============================================================
// 충돌 감지
// ============================================================
function checkCollision(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
}

// ============================================================
// 점수
// ============================================================
function updateScore() {
    if (frameCount % 4 === 0) {
        score++;
    }

    // 속도 점진적 증가
    gameSpeed = 5 + Math.floor(score / 100) * 0.5;
    if (gameSpeed > 14) gameSpeed = 14;

    scoreEl.textContent = String(score).padStart(5, '0');

    if (highScore > 0) {
        highScoreEl.textContent = 'HI ' + String(highScore).padStart(5, '0') + '  ';
    }
}

// ============================================================
// 게임 루프
// ============================================================
function resetGame() {
    score = 0;
    frameCount = 0;
    gameSpeed = 5;
    obstacles = [];
    clouds = [];
    spawnTimer = 0;
    groundOffset = 0;
    dino.reset();
}

function update() {
    frameCount++;

    // 공룡 업데이트
    dino.update();

    // 땅 스크롤
    groundOffset = (groundOffset + gameSpeed) % 300;

    // 장애물 스폰
    spawnTimer--;
    if (spawnTimer <= 0) {
        spawnObstacle();
        // 스폰 간격: 속도가 빠를수록 짧아짐
        const minGap = Math.max(40, 80 - gameSpeed * 3);
        const maxGap = minGap + 40;
        spawnTimer = minGap + Math.floor(Math.random() * (maxGap - minGap));
    }

    // 장애물 이동
    obstacles.forEach(ob => {
        ob.x -= gameSpeed;
        // 새 날개 애니메이션
        if (ob.kind === 'bird' && frameCount % 12 === 0) {
            ob.wingFrame = ob.wingFrame === 0 ? 1 : 0;
        }
    });

    // 화면 밖 장애물 제거
    obstacles = obstacles.filter(ob => ob.x + ob.width > -20);

    // 구름 스폰
    if (frameCount % 120 === 0) {
        spawnCloud();
    }
    clouds.forEach(c => { c.x -= gameSpeed * 0.3; });
    clouds = clouds.filter(c => c.x + c.width > -60);

    // 충돌 감지
    const dinoHitbox = dino.getHitbox();
    for (const ob of obstacles) {
        const obHitbox = { x: ob.x + 2, y: ob.y + 2, w: ob.width - 4, h: ob.height - 4 };
        if (checkCollision(dinoHitbox, obHitbox)) {
            gameOver();
            return;
        }
    }

    // 점수 업데이트
    updateScore();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawClouds();
    drawGround();

    // 장애물 그리기
    obstacles.forEach(ob => {
        if (ob.kind === 'bird') {
            drawBird(ob);
        } else {
            drawCactus(ob);
        }
    });

    // 공룡 그리기
    dino.draw();
}

function gameLoop() {
    if (state !== STATE.PLAYING) return;
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// ============================================================
// 게임 시작 / 종료
// ============================================================
function startGame() {
    resetGame();
    state = STATE.PLAYING;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    dino.reset();
    gameLoop();
}

function gameOver() {
    state = STATE.OVER;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('dinoHighScore', highScore);
    }

    finalScoreEl.textContent = String(score).padStart(5, '0');
    gameOverScreen.classList.remove('hidden');
}

// ============================================================
// 입력 처리
// ============================================================
const keys = {};

document.addEventListener('keydown', (e) => {
    if (keys[e.code]) return;
    keys[e.code] = true;

    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (state === STATE.IDLE || state === STATE.OVER) {
            startGame();
        } else if (state === STATE.PLAYING) {
            dino.jump();
        }
    }

    if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (state === STATE.PLAYING) {
            dino.duck(true);
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'ArrowDown') {
        dino.duck(false);
    }
});

// 모바일 터치
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (state === STATE.IDLE || state === STATE.OVER) {
        startGame();
    } else if (state === STATE.PLAYING) {
        dino.jump();
    }
});

startScreen.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startGame();
});

gameOverScreen.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startGame();
});

// 마우스 클릭 (시작/재시작)
startScreen.addEventListener('click', startGame);
gameOverScreen.addEventListener('click', startGame);

// --- 초기 화면 ---
dino.reset();
draw();
if (highScore > 0) {
    highScoreEl.textContent = 'HI ' + String(highScore).padStart(5, '0') + '  ';
}
