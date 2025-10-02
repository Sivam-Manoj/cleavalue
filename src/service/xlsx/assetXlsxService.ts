import * as XLSX from "xlsx";
import { extractVinFromText } from "../vehicleApiService.js";

// Build a flat results table based on grouping mode and lot/item structures
export async function generateAssetXlsxFromReport(reportData: any): Promise<Buffer> {
  const grouping: string = String(reportData?.grouping_mode || "single_lot");
  const lots: any[] = Array.isArray(reportData?.lots) ? reportData.lots : [];
  const defaultContractNo: string = String(
    reportData?.contract_no || reportData?.contract_number || ""
  );

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

  // Fixed dropdown lists
  const CONDITION_LIST = [
    "Unverified Working Condition",
    "Untested",
    "Unused",
  ];
  const LOCATION_LIST = [
    "800 North Service Road, Emerald Park, SK",
    "203 60th Street East, Saskatoon, SK",
    "5221 Portage Ave, Headingley, MB",
    "8761 Wilkes Ave, Saint Eustache, MB",
    "601 17th Street East, Brandon, MB",
    "1209 - 8A Street, Nisku, AB",
    "6270 Dorman Rd, Mississauga, ON",
    "175 Chem. Du Grand-Pre, Saint-Jean-Sur-Richelieu, QC",
    "4728 I-35W, Alvarado, TX 76009",
  ];
  const DEFAULT_LOCATION = LOCATION_LIST[0];

  // New extras columns requested for XLSX (applies to all modes)
  const extrasHeaders = [
    "Lot #",
    "Quantity",
    "Must Take",
    "Contract #",
    "Categories",
    "Serial Number (VIN/SN)",
    "Show On Website",
    "Close Date",
    "Bid Increment",
    "Location",
    "Opening Bid",
    "Latitude",
    "Longitude",
    "Item Condition",
  ];

  const toBoolCell = (v: any) => (v === undefined || v === null ? "" : !!v);
  const toNumCell = (v: any) => {
    if (v === undefined || v === null) return "";
    const n = Number(v);
    return Number.isFinite(n) ? n : "";
  };
  const toStrCell = (v: any) => (v === undefined || v === null ? "" : String(v));

  const computeSerial = (rec: any): string => {
    const sv = (rec?.sn_vin || rec?.serial_no_or_label || "").trim();
    if (sv && sv.toLowerCase() !== "not found") return sv;
    const found =
      extractVinFromText(rec?.sn_vin) ||
      extractVinFromText(
        [rec?.serial_no_or_label, rec?.details, rec?.description, rec?.title]
          .filter(Boolean)
          .join(" ")
      );
    return found || "";
  };

  const extrasValues = (rec: any): any[] => [
    toStrCell(rec?.lot_number),
    toNumCell(rec?.quantity),
    toBoolCell(rec?.must_take),
    toStrCell(rec?.contract_number || defaultContractNo),
    toStrCell(rec?.categories),
    toStrCell(computeSerial(rec)),
    toBoolCell(rec?.show_on_website),
    toStrCell(rec?.close_date),
    toNumCell(rec?.bid_increment),
    toStrCell(rec?.location ?? DEFAULT_LOCATION),
    toNumCell(rec?.opening_bid),
    toNumCell(rec?.latitude),
    toNumCell(rec?.longitude),
    toStrCell(rec?.item_condition ?? CONDITION_LIST[0]),
  ];

  // Unified mixed-style output for ALL inputs
  headers = [
    "Mode",
    "Lot ID",
    "Lot Title",
    "Item Title",
    "Description",
    ...extrasHeaders,
    "Details",
    "Condition",
    "Estimated Value",
    ...vinHeaders,
  ];

  const getModeLabel = (lot: any): string => {
    if (typeof lot?.mode === "string" && lot.mode) return String(lot.mode);
    const tags: string[] = Array.isArray(lot?.tags) ? lot.tags.map(String) : [];
    const modeTag = tags.find((t) => t?.startsWith?.("mode:"));
    if (modeTag) return modeTag.split(":", 2)[1] || "";
    return String(grouping || "");
  };

  for (const lot of lots) {
    const mode = getModeLabel(lot);
    const lotId = lot?.lot_id ?? "";
    const lotTitle = lot?.title ?? "";
    const items: any[] = Array.isArray(lot?.items) ? lot.items : [];

    if (items.length > 0) {
      // Expand catalogue-like items into individual rows
      for (const it of items) {
        rows.push([
          mode || "catalogue",
          lotId,
          lotTitle,
          it?.title ?? "",
          it?.description ?? "",
          ...extrasValues(it),
          it?.details ?? "",
          it?.condition ?? "",
          it?.estimated_value ?? "",
          ...vinCols(it),
        ]);
      }
    } else {
      // Regular lot row (single_lot, per_item, per_photo, or catalogue-without-items)
      rows.push([
        mode || String(grouping || ""),
        lotId,
        lotTitle,
        "",
        lot?.description ?? "",
        ...extrasValues(lot),
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

  // Build Lists sheet for data validation sources
  const listsWs = XLSX.utils.aoa_to_sheet([]);
  // Fill column A with CONDITION_LIST
  for (let i = 0; i < CONDITION_LIST.length; i++) {
    const addr = XLSX.utils.encode_cell({ r: i, c: 0 });
    (listsWs as any)[addr] = { t: "s", v: CONDITION_LIST[i] };
  }
  // Fill column B with LOCATION_LIST
  for (let i = 0; i < LOCATION_LIST.length; i++) {
    const addr = XLSX.utils.encode_cell({ r: i, c: 1 });
    (listsWs as any)[addr] = { t: "s", v: LOCATION_LIST[i] };
  }
  (listsWs as any)["!ref"] = `A1:B${Math.max(CONDITION_LIST.length, LOCATION_LIST.length)}`;

  // Define named ranges for lists
  (wb as any).Workbook = (wb as any).Workbook || {};
  (wb as any).Workbook.Names = [
    ...(((wb as any).Workbook.Names as any[]) || []),
    { Name: "ItemConditionList", Ref: `Lists!$A$1:$A$${CONDITION_LIST.length}` },
    { Name: "LocationList", Ref: `Lists!$B$1:$B$${LOCATION_LIST.length}` },
  ];

  // Append sheets (Lists can be visible; Excel users can change later)
  XLSX.utils.book_append_sheet(wb, ws, "Results");
  XLSX.utils.book_append_sheet(wb, listsWs, "Lists");

  // Attempt to add data validation for Item Condition (col S) and Location (col O)
  try {
    const dvAny: any = (ws as any);
    const validations: any[] = dvAny["!dataValidation"] || [];
    validations.push({ type: "list", allowBlank: true, sqref: "S2:S1048576", formulae: ["ItemConditionList"] });
    validations.push({ type: "list", allowBlank: true, sqref: "O2:O1048576", formulae: ["LocationList"] });
    dvAny["!dataValidation"] = validations;
  } catch {}
  const out: any = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}
