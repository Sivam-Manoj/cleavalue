# DOCX Generation Service - Production Ready

## Overview
Clean, production-ready DOCX generation service that reliably merges documents in this order:
**Cover Page → Main Report → CV Divider → Appraiser CV**

## File: `server/src/service/assetDocxService.ts`

### Key Features
- ✅ **Always merges custom cover page** - No skip flags or fallbacks
- ✅ **Clean separation of concerns** - 4 helper functions, each with single responsibility
- ✅ **Reliable error handling** - Throws descriptive errors, no silent failures
- ✅ **Production logging** - Emoji-prefixed console logs for easy monitoring
- ✅ **Straightforward flow** - Linear execution, no complex conditionals

### Functions

#### `generateAssetDocxFromReport(reportData)`
Main entry point. Orchestrates the 4-step process:
1. Generate custom cover page from template
2. Generate main report content
3. Fetch appraiser CV (if available)
4. Merge all documents

#### `generateCoverPage(reportData)`
- Reads `public/coverPage.docx` template
- Uses docxtemplater to fill in: preparedFor, reportDate, userEmail
- Returns Buffer
- **Throws error** if template missing or render fails

#### `fetchAppraiserCV(cvUrl)`
- Fetches CV from S3/R2 URL
- 10-second timeout
- Returns Buffer or null (graceful failure)
- Logs warnings if CV unavailable

#### `mergeDocuments(coverBuffer, mainBuffer, cvBuffer)`
- Uses `docx-merger` package
- Converts Buffers to binary strings
- Adds "Appraiser CV" divider page before CV
- Returns merged Buffer
- **Throws error** if merge fails

#### `formatReportDate(date)`
- Utility to format dates for cover page
- Returns "Month Day, Year" format
- Fallback to ISO date if parsing fails

---

## File: `server/src/utils/imageProcessing.ts`

### Image Processing with Logo
**Function:** `processImageWithLogo(inputBuffer, logoPath, options)`

### Features
- ✅ **Resize to target dimensions** (default 1200x900, cover crop)
- ✅ **Add logo overlay** (bottom-right by default)
- ✅ **Smart logo sizing** (16% of image width by default)
- ✅ **Dynamic margins** (pixel + percentage based)
- ✅ **Quality optimization** (ramp down to meet size limit)
- ✅ **Jimp v1.x compatible** (uses modern API)

### Options
```typescript
{
  maxBytes: 1048576,        // 1MB default
  qualityStart: 82,         // Starting JPEG quality
  qualityMin: 50,           // Minimum quality before failing
  logoScale: 0.16,          // 16% of image width
  logoMarginPx: 12,         // Minimum margin in pixels
  logoMarginPct: 0.02,      // 2% of smaller dimension
  logoPosition: "bottom_right", // or "top_right"
  targetWidth: 1200,        // Output width
  targetHeight: 900         // Output height
}
```

### Usage in Asset Report Job
Located in `server/src/jobs/assetReportJob.ts` line 299-321:
- Processes each uploaded image
- Adds logo from `public/logoNobg.png`
- Ensures output ≤ 1MB
- Falls back to original image if processing fails
- **Now logs success/failure** for debugging

---

## Testing

### Test DOCX Generation
```bash
npm run test:docx
```

Expected console output:
```
✅ Custom cover page generated
📄 Merging: Cover -> Report -> CV Divider -> CV
✅ Documents merged successfully
```

### Test Logo Processing
Upload images via the web form and check server logs:
```
✅ Logo added to image 1/5
✅ Logo added to image 2/5
...
```

If logo fails:
```
⚠️  Logo processing failed for image 1, using original: [error details]
```

---

## Dependencies

### Required Packages
- `docx-merger@^1.2.2` - Document merging
- `docxtemplater@^3.67.1` - Template rendering
- `pizzip` - ZIP handling for DOCX
- `jimp@^1.6.0` - Image processing

### Files Required
- `public/coverPage.docx` - Cover page template
- `public/logoNobg.png` - Logo for image overlay

---

## Troubleshooting

### Logo Not Appearing on Images
1. Check server logs for `⚠️  Logo processing failed`
2. Verify `public/logoNobg.png` exists
3. Ensure Jimp is installed: `npm i jimp`
4. Check image format is supported (jpg, png, webp, etc.)

### Cover Page Not Merging
1. Check for `❌ Cover page generation failed`
2. Verify `public/coverPage.docx` exists
3. Ensure template has placeholders: `{preparedFor}`, `{reportDate}`, `{userEmail}`
4. Verify docxtemplater and pizzip are installed

### CV Not Appending
1. Check logs for `⚠️  Failed to fetch appraiser CV`
2. Verify user has uploaded CV in settings
3. Check CV URL is accessible
4. Ensure CV is valid .docx format

---

## Production Checklist

- ✅ No skip flags or environment variables
- ✅ Direct imports (no dynamic imports)
- ✅ Clear error messages
- ✅ Logging at each step
- ✅ Timeouts on external requests (CV fetch)
- ✅ Graceful fallbacks where appropriate
- ✅ TypeScript types for all parameters
- ✅ JSDoc comments on all functions
- ✅ No silent failures
- ✅ Production-ready error handling

---

## Code Quality

### Before (Problematic)
- Dynamic imports with complex fallbacks
- Skip flags and conditional logic
- Silent failures (catch blocks with only console.warn)
- Mixed concerns in single function
- Difficult to debug

### After (Production-Ready)
- Direct imports, no fallbacks
- Linear flow, no skip flags
- Explicit error throws
- Single responsibility per function
- Easy to debug with clear logs
- Clean, maintainable code

---

Generated: Oct 30, 2025
