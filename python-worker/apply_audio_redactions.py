import sys
import json
from pydub import AudioSegment
from pydub.generators import Sine
import os

# Add ffmpeg to path
ffmpeg_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../ffmpeg/bin"))
os.environ["PATH"] += os.pathsep + ffmpeg_path

def apply_redactions(audio_path, redactions_file, output_path):
    """Apply redactions to audio file"""
    try:
        # Load redactions
        with open(redactions_file, 'r') as f:
            redactions = json.load(f)
        
        # Load the audio file
        audio = AudioSegment.from_file(audio_path)
        
        # Sort redactions by start time in reverse order to avoid offset issues
        sorted_redactions = sorted(redactions, key=lambda r: r['start_time'], reverse=True)
        
        # Process each redaction
        for redaction in sorted_redactions:
            start_ms = int(redaction['start_time'] * 1000)
            end_ms = int(redaction['end_time'] * 1000)
            
            # Ensure we don't go beyond audio length
            start_ms = max(0, start_ms)
            end_ms = min(len(audio), end_ms)
            
            if start_ms >= end_ms:
                continue  # Skip invalid redactions
            
            if redaction['action'] == 'silence':
                # Replace with silence
                silence = AudioSegment.silent(duration=end_ms - start_ms)
                audio = audio[:start_ms] + silence + audio[end_ms:]
                
            elif redaction['action'] == 'beep':
                # Replace with beep tone
                beep_duration = end_ms - start_ms
                beep = Sine(800).to_audio_segment(duration=beep_duration)
                # Make the beep quieter
                beep = beep - 20  # Reduce volume by 20dB
                audio = audio[:start_ms] + beep + audio[end_ms:]
                
            elif redaction['action'] == 'anonymize':
                # Apply pitch shifting to anonymize voice
                segment_to_anonymize = audio[start_ms:end_ms]
                
                # Increase pitch by 4 semitones (makes voice higher and less recognizable)
                # Note: This requires ffmpeg with pitch shift support
                try:
                    # Export segment temporarily
                    temp_file = "temp_segment.wav"
                    segment_to_anonymize.export(temp_file, format="wav")
                    
                    # Apply pitch shift using ffmpeg
                    import subprocess
                    shifted_file = "temp_shifted.wav"
                    subprocess.run([
                        "ffmpeg", "-i", temp_file, 
                        "-af", "asetrate=44100*1.26,aresample=44100,atempo=0.794",  # Pitch shift up
                        "-y", shifted_file
                    ], capture_output=True)
                    
                    # Load the shifted audio
                    shifted_segment = AudioSegment.from_file(shifted_file)
                    
                    # Clean up temp files
                    import os
                    try:
                        os.remove(temp_file)
                        os.remove(shifted_file)
                    except:
                        pass
                    
                    # Replace in original audio
                    audio = audio[:start_ms] + shifted_segment + audio[end_ms:]
                    
                except Exception as pitch_error:
                    print(f"Pitch shifting failed, using beep instead: {pitch_error}", file=sys.stderr)
                    # Fallback to beep if pitch shifting fails
                    beep_duration = end_ms - start_ms
                    beep = Sine(400).to_audio_segment(duration=beep_duration)  # Lower frequency beep
                    beep = beep - 15  # Reduce volume by 15dB
                    audio = audio[:start_ms] + beep + audio[end_ms:]
        
        # Export the redacted audio
        audio.export(output_path, format="mp3")
        print(f"Successfully exported redacted audio to: {output_path}")
        return True
        
    except Exception as e:
        print(f"Error applying redactions: {e}", file=sys.stderr)
        return False

def main():
    if len(sys.argv) != 4:
        print("Usage: python apply_audio_redactions.py <audio_file> <redactions_file> <output_file>")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    redactions_file = sys.argv[2]
    output_path = sys.argv[3]
    
    success = apply_redactions(audio_path, redactions_file, output_path)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
