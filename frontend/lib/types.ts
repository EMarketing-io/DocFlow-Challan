export interface ChallanSummary {
  id: string;
  doer_name: string;
  entry_date: string;
  track: string;
  challan_no: string;
  issue_date: string;
  order_no: string;
  order_date: string;
  client_name: string;
  phone: string;
  city: string;
  agency: string;
  gst_no: string;
  pdf_url: string;
  status: "pending" | "done";
  created_at: string;
  total_items?: number;
  delivered_items?: number;
}

export interface LineItem {
  id: string;
  challan_id: string;
  sr: number;
  item_code: string;
  tag: string;
  color: string;
  hsn: string;
  qty_2xl: number;
  qty_3xl: number;
  qty_4xl: number;
  qty_5xl: number;
  qty_6xl: number;
  qty_l: number;
  qty_m: number;
  qty_s: number;
  qty_xl: number;
  total_qty: number;
  price: number;
  amount: number;
  delivered: boolean | string;
  image_url?: string;
}

export interface ChallanDetail extends ChallanSummary {
  line_items: LineItem[];
}
