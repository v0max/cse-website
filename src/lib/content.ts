/**
 * Loads the site's content from the `content/` folder at build time.
 *
 *   content/people/<slug>.md   one file per person (YAML front matter + bio)
 *   content/cases.yml          cases of note
 *   content/site.yml           site-wide text and contact details
 *
 * Mistakes that would silently break a page (an unknown expert in a case,
 * a missing name or role) stop the build with a message saying which file
 * to fix, so a typo can never reach the live site.
 */
import fs from "node:fs";
import path from "node:path";
import { load } from "js-yaml";

const CONTENT_DIR = path.join(process.cwd(), "content");
const PEOPLE_DIR = path.join(CONTENT_DIR, "people");
const PORTRAIT_DIR = path.join(process.cwd(), "public", "portraits");

export const ROLES = ["Testifying Expert", "Consulting Expert", "Research Staff"] as const;
export type Role = (typeof ROLES)[number];

export interface Link {
  label: string;
  url: string;
}

export interface Person {
  slug: string;
  name: string;
  role: Role;
  topics: string[];
  highlights: string[];
  education: string[];
  recognition: string[];
  links: Link[];
  cv: string;
  testimonyList: string;
  /** Public URL of the generated portrait, or "" if none has been generated yet. */
  portrait: string;
  initials: string;
  /** Markdown bio. The first paragraph is shown as the lede. */
  body: string;
  sortKey: string;
}

export const CASE_STATUSES = ["Verdict", "Judgment", "Settled", "Pending", "PTAB"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export interface Case {
  name: string;
  shortName: string;
  forum: string;
  law: string;
  status: CaseStatus;
  year?: number;
  issue: string;
  experts: string[];
  retainedBy: string;
  link: string;
  outsideCse: boolean;
  featured: boolean;
  question: string;
}

export interface Matter {
  title: string;
  body: string;
  experts: string[];
}

export interface Service {
  title: string;
  body: string;
}

export interface Site {
  name: string;
  shortName: string;
  description: string;
  email: string;
  phone: string;
  offices: string[];
  registeredIn: string;
  hero: { kicker: string; headline: string; headlineEmphasis: string; lede: string };
  mattersIntro: string;
  matters: Matter[];
  servicesIntro: string;
  services: Service[];
  expertsIntro: string;
  engageIntro: string;
  conflictsChecklist: string[];
}

type Raw = Record<string, unknown>;

class ContentError extends Error {
  constructor(file: string, message: string) {
    super(`content/${path.relative(CONTENT_DIR, file)}: ${message}`);
  }
}

function str(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

function strList(v: unknown): string[] {
  if (v === undefined || v === null || v === "") return [];
  if (!Array.isArray(v)) return [str(v)].filter(Boolean);
  return v.map(str).filter(Boolean);
}

function readYaml(file: string): Raw {
  const data = load(fs.readFileSync(file, "utf8"));
  if (!data || typeof data !== "object") throw new ContentError(file, "file is empty or not a YAML mapping");
  return data as Raw;
}

function readFrontMatter(file: string): { data: Raw; body: string } {
  const raw = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new ContentError(file, 'must start with a "---" block of fields, followed by the bio');
  const data = (load(m[1]) ?? {}) as Raw;
  return { data, body: m[2].trim() };
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

let peopleCache: Person[] | null = null;

/** Everyone, ordered by role (testifying, consulting, staff) and then by last name. */
export function getPeople(): Person[] {
  if (peopleCache) return peopleCache;
  const files = fs.readdirSync(PEOPLE_DIR).filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  const people = files.map((f): Person => {
    const file = path.join(PEOPLE_DIR, f);
    const { data, body } = readFrontMatter(file);
    const slug = slugify(f.replace(/\.md$/, ""));
    const name = str(data.name);
    if (!name) throw new ContentError(file, "missing `name`");
    const role = str(data.role) as Role;
    if (!ROLES.includes(role)) {
      throw new ContentError(file, `\`role\` must be one of: ${ROLES.join(", ")} (found "${role}")`);
    }
    const links = Array.isArray(data.links)
      ? (data.links as Raw[]).map((l) => ({ label: str(l?.label), url: str(l?.url) })).filter((l) => l.label && l.url)
      : [];
    const portraitFile = path.join(PORTRAIT_DIR, `${slug}.webp`);
    const last = name.split(/\s+/).slice(-1)[0] ?? name;
    return {
      slug,
      name,
      role,
      topics: strList(data.topics),
      highlights: strList(data.highlights),
      education: strList(data.education),
      recognition: strList(data.recognition),
      links,
      cv: str(data.cv),
      testimonyList: str(data.testimony_list),
      portrait: fs.existsSync(portraitFile) ? `/portraits/${slug}.webp` : "",
      initials: initialsOf(name),
      body,
      sortKey: str(data.sort_name) || `${last} ${name}`,
    };
  });
  people.sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.sortKey.localeCompare(b.sortKey));
  peopleCache = people;
  return people;
}

export function getPerson(slug: string): Person | undefined {
  return getPeople().find((p) => p.slug === slug);
}

function checkExperts(file: string, where: string, slugs: string[]): void {
  const known = new Set(getPeople().map((p) => p.slug));
  for (const s of slugs) {
    if (!known.has(s)) {
      throw new ContentError(
        file,
        `${where} lists expert "${s}", but there is no content/people/${s}.md. ` +
          `Use one of: ${[...known].join(", ")}`,
      );
    }
  }
}

let casesCache: Case[] | null = null;

/** Cases, most recent first (cases without a year last, in file order). */
export function getCases(): Case[] {
  if (casesCache) return casesCache;
  const file = path.join(CONTENT_DIR, "cases.yml");
  const raw = readYaml(file).cases;
  if (!Array.isArray(raw)) throw new ContentError(file, "must contain a `cases:` list");
  const cases = (raw as Raw[]).map((c, i): Case => {
    const name = str(c.name);
    if (!name) throw new ContentError(file, `case #${i + 1} is missing \`name\``);
    const status = str(c.status) as CaseStatus;
    if (!CASE_STATUSES.includes(status)) {
      throw new ContentError(file, `"${name}": \`status\` must be one of ${CASE_STATUSES.join(", ")}`);
    }
    const experts = strList(c.experts);
    checkExperts(file, `"${name}"`, experts);
    const year = c.year === undefined || c.year === null || c.year === "" ? undefined : Number(c.year);
    return {
      name,
      shortName: str(c.short_name) || name,
      forum: str(c.forum),
      law: str(c.law),
      status,
      year: Number.isFinite(year) ? year : undefined,
      issue: str(c.issue),
      experts,
      retainedBy: str(c.retained_by),
      link: str(c.link),
      outsideCse: c.outside_cse === true,
      featured: c.featured === true,
      question: str(c.question),
    };
  });
  const order = new Map(cases.map((c, i) => [c, i]));
  cases.sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity) || order.get(a)! - order.get(b)!);
  casesCache = cases;
  return cases;
}

export function getCasesFor(slug: string): Case[] {
  return getCases().filter((c) => c.experts.includes(slug));
}

let siteCache: Site | null = null;

export function getSite(): Site {
  if (siteCache) return siteCache;
  const file = path.join(CONTENT_DIR, "site.yml");
  const d = readYaml(file);
  const hero = (d.hero ?? {}) as Raw;
  const matters = (Array.isArray(d.matters) ? d.matters : []) as Raw[];
  const services = (Array.isArray(d.services) ? d.services : []) as Raw[];
  const site: Site = {
    name: str(d.name),
    shortName: str(d.short_name),
    description: str(d.description),
    email: str(d.email),
    phone: str(d.phone),
    offices: strList(d.offices),
    registeredIn: str(d.registered_in),
    hero: {
      kicker: str(hero.kicker),
      headline: str(hero.headline),
      headlineEmphasis: str(hero.headline_emphasis),
      lede: str(hero.lede),
    },
    mattersIntro: str(d.matters_intro),
    matters: matters.map((m) => ({ title: str(m.title), body: str(m.body), experts: strList(m.experts) })),
    servicesIntro: str(d.services_intro),
    services: services.map((s) => ({ title: str(s.title), body: str(s.body) })),
    expertsIntro: str(d.experts_intro),
    engageIntro: str(d.engage_intro),
    conflictsChecklist: strList(d.conflicts_checklist),
  };
  site.matters.forEach((m) => checkExperts(file, `matter "${m.title}"`, m.experts));
  siteCache = site;
  return site;
}

/** "Egelman · Schechter" style list of last names for a set of slugs. */
export function lastNames(slugs: string[]): string[] {
  return slugs.map((s) => getPerson(s)?.name.split(/\s+/).slice(-1)[0] ?? s);
}
