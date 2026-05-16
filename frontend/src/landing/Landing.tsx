import { useEffect } from 'react'
import './landing.css'

const ArrowIcon = () => (
  <svg
    className="arr"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
)

const CHANNELS: Array<[string, string, string, string]> = [
  ['A', '#7c5e3c', 'Acquired', '@acquired'],
  ['V', '#2e6f8e', 'Veritasium', '@veritasium'],
  ['L', '#3a3a3a', 'Lex Fridman', '@lexfridman'],
  ['K', '#c44a3a', 'Kurzgesagt', '@kurzgesagt'],
  ['S', '#4a5d4a', 'Stratechery TV', '@stratecherytv'],
  ['T', '#7a4e8c', 'Two Minute Papers', '@twominutepapers'],
  ['T', '#b03a3a', 'Tom Scott', '@tomscott'],
  ['W', '#3e6a8c', 'Wendover', '@wendover'],
  ['C', '#5a7a4a', 'CGP Grey', '@cgpgrey'],
  ['P', '#8c6e3a', 'Practical Engineering', '@practicaleng'],
  ['R', '#3a6a7a', 'Real Engineering', '@realeng'],
  ['M', '#a8893a', 'Mustard', '@mustard'],
  ['P', '#4a4a6a', 'Polymatter', '@polymatter'],
  ['A', '#6a4a4a', 'Asianometry', '@asianometry'],
  ['M', '#3a5a4a', 'Modern MBA', '@modernmba'],
]

function ChannelChip({ letter, color, name, handle }: { letter: string; color: string; name: string; handle: string }) {
  return (
    <span className="channel-chip">
      <span className="cc-dot" style={{ background: color }}>{letter}</span>
      {name}
      <span className="cc-handle">{handle}</span>
    </span>
  )
}

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
        <div className="wrap nav-inner">
          <a href="/" className="brand">
            <span className="brand-mark">R</span>
            Reel Notes
          </a>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#samples">Samples</a>
            <a href="#channels">Channels</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
          </div>
          <div className="nav-cta">
            <a href="#" className="btn btn-ghost">Sign in</a>
            <a href="/app" className="btn btn-primary">
              Try the demo
              <ArrowIcon />
            </a>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">A personal video digest</span>
              <h1>
                <span className="strike">Watch</span> <em>Read</em>
                <br />
                your YouTube
                <br />
                subscriptions.
              </h1>
              <p className="hero-sub">
                Reel Notes turns the channels you follow into a daily reading queue —
                calm, typeset, six minutes apiece. No autoplay. No thumbnails.
                Just the ideas, on paper.
              </p>
              <div className="hero-ctas">
                <a href="/app" className="btn btn-primary btn-lg">
                  Open the demo
                  <ArrowIcon />
                </a>
                <a href="#how" className="btn btn-outline btn-lg">See how it works</a>
              </div>
              <div className="hero-meta">
                <span className="dot"></span>
                <span>NO LOGIN REQUIRED · 12 SAMPLE SUMMARIES INSIDE</span>
              </div>
            </div>

            <div className="hero-visual">
              <div className="slide-card slide-1">
                <div className="pin"></div>
                <div className="slide-header">
                  <span>ACQUIRED</span>
                  <span>6 MIN READ</span>
                </div>
                <div className="slide-body">
                  <div className="slide-eyebrow">Video Summary · 03h ago</div>
                  <div className="slide-title">The Nvidia Decade: How CUDA Became the Moat</div>
                  <div className="slide-tldr">
                    Nvidia's position isn't the GPU — it's 17 years of CUDA libraries that nobody can replicate in a single product cycle.
                  </div>
                </div>
                <div className="slide-footer">
                  <span>— SUMMARY</span>
                  <span>01 / 06</span>
                </div>
                <div className="anno anno-1">Compare vs MI300X</div>
              </div>

              <div className="slide-card slide-2">
                <div className="pin"></div>
                <div className="slide-header">
                  <span>VERITASIUM</span>
                  <span>04 / 06</span>
                </div>
                <div className="slide-body">
                  <div className="slide-eyebrow">By the Numbers</div>
                  <div className="stat-big">5×</div>
                  <div className="stat-caption">fuel burn per seat-mile vs subsonic — why planes don't fly faster anymore.</div>
                </div>
              </div>

              <div className="slide-card slide-3">
                <div className="pin"></div>
                <div className="slide-header">
                  <span>LEX FRIDMAN</span>
                  <span>03 / 09</span>
                </div>
                <div className="slide-body">
                  <div className="quote-mark">&ldquo;</div>
                  <div className="quote-text">Scale is necessary. It is not sufficient.</div>
                  <div className="quote-attrib">— DEMIS HASSABIS</div>
                </div>
              </div>

              <span className="float-tag" style={{ top: -10, left: 30 }}>#ai · #semis</span>
              <span className="float-tag" style={{ bottom: -8, right: 40 }}>double-click to annotate</span>
            </div>
          </div>
        </div>
      </section>

      <section className="flow-section" id="how">
        <div className="wrap">
          <div className="section-eyebrow-row">
            <span className="num">§ 01</span>
            <span className="label">The mechanic</span>
            <span className="line"></span>
          </div>
          <h2 className="section-title">
            From <em>twelve hours</em> of video<br />to twelve minutes of reading.
          </h2>
          <p className="section-lede">
            Point us at the channels you'd otherwise let pile up. Each new upload
            becomes a six-slide deck — TLDR, key points, headline stat, the quote,
            a timeline, a closer. Skim or read; star or skip.
          </p>

          <div className="flow">
            <div className="step">
              <div className="step-num">Step 01</div>
              <h3 className="step-title">Subscribe to channels</h3>
              <p className="step-body">
                Paste a YouTube URL, search a handle, or import your existing
                subscriptions. We've seeded the demo with fifteen channels worth following.
              </p>
              <div className="step-visual">
                <div className="url-bar">
                  <span style={{ color: 'var(--accent)' }}>https://</span>
                  <span>youtube.com/@acquired</span>
                  <span className="caret"></span>
                </div>
                <div className="subs-list">
                  <div className="sub-row"><span className="ch-dot" style={{ background: '#7c5e3c' }}>A</span>Acquired</div>
                  <div className="sub-row"><span className="ch-dot" style={{ background: '#2e6f8e' }}>V</span>Veritasium</div>
                  <div className="sub-row"><span className="ch-dot" style={{ background: '#7a4e8c' }}>T</span>Two Minute Papers</div>
                </div>
              </div>
            </div>

            <div className="step">
              <div className="step-num">Step 02</div>
              <h3 className="step-title">We watch so you don't</h3>
              <p className="step-body">
                New uploads are transcribed, condensed, and typeset into a
                consistent slide grammar. Your queue fills overnight; nothing autoplays, ever.
              </p>
              <div className="step-visual">
                <div className="processing">
                  <div className="scanline">
                    <div className="ln"></div>
                    <div className="ln"></div>
                    <div className="ln"></div>
                  </div>
                  <div className="proc-label">Distilling · 11,340s of video</div>
                </div>
              </div>
            </div>

            <div className="step">
              <div className="step-num">Step 03</div>
              <h3 className="step-title">Read in six minutes</h3>
              <p className="step-body">
                Each summary is six slides. Tap a key point to jump to that moment in the
                source video. Star, annotate, share — or one-shot a single video you found elsewhere.
              </p>
              <div className="step-visual">
                <div className="deck-stack">
                  <div className="deck-mini b1"></div>
                  <div className="deck-mini b2"></div>
                  <div className="deck-mini front">
                    <div className="t-eye">Video Summary</div>
                    <div className="t-title">Aggregation Theory, Ten Years Later</div>
                    <div className="t-body">The thesis still holds — but the surface moved to LLM context.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="anatomy">
        <div className="wrap">
          <div className="section-eyebrow-row">
            <span className="num">§ 02</span>
            <span className="label">Anatomy of a summary</span>
            <span className="line"></span>
          </div>
          <h2 className="section-title">A grammar, not a wall of bullets.</h2>
          <p className="section-lede">
            Every summary follows the same six-slide form, so once you've read one
            you can skim any of them in under a minute.
          </p>

          <div className="anatomy">
            <div className="anatomy-slide">
              <div className="ana-inner">
                <div className="ana-header">
                  <span>ACQUIRED</span>
                  <span>The Nvidia Decade: How CUDA Became the Moat</span>
                </div>
                <div className="ana-eyebrow">Video Summary</div>
                <div className="ana-title">The Nvidia Decade: How CUDA Became the Moat</div>
                <div className="ana-body">
                  Nvidia's position isn't the GPU — it's 17 years of CUDA libraries that nobody can replicate in a single product cycle.
                </div>
                <div className="ana-footer">
                  <span>— SUMMARY</span>
                  <span>01 / 06</span>
                </div>
              </div>

              <div className="callout c1">
                <span className="line"></span>
                <span className="num">1</span>
                <span>Channel byline</span>
              </div>
              <div className="callout c2">
                <span className="num">2</span>
                <span className="line"></span>
                <span>The thesis, in one sentence</span>
              </div>
              <div className="callout c3">
                <span className="line"></span>
                <span className="num">3</span>
                <span>Estimated read time</span>
              </div>
            </div>

            <div className="anatomy-list">
              <div className="anatomy-item">
                <div className="a-num">1</div>
                <div>
                  <h4>The byline</h4>
                  <p>Who made it, when, and how long the original ran — surfaced like a magazine header so you can decide whether to read in two seconds.</p>
                </div>
              </div>
              <div className="anatomy-item">
                <div className="a-num">2</div>
                <div>
                  <h4>The thesis</h4>
                  <p>Every summary opens with one italicized sentence. If you only have time for that, you have the gist.</p>
                </div>
              </div>
              <div className="anatomy-item">
                <div className="a-num">3</div>
                <div>
                  <h4>Predictable form</h4>
                  <p>Key points → headline stat → the quote → timeline → closer. Six slides, always in this order. Skimming becomes muscle memory.</p>
                </div>
              </div>
              <div className="anatomy-item">
                <div className="a-num">4</div>
                <div>
                  <h4>Deep-linked to the source</h4>
                  <p>Every key point carries a timestamp into the original video. Click anything and you're watching the exact second it came from.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="samples-section" id="samples">
        <div className="wrap">
          <div className="section-eyebrow-row">
            <span className="num">§ 03</span>
            <span className="label">Today's queue</span>
            <span className="line"></span>
          </div>
          <h2 className="section-title">Real summaries from the demo.</h2>
          <p className="section-lede">
            These are slides we actually generated for the channels seeded in the
            demo. Open one and read end-to-end in six minutes.
          </p>

          <div className="samples">
            <a href="/app" className="sample">
              <div className="sample-deck">
                <div className="s-meta">
                  <span>ACQUIRED</span>
                  <span>01 / 06</span>
                </div>
                <div className="s-eye">Video Summary</div>
                <div className="s-title">The Nvidia Decade: How CUDA Became the Moat</div>
                <div className="s-tldr">
                  Nvidia's position isn't the GPU — it's 17 years of CUDA libraries that nobody can replicate in a single product cycle.
                </div>
                <div className="s-foot">
                  <span>— SUMMARY</span>
                  <span>3h 09m source</span>
                </div>
              </div>
              <div className="sample-info">
                <div className="s-channel">
                  <span className="ch-dot" style={{ background: '#7c5e3c' }}>A</span>
                  Acquired · @acquired
                </div>
                <div className="s-tags">
                  <span>#ai</span><span>#semis</span><span>#strategy</span>
                </div>
                <div className="read-time">★ 6 min read</div>
              </div>
            </a>

            <a href="/app" className="sample">
              <div className="sample-deck stat-card">
                <div>
                  <div className="s-meta">
                    <span>VERITASIUM</span>
                    <span>03 / 04</span>
                  </div>
                  <div className="s-eye" style={{ marginTop: 14 }}>By the Numbers</div>
                  <div className="big">5×</div>
                  <div className="big-cap">fuel burn per seat-mile vs subsonic flight</div>
                </div>
                <div className="s-foot">
                  <span>— SUMMARY</span>
                  <span>20m source</span>
                </div>
              </div>
              <div className="sample-info">
                <div className="s-channel">
                  <span className="ch-dot" style={{ background: '#2e6f8e' }}>V</span>
                  Veritasium · @veritasium
                </div>
                <div className="s-tags">
                  <span>#aviation</span><span>#physics</span>
                </div>
                <div className="read-time">★ 4 min read</div>
              </div>
            </a>

            <a href="/app" className="sample">
              <div className="sample-deck quote-card">
                <div className="s-meta">
                  <span>LEX FRIDMAN</span>
                  <span>04 / 09</span>
                </div>
                <div className="qm">&ldquo;</div>
                <div className="qt">Scale is necessary. It is not sufficient.</div>
                <div className="qa">— DEMIS HASSABIS</div>
                <div className="s-foot" style={{ marginTop: 24 }}>
                  <span>— SUMMARY</span>
                  <span>2h 44m source</span>
                </div>
              </div>
              <div className="sample-info">
                <div className="s-channel">
                  <span className="ch-dot" style={{ background: '#3a3a3a' }}>L</span>
                  Lex Fridman · @lexfridman
                </div>
                <div className="s-tags">
                  <span>#ai</span><span>#interview</span>
                </div>
                <div className="read-time">★ 9 min read</div>
              </div>
            </a>
          </div>
        </div>
      </section>

      <section className="channels-section" id="channels">
        <div className="channels-head">
          <span className="eyebrow">§ 04 — Coverage</span>
          <h3>From Acquired to Asianometry — the channels you'd otherwise let pile up.</h3>
        </div>
        <div className="marquee">
          <div className="marquee-track">
            {CHANNELS.map(([l, c, n, h], i) => (
              <ChannelChip key={`a-${i}`} letter={l} color={c} name={n} handle={h} />
            ))}
            {CHANNELS.map(([l, c, n, h], i) => (
              <ChannelChip key={`b-${i}`} letter={l} color={c} name={n} handle={h} />
            ))}
          </div>
        </div>
      </section>

      <section id="features">
        <div className="wrap">
          <div className="section-eyebrow-row">
            <span className="num">§ 05</span>
            <span className="label">Built for readers</span>
            <span className="line"></span>
          </div>
          <h2 className="section-title">Small choices, in your favor.</h2>
          <p className="section-lede">
            The things you'd build yourself if you had a quiet weekend.
          </p>

          <div className="features">
            <div className="feature">
              <div className="ficon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h13M3 12h7M3 18h13" />
                  <path d="M16 8l4 4-4 4" strokeWidth="1.8" />
                </svg>
              </div>
              <h4>One-shot summaries</h4>
              <p>Drop any YouTube URL in. Two minutes later it's a deck in your queue — even if it's from a channel you don't subscribe to.</p>
            </div>
            <div className="feature">
              <div className="ficon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4l8 8-8 8H4v-8l8-8Z" />
                </svg>
              </div>
              <h4>Annotate in the margins</h4>
              <p>Double-click any slide to drop a sticky note. Ask yourself a question, jot a counter-thought, flag a citation to verify.</p>
            </div>
            <div className="feature">
              <div className="ficon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <h4>Focus mode</h4>
              <p>Hide the queue, the rail, the chrome. Just the deck, full-bleed, with arrow keys to navigate — like reading on a Kindle.</p>
            </div>
            <div className="feature">
              <div className="ficon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </div>
              <h4>Deep-linked moments</h4>
              <p>Every bullet point carries a timestamp. Click and you're in the original video at the second it came from. Verify, don't trust.</p>
            </div>
            <div className="feature">
              <div className="ficon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
                </svg>
              </div>
              <h4>Paper, sepia, or dark</h4>
              <p>Three themes designed for long sessions. The default looks like a weekend magazine; the dark is for the airplane.</p>
            </div>
            <div className="feature">
              <div className="ficon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4v12m0 0l-5-5m5 5l5-5M4 20h16" />
                </svg>
              </div>
              <h4>Export to anywhere</h4>
              <p>Send a deck to Notion, Obsidian, or PDF. Or just keep it in Reel Notes — your library is searchable across every summary.</p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--surface)', borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
        <div className="wrap">
          <div className="section-eyebrow-row">
            <span className="num">§ 06</span>
            <span className="label">Who it's for</span>
            <span className="line"></span>
          </div>
          <h2 className="section-title">
            For people whose <em>watch later</em><br />queue judges them.
          </h2>

          <div className="use-cases">
            <div className="use-card">
              <div className="use-label">The investor</div>
              <h3>You follow Acquired, Stratechery, and Asianometry.</h3>
              <p>Together they ship eight hours of content a week. You used to listen at 2× on the gym treadmill; now they're six minutes apiece over morning coffee.</p>
              <ul>
                <li>Cross-channel search for the same thesis</li>
                <li>Star a summary to revisit before a partners' meeting</li>
                <li>Export to Notion with one click</li>
              </ul>
            </div>
            <div className="use-card">
              <div className="use-label">The researcher</div>
              <h3>You follow Lex, Veritasium, and Two Minute Papers.</h3>
              <p>Most interviews are 90% pleasantries. You want the load-bearing twenty minutes — the claims, the studies, the disagreements — and a deep link if you want to verify.</p>
              <ul>
                <li>Every key point timestamps back to the source</li>
                <li>Annotate citations and quotes in the margin</li>
                <li>Tag-based filtering across your whole library</li>
              </ul>
            </div>
          </div>

          <div className="pull">
            <p className="pull-text">Finally, the YouTube reader I've been wanting for a decade. It treats videos like essays — with bylines, pull quotes, and a place for marginalia.</p>
            <div className="pull-attrib">— Subscriber #0047, ex-magazine editor</div>
          </div>
        </div>
      </section>

      <section className="cta-section" id="pricing">
        <div className="wrap">
          <div className="cta-card">
            <div>
              <span className="eyebrow">Free during the beta</span>
              <h2>Stop watching.<br />Start <em>reading.</em></h2>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 19, color: 'rgba(244,237,224,.65)', margin: '24px 0 0', maxWidth: 460, lineHeight: 1.5 }}>
                Open the demo, no email required. Twelve summaries already loaded.
                When you're ready, add your own channels.
              </p>
            </div>
            <div className="cta-actions">
              <a href="/app" className="btn btn-primary btn-lg">
                Open the demo
                <ArrowIcon />
              </a>
              <a href="#" className="btn btn-ghost btn-lg">Join the waitlist instead</a>
              <span className="cta-meta">No card · no email · paper, sepia, or dark</span>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <div className="foot">
            <div className="foot-brand">
              <a href="/" className="brand">
                <span className="brand-mark">R</span>
                Reel Notes
              </a>
              <p>A personal video digest. Turn the YouTube channels you follow into a calm, typeset reading queue.</p>
            </div>
            <div>
              <h5>Product</h5>
              <ul>
                <li><a href="/app">Demo</a></li>
                <li><a href="#features">Features</a></li>
                <li><a href="#samples">Samples</a></li>
                <li><a href="#channels">Channels</a></li>
              </ul>
            </div>
            <div>
              <h5>Company</h5>
              <ul>
                <li><a href="#">About</a></li>
                <li><a href="#">Manifesto</a></li>
                <li><a href="#">Changelog</a></li>
                <li><a href="#">Press</a></li>
              </ul>
            </div>
            <div>
              <h5>Elsewhere</h5>
              <ul>
                <li><a href="#">Newsletter</a></li>
                <li><a href="#">Twitter</a></li>
                <li><a href="#">RSS</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 REEL NOTES · MADE FOR READERS</span>
            <span>v0.4 · BETA</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
