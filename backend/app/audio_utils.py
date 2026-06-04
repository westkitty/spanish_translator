import re
import subprocess
from pathlib import Path
from app.config import settings

silence_start_re = re.compile(r"silence_start:\s+([\d.]+)")
silence_end_re = re.compile(r"silence_end:\s+([\d.]+)")

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
    result = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 0.0

def normalize_audio(input_path: Path, output_path: Path) -> Path:
    """
    Converts audio to 16-bit PCM Mono WAV at 16kHz via FFmpeg.
    """
    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(input_path),
        "-ar", str(settings.AUDIO_SAMPLE_RATE),
        "-ac", str(settings.AUDIO_CHANNELS),
        "-c:a", "pcm_s16le",
        str(output_path)
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path

def detect_silence(audio_path: Path) -> list[tuple[float, float]]:
    """
    Scans for silence thresholds using FFmpeg silencedetect filter.
    Returns a list of tuples representing (start_time, end_time) of silent intervals.
    """
    cmd = [
        "ffmpeg",
        "-i", str(audio_path),
        "-af", f"silencedetect=noise={settings.SILENCE_THRESHOLD_DB}dB:d={settings.SILENCE_DURATION_SEC}",
        "-f", "null",
        "-"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    silence_intervals = []
    current_start = None
    
    for line in result.stderr.splitlines():
        if "silencedetect" in line:
            start_match = silence_start_re.search(line)
            if start_match:
                current_start = float(start_match.group(1))
            end_match = silence_end_re.search(line)
            if end_match:
                if current_start is not None:
                    end_time = float(end_match.group(1))
                    silence_intervals.append((current_start, end_time))
                    current_start = None
                    
    # Close pending silence interval at end of file duration
    if current_start is not None:
        duration = get_audio_duration(audio_path)
        silence_intervals.append((current_start, duration))
        
    return silence_intervals

def slice_audio(audio_path: Path, output_dir: Path) -> list[dict]:
    """
    Slices normalized WAV audio into 20-minute chunks with a 10-second overlap.
    """
    duration = get_audio_duration(audio_path)
    if duration <= 0:
        raise ValueError(f"Invalid or zero audio duration for file {audio_path}")
        
    chunk_len = settings.SLICE_DURATION
    overlap = settings.SLICE_OVERLAP
    
    chunks = []
    chunk_index = 0
    start_time = 0.0
    
    while start_time < duration:
        end_time = min(start_time + chunk_len, duration)
        chunk_duration = end_time - start_time
        
        chunk_file = output_dir / f"chunk_{chunk_index}.wav"
        
        cmd = [
            "ffmpeg",
            "-y",
            "-ss", f"{start_time:.3f}",
            "-t", f"{chunk_duration:.3f}",
            "-i", str(audio_path),
            "-c", "copy",
            str(chunk_file)
        ]
        
        subprocess.run(cmd, check=True, capture_output=True)
        
        chunks.append({
            "chunk_index": chunk_index,
            "start_time": start_time,
            "end_time": end_time,
            "file_path": str(chunk_file)
        })
        
        if end_time >= duration:
            break
            
        start_time = end_time - overlap
        chunk_index += 1
        
    return chunks
