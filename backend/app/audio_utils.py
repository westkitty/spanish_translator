import subprocess
import os
from pathlib import Path

def get_audio_duration(audio_path: Path) -> float:
    """
    Gets the duration of the audio file in seconds using ffprobe.
    """
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(audio_path)
    ]
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.DEVNULL,
            text=True,
            check=True
        )
        return float(result.stdout.strip())
    except Exception:
        return 0.0

def normalize_audio_payload(input_path: str, output_path: str) -> bool:
    """
    Executes an explicit normalization downsample pass using FFmpeg.
    Ensures zero terminal interaction freezes by decoupling interactive stdin.
    """
    if not os.path.exists(input_path):
        return False
        
    cmd = [
        "ffmpeg",
        "-y",               # Overwrite existing files without asking
        "-nostdin",         # Disable all terminal interactive input listening hooks
        "-i", input_path,
        "-vn",              # Strip video channels entirely
        "-acodec", "pcm_s16le",
        "-ar", "16000",     # Downsample to 16kHz for Whisper engine matching
        "-ac", "1",         # Force downmix into Mono channel
        output_path
    ]
    
    try:
        # Redirect stdin strictly to DEVNULL to enforce absolute headless background isolation
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.DEVNULL,
            check=True
        )
        return True
    except subprocess.CalledProcessError as e:
        error_log = e.stderr.decode('utf-8', errors='ignore')
        print(f"FFmpeg Execution Exception: {error_log}")
        return False
