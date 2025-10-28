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
    radiusA: document.getElementById('radius-a'),
    radiusB: document.getElementById('radius-b'),
    speed: document.getElementById('speed'),
    massAValue: document.getElementById('mass-a-value'),
    massBValue: document.getElementById('mass-b-value'),
    radiusAValue: document.getElementById('radius-a-value'),
    radiusBValue: document.getElementById('radius-b-value'),
    massADisplay: document.getElementById('mass-a-display'),
    massBDisplay: document.getElementById('mass-b-display'),
    speedValue: document.getElementById('speed-value'),
    startBtn: document.getElementById('start-btn'),
    stopBtn: document.getElementById('stop-btn'),
    resetBtn: document.getElementById('reset-btn'),
    showTrail: document.getElementById('show-trail'),
    showGrid: document.getElementById('show-grid'),
    showForce: document.getElementById('show-force'),
    enableCollision: document.getElementById('enable-collision'),
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
    showGrid: true,
    showForce: true,
    enableCollision: true
};

// 質量変換関数（スライダー値 → 実際の質量）
// 線形スケール: 1 〜 100
function sliderToMass(sliderValue) {
    // sliderValue: 1 〜 100 → mass: 1 〜 100
    return sliderValue;
}

// 惑星データを初期化する関数
function initializeBodies(massA, massB, radiusA, radiusB) {
    // 惑星Bを原点から150の位置に配置
    const xB = 150;
    // 重心が原点になるように惑星Aの位置を計算
    const xA = -massB * xB / massA;

    return {
        A: {
            mass: massA,
            x: xA,
            y: 0,
            vx: 0,
            vy: 0,
            radius: radiusA,
            color: '#FF5722',
            trail: [],
            active: true
        },
        B: {
            mass: massB,
            x: xB,
            y: 0,
            vx: 0,
            vy: 0,
            radius: radiusB,
            color: '#2196F3',
            trail: [],
            active: true
        }
    };
}

// 惑星データ（初期質量: A=50, B=50, 初期半径: A=15, B=15）
let bodies = initializeBodies(50, 50, 15, 15);

// 爆発エフェクトの状態
let explosion = {
    active: false,
    x: 0,
    y: 0,
    startTime: 0,
    duration: 1000 // 1秒間表示
};

// 初期状態は動的に生成するため保存不要（質量に応じて変わる）

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

// 力ベクトル表示
function drawForceVectors() {
    if (!state.showForce) return;
    if (!bodies.A.active || !bodies.B.active) return;

    // AがBから受ける力を計算
    const dx = bodies.B.x - bodies.A.x;
    const dy = bodies.B.y - bodies.A.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    if (dist < 0.1) return;

    const forceScale = 50; // 表示用のスケール

    // 惑星Aに働く力
    const forceA = state.G * bodies.B.mass / distSq;
    const posA = toCanvas(bodies.A.x, bodies.A.y);
    const forceEndA = toCanvas(
        bodies.A.x + (dx / dist) * forceA * forceScale,
        bodies.A.y + (dy / dist) * forceA * forceScale
    );
    drawArrow(posA.x, posA.y, forceEndA.x, forceEndA.y, '#FF00FF', 'F', 'A');

    // 惑星Bに働く力（反対方向）
    const forceB = state.G * bodies.A.mass / distSq;
    const posB = toCanvas(bodies.B.x, bodies.B.y);
    const forceEndB = toCanvas(
        bodies.B.x - (dx / dist) * forceB * forceScale,
        bodies.B.y - (dy / dist) * forceB * forceScale
    );
    drawArrow(posB.x, posB.y, forceEndB.x, forceEndB.y, '#FF00FF', 'F', 'B');
}

// ベクトル描画ヘルパー関数
function drawArrow(fromX, fromY, toX, toY, color, mainLabel, subLabel) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 3) return;

    // 矢印の線
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // 矢印の頭
    const angle = Math.atan2(dy, dx);
    const arrowSize = 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
        toX - arrowSize * Math.cos(angle - Math.PI / 6),
        toY - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        toX - arrowSize * Math.cos(angle + Math.PI / 6),
        toY - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();

    // ラベル（下付き文字対応）
    if (mainLabel) {
        ctx.fillStyle = color;

        // メイン文字（イタリック）
        ctx.font = 'italic bold 14px Georgia, serif';
        ctx.textAlign = 'left';
        const mainWidth = ctx.measureText(mainLabel).width;
        const labelX = toX - mainWidth / 2 - 3;
        const labelY = toY - 15;
        ctx.fillText(mainLabel, labelX, labelY);

        // 下付き文字
        if (subLabel) {
            ctx.font = 'italic bold 10px Georgia, serif';
            ctx.fillText(subLabel, labelX + mainWidth, labelY + 3);
        }
    }
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
    // カメラは常にcanvasの中心（重心座標系の原点）
    state.offsetX = canvas.width / 2;
    state.offsetY = canvas.height / 2;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    drawBody(bodies.A, 'A');
    drawBody(bodies.B, 'B');

    // 重心を描画（常に原点 = canvas中心）
    if (bodies.A.active && bodies.B.active) {
        const cmPos = toCanvas(0, 0);
        ctx.fillStyle = '#00BCD4';
        ctx.beginPath();
        ctx.arc(cmPos.x, cmPos.y, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // 力ベクトル表示
    drawForceVectors();

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

    // 重心を計算
    const cmX = (bodies.A.mass * bodies.A.x + bodies.B.mass * bodies.B.x) / (bodies.A.mass + bodies.B.mass);
    const cmY = (bodies.A.mass * bodies.A.y + bodies.B.mass * bodies.B.y) / (bodies.A.mass + bodies.B.mass);

    // 重心を原点とする座標系に変換
    bodies.A.x -= cmX;
    bodies.A.y -= cmY;
    bodies.B.x -= cmX;
    bodies.B.y -= cmY;

    // 衝突判定（有効化されている場合のみ）
    if (state.enableCollision) {
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
    }

    // 軌道記録（重心座標系で記録）
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
    const newMassA = sliderToMass(sliderValue);

    // 質量変更時は重心を維持するために位置を再計算
    if (!state.running) {
        const currentVxA = bodies.A.vx;
        const currentVyA = bodies.A.vy;
        const currentVxB = bodies.B.vx;
        const currentVyB = bodies.B.vy;

        bodies = initializeBodies(newMassA, bodies.B.mass, bodies.A.radius, bodies.B.radius);

        // 速度は保持
        bodies.A.vx = currentVxA;
        bodies.A.vy = currentVyA;
        bodies.B.vx = currentVxB;
        bodies.B.vy = currentVyB;
    } else {
        // シミュレーション実行中は質量のみ変更（位置は物理演算で補正される）
        bodies.A.mass = newMassA;
    }

    elements.massAValue.textContent = newMassA.toFixed(0);
    updateParameters();
});

elements.massB.addEventListener('input', (e) => {
    const sliderValue = parseFloat(e.target.value);
    const newMassB = sliderToMass(sliderValue);

    // 質量変更時は重心を維持するために位置を再計算
    if (!state.running) {
        const currentVxA = bodies.A.vx;
        const currentVyA = bodies.A.vy;
        const currentVxB = bodies.B.vx;
        const currentVyB = bodies.B.vy;

        bodies = initializeBodies(bodies.A.mass, newMassB, bodies.A.radius, bodies.B.radius);

        // 速度は保持
        bodies.A.vx = currentVxA;
        bodies.A.vy = currentVyA;
        bodies.B.vx = currentVxB;
        bodies.B.vy = currentVyB;
    } else {
        // シミュレーション実行中は質量のみ変更（位置は物理演算で補正される）
        bodies.B.mass = newMassB;
    }

    elements.massBValue.textContent = newMassB.toFixed(0);
    updateParameters();
});

elements.radiusA.addEventListener('input', (e) => {
    const newRadiusA = parseFloat(e.target.value);
    bodies.A.radius = newRadiusA;
    elements.radiusAValue.textContent = newRadiusA.toFixed(0);
});

elements.radiusB.addEventListener('input', (e) => {
    const newRadiusB = parseFloat(e.target.value);
    bodies.B.radius = newRadiusB;
    elements.radiusBValue.textContent = newRadiusB.toFixed(0);
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

    // 現在の質量と半径を保存
    const currentMassA = bodies.A.mass;
    const currentMassB = bodies.B.mass;
    const currentRadiusA = bodies.A.radius;
    const currentRadiusB = bodies.B.radius;

    // 現在の質量と半径で重心原点の初期状態を再生成
    bodies = initializeBodies(currentMassA, currentMassB, currentRadiusA, currentRadiusB);

    // 爆発エフェクトをリセット
    explosion.active = false;

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

elements.showForce.addEventListener('change', (e) => {
    state.showForce = e.target.checked;
});

elements.enableCollision.addEventListener('change', (e) => {
    state.enableCollision = e.target.checked;
});

// 初期化
window.addEventListener('load', () => {
    resizeCanvas();
    updateParameters();
    animate();
});

window.addEventListener('resize', resizeCanvas);
