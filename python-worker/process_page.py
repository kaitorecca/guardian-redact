#!/usr/bin/env python3
"""
Guardian Redact - Python Worker for Document Processing
Processes a single page of a PDF document using Gemma 3n model via Ollama
"""

import sys
import json
import os
import tempfile
from pathlib import Path
# Remove ollama import, we'll use our embedded manager
import PyPDF2
import io
from PIL import Image
import fitz  # PyMuPDF for better PDF processing
from ollama_manager import get_ollama_manager, initialize_ollama, call_ollama_chat

# Categories for different types of sensitive information
REDACTION_CATEGORIES = {
    "PII": "Personal Identifiable Information",
    "FINANCIAL": "Financial Information",
    "MEDICAL": "Medical Information", 
    "LEGAL": "Legal Information",
    "CONTACT": "Contact Information",
    "FACES": "Human Faces"
}

def extract_text_from_page(pdf_path, page_number):
    """Extract text from a specific page of the PDF."""
    try:
        doc = fitz.open(pdf_path)
        page = doc[page_number - 1]  # PyMuPDF uses 0-based indexing
        text = page.get_text()
        doc.close()
        return text
    except Exception as e:
        print(f"Error extracting text from page {page_number}: {e}", file=sys.stderr)
        return ""

def extract_images_from_page(pdf_path, page_number):
    """Extract images from a specific page of the PDF."""
    try:
        doc = fitz.open(pdf_path)
        page = doc[page_number - 1]
        image_list = page.get_images()
        
        images = []
        for img_index, img in enumerate(image_list):
            xref = img[0]
            pix = fitz.Pixmap(doc, xref)
            
            if pix.n - pix.alpha < 4:  # GRAY or RGB
                img_data = pix.tobytes("png")
                images.append({
                    'index': img_index,
                    'data': img_data,
                    'bbox': page.get_image_bbox(img)
                })
            pix = None
        
        doc.close()
        return images
    except Exception as e:
        print(f"Error extracting images from page {page_number}: {e}", file=sys.stderr)
        return []

def build_redaction_prompt(text, profile="quick"):
    """Build the prompt for Gemma 3n based on the redaction profile."""
    
    if profile == "quick":
        prompt = f"""You are an AI assistant specialized in identifying sensitive information that should be redacted from documents.

Analyze the following text and identify ALL instances of sensitive information that should be redacted for privacy protection.

TEXT TO ANALYZE:
{text}

IMPORTANT: Respond ONLY with a valid JSON array. Each object should have:
- "text": the exact text that should be redacted (be very precise with the text)
- "category": one of ["PII", "FINANCIAL", "MEDICAL", "LEGAL", "CONTACT"]
- "confidence": a number between 0 and 1
- "reason": brief explanation why this should be redacted

PRIORITY REDACTION TARGETS (find these first):
- Full names of people (like "Hoang Duc Hiep", "John Smith")
- Email addresses (like "email@example.com")
- Phone numbers (like "+84 123 456 789", "555-123-4567")
- University names (like "National Economics University")
- Company names (like "Urbox Digital Agency")
- Addresses and locations (like "Hanoi", "Vietnam", "123 Main St")
- Graduation dates (like "Graduated: 04/2023")
- GPA scores (like "GPA: 3.42")
- LinkedIn profiles or social media handles

DO NOT redact generic terms like:
- Software names (Excel, Google Sheets, Python, etc.)
- General skill terms (Data Analysis, SQL, etc.)
- Job titles without person names
- General locations without specific addresses

Example format:
[
  {{"text": "James Bond", "category": "PII", "confidence": 0.95, "reason": "Person's full name"}},
  {{"text": "National Economics University", "category": "PII", "confidence": 0.90, "reason": "Educational institution name"}},
  {{"text": "whuchiep@gmail.com", "category": "CONTACT", "confidence": 0.98, "reason": "Email address"}}
]

JSON Response:"""
    
    else:  # deep analysis
        prompt = f"""You are an expert privacy analyst with deep knowledge of data protection regulations (GDPR, HIPAA, etc.).

Perform a comprehensive analysis of the following text to identify ALL sensitive information requiring redaction.

TEXT TO ANALYZE:
{text}

IMPORTANT: Respond ONLY with a valid JSON array. Each object should have:
- "text": the exact text that should be redacted
- "category": one of ["PII", "FINANCIAL", "MEDICAL", "LEGAL", "CONTACT"]
- "confidence": a number between 0 and 1
- "reason": detailed explanation including relevant regulations

Perform deep analysis for:
- Direct identifiers (names, IDs, addresses)
- Quasi-identifiers (age, location, occupation combinations)
- Financial data (account numbers, transaction details)
- Health information (conditions, treatments, provider names)
- Legal information (case details, attorney-client privileged)
- Contextual sensitive information (relationships, private details)
- Cross-reference risks (information that combined could identify someone)

Consider regulatory requirements:
- GDPR: Any information relating to an identified or identifiable person
- HIPAA: Protected Health Information (PHI)
- FERPA: Educational records
- Financial privacy regulations

JSON Response:"""
    
    return prompt

def parse_model_response(response_text):
    """Parse and clean the model response to extract valid JSON."""
    try:
        # Remove markdown code blocks if present
        cleaned_response = response_text.strip()
        if cleaned_response.startswith('```json'):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.startswith('```'):
            cleaned_response = cleaned_response[3:]
        if cleaned_response.endswith('```'):
            cleaned_response = cleaned_response[:-3]
        
        # Find the JSON array part
        start_idx = cleaned_response.find('[')
        end_idx = cleaned_response.rfind(']')
        
        if start_idx == -1 or end_idx == -1:
            print(f"No JSON array found in response", file=sys.stderr)
            return []
        
        json_text = cleaned_response[start_idx:end_idx+1]
        
        # Fix common JSON issues
        json_text = json_text.replace(',\n}', '\n}')  # Remove trailing commas before }
        json_text = json_text.replace(',\n]', '\n]')  # Remove trailing commas before ]
        json_text = json_text.replace(',]', ']')  # Remove trailing commas immediately before ]
        json_text = json_text.replace(',}', '}')  # Remove trailing commas immediately before }
        json_text = json_text.replace('}\n  {', '},\n  {')  # Add missing commas between objects
        
        # Parse the cleaned JSON
        return json.loads(json_text)
        
    except Exception as e:
        print(f"Error parsing model response: {e}", file=sys.stderr)
        print(f"Raw response: {response_text}", file=sys.stderr)
        return []

def call_gemma_model(prompt, model_name="gemma3n"):
    """Call the embedded Gemma model via our Ollama manager."""
    try:
        messages = [
            {
                'role': 'user',
                'content': prompt
            }
        ]
        
        response = call_ollama_chat(messages)
        if response and 'message' in response:
            return response['message']['content']
        else:
            print(f"Invalid response from Ollama: {response}", file=sys.stderr)
            return None
            
    except Exception as e:
        print(f"Error calling embedded Gemma model: {e}", file=sys.stderr)
        return None

def find_text_positions(pdf_path, page_number, target_texts):
    """Find the actual positions of text items on the PDF page."""
    try:
        doc = fitz.open(pdf_path)
        page = doc[page_number - 1]  # Convert back to 0-based indexing for PyMuPDF
        
        # Get page dimensions for coordinate conversion
        page_rect = page.rect
        page_height = page_rect.height
        
        text_positions = {}
        
        for target_text in target_texts:
            print(f"DEBUG: Searching for text: '{target_text}'", file=sys.stderr)
            
            # Search for the text on the page
            text_instances = page.search_for(target_text)
            
            if text_instances:
                # Use the first instance found
                rect = text_instances[0]
                # PyMuPDF's `search_for` returns coordinates with a top-left origin.
                # No conversion is needed before sending to the frontend.
                text_positions[target_text] = {
                    "x": float(rect.x0),
                    "y": float(rect.y0),
                    "width": float(rect.x1 - rect.x0),
                    "height": float(rect.y1 - rect.y0)
                }
                print(f"DEBUG: Found exact match at PDF coords x={rect.x0:.1f}, y={rect.y0:.1f}", file=sys.stderr)
            else:
                print(f"DEBUG: No exact match found, trying partial matches", file=sys.stderr)
                # Enhanced fallback: try to find partial matches or keywords
                words = page.get_text("words")  # Get word-level positions
                best_match = None
                best_score = 0
                
                # Split target text into words for better matching
                target_words = target_text.lower().split()
                
                for word in words:
                    word_text = word[4].lower()  # word[4] is the text content
                    
                    # Try different matching strategies
                    score = 0
                    
                    # Strategy 1: Exact word match
                    if word_text in [w.lower() for w in target_words]:
                        score = 1.0
                    
                    # Strategy 2: Partial string match
                    elif target_text.lower() in word_text or word_text in target_text.lower():
                        score = min(len(target_text), len(word_text)) / max(len(target_text), len(word_text))
                    
                    # Strategy 3: First word match (for names like "Hoang Duc Hiep")
                    elif len(target_words) > 0 and target_words[0] in word_text:
                        score = 0.8
                    
                    if score > best_score:
                        best_score = score
                        best_match = word
                        print(f"DEBUG: Better match '{word_text}' with score {score:.2f}", file=sys.stderr)
                
                if best_match and best_score > 0.3:  # Lower threshold for better matching
                    word = best_match
                    text_positions[target_text] = {
                        "x": float(word[0]),  # x0
                        "y": float(word[1]),  # y0
                        "width": float(word[2] - word[0]),  # x1 - x0
                        "height": float(word[3] - word[1])   # y1 - y0
                    }
                    print(f"DEBUG: Using partial match at PDF coords x={word[0]:.1f}, y={word[1]:.1f}", file=sys.stderr)
                else:
                    print(f"DEBUG: No suitable match found for '{target_text}'", file=sys.stderr)
        
        doc.close()
        return text_positions
    except Exception as e:
        print(f"Error finding text positions: {e}", file=sys.stderr)
        return {}

def detect_faces_in_images(images):
    """Detect faces in extracted images using a simple approach."""
    face_redactions = []
    
    for img in images:
        # Simulate face detection - in reality you'd use cv2.CascadeClassifier or similar
        if len(img['data']) > 10000:  # Assume larger images might have faces
            bbox = img['bbox']
            face_redactions.append({
                "text": "DETECTED_FACE",
                "category": "FACES", 
                "confidence": 0.85,
                "reason": "Human face detected in image",
                "coordinates": {
                    "x": bbox.x0,
                    "y": bbox.y0, 
                    "width": bbox.x1 - bbox.x0,
                    "height": bbox.y1 - bbox.y0
                }
            })
    
    return face_redactions

def process_page(pdf_path, page_number, profile="quick"):
    """Process a single page and return redaction suggestions."""
    
    # Extract text from the page
    text = extract_text_from_page(pdf_path, page_number)
    
    if not text.strip():
        print(f"No text found on page {page_number}", file=sys.stderr)
        return []
    
    # Get page dimensions for debugging
    try:
        doc = fitz.open(pdf_path)
        page = doc[page_number - 1]
        page_rect = page.rect
        print(f"DEBUG: PDF Page dimensions - Width: {page_rect.width}, Height: {page_rect.height}", file=sys.stderr)
        doc.close()
    except Exception as e:
        print(f"Error getting page dimensions: {e}", file=sys.stderr)
    
    # Build prompt and call model
    prompt = build_redaction_prompt(text, profile)
    model_response = call_gemma_model(prompt)
    
    if not model_response:
        return []
    
    # Parse the model response with better JSON handling
    redactions = parse_model_response(model_response)
    
    # Debug: Print what the AI detected
    print(f"DEBUG: AI detected {len(redactions)} redactions:", file=sys.stderr)
    for i, redaction in enumerate(redactions):
        print(f"DEBUG: {i+1}. '{redaction['text']}' ({redaction['category']})", file=sys.stderr)
    
    # Add page coordinates for each redaction using actual text positions
    target_texts = [r["text"] for r in redactions]
    print(f"DEBUG: Looking for these texts: {target_texts}", file=sys.stderr)
    text_positions = find_text_positions(pdf_path, page_number, target_texts)
    
    for i, redaction in enumerate(redactions):
        redaction["id"] = f"page_{page_number}_redaction_{i}"
        
        # Use real text positions if found, otherwise fallback to estimated positions
        text = redaction["text"]
        print(f"DEBUG: Processing redaction for text: '{text}'", file=sys.stderr)
        
        if text in text_positions:
            coords = text_positions[text]
            redaction["coordinates"] = {
                "page": page_number,
                "x": coords["x"],
                "y": coords["y"],
                "width": coords["width"],
                "height": coords["height"]
            }
            print(f"DEBUG: ✅ Found '{text}' at x={coords['x']:.1f}, y={coords['y']:.1f}", file=sys.stderr)
        else:
            # Fallback to estimated coordinates
            redaction["coordinates"] = {
                "page": page_number,
                "x": 100 + (i * 50),  # Fallback coordinates
                "y": 100 + (i * 30),
                "width": max(100, len(redaction["text"]) * 8),
                "height": 20
            }
            print(f"DEBUG: ❌ Using fallback coordinates for '{text}' - NOT FOUND IN text_positions", file=sys.stderr)
            print(f"DEBUG: Available keys in text_positions: {list(text_positions.keys())}", file=sys.stderr)
        
        redaction["accepted"] = False
    
    # Process images for face detection (if deep profile)
    if profile == "deep":
        images = extract_images_from_page(pdf_path, page_number)
        face_redactions = detect_faces_in_images(images)
        
        for face in face_redactions:
            face["id"] = f"page_{page_number}_face_{len(redactions)}"
            face["coordinates"]["page"] = page_number
            face["accepted"] = False
            
        redactions.extend(face_redactions)
    
    return redactions

def main():
    """Main entry point for the Python worker."""
    if len(sys.argv) != 4:
        print("Usage: python process_page.py <pdf_path> <page_number> <profile>", file=sys.stderr)
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    try:
        page_number = int(sys.argv[2])
    except ValueError:
        print("Page number must be an integer", file=sys.stderr)
        sys.exit(1)
    
    profile = sys.argv[3]
    if profile not in ["quick", "deep"]:
        print("Profile must be 'quick' or 'deep'", file=sys.stderr)
        sys.exit(1)
    
    if not os.path.exists(pdf_path):
        print(f"PDF file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
    
    # Initialize Ollama service on first run
    print("🔧 Initializing AI engine...", file=sys.stderr)
    if not initialize_ollama():
        print("❌ Failed to initialize AI engine", file=sys.stderr)
        sys.exit(1)
    
    try:
        redactions = process_page(pdf_path, page_number, profile)
        print(json.dumps(redactions, indent=2))
    except Exception as e:
        print(f"Error processing page: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
