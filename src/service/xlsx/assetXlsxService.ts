import * as XLSX from "xlsx";

// Build a flat results table based on grouping mode and lot/item structures
export async function generateAssetXlsxFromReport(reportData: any): Promise<Buffer> {
  const grouping: string = String(reportData?.grouping_mode || "single_lot");
  const lots: any[] = Array.isArray(reportData?.lots) ? reportData.lots : [];

  // Define headers per mode
  let headers: string[];
  const rows: any[][] = [];

  if (grouping === "catalogue") {
    headers = [
      "Lot ID",
      "Lot Title",
      "Item Title",
      "SN/VIN",
      "Description",
      "Condition/Details",
      "Est. Value (CAD)",
    ];
    for (const lot of lots) {
      const lotId = lot?.lot_id ?? "";
      const lotTitle = lot?.title ?? "";
      const items: any[] = Array.isArray(lot?.items) ? lot.items : [];
      if (items.length === 0) {
        // No items: emit a single row from lot-level info if present
        rows.push([
          lotId,
          lotTitle,
          "",
          lot?.sn_vin ?? lot?.serial_no_or_label ?? "",
          lot?.description ?? "",
          lot?.condition ?? lot?.details ?? "",
          lot?.estimated_value ?? "",
        ]);
        continue;
      }
      for (const it of items) {
        rows.push([
          lotId,
          lotTitle,
          it?.title ?? "",
          it?.sn_vin ?? "not found",
          it?.description ?? "",
          it?.condition ?? it?.details ?? "",
          it?.estimated_value ?? "",
        ]);
      }
    }
  } else if (grouping === "per_item") {
    headers = [
      "Lot ID",
      "Title",
      "Serial No/Label",
      "Description",
      "Details",
      "Est. Value (CAD)",
    ];
    for (const lot of lots) {
      rows.push([
        lot?.lot_id ?? "",
        lot?.title ?? "",
        lot?.serial_no_or_label ?? "",
        lot?.description ?? "",
        lot?.details ?? "",
        lot?.estimated_value ?? "",
      ]);
    }
  } else {
    // single_lot or per_photo (flatten lots similarly)
    headers = [
      "Lot ID",
      "Title",
      "Serial No/Label",
      "Description",
      "Details",
      "Condition",
      "Est. Value (CAD)",
    ];
    for (const lot of lots) {
      rows.push([
        lot?.lot_id ?? "",
        lot?.title ?? "",
        lot?.serial_no_or_label ?? "",
        lot?.description ?? "",
        lot?.details ?? "",
        lot?.condition ?? "",
        lot?.estimated_value ?? "",
      ]);
    }
  }

  const data = [headers, ...rows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Some light column sizing heuristics
  const colWidths = headers.map((h) => ({ wch: Math.max(12, Math.min(48, String(h).length + 6)) }));
  (ws as any)["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Results");
  const out: any = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}
