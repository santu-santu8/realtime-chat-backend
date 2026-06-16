const express = require("express");

const router = express.Router();

const multer = require("multer");

const path = require("path");

const fs = require("fs");

// ======================
// CREATE UPLOADS FOLDER
// ======================

const uploadDir = "uploads";

if (!fs.existsSync(uploadDir)) {

  fs.mkdirSync(uploadDir);

}

// ======================
// MULTER STORAGE
// ======================

const storage = multer.diskStorage({

  destination: (req, file, cb) => {

    cb(null, "uploads/");

  },

  filename: (req, file, cb) => {

    const uniqueName =
      Date.now() +
      "-" +
      file.originalname.replace(/\s/g, "");

    cb(null, uniqueName);

  },

});

// ======================
// FILE FILTER
// ======================

const fileFilter = (
  req,
  file,
  cb
) => {

  cb(null, true);

};

// ======================
// UPLOAD CONFIG
// ======================

const upload = multer({

  storage,

  fileFilter,

  limits: {
    fileSize:
      20 * 1024 * 1024,
  },

});

// ======================
// UPLOAD ROUTE
// ======================

router.post(
  "/",
  upload.single("file"),
  (req, res) => {

    try {

      if (!req.file) {

        return res.status(400).json({
          message:
            "No file uploaded",
        });

      }

      console.log(
        "UPLOADED FILE:",
        req.file
      );

      return res.status(200).json({

        success: true,

        fileUrl:
          "/uploads/" +
          req.file.filename,

      });

    } catch (error) {

      console.log(
        "UPLOAD ERROR:",
        error
      );

      return res.status(500).json({

        message:
          "Upload failed",

      });

    }
  }
);

module.exports = router;