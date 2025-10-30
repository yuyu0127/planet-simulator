// キャンバスと描画コンテキスト
const canvas = document.getElementById('simulation-canvas');
const ctx = canvas.getContext('2d');

// UI要素
const elements = {
    posB: document.getElementById('pos-b'),
    velB: document.getElementById('vel-b'),
    distance: document.getElementById('distance'),
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
    showForce: document.getElementById('show-force'),
    enableCollision: document.getElementById('enable-collision'),
    instructions: document.getElementById('instructions'),
    zoomIn: document.getElementById('zoom-in'),
    zoomOut: document.getElementById('zoom-out'),
    zoomReset: document.getElementById('zoom-reset')
};

// 物理定数（単位系: kg, m, 年）
const CONSTANTS = {
    G: 6.644e4, // 重力定数 [m³/(kg·年²)]
    SUN_MASS: 1.989e30, // 太陽の質量 [kg]
    MARS_MASS: 6.39e23, // 火星の質量 [kg]
    AU: 1.496e11, // 天文単位 [m]
    SUN_RADIUS: 6.96e8, // 太陽の半径 [m]
    MARS_RADIUS: 3.39e6, // 火星の半径 [m]
    MARS_ORBIT: 2.279e11, // 火星の軌道長半径 [m]
    MARS_PERIHELION: 2.066e11, // 火星の近日点距離 [m]
    MARS_ECCENTRICITY: 0.0934 // 火星の軌道離心率
};

// シミュレーション状態
let state = {
    running: false,
    wasRunning: false, // ドラッグ前に実行中だったかどうか
    scale: 65, // 座標系のスケール係数（10^11 m → ピクセル）
    offsetX: 0,
    offsetY: 0,
    G: CONSTANTS.G, // 重力定数
    dt: 0.0005, // タイムステップ [年]（約4.4時間）
    softening: 1e9, // 軟化パラメータ [m]（近接時の計算安定化）
    speedMultiplier: 1,
    dragging: null,
    dragStart: { x: 0, y: 0 },
    currentMouse: { x: 0, y: 0 },
    showTrail: true,
    showGrid: true,
    showForce: true,
    enableCollision: true,
    displayScale: 1e-11 // 表示用スケール（m → 10^11 m）
};

// 質量から表示用半径を計算
// 実際の半径は軌道に比べて小さすぎるため、表示用に拡大
function calculateDisplayRadius(mass, actualRadius) {
    // 実際の半径を使用し、表示可能なサイズにスケーリング
    // 太陽: 基準サイズ、火星: 太陽との比率を維持しつつ見やすく
    if (mass > 1e29) {
        // 太陽
        return actualRadius * state.displayScale * 10; // 拡大して表示
    } else {
        // 火星
        return actualRadius * state.displayScale * 50; // さらに拡大して表示
    }
}

// 惑星データを初期化する関数
function initializeBodies(massA, massB) {
    // 太陽（A）は原点に固定
    // 火星（B）を近日点距離に配置
    const xB = CONSTANTS.MARS_PERIHELION; // [m]

    // 近日点での速度を計算（垂直方向）
    // v_p = sqrt(G * M_sun * (1 + e) / (a * (1 - e)))
    const a = CONSTANTS.MARS_ORBIT;
    const e = CONSTANTS.MARS_ECCENTRICITY;
    const vyB = Math.sqrt(CONSTANTS.G * massA * (1 + e) / (a * (1 - e)));

    return {
        A: {
            mass: massA,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            actualRadius: CONSTANTS.SUN_RADIUS,
            radius: calculateDisplayRadius(massA, CONSTANTS.SUN_RADIUS),
            color: '#FDB813', // 太陽の色（黄色）
            trail: [],
            active: true
        },
        B: {
            mass: massB,
            x: xB,
            y: 0,
            vx: 0,
            vy: vyB,
            actualRadius: CONSTANTS.MARS_RADIUS,
            radius: calculateDisplayRadius(massB, CONSTANTS.MARS_RADIUS),
            color: '#CD5C5C', // 火星の色（赤系）
            trail: [],
            active: true
        }
    };
}

// 惑星データ（実際の質量）
let bodies = initializeBodies(CONSTANTS.SUN_MASS, CONSTANTS.MARS_MASS);

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

// 座標変換（シミュレーション座標[m] → キャンバス座標[px]）
function toCanvas(x, y) {
    // x, y は m 単位 → 10^11 m 単位に変換してからスケール
    return {
        x: x * state.displayScale * state.scale + state.offsetX,
        y: -y * state.displayScale * state.scale + state.offsetY
    };
}

// 座標変換（キャンバス座標[px] → シミュレーション座標[m]）
function toSimulation(x, y) {
    return {
        x: (x - state.offsetX) / (state.scale * state.displayScale),
        y: -(y - state.offsetY) / (state.scale * state.displayScale)
    };
}

// グリッド描画
function drawGrid() {
    if (!state.showGrid) return;

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;

    const gridSize = 0.5e11; // 0.5×10^11 m (約0.33 AU)
    const startX = -state.offsetX / (state.scale * state.displayScale);
    const startY = -state.offsetY / (state.scale * state.displayScale);
    const endX = (canvas.width - state.offsetX) / (state.scale * state.displayScale);
    const endY = (canvas.height - state.offsetY) / (state.scale * state.displayScale);

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

    // 惑星本体（半径をスケールしてピクセル単位に変換）
    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, body.radius * state.scale, 0, Math.PI * 2);
    ctx.fill();

    // 縁取り
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ラベル（太陽の場合は黒文字、火星の場合は白文字）
    ctx.fillStyle = label === '太陽' ? '#000' : '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, pos.x, pos.y);
}

// 力ベクトル表示
function drawForceVectors() {
    if (!state.showForce) return;
    if (!bodies.A.active || !bodies.B.active) return;

    // 火星がBから受ける力を計算（軟化パラメータ適用）
    const dx = bodies.B.x - bodies.A.x;
    const dy = bodies.B.y - bodies.A.y;
    const distSq = dx * dx + dy * dy;
    const softenedDistSq = distSq + state.softening * state.softening;
    const dist = Math.sqrt(softenedDistSq);

    const forceScale = 0.2; // 表示用のスケール

    // 火星（B）に働く力（太陽からの引力）
    const forceB = state.G * bodies.A.mass / softenedDistSq;
    const posB = toCanvas(bodies.B.x, bodies.B.y);
    const forceEndB = toCanvas(
        bodies.B.x - (dx / dist) * forceB * forceScale,
        bodies.B.y - (dy / dist) * forceB * forceScale
    );
    drawArrow(posB.x, posB.y, forceEndB.x, forceEndB.y, '#FF00FF', 'F', '');
}

// ドラッグ中の速度矢印表示
function drawDragArrow() {
    if (!state.dragging) return;

    const body = bodies[state.dragging];
    const posStart = toCanvas(body.x, body.y);
    const posCurrent = toCanvas(state.currentMouse.x, state.currentMouse.y);

    // ドラッグした方向と逆向きの矢印を描画
    const dx = posStart.x - posCurrent.x;
    const dy = posStart.y - posCurrent.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < 5) return;

    const arrowEndX = posStart.x + dx;
    const arrowEndY = posStart.y + dy;

    // 矢印の線
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(posStart.x, posStart.y);
    ctx.lineTo(arrowEndX, arrowEndY);
    ctx.stroke();

    // 矢印の頭
    const angle = Math.atan2(dy, dx);
    const arrowSize = 15;
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.moveTo(arrowEndX, arrowEndY);
    ctx.lineTo(
        arrowEndX - arrowSize * Math.cos(angle - Math.PI / 6),
        arrowEndY - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        arrowEndX - arrowSize * Math.cos(angle + Math.PI / 6),
        arrowEndY - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
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
    // カメラは常にcanvasの中心（太陽の位置＝原点）
    state.offsetX = canvas.width / 2;
    state.offsetY = canvas.height / 2;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();
    drawBody(bodies.A, '太陽');
    drawBody(bodies.B, '火星');

    // 力ベクトル表示
    drawForceVectors();

    // ドラッグ中の速度矢印表示
    drawDragArrow();

    // 爆発エフェクト描画
    drawExplosion();
}

// 重力加速度計算（軟化パラメータ適用）
function calculateAcceleration(body1, body2) {
    const dx = body2.x - body1.x;
    const dy = body2.y - body1.y;
    const distSq = dx * dx + dy * dy;

    // 軟化パラメータを追加（近接時の発散を防ぐ）
    const softenedDistSq = distSq + state.softening * state.softening;
    const dist = Math.sqrt(softenedDistSq);

    // 軟化距離を使った力の計算
    const force = state.G * body2.mass / softenedDistSq;
    const ax = force * dx / dist;
    const ay = force * dy / dist;

    return { ax, ay };
}

// 物理シミュレーション（Velocity Verlet法）
function updatePhysics() {
    // 両方の惑星がアクティブでない場合は更新しない
    if (!bodies.A.active || !bodies.B.active) return;

    const dt = state.dt * state.speedMultiplier;

    // 火星の加速度計算（太陽からの重力）
    const accB = calculateAcceleration(bodies.B, bodies.A);

    // 火星の速度更新（半ステップ）
    bodies.B.vx += accB.ax * dt / 2;
    bodies.B.vy += accB.ay * dt / 2;

    // 火星の位置更新
    bodies.B.x += bodies.B.vx * dt;
    bodies.B.y += bodies.B.vy * dt;

    // 新しい加速度計算
    const accB2 = calculateAcceleration(bodies.B, bodies.A);

    // 火星の速度更新（残り半ステップ）
    bodies.B.vx += accB2.ax * dt / 2;
    bodies.B.vy += accB2.ay * dt / 2;

    // 太陽は完全に固定（位置も速度も更新しない）
    // bodies.A.x = 0;
    // bodies.A.y = 0;
    // bodies.A.vx = 0;
    // bodies.A.vy = 0;

    // 衝突判定（有効化されている場合のみ）
    if (state.enableCollision) {
        const dx = bodies.B.x - bodies.A.x;
        const dy = bodies.B.y - bodies.A.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 実際の半径で判定
        const radiusA = bodies.A.actualRadius;
        const radiusB = bodies.B.actualRadius;

        if (distance < radiusA + radiusB) {
            // 衝突発生！
            const collisionX = (bodies.A.x * radiusB + bodies.B.x * radiusA) / (radiusA + radiusB);
            const collisionY = (bodies.A.y * radiusB + bodies.B.y * radiusA) / (radiusA + radiusB);

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

    // 軌道記録（火星のみ）
    if (state.showTrail) {
        bodies.B.trail.push({ x: bodies.B.x, y: bodies.B.y });
    }
}

// パラメータ更新
function updateParameters() {
    const dx = bodies.B.x - bodies.A.x;
    const dy = bodies.B.y - bodies.A.y;
    const r = Math.sqrt(dx * dx + dy * dy);

    const vB = Math.sqrt(bodies.B.vx ** 2 + bodies.B.vy ** 2);

    // 質量を科学的記法で表示
    elements.massADisplay.textContent = (bodies.A.mass / 1e30).toFixed(2) + '×10³⁰ kg';
    elements.massBDisplay.textContent = (bodies.B.mass / 1e23).toFixed(2) + '×10²³ kg';

    // 位置を AU 単位で表示
    elements.posB.textContent = `(${(bodies.B.x / CONSTANTS.AU).toFixed(3)}, ${(bodies.B.y / CONSTANTS.AU).toFixed(3)}) AU`;

    // 速度を km/s 単位で表示（年単位 → 秒単位に変換）
    const vB_ms = vB / 31557600; // m/年 → m/s
    elements.velB.textContent = (vB_ms / 1000).toFixed(2) + ' km/s';

    // 距離を AU 単位で表示
    elements.distance.textContent = (r / CONSTANTS.AU).toFixed(3) + ' AU';
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

    // 火星（B）のみドラッグ可能
    const distB = Math.sqrt((simPos.x - bodies.B.x) ** 2 + (simPos.y - bodies.B.y) ** 2);

    // 表示用の半径で判定（クリックしやすくするため）
    const radiusB = bodies.B.radius / (state.scale * state.displayScale);

    if (distB < radiusB) {
        state.dragging = 'B';
        state.dragStart = { x: bodies.B.x, y: bodies.B.y };
        state.currentMouse = { x: bodies.B.x, y: bodies.B.y };

        // シミュレーションを一時停止
        if (state.running) {
            state.wasRunning = true;
            state.running = false;
            elements.startBtn.disabled = false;
            elements.stopBtn.disabled = true;
        } else {
            state.wasRunning = false;
        }
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

    // 速度はまだ設定しない（ドラッグ終了時に設定）
    // ここでは矢印の表示のためにcurrentMouseを更新するだけ
}

// 共通のドラッグ終了処理
function handleDragEnd() {
    if (state.dragging) {
        const body = bodies[state.dragging];

        // ドラッグした方向と逆向きに速度を直接設定
        body.vx = -(state.currentMouse.x - state.dragStart.x);
        body.vy = -(state.currentMouse.y - state.dragStart.y);

        updateParameters();

        // シミュレーションを自動開始（初回でも再生）
        state.running = true;
        elements.startBtn.disabled = true;
        elements.stopBtn.disabled = false;

        elements.instructions.classList.add('hidden');
    }
    state.dragging = null;
    state.wasRunning = false;
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
    // スライダー値を実際の質量に変換（値×10^29 kg）
    const newMassA = sliderValue * 1e29; // kg

    // 太陽の質量と半径のみ変更（位置は常に原点）
    bodies.A.mass = newMassA;
    bodies.A.radius = calculateDisplayRadius(newMassA, CONSTANTS.SUN_RADIUS);
    bodies.A.x = 0;
    bodies.A.y = 0;
    bodies.A.vx = 0;
    bodies.A.vy = 0;

    elements.massAValue.textContent = (newMassA / 1e30).toFixed(2) + '×10³⁰';
    updateParameters();
});

elements.massB.addEventListener('input', (e) => {
    const sliderValue = parseFloat(e.target.value);
    // スライダー値を実際の質量に変換（値×10^22 kg）
    const newMassB = sliderValue * 1e22; // kg

    // 質量変更時、位置と速度は保持
    if (!state.running) {
        const currentVxB = bodies.B.vx;
        const currentVyB = bodies.B.vy;
        const currentXB = bodies.B.x;
        const currentYB = bodies.B.y;

        bodies.B.mass = newMassB;
        bodies.B.actualRadius = CONSTANTS.MARS_RADIUS * (sliderValue / 6.39);
        bodies.B.radius = calculateDisplayRadius(newMassB, bodies.B.actualRadius);

        // 位置と速度は保持
        bodies.B.x = currentXB;
        bodies.B.y = currentYB;
        bodies.B.vx = currentVxB;
        bodies.B.vy = currentVyB;
    } else {
        // シミュレーション実行中は質量と半径を変更
        bodies.B.mass = newMassB;
        bodies.B.actualRadius = CONSTANTS.MARS_RADIUS * (sliderValue / 6.39);
        bodies.B.radius = calculateDisplayRadius(newMassB, bodies.B.actualRadius);
    }

    elements.massBValue.textContent = (newMassB / 1e23).toFixed(2) + '×10²³';
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

    // 初期状態を再生成
    bodies = initializeBodies(currentMassA, currentMassB);

    // 爆発エフェクトをリセット
    explosion.active = false;

    elements.instructions.classList.remove('hidden');
    updateParameters();
});

elements.showTrail.addEventListener('change', (e) => {
    state.showTrail = e.target.checked;
    if (!state.showTrail) {
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

// ズームコントロール
elements.zoomIn.addEventListener('click', () => {
    // 拡大（スケールを増やす）
    state.scale = Math.min(state.scale * 1.2, 200);
});

elements.zoomOut.addEventListener('click', () => {
    // 縮小（スケールを減らす）
    state.scale = Math.max(state.scale / 1.2, 10);
});

elements.zoomReset.addEventListener('click', () => {
    // リセット（初期値50に戻す）
    state.scale = 50;
});

// 初期化
window.addEventListener('load', () => {
    resizeCanvas();
    updateParameters();
    animate();
});

window.addEventListener('resize', resizeCanvas);
