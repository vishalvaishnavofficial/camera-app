const video = document.getElementById('videoFeed');
const zoomPill = document.getElementById('zoomPill');
const rulerView = document.getElementById('rulerView');
const modeTrack = document.getElementById('modeTrack');
const shutter = document.getElementById('shutter');
const timerDisplay = document.getElementById('timer');
const modeOverlay = document.getElementById('modeOverlay');
const gridOverlay = document.getElementById('gridOverlay');

let currentFacing = "environment", maxZoom = 10, currentMode = "photo";
let mediaRecorder, chunks = [], lastMediaURL = null, lastMediaType = null;
let recordingSeconds = 0, timerInterval;
let flashMode = 'off';
let gridVisible = false;

async function startCamera(face) {
    try {
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(t => t.stop());
        }
        // Request higher capabilities for HD mode potential
        const constraints = {
            video: { 
                facingMode: face, 
                width: { ideal: 4096 }, 
                height: { ideal: 2160 } 
            },
            audio: true
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            const track = stream.getVideoTracks()[0];
            const caps = track.getCapabilities();
            maxZoom = caps.zoom ? caps.zoom.max : 10;
            buildRuler();
        };
    } catch (err) { console.error(err); }
}

function toggleGrid() {
    gridVisible = !gridVisible;
    gridOverlay.style.display = gridVisible ? 'grid' : 'none';
    document.getElementById('gridLabel').innerText = gridVisible ? 'On' : 'Grid';
    document.getElementById('gridIcon').style.color = gridVisible ? 'var(--accent)' : 'white';
}

function setMode(idx, mode) {
    if (currentMode === mode) return;
    
    const icons = { 'photo': 'photo_camera', 'hd-photo': 'hd', 'video': 'videocam', 'short': 'bolt', 'slowmo': 'slow_motion_video' };
    const labels = { 'photo': 'Photo', 'hd-photo': 'HD Photo', 'video': 'Video', 'short': 'Short Video', 'slowmo': 'Slow Motion' };

    document.getElementById('overlayIcon').innerText = icons[mode];
    document.getElementById('overlayText').innerText = labels[mode];
    modeOverlay.style.display = 'flex';
    setTimeout(() => { modeOverlay.style.display = 'none'; }, 800);

    currentMode = mode;
    document.querySelectorAll('.mode-item').forEach((m, i) => m.classList.toggle('active', i === idx));
    
    // Shift track to center the current mode horizontally above shutter
    const offset = (1 - idx) * 110; 
    modeTrack.style.transform = `translate(calc(-50% + ${offset}px), -50%)`;
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
    const track = video.srcObject.getVideoTracks()[0];
    const settings = track.getSettings();

    // High resolution logic for HD mode
    if (currentMode === 'hd-photo') {
        captureCanvas.width = settings.width || video.videoWidth;
        captureCanvas.height = settings.height || video.videoHeight;
    } else {
        captureCanvas.width = video.videoWidth;
        captureCanvas.height = video.videoHeight;
    }

    const ctx = captureCanvas.getContext('2d');
    if (currentMode === 'hd-photo') ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

    // Save as JPEG with 100% quality for HD mode
    lastMediaURL = captureCanvas.toDataURL('image/jpeg', currentMode === 'hd-photo' ? 1.0 : 0.8);
    lastMediaType = 'image';
    updateGalleryPreview(lastMediaURL);
}

async function startRecording() {
    chunks = [];
    mediaRecorder = new MediaRecorder(video.srcObject);
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        lastMediaURL = URL.createObjectURL(blob);
        lastMediaType = 'video';
        updateGalleryPreview(null);
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
    if (mediaRecorder?.state !== "inactive") mediaRecorder.stop();
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
    if (currentMode === 'photo' || currentMode === 'hd-photo') takePhoto();
    else (mediaRecorder?.state === "recording" ? stopRecording() : startRecording());
};

function openViewer() {
    if (!lastMediaURL) return;
    const vBody = document.getElementById('vBody');
    vBody.innerHTML = '';
    if (lastMediaType === 'image') {
        vBody.innerHTML = `<img src="${lastMediaURL}">`;
    } else {
        const videoEl = document.createElement('video');
        videoEl.src = lastMediaURL; videoEl.controls = true; videoEl.autoplay = true;
        videoEl.style.width = '100%';
        if (currentMode === 'slowmo') {
            videoEl.addEventListener('timeupdate', () => {
                videoEl.playbackRate = videoEl.currentTime > 2 ? 0.4 : 1.0;
            });
        }
        vBody.appendChild(videoEl);
    }
    document.getElementById('viewer').style.display = 'flex';
}

function closeViewer() { document.getElementById('viewer').style.display = 'none'; }
function toggleCamera() { currentFacing = currentFacing === "environment" ? "user" : "environment"; startCamera(currentFacing); }
function toggleFlash() {
    const icon = document.getElementById('flashIcon');
    const label = document.getElementById('flashLabel');
    if(flashMode === 'off') { flashMode = 'on'; icon.innerText = 'flash_on'; label.innerText = 'On'; setFlash(true); }
    else if(flashMode === 'on') { flashMode = 'auto'; icon.innerText = 'flash_auto'; label.innerText = 'Auto'; setFlash(false); }
    else { flashMode = 'off'; icon.innerText = 'flash_off'; label.innerText = 'Off'; setFlash(false); }
}
async function setFlash(state) {
    const track = video.srcObject?.getVideoTracks()[0];
    if (track?.getCapabilities().torch) {
        try { await track.applyConstraints({ advanced: [{ torch: state }] }); } catch (e) {}
    }
}
function applyZoom(val) {
    video.style.transform = `translate(-50%, -50%) scale(${val})`;
    document.querySelectorAll('.zoom-dot').forEach(d => {
        const dv = d.id === 'dot05' ? 0.5 : parseFloat(d.innerText);
        d.classList.toggle('active', Math.abs(dv - val) < 0.25);
    });
}
let holdTimer;
zoomPill.onmousedown = zoomPill.ontouchstart = () => { holdTimer = setTimeout(() => zoomPill.classList.add('expanded'), 300); };
window.onmouseup = window.ontouchend = () => { clearTimeout(holdTimer); zoomPill.classList.remove('expanded'); };
rulerView.onscroll = () => {
    if(!zoomPill.classList.contains('expanded')) return;
    const scrollPerc = rulerView.scrollLeft / (rulerView.scrollWidth - rulerView.clientWidth);
    applyZoom(0.5 + (scrollPerc * (maxZoom - 0.5)));
};

startCamera(currentFacing);
