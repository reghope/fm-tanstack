import { QdrantClient } from "@qdrant/js-client-rest";

const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
const parsedUrl = new URL(qdrantUrl);

export const qdrantClient = new QdrantClient({
  url: `${parsedUrl.protocol}//${parsedUrl.hostname}`,
  port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : 6333,
  apiKey: process.env.QDRANT_API_KEY || undefined,
  checkCompatibility: false,
});

export const COLLECTION_NAME = process.env.QDRANT_COLLECTION || "faces";

export interface SearchResult {
  id: string | number;
  score: number;
  payload?: Record<string, unknown>;
}

export interface PaginatedSearchResult {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function searchFaces(
  embedding: number[],
  limit: number = 25,
  threshold: number = 0.6,
  offset: number = 0
): Promise<PaginatedSearchResult> {
  // Fetch more results to get total count (up to a reasonable max)
  const maxFetch = 500;
  const result = await qdrantClient.query(COLLECTION_NAME, {
    query: embedding,
    limit: maxFetch,
    score_threshold: threshold,
    with_payload: true,
  });

  const allResults = result.points.map((point) => ({
    id: point.id,
    score: point.score ?? 0,
    payload: point.payload as Record<string, unknown> | undefined,
  }));

  const total = allResults.length;
  const paginatedResults = allResults.slice(offset, offset + limit);

  return {
    results: paginatedResults,
    total,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  };
}

export interface FacePayload {
  croppedImageUrl?: string; // S3 URL of cropped face image
  fullImageUrl?: string; // S3 URL of full uploaded image
  source?: string; // Optional source identifier
  createdAt: string;
}

export async function upsertFace(
  embedding: number[],
  payload: FacePayload
): Promise<string> {
  const id = crypto.randomUUID();

  await qdrantClient.upsert(COLLECTION_NAME, {
    wait: true,
    points: [
      {
        id,
        vector: embedding,
        payload: payload as unknown as Record<string, unknown>,
      },
    ],
  });

  return id;
}

export interface FaceRecord {
  id: string;
  vector: number[];
  payload: FacePayload;
}

export async function getFaceById(id: string): Promise<FaceRecord | null> {
  try {
    const result = await qdrantClient.retrieve(COLLECTION_NAME, {
      ids: [id],
      with_payload: true,
      with_vector: true,
    });

    if (result.length === 0) {
      return null;
    }

    const point = result[0];
    return {
      id: point.id as string,
      vector: point.vector as number[],
      payload: point.payload as unknown as FacePayload,
    };
  } catch {
    return null;
  }
}

export async function searchSimilarFaces(
  faceId: string,
  limit: number = 25,
  threshold: number = 0.6,
  offset: number = 0
): Promise<PaginatedSearchResult> {
  const face = await getFaceById(faceId);
  if (!face) {
    return { results: [], total: 0, page: 1, pageSize: limit, totalPages: 0 };
  }

  // Fetch more results to get total count (up to a reasonable max)
  const maxFetch = 500;
  const result = await qdrantClient.query(COLLECTION_NAME, {
    query: face.vector,
    limit: maxFetch,
    score_threshold: threshold,
    with_payload: true,
  });

  const allResults = result.points
    .filter((point) => point.id !== faceId)
    .map((point) => ({
      id: point.id,
      score: point.score ?? 0,
      payload: point.payload as Record<string, unknown> | undefined,
    }));

  const total = allResults.length;
  const paginatedResults = allResults.slice(offset, offset + limit);

  return {
    results: paginatedResults,
    total,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function hasEmbeddingByS3Key(s3Key: string): Promise<boolean> {
  const result = await qdrantClient.scroll(COLLECTION_NAME, {
    filter: {
      must: [
        {
          key: "s3Key",
          match: { value: s3Key },
        },
      ],
    },
    limit: 1,
    with_payload: false,
    with_vector: false,
  });

  return result.points.length > 0;
}

export async function checkEmbeddingsByS3Keys(
  s3Keys: string[],
  concurrency: number = 10
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // Process in batches with concurrency limit
  for (let i = 0; i < s3Keys.length; i += concurrency) {
    const batch = s3Keys.slice(i, i + concurrency);
    const checks = await Promise.all(
      batch.map(async (key) => ({
        key,
        hasEmbedding: await hasEmbeddingByS3Key(key),
      }))
    );

    for (const { key, hasEmbedding } of checks) {
      results.set(key, hasEmbedding);
    }
  }

  return results;
}
