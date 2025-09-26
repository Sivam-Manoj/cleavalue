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
import {
  buildKeyValueTable,
  goldDivider,
  formatDateUS,
} from "./builders/utils.js";
import { buildHeaderTable } from "./builders/header.js";
import { buildCover } from "./builders/cover.js";
import { buildTOC } from "./builders/toc.js";
import { buildCertificateOfAppraisal } from "./builders/certificate.js";
import { buildAppendixPhotoGallery } from "./builders/appendix.js";
import { buildMarketOverview } from "./builders/marketOverview.js";

function pageBreak(): Paragraph {
  return new Paragraph({
    children: [new TextRun("")],
    pageBreakBefore: true,
  });
}

function safe(val?: any): string {
  if (val === undefined || val === null) return "";
  return String(val);
}

function getCompVal(obj: any, key: string, alt?: string): string {
  if (!obj) return "";
  if (obj[key] !== undefined && obj[key] !== null) return String(obj[key]);
  if (alt && obj[alt] !== undefined && obj[alt] !== null)
    return String(obj[alt]);
  // Try case-insensitive fallback
  const lowerKey = key.toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lowerKey) return String(obj[k]);
  }
  return "";
}

function buildRealEstateTransmittal(
  tt: any,
  owner: string,
  addr: string,
  inspectorName: string,
  inspectorCompany: string,
  reportDate: string
): Paragraph[] {
  const children: Paragraph[] = [];
  children.push(
    new Paragraph({
      text: tt.transmittalHeading,
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 160 },
    })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: reportDate })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 140 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: owner || "—", bold: true })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 120 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: `${tt.dear} ${owner || "—"},` })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 100 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: tt.transmittalP1(addr || "—") })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 110 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: tt.transmittalP2 })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 110 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: tt.transmittalP3 })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 110 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: tt.transmittalP4 })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 120 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: tt.sincerely + "," })],
      keepLines: true,
      keepNext: true,
      spacing: { before: 60, after: 100 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: inspectorName })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 60 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: inspectorCompany, bold: true })],
    })
  );
  return children;
}

export async function generateRealEstateDocx(reportData: any): Promise<Buffer> {
  const lang: "en" | "fr" | "es" = ((): any => {
    const l = String((reportData as any)?.language || "").toLowerCase();
    return l === "fr" || l === "es" ? l : "en";
  })();

  const t = {
    en: {
      title: "Real Estate Valuation Report",
      reportSummary: "Report Summary",
      preparedFor: "Prepared for",
      reportDate: "Report Date",
      page: "Page ",
      valuationSummary: "Valuation Summary",
      methodology: "Methodology",
      valueSource: "Value Source",
      comparableListPrice: "Comparable List Price",
      comparableUsed: "Comparable Used",
      finalEstimateSummary: "Final Estimate Summary",
      finalEstimateValue: "Final Estimate (Words)",
      transmittalHeading: "Transmittal Letter",
      dear: "Dear",
      transmittalP1: (addr: string) => `Re: Evaluation of ${addr}`,
      transmittalP2:
        "At your request, we have prepared a real estate report of certain real estate owned by you, a copy of which is enclosed. This report is intended for your exclusive use along with your chosen agent and is intended only for establishing values of the subject property.",
      transmittalP3:
        "The subject property was evaluated under the premise of Fair Market Value for internal consideration. The cost and market approaches to value have been considered for this report and have either been utilized where necessary or deemed inappropriate for the value conclusions found therein.",
      transmittalP4:
        "After a thorough analysis of the property and information made available to us, it is our opinion that as of the Effective Date, this property has a Fair Market Value as shown on the certificate included.",
      sincerely: "Sincerely",
      certificateHeading: "Certificate of Value",
      totalValue: "Fair Market Value",
      scheduleA: 'Schedule "A" - Property Details',
      comparablesHeading: "Comparable Properties",
      feature: "Feature",
      subject: "Subject Property",
      features: {
        address: "Address",
        listPrice: "List Price",
        squareFootage: "Square Footage",
        lotSize: "Lot Size",
        rooms: "Rooms/Bedrooms",
        bathrooms: "Bathrooms",
        adjustedValue: "Adjusted Value",
      },
    },
    fr: {
      title: "Rapport d'évaluation immobilière",
      reportSummary: "Résumé du rapport",
      preparedFor: "Préparé pour",
      reportDate: "Date du rapport",
      page: "Page ",
      valuationSummary: "Résumé de l’évaluation",
      methodology: "Méthodologie",
      valueSource: "Source de la valeur",
      comparableListPrice: "Prix affiché du comparable",
      comparableUsed: "Comparable utilisé",
      finalEstimateSummary: "Résumé de l’estimation finale",
      finalEstimateValue: "Estimation finale (en toutes lettres)",
      transmittalHeading: "Lettre d’envoi",
      dear: "Madame, Monsieur",
      transmittalP1: (addr: string) => `Objet : Évaluation de ${addr}`,
      transmittalP2:
        "À votre demande, nous avons préparé un rapport immobilier concernant un bien vous appartenant, dont copie est jointe. Ce rapport est destiné à votre usage exclusif ainsi qu’à celui de votre mandataire et uniquement à l’établissement de la valeur du bien évalué.",
      transmittalP3:
        "Le bien a été évalué selon l’hypothèse de la Juste Valeur Marchande, à des fins internes. Les approches par le coût et par le marché ont été prises en compte et utilisées lorsque cela était nécessaire pour les conclusions de valeur présentées.",
      transmittalP4:
        "Après une analyse approfondie du bien et des informations mises à notre disposition, nous estimons qu’à la date d’effet, ce bien a la valeur marchande indiquée dans le certificat inclus.",
      sincerely: "Cordialement",
      certificateHeading: "Certificat de valeur",
      totalValue: "Valeur marchande",
      scheduleA: 'Annexe "A" - Détails du bien',
      comparablesHeading: "Biens comparables",
      feature: "Caractéristique",
      subject: "Bien sujet",
      features: {
        address: "Adresse",
        listPrice: "Prix affiché",
        squareFootage: "Superficie (pi²)",
        lotSize: "Superficie du lot",
        rooms: "Pièces/Chambres",
        bathrooms: "Salles de bain",
        adjustedValue: "Valeur ajustée",
      },
    },
    es: {
      title: "Informe de valoración inmobiliaria",
      reportSummary: "Resumen del informe",
      preparedFor: "Preparado para",
      reportDate: "Fecha del informe",
      page: "Página ",
      valuationSummary: "Resumen de la valoración",
      methodology: "Metodología",
      valueSource: "Fuente del valor",
      comparableListPrice: "Precio de lista del comparable",
      comparableUsed: "Comparable utilizado",
      finalEstimateSummary: "Resumen de la estimación final",
      finalEstimateValue: "Valor estimado final (en palabras)",
      transmittalHeading: "Carta de presentación",
      dear: "Estimado/a",
      transmittalP1: (addr: string) => `Asunto: Valoración de ${addr}`,
      transmittalP2:
        "A su solicitud, hemos preparado un informe inmobiliario de un bien de su propiedad, cuya copia se adjunta. Este informe es para su uso exclusivo y el de su agente designado y solo para establecer el valor del inmueble objeto.",
      transmittalP3:
        "El inmueble fue evaluado bajo el supuesto de Valor de Mercado, para consideración interna. Se han considerado los enfoques de costo y de mercado y se han utilizado cuando correspondía para las conclusiones de valor presentadas.",
      transmittalP4:
        "Tras un análisis exhaustivo de la propiedad y la información disponible, a nuestro juicio a la fecha de vigencia, esta propiedad tiene el Valor de Mercado indicado en el certificado adjunto.",
      sincerely: "Atentamente",
      certificateHeading: "Certificado de valor",
      totalValue: "Valor de mercado",
      scheduleA: 'Anexo "A" - Detalles de la propiedad',
      comparablesHeading: "Propiedades comparables",
      feature: "Característica",
      subject: "Propiedad sujeta",
      features: {
        address: "Dirección",
        listPrice: "Precio de lista",
        squareFootage: "Superficie (ft²)",
        lotSize: "Tamaño del lote",
        rooms: "Habitaciones/Dormitorios",
        bathrooms: "Baños",
        adjustedValue: "Valor ajustado",
      },
    },
  } as const;

  const tt = (t as any)[lang] as typeof t.en;

  const owner = safe(
    reportData?.owner_name || reportData?.property_details?.owner_name
  );
  const addr = safe(reportData?.property_details?.address);
  const reportDate = safe(reportData?.report_dates?.report_date);
  const inspectorName = safe(reportData?.inspector_info?.inspector_name);
  const inspectorCompany = safe(reportData?.inspector_info?.company_name);
  const fmv = safe(
    reportData?.valuation?.fair_market_value ||
      reportData?.valuation?.final_estimate_value
  );
  const valuation = (reportData as any)?.valuation || {};

  // Normalize comparables to an array of [name, obj]
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

  // Build comparables table
  const compColumns = 2 + compsEntries.length; // Feature + Subject + comps
  const compTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: tt.feature, bold: true })],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: tt.subject, bold: true })],
              }),
            ],
          }),
          ...compsEntries.map(
            ([name]) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: String(name), bold: true })],
                  }),
                ],
              })
          ),
        ],
      }),
      // Address
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(tt.features.address)] }),
          new TableCell({ children: [new Paragraph(addr || "—")] }),
          ...compsEntries.map(
            ([, c]) =>
              new TableCell({
                children: [
                  new Paragraph(
                    getCompVal(c, "address", "Address / Location") || "—"
                  ),
                ],
              })
          ),
        ],
      }),
      // List Price
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(tt.features.listPrice)] }),
          new TableCell({ children: [new Paragraph("N/A")] }),
          ...compsEntries.map(
            ([, c]) =>
              new TableCell({
                children: [
                  new Paragraph(
                    getCompVal(c, "listPrice", "List Price") || "—"
                  ),
                ],
              })
          ),
        ],
      }),
      // Square Footage
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph(tt.features.squareFootage)],
          }),
          new TableCell({
            children: [
              new Paragraph(
                safe(reportData?.house_details?.square_footage) || "—"
              ),
            ],
          }),
          ...compsEntries.map(
            ([, c]) =>
              new TableCell({
                children: [
                  new Paragraph(
                    getCompVal(c, "squareFootage", "Square Footage") || "—"
                  ),
                ],
              })
          ),
        ],
      }),
      // Lot Size
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(tt.features.lotSize)] }),
          new TableCell({
            children: [
              new Paragraph(
                safe(reportData?.house_details?.lot_size_sqft) || "—"
              ),
            ],
          }),
          ...compsEntries.map(
            ([, c]) =>
              new TableCell({
                children: [
                  new Paragraph(getCompVal(c, "lotSize", "Lot Size") || "—"),
                ],
              })
          ),
        ],
      }),
      // Rooms / Bedrooms
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(tt.features.rooms)] }),
          new TableCell({
            children: [
              new Paragraph(
                safe(reportData?.house_details?.number_of_rooms) || "—"
              ),
            ],
          }),
          ...compsEntries.map(
            ([, c]) =>
              new TableCell({
                children: [
                  new Paragraph(getCompVal(c, "bedrooms", "Bedrooms") || "—"),
                ],
              })
          ),
        ],
      }),
      // Bathrooms
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(tt.features.bathrooms)] }),
          new TableCell({
            children: [
              new Paragraph(
                `${safe(reportData?.house_details?.number_of_full_bathrooms) || "0"} Full, ${safe(reportData?.house_details?.number_of_half_bathrooms) || "0"} Half`
              ),
            ],
          }),
          ...compsEntries.map(
            ([, c]) =>
              new TableCell({
                children: [
                  new Paragraph(getCompVal(c, "bathrooms", "Bathrooms") || "—"),
                ],
              })
          ),
        ],
      }),
      // Adjusted Value
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph(tt.features.adjustedValue)],
          }),
          new TableCell({ children: [new Paragraph("N/A")] }),
          ...compsEntries.map(
            ([, c]) =>
              new TableCell({
                children: [
                  new Paragraph(
                    getCompVal(c, "adjustedValue", "Adjusted Value") || "—"
                  ),
                ],
              })
          ),
        ],
      }),
    ],
  });

  // Shared visuals and layout like Mixed DOCX
  const contentWidthTw = convertInchesToTwip(6.5);
  // Load logo
  let logoBuffer: Buffer | null = null;
  try {
    const logoPath = path.resolve(process.cwd(), "public/logo.jpg");
    logoBuffer = await fs.readFile(logoPath);
  } catch {
    logoBuffer = null;
  }
  // Header table and report date
  const headerTable = buildHeaderTable(
    logoBuffer,
    contentWidthTw,
    (reportData?.inspector_info?.contact_email as string) ||
      (reportData as any)?.user_email ||
      ""
  );
  const reportDateStr = formatDateUS(
    (reportData as any)?.report_dates?.report_date || new Date().toISOString()
  );

  // Normalize fields for builders
  const docData = {
    ...reportData,
    appraiser: inspectorName,
    appraisal_company: inspectorCompany,
    client_name: owner || (reportData as any)?.client_name || "",
  };
  const coverData = {
    ...docData,
    inspector_name: inspectorName,
  };
  const rootImageUrls: string[] = Array.isArray((reportData as any)?.imageUrls)
    ? (reportData as any).imageUrls
    : [];

  // Main content children
  const children: Array<Paragraph | Table> = [];
  children.push(
    new Paragraph({
      text: tt.reportSummary,
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 120 },
    })
  );
  children.push(goldDivider());
  children.push(
    buildKeyValueTable([
      { label: tt.preparedFor, value: owner },
      { label: tt.reportDate, value: reportDateStr },
      { label: tt.features.address, value: addr },
      { label: tt.totalValue, value: fmv || "—" },
    ])
  );

  // Schedule A
  children.push(
    new Paragraph({
      text: tt.scheduleA,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 140, after: 80 },
    })
  );
  children.push(
    buildKeyValueTable([
      { label: tt.features.address, value: addr },
      {
        label: tt.features.squareFootage,
        value: safe(reportData?.house_details?.square_footage),
      },
      {
        label: tt.features.lotSize,
        value: safe(reportData?.house_details?.lot_size_sqft),
      },
      {
        label: tt.features.rooms,
        value: safe(reportData?.house_details?.number_of_rooms),
      },
      {
        label: tt.features.bathrooms,
        value: `${safe(reportData?.house_details?.number_of_full_bathrooms) || "0"} Full, ${safe(reportData?.house_details?.number_of_half_bathrooms) || "0"} Half`,
      },
    ])
  );

  // Comparables
  children.push(
    new Paragraph({
      text: tt.comparablesHeading,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 140, after: 80 },
    })
  );
  children.push(compTable);

  // Valuation Summary (green-themed accents) under comparables
  children.push(goldDivider());
  children.push(
    new Paragraph({
      text: tt.valuationSummary,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 140, after: 80 },
    })
  );
  children.push(
    buildKeyValueTable([
      {
        label: tt.totalValue,
        value: fmv || safe(valuation?.fair_market_value) || "—",
      },
      { label: tt.valueSource, value: safe(valuation?.value_source) },
      { label: tt.comparableUsed, value: safe(valuation?.comparable_used) },
      {
        label: tt.comparableListPrice,
        value: safe(valuation?.comparable_list_price),
      },
      {
        label: tt.finalEstimateValue,
        value: safe(valuation?.final_estimate_value),
      },
    ])
  );
  children.push(
    new Paragraph({
      text: tt.finalEstimateSummary,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 120, after: 60 },
    })
  );
  children.push(
    new Paragraph({ text: safe(valuation?.final_estimate_summary) })
  );
  children.push(goldDivider());
  children.push(
    new Paragraph({
      text: tt.methodology,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 120, after: 60 },
    })
  );
  children.push(new Paragraph({ text: safe(valuation?.details) }));

  // Market overview and appendix
  children.push(
    ...(await buildMarketOverview({
      ...reportData,
      industry: (reportData as any)?.industry || "Real Estate",
    }))
  );
  if (rootImageUrls.length) {
    const appendixChildren = await buildAppendixPhotoGallery(
      reportData,
      rootImageUrls,
      contentWidthTw
    );
    children.push(...appendixChildren);
  }

  const doc = new Document({
    creator: inspectorName || "ClearValue",
    title: `${tt.title}${addr ? ` - ${addr}` : ""}`,
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
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: { default: new Header({ children: [] }) },
        footers: { default: new Footer({ children: [] }) },
        children: [buildCover(coverData, logoBuffer, contentWidthTw, tt.title)],
      },
      // Table of Contents (no header/footer)
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: { default: new Header({ children: [] }) },
        footers: { default: new Footer({ children: [] }) },
        children: buildTOC(coverData),
      },
      // Transmittal Letter (no header/footer)
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: { default: new Header({ children: [] }) },
        footers: { default: new Footer({ children: [] }) },
        children: buildRealEstateTransmittal(
          tt,
          owner,
          addr,
          inspectorName,
          inspectorCompany,
          reportDateStr
        ),
      },
      // Certificate (no header/footer)
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: { default: new Header({ children: [] }) },
        footers: { default: new Footer({ children: [] }) },
        children: buildCertificateOfAppraisal(
          docData,
          contentWidthTw,
          reportDateStr
        ) as any,
      },
      // Main content with header/footer and page numbers
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
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
