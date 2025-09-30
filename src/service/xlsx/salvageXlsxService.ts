import * as XLSX from "xlsx";

function safe(val?: any): string {
  if (val === undefined || val === null) return "";
  return String(val);
}

export async function generateSalvageXlsx(reportData: any): Promise<Buffer> {
  const lang: 'en' | 'fr' | 'es' = ((): any => {
    const l = String((reportData as any)?.language || '').toLowerCase();
    return (l === 'fr' || l === 'es') ? l : 'en';
  })();
  const t = {
    en: {
      sheetDetails: 'Details',
      sheetComparables: 'Comparables',
      field: 'Field',
      value: 'Value',
      reportDate: 'Report Date',
      fileNumber: 'File Number',
      claimNumber: 'Claim Number',
      policyNumber: 'Policy Number',
      appraiser: 'Appraiser',
      company: 'Company',
      currency: 'Currency',
      adjuster: 'Adjuster',
      insured: 'Insured',
      companyAddress: 'Company Address',
      itemType: 'Item Type',
      year: 'Year',
      make: 'Make',
      model: 'Model',
      vin: 'VIN',
      condition: 'Condition',
      damageDescription: 'Damage Description',
      inspectionComments: 'Inspection Comments',
      totalValue: 'Fair Market Value',
      confidence: 'Confidence',
      summary: 'Summary',
      title: 'Title',
      price: 'Price',
      location: 'Location',
      link: 'Link',
    },
    fr: {
      sheetDetails: 'Détails',
      sheetComparables: 'Comparables',
      field: 'Champ',
      value: 'Valeur',
      reportDate: 'Date du rapport',
      fileNumber: 'Numéro de dossier',
      claimNumber: 'Numéro de réclamation',
      policyNumber: 'Numéro de police',
      appraiser: 'Évaluateur',
      company: 'Société',
      currency: 'Devise',
      adjuster: 'Expert en sinistres',
      insured: 'Assuré',
      companyAddress: 'Adresse de la société',
      itemType: "Type d'article",
      year: 'Année',
      make: 'Marque',
      model: 'Modèle',
      vin: 'VIN',
      condition: 'État',
      damageDescription: 'Description des dommages',
      inspectionComments: "Commentaires d'inspection",
      totalValue: 'Valeur marchande',
      confidence: 'Confiance',
      summary: 'Résumé',
      title: 'Titre',
      price: 'Prix',
      location: 'Emplacement',
      link: 'Lien',
    },
    es: {
      sheetDetails: 'Detalles',
      sheetComparables: 'Comparables',
      field: 'Campo',
      value: 'Valor',
      reportDate: 'Fecha del informe',
      fileNumber: 'Número de expediente',
      claimNumber: 'Número de reclamación',
      policyNumber: 'Número de póliza',
      appraiser: 'Tasador',
      company: 'Empresa',
      currency: 'Moneda',
      adjuster: 'Perito',
      insured: 'Asegurado',
      companyAddress: 'Dirección de la empresa',
      itemType: 'Tipo de artículo',
      year: 'Año',
      make: 'Marca',
      model: 'Modelo',
      vin: 'VIN',
      condition: 'Condición',
      damageDescription: 'Descripción del daño',
      inspectionComments: 'Comentarios de inspección',
      totalValue: 'Valor de mercado',
      confidence: 'Confianza',
      summary: 'Resumen',
      title: 'Título',
      price: 'Precio',
      location: 'Ubicación',
      link: 'Enlace',
    },
  } as const;
  const tt = (t as any)[lang] as typeof t.en;

  const wb = XLSX.utils.book_new();

  // Details sheet
  const rows: any[][] = [];
  const push = (k: string, v?: any) => rows.push([k, safe(v)]);
  push(tt.reportDate, reportData?.report_date);
  push(tt.fileNumber, reportData?.file_number);
  push(tt.claimNumber, reportData?.claim_number);
  push(tt.policyNumber, reportData?.policy_number);
  push(tt.appraiser, reportData?.appraiser_name);
  push(tt.company, reportData?.company_name);
  push(tt.currency, reportData?.currency || 'CAD');
  push(tt.adjuster, reportData?.adjuster_name);
  push(tt.insured, reportData?.insured_name);
  push(tt.companyAddress, reportData?.company_address);
  push(tt.itemType, reportData?.item_type || reportData?.aiExtractedDetails?.item_type);
  push(tt.year, reportData?.year || reportData?.aiExtractedDetails?.year);
  push(tt.make, reportData?.make || reportData?.aiExtractedDetails?.make);
  push(tt.model, reportData?.item_model || reportData?.aiExtractedDetails?.item_model);
  push(tt.vin, reportData?.vin || reportData?.aiExtractedDetails?.vin);
  push(tt.condition, reportData?.item_condition || reportData?.aiExtractedDetails?.item_condition);
  push(tt.damageDescription, reportData?.damage_description || reportData?.aiExtractedDetails?.damage_description);
  push(tt.inspectionComments, reportData?.inspection_comments || reportData?.aiExtractedDetails?.inspection_comments);
  push(tt.totalValue, reportData?.valuation?.fairMarketValue);
  push(tt.confidence, reportData?.valuation?.confidence_level);
  push(tt.summary, reportData?.valuation?.summary);

  const wsDetails = XLSX.utils.aoa_to_sheet([[tt.field, tt.value], ...rows]);
  (wsDetails as any)["!cols"] = [{ wch: 28 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsDetails, tt.sheetDetails);

  // Comparables sheet
  const comps = Array.isArray(reportData?.comparableItems) ? reportData.comparableItems : [];
  const compsData = [
    [tt.title, tt.price, tt.location, tt.link],
    ...comps.map((c: any) => [safe(c?.title), safe(c?.price), safe(c?.location), safe(c?.link)]),
  ];
  const wsComps = XLSX.utils.aoa_to_sheet(compsData);
  (wsComps as any)["!cols"] = [{ wch: 48 }, { wch: 16 }, { wch: 20 }, { wch: 64 }];
  XLSX.utils.book_append_sheet(wb, wsComps, tt.sheetComparables);

  const out: any = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}
