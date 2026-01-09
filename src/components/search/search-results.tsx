import { useState } from "react";
import { ExternalLink, Copy, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import type { Pagination, SearchResult } from "@/shared/search-types";

function truncateId(id: string | number): string {
  const str = String(id);
  if (str.length <= 12) return str;
  return `${str.slice(0, 8)}...${str.slice(-4)}`;
}

interface SearchResultsProps {
  results: SearchResult[];
  queryImage?: string; // Base64 image of the searched face
  onNewSearch: () => void;
  pagination?: Pagination;
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
  searchDuration?: number; // Search duration in milliseconds
}

function ResultCard({ result }: { result: SearchResult }) {
  const [copied, setCopied] = useState(false);

  const faceImageUrl = result.payload?.faceImageUrl;
  const originalUrl = result.payload?.originalUrl;
  const matchPercent = (result.score * 100).toFixed(1);
  const displayId = truncateId(result.id);
  const fullId = String(result.id);

  const copyId = async () => {
    await navigator.clipboard.writeText(fullId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract domain from URL for cleaner display
  const getSourceDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  };

  return (
    <Card className="overflow-hidden group">
      {/* Face Image */}
      {faceImageUrl && (
        <div className="relative aspect-square bg-muted">
          <img
            src={faceImageUrl}
            alt="Match"
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
          {/* Match percentage badge */}
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-md text-sm font-semibold">
            {matchPercent}%
          </div>
        </div>
      )}

      {/* Original URL - Prominent placement directly under image */}
      {originalUrl && (
        <a
          href={originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-3 py-2 bg-muted/50 border-b text-xs text-muted-foreground hover:text-primary hover:bg-muted transition-colors truncate"
          title={originalUrl}
        >
          <span className="font-medium">{getSourceDomain(originalUrl)}</span>
          <span className="opacity-60 ml-1">
            {originalUrl.replace(/^https?:\/\/(www\.)?[^/]+/, "")}
          </span>
        </a>
      )}

      <CardContent className="p-3 space-y-3">
        {/* Match ID with copy */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {result.payload?.name || `#${displayId}`}
            </span>
            <button
              onClick={copyId}
              className="text-muted-foreground hover:text-primary transition-colors p-1 rounded"
              title="Copy full ID"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
          {originalUrl && (
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors p-1"
              title="View original"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${result.score * 100}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function SearchResults({
  results,
  queryImage,
  onNewSearch,
  pagination,
  onPageChange,
  isLoading,
  searchDuration,
}: SearchResultsProps) {
  const totalResults = pagination?.total ?? results.length;
  const currentPage = pagination?.page ?? 1;
  const totalPages = pagination?.totalPages ?? 1;

  if (results.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12 space-y-4">
        {queryImage && (
          <div className="flex justify-center mb-4">
            <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-muted">
              <img
                src={queryImage}
                alt="Searched face"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </div>
        )}
        <p className="text-lg text-muted-foreground">No matching faces found</p>
        <Button onClick={onNewSearch}>Try Another Photo</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        {queryImage && (
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-primary flex-shrink-0">
              <img
                src={queryImage}
                alt="Searched face"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Searching for</p>
              <h2 className="text-lg font-semibold">
                {totalResults} match{totalResults !== 1 ? "es" : ""} found
              </h2>
            </div>
          </div>
        )}
        {!queryImage && (
          <h2 className="text-xl font-semibold">
            Found {totalResults} match{totalResults !== 1 ? "es" : ""}
          </h2>
        )}
        <Button variant="outline" onClick={onNewSearch}>
          New Search
        </Button>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${isLoading ? "opacity-50 pointer-events-none" : ""}`}>
        {results.map((result) => (
          <ResultCard key={result.id} result={result} />
        ))}
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {/* Page numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => {
                // Show first, last, current, and adjacent pages
                if (page === 1 || page === totalPages) return true;
                if (Math.abs(page - currentPage) <= 1) return true;
                return false;
              })
              .reduce<(number | string)[]>((acc, page, idx, arr) => {
                // Add ellipsis between gaps
                if (idx > 0) {
                  const prev = arr[idx - 1];
                  if (page - prev > 1) {
                    acc.push("...");
                  }
                }
                acc.push(page);
                return acc;
              }, [])
              .map((item, idx) => (
                typeof item === "number" ? (
                  <Button
                    key={idx}
                    variant={item === currentPage ? "default" : "outline"}
                    size="sm"
                    className="w-9 h-9 p-0"
                    onClick={() => onPageChange?.(item)}
                    disabled={isLoading}
                  >
                    {item}
                  </Button>
                ) : (
                  <span key={idx} className="text-muted-foreground px-1">
                    {item}
                  </span>
                )
              ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Results info */}
      <p className="text-center text-sm text-muted-foreground">
        {pagination ? (
          <>Showing {((currentPage - 1) * pagination.pageSize) + 1}-{Math.min(currentPage * pagination.pageSize, totalResults)} of {totalResults} results</>
        ) : (
          <>{totalResults} result{totalResults !== 1 ? "s" : ""}</>
        )}
        {searchDuration !== undefined && (
          <span className="ml-2 text-muted-foreground/70">
            ({searchDuration < 1000 ? `${searchDuration}ms` : `${(searchDuration / 1000).toFixed(2)}s`})
          </span>
        )}
      </p>
    </div>
  );
}
