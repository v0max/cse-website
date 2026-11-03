# cse.llc

Website for Computer Science Experts, LLC. Built with Next.js and deployed on Vercel.

**To change what's on the site, see [MAINTAINING.md](MAINTAINING.md).** All
content lives in `content/`. Add a person by adding one file and one photo.

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build (also validates the content)
npm run portraits    # regenerate halftone portraits (needs Python; see MAINTAINING.md)
```

## Layout

| Path | What it is |
| --- | --- |
| `content/` | People, cases, site text, raw photos |
| `public/portraits/` | Generated halftone portraits (do not edit by hand) |
| `public/documents/` | CVs and testimony lists |
| `src/lib/content.ts` | Loads and validates the content |
| `src/app/page.tsx` | Home page |
| `src/app/experts/[slug]/page.tsx` | Profile pages |
| `src/app/globals.css` | All styling (colours and type at the top) |
| `tools/portraits/` | Photo → halftone portrait pipeline |
| `.github/workflows/portraits.yml` | Runs the pipeline when photos change |
| `.pages.yml` | Web editor (Pages CMS) forms |
