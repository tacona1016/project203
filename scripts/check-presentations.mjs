import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { quarters } from "../data/quarters.ts";

// Pure validation also accepts synthetic registries/routes in regression tests.
export function findPresentationIssues(entries, mdxSlugs) {
  const issues = [], registered = new Set(), routes = new Set(mdxSlugs);
  for (const quarter of entries) {
    if (!/^\d{4}-q[1-4]$/.test(quarter.slug)) issues.push(`Invalid quarter slug: ${quarter.slug}`);
    if (registered.has(quarter.slug)) issues.push(`Duplicate quarter slug: ${quarter.slug}`);
    registered.add(quarter.slug);
    if (quarter.presentationPublished === true && !routes.has(quarter.slug)) issues.push(`Published presentation is missing page.mdx: ${quarter.slug}`);
  }
  for (const slug of routes) if (!registered.has(slug)) issues.push(`MDX presentation has no quarter metadata: ${slug}`);
  return issues;
}

export async function checkPresentations(root = process.cwd()) {
  const directory = path.join(root, "app/quarter");
  let directories;
  try { directories = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code !== "ENOENT") throw error; directories = []; }
  const mdxSlugs = [];
  for (const entry of directories) {
    if (!entry.isDirectory()) continue;
    try {
      if ((await stat(path.join(directory, entry.name, "page.mdx"))).isFile()) mdxSlugs.push(entry.name);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  return findPresentationIssues(quarters, mdxSlugs);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const issues = await checkPresentations();
    if (issues.length) { for (const issue of issues) console.error(issue); process.exitCode = 1; }
    else console.log("Presentation publication settings and MDX routes are consistent.");
  } catch { console.error("Could not verify presentation files. Check the local quarter directory."); process.exitCode = 1; }
}
