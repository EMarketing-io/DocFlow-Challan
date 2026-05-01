import os
import uuid
import tempfile
import traceback
from fastapi import APIRouter, BackgroundTasks, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from app.services.pdf_parser import parse_challan
from app.services.drive import upload_to_drive, upload_images_batch
from app.services.sheets import append_challan, append_line_items, batch_update_image_urls

router = APIRouter()


def _bg_upload_images(
    images: list[tuple[bytes, str]],
    items: list[dict],
    challan_no: str,
) -> None:
    """Background task: upload all item images then batch-update the sheet."""
    print(f"[bg] _bg_upload_images started: {len(images)} images, {len(items)} items, challan={challan_no}")
    try:
        id_url_map = upload_images_batch(images, items, challan_no)
        print(f"[bg] upload_images_batch returned {len(id_url_map)} URLs")
        if id_url_map:
            batch_update_image_urls(id_url_map)
        else:
            print("[bg] id_url_map empty — sheet not updated")
    except Exception:
        traceback.print_exc()


@router.post("/challans/upload")
async def upload_challan(
    background_tasks: BackgroundTasks,
    doer_name: str = Form(...),
    entry_date: str = Form(...),
    track: str = Form(...),
    file: UploadFile = File(...),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files accepted")

    challan_id = str(uuid.uuid4())
    content = await file.read()

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # ── 1. Parse (fast — in-process) ──────────────────────────────────
        parsed = parse_challan(tmp_path)
        header = parsed["header"]
        items  = parsed["line_items"]
        images = parsed["images"]          # list[(bytes, ext)] — already in memory

        challan_no = header.get("challan_no") or challan_id[:8]

        # ── 2. Upload PDF to Drive ─────────────────────────────────────────
        drive_url = upload_to_drive(file_path=tmp_path, filename=f"{challan_no}.pdf")

        # ── 3. Write metadata + items to Sheets (image_url blank for now) ─
        for item in items:
            item.setdefault("image_url", "")

        row = {
            "id": challan_id,
            "doer_name": doer_name,
            "entry_date": entry_date,
            "track": track,
            "pdf_url": drive_url,
            **header,
            "status": "pending",
        }
        append_challan(row)
        append_line_items(challan_id, items)
        # append_line_items assigns item["id"] in-place — items now have UUIDs

        # ── 4. Return immediately ──────────────────────────────────────────
        if images:
            background_tasks.add_task(_bg_upload_images, images, items, challan_no)

        return JSONResponse({
            "id": challan_id,
            "challan_no": challan_no,
            "items_extracted": len(items),
            "images_count": len(images),
            "pdf_url": drive_url,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)
