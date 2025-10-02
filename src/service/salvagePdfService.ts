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

// Helper: coalesce - returns first non-empty arg
handlebars.registerHelper("coalesce", function (...args: any[]) {
  const opts = args.pop();
  for (const v of args) {
    if (v === 0) return 0;
    if (v !== null && v !== undefined) {
      const s = typeof v === "string" ? v.trim() : v;
      if (s !== "") return v;
    }
  }
  return "";
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

    // Derive itemized parts/labour and composition values for the template
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
    const re = ((reportData as any)?.aiExtractedDetails?.repair_estimate || (reportData as any)?.repair_estimate || {}) as any;
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
    const procurementNotes = (reportData as any)?.procurement_notes || (reportData as any)?.aiExtractedDetails?.procurement_notes || "";
    const safetyConcerns = (reportData as any)?.safety_concerns || (reportData as any)?.aiExtractedDetails?.safety_concerns || "";
    const assumptions = (reportData as any)?.assumptions || (reportData as any)?.aiExtractedDetails?.assumptions || "";
    const priorityLevel = (reportData as any)?.priority_level || (reportData as any)?.aiExtractedDetails?.priority_level || "";
    const hasManagerNotes = Boolean(procurementNotes || safetyConcerns || assumptions || priorityLevel);

    // Build computed rows for template rendering
    const partsRows = partsItems.map((it: any) => {
      const _qty = toNum(it?.quantity);
      const _unit = toNum(it?.unit_price);
      const _line = toNum(it?.line_total ?? _qty * _unit);
      return { ...it, _qty, _unit, _line };
    });
    const labourRows = labourBreakdown.map((it: any) => {
      const _hours = toNum(it?.hours);
      const _rate = toNum(it?.rate_per_hour ?? labourRateDefault);
      const _line = toNum(it?.line_total ?? _hours * _rate);
      return { ...it, _hours, _rate, _line };
    });

    const dataForPdf = {
      logo_url: logoUrl,
      language: lang,
      tt: (t as any)[lang],
      currency: (reportData as any)?.currency || 'CAD',
      specLabels,
      compDetailsLabels,
      partsItems,
      labourBreakdown,
      partsRows,
      labourRows,
      labourRateDefault,
      partsSubtotal,
      labourTotal,
      totalHours: totalHoursCalc,
      lessBetterment,
      shopSupplies,
      miscellaneous,
      taxes,
      grandTotal,
      procurementNotes,
      safetyConcerns,
      assumptions,
      priorityLevel,
      hasManagerNotes,
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
