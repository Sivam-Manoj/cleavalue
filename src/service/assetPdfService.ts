import puppeteer from "puppeteer";
import handlebars from "handlebars";
import fs from "fs/promises";
import path from "path";
import {
  fetchCanadaAndNorthAmericaIndicators,
  generateTrendChartImage,
  generateBarChartImage,
} from "./marketIntelService.js";

// Helpers
handlebars.registerHelper("formatDate", function (dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});
// Equality helper for simple comparisons in templates
handlebars.registerHelper("eq", function (a: any, b: any) {
  return a === b;
});

export async function generateAssetPdfFromReport(reportData: any): Promise<Buffer> {
  try {
    const templatePath = path.resolve(
      process.cwd(),
      reportData?.grouping_mode === "per_item"
        ? "src/templates/asset_per_item.html"
        : reportData?.grouping_mode === "catalogue"
        ? "src/templates/catalogue.html"
        : reportData?.grouping_mode === "mixed"
        ? "src/templates/asset_mixed.html"
        : "src/templates/asset.html"
    );
    const htmlTemplate = await fs.readFile(templatePath, "utf-8");

    const logoPath = path.resolve(process.cwd(), "public/logo.jpg");
    const logoImage = await fs.readFile(logoPath);
    const logoBase64 = logoImage.toString("base64");
    const logoUrl = `data:image/jpeg;base64,${logoBase64}`;

    const template = handlebars.compile(htmlTemplate);

    const sanitizedData = JSON.parse(JSON.stringify(reportData));

    // i18n translations for templates
    const lang: 'en' | 'fr' | 'es' = ((): any => {
      const l = String((reportData as any)?.language || '').toLowerCase();
      return (l === 'fr' || l === 'es') ? l : 'en';
    })();
    const translations = {
      en: {
        assetReport: 'Asset Report',
        mixed: 'Mixed',
        groupingMode: 'Grouping Mode',
        totalLots: 'Total Lots',
        totalImages: 'Total Images',
        reportDetails: 'Report Details',
        contractNo: 'Contract No',
        perItem: 'Per Item',
        perPhoto: 'Per Photo',
        singleLot: 'Bundle',
        lotWord: 'Lot',
        lotsWord: 'Lots',
        title: 'Title',
        serialNoOrLabel: 'Serial / Label',
        description: 'Description',
        details: 'Details',
        estimatedValue: 'Est. Value',
        image: 'Image',
        client: 'Client',
        inspector: 'Inspector',
      },
      fr: {
        assetReport: "Rapport d'actifs",
        mixed: 'Mixte',
        groupingMode: 'Mode de regroupement',
        totalLots: 'Total des lots',
        totalImages: "Nombre d'images",
        reportDetails: 'Détails du rapport',
        contractNo: 'Numéro de contrat',
        perItem: 'Par article',
        perPhoto: 'Par photo',
        singleLot: 'Lot unique',
        lotWord: 'Lot',
        lotsWord: 'Lots',
        title: 'Titre',
        serialNoOrLabel: 'N° de série / Étiquette',
        description: 'Description',
        details: 'Détails',
        estimatedValue: 'Valeur estimée',
        image: 'Image',
        client: 'Client',
        inspector: 'Inspecteur',
      },
      es: {
        assetReport: 'Informe de activos',
        mixed: 'Mixto',
        groupingMode: 'Modo de agrupación',
        totalLots: 'Total de lotes',
        totalImages: 'Total de imágenes',
        reportDetails: 'Detalles del informe',
        contractNo: 'Número de contrato',
        perItem: 'Por artículo',
        perPhoto: 'Por foto',
        singleLot: 'Lote único',
        lotWord: 'Lote',
        lotsWord: 'Lotes',
        title: 'Título',
        serialNoOrLabel: 'Serie / Etiqueta',
        description: 'Descripción',
        details: 'Detalles',
        estimatedValue: 'Valor est.',
        image: 'Imagen',
        client: 'Cliente',
        inspector: 'Inspector',
      },
    } as const;
    const t = (translations as any)[lang] as typeof translations.en;

    // Prepare Market Overview data (bullets, sources, and chart images)
    let market: any = null;
    try {
      const { industry, canada, northAmerica } =
        await fetchCanadaAndNorthAmericaIndicators(reportData);

      const caChart = await generateTrendChartImage(
        canada.series.years,
        canada.series.values,
        `${industry} – Canada (5-Year Trend)`,
        1000,
        600
      );
      const naChart = await generateBarChartImage(
        northAmerica.series.years,
        northAmerica.series.values,
        `${industry} – North America (5-Year Trend)`,
        1000,
        600
      );

      const caChartUrl = `data:image/png;base64,${Buffer.from(caChart).toString(
        "base64"
      )}`;
      const naChartUrl = `data:image/png;base64,${Buffer.from(naChart).toString(
        "base64"
      )}`;

      // Unique sources by URL
      const combined = [
        ...(Array.isArray(canada?.sources) ? canada.sources : []),
        ...(Array.isArray(northAmerica?.sources) ? northAmerica.sources : []),
      ];
      const seen = new Set<string>();
      const uniqueRefs = combined.filter((s: any) => {
        const key = (s?.url || "").trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      market = {
        canada: { bullets: canada?.bullets || [], chart: caChartUrl },
        northAmerica: {
          bullets: northAmerica?.bullets || [],
          chart: naChartUrl,
        },
        sources: uniqueRefs,
      };
    } catch {
      market = null; // non-fatal
    }

    const dataForPdf = {
      logo_url: logoUrl,
      market,
      t,
      ...sanitizedData,
    };

    const finalHtml = template(dataForPdf);

    const browser = await puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      timeout: 120000,
    });
    const page = await browser.newPage();
    await page.setContent(finalHtml, { waitUntil: "networkidle0", timeout: 120000 });

    // Header/Footer templates for consistent branding and page numbers
    const headerTemplate = `
      <style>
        .pdf-header { font-size:8px; color:#6B7280; width:100%; padding: 4px 20px; }
        .pdf-header .right { float:right; }
        .pdf-header img { vertical-align:middle; height:16px; margin-right:8px; }
      </style>
      <div class="pdf-header">
        <span><img src="${logoUrl}" /> P.O. Box 3081 Regina, SK S4P 3G7 · www.McDougallBay.com · (306)757-1747${
          reportData?.user_email ? ` · ${reportData.user_email}` : ""
        }</span>
      </div>`;

    const footerTemplate = `
      <style>
        .pdf-footer { font-size:8px; color:#6B7280; width:100%; padding: 4px 20px; }
        .pdf-footer .page { float:right; }
      </style>
      <div class="pdf-footer">
        <span class="page"><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`;

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: { top: "60px", right: "20px", bottom: "60px", left: "20px" },
    });

    await browser.close();

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error("Error generating Asset PDF:", error);
    throw new Error("Failed to generate Asset PDF report.");
  }
}
