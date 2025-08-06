import whisper_timestamped as whisper
import json
import sys
import os
from pydub import AudioSegment
from pydub.generators import Sine
import tempfile
import shutil

# Add ffmpeg to path
ffmpeg_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../ffmpeg/bin"))
os.environ["PATH"] += os.pathsep + ffmpeg_path

from ollama_manager import get_ollama_manager, initialize_ollama, call_ollama_chat

def transcribe_audio(audio_path):
    """Transcribe audio file and return word-by-word timestamps"""
    try:
        # Load audio
        audio = whisper.load_audio(audio_path)
        
        # Load model (using CPU)
        model = whisper.load_model("base", device="cpu")
        
        # Transcribe with word-level timestamps
        result = whisper.transcribe(model, audio)
        
        # Extract words with timestamps
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
        
        return words
    except Exception as e:
        print(f"Error transcribing audio: {e}", file=sys.stderr)
        return []

def format_transcript_for_ai(words):
    """Format transcript in the style expected by Gemma3n"""
    formatted_lines = []
    for word in words:
        # Format timestamp as [ HH:MM:SS.mmm ]
        hours = int(word['start'] // 3600)
        minutes = int((word['start'] % 3600) // 60)
        seconds = word['start'] % 60
        timestamp = f"[ {hours:02d}:{minutes:02d}:{seconds:06.3f} ]"
        formatted_lines.append(f"{timestamp} {word['text']}")
    
    return "\n".join(formatted_lines)

def analyze_transcript_for_pii(transcript):
    """Use Gemma3n to analyze transcript for PII"""
    try:
        print("Analyzing transcript for PII with embedded AI...", file=sys.stderr)
        
        prompt = f"""You are a JSON-only API. You must respond with ONLY valid JSON, no other text.

Analyze the following transcript and identify all instances of Personally Identifiable Information (PII). 

CRITICAL REQUIREMENTS:
- Your response must be ONLY a JSON array, starting with [ and ending with ]
- Do NOT use markdown code blocks (no ```json or ```)
- Do NOT include any explanatory text, headers, or formatting
- Respond with raw JSON only

For each PII found, create an object with these exact fields:
- "text": the exact text of the PII
- "category": one of these exact values: "Name", "Age", "Location", "Address", "Phone", "Email", "Date", "ID", "Other"  
- "start_time": start timestamp in seconds (number)
- "end_time": end timestamp in seconds (number)
- "explanation": brief reason why this is PII
- "confidence": confidence score between 0.0 and 1.0

If no PII is found, return an empty array: []

Transcript:
{transcript}

REMEMBER: Respond with raw JSON array only, no markdown, no extra text."""

        print("Sending request to embedded AI model...", file=sys.stderr)
        
        messages = [
            {
                'role': 'user',
                'content': prompt
            }
        ]
        
        response = call_ollama_chat(messages)
        if response and 'message' in response:
            ai_response = response['message']['content']
            print(f"AI response received, length: {len(ai_response)} chars", file=sys.stderr)
            
            # Try to extract JSON from the response
            try:
                print(f"Raw AI response: {ai_response[:200]}...", file=sys.stderr)
                
                # Clean the response - remove markdown code blocks if present
                cleaned_response = ai_response.strip()
                if cleaned_response.startswith('```json'):
                    # Remove ```json at start and ``` at end
                    cleaned_response = cleaned_response[7:]  # Remove ```json
                    if cleaned_response.endswith('```'):
                        cleaned_response = cleaned_response[:-3]  # Remove ```
                elif cleaned_response.startswith('```'):
                    # Remove ``` at start and end
                    cleaned_response = cleaned_response[3:]
                    if cleaned_response.endswith('```'):
                        cleaned_response = cleaned_response[:-3]
                
                cleaned_response = cleaned_response.strip()
                print(f"Cleaned response: {cleaned_response[:200]}...", file=sys.stderr)
                
                # First, try to parse the cleaned response as JSON
                try:
                    pii_items = json.loads(cleaned_response)
                    print(f"Successfully parsed cleaned response as JSON: {len(pii_items)} items", file=sys.stderr)
                    return pii_items
                except json.JSONDecodeError:
                    pass
                
                # Look for JSON array in the response
                start_idx = cleaned_response.find('[')
                end_idx = cleaned_response.rfind(']') + 1
                
                if start_idx != -1 and end_idx > start_idx:
                    json_str = cleaned_response[start_idx:end_idx]
                    print(f"Extracted JSON substring: {json_str[:100]}...", file=sys.stderr)
                    pii_items = json.loads(json_str)
                    print(f"Successfully parsed {len(pii_items)} PII items", file=sys.stderr)
                    return pii_items
                else:
                    print("No JSON array brackets found in response", file=sys.stderr)
                    # If the AI didn't return JSON format, return empty array
                    print(f"Non-JSON AI response: {cleaned_response}", file=sys.stderr)
                    return []
                    
            except json.JSONDecodeError as json_err:
                print(f"JSON parsing failed: {json_err}", file=sys.stderr)
                print(f"Attempted to parse: {cleaned_response[:500]}...", file=sys.stderr)
                return []
        else:
            print(f"Invalid response from embedded AI: {response}", file=sys.stderr)
            return []
            
    except Exception as e:
        error_msg = f"Error analyzing transcript with embedded AI: {e}"
        print(error_msg, file=sys.stderr)
        raise Exception(error_msg)

def apply_audio_redactions(audio_path, redactions, output_path):
    """Apply redactions to audio file"""
    try:
        # Load the audio file
        audio = AudioSegment.from_file(audio_path)
        
        # Sort redactions by start time
        sorted_redactions = sorted(redactions, key=lambda r: r['start_time'])
        
        # Process redactions from end to beginning to avoid offset issues
        for redaction in reversed(sorted_redactions):
            start_ms = int(redaction['start_time'] * 1000)
            end_ms = int(redaction['end_time'] * 1000)
            
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
            # For 'anonymize', we would need voice conversion - for now, treat as silence
            elif redaction['action'] == 'anonymize':
                silence = AudioSegment.silent(duration=end_ms - start_ms)
                audio = audio[:start_ms] + silence + audio[end_ms:]
        
        # Export the redacted audio
        audio.export(output_path, format="mp3")
        return True
        
    except Exception as e:
        print(f"Error applying redactions: {e}", file=sys.stderr)
        return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python process_audio.py <audio_file_path> [output_dir]")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(audio_path)
    
    try:
        # Step 1: Transcribe audio
        print("Transcribing audio...", file=sys.stderr)
        words = transcribe_audio(audio_path)
        
        if not words:
            print("No transcription results", file=sys.stderr)
            sys.exit(1)
        
        # Step 2: Format transcript for AI analysis
        transcript = format_transcript_for_ai(words)
        
        # Step 3: Analyze for PII
        print("Analyzing transcript for PII...", file=sys.stderr)
        pii_items = analyze_transcript_for_pii(transcript)
        
        # Step 4: Return results as JSON
        result = {
            "transcript": words,
            "pii_suggestions": pii_items,
            "formatted_transcript": transcript
        }
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(f"Error processing audio: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
