import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({ storage });

export const uploadDocxOnly = multer({
  storage,
  fileFilter: (req, file, cb) => {
    try {
      const okMime = file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const okExt = /\.docx$/i.test(file.originalname || "");
      if (okMime && okExt) return cb(null, true);
      return cb(new Error("Only .docx files are allowed"));
    } catch (e) {
      return cb(new Error("Invalid file"));
    }
  },
});

export default upload;
