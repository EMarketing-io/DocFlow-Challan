from pydantic import BaseModel
from typing import Optional

class ChallanHeader(BaseModel):
    challan_no: str = ""
    issue_date: str = ""
    order_no: str = ""
    order_date: str = ""
    client_name: str = ""
    phone: str = ""
    city: str = ""
    agency: str = ""
    gst_no: str = ""

class ChallanCreate(BaseModel):
    doer_name: str
    entry_date: str
    track: str

class ChallanRow(BaseModel):
    id: str
    doer_name: str
    entry_date: str
    track: str
    challan_no: str
    issue_date: str
    order_no: str
    order_date: str
    client_name: str
    phone: str
    city: str
    agency: str
    gst_no: str
    pdf_url: str
    status: str
    created_at: str

class ChallanSummary(BaseModel):
    id: str
    doer_name: str
    entry_date: str
    track: str
    challan_no: str
    issue_date: str
    order_no: str
    client_name: str
    city: str
    status: str
    pdf_url: str
    gst_no: str
    order_date: str
    agency: str
    phone: str
