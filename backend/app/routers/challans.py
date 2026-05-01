import re
from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import Response
from app.services.sheets import (
    get_all_challans,
    get_all_item_counts,
    get_challan_by_id,
    get_line_items_by_challan,
    delete_challan,
)
from app.services.drive import _get_service, delete_challan_drive_files

router = APIRouter()


@router.get("/challans")
def list_challans():
    challans = get_all_challans()
    counts = get_all_item_counts()
    for c in challans:
        cid = c.get("id", "")
        c["total_items"] = counts.get(cid, {}).get("total", 0)
        c["delivered_items"] = counts.get(cid, {}).get("delivered", 0)
    return challans


@router.get("/challans/{challan_id}")
def get_challan(challan_id: str):
    challan = get_challan_by_id(challan_id)
    if not challan:
        raise HTTPException(status_code=404, detail="Challan not found")
    items = get_line_items_by_challan(challan_id)
    return {**challan, "line_items": items}


@router.delete("/challans/{challan_id}")
def remove_challan(challan_id: str, background_tasks: BackgroundTasks):
    challan = get_challan_by_id(challan_id)
    if not challan:
        raise HTTPException(status_code=404, detail="Challan not found")
    ok = delete_challan(challan_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Challan not found")
    background_tasks.add_task(
        delete_challan_drive_files,
        challan.get("pdf_url", ""),
        challan.get("challan_no", ""),
    )
    return {"deleted": True}


@router.get("/images/{file_id}")
def proxy_image(file_id: str):
    """Proxy Drive image through backend — avoids shared-drive public-access restrictions."""
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", file_id):
        raise HTTPException(status_code=400, detail="Invalid file ID")
    try:
        import io
        from googleapiclient.http import MediaIoBaseDownload
        service = _get_service()
        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
        buf = io.BytesIO()
        dl = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = dl.next_chunk()
        return Response(content=buf.getvalue(), media_type="image/jpeg",
                        headers={"Cache-Control": "public, max-age=86400"})
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
