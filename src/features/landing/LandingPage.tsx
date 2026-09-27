import { useEffect, useRef, useState, type PointerEvent } from 'react';
import './landing.css';

/** Public marketing page. It does not load project data or require authentication. */
export function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Prometheus';
    const updateScrolled = () => setScrolled(window.scrollY > 40);
    updateScrolled();
    window.addEventListener('scroll', updateScrolled, { passive: true });
    return () => {
      document.title = previousTitle;
      window.removeEventListener('scroll', updateScrolled);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: KeyboardEvent | MouseEvent) => {
      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        setMenuOpen(false);
      } else if (event instanceof MouseEvent && !navRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', closeMenu);
    document.addEventListener('click', closeMenu);
    return () => {
      document.removeEventListener('keydown', closeMenu);
      document.removeEventListener('click', closeMenu);
    };
  }, [menuOpen]);

  function handleHeroPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const heroArt = event.currentTarget;
    const rect = heroArt.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    heroArt.style.setProperty('--tilt-x', `${(-y * 7).toFixed(2)}deg`);
    heroArt.style.setProperty('--tilt-y', `${(x * 9).toFixed(2)}deg`);
    heroArt.style.setProperty('--shift-x', `${(x * 8).toFixed(2)}px`);
    heroArt.style.setProperty('--shift-y', `${(y * 6).toFixed(2)}px`);
  }

  function handleHeroPointerLeave(event: PointerEvent<HTMLDivElement>) {
    for (const [key, value] of Object.entries({
      '--tilt-x': '0deg', '--tilt-y': '0deg', '--shift-x': '0px', '--shift-y': '0px',
    })) event.currentTarget.style.setProperty(key, value);
  }

  return (
    <div id="landing-root">
      {/* Anchor must sit in normal flow: sticky headers are already visible and
          do not scroll the document back to the start when targeted. */}
      <div id="top" aria-hidden="true" />
      <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
          <nav className="nav wrap" aria-label="Main navigation" ref={navRef}>
            <a className="brand" href="#top" aria-label="Prometheus, back to top">
              <span className="brand-icon"><span className="mark" aria-hidden="true"></span></span>
              <span><span className="brand-name">Prometheus</span><span className="brand-sub">VIRTUAL OFFICE</span></span>
            </a>
            <div className={`nav-links${menuOpen ? " open" : ""}`} id="navLinks" onClick={() => setMenuOpen(false)}>
              <a href="#platform">The platform</a>
              <a href="#features">What it does</a>
              <a href="#approach">How it works</a>
              <a className="mobile-workspace" href="/login">Open workspace ↗</a>
            </div>
            <a className="nav-button" href="/login">Open workspace <span className="arrow" aria-hidden="true">↗</span></a>
            <button type="button" className="menu-toggle" id="menuToggle" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="navLinks" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? "×" : "☰"}</button>
          </nav>
        </header>
      
        <main>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-grid wrap">
              <div className="hero-copy">
                <span className="label hero-index">A SPACE TO MAKE THINGS HAPPEN</span>
                <h1 id="hero-title" className="serif">Good ideas spark.<br />Teams make them <em>real.</em></h1>
                <p className="hero-description">One place to plan the work, know who's on it, and see it through. From the first conversation to the final outcome.</p>
                <div className="hero-actions">
                  <a className="action-primary" href="/login">Open Prometheus <span aria-hidden="true">↗</span></a>
                  <a className="action-text" href="#platform">Take a look <span aria-hidden="true">↓</span></a>
                </div>
                <span className="label hero-bottom">PROJECTS&nbsp; / &nbsp;PEOPLE&nbsp; / &nbsp;PROGRESS</span>
              </div>
              <div className="hero-art" aria-label="Prometheus holding the Prometheus flame in a dimensional animated hero artwork" onPointerMove={handleHeroPointerMove} onPointerLeave={handleHeroPointerLeave}>
                <div className="art-top"><span>THE PROMETHEUS MARK</span></div>
                <div className="art-logo" role="img" aria-label="Prometheus holding the white Prometheus flame"></div>
                <div className="art-caption"><strong>The fire<br />is shared.</strong><small>01 / THE<br />VIRTUAL OFFICE</small></div>
              </div>
            </div>
          </section>
      
          <div className="statement wrap">
            <span className="label statement-index">WHY PROMETHEUS / 01</span>
            <p>Not another place to keep tabs open. A place where the team can see the plan, the work, and <em>what happens next.</em></p>
          </div>
      
          <section className="product-section" id="platform" aria-labelledby="platform-title">
            <div className="wrap">
              <div className="section-top">
                <div><span className="label">THE PLATFORM / 02</span><h2 className="section-title" id="platform-title">The whole picture.<br />In one window.</h2></div>
                <p className="section-aside">Projects and outcomes are at the center. Schedules, conversations, reviews, and reporting stay close to the work.</p>
              </div>
              <div className="browser-shell" aria-label="Illustrative Prometheus dashboard preview using sample data">
                <div className="browser-top"><div className="traffic" aria-hidden="true"><i></i><i></i><i></i></div><span className="label">PROMETHEUS / HOME</span><span className="label">WORKSPACE</span></div>
                <div className="workspace">
                  <aside className="work-side glass-panel" aria-label="Illustrative workspace navigation">
                    <div className="work-logo"><span className="mark" aria-hidden="true"></span><span>Prometheus<small>VIRTUAL OFFICE</small></span></div>
                    <div className="work-nav">
                      <span className="selected"><i className="nav-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/></svg></i>Home</span>
                      <span><i className="nav-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 7.5h7l2 2h9v10.5H3z"/><path d="M3 7.5V5h7l2 2h9"/></svg></i>Projects</span>
                      <span><i className="nav-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.2"/></svg></i>VisiWork</span>
                      <span><i className="nav-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg></i>Schedule</span>
                      <span><i className="nav-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3.5 20c.2-4 2.2-6 5.5-6s5.3 2 5.5 6M14 15c3.4-.2 5.5 1.5 6 5"/></svg></i>Team</span>
                      <span><i className="nav-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7M2 20h20"/></svg></i>Reports &amp; Analytics</span>
                    </div>
                    <div className="work-nav work-nav-secondary">
                      <span><i className="nav-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 6V4h8v2M8 11h8M8 15h5"/></svg></i>Registry</span>
                      <span><i className="nav-glyph" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg></i>Notifications<span className="side-notification">3</span></span>
                    </div>
                    <div className="workspace-profile"><div className="profile-avatar">PW</div><div className="profile-copy"><b>Team workspace</b><small>Company account</small></div></div>
                  </aside>
      
                  <div className="work-main glass-panel">
                    <div className="work-kicker">COMPANY COMMAND CENTER</div>
                    <div className="work-heading">
                      <div className="work-heading-copy"><h3>Good afternoon, team.</h3><p>Here is what is moving across Prometheus right now.</p></div>
                      <span className="date-chip">TODAY</span>
                    </div>
      
                    <div className="work-metrics">
                      <div className="metric"><small>Working now</small><b>4</b><span>members currently active</span></div>
                      <div className="metric"><small>Active projects</small><b>5</b><span>6 projects total</span></div>
                      <div className="metric"><small>Awaiting review</small><b>3</b><span>items need attention</span></div>
                      <div className="metric"><small>This week</small><b>18.6h</b><span>planned commitment</span></div>
                    </div>
      
                    <div className="dashboard-body">
                      <section className="work-panel projects-panel">
                        <div className="panel-head"><div><h4>My Projects</h4><p className="sub">Projects you lead or contribute to.</p></div><span className="view-all">View all →</span></div>
      
                        <div className="project-group">
                          <div className="project-label"><span>Leading</span><span>2</span></div>
                          <div className="project-card">
                            <div><div className="project-title">Client Management System</div><div className="project-meta"><span className="pill">LEAD</span><span>In Progress</span></div></div>
                            <div className="project-progress"><b>53%</b><i><span style={{ width: '53%' }}></span></i></div>
                          </div>
                          <div className="project-card">
                            <div><div className="project-title">Customer Onboarding Launch</div><div className="project-meta"><span className="pill">LEAD</span><span>In Progress</span></div></div>
                            <div className="project-progress"><b>78%</b><i><span style={{ width: '78%' }}></span></i></div>
                          </div>
                        </div>
      
                        <div className="project-group">
                          <div className="project-label"><span>Participating</span><span>1</span></div>
                          <div className="project-card">
                            <div><div className="project-title">Team Workflow Refresh</div><div className="project-meta"><span className="pill member">MEMBER</span><span>Planning</span></div></div>
                            <div className="project-progress"><b>30%</b><i><span style={{ width: '30%' }}></span></i></div>
                          </div>
                        </div>
                      </section>
      
                      <div className="dashboard-stack">
                        <section className="work-panel"><h4>Working now</h4><p className="sub">4 active members</p><div className="active-list"><div className="active-member"><div className="member-avatar">TM</div><div className="member-copy"><b>Team member</b><small>Design</small></div><span className="status-dot"></span></div><div className="active-member"><div className="member-avatar">TM</div><div className="member-copy"><b>Team member</b><small>Development</small></div><span className="status-dot"></span></div></div></section>
                        <section className="work-panel"><h4>Needs attention</h4><p className="sub">Review and delivery signals.</p><div className="attention"><b>Interface review</b><small>Client Management System · Experience Design &amp; Build</small><span className="review-tag">FOR REVIEW</span></div></section>
                        <section className="work-panel"><h4>Quick access</h4><div className="quick-grid"><span>Projects <i>→</i></span><span>Schedule <i>→</i></span><span>Team <i>→</i></span><span>Reports <i>→</i></span></div></section>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="product-caption"><span>DESIGNED AROUND THE ACTUAL PROMETHEUS WORKSPACE</span><span>ILLUSTRATIVE CONTENT, NOT LIVE DATA</span></div>
            </div>
          </section>
      
          <section className="features" id="features" aria-labelledby="features-title">
            <div className="wrap">
              <div className="section-top"><div><span className="label">EVERYTHING IN ITS PLACE / 03</span><h2 className="section-title" id="features-title">Less chasing.<br />More doing.</h2></div><p className="section-aside">The things a project team needs, without scattering them across a dozen places.</p></div>
              <article className="feature-row"><span className="label feature-no">01</span><h3>Projects with a point.</h3><p>Break work into stages and outcomes. Assign ownership, submit deliverables, and keep reviews connected to the project.</p><span className="feature-arrow" aria-hidden="true">↗</span></article>
              <article className="feature-row"><span className="label feature-no">02</span><h3>Conversations in context.</h3><p>VisiWork, project chat, announcements, mentions, and activity stay near the people and projects they belong to.</p><span className="feature-arrow" aria-hidden="true">↗</span></article>
              <article className="feature-row"><span className="label feature-no">03</span><h3>Time you can account for.</h3><p>See shifts, schedules, attendance, team activity, and reporting together, without losing sight of delivery.</p><span className="feature-arrow" aria-hidden="true">↗</span></article>
              <p className="features-tail">Also included: team management, notifications, role-based access, and a shared home dashboard.</p>
            </div>
          </section>
      
          <section className="process" id="approach" aria-labelledby="approach-title">
            <div className="wrap">
              <div className="process-head"><div><span className="label">HOW WORK MOVES / 04</span><h2 id="approach-title">From a spark<br />to something real.</h2></div><p>No elaborate ritual. Just a clear path from deciding what matters to finishing what you started.</p></div>
              <div className="process-grid">
                <div className="process-step"><span className="label">01 / SET THE DIRECTION</span><h3>Plan it.</h3><p>Make the project visible, define outcomes, and bring the right people into the work.</p></div>
                <div className="process-step"><span className="label">02 / WORK TOGETHER</span><h3>Make it happen.</h3><p>Coordinate schedules, talk through decisions, and keep the work moving.</p></div>
                <div className="process-step"><span className="label">03 / SEE IT THROUGH</span><h3>Deliver it.</h3><p>Review submissions, close the loop, and understand how the project performed.</p></div>
              </div>
            </div>
          </section>
      
          <section className="closing wrap" aria-labelledby="closing-title">
            <div><span className="label">YOUR WORKSPACE IS READY</span><h2 id="closing-title">Good work<br />is a <em>team sport.</em></h2></div>
            <div className="closing-actions"><a className="action-primary" href="/login">Open Prometheus <span aria-hidden="true">↗</span></a></div>
          </section>
        </main>
      
        <footer className="footer"><div className="footer-inner wrap"><a className="brand" href="#top"><span className="brand-icon"><span className="mark" aria-hidden="true"></span></span><span><span className="brand-name">Prometheus</span><span className="brand-sub">VIRTUAL OFFICE</span></span></a><nav className="footer-links" aria-label="Footer navigation"><a href="#platform">Platform</a><a href="#features">Features</a><a href="#approach">Approach</a></nav><span className="footer-note">MADE FOR THE WORK WE DO TOGETHER.</span></div></footer>
    </div>
  );
}
