const DEEPFACE_API = process.env.DEEPFACE_API_URL || "https://api1.intuvo.co.uk";
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_CONCURRENCY = 4;

function parseEnvInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const DEEPFACE_TIMEOUT_MS = parseEnvInt(
  process.env.DEEPFACE_TIMEOUT_MS,
  DEFAULT_TIMEOUT_MS
);
const DEEPFACE_CONCURRENCY = parseEnvInt(
  process.env.DEEPFACE_CONCURRENCY,
  DEFAULT_CONCURRENCY
);

let activeRequests = 0;
const pendingRequests: Array<() => void> = [];

async function withConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  if (!Number.isFinite(DEEPFACE_CONCURRENCY) || DEEPFACE_CONCURRENCY <= 0) {
    return fn();
  }

  if (activeRequests >= DEEPFACE_CONCURRENCY) {
    await new Promise<void>((resolve) => pendingRequests.push(resolve));
  }

  activeRequests += 1;
  try {
    return await fn();
  } finally {
    activeRequests -= 1;
    const next = pendingRequests.shift();
    if (next) {
      next();
    }
  }
}

interface FaceEmbedding {
  embedding: number[];
  region?: { x: number; y: number; w: number; h: number };
  confidence?: number;
}

interface DeepFaceResult {
  faces: FaceEmbedding[];
  error?: string;
}

function parseFaces(data: unknown): FaceEmbedding[] {
  const rawFaces = Array.isArray((data as Record<string, unknown>)?.results)
    ? (data as Record<string, unknown>).results
    : Array.isArray(data)
      ? data
      : [];

  const faces: FaceEmbedding[] = [];

  for (const face of rawFaces as Record<string, unknown>[]) {
    if (Array.isArray(face.embedding)) {
      faces.push({
        embedding: face.embedding as number[],
        region: (face.facial_area || face.region) as FaceEmbedding["region"],
        confidence: (face.face_confidence || face.confidence) as number | undefined,
      });
    }
  }

  return faces;
}

export async function generateFaceNet512Embedding(
  imageUrl: string,
  enforceDetection: boolean = false
): Promise<DeepFaceResult> {
  return withConcurrency(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEEPFACE_TIMEOUT_MS);

    try {
      const response = await fetch(`${DEEPFACE_API}/represent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          img: imageUrl,
          model_name: "Facenet512",
          detector_backend: "retinaface",
          enforce_detection: enforceDetection,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const normalized = text.toLowerCase();

        if (
          normalized.includes("could not be detected") ||
          normalized.includes("no face") ||
          normalized.includes("no faces")
        ) {
          return { faces: [], error: "No face detected in image" };
        }

        return { faces: [], error: `DeepFace API error ${response.status}: ${text.slice(0, 200)}` };
      }

      const data = await response.json();
      const faces = parseFaces(data);

      return { faces };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { faces: [], error: `DeepFace request timed out after ${DEEPFACE_TIMEOUT_MS}ms` };
      }
      const message = err instanceof Error ? err.message : "Unknown error";
      return { faces: [], error: `DeepFace request failed: ${message}` };
    } finally {
      clearTimeout(timeout);
    }
  });
}

export async function generateEmbeddingFromBase64(
  base64Image: string,
  enforceDetection: boolean = false
): Promise<DeepFaceResult> {
  // DeepFace API can accept base64 directly with data URI prefix
  const imageData = base64Image.startsWith("data:")
    ? base64Image
    : `data:image/jpeg;base64,${base64Image}`;

  return generateFaceNet512Embedding(imageData, enforceDetection);
}
