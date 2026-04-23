let activeMode = null;
let activeVideoStream = null;
let barcodeDetector = null;
let scanLoopHandle = null;
let html5Scanner = null;
let html5ScriptPromise = null;

function stopNativeLoop() {
  if (scanLoopHandle) {
    cancelAnimationFrame(scanLoopHandle);
    scanLoopHandle = null;
  }
}

function stopVideoTracks() {
  if (activeVideoStream) {
    activeVideoStream.getTracks().forEach((track) => track.stop());
    activeVideoStream = null;
  }
}

async function loadHtml5QrcodeScript() {
  if (window.Html5Qrcode) return window.Html5Qrcode;
  if (html5ScriptPromise) return html5ScriptPromise;
  html5ScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js';
    script.async = true;
    script.onload = () => resolve(window.Html5Qrcode);
    script.onerror = () => reject(new Error('html5-qrcode fallback library failed to load.'));
    document.head.appendChild(script);
  });
  return html5ScriptPromise;
}

function supportsBarcodeDetector() {
  return 'BarcodeDetector' in window;
}

async function startBarcodeDetector(videoEl, statusEl, onCode) {
  barcodeDetector = barcodeDetector || new window.BarcodeDetector({ formats: ['qr_code'] });
  activeVideoStream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  });

  videoEl.srcObject = activeVideoStream;
  await videoEl.play();
  activeMode = 'barcode-detector';
  if (statusEl) statusEl.textContent = 'Scanner running with BarcodeDetector.';

  const loop = async () => {
    if (activeMode !== 'barcode-detector') return;
    if (!videoEl.srcObject || videoEl.readyState < 2) {
      scanLoopHandle = requestAnimationFrame(loop);
      return;
    }
    try {
      const codes = await barcodeDetector.detect(videoEl);
      const found = codes?.[0]?.rawValue;
      if (found) {
        onCode(found, 'barcode-detector');
        await stopQrScanner();
        return;
      }
    } catch (error) {
      console.error('BarcodeDetector detect failed', error);
      throw error;
    }
    scanLoopHandle = requestAnimationFrame(loop);
  };

  scanLoopHandle = requestAnimationFrame(loop);
}

async function startHtml5Fallback(readerEl, statusEl, onCode) {
  await loadHtml5QrcodeScript();
  if (!window.Html5Qrcode) throw new Error('html5-qrcode is unavailable.');
  readerEl.hidden = false;
  activeMode = 'html5-qrcode';
  html5Scanner = new window.Html5Qrcode(readerEl.id, { verbose: false });
  const cameras = await window.Html5Qrcode.getCameras();
  const preferred = cameras.find((cam) => /back|rear|environment/i.test(cam.label || '')) || cameras[0];
  if (!preferred) throw new Error('No camera found for QR scanning.');

  await html5Scanner.start(
    preferred.id,
    {
      fps: 10,
      qrbox: { width: 220, height: 220 },
      aspectRatio: 1.333334
    },
    async (decodedText) => {
      onCode(decodedText, 'html5-qrcode');
      await stopQrScanner();
    },
    () => {}
  );

  if (statusEl) statusEl.textContent = 'Scanner running with html5-qrcode fallback.';
}

export async function startQrScanner({ videoEl, readerEl, statusEl, onCode }) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera scanning is not supported on this browser.');
  }

  await stopQrScanner();

  if (readerEl) {
    readerEl.hidden = true;
    readerEl.innerHTML = '';
  }

  if (videoEl) {
    videoEl.hidden = false;
    videoEl.srcObject = null;
  }

  if (supportsBarcodeDetector()) {
    try {
      await startBarcodeDetector(videoEl, statusEl, onCode);
      return { mode: 'barcode-detector' };
    } catch (error) {
      console.warn('Falling back from BarcodeDetector scanner', error);
      stopNativeLoop();
      stopVideoTracks();
      if (videoEl) {
        videoEl.pause?.();
        videoEl.srcObject = null;
        videoEl.hidden = true;
      }
    }
  }

  await startHtml5Fallback(readerEl, statusEl, onCode);
  return { mode: 'html5-qrcode' };
}

export async function stopQrScanner() {
  stopNativeLoop();
  stopVideoTracks();

  if (html5Scanner) {
    try {
      if (html5Scanner.isScanning) await html5Scanner.stop();
      await html5Scanner.clear();
    } catch (error) {
      console.warn('Unable to stop html5-qrcode cleanly', error);
    }
    html5Scanner = null;
  }

  activeMode = null;
}

export function scannerCapabilities() {
  return {
    barcodeDetector: supportsBarcodeDetector(),
    camera: Boolean(navigator.mediaDevices?.getUserMedia),
    html5QrcodeLoaded: Boolean(window.Html5Qrcode)
  };
}
