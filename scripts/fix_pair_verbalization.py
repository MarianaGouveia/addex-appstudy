"""One-off: add an empty `verbalization` field to every saved pair JSON
that's missing it, inserting between `id` and `paths` to preserve the
expected key order. Idempotent: files that already have verbalization
(empty or filled) are skipped without rewriting.

Run from the ADDEx repo root:
    python3 scripts/fix_pair_verbalization.py
"""

import json
import os
from glob import glob
from multiprocessing import Pool, cpu_count

ROOT = "rex/saved_models"


def fix_one(path: str) -> tuple[str, str]:
    """Return (path, status) where status is 'fixed', 'skipped', or 'error'."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:
        return path, f"error:read:{exc}"

    if "verbalization" in data:
        return path, "skipped"

    # Reconstruct dict in the desired order: id, verbalization, paths, ...rest.
    # (Some files have extra fields like 'warning'; preserve those after paths.)
    new_data = {}
    for key in data:
        new_data[key] = data[key]
        if key == "id":
            new_data["verbalization"] = ""
    # Defensive: if there was no 'id' key (shouldn't happen), prepend.
    if "verbalization" not in new_data:
        new_data = {"verbalization": "", **data}

    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(new_data, f, indent=2, ensure_ascii=False)
        return path, "fixed"
    except Exception as exc:
        return path, f"error:write:{exc}"


def main():
    files = sorted(glob(os.path.join(ROOT, "*", "*", "*", "pairs", "*.json")))
    print(f"Found {len(files)} pair files; scanning...")

    fixed = skipped = errors = 0
    with Pool(processes=cpu_count()) as pool:
        for i, (path, status) in enumerate(pool.imap_unordered(fix_one, files, chunksize=200), 1):
            if status == "fixed":
                fixed += 1
            elif status == "skipped":
                skipped += 1
            else:
                errors += 1
                if errors <= 5:
                    print(f"  ERROR: {path}: {status}")
            if i % 25000 == 0:
                print(f"  ...{i:>7}/{len(files)} processed (fixed={fixed} skipped={skipped} errors={errors})")

    print(f"\nDone. fixed={fixed} skipped={skipped} errors={errors}")


if __name__ == "__main__":
    main()
