import whisper_timestamped as whisper
import os
import sys
ffmpeg_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../ffmpeg/bin"))
os.environ["PATH"] += os.pathsep + ffmpeg_path
print(f"FFmpeg path added to PATH: {ffmpeg_path}")

audio = whisper.load_audio(os.path.abspath(os.path.join(os.path.dirname(__file__), "./audio-1.wav")))



model = whisper.load_model("base", device="cpu")

result = whisper.transcribe(model, audio)

import json
# Print word-by-word with text, start, end, and confidence only
words = []
if "segments" in result:
    for segment in result["segments"]:
        if "words" in segment:
            for word in segment["words"]:
                words.append({
                    "text": word["text"],
                    "start": word["start"],
                    "end": word["end"]
                })
if words:
    for word in words:
        print(json.dumps(word, ensure_ascii=False))
else:
    print("No word-level timestamps found in result.")