import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { buildKeyValueTable } from "./builders/utils.js";

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
  if (alt && obj[alt] !== undefined && obj[alt] !== null) return String(obj[alt]);
  // Try case-insensitive fallback
  const lowerKey = key.toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lowerKey) return String(obj[k]);
  }
  return "";
}

export async function generateRealEstateDocx(reportData: any): Promise<Buffer> {
  const lang: "en" | "fr" | "es" = ((): any => {
    const l = String((reportData as any)?.language || "").toLowerCase();
    return l === "fr" || l === "es" ? l : "en";
  })();

  const t = {
    en: {
      title: "Real Estate Valuation Report",
      preparedFor: "Prepared for",
      reportDate: "Report Date",
      transmittalHeading: "Transmittal Letter",
      dear: "Dear",
      transmittalP1: (addr: string) =>
        `Re: Evaluation of ${addr}`,
      transmittalP2:
        "At your request, we have prepared a real estate report of certain real estate owned by you, a copy of which is enclosed. This report is intended for your exclusive use along with your chosen agent and is intended only for establishing values of the subject property.",
      transmittalP3:
        "The subject property was evaluated under the premise of Fair Market Value for internal consideration. The cost and market approaches to value have been considered for this report and have either been utilized where necessary or deemed inappropriate for the value conclusions found therein.",
      transmittalP4:
        "After a thorough analysis of the property and information made available to us, it is our opinion that as of the Effective Date, this property has a Fair Market Value as shown on the certificate included.",
      sincerely: "Sincerely",
      certificateHeading: "Certificate of Value",
      totalValue: "Fair Market Value",
      scheduleA: "Schedule \"A\" - Property Details",
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
      preparedFor: "Préparé pour",
      reportDate: "Date du rapport",
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
      scheduleA: "Annexe \"A\" - Détails du bien",
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
      preparedFor: "Preparado para",
      reportDate: "Fecha del informe",
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
      scheduleA: "Anexo \"A\" - Detalles de la propiedad",
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

  const owner = safe(reportData?.owner_name || reportData?.property_details?.owner_name);
  const addr = safe(reportData?.property_details?.address);
  const reportDate = safe(reportData?.report_dates?.report_date);
  const inspectorName = safe(reportData?.inspector_info?.inspector_name);
  const inspectorCompany = safe(reportData?.inspector_info?.company_name);
  const fmv = safe(reportData?.valuation?.fair_market_value || reportData?.valuation?.final_estimate_value);

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
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.feature, bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: tt.subject, bold: true })] })] }),
          ...compsEntries.map(([name]) =>
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(name), bold: true })] })] })
          ),
        ],
      }),
      // Address
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(tt.features.address)] }),
          new TableCell({ children: [new Paragraph(addr || "—")] }),
          ...compsEntries.map(([, c]) =>
            new TableCell({ children: [new Paragraph(getCompVal(c, "address", "Address / Location") || "—")] })
          ),
        ],
      }),
      // List Price
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(tt.features.listPrice)] }),
          new TableCell({ children: [new Paragraph("N/A")] }),
          ...compsEntries.map(([, c]) =>
            new TableCell({ children: [new Paragraph(getCompVal(c, "listPrice", "List Price") || "—")] })
          ),
        ],
      }),
      // Square Footage
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(tt.features.squareFootage)] }),
          new TableCell({ children: [new Paragraph(safe(reportData?.house_details?.square_footage) || "—")] }),
          ...compsEntries.map(([, c]) =>
            new TableCell({ children: [new Paragraph(getCompVal(c, "squareFootage", "Square Footage") || "—")] })
          ),
        ],
      }),
      // Lot Size
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(tt.features.lotSize)] }),
          new TableCell({ children: [new Paragraph(safe(reportData?.house_details?.lot_size_sqft) || "—")] }),
          ...compsEntries.map(([, c]) =>
            new TableCell({ children: [new Paragraph(getCompVal(c, "lotSize", "Lot Size") || "—")] })
          ),
        ],
      }),
      // Rooms / Bedrooms
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(tt.features.rooms)] }),
          new TableCell({ children: [new Paragraph(safe(reportData?.house_details?.number_of_rooms) || "—")] }),
          ...compsEntries.map(([, c]) =>
            new TableCell({ children: [new Paragraph(getCompVal(c, "bedrooms", "Bedrooms") || "—")] })
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
          ...compsEntries.map(([, c]) =>
            new TableCell({ children: [new Paragraph(getCompVal(c, "bathrooms", "Bathrooms") || "—")] })
          ),
        ],
      }),
      // Adjusted Value
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(tt.features.adjustedValue)] }),
          new TableCell({ children: [new Paragraph("N/A")] }),
          ...compsEntries.map(([, c]) =>
            new TableCell({ children: [new Paragraph(getCompVal(c, "adjustedValue", "Adjusted Value") || "—")] })
          ),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: tt.title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: addr,
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({ text: `${tt.preparedFor}: `, bold: true }),
              new TextRun({ text: owner || "—" }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `${tt.reportDate}: `, bold: true }),
              new TextRun({ text: reportDate || "—" }),
            ],
          }),
          pageBreak(),

          // Transmittal Letter
          new Paragraph({
            text: tt.transmittalHeading,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph(`${tt.dear} ${owner || "—"},`),
          new Paragraph(tt.transmittalP1(addr || "—")),
          new Paragraph(tt.transmittalP2),
          new Paragraph(tt.transmittalP3),
          new Paragraph(tt.transmittalP4),
          new Paragraph(""),
          new Paragraph(tt.sincerely + ","),
          new Paragraph(inspectorName),
          new Paragraph(inspectorCompany),
          pageBreak(),

          // Certificate of Value
          new Paragraph({
            text: tt.certificateHeading,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({ text: tt.totalValue, heading: HeadingLevel.HEADING_3 }),
          new Paragraph({
            children: [new TextRun({ text: fmv || "—", bold: true, size: 48 })],
          }),
          buildKeyValueTable([
            { label: tt.preparedFor, value: owner },
            { label: tt.reportDate, value: reportDate },
          ]),
          pageBreak(),

          // Schedule A - Property Details (minimal selection)
          new Paragraph({ text: tt.scheduleA, heading: HeadingLevel.HEADING_1 }),
          buildKeyValueTable([
            { label: tt.features.address, value: addr },
            { label: tt.features.squareFootage, value: safe(reportData?.house_details?.square_footage) },
            { label: tt.features.lotSize, value: safe(reportData?.house_details?.lot_size_sqft) },
            { label: tt.features.rooms, value: safe(reportData?.house_details?.number_of_rooms) },
            { label: tt.features.bathrooms, value: `${safe(reportData?.house_details?.number_of_full_bathrooms) || "0"} Full, ${safe(reportData?.house_details?.number_of_half_bathrooms) || "0"} Half` },
          ]),
          pageBreak(),

          // Comparables
          new Paragraph({ text: tt.comparablesHeading, heading: HeadingLevel.HEADING_1 }),
          compTable,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
