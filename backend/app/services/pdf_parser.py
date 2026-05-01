import re
import fitz  # PyMuPDF
import pdfplumber
from app.models.challan import ChallanHeader
from app.models.line_item import LineItem


def _safe_int(val) -> int:
    try:
        return int(str(val).strip()) if val and str(val).strip() not in ("-", "") else 0
    except (ValueError, TypeError):
        return 0


def _safe_float(val) -> float:
    try:
        return float(str(val).replace(",", "").strip()) if val and str(val).strip() not in ("-", "") else 0.0
    except (ValueError, TypeError):
        return 0.0


def extract_header(text: str) -> dict:
    patterns = {
        "challan_no":  r"Delivery Challan No[.:\s]+([A-Z0-9\-]+)",
        "issue_date":  r"Issue Date[.:\s]+([\d]{1,2}\s+\w+,?\s+\d{4}[^\\n]*?)(?:\n|Order)",
        "order_no":    r"Order No\.[.:\s]+([A-Z0-9\-]+)",
        "order_date":  r"(?:Direct\s+)?Order Date[.:\s]+([\d]{1,2}\s+\w+,?\s+\d{4})",
        # Stop at Delivery Challan / Phone / newline — avoids consuming the challan no. line
        "client_name": r"M/S[.:\s]*(.+?)(?=\s*(?:Delivery Challan|Phone No\.|\n))",
        "phone":       r"Phone No[.:\s]+([\d]+)",
        # Require city to start with a letter so stray dashes / "Order No." don't match
        "city":        r"City[.:\s]+([A-Za-z][^\n]*?)(?:\s*(?:\n|Agency|Order No\.|$))",
        "agency":      r"Agency[.:\s]+([A-Za-z][^\n]*?)(?:\s*(?:\n|(?:Direct\s+)?Order Date|$))",
        "gst_no":      r"GST No[.:\s]+([A-Z0-9]+)",
    }
    result = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        result[key] = match.group(1).strip() if match else ""
    return result


SIZE_COLS = ["2XL", "3XL", "4XL", "5XL", "6XL", "L", "M", "S", "XL"]
SIZE_KEYS = ["qty_2xl", "qty_3xl", "qty_4xl", "qty_5xl", "qty_6xl", "qty_l", "qty_m", "qty_s", "qty_xl"]


def extract_line_items(pdf_path: str) -> list[dict]:
    items = []
    seen_sr = set()

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables({
                "vertical_strategy": "lines",
                "horizontal_strategy": "lines",
            })
            for table in tables:
                for row in table:
                    if not row or not row[0]:
                        continue
                    sr_raw = str(row[0]).strip()
                    if not sr_raw.isdigit():
                        continue
                    sr = int(sr_raw)
                    if sr in seen_sr:
                        continue
                    seen_sr.add(sr)

                    try:
                        item = {
                            "sr": sr,
                            "item_code": str(row[1]).strip() if row[1] else "",
                            "tag": str(row[2]).strip() if row[2] else "",
                            "color": str(row[3]).strip() if row[3] else "",
                            "hsn": str(row[4]).strip() if row[4] else "",
                            "delivered": False,
                        }
                        for i, key in enumerate(SIZE_KEYS):
                            item[key] = _safe_int(row[5 + i] if len(row) > 5 + i else None)

                        item["total_qty"] = _safe_int(row[14] if len(row) > 14 else None)
                        item["price"] = _safe_float(row[15] if len(row) > 15 else None)
                        item["amount"] = _safe_float(row[16] if len(row) > 16 else None)
                        items.append(item)
                    except (IndexError, ValueError):
                        continue

    return items


def extract_images_ordered(pdf_path: str) -> list[tuple[bytes, str]]:
    """
    Extract embedded product images from PDF sorted by (page, y-position).
    Filters out tiny/banner images that are decorative rather than product thumbnails.
    Returns list of (image_bytes, file_extension) tuples.
    """
    doc = fitz.open(pdf_path)
    images_with_pos: list[tuple[int, float, float, float, bytes, str]] = []
    seen_xrefs: set[int] = set()

    for page_num in range(len(doc)):
        page = doc[page_num]
        img_list = page.get_images(full=True)

        for img in img_list:
            xref = img[0]
            if xref in seen_xrefs:
                continue
            seen_xrefs.add(xref)

            try:
                rect = page.get_image_bbox(img)
                y0 = rect.y0
                width = rect.x1 - rect.x0
                height = rect.y1 - rect.y0
            except Exception:
                y0, width, height = 0.0, 0.0, 0.0

            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image.get("ext", "jpeg")

            # Skip logo/decorative: too small in bytes or extremely wide (header banner)
            if len(image_bytes) < 800:
                continue
            if width > 0 and height > 0 and width > height * 6:
                continue

            images_with_pos.append((page_num, y0, width, height, image_bytes, image_ext))

    doc.close()
    images_with_pos.sort(key=lambda x: (x[0], x[1]))
    return [(b, e) for _, _, _, _, b, e in images_with_pos]


def parse_challan(pdf_path: str) -> dict:
    with pdfplumber.open(pdf_path) as pdf:
        full_text = "\n".join(page.extract_text() or "" for page in pdf.pages)

    header = extract_header(full_text)
    line_items = extract_line_items(pdf_path)
    images = extract_images_ordered(pdf_path)
    # First extracted image is always the company logo — skip it
    if images:
        images = images[1:]

    return {
        "header": header,
        "line_items": line_items,
        "images": images,
        "raw_text": full_text,
    }
