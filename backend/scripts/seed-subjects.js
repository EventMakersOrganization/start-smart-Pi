const mongoose = require("mongoose");
require("dotenv").config();

const subjectSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    chapters: [
      {
        title: { type: String, required: true },
        description: { type: String },
        order: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true },
);

const Subject =
  mongoose.models.Subject || mongoose.model("Subject", subjectSchema);

function parseArg(name, fallback = "") {
  const full = `--${name}=`;
  const arg = process.argv.find((x) => x.startsWith(full));
  return arg ? arg.slice(full.length) : fallback;
}

function normalizeSubjects(raw) {
  return String(raw || "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [codePart, titlePart, descriptionPart] = item
        .split("::")
        .map((value) => value.trim());
      return {
        code: codePart,
        title: titlePart,
        description: descriptionPart || "",
      };
    });
}

async function run() {
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/user-management";
  const instructorId = parseArg(
    "instructorId",
    process.env.INSTRUCTOR_ID || "",
  ).trim();
  const rawSubjects = parseArg(
    "subjects",
    process.env.SUBJECTS_LIST ||
      "ESE.INFWEB0004_4TWIN3::Application côté client 2_4TWIN3::Front-end et interaction utilisateur|ESE.MT-41_4TWIN3::Applications web distribuées_4TWIN3::Architecture distribuée et services web|ESE.INFASI0005_4TWIN3::Architecture des SI_4TWIN3::Analyse et structuration des systèmes d’information|ESE.AN-05_4TWIN3::Communication, Culture et Citoyenneté A4_4TWIN3::Compétences transversales et communication|ESE.TC-21_4TWIN3::Complexité appliquée à la RO_4TWIN3::Recherche opérationnelle et optimisation|ESE.SH-104_4TWIN3::Droit de la propriété intellectuelle_4TWIN3::Cadre juridique et propriété intellectuelle",
  );
  const subjectList = normalizeSubjects(rawSubjects);

  if (!instructorId) {
    throw new Error(
      "Missing instructorId. Use --instructorId=<mongo_user_id> or INSTRUCTOR_ID env var.",
    );
  }

  if (!mongoose.Types.ObjectId.isValid(instructorId)) {
    throw new Error(`Invalid instructorId: ${instructorId}`);
  }

  if (!subjectList.length) {
    throw new Error(
      'No subjects provided. Use --subjects="CODE::Title::Description|..."',
    );
  }

  await mongoose.connect(mongoUri);

  const operations = subjectList.map((subject) => ({
    updateOne: {
      filter: {
        code: subject.code,
        instructorId: new mongoose.Types.ObjectId(instructorId),
      },
      update: {
        $set: {
          code: subject.code,
          title: subject.title,
          description: subject.description,
          instructorId: new mongoose.Types.ObjectId(instructorId),
          chapters: [],
        },
      },
      upsert: true,
    },
  }));

  const result = await Subject.bulkWrite(operations);

  console.log("Subjects seed completed.");
  console.log(`Matched: ${result.matchedCount}`);
  console.log(`Modified: ${result.modifiedCount}`);
  console.log(`Upserted: ${result.upsertedCount}`);
  console.log(`Instructor: ${instructorId}`);
  console.log(
    `Subjects: ${subjectList.map((subject) => subject.title).join(", ")}`,
  );

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Seed failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // no-op
  }
  process.exit(1);
});
