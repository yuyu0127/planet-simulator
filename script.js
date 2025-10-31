// キャンバスと描画コンテキスト
const canvas = document.getElementById('simulation-canvas');
const ctx = canvas.getContext('2d');

// UI要素
const elements = {
    time: document.getElementById('time'),
    posB: document.getElementById('pos-b'),
    velB: document.getElementById('vel-b'),
    distance: document.getElementById('distance'),
    period: document.getElementById('period'),
    semiMajor: document.getElementById('semi-major'),
    semiMinor: document.getElementById('semi-minor'),
    eccentricity: document.getElementById('eccentricity'),
    angle: document.getElementById('angle'),
    sinAngle: document.getElementById('sin-angle'),
    speed: document.getElementById('speed'),
    massADisplay: document.getElementById('mass-a-display'),
    massBDisplay: document.getElementById('mass-b-display'),
    speedValue: document.getElementById('speed-value'),
    massB: document.getElementById('mass-b'),
    massBValue: document.getElementById('mass-b-value'),
    initialDistance: document.getElementById('initial-distance'),
    initialDistanceValue: document.getElementById('initial-distance-value'),
    initialVelocity: document.getElementById('initial-velocity'),
    initialVelocityValue: document.getElementById('initial-velocity-value'),
    startBtn: document.getElementById('start-btn'),
    stopBtn: document.getElementById('stop-btn'),
    resetBtn: document.getElementById('reset-btn'),
    clearTrailBtn: document.getElementById('clear-trail-btn'),
    showTrail: document.getElementById('show-trail'),
    showGrid: document.getElementById('show-grid'),
    showForce: document.getElementById('show-force'),
    enableCollision: document.getElementById('enable-collision'),
    zoomIn: document.getElementById('zoom-in'),
    zoomOut: document.getElementById('zoom-out'),
    zoomReset: document.getElementById('zoom-reset')
};

// 物理定数（単位系: kg, m, 年）
const CONSTANTS = {
    G: 6.644e4, // 重力定数 [m³/(kg·年²)]
    SUN_MASS: 1.989e30, // 太陽の質量 [kg]
    MARS_MASS: 6.39e23, // 惑星の質量 [kg]（デフォルト値：火星）
    AU: 1.496e11, // 天文単位 [m]
    SUN_RADIUS: 6.96e8, // 太陽の半径 [m]
    MARS_RADIUS: 3.39e6, // 惑星の半径 [m]（デフォルト値：火星）
    MARS_ORBIT: 2.279e11, // 軌道長半径 [m]（デフォルト値：火星）
    MARS_PERIHELION: 2.066e11, // 近日点距離 [m]（デフォルト値：火星）
    MARS_ECCENTRICITY: 0.0934 // 軌道離心率（デフォルト値：火星）
};

// 太陽系惑星のプリセットデータ（最遠点での位置と速度）
const PLANET_PRESETS = {
    mercury: {
        name: '水星',
        mass: 3.3011e23, // kg
        radius: 2.4397e6, // m
        aphelion: 6.982e10, // m（最遠点）
        eccentricity: 0.2056
    },
    venus: {
        name: '金星',
        mass: 4.8675e24, // kg
        radius: 6.0518e6, // m
        aphelion: 1.0894e11, // m
        eccentricity: 0.0067
    },
    earth: {
        name: '地球',
        mass: 5.972e24, // kg
        radius: 6.371e6, // m
        aphelion: 1.521e11, // m
        eccentricity: 0.0167
    },
    mars: {
        name: '火星',
        mass: 6.39e23, // kg
        radius: 3.3895e6, // m
        aphelion: 2.492e11, // m
        eccentricity: 0.0934
    },
    jupiter: {
        name: '木星',
        mass: 1.8982e27, // kg
        radius: 6.9911e7, // m
        aphelion: 8.166e11, // m
        eccentricity: 0.0489
    },
    saturn: {
        name: '土星',
        mass: 5.6834e26, // kg
        radius: 5.8232e7, // m
        aphelion: 1.5145e12, // m
        eccentricity: 0.0565
    },
    uranus: {
        name: '天王星',
        mass: 8.6810e25, // kg
        radius: 2.5362e7, // m
        aphelion: 3.008e12, // m
        eccentricity: 0.0457
    },
    neptune: {
        name: '海王星',
        mass: 1.02413e26, // kg
        radius: 2.4622e7, // m
        aphelion: 4.54e12, // m
        eccentricity: 0.0113
    }
};

// シミュレーション状態
let state = {
    running: false,
    scale: 150, // 座標系のスケール係数（10^11 m → ピクセル）
    offsetX: 0,
    offsetY: 0,
    G: CONSTANTS.G, // 重力定数
    dt: 0.001, // タイムステップ [年]（解析解なので大きくても精度は完璧）
    speedMultiplier: 1,
    showTrail: true,
    showGrid: true,
    showForce: true,
    enableCollision: true,
    displayScale: 1e-11, // 表示用スケール（m → 10^11 m）
    elapsedTime: 0 // 経過時間 [年]
};

// 実際の半径から表示用半径を計算
function calculateDisplayRadius(actualRadius) {
    // そのまま実際の半径を使用（displayScaleで10^11 m単位に変換）
    return actualRadius * state.displayScale;
}

// 惑星データを初期化する関数
function initializeBodies(massA, massB, initialDistance, initialVelocity, planetRadius) {
    // 太陽（A）は原点に固定
    // 惑星（B）を指定された距離に配置
    const xB = initialDistance !== undefined ? initialDistance : CONSTANTS.MARS_PERIHELION; // [m]

    // 初速度が指定されていない場合は、近日点での速度を計算（垂直方向）
    // v_p = sqrt(G * (M_sun + m) * (1 + e) / (a * (1 - e)))
    // 換算質量を使用
    const a = CONSTANTS.MARS_ORBIT;
    const e = CONSTANTS.MARS_ECCENTRICITY;
    const mu = CONSTANTS.G * (massA + massB);
    const defaultVelocity = Math.sqrt(mu * (1 + e) / (a * (1 - e)));
    const vyB = initialVelocity !== undefined ? initialVelocity : defaultVelocity;

    const bodyRadius = planetRadius !== undefined ? planetRadius : CONSTANTS.MARS_RADIUS;

    return {
        A: {
            mass: massA,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            actualRadius: CONSTANTS.SUN_RADIUS,
            radius: calculateDisplayRadius(CONSTANTS.SUN_RADIUS),
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
            actualRadius: bodyRadius,
            radius: calculateDisplayRadius(bodyRadius),
            color: '#CD5C5C', // 惑星の色（赤系）
            trail: [],
            active: true
        }
    };
}

// 惑星データ（実際の質量）
let bodies = initializeBodies(CONSTANTS.SUN_MASS, CONSTANTS.MARS_MASS);

// 軌道要素（解析解用）
let orbit = {
    a: 0,          // 長半径 [m]（双曲線の場合は負）
    e: 0,          // 離心率
    omega: 0,      // 近点引数 [rad]
    M0: 0,         // 初期平均近点角 [rad]
    n: 0,          // 平均運動 [rad/年]（双曲線の場合は負）
    mu: 0,         // 標準重力パラメータ GM [m³/年²]
    t0: 0,         // 軌道要素を計算した時刻 [年]
    type: 'ellipse' // 軌道の種類 'ellipse', 'parabola', 'hyperbola'
};

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
function drawBody(body) {
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
}

// 力ベクトル表示
function drawForceVectors() {
    if (!state.showForce) return;
    if (!bodies.A.active || !bodies.B.active) return;

    // 惑星が太陽から受ける重力を計算（純粋なニュートン重力）
    const dx = bodies.B.x - bodies.A.x;
    const dy = bodies.B.y - bodies.A.y;
    const distSq = dx * dx + dy * dy;
    const dist = Math.sqrt(distSq);

    // 表示用のスケール（質量に応じて調整）
    // 質量が大きいほど力も大きくなるので、適切に表示するためのスケーリング
    const forceScale = 1e-26 / Math.sqrt(bodies.B.mass / CONSTANTS.MARS_MASS);

    // 惑星（B）に働く力（太陽からの引力）F = G*M*m/r^2
    const forceB = state.G * bodies.A.mass * bodies.B.mass / distSq;
    const posB = toCanvas(bodies.B.x, bodies.B.y);
    const forceEndB = toCanvas(
        bodies.B.x - (dx / dist) * forceB * forceScale,
        bodies.B.y - (dy / dist) * forceB * forceScale
    );
    drawArrow(posB.x, posB.y, forceEndB.x, forceEndB.y, '#FF00FF', 'F', '');
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

// 太陽と惑星を結ぶ線分を描画
function drawConnectionLine() {
    if (!bodies.A.active || !bodies.B.active) return;

    const posA = toCanvas(bodies.A.x, bodies.A.y);
    const posB = toCanvas(bodies.B.x, bodies.B.y);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]); // 破線
    ctx.beginPath();
    ctx.moveTo(posA.x, posA.y);
    ctx.lineTo(posB.x, posB.y);
    ctx.stroke();
    ctx.setLineDash([]); // 破線を解除
}

// 描画メインループ
function draw() {
    // カメラは常にcanvasの中心（太陽の位置＝原点）
    state.offsetX = canvas.width / 2;
    state.offsetY = canvas.height / 2;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();

    // 太陽と惑星を結ぶ線分（天体の下に描画）
    drawConnectionLine();

    drawBody(bodies.A);
    drawBody(bodies.B);

    // 力ベクトル表示
    drawForceVectors();

    // 爆発エフェクト描画
    drawExplosion();
}

// 初期条件から軌道要素を計算
function calculateOrbitalElementsFromState(x, y, vx, vy, currentTime) {
    const r = Math.sqrt(x * x + y * y);
    const v = Math.sqrt(vx * vx + vy * vy);

    // 換算質量を使用（両方の質量を考慮）
    const mu = state.G * (bodies.A.mass + bodies.B.mass);

    // 比エネルギー（単位質量あたり）
    const specificEnergy = (v * v) / 2 - mu / r;

    // 長半径 a = -μ / (2E)
    const a = -mu / (2 * specificEnergy);

    // 角運動量ベクトル（z成分のみ、2次元）
    const h = x * vy - y * vx;

    // 角運動量が非常に小さい場合の特別処理
    // 直線落下に近い軌道になるため、最小値を設定して数値的な安定性を確保
    const MIN_H = Math.abs(mu) * 1e-8; // muに応じた最小角運動量
    const effectiveH = Math.abs(h) < MIN_H ? (h >= 0 ? MIN_H : -MIN_H) : h;

    // 離心率 e = sqrt(1 + 2Eh²/μ²)
    const e = Math.sqrt(Math.max(0, 1 + 2 * specificEnergy * effectiveH * effectiveH / (mu * mu)));

    // ラプラス・ルンゲ・レンツベクトル（離心率ベクトル）
    // effectiveHを使用して計算の安定性を確保
    const ex = (vy * effectiveH / mu) - (x / r);
    const ey = -(vx * effectiveH / mu) - (y / r);

    // 近点引数 ω（離心率ベクトルの角度）
    const omega = Math.atan2(ey, ex);

    // 現在の真近点角 ν
    const cosNu = (x * Math.cos(omega) + y * Math.sin(omega)) / r;
    const sinNu = (-x * Math.sin(omega) + y * Math.cos(omega)) / r;
    const nu = Math.atan2(sinNu, cosNu);

    // 軌道の種類を判定
    let orbitType;
    if (e < 0.99) {
        orbitType = 'ellipse';
    } else if (e > 1.01) {
        orbitType = 'hyperbola';
    } else {
        orbitType = 'parabola';
    }

    let M0, n;

    if (orbitType === 'ellipse') {
        // 楕円軌道
        // 離心近点角 E
        const E = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu / 2));
        // 平均近点角 M
        M0 = E - e * Math.sin(E);
        // 平均運動 n = sqrt(μ/a³)
        n = Math.sqrt(mu / (a * a * a));
    } else if (orbitType === 'hyperbola') {
        // 双曲線軌道
        // 双曲離心近点角 H
        const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
        // 平均近点角 M
        M0 = e * Math.sinh(H) - H;
        // 平均運動 n = sqrt(μ/(-a)³)（aは負なので-aが正）
        n = Math.sqrt(mu / (-a * -a * -a));
    } else {
        // 放物線軌道
        // バーカー方程式を使用
        const D = Math.tan(nu / 2);
        M0 = D + D * D * D / 3;
        // 放物線の場合、nは定義されないが計算のため仮の値
        n = 0;
    }

    orbit.a = a;
    orbit.e = e;
    orbit.omega = omega;
    orbit.M0 = M0;
    orbit.n = n;
    orbit.mu = mu;
    orbit.t0 = currentTime;
    orbit.type = orbitType;
}

// ケプラーの方程式を解く（ニュートン法）楕円軌道用
// M = E - e*sin(E) から E を求める
function solveKeplerEquation(M, e, tolerance = 1e-10, maxIterations = 100) {
    // 初期推定値
    let E = M + e * Math.sin(M);

    for (let i = 0; i < maxIterations; i++) {
        const f = E - e * Math.sin(E) - M;
        const fPrime = 1 - e * Math.cos(E);
        const dE = f / fPrime;

        E = E - dE;

        if (Math.abs(dE) < tolerance) {
            return E;
        }
    }

    return E;
}

// 双曲線ケプラー方程式を解く（ニュートン法）
// M = e*sinh(H) - H から H を求める
function solveHyperbolicKeplerEquation(M, e, tolerance = 1e-10, maxIterations = 100) {
    // 初期推定値
    let H = M / (e - 1);

    for (let i = 0; i < maxIterations; i++) {
        const f = e * Math.sinh(H) - H - M;
        const fPrime = e * Math.cosh(H) - 1;
        const dH = f / fPrime;

        H = H - dH;

        if (Math.abs(dH) < tolerance) {
            return H;
        }
    }

    return H;
}

// 放物線軌道のバーカー方程式を解く（ニュートン法）
// M = D + D³/3 から D を求める（D = tan(ν/2)）
function solveBarkerEquation(M, tolerance = 1e-10, maxIterations = 100) {
    // 初期推定値
    let D = Math.cbrt(3 * M);

    for (let i = 0; i < maxIterations; i++) {
        const f = D + D * D * D / 3 - M;
        const fPrime = 1 + D * D;
        const dD = f / fPrime;

        D = D - dD;

        if (Math.abs(dD) < tolerance) {
            return D;
        }
    }

    return D;
}

// 時間から位置と速度を計算（解析解）
function updatePositionFromTime(t) {
    if (orbit.type === 'ellipse') {
        updatePositionEllipse(t);
    } else if (orbit.type === 'hyperbola') {
        updatePositionHyperbola(t);
    } else {
        updatePositionParabola(t);
    }
}

// 楕円軌道の位置更新
function updatePositionEllipse(t) {
    // 平均近点角 M(t) = M0 + n*(t - t0)
    const M = orbit.M0 + orbit.n * (t - orbit.t0);

    // ケプラーの方程式を解いて離心近点角 E を求める
    const E = solveKeplerEquation(M, orbit.e);

    // 真近点角 ν を計算
    const nu = 2 * Math.atan(Math.sqrt((1 + orbit.e) / (1 - orbit.e)) * Math.tan(E / 2));

    // 軌道半径 r = a(1 - e*cos(E))
    const r = orbit.a * (1 - orbit.e * Math.cos(E));

    // 軌道面内の位置（近点座標系）
    const xOrb = r * Math.cos(nu);
    const yOrb = r * Math.sin(nu);

    // 慣性座標系への変換（近点引数 ω で回転）
    bodies.B.x = xOrb * Math.cos(orbit.omega) - yOrb * Math.sin(orbit.omega);
    bodies.B.y = xOrb * Math.sin(orbit.omega) + yOrb * Math.cos(orbit.omega);

    // 速度の計算
    const vFactor = Math.sqrt(orbit.mu / orbit.a);
    const vxOrb = -vFactor * Math.sin(E) / (1 - orbit.e * Math.cos(E));
    const vyOrb = vFactor * Math.sqrt(1 - orbit.e * orbit.e) * Math.cos(E) / (1 - orbit.e * Math.cos(E));

    // 慣性座標系への変換
    bodies.B.vx = vxOrb * Math.cos(orbit.omega) - vyOrb * Math.sin(orbit.omega);
    bodies.B.vy = vxOrb * Math.sin(orbit.omega) + vyOrb * Math.cos(orbit.omega);
}

// 双曲線軌道の位置更新
function updatePositionHyperbola(t) {
    // 平均近点角 M(t) = M0 + n*(t - t0)
    const M = orbit.M0 + orbit.n * (t - orbit.t0);

    // 双曲線ケプラー方程式を解いて双曲離心近点角 H を求める
    const H = solveHyperbolicKeplerEquation(M, orbit.e);

    // 真近点角 ν を計算
    const nu = 2 * Math.atan(Math.sqrt((orbit.e + 1) / (orbit.e - 1)) * Math.tanh(H / 2));

    // 軌道半径 r = a(1 - e*cosh(H))（aは負なので注意）
    const r = orbit.a * (1 - orbit.e * Math.cosh(H));

    // 軌道面内の位置（近点座標系）
    const xOrb = r * Math.cos(nu);
    const yOrb = r * Math.sin(nu);

    // 慣性座標系への変換（近点引数 ω で回転）
    bodies.B.x = xOrb * Math.cos(orbit.omega) - yOrb * Math.sin(orbit.omega);
    bodies.B.y = xOrb * Math.sin(orbit.omega) + yOrb * Math.cos(orbit.omega);

    // 速度の計算
    const vFactor = Math.sqrt(orbit.mu / (-orbit.a));
    const vxOrb = -vFactor * Math.sinh(H) / (1 - orbit.e * Math.cosh(H));
    const vyOrb = vFactor * Math.sqrt(orbit.e * orbit.e - 1) * Math.cosh(H) / (1 - orbit.e * Math.cosh(H));

    // 慣性座標系への変換
    bodies.B.vx = vxOrb * Math.cos(orbit.omega) - vyOrb * Math.sin(orbit.omega);
    bodies.B.vy = vxOrb * Math.sin(orbit.omega) + vyOrb * Math.cos(orbit.omega);
}

// 放物線軌道の位置更新
function updatePositionParabola(t) {
    // バーカー方程式用の平均運動を計算
    const p = 2 * orbit.a; // 半直弦 p = 2a（放物線の場合）
    const n_parabola = Math.sqrt(orbit.mu / (p * p * p)) * 2;

    // 平均近点角 M(t) = M0 + n*(t - t0)
    const M = orbit.M0 + n_parabola * (t - orbit.t0);

    // バーカー方程式を解いて D = tan(ν/2) を求める
    const D = solveBarkerEquation(M);

    // 真近点角 ν を計算
    const nu = 2 * Math.atan(D);

    // 軌道半径 r = p / (1 + cos(ν))
    const r = p / (1 + Math.cos(nu));

    // 軌道面内の位置（近点座標系）
    const xOrb = r * Math.cos(nu);
    const yOrb = r * Math.sin(nu);

    // 慣性座標系への変換（近点引数 ω で回転）
    bodies.B.x = xOrb * Math.cos(orbit.omega) - yOrb * Math.sin(orbit.omega);
    bodies.B.y = xOrb * Math.sin(orbit.omega) + yOrb * Math.cos(orbit.omega);

    // 速度の計算
    const vFactor = Math.sqrt(2 * orbit.mu / p);
    const vxOrb = -vFactor * Math.sin(nu);
    const vyOrb = vFactor * (1 + Math.cos(nu));

    // 慣性座標系への変換
    bodies.B.vx = vxOrb * Math.cos(orbit.omega) - vyOrb * Math.sin(orbit.omega);
    bodies.B.vy = vxOrb * Math.sin(orbit.omega) + vyOrb * Math.cos(orbit.omega);
}

// 物理シミュレーション（解析解）
function updatePhysics() {
    // 両方の惑星がアクティブでない場合は更新しない
    if (!bodies.A.active || !bodies.B.active) return;

    const dt = state.dt * state.speedMultiplier;

    // 経過時間を更新
    state.elapsedTime += dt;

    // 解析解で位置と速度を計算
    updatePositionFromTime(state.elapsedTime);

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

// 日本語単位でのフォーマット（2e8 → 2億）
function formatJapanese(value, precision = 3) {
    if (value === 0) return '0';

    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    // 日本語の単位（4桁ごと）
    const units = [
        { threshold: 1e32, name: '溝' },
        { threshold: 1e28, name: '穣' },
        { threshold: 1e24, name: '秭' },
        { threshold: 1e20, name: '垓' },
        { threshold: 1e16, name: '京' },
        { threshold: 1e12, name: '兆' },
        { threshold: 1e8, name: '億' },
        { threshold: 1e4, name: '万' }
    ];

    for (const unit of units) {
        if (absValue >= unit.threshold) {
            const quotient = absValue / unit.threshold;
            // quotientを適切にフォーマット（科学的記法を避ける）
            let formattedQuotient;
            if (quotient >= 1000) {
                // 1000以上の場合は整数部分のみ
                formattedQuotient = Math.round(quotient).toString();
            } else if (quotient >= 100) {
                // 100-999の場合は小数点以下1桁
                formattedQuotient = quotient.toFixed(1);
            } else if (quotient >= 10) {
                // 10-99の場合は小数点以下2桁
                formattedQuotient = quotient.toFixed(2);
            } else {
                // 1-9の場合は小数点以下3桁
                formattedQuotient = quotient.toFixed(3);
            }
            // 末尾の不要な0を削除
            formattedQuotient = formattedQuotient.replace(/\.?0+$/, '');
            return `${sign}${formattedQuotient}${unit.name}`;
        }
    }

    // 1万未満の場合
    if (absValue >= 1) {
        // 整数または小数を適切にフォーマット
        let formatted;
        if (absValue >= 1000) {
            formatted = Math.round(absValue).toString();
        } else if (absValue >= 100) {
            formatted = absValue.toFixed(1);
        } else if (absValue >= 10) {
            formatted = absValue.toFixed(2);
        } else {
            formatted = absValue.toFixed(3);
        }
        formatted = formatted.replace(/\.?0+$/, '');
        return `${sign}${formatted}`;
    } else {
        // 小数の場合は科学的記法
        const exp = value.toExponential(precision - 1);
        const [mantissa, exponent] = exp.split('e');
        const expNum = parseInt(exponent);

        const superscript = {
            '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
            '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
            '-': '⁻', '+': '⁺'
        };

        const expStr = expNum.toString().split('').map(c => superscript[c] || c).join('');
        return `${mantissa}×10${expStr}`;
    }
}

// 軌道要素を計算
function calculateOrbitalElements() {
    const dx = bodies.B.x - bodies.A.x;
    const dy = bodies.B.y - bodies.A.y;
    const r = Math.sqrt(dx * dx + dy * dy);

    const vx = bodies.B.vx;
    const vy = bodies.B.vy;
    const v = Math.sqrt(vx * vx + vy * vy);

    // 比エネルギー（単位質量あたりのエネルギー）
    // 換算質量を使用（両方の質量を考慮）
    const mu = state.G * (bodies.A.mass + bodies.B.mass);
    const specificEnergy = (v * v) / 2 - mu / r;

    // 長半径 a = -mu / (2 * E)
    const a = -mu / (2 * specificEnergy);

    // 角運動量ベクトルの大きさ（z成分のみ、2次元なので）
    const h = dx * vy - dy * vx;

    // 角運動量が非常に小さい場合の特別処理
    const MIN_H = Math.abs(mu) * 1e-8;
    const effectiveH = Math.abs(h) < MIN_H ? (h >= 0 ? MIN_H : -MIN_H) : h;

    // 離心率 e = sqrt(1 + 2*E*h^2/mu^2)
    const e = Math.sqrt(Math.max(0, 1 + 2 * specificEnergy * effectiveH * effectiveH / (mu * mu)));

    // 軌道タイプに応じた計算
    let b, T;
    if (orbit.type === 'ellipse') {
        // 短半径 b = a * sqrt(1 - e^2)
        b = a * Math.sqrt(Math.abs(1 - e * e));
        // 周期 T = 2π * sqrt(a^3 / mu)
        T = 2 * Math.PI * Math.sqrt(Math.abs(a * a * a) / mu);
    } else {
        // 双曲線・放物線の場合は短半径と周期は定義されない
        b = null;
        T = null;
    }

    // 速度ベクトルと位置ベクトルのなす角 θ
    // cos(θ) = (r・v) / (|r||v|)
    const dotProduct = dx * vx + dy * vy;
    const cosTheta = dotProduct / (r * v);
    const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta))) * 180 / Math.PI; // ラジアンから度へ
    const sinTheta = Math.sin(Math.acos(Math.max(-1, Math.min(1, cosTheta))));

    return { r, v, a, b, e, T, theta, sinTheta };
}

// パラメータ更新
function updateParameters() {
    const orbital = calculateOrbitalElements();

    // 質量を日本語単位で表示
    elements.massADisplay.textContent = formatJapanese(bodies.A.mass, 4) + ' kg';
    elements.massBDisplay.textContent = formatJapanese(bodies.B.mass, 4) + ' kg';

    // 経過時間を表示
    elements.time.textContent = state.elapsedTime.toFixed(3) + ' 年';

    // 位置を km 単位で表示（日本語単位）
    const xKm = bodies.B.x / 1000;
    const yKm = bodies.B.y / 1000;
    elements.posB.textContent = `(${formatJapanese(xKm, 4)}, ${formatJapanese(yKm, 4)}) km`;

    // 速度を km/s 単位で表示（m/年 → m/s → km/s）
    const vKmPerSec = orbital.v / 31557600 / 1000; // 1年 = 31,557,600秒
    elements.velB.textContent = formatJapanese(vKmPerSec, 4) + ' km/s';

    // 距離を km 単位で表示
    const rKm = orbital.r / 1000;
    elements.distance.textContent = formatJapanese(rKm, 4) + ' km';

    // 軌道パラメータ（軌道タイプに応じて表示）
    if (orbit.type === 'ellipse') {
        elements.period.textContent = orbital.T.toFixed(3) + ' 年';
        const aKm = orbital.a / 1000;
        const bKm = orbital.b / 1000;
        elements.semiMajor.textContent = formatJapanese(aKm, 4) + ' km';
        elements.semiMinor.textContent = formatJapanese(bKm, 4) + ' km';
        elements.eccentricity.textContent = orbital.e.toFixed(4) + ' (楕円)';
    } else if (orbit.type === 'hyperbola') {
        elements.period.textContent = '∞ (脱出軌道)';
        const aKm = Math.abs(orbital.a) / 1000;
        elements.semiMajor.textContent = formatJapanese(aKm, 4) + ' km (双曲)';
        elements.semiMinor.textContent = '—';
        elements.eccentricity.textContent = orbital.e.toFixed(4) + ' (双曲線)';
    } else {
        elements.period.textContent = '∞ (脱出軌道)';
        const pKm = Math.abs(orbital.a) / 1000;
        elements.semiMajor.textContent = formatJapanese(pKm, 4) + ' km (放物)';
        elements.semiMinor.textContent = '—';
        elements.eccentricity.textContent = orbital.e.toFixed(4) + ' (放物線)';
    }

    elements.angle.textContent = orbital.theta.toFixed(2) + '°';
    elements.sinAngle.textContent = orbital.sinTheta.toFixed(4);
}

// アニメーションループ
function animate() {
    if (state.running) {
        // 解析解なので1回の計算で正確
        updatePhysics();
        updateParameters();
    }
    draw();
    requestAnimationFrame(animate);
}


// 現在のスライダー値を保持する変数（太陽の質量は固定）
const currentMassA = CONSTANTS.SUN_MASS;
let currentMassB = CONSTANTS.MARS_MASS;
let currentDistance = CONSTANTS.MARS_PERIHELION; // [m]
// 火星の近日点速度を計算 v_p = sqrt(G * M_sun * (1 + e) / (a * (1 - e)))
const marsInitialVelocity = Math.sqrt(CONSTANTS.G * CONSTANTS.SUN_MASS * (1 + CONSTANTS.MARS_ECCENTRICITY) / (CONSTANTS.MARS_ORBIT * (1 - CONSTANTS.MARS_ECCENTRICITY)));
let currentVelocity = marsInitialVelocity; // [m/年]
let currentPlanetRadius = CONSTANTS.MARS_RADIUS;

// 質量スライダーの値を実際の質量に変換
function massSliderToValue(sliderValue) {
    return Math.pow(10, parseFloat(sliderValue));
}

// 実際の質量をスライダーの値に変換
function massValueToSlider(mass) {
    return Math.log10(mass);
}

// 距離スライダーの値を実際の距離に変換 (10^11 m → m)
function distanceSliderToValue(sliderValue) {
    return parseFloat(sliderValue) * 1e11;
}

// 実際の距離をスライダーの値に変換 (m → 10^11 m)
function distanceValueToSlider(distance) {
    return distance / 1e11;
}

// 速度スライダーの値を実際の速度に変換 (km/s → m/年)
function velocitySliderToValue(sliderValue) {
    // km/s → m/s → m/年
    const mPerSec = parseFloat(sliderValue) * 1000;
    return mPerSec * 31557600; // 1年 = 31,557,600秒
}

// 実際の速度をスライダーの値に変換 (m/年 → km/s)
function velocityValueToSlider(velocity) {
    // m/年 → m/s → km/s
    const mPerSec = velocity / 31557600;
    return mPerSec / 1000;
}

// シミュレーションをリセットする関数
function resetSimulation() {
    state.running = false;
    elements.startBtn.disabled = false;
    elements.stopBtn.disabled = true;

    // 初期状態を再生成
    bodies = initializeBodies(currentMassA, currentMassB, currentDistance, currentVelocity, currentPlanetRadius);

    // 軌道要素を初期条件から計算
    calculateOrbitalElementsFromState(bodies.B.x, bodies.B.y, bodies.B.vx, bodies.B.vy, 0);

    // 爆発エフェクトをリセット
    explosion.active = false;

    // 経過時間をリセット
    state.elapsedTime = 0;

    updateParameters();
}

// UI イベント
elements.massB.addEventListener('input', (e) => {
    currentMassB = massSliderToValue(e.target.value);
    elements.massBValue.textContent = formatJapanese(currentMassB, 4) + ' kg';
    resetSimulation();
});

elements.initialDistance.addEventListener('input', (e) => {
    currentDistance = distanceSliderToValue(e.target.value);
    elements.initialDistanceValue.textContent = formatJapanese(currentDistance / 1000, 3) + ' km';
    resetSimulation();
});

elements.initialVelocity.addEventListener('input', (e) => {
    currentVelocity = velocitySliderToValue(e.target.value);
    elements.initialVelocityValue.textContent = e.target.value + ' km/s';
    resetSimulation();
});

elements.speed.addEventListener('input', (e) => {
    state.speedMultiplier = parseFloat(e.target.value);
    elements.speedValue.textContent = e.target.value + 'x';
});

elements.startBtn.addEventListener('click', () => {
    state.running = true;
    elements.startBtn.disabled = true;
    elements.stopBtn.disabled = false;
});

elements.stopBtn.addEventListener('click', () => {
    state.running = false;
    elements.startBtn.disabled = false;
    elements.stopBtn.disabled = true;
});

elements.resetBtn.addEventListener('click', () => {
    // 軌道をクリア
    bodies.B.trail = [];
    resetSimulation();
});

elements.clearTrailBtn.addEventListener('click', () => {
    // 軌道のみをクリア
    bodies.B.trail = [];
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

// 惑星プリセットボタン
document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const planetKey = btn.dataset.planet;
        const planet = PLANET_PRESETS[planetKey];

        if (!planet) return;

        // 質量を設定
        currentMassB = planet.mass;
        currentPlanetRadius = planet.radius;
        elements.massB.value = massValueToSlider(planet.mass);
        elements.massBValue.textContent = formatJapanese(planet.mass, 4) + ' kg';

        // 最遠点での距離を設定
        currentDistance = planet.aphelion;
        elements.initialDistance.value = distanceValueToSlider(planet.aphelion).toFixed(2);
        elements.initialDistanceValue.textContent = formatJapanese(planet.aphelion / 1000, 3) + ' km';

        // 最遠点での速度を計算
        // v_a = sqrt(G * M_sun * (1 - e) / (a * (1 + e)))
        const a = planet.aphelion / (1 + planet.eccentricity);
        const velocityAtAphelion = Math.sqrt(CONSTANTS.G * currentMassA * (1 - planet.eccentricity) / (a * (1 + planet.eccentricity)));

        currentVelocity = velocityAtAphelion;
        const velocityKmPerS = velocityValueToSlider(velocityAtAphelion);
        elements.initialVelocity.value = velocityKmPerS.toFixed(1);
        elements.initialVelocityValue.textContent = velocityKmPerS.toFixed(1) + ' km/s';

        // シミュレーションをリセット
        resetSimulation();
    });
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
    // リセット（初期値に戻す）
    state.scale = 150;
});

// 初期化
window.addEventListener('load', () => {
    resizeCanvas();
    // 初期軌道要素を計算
    calculateOrbitalElementsFromState(bodies.B.x, bodies.B.y, bodies.B.vx, bodies.B.vy, 0);
    updateParameters();

    // 初期表示の更新
    elements.massBValue.textContent = formatJapanese(currentMassB, 4) + ' kg';
    elements.initialDistanceValue.textContent = formatJapanese(currentDistance / 1000, 3) + ' km';
    elements.initialVelocityValue.textContent = velocityValueToSlider(currentVelocity).toFixed(1) + ' km/s';

    animate();
});

window.addEventListener('resize', resizeCanvas);
