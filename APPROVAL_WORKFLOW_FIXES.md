# Approval Workflow Fixes

## Issues Fixed

### 1. ✅ Reports Show in Approvals Before Files Are Ready
**Problem:** When users submitted a preview, it immediately appeared in admin approvals, but the files (DOCX, XLSX, ZIP) were still being generated in the background.

**Solution:**
- Changed initial status from `'pending_approval'` to `'preview'` in `asset.controller.ts`
- Status is now changed to `'pending_approval'` AFTER files are created in `runPreviewFilesJob`

**Files Changed:**
- `server/src/controller/asset.controller.ts` (line 233)
- `server/src/jobs/assetReportJob.ts` (line 154-159)

**Flow:**
```
User Submits → Status: 'preview' → Background Job Starts
                                         ↓
                                   Files Created
                                         ↓
                           Status: 'pending_approval' → Shows in Admin Approvals
```

---

### 2. ✅ Approved Reports Don't Show in User's Reports List
**Problem:** After admin approved a report, it didn't appear in the user's reports page. Only old PdfReports were shown.

**Solution:**
- Updated `getReportsByUser` to query BOTH `PdfReport` AND approved `AssetReport`
- Converted AssetReports to match PdfReport format for frontend compatibility
- Combined and sorted by `createdAt` (newest first)

**Files Changed:**
- `server/src/controller/pdfReport.controller.ts` (line 126-197)

**Query:**
```typescript
// Old-style reports
const pdfReports = await PdfReport.find({ user: req.userId })

// New-style approved reports  
const approvedAssetReports = await AssetReport.find({ 
  user: req.userId,
  status: 'approved'
})

// Combined and sorted by newest first
```

---

### 3. ✅ Newest Reports Appear First
**Problem:** Reports weren't consistently ordered by newest first.

**Solution:**
- Added explicit sort by `createdAt` descending
- Both PdfReports and AssetReports are sorted individually
- Combined result is sorted again to ensure newest first

**Code:**
```typescript
const allReports = [...pdfResults, ...assetResults].sort((a, b) => {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
});
```

---

## Status Workflow

### Before Fix:
```
Submit → pending_approval (immediate) → Files generating in background
                ↓
         Shows in approvals (but files not ready yet!)
```

### After Fix:
```
Submit → preview → Files generating in background
                        ↓
                   Files ready
                        ↓
              pending_approval → Shows in approvals
                        ↓
                   Admin approves
                        ↓
                   approved → Shows in user's reports
```

---

## Testing

### Test 1: Preview Submission
1. User creates and submits preview
2. **Expected:** Report does NOT immediately appear in admin approvals
3. Wait for background job to complete (~30-60 seconds)
4. **Expected:** Report appears in admin approvals with all 3 files ready

**Server Logs:**
```
[PreviewFilesJob] Starting for report 123...
✅ Files created and status set to pending_approval for report 123
[PreviewFilesJob] Completed for report 123
```

### Test 2: Admin Approval
1. Admin approves a report
2. **Expected:** Report status changes to 'approved'
3. User refreshes their reports page
4. **Expected:** Approved report appears at the TOP of the list

### Test 3: Report Ordering
1. Create 3 reports on different days
2. **Expected:** Newest report appears first
3. Older reports appear below in chronological order

---

## API Endpoints

### User Reports Endpoint
```
GET /api/reports/myreports
```

**Returns:**
- All old-style PdfReports (approved)
- All new-style AssetReports with status='approved'
- Sorted by createdAt (newest first)
- Includes preview_files URLs for downloading

### Admin Approvals Endpoint
```
GET /api/admin/reports/pending
```

**Returns:**
- AssetReports with status='pending_approval'
- Only shows reports where files are READY
- Sorted by createdAt (newest first)

---

## Status States

### AssetReport Status Values:
- `'draft'` - Initial creation, not submitted
- `'preview'` - User submitted, files being generated
- `'pending_approval'` - Files ready, waiting for admin review
- `'approved'` - Admin approved, available to user
- `'declined'` - Admin rejected

### When Each Status is Set:
- `draft` → When report is first created
- `preview` → When user clicks "Submit for Approval" 
- `pending_approval` → When background job finishes creating files
- `approved` → When admin approves
- `declined` → When admin rejects

---

## Database Fields

### AssetReport Model:
```typescript
{
  status: 'draft' | 'preview' | 'pending_approval' | 'approved' | 'declined',
  preview_data: { ... },  // Editable report data
  preview_files: {        // Generated files (set by background job)
    docx: string,
    excel: string,
    images: string
  },
  preview_submitted_at: Date,      // When user submitted
  approval_requested_at: Date,     // When files were ready
  approval_processed_at: Date      // When admin approved/declined
}
```

---

## Background Jobs

### runPreviewFilesJob
**Triggered:** When user submits preview
**Duration:** 30-60 seconds
**Actions:**
1. Generate DOCX from report data
2. Generate XLSX from report data
3. Generate images.zip with renamed files
4. Upload all 3 files to R2
5. Set preview_files URLs on report
6. **Set status to 'pending_approval'**
7. Save report to database
8. **THEN send emails to user and admin** (only after files are ready)

**Console Logs:**
```
[PreviewFilesJob] Starting for report abc123
✅ Files created and status set to pending_approval for report abc123
📧 Emails sent to user and admin
[PreviewFilesJob] Completed for report abc123
```

**Important:** Emails are sent ONLY after:
- All 3 files are generated and uploaded ✅
- Status is set to 'pending_approval' ✅
- Report is saved to database ✅

---

## User Experience

### User Flow:
1. Create report and fill preview data
2. Click "Submit for Approval"
3. See message: "Files are being prepared. Report will appear in approvals when ready."
4. Receive email when files are ready
5. Wait for admin approval
6. Receive email when approved
7. See report in "My Reports" page
8. Download DOCX, XLSX, or images

### Admin Flow:
1. Receive email when new report is ready for approval
2. Go to Approvals page
3. See report with all 3 files ready to preview
4. Review DOCX, XLSX, images
5. Approve or Decline
6. User receives notification

---

## Files Modified

1. **server/src/controller/asset.controller.ts**
   - Line 233: Set status to 'preview' instead of 'pending_approval'
   - Removed approval_requested_at from initial save

2. **server/src/jobs/assetReportJob.ts**
   - Line 154-159: Set status to 'pending_approval' after files created
   - Added approval_requested_at timestamp
   - Added console log for completion

3. **server/src/controller/pdfReport.controller.ts**
   - Line 126-197: Rewrote getReportsByUser
   - Query both PdfReport and approved AssetReport
   - Convert AssetReports to match PdfReport format
   - Sort combined results by newest first

---

## Production Checklist

- ✅ Reports only appear in approvals when files are ready
- ✅ Approved reports show in user's reports list
- ✅ Newest reports appear first
- ✅ Background job sets correct status
- ✅ Proper timestamps recorded
- ✅ Email notifications sent
- ✅ Console logs for debugging
- ✅ Compatible with old PdfReport system
- ✅ Frontend receives correct data format

---

Generated: Oct 30, 2025
