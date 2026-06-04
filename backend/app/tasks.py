import json
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from sqlalchemy import create_engine, Column, String, Float, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings
from app.audio_utils import normalize_audio, detect_silence, slice_audio
from app.transcription import default_engine

# Database Initialization
engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Job(Base):
    __tablename__ = "jobs"
    
    id = Column(String, primary_key=True, index=True)
    filename = Column(String)
    file_path = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending, processing, completed, failed
    progress = Column(Float, default=0.0)       # 0.0 to 100.0
    error_message = Column(String, nullable=True)
    transcript_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)

# Thread Pool Executor for running jobs asynchronously in the background
executor = ThreadPoolExecutor(max_workers=3)

def merge_chunks(chunks_word_lists: list[list[dict]], chunk_definitions: list[dict]) -> list[dict]:
    """
    Merges chunk timestamps by tracking rolling timeline offsets and resolving duplicates
    in the 10-second overlaps by using the overlap midpoint cutoff.
    """
    merged_words = []
    for i, chunk_words in enumerate(chunks_word_lists):
        chunk_def = chunk_definitions[i]
        chunk_start = chunk_def["start_time"]
        
        # Map word timestamps to the global timeline
        global_words = []
        for w in chunk_words:
            global_words.append({
                "word": w["word"],
                "start": round(w["start"] + chunk_start, 3),
                "end": round(w["end"] + chunk_start, 3)
            })
            
        if i == 0:
            merged_words.extend(global_words)
        else:
            prev_chunk_def = chunk_definitions[i - 1]
            prev_chunk_end = prev_chunk_def["end_time"]
            
            overlap_start = chunk_start
            overlap_end = prev_chunk_end
            
            # Resolve overlap using the midpoint cutoff
            midpoint = (overlap_start + overlap_end) / 2.0
            
            # Prune previous merged words that start at or after midpoint
            merged_words = [w for w in merged_words if w["start"] < midpoint]
            
            # Add words from chunk i that start at or after midpoint
            chunk_i_filtered = [w for w in global_words if w["start"] >= midpoint]
            merged_words.extend(chunk_i_filtered)
            
    return merged_words

def run_transcription_job(job_id: str):
    """
    Full background task to assemble chunks, normalize, detect silence,
    slice, transcribe, and merge back.
    """
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
            
        job.status = "processing"
        job.progress = 10.0
        db.commit()
        
        # 1. Assemble sequential chunk files
        job_chunk_dir = settings.CHUNK_DIR / job_id
        chunk_files = sorted(
            [f for f in job_chunk_dir.glob("chunk_*") if f.is_file()],
            key=lambda x: int(x.name.split("_")[1])
        )
        
        if not chunk_files:
            raise ValueError("No uploaded chunks found for this job.")
            
        assembled_raw_path = settings.UPLOAD_DIR / f"{job_id}_raw.bin"
        with open(assembled_raw_path, "wb") as outfile:
            for chunk_file in chunk_files:
                with open(chunk_file, "rb") as infile:
                    outfile.write(infile.read())
                    
        job.progress = 25.0
        db.commit()
        
        # 2. Normalize to 16kHz PCM Mono WAV
        normalized_path = settings.UPLOAD_DIR / f"{job_id}_normalized.wav"
        normalize_audio(assembled_raw_path, normalized_path)
        
        job.file_path = str(normalized_path)
        job.progress = 40.0
        db.commit()
        
        # 3. Detect silence on entire normalized audio
        silence_intervals = detect_silence(normalized_path)
        job.progress = 55.0
        db.commit()
        
        # 4. Slice normalized audio into overlapping 20-minute chunks
        slice_out_dir = settings.CHUNK_DIR / job_id / "slices"
        slice_out_dir.mkdir(parents=True, exist_ok=True)
        chunks = slice_audio(normalized_path, slice_out_dir)
        
        # 5. Transcribe each slice using the pluggable engine
        chunks_word_lists = []
        for chunk in chunks:
            chunk_path = Path(chunk["file_path"])
            chunk_start = chunk["start_time"]
            chunk_end = chunk["end_time"]
            
            # Map global silence intervals to local slice timeline
            local_silence = []
            for s_start, s_end in silence_intervals:
                local_start = max(0.0, s_start - chunk_start)
                local_end = min(chunk_end - chunk_start, s_end - chunk_start)
                if local_start < local_end:
                    local_silence.append((local_start, local_end))
                    
            chunk_words = default_engine.transcribe(chunk_path, local_silence)
            chunks_word_lists.append(chunk_words)
            
        job.progress = 80.0
        db.commit()
        
        # 6. Merge chunk timestamps resolving duplicates
        merged_words = merge_chunks(chunks_word_lists, chunks)
        
        job.transcript_json = json.dumps(merged_words, ensure_ascii=False)
        job.status = "completed"
        job.progress = 100.0
        db.commit()
        
        # Cleanup temporary assembled raw file
        if assembled_raw_path.exists():
            assembled_raw_path.unlink()
            
    except Exception as e:
        db.rollback()
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "failed"
            job.progress = 100.0
            job.error_message = str(e)
            db.commit()
    finally:
        db.close()

def trigger_transcription(job_id: str):
    """
    Submits the transcription job to the thread pool.
    """
    executor.submit(run_transcription_job, job_id)
