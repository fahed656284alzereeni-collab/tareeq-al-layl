import sys
import fitz
from pdf2docx import Converter

source_path = sys.argv[1]
output_path = sys.argv[2]

with fitz.open(source_path) as document:
    if document.page_count > 150:
        raise SystemExit(20)
    if document.page_count < 1:
        raise SystemExit(2)

converter = Converter(source_path)
try:
    converter.convert(output_path, start=0, end=None)
finally:
    converter.close()
