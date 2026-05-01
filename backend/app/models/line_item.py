from pydantic import BaseModel

class LineItem(BaseModel):
    id: str = ""
    challan_id: str = ""
    sr: int = 0
    item_code: str = ""
    tag: str = ""
    color: str = ""
    hsn: str = ""
    qty_2xl: int = 0
    qty_3xl: int = 0
    qty_4xl: int = 0
    qty_5xl: int = 0
    qty_6xl: int = 0
    qty_l: int = 0
    qty_m: int = 0
    qty_s: int = 0
    qty_xl: int = 0
    total_qty: int = 0
    price: float = 0.0
    amount: float = 0.0
    delivered: bool = False
