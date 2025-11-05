import { HeadingLevel, Paragraph, TextRun, AlignmentType } from "docx";
import { goldDivider } from "./utils.js";
import { getLang, t } from "./i18n.js";

export function buildTransmittalLetter(
  reportData: any,
  reportDate: string
): Paragraph[] {
  const children: Paragraph[] = [];

  const clientName = String(reportData?.client_name || "").trim() || "Client";
  const ownerName = String(reportData?.owner_name || "").trim() || clientName;
  const exclusiveUseBy = String(
    (reportData as any)?.exclusive_use_by || clientName
  );
  const attentionName = String(
    (reportData as any)?.attention ||
      (reportData as any)?.contact_name ||
      clientName
  ).trim();
  const lang = getLang(reportData);
  const tr = t(lang);
  const purposeRaw = String(reportData?.appraisal_purpose || "").toLowerCase();
  const isFMV =
    purposeRaw.includes("fmv") ||
    purposeRaw.includes("fair market") ||
    !!(reportData as any)?.valuation?.fair_market_value ||
    !!(reportData as any)?.valuation_data?.baseFMV;

  children.push(
    new Paragraph({
      text: tr.transmittalLetter,
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
      children: [new TextRun({ text: clientName, bold: true })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 120 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: `${tr.attention}: ${attentionName}` })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 80 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: `${tr.rePrefix}: ${clientName} – ${tr.assetAppraisal}`,
        }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 140 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: `Dear ${attentionName},` })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 100 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: `At your request, we have prepared an appraisal of certain equipment owned by ${ownerName}, a copy of which is enclosed. This appraisal report is intended for exclusive use by ${exclusiveUseBy} and is intended only for establishing values of the listed equipment.`,
        }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 120 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: isFMV
            ? "The subject assets were appraised under the premise of Fair Market Value for internal consideration."
            : tr.premiseSentence,
        }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 110 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: tr.approachesSentence })],
      keepLines: true,
      keepNext: true,
      spacing: { after: 110 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: isFMV
            ? "After a thorough analysis of the assets and information made available to us, it is our opinion that as of the Effective Date, these assets have a Fair Market Value in Canadian Funds as shown on the certificate that we have prepared."
            : tr.opinionSentence,
        }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 110 },
    })
  );

  // Add valuation methods paragraph if available
  const valuationData = reportData?.valuation_data;
  if (valuationData && Array.isArray(valuationData.methods) && valuationData.methods.length > 0) {
    const currency = reportData?.currency || "CAD";
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    };

    // Build comma-separated list of valuations
    const valuationParts: string[] = [];
    valuationData.methods.forEach((method: any, index: number) => {
      const methodName = method.fullName || method.method || "Unknown Method";
      const methodValue = formatCurrency(method.value || 0);
      valuationParts.push(`${methodName} ${tr.valuationAt} ${methodValue}`);
    });

    let valuationText = "";
    if (valuationParts.length === 1) {
      valuationText = `${tr.valuationSinglePrefix} ${valuationParts[0]}.`;
    } else if (valuationParts.length === 2) {
      valuationText = `${tr.valuationMultiplePrefix} ${valuationParts[0]} ${tr.valuationAnd} ${valuationParts[1]}.`;
    } else {
      const lastPart = valuationParts.pop();
      valuationText = `${tr.valuationMultiplePrefix} ${valuationParts.join(", ")}, ${tr.valuationAnd} ${lastPart}.`;
    }

    children.push(
      new Paragraph({
        style: "BodyLarge",
        children: [
          new TextRun({
            text: valuationText,
          }),
        ],
        keepLines: true,
        keepNext: true,
        spacing: { after: 110 },
      })
    );
  }
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: tr.certifySentence,
        }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 120 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: tr.contactSentence,
        }),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 140 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: tr.sincerely })],
      keepLines: true,
      keepNext: true,
      spacing: { before: 60, after: 120 },
    })
  );
  // Simple signature placeholders on the Transmittal Letter
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: "______________________________",
          color: "A3A3A3",
        }),
      ],
      spacing: { after: 20 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: tr.appraiserSignature || "Appraiser Signature",
          color: "6B7280",
        }),
      ],
      spacing: { after: 40 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({
          text: `${tr.dateLabel || "Date: "}${reportDate}`,
          color: "6B7280",
        }),
      ],
      spacing: { after: 100 },
    })
  );
  const appraiserLine = `${reportData?.appraiser || "Certified Appraiser"}`;
  const appraiserDesignation = [
    (reportData as any)?.appraiser_designations,
    (reportData as any)?.appraiser_credentials,
    (reportData as any)?.appraiser_letters,
  ]
    .filter((x) => typeof x === "string" && x.trim())
    .join(", ");
  const companyLine =
    `${reportData?.appraisal_company || "McDougall Auctioneers"}`
      .replace(/\bLtd\.?\b/gi, "")
      .trim() || "McDougall Auctioneers";
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [
        new TextRun({ text: appraiserLine }),
        ...(appraiserDesignation
          ? [new TextRun({ text: `, ${appraiserDesignation}` })]
          : []),
      ],
      keepLines: true,
      keepNext: true,
      spacing: { after: 80 },
    })
  );
  children.push(
    new Paragraph({
      style: "BodyLarge",
      children: [new TextRun({ text: companyLine, bold: true })],
    })
  );

  return children;
}
