import os
import tempfile
import traceback
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from app.services.sheets import (
    update_item_delivered,
    update_challan_status,
    get_challan_by_id,
    get_line_items_by_challan,
    batch_update_image_urls,
)
from app.services.drive import download_pdf_from_drive, upload_images_batch
from app.services.pdf_parser import extract_images_ordered

router = APIRouter()


class DeliveryUpdate(BaseModel):
    delivered: bool


class StatusUpdate(BaseModel):
    status: str


@router.patch("/challans/{challan_id}/status")
def set_challan_status(challan_id: str, body: StatusUpdate):
    ok = update_challan_status(challan_id, body.status)
    if not ok:
        raise HTTPException(status_code=404, detail="Challan not found")
    return {"updated": True}


@router.patch("/challans/{challan_id}/items/{item_id}/delivered")
def set_item_delivered(challan_id: str, item_id: str, body: DeliveryUpdate):
    ok = update_item_delivered(item_id, body.delivered)
    if not ok:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"updated": True}


def _bg_reprocess(pdf_bytes: bytes, items: list[dict], challan_no: str) -> None:
    print(f"[bg] _bg_reprocess started: {len(items)} items, challan={challan_no}")
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name

        images = extract_images_ordered(tmp_path)
        if images:
            images = images[1:]  # skip logo
        if not images:
            print(f"[reprocess] no images extracted for {challan_no}")
            return

        id_url_map = upload_images_batch(images, items, challan_no)
        if id_url_map:
            batch_update_image_urls(id_url_map)
            print(f"[reprocess] {len(id_url_map)} images updated for {challan_no}")
    except Exception:
        traceback.print_exc()
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/challans/{challan_id}/reprocess-images")
def reprocess_images(challan_id: str, background_tasks: BackgroundTasks):
    """Re-download the PDF, re-extract images, re-upload. Use when images are missing."""
    challan = get_challan_by_id(challan_id)
    if not challan:
        raise HTTPException(status_code=404, detail="Challan not found")

    pdf_url = challan.get("pdf_url", "")
    if not pdf_url:
        raise HTTPException(status_code=400, detail="No PDF URL stored for this challan")

    items = get_line_items_by_challan(challan_id)
    if not items:
        raise HTTPException(status_code=404, detail="No line items found")

    challan_no = challan.get("challan_no") or challan_id[:8]

    try:
        pdf_bytes = download_pdf_from_drive(pdf_url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not download PDF: {e}")

    background_tasks.add_task(_bg_reprocess, pdf_bytes, items, challan_no)

    return {"message": "Reprocessing started", "challan_no": challan_no, "items": len(items)}
