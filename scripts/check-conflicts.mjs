import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mdx", ".json", ".css", ".md", ".sql", ".yml", ".yaml"]);
const excluded = new Set([".git", "node_modules", ".verification", ".vercel", ".agents", ".codex", "coverage", "backups", "private-assets"]);

// Match standalone conflict control lines, not quoted strings in ordinary
// code/tests. Check each marker independently so a partial conflict also fails.
export function findConflictMarkers(source) {
  const marker = /^[\t ]*(?:<{7}(?:[\t ].*)?|={7}|>{7}(?:[\t ].*)?|\|{7}(?:[\t ].*)?)[\t ]*$/;
  return source.split(/\r?\n/).flatMap((line, index) => marker.test(line) ? [index + 1] : []);
}

// Walk source files rather than requiring .git: Vercel source archives and the
// isolated integration app do not necessarily contain repository metadata.
// Untracked source is checked too. Ignore symlinks and generated/private data.
export async function checkConflicts(root = process.cwd()) {
  const issues = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!excluded.has(entry.name) && !entry.name.startsWith(".next")) await walk(filename);
      } else if (entry.isFile() && !entry.name.startsWith(".env") && extensions.has(path.extname(entry.name))) {
        const source = await readFile(filename, "utf8");
        for (const line of findConflictMarkers(source)) issues.push({ file: path.relative(root, filename).split(path.sep).join("/"), line });
      }
    }
  }
  await walk(root);
  return issues.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const issues = await checkConflicts();
    if (issues.length) {
      for (const issue of issues) console.error(`${issue.file}:${issue.line}: unresolved Git conflict marker`);
      process.exitCode = 1;
    } else console.log("No Git conflict markers found in source files.");
  } catch {
    console.error("Could not inspect source files for Git conflicts.");
    process.exitCode = 1;
  }
}
