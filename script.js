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
    currentMouse: { x: 0, y: 0 },
    showTrail: true,
    showGrid: true
};

// 質量変換関数（スライダー値 → 実際の質量）
function sliderToMassA(sliderValue) {
    // スライダー 0-4 を 1000-5000 に変換
    // value=0 → 1000, value=1 → 2000, ..., value=4 → 5000
    return 1000 * (sliderValue + 1);
}

function sliderToMassB(sliderValue) {
    // スライダー 0-4 を 1-5 に変換
    // value=0 → 1, value=1 → 2, ..., value=4 → 5
    return sliderValue + 1;
}

// 惑星データ
let bodies = {
    A: {
        mass: 3000, // sliderValue=2 → 1000 * (2 + 1) = 3000
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 25, // 大きな質量に対応した半径
        color: '#FF5722',
        trail: [],
        active: true
    },
    B: {
        mass: 3, // sliderValue=2 → 2 + 1 = 3
        x: 150,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 10,
        color: '#2196F3',
        trail: [],
        active: true
    }
};

// 爆発エフェクトの状態
let explosion = {
    active: false,
    x: 0,
    y: 0,
    startTime: 0,
    duration: 1000 // 1秒間表示
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

// 惑星描画
function drawBody(body, label) {
    // アクティブでない場合は描画しない
    if (!body.active) return;

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

    // 惑星本体
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

// 爆発エフェクト描画
function drawExplosion() {
    if (!explosion.active) return;

    const elapsed = Date.now() - explosion.startTime;
    if (elapsed > explosion.duration) {
        explosion.active = false;
        return;
    }

    const progress = elapsed / explosion.duration;
    const pos = toCanvas(explosion.x, explosion.y);

    // 複数の同心円で爆発を表現
    const maxRadius = 80;
    const numCircles = 5;

    for (let i = 0; i < numCircles; i++) {
        const phase = (progress + i * 0.1) % 1;
        const radius = maxRadius * phase;
        const alpha = 1 - phase;

        ctx.strokeStyle = `rgba(255, ${100 + i * 30}, 0, ${alpha * 0.8})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    // 中心の明るい光
    const centralAlpha = 1 - progress;
    const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 40);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${centralAlpha})`);
    gradient.addColorStop(0.5, `rgba(255, 200, 0, ${centralAlpha * 0.7})`);
    gradient.addColorStop(1, 'rgba(255, 100, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 40, 0, Math.PI * 2);
    ctx.fill();
}

// 描画メインループ
function draw() {
    // 重心の座標を計算（両方の惑星がアクティブな場合のみ）
    if (bodies.A.active && bodies.B.active) {
        const cmX = (bodies.A.mass * bodies.A.x + bodies.B.mass * bodies.B.x) / (bodies.A.mass + bodies.B.mass);
        const cmY = (bodies.A.mass * bodies.A.y + bodies.B.mass * bodies.B.y) / (bodies.A.mass + bodies.B.mass);

        // カメラを重心に自動追従
        state.offsetX = canvas.width / 2 - cmX;
        state.offsetY = canvas.height / 2 + cmY;
    }

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    drawBody(bodies.A, 'A');
    drawBody(bodies.B, 'B');

    // 重心を描画（両方の惑星がアクティブな場合のみ）
    if (bodies.A.active && bodies.B.active) {
        const cmX = (bodies.A.mass * bodies.A.x + bodies.B.mass * bodies.B.x) / (bodies.A.mass + bodies.B.mass);
        const cmY = (bodies.A.mass * bodies.A.y + bodies.B.mass * bodies.B.y) / (bodies.A.mass + bodies.B.mass);
        const cmPos = toCanvas(cmX, cmY);
        ctx.fillStyle = '#00BCD4';
        ctx.beginPath();
        ctx.arc(cmPos.x, cmPos.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // 爆発エフェクト描画
    drawExplosion();
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
    // 両方の惑星がアクティブでない場合は更新しない
    if (!bodies.A.active || !bodies.B.active) return;

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

    // 衝突判定
    const dx = bodies.B.x - bodies.A.x;
    const dy = bodies.B.y - bodies.A.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < bodies.A.radius + bodies.B.radius) {
        // 衝突発生！
        const collisionX = (bodies.A.x * bodies.B.radius + bodies.B.x * bodies.A.radius) / (bodies.A.radius + bodies.B.radius);
        const collisionY = (bodies.A.y * bodies.B.radius + bodies.B.y * bodies.A.radius) / (bodies.A.radius + bodies.B.radius);

        explosion.active = true;
        explosion.x = collisionX;
        explosion.y = collisionY;
        explosion.startTime = Date.now();

        // 両方の惑星を非アクティブに
        bodies.A.active = false;
        bodies.B.active = false;

        // シミュレーションを停止
        state.running = false;
        elements.startBtn.disabled = false;
        elements.stopBtn.disabled = true;
    }

    // 軌道記録
    if (state.showTrail) {
        bodies.A.trail.push({ x: bodies.A.x, y: bodies.A.y });
        bodies.B.trail.push({ x: bodies.B.x, y: bodies.B.y });
    }
}

// パラメータ更新
function updateParameters() {
    const dx = bodies.B.x - bodies.A.x;
    const dy = bodies.B.y - bodies.A.y;
    const r = Math.sqrt(dx * dx + dy * dy);

    const vA = Math.sqrt(bodies.A.vx ** 2 + bodies.A.vy ** 2);
    const vB = Math.sqrt(bodies.B.vx ** 2 + bodies.B.vy ** 2);

    elements.massADisplay.textContent = bodies.A.mass.toFixed(0);
    elements.massBDisplay.textContent = bodies.B.mass.toFixed(0);
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

// 共通のドラッグ開始処理
function handleDragStart(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    const simPos = toSimulation(canvasX, canvasY);

    // 惑星Bのみドラッグ可能
    const distB = Math.sqrt((simPos.x - bodies.B.x) ** 2 + (simPos.y - bodies.B.y) ** 2);

    if (distB < bodies.B.radius) {
        state.dragging = 'B';
        state.dragStart = { x: bodies.B.x, y: bodies.B.y };
        state.currentMouse = { x: bodies.B.x, y: bodies.B.y };
    }
}

// 共通のドラッグ移動処理
function handleDragMove(clientX, clientY) {
    if (!state.dragging) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    const simPos = toSimulation(canvasX, canvasY);

    state.currentMouse = { x: simPos.x, y: simPos.y };

    const body = bodies[state.dragging];
    // ドラッグした矢印の長さをそのまま速度に（スケール調整）
    body.vx = (simPos.x - state.dragStart.x) * 0.05;
    body.vy = (simPos.y - state.dragStart.y) * 0.05;

    updateParameters();
}

// 共通のドラッグ終了処理
function handleDragEnd() {
    if (state.dragging) {
        elements.instructions.classList.add('hidden');
    }
    state.dragging = null;
}

// マウスイベント
canvas.addEventListener('mousedown', (e) => {
    handleDragStart(e.clientX, e.clientY);
});

canvas.addEventListener('mousemove', (e) => {
    handleDragMove(e.clientX, e.clientY);
});

canvas.addEventListener('mouseup', () => {
    handleDragEnd();
});

canvas.addEventListener('mouseleave', () => {
    handleDragEnd();
});

// タッチイベント
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // スクロールを防止
    if (e.touches.length > 0) {
        handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // スクロールを防止
    if (e.touches.length > 0) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleDragEnd();
});

canvas.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    handleDragEnd();
});

// UI イベント
elements.massA.addEventListener('input', (e) => {
    const sliderValue = parseFloat(e.target.value);
    bodies.A.mass = sliderToMassA(sliderValue);
    elements.massAValue.textContent = bodies.A.mass.toFixed(0);
    // 半径は質量に応じて設定（1000→20, 5000→35程度）
    bodies.A.radius = 15 + (bodies.A.mass / 1000) * 4;
    updateParameters();
});

elements.massB.addEventListener('input', (e) => {
    const sliderValue = parseFloat(e.target.value);
    bodies.B.mass = sliderToMassB(sliderValue);
    elements.massBValue.textContent = bodies.B.mass.toFixed(0);
    // 半径は質量に応じて設定（1→8, 5→12程度）
    bodies.B.radius = 7 + bodies.B.mass;
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

    // 現在の質量を保存
    const currentMassA = bodies.A.mass;
    const currentMassB = bodies.B.mass;

    // 位置と速度をリセット
    bodies.A = JSON.parse(JSON.stringify(initialState.A));
    bodies.B = JSON.parse(JSON.stringify(initialState.B));

    // 質量を現在の値に戻す
    bodies.A.mass = currentMassA;
    bodies.B.mass = currentMassB;

    // 半径を質量に応じて再計算
    bodies.A.radius = 15 + (bodies.A.mass / 1000) * 4;
    bodies.B.radius = 7 + bodies.B.mass;

    // 惑星をアクティブに
    bodies.A.active = true;
    bodies.B.active = true;

    // 爆発エフェクトをリセット
    explosion.active = false;

    // 軌道をクリア
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

// 初期化
window.addEventListener('load', () => {
    resizeCanvas();
    updateParameters();
    animate();
});

window.addEventListener('resize', resizeCanvas);
