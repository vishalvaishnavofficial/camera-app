const video = document.getElementById('videoFeed');
const modeTrack = document.getElementById('modeTrack');
const gridOverlay = document.getElementById('gridOverlay');
const shutter = document.getElementById('shutter');
let currentMode = 'photo';
let currentFacing = 'environment';

async function startCamera(face) {
    if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
    const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: face, width: { ideal: 4096 }, height: { ideal: 2160 } } 
    });
    video.srcObject = stream;
    // Default zoom is 1x
    applyZoom(1);
}

function setMode(idx, mode) {
    currentMode = mode;
    
    // Horizontal Centering Math
    const itemWidth = 90; // matches min-width in CSS
    const offset = -(idx * itemWidth) - (itemWidth / 2);
    modeTrack.style.transform = `translateX(${offset}px)`;

    document.querySelectorAll('.mode-item').forEach((m, i) => {
        m.classList.toggle('active', i === idx);
    });

    // Show mode overlay
    const overlay = document.getElementById('modeOverlay');
    document.getElementById('overlayText').innerText = mode.toUpperCase();
    overlay.style.display = 'flex';
    setTimeout(() => overlay.style.display = 'none', 500);
}

function applyZoom(val) {
    // If 0.5 is clicked, we scale the video smaller than 1 to "zoom out"
    // If 1 or higher, we scale up
    video.style.transform = `translate(-50%, -50%) scale(${val})`;
    
    document.querySelectorAll('.zoom-dot').forEach(dot => {
        const dotVal = parseFloat(dot.innerText) || 0.5;
        dot.classList.toggle('active', dotVal === val);
    });
}

function toggleGrid() {
    const isVisible = gridOverlay.style.display === 'grid';
    gridOverlay.style.display = isVisible ? 'none' : 'grid';
    document.getElementById('gridIcon').style.color = isVisible ? 'white' : '#f7d8ba';
}

function capture() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    // HD Photo Mode resolution logic
    if (currentMode === 'hd-photo') {
        canvas.width = video.videoWidth * 2; // Super-sampling simulation
        canvas.height = video.videoHeight * 2;
        ctx.imageSmoothingQuality = 'high';
    } else {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 1.0);
    document.getElementById('thumbImg').src = data;
    document.getElementById('thumbImg').style.display = 'block';
}

shutter.onclick = () => {
    if (currentMode.includes('photo')) capture();
};

function toggleCamera() {
    currentFacing = currentFacing === 'environment' ? 'user' : 'environment';
    startCamera(currentFacing);
}

// Initial Setup
window.onload = () => {
    startCamera(currentFacing);
    setMode(1, 'photo'); // Default selects index 1 (Photos)
};
