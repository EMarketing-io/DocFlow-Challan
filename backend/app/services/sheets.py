import uuid
from datetime import datetime
from googleapiclient.discovery import build
from google.oauth2 import service_account
from app.config import settings

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

CHALLAN_COLS = [
    "id", "doer_name", "entry_date", "track", "challan_no", "issue_date",
    "order_no", "order_date", "client_name", "phone", "city", "agency",
    "gst_no", "pdf_url", "status", "created_at",
]

ITEM_COLS = [
    "id", "challan_id", "sr", "item_code", "tag", "color", "hsn",
    "qty_2xl", "qty_3xl", "qty_4xl", "qty_5xl", "qty_6xl",
    "qty_l", "qty_m", "qty_s", "qty_xl",
    "total_qty", "price", "amount", "delivered", "image_url",
]


def _get_service():
    if settings.google_credentials_json:
        import json
        info = json.loads(settings.google_credentials_json)
        creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    else:
        creds = service_account.Credentials.from_service_account_file(
            settings.google_service_account_path, scopes=SCOPES
        )
    return build("sheets", "v4", credentials=creds)


def _sheet(service):
    return service.spreadsheets().values()


def ensure_headers():
    service = _get_service()
    sh = _sheet(service)
    sh.update(
        spreadsheetId=settings.google_sheet_id,
        range="challans!A1",
        valueInputOption="RAW",
        body={"values": [CHALLAN_COLS]},
    ).execute()
    sh.update(
        spreadsheetId=settings.google_sheet_id,
        range="line_items!A1",
        valueInputOption="RAW",
        body={"values": [ITEM_COLS]},
    ).execute()


def append_challan(data: dict) -> None:
    data.setdefault("created_at", datetime.utcnow().isoformat())
    row = [str(data.get(c, "")) for c in CHALLAN_COLS]
    _get_service().spreadsheets().values().append(
        spreadsheetId=settings.google_sheet_id,
        range="challans!A1",
        valueInputOption="RAW",
        body={"values": [row]},
    ).execute()


def append_line_items(challan_id: str, items: list[dict]) -> None:
    if not items:
        return
    rows = []
    for item in items:
        item["id"] = str(uuid.uuid4())
        item["challan_id"] = challan_id
        rows.append([str(item.get(c, "")) for c in ITEM_COLS])

    _get_service().spreadsheets().values().append(
        spreadsheetId=settings.google_sheet_id,
        range="line_items!A1",
        valueInputOption="RAW",
        body={"values": rows},
    ).execute()


def get_all_challans() -> list[dict]:
    service = _get_service()
    res = _sheet(service).get(
        spreadsheetId=settings.google_sheet_id,
        range="challans!A1:Z10000",
    ).execute()
    rows = res.get("values", [])
    if len(rows) < 2:
        return []
    headers = rows[0]
    return [dict(zip(headers, row + [""] * (len(headers) - len(row)))) for row in rows[1:]]


def get_challan_by_id(challan_id: str) -> dict | None:
    challans = get_all_challans()
    return next((c for c in challans if c.get("id") == challan_id), None)


def get_line_items_by_challan(challan_id: str) -> list[dict]:
    service = _get_service()
    res = _sheet(service).get(
        spreadsheetId=settings.google_sheet_id,
        range="line_items!A1:Z100000",
    ).execute()
    rows = res.get("values", [])
    if len(rows) < 2:
        return []
    headers = rows[0]
    all_items = [dict(zip(headers, row + [""] * (len(headers) - len(row)))) for row in rows[1:]]
    return [i for i in all_items if i.get("challan_id") == challan_id]


def update_item_delivered(item_id: str, delivered: bool) -> bool:
    service = _get_service()
    res = _sheet(service).get(
        spreadsheetId=settings.google_sheet_id,
        range="line_items!A1:Z100000",
    ).execute()
    rows = res.get("values", [])
    if len(rows) < 2:
        return False

    headers = rows[0]
    id_col = headers.index("id") if "id" in headers else 0
    delivered_col = headers.index("delivered") if "delivered" in headers else -1
    if delivered_col == -1:
        return False

    col_letter = chr(ord("A") + delivered_col)
    for idx, row in enumerate(rows[1:], start=2):
        if len(row) > id_col and row[id_col] == item_id:
            _sheet(service).update(
                spreadsheetId=settings.google_sheet_id,
                range=f"line_items!{col_letter}{idx}",
                valueInputOption="RAW",
                body={"values": [["TRUE" if delivered else "FALSE"]]},
            ).execute()
            return True
    return False


def update_challan_status(challan_id: str, status: str) -> bool:
    service = _get_service()
    res = _sheet(service).get(
        spreadsheetId=settings.google_sheet_id,
        range="challans!A1:Z10000",
    ).execute()
    rows = res.get("values", [])
    if len(rows) < 2:
        return False

    headers = rows[0]
    id_col = headers.index("id") if "id" in headers else 0
    status_col = headers.index("status") if "status" in headers else -1
    if status_col == -1:
        return False

    col_letter = chr(ord("A") + status_col)
    for idx, row in enumerate(rows[1:], start=2):
        if len(row) > id_col and row[id_col] == challan_id:
            _sheet(service).update(
                spreadsheetId=settings.google_sheet_id,
                range=f"challans!{col_letter}{idx}",
                valueInputOption="RAW",
                body={"values": [[status]]},
            ).execute()
            return True
    return False


def _col_letter(index: int) -> str:
    """Convert 0-based column index to spreadsheet letter (supports AA, AB, ...)."""
    result = ""
    index += 1
    while index:
        index, rem = divmod(index - 1, 26)
        result = chr(65 + rem) + result
    return result


def batch_update_image_urls(item_id_url_map: dict[str, str]) -> None:
    """Single batchUpdate call to write image_url for all items at once."""
    if not item_id_url_map:
        print("[sheets] batch_update_image_urls: empty map, skip")
        return
    print(f"[sheets] batch_update_image_urls: {len(item_id_url_map)} URLs to write")
    service = _get_service()
    res = _sheet(service).get(
        spreadsheetId=settings.google_sheet_id,
        range="line_items!A1:ZZ100000",
    ).execute()
    rows = res.get("values", [])
    if len(rows) < 2:
        print("[sheets] batch_update_image_urls: sheet has no data rows")
        return

    headers = rows[0]
    print(f"[sheets] headers found: {headers}")

    # Self-heal: if image_url column missing from header, add it now then re-read
    if "image_url" not in headers:
        print("[sheets] image_url missing from headers — running ensure_headers()")
        ensure_headers()
        res2 = _sheet(service).get(
            spreadsheetId=settings.google_sheet_id,
            range="line_items!A1:ZZ100000",
        ).execute()
        rows = res2.get("values", [])
        if not rows:
            print("[sheets] re-read returned empty — abort")
            return
        headers = rows[0]
        print(f"[sheets] headers after heal: {headers}")

    if "id" not in headers:
        print("[sheets] 'id' column not found in headers — abort")
        return
    if "image_url" not in headers:
        print("[sheets] 'image_url' still not in headers after heal — abort")
        return

    id_col = headers.index("id")
    img_col = headers.index("image_url")
    img_col_letter = _col_letter(img_col)
    print(f"[sheets] id_col={id_col}, img_col={img_col}, col_letter={img_col_letter}")

    data = []
    for idx, row in enumerate(rows[1:], start=2):
        if len(row) > id_col:
            item_id = row[id_col].strip()
            if item_id in item_id_url_map and item_id_url_map[item_id]:
                data.append({
                    "range": f"line_items!{img_col_letter}{idx}",
                    "values": [[item_id_url_map[item_id]]],
                })

    print(f"[sheets] matched {len(data)} rows to update")
    if data:
        _sheet(service).batchUpdate(
            spreadsheetId=settings.google_sheet_id,
            body={"valueInputOption": "RAW", "data": data},
        ).execute()
        print(f"[sheets] batchUpdate done — {len(data)} image URLs written")
    else:
        print(f"[sheets] no rows matched. map IDs sample: {list(item_id_url_map.keys())[:3]}")
        if len(rows) > 1:
            sample_row = rows[1]
            print(f"[sheets] sheet row[1] sample (first 3 cols): {sample_row[:3]}")


def _get_sheet_id_map(service) -> dict[str, int]:
    """Return {sheet_title: sheetId} for all tabs in the spreadsheet."""
    meta = service.spreadsheets().get(
        spreadsheetId=settings.google_sheet_id,
        fields="sheets.properties",
    ).execute()
    return {
        s["properties"]["title"]: s["properties"]["sheetId"]
        for s in meta.get("sheets", [])
    }


def delete_challan(challan_id: str) -> bool:
    service = _get_service()
    sheet_ids = _get_sheet_id_map(service)

    challans_sid = sheet_ids.get("challans")
    items_sid = sheet_ids.get("line_items")
    if challans_sid is None:
        return False

    requests = []

    # ── 1. Find challan row ───────────────────────────────────────────────
    res = _sheet(service).get(
        spreadsheetId=settings.google_sheet_id,
        range="challans!A1:Z10000",
    ).execute()
    rows = res.get("values", [])
    if len(rows) < 2:
        return False

    headers = rows[0]
    id_col = headers.index("id") if "id" in headers else 0
    challan_row_idx = None
    for idx, row in enumerate(rows[1:], start=2):
        if len(row) > id_col and row[id_col].strip() == challan_id:
            challan_row_idx = idx
            break

    if challan_row_idx is None:
        return False

    # ── 2. Find all line-item rows for this challan ───────────────────────
    item_row_indices = []
    if items_sid is not None:
        res2 = _sheet(service).get(
            spreadsheetId=settings.google_sheet_id,
            range="line_items!A1:ZZ100000",
        ).execute()
        irows = res2.get("values", [])
        if len(irows) >= 2:
            iheaders = irows[0]
            cid_col = iheaders.index("challan_id") if "challan_id" in iheaders else 1
            for idx, row in enumerate(irows[1:], start=2):
                if len(row) > cid_col and row[cid_col].strip() == challan_id:
                    item_row_indices.append(idx)

    # ── 3. Build deleteDimension requests (descending order to avoid index shift) ──
    # Delete line items first (higher sheet, sort desc), then challan row
    for row_idx in sorted(item_row_indices, reverse=True):
        requests.append({
            "deleteDimension": {
                "range": {
                    "sheetId": items_sid,
                    "dimension": "ROWS",
                    "startIndex": row_idx - 1,
                    "endIndex": row_idx,
                }
            }
        })

    requests.append({
        "deleteDimension": {
            "range": {
                "sheetId": challans_sid,
                "dimension": "ROWS",
                "startIndex": challan_row_idx - 1,
                "endIndex": challan_row_idx,
            }
        }
    })

    service.spreadsheets().batchUpdate(
        spreadsheetId=settings.google_sheet_id,
        body={"requests": requests},
    ).execute()
    return True
