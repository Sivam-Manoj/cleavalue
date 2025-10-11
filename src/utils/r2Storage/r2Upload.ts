import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import { config } from "dotenv";

config();

// Configure the R2 (S3-compatible) client
const s3 = new AWS.S3({
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  endpoint: process.env.R2_ENDPOINT!,
  s3ForcePathStyle: true, // Required for Cloudflare R2 compatibility
  signatureVersion: "v4",
});

/**
 * Function to upload a file to Cloudflare R2.
 * @param file The file to be uploaded (from multer)
 * @param bucketName The R2 bucket name
 * @returns A promise with the uploaded file's URL.
 */
export const uploadToR2 = async (
  file: Express.Multer.File,
  bucketName: string,
  fileName: string
): Promise<string> => {
  // Read file content (support both diskStorage and memoryStorage)
  let fileContent: Buffer;
  let usedPath: string | null = null;
  const anyFile = file as any;

  if (anyFile?.buffer && Buffer.isBuffer(anyFile.buffer)) {
    // Memory storage path
    fileContent = anyFile.buffer as Buffer;
  } else {
    // Disk storage: resolve possible locations robustly
    const candidates: string[] = [];
    if (typeof (file as any)?.path === "string") {
      candidates.push((file as any).path);
    }
    if (typeof (file as any)?.destination === "string" && typeof file.filename === "string") {
      const dest = (file as any).destination as string;
      const joined = path.isAbsolute(dest)
        ? path.join(dest, file.filename)
        : path.resolve(process.cwd(), dest, file.filename);
      candidates.push(joined);
    }
    if (typeof file.filename === "string") {
      candidates.push(path.resolve(process.cwd(), "uploads", file.filename));
      candidates.push(path.resolve(process.cwd(), "server", "uploads", file.filename));
    }

    let found: string | undefined;
    for (const p of candidates) {
      try {
        if (p && fs.existsSync(p)) {
          found = p;
          break;
        }
      } catch {}
    }
    if (!found) {
      throw new Error(
        `Local upload temp file not found; tried: ${candidates.filter(Boolean).join(" | ")}`
      );
    }
    usedPath = found;
    fileContent = fs.readFileSync(found);
  }

  const params = {
    Bucket: bucketName,
    Key: fileName, // Unique file name with timestamp
    Body: fileContent,
    ContentType: file.mimetype,
    ACL: "public-read", // Optional: to allow public access
  };

  try {
    const data = await s3.upload(params).promise();
    // Clean up the temporary file from disk
    try {
      if (usedPath) fs.unlinkSync(usedPath);
    } catch {}
    return data.Location; // Return the URL of the uploaded file
  } catch (error: any) {
    // Clean up the temporary file in case of an error
    try {
      if (usedPath) fs.unlinkSync(usedPath);
    } catch {}
    throw new Error(`Error uploading to R2: ${error.message}`);
  }
};

/**
 * Upload a raw Buffer directly to R2 with a provided content type.
 */
export const uploadBufferToR2 = async (
  buffer: Buffer,
  contentType: string,
  bucketName: string,
  fileName: string
): Promise<string> => {
  const params = {
    Bucket: bucketName,
    Key: fileName,
    Body: buffer,
    ContentType: contentType,
    ACL: "public-read",
  };
  const data = await s3.upload(params).promise();
  return data.Location;
};
