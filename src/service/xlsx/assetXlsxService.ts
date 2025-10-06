import * as XLSX from "xlsx";
import { extractVinFromText } from "../vehicleApiService.js";

// Build a flat results table based on grouping mode and lot/item structures
export async function generateAssetXlsxFromReport(reportData: any): Promise<Buffer> {
  const grouping: string = String(reportData?.grouping_mode || "single_lot");
  const lots: any[] = Array.isArray(reportData?.lots) ? reportData.lots : [];
  const defaultContractNo: string = String(
    reportData?.contract_no || reportData?.contract_number || ""
  );

  // Define headers
  const headers: string[] = [
    "Lot #",
    "Title",
    "Description",
    "Details",
    "FMV",
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
  let rows: any[][] = [];

  // Helper to derive serial/VIN when absent
  const deriveSerial = (rec: any): string => {
    const sv = (rec?.serial_number || rec?.sn_vin || rec?.serial_no_or_label || "").trim();
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

  // Allowed Categories (mirrors prompt's allowedCategories)
  const CATEGORIES_LIST = [
    "Buyer Return",
    "Cleaning And Repair",
    "Commissions",
    "Storage",
    "Conveyors",
    "Crushers",
    "Feeders",
    "Material Washing Equipment",
    "Power Stations",
    "Screening Equipment",
    "Applicators",
    "Grain Handling",
    "Harvest",
    "Hay & Forage",
    "Landscape Equipment",
    "Livestock Handling",
    "Seeding And Tilling",
    "Tractor Attachments",
    "Tractors",
    "Trailers",
    "Air Support",
    "Airplane",
    "Crawler Tractor Attachments",
    "Demolition Attachments",
    "Excavator Attachments",
    "Loader Backhoe Attachments",
    "Motor Grader Attachments",
    "Skid Steer Attachments",
    "Truck Attachments",
    "Wheel Loader Attachments",
    "Cars / SUVs / Vans",
    "Computers / Electronics / Photocopiers / Office Equipment",
    "Articulated Dump Trucks",
    "Compactors",
    "Cranes",
    "Dozers",
    "Drill",
    "Excavators",
    "Generators",
    "Haul Trucks",
    "Loader Backhoes",
    "Loaders",
    "Motor Graders",
    "RTMove Homes / Mobile Homes / Sheds / Skid Shacks",
    "Scrapers",
    "Skid Steers",
    "Water Wagons",
    "Firearms And Accessories",
    "Chipping / Shredding",
    "Self Propelled Clearing",
    "Skidder",
    "General Merchandise",
    "Heavy Trucks",
    "Jewellery",
    "Boom And Scissor Lifts",
    "Forklift",
    "Telehandler",
    "Light Duty Freight Trailers",
    "Light Duty Trucks (1 Ton And Under)",
    "Asphalt Trucks",
    "Concrete Mixer Truck",
    "Concrete Mixing",
    "Concrete Paving",
    "Concrete Plant / Components",
    "Concrete Pump",
    "Concrete Pump Trucks",
    "Oil & Gas",
    "Paving Equipment",
    "Rail Road Equipment",
    "Commercial",
    "Farm Land",
    "Residential",
    "ATVs / UTVs",
    "Camper Trailer",
    "Golf Cart",
    "Motorcycles",
    "Motorhome",
    "Snowmobiles",
    "Watercraft",
    "Restaurant Equipment",
    "Salvage And Seized Vehicles",
    "Semi Tractors",
    "Semi Trailers",
    "Storage Wars",
    "Yard Care And Lawn Equipment / Lumber",
  ];
  const DEFAULT_CATEGORY = "General Merchandise";

  // Normalization helpers
  const normalizeCategory = (v: any): string => {
    try {
      if (v === undefined || v === null) return DEFAULT_CATEGORY;
      const s = String(v).trim();
      if (!s) return DEFAULT_CATEGORY;
      const sl = s.toLowerCase();
      // exact case-insensitive match
      const exact = CATEGORIES_LIST.find((c) => c.toLowerCase() === sl);
      if (exact) return exact;
      // partial includes (both directions)
      const partial = CATEGORIES_LIST.find((c) => c.toLowerCase().includes(sl) || sl.includes(c.toLowerCase()));
      if (partial) return partial;
      // naive plural/singular flip
      const alt = sl.endsWith("s") ? sl.slice(0, -1) : sl + "s";
      const fuzzy = CATEGORIES_LIST.find((c) => c.toLowerCase() === alt || c.toLowerCase().includes(alt) || alt.includes(c.toLowerCase()));
      return fuzzy || DEFAULT_CATEGORY;
    } catch {
      return DEFAULT_CATEGORY;
    }
  };

  const normalizeCondition = (v: any): string => {
    try {
      const fallback = CONDITION_LIST[0];
      if (v === undefined || v === null) return fallback;
      const s = String(v).trim();
      if (!s) return fallback;
      const sl = s.toLowerCase();
      // exact match ignoring case
      const exact = CONDITION_LIST.find((c) => c.toLowerCase() === sl);
      if (exact) return exact;
      if (sl.includes("unused") || sl.includes("new")) return "Unused";
      if (sl.includes("untested")) return "Untested";
      return fallback;
    } catch {
      return CONDITION_LIST[0];
    }
  };

  const toBoolCell = (v: any) => (v === undefined || v === null ? "" : !!v);
  const toNumCell = (v: any) => {
    if (v === undefined || v === null) return "";
    const n = Number(v);
    return Number.isFinite(n) ? n : "";
  };
  const toStrCell = (v: any) => (v === undefined || v === null ? "" : String(v));
  const mapExcelRow = (rec: any): any[] => [
    toStrCell(rec?.lot_number),
    toStrCell(rec?.title),
    toStrCell(rec?.description),
    toStrCell(rec?.details),
    toStrCell(rec?.estimated_value),
    toNumCell(rec?.quantity ?? 1),
    toBoolCell(rec?.must_take),
    toStrCell(defaultContractNo),
    toStrCell(normalizeCategory(rec?.categories)),
    toStrCell(rec?.serial_number ?? deriveSerial(rec)),
    toBoolCell(rec?.show_on_website),
    toStrCell(rec?.close_date),
    toNumCell(rec?.bid_increment),
    toStrCell(rec?.location ?? DEFAULT_LOCATION),
    toNumCell(rec?.opening_bid),
    toNumCell(rec?.latitude),
    toNumCell(rec?.longitude),
    toStrCell(normalizeCondition(rec?.item_condition)),
  ];

  // Map lots directly to Excel rows
  for (const lot of lots) {
    const items: any[] = Array.isArray(lot?.items) ? lot.items : [];
    if (items.length > 0) {
      for (const it of items) rows.push(mapExcelRow({ ...lot, ...it }));
    } else {
      rows.push(mapExcelRow(lot));
    }
  }

  // Ensure every row has a Lot #; fill sequentially in current order
  try {
    let seq = 1;
    for (const r of rows) {
      const current = r?.[0];
      if (current === undefined || current === null || String(current).trim() === "") {
        r[0] = String(seq);
      }
      seq += 1;
    }
  } catch {}

  const data = [headers, ...rows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Some light column sizing heuristics
  const colWidths = headers.map((h) => ({ wch: Math.max(12, Math.min(48, String(h).length + 6)) }));
  (ws as any)["!cols"] = colWidths;

  // Build Lists sheet for data validation sources
  const listsWs = XLSX.utils.aoa_to_sheet([]);
  // Column A: Item Condition
  for (let i = 0; i < CONDITION_LIST.length; i++) {
    const addr = XLSX.utils.encode_cell({ r: i, c: 0 });
    (listsWs as any)[addr] = { t: "s", v: CONDITION_LIST[i] };
  }
  // Column B: Location
  for (let i = 0; i < LOCATION_LIST.length; i++) {
    const addr = XLSX.utils.encode_cell({ r: i, c: 1 });
    (listsWs as any)[addr] = { t: "s", v: LOCATION_LIST[i] };
  }
  // Column C: Categories
  for (let i = 0; i < CATEGORIES_LIST.length; i++) {
    const addr = XLSX.utils.encode_cell({ r: i, c: 2 });
    (listsWs as any)[addr] = { t: "s", v: CATEGORIES_LIST[i] };
  }
  const maxListLen = Math.max(CONDITION_LIST.length, LOCATION_LIST.length, CATEGORIES_LIST.length);
  (listsWs as any)["!ref"] = `A1:C${maxListLen}`;

  // Define named ranges for lists
  (wb as any).Workbook = (wb as any).Workbook || {};
  (wb as any).Workbook.Names = [
    ...(((wb as any).Workbook.Names as any[]) || []),
    { Name: "ItemConditionList", Ref: `Lists!$A$1:$A$${CONDITION_LIST.length}` },
    { Name: "LocationList", Ref: `Lists!$B$1:$B$${LOCATION_LIST.length}` },
    { Name: "CategoriesList", Ref: `Lists!$C$1:$C$${CATEGORIES_LIST.length}` },
  ];

  // Append sheets
  XLSX.utils.book_append_sheet(wb, ws, "Results");
  XLSX.utils.book_append_sheet(wb, listsWs, "Lists");

  // Data validation: Item Condition (col Q), Location (col M), Categories (col H)
  try {
    const dvAny: any = (ws as any);
    const validations: any[] = dvAny["!dataValidation"] || [];
    // After adding Details column, these columns shift by +1
    validations.push({ type: "list", allowBlank: true, sqref: "R2:R1048576", formulae: ["ItemConditionList"] });
    validations.push({ type: "list", allowBlank: true, sqref: "N2:N1048576", formulae: ["LocationList"] });
    validations.push({ type: "list", allowBlank: true, sqref: "I2:I1048576", formulae: ["CategoriesList"] });
    dvAny["!dataValidation"] = validations;
  } catch {}
  const out: any = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}
