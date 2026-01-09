export interface SearchResultPayload {
  faceImageUrl?: string;
  originalUrl?: string;
  name?: string;
  croppedImageUrl?: string;
  fullImageUrl?: string;
}

export interface SearchResult {
  id: string | number;
  score: number;
  payload?: SearchResultPayload;
}

export interface Pagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
