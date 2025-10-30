# Quick Start - Logo Testing

## 🚀 Test Logo Processing

Run this command to verify logo processing works:

```bash
npm run test:image
```

### What it does:
1. Takes `public/logo.jpg` as input
2. Adds `public/logoNobg.png` logo in **bottom-right corner**
3. Resizes to 1200x900 pixels
4. Saves to `test-outputs/test-logo-[timestamp].jpg`

### Expected Result:
```
✅ Processing complete in 150ms
💾 Output saved to: test-outputs/test-logo-2025-10-30T10-30-15.jpg
✅ Test completed successfully!
```

**Open the output file** to visually verify the logo appears in the bottom-right corner.

---

## 🔍 Verify Production Flow

### Step 1: Upload Images via Web Form
Upload 2-3 test images through the web application.

### Step 2: Check Server Logs
You should see:
```
✅ Logo added to image 1/3
✅ Logo added to image 2/3
✅ Logo added to image 3/3
```

**If you see warnings:**
```
⚠️  Logo processing failed for image 1, using original: [error details]
```
This means logo processing failed. Check:
- `public/logoNobg.png` exists
- Image format is supported (jpg, png, webp)
- No memory/permission issues

### Step 3: Verify Uploaded Images
1. Copy an image URL from the logs (e.g., `https://images.sellsnap.store/uploads/asset/...`)
2. Open it in your browser
3. **Logo should be visible in bottom-right corner** ✅

### Step 4: Download and Check ZIP
1. Complete report generation
2. Download `images.zip`
3. Extract and open images
4. **All images should have logos** ✅

---

## ✅ Success Indicators

Everything is working when:
- ✅ `npm run test:image` succeeds
- ✅ Test output image has logo in `test-outputs/`
- ✅ Server logs show "Logo added" for each image
- ✅ Uploaded images have logos when viewed via URL
- ✅ ZIP contains images with logos
- ✅ All images are 1200x900 and under 1MB

---

## ❌ If Logos Are Missing

### Problem: Test fails with error
**Solution:** Check `public/logoNobg.png` exists and is valid PNG

### Problem: Test succeeds but production fails
**Solution:** Check server logs for "Logo processing failed" warnings

### Problem: Logos appear on direct URLs but not in ZIP
**Solution:** This shouldn't happen! The ZIP downloads from the same URLs.
Verify by:
1. Check `allUrls` in logs contains processed URLs
2. Manually download an image from one of those URLs
3. If it has a logo, the ZIP should too

---

## 📝 Commands

```bash
# Test logo processing
npm run test:image

# Test DOCX generation
npm run test:docx

# Build for production
npm run build

# Start server
npm run dev
```

---

## 📁 Key Files

- **Logo file:** `public/logoNobg.png`
- **Test input:** `public/logo.jpg`
- **Test output:** `test-outputs/test-logo-*.jpg`
- **Processing code:** `src/utils/imageProcessing.ts`
- **Upload code:** `src/jobs/assetReportJob.ts` (line 299-321)
- **ZIP code:** `src/jobs/assetReportJob.ts` (line 1674)

---

Generated: Oct 30, 2025
