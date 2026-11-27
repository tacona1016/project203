import { copyFile, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/** Install only ignored, authenticated review routes; production app is untouched. */
export async function installReviewRoutes(appDirectory, reviewDirectory) {
  const appRoot = path.resolve(appDirectory);
  const reviewRoot = path.resolve(reviewDirectory);
  const allowed = path.resolve(".verification") + path.sep;
  if (!appRoot.startsWith(allowed) || !reviewRoot.startsWith(allowed)) throw Error("Review routes must remain in the ignored workspace");
  const routes = path.join(appRoot, "app/presentation-review");
  const archive = path.join(reviewRoot, "archive");
  await mkdir(archive, { recursive: true });
  for (const name of ["results", "results-detail"]) {
    const oldPage = path.join(routes, name, "page.mdx");
    try { await rename(oldPage, path.join(archive, Date.now() + "-" + name + "-page.mdx")); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  await mkdir(path.join(routes, "existing"), { recursive: true });
  await copyFile(path.join(reviewRoot, "mdx/existing-2026q4-v2.mdx"), path.join(routes, "existing/page.mdx"));
  await writeFile(path.join(routes, "layout.tsx"), 'import {requireAccessSession} from "@/lib/auth/session";\nimport type {ReactNode} from "react";\nexport const dynamic="force-dynamic";\nexport default async function Layout({children}:{children:ReactNode}){await requireAccessSession("/presentation-review/existing");return children;}\n');
  await writeFile(path.join(routes, "page.tsx"), 'export default function Page(){return <main className="site-container content-page"><h1>발표자료 검토</h1><p>기존 12장 + 설문 조사 결과 1장 · 운영 미반영</p><ul><li><a href="/presentation-review/existing">2026 Q4 발표자료 · 13장</a></li><li><a href="/presentation-review/existing#results-overview">설문 조사 결과 · 마지막 장</a></li><li><a href="/presentation-review/original">기존 디자인 비교</a></li></ul></main>;}\n');
  await mkdir(path.join(routes, "results"), { recursive: true });
  await writeFile(path.join(routes, "results/page.tsx"), 'import {redirect} from "next/navigation";\nexport default function Page(){redirect("/presentation-review/existing#results-overview");}\n');
}
