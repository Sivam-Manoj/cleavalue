import axios from "axios";

export interface DecodedVin {
  vin: string;
  Make?: string;
  Model?: string;
  ModelYear?: string;
  Trim?: string;
  Series?: string;
  BodyClass?: string;
  DriveType?: string;
  EngineCylinders?: string;
  DisplacementL?: string;
  FuelTypePrimary?: string;
  TransmissionStyle?: string;
  TransmissionSpeeds?: string;
  VehicleType?: string;
}

const VPIC_BASE = process.env.VPIC_BASE_URL || "https://vpic.nhtsa.dot.gov/api";

// Extract a likely VIN (17 characters, excluding I, O, Q) from free text
export function extractVinFromText(text?: string | null): string | null {
  if (!text) return null;
  const upper = String(text).toUpperCase();
  // Prefer full VIN first (17 chars, no I/O/Q)
  const fullMatches = upper.match(/[A-HJ-NPR-Z0-9]{17}/g) || [];
  if (fullMatches.length > 0) return fullMatches[0] || null;
  // Allow partial VINs: 8-16 chars, may include '*' placeholders
  const partialMatches = upper.match(/[A-HJ-NPR-Z0-9*]{8,16}/g) || [];
  const isPlausible = (s: string) => {
    const letters = (s.match(/[A-HJ-NPR-Z]/g) || []).length;
    const digits = (s.match(/[0-9]/g) || []).length;
    return letters >= 2 && digits >= 2; // basic plausibility to reduce noise
  };
  const filtered = partialMatches.filter(isPlausible);
  if (filtered.length === 0) return null;
  // Choose the longest plausible partial
  filtered.sort((a, b) => b.length - a.length);
  return filtered[0] || null;
}

export async function decodeVin(
  vin: string,
  yearGuess?: number
): Promise<DecodedVin | null> {
  try {
    const u = new URL(
      `${VPIC_BASE}/vehicles/DecodeVinValuesExtended/${encodeURIComponent(vin)}`
    );
    u.searchParams.set("format", "json");
    if (yearGuess && Number.isFinite(yearGuess)) {
      u.searchParams.set("modelyear", String(yearGuess));
    }
    const resp = await axios.get(u.toString(), { timeout: 8000 });
    const data: any = resp?.data as any;
    const results = Array.isArray(data?.Results) ? data.Results : [];
    if (!Array.isArray(results) || results.length === 0) return null;
    const row: any = results[0] || {};
    const out: DecodedVin = {
      vin,
      Make: row.Make || row["Make"] || undefined,
      Model: row.Model || row["Model"] || undefined,
      ModelYear: row.ModelYear || row["Model Year"] || undefined,
      Trim: row.Trim || row["Trim"] || row["Series2"] || undefined,
      Series: row.Series || row["Series"] || undefined,
      BodyClass: row.BodyClass || row["Body Class"] || undefined,
      DriveType: row.DriveType || row["Drive Type"] || undefined,
      EngineCylinders:
        row.EngineCylinders || row["Engine Number of Cylinders"] || undefined,
      DisplacementL: row.DisplacementL || row["Displacement (L)"] || undefined,
      FuelTypePrimary: row.FuelTypePrimary || row["Fuel Type - Primary"] || undefined,
      TransmissionStyle: row.TransmissionStyle || row["Transmission Style"] || undefined,
      TransmissionSpeeds:
        row.TransmissionSpeeds || row["Transmission Speeds"] || undefined,
      VehicleType: row.VehicleType || row["Vehicle Type"] || undefined,
    };
    return out;
  } catch (e) {
    console.error("vPIC VIN decode failed for", vin, e);
    return null;
  }
}

function normalizeInt(s?: string): number | undefined {
  const n = parseInt((s || "").trim(), 10);
  return Number.isFinite(n) ? n : undefined;
}

function buildTitleFromDecoded(
  dv: DecodedVin,
  originalTitle?: string
): string | undefined {
  const year = normalizeInt(dv.ModelYear);
  const parts: string[] = [];
  if (year) parts.push(String(year));
  if (dv.Make) parts.push(String(dv.Make));
  if (dv.Model) parts.push(String(dv.Model));
  const trim = dv.Trim && String(dv.Trim).trim();
  if (trim) parts.push(trim);
  if (parts.length === 0) return undefined;
  const newTitle = parts.join(" ");
  if (!originalTitle) return newTitle;
  const upperOrig = originalTitle.toUpperCase();
  if (year && upperOrig.startsWith(String(year))) {
    return originalTitle;
  }
  if (!year && dv.Make && dv.Model && upperOrig.includes((dv.Make + " " + dv.Model).toUpperCase()))
    return originalTitle;
  return newTitle;
}

function joinUnique(existing: string | undefined, additions: string[]): string {
  const base = (existing || "").trim();
  const add = additions
    .filter(Boolean)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const seen = new Set<string>();
  const out: string[] = [];
  const pushPart = (p: string) => {
    const key = p.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  };
  if (base)
    base
      .split(/[;\,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach(pushPart);
  add.forEach(pushPart);
  return out.join("; ");
}

export async function enrichLotsWithVin(
  lots: any[],
  groupingMode?: string
): Promise<any[]> {
  const cache = new Map<string, DecodedVin | null>();

  const yearRange = (t?: string) => {
    if (!t) return undefined;
    const m = t.match(/\b(19[8-9]\d|20[0-4]\d)\b/);
    return m ? parseInt(m[1], 10) : undefined;
  };

  const decodeCached = async (
    vin: string,
    yearHint?: number
  ): Promise<DecodedVin | null> => {
    const key = vin + ":" + (yearHint || "");
    if (cache.has(key)) return cache.get(key)!;
    const data = await decodeVin(vin, yearHint);
    cache.set(key, data);
    return data;
  };

  const processRecord = async (rec: any) => {
    const texts = [
      rec?.serial_no_or_label,
      rec?.sn_vin,
      rec?.details,
      rec?.description,
      rec?.title,
    ];
    let vin: string | null = null;
    for (const t of texts) {
      vin = extractVinFromText(typeof t === "string" ? t : undefined);
      if (vin) break;
    }
    if (!vin) return rec;

    const yearHint = yearRange(rec?.title) || yearRange(rec?.description);
    const dv = await decodeCached(vin, yearHint);
    if (!dv) return rec;

    const newTitle = buildTitleFromDecoded(
      dv,
      typeof rec?.title === "string" ? rec.title : undefined
    );
    if (newTitle) rec.title = newTitle;

    const additions: string[] = [];
    if (!/vin:/i.test(rec?.details || "")) additions.push(`VIN: ${vin}`);
    const yInt = normalizeInt(dv.ModelYear);
    if (yInt && !/\byear:/i.test(rec?.details || "")) additions.push(`Year: ${yInt}`);
    if (dv.Make && !/make:/i.test(rec?.details || "")) additions.push(`Make: ${dv.Make}`);
    if (dv.Model && !/model:/i.test(rec?.details || "")) additions.push(`Model: ${dv.Model}`);
    if (dv.Trim) additions.push(`Trim: ${dv.Trim}`);
    if (dv.Series) additions.push(`Series: ${dv.Series}`);
    if (dv.BodyClass) additions.push(`Body Class: ${dv.BodyClass}`);
    if (dv.EngineCylinders) additions.push(`Engine Cylinders: ${dv.EngineCylinders}`);
    if (dv.DisplacementL) additions.push(`Engine Displacement: ${dv.DisplacementL}L`);
    if (dv.FuelTypePrimary) additions.push(`Fuel: ${dv.FuelTypePrimary}`);
    if (dv.TransmissionStyle || dv.TransmissionSpeeds) {
      const tLabel = [
        dv.TransmissionStyle,
        dv.TransmissionSpeeds ? `${dv.TransmissionSpeeds}-speed` : undefined,
      ]
        .filter(Boolean)
        .join(" ");
      if (tLabel) additions.push(`Transmission: ${tLabel}`);
    }
    if (dv.DriveType) additions.push(`Drive: ${dv.DriveType}`);
    if (dv.VehicleType) additions.push(`Vehicle Type: ${dv.VehicleType}`);

    rec.details = joinUnique(rec?.details, additions);

    // Attach structured decoded fields for downstream XLSX/DOCX builders
    const transLabel = [
      dv.TransmissionStyle,
      dv.TransmissionSpeeds ? `${dv.TransmissionSpeeds}-speed` : undefined,
    ]
      .filter(Boolean)
      .join(" ");
    const yInt2 = normalizeInt(dv.ModelYear);
    (rec as any).vinDecoded = {
      vin,
      year: yInt2,
      make: dv.Make,
      model: dv.Model,
      trim: dv.Trim,
      series: dv.Series,
      bodyClass: dv.BodyClass,
      driveType: dv.DriveType,
      engineCylinders: dv.EngineCylinders,
      displacementL: dv.DisplacementL,
      fuelType: dv.FuelTypePrimary,
      transmission: transLabel || undefined,
      transmissionStyle: dv.TransmissionStyle,
      transmissionSpeeds: dv.TransmissionSpeeds,
      vehicleType: dv.VehicleType,
    };

    // Normalize serial/VIN style fields
    if (typeof rec?.sn_vin === "string") {
      if (/not\s*found/i.test(rec.sn_vin)) rec.sn_vin = vin;
    } else if (rec?.sn_vin == null) {
      rec.sn_vin = vin;
    }
    if (typeof rec?.serial_no_or_label === "string") {
      if (!/vin\s*:/i.test(rec.serial_no_or_label))
        rec.serial_no_or_label = `${rec.serial_no_or_label}; VIN: ${vin}`;
    }

    return rec;
  };

  if (Array.isArray(lots)) {
    for (const lot of lots) {
      if (Array.isArray(lot?.items)) {
        for (let i = 0; i < lot.items.length; i++) {
          lot.items[i] = await processRecord(lot.items[i]);
        }
      } else {
        await processRecord(lot);
      }
    }
  }

  return lots;
}
