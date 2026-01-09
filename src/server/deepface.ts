const DEEPFACE_API = process.env.DEEPFACE_API_URL || "https://api1.intuvo.co.uk";

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
    const message = err instanceof Error ? err.message : "Unknown error";
    return { faces: [], error: `DeepFace request failed: ${message}` };
  }
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
