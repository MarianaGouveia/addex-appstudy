#!/usr/bin/env node
/*
 * One-shot migration: split every `rex/saved_models/<dataset>/<task>/<persona>/paths.json`
 * into per-pair files under a sibling `pairs/` directory.
 *
 * Usage:
 *   node scripts/migrate-paths-to-per-pair.mjs              # migrate all
 *   node scripts/migrate-paths-to-per-pair.mjs --dry-run    # report, don't write
 *   node scripts/migrate-paths-to-per-pair.mjs --delete-source
 *                                                           # delete the big paths.json
 *                                                           # after successful migration
 *
 * Why streaming? The OREGANO DTI paths.json files are ~830 MB, which exceeds
 * Node's ~512 MB max-string limit. We can't fs.readFileSync them. `stream-json`
 * parses the array of pairs one object at a time without loading the whole
 * file into a single string.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chain from "stream-chain";
import { parser as jsonParser } from "stream-json";
import { pick as jsonPick } from "stream-json/filters/pick.js";
import { streamArray as jsonStreamArray } from "stream-json/streamers/stream-array.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const SAVED_MODELS_ROOT = path.join(projectRoot, "rex", "saved_models");

const flags = new Set(process.argv.slice(2));
const DRY_RUN = flags.has("--dry-run");
const DELETE_SOURCE = flags.has("--delete-source");

// Must match `pairIdToFilename` in src/app/api/_lib/rexSearch.ts so the
// runtime can read pair files written by this migration. See the comment
// there for why long IDs fall back to a hashed name.
const PAIR_FILENAME_LIMIT = 220;
function pairIdToFilename(pairId) {
  const safe = pairId
    .split(" - ")
    .map((part) => part.replace(/[:\s]/g, "_"))
    .join("__");
  if (safe.length + 5 <= PAIR_FILENAME_LIMIT) {
    return `${safe}.json`;
  }
  const prefix = safe.slice(0, 60);
  const hash = crypto.createHash("sha256").update(pairId).digest("hex").slice(0, 16);
  return `${prefix}__h_${hash}.json`;
}

function findPathsJsonFiles(root) {
  const results = [];
  if (!fs.existsSync(root)) return results;
  for (const dataset of fs.readdirSync(root)) {
    const datasetDir = path.join(root, dataset);
    if (!fs.statSync(datasetDir).isDirectory()) continue;
    for (const task of fs.readdirSync(datasetDir)) {
      const taskDir = path.join(datasetDir, task);
      if (!fs.statSync(taskDir).isDirectory()) continue;
      for (const persona of fs.readdirSync(taskDir)) {
        const personaDir = path.join(taskDir, persona);
        if (!fs.statSync(personaDir).isDirectory()) continue;
        const pathsJson = path.join(personaDir, "paths.json");
        if (fs.existsSync(pathsJson)) {
          results.push({
            dataset,
            task,
            persona,
            personaDir,
            pathsJson,
          });
        }
      }
    }
  }
  return results;
}

async function migrateOne({ dataset, task, persona, personaDir, pathsJson }) {
  const pairsDir = path.join(personaDir, "pairs");
  const label = `${dataset}/${task}/${persona}`;
  const size = (fs.statSync(pathsJson).size / (1024 * 1024)).toFixed(1);
  process.stdout.write(`\n[${label}] paths.json is ${size} MB\n`);

  if (!DRY_RUN) {
    fs.mkdirSync(pairsDir, { recursive: true });
  }

  let pairCount = 0;
  let writtenCount = 0;
  let skippedExisting = 0;
  let errorCount = 0;

  await new Promise((resolve, reject) => {
    const pipeline = chain([
      fs.createReadStream(pathsJson),
      jsonParser(),
      jsonPick({ filter: "pairs" }),
      jsonStreamArray(),
    ]);

    pipeline.on("data", ({ value: pair }) => {
      pairCount += 1;
      const pairId = pair?.id;
      if (typeof pairId !== "string" || !pairId.includes(" - ")) {
        errorCount += 1;
        process.stderr.write(
          `[${label}] skipping pair with bad id at index ${pairCount - 1}\n`
        );
        return;
      }

      const outFile = path.join(pairsDir, pairIdToFilename(pairId));
      if (fs.existsSync(outFile)) {
        skippedExisting += 1;
        return;
      }

      if (DRY_RUN) {
        writtenCount += 1;
        return;
      }

      try {
        fs.writeFileSync(outFile, JSON.stringify(pair, null, 2), "utf-8");
        writtenCount += 1;
      } catch (err) {
        errorCount += 1;
        process.stderr.write(
          `[${label}] write failed for ${pairId}: ${err.message}\n`
        );
      }

      if (writtenCount % 5000 === 0) {
        process.stdout.write(
          `[${label}] ${writtenCount.toLocaleString()} pairs written...\n`
        );
      }
    });

    pipeline.on("end", resolve);
    pipeline.on("close", resolve);
    pipeline.on("error", reject);
  });

  process.stdout.write(
    `[${label}] done. pairs seen=${pairCount.toLocaleString()} written=${writtenCount.toLocaleString()} existing=${skippedExisting.toLocaleString()} errors=${errorCount}\n`
  );

  if (DELETE_SOURCE && !DRY_RUN && errorCount === 0) {
    fs.unlinkSync(pathsJson);
    process.stdout.write(`[${label}] removed source paths.json\n`);
  }

  return { pairCount, writtenCount, skippedExisting, errorCount };
}

async function main() {
  const candidates = findPathsJsonFiles(SAVED_MODELS_ROOT);
  if (candidates.length === 0) {
    console.log("No paths.json files found under", SAVED_MODELS_ROOT);
    return;
  }

  console.log(
    `Found ${candidates.length} paths.json file(s). Dry run: ${DRY_RUN}. Delete source: ${DELETE_SOURCE}.`
  );

  let totalPairs = 0;
  let totalWritten = 0;
  let totalExisting = 0;
  let totalErrors = 0;
  for (const candidate of candidates) {
    const result = await migrateOne(candidate);
    totalPairs += result.pairCount;
    totalWritten += result.writtenCount;
    totalExisting += result.skippedExisting;
    totalErrors += result.errorCount;
  }

  console.log(
    `\nAll done. pairs=${totalPairs.toLocaleString()} written=${totalWritten.toLocaleString()} existing=${totalExisting.toLocaleString()} errors=${totalErrors}`
  );
  if (totalErrors > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
