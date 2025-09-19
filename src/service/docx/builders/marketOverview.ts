import {
  AlignmentType,
  HeadingLevel,
  ImageRun,
  Paragraph,
  TextRun,
} from "docx";
import { goldDivider, formatMonthYear } from "./utils.js";
import {
  fetchCanadaAndNorthAmericaIndicators,
  generateTrendChartImage,
  generateBarChartImage,
} from "../../marketIntelService.js";
import { getLang, t } from "./i18n.js";

export async function buildMarketOverview(
  reportData: any
): Promise<Paragraph[]> {
  const children: Paragraph[] = [];
  const lang = getLang(reportData);
  const tr = t(lang);
  try {
    const { industry, canada, northAmerica } =
      await fetchCanadaAndNorthAmericaIndicators(reportData);

    children.push(
      new Paragraph({
        text: tr.marketOverview,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        spacing: { after: 160 },
      })
    );

    // Canada Highlights
    if (Array.isArray(canada?.bullets) && canada.bullets.length) {
      children.push(
        new Paragraph({
          text: tr.canadaHighlights,
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 100 },
        })
      );
      for (const b of canada.bullets) {
        children.push(
          new Paragraph({
            text: String(b),
            style: "BodyLarge",
            bullet: { level: 0 },
            spacing: { after: 40 },
          })
        );
      }
    }

    const caChart = await generateTrendChartImage(
      canada.series.years,
      canada.series.values,
      `${industry} – Canada (5-Year Trend)`,
      1000,
      600
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [
          new ImageRun({
            data: caChart as any,
            transformation: { width: 640, height: 384 },
          } as any),
        ],
      })
    );

    // North America Highlights
    if (Array.isArray(northAmerica?.bullets) && northAmerica.bullets.length) {
      children.push(
        new Paragraph({
          text: tr.northAmericaHighlights,
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 100 },
        })
      );
      for (const b of northAmerica.bullets) {
        children.push(
          new Paragraph({
            text: String(b),
            style: "BodyLarge",
            bullet: { level: 0 },
            spacing: { after: 40 },
          })
        );
      }
    }

    const naChart = await generateBarChartImage(
      northAmerica.series.years,
      northAmerica.series.values,
      `${industry} – North America (5-Year Trend)`,
      1000,
      600
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [
          new ImageRun({
            data: naChart as any,
            transformation: { width: 640, height: 384 },
          } as any),
        ],
      })
    );

    const combined = [
      ...(Array.isArray(canada?.sources) ? canada.sources : []),
      ...(Array.isArray(northAmerica?.sources) ? northAmerica.sources : []),
    ];
    const seen = new Set<string>();
    const uniqueRefs = combined.filter((s) => {
      const key = (s?.url || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (uniqueRefs.length) {
      children.push(
        new Paragraph({
          text: tr.references,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 80, after: 120 },
        })
      );
      children.push(goldDivider());
      for (const s of uniqueRefs) {
        children.push(
          new Paragraph({
            text: `${s.title} — ${s.url}`,
            style: "BodyLarge",
            bullet: { level: 0 },
            spacing: { after: 40 },
          })
        );
      }
    }
  } catch {
    // ignore market errors
  }

  return children;
}
