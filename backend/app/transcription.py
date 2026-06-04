from abc import ABC, abstractmethod
from pathlib import Path
from app.audio_utils import get_audio_duration

class BaseTranscriptionEngine(ABC):
    @abstractmethod
    def transcribe(self, audio_path: Path, silence_intervals: list[tuple[float, float]]) -> list[dict]:
        """
        Transcribes the audio file and returns a list of dictionaries with word-level timestamps.
        Each word dict should look like:
        {
            "word": str,
            "start": float,  # start timestamp in seconds
            "end": float     # end timestamp in seconds
        }
        """
        pass

class MockSpanishTranscriptionEngine(BaseTranscriptionEngine):
    """
    Offline pluggable Spanish transcription engine.
    Generates realistic Spanish text with tildes/accents mapped to word-level timestamps,
    filtering out segments corresponding to detected silence (hallucination guard).
    """
    def transcribe(self, audio_path: Path, silence_intervals: list[tuple[float, float]]) -> list[dict]:
        duration = get_audio_duration(audio_path)
        if duration <= 0:
            duration = 10.0  # Fallback for mock environment
            
        words = []
        current_time = 0.2
        word_idx = 0
        
        sentences = [
            "hola bienvenido al sistema de transcripción offline de audio español",
            "el procesamiento local garantiza la privacidad y seguridad de la información",
            "esta es una demostración práctica de tecnología móvil con acentos y tildes",
            "el motor de audio divide las grabaciones largas y resuelve los duplicados"
        ]
        
        # Flatten sentences to a list of words
        words_pool = []
        for s in sentences:
            words_pool.extend(s.split())
            
        while current_time < duration:
            word = words_pool[word_idx % len(words_pool)]
            word_idx += 1
            
            # Word duration scales with word length (approx. 0.07s per char, bounded [0.25, 0.6])
            word_len = len(word)
            word_duration = max(0.25, min(0.6, word_len * 0.07))
            
            word_start = current_time
            word_end = word_start + word_duration
            
            # Hallucination guard: Shift past any silence intervals
            while True:
                overlap_end = None
                for s_start, s_end in silence_intervals:
                    # Check if the word range overlaps with this silence interval
                    if not (word_end <= s_start or word_start >= s_end):
                        overlap_end = s_end
                        break
                if overlap_end is None:
                    break
                word_start = overlap_end + 0.1
                word_end = word_start + word_duration
                
            # If shifted past the duration, stop generating
            if word_end > duration:
                break
                
            words.append({
                "word": word,
                "start": round(word_start, 3),
                "end": round(word_end, 3)
            })
            
            # Advance time with a small inter-word gap
            current_time = word_end + 0.08
            
        return words

# Default transcription engine export
default_engine = MockSpanishTranscriptionEngine()
