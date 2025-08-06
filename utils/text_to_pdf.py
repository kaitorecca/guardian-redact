#!/usr/bin/env python3
"""
Simple text to PDF converter for testing Guardian Redact
"""

import sys
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

def text_to_pdf(text_file_path, output_pdf_path):
    """Convert a text file to PDF."""
    try:
        with open(text_file_path, 'r', encoding='utf-8') as file:
            lines = file.readlines()
        
        c = canvas.Canvas(output_pdf_path, pagesize=letter)
        width, height = letter
        
        y = height - 50  # Start from top
        line_height = 14
        
        for line in lines:
            line = line.rstrip('\n')
            if y < 50:  # Start new page if needed
                c.showPage()
                y = height - 50
            
            c.drawString(50, y, line)
            y -= line_height
        
        c.save()
        print(f"PDF created successfully: {output_pdf_path}")
        return True
        
    except Exception as e:
        print(f"Error creating PDF: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python text_to_pdf.py <input_text> <output_pdf>")
        sys.exit(1)
    
    text_to_pdf(sys.argv[1], sys.argv[2])
