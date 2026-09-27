const MAX_ANALYSIS_SIDE = 1400;
const OPENCV_FALLBACK_AFTER_MS = 5_000;
const BLUR_THRESHOLD = 40;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The image could not be read."));
    };
    image.src = url;
  });
}

export type ReceiptQuality = {
  ok: boolean;
  brightness: number;
  sharpness: number;
  message?: string;
};

type WorkerResult = ReceiptQuality & { error?: string };

function qualityResult(brightness: number, sharpness: number): ReceiptQuality {
  const isTooDark = brightness < 58;
  const isTooBlurry = sharpness < BLUR_THRESHOLD;
  let message: string | undefined;
  if (isTooDark && isTooBlurry) message = "This receipt looks too dark and blurry. Please upload a brighter, clearer copy.";
  else if (isTooDark) message = "This receipt looks too dark to read. Please upload a brighter image.";
  else if (isTooBlurry) message = "This receipt looks blurry. Please upload a sharper image where the details are readable.";
  return { ok: !message, brightness, sharpness, message };
}

/**
 * Lightweight Laplacian-style variance fallback. It uses the same brightness
 * and sharpness concepts as the OpenCV path, but avoids a large runtime/CDN
 * dependency when OpenCV.js is slow or unavailable.
 */
function analyzePixels(pixels: Uint8ClampedArray, width: number, height: number): ReceiptQuality {
  const step = Math.max(1, Math.floor(Math.max(width, height) / 900));
  let brightnessSum = 0;
  let brightnessCount = 0;
  let laplacianSum = 0;
  let laplacianSquareSum = 0;
  let laplacianCount = 0;

  const grayAt = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    return 0.299 * pixels[offset] + 0.587 * pixels[offset + 1] + 0.114 * pixels[offset + 2];
  };

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      brightnessSum += grayAt(x, y);
      brightnessCount += 1;
      if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
        const center = grayAt(x, y);
        const laplacian = 4 * center - grayAt(x - 1, y) - grayAt(x + 1, y) - grayAt(x, y - 1) - grayAt(x, y + 1);
        laplacianSum += laplacian;
        laplacianSquareSum += laplacian * laplacian;
        laplacianCount += 1;
      }
    }
  }

  const brightness = brightnessSum / Math.max(1, brightnessCount);
  const laplacianMean = laplacianSum / Math.max(1, laplacianCount);
  const sharpness = laplacianSquareSum / Math.max(1, laplacianCount) - laplacianMean ** 2;
  return qualityResult(brightness, Math.max(0, sharpness));
}

export async function analyzeReceiptImage(file: File): Promise<ReceiptQuality> {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_ANALYSIS_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("The image could not be analyzed.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const fallbackPixels = new Uint8ClampedArray(imageData.data);
  const worker = new Worker(new URL("./receiptQuality.worker.ts", import.meta.url));

  return new Promise<ReceiptQuality>((resolve) => {
    let settled = false;
    const finish = (result: ReceiptQuality) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackTimer);
      worker.terminate();
      resolve(result);
    };

    const fallbackTimer = window.setTimeout(() => {
      finish(analyzePixels(fallbackPixels, canvas.width, canvas.height));
    }, OPENCV_FALLBACK_AFTER_MS);

    worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      if (event.data.error) {
        finish(analyzePixels(fallbackPixels, canvas.width, canvas.height));
      } else {
        finish(event.data);
      }
    };

    worker.onerror = () => {
      finish(analyzePixels(fallbackPixels, canvas.width, canvas.height));
    };

    worker.postMessage({ pixels: imageData.data.buffer, width: canvas.width, height: canvas.height }, [imageData.data.buffer]);
  });
}
