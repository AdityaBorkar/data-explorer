import { rm } from "node:fs/promises";
import path from "node:path";

import tailwind from "bun-plugin-tailwind";

const outdir = path.join(process.cwd(), "dist");
await rm(outdir, { force: true, recursive: true });

const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];

const result = await Bun.build({
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  entrypoints,
  minify: true,
  outdir,
  plugins: [tailwind],
  sourcemap: "linked",
  target: "browser",
});

for (const output of result.outputs) {
  console.log(
    ` ${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`,
  );
}
