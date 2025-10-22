// キャンバスと描画コンテキスト
const canvas = document.getElementById('simulation-canvas');
const ctx = canvas.getContext('2d');

// UI要素
const elements = {
    posA: document.getElementById('pos-a'),
    posB: document.getElementById('pos-b'),
    velA: document.getElementById('vel-a'),
    velB: document.getElementById('vel-b'),
    semiMajor: document.getElementById('semi-major'),
    semiMinor: document.getElementById('semi-minor'),
    distance: document.getElementById('distance'),
    period: document.getElementById('period'),
    massA: document.getElementById('mass-a'),
    massB: document.getElementById('mass-b'),
    speed: document.getElementById('speed'),
    massAValue: document.getElementById('mass-a-value'),
    massBValue: document.getElementById('mass-b-value'),
    massADisplay: document.getElementById('mass-a-display'),
    massBDisplay: document.getElementById('mass-b-display'),
    speedValue: document.getElementById('speed-value'),
    startBtn: document.getElementById('start-btn'),
    stopBtn: document.getElementById('stop-btn'),
    resetBtn: document.getElementById('reset-btn'),
    showTrail: document.getElementById('show-trail'),
    showGrid: document.getElementById('show-grid'),
    followCM: document.getElementById('follow-cm'),
    instructions: document.getElementById('instructions')
};

// シミュレーション状態
let state = {
    running: false,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    G: 100, // 重力定数（調整済み）
    dt: 0.016, // タイムステップ
    speedMultiplier: 1,
    dragging: null,
    dragStart: { x: 0, y: 0 },
    showTrail: true,
    showGrid: true,
    followCM: false
};

// 質量変換関数（スライダー値 → 実際の質量）
function sliderToMass(sliderValue) {
    // スライダー 0-100 を 1-10000 の指数スケールに変換
    // value=0 → 1, value=25 → 10, value=50 → 100, value=75 → 1000, value=100 → 10000
    return Math.pow(10, sliderValue / 25);
}

// 質点データ
let bodies = {
    A: {
        mass: 100, // sliderValue=50 → 10^(50/25) = 100
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 15,
        color: '#FF5722',
        trail: []
    },
    B: {
        mass: 100, // sliderValue=50 → 10^(50/25) = 100
        x: 150,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 15,
        color: '#2196F3',
        trail: []
    }
};

// 初期位置を保存
const initialState = JSON.parse(JSON.stringify(bodies));

// キャンバスサイズ調整
function resizeCanvas() {
    const panel = document.querySelector('.canvas-panel');
    canvas.width = panel.clientWidth - 20;
    canvas.height = panel.clientHeight - 20;
    state.offsetX = canvas.width / 2;
    state.offsetY = canvas.height / 2;
}

// 座標変換（シミュレーション座標 → キャンバス座標）
function toCanvas(x, y) {
    return {
        x: x + state.offsetX,
        y: -y + state.offsetY
    };
}

// 座標変換（キャンバス座標 → シミュレーション座標）
function toSimulation(x, y) {
    return {
        x: x - state.offsetX,
        y: -(y - state.offsetY)
    };
}

// グリッド描画
function drawGrid() {
    if (!state.showGrid) return;

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;

    const gridSize = 50;
    const startX = -state.offsetX;
    const startY = -state.offsetY;
    const endX = canvas.width - state.offsetX;
    const endY = canvas.height - state.offsetY;

    // 垂直線
    for (let x = Math.floor(startX / gridSize) * gridSize; x <= endX; x += gridSize) {
        const canvasPos = toCanvas(x, 0);
        ctx.beginPath();
        ctx.moveTo(canvasPos.x, 0);
        ctx.lineTo(canvasPos.x, canvas.height);
        ctx.stroke();
    }

    // 水平線
    for (let y = Math.floor(startY / gridSize) * gridSize; y <= endY; y += gridSize) {
        const canvasPos = toCanvas(0, y);
        ctx.beginPath();
        ctx.moveTo(0, canvasPos.y);
        ctx.lineTo(canvas.width, canvasPos.y);
        ctx.stroke();
    }

    // 軸を強調
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;

    const origin = toCanvas(0, 0);
    // X軸
    ctx.beginPath();
    ctx.moveTo(0, origin.y);
    ctx.lineTo(canvas.width, origin.y);
    ctx.stroke();

    // Y軸
    ctx.beginPath();
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, canvas.height);
    ctx.stroke();
}

// 質点描画
function drawBody(body, label) {
    const pos = toCanvas(body.x, body.y);

    // 軌道描画
    if (state.showTrail && body.trail.length > 1) {
        ctx.strokeStyle = body.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        const firstPoint = toCanvas(body.trail[0].x, body.trail[0].y);
        ctx.moveTo(firstPoint.x, firstPoint.y);
        for (let i = 1; i < body.trail.length; i++) {
            const point = toCanvas(body.trail[i].x, body.trail[i].y);
            ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // 質点本体
    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, body.radius, 0, Math.PI * 2);
    ctx.fill();

    // 縁取り
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ラベル
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, pos.x, pos.y);
}

// 速度ベクトル描画
function drawVelocityArrow(body, label) {
    if (state.dragging !== label) return;

    const pos = toCanvas(body.x, body.y);
    const arrowEnd = toCanvas(
        body.x + body.vx * 10,
        body.y + body.vy * 10
    );

    const dx = arrowEnd.x - pos.x;
    const dy = arrowEnd.y - pos.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 5) return;

    // 矢印の線
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(arrowEnd.x, arrowEnd.y);
    ctx.stroke();

    // 矢印の頭
    const angle = Math.atan2(dy, dx);
    const arrowSize = 15;
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(arrowEnd.x, arrowEnd.y);
    ctx.lineTo(
        arrowEnd.x - arrowSize * Math.cos(angle - Math.PI / 6),
        arrowEnd.y - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        arrowEnd.x - arrowSize * Math.cos(angle + Math.PI / 6),
        arrowEnd.y - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
}

// 描画メインループ
function draw() {
    // 重心の座標を計算
    const cmX = (bodies.A.mass * bodies.A.x + bodies.B.mass * bodies.B.x) / (bodies.A.mass + bodies.B.mass);
    const cmY = (bodies.A.mass * bodies.A.y + bodies.B.mass * bodies.B.y) / (bodies.A.mass + bodies.B.mass);

    // 重心追従モードの場合、オフセットを調整
    if (state.followCM) {
        state.offsetX = canvas.width / 2 - cmX;
        state.offsetY = canvas.height / 2 + cmY;
    } else {
        // 通常モードでは中心に固定
        state.offsetX = canvas.width / 2;
        state.offsetY = canvas.height / 2;
    }

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    drawBody(bodies.A, 'A');
    drawBody(bodies.B, 'B');
    drawVelocityArrow(bodies.A, 'A');
    drawVelocityArrow(bodies.B, 'B');

    // 重心を描画
    const cmPos = toCanvas(cmX, cmY);
    ctx.fillStyle = '#00BCD4';
    ctx.beginPath();
    ctx.arc(cmPos.x, cmPos.y, 5, 0, Math.PI * 2);
    ctx.fill();
}

// 重力加速度計算
function calculateAcceleration(body1, body2) {
    const dx = body2.x - body1.x;
    const dy = body2.y - body1.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    if (dist < 0.1) return { ax: 0, ay: 0 };

    const force = state.G * body2.mass / distSq;
    const ax = force * dx / dist;
    const ay = force * dy / dist;

    return { ax, ay };
}

// 物理シミュレーション（Velocity Verlet法）
function updatePhysics() {
    const dt = state.dt * state.speedMultiplier;

    // 加速度計算
    const accA = calculateAcceleration(bodies.A, bodies.B);
    const accB = calculateAcceleration(bodies.B, bodies.A);

    // 速度更新（半ステップ）
    bodies.A.vx += accA.ax * dt / 2;
    bodies.A.vy += accA.ay * dt / 2;
    bodies.B.vx += accB.ax * dt / 2;
    bodies.B.vy += accB.ay * dt / 2;

    // 位置更新
    bodies.A.x += bodies.A.vx * dt;
    bodies.A.y += bodies.A.vy * dt;
    bodies.B.x += bodies.B.vx * dt;
    bodies.B.y += bodies.B.vy * dt;

    // 新しい加速度計算
    const accA2 = calculateAcceleration(bodies.A, bodies.B);
    const accB2 = calculateAcceleration(bodies.B, bodies.A);

    // 速度更新（残り半ステップ）
    bodies.A.vx += accA2.ax * dt / 2;
    bodies.A.vy += accA2.ay * dt / 2;
    bodies.B.vx += accB2.ax * dt / 2;
    bodies.B.vy += accB2.ay * dt / 2;

    // 軌道記録
    if (state.showTrail) {
        bodies.A.trail.push({ x: bodies.A.x, y: bodies.A.y });
        bodies.B.trail.push({ x: bodies.B.x, y: bodies.B.y });

        // 軌道の長さ制限
        if (bodies.A.trail.length > 1000) bodies.A.trail.shift();
        if (bodies.B.trail.length > 1000) bodies.B.trail.shift();
    }
}

// パラメータ更新
function updateParameters() {
    const dx = bodies.B.x - bodies.A.x;
    const dy = bodies.B.y - bodies.A.y;
    const r = Math.sqrt(dx * dx + dy * dy);

    const vA = Math.sqrt(bodies.A.vx ** 2 + bodies.A.vy ** 2);
    const vB = Math.sqrt(bodies.B.vx ** 2 + bodies.B.vy ** 2);

    elements.massADisplay.textContent = bodies.A.mass.toFixed(2);
    elements.massBDisplay.textContent = bodies.B.mass.toFixed(2);
    elements.posA.textContent = `(${bodies.A.x.toFixed(2)}, ${bodies.A.y.toFixed(2)})`;
    elements.posB.textContent = `(${bodies.B.x.toFixed(2)}, ${bodies.B.y.toFixed(2)})`;
    elements.velA.textContent = vA.toFixed(2);
    elements.velB.textContent = vB.toFixed(2);
    elements.distance.textContent = r.toFixed(2);

    // 軌道パラメータ（簡易計算）
    const mu = state.G * (bodies.A.mass + bodies.B.mass);
    const v = vA + vB; // 相対速度の近似
    const E = 0.5 * v * v - mu / r; // 比エネルギー

    if (E < 0) {
        const a = -mu / (2 * E);
        const period = 2 * Math.PI * Math.sqrt(a ** 3 / mu);
        const ecc = Math.sqrt(1 + 2 * E * (r * v) ** 2 / (mu * mu));
        const b = a * Math.sqrt(1 - ecc * ecc);

        elements.semiMajor.textContent = a.toFixed(2);
        elements.semiMinor.textContent = b.toFixed(2);
        elements.period.textContent = period.toFixed(2);
    } else {
        elements.semiMajor.textContent = '∞';
        elements.semiMinor.textContent = '∞';
        elements.period.textContent = '∞';
    }
}

// アニメーションループ
function animate() {
    if (state.running) {
        updatePhysics();
        updateParameters();
    }
    draw();
    requestAnimationFrame(animate);
}

// マウスイベント
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const simPos = toSimulation(mouseX, mouseY);

    // どちらの質点をクリックしたか判定
    const distA = Math.sqrt((simPos.x - bodies.A.x) ** 2 + (simPos.y - bodies.A.y) ** 2);
    const distB = Math.sqrt((simPos.x - bodies.B.x) ** 2 + (simPos.y - bodies.B.y) ** 2);

    if (distA < bodies.A.radius) {
        state.dragging = 'A';
        state.dragStart = { x: simPos.x, y: simPos.y };
    } else if (distB < bodies.B.radius) {
        state.dragging = 'B';
        state.dragStart = { x: simPos.x, y: simPos.y };
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!state.dragging) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const simPos = toSimulation(mouseX, mouseY);

    const body = bodies[state.dragging];
    body.vx = (simPos.x - state.dragStart.x) * 0.1;
    body.vy = (simPos.y - state.dragStart.y) * 0.1;

    updateParameters();
});

canvas.addEventListener('mouseup', () => {
    if (state.dragging) {
        elements.instructions.classList.add('hidden');
    }
    state.dragging = null;
});

canvas.addEventListener('mouseleave', () => {
    state.dragging = null;
});

// UI イベント
elements.massA.addEventListener('input', (e) => {
    const sliderValue = parseFloat(e.target.value);
    bodies.A.mass = sliderToMass(sliderValue);
    elements.massAValue.textContent = bodies.A.mass.toFixed(2);
    bodies.A.radius = Math.max(8, Math.min(30, 10 + Math.log10(bodies.A.mass) * 3));
    updateParameters();
});

elements.massB.addEventListener('input', (e) => {
    const sliderValue = parseFloat(e.target.value);
    bodies.B.mass = sliderToMass(sliderValue);
    elements.massBValue.textContent = bodies.B.mass.toFixed(2);
    bodies.B.radius = Math.max(8, Math.min(30, 10 + Math.log10(bodies.B.mass) * 3));
    updateParameters();
});

elements.speed.addEventListener('input', (e) => {
    state.speedMultiplier = parseFloat(e.target.value);
    elements.speedValue.textContent = e.target.value + 'x';
});

elements.startBtn.addEventListener('click', () => {
    state.running = true;
    elements.startBtn.disabled = true;
    elements.stopBtn.disabled = false;
    elements.instructions.classList.add('hidden');
});

elements.stopBtn.addEventListener('click', () => {
    state.running = false;
    elements.startBtn.disabled = false;
    elements.stopBtn.disabled = true;
});

elements.resetBtn.addEventListener('click', () => {
    state.running = false;
    elements.startBtn.disabled = false;
    elements.stopBtn.disabled = true;

    // 状態をリセット
    bodies.A = JSON.parse(JSON.stringify(initialState.A));
    bodies.B = JSON.parse(JSON.stringify(initialState.B));
    bodies.A.trail = [];
    bodies.B.trail = [];

    elements.instructions.classList.remove('hidden');
    updateParameters();
});

elements.showTrail.addEventListener('change', (e) => {
    state.showTrail = e.target.checked;
    if (!state.showTrail) {
        bodies.A.trail = [];
        bodies.B.trail = [];
    }
});

elements.showGrid.addEventListener('change', (e) => {
    state.showGrid = e.target.checked;
});

elements.followCM.addEventListener('change', (e) => {
    state.followCM = e.target.checked;
});

// 初期化
window.addEventListener('load', () => {
    resizeCanvas();
    updateParameters();
    animate();
});

window.addEventListener('resize', resizeCanvas);
