# 🔧 Fix for Duplicate Reports Issue

## Problem Summary
- DocxGenJob runs immediately after preview submission
- Creates PdfReport records prematurely  
- User sees 2 reports instead of 1
- One report shows "failed to fetch"

## Root Cause
DocxGenJob is executing and passing the status check, which means:
**Something is setting report.status = 'approved' automatically!**

## Immediate Action Required

**Check your next report submission logs for:**
```
⚠️  [DocxGenJob] CALLED FOR REPORT {id}
📍 Call stack trace: Error
    at runDocxGenerationJob (...)  ← THIS WILL SHOW WHO CALLED IT!
📊 [DocxGenJob] Report status: {status}
```

The call stack will reveal what's triggering the auto-approval.

## Likely Causes

### 1. Duplicate Route Registration
There are TWO approval routes:
- `POST /assets/:id/approve` → asset.controller.approveReport
- `PATCH /reports/:id/approve` → approval.controller.approveReport

**Possible issue:** Frontend might be calling BOTH routes.

### 2. Auto-Approval in Development Mode
Check for environment variables that might enable auto-approval:
- AUTO_APPROVE_REPORTS
- DEV_MODE
- SKIP_APPROVAL
- TEST_MODE

### 3. Email Webhook or Callback
The admin approval request email might have a link that auto-approves.

## Solution Steps

### Step 1: Add Safety Check to DocxGenJob

Already added enhanced logging. Next submission will show the call stack.

### Step 2: Comment Out One Approval Route

Since there are two approval endpoints, temporarily disable one:

**Option A: Keep admin route only** (in `admin.routes.ts`):
```typescript
router.patch("/reports/:id/approve", adminProtect, approveReport);
```

**Option B: Keep asset route only** (in `asset.routes.ts`):
```typescript
// router.post("/:id/approve", protect, approveReport); // DISABLED
```

### Step 3: Check Frontend Approval Button

In `admin/components/admin/AdminApprovals.tsx`, verify the approve button calls:
```typescript
// Should call: PATCH /api/admin/reports/{id}/approve
// NOT: POST /api/assets/{id}/approve
```

### Step 4: Remove Auto-Approval Logic

If found in logs, remove any code that:
```typescript
// BAD - Auto-approve after preview
if (NODE_ENV === 'development') {
  report.status = 'approved';  // ← REMOVE THIS!
}
```

## Temporary Workaround

Until the root cause is found, add this check to DocxGenJob:

```typescript
// In runDocxGenerationJob(), add delay check:
const timeSinceSubmission = Date.now() - new Date(report.preview_submitted_at).getTime();
if (timeSinceSubmission < 30000) { // Less than 30 seconds
  console.warn(`⚠️  DocxGenJob called too soon (${timeSinceSubmission}ms after submission)`);
  console.warn(`⚠️  This suggests auto-approval. Rejecting to prevent duplicates.`);
  throw new Error('Report approved too quickly after submission - possible auto-approval bug');
}
```

## Expected Behavior

```
1. User Submits Preview
   └─ Status: pending_approval
   └─ Files generated (DOCX/XLSX/ZIP uploaded to R2)
   └─ Emails sent to user & admin
   └─ [STOP HERE - WAIT FOR ADMIN]

2. Admin Reviews in /admin/approvals  
   └─ Downloads from R2 URLs
   └─ Clicks "Approve" button
   
3. Admin Approves
   └─ Status: approved
   └─ DocxGenJob runs NOW (creates PdfReports)
   └─ User can download from /reports
```

## Next Steps

1. ✅ Submit a new test report
2. ✅ Check console logs for call stack
3. ✅ Identify what's calling DocxGenJob
4. ✅ Remove auto-approval code
5. ✅ Test that reports only appear once
6. ✅ Test that admin must manually approve

## Contact

Share the console logs from the next submission, especially:
- The call stack from DocxGenJob
- Any errors or warnings
- The full log sequence from submission to completion
