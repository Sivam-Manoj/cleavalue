import * as XLSX from "xlsx";
import { extractVinFromText } from "../vehicleApiService.js";

// Build a flat results table based on grouping mode and lot/item structures
export async function generateAssetXlsxFromReport(reportData: any): Promise<Buffer> {
  const grouping: string = String(reportData?.grouping_mode || "single_lot");
  const lots: any[] = Array.isArray(reportData?.lots) ? reportData.lots : [];

  // Define headers per mode
  let headers: string[];
  const rows: any[][] = [];

  const vinHeaders = [
    "VIN",
    "Year",
    "Make",
    "Model",
    "Trim",
    "Series",
    "Body Class",
    "Drive Type",
    "Engine Cyl",
    "Displacement (L)",
    "Fuel",
    "Transmission",
  ];
  const vinCols = (rec: any): any[] => {
    const vd = (rec?.vinDecoded as any) || {};
    const vin =
      vd?.vin ||
      extractVinFromText(rec?.sn_vin) ||
      extractVinFromText(
        [rec?.serial_no_or_label, rec?.details, rec?.description, rec?.title]
          .filter(Boolean)
          .join(" ")
      ) || "";
    return [
      vin || "",
      vd?.year ?? "",
      vd?.make ?? "",
      vd?.model ?? "",
      vd?.trim ?? "",
      vd?.series ?? "",
      vd?.bodyClass ?? "",
      vd?.driveType ?? "",
      vd?.engineCylinders ?? "",
      vd?.displacementL ?? "",
      vd?.fuelType ?? "",
      vd?.transmission ?? "",
    ];
  };

  if (grouping === "catalogue") {
    headers = [
      "Lot ID",
      "Lot Title",
      "Item Title",
      "SN/VIN",
      "Description",
      "Condition/Details",
      "Est. Value (CAD)",
      ...vinHeaders,
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
          ...vinCols(lot),
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
          ...vinCols(it),
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
      ...vinHeaders,
    ];
    for (const lot of lots) {
      rows.push([
        lot?.lot_id ?? "",
        lot?.title ?? "",
        lot?.serial_no_or_label ?? "",
        lot?.description ?? "",
        lot?.details ?? "",
        lot?.estimated_value ?? "",
        ...vinCols(lot),
      ]);
    }
  } else if (grouping === "mixed") {
    // Mixed: flatten all lots; include Mode column derived from tags 'mode:<subMode>' when available
    headers = [
      "Lot ID",
      "Title",
      "Serial No/Label",
      "Description",
      "Details",
      "Condition",
      "Est. Value (CAD)",
      "Mode",
      ...vinHeaders,
    ];
    const getModeFromTags = (lot: any): string => {
      const tags: string[] = Array.isArray(lot?.tags) ? lot.tags.map(String) : [];
      const modeTag = tags.find((t) => t?.startsWith?.("mode:"));
      if (!modeTag) return "";
      const m = modeTag.split(":", 2)[1] || "";
      return m.replace(/_/g, " ");
    };
    for (const lot of lots) {
      rows.push([
        lot?.lot_id ?? "",
        lot?.title ?? "",
        lot?.serial_no_or_label ?? "",
        lot?.description ?? "",
        lot?.details ?? "",
        lot?.condition ?? "",
        lot?.estimated_value ?? "",
        getModeFromTags(lot),
        ...vinCols(lot),
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
      ...vinHeaders,
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
        ...vinCols(lot),
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
