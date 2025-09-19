export type AssetGroupingModeUtil =
  | "single_lot"
  | "per_item"
  | "per_photo"
  | "catalogue";

/**
 * Returns a system prompt tailored to the desired grouping mode.
 * The prompt enforces strict JSON output and consistent field semantics.
 */
export function getAssetSystemPrompt(
  groupingMode: AssetGroupingModeUtil
): string {
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

VIN and Serial Handling:
- Keep all serial numbers and VINs OUTSIDE of the description. Use 'serial_no_or_label' (per_item, per_photo, single_lot) or 'sn_vin' (catalogue items).
- When a VIN is visible, label it EXACTLY as: "VIN: <VIN>" (17 characters, no I/O/Q). If characters are missing (partial VIN), you may use '*' placeholders for unknown characters.
- If a VIN is not visible or unknown: per_item/per_photo/single_lot -> use null in 'serial_no_or_label'; catalogue items -> set 'sn_vin' to the literal text "not found".
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

  const vehicleAttributeFieldList = `
Field Label,Section,Section Order,
"Year, Auto Lube:",Identification,0,
Certification Number:,Identification,0,
FEL/Serial Number:,Identification,0,
Inspection:,Identification,0,
Log Book:,Identification,0,
Make/Model/Cap Ball:,Identification,0,
Make/Model/Cap Block:,Identification,0,
Model:,Identification,0,
Serial Number:,Identification,0,
Airlift Axles:,Powertrain & Performance,1,
Axle Cap:,Powertrain & Performance,1,
Axle Capacity:,Powertrain & Performance,1,
Axle Configuration:,Powertrain & Performance,1,
Axle Type:,Powertrain & Performance,1,
Axles:,Powertrain & Performance,1,
Capacity/Axle:,Powertrain & Performance,1,
Direct Drive:,Powertrain & Performance,1,
Drive Over Fenders:,Powertrain & Performance,1,
Drive Type:,Powertrain & Performance,1,
Engine Brake:,Powertrain & Performance,1,
Engine Hours:,Powertrain & Performance,1,
Engine/HP:,Powertrain & Performance,1,
Engine:,Powertrain & Performance,1,
Extendable Axles:,Powertrain & Performance,1,
Fast Fuel:,Powertrain & Performance,1,
Fuel Tank:,Powertrain & Performance,1,
Fuel Type:,Powertrain & Performance,1,
HP:,Powertrain & Performance,1,
Hours Meter:,Powertrain & Performance,1,
Hours:,Powertrain & Performance,1,
Hydraulic Axle Adjust:,Powertrain & Performance,1,
Hydraulic Drive:,Powertrain & Performance,1,
Hydraulic Knife Drive:,Powertrain & Performance,1,
KVA:,Powertrain & Performance,1,
KW:,Powertrain & Performance,1,
Mileage:,Powertrain & Performance,1,
Motor/HP:,Powertrain & Performance,1,
Oscillating Axle:,Powertrain & Performance,1,
PTO:,Powertrain & Performance,1,
Powered Rear Axle:,Powertrain & Performance,1,
Rear Axle Cap:,Powertrain & Performance,1,
Run Hours:,Powertrain & Performance,1,
Thresh Hours:,Powertrain & Performance,1,
Transmission Speed:,Powertrain & Performance,1,
Transmission/Speed:,Powertrain & Performance,1,
Transmission:,Powertrain & Performance,1,
V-Drive:,Powertrain & Performance,1,
Voltage:,Powertrain & Performance,1,
Additional Counter Weights:,Dimensions & Capacity,2,
Auger Size:,Dimensions & Capacity,2,
Auger Type:,Dimensions & Capacity,2,
Bin Lid Closer:,Dimensions & Capacity,2,
Blade Size:,Dimensions & Capacity,2,
Blade Type:,Dimensions & Capacity,2,
Blade Width:,Dimensions & Capacity,2,
Boom Configuration:,Dimensions & Capacity,2,
Boom Length:,Dimensions & Capacity,2,
Boom Width:,Dimensions & Capacity,2,
Bucket Type/Size:,Dimensions & Capacity,2,
Capacity:,Dimensions & Capacity,2,
Chaffe Chopper/Spreader:,Dimensions & Capacity,2,
Chem Mix Tank:,Dimensions & Capacity,2,
Cross Auger:,Dimensions & Capacity,2,
DF Tank:,Dimensions & Capacity,2,
Dimensions of Screen:,Dimensions & Capacity,2,
Dimensions:,Dimensions & Capacity,2,
Discharge Auger:,Dimensions & Capacity,2,
Drum Size:,Dimensions & Capacity,2,
Drum Thickness:,Dimensions & Capacity,2,
Forks:,Dimensions & Capacity,2,
GVWR:,Dimensions & Capacity,2,
Hopper Extension:,Dimensions & Capacity,2,
Hopper Size:,Dimensions & Capacity,2,
Hopper Type:,Dimensions & Capacity,2,
Hot Water Tank:,Dimensions & Capacity,2,
Hydraulic Fork Positioner:,Dimensions & Capacity,2,
Hydraulic Unload:,Dimensions & Capacity,2,
Infeed Capacity:,Dimensions & Capacity,2,
Jib Length:,Dimensions & Capacity,2,
Length:,Dimensions & Capacity,2,
Load Auger:,Dimensions & Capacity,2,
Loading Lights:,Dimensions & Capacity,2,
Max Height:,Dimensions & Capacity,2,
Max Reach:,Dimensions & Capacity,2,
Neck Dimension:,Dimensions & Capacity,2,
Onboard Water Tank:,Dimensions & Capacity,2,
Paving Width:,Dimensions & Capacity,2,
Q/A Bucket:,Dimensions & Capacity,2,
Reach:,Dimensions & Capacity,2,
Rear Weights:,Dimensions & Capacity,2,
Rinse Tank:,Dimensions & Capacity,2,
Rod Loader:,Dimensions & Capacity,2,
Size of Boom:,Dimensions & Capacity,2,
Size/Type of Blades:,Dimensions & Capacity,2,
Smooth Drum:,Dimensions & Capacity,2,
Spray Bar/Width:,Dimensions & Capacity,2,
Stick Dimensions:,Dimensions & Capacity,2,
Tank Cpacity:,Dimensions & Capacity,2,
Tank Monitor:,Dimensions & Capacity,2,
Tank Size/Type:,Dimensions & Capacity,2,
Tank Size:,Dimensions & Capacity,2,
Tank Type:,Dimensions & Capacity,2,
Track Length:,Dimensions & Capacity,2,
Track Width:,Dimensions & Capacity,2,
Type/Size of Bucket:,Dimensions & Capacity,2,
Weights:,Dimensions & Capacity,2,
Wheel Base:,Dimensions & Capacity,2,
Width Min/Max:,Dimensions & Capacity,2,
Width of Basket:,Dimensions & Capacity,2,
Width:,Dimensions & Capacity,2,
Working Deck Dimensions:,Dimensions & Capacity,2,
A/C Seats:,Features & Options,3,
A/C Units:,Features & Options,3,
A/C:,Features & Options,3,
A/R Cab:,Features & Options,3,
A/R Suspension:,Features & Options,3,
Air Suspension:,Features & Options,3,
Auto 4WD:,Features & Options,3,
Auto Level:,Features & Options,3,
Autofloat:,Features & Options,3,
Aux Hydraulics:,Features & Options,3,
Auxillary Hydraulics:,Features & Options,3,
Blockage Monitor:,Features & Options,3,
Cab Camera's:,Features & Options,3,
Cab Package:,Features & Options,3,
Control Panel:,Features & Options,3,
Crown Control:,Features & Options,3,
Display:,Features & Options,3,
Enclosed Cab:,Features & Options,3,
Exterior Camera:,Features & Options,3,
Fender Controls:,Features & Options,3,
Front Auxillary Hydraulics:,Features & Options,3,
GPS Activation:,Features & Options,3,
GPS Display:,Features & Options,3,
GPS:,Features & Options,3,
Grade Control:,Features & Options,3,
Grade Controls:,Features & Options,3,
Heated Box:,Features & Options,3,
Heated Grips:,Features & Options,3,
Heated Seats:,Features & Options,3,
Heated Steering Wheel:,Features & Options,3,
Heated:,Features & Options,3,
High Rise Cab:,Features & Options,3,
Hydraulic Adjust Screed:,Features & Options,3,
Hydraulic Bag Lift:,Features & Options,3,
Hydraulic Ejector:,Features & Options,3,
Hydraulic F&A:,Features & Options,3,
Hydraulic Fan:,Features & Options,3,
Hydraulic Grapple:,Features & Options,3,
Hydraulic Levelling:,Features & Options,3,
Hydraulic Lift:,Features & Options,3,
Hydraulic Outlets:,Features & Options,3,
Hydraulic Outriggers:,Features & Options,3,
Hydraulic P/U:,Features & Options,3,
Hydraulic Power:,Features & Options,3,
Hydraulic Q/A:,Features & Options,3,
Hydraulic Rotation:,Features & Options,3,
Hydraulic Side Shift:,Features & Options,3,
Hydraulic Swing:,Features & Options,3,
Hydraulic Tensioner:,Features & Options,3,
Hydraulic Tilt:,Features & Options,3,
Hydraulic Wing Lift:,Features & Options,3,
Keyless Entry:,Features & Options,3,
Lighting Package:,Features & Options,3,
Lighting:,Features & Options,3,
Monitor:,Features & Options,3,
Operator Controls:,Features & Options,3,
Power Locks:,Features & Options,3,
Power Mirrors:,Features & Options,3,
Power Pedals:,Features & Options,3,
Power Seats:,Features & Options,3,
Power Windows:,Features & Options,3,
Powered By:,Features & Options,3,
Q/A Front Attachment:,Features & Options,3,
Q/A:,Features & Options,3,
Radio:,Features & Options,3,
Rear Cameras:,Features & Options,3,
Rear View Camera:,Features & Options,3,
Rear/Side Camera:,Features & Options,3,
Rearview Camera:,Features & Options,3,
Receiver:,Features & Options,3,
Remote Control Cutter:,Features & Options,3,
Remote Control:,Features & Options,3,
Remote Start:,Features & Options,3,
Remote:,Features & Options,3,
Seat:,Features & Options,3,
Sectional Control:,Features & Options,3,
Shaft Monitor:,Features & Options,3,
Slope Control:,Features & Options,3,
Stereo:,Features & Options,3,
Suspension:,Features & Options,3,
Traction Control:,Features & Options,3,
Yield & Moisture Monitor:,Features & Options,3,
Current CVIP:,Condition & Maintenance,4,
Damages:,Condition & Maintenance,4,
Foam Filled Tires:,Condition & Maintenance,4,
Keys:,Condition & Maintenance,4,
Other Description:,Condition & Maintenance,4,
Other Details:,Condition & Maintenance,4,
Requires CVIP:,Condition & Maintenance,4,
Service Manual:,Condition & Maintenance,4,
Tire Size:,Condition & Maintenance,4,
Tires:,Condition & Maintenance,4,
Tracks:,Condition & Maintenance,4,
Dealer Consignment:,Additional Notes,5,
Description:,Additional Notes,5,
Details:,Additional Notes,5,
Fits:,Additional Notes,5,
Repo Piece:,Additional Notes,5,
1 Phase:,Uncategorized,6,
3 Phase:,Uncategorized,6,
3PH:,Uncategorized,6,
4WD:,Uncategorized,6,
4x4:,Uncategorized,6,
Accumulator:,Uncategorized,6,
Adapter Type:,Uncategorized,6,
Adjustable 5th Wheel:,Uncategorized,6,
Adjustable Discharge:,Uncategorized,6,
Adjustable Wings:,Uncategorized,6,
Air Brakes:,Uncategorized,6,
Air Reel:,Uncategorized,6,
Air Weigh Gauges:,Uncategorized,6,
Air:,Uncategorized,6,
Aluminum Rims:,Uncategorized,6,
Aluminum Slopes:,Uncategorized,6,
Anti Two Block:,Uncategorized,6,
Aux Wich:,Uncategorized,6,
Awning/Size:,Uncategorized,6,
Awning:,Uncategorized,6,
Bag Carrier:,Uncategorized,6,
Barn Door:,Uncategorized,6,
Bath:,Uncategorized,6,
Beater:,Uncategorized,6,
Box:,Uncategorized,6,
Breakaway Torque Limiter:,Uncategorized,6,
Bush Guard:,Uncategorized,6,
Bush Guards:,Uncategorized,6,
Bushel Per Hr +/-:,Uncategorized,6,
CVIP Sticker:,Uncategorized,6,
Canopy:,Uncategorized,6,
Carrier:,Uncategorized,6,
Charger:,Uncategorized,6,
Chutes:,Uncategorized,6,
Clutches:,Uncategorized,6,
Color:,Uncategorized,6,
Compartments:,Uncategorized,6,
Cover:,Uncategorized,6,
Cruise:,Uncategorized,6,
DVD Player:,Uncategorized,6,
Dbl Swath:,Uncategorized,6,
Diameter:,Uncategorized,6,
Diff Lock:,Uncategorized,6,
Differential Steering:,Uncategorized,6,
Digital Scale:,Uncategorized,6,
Discharge:,Uncategorized,6,
Distributer:,Uncategorized,6,
Dividers:,Uncategorized,6,
Doors:,Uncategorized,6,
Double Frame:,Uncategorized,6,
Dozer Type:,Uncategorized,6,
Draw Bar:,Uncategorized,6,
Drill Stem:,Uncategorized,6,
Dryer Type:,Uncategorized,6,
Dual Joystick:,Uncategorized,6,
Elect Start:,Uncategorized,6,
Electric Start:,Uncategorized,6,
Emergency Steer:,Uncategorized,6,
Emergency Stops:,Uncategorized,6,
Extendahoe:,Uncategorized,6,
Extensions:,Uncategorized,6,
Fan:,Uncategorized,6,
Feed Storage:,Uncategorized,6,
Feederhouse Tilt:,Uncategorized,6,
Fin Thickness:,Uncategorized,6,
Fire Suppression:,Uncategorized,6,
Flare Tub:,Uncategorized,6,
Fleet Vehicle:,Uncategorized,6,
Floating Hitch:,Uncategorized,6,
Floats:,Uncategorized,6,
Floor Type:,Uncategorized,6,
Foam Filled:,Uncategorized,6,
Frame:,Uncategorized,6,
Fridge:,Uncategorized,6,
Front Attachment Type/Size:,Uncategorized,6,
Front Attachment:,Uncategorized,6,
Furnace:,Uncategorized,6,
GWR:,Uncategorized,6,
Generator:,Uncategorized,6,
Guage Wheels:,Uncategorized,6,
Hammer Mill:,Uncategorized,6,
Hand Warmers:,Uncategorized,6,
Heat:,Uncategorized,6,
Heater:,Uncategorized,6,
High Flow:,Uncategorized,6,
Hitch Type/Size:,Uncategorized,6,
Hitch Type:,Uncategorized,6,
Hitch:,Uncategorized,6,
Holding:,Uncategorized,6,
Hour Meter:,Uncategorized,6,
Inboard:
Outboard:
Ski Pole:
Tower:
V-Drive:
Wedge: A/R Cab:
Wheel Base:
`;

  const catalogue = `
  Grouping mode: catalogue (sales catalogue style)
  - Treat the provided images as one catalogue lot segment. Return exactly ONE lot that summarizes the set of images and also includes an 'items' array.
  - Only include items that are fully visible in the images; do not include items that are partially visible or not visible.
  - Each item represents a distinct saleable item within the lot segment.
  - Identify EVERY distinct saleable item visible across ALL provided images for this segment. Do NOT omit any item. If uncertain, include the item and note uncertainty in 'details'.
  - Lot-level fields: lot_id, title, description, condition, estimated_value, tags?, image_indexes (0-based indexes of the images for this lot).
  - REQUIRED item fields (table row fields):
    - title: concise and specific. For vehicles, use: "YYYY Make Model Trim" (e.g., "2018 Honda Civic EX-L").
    - sn_vin: string. When a VIN is visible, label it EXACTLY as "VIN: <VIN>" (17 characters; use '*' for any unknown characters in a partial VIN). If VIN not visible or unknown, set to the literal text "not found".
    - description: short description of the item using the vehicle attribute order below — order by Section Order ascending and within each section keep the exact label order. Output only labels and values (no section headers).
    - condition: string describing the item's condition with clear explanation of how you determined it.
    - estimated_value: string in Canadian dollars, prefixed with CA$, e.g., "CA$12,500".
    - image_local_index: integer (0-based) referencing the SINGLE best image among the provided images for this catalogue segment that most clearly shows this item. Always include this. If unsure, pick the clearest view.
    - image_url: OPTIONAL direct URL for that image if and only if it is explicitly provided to you (do not fabricate). Base64 inputs will not have URLs.
  - OPTIONAL item fields:
    - details: compact attributes (e.g., Mileage, Transmission, Drivetrain, Extras like winter tires). Do not duplicate the price/value here; that belongs in 'estimated_value'.
  - Additional guidance:
  - Titles must be concise and attention-grabbing; avoid repetition across items in the same lot.
  - If an item appears in multiple frames, do not duplicate the item; list it once.
  - Item description formatting (for each item.description):
    - Start with YEAR MAKE MODEL [TRIM/TYPE], followed by concise attributes separated by commas.
    - Extract as many of the following attribute labels as are clearly visible; do NOT fabricate; omit unknowns. Keep serial/VIN in 'sn_vin' and do not repeat it in the description.
    - If the item is a VEHICLE, strictly follow the vehicle attribute order below — order by Section Order ascending and within each section keep the exact label order. Output only labels and values (no section headers):
    - ${vehicleAttributeFieldList}
    - For non-vehicle items, use the general attributes:
  - Keep all output strictly valid JSON.
`;

  const exampleCatalogue = `
  Example Output (catalogue):
  {
    "lots": [
      {
        "lot_id": "lot-101",
        "title": "Vehicle Listings — Two Sedans",
        "description": "Two compact sedans with clean interiors; light exterior wear noted.",
        "condition": "Mixed — Used",
        "estimated_value": "CA$23,500",
        "tags": ["vehicles", "sedans"],
        "image_indexes": [0,1,2,3],
        "items": [
          {
            "title": "2018 Honda Civic EX-L",
            "sn_vin": "2HGFC1F97JH012345",
            "description": "White exterior, black leather; clean interior.",
            "condition": "Used - Good",
            "details": "Mileage: 82,000 km; Transmission: Automatic; Drivetrain: FWD; Extras: winter tires included",
            "estimated_value": "CA$12,500",
            "image_local_index": 1
          },
          {
            "title": "2017 Toyota Corolla LE",
            "sn_vin": "not found",
            "description": "Silver exterior; minor scuffs on rear bumper.",
            "condition": "Used - Fair",
            "details": "Mileage: 95,500 km; Transmission: Automatic; Drivetrain: FWD",
            "estimated_value": "CA$11,000",
            "image_local_index": 2
          }
        ]
      }
    ],
    "summary": "Catalogue lot with 2 vehicles identified from 4 images."
  };
`;

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
  };
`;

  const perPhoto = `
Grouping mode: per_photo
- Return EXACTLY one lot per image; with N images, return N lots total.
- Each lot must contain exactly one image index.
- No overlaps across lots.
- Ensure titles are concise and unique.
 - Description formatting for each lot:
   - Start with YEAR MAKE MODEL [TRIM/TYPE], followed by concise attributes separated by commas.
   - Extract only what is clearly visible; do NOT fabricate. Omit unknowns. Keep serial/VIN outside the description.
   - If the item is a VEHICLE, strictly follow the vehicle attribute order below — order by Section Order ascending and within each section keep the exact label order. Output only labels and values (no section headers):
   - ${vehicleAttributeFieldList}
   - For non-vehicle items, use the general attributes:
 - Additional per_photo fields to include for each lot:\n   - serial_no_or_label: string | null — extract any visible serial/model numbers or label text. When a VIN is visible, include it labeled EXACTLY as "VIN: <VIN>" (use '*' for unknown characters in a partial VIN). Use null if nothing is visible.

`;

  const perItem = `
Grouping mode: per_item ("everything you see")
- Single-image analysis (typical usage): Identify EVERY unique physical item visible in THIS SINGLE IMAGE and return EACH as its own lot. Do NOT omit any single item. Do not collapse distinct items.
- If multiple identical units exist in the same image, create separate lots for each unit and distinguish titles with "(#1)", "(#2)", etc.
- For single-image analysis, set 'image_indexes' to exactly the provided index for that image ONLY (the caller/user message will specify it). Do NOT include any other indexes.
- Titles must be concise and unique across lots.
 - Description formatting for each lot:
   - Each description MUST start with YEAR MAKE MODEL [TRIM/TYPE], followed by concise attributes separated by commas.
   - Extract only what is clearly visible; do NOT fabricate. Omit unknowns. Keep serial/VIN outside the description (use 'serial_no_or_label' for that).
   - If the item is a VEHICLE, strictly follow the vehicle attribute order below — order by Section Order ascending and within each section keep the exact label order. Output only labels and values (no section headers):
   - ${vehicleAttributeFieldList}
   - For non-vehicle items, use the general attributes:
- Additional per_item fields to include for each lot:
  - serial_no_or_label: string | null — extract any visible serial/model numbers or label text. When a VIN is visible, include it labeled EXACTLY as "VIN: <VIN>" (17 characters; use '*' for any unknown characters in a partial VIN). Use null if not visible. For partial VINs, include the visible characters and '*' placeholders where unknown.
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
- Description formatting for the lot:
  - Create a numbered list where each line describes one distinct item identified in the lot.
  - Each line MUST start with YEAR MAKE MODEL [TRIM/TYPE], followed by concise attributes separated by commas.
  - Extract only what is clearly visible from images; do NOT fabricate. If unknown, omit. Keep serial/VIN outside the description.
  - If the item is a VEHICLE, strictly follow the vehicle attribute order below — order by Section Order ascending and within each section keep the exact label order. Output only labels and values (no section headers):
  - ${vehicleAttributeFieldList}
  - For non-vehicle items, use the general attributes:
 - Optional additional field at lot level:\n   - serial_no_or_label: string | null — if one or more serials/VINs are clearly visible for the primary subject(s), include them. When a VIN is visible, label it EXACTLY as "VIN: <VIN>" (use '*' for partial VINs). For multiple items, separate entries with "; ". Use null if nothing is visible.
  - Example numbered lines:
    1. 2002 Kenworth T800 T/A Truck Tractor, CAT C15 475 HP Diesel Engine, 18 Spd Trans, A/R Susp., WetKit, Sliding 5th Wheel, 16,000 lb Front, 46,000 lb Rear, Aluminum Wheels, Front Tires 385/65R22.5, Rear Tires 11R24.5, New CVI
    2. 2004 Kenworth T800 T/A Truck Tractor, CAT C15 Diesel Engine, 18 Spd Trans, 16,000 lb / 46,000 lb Front/Rears, A/R Susp., Alum Headache Rack, Sliding 5th Wheel, Aluminum Wheels, Front Tires 315/80R22.5, Rear 11R24.5, New CVI
    3. 2006 Kenworth T800 T/A Fuel Truck, CAT C11 Diesel Engine, 13 Spd Trans, Chalmers Susp., Advanced 2 Compartment Steel Tank, 2,273 L & 13,683 L, (2) MID Com Pumps, Hoses, & Reels, PTO, Aluminum Wheels, Front Tires 385/65R22.5, Rear Tires 11R24.5, New CVI
`;

  let modeSection = perItem; // sensible default
  switch (groupingMode) {
    case "per_photo":
      modeSection = perPhoto;
      break;
    case "single_lot":
      modeSection = singleLot;
      break;
    case "catalogue":
      modeSection = catalogue;
      break;
    case "per_item":
    default:
      modeSection = perItem;
      break;
  }

  const exampleBlock =
    groupingMode === "per_item"
      ? examplePerItem
      : groupingMode === "catalogue"
        ? exampleCatalogue
        : exampleDefault;

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
