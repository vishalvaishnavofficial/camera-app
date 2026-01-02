const video = document.getElementById('videoFeed');
const portraitCanvas = document.getElementById('portraitCanvas');
const portraitCtx = portraitCanvas.getContext('2d');
const zoomPill = document.getElementById('zoomPill');
const rulerView = document.getElementById('rulerView');
const modeTrack = document.getElementById('modeTrack');
const shutter = document.getElementById('shutter');
const timerDisplay = document.getElementById('timer');
const modeOverlay = document.getElementById('modeOverlay');

// New Portrait Controls
const portraitSettingsBtn = document.getElementById('portraitSettingsBtn');
const blurContainer = document.getElementById('blurContainer');
const blurSlider = document.getElementById('blurSlider');
const blurValueDisplay = document.getElementById('blurValue');

let currentFacing = "environment", maxZoom = 10, currentMode = "photo";
let mediaRecorder, chunks = [], lastMediaURL = null, lastMediaType = null;
let recordingSeconds = 0, timerInterval;
let flashMode = 'off';
let blurAmount = 12; // Default blur

// Initialize Portrait Blur Engine
const selfieSegmentation = new SelfieSegmentation({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
});

selfieSegmentation.setOptions({ modelSelection: 1 });
selfieSegmentation.onResults(onPortraitResults);

function onPortraitResults(results) {
    if (currentMode !== 'portrait') return;

    portraitCanvas.width = video.videoWidth;
    portraitCanvas.height = video.videoHeight;

    portraitCtx.save();
    portraitCtx.clearRect(0, 0, portraitCanvas.width, portraitCanvas.height);

    portraitCtx.drawImage(results.segmentationMask, 0, 0, portraitCanvas.width, portraitCanvas.height);

    portraitCtx.globalCompositeOperation = 'source-out';
    portraitCtx.filter = `blur(${blurAmount}px) brightness(0.9)`; 
    portraitCtx.drawImage(results.image, 0, 0, portraitCanvas.width, portraitCanvas.height);

    portraitCtx.globalCompositeOperation = 'destination-over';
    portraitCtx.filter = 'none';
    portraitCtx.drawImage(results.image, 0, 0, portraitCanvas.width, portraitCanvas.height);

    portraitCtx.restore();

    requestAnimationFrame(() => {
        if(currentMode === 'portrait') selfieSegmentation.send({image: video});
    });
}

// Blur Slider Listeners
blurSlider.addEventListener('input', (e) => {
    blurAmount = e.target.value;
    const percentage = Math.round((blurAmount / 30) * 100);
    blurValueDisplay.innerText = `${percentage}%`;
    blurContainer.classList.add('interacting');
});

blurSlider.addEventListener('change', () => {
    blurContainer.classList.remove('interacting');
});

blurSlider.addEventListener('mouseup', () => blurContainer.classList.remove('interacting'));
blurSlider.addEventListener('touchend', () => blurContainer.classList.remove('interacting'));

function toggleBlurSlider() {
    const isVisible = blurContainer.style.display === 'flex';
    blurContainer.style.display = isVisible ? 'none' : 'flex';
}

async function startCamera(face) {
    try {
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(t => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: face },
            audio: true
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            const track = stream.getVideoTracks()[0];
            const caps = track.getCapabilities();
            maxZoom = caps.zoom ? caps.zoom.max : 10;
            buildRuler();
        };
    } catch (err) { console.error(err); }
}

async function setFlash(state) {
    const track = video.srcObject?.getVideoTracks()[0];
    if (track && track.getCapabilities().torch) {
        try { await track.applyConstraints({ advanced: [{ torch: state }] }); } catch (e) {}
    }
}

function toggleFlash() {
    const icon = document.getElementById('flashIcon');
    const label = document.getElementById('flashLabel');
    if(flashMode === 'off') { flashMode = 'on'; icon.innerText = 'flash_on'; label.innerText = 'On'; setFlash(true); }
    else if(flashMode === 'on') { flashMode = 'auto'; icon.innerText = 'flash_auto'; label.innerText = 'Auto'; setFlash(false); }
    else { flashMode = 'off'; icon.innerText = 'flash_off'; label.innerText = 'Off'; setFlash(false); }
}

function toggleCamera() {
    currentFacing = currentFacing === "environment" ? "user" : "environment";
    startCamera(currentFacing);
}

function setMode(idx, mode) {
    if (currentMode === mode) return;
    const icons = { 'photo': 'photo_camera', 'video': 'videocam', 'short': 'bolt', 'portrait': 'person' };
    const labels = { 'photo': 'Photo', 'video': 'Video', 'short': 'Short Video', 'portrait': 'Portrait' };

    document.getElementById('overlayIcon').innerText = icons[mode];
    document.getElementById('overlayText').innerText = labels[mode];
    modeOverlay.style.display = 'flex';
    setTimeout(() => { modeOverlay.style.display = 'none'; }, 800);

    currentMode = mode;

    // Toggle Portrait specific UI
    if(mode === 'portrait') {
        portraitCanvas.style.display = 'block';
        portraitSettingsBtn.style.display = 'flex';
        video.style.opacity = '0';
        selfieSegmentation.send({image: video});
    } else {
        portraitCanvas.style.display = 'none';
        portraitSettingsBtn.style.display = 'none';
        blurContainer.style.display = 'none';
        video.style.opacity = '1';
    }

    document.querySelectorAll('.mode-item').forEach((m, i) => m.classList.toggle('active', i === idx));
    
    // Centers the active tab (Index 1 "Photos" is centered when idx=1)
    modeTrack.style.transform = `translate(calc(-50% + ${(1 - idx) * 110}px), -50%)`;
}

async function takePhoto() {
    if (flashMode === 'auto') {
        await setFlash(true);
        setTimeout(async () => {
            captureFrame();
            await setFlash(false);
        }, 500);
    } else {
        captureFrame();
    }
}

function captureFrame() {
    const captureCanvas = document.getElementById('canvas');
    captureCanvas.width = video.videoWidth; captureCanvas.height = video.videoHeight;
    const ctx = captureCanvas.getContext('2d');

    if(currentMode === 'portrait') {
        ctx.drawImage(portraitCanvas, 0, 0);
    } else {
        ctx.drawImage(video, 0, 0);
    }

    lastMediaURL = captureCanvas.toDataURL('image/png');
    lastMediaType = 'image';
    updateGalleryPreview(lastMediaURL);
}

async function startRecording() {
    if (flashMode === 'auto') await setFlash(true);
    chunks = [];
    const stream = currentMode === 'portrait' ? portraitCanvas.captureStream() : video.srcObject;
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        lastMediaURL = URL.createObjectURL(blob);
        lastMediaType = 'video';
        updateGalleryPreview(null);
        if (flashMode === 'auto') await setFlash(false);
    };
    mediaRecorder.start();
    shutter.classList.add('recording');
    timerDisplay.style.display = 'block';
    recordingSeconds = 0;
    updateTimerUI();
    timerInterval = setInterval(() => {
        recordingSeconds++;
        updateTimerUI();
        if (currentMode === 'short' && recordingSeconds >= 30) stopRecording();
    }, 1000);
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    shutter.classList.remove('recording');
    timerDisplay.style.display = 'none';
    clearInterval(timerInterval);
}

function updateGalleryPreview(url) {
    const thumbImg = document.getElementById('thumbImg');
    const galleryIcon = document.getElementById('galleryIcon');
    if (lastMediaType === 'image') {
        thumbImg.src = url; thumbImg.style.display = 'block'; galleryIcon.style.display = 'none';
    } else {
        thumbImg.style.display = 'none'; galleryIcon.innerText = 'videocam';
        galleryIcon.style.display = 'block'; galleryIcon.style.color = 'var(--accent)';
    }
}

function toggleRatio() {
    const vp = document.getElementById('viewport');
    const label = document.getElementById('ratioLabel');
    vp.classList.remove('ratio-4-3', 'ratio-16-9');
    const current = label.innerText;
    if(current === 'Full') { label.innerText = '4:3'; vp.classList.add('ratio-4-3'); }
    else if(current === '4:3') { label.innerText = '16:9'; vp.classList.add('ratio-16-9'); }
    else { label.innerText = 'Full'; }
}

function buildRuler() {
    const track = document.getElementById('rulerTrack');
    track.innerHTML = '';
    for(let i=0.5; i<=maxZoom; i+=0.5) {
        if(i === 0.5 || Number.isInteger(i)) track.innerHTML += `<div class="tick major" data-val="${i}x"></div>`;
        else track.innerHTML += `<div class="tick"></div>`;
    }
}

function updateTimerUI() {
    const fmt = s => Math.floor(s/60).toString().padStart(2,'0') + ":" + (s%60).toString().padStart(2,'0');
    timerDisplay.innerText = currentMode === 'short' ? `${fmt(recordingSeconds)} / 00:30` : fmt(recordingSeconds);
}

shutter.onclick = () => {
    if (currentMode === 'photo' || currentMode === 'portrait') takePhoto();
    else (mediaRecorder?.state === "recording" ? stopRecording() : startRecording());
};

function openViewer() {
    if (!lastMediaURL) return;
    const vBody = document.getElementById('vBody');
    vBody.innerHTML = lastMediaType === 'image' ? `<img src="${lastMediaURL}">` : `<video src="${lastMediaURL}" controls autoplay style="width:100%"></video>`;
    document.getElementById('viewer').style.display = 'flex';
}
function closeViewer() { document.getElementById('viewer').style.display = 'none'; }

let holdTimer;
zoomPill.onmousedown = zoomPill.ontouchstart = () => { holdTimer = setTimeout(() => zoomPill.classList.add('expanded'), 300); };
window.onmouseup = window.ontouchend = () => { clearTimeout(holdTimer); zoomPill.classList.remove('expanded'); };
rulerView.onscroll = () => {
    if(!zoomPill.classList.contains('expanded')) return;
    const scrollPerc = rulerView.scrollLeft / (rulerView.scrollWidth - rulerView.clientWidth);
    applyZoom(0.5 + (scrollPerc * (maxZoom - 0.5)));
};
function applyZoom(val) {
    video.style.transform = `translate(-50%, -50%) scale(${val})`;
    portraitCanvas.style.transform = `translate(-50%, -50%) scale(${val})`;
    document.querySelectorAll('.zoom-dot').forEach(d => {
        const dv = d.id === 'dot05' ? 0.5 : parseFloat(d.innerText);
        d.classList.toggle('active', Math.abs(dv - val) < 0.25);
    });
}

startCamera(currentFacing);
