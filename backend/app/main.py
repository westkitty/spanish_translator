import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, Query, HTTPException, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.config import settings
from app.tasks import init_db, SessionLocal, Job, trigger_transcription

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize the SQLite database
    init_db()
    yield

app = FastAPI(
    title="Spanish Audio Transcription Engine",
    description="Backend transcription engine for Mobile-First Spanish Audio Transcription & Caption Engine",
    version="0.1.0",
    lifespan=lifespan
)

# CORS Configuration for local webviews and mobile frameworks
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Session Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Caption Formatting Helper Functions
def group_words_into_segments(words: list[dict], max_words: int = 5, max_gap: float = 1.5) -> list[dict]:
    """
    Groups individual words into coherent subtitle blocks based on time gap and word count limits.
    """
    if not words:
        return []
        
    segments = []
    current_words = []
    
    for w in words:
        if not current_words:
            current_words.append(w)
        else:
            prev_w = current_words[-1]
            gap = w["start"] - prev_w["end"]
            
            if len(current_words) < max_words and gap <= max_gap:
                current_words.append(w)
            else:
                segments.append({
                    "start": current_words[0]["start"],
                    "end": current_words[-1]["end"],
                    "text": " ".join([x["word"] for x in current_words])
                })
                current_words = [w]
                
    if current_words:
        segments.append({
            "start": current_words[0]["start"],
            "end": current_words[-1]["end"],
            "text": " ".join([x["word"] for x in current_words])
        })
        
    return segments

def format_timestamp(seconds: float, srt_format: bool = False) -> str:
    """
    Formally formats seconds to HH:MM:SS.mmm or HH:MM:SS,mmm for WebVTT/SRT.
    """
    total_milliseconds = int(round(seconds * 1000))
    hours = total_milliseconds // 3600000
    minutes = (total_milliseconds % 3600000) // 60000
    secs = (total_milliseconds % 60000) // 1000
    millis = total_milliseconds % 1000
    
    delimiter = "," if srt_format else "."
    return f"{hours:02d}:{minutes:02d}:{secs:02d}{delimiter}{millis:03d}"

def export_srt(segments: list[dict]) -> str:
    """
    Converts subtitle segments to SRT format.
    """
    lines = []
    for idx, seg in enumerate(segments, 1):
        lines.append(str(idx))
        start_str = format_timestamp(seg["start"], srt_format=True)
        end_str = format_timestamp(seg["end"], srt_format=True)
        lines.append(f"{start_str} --> {end_str}")
        lines.append(seg["text"])
        lines.append("")  # Blank line separator
    return "\n".join(lines)

def export_vtt(segments: list[dict]) -> str:
    """
    Converts subtitle segments to WebVTT format.
    """
    lines = ["WEBVTT", ""]
    for idx, seg in enumerate(segments, 1):
        lines.append(str(idx))
        start_str = format_timestamp(seg["start"], srt_format=False)
        end_str = format_timestamp(seg["end"], srt_format=False)
        lines.append(f"{start_str} --> {end_str}")
        lines.append(seg["text"])
        lines.append("")  # Blank line separator
    return "\n".join(lines)


# FastAPI Endpoint Routes

@app.post("/api/jobs/{job_id}/upload")
async def upload_chunk(
    job_id: str,
    chunk_index: int = Query(..., description="0-based sequence number of the audio chunk"),
    total_chunks: int = Query(..., description="Total number of chunks expected"),
    filename: str = Query(..., description="Original filename of the audio recording"),
    file: UploadFile = File(...)
):
    """
    Handles sequential 5MB chunked uploads, storing files locally under the task's storage tree.
    If it is the first chunk (index 0), initialized the task database entry.
    """
    # Create target directories
    job_dir = settings.CHUNK_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    
    chunk_path = job_dir / f"chunk_{chunk_index}"
    
    # Save the chunk data
    try:
        contents = await file.read()
        with open(chunk_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to write chunk {chunk_index}: {e}")
        
    # Check or initialize Job database entry
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            job = Job(
                id=job_id,
                filename=filename,
                status="uploading",
                progress=0.0
            )
            db.add(job)
            db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error during initialization: {e}")
    finally:
        db.close()
        
    return {
        "message": f"Chunk {chunk_index}/{total_chunks} uploaded successfully",
        "job_id": job_id,
        "chunk_index": chunk_index
    }

@app.post("/api/jobs/{job_id}/process")
def process_job(job_id: str, db: Session = Depends(get_db)):
    """
    Triggers the multi-threaded offline audio processing execution queue.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job record not found")
        
    if job.status == "processing":
        return {"status": "already_processing", "message": "Job is currently being processed", "job_id": job_id}
        
    # Queue the background processing
    trigger_transcription(job_id)
    return {"status": "queued", "message": "Transcription job queued successfully", "job_id": job_id}

@app.get("/api/jobs/{job_id}")
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """
    Polls the current status, progress percentage, and failures of the job.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job record not found")
        
    return {
        "job_id": job.id,
        "filename": job.filename,
        "status": job.status,
        "progress": job.progress,
        "error_message": job.error_message,
        "created_at": job.created_at,
        "updated_at": job.updated_at
    }

@app.get("/api/jobs/{job_id}/export")
def export_captions(
    job_id: str,
    format: str = Query("json", description="Caption formats available: 'json', 'srt', 'vtt'"),
    db: Session = Depends(get_db)
):
    """
    Exports/downloads the final transcribed Spanish subtitles in SRT, WebVTT, or raw JSON.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job record not found")
        
    if job.status != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job is in state '{job.status}'. Captions are only exportable when completed."
        )
        
    if not job.transcript_json:
        raise HTTPException(status_code=400, detail="Transcript content is empty")
        
    words = json.loads(job.transcript_json)
    
    if format == "json":
        return words
        
    # Convert word timestamps into standard grouped subtitle frames
    segments = group_words_into_segments(words)
    
    if format == "srt":
        srt_content = export_srt(segments)
        return Response(
            content=srt_content,
            media_type="text/srt",
            headers={"Content-Disposition": f"attachment; filename={job_id}.srt"}
        )
        
    if format == "vtt":
        vtt_content = export_vtt(segments)
        return Response(
            content=vtt_content,
            media_type="text/vtt",
            headers={"Content-Disposition": f"attachment; filename={job_id}.vtt"}
        )
        
    raise HTTPException(status_code=400, detail=f"Unsupported format '{format}'")
