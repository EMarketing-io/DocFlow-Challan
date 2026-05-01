import io
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload, MediaIoBaseDownload
from google.oauth2 import service_account
from app.config import settings

SCOPES = ["https://www.googleapis.com/auth/drive"]

_MIME = {
    "jpeg": "image/jpeg",
    "jpg":  "image/jpeg",
    "png":  "image/png",
    "webp": "image/webp",
    "gif":  "image/gif",
}


def _get_service():
    if settings.google_credentials_json:
        import json
        info = json.loads(settings.google_credentials_json)
        creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    else:
        creds = service_account.Credentials.from_service_account_file(
            settings.google_service_account_path, scopes=SCOPES
        )
    return build("drive", "v3", credentials=creds)


def _get_or_create_folder(service, parent_id: str, name: str) -> str:
    query = (
        f"name='{name}' and '{parent_id}' in parents "
        f"and mimeType='application/vnd.google-apps.folder' and trashed=false"
    )
    res = service.files().list(
        q=query, fields="files(id)",
        supportsAllDrives=True, includeItemsFromAllDrives=True,
    ).execute()
    if res.get("files"):
        return res["files"][0]["id"]
    f = service.files().create(
        body={"name": name, "mimeType": "application/vnd.google-apps.folder", "parents": [parent_id]},
        fields="id", supportsAllDrives=True,
    ).execute()
    return f["id"]


def _make_public(service, file_id: str) -> None:
    service.permissions().create(
        fileId=file_id,
        body={"type": "anyone", "role": "reader"},
        supportsAllDrives=True,
    ).execute()


def upload_to_drive(file_path: str, filename: str) -> str:
    """Upload PDF. Non-resumable — faster for typical challan file sizes."""
    service = _get_service()
    month_id = _get_or_create_folder(service, settings.google_drive_folder_id, datetime.now().strftime("%Y-%m"))
    meta = {"name": filename, "parents": [month_id]}
    media = MediaFileUpload(file_path, mimetype="application/pdf")
    f = service.files().create(
        body=meta, media_body=media,
        fields="id,webViewLink", supportsAllDrives=True,
    ).execute()
    _make_public(service, f["id"])
    return f.get("webViewLink", "")


def _upload_one_image(img_bytes: bytes, img_ext: str, filename: str, folder_id: str) -> str:
    """Upload a single image using in-memory buffer — no temp file, no Windows file-lock issues."""
    service = _get_service()
    mime = _MIME.get(img_ext.lower(), "image/jpeg")
    try:
        buf = io.BytesIO(img_bytes)
        meta = {"name": filename, "parents": [folder_id]}
        media = MediaIoBaseUpload(buf, mimetype=mime)
        f = service.files().create(
            body=meta, media_body=media, fields="id", supportsAllDrives=True,
        ).execute()
        return f"/api/images/{f['id']}"
    except Exception:
        return ""


def upload_images_batch(
    images: list[tuple[bytes, str]],
    items: list[dict],
    challan_no: str,
    max_workers: int = 10,
) -> dict[str, str]:
    """
    Upload all item images in parallel (10 workers by default).
    Returns {item_id: thumbnail_url} for successful uploads.
    ~10-15s for 84 images vs ~90s sequential.
    """
    if not images:
        print("[drive] upload_images_batch: images list is empty — skip")
        return {}

    # One service call to set up folders (shared, no per-image overhead)
    svc = _get_service()
    month_id = _get_or_create_folder(svc, settings.google_drive_folder_id, datetime.now().strftime("%Y-%m"))
    folder_id = _get_or_create_folder(svc, month_id, f"{challan_no}_images")

    # Build task list
    tasks: list[tuple[int, str, bytes, str, str]] = []  # (idx, item_id, bytes, ext, filename)
    for i, item in enumerate(items):
        if i >= len(images):
            break
        img_bytes, img_ext = images[i]
        item_id = item.get("id", "")
        if not item_id:
            continue
        filename = f"{challan_no}_item_{item['sr']}.{img_ext}"
        tasks.append((i, item_id, img_bytes, img_ext, filename))

    print(f"[drive] upload_images_batch: {len(tasks)} tasks, folder={folder_id}")
    result: dict[str, str] = {}

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        future_map = {
            pool.submit(_upload_one_image, img_bytes, img_ext, filename, folder_id): item_id
            for _, item_id, img_bytes, img_ext, filename in tasks
        }
        for future in as_completed(future_map):
            item_id = future_map[future]
            try:
                url = future.result()
            except Exception as e:
                print(f"[drive] upload failed for {item_id}: {e}")
                url = ""
            if url:
                result[item_id] = url

    print(f"[drive] upload_images_batch done: {len(result)}/{len(tasks)} succeeded")
    if result:
        sample_id = next(iter(result))
        print(f"[drive] sample id={sample_id!r}, url={result[sample_id][:60]}")
    return result


def delete_challan_drive_files(pdf_url: str, challan_no: str) -> None:
    """Delete PDF file and images folder from Drive. Best-effort — errors are logged, not raised."""
    service = _get_service()

    # Delete PDF
    if pdf_url:
        match = re.search(r"/d/([a-zA-Z0-9_-]+)", pdf_url)
        if match:
            try:
                service.files().delete(fileId=match.group(1), supportsAllDrives=True).execute()
                print(f"[drive] deleted PDF {match.group(1)}")
            except Exception as e:
                print(f"[drive] could not delete PDF: {e}")

    # Find and delete images folder by name
    if challan_no:
        folder_name = f"{challan_no}_images"
        try:
            res = service.files().list(
                q=f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
                fields="files(id,name)",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            ).execute()
            for f in res.get("files", []):
                try:
                    service.files().delete(fileId=f["id"], supportsAllDrives=True).execute()
                    print(f"[drive] deleted images folder {f['id']} ({folder_name})")
                except Exception as e:
                    print(f"[drive] could not delete folder {f['id']}: {e}")
        except Exception as e:
            print(f"[drive] could not search for images folder: {e}")


def download_pdf_from_drive(pdf_url: str) -> bytes:
    """Download a PDF from Drive given its webViewLink. Used for reprocessing."""
    match = re.search(r"/d/([a-zA-Z0-9_-]+)", pdf_url)
    if not match:
        raise ValueError(f"Cannot extract file ID from URL: {pdf_url}")
    file_id = match.group(1)

    service = _get_service()
    request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buf.getvalue()
