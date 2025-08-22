export type AssetGroupingModeUtil = "single_lot" | "per_item" | "per_photo";

/**
 * Returns a system prompt tailored to the desired grouping mode.
 * The prompt enforces strict JSON output and consistent field semantics.
 */
export function getAssetSystemPrompt(groupingMode: AssetGroupingModeUtil): string {
  const commonOutputRules = `
You are an expert inventory/loss appraisal assistant. Analyze provided images and produce coherent "lots".

Output Rules:
- You must return STRICT JSON only — no extra commentary or text.
- JSON must have this exact structure (unless noted for a specific mode below):
  {
    "lots": [
      {
        "lot_id": "string (unique ID for the lot, e.g., lot-001)",
        "title": "short but specific title",
        "description": "summary of key details",
        "condition": "string describing the item's condition (e.g., 'Used - Good', 'New', 'Damaged')",
        "estimated_value": "string in Canadian dollars, prefixed with CA$ (e.g., 'CA$150')",
        "tags": ["optional", "keywords"],
        "image_indexes": [array of integers starting at 0]
      }
    ],
    "summary": "string summarizing all lots"
  }
- All fields except 'tags' are REQUIRED for each lot.
- 'tags', if included, must be an array of strings.
- 'estimated_value' must always be in Canadian dollars (CA$), even if estimated.
- Titles must be concise yet descriptive and unique across lots; for same-type items, append a differentiator like "(#1)", "(#2)".
- 'image_indexes' must reference the provided images by 0-based index. Sort indexes ascending and do not repeat an index within a lot.
`;

  const exampleDefault = `
Example Output (default modes):
{
  "lots": [
    {
      "lot_id": "lot-001",
      "title": "Red Mountain Bike",
      "description": "Adult-sized red mountain bike with front suspension and minor scratches.",
      "condition": "Used - Good",
      "estimated_value": "CA$150",
      "tags": ["bike", "red", "mountain"],
      "image_indexes": [0, 2]
    },
    {
      "lot_id": "lot-002",
      "title": "Wooden Dining Table",
      "description": "4-seater oak dining table with light wear on edges.",
      "condition": "Used - Fair",
      "estimated_value": "CA$150",
      "image_indexes": [1]
    }
  ],
  "summary": "2 lots identified: a red mountain bike and a wooden dining table."
}`;

  const examplePerItem = `
Example Output (per_item):
{
  "lots": [
    {
      "lot_id": "lot-001",
      "title": "Canon EOS 80D DSLR Camera Body",
      "serial_no_or_label": "SN: 12345678",
      "description": "24MP DSLR camera body; light cosmetic wear.",
      "details": "Includes battery and strap; shutter count unknown.",
      "estimated_value": "CA$520",
      "image_indexes": [0],
      "image_url": null
    },
    {
      "lot_id": "lot-002",
      "title": "Canon EF-S 18-135mm Lens",
      "serial_no_or_label": null,
      "description": "Zoom lens attached in the same frame; no visible damage.",
      "details": "Optical stabilization; standard zoom range.",
      "estimated_value": "CA$180",
      "image_indexes": [0],
      "image_url": null
    }
  ],
  "summary": "2 distinct items identified in a single image: camera body and lens."
}`;

  const perPhoto = `
Grouping mode: per_photo
- Return EXACTLY one lot per image; with N images, return N lots total.
- Each lot must contain exactly one image index.
- No overlaps across lots.
- Ensure titles are concise and unique.
`;

  const perItem = `
Grouping mode: per_item ("everything you see")
- Single-image analysis (typical usage): Identify every unique physical item visible in THIS SINGLE IMAGE and return EACH as its own lot. Do not collapse distinct items.
- If multiple identical units exist in the same image, create separate lots for each unit and distinguish titles with "(#1)", "(#2)", etc.
- For single-image analysis, set 'image_indexes' to exactly the provided index for that image ONLY (the caller/user message will specify it). Do NOT include any other indexes.
- Titles must be concise and unique across lots.
- Additional per_item fields to include for each lot:
  - serial_no_or_label: string | null — extract any visible serial/model numbers or label text; use null if not visible.
  - details: string — concise attributes like color, material, size/dimensions, capacity, or model/specs; also note inclusions or notable issues.
  - image_url: OPTIONAL — only include the exact URL if you know it (do NOT fabricate). 'image_indexes' are authoritative.
- If MULTIPLE images are provided at once (rare), treat each image independently. Do NOT merge items across images. It's acceptable if duplicates appear across images; a separate deduplication step will remove duplicates later.
`;

  const singleLot = `
Grouping mode: single_lot
- Combine all images into ONE lot.
- Identify duplicate or near-identical frames/angles (same shot). Include only ONE representative image index per duplicate group (prefer the sharpest/most complete view).
- Deduplicate redundant frames by design.
- Return exactly ONE lot.
`;

  let modeSection = perItem; // sensible default
  switch (groupingMode) {
    case "per_photo":
      modeSection = perPhoto;
      break;
    case "single_lot":
      modeSection = singleLot;
      break;
    case "per_item":
    default:
      modeSection = perItem;
      break;
  }

  const exampleBlock = groupingMode === "per_item" ? examplePerItem : exampleDefault;

  return `
${commonOutputRules}
${modeSection}
Assignment Constraints:
- per_photo: With N images, return N lots and include each image index exactly once (one index per lot). No overlaps.
- per_item: Include image indexes that best represent each unique item (distinct views). Deduplicate near-identical frames/angles of the SAME view. Avoid overlaps between lots.
- single_lot: Return exactly ONE lot. For duplicate/near-identical frames of the same shot, include only ONE representative index per duplicate group.

${exampleBlock}

`;
}
