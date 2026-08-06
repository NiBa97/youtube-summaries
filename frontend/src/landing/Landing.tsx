import { useEffect } from 'react'
import './landing.css'

/* All summary content on this page is taken verbatim from decks the app
   actually generated (see the videos collection): titles, TLDRs, section
   titles, items, and source_start timestamps. Trim, don't invent. */

export function Landing() {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'auto'
    document.documentElement.setAttribute('data-theme', 'paper')
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  return (
    <div className="landing-root">
      <nav className="top">
        <div className="wrap">
          <a className="wordmark" href="/">Reel Notes</a>
          <div className="navlinks">
            <a href="#how">How it works</a>
            <a href="#anatomy">A summary</a>
            <a href="#samples">From the library</a>
            <a href="#features">Particulars</a>
          </div>
          <a className="nav-cta" href="/app">Open the app</a>
        </div>
      </nav>

      <div className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <span className="kicker">A private review of your subscriptions</span>
              <h1>
                <span className="strike">Watch</span> <em>Read</em> your YouTube subscriptions.
              </h1>
              <p className="hero-lede">
                Reel Notes turns YouTube videos into short, typeset summaries — the argument,
                the numbers, the one good quote — each section pointing back to its exact
                moment in the film.
              </p>
              <div className="hero-actions">
                <a className="btn" href="/app">Open the app</a>
                <a className="aside-link" href="#anatomy">or inspect a specimen ↓</a>
              </div>
              <div className="hero-meta">No account — <b>it runs on your machine</b></div>
            </div>

            <div className="desk">
              <div className="card c1">
                <div className="head">
                  <span>AI Reshapes Software Engineering</span>
                  <span className="chip">claim · 1:17 →</span>
                </div>
                <div className="title">Adapting to AI: Spectators vs. Surfers</div>
                <div className="body">
                  Engineers split into 'spectators', who resist or are overwhelmed by AI's rapid
                  advances, and 'surfers', who treat it as an abstraction layer and ride it.
                </div>
              </div>

              <div className="card c2">
                <div className="head">
                  <span>How to Spend Money Smarter</span>
                  <span className="chip">list · 0:40 →</span>
                </div>
                <div className="title">Five questions to guide smarter spending</div>
                <ul>
                  <li><i>01</i>Does this purchase buy me time or steal it?</li>
                  <li><i>02</i>Is this a story (experience) or just a thing (possession)?</li>
                  <li><i>03</i>Does this spending bring me closer to other people?</li>
                </ul>
                <div className="more">+ two more in the summary</div>
              </div>

              <div className="card c3">
                <div className="head">
                  <span>The 7 Levels of Motivation</span>
                  <span className="chip">claim · 5:51 →</span>
                </div>
                <div className="title">Freedom integrates autonomy, mastery, and purpose.</div>
                <div className="body">
                  At the peak, individuals direct their own lives, continuously improve at tasks
                  that matter, and make meaningful contributions.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section id="how" className="alt">
        <div className="wrap">
          <div className="sec-head">
            <span className="kicker">The routine</span>
            <h2>Paste, wait half a minute, <em>read.</em></h2>
            <p>An eight-minute video becomes a two-minute read. A three-hour podcast, six.</p>
          </div>
          <div className="steps">
            <div className="step">
              <span className="n">First,</span>
              <h3>paste a link.</h3>
              <p>
                Any YouTube URL with captions, in any language — the three-hour interview you
                bookmarked in March qualifies.
              </p>
              <div className="visual">
                <div className="urlbar">
                  <span className="h">https://</span>youtube.com/watch?v=iGkVqeFUVNU<span className="caret"></span>
                </div>
                <div className="subrows">
                  <div className="r"><span>How to Spend Money Smarter for Greater Happiness</span><i>queued</i></div>
                  <div className="r"><span>Pantlaza Dinosaur Commander Deck Tech</span><i>queued</i></div>
                </div>
              </div>
            </div>
            <div className="step">
              <span className="n">Then,</span>
              <h3>it is condensed.</h3>
              <p>
                The transcript is distilled into three to seven sections built from five shapes —
                claim, list, metric, quote, timeline — with a two-sentence TLDR on top. Your eyes
                learn the shapes; skimming becomes muscle memory.
              </p>
              <div className="visual">
                <div className="distill">
                  <div className="ln"></div>
                  <div className="ln"></div>
                  <div className="ln"></div>
                  <div className="lab">distilling · 519 s of video</div>
                </div>
              </div>
            </div>
            <div className="step">
              <span className="n">Finally,</span>
              <h3>it files itself.</h3>
              <p>
                Each summary lands on one of your topic shelves and picks up tags from your
                vocabulary. Suggested new tags wait for your approval — the library never grows
                behind your back.
              </p>
              <div className="visual">
                <div className="ministack">
                  <div className="m b1"></div>
                  <div className="m b2"></div>
                  <div className="m top">
                    <div className="t-eye">Career · #ai #software</div>
                    <div className="t-title">AI Reshapes Software Engineering</div>
                    <div className="t-body">Two proposed tags are waiting for your approval.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="anatomy">
        <div className="wrap">
          <div className="sec-head">
            <span className="kicker">Anatomy of a summary</span>
            <h2>A grammar, not a wall of bullets.</h2>
            <p>
              This is a real summary from the library, as the app generated it. Every summary
              reads the same way, so once you have read one, you can skim any of them.
            </p>
          </div>
          <div className="anatomy">
            <div className="page-lg">
              <div className="head">
                <span>How to Spend Money Smarter for Greater Happiness</span>
                <span>7 sections · 8m 39s</span>
              </div>
              <p className="tldr">
                Psychologist research shows that how you spend money impacts happiness more than
                how much you earn. Five science-backed questions can guide purchases to maximize
                joy and avoid common traps like hedonic adaptation.
              </p>
              <div className="sect">
                <div className="meta">
                  <span className="chip">0:40 →</span>
                  <span className="type-label">list · Happy Money Principles</span>
                </div>
                <h4>Five questions to guide smarter spending</h4>
                <ul>
                  <li>Does this purchase buy me time or steal it?</li>
                  <li>Is this a story (experience) or just a thing (possession)?</li>
                  <li>Does this spending bring me closer to other people?</li>
                  <li>Can I make this a treat instead of a new baseline?</li>
                  <li>Can I pay now and enjoy the experience later?</li>
                </ul>
              </div>
              <div className="sect">
                <div className="meta">
                  <span className="chip">1:03 →</span>
                  <span className="type-label">claim · Prioritize Your Time</span>
                </div>
                <h4>Spend money to save time for greater satisfaction.</h4>
                <p>
                  People who spend money on time-saving services — house cleaning, grocery
                  delivery, shorter commutes — report higher life satisfaction than those who
                  buy material goods.
                </p>
              </div>
              <div className="foot">
                <span>5 more sections below</span>
                <span>Reel Notes</span>
              </div>
              <span className="mark" style={{ top: 96, left: -11 }}>1</span>
              <span className="mark" style={{ top: 218, left: -11 }}>2</span>
              <span className="mark" style={{ top: 218, right: -11 }}>3</span>
            </div>
            <div>
              <div className="anno">
                <span className="n">1</span>
                <div>
                  <h4>The TLDR</h4>
                  <p>
                    Every summary opens with two sentences. If that is all you read, you have
                    the gist.
                  </p>
                </div>
              </div>
              <div className="anno">
                <span className="n">2</span>
                <div>
                  <h4>Trust, then verify</h4>
                  <p>
                    Every section carries a timestamp. Click it and the player jumps to the
                    second where the transcript supports the claim.
                  </p>
                </div>
              </div>
              <div className="anno">
                <span className="n">3</span>
                <div>
                  <h4>Sections, not slides</h4>
                  <p>
                    Five shapes — claim, list, metric, quote, timeline — labeled so you always
                    know what you are looking at. Sections can also carry one to three links
                    for independent further reading.
                  </p>
                </div>
              </div>
              <div className="anno">
                <span className="n">✓</span>
                <div>
                  <h4>The commentariat</h4>
                  <p>
                    On request, the comment section is read against the summary. Claims the
                    audience credibly disputes receive a printed caveat, with quotes verified
                    verbatim. Most videos correctly receive nothing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="samples" className="alt">
        <div className="wrap">
          <div className="sec-head">
            <span className="kicker">From the library</span>
            <h2>Real summaries, verbatim.</h2>
            <p>
              Straight from the app's database — titles, TLDRs, and section counts exactly as
              generated.
            </p>
          </div>
          <div className="samples">
            <a className="sample" href="/app">
              <div className="paper">
                <div className="s-head"><span>Summary</span><span>7 sections</span></div>
                <div className="s-title">How to Spend Money Smarter for Greater Happiness</div>
                <div className="s-tldr">
                  How you spend money impacts happiness more than how much you earn. Five
                  science-backed questions can guide purchases to maximize joy.
                </div>
                <div className="s-foot"><span>1 list · 6 claims</span><span>8m 39s source</span></div>
              </div>
              <div className="under">
                <span className="ch">One-shot import</span>
                <span className="rt">2 min read</span>
              </div>
            </a>
            <a className="sample" href="/app">
              <div className="paper">
                <div className="s-head"><span>Summary</span><span>6 sections</span></div>
                <div className="s-title">The 7 Levels of Motivation: From Survival to Freedom</div>
                <div className="s-tldr">
                  Seven distinct levels of motivation, from fear-driven compliance and external
                  rewards to internal drives like growth, purpose, and autonomy.
                </div>
                <div className="s-foot"><span>1 list · 5 claims</span><span>7m 29s source</span></div>
              </div>
              <div className="under">
                <span className="ch">One-shot import</span>
                <span className="rt">2 min read</span>
              </div>
            </a>
            <a className="sample" href="/app">
              <div className="paper">
                <div className="s-head"><span>Summary</span><span>7 sections</span></div>
                <div className="s-title">Pantlaza Dinosaur Commander Deck Tech</div>
                <div className="s-tldr">
                  A Naya Dinosaur Commander deck led by Pantlaza, Sun-Favored, built around
                  discover triggers, free big creatures, and multiple win conditions.
                </div>
                <div className="s-foot"><span>1 claim · 6 lists</span><span>19m 55s source</span></div>
              </div>
              <div className="under">
                <span className="ch">Imported with instructions: “name every card”</span>
                <span className="rt">3 min read</span>
              </div>
            </a>
          </div>
          <div className="channels">
            Works on anything with captions —{' '}
            <b>deck techs</b><i>·</i><b>lectures</b><i>·</i><b>three-hour podcasts</b><i>·</i><b>career advice</b><i>·</i><b>pop science</b>
            {' '}— in any language the video is subtitled in. Summaries always come out in English.
          </div>
        </div>
      </section>

      <section id="features">
        <div className="wrap">
          <div className="sec-head">
            <span className="kicker">Particulars</span>
            <h2>Small courtesies.</h2>
            <p>The things you would build yourself, given a quiet weekend.</p>
          </div>
          <div className="feats">
            <div className="feat">
              <h3>Reader's instructions</h3>
              <p>
                Tell the editor what you care about — “name every Magic card mentioned” — and
                the summary is built around it.
              </p>
            </div>
            <div className="feat">
              <h3>An inbox, not a feed</h3>
              <p>
                Unread, reading, read, starred. No autoplay, no thumbnails, nothing suggested.
                The queue holds only what you gave it.
              </p>
            </div>
            <div className="feat">
              <h3>Shelves and tags</h3>
              <p>
                One topic shelf per video, tags beneath it. Machine-applied tags are marked as
                such and revertible in bulk.
              </p>
            </div>
            <div className="feat">
              <h3>The commentariat</h3>
              <p>
                One button reads the comments against the summary and prints caveats where the
                audience credibly objects.
              </p>
            </div>
            <div className="feat">
              <h3>Further reading</h3>
              <p>
                Sections carry up to three independent sources — papers, data, journalism.
                Never the sponsor's shop.
              </p>
            </div>
            <div className="feat">
              <h3>Entirely yours</h3>
              <p>
                Self-hosted, single user, no accounts. Transcripts are kept, so the library
                re-renders offline, forever.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="alt">
        <div className="pull">
          <p className="q">
            “Finally, the YouTube reader I have wanted for a decade. It treats videos like
            essays — with a thesis, numbers, and a place in the margin for doubt.”
          </p>
          <p className="a">— The first and, so far, only user</p>
        </div>
      </section>

      <div className="cta-band">
        <div className="wrap">
          <div className="inner">
            <div>
              <span className="kicker">Free — it runs on your machine</span>
              <h2>Stop watching.<br />Start <em>reading.</em></h2>
              <p>No account, no email, no feed. Paste your first link and read it on your next coffee.</p>
            </div>
            <div className="actions">
              <a className="btn" href="/app">Open the app</a>
              <div className="sub">One docker-compose · your hardware</div>
            </div>
          </div>
        </div>
      </div>

      <footer>
        <div className="wrap">
          <div className="inner">
            <a className="fm" href="/">Reel Notes</a>
            <div className="flinks">
              <a href="/app">The app</a>
              <a href="#anatomy">A summary</a>
              <a href="#samples">From the library</a>
              <a href="#features">Particulars</a>
            </div>
            <span className="fver">v0.4 · made for readers</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
