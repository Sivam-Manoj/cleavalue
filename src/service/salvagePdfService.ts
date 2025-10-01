import puppeteer from "puppeteer";
import handlebars from "handlebars";
import fs from "fs/promises";
import path from "path";

// Helper to format dates using the current context language (en/fr/es)
handlebars.registerHelper("formatDate", function (this: any, dateString: any) {
  if (!dateString) return "";
  const lang = this?.language || "en";
  const locale = lang === "fr" ? "fr-CA" : lang === "es" ? "es-ES" : "en-US";
  return new Date(dateString).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

// Numeric formatting helper with locale based on language
handlebars.registerHelper("numberFormat", function (this: any, value: any) {
  if (value == null || value === "") return "";
  const lang = this?.language || "en";
  const locale = lang === "fr" ? "fr-CA" : lang === "es" ? "es-ES" : "en-US";
  let num: number;
  if (typeof value === "number") num = value;
  else {
    const cleaned = String(value).replace(/[^0-9.-]/g, "");
    num = parseFloat(cleaned);
  }
  if (!isFinite(num)) return String(value);
  return num.toLocaleString(locale);
});

// Currency formatting helper using selected currency
handlebars.registerHelper("currencyFormat", function (this: any, value: any) {
  if (value == null || value === "") return "";
  const lang = this?.language || "en";
  const locale = lang === "fr" ? "fr-CA" : lang === "es" ? "es-ES" : "en-US";
  const currency = (this?.currency || "CAD").toString().toUpperCase();
  let num: number;
  if (typeof value === "number") num = value;
  else {
    const cleaned = String(value).replace(/[^0-9.-]/g, "");
    num = parseFloat(cleaned);
  }
  if (!isFinite(num)) return String(value);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return num.toLocaleString(locale);
  }
});

export async function generateSalvagePdfFromReport(reportData: any): Promise<Buffer> {
  try {
    const templatePath = path.resolve(
      process.cwd(),
      "src/templates/salvage.html"
    );
    const htmlTemplate = await fs.readFile(templatePath, "utf-8");

    const logoPath = path.resolve(process.cwd(), "public/logo.jpg");
    const logoImage = await fs.readFile(logoPath);
    const logoBase64 = logoImage.toString("base64");
    const logoUrl = `data:image/jpeg;base64,${logoBase64}`;

    const template = handlebars.compile(htmlTemplate);

    const sanitizedData = JSON.parse(JSON.stringify(reportData));

    // Basic i18n dictionary for PDF template labels
    const lang: "en" | "fr" | "es" = ((): any => {
      const l = String((reportData as any)?.language || "").toLowerCase();
      return l === "fr" || l === "es" ? l : "en";
    })();
    const t = {
      en: {
        title: "Salvage Report",
        reportSummary: "Report Summary",
        assetDetails: "Asset Details",
        repairEstimate: "Repair Estimate",
        comparables: "Comparable Salvage Listings",
        comparableDetails: "Comparable Details",
        valuationSummary: "Valuation Summary",
        confidence: "Confidence Level",
        preparedFor: "Prepared for",
        appraiser: "Appraiser",
        reportDate: "Report Date",
        fileNumber: "File Number",
        totalValue: "Fair Market Value",
        reportDetails: "Report Details",
        dateReceived: "Date Received",
        nextReportDue: "Next Report Due",
        lossType: "Loss Type",
        itemType: "Item Type",
        year: "Year",
        make: "Make",
        model: "Model",
        vin: "VIN",
        damageRepairAnalysis: "Damage & Repair Analysis",
        itemCondition: "Item Condition",
        damageDescription: "Damage Description",
        inspectionComments: "Inspection Comments",
        repairable: "Repairable",
        repairFacility: "Repair Facility",
        repairFacilityComments: "Repair Facility Comments",
        parts: "Parts",
        labour: "Labour",
        shopSupplies: "Shop Supplies",
        miscellaneous: "Miscellaneous",
        taxes: "Taxes",
        lessBetterment: "Less Betterment",
        totalEstimate: "Total Estimate",
        valuation: "Valuation",
        actualCashValue: "Actual Cash Value",
        replacementCost: "Replacement Cost",
        replacementCostReferences: "Replacement Cost References",
        recommendedReserve: "Recommended Reserve",
        lossSummaryComments: "Loss Summary & Comments",
        appraiserComments: "Appraiser Comments",
        contactInformation: "Contact Information",
        insured: "Insured",
        adjuster: "Adjuster",
        phone: "Phone",
        email: "Email",
        comparableSales: "Comparable Sales",
        viewListing: "View Listing",
        images: "Images",
        confidential: "Confidential",
        compsColumnsTitle: "Title",
        compsColumnsPrice: "Price",
        compsColumnsLocation: "Location",
        compsColumnsLink: "Link",
        specValuationHeader: "Specialty Valuation Data",
        specField: "Field",
        specClient: "Client Vehicle",
        specComp1: "Comparable 1",
        specAdj: "Adjustments",
        notFound: "Not Found",
      },
      fr: {
        title: "Rapport de récupération",
        reportSummary: "Résumé du rapport",
        assetDetails: "Détails de l'actif",
        repairEstimate: "Estimation des réparations",
        comparables: "Annonces de récupération comparables",
        comparableDetails: "Détails comparables",
        valuationSummary: "Résumé de l’évaluation",
        confidence: "Niveau de confiance",
        preparedFor: "Préparé pour",
        appraiser: "Évaluateur",
        reportDate: "Date du rapport",
        fileNumber: "Numéro de dossier",
        totalValue: "Valeur marchande",
        reportDetails: "Détails du rapport",
        dateReceived: "Date de réception",
        nextReportDue: "Prochain rapport dû",
        lossType: "Type de sinistre",
        itemType: "Type d'article",
        year: "Année",
        make: "Marque",
        model: "Modèle",
        vin: "VIN",
        damageRepairAnalysis: "Analyse des dommages et réparations",
        itemCondition: "État de l'article",
        damageDescription: "Description des dommages",
        inspectionComments: "Commentaires d'inspection",
        repairable: "Réparable",
        repairFacility: "Atelier de réparation",
        repairFacilityComments: "Commentaires de l'atelier",
        parts: "Pièces",
        labour: "Main-d'œuvre",
        shopSupplies: "Fournitures d'atelier",
        miscellaneous: "Divers",
        taxes: "Taxes",
        lessBetterment: "Moins plus-value",
        totalEstimate: "Estimation totale",
        valuation: "Évaluation",
        actualCashValue: "Valeur au comptant réelle",
        replacementCost: "Coût de remplacement",
        replacementCostReferences: "Références du coût de remplacement",
        recommendedReserve: "Réserve recommandée",
        lossSummaryComments: "Résumé des pertes et commentaires",
        appraiserComments: "Commentaires de l'évaluateur",
        contactInformation: "Coordonnées",
        insured: "Assuré",
        adjuster: "Expert en sinistres",
        phone: "Téléphone",
        email: "Courriel",
        comparableSales: "Ventes comparables",
        viewListing: "Voir l'annonce",
        images: "Images",
        confidential: "Confidentiel",
        compsColumnsTitle: "Titre",
        compsColumnsPrice: "Prix",
        compsColumnsLocation: "Emplacement",
        compsColumnsLink: "Lien",
        specValuationHeader: "Données d'évaluation spécialisées",
        specField: "Champ",
        specClient: "Véhicule du client",
        specComp1: "Comparable 1",
        specAdj: "Ajustements",
        notFound: "Introuvable",
      },
      es: {
        title: "Informe de salvamento",
        reportSummary: "Resumen del informe",
        assetDetails: "Detalles del activo",
        repairEstimate: "Estimación de reparación",
        comparables: "Anuncios de salvamento comparables",
        comparableDetails: "Detalles comparables",
        valuationSummary: "Resumen de la valoración",
        confidence: "Nivel de confianza",
        preparedFor: "Preparado para",
        appraiser: "Tasador",
        reportDate: "Fecha del informe",
        fileNumber: "Número de expediente",
        totalValue: "Valor de mercado",
        reportDetails: "Detalles del informe",
        dateReceived: "Fecha de recepción",
        nextReportDue: "Próximo informe",
        lossType: "Tipo de pérdida",
        itemType: "Tipo de artículo",
        year: "Año",
        make: "Marca",
        model: "Modelo",
        vin: "VIN",
        damageRepairAnalysis: "Análisis de daños y reparación",
        itemCondition: "Condición del artículo",
        damageDescription: "Descripción del daño",
        inspectionComments: "Comentarios de inspección",
        repairable: "Reparable",
        repairFacility: "Taller de reparación",
        repairFacilityComments: "Comentarios del taller",
        parts: "Piezas",
        labour: "Mano de obra",
        shopSupplies: "Suministros de taller",
        miscellaneous: "Misceláneos",
        taxes: "Impuestos",
        lessBetterment: "Menos mejoramiento",
        totalEstimate: "Estimación total",
        valuation: "Valoración",
        actualCashValue: "Valor en efectivo real",
        replacementCost: "Costo de reemplazo",
        replacementCostReferences: "Referencias del costo de reemplazo",
        recommendedReserve: "Reserva recomendada",
        lossSummaryComments: "Resumen de pérdidas y comentarios",
        appraiserComments: "Comentarios del tasador",
        contactInformation: "Información de contacto",
        insured: "Asegurado",
        adjuster: "Perito",
        phone: "Teléfono",
        email: "Correo electrónico",
        comparableSales: "Ventas comparables",
        viewListing: "Ver anuncio",
        images: "Imágenes",
        confidential: "Confidencial",
        compsColumnsTitle: "Título",
        compsColumnsPrice: "Precio",
        compsColumnsLocation: "Ubicación",
        compsColumnsLink: "Enlace",
        specValuationHeader: "Datos de valoración especializada",
        specField: "Campo",
        specClient: "Vehículo del cliente",
        specComp1: "Comparable 1",
        specAdj: "Ajustes",
        notFound: "No encontrado",
      },
    } as const;

    // Precompute dynamic label sets for template tables
    const sd: any = (reportData as any)?.specialty_data || (reportData as any)?.aiExtractedDetails?.specialty_data || {};
    const clientMap: Record<string, any> = (sd && typeof sd.client_vehicle === 'object' && sd.client_vehicle) || {};
    const compMap: Record<string, any> = (sd && typeof sd.comparable_1 === 'object' && sd.comparable_1) || {};
    const adjMap: Record<string, any> = (sd && typeof sd.adjustments === 'object' && sd.adjustments) || {};
    const specLabels = Array.from(new Set<string>([...Object.keys(clientMap), ...Object.keys(compMap), ...Object.keys(adjMap)]));
    if (specLabels.length === 0) specLabels.push("YEAR");
    const compDetailsLabels = Array.from(new Set<string>((Array.isArray((reportData as any)?.comparableItems) ? (reportData as any).comparableItems : []).flatMap((c: any) => Object.keys((c && typeof c.details === 'object' && c.details) || {}))));

    const dataForPdf = {
      logo_url: logoUrl,
      language: lang,
      tt: (t as any)[lang],
      currency: (reportData as any)?.currency || 'CAD',
      specLabels,
      compDetailsLabels,
      ...sanitizedData,
    };

    const finalHtml = template(dataForPdf);

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      timeout: 120000, // 2 minutes
    });
    const page = await browser.newPage();
    await page.setContent(finalHtml, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
    });

    await browser.close();

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate PDF report.");
  }
}
