const OPENCV_URL = "https://docs.opencv.org/4.x/opencv.js";
const BLUR_THRESHOLD = 40;
let openCvPromise: Promise<any> | null = null;

function loadOpenCv() {
  if (openCvPromise) return openCvPromise;
  openCvPromise = new Promise((resolve, reject) => {
    try {
      const loadScript = (globalThis as unknown as { importScripts: (...urls: string[]) => void }).importScripts;
      loadScript(OPENCV_URL);
      const cv = (self as any).cv;
      if (!cv) {
        reject(new Error("OpenCV could not be loaded."));
        return;
      }
      if (cv.Mat) {
        resolve(cv);
        return;
      }
      cv.onRuntimeInitialized = () => resolve(cv);
      setTimeout(() => reject(new Error("OpenCV initialization timed out.")), 30_000);
    } catch (error) {
      reject(error);
    }
  });
  return openCvPromise;
}

self.onmessage = async (event: MessageEvent<{ pixels: ArrayBuffer; width: number; height: number }>) => {
  const { pixels, width, height } = event.data;
  try {
    const cv = await loadOpenCv();
    const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);
    const source = cv.matFromImageData(imageData);
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
      const isTooBlurry = sharpness < BLUR_THRESHOLD;

      let message: string | undefined;
      if (isTooDark && isTooBlurry) message = "This receipt looks too dark and blurry. Please upload a brighter, clearer copy.";
      else if (isTooDark) message = "This receipt looks too dark to read. Please upload a brighter image.";
      else if (isTooBlurry) message = "This receipt looks blurry. Please upload a sharper image where the details are readable.";

      self.postMessage({ ok: !message, brightness, sharpness, message });
    } finally {
      source.delete();
      gray.delete();
      laplacian.delete();
      mean.delete();
      stddev.delete();
    }
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : "OpenCV could not analyze this image." });
  }
};
