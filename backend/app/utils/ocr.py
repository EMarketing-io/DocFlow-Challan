import pytesseract
from pdf2image import convert_from_path


def pdf_to_text_ocr(pdf_path: str, dpi: int = 300) -> str:
    images = convert_from_path(pdf_path, dpi=dpi)
    return "\n".join(pytesseract.image_to_string(img, lang="eng") for img in images)
