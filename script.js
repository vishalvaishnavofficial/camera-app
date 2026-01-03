const video = document.getElementById('videoFeed');
const modeTrack = document.getElementById('modeTrack');
const viewport = document.getElementById('viewport');
const thumbImg = document.getElementById('thumbImg');
const galleryIcon = document.getElementById('galleryIcon');
const shutter = document.getElementById('shutter');

let currentFacing = "environment";
let currentMode = "photo";

async function startCamera(face) {
    if (video.srcObject) { video.srcObject.getTracks().forEach(t => t.stop()); }
    const constraints = { video: { facingMode: face, width: { ideal: 3840 }, height: { ideal: 2160 } } };
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        applyZoom(1); // Force 1x on start
    } catch (e) { console.error("Camera Error:", e); }
}

function setMode(idx, mode) {
    currentMode = mode;
    const itemWidth = 100;
    // Calculation to center the active item
    const offset = -(idx * itemWidth) + (itemWidth / 2) - 50;
    modeTrack.style.transform = `translateX(${offset}px)`;

    document.querySelectorAll('.mode-item').forEach((m, i) => m.classList.toggle('active', i === idx));
    
    const overlay = document.getElementById('modeOverlay');
    document.getElementById('overlayText').innerText = mode.replace('-', ' ').toUpperCase();
    overlay.style.display = 'flex';
    setTimeout(() => overlay.style.display = 'none', 500);
}

function toggleRatio() {
    const label = document.getElementById('ratioLabel');
    if (label.innerText === 'Full') {
        label.innerText = '4:3';
        viewport.style.aspectRatio = "3/4";
        viewport.style.height = "auto";
    } else if (label.innerText === '4:3') {
        label.innerText = '16:9';
        viewport.style.aspectRatio = "9/16";
        viewport.style.height = "auto";
    } else {
        label.innerText = 'Full';
        viewport.style.aspectRatio = "auto";
        viewport.style.height = "100%";
    }
}

function applyZoom(val) {
    video.style.transform = `translate(-50%, -50%) scale(${val})`;
    document.querySelectorAll('.zoom-dot').forEach(dot => {
        const dotVal = dot.id === 'dot05' ? 0.7 : parseFloat(dot.innerText);
        dot.classList.toggle('active', dotVal === val);
    });
}

function capture() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    if (currentMode === 'hd-photo') ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const data = canvas.toDataURL('image/jpeg', 1.0);
    
    // 1. Instant Download
    const link = document.createElement('a');
    link.download = `PixelSense_${Date.now()}.jpg`;
    link.href = data;
    link.click();

    // 2. Save to Gallery Storage
    let photos = JSON.parse(localStorage.getItem('userPhotos') || '[]');
    photos.unshift(data);
    if (photos.length > 24) photos.pop(); // Limit storage
    localStorage.setItem('userPhotos', JSON.stringify(photos));

    // 3. Update Preview
    thumbImg.src = data;
    thumbImg.style.display = 'block';
    galleryIcon.style.display = 'none';
}

function openGalleryPage() { window.location.href = 'gallery.html'; }

function toggleCamera() {
    currentFacing = currentFacing === 'environment' ? 'user' : 'environment';
    startCamera(currentFacing);
}

shutter.onclick = () => { if (currentMode.includes('photo')) capture(); };

window.onload = () => {
    startCamera(currentFacing);
    setMode(1, 'photo');
};
