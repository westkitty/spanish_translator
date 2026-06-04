import { useState, useCallback, useEffect, useRef } from 'react';

interface UploadState {
  uploadId: string;
  nextChunkIndex: number;
  totalChunks: number;
  fileName: string;
  fileSize: number;
}

interface UseChunkUploaderOptions {
  chunkSize?: number;      // defaults to 5MB
  maxRetries?: number;      // defaults to 3
  uploadEndpoint?: string; // defaults to '/api/upload-chunk'
}

export function useChunkUploader(options: UseChunkUploaderOptions = {}) {
  const {
    chunkSize = 5 * 1024 * 1024, // 5MB
    maxRetries = 3,
    uploadEndpoint = '/api/upload-chunk',
  } = options;

  const [uploadId, setUploadId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [pendingResume, setPendingResume] = useState<UploadState | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isUploadingRef = useRef(false);

  // Check if there is an unfinished upload in localStorage for the selected file
  const checkResumeState = useCallback((file: File): UploadState | null => {
    const key = `upload_resume_${file.name}_${file.size}_${file.lastModified}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        return JSON.parse(cached) as UploadState;
      } catch (e) {
        localStorage.removeItem(key);
      }
    }
    return null;
  }, []);

  // Update file and check if we can resume
  const setFile = useCallback((file: File) => {
    setCurrentFile(file);
    setError(null);
    setProgress(0);
    setUploadId(null);
    const resumeState = checkResumeState(file);
    if (resumeState) {
      setPendingResume(resumeState);
    } else {
      setPendingResume(null);
    }
  }, [checkResumeState]);

  // Upload helper with retries
  const uploadChunkWithRetry = async (
    chunk: Blob,
    chunkIndex: number,
    state: UploadState,
    retryCount = 0
  ): Promise<Response> => {
    const headers = new Headers();
    headers.append('Content-Type', 'application/octet-stream');
    headers.append('X-Upload-ID', state.uploadId);
    headers.append('X-Chunk-Index', chunkIndex.toString());
    headers.append('X-Total-Chunks', state.totalChunks.toString());
    headers.append('X-File-Name', encodeURIComponent(state.fileName));

    try {
      const response = await fetch(uploadEndpoint, {
        method: 'PUT',
        headers,
        body: chunk,
        signal: abortControllerRef.current?.signal,
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      // Guard against the dev proxy / SPA fallback returning index.html with a
      // 200 status, which would otherwise be treated as a successful chunk.
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          `Expected JSON ack but received '${contentType || 'unknown'}'. Is the ingestion server running on port 8000?`
        );
      }

      return response;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 200;
        console.warn(`Chunk ${chunkIndex} failed. Retrying in ${delay.toFixed(0)}ms...`, err);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return uploadChunkWithRetry(chunk, chunkIndex, state, retryCount + 1);
      }
      throw err;
    }
  };

  const startUploadInternal = async (file: File, resumeState?: UploadState) => {
    if (isUploadingRef.current) return;
    setIsUploading(true);
    isUploadingRef.current = true;
    setError(null);
    abortControllerRef.current = new AbortController();

    const totalChunks = Math.ceil(file.size / chunkSize);
    const resumeKey = `upload_resume_${file.name}_${file.size}_${file.lastModified}`;

    let uploadState: UploadState;
    if (resumeState) {
      uploadState = resumeState;
    } else {
      uploadState = {
        uploadId: "job_" + Math.random().toString(36).substring(2, 15),
        nextChunkIndex: 0,
        totalChunks,
        fileName: file.name,
        fileSize: file.size,
      };
      localStorage.setItem(resumeKey, JSON.stringify(uploadState));
    }

    setUploadId(uploadState.uploadId);
    setPendingResume(null);

    try {
      while (uploadState.nextChunkIndex < totalChunks) {
        // If aborted, stop
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Upload aborted');
        }

        const start = uploadState.nextChunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        // Upload chunk
        await uploadChunkWithRetry(chunk, uploadState.nextChunkIndex, uploadState);

        // Increment state and update cache
        uploadState.nextChunkIndex += 1;
        localStorage.setItem(resumeKey, JSON.stringify(uploadState));

        // Update progress
        const currentProgress = Math.round((uploadState.nextChunkIndex / totalChunks) * 100);
        setProgress(currentProgress);
      }

      // Success
      localStorage.removeItem(resumeKey);
      setProgress(100);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Upload failed');
      }
    } finally {
      setIsUploading(false);
      isUploadingRef.current = false;
    }
  };

  const startUpload = useCallback(async () => {
    if (!currentFile) return;
    await startUploadInternal(currentFile);
  }, [currentFile, chunkSize]);

  const resumeUpload = useCallback(async () => {
    if (!currentFile || !pendingResume) return;
    await startUploadInternal(currentFile, pendingResume);
  }, [currentFile, pendingResume]);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsUploading(false);
    isUploadingRef.current = false;
  }, []);

  const resetUploader = useCallback(() => {
    cancelUpload();
    if (currentFile) {
      const key = `upload_resume_${currentFile.name}_${currentFile.size}_${currentFile.lastModified}`;
      localStorage.removeItem(key);
    }
    setCurrentFile(null);
    setProgress(0);
    setError(null);
    setUploadId(null);
    setPendingResume(null);
  }, [currentFile, cancelUpload]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    uploadId,
    currentFile,
    isUploading,
    progress,
    error,
    pendingResume,
    setFile,
    startUpload,
    resumeUpload,
    cancelUpload,
    resetUploader,
  };
}
