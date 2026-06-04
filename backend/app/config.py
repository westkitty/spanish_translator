import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Base paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    CHUNK_DIR: Path = UPLOAD_DIR / "chunks"
    OUTPUT_DIR: Path = BASE_DIR / "output"
    
    # Database
    DATABASE_URL: str = "sqlite:///jobs.db"
    
    # Audio Normalization Settings
    AUDIO_SAMPLE_RATE: int = 16000  # 16kHz
    AUDIO_CHANNELS: int = 1         # Mono
    
    # Slicing Settings
    SLICE_DURATION: int = 1200      # 20 minutes in seconds (20 * 60)
    SLICE_OVERLAP: int = 10         # 10 seconds overlap
    
    # Silence Detection (FFmpeg silencedetect)
    SILENCE_THRESHOLD_DB: int = -35  # Noise threshold in dB
    SILENCE_DURATION_SEC: float = 1.0  # Silence duration to trigger detection
    
    class Config:
        env_prefix = "TRANSCRIPTION_"

settings = Settings()

# Ensure directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.CHUNK_DIR.mkdir(parents=True, exist_ok=True)
settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
