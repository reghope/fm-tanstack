import { useCallback, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AlertCircle, Loader2 } from 'lucide-react'
import { PhotoUpload } from '@/components/search/photo-upload'
import { FaceSelector } from '@/components/search/face-selector'
import { SearchResults } from '@/components/search/search-results'
import { useFaceDetection, type CroppedFace } from '@/hooks/use-face-detection'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: SearchPage,
})

type SearchStep = 'upload' | 'detecting' | 'select' | 'searching' | 'results'

interface SearchResult {
  id: string | number
  score: number
  payload?: Record<string, unknown>
}

interface Pagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function SearchPage() {
  const [step, setStep] = useState<SearchStep>('upload')
  const [fullImageData, setFullImageData] = useState<string | null>(null)
  const [detectedFaces, setDetectedFaces] = useState<CroppedFace[]>([])
  const [selectedFace, setSelectedFace] = useState<CroppedFace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [queryImageUrl, setQueryImageUrl] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [searchDuration, setSearchDuration] = useState<number | undefined>(
    undefined,
  )

  const {
    detectFaces,
    isLoading: detectLoading,
    isSupported,
    error: detectError,
  } = useFaceDetection()

  const isModelLoading = detectLoading

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null)
      setStep('detecting')

      try {
        const img = new Image()
        const imageUrl = URL.createObjectURL(file)

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Failed to load image'))
          img.src = imageUrl
        })

        const reader = new FileReader()
        const fullBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('Failed to read file'))
          reader.readAsDataURL(file)
        })
        setFullImageData(fullBase64)

        const faces = await detectFaces(img)
        setDetectedFaces(faces)

        if (faces.length === 0) {
          setError('No faces detected in the image. Please try another photo.')
          setStep('upload')
        } else if (faces.length === 1) {
          await handleFaceSelect(faces[0])
        } else {
          setStep('select')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process image')
        setStep('upload')
      }
    },
    [detectFaces],
  )

  const performSearch = async (
    face: CroppedFace,
    page: number = 1,
    isPageChange: boolean = false,
  ) => {
    if (isPageChange) {
      setIsPageLoading(true)
    } else {
      setStep('searching')
    }
    setError(null)

    const startTime = performance.now()

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          croppedImageData: face.imageData,
          fullImageData: isPageChange ? null : fullImageData,
          limit: 25,
          threshold: 0.6,
          page,
        }),
      })

      const data = await response.json()
      const endTime = performance.now()
      setSearchDuration(Math.round(endTime - startTime))

      if (!response.ok) {
        throw new Error(data.error || 'Search failed')
      }

      setSearchResults(data.results || [])
      setPagination(data.pagination || null)
      if (!isPageChange) {
        setQueryImageUrl(data.query?.croppedImageUrl || face.imageData)
      }
      setStep('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      if (!isPageChange) {
        setStep('select')
      }
    } finally {
      setIsPageLoading(false)
    }
  }

  const handleFaceSelect = async (face: CroppedFace) => {
    setSelectedFace(face)
    await performSearch(face, 1, false)
  }

  const handlePageChange = async (page: number) => {
    if (selectedFace) {
      await performSearch(selectedFace, page, true)
    }
  }

  const handleNewSearch = () => {
    setStep('upload')
    setFullImageData(null)
    setDetectedFaces([])
    setSelectedFace(null)
    setError(null)
    setSearchResults([])
    setQueryImageUrl(null)
    setPagination(null)
    setIsPageLoading(false)
    setSearchDuration(undefined)
  }

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
