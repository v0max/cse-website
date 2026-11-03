import Link from "next/link";
import { getCases, getPeople, getSite, lastNames, type Person } from "@/lib/content";
import { inline } from "@/lib/markdown";
import { Portrait, SectionHead, SiteFooter, SiteHeader } from "@/ui/Chrome";

function ExpertCard({ person }: { person: Person }) {
  return (
    <article id={person.slug} className="expert-card">
      <div className="expert-card__head">
        <Portrait person={person} size={120} className="expert-card__portrait" />
        <h4>{person.name}</h4>
      </div>
      {person.topics.length > 0 && (
        <div>
          <p className="label">Testifies on</p>
          <div className="chips">
            {person.topics.map((t) => (
              <span key={t} className="chip chip--sm">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      <ul className="bullets">
        {person.highlights.map((h) => (
          <li key={h}>{inline(h)}</li>
        ))}
      </ul>
      <div className="expert-card__links">
        <Link href={`/experts/${person.slug}`} className="strong">
          Full profile →
        </Link>
        {person.cv && <a href={person.cv}>CV (PDF)</a>}
      </div>
    </article>
  );
}

export default function Home() {
  const site = getSite();
  const people = getPeople();
  const cases = getCases();
  const testifying = people.filter((p) => p.role === "Testifying Expert");
  const consulting = people.filter((p) => p.role === "Consulting Expert");
  const staff = people.filter((p) => p.role === "Research Staff");
  const featured = cases.filter((c) => c.featured);
  const anyOutside = cases.some((c) => c.outsideCse);
  const nameOf = (slugs: string[]) =>
    slugs.map((s) => people.find((p) => p.slug === s)?.name ?? s).join(", ");

  return (
    <>
      <SiteHeader home />
      <main id="top">
        <section className="hero">
          <div className="wrap hero__inner">
            <div className="hero__main">
              <p className="kicker">{site.hero.kicker}</p>
              <h1>
                {site.hero.headline} <em>{site.hero.headlineEmphasis}</em>.
              </h1>
              <p className="hero__lede">{site.hero.lede}</p>
              <div className="button-row">
                <a href="#engage" className="btn btn--light">
                  How to engage us
                </a>
                <a href="#experts" className="btn btn--ghost">
                  Meet the experts
                </a>
              </div>
            </div>
            {featured.length > 0 && (
              <aside aria-label="Recent matters" className="hero__aside">
                <p className="label label--dark">Recent matters · the technical question</p>
                {featured.map((c) => (
                  <div key={c.name} className="featured">
                    <div className="featured__q">{c.question || c.issue}</div>
                    <div className="featured__case">
                      <em>{c.shortName}</em> · {c.status === "Verdict" ? "Jury verdict" : c.status}
                      {c.year ? `, ${c.year}` : ""}
                    </div>
                    <div className="featured__who">
                      {c.experts.length > 1 ? "Experts" : "Expert"}: {nameOf(c.experts)}
                    </div>
                  </div>
                ))}
                {anyOutside && (
                  <p className="hero__note">
                    Includes work performed before or outside CSE. See all <a href="#cases">cases of note</a>.
                  </p>
                )}
              </aside>
            )}
          </div>
          <div className="hero__strip">
            <div className="wrap hero__strip-inner">
              <span>
                <b>{testifying.length}</b> testifying experts
              </span>
              <span>
                <b>{consulting.length}</b> consulting experts
              </span>
              <span>{site.offices.join(" · ")}</span>
            </div>
          </div>
        </section>

        <section className="band" id="matters">
          <div className="wrap section">
            <SectionHead n={1} title="Matters we handle" intro={site.mattersIntro} />
            <div className="matters">
              {site.matters.map((m, i) => (
                <div key={m.title} className="matter">
                  <span className="mono-sm">1.{i + 1}</span>
                  <h3>{m.title}</h3>
                  <p>{inline(m.body)}</p>
                  <p className="matter__who">{lastNames(m.experts).join(" · ")}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="band band--tint">
          <div className="wrap section">
            <SectionHead n={2} title="How we help" intro={site.servicesIntro} />
            <ol className="services">
              {site.services.map((s, i) => (
                <li key={s.title}>
                  <span className="mono-sm">{String(i + 1).padStart(2, "0")}</span>
                  <h3>{s.title}</h3>
                  <p>{inline(s.body)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="band" id="cases">
          <div className="wrap section">
            <SectionHead
              n={3}
              title="Cases of note"
              intro="A selection of matters in which our experts have been retained."
            />
            <div className="table-scroll">
              <table className="cases">
                <thead>
                  <tr>
                    <th scope="col">Matter</th>
                    <th scope="col">Law</th>
                    <th scope="col">Technical issue · status</th>
                    <th scope="col">Expert</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((c) => (
                    <tr key={c.name}>
                      <td>
                        {c.link ? (
                          <a href={c.link} className="case-name" target="_blank" rel="noopener">
                            {c.name}
                          </a>
                        ) : (
                          <span className="case-name">{c.name}</span>
                        )}
                        {c.outsideCse && (
                          <sup>
                            <a href="#fn-outside" className="fn">
                              1
                            </a>
                          </sup>
                        )}
                        <div className="mono-xs">{c.forum}</div>
                      </td>
                      <td>{c.law}</td>
                      <td>
                        <span className={`status status--${c.status.toLowerCase()}`}>
                          {c.status}
                          {c.year ? ` · ${c.year}` : ""}
                        </span>
                        <div>{c.issue}</div>
                      </td>
                      <td>
                        {c.experts.map((s, i) => (
                          <span key={s}>
                            {i > 0 && ", "}
                            <Link href={`/experts/${s}`}>{lastNames([s])[0]}</Link>
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {anyOutside && (
              <p id="fn-outside" className="footnote">
                <sup>1</sup> Includes work our experts performed before joining, or outside of, CSE. Status reflects the
                public record; several matters are on appeal.
              </p>
            )}
          </div>
        </section>

        <section className="band" id="experts">
          <div className="wrap section">
            <SectionHead n={4} title="The experts" intro={site.expertsIntro} />

            <h3 className="group-label">Testifying experts</h3>
            <div className="expert-grid">
              {testifying.map((p) => (
                <ExpertCard key={p.slug} person={p} />
              ))}
            </div>

            {consulting.length > 0 && (
              <>
                <h3 className="group-label group-label--spaced">Consulting experts</h3>
                <div className="consult-grid">
                  {consulting.map((p) => (
                    <article key={p.slug} id={p.slug} className="consult">
                      <Portrait person={p} size={104} className="consult__portrait" />
                      <h4>{p.name}</h4>
                      <ul className="bullets bullets--tight">
                        {p.highlights.map((h) => (
                          <li key={h}>{inline(h)}</li>
                        ))}
                      </ul>
                      <Link href={`/experts/${p.slug}`} className="strong">
                        Full profile →
                      </Link>
                    </article>
                  ))}
                </div>
              </>
            )}

            {staff.length > 0 && (
              <>
                <h3 className="group-label group-label--spaced">Research staff</h3>
                <div className="staff-grid">
                  {staff.map((p) => (
                    <article key={p.slug} id={p.slug} className="staff">
                      <Portrait person={p} size={88} className="staff__portrait" />
                      <div>
                        <h4>{p.name}</h4>
                        <p>{p.highlights.slice(0, 2).map((h, i) => <span key={h}>{i > 0 && ". "}{inline(h)}</span>)}.</p>
                        <Link href={`/experts/${p.slug}`} className="strong">
                          Full profile →
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="band band--dark" id="engage">
          <div className="wrap section">
            <SectionHead n={5} title="Engaging us" intro={site.engageIntro} />
            <ol className="steps">
              <li>
                <span className="mono-sm">Step 1</span>
                <h3>Send the basics</h3>
                <p>
                  Email <a href={`mailto:${site.email}`}>{site.email}</a> with only what we need to check conflicts:
                </p>
                <ul>
                  {site.conflictsChecklist.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </li>
              <li>
                <span className="mono-sm">Step 2</span>
                <h3>We run conflicts</h3>
                <p>We check every proposed expert and respond promptly about availability and fit.</p>
              </li>
              <li>
                <span className="mono-sm">Step 3</span>
                <h3>Engagement, then materials</h3>
                <p>Once a written engagement agreement is signed, share case materials through the channel we agree on.</p>
              </li>
            </ol>
            <div className="callout">
              <p>
                <strong>Please don’t send confidential information</strong> until the conflicts check is complete and an
                engagement agreement is in place.
              </p>
              <a href={`mailto:${site.email}?subject=Conflicts%20check%20request`} className="btn btn--light">
                Email {site.email}
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
