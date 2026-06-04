import os
import time
from pathlib import Path
from app.audio_utils import normalize_audio_payload
from app.transcription import default_engine

def run_transcription_job(job_id: str, db_reference: dict):
    """
    Background worker execution thread processing pre-assembled files.
    """
    job = db_reference.get(job_id)
    if not job:
        return
        
    job["status"] = "processing"
    raw_audio_path = job["filepath"]
    normalized_audio_path = raw_audio_path + ".normalized.wav"
    
    # 1. Hardware-Safe Normalization Pass Execution
    success = normalize_audio_payload(raw_audio_path, normalized_audio_path)
    if not success:
        job["status"] = "failed"
        job["error"] = "FFmpeg audio conversion and downsampling pipeline failure."
        return
        
    try:
        # Generate word-level transcripts mapped to the actual audio duration
        transcript_payload = default_engine.transcribe(Path(normalized_audio_path), [])
        
        # Simulate processing time proportional to file size or fixed delay
        time.sleep(2)
        
        job["status"] = "completed"
        job["transcript"] = transcript_payload
        
        # Cleanup raw multi-gigabyte ingestion file to keep storage space clean
        if os.path.exists(raw_audio_path):
            os.remove(raw_audio_path)
            
    except Exception as e:
        job["status"] = "failed"
        job["error"] = f"Transcription engine initialization abort: {str(e)}"
