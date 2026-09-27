type OpenCv = {
  Mat: new () => any;
  CV_64F: number;
  COLOR_RGBA2GRAY: number;
  Laplacian: (src: any, dst: any, depth: number) => void;
  cvtColor: (src: any, dst: any, code: number) => void;
  meanStdDev: (src: any, mean: any, stddev: any) => void;
  imread: (source: HTMLCanvasElement) => any;
  resize: (src: any, dst: any, size: any, fx: number, fy: number, interpolation: number) => void;
  Size: new (width: number, height: number) => any;
  INTER_AREA: number;
};

declare global {
  interface Window {
    cv?: OpenCv & { onRuntimeInitialized?: () => void };
  }
}

const OPENCV_URL = "https://docs.opencv.org/4.x/opencv.js";
let openCvPromise: Promise<OpenCv> | null = null;

function loadOpenCv() {
  if (openCvPromise) return openCvPromise;

  openCvPromise = new Promise<OpenCv>((resolve, reject) => {
    const startedAt = Date.now();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${OPENCV_URL}"]`);
    const script = existing ?? document.createElement("script");

    if (!existing) {
      script.src = OPENCV_URL;
      script.async = true;
      document.head.appendChild(script);
    }

    const poll = () => {
      if (window.cv?.Mat) {
        resolve(window.cv);
        return;
      }
      if (Date.now() - startedAt > 30_000) {
        reject(new Error("OpenCV could not be loaded."));
        return;
      }
      window.setTimeout(poll, 100);
    };

    script.addEventListener("error", () => reject(new Error("OpenCV could not be loaded.")), { once: true });
    poll();
  });

  return openCvPromise;
}

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

export async function analyzeReceiptImage(file: File): Promise<ReceiptQuality> {
  const cv = await loadOpenCv();
  const image = await loadImage(file);
  const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("The image could not be analyzed.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const source = cv.imread(canvas);
  const gray = new cv.Mat();
  const laplacian = new cv.Mat();
  const mean = new cv.Mat();
  const stddev = new cv.Mat();

  try {
    if (source.channels() === 4) cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    else source.copyTo(gray);
    cv.meanStdDev(gray, mean, stddev);
    const brightness = Number(mean.doubleAt(0, 0));
    cv.Laplacian(gray, laplacian, cv.CV_64F);
    cv.meanStdDev(laplacian, mean, stddev);
    const sharpness = Number(stddev.doubleAt(0, 0)) ** 2;
    const isTooDark = brightness < 58;
    const isTooBlurry = sharpness < 8;

    if (isTooDark && isTooBlurry) {
      return { ok: false, brightness, sharpness, message: "This receipt looks too dark and blurry. Please upload a brighter, clearer copy." };
    }
    if (isTooDark) {
      return { ok: false, brightness, sharpness, message: "This receipt looks too dark to read. Please upload a brighter image." };
    }
    if (isTooBlurry) {
      return { ok: false, brightness, sharpness, message: "This receipt looks blurry. Please upload a sharper image where the details are readable." };
    }
    return { ok: true, brightness, sharpness };
  } finally {
    source.delete();
    gray.delete();
    laplacian.delete();
    mean.delete();
    stddev.delete();
  }
}
