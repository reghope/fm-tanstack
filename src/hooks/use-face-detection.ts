import { useState, useEffect, useCallback, useRef } from "react";

export interface CroppedFace {
  id: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  imageData: string; // Base64 cropped face image
}

interface FaceDetectionResult {
  detectFaces: (image: HTMLImageElement | HTMLCanvasElement) => Promise<CroppedFace[]>;
  isLoading: boolean;
  isSupported: boolean;
  error: string | null;
}

// Use type any for faceapi since we're loading it dynamically
type FaceApiModule = typeof import("@vladmandic/face-api");

export function useFaceDetection(): FaceDetectionResult {
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const faceapiRef = useRef<FaceApiModule | null>(null);

  useEffect(() => {
    async function loadModels() {
      try {
        // Dynamic import to avoid SSR issues
        const faceapi = await import("@vladmandic/face-api");
        faceapiRef.current = faceapi;

        const MODEL_URL = "/models";

        // Load the models
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        setIsReady(true);
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load face-api models:", err);
        setError(`Failed to load face detection models: ${err}`);
        setIsLoading(false);
      }
    }

    loadModels();
  }, []);

  const detectFaces = useCallback(
    async (image: HTMLImageElement | HTMLCanvasElement): Promise<CroppedFace[]> => {
      const faceapi = faceapiRef.current;
      if (!isReady || !faceapi) {
        throw new Error("Face detection models not loaded");
      }

      try {
        // Detect all faces with landmarks
        const detections = await faceapi
          .detectAllFaces(image, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks();

        if (detections.length === 0) {
          return [];
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Could not get canvas context");
        }

        const croppedFaces: CroppedFace[] = detections.map((detection, index) => {
          const box = detection.detection.box;
          const imgWidth = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
          const imgHeight = image instanceof HTMLImageElement ? image.naturalHeight : image.height;

          // Calculate square crop centered on face
          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;
          const faceSize = Math.max(box.width, box.height);
          const padding = 0.4;
          let cropSize = faceSize * (1 + padding * 2);

          // Ensure crop fits within image
          const maxSize = Math.min(
            centerX * 2,
            (imgWidth - centerX) * 2,
            centerY * 2,
            (imgHeight - centerY) * 2,
            imgWidth,
            imgHeight
          );
          cropSize = Math.min(cropSize, maxSize);

          const cropX = centerX - cropSize / 2;
          const cropY = centerY - cropSize / 2;

          // Draw to square canvas
          canvas.width = 256;
          canvas.height = 256;
          ctx.drawImage(
            image,
            cropX,
            cropY,
            cropSize,
            cropSize,
            0,
            0,
            256,
            256
          );

          return {
            id: `face-${index}`,
            bbox: {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
            },
            confidence: detection.detection.score,
            imageData: canvas.toDataURL("image/jpeg", 0.9),
          };
        });

        return croppedFaces;
      } catch (err) {
        throw new Error(`Face detection failed: ${err}`);
      }
    },
    [isReady]
  );

  return {
    detectFaces,
    isLoading,
    isSupported: true,
    error,
  };
}
