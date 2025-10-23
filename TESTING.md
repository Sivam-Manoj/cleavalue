# Testing DOCX Generation

## Quick Test Command

To test DOCX generation with certificate and valuation table:

```bash
cd server
npm run test:docx
```

This command:
- ✅ **No build required** - runs directly with ts-node
- ✅ Generates 3 sample reports in `./reports` directory
- ✅ Tests certificate page with proper dimensions
- ✅ Tests valuation comparison table (FML, OLV, FLV)
- ✅ Tests all DOCX sections

## Alternative Commands

### Production Build Test
```bash
npm run sample:docx
```
Builds the project first, then generates samples.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run test:docx` | **Fast** - Generate sample DOCX without build |
| `npm run sample:docx` | Generate sample DOCX with production build |
| `npm run dev` | Start development server with nodemon |
| `npm run build` | Build TypeScript to JavaScript |

## Generated Reports

The script creates 3 sample reports:

1. **Asset Report** (`sample-asset-*.docx`)
   - Certificate of Appraisal (centered, proper A4 size)
   - Valuation Comparison Table with AI explanations
   - Transmittal Letter
   - Table of Contents
   - Report sections

2. **Catalogue Report** (`sample-catalogue-*.docx`)
   - Grouped items with images
   - All standard sections

3. **Per-Item Report** (`sample-per_item-*.docx`)
   - Individual item listings
   - All standard sections

## Output Location

```
server/
  reports/
    sample-asset-2025-10-23T12-30-00-000Z.docx
    sample-catalogue-2025-10-23T12-30-00-000Z.docx
    sample-per_item-2025-10-23T12-30-00-000Z.docx
```

## What Gets Tested

- ✅ Certificate page (794×1123px, no blank space)
- ✅ Valuation comparison table (multiple methods)
- ✅ AI-generated valuation explanations
- ✅ Cover page design
- ✅ Transmittal letter
- ✅ Table of contents
- ✅ Footer on all pages
- ✅ Image embedding
- ✅ All DOCX formatting

## Troubleshooting

### "Cannot find module"
Make sure you're in the server directory:
```bash
cd server
npm install
```

### Puppeteer issues
If certificate generation fails, check Puppeteer installation:
```bash
npm install puppeteer --force
```

### No images in report
Make sure `public/icon.png` exists, or the script will generate text-only reports.
