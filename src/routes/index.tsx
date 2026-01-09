import { createFileRoute } from '@tanstack/react-router'
import { AlertCircle, Loader2 } from 'lucide-react'
import { PhotoUpload } from '@/components/search/photo-upload'
import { FaceSelector } from '@/components/search/face-selector'
import { SearchResults } from '@/components/search/search-results'
import { Button } from '@/components/ui/button'
import { useSearchFlow } from '@/hooks/use-search-flow'

export const Route = createFileRoute('/')({
  component: SearchPage,
})

function SearchPage() {
  const {
    state,
    isModelLoading,
    isSupported,
    detectError,
    handleUpload,
    handleFaceSelect,
    handlePageChange,
    handleNewSearch,
  } = useSearchFlow()

  const {
    step,
    detectedFaces,
    selectedFace,
    error,
    searchResults,
    queryImageUrl,
    pagination,
    isPageLoading,
    searchDuration,
  } = state

  if (isModelLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary" />
          <p className="text-lg">Loading face recognition models...</p>
          <p className="text-sm text-muted-foreground">
            This may take a few seconds
          </p>
        </div>
      </main>
    )
  }

  if (!isSupported || detectError) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
          <h2 className="text-xl font-semibold">Browser Not Supported</h2>
          <p className="text-muted-foreground">
            {detectError || 'Face detection requires Chrome 94 or later.'}
          </p>
          <p className="text-sm text-muted-foreground">
            Please use a supported browser to use this feature.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Face Search</h1>
          <p className="text-muted-foreground">
            Upload a photo to find matching faces in our database
          </p>
        </header>

        {error && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {step === 'upload' && (
          <PhotoUpload onUpload={handleUpload} isDisabled={isModelLoading} />
        )}

        {step === 'detecting' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p>Detecting faces...</p>
          </div>
        )}

        {step === 'select' && (
          <div className="space-y-6">
            <FaceSelector
              faces={detectedFaces}
              onSelect={handleFaceSelect}
              selectedId={selectedFace?.id}
            />
            <div className="flex justify-center">
              <Button variant="outline" onClick={handleNewSearch}>
                Upload Different Photo
              </Button>
            </div>
          </div>
        )}

        {step === 'searching' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p>Searching for matches...</p>
          </div>
        )}

        {step === 'results' && (
          <SearchResults
            results={searchResults}
            queryImage={queryImageUrl || undefined}
            onNewSearch={handleNewSearch}
            pagination={pagination || undefined}
            onPageChange={handlePageChange}
            isLoading={isPageLoading}
            searchDuration={searchDuration}
          />
        )}
      </div>
    </main>
  )
}
