import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import LoginCard from "./components/LoginCard";
import RegisterCard from "./components/RegisterCard";
import {
  continueDashboardItem,
  fetchConfig,
  fetchAdminDashboard,
  fetchDashboard,
  fetchProfile,
  getSsoLoginUrl,
  requestUpdateDashboardItem,
  submitContribution,
  topUpDashboardItem,
  verifyEmail,
} from "./api";
import { AuthConfig, DashboardItem, DashboardResponse, UserProfile } from "./types";
import logoFull from "./assets/farmwith-logo-full.svg";
import logoIcon from "./assets/farmwith-logo-icon.svg";

interface Idea {
  id: string;
  title: string;
  summary: string;
  location: string;
  timeline: string;
  needs: string[];
  perks: string[];
  tags: string[];
}

interface Site {
  id: string;
  name: string;
  location: string;
  summary: string;
  acreage: string;
  stage: string;
  focus: string[];
  projects: Idea[];
}

type ContributionMode = "funding" | "support";

function safeGetStorage(key: string, type: "local" | "session" = "local") {
  try {
    const storage = type === "local" ? window.localStorage : window.sessionStorage;
    return storage.getItem(key);
  } catch (err) {
    console.warn(`Storage read failed for ${key}:`, err);
    return null;
  }
}

function safeSetStorage(key: string, value: string | null, type: "local" | "session" = "local") {
  try {
    const storage = type === "local" ? window.localStorage : window.sessionStorage;
    if (value === null) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, value);
    }
  } catch (err) {
    console.warn(`Storage write failed for ${key}:`, err);
  }
}

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";

  const stored = safeGetStorage("farmwith_theme");
  if (stored === "dark" || stored === "light") {
    return stored;
  }

  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function PublicHeader({
  isAuthenticated,
  theme,
  onThemeToggle,
  onLoginRequested,
  onAdminRequested,
}: {
  isAuthenticated: boolean;
  theme: "light" | "dark";
  onThemeToggle: () => void;
  onLoginRequested: () => void;
  onAdminRequested: () => void;
}) {
  return (
    <header className="site-header">
      <div className="brand-lockup">
        <img src={logoIcon} alt="FarmWith" className="brand-mark" />
        <div>
          <p className="eyebrow">FarmWith</p>
          <strong>Public farm website</strong>
        </div>
      </div>

      <nav className="site-nav" aria-label="Primary">
        <a href="#story">Story</a>
        <a href="#projects">Projects</a>
        <a href="#access">Access</a>
      </nav>

      <div className="site-actions">
        <button type="button" className="ghost small" onClick={onThemeToggle}>
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <button type="button" className="ghost small" onClick={isAuthenticated ? onAdminRequested : onLoginRequested}>
          {isAuthenticated ? "Admin panel" : "Login"}
        </button>
      </div>
    </header>
  );
}

const currentSiteProjects: Idea[] = [
  {
    id: "goat-sheds",
    title: "Elevated goat farm (4 x 2,400 sq ft sheds)",
    summary:
      "Raised sheds with slatted flooring, ramped loading bays, and mist cooling for heat control. Integrates fodder blocks grown on-site so feed stays local.",
    location: "Tiruvallur, Tamil Nadu",
    timeline: "Ready to break ground in Q1",
    needs: [
      "Structural steel/wood, mesh, and waterline setup for four sheds",
      "Breeding stock sourcing plus vaccinations and deworming plan",
      "Volunteers for flooring, ramps, and rainwater harvesting gutters",
      "Solar lighting for night checks and perimeter safety",
    ],
    perks: [
      "Target 16–18% net/yr after year 2 with herd expansion",
      "On-site fodder brings feed costs down and improves margins",
      "Transparent health logs and weight-gain tracking shared weekly",
    ],
    tags: ["Livestock", "Capex-ready", "Feed-secure"],
  },
  {
    id: "fodder-loop",
    title: "Integrated fodder loop for goats, hens, cows, and fish",
    summary:
      "Multi-cut CO-4/COFS and azolla troughs feeding goats, poultry, and dairy. Leftover greens plus manure get cycled into fish ponds as bio-nutrient feed.",
    location: "Tiruvallur, Tamil Nadu",
    timeline: "Soil prep and seed trenching planned",
    needs: [
      "Drip lines, sprayers, and silage bags for lean months",
      "Pelletizer or chaff cutter for consistent ration sizing",
      "Lab soil test kit and micronutrient plan for the block",
      "Hands to build azolla tanks and shade netting",
    ],
    perks: [
      "Cuts feed procurement volatility and trucking costs",
      "Better feed conversion across goats, hens, and dairy",
      "Excess greens feed fish ponds while reducing waste",
    ],
    tags: ["Fodder", "Circular", "Cost-down"],
  },
  {
    id: "aquaponics",
    title: "Aquaponics fish ponds (4 x 5m dia)",
    summary:
      "Two round ponds for snakehead murrel with two seasonal/optional ponds. Recirculating biofilters reuse goat and poultry manure as safe input after treatment.",
    location: "Tiruvallur, Tamil Nadu",
    timeline: "Liner and aeration procurement open",
    needs: [
      "HDPE liners, paddlewheel aerators, and DO monitoring",
      "Low-head pumps plus solar backup for power cuts",
      "Water-quality testing and FCR tracking sheets",
      "Hands-on help to set up biofilter drums and sump",
    ],
    perks: [
      "Pond/fodder loop keeps input spend predictable",
      "High-value murrel with Tamil Nadu restaurant demand",
      "Seasonal ponds can rotate with leafy greens on rafts",
    ],
    tags: ["Aquaculture", "Circular water", "High demand"],
  },
  {
    id: "poultry-dual",
    title: "Dual poultry barns (broiler + country chicken)",
    summary:
      "Two 2,400 sq ft houses—one for quick broiler cycles, one for native birds with premium pricing. Shared brooding, dosing, and litter management SOPs.",
    location: "Tiruvallur, Tamil Nadu",
    timeline: "Contract grower ties + vet roster in progress",
    needs: [
      "Curtains, foggers, and backup ventilation",
      "Chick procurement and vaccination schedule",
      "Deep-litter turning tools and manure-to-compost channel",
      "Workers for periodic litter removal and shed hygiene",
    ],
    perks: [
      "Broilers give cash flow; country birds add premium margin",
      "Litter converts to compost for fodder and horticulture",
      "Tiered pricing for nearby hotels and butcheries",
    ],
    tags: ["Poultry", "Cashflow", "Compost-ready"],
  },
  {
    id: "dairy-micro",
    title: "Small dairy shed (5 cows + 5 buffalo)",
    summary:
      "Micro-dairy with milking machine, chilling, and a small product room for ghee, paneer, and flavored milk. Uses fodder loop and compost side-stream.",
    location: "Tiruvallur, Tamil Nadu",
    timeline: "Foundation layout drafted",
    needs: [
      "Milking machine, cans, and chilling unit",
      "Breed selection (HF/Jersey cross + Murrah) and AI partner",
      "PPE and hygiene station for milk room",
      "Volunteers for drainage slope and washable flooring",
    ],
    perks: [
      "Fresh milk plus value-added products for nearby town",
      "Dung to vermicompost and slurry to fish ponds",
      "Transparent quality tests shared with contributors",
    ],
    tags: ["Dairy", "Value-added", "Soil health"],
  },
  {
    id: "lease-revenue",
    title: "Lease-out pods with revenue share",
    summary:
      "Offer portions of the 40-acre land for community entrepreneurs with minimal upfront rent and a revenue-share model. FarmWith takes a modest 10% only after 30%+ profit.",
    location: "Tiruvallur, Tamil Nadu",
    timeline: "Parcel map and basic infra listing ready",
    needs: [
      "Interested operators with validated ideas",
      "Shared borewell/power layout and fencing plan",
      "Simple digital agreements for transparent payouts",
      "Community mentors to review proposals",
    ],
    perks: [
      "Low barrier to start for smallholder founders",
      "FarmWith earns only when the idea scales",
      "Shared infrastructure keeps capex lean",
    ],
    tags: ["Community", "Partnership", "Shared infra"],
  },
  {
    id: "value-additions",
    title: "Add-on ideas to strengthen the hub",
    summary:
      "Quick wins layered onto livestock to boost resilience: apiary rows for pollination and honey, vermicompost pits, and a solar dryer for herbs/spices.",
    location: "Tiruvallur, Tamil Nadu",
    timeline: "Pilot blocks can start alongside sheds",
    needs: [
      "Bee boxes and training for handling seasons",
      "Vermicompost beds using poultry + dairy litter",
      "Solar dryer kit for fodder reserves and masala-grade herbs",
      "Local FPO/SHG tie-ups for offtake and training",
    ],
    perks: [
      "Reduces waste and creates new SKUs for urban buyers",
      "Pollination boost for future crop blocks",
      "Hands-on workshops for community contributors",
    ],
    tags: ["Pollination", "Compost", "Workshops"],
  },
  {
    id: "rabbits-soil",
    title: "Rabbit forage & soil builders",
    summary:
      "Rabbits for manure-rich pellets that quickly improve soil tilth and encourage ground cover. Low-water forage (sunhemp, cowpea, azolla) keeps them fed alongside goats and poultry.",
    location: "Tiruvallur, Tamil Nadu",
    timeline: "Can start in parallel with fodder loop",
    needs: [
      "Raised hutches with shade and airflow",
      "Breeding pairs plus basic vaccination plan",
      "Forage strips (sunhemp/cowpea) and cut-and-carry greens",
      "Volunteers to build compost windrows with rabbit manure",
    ],
    perks: [
      "Manure improves soil quickly without heavy inputs",
      "Rabbits thrive on low-water greens, easing fodder pressure",
      "Can sell growers as starter units to nearby farmers",
    ],
    tags: ["Small livestock", "Soil health", "Low water"],
  },
  {
    id: "perimeter-security",
    title: "Perimeter security & access",
    summary:
      "Stage-wise fencing/wall plan with solar lights and cameras to secure sheds, ponds, and equipment while keeping visitor and volunteer access organized.",
    location: "Tiruvallur, Tamil Nadu",
    timeline: "Phase 1 fencing ready to scope",
    needs: [
      "Chain-link stretches now; wall/compound phases later",
      "Corner poles, gates, and cattle grids",
      "Solar streetlights + CCTV covering sheds and ponds",
      "Simple guard/visitor hut with QR/ID logbook",
    ],
    perks: [
      "Protects livestock, feed, and tools across 40 acres",
      "Safer weekend builds and community events",
      "Future-ready access for lease-out pods and logistics",
    ],
    tags: ["Infra", "Safety", "Scalable"],
  },
  {
    id: "dryland-agroforestry",
    title: "Dryland crops & agroforestry strips",
    summary:
      "Groundnut starter plots plus eucalyptus/teak shelterbelts that fit Tiruvallur's water profile. Integrates with fodder and bee rows for diversified income.",
    location: "Tiruvallur, Tamil Nadu",
    timeline: "Pilot beds post-monsoon",
    needs: [
      "Groundnut and millets with basic drip and mulching",
      "Eucalyptus/teak saplings for windbreak rows",
      "Soil tests and moisture sensors to track resilience",
      "Community planting days to establish the belts",
    ],
    perks: [
      "Adds medium-term timber income alongside livestock",
      "Shade/windbreak improves goat and poultry comfort",
      "Soil cover reduces erosion and builds organic matter",
    ],
    tags: ["Crops", "Agroforestry", "Drought-ready"],
  },
  {
    id: "self-sustain-infra",
    title: "Self-sustain utilities & transport base",
    summary:
      "Solar + rainwater capture, a small packhouse/cold store for milk/eggs/fish, and on-farm mobility (EV cart/tractor) so the 40-acre hub runs independent and efficient.",
    location: "Tiruvallur, Tamil Nadu",
    timeline: "Infra scoping alongside sheds",
    needs: [
      "Rooftop/ground-mount solar with battery backup",
      "Rainwater harvesting to recharge ponds and storage",
      "Packhouse/cold-room shell with insulation and racks",
      "Utility vehicle or EV cart for haulage across plots",
    ],
    perks: [
      "Cuts diesel and grid dependence for daily ops",
      "Keeps milk/eggs/fish fresh for Tiruvallur deliveries",
      "Better logistics for volunteers, feed, and harvests",
    ],
    tags: ["Infra", "Utilities", "Logistics"],
  },
  {
    id: "seed-nursery-training",
    title: "Seed nursery, training commons & demo plots",
    summary:
      "A small propagation nursery with shaded demo plots where local farmers, SHGs, and volunteers can learn low-water farming, livestock feed crops, composting, and simple farm ops.",
    location: "Tiruvallur, Tamil Nadu",
    timeline: "Can begin with a basic shade-net setup",
    needs: [
      "Shade net, seed trays, potting mix, and mist lines",
      "Starter seeds for fodder, vegetables, and pollinator plants",
      "Blackboard/whiteboard space for weekend training sessions",
      "Simple storage for tools, labels, and nursery inputs",
    ],
    perks: [
      "Builds local know-how so the farm can scale with better operators",
      "Creates plant stock for fodder rows, agroforestry, and home gardens",
      "Helps the community learn practical, income-ready skills on-site",
    ],
    tags: ["Training", "Nursery", "Community"],
  },
];

const sites: Site[] = [
  {
    id: "tiruvallur-40-acre",
    name: "Tiruvallur 40-acre hub",
    location: "Tiruvallur, Tamil Nadu",
    summary:
      "The current flagship site. All 12 projects below belong to this land parcel and can be funded or supported individually.",
    acreage: "40 acres",
    stage: "Active site",
    focus: ["Goats", "Poultry", "Dairy", "Fodder", "Water", "Training"],
    projects: currentSiteProjects,
  },
];

const verificationRequestsInFlight = new Set<string>();
const verificationRequestsCompleted = new Set<string>();

function IdeaCard({ idea, onContribute }: { idea: Idea; onContribute: (idea: Idea) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="idea-card">
      <div className="idea-header">
        <div>
          <p className="eyebrow">{idea.location}</p>
          <h3>{idea.title}</h3>
          <p className="helper">{idea.summary}</p>
        </div>
        <div className="pill subtle">{idea.timeline}</div>
      </div>
      {!expanded ? (
        <div className="idea-preview">
          <p className="helper">Tap View more to see the needs and impact behind this project.</p>
        </div>
      ) : (
        <div className="idea-body">
          <div>
            <p className="eyebrow">What we need</p>
            <ul>
              {idea.needs.map((need) => (
                <li key={need}>{need}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Why it matters</p>
            <ul>
              {idea.perks.map((perk) => (
                <li key={perk}>{perk}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="idea-footer">
        <div className="tag-row">
          {idea.tags.map((tag) => (
            <span key={tag} className="pill neutral">
              {tag}
            </span>
          ))}
        </div>
        <div className="idea-actions">
          <button type="button" className="ghost" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Show less" : "View more"}
          </button>
          <button type="button" onClick={() => onContribute(idea)}>
            Contribute
          </button>
        </div>
      </div>
    </div>
  );
}

function ContributionPanel({
  idea,
  mode,
  projects,
  site,
  token,
  onClose,
  onSubmitted,
}: {
  idea: Idea | null;
  mode: ContributionMode;
  projects: Idea[];
  site: Site;
  token: string;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const [selectedIdeaId, setSelectedIdeaId] = useState(idea?.id ?? projects[0]?.id ?? "");
  const [contributionType, setContributionType] = useState("Financial support");
  const [pledgeAmount, setPledgeAmount] = useState("");
  const [note, setNote] = useState("I can help with ₹, materials, or my time.");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSubmitted(false);
    setSelectedIdeaId(idea?.id ?? projects[0]?.id ?? "");
    setContributionType(mode === "funding" ? "Financial support" : "Materials / equipment");
    setPledgeAmount("");
    setNote(
      mode === "funding"
        ? "I can support this project financially."
        : "I can help with materials, skills, or my time.",
    );
    setName("");
    setContact("");
    setSubmitting(false);
    setError(null);
  }, [idea, mode, projects]);

  if (!idea) return null;

  const selectedIdea = projects.find((entry) => entry.id === selectedIdeaId) ?? idea;
  const contributionOptions =
    mode === "funding"
      ? ["Financial support"]
      : ["Financial support", "Materials / equipment", "Physical help on-site", "Services (vet, agronomy, design)", "Mentorship / proposal review"];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedIdea) return;

    setSubmitting(true);
    setSubmitted(false);
    setError(null);

    try {
      const parsedPledgeAmount = pledgeAmount.trim() ? Number(pledgeAmount) : undefined;
      await submitContribution(
        {
          site_id: site.id,
          site_name: site.name,
          idea_id: selectedIdea.id,
          idea_title: selectedIdea.title,
          name,
          contact,
          contribution_type: contributionType,
          pledge_amount: parsedPledgeAmount,
          note,
        },
        token,
      );
      setSubmitted(true);
      onSubmitted?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to submit contribution";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="contribution-panel" onClick={onClose} role="presentation">
      <div className="contribution-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <div className="contribution-header">
          <div>
            <p className="eyebrow">{mode === "funding" ? "Fund a project" : "Contribute to"}</p>
            <h3>{mode === "funding" ? "Support a project financially" : selectedIdea.title}</h3>
            <p className="helper">
              {mode === "funding"
                ? "Choose the project you want to fund. This path is for financial help only."
                : "Pick a project and tell us how you want to help. We'll respond with a WhatsApp/Email follow-up."}
            </p>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <form className="contribution-form" onSubmit={handleSubmit}>
          <label>
            Your name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
              required
            />
          </label>
          <label>
            WhatsApp or email
            <input
              value={contact}
              onChange={(event) => setContact(event.target.value)}
              placeholder="e.g., +91 98xxxxxx12 or you@domain.com"
              required
            />
          </label>
          <label>
            Project
            <select value={selectedIdeaId} onChange={(event) => setSelectedIdeaId(event.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Contribution type
            <select
              value={contributionType}
              onChange={(event) => setContributionType(event.target.value)}
              disabled={mode === "funding"}
            >
              {contributionOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            {mode === "funding" && <span className="helper">Quick contribute starts as financial support.</span>}
          </label>
          {(mode === "funding" || contributionType === "Financial support") && (
            <label>
              Pledge amount (INR)
              <input
                value={pledgeAmount}
                onChange={(event) => setPledgeAmount(event.target.value)}
                type="number"
                min="1"
                step="1"
                placeholder="25000"
                required={mode === "funding" || contributionType === "Financial support"}
              />
            </label>
          )}
          <label>
            Note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Share what you can contribute and when."
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Sending..." : "Submit interest"}
          </button>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {submitted && (
            <div className="alert success" role="status">
              Thanks! We've captured your interest for {idea.title}. A FarmWith admin will reach out via {contact || "your contact"}.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function DashboardHero() {
  return (
    <section className="hero-grid">
      <div className="hero-copy">
        <span className="pill">40-acre farm network • Tiruvallur, Tamil Nadu</span>
        <h1>FarmWith turns a working farm into a living online community.</h1>
        <p className="helper">
          We bring the farm online so farmers, families, partners, and local supporters can follow the work, learn
          what is growing, and join the right part of the journey.
        </p>
        <div className="hero-meta">
          <div>
            <p className="eyebrow">Rooted in farming</p>
            <strong>Livestock, fodder, soil, water, and infrastructure</strong>
          </div>
          <div>
            <p className="eyebrow">Built for community</p>
            <strong>Visitors can explore before ever signing in</strong>
          </div>
          <div>
            <p className="eyebrow">Action layer</p>
            <strong>Login is for private updates and admin follow-up</strong>
          </div>
        </div>
      </div>
      <div className="hero-card">
        <p className="eyebrow">How FarmWith works</p>
        <ul>
          <li>Show the farm openly so visitors understand the land and the plan.</li>
          <li>Keep account actions private for members, contributors, and admins.</li>
          <li>Use the website to build trust, not just to collect logins.</li>
        </ul>
        <div className="placeholder">Public browsing first. Login only when you need to act.</div>
      </div>
    </section>
  );
}

function ContributionShortcuts({ onContribute }: { onContribute: (mode: ContributionMode) => void }) {
  return (
    <>
      <div className="card">
        <p className="eyebrow">Join the network</p>
        <h3>Want to support or follow the project?</h3>
        <p className="helper">Login is for people who want to contribute, track progress, or manage the farm activity.</p>
        <div className="shortcut-buttons">
          <Link className="button" to="/login">
            Login
          </Link>
          <button type="button" className="ghost" onClick={() => onContribute("support")}>
            Talk to us
          </button>
        </div>
      </div>
      <div className="card list-card">
        <p className="eyebrow">Farm rhythm</p>
        <ul>
          <li>Heat-ready sheds, monsoon drainage, and backup power planning.</li>
          <li>Local vet, feed, and field support built into daily operations.</li>
          <li>On-site fodder and manure loops to keep the farm steady.</li>
        </ul>
      </div>
      <div className="card list-card">
        <p className="eyebrow">What people can do</p>
        <ul>
          <li>Follow the project stories and see what is happening on the land.</li>
          <li>Support a project once you feel ready.</li>
          <li>Use the private panel for account actions and follow-up.</li>
        </ul>
      </div>
    </>
  );
}

function PublicHomePage({
  theme,
  onThemeToggle,
  onLoginRequested,
  onAdminRequested,
  isAuthenticated,
}: {
  theme: "light" | "dark";
  onThemeToggle: () => void;
  onLoginRequested: () => void;
  onAdminRequested: () => void;
  isAuthenticated: boolean;
}) {
  const site = sites[0];

  return (
    <main className="page site-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <PublicHeader
        isAuthenticated={isAuthenticated}
        theme={theme}
        onThemeToggle={onThemeToggle}
        onLoginRequested={onLoginRequested}
        onAdminRequested={onAdminRequested}
      />

      <section className="hero-showcase">
        <DashboardHero />
        <div className="hero-stack">
          <div className="stack-card card tilt-card">
            <p className="eyebrow">Farm snapshot</p>
            <h3>{site.name}</h3>
            <p className="helper">{site.summary}</p>
            <div className="hero-meta">
              <div>
                <p className="eyebrow">Acreage</p>
                <strong>{site.acreage}</strong>
              </div>
              <div>
                <p className="eyebrow">Projects</p>
                <strong>{site.projects.length}</strong>
              </div>
              <div>
                <p className="eyebrow">Focus</p>
                <strong>Livestock + infra</strong>
              </div>
            </div>
          </div>
          <div className="stack-card card glass-card">
            <p className="eyebrow">Ways to engage</p>
            <div className="button-row">
              <button type="button" onClick={onLoginRequested}>
                Login
              </button>
              <a className="ghost button" href="#projects">
                Explore the farm
              </a>
            </div>
            <p className="helper">
              The public site tells the story. The private area is only for the pieces that need identity, tracking,
              and follow-up.
            </p>
          </div>
        </div>
      </section>

      <section className="stat-grid" id="story">
        <div className="stat-card tilt-card">
          <p className="stat-label">Public story</p>
          <p className="stat-value">Open to visitors</p>
          <p className="stat-detail">Farm goals, land use, and project direction are easy to understand at a glance.</p>
        </div>
        <div className="stat-card tilt-card">
          <p className="stat-label">Private layer</p>
          <p className="stat-value">Members only</p>
          <p className="stat-detail">Login unlocks account actions, progress tracking, and admin follow-up.</p>
        </div>
        <div className="stat-card tilt-card">
          <p className="stat-label">Design language</p>
          <p className="stat-value">Modern farm brand</p>
          <p className="stat-detail">Layered depth, soft glass, and gentle movement keep the site premium.</p>
        </div>
      </section>

      <section className="story-grid" aria-label="FarmWith story">
        <div className="card tilt-card">
          <p className="eyebrow">Why it exists</p>
          <h3>To connect a real farm with a wider community.</h3>
          <p className="helper">FarmWith is a way to make the work visible, trusted, and easier to participate in.</p>
        </div>
        <div className="card tilt-card">
          <p className="eyebrow">What visitors see</p>
          <h3>Stories, projects, and how the farm is taking shape.</h3>
          <p className="helper">Visitors can browse the landscape, the project mix, and the operating vision without logging in.</p>
        </div>
        <div className="card tilt-card">
          <p className="eyebrow">What stays private</p>
          <h3>Account details, follow-up records, and admin tools.</h3>
          <p className="helper">Signed-in users get the private panel for actions that need identity and tracking.</p>
        </div>
      </section>

      <section className="access-grid" id="access">
        <ContributionShortcuts onContribute={() => onLoginRequested()} />
      </section>

      <section className="project-section" id="projects">
        <div className="section-header">
          <div>
            <p className="eyebrow">Projects</p>
            <h2>What the farm is building</h2>
            <p className="helper">A mix of livestock, water, feed, resilience, and community-facing infrastructure.</p>
          </div>
        </div>
        <div className="idea-grid-cards">
          {site.projects.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onContribute={() => {
                onLoginRequested();
              }}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function DashboardActivityCard({
  item,
  onContinue,
  onRequestUpdate,
  onTopUp,
}: {
  item: DashboardItem;
  onContinue: (item: DashboardItem) => void;
  onRequestUpdate: (item: DashboardItem) => void;
  onTopUp: (item: DashboardItem, amount: number) => void;
}) {
  const displayAmount = item.accepted_amount ?? item.requested_amount ?? "";
  const [topUpAmount, setTopUpAmount] = useState(displayAmount ? String(displayAmount) : "");

  useEffect(() => {
    setTopUpAmount(displayAmount ? String(displayAmount) : "");
  }, [displayAmount, item.id]);

  const parsedTopUpAmount = Number(topUpAmount);
  const canTopUp = Number.isFinite(parsedTopUpAmount) && parsedTopUpAmount > 0;
  const isAcceptedFunding = item.classification === "funding" && item.status === "accepted";
  const statusLabel =
    item.status === "open"
      ? "Awaiting admin review"
      : item.classification
        ? `${item.classification} accepted`
        : item.status.replace(/_/g, " ");

  return (
    <article className="activity-card">
      <div className="activity-header">
        <div>
          <p className="eyebrow">{item.site_name}</p>
          <h4>{item.project_title}</h4>
          <p className="helper">
            {item.contribution_type} · {statusLabel}
          </p>
        </div>
        <div className="pill subtle">{new Date(item.updated_at).toLocaleDateString()}</div>
      </div>
      <p className="activity-note">{item.latest_update || item.note || "No update yet."}</p>
      {isAcceptedFunding && (
        <div className="activity-top-up">
          <label>
            Top-up amount
            <input
              value={topUpAmount}
              onChange={(event) => setTopUpAmount(event.target.value)}
              type="number"
              min="1"
              step="1"
              placeholder="10000"
            />
          </label>
          <button type="button" disabled={!canTopUp} onClick={() => onTopUp(item, parsedTopUpAmount)}>
            Top up
          </button>
        </div>
      )}
      <div className="activity-actions">
        <button type="button" className="ghost" onClick={() => onContinue(item)}>
          Continue
        </button>
        <button type="button" className="ghost" onClick={() => onRequestUpdate(item)}>
          Request update
        </button>
      </div>
    </article>
  );
}

function Dashboard({
  profile,
  site,
  selectedSiteId,
  dashboard,
  onSiteChange,
  onContribute,
  onContinue,
  onRequestUpdate,
  onTopUp,
}: {
  profile: UserProfile;
  site: Site;
  selectedSiteId: string;
  dashboard: DashboardResponse | null;
  onSiteChange: (siteId: string) => void;
  onContribute: (idea: Idea, mode?: ContributionMode) => void;
  onContinue: (item: DashboardItem) => void;
  onRequestUpdate: (item: DashboardItem) => void;
  onTopUp: (item: DashboardItem, amount: number) => void;
}) {
  return (
    <section className="dashboard-shell">
      <div className="card heading-card">
        <div>
          <p className="eyebrow">Admin panel</p>
          <h2>{profile.email}</h2>
          <p className="helper">This private area tracks your requests, follows up on support, and exposes admin-style actions.</p>
        </div>
        <div className="pill neutral">Private login</div>
      </div>

      <section className="card dashboard-summary">
          <div>
            <p className="eyebrow">Private dashboard</p>
            <h3>Manage your FarmWith activity</h3>
            <p className="helper">Everything you fund, request, or continue lives here for easy follow-up.</p>
            <p className="helper">
              Active enquiries include every request logged in the app. Open means waiting for admin review, while
              funding and support only count after admin acceptance. Pledged updates once funding is accepted.
            </p>
          </div>
        <div className="summary-grid">
          <div className="stat-mini">
            <span className="eyebrow">Active enquiries</span>
            <strong>{dashboard?.summary.active_items ?? 0}</strong>
          </div>
          <div className="stat-mini">
            <span className="eyebrow">Funding</span>
            <strong>{dashboard?.summary.funding_items ?? 0}</strong>
          </div>
          <div className="stat-mini">
            <span className="eyebrow">Support</span>
            <strong>{dashboard?.summary.support_items ?? 0}</strong>
          </div>
          <div className="stat-mini">
            <span className="eyebrow">Open</span>
            <strong>{dashboard?.summary.open_items ?? 0}</strong>
          </div>
          <div className="stat-mini">
            <span className="eyebrow">Pledged</span>
            <strong>INR {dashboard?.summary.total_pledged ?? "0"}</strong>
          </div>
        </div>
      </section>

      <section className="site-strip">
        <div className="card site-card">
          <p className="eyebrow">Site selector</p>
          <div className="site-row">
            <div>
              <select value={selectedSiteId} onChange={(event) => onSiteChange(event.target.value)}>
                {sites.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
              <p className="helper">{site.summary}</p>
            </div>
            <div className="site-meta">
              <span className="pill neutral">{site.acreage}</span>
              <span className="pill neutral">{site.projects.length} projects</span>
              <span className="pill neutral">{site.stage}</span>
            </div>
          </div>
        </div>
        <div className="card site-card">
          <p className="eyebrow">Site focus</p>
          <div className="tag-row">
            {site.focus.map((tag) => (
              <span key={tag} className="pill neutral">
                {tag}
              </span>
            ))}
          </div>
          <p className="helper">Future sites can be added here later with their own project sets.</p>
        </div>
      </section>

      <DashboardHero />
      <ContributionShortcuts onContribute={(mode) => onContribute(site.projects[0], mode)} />

      <section className="card activity-feed">
        <div className="section-header">
          <div>
            <p className="eyebrow">My active items</p>
            <h3>Continue or top up existing interests</h3>
            <p className="helper">Use these cards to follow up on earlier support requests, funding pledges, or idea submissions.</p>
          </div>
        </div>
        {!dashboard?.items.length ? (
          <div className="placeholder">No activity yet. Your first submission will appear here.</div>
        ) : (
          <div className="activity-grid">
            {dashboard.items.map((item) => (
              <DashboardActivityCard
                key={item.id}
                item={item}
                onContinue={onContinue}
                onRequestUpdate={onRequestUpdate}
                onTopUp={onTopUp}
              />
            ))}
          </div>
        )}
      </section>

      <section className="card recent-activity">
        <div className="section-header">
          <div>
            <p className="eyebrow">Recent activity</p>
            <h3>Latest dashboard events</h3>
          </div>
        </div>
        {!dashboard?.recent_events.length ? (
          <div className="placeholder">No recent events yet.</div>
        ) : (
          <ul className="recent-event-list">
            {dashboard.recent_events.map((event) => (
              <li key={event.id}>
                <strong>{event.project_title}</strong>
                <span>{event.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="idea-grid">
        <div className="section-header">
          <div>
            <p className="eyebrow">Project lineup</p>
            <h3>12 projects under the current 40-acre plan</h3>
            <p className="helper">Each site will have its own projects later. For now, these belong to the current flagship site.</p>
          </div>
        </div>
        <div className="idea-grid-cards">
          {site.projects.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} onContribute={(chosen) => onContribute(chosen)} />
          ))}
        </div>
      </section>

      <section className="card contribution-notes">
        <div>
          <p className="eyebrow">Participation</p>
          <h3>Support can be financial, practical, or advisory.</h3>
          <p className="helper">The platform should feel like a farm community, not just a checkout flow.</p>
        </div>
        <div className="placeholder">
          Private support tools live behind login.
        </div>
      </section>
    </section>
  );
}

function DashboardPage({
  profile,
  token,
  onLogout,
  theme,
  onThemeToggle,
  adminMode = false,
}: {
  profile: UserProfile;
  token: string;
  onLogout: () => void;
  theme: "light" | "dark";
  onThemeToggle: () => void;
  adminMode?: boolean;
}) {
  const [contributionTarget, setContributionTarget] = useState<{ idea: Idea; mode: ContributionMode } | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState(sites[0]?.id ?? "");
  const selectedSite = sites.find((entry) => entry.id === selectedSiteId) ?? sites[0];
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    setContributionTarget(null);
  }, [selectedSiteId]);

  const refreshDashboard = () => {
    setDashboardLoading(true);
    setDashboardError(null);
    const loader = adminMode ? fetchAdminDashboard : fetchDashboard;
    loader(token)
      .then((data) => setDashboard(data))
      .catch((error: unknown) => {
        setDashboardError(error instanceof Error ? error.message : "Unable to load dashboard");
      })
      .finally(() => setDashboardLoading(false));
  };

  useEffect(() => {
    refreshDashboard();
  }, [token]);

  const handleOpenContribution = (idea?: Idea, mode: ContributionMode = "support") => {
    setContributionTarget({ idea: idea ?? selectedSite.projects[0], mode });
  };

  const handleContinueItem = (item: DashboardItem) => {
    continueDashboardItem(item.id, {}, token)
      .then(() => refreshDashboard())
      .catch((error: unknown) => {
        setDashboardError(error instanceof Error ? error.message : "Unable to continue item");
      });
  };

  const handleRequestUpdateItem = (item: DashboardItem) => {
    requestUpdateDashboardItem(item.id, {}, token)
      .then(() => refreshDashboard())
      .catch((error: unknown) => {
        setDashboardError(error instanceof Error ? error.message : "Unable to request update");
      });
  };

  const handleTopUpItem = (item: DashboardItem, amount: number) => {
    topUpDashboardItem(item.id, { amount }, token)
      .then(() => refreshDashboard())
      .catch((error: unknown) => {
        setDashboardError(error instanceof Error ? error.message : "Unable to top up");
      });
  };

  return (
    <main className="page">
      <div className="topbar">
        <Link className="topbar-brand" to="/" aria-label="FarmWith home">
          <img src={logoIcon} alt="FarmWith logo" />
        </Link>
        <div className="topbar-actions">
          <Link className="ghost button" to="/">
            Home
          </Link>
          <Link className="ghost button" to={adminMode ? "/admin/dashboard" : "/dashboard"}>
            {adminMode ? "Admin" : "User"}
          </Link>
          <button type="button" className="ghost" onClick={onThemeToggle}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button type="button" className="ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>

      <Dashboard
        profile={profile}
        site={selectedSite}
        selectedSiteId={selectedSiteId}
        dashboard={dashboard}
        onSiteChange={setSelectedSiteId}
        onContribute={handleOpenContribution}
        onContinue={handleContinueItem}
        onRequestUpdate={handleRequestUpdateItem}
        onTopUp={handleTopUpItem}
      />
      {dashboardLoading && <div className="card">Loading your dashboard activity...</div>}
      {dashboardError && <div className="card alert error">{dashboardError}</div>}
      <ContributionPanel
        idea={contributionTarget?.idea ?? null}
        mode={contributionTarget?.mode ?? "support"}
        projects={selectedSite.projects}
        site={selectedSite}
        token={token}
        onClose={() => setContributionTarget(null)}
        onSubmitted={refreshDashboard}
      />
    </main>
  );
}

function LoginPage({
  loading,
  error,
  theme,
  onThemeToggle,
  onTokenReceived,
  onRegisterRequested,
}: {
  loading: boolean;
  error: string | null;
  theme: "light" | "dark";
  onThemeToggle: () => void;
  onTokenReceived: (token: string, remember: boolean) => void;
  onRegisterRequested: () => void;
}) {
  return (
    <main className="auth-page">
      <div className="auth-shell compact">
        <div className="auth-panel">
          <div>
            <p className="eyebrow" style={{ marginBottom: "0.25rem" }}>
              Welcome back
            </p>
            <h1 className="auth-title">Sign in to FarmWith</h1>
            <p className="helper">
              Access your own account, email verification flow, and password reset from here.
            </p>
          </div>

          <LoginCard
            enableSso={false}
            showSso={false}
            theme={theme}
            onThemeToggle={onThemeToggle}
            onTokenReceived={onTokenReceived}
            onRegisterRequested={onRegisterRequested}
            busy={loading}
          />

          {error && <div className="alert error">{error}</div>}

          <div className="auth-footer-link">
            <p className="helper">Admin users should use the Authentik panel.</p>
            <Link className="ghost button" to="/admin/login">
              Admin login
            </Link>
          </div>
        </div>

        <aside className="auth-aside tilt-card">
          <img src={logoFull} alt="FarmWith full logo" className="brand-full-logo" />
          <div className="auth-aside-copy">
            <p className="eyebrow">Private access</p>
            <h3>What happens after login?</h3>
            <ul>
              <li>You enter your user dashboard and activity view.</li>
              <li>Email/password stays for normal users only.</li>
              <li>Email verification and password reset remain in the flow.</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

function AdminLoginPage({
  loading,
  error,
  theme,
  onThemeToggle,
  onSsoRequested,
}: {
  loading: boolean;
  error: string | null;
  theme: "light" | "dark";
  onThemeToggle: () => void;
  onSsoRequested: () => void;
}) {
  return (
    <main className="auth-page">
      <div className="auth-shell compact">
        <div className="auth-panel">
          <div>
            <p className="eyebrow" style={{ marginBottom: "0.25rem" }}>
              Admin access
            </p>
            <h1 className="auth-title">Admin login</h1>
            <p className="helper">
              This area is reserved for the single admin identity. Regular users should sign in through the user login.
            </p>
          </div>

          <div className="auth-card">
            <button type="button" onClick={onSsoRequested} disabled={loading}>
              Open Admin Panel
            </button>
            {error && <div className="alert error">{error}</div>}
            <Link className="ghost button admin-back-link" to="/login">
              Back to user login
            </Link>
          </div>
        </div>

        <aside className="auth-aside tilt-card">
          <img src={logoFull} alt="FarmWith full logo" className="brand-full-logo" />
          <div className="auth-aside-copy">
            <p className="eyebrow">Admin only</p>
            <h3>Operations, enquiries, and internal follow-up</h3>
            <ul>
              <li>Only the approved Authentik identity can enter.</li>
              <li>All user email logins stay on the public user side.</li>
              <li>Admin sees the full enquiry pipeline and notes.</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

function RegisterPage({
  loading,
  error,
  theme,
  onThemeToggle,
  onLoginRequested,
}: {
  loading: boolean;
  error: string | null;
  theme: "light" | "dark";
  onThemeToggle: () => void;
  onLoginRequested: () => void;
}) {
  return (
    <main className="auth-page">
      <div className="auth-shell compact">
        <div className="auth-panel">
          <div>
            <p className="eyebrow" style={{ marginBottom: "0.25rem" }}>
              Join FarmWith
            </p>
            <h1 className="auth-title">Create your account</h1>
            <p className="helper">
              Register to unlock the private dashboard. Email verification is required before sign-in is allowed.
            </p>
          </div>

          <RegisterCard
            theme={theme}
            onThemeToggle={onThemeToggle}
            onLoginRequested={onLoginRequested}
            busy={loading}
          />

          {error && <div className="alert error">{error}</div>}
        </div>

        <aside className="auth-aside tilt-card">
          <img src={logoFull} alt="FarmWith full logo" className="brand-full-logo" />
          <div className="auth-aside-copy">
            <p className="eyebrow">Secure signup</p>
            <h3>Verification stays in the loop</h3>
            <ul>
              <li>Accounts are verified before login is allowed.</li>
              <li>Phone number and optional company details can be captured.</li>
              <li>The same login can feed the public support workflow later.</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

function VerifyEmailPage({ onVerificationComplete }: { onVerificationComplete: () => void }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [message, setMessage] = useState<string>("Verifying your email...");
  const [isError, setIsError] = useState(false);
  const verificationStartedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setMessage("Verification token is missing.");
      setIsError(true);
      return;
    }

    if (
      verificationStartedRef.current ||
      verificationRequestsInFlight.has(token) ||
      verificationRequestsCompleted.has(token)
    ) {
      return;
    }

    verificationStartedRef.current = true;
    verificationRequestsInFlight.add(token);

    verifyEmail(token)
      .then((response) => {
        verificationRequestsCompleted.add(token);
        setMessage(response.detail);
        setIsError(false);
      })
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Unable to verify email");
        setIsError(true);
      })
      .finally(() => {
        verificationRequestsInFlight.delete(token);
      });
  }, [token]);

  return (
    <main className="auth-page">
      <div className="card" style={{ maxWidth: "560px" }}>
        <h1>Email verification</h1>
        <p className={isError ? "alert error" : "alert success"}>{message}</p>
        <button type="button" onClick={onVerificationComplete}>
          Go to sign in
        </button>
      </div>
    </main>
  );
}

function SsoCallback({ onTokenReceived }: { onTokenReceived: (token: string) => void }) {
  const navigate = useNavigate();
  const query = new URLSearchParams(window.location.search);
  const token = query.get("token");

  useEffect(() => {
    if (token) {
      onTokenReceived(token);
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [token, navigate, onTokenReceived]);

  return (
    <main className="page">
      <div className="card">
        <h2>Completing SSO...</h2>
        <p>You will be redirected shortly.</p>
      </div>
    </main>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [remembered, setRemembered] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => getInitialTheme());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    safeSetStorage("farmwith_theme", theme);
  }, [theme]);

  useEffect(() => {
    fetchConfig()
      .then((data) => {
        setConfig(data);
      })
      .catch((err) => {
        setConfigError(err instanceof Error ? err.message : "Unable to load configuration");
      })
      .finally(() => setConfigLoading(false));
  }, []);

  useEffect(() => {
    const storedPersistent = safeGetStorage("farmwith_token", "local");
    if (storedPersistent) {
      setToken(storedPersistent);
      setRemembered(true);
      return;
    }

    const storedSession = safeGetStorage("farmwith_token", "session");
    if (storedSession) {
      setToken(storedSession);
      setRemembered(false);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      setProfile(null);
      safeSetStorage("farmwith_token", null, "session");
      safeSetStorage("farmwith_token", null, "local");
      return;
    }

    if (remembered) {
      safeSetStorage("farmwith_token", token, "local");
      safeSetStorage("farmwith_token", null, "session");
    } else {
      safeSetStorage("farmwith_token", token, "session");
      safeSetStorage("farmwith_token", null, "local");
    }
  }, [token, remembered]);

  useEffect(() => {
    if (!token) {
      return;
    }

    setProfileLoading(true);
    fetchProfile(token)
      .then((data) => {
        setProfile(data);
        if (data.role === "admin") {
          navigate("/admin/dashboard", { replace: true });
        }
      })
      .catch(() => {
        setProfile(null);
        setToken(null);
        safeSetStorage("farmwith_token", null, "session");
        safeSetStorage("farmwith_token", null, "local");
        navigate("/login", { replace: true });
      })
      .finally(() => setProfileLoading(false));
  }, [token, navigate]);

  const handleToken = (newToken: string, remember: boolean) => {
    setRemembered(remember);
    setToken(newToken);
    navigate("/dashboard");
  };

  const handleSso = () => {
    window.location.href = getSsoLoginUrl();
  };

  const handleSsoCallbackToken = (newToken: string) => {
    setRemembered(false);
    setToken(newToken);
  };

  const handleVerificationComplete = () => {
    navigate("/login", { replace: true });
  };

  const handleLogout = () => {
    setToken(null);
    setProfile(null);
    setRemembered(false);
    safeSetStorage("farmwith_token", null, "session");
    safeSetStorage("farmwith_token", null, "local");
    navigate("/", { replace: true });
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const hasToken = useMemo(() => Boolean(token), [token]);
  const isAuthenticated = useMemo(() => Boolean(token && profile), [token, profile]);
  const goToLogin = () => navigate("/login");
  const goToDashboard = () => navigate("/dashboard");

  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicHomePage
            theme={theme}
            onThemeToggle={toggleTheme}
            onLoginRequested={goToLogin}
            onAdminRequested={goToDashboard}
            isAuthenticated={isAuthenticated}
          />
        }
      />
      <Route
        path="/login"
        element={
          <LoginPage
            loading={configLoading || profileLoading}
            error={configError}
            theme={theme}
            onThemeToggle={toggleTheme}
            onTokenReceived={handleToken}
            onRegisterRequested={() => navigate("/register")}
          />
        }
      />
      <Route
        path="/admin/login"
        element={
          <AdminLoginPage
            loading={configLoading || profileLoading}
            error={configError}
            theme={theme}
            onThemeToggle={toggleTheme}
            onSsoRequested={handleSso}
          />
        }
      />
      <Route
        path="/register"
        element={
          <RegisterPage
            loading={configLoading || profileLoading}
            error={configError}
            theme={theme}
            onThemeToggle={toggleTheme}
            onLoginRequested={() => navigate("/login")}
          />
        }
      />
      <Route path="/verify-email" element={<VerifyEmailPage onVerificationComplete={handleVerificationComplete} />} />
      <Route
        path="/dashboard"
        element={
          isAuthenticated ? (
            <DashboardPage
              profile={profile as UserProfile}
              token={token as string}
              onLogout={handleLogout}
              theme={theme}
              onThemeToggle={toggleTheme}
            />
          ) : hasToken && profileLoading ? (
            <main className="page">
              <div className="card">Loading your session...</div>
            </main>
          ) : configLoading ? (
            <main className="page">
              <div className="card">Loading configuration...</div>
            </main>
          ) : hasToken ? (
            <main className="page">
              <div className="card">Validating your session...</div>
            </main>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          isAuthenticated && profile?.role === "admin" ? (
            <DashboardPage
              profile={profile as UserProfile}
              token={token as string}
              onLogout={handleLogout}
              theme={theme}
              onThemeToggle={toggleTheme}
              adminMode
            />
          ) : hasToken && profileLoading ? (
            <main className="page">
              <div className="card">Loading your session...</div>
            </main>
          ) : (
            <Navigate to="/admin/login" replace />
          )
        }
      />
      <Route path="/sso/callback" element={<SsoCallback onTokenReceived={handleSsoCallbackToken} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
