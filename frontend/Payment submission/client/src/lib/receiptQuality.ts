const MAX_ANALYSIS_SIDE = 1400;

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
  const worker = new Worker(new URL("./receiptQuality.worker.ts", import.meta.url));

  return new Promise<ReceiptQuality>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("The image quality check timed out. Please try again."));
    }, 45_000);

    worker.onmessage = (event: MessageEvent<WorkerResult>) => {
      window.clearTimeout(timeout);
      worker.terminate();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data);
    };

    worker.onerror = () => {
      window.clearTimeout(timeout);
      worker.terminate();
      reject(new Error("The image quality check could not be completed."));
    };

    worker.postMessage({ pixels: imageData.data.buffer, width: canvas.width, height: canvas.height }, [imageData.data.buffer]);
  });
}
