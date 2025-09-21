import * as XLSX from "xlsx";

function safe(val?: any): string {
  if (val === undefined || val === null) return "";
  return String(val);
}

function getCompVal(obj: any, key: string, alt?: string): string {
  if (!obj) return "";
  if (obj[key] !== undefined && obj[key] !== null) return String(obj[key]);
  if (alt && obj[alt] !== undefined && obj[alt] !== null) return String(obj[alt]);
  const lowerKey = key.toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lowerKey) return String(obj[k]);
  }
  return "";
}

/**
 * Generates an Excel sheet focusing on the Comparable Properties table.
 * Layout matches the HTML template style where features are rows and columns are Subject + Comparables.
 */
export async function generateRealEstateXlsx(reportData: any): Promise<Buffer> {
  const lang: 'en' | 'fr' | 'es' = ((): any => {
    const l = String((reportData as any)?.language || '').toLowerCase();
    return (l === 'fr' || l === 'es') ? l : 'en';
  })();
  const t = {
    en: {
      feature: 'Feature',
      subject: 'Subject Property',
      address: 'Address',
      listPrice: 'List Price',
      squareFootage: 'Square Footage',
      lotSize: 'Lot Size',
      rooms: 'Rooms/Bedrooms',
      bathrooms: 'Bathrooms',
      adjustedValue: 'Adjusted Value',
      na: 'N/A',
      half: 'Half',
      full: 'Full',
    },
    fr: {
      feature: 'Caractéristique',
      subject: 'Bien sujet',
      address: 'Adresse',
      listPrice: 'Prix affiché',
      squareFootage: 'Superficie (pi²)',
      lotSize: 'Superficie du lot',
      rooms: 'Pièces/Chambres',
      bathrooms: 'Salles de bain',
      adjustedValue: 'Valeur ajustée',
      na: 'S/O',
      half: 'Demi',
      full: 'Complète',
    },
    es: {
      feature: 'Característica',
      subject: 'Propiedad sujeta',
      address: 'Dirección',
      listPrice: 'Precio de lista',
      squareFootage: 'Superficie (ft²)',
      lotSize: 'Tamaño del lote',
      rooms: 'Habitaciones/Dormitorios',
      bathrooms: 'Baños',
      adjustedValue: 'Valor ajustado',
      na: 'N/D',
      half: 'Medio',
      full: 'Completo',
    },
  } as const;
  const tt = (t as any)[lang] as typeof t.en;
  const subject = {
    address: safe(reportData?.property_details?.address),
    listPrice: tt.na,
    squareFootage: safe(reportData?.house_details?.square_footage),
    lotSize: safe(reportData?.house_details?.lot_size_sqft),
    bedrooms: safe(reportData?.house_details?.number_of_rooms),
    bathrooms: `${safe(reportData?.house_details?.number_of_full_bathrooms) || "0"} ${tt.full}, ${safe(reportData?.house_details?.number_of_half_bathrooms) || "0"} ${tt.half}`,
    adjustedValue: tt.na,
  };

  // Normalize comparableProperties into entries [name, obj]
  const compsEntries: Array<[string, any]> = (() => {
    const cp = reportData?.comparableProperties;
    if (!cp) return [];
    if (Array.isArray(cp)) {
      return cp.map((c: any, idx: number) => [c?.name || `Comp ${idx + 1}`, c]);
    }
    if (cp instanceof Map) return Array.from(cp.entries());
    if (typeof cp === "object") return Object.entries(cp);
    return [];
  })();

  const headers = [
    tt.feature,
    tt.subject,
    ...compsEntries.map(([name]) => String(name)),
  ];

  const rows: any[][] = [];
  const pushRow = (feature: string, subjectVal: string, key: string, alt?: string) => {
    rows.push([
      feature,
      subjectVal,
      ...compsEntries.map(([, c]) => getCompVal(c, key, alt) || "—"),
    ]);
  };

  pushRow(tt.address, subject.address, "address", "Address / Location");
  pushRow(tt.listPrice, subject.listPrice, "listPrice", "List Price");
  pushRow(tt.squareFootage, subject.squareFootage, "squareFootage", "Square Footage");
  pushRow(tt.lotSize, subject.lotSize, "lotSize", "Lot Size");
  pushRow(tt.rooms, subject.bedrooms, "bedrooms", "Bedrooms");
  pushRow(tt.bathrooms, subject.bathrooms, "bathrooms", "Bathrooms");
  pushRow(tt.adjustedValue, subject.adjustedValue, "adjustedValue", "Adjusted Value");

  const data = [headers, ...rows];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  (ws as any)["!cols"] = headers.map((h) => ({ wch: Math.max(16, Math.min(48, String(h).length + 6)) }));
  XLSX.utils.book_append_sheet(wb, ws, "Comparables");
  const out: any = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}
