import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from "docx";
import fs from "fs/promises";
import path from "path";
import { buildHeaderTable } from "./builders/header.js";
import { buildCover } from "./builders/cover.js";
import { buildTOC } from "./builders/toc.js";
import { buildAppendixPhotoGallery } from "./builders/appendix.js";
import { goldDivider } from "./builders/utils.js";

function safe(val?: any): string {
  if (val === undefined || val === null) return "";
  return String(val);
}

function formatMoneyStrict(input: any, ccy: string): string {
  try {
    let n: number | null = null;
    if (typeof input === "number" && Number.isFinite(input)) n = input;
    else if (typeof input === "string") {
      const cleaned = input.replace(/[^0-9.\-]/g, "");
      if (cleaned) {
        const parsed = Number(cleaned);
        if (Number.isFinite(parsed)) n = parsed;
      }
    }
    if (n === null) return String(input || "—");
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: ccy || "CAD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return String(input || "—");
  }
}

export async function generateSalvageDocx(reportData: any): Promise<Buffer> {
  // Language and i18n
  const lang: "en" | "fr" | "es" = ((): any => {
    const l = String((reportData as any)?.language || "").toLowerCase();
    return l === "fr" || l === "es" ? l : "en";
  })();
  const t = {
    en: {
      title: "Salvage Report",
      reportSummary: "Report Summary",
      preparedFor: "Prepared for",
      appraiser: "Appraiser",
      reportDate: "Report Date",
      fileNumber: "File Number",
      totalValue: "Fair Market Value",
      assetDetails: "Asset Details",
      repairEstimate: "Repair Estimate",
      comparablesHeading: "Comparable Salvage Listings",
      valuationSummary: "Valuation Summary",
      confidence: "Confidence Level",
      recommendedReserve: "Recommended Reserve",
      actualCashValue: "Actual Cash Value",
      replacementCost: "Replacement Cost",
      references: "References",
      summary: "Summary",
      page: "Page ",
      compsColumns: {
        title: "Title",
        price: "Price",
        location: "Location",
        link: "Link",
      },
      fields: {
        itemType: "Item Type",
        year: "Year",
        make: "Make",
        model: "Model",
        vin: "VIN",
        condition: "Condition",
        damageDescription: "Damage Description",
        inspectionComments: "Inspection Comments",
      },
      repair: {
        parts: "Parts",
        lessBetterment: "Less Betterment",
        labour: "Labour",
        shopSupplies: "Shop Supplies",
        miscellaneous: "Miscellaneous",
        taxes: "Taxes",
        total: "Total",
      },
      itemizedPartsHeading: "Itemized Parts",
      labourBreakdownHeading: "Labour Breakdown",
      estimateComposition: "Estimate Composition",
      managerNotesHeading: "Manager Notes",
      procurementNotes: "Procurement Notes",
      safetyConcerns: "Safety Concerns",
      assumptions: "Assumptions",
      priorityLevel: "Priority Level",
      partsColumns: {
        item: "Item",
        sku: "SKU",
        oem: "OEM/Aftermarket",
        qty: "Qty",
        unitPrice: "Unit Price",
        lineTotal: "Line Total",
        vendor: "Vendor",
        link: "Link",
        leadTime: "Lead Time (days)",
        notes: "Notes",
      },
      labourColumns: {
        task: "Task",
        hours: "Hours",
        rate: "Rate/hour",
        lineTotal: "Line Total",
        notes: "Notes",
      },
      compositionRows: {
        partsSubtotal: "Parts Subtotal",
        labourTotal: "Labour Total",
        totalHours: "Total Labour Hours",
        lessBetterment: "Less Betterment",
        shopSupplies: "Shop Supplies",
        miscellaneous: "Miscellaneous",
        taxes: "Taxes",
        grandTotal: "Grand Total",
      },
    },
    fr: {
      title: "Rapport de récupération",
      reportSummary: "Résumé du rapport",
      preparedFor: "Préparé pour",
      appraiser: "Évaluateur",
      reportDate: "Date du rapport",
      fileNumber: "Numéro de dossier",
      totalValue: "Valeur marchande",
      assetDetails: "Détails de l'actif",
      repairEstimate: "Estimation des réparations",
      comparablesHeading: "Annonces de récupération comparables",
      valuationSummary: "Résumé de l’évaluation",
      confidence: "Niveau de confiance",
      recommendedReserve: "Réserve recommandée",
      actualCashValue: "Valeur au comptant réelle",
      replacementCost: "Coût de remplacement",
      references: "Références",
      summary: "Résumé",
      page: "Page ",
      compsColumns: {
        title: "Titre",
        price: "Prix",
        location: "Emplacement",
        link: "Lien",
      },
      fields: {
        itemType: "Type d'article",
        year: "Année",
        make: "Marque",
        model: "Modèle",
        vin: "VIN",
        condition: "État",
        damageDescription: "Description des dommages",
        inspectionComments: "Commentaires d'inspection",
      },
      repair: {
        parts: "Pièces",
        lessBetterment: "Moins plus-value",
        labour: "Main-d'œuvre",
        shopSupplies: "Fournitures d'atelier",
        miscellaneous: "Divers",
        taxes: "Taxes",
        total: "Total",
      },
      itemizedPartsHeading: "Pièces détaillées",
      labourBreakdownHeading: "Répartition de la main-d'œuvre",
      estimateComposition: "Composition de l'estimation",
      managerNotesHeading: "Notes du gestionnaire",
      procurementNotes: "Notes d'approvisionnement",
      safetyConcerns: "Préoccupations de sécurité",
      assumptions: "Hypothèses",
      priorityLevel: "Niveau de priorité",
      partsColumns: {
        item: "Article",
        sku: "SKU",
        oem: "OEM/Après-vente",
        qty: "Qté",
        unitPrice: "Prix unitaire",
        lineTotal: "Total de ligne",
        vendor: "Fournisseur",
        link: "Lien",
        leadTime: "Délai (jours)",
        notes: "Notes",
      },
      labourColumns: {
        task: "Tâche",
        hours: "Heures",
        rate: "Taux/heure",
        lineTotal: "Total de ligne",
        notes: "Notes",
      },
      compositionRows: {
        partsSubtotal: "Sous-total pièces",
        labourTotal: "Total main-d'œuvre",
        totalHours: "Total d'heures",
        lessBetterment: "Moins plus-value",
        shopSupplies: "Fournitures d'atelier",
        miscellaneous: "Divers",
        taxes: "Taxes",
        grandTotal: "Total général",
      },
    },
    es: {
      title: "Informe de salvamento",
      reportSummary: "Resumen del informe",
      preparedFor: "Preparado para",
      appraiser: "Tasador",
      reportDate: "Fecha del informe",
      fileNumber: "Número de expediente",
      totalValue: "Valor de mercado",
      assetDetails: "Detalles del activo",
      repairEstimate: "Estimación de reparación",
      comparablesHeading: "Anuncios de salvamento comparables",
      valuationSummary: "Resumen de la valoración",
      confidence: "Nivel de confianza",
      recommendedReserve: "Reserva recomendada",
      actualCashValue: "Valor en efectivo real",
      replacementCost: "Costo de reemplazo",
      references: "Referencias",
      summary: "Resumen",
      page: "Página ",
      compsColumns: {
        title: "Título",
        price: "Precio",
        location: "Ubicación",
        link: "Enlace",
      },
      fields: {
        itemType: "Tipo de artículo",
        year: "Año",
        make: "Marca",
        model: "Modelo",
        vin: "VIN",
        condition: "Condición",
        damageDescription: "Descripción del daño",
        inspectionComments: "Comentarios de inspección",
      },
      repair: {
        parts: "Piezas",
        lessBetterment: "Menos mejoramiento",
        labour: "Mano de obra",
        shopSupplies: "Suministros de taller",
        miscellaneous: "Misceláneos",
        taxes: "Impuestos",
        total: "Total",
      },
      itemizedPartsHeading: "Piezas detalladas",
      labourBreakdownHeading: "Desglose de mano de obra",
      estimateComposition: "Composición de la estimación",
      managerNotesHeading: "Notas del gerente",
      procurementNotes: "Notas de compras",
      safetyConcerns: "Preocupaciones de seguridad",
      assumptions: "Suposiciones",
      priorityLevel: "Nivel de prioridad",
      partsColumns: {
        item: "Artículo",
        sku: "SKU",
        oem: "OEM/Posventa",
        qty: "Cant.",
        unitPrice: "Precio unitario",
        lineTotal: "Total de línea",
        vendor: "Proveedor",
        link: "Enlace",
        leadTime: "Plazo (días)",
        notes: "Notas",
      },
      labourColumns: {
        task: "Tarea",
        hours: "Horas",
        rate: "Tarifa/hora",
        lineTotal: "Total de línea",
        notes: "Notas",
      },
      compositionRows: {
        partsSubtotal: "Subtotal de piezas",
        labourTotal: "Total de mano de obra",
        totalHours: "Horas totales",
        lessBetterment: "Menos mejoramiento",
        shopSupplies: "Suministros de taller",
        miscellaneous: "Misceláneos",
        taxes: "Impuestos",
        grandTotal: "Total general",
      },
    },
  } as const;
  const tt = (t as any)[lang] as typeof t.en;

  // Theme and sizes: use 0.75" margins and wider content area
  const contentWidthTw = convertInchesToTwip(7);

  // Load logo (optional)
  let logoBuffer: Buffer | null = null;
  try {
    const logoPath = path.resolve(process.cwd(), "public/logo.jpg");
    logoBuffer = await fs.readFile(logoPath);
  } catch {
    logoBuffer = null;
  }

  // Header table and common fields
  const headerTable = buildHeaderTable(
    logoBuffer,
    contentWidthTw,
    (reportData?.appraiser_email as string) ||
      (reportData as any)?.user_email ||
      ""
  );

  const title = tt.title;
  const ccy = String((reportData as any)?.currency || "CAD");
  const fmv = safe(reportData?.valuation?.fairMarketValue);
  const fmvFormatted = fmv ? formatMoneyStrict(fmv, ccy) : "";
  const reportDate = safe(reportData?.report_date);
  const fileNo = safe(reportData?.file_number);
  const appraiser = safe(reportData?.appraiser_name);
  const company = safe(reportData?.company_name);

  const imageUrls: string[] = Array.isArray((reportData as any)?.imageUrls)
    ? (reportData as any).imageUrls
    : [];

  // Comparables table
  const comps = Array.isArray(reportData?.comparableItems)
    ? (reportData?.comparableItems as any[])
    : [];
  const compsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: tt.compsColumns.title, bold: true }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: tt.compsColumns.price, bold: true }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: tt.compsColumns.location, bold: true }),
                ],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: tt.compsColumns.link, bold: true }),
                ],
              }),
            ],
          }),
        ],
      }),
      ...comps.map(
        (c) =>
          new TableRow({
            children: [
              new TableCell({
                children: [new Paragraph(safe(c?.title) || "—")],
              }),
              new TableCell({
                children: [new Paragraph(safe(c?.price) || "—")],
              }),
              new TableCell({
                children: [new Paragraph(safe(c?.location) || "—")],
              }),
              new TableCell({
                children: [new Paragraph(safe(c?.link) || "—")],
              }),
            ],
          })
      ),
    ],
  });

  // Main document content
  const children: Array<Paragraph | Table> = [];

  // Report Summary
  children.push(
    new Paragraph({
      text: tt.reportSummary,
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 100 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.preparedFor)] }),
            new TableCell({ children: [new Paragraph(company || "—")] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.appraiser)] }),
            new TableCell({ children: [new Paragraph(appraiser || "—")] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.reportDate)] }),
            new TableCell({ children: [new Paragraph(reportDate || "—")] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.fileNumber)] }),
            new TableCell({ children: [new Paragraph(fileNo || "—")] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.totalValue)] }),
            new TableCell({ children: [new Paragraph(fmvFormatted || "—")] }),
          ],
        }),
      ],
    })
  );

  // Asset Details
  children.push(
    new Paragraph({
      text: tt.assetDetails,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 140, after: 80 },
    })
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.fields.itemType)] }),
            new TableCell({
              children: [
                new Paragraph(
                  safe(reportData?.item_type) ||
                    safe(reportData?.aiExtractedDetails?.item_type) ||
                    "—"
                ),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.fields.year)] }),
            new TableCell({
              children: [
                new Paragraph(
                  safe(reportData?.year) ||
                    safe(reportData?.aiExtractedDetails?.year) ||
                    "—"
                ),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.fields.make)] }),
            new TableCell({
              children: [
                new Paragraph(
                  safe(reportData?.make) ||
                    safe(reportData?.aiExtractedDetails?.make) ||
                    "—"
                ),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.fields.model)] }),
            new TableCell({
              children: [
                new Paragraph(
                  safe(reportData?.item_model) ||
                    safe(reportData?.aiExtractedDetails?.item_model) ||
                    "—"
                ),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.fields.vin)] }),
            new TableCell({
              children: [
                new Paragraph(
                  safe(reportData?.vin) ||
                    safe(reportData?.aiExtractedDetails?.vin) ||
                    "—"
                ),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.fields.condition)] }),
            new TableCell({
              children: [
                new Paragraph(
                  safe(reportData?.item_condition) ||
                    safe(reportData?.aiExtractedDetails?.item_condition) ||
                    "—"
                ),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph(tt.fields.damageDescription)],
            }),
            new TableCell({
              children: [
                new Paragraph(
                  safe(reportData?.damage_description) ||
                    safe(reportData?.aiExtractedDetails?.damage_description) ||
                    "—"
                ),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph(tt.fields.inspectionComments)],
            }),
            new TableCell({
              children: [
                new Paragraph(
                  safe(reportData?.inspection_comments) ||
                    safe(reportData?.aiExtractedDetails?.inspection_comments) ||
                    "—"
                ),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // Repair Estimate
  const re = (reportData?.aiExtractedDetails?.repair_estimate ||
    reportData?.repair_estimate ||
    {}) as any;
  children.push(
    new Paragraph({
      text: tt.repairEstimate,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 140, after: 80 },
    })
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.repair.parts)] }),
            new TableCell({
              children: [
                new Paragraph(formatMoneyStrict(re?.parts, ccy) || "—"),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph(tt.repair.lessBetterment)],
            }),
            new TableCell({
              children: [
                new Paragraph(
                  re?.less_betterment != null && re?.less_betterment !== ""
                    ? `- ${formatMoneyStrict(re?.less_betterment, ccy)}`
                    : "—"
                ),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.repair.labour)] }),
            new TableCell({
              children: [
                new Paragraph(formatMoneyStrict(re?.labour, ccy) || "—"),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph(tt.repair.shopSupplies)],
            }),
            new TableCell({
              children: [
                new Paragraph(formatMoneyStrict(re?.shop_supplies, ccy) || "—"),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph(tt.repair.miscellaneous)],
            }),
            new TableCell({
              children: [
                new Paragraph(formatMoneyStrict(re?.miscellaneous, ccy) || "—"),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.repair.taxes)] }),
            new TableCell({
              children: [
                new Paragraph(formatMoneyStrict(re?.taxes, ccy) || "—"),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.repair.total)] }),
            new TableCell({
              children: [
                new Paragraph(formatMoneyStrict(re?.total, ccy) || "—"),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // Itemized details (Parts & Labour) and composition
  const toNum = (v: any): number => {
    try {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      if (typeof v === "string") {
        const p = Number(v.replace(/[^0-9.\-]/g, ""));
        return Number.isFinite(p) ? p : 0;
      }
      return 0;
    } catch {
      return 0;
    }
  };
  const partsItems: any[] = Array.isArray((reportData as any)?.repair_items)
    ? ((reportData as any)?.repair_items as any[])
    : (Array.isArray((re as any)?.parts_items) ? (re as any)?.parts_items : []);
  const labourBreakdown: any[] = Array.isArray((reportData as any)?.labour_breakdown)
    ? ((reportData as any)?.labour_breakdown as any[])
    : (Array.isArray((re as any)?.labour_breakdown) ? (re as any)?.labour_breakdown : []);
  const labourRateDefault = toNum((reportData as any)?.labour_rate_default ?? (re as any)?.labour_rate_default);

  const partsSubtotalCalc = partsItems.reduce((sum, it: any) => sum + toNum(it?.line_total ?? (toNum(it?.quantity) * toNum(it?.unit_price))), 0);
  const labourTotalCalc = labourBreakdown.reduce((sum, it: any) => {
    const rate = toNum(it?.rate_per_hour ?? labourRateDefault);
    const hours = toNum(it?.hours);
    const line = toNum(it?.line_total ?? hours * rate);
    return sum + line;
  }, 0);
  const totalHoursCalc = labourBreakdown.reduce((sum, it: any) => sum + toNum(it?.hours), 0);

  const partsSubtotal = toNum((reportData as any)?.parts_subtotal ?? (re as any)?.parts_subtotal ?? partsSubtotalCalc);
  const labourTotal = toNum((reportData as any)?.labour_total ?? (re as any)?.labour_total ?? labourTotalCalc);
  const lessBetterment = toNum((re as any)?.less_betterment);
  const shopSupplies = toNum((re as any)?.shop_supplies);
  const miscellaneous = toNum((re as any)?.miscellaneous);
  const taxes = toNum((re as any)?.taxes);
  const grandTotal = toNum((re as any)?.total ?? (partsSubtotal + labourTotal + shopSupplies + miscellaneous + taxes - lessBetterment));

  // Itemized Parts
  children.push(
    new Paragraph({
      text: tt.itemizedPartsHeading,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 120, after: 60 },
    })
  );
  if (partsItems.length > 0) {
    const partRows: TableRow[] = [];
    // Header
    partRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.partsColumns.item, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.partsColumns.sku, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.partsColumns.oem, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.partsColumns.qty, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.partsColumns.unitPrice, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.partsColumns.lineTotal, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.partsColumns.vendor, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.partsColumns.link, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.partsColumns.leadTime, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.partsColumns.notes, bold: true })] })] }),
        ],
      })
    );
    for (const it of partsItems) {
      const qty = toNum(it?.quantity);
      const unit = toNum(it?.unit_price);
      const line = toNum(it?.line_total ?? qty * unit);
      partRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(safe(it?.name) || "—")] }),
            new TableCell({ children: [new Paragraph(safe(it?.sku) || "—")] }),
            new TableCell({ children: [new Paragraph(safe(it?.oem_or_aftermarket) || "—")] }),
            new TableCell({ children: [new Paragraph(String(qty || 0))] }),
            new TableCell({ children: [new Paragraph(formatMoneyStrict(unit, ccy) || "—")] }),
            new TableCell({ children: [new Paragraph(formatMoneyStrict(line, ccy) || "—")] }),
            new TableCell({ children: [new Paragraph(safe(it?.vendor) || "—")] }),
            new TableCell({ children: [new Paragraph(safe(it?.vendor_link) || "—")] }),
            new TableCell({ children: [new Paragraph(String(toNum(it?.lead_time_days) || 0))] }),
            new TableCell({ children: [new Paragraph(safe(it?.notes) || "")] }),
          ],
        })
      );
    }
    children.push(
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: partRows })
    );
  } else {
    children.push(new Paragraph({ text: "—" }));
  }

  // Labour Breakdown
  children.push(
    new Paragraph({
      text: tt.labourBreakdownHeading,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 120, after: 60 },
    })
  );
  if (labourBreakdown.length > 0) {
    const labRows: TableRow[] = [];
    labRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.labourColumns.task, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.labourColumns.hours, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.labourColumns.rate, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.labourColumns.lineTotal, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.labourColumns.notes, bold: true })] })] }),
        ],
      })
    );
    for (const it of labourBreakdown) {
      const hours = toNum(it?.hours);
      const rate = toNum(it?.rate_per_hour ?? labourRateDefault);
      const line = toNum(it?.line_total ?? hours * rate);
      labRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(safe(it?.task) || "—")] }),
            new TableCell({ children: [new Paragraph(String(hours || 0))] }),
            new TableCell({ children: [new Paragraph(formatMoneyStrict(rate, ccy) || "—")] }),
            new TableCell({ children: [new Paragraph(formatMoneyStrict(line, ccy) || "—")] }),
            new TableCell({ children: [new Paragraph(safe(it?.notes) || "")] }),
          ],
        })
      );
    }
    children.push(
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: labRows })
    );
  } else {
    children.push(new Paragraph({ text: "—" }));
  }

  // Estimate Composition Summary
  children.push(
    new Paragraph({
      text: tt.estimateComposition,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 120, after: 60 },
    })
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [ new TableCell({ children: [new Paragraph(tt.compositionRows.partsSubtotal)] }), new TableCell({ children: [new Paragraph(formatMoneyStrict(partsSubtotal, ccy))] }) ] }),
        new TableRow({ children: [ new TableCell({ children: [new Paragraph(tt.compositionRows.labourTotal)] }), new TableCell({ children: [new Paragraph(formatMoneyStrict(labourTotal, ccy))] }) ] }),
        new TableRow({ children: [ new TableCell({ children: [new Paragraph(tt.compositionRows.totalHours)] }), new TableCell({ children: [new Paragraph(String(totalHoursCalc))] }) ] }),
        new TableRow({ children: [ new TableCell({ children: [new Paragraph(tt.compositionRows.lessBetterment)] }), new TableCell({ children: [new Paragraph(formatMoneyStrict(lessBetterment, ccy))] }) ] }),
        new TableRow({ children: [ new TableCell({ children: [new Paragraph(tt.compositionRows.shopSupplies)] }), new TableCell({ children: [new Paragraph(formatMoneyStrict(shopSupplies, ccy))] }) ] }),
        new TableRow({ children: [ new TableCell({ children: [new Paragraph(tt.compositionRows.miscellaneous)] }), new TableCell({ children: [new Paragraph(formatMoneyStrict(miscellaneous, ccy))] }) ] }),
        new TableRow({ children: [ new TableCell({ children: [new Paragraph(tt.compositionRows.taxes)] }), new TableCell({ children: [new Paragraph(formatMoneyStrict(taxes, ccy))] }) ] }),
        new TableRow({ children: [ new TableCell({ children: [new Paragraph(tt.compositionRows.grandTotal)] }), new TableCell({ children: [new Paragraph(formatMoneyStrict(grandTotal, ccy))] }) ] }),
      ],
    })
  );

  // Manager Notes
  const procurementNotes = safe((reportData as any)?.procurement_notes) || safe((reportData as any)?.aiExtractedDetails?.procurement_notes);
  const safetyConcerns = safe((reportData as any)?.safety_concerns) || safe((reportData as any)?.aiExtractedDetails?.safety_concerns);
  const assumptions = safe((reportData as any)?.assumptions) || safe((reportData as any)?.aiExtractedDetails?.assumptions);
  const priorityLevel = safe((reportData as any)?.priority_level) || safe((reportData as any)?.aiExtractedDetails?.priority_level);
  if (procurementNotes || safetyConcerns || assumptions || priorityLevel) {
    children.push(
      new Paragraph({
        text: tt.managerNotesHeading,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 60 },
      })
    );
    const notesRows: TableRow[] = [];
    if (procurementNotes) notesRows.push(new TableRow({ children: [ new TableCell({ children: [new Paragraph(tt.procurementNotes)] }), new TableCell({ children: [ new Paragraph(String(procurementNotes)) ] }) ] }));
    if (safetyConcerns) notesRows.push(new TableRow({ children: [ new TableCell({ children: [new Paragraph(tt.safetyConcerns)] }), new TableCell({ children: [ new Paragraph(String(safetyConcerns)) ] }) ] }));
    if (assumptions) notesRows.push(new TableRow({ children: [ new TableCell({ children: [new Paragraph(tt.assumptions)] }), new TableCell({ children: [ new Paragraph(String(assumptions)) ] }) ] }));
    if (priorityLevel) notesRows.push(new TableRow({ children: [ new TableCell({ children: [new Paragraph(tt.priorityLevel)] }), new TableCell({ children: [ new Paragraph(String(priorityLevel)) ] }) ] }));
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: notesRows }));
  }

  // Comparables
  children.push(
    new Paragraph({
      text: tt.comparablesHeading,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 140, after: 80 },
    })
  );
  children.push(compsTable);

  // Comparable Details table (Field vs each Comparable)
  if (comps.length > 0) {
    const detailMaps: Record<string, any>[] = comps.map((c) =>
      (c && typeof c.details === "object" && c.details) || {}
    );
    const labelSet2 = new Set<string>();
    for (const m of detailMaps) {
      for (const k of Object.keys(m)) labelSet2.add(k);
    }
    const labels2 = Array.from(labelSet2);
    if (labels2.length > 0) {
      const fieldLabel = lang === "fr" ? "Champ" : lang === "es" ? "Campo" : "Field";
      const compHeader = (i: number) =>
        (lang === "fr" || lang === "es" ? "Comparable" : "Comparable") + " " + i;

      const rows: TableRow[] = [];
      // Header
      rows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: fieldLabel, bold: true })] })] }),
            ...comps.map((_, idx) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: compHeader(idx + 1), bold: true })],
                  }),
                ],
              })
            ),
          ],
        })
      );
      // Data rows
      for (const label of labels2) {
        rows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph(String(label))] }),
              ...detailMaps.map((m) => new TableCell({ children: [new Paragraph(safe(m?.[label]) || "Not Found")] })),
            ],
          })
        );
      }
      children.push(
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
      );
    }
  }

  // Valuation Summary
  children.push(goldDivider());
  children.push(
    new Paragraph({
      text: tt.valuationSummary,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 140, after: 80 },
    })
  );
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.totalValue)] }),
            new TableCell({ children: [new Paragraph(fmvFormatted || "—")] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.confidence)] }),
            new TableCell({
              children: [
                new Paragraph(
                  safe(reportData?.valuation?.confidence_level) || "—"
                ),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.recommendedReserve)] }),
            new TableCell({
              children: [
                new Paragraph(
                  formatMoneyStrict(
                    reportData?.aiExtractedDetails?.recommended_reserve,
                    ccy
                  ) || "—"
                ),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.actualCashValue)] }),
            new TableCell({
              children: [
                new Paragraph(
                  formatMoneyStrict(
                    reportData?.aiExtractedDetails?.actual_cash_value,
                    ccy
                  ) || "—"
                ),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.replacementCost)] }),
            new TableCell({
              children: [
                new Paragraph(
                  formatMoneyStrict(
                    reportData?.aiExtractedDetails?.replacement_cost,
                    ccy
                  ) || "—"
                ),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(tt.references)] }),
            new TableCell({
              children: [
                new Paragraph(
                  safe(
                    reportData?.aiExtractedDetails?.replacement_cost_references
                  ) || "—"
                ),
              ],
            }),
          ],
        }),
      ],
    })
  );
  if (safe(reportData?.valuation?.summary)) {
    children.push(
      new Paragraph({
        text: tt.summary,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 60 },
      })
    );
    children.push(
      new Paragraph({ text: safe(reportData?.valuation?.summary) })
    );
  }

  // Specialty Valuation Data (Client vs Comparable 1 vs Adjustments)
  const specI18n = {
    en: { header: "Specialty Valuation Data", field: "Field", client: "Client Vehicle", comp1: "Comparable 1", adj: "Adjustments", notFound: "Not Found" },
    fr: { header: "Données d'évaluation spécialisées", field: "Champ", client: "Véhicule du client", comp1: "Comparable 1", adj: "Ajustements", notFound: "Introuvable" },
    es: { header: "Datos de valoración especializada", field: "Campo", client: "Vehículo del cliente", comp1: "Comparable 1", adj: "Ajustes", notFound: "No encontrado" },
  } as const;
  const spec = (specI18n as any)[lang] as typeof specI18n.en;

  children.push(
    new Paragraph({
      text: spec.header,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 140, after: 80 },
    })
  );
  const sd: any = (reportData as any)?.specialty_data || (reportData as any)?.aiExtractedDetails?.specialty_data || {};
  const clientMap: Record<string, any> = (sd && typeof sd.client_vehicle === 'object' && sd.client_vehicle) || {};
  const compMap: Record<string, any> = (sd && typeof sd.comparable_1 === 'object' && sd.comparable_1) || {};
  const adjMap: Record<string, any> = (sd && typeof sd.adjustments === 'object' && sd.adjustments) || {};
  const labelSet = new Set<string>([...Object.keys(clientMap), ...Object.keys(compMap), ...Object.keys(adjMap)]);
  const labels = Array.from(labelSet);
  if (labels.length === 0) {
    // Fallback single row
    labels.push("YEAR");
  }
  const specRows: TableRow[] = [];
  // Header row
  specRows.push(
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: spec.field, bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: spec.client, bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: spec.comp1, bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: spec.adj, bold: true })] })] }),
      ],
    })
  );
  for (const key of labels) {
    const cv = safe(clientMap?.[key]) || spec.notFound;
    const cp = safe(compMap?.[key]) || spec.notFound;
    const adjRaw = (adjMap as any)?.[key];
    const adjTxt = Number.isFinite(adjRaw)
      ? formatMoneyStrict(adjRaw, ccy)
      : (typeof adjRaw === 'string' && adjRaw.trim()) ? adjRaw : '0';
    specRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(String(key))] }),
          new TableCell({ children: [new Paragraph(String(cv))] }),
          new TableCell({ children: [new Paragraph(String(cp))] }),
          new TableCell({ children: [new Paragraph(String(adjTxt))] }),
        ],
      })
    );
  }
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: specRows,
    })
  );

  // Appendix photo gallery
  if (imageUrls.length) {
    children.push(
      ...(await buildAppendixPhotoGallery(
        reportData,
        imageUrls,
        contentWidthTw
      ))
    );
  }

  const doc = new Document({
    title,
    creator: appraiser || "ClearValue",
    features: { updateFields: true },
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 26, color: "111827" },
          paragraph: { spacing: { line: 276, before: 0, after: 80 } },
        },
      },
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          basedOn: "Normal",
          next: "Normal",
          run: { font: "Calibri", size: 26, color: "111827" },
          paragraph: { spacing: { line: 276, after: 120 } },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 44, bold: true, color: "065F46" },
          paragraph: { spacing: { before: 180, after: 100 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 36, bold: true, color: "059669" },
          paragraph: { spacing: { before: 140, after: 80 } },
        },
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 52, bold: true, color: "065F46" },
          paragraph: {
            spacing: { before: 160, after: 120 },
            alignment: AlignmentType.CENTER,
          },
        },
        {
          id: "BodyLarge",
          name: "Body Large",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, color: "111827" },
          paragraph: { spacing: { line: 276, before: 0, after: 80 } },
        },
      ],
    },
    sections: [
      // Cover (no header/footer)
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
            },
          },
        },
        headers: { default: new Header({ children: [] }) },
        footers: { default: new Footer({ children: [] }) },
        children: [
          buildCover(
            { ...reportData, inspector_name: appraiser, suppressLotsLine: true },
            logoBuffer,
            contentWidthTw,
            title
          ),
        ],
      },
      // TOC (no header/footer)
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
            },
          },
        },
        headers: { default: new Header({ children: [] }) },
        footers: { default: new Footer({ children: [] }) },
        children: buildTOC({ ...reportData, inspector_name: appraiser }),
      },
      // Main content with header/footer and page numbers
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(0.75),
            },
            pageNumbers: { start: 1 },
          },
        },
        headers: { default: new Header({ children: [headerTable] }) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: tt.page }),
                  PageNumber.CURRENT as any,
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
