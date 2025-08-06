#!/usr/bin/env python3
"""
Guardian Redact - PDF Export Worker
Applies redactions to a PDF and exports a new flattened document
"""

import sys
import json
import os
import fitz  # PyMuPDF
from PIL import Image, ImageDraw

def apply_text_redactions(doc, redactions):
    """Apply text redactions to the PDF document."""
    
    for redaction in redactions:
        if not redaction.get('accepted', False):
            continue
            
        coords = redaction['coordinates']
        page_num = coords['page'] - 1  # Convert to 0-based index
        
        if page_num < 0 or page_num >= len(doc):
            continue
            
        page = doc[page_num]
        
        # Create redaction rectangle
        rect = fitz.Rect(
            coords['x'],
            coords['y'], 
            coords['x'] + coords['width'],
            coords['y'] + coords['height']
        )
        
        # Add redaction annotation (black rectangle)
        redact_annot = page.add_redact_annot(rect)
        redact_annot.set_colors(stroke=[0, 0, 0], fill=[0, 0, 0])  # Black
        redact_annot.update()
        
    # Apply all redactions
    for page in doc:
        page.apply_redactions()

def apply_image_redactions(doc, redactions):
    """Apply face/image redactions to the PDF document."""
    
    for redaction in redactions:
        if not redaction.get('accepted', False) or redaction['category'] != 'FACES':
            continue
            
        coords = redaction['coordinates']
        page_num = coords['page'] - 1
        
        if page_num < 0 or page_num >= len(doc):
            continue
            
        page = doc[page_num]
        
        # Create redaction rectangle for face
        rect = fitz.Rect(
            coords['x'],
            coords['y'],
            coords['x'] + coords['width'], 
            coords['y'] + coords['height']
        )
        
        # Add a black rectangle to cover the face
        page.draw_rect(rect, color=[0, 0, 0], fill=[0, 0, 0])

def export_redacted_pdf(input_path, redactions, output_path):
    """Export the PDF with redactions applied."""
    
    try:
        # Open the original PDF
        doc = fitz.open(input_path)
        
        # Apply text redactions
        text_redactions = [r for r in redactions if r['category'] != 'FACES']
        apply_text_redactions(doc, text_redactions)
        
        # Apply image/face redactions
        image_redactions = [r for r in redactions if r['category'] == 'FACES']
        apply_image_redactions(doc, image_redactions)
        
        # Save the redacted document
        doc.save(output_path, garbage=4, deflate=True)
        doc.close()
        
        return True
        
    except Exception as e:
        print(f"Error exporting redacted PDF: {e}", file=sys.stderr)
        return False

def main():
    """Main entry point for the PDF export worker."""
    if len(sys.argv) != 4:
        print("Usage: python export_pdf.py <input_pdf> <redactions_json> <output_pdf>", file=sys.stderr)
        sys.exit(1)
    
    input_pdf = sys.argv[1]
    redactions_json = sys.argv[2]
    output_pdf = sys.argv[3]
    
    if not os.path.exists(input_pdf):
        print(f"Input PDF not found: {input_pdf}", file=sys.stderr)
        sys.exit(1)
    
    try:
        redactions = json.loads(redactions_json)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON in redactions: {e}", file=sys.stderr)
        sys.exit(1)
    
    success = export_redacted_pdf(input_pdf, redactions, output_pdf)
    
    if success:
        print(f"Successfully exported redacted PDF to: {output_pdf}")
    else:
        print("Failed to export redacted PDF", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
