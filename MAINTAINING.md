# Maintaining the CSE website

Everything that appears on the site lives in the `content/` folder. You never
need to touch the code to add a person, change a bio, or add a case.

```
content/
  people/<name>.md   one file per person: details at the top, bio below
  photos/            raw headshots (any size; jpg, png or webp)
  cases.yml          cases of note
  site.yml           home-page text, contact details, offices
public/
  portraits/         halftone portraits — generated automatically, don't edit
  documents/         CVs and testimony lists (PDF)
```

There are two ways to edit. Both end up as the same kind of change in GitHub,
and the live site updates a minute or two after the change reaches `main`.

## Option A: the web editor (no Git needed)

1. Go to <https://app.pagescms.org> and sign in with GitHub.
2. Open **csexperts/cse-website**.
3. Use **People**, **Cases of note** or **Site text & contact details**.
4. Save. Pages CMS commits the change for you.

You need a GitHub account with write access to the repository. The first
person to use Pages CMS will be asked to install its GitHub app on the
`csexperts` organization.

## Option B: edit the files

Edit on github.com (pencil icon) or in a local checkout, then commit. For
bigger changes, use a branch and a pull request: Vercel posts a preview link on
the pull request so you can check the result before merging.

## Common tasks

### Add a person

1. Put their headshot in `content/photos/` (e.g. `content/photos/ada-lovelace.jpg`).
2. Copy any file in `content/people/` to `content/people/ada-lovelace.md`
   (the file name becomes the web address: `/experts/ada-lovelace`).
3. Fill in the fields and replace the bio:

```markdown
---
name: Ada Lovelace
role: Testifying Expert          # or Consulting Expert, or Research Staff
photo: content/photos/ada-lovelace.jpg
topics:                          # short tags; "Testifies on" on the card
  - Algorithms
  - Analytical engines
highlights:                      # 3–5 bullets: card + top of profile
  - Professor of Computing, Somewhere University
  - Author of the first published algorithm
education:
  - PhD in Mathematics, Somewhere University
recognition: []
links:
  - label: Personal website
    url: https://example.com
cv: /documents/ada-lovelace-cv.pdf          # optional; put the PDF in public/documents/
testimony_list: ''                          # optional
---

Ada Lovelace studies how machines follow instructions. (This first paragraph is
shown large, as the introduction.)

Second paragraph of the bio. *Italics* and [links](https://example.com) work.
```

That's it. Within a few minutes:

- the **Portraits** GitHub Action turns the photo into the halftone portrait
  and commits it, and
- the person appears on the home page (grouped by role, in last-name order)
  with their own profile page.

Until the portrait has been generated, the site shows their initials instead.

### Remove a person

Delete their file in `content/people/` (and their photo). Also remove them
from `experts:` lists in `content/cases.yml` and `content/site.yml`, or the
build will stop and tell you where they're still listed.

### Add or edit a case

Edit `content/cases.yml`. Each case lists its experts by file name (without
`.md`). Set `featured: true` and a short `question` to show a case in "Recent
matters" at the top of the home page. Cases are listed newest first by
`year`. A case's experts automatically get it under "Selected matters" on
their profile.

### Change home-page text, email, phone or offices

Edit `content/site.yml`.

## Photos and portraits

Ask for headshots that suit the pipeline, so portraits match without manual
tweaks:

- plain, light background (not a cut-out — the pipeline removes the background itself)
- soft, even light from the front; no harsh side shadows
- camera at eye level, facing the camera, head and shoulders in frame
- at least 1000 px wide, no filters or retouching

If a portrait's framing looks off, add a `portrait:` block to that person's
file and save; the portrait is regenerated:

```yaml
portrait:
  zoom: 1.15        # bigger = closer crop (default 1)
  shift_x: 0.05     # move the face right (+) or left (−) (default 0)
  background: fade  # auto (default) | fade (busy backgrounds) | trim (windows, door frames)
```

The Action only regenerates portraits whose photo or settings changed. To
regenerate everything (e.g. after changing the style in
`tools/portraits/portrait.py`), run the **Portraits** workflow from the
Actions tab with "Regenerate every portrait" ticked.

To run it on your own machine:

```bash
pip install -r tools/portraits/requirements.txt
python3 tools/portraits/build.py           # changed portraits only
python3 tools/portraits/build.py --all     # everyone
```

The first run downloads a 176 MB background-removal model to
`~/.cache/cse-portraits/`.

## Running the site locally

```bash
npm install
npm run dev        # http://localhost:3000
```

## When the build fails

The build checks the content and stops with a message naming the file to fix,
for example:

```
content/cases.yml: "Young et al. v. Salesforce, Inc." lists expert
"stuart-schecter", but there is no content/people/stuart-schecter.md.
```

A failed build never replaces the live site; Vercel keeps serving the last
good version until the problem is fixed.

## Privacy

The site sets no cookies and loads nothing from third parties: fonts are
bundled at build time by `next/font`, and there are no analytics. Keep it that
way, or update the footer line in `src/ui/Chrome.tsx`.
