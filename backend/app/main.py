import os
import urllib.parse
from fastapi import FastAPI, Request, Header, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Spanish Audio Ingestion Engine")

# CORS Configuration for local webviews and mobile frameworks
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.abspath("./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mock in-memory database store for task tracking
JOBS_DB = {}

class ProcessRequest(BaseModel):
    uploadId: str

@app.put("/api/upload-chunk")
async def upload_chunk(
    request: Request,
    x_upload_id: str = Header(..., alias="X-Upload-ID"),
    x_chunk_index: int = Header(..., alias="X-Chunk-Index"),
    x_total_chunks: int = Header(..., alias="X-Total-Chunks"),
    x_file_name: str = Header(..., alias="X-File-Name")
):
    try:
        decoded_filename = urllib.parse.unquote(x_file_name)
        clean_filename = os.path.basename(decoded_filename)
        
        # Unique safe storage destination for the pre-assembled target file
        target_file_path = os.path.join(UPLOAD_DIR, f"{x_upload_id}_{clean_filename}")
        
        # Open in binary append mode ('ab') to stream bytes sequentially as they land
        with open(target_file_path, "ab") as f:
            async for chunk in request.stream():
                f.write(chunk)
                
        # Register or update the job tracking state structure
        if x_upload_id not in JOBS_DB:
            JOBS_DB[x_upload_id] = {
                "id": x_upload_id,
                "filename": clean_filename,
                "filepath": target_file_path,
                "status": "uploading",
                "chunks_received": 0,
                "total_chunks": x_total_chunks,
                "progress": 0,
                "error": None,
                "transcript": None
            }
            
        JOBS_DB[x_upload_id]["chunks_received"] += 1
        JOBS_DB[x_upload_id]["progress"] = int((JOBS_DB[x_upload_id]["chunks_received"] / x_total_chunks) * 100)
        
        if JOBS_DB[x_upload_id]["chunks_received"] == x_total_chunks:
            JOBS_DB[x_upload_id]["status"] = "uploaded"
            
        return {"status": "success", "chunk": x_chunk_index, "job_progress": JOBS_DB[x_upload_id]["progress"]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Streaming chunk append failure: {str(e)}")

@app.post("/api/jobs/{job_id}/process")
async def process_audio(job_id: str, payload: ProcessRequest, background_tasks: BackgroundTasks):
    if job_id not in JOBS_DB:
        raise HTTPException(status_code=404, detail="Requested ingestion task profile not found")
        
    JOBS_DB[job_id]["status"] = "queued"
    
    # Import deferred local tasks to bypass cyclical references
    from app.tasks import run_transcription_job
    background_tasks.add_task(run_transcription_job, job_id, JOBS_DB)
    
    return {"status": "queued", "job_id": job_id}

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    if job_id not in JOBS_DB:
        raise HTTPException(status_code=404, detail="Job entry missing")
    return JOBS_DB[job_id]

@app.get("/api/jobs/{job_id}/export")
async def export_transcript(job_id: str, format: str = "json"):
    if job_id not in JOBS_DB:
        raise HTTPException(status_code=404, detail="Job entries missing")
    job = JOBS_DB[job_id]
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Transcript generation incomplete")
    return {"filename": job["filename"], "format": format, "transcript": job["transcript"]}
