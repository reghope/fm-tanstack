import { useCallback, useReducer } from 'react'
import { useFaceDetection, type CroppedFace } from '@/hooks/use-face-detection'
import type { Pagination, SearchResult } from '@/shared/search-types'

type SearchStep = 'upload' | 'detecting' | 'select' | 'searching' | 'results'

interface SearchState {
  step: SearchStep
  fullImageData: string | null
  detectedFaces: CroppedFace[]
  selectedFace: CroppedFace | null
  error: string | null
  searchResults: SearchResult[]
  queryImageUrl: string | null
  pagination: Pagination | null
  isPageLoading: boolean
  searchDuration: number | undefined
}

type SearchAction =
  | { type: 'reset' }
  | { type: 'setStep'; step: SearchStep }
  | { type: 'setFullImageData'; data: string | null }
  | { type: 'setDetectedFaces'; faces: CroppedFace[] }
  | { type: 'setSelectedFace'; face: CroppedFace | null }
  | { type: 'setError'; error: string | null }
  | { type: 'searchStart'; isPageChange: boolean }
  | {
      type: 'searchSuccess'
      results: SearchResult[]
      pagination: Pagination | null
      queryImageUrl: string | null
      searchDuration: number
      isPageChange: boolean
    }
  | { type: 'searchError'; error: string; isPageChange: boolean }

const initialState: SearchState = {
  step: 'upload',
  fullImageData: null,
  detectedFaces: [],
  selectedFace: null,
  error: null,
  searchResults: [],
  queryImageUrl: null,
  pagination: null,
  isPageLoading: false,
  searchDuration: undefined,
}

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case 'reset':
      return initialState
    case 'setStep':
      return { ...state, step: action.step }
    case 'setFullImageData':
      return { ...state, fullImageData: action.data }
    case 'setDetectedFaces':
      return { ...state, detectedFaces: action.faces }
    case 'setSelectedFace':
      return { ...state, selectedFace: action.face }
    case 'setError':
      return { ...state, error: action.error }
    case 'searchStart':
      return {
        ...state,
        error: null,
        isPageLoading: action.isPageChange,
        step: action.isPageChange ? state.step : 'searching',
        searchDuration: action.isPageChange ? state.searchDuration : undefined,
      }
    case 'searchSuccess':
      return {
        ...state,
        error: null,
        searchResults: action.results,
        pagination: action.pagination,
        queryImageUrl: action.isPageChange
          ? state.queryImageUrl
          : action.queryImageUrl,
        step: 'results',
        isPageLoading: false,
        searchDuration: action.searchDuration,
      }
    case 'searchError':
      return {
        ...state,
        error: action.error,
        isPageLoading: false,
        step: action.isPageChange ? state.step : 'select',
      }
    default:
      return state
  }
}

export function useSearchFlow() {
  const [state, dispatch] = useReducer(searchReducer, initialState)
  const {
    detectFaces,
    isLoading: detectLoading,
    isSupported,
    error: detectError,
  } = useFaceDetection()

  const performSearch = useCallback(
    async (
      face: CroppedFace,
      page: number = 1,
      isPageChange: boolean = false,
      fullImageOverride?: string | null,
    ) => {
      dispatch({ type: 'searchStart', isPageChange })

      const startTime = performance.now()

      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            croppedImageData: face.imageData,
            fullImageData: isPageChange
              ? null
              : fullImageOverride ?? state.fullImageData,
            limit: 25,
            threshold: 0.6,
            page,
          }),
        })

        const data = await response.json()
        const endTime = performance.now()
        const duration = Math.round(endTime - startTime)

        if (!response.ok) {
          throw new Error(data.error || 'Search failed')
        }

        dispatch({
          type: 'searchSuccess',
          results: data.results || [],
          pagination: data.pagination || null,
          queryImageUrl: isPageChange
            ? state.queryImageUrl
            : data.query?.croppedImageUrl || face.imageData,
          searchDuration: duration,
          isPageChange,
        })
      } catch (err) {
        dispatch({
          type: 'searchError',
          error: err instanceof Error ? err.message : 'Search failed',
          isPageChange,
        })
      }
    },
    [state.fullImageData, state.queryImageUrl],
  )

  const handleFaceSelect = useCallback(
    async (face: CroppedFace, fullImageOverride?: string | null) => {
      dispatch({ type: 'setSelectedFace', face })
      await performSearch(face, 1, false, fullImageOverride)
    },
    [performSearch],
  )

  const handleUpload = useCallback(
    async (file: File) => {
      dispatch({ type: 'setError', error: null })
      dispatch({ type: 'setStep', step: 'detecting' })

      let imageUrl: string | null = null

      try {
        const img = new Image()
        imageUrl = URL.createObjectURL(file)

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
        dispatch({ type: 'setFullImageData', data: fullBase64 })

        const faces = await detectFaces(img)
        dispatch({ type: 'setDetectedFaces', faces })

        if (faces.length === 0) {
          dispatch({
            type: 'setError',
            error: 'No faces detected in the image. Please try another photo.',
          })
          dispatch({ type: 'setStep', step: 'upload' })
        } else if (faces.length === 1) {
          await handleFaceSelect(faces[0], fullBase64)
        } else {
          dispatch({ type: 'setStep', step: 'select' })
        }
      } catch (err) {
        dispatch({
          type: 'setError',
          error: err instanceof Error ? err.message : 'Failed to process image',
        })
        dispatch({ type: 'setStep', step: 'upload' })
      } finally {
        if (imageUrl) {
          URL.revokeObjectURL(imageUrl)
        }
      }
    },
    [detectFaces, handleFaceSelect],
  )

  const handlePageChange = useCallback(
    async (page: number) => {
      if (state.selectedFace) {
        await performSearch(state.selectedFace, page, true)
      }
    },
    [performSearch, state.selectedFace],
  )

  const handleNewSearch = useCallback(() => {
    dispatch({ type: 'reset' })
  }, [])

  return {
    state,
    isModelLoading: detectLoading,
    isSupported,
    detectError,
    handleUpload,
    handleFaceSelect,
    handlePageChange,
    handleNewSearch,
  }
}
