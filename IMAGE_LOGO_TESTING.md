# Image Logo Processing - Testing Guide

## Overview
Images uploaded for asset reports are automatically processed to:
- Add company logo in bottom-right corner
- Resize to 1200x900 pixels
- Optimize to ≤1MB file size
- Convert to JPEG format

## Flow Diagram
```
User Upload → Process with Logo → Upload to R2 → Store URL → Download for ZIP
                                      ↓
                              (Logo included here)
```

## Test Logo Processing

### Quick Test
Test the logo processing with a sample image:

```bash
npm run test:image
```

**What this does:**
1. Reads `public/logo.jpg` as test input
2. Adds `public/logoNobg.png` as logo overlay
3. Resizes to 1200x900
4. Saves output to `test-outputs/test-logo-[timestamp].jpg`

**Expected output:**
```
🧪 Testing Image Processing with Logo...

📁 Input image: C:\...\server\public\logo.jpg
🏷️  Logo path: C:\...\server\public\logoNobg.png
✅ Input image exists
✅ Logo exists

📖 Reading input image...
   Original size: 48.44 KB

🎨 Processing image with logo...
   Options:
   - Target: 1200x900
   - Logo position: bottom_right
   - Logo scale: 16% of width
   - Max size: 1MB
   - Quality: 82 (start), 50 (min)

✅ Processing complete in 123ms
   Output size: 245.67 KB
   Format: jpeg
   Size reduction: 15.3%

💾 Output saved to: test-outputs/test-logo-2025-10-30T10-30-00.jpg

✅ Test completed successfully!

📸 Open the output file to verify the logo appears in the bottom-right corner.
```

### Visual Verification
1. Navigate to `test-outputs/` folder
2. Open the generated `test-logo-*.jpg` file
3. Verify the logo appears in the **bottom-right corner**
4. Check image is 1200x900 pixels
5. Verify file size is under 1MB

---

## Production Flow

### 1. Image Upload (Line 278-334)
When users upload images:

```typescript
// For each image:
const { buffer } = await processImageWithLogo(
  inputBuffer,
  "public/logoNobg.png",
  { maxBytes: 1024 * 1024 }
);

// Upload processed image to R2
await uploadBufferToR2(buffer, "image/jpeg", bucket, fileName);

// Store URL
imageUrls.push(url); // ← This URL points to image WITH logo
```

### 2. ZIP Generation (Line 121)
When creating the images.zip:

```typescript
const imagesZip = await generateImagesZip(allUrls, renameMap);
```

This function:
1. Downloads images from URLs in `allUrls`
2. These URLs were created in step 1 (WITH logos)
3. Adds them to ZIP with renamed filenames

**Result:** ZIP contains processed images with logos ✅

---

## Troubleshooting

### Logo Not Appearing

#### Check 1: Logo File Exists
```bash
ls public/logoNobg.png
```
Expected: File exists (~64KB PNG with transparent background)

#### Check 2: Test Processing
```bash
npm run test:image
```
- If this fails → Logo processing has an issue
- If this succeeds → Issue is elsewhere in the flow

#### Check 3: Server Logs
When uploading images, look for:
```
✅ Logo added to image 1/5
✅ Logo added to image 2/5
```

If you see:
```
⚠️  Logo processing failed for image 1, using original: [error]
```
This indicates logo processing failed. Common causes:
- `public/logoNobg.png` missing or corrupted
- Input image format not supported by Jimp
- Memory issues (very large images)

#### Check 4: Verify Uploaded Images
1. Upload test image via web form
2. Check server logs for the R2 URL
3. Open the URL directly in browser
4. Logo should be visible in bottom-right

#### Check 5: Verify ZIP Contents
1. Complete a full report generation
2. Download the images.zip
3. Extract and open images
4. Logo should be visible on ALL images

---

## Configuration

Logo processing options (in `assetReportJob.ts` line 299):

```typescript
const options = {
  maxBytes: 1024 * 1024,     // 1MB max file size
  qualityStart: 82,          // Starting JPEG quality
  qualityMin: 50,            // Minimum quality (stops reducing here)
  logoScale: 0.16,           // Logo is 16% of image width
  logoMarginPx: 12,          // Min margin in pixels
  logoMarginPct: 0.02,       // 2% margin of smaller dimension
  logoPosition: "bottom_right", // Logo position
  targetWidth: 1200,         // Output width
  targetHeight: 900          // Output height
};
```

### To Change Logo Position
Change `logoPosition` to:
- `"bottom_right"` (default)
- `"top_right"`

### To Change Logo Size
Adjust `logoScale`:
- `0.16` = 16% of image width (default)
- `0.12` = 12% (smaller)
- `0.20` = 20% (larger)

---

## Files

### Logo Processing
- **Code:** `server/src/utils/imageProcessing.ts`
- **Used by:** `server/src/jobs/assetReportJob.ts`
- **Logo file:** `server/public/logoNobg.png`
- **Test script:** `server/src/scripts/testImageProcessing.ts`

### ZIP Generation
- **Code:** `server/src/jobs/assetReportJob.ts` (line 1674)
- **Function:** `generateImagesZip(imageUrls, renameMap)`
- **Downloads from:** URLs stored in `imageUrls` array

---

## FAQ

### Q: Why are logos missing in the ZIP?
**A:** If logos appear in uploaded images but not in ZIP:
1. Check if `allUrls` in `generateImagesZip` points to processed images
2. Verify logs show "✅ Logo added to image X/Y"
3. Test with `npm run test:image` to verify processing works

### Q: Logo is too big/small
**A:** Adjust `logoScale` in `assetReportJob.ts` line 302:
```typescript
logoScale: 0.12  // 12% instead of 16%
```

### Q: Logo is in wrong position
**A:** Change `logoPosition` in options:
```typescript
logoPosition: "top_right"  // Instead of bottom_right
```

### Q: Images are too large
**A:** Reduce `maxBytes` or `qualityStart`:
```typescript
maxBytes: 512 * 1024,  // 512KB instead of 1MB
qualityStart: 75,      // Lower starting quality
```

---

## Success Checklist

When everything works correctly:

- ✅ `npm run test:image` succeeds
- ✅ Output image in `test-outputs/` has logo in bottom-right
- ✅ Server logs show "✅ Logo added to image X/Y"
- ✅ Uploaded images have logo when viewed directly via URL
- ✅ Downloaded ZIP contains images with logos
- ✅ DOCX report includes images with logos
- ✅ All images are 1200x900 pixels
- ✅ All images are under 1MB

---

Generated: Oct 30, 2025
