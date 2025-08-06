import whisper_timestamped as whisper
import json
import sys
import os
from pydub import AudioSegment
from pydub.generators import Sine
import tempfile
import shutil

# Set UTF-8 encoding for stdout
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
elif hasattr(sys.stdout, 'buffer'):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Add ffmpeg to path
ffmpeg_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../ffmpeg/bin"))
os.environ["PATH"] += os.pathsep + ffmpeg_path

from ollama_manager import get_ollama_manager, initialize_ollama, call_ollama_chat

def transcribe_audio(audio_path):
    """Transcribe audio file and return word-by-word timestamps"""
    try:
        print(f"DEBUG: Starting transcription of {audio_path}", file=sys.stderr)
        
        # Load audio
        audio = whisper.load_audio(audio_path)
        print(f"DEBUG: Audio loaded successfully", file=sys.stderr)
        
        # Load model (using CPU)
        model = whisper.load_model("base", device="cpu")
        print(f"DEBUG: Whisper model loaded", file=sys.stderr)
        
        # Transcribe with word-level timestamps
        # Suppress Whisper's stdout output
        import contextlib
        import io
        
        # Capture stdout during transcription to prevent contamination
        stdout_capture = io.StringIO()
        with contextlib.redirect_stdout(stdout_capture):
            result = whisper.transcribe(model, audio)
        
        # Check what Whisper output (for debugging)
        captured_output = stdout_capture.getvalue()
        if captured_output:
            print(f"DEBUG: Whisper stdout captured: {captured_output[:200]}...", file=sys.stderr)
        
        print(f"DEBUG: Transcription completed", file=sys.stderr)
        
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
        
        print(f"DEBUG: Extracted {len(words)} words from transcription", file=sys.stderr)
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

def convert_timestamp_to_seconds(timestamp_str):
    """Convert timestamp string like '00:00:01.640' to seconds as float"""
    try:
        if isinstance(timestamp_str, (int, float)):
            result = float(timestamp_str)
            # Check for NaN or infinite values
            if not (0 <= result <= 10000):  # Reasonable bounds for audio timestamps
                print(f"Warning: Timestamp {result} is out of reasonable bounds", file=sys.stderr)
                return 0.0
            return result
        
        if isinstance(timestamp_str, str):
            # Handle format like "00:00:01.640"
            if ":" in timestamp_str:
                parts = timestamp_str.split(":")
                if len(parts) != 3:
                    print(f"Warning: Invalid timestamp format '{timestamp_str}' - expected HH:MM:SS.mmm", file=sys.stderr)
                    return 0.0
                    
                hours = int(parts[0])
                minutes = int(parts[1])
                seconds = float(parts[2])
                
                # Validate ranges
                if not (0 <= hours <= 23 and 0 <= minutes <= 59 and 0 <= seconds <= 59.999):
                    print(f"Warning: Invalid timestamp values in '{timestamp_str}'", file=sys.stderr)
                    return 0.0
                    
                total_seconds = hours * 3600 + minutes * 60 + seconds
                return total_seconds
            else:
                # Try to parse as direct number string
                result = float(timestamp_str)
                if not (0 <= result <= 10000):  # Reasonable bounds
                    print(f"Warning: Timestamp {result} is out of reasonable bounds", file=sys.stderr)
                    return 0.0
                return result
    except (ValueError, IndexError, AttributeError) as e:
        print(f"Warning: Could not parse timestamp '{timestamp_str}': {e}", file=sys.stderr)
        return 0.0
    
    return 0.0

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
- "text": the exact text/phrase of the PII
- "category": one of these exact values: "Name", "Age", "Location", "Address", "Phone", "Email", "Date", "ID", "Other"  
- "start_time": start timestamp like in the transcript
- "end_time": end timestamp like in the transcript plus 1 second
- "explanation": brief reason why this is PII
- "confidence": confidence score between 0.0 and 1.0

If no PII is found, return an empty array: []

Transcript:
{transcript}

REMEMBER: Respond with raw JSON array only, no markdown, no extra text."""

        print("Sending request to embedded AI model...", file=sys.stderr)
        
        messages = [
            {
                'role': 'system',
                'content': "You are a helpful assistant."
            },
            {
                'role': 'user',
                'content': prompt
            }
        ]
        
        response = call_ollama_chat(messages)
        print(f"Prompt: {prompt} chars", file=sys.stderr)
        if response and 'message' in response:
            ai_response = response['message']['content']
            print(f"AI response received, length: {len(ai_response)} chars", file=sys.stderr)
            print(f"AI response received: {ai_response} ", file=sys.stderr)
            
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
                    if isinstance(pii_items, list):
                        print(f"Successfully parsed cleaned response as JSON: {len(pii_items)} items", file=sys.stderr)
                        
                        # Convert string timestamps to numeric seconds
                        for item in pii_items:
                            if 'start_time' in item:
                                original_start = item['start_time']
                                item['start_time'] = convert_timestamp_to_seconds(item['start_time'])
                                if str(original_start) != str(item['start_time']):
                                    print(f"DEBUG: Converted start_time '{original_start}' -> {item['start_time']}", file=sys.stderr)
                            if 'end_time' in item:
                                original_end = item['end_time']
                                item['end_time'] = convert_timestamp_to_seconds(item['end_time'])
                                if str(original_end) != str(item['end_time']):
                                    print(f"DEBUG: Converted end_time '{original_end}' -> {item['end_time']}", file=sys.stderr)
                            # Also convert confidence to float if it's a string
                            if 'confidence' in item and isinstance(item['confidence'], str):
                                try:
                                    item['confidence'] = float(item['confidence'])
                                except ValueError:
                                    item['confidence'] = 0.8  # default fallback
                        
                        print(f"Converted timestamps for {len(pii_items)} PII items", file=sys.stderr)
                        return pii_items
                    else:
                        print(f"AI response was not a JSON array, got: {type(pii_items)}", file=sys.stderr)
                        return []
                except json.JSONDecodeError:
                    print("Failed to parse cleaned response as JSON, trying array extraction...", file=sys.stderr)
                    pass
                
                # Look for JSON array in the response
                start_idx = cleaned_response.find('[')
                end_idx = cleaned_response.rfind(']') + 1
                
                if start_idx != -1 and end_idx > start_idx:
                    json_str = cleaned_response[start_idx:end_idx]
                    print(f"Extracted JSON substring: {json_str[:100]}...", file=sys.stderr)
                    pii_items = json.loads(json_str)
                    if isinstance(pii_items, list):
                        # Convert string timestamps to numeric seconds
                        for item in pii_items:
                            if 'start_time' in item:
                                item['start_time'] = convert_timestamp_to_seconds(item['start_time'])
                            if 'end_time' in item:
                                item['end_time'] = convert_timestamp_to_seconds(item['end_time'])
                            # Also convert confidence to float if it's a string
                            if 'confidence' in item and isinstance(item['confidence'], str):
                                try:
                                    item['confidence'] = float(item['confidence'])
                                except ValueError:
                                    item['confidence'] = 0.8  # default fallback
                        
                        print(f"Successfully parsed {len(pii_items)} PII items", file=sys.stderr)
                        return pii_items
                    else:
                        print(f"Extracted JSON was not an array: {type(pii_items)}", file=sys.stderr)
                        return []
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
        
        # Validate pii_items is a list
        if not isinstance(pii_items, list):
            print(f"WARNING: PII analysis returned non-list: {type(pii_items)}", file=sys.stderr)
            pii_items = []
        
        print(f"PII analysis complete, found {len(pii_items)} items", file=sys.stderr)
        
        # Step 4: Return results as JSON
        result = {
            "transcript": words,
            "pii_suggestions": pii_items,
            "formatted_transcript": transcript
        }
        
        # Add a unique timestamp marker for debugging
        import time
        result["debug_timestamp"] = int(time.time() * 1000)  # milliseconds
        result["debug_process_id"] = os.getpid()  # process ID
        
        # Validate the result can be serialized
        try:
            # Always use ensure_ascii=True to avoid encoding issues
            result_json = json.dumps(result, ensure_ascii=True, separators=(',', ':'))
            print(f"Final result JSON length: {len(result_json)} chars", file=sys.stderr)
            print(f"DEBUG: Outputting JSON with timestamp {result['debug_timestamp']}, PID {result['debug_process_id']}", file=sys.stderr)
            print(f"DEBUG: Contains Japanese PII items: {len([item for item in result['pii_suggestions'] if any(ord(c) > 127 for c in item.get('text', ''))])}", file=sys.stderr)
            
            # Output the JSON (with Unicode escapes for Japanese characters)
            print(result_json)
            sys.stdout.flush()
                
        except Exception as json_error:
            print(f"Error serializing final result: {json_error}", file=sys.stderr)
            # Return minimal valid result
            minimal_result = {
                "transcript": [],
                "pii_suggestions": [],
                "formatted_transcript": "",
                "debug_timestamp": int(time.time() * 1000),
                "debug_process_id": os.getpid()
            }
            minimal_json = json.dumps(minimal_result, ensure_ascii=True, separators=(',', ':'))
            print(minimal_json)
            sys.stdout.flush()
        
    except Exception as e:
        print(f"Error processing audio: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
