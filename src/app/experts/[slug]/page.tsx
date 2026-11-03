import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCasesFor, getPeople, getPerson, getSite } from "@/lib/content";
import { inline, paragraphs } from "@/lib/markdown";
import { ExpertLinks, Portrait, SiteFooter, SiteHeader } from "@/ui/Chrome";

type Props = { params: Promise<{ slug: string }> };

// Every profile is generated at build time from content/people/*.md.
export const dynamicParams = false;

export function generateStaticParams() {
  return getPeople().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const person = getPerson(slug);
  if (!person) return {};
  const lede = paragraphs(person.body)[0]?.replace(/[*_]/g, "") ?? "";
  return {
    title: `${person.name}, ${person.role.toLowerCase()}`,
    description: lede,
    openGraph: { title: person.name, description: lede, images: person.portrait ? [person.portrait] : [] },
  };
}

export default async function ExpertPage({ params }: Props) {
  const { slug } = await params;
  const person = getPerson(slug);
  if (!person) notFound();
  const site = getSite();
  const cases = getCasesFor(slug);
  const [lede, ...bio] = paragraphs(person.body);
  const isStaff = person.role === "Research Staff";
  const docs = [
    person.cv && { label: "Curriculum vitae", tag: "PDF ↓", url: person.cv },
    person.testimonyList && { label: "Prior testimony, last 4 years", tag: "PDF ↓", url: person.testimonyList },
    ...person.links.map((l) => ({ label: l.label, tag: "↗", url: l.url })),
  ].filter(Boolean) as { label: string; tag: string; url: string }[];
  const subject = encodeURIComponent(`Conflicts check: ${person.name}`);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="profile-hero">
          <div className="wrap">
            <p className="crumbs">
              <Link href="/#experts">Experts</Link> / {person.role}
            </p>
            <div className="profile-hero__row">
              <Portrait person={person} size={240} className="profile-hero__portrait" />
              <div className="profile-hero__text">
                <h1>{person.name}</h1>
                {person.topics.length > 0 && (
                  <div className="chips">
                    {person.topics.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap profile">
            <div className="profile__main">
              {person.highlights.length > 0 && (
                <div>
                  <h2 className="label label--accent">At a glance</h2>
                  <ul className="bullets bullets--lg">
                    {person.highlights.map((h) => (
                      <li key={h}>{inline(h)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {lede && (
                <div>
                  <h2 className="label label--accent">Biography</h2>
                  <p className="lede">{inline(lede)}</p>
                  {bio.map((p, i) => (
                    <p key={i} className="body-text">
                      {inline(p)}
                    </p>
                  ))}
                </div>
              )}

              {cases.length > 0 && (
                <div>
                  <h2 className="label label--accent">Selected matters</h2>
                  <ul className="matters-list">
                    {cases.map((c) => (
                      <li key={c.name}>
                        <div>
                          <em>{c.name}</em> · {c.law}
                          {c.experts.some((s) => s !== slug) && (
                            <div className="matters-list__with">
                              With <ExpertLinks slugs={c.experts.filter((s) => s !== slug)} />
                            </div>
                          )}
                        </div>
                        <span className={`status-text status--${c.status.toLowerCase()}`}>
                          {c.status}
                          {c.year ? ` · ${c.year}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="footnote">
                    {cases.some((c) => c.outsideCse) && "Includes work performed before or outside CSE. "}A complete
                    testimony list is available on request.
                  </p>
                </div>
              )}

              {(person.recognition.length > 0 || person.education.length > 0) && (
                <div className="two-col">
                  {person.recognition.length > 0 && (
                    <div>
                      <h2 className="label label--accent">Recognition</h2>
                      <ul className="bullets">
                        {person.recognition.map((r) => (
                          <li key={r}>{inline(r)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {person.education.length > 0 && (
                    <div>
                      <h2 className="label label--accent">Education</h2>
                      <ul className="bullets">
                        {person.education.map((e) => (
                          <li key={e}>{inline(e)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <aside aria-label="Documents and contact" className="profile__aside">
              {docs.length > 0 && (
                <div className="doc-card">
                  <h2 className="label">Documents</h2>
                  <ul>
                    {docs.map((d) => (
                      <li key={d.label}>
                        <a href={d.url} target={/^https?:/.test(d.url) ? "_blank" : undefined} rel="noopener">
                          {d.label}
                          <span className="mono-sm">{d.tag}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="contact-card">
                <h2>{isStaff ? "Work with CSE" : `Retain ${person.name}`}</h2>
                <p>Send parties, forum and deadlines for a conflicts check. Please don’t include confidential information.</p>
                <a href={`mailto:${site.email}?subject=${subject}`} className="btn btn--light">
                  Email {site.email}
                </a>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
