const canvas = document.getElementById('draw-canvas');
const ctx = canvas.getContext('2d');
const centerPoint = document.getElementById('center-point');
const instruction = document.getElementById('instruction');
const resultOverlay = document.getElementById('result-overlay');
const scoreText = document.getElementById('score-text');
const feedbackMsg = document.getElementById('feedback-msg');
const retryBtn = document.getElementById('retry-btn');
const shareBtn = document.getElementById('share-btn');
const modeBtns = document.querySelectorAll('.mode-btn');
const toast = document.getElementById('toast');

let isDrawing = false;
let points = [];
let currentMode = 'circle'; // circle, triangle, angle
let width, height, centerX, centerY;
let finalScore = 0;

// 初期化・リサイズ処理
function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    centerX = width / 2;
    centerY = height / 2;
    resetGame();
}

window.addEventListener('resize', resizeCanvas);

function resetGame() {
    ctx.clearRect(0, 0, width, height);
    points = [];
    isDrawing = false;
    resultOverlay.classList.add('hidden');
    instruction.style.opacity = '1';
    
    if (currentMode === 'circle') {
        centerPoint.style.display = 'block';
        instruction.textContent = '円を描いてください';
    } else if (currentMode === 'triangle') {
        centerPoint.style.display = 'none';
        instruction.textContent = '正三角形を描いてください';
    } else if (currentMode === 'angle') {
        centerPoint.style.display = 'none';
        instruction.textContent = '45度を描いてください';
    }
}

// 描画処理系
function startDrawing(e) {
    if (!resultOverlay.classList.contains('hidden')) return;
    
    isDrawing = true;
    points = [];
    instruction.style.opacity = '0';
    ctx.clearRect(0, 0, width, height);
    
    const { x, y } = getCoord(e);
    points.push({ x, y });
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function draw(e) {
    if (!isDrawing) return;
    const { x, y } = getCoord(e);
    points.push({ x, y });
    
    ctx.lineTo(x, y);
    ctx.stroke();
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    evaluateShape();
}

function getCoord(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

// イベントリスナー
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

canvas.addEventListener('touchstart', startDrawing, { passive: false });
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // スクロール防止
    draw(e);
}, { passive: false });
canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('touchcancel', stopDrawing);

retryBtn.addEventListener('click', resetGame);
shareBtn.addEventListener('click', shareResult);

modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        modeBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentMode = e.target.getAttribute('data-mode');
        resetGame();
    });
});

// 解析系スタブ
function evaluateShape() {
    if (points.length < 10) {
        showResult(0, '線を長く描いてください');
        return;
    }
    
    let score = 0;
    let msg = '';
    
    if (currentMode === 'circle') {
        score = evaluateCircle();
    } else if (currentMode === 'triangle') {
        score = evaluateTriangle();
    } else if (currentMode === 'angle') {
        score = evaluateAngle();
    }
    
    score = Math.max(0, Math.min(100, score));
    
    if (score > 95) msg = 'Amazing!';
    else if (score > 80) msg = 'Great!';
    else if (score > 60) msg = 'Not bad';
    else msg = 'Too shaky...';
    
    showResult(score, msg);
}

function evaluateCircle() {
    let sumR = 0;
    for (let p of points) {
        sumR += Math.hypot(p.x - centerX, p.y - centerY);
    }
    let R = sumR / points.length;
    
    let varianceR = 0;
    let totalAngle = 0;
    
    for (let i = 0; i < points.length; i++) {
        let p = points[i];
        let r = Math.hypot(p.x - centerX, p.y - centerY);
        varianceR += Math.abs(r - R);
        
        if (i > 0) {
            let prev = points[i-1];
            let a1 = Math.atan2(prev.y - centerY, prev.x - centerX);
            let a2 = Math.atan2(p.y - centerY, p.x - centerX);
            let diff = a2 - a1;
            while(diff < -Math.PI) diff += 2 * Math.PI;
            while(diff > Math.PI) diff -= 2 * Math.PI;
            totalAngle += diff;
        }
    }
    
    let avgDev = varianceR / points.length;
    let errPercent = (avgDev / R) * 100;
    
    let angleRatio = Math.abs(Math.abs(totalAngle) - 2 * Math.PI) / (2 * Math.PI);
    let startEndDist = Math.hypot(points[0].x - points[points.length-1].x, points[0].y - points[points.length-1].y);
    
    let score = 100 - (errPercent * 4); // 厳格化: K=4
    
    if (angleRatio > 0.1 || startEndDist > R * 0.5) {
        score -= 20 + (angleRatio * 100);
    }
    
    // ガイド描画
    ctx.beginPath();
    ctx.arc(centerX, centerY, R, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.6)';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    return score;
}

function evaluateTriangle() {
    // 重心を求める
    let cx = 0, cy = 0;
    for (let p of points) {
        cx += p.x; cy += p.y;
    }
    cx /= points.length;
    cy /= points.length;
    
    // 最も遠い点（頂点1）をさがす
    let maxR = 0;
    let v1 = points[0];
    for (let p of points) {
        let r = Math.hypot(p.x - cx, p.y - cy);
        if (r > maxR) {
            maxR = r;
            v1 = p;
        }
    }
    
    // v1の角度
    let a1 = Math.atan2(v1.y - cy, v1.x - cx);
    
    // 残りの2頂点を、a1+120度、a1-120度 付近から最大のrを持つ点とする
    function findVertexInSector(targetAngle) {
        let maxRFunc = 0;
        let bestV = null;
        for (let p of points) {
            let pA = Math.atan2(p.y - cy, p.x - cx);
            let diff = Math.abs(pA - targetAngle);
            while(diff > Math.PI) diff -= 2 * Math.PI;
            diff = Math.abs(diff);
            
            // +- 60 degree 
            if (diff < Math.PI / 3) {
                let r = Math.hypot(p.x - cx, p.y - cy);
                if (r > maxRFunc) {
                    maxRFunc = r;
                    bestV = p;
                }
            }
        }
        return bestV || points[0];
    }
    
    let a2 = a1 + (Math.PI * 2 / 3);
    if (a2 > Math.PI) a2 -= 2*Math.PI;
    let v2 = findVertexInSector(a2);
    
    let a3 = a1 - (Math.PI * 2 / 3);
    if (a3 < -Math.PI) a3 += 2*Math.PI;
    let v3 = findVertexInSector(a3);
    
    let vertices = [v1, v2, v3];
    
    // 3辺の長さのばらつき
    let len1 = Math.hypot(v1.x - v2.x, v1.y - v2.y);
    let len2 = Math.hypot(v2.x - v3.x, v2.y - v3.y);
    let len3 = Math.hypot(v3.x - v1.x, v3.y - v1.y);
    let avgLen = (len1 + len2 + len3) / 3;
    let lenVar = (Math.abs(len1 - avgLen) + Math.abs(len2 - avgLen) + Math.abs(len3 - avgLen)) / 3;
    
    // 点から 各辺への距離（直線のゆがみ）
    let totalDist = 0;
    for (let p of points) {
        let d1 = perpDist(p, v1, v2);
        let d2 = perpDist(p, v2, v3);
        let d3 = perpDist(p, v3, v1);
        totalDist += Math.min(d1, d2, d3);
    }
    
    let avgDist = totalDist / points.length;
    
    let score = 100 - (lenVar / avgLen * 100 * 2) - (avgDist / avgLen * 100 * 5);
    
    // 閉路判定
    let startEndDist = Math.hypot(points[0].x - points[points.length-1].x, points[0].y - points[points.length-1].y);
    if (startEndDist > avgLen * 0.3) {
        score -= 30; // 途切れている
    }
    
    // ガイド描画
    ctx.beginPath();
    ctx.moveTo(v1.x, v1.y);
    ctx.lineTo(v2.x, v2.y);
    ctx.lineTo(v3.x, v3.y);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.6)';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    return score;
}

function evaluateAngle() {
    let start = points[0];
    let end = points[points.length - 1];
    
    let maxDist = 0;
    let corner = points[Math.floor(points.length / 2)];
    
    for (let p of points) {
        let dist = perpDist(p, start, end);
        if (dist > maxDist) {
            maxDist = dist;
            corner = p;
        }
    }
    
    // 2本のベクトルの角度
    let dx1 = start.x - corner.x;
    let dy1 = start.y - corner.y;
    let len1 = Math.hypot(dx1, dy1);
    
    let dx2 = end.x - corner.x;
    let dy2 = end.y - corner.y;
    let len2 = Math.hypot(dx2, dy2);
    
    let dot = (dx1 * dx2 + dy1 * dy2) / (len1 * len2);
    let angleRad = Math.acos(Math.max(-1, Math.min(1, dot)));
    let angleDeg = angleRad * 180 / Math.PI;
    
    // 45度からの偏差
    let targetAngle = 45;
    let diff = Math.abs(angleDeg - targetAngle);
    
    // 直線性（ゆがみ）
    let totalDist = 0;
    for (let p of points) {
        let d1 = perpDist(p, start, corner);
        let d2 = perpDist(p, corner, end);
        // 端点付近の場合は片方しか考慮しないように、単純にminを取る
        totalDist += Math.min(d1, d2);
    }
    let avgDist = totalDist / points.length;
    let avgLen = (len1 + len2) / 2;
    
    let score = 100 - (diff * 2.0) - (avgDist / avgLen * 100 * 5);
    
    // ガイドとして、cornerから理想の45度線を引く
    let baseAngle = Math.atan2(dy1, dx1);
    let target1 = baseAngle + (targetAngle * Math.PI / 180);
    let target2 = baseAngle - (targetAngle * Math.PI / 180);
    
    let drawnAngle = Math.atan2(dy2, dx2);
    let diff1 = Math.abs(target1 - drawnAngle);
    let diff2 = Math.abs(target2 - drawnAngle);
    while (diff1 > Math.PI) diff1 -= 2*Math.PI;
    while (diff2 > Math.PI) diff2 -= 2*Math.PI;
    diff1 = Math.abs(diff1);
    diff2 = Math.abs(diff2);
    
    let bestTargetAngle = diff1 < diff2 ? target1 : target2;
    
    let idealEndX = corner.x + Math.cos(bestTargetAngle) * len2;
    let idealEndY = corner.y + Math.sin(bestTargetAngle) * len2;
    
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(corner.x, corner.y);
    ctx.lineTo(idealEndX, idealEndY);
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.6)';
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    return score;
}

function perpDist(pt, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const mag = Math.hypot(dx, dy);
    if (mag > 0) {
        return Math.abs(dx * (lineStart.y - pt.y) - (lineStart.x - pt.x) * dy) / mag;
    } else {
        return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);
    }
}

function showResult(score, msg) {
    finalScore = score;
    feedbackMsg.textContent = msg;
    resultOverlay.classList.remove('hidden');
    animateScore(score);
}

function animateScore(targetScore) {
    let current = 0;
    const duration = 1000;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        current = targetScore * easeProgress;
        
        scoreText.textContent = current.toFixed(1) + '%';
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            scoreText.textContent = targetScore.toFixed(1) + '%';
        }
    }
    
    requestAnimationFrame(update);
}

function shareResult() {
    const emojis = finalScore >= 95 ? '👑' : finalScore >= 80 ? '🎯' : finalScore >= 60 ? '👍' : '💦';
    const text = `The Correct Circle\nMode: ${currentMode}\nScore: ${finalScore.toFixed(1)}% ${emojis}\nCan you do better?\n#TheCorrectCircle`;
    
    navigator.clipboard.writeText(text).then(() => {
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
    }).catch(err => {
        console.error('Copy failed', err);
    });
}

// 初期化実行
resizeCanvas();
