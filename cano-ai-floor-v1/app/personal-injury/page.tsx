"use client";

import {
  Activity,
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Compass,
  ExternalLink,
  FileSearch,
  Filter,
  Gauge,
  Handshake,
  HeartPulse,
  Inbox,
  Landmark,
  Mail,
  MapPin,
  Megaphone,
  MessageSquareText,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundCheck,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./personal-injury.module.css";

type TabId =
  | "referrals"
  | "leads"
  | "campaigns"
  | "compliance";

type ReferralStatus =
  | "new"
  | "researching"
  | "approved"
  | "contacted"
  | "replied"
  | "meeting"
  | "partner"
  | "not_fit";

type LeadStatus =
  | "new"
  | "qualifying"
  | "consult"
  | "signed"
  | "lost"
  | "compliance_hold";

type PiAgent = {
  id: string;
  name: string;
  role: string;
  shortRole: string;
  description: string;
  zone: "manager" | "growth";
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  capabilities: string[];
  output: string[];
  status: "ready" | "working" | "review";
};

type ReferralContact = {
  id: string;
  prospect_id: string;
  apollo_person_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  title: string;
  seniority: string;
  email: string;
  phone: string;
  linkedin_url: string;
  priority: number;
  selected_for_outreach: boolean;
  enrichment_status: string;
  email_status: string;
  is_demo?: boolean;
};

type ReferralProspect = {
  id: string;
  organization_name: string;
  contact_name: string;
  category: string;
  practice_area?: string;
  city: string;
  state: string;
  website: string;
  email: string;
  phone: string;
  why_fit: string;
  source_url: string;
  relationship_status: ReferralStatus;
  score: number;
  apollo_organization_id?: string;
  organization_domain?: string;
  contacts?: ReferralContact[];
  last_contact_at?: string | null;
  next_follow_up_at?: string | null;
  is_demo?: boolean;
};

type ApolloBudget = {
  limit: number;
  used: number;
  remaining: number;
  window_minutes: number;
};

type PiLead = {
  id: string;
  name: string;
  source: string;
  accident_type: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  summary: string;
  urgency: "high" | "medium" | "low";
  status: LeadStatus;
  created_at: string;
  is_demo?: boolean;
};

type Campaign = {
  id: string;
  name: string;
  channel: string;
  status: "active" | "draft" | "paused";
  leads: number;
  consults: number;
  signed: number;
  spend: number;
  is_demo?: boolean;
};

type WorkspacePayload = {
  ok: boolean;
  referrals: ReferralProspect[];
  leads: PiLead[];
  campaigns: Campaign[];
  apolloBudget: ApolloBudget;
};

const agents: PiAgent[] = [
  {
    id: "catalyst",
    name: "Catalyst",
    role: "PI Growth Manager",
    shortRole: "Growth",
    description:
      "Coordinates the Personal Injury growth floor: referral development, inbound lead performance, campaign priorities, and revenue attribution.",
    zone: "manager",
    icon: TrendingUp,
    capabilities: [
      "Set growth priorities",
      "Rank referral and lead opportunities",
      "Coordinate campaigns",
      "Surface conversion bottlenecks",
      "Prepare weekly growth briefs",
    ],
    output: [
      "Growth brief",
      "Priority queue",
      "Channel scorecard",
      "Pipeline summary",
    ],
    status: "ready",
  },
  {
    id: "scout",
    name: "Scout",
    role: "Referral Intelligence Manager",
    shortRole: "Referrals",
    description:
      "Finds and enriches professional referral opportunities, explains why each relationship may fit, and sends approved prospects into outreach.",
    zone: "manager",
    icon: Handshake,
    capabilities: [
      "Discover professional referral targets",
      "Enrich public business contact information",
      "Score relationship fit",
      "Track source provenance",
      "Prepare human-review queues",
    ],
    output: [
      "Referral prospect list",
      "Contact records",
      "Fit rationale",
      "Source links",
    ],
    status: "ready",
  },
  {
    id: "pulse",
    name: "Pulse",
    role: "Lead Operations Manager",
    shortRole: "Leads",
    description:
      "Owns the inbound PI lead queue from calls, forms, advertising, directories, referrals, and future integrations.",
    zone: "manager",
    icon: HeartPulse,
    capabilities: [
      "Deduplicate leads",
      "Prioritize response speed",
      "Track source attribution",
      "Route qualified leads",
      "Measure consult and signed-case conversion",
    ],
    output: [
      "Lead queue",
      "Qualification status",
      "Source attribution",
      "Conversion report",
    ],
    status: "ready",
  },
  {
    id: "beacon",
    name: "Beacon",
    role: "Market Intelligence Manager",
    shortRole: "Market Intel",
    description:
      "Researches PI demand, competitors, directories, geographic opportunities, and campaign gaps without making autonomous spend decisions.",
    zone: "manager",
    icon: Compass,
    capabilities: [
      "Market and competitor research",
      "Directory opportunity research",
      "Geo opportunity mapping",
      "Search-theme research",
      "Campaign intelligence",
    ],
    output: [
      "Opportunity map",
      "Competitor notes",
      "Directory list",
      "Campaign research",
    ],
    status: "ready",
  },
  {
    id: "bridge",
    name: "Bridge",
    role: "Professional Referral Scout",
    shortRole: "Referral Scout",
    description:
      "Builds prospect lists of attorneys, firms, and professional organizations that may have complementary referral relationships.",
    zone: "growth",
    icon: UsersRound,
    capabilities: [
      "Attorney and firm prospecting",
      "Practice-area filtering",
      "Geographic filtering",
      "Contact-source collection",
      "Duplicate checking",
    ],
    output: ["Prospect queue", "Public contact data", "Fit notes"],
    status: "ready",
  },
  {
    id: "reach",
    name: "Reach",
    role: "Outreach Drafting Agent",
    shortRole: "Outreach",
    description:
      "Drafts professional referral outreach for human approval. It does not auto-contact accident victims.",
    zone: "growth",
    icon: Send,
    capabilities: [
      "Draft referral introductions",
      "Personalize approved outreach",
      "Prepare email and LinkedIn copy",
      "Preserve compliance notes",
      "Require approval before send",
    ],
    output: ["Outreach drafts", "Approval queue", "Message variants"],
    status: "review",
  },
  {
    id: "orbit",
    name: "Orbit",
    role: "Relationship Follow-Up Agent",
    shortRole: "Follow-Up",
    description:
      "Tracks follow-up timing, replies, meetings, and referral-partner relationship history.",
    zone: "growth",
    icon: CalendarClock,
    capabilities: [
      "Follow-up reminders",
      "Relationship-stage tracking",
      "Meeting follow-up",
      "Referral attribution",
      "Dormant-relationship alerts",
    ],
    output: ["Follow-up queue", "Relationship history", "Referral log"],
    status: "ready",
  },
  {
    id: "radar",
    name: "Radar",
    role: "PI Demand Research Agent",
    shortRole: "Demand",
    description:
      "Researches high-intent PI demand, geographic gaps, search themes, and market opportunities for attorney review.",
    zone: "growth",
    icon: Search,
    capabilities: [
      "Search-demand research",
      "Geo comparisons",
      "High-value case-type research",
      "Local-market gap detection",
      "Trend monitoring",
    ],
    output: ["Demand map", "Search themes", "Geo opportunities"],
    status: "ready",
  },
  {
    id: "launch",
    name: "Launch",
    role: "Paid Media Intelligence Agent",
    shortRole: "Paid Media",
    description:
      "Organizes Google and Meta campaign performance and proposes tests; budget and creative changes remain human-approved.",
    zone: "growth",
    icon: Megaphone,
    capabilities: [
      "Campaign scorecards",
      "Keyword and creative analysis",
      "Lead-quality comparisons",
      "Budget-shift proposals",
      "Landing-page observations",
    ],
    output: ["Campaign brief", "Test ideas", "Waste alerts"],
    status: "ready",
  },
  {
    id: "intake",
    name: "Intake",
    role: "PI Lead Qualifier",
    shortRole: "Qualifier",
    description:
      "Structures incoming PI lead facts, urgency, treatment status, liability indicators, insurance information, and missing intake questions.",
    zone: "growth",
    icon: UserRoundCheck,
    capabilities: [
      "Lead intake structuring",
      "Urgency detection",
      "Missing-question detection",
      "Consult routing",
      "Conflict/compliance hold flags",
    ],
    output: ["Lead brief", "Missing questions", "Consult priority"],
    status: "ready",
  },
  {
    id: "ledger",
    name: "Ledger",
    role: "Lead Attribution Agent",
    shortRole: "Attribution",
    description:
      "Connects leads, consults, signed matters, referral sources, and marketing spend so the firm can see what actually produces cases.",
    zone: "growth",
    icon: CircleDollarSign,
    capabilities: [
      "Source attribution",
      "CAC reporting",
      "Referral attribution",
      "Signed-case conversion",
      "Channel comparisons",
    ],
    output: ["Attribution table", "CAC summary", "Source ROI"],
    status: "ready",
  },
  {
    id: "guard",
    name: "Guard",
    role: "Marketing Compliance Gate",
    shortRole: "Compliance",
    description:
      "Flags outreach, ads, lead vendors, and solicitation workflows that need attorney or Florida Bar compliance review before activation.",
    zone: "growth",
    icon: ShieldCheck,
    capabilities: [
      "Human-approval gates",
      "Lead-vendor review queue",
      "Outreach-type classification",
      "Ad-review tracking",
      "Compliance notes",
    ],
    output: ["Compliance queue", "Approval status", "Blocked actions"],
    status: "review",
  },
];

const demoReferrals: ReferralProspect[] = [
  {
    id: "demo-ref-1",
    organization_name: "Immigration-focused firm · Miami",
    contact_name: "Referral partner prospect",
    category: "Attorney · Immigration",
    practice_area: "Immigration",
    city: "Miami",
    state: "FL",
    website: "",
    email: "",
    phone: "",
    why_fit:
      "Complementary practice area with substantial client overlap and no PI positioning identified in the preview record.",
    source_url: "",
    relationship_status: "new",
    contacts: [
      {
        id: "demo-contact-1",
        prospect_id: "demo-ref-1",
        apollo_person_id: "preview-1",
        first_name: "Managing",
        last_name: "Partner",
        full_name: "Managing Partner · Preview",
        title: "Managing Partner",
        seniority: "partner",
        email: "",
        phone: "",
        linkedin_url: "",
        priority: 1,
        selected_for_outreach: true,
        enrichment_status: "preview",
        email_status: "",
        is_demo: true,
      },
      {
        id: "demo-contact-2",
        prospect_id: "demo-ref-1",
        apollo_person_id: "preview-2",
        first_name: "Partner",
        last_name: "Two",
        full_name: "Second Partner · Preview",
        title: "Partner",
        seniority: "partner",
        email: "",
        phone: "",
        linkedin_url: "",
        priority: 2,
        selected_for_outreach: false,
        enrichment_status: "preview",
        email_status: "",
        is_demo: true,
      },
    ],
    score: 92,
    is_demo: true,
  },
  {
    id: "demo-ref-2",
    organization_name: "Estate & Probate practice · South Florida",
    contact_name: "Referral partner prospect",
    category: "Attorney · Probate",
    practice_area: "Probate / Estate",
    city: "Fort Lauderdale",
    state: "FL",
    website: "",
    email: "",
    phone: "",
    why_fit:
      "Potential wrongful-death and serious-injury referral overlap. Requires Scout verification before outreach.",
    source_url: "",
    relationship_status: "researching",
    score: 84,
    is_demo: true,
  },
  {
    id: "demo-ref-3",
    organization_name: "Out-of-state litigation firm · Preview",
    contact_name: "Florida co-counsel prospect",
    category: "Attorney · Out-of-State",
    practice_area: "General Litigation",
    city: "Atlanta",
    state: "GA",
    website: "",
    email: "",
    phone: "",
    why_fit:
      "Potential Florida local-counsel and referral relationship. Public contact and practice fit still need verification.",
    source_url: "",
    relationship_status: "approved",
    score: 78,
    is_demo: true,
  },
];

const demoLeads: PiLead[] = [
  {
    id: "demo-lead-1",
    name: "Preview lead · Auto collision",
    source: "Google Ads",
    accident_type: "Car Accident",
    city: "Miami",
    state: "FL",
    phone: "",
    email: "",
    summary:
      "Preview only: inbound caller reports recent collision, medical treatment started, liability intake incomplete.",
    urgency: "high",
    status: "new",
    created_at: new Date().toISOString(),
    is_demo: true,
  },
  {
    id: "demo-lead-2",
    name: "Preview lead · Commercial vehicle",
    source: "Referral",
    accident_type: "Truck Accident",
    city: "Orlando",
    state: "FL",
    phone: "",
    email: "",
    summary:
      "Preview only: professional referral. Commercial-vehicle and insurance details still need intake confirmation.",
    urgency: "high",
    status: "qualifying",
    created_at: new Date().toISOString(),
    is_demo: true,
  },
];

const demoCampaigns: Campaign[] = [
  {
    id: "demo-campaign-1",
    name: "Car Accident · Search",
    channel: "Google Ads",
    status: "active",
    leads: 0,
    consults: 0,
    signed: 0,
    spend: 0,
    is_demo: true,
  },
  {
    id: "demo-campaign-2",
    name: "Wrongful Death · Search",
    channel: "Google Ads",
    status: "draft",
    leads: 0,
    consults: 0,
    signed: 0,
    spend: 0,
    is_demo: true,
  },
  {
    id: "demo-campaign-3",
    name: "PI Education · Social",
    channel: "Meta",
    status: "draft",
    leads: 0,
    consults: 0,
    signed: 0,
    spend: 0,
    is_demo: true,
  },
];

const referralStages: { value: ReferralStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "researching", label: "Researching" },
  { value: "approved", label: "Approved" },
  { value: "contacted", label: "Contacted" },
  { value: "replied", label: "Replied" },
  { value: "meeting", label: "Meeting" },
  { value: "partner", label: "Partner" },
  { value: "not_fit", label: "Not Fit" },
];

const leadStages: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "qualifying", label: "Qualifying" },
  { value: "consult", label: "Consult" },
  { value: "signed", label: "Signed" },
  { value: "lost", label: "Lost" },
  { value: "compliance_hold", label: "Compliance Hold" },
];

function agentDot(status: PiAgent["status"]) {
  if (status === "working") return styles.dotWorking;
  if (status === "review") return styles.dotReview;
  return styles.dotReady;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}


function referralPracticeLabel(prospect: ReferralProspect) {
  const explicit = String(prospect.practice_area || "").trim();

  if (explicit) return explicit;

  const category = String(prospect.category || "")
    .replace(/^Attorney\s*·\s*/i, "")
    .trim();

  if (
    category &&
    !/unknown|review|professional referral candidate/i.test(category)
  ) {
    return category;
  }

  return "Practice area pending";
}

function referralLocationLabel(prospect: ReferralProspect) {
  return [prospect.city, prospect.state]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ") || "Location pending";
}

export default function PersonalInjuryFloor() {
  const [selectedAgent, setSelectedAgent] = useState<PiAgent | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("referrals");
  const [workspace, setWorkspace] = useState<WorkspacePayload>({
    ok: true,
    referrals: [],
    leads: [],
    campaigns: [],
    apolloBudget: {
      limit: 10,
      used: 0,
      remaining: 10,
      window_minutes: 60,
    },
  });
  const [loading, setLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [referralFilter, setReferralFilter] = useState<ReferralStatus | "all">(
    "all"
  );
  const [leadFilter, setLeadFilter] = useState<LeadStatus | "all">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [agentMessage, setAgentMessage] = useState("");

  async function loadWorkspace() {
    setLoading(true);
    setWorkspaceError("");

    try {
      const res = await fetch("/api/pi/workspace", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Unable to load PI workspace.");
      }

      setWorkspace({
        ok: true,
        referrals: Array.isArray(data.referrals) ? data.referrals : [],
        leads: Array.isArray(data.leads) ? data.leads : [],
        campaigns: Array.isArray(data.campaigns) ? data.campaigns : [],
        apolloBudget:
          data?.apolloBudget &&
          typeof data.apolloBudget === "object"
            ? data.apolloBudget
            : {
                limit: 10,
                used: 0,
                remaining: 10,
                window_minutes: 60,
              },
      });
    } catch (error) {
      setWorkspaceError(
        error instanceof Error
          ? error.message
          : "Unable to load PI workspace."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const realDataExists =
    workspace.referrals.length > 0 ||
    workspace.leads.length > 0 ||
    workspace.campaigns.length > 0;

  const referrals = realDataExists
    ? workspace.referrals
    : demoReferrals;

  const leads = realDataExists
    ? workspace.leads
    : demoLeads;

  const campaigns = realDataExists
    ? workspace.campaigns
    : demoCampaigns;

  const previewMode = !realDataExists;

  const managerAgents = agents.filter((agent) => agent.zone === "manager");
  const growthAgents = agents.filter((agent) => agent.zone === "growth");

  const filteredReferrals = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    return referrals.filter((item) => {
      const matchesFilter =
        referralFilter === "all" ||
        item.relationship_status === referralFilter;

      const matchesSearch =
        !needle ||
        [
          item.organization_name,
          item.contact_name,
          item.category,
          item.practice_area,
          item.city,
          item.state,
          item.why_fit,
          ...(Array.isArray(item.contacts)
            ? item.contacts.flatMap((contact) => [
                contact.full_name,
                contact.title,
                contact.email,
              ])
            : []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);

      return matchesFilter && matchesSearch;
    });
  }, [referrals, searchTerm, referralFilter]);

  const filteredLeads = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();

    return leads.filter((item) => {
      const matchesFilter =
        leadFilter === "all" || item.status === leadFilter;

      const matchesSearch =
        !needle ||
        [
          item.name,
          item.source,
          item.accident_type,
          item.city,
          item.state,
          item.summary,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);

      return matchesFilter && matchesSearch;
    });
  }, [leads, searchTerm, leadFilter]);

  const referralPartners = referrals.filter(
    (item) => item.relationship_status === "partner"
  ).length;

  const openReferralWork = referrals.filter(
    (item) =>
      !["partner", "not_fit"].includes(item.relationship_status)
  ).length;

  const newLeads = leads.filter((lead) => lead.status === "new").length;
  const consults = leads.filter((lead) => lead.status === "consult").length;
  const signed = leads.filter((lead) => lead.status === "signed").length;
  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === "active"
  ).length;

  async function runPiAgent(
    agentId: "scout" | "pulse" | "beacon" | "guard",
    requestPayload: Record<string, any> = {}
  ) {
    if (runningAgent) return;

    setRunningAgent(agentId);
    setAgentMessage("");

    try {
      const res = await fetch("/api/pi/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          request: requestPayload,
        }),
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `Unable to start ${agentId}.`);
      }

      setAgentMessage(
        data?.message ||
          `${agentId} accepted the request. Refresh the workspace after the workflow finishes.`
      );

      window.setTimeout(() => {
        void loadWorkspace();
      }, 1800);
    } catch (error) {
      setAgentMessage(
        error instanceof Error
          ? error.message
          : `Unable to start ${agentId}.`
      );
    } finally {
      setRunningAgent(null);
    }
  }

  async function updateReferralContact(
    contactId: string,
    selectedForOutreach: boolean
  ) {
    const allContacts = referrals.flatMap(
      (referral) => referral.contacts || []
    );

    const contact = allContacts.find(
      (item) => item.id === contactId
    );

    if (!contact || contact.is_demo) return;

    setUpdatingId(contactId);

    try {
      const res = await fetch("/api/pi/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_referral_contact",
          id: contactId,
          selected_for_outreach: selectedForOutreach,
        }),
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(
          data?.error || "Unable to update referral contact."
        );
      }

      await loadWorkspace();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to update referral contact."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateReferralStatus(id: string, status: ReferralStatus) {
    const item = referrals.find((referral) => referral.id === id);
    if (!item || item.is_demo) return;

    setUpdatingId(id);

    try {
      const res = await fetch("/api/pi/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_referral_status",
          id,
          status,
        }),
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Unable to update referral.");
      }

      await loadWorkspace();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to update referral."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function updateLeadStatus(id: string, status: LeadStatus) {
    const item = leads.find((lead) => lead.id === id);
    if (!item || item.is_demo) return;

    setUpdatingId(id);

    try {
      const res = await fetch("/api/pi/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_lead_status",
          id,
          status,
        }),
      });

      const data = await res.json();

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || "Unable to update lead.");
      }

      await loadWorkspace();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to update lead."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/">
          <div className={styles.brandMark}>C</div>
          <div>
            <div className={styles.brandTitle}>CANO LAW FIRM</div>
            <div className={styles.brandSubtitle}>AI LEGAL OPERATIONS FLOOR</div>
          </div>
        </a>

        <div className={styles.topActions}>
          <a className={styles.floorBack} href="/">
            <ArrowLeft size={15} />
            Immigration Floor
          </a>

          <div className={styles.systemPill}>
            <span />
            PI Systems Ready
          </div>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>
            <Building2 size={15} />
            CANO AI OFFICE · FLOOR 02
          </div>

          <h1>Personal Injury Growth Floor</h1>

          <p>
            Referral development, inbound lead operations, market intelligence,
            campaign performance, and compliance-gated outreach — all in one
            attorney-controlled workspace.
          </p>

          <div className={styles.guardrailLine}>
            <ShieldCheck size={14} />
            Professional referral outreach and inbound lead growth only.
            Consumer solicitation and outbound victim contact remain blocked
            unless separately reviewed and approved.
          </div>
        </div>

        <div className={styles.heroStats}>
          <MetricCard
            icon={Handshake}
            value={openReferralWork}
            label="referral opportunities"
          />
          <MetricCard
            icon={Inbox}
            value={newLeads}
            label="new PI leads"
          />
          <MetricCard
            icon={UserRoundCheck}
            value={consults}
            label="consults"
          />
          <MetricCard
            icon={CheckCircle2}
            value={signed}
            label="signed matters"
          />
        </div>
      </section>

      {previewMode && (
        <section className={styles.previewBanner}>
          <Sparkles size={15} />
          <div>
            <strong>Preview mode</strong>
            <span>
              The floor is fully rendered, but the cards below are sample data
              until you run the included Supabase SQL and begin populating the
              PI workspace.
            </span>
          </div>
        </section>
      )}

      {workspaceError && (
        <section className={styles.errorBanner}>
          <strong>PI database connection needs attention</strong>
          <span>{workspaceError}</span>
        </section>
      )}

      {agentMessage && (
        <section className={styles.agentBanner}>
          <Sparkles size={15} />
          <div>
            <strong>PI agent workflow</strong>
            <span>{agentMessage}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss PI agent message"
            onClick={() => setAgentMessage("")}
          >
            <X size={14} />
          </button>
        </section>
      )}

      <section className={styles.floorWrap}>
        <div className={styles.sectionHeading}>
          <span>VISUAL FLOOR VIEW</span>
          <small>Click a desk to inspect the agent</small>
        </div>

        <div className={styles.floorBoard}>
          <div className={styles.floorLabels}>
            <span>MANAGER OFFICES</span>
            <span>GROWTH & INTAKE AGENT FLOOR</span>
          </div>

          <div className={styles.floorLayout}>
            <div className={styles.managerBox}>
              <div className={styles.managerGrid}>
                {managerAgents.map((agent) => (
                  <AgentDesk
                    key={agent.id}
                    agent={agent}
                    onOpen={setSelectedAgent}
                  />
                ))}
              </div>
            </div>

            <div className={styles.floorDivider} />

            <div className={styles.openFloorBox}>
              <div className={styles.openFloorGrid}>
                {growthAgents.map((agent) => (
                  <AgentDesk
                    key={agent.id}
                    agent={agent}
                    onOpen={setSelectedAgent}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.operationWrap}>
        <div className={styles.sectionHeading}>
          <span>PI GROWTH COMMAND CENTER</span>
          <small>
            Referral pipeline, incoming leads, campaign intelligence, and
            compliance controls
          </small>
        </div>

        <div className={styles.commandStats}>
          <MiniStat
            icon={Handshake}
            label="Referral partners"
            value={referralPartners}
          />
          <MiniStat
            icon={Target}
            label="Open referral work"
            value={openReferralWork}
          />
          <MiniStat
            icon={Megaphone}
            label="Active campaigns"
            value={activeCampaigns}
          />
          <MiniStat
            icon={Gauge}
            label="Signed conversion"
            value={
              leads.length
                ? `${Math.round((signed / leads.length) * 100)}%`
                : "0%"
            }
          />
        </div>

        <div className={styles.tabBar}>
          <button
            className={activeTab === "referrals" ? styles.tabActive : ""}
            onClick={() => setActiveTab("referrals")}
          >
            <Handshake size={15} />
            Referral Engine
          </button>
          <button
            className={activeTab === "leads" ? styles.tabActive : ""}
            onClick={() => setActiveTab("leads")}
          >
            <Inbox size={15} />
            Lead Engine
          </button>
          <button
            className={activeTab === "campaigns" ? styles.tabActive : ""}
            onClick={() => setActiveTab("campaigns")}
          >
            <BarChart3 size={15} />
            Campaign Intel
          </button>
          <button
            className={activeTab === "compliance" ? styles.tabActive : ""}
            onClick={() => setActiveTab("compliance")}
          >
            <ShieldCheck size={15} />
            Compliance Center
          </button>

          <button
            className={styles.refreshButton}
            onClick={() => void loadWorkspace()}
            disabled={loading}
            title="Refresh PI workspace"
          >
            <RefreshCw size={14} className={loading ? styles.spin : ""} />
          </button>
        </div>

        {activeTab === "referrals" && (
          <ReferralEngine
            referrals={filteredReferrals}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filter={referralFilter}
            setFilter={setReferralFilter}
            updatingId={updatingId}
            onStatus={updateReferralStatus}
            previewMode={previewMode}
            runningAgent={runningAgent}
            apolloBudget={workspace.apolloBudget}
            onContactSelection={updateReferralContact}
            onRunScout={() =>
              runPiAgent("scout", {
                mode: "standard_test",
                geography: "Florida",
                targetCategories: [
                  "immigration attorney",
                  "criminal defense attorney",
                  "family law attorney",
                  "probate attorney",
                  "employment attorney",
                  "general practice attorney",
                  "out-of-state law firm seeking Florida referral counsel"
                ],
                maxResults: 10,
                apollo: {
                  mode: "test",
                  maxCallsPerHour: 10,
                  maxSearchCallsThisRun: 2,
                  maxEnrichmentCallsThisRun: 1,
                  peoplePerSearch: 10,
                  maxContactsPerFirm: 3,
                },
              })
            }
            onRunScoutTest10={() =>
              runPiAgent("scout", {
                mode: "nationwide_unique_firms_test",
                geography: "United States",
                targetCategories: [
                  "immigration attorney",
                  "criminal defense attorney",
                  "family law attorney",
                  "probate attorney",
                  "employment attorney",
                  "general practice attorney"
                ],
                maxResults: 10,
                uniqueFirms: true,
                oneContactPerFirm: true,
                apollo: {
                  mode: "test",
                  maxCallsPerHour: 10,
                  maxSearchCallsThisRun: 1,
                  maxEnrichmentCallsThisRun: 1,
                  peoplePerSearch: 50,
                  maxContactsPerFirm: 1
                }
              })
            }
          />
        )}

        {activeTab === "leads" && (
          <LeadEngine
            leads={filteredLeads}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filter={leadFilter}
            setFilter={setLeadFilter}
            updatingId={updatingId}
            onStatus={updateLeadStatus}
            previewMode={previewMode}
            runningAgent={runningAgent}
            onRunPulse={() =>
              runPiAgent("pulse", {
                mode: "sync_and_qualify",
              })
            }
          />
        )}

        {activeTab === "campaigns" && (
          <CampaignIntel
            campaigns={campaigns}
            previewMode={previewMode}
            runningAgent={runningAgent}
            onRunBeacon={() =>
              runPiAgent("beacon", {
                geography: "Florida",
                practiceArea: "personal injury",
                focus: [
                  "car accidents",
                  "truck accidents",
                  "wrongful death",
                  "pedestrian accidents",
                  "motorcycle accidents",
                  "nursing home negligence"
                ],
              })
            }
          />
        )}

        {activeTab === "compliance" && (
          <ComplianceCenter
            runningAgent={runningAgent}
            onRunGuard={() =>
              runPiAgent("guard", {
                mode: "review_open_items",
              })
            }
          />
        )}
      </section>

      {selectedAgent && (
        selectedAgent.id === "scout" ? (
          <div
            className={styles.scoutWorkstationBackdrop}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) {
                setSelectedAgent(null);
              }
            }}
          >
            <section className={styles.scoutWorkstation}>
              <div className={styles.scoutWorkstationHeader}>
                <div className={styles.scoutWorkstationIdentity}>
                  <div className={styles.panelIcon}>
                    <selectedAgent.icon size={27} strokeWidth={1.7} />
                  </div>

                  <div>
                    <div className={styles.panelStatus}>
                      <span className={agentDot(selectedAgent.status)} />
                      SCOUT · REFERRAL INTELLIGENCE
                    </div>
                    <h2>Scout Referral Workstation</h2>
                    <p>
                      Apollo-backed firm discovery, practice-area intelligence,
                      contact enrichment, fit scoring, and human-controlled
                      outreach selection.
                    </p>
                  </div>
                </div>

                <button
                  className={styles.workstationCloseButton}
                  onClick={() => setSelectedAgent(null)}
                  aria-label="Close Scout workstation"
                >
                  <X size={19} />
                </button>
              </div>

              <div className={styles.scoutWorkstationStats}>
                <div>
                  <span>FIRMS LOADED</span>
                  <strong>{referrals.length}</strong>
                </div>
                <div>
                  <span>CONTACTS</span>
                  <strong>
                    {referrals.reduce(
                      (total, referral) =>
                        total + (referral.contacts || []).length,
                      0
                    )}
                  </strong>
                </div>
                <div>
                  <span>APOLLO CALLS</span>
                  <strong>
                    {workspace.apolloBudget.used}/{workspace.apolloBudget.limit}
                  </strong>
                </div>
                <div>
                  <span>APPROVED+</span>
                  <strong>
                    {
                      referrals.filter((referral) =>
                        ["approved", "contacted", "replied", "meeting", "partner"].includes(
                          referral.relationship_status
                        )
                      ).length
                    }
                  </strong>
                </div>
              </div>

              <div className={styles.scoutWorkstationBody}>
                <ReferralEngine
                  referrals={filteredReferrals}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  filter={referralFilter}
                  setFilter={setReferralFilter}
                  updatingId={updatingId}
                  onStatus={updateReferralStatus}
                  previewMode={previewMode}
                  runningAgent={runningAgent}
                  apolloBudget={workspace.apolloBudget}
                  onContactSelection={updateReferralContact}
                  onRunScout={() =>
                    runPiAgent("scout", {
                      mode: "standard_test",
                      geography: "Florida",
                      targetCategories: [
                        "immigration attorney",
                        "criminal defense attorney",
                        "family law attorney",
                        "probate attorney",
                        "employment attorney",
                        "general practice attorney",
                        "out-of-state law firm seeking Florida referral counsel"
                      ],
                      maxResults: 10,
                      apollo: {
                        mode: "test",
                        maxCallsPerHour: 10,
                        maxSearchCallsThisRun: 2,
                        maxEnrichmentCallsThisRun: 1,
                        peoplePerSearch: 10,
                        maxContactsPerFirm: 3,
                      },
                    })
                  }
                  onRunScoutTest10={() =>
                    runPiAgent("scout", {
                      mode: "nationwide_unique_firms_test",
                      geography: "United States",
                      targetCategories: [
                        "immigration attorney",
                        "criminal defense attorney",
                        "family law attorney",
                        "probate attorney",
                        "employment attorney",
                        "general practice attorney"
                      ],
                      maxResults: 10,
                      uniqueFirms: true,
                      oneContactPerFirm: true,
                      apollo: {
                        mode: "test",
                        maxCallsPerHour: 10,
                        maxSearchCallsThisRun: 1,
                        maxEnrichmentCallsThisRun: 1,
                        peoplePerSearch: 50,
                        maxContactsPerFirm: 1
                      }
                    })
                  }
                />
              </div>
            </section>
          </div>
        ) : (
          <div
            className={styles.modalBackdrop}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) {
                setSelectedAgent(null);
              }
            }}
          >
            <aside className={styles.agentPanel}>
              <button
                className={styles.closeButton}
                onClick={() => setSelectedAgent(null)}
                aria-label="Close agent panel"
              >
                <X size={18} />
              </button>

              <div className={styles.panelHead}>
                <div className={styles.panelIcon}>
                  <selectedAgent.icon size={27} strokeWidth={1.7} />
                </div>
                <div>
                  <div className={styles.panelStatus}>
                    <span className={agentDot(selectedAgent.status)} />
                    {selectedAgent.status === "review"
                      ? "Human Review"
                      : selectedAgent.status}
                  </div>
                  <h2>{selectedAgent.name}</h2>
                  <p>{selectedAgent.role}</p>
                </div>
              </div>

              <p className={styles.panelDescription}>
                {selectedAgent.description}
              </p>

              <div className={styles.panelSection}>
                <h3>Capabilities</h3>
                <ul>
                  {selectedAgent.capabilities.map((capability) => (
                    <li key={capability}>{capability}</li>
                  ))}
                </ul>
              </div>

              <div className={styles.panelSection}>
                <h3>Typical Output</h3>
                <div className={styles.chips}>
                  {selectedAgent.output.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>

              <div className={styles.panelNotice}>
                <ShieldCheck size={15} />
                V1 is human-controlled. Research can be automated; outbound
                messages, spend changes, and consumer-facing actions require an
                approval step before execution.
              </div>
            </aside>
          </div>
        )
      )}
    </main>
  );
}

function MetricCard({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ size?: number }>;
  value: string | number;
  label: string;
}) {
  return (
    <div className={styles.metricCard}>
      <Icon size={18} />
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ size?: number }>;
  value: string | number;
  label: string;
}) {
  return (
    <div className={styles.miniStat}>
      <div>
        <Icon size={15} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AgentDesk({
  agent,
  onOpen,
}: {
  agent: PiAgent;
  onOpen: (agent: PiAgent) => void;
}) {
  return (
    <button className={styles.deskNode} onClick={() => onOpen(agent)}>
      <div className={styles.deskLabel}>{agent.shortRole.toUpperCase()}</div>
      <div className={styles.deskFigure}>
        <div className={`${styles.monitor} ${styles.monitorLeft}`} />
        <div className={`${styles.monitor} ${styles.monitorRight}`} />
        <div className={styles.head} />
        <div className={styles.body} />
        <div className={styles.deskBase} />
        <span className={`${styles.agentDot} ${agentDot(agent.status)}`} />
      </div>
      <div className={styles.agentName}>{agent.name}</div>
      <agent.icon size={14} strokeWidth={1.8} />
    </button>
  );
}

function ReferralEngine({
  referrals,
  searchTerm,
  setSearchTerm,
  filter,
  setFilter,
  updatingId,
  onStatus,
  previewMode,
  runningAgent,
  apolloBudget,
  onContactSelection,
  onRunScout,
  onRunScoutTest10,
}: {
  referrals: ReferralProspect[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filter: ReferralStatus | "all";
  setFilter: (value: ReferralStatus | "all") => void;
  updatingId: string | null;
  onStatus: (id: string, status: ReferralStatus) => void;
  previewMode: boolean;
  runningAgent: string | null;
  apolloBudget: ApolloBudget;
  onContactSelection: (
    contactId: string,
    selectedForOutreach: boolean
  ) => void;
  onRunScout: () => void;
  onRunScoutTest10: () => void;
}) {
  return (
    <div className={styles.tabContent}>
      <div className={styles.panelHero}>
        <div>
          <span className={styles.panelEyebrow}>SCOUT + BRIDGE</span>
          <h2>Professional Referral Engine</h2>
          <p>
            Build repeatable lawyer-to-lawyer and professional relationships.
            Discovery and enrichment can be automated; outreach remains
            approval-gated.
          </p>
        </div>

        <div className={styles.panelActions}>
          <div className={styles.apolloBudget}>
            <span>APOLLO TEST MODE</span>
            <strong>
              {apolloBudget.used}/{apolloBudget.limit}
            </strong>
            <small>calls used in the last hour</small>
          </div>

          <div className={styles.scoutButtonGroup}>
            <button
              onClick={onRunScout}
              disabled={
                Boolean(runningAgent) ||
                apolloBudget.remaining <= 0
              }
              title={
                apolloBudget.remaining <= 0
                  ? "Apollo hourly test budget is exhausted."
                  : "Run the normal Florida Scout discovery test."
              }
            >
              {runningAgent === "scout" ? (
                <RefreshCw size={14} className={styles.spin} />
              ) : (
                <FileSearch size={14} />
              )}
              {runningAgent === "scout"
                ? "Scout Running…"
                : apolloBudget.remaining <= 0
                ? "Apollo Limit Reached"
                : "Run Scout Discovery"}
            </button>

            <button
              className={styles.testTenButton}
              onClick={onRunScoutTest10}
              disabled={
                Boolean(runningAgent) ||
                apolloBudget.remaining < 2
              }
              title={
                apolloBudget.remaining < 2
                  ? "The 10-firm test reserves up to 2 Apollo calls, so at least 2 hourly calls must remain."
                  : "Test Scout now: find 10 contacts from 10 different firms across the United States."
              }
            >
              <UsersRound size={14} />
              Test 10 Firms
            </button>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <label className={styles.searchBox}>
          <Search size={15} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search firm, contact, city, category, fit..."
          />
        </label>

        <div className={styles.filterRow}>
          <Filter size={14} />
          <button
            className={filter === "all" ? styles.filterActive : ""}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          {referralStages.slice(0, 7).map((stage) => (
            <button
              key={stage.value}
              className={filter === stage.value ? styles.filterActive : ""}
              onClick={() => setFilter(stage.value)}
            >
              {stage.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.referralGrid}>
        {referrals.map((prospect) => (
          <article className={styles.referralCard} key={prospect.id}>
            <div className={styles.cardHead}>
              <div>
                <div className={styles.practiceMetaRow}>
                  <span className={styles.category}>{prospect.category}</span>
                  <span className={styles.practiceBadge}>
                    {referralPracticeLabel(prospect)}
                  </span>
                </div>
                <h3>{prospect.organization_name}</h3>
                <p>{prospect.contact_name}</p>
              </div>

              <div className={styles.scoreBadge}>
                <strong>{prospect.score}</strong>
                <span>fit score</span>
              </div>
            </div>

            <div className={styles.locationLine}>
              <MapPin size={15} />
              <div>
                <span>LOCATION</span>
                <strong>{referralLocationLabel(prospect)}</strong>
              </div>
            </div>

            <div className={styles.fitBox}>
              <span>WHY IT MAY FIT</span>
              <p>{prospect.why_fit}</p>
            </div>

            <div className={styles.firmLinkRow}>
              {prospect.website ? (
                <a
                  className={styles.websiteLink}
                  href={prospect.website}
                  target="_blank"
                  rel="noreferrer"
                  title={`Open ${prospect.organization_name} website`}
                >
                  <ExternalLink size={12} />
                  <span>{prospect.website}</span>
                </a>
              ) : (
                <div className={`${styles.contactItem} ${styles.websitePending}`}>
                  <ExternalLink size={12} />
                  <span>Website pending</span>
                </div>
              )}

              {prospect.source_url ? (
                <a
                  className={styles.sourceLink}
                  href={prospect.source_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source
                  <ExternalLink size={11} />
                </a>
              ) : null}
            </div>

            <div className={styles.contactStack}>
              <div className={styles.contactStackHead}>
                <span>POTENTIAL CONTACTS</span>
                <small>
                  {(prospect.contacts || []).length} found
                </small>
              </div>

              {(prospect.contacts || []).length ? (
                (prospect.contacts || [])
                  .slice()
                  .sort(
                    (a, b) =>
                      Number(a.priority || 99) -
                      Number(b.priority || 99)
                  )
                  .slice(0, 3)
                  .map((contact, contactIndex) => (
                    <div
                      className={`${styles.personContact} ${
                        contact.selected_for_outreach
                          ? styles.personContactSelected
                          : ""
                      }`}
                      key={contact.id}
                    >
                      <button
                        type="button"
                        className={styles.contactSelect}
                        disabled={
                          Boolean(contact.is_demo) ||
                          updatingId === contact.id
                        }
                        onClick={() =>
                          onContactSelection(
                            contact.id,
                            !contact.selected_for_outreach
                          )
                        }
                        title={
                          contact.selected_for_outreach
                            ? "Remove from approved outreach contacts"
                            : "Select as a potential outreach contact"
                        }
                      >
                        {contact.selected_for_outreach ? (
                          <CheckCircle2 size={15} />
                        ) : (
                          <span>{contactIndex + 1}</span>
                        )}
                      </button>

                      <div className={styles.personIdentity}>
                        <strong>
                          {contact.full_name ||
                            [contact.first_name, contact.last_name]
                              .filter(Boolean)
                              .join(" ") ||
                            "Apollo contact"}
                        </strong>
                        <span>
                          {contact.title || "Title unavailable"}
                        </span>
                      </div>

                      <div className={styles.personMethods}>
                        <span>
                          <Mail size={11} />
                          {contact.email || "Email not enriched"}
                        </span>
                        <span>
                          <Phone size={11} />
                          {contact.phone || "Phone not enriched"}
                        </span>
                      </div>

                      {contact.linkedin_url ? (
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.linkedinLink}
                        >
                          LinkedIn
                          <ExternalLink size={10} />
                        </a>
                      ) : null}
                    </div>
                  ))
              ) : (
                <div className={styles.noContacts}>
                  Apollo contacts have not been enriched for this firm yet.
                </div>
              )}
            </div>

            <div className={styles.cardFooter}>
              {prospect.is_demo ? (
                <span className={styles.previewTag}>Preview</span>
              ) : (
                <select
                  value={prospect.relationship_status}
                  disabled={updatingId === prospect.id}
                  onChange={(event) =>
                    onStatus(
                      prospect.id,
                      event.target.value as ReferralStatus
                    )
                  }
                >
                  {referralStages.map((stage) => (
                    <option key={stage.value} value={stage.value}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              )}

              <button
                disabled={
                  prospect.is_demo ||
                  !["approved", "contacted", "replied", "meeting"].includes(
                    prospect.relationship_status
                  )
                }
                title="Outreach sending is added after approval workflow is connected"
              >
                <MessageSquareText size={13} />
                Draft Outreach
              </button>
            </div>
          </article>
        ))}
      </div>

      {!referrals.length && (
        <EmptyState
          icon={Handshake}
          title="No referral prospects yet"
          text="Scout discovery will populate this board. You can also insert prospects directly into Supabase."
        />
      )}

      {previewMode && (
        <p className={styles.previewFootnote}>
          Preview records are not real referral contacts and cannot be updated.
        </p>
      )}
    </div>
  );
}

function LeadEngine({
  leads,
  searchTerm,
  setSearchTerm,
  filter,
  setFilter,
  updatingId,
  onStatus,
  previewMode,
  runningAgent,
  onRunPulse,
}: {
  leads: PiLead[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filter: LeadStatus | "all";
  setFilter: (value: LeadStatus | "all") => void;
  updatingId: string | null;
  onStatus: (id: string, status: LeadStatus) => void;
  previewMode: boolean;
  runningAgent: string | null;
  onRunPulse: () => void;
}) {
  return (
    <div className={styles.tabContent}>
      <div className={styles.panelHero}>
        <div>
          <span className={styles.panelEyebrow}>PULSE + INTAKE + LEDGER</span>
          <h2>Inbound PI Lead Engine</h2>
          <p>
            One queue for calls, forms, Google Ads, Meta, directories, and
            professional referrals. The goal is response speed, qualification,
            attribution, and signed-case conversion.
          </p>
        </div>

        <div className={styles.panelActions}>
          <button
            onClick={onRunPulse}
            disabled={Boolean(runningAgent)}
          >
            {runningAgent === "pulse" ? (
              <RefreshCw size={14} className={styles.spin} />
            ) : (
              <HeartPulse size={14} />
            )}
            {runningAgent === "pulse" ? "Pulse Running…" : "Run Lead Sync"}
          </button>
        </div>
      </div>

      <div className={styles.controls}>
        <label className={styles.searchBox}>
          <Search size={15} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search lead, source, accident type, city..."
          />
        </label>

        <div className={styles.filterRow}>
          <Filter size={14} />
          <button
            className={filter === "all" ? styles.filterActive : ""}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          {leadStages.map((stage) => (
            <button
              key={stage.value}
              className={filter === stage.value ? styles.filterActive : ""}
              onClick={() => setFilter(stage.value)}
            >
              {stage.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.leadTable}>
        <div className={styles.leadTableHead}>
          <span>Lead</span>
          <span>Source</span>
          <span>Case Type</span>
          <span>Location</span>
          <span>Priority</span>
          <span>Status</span>
        </div>

        {leads.map((lead) => (
          <div className={styles.leadRow} key={lead.id}>
            <div>
              <strong>{lead.name}</strong>
              <small>{lead.summary}</small>
            </div>
            <span>{lead.source}</span>
            <span>{lead.accident_type}</span>
            <span>
              {lead.city}, {lead.state}
            </span>
            <span
              className={`${styles.urgency} ${
                lead.urgency === "high"
                  ? styles.urgencyHigh
                  : lead.urgency === "medium"
                  ? styles.urgencyMedium
                  : styles.urgencyLow
              }`}
            >
              {lead.urgency}
            </span>

            {lead.is_demo ? (
              <span className={styles.previewTag}>Preview</span>
            ) : (
              <select
                value={lead.status}
                disabled={updatingId === lead.id}
                onChange={(event) =>
                  onStatus(lead.id, event.target.value as LeadStatus)
                }
              >
                {leadStages.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      {!leads.length && (
        <EmptyState
          icon={Inbox}
          title="No inbound PI leads yet"
          text="Pulse will become the shared intake queue once the current call/form sources are wired to this workspace."
        />
      )}

      {previewMode && (
        <p className={styles.previewFootnote}>
          Preview leads demonstrate the queue only. No consumer contact has been
          initiated.
        </p>
      )}
    </div>
  );
}

function CampaignIntel({
  campaigns,
  previewMode,
  runningAgent,
  onRunBeacon,
}: {
  campaigns: Campaign[];
  previewMode: boolean;
  runningAgent: string | null;
  onRunBeacon: () => void;
}) {
  return (
    <div className={styles.tabContent}>
      <div className={styles.panelHero}>
        <div>
          <span className={styles.panelEyebrow}>BEACON + RADAR + LAUNCH</span>
          <h2>Campaign & Market Intelligence</h2>
          <p>
            Compare channels by lead quality, consultations, signed matters,
            spend, and acquisition cost. V1 does not autonomously change
            budgets or publish advertising.
          </p>
        </div>

        <div className={styles.panelActions}>
          <button
            onClick={onRunBeacon}
            disabled={Boolean(runningAgent)}
          >
            {runningAgent === "beacon" ? (
              <RefreshCw size={14} className={styles.spin} />
            ) : (
              <Compass size={14} />
            )}
            {runningAgent === "beacon" ? "Beacon Running…" : "Run Market Scan"}
          </button>
        </div>
      </div>

      <div className={styles.campaignGrid}>
        {campaigns.map((campaign) => {
          const costPerLead =
            campaign.leads > 0 ? campaign.spend / campaign.leads : 0;
          const costPerSigned =
            campaign.signed > 0 ? campaign.spend / campaign.signed : 0;

          return (
            <article className={styles.campaignCard} key={campaign.id}>
              <div className={styles.cardHead}>
                <div>
                  <span className={styles.category}>{campaign.channel}</span>
                  <h3>{campaign.name}</h3>
                </div>
                <span
                  className={`${styles.campaignStatus} ${
                    campaign.status === "active"
                      ? styles.campaignActive
                      : campaign.status === "paused"
                      ? styles.campaignPaused
                      : ""
                  }`}
                >
                  {campaign.status}
                </span>
              </div>

              <div className={styles.campaignMetrics}>
                <CampaignMetric label="Spend" value={money(campaign.spend)} />
                <CampaignMetric label="Leads" value={campaign.leads} />
                <CampaignMetric label="Consults" value={campaign.consults} />
                <CampaignMetric label="Signed" value={campaign.signed} />
                <CampaignMetric
                  label="Cost / Lead"
                  value={costPerLead ? money(costPerLead) : "—"}
                />
                <CampaignMetric
                  label="Cost / Signed"
                  value={costPerSigned ? money(costPerSigned) : "—"}
                />
              </div>

              {campaign.is_demo && (
                <span className={styles.previewTag}>Preview</span>
              )}
            </article>
          );
        })}
      </div>

      {previewMode && (
        <p className={styles.previewFootnote}>
          Connect Google Ads / Meta reporting later; the data model is ready for
          channel-level performance.
        </p>
      )}
    </div>
  );
}

function ComplianceCenter({
  runningAgent,
  onRunGuard,
}: {
  runningAgent: string | null;
  onRunGuard: () => void;
}) {
  const controls = [
    {
      title: "Professional referral outreach",
      status: "allowed_with_review",
      text:
        "Research and drafting can be automated. A human approves the recipient and final message before any external send.",
    },
    {
      title: "Inbound consumer leads",
      status: "ready",
      text:
        "Calls, forms, chat, ad responses, and referral inquiries can enter Pulse for qualification and routing.",
    },
    {
      title: "Cold accident-victim outreach",
      status: "blocked",
      text:
        "Not part of this floor. The system does not scrape recent crash victims and automatically call, text, DM, or email them.",
    },
    {
      title: "Lead vendor activation",
      status: "review",
      text:
        "A vendor stays blocked until its acquisition method, pricing structure, disclosures, and Florida compliance posture are reviewed.",
    },
    {
      title: "Consumer-facing ads",
      status: "review",
      text:
        "Creative, landing pages, and campaign changes can be prepared here, but publication remains an approved human action with advertising-compliance tracking.",
    },
    {
      title: "Fee / referral arrangements",
      status: "review",
      text:
        "Any fee-sharing or referral arrangement stays attorney-controlled and must be documented outside the automation before activation.",
    },
  ];

  return (
    <div className={styles.tabContent}>
      <div className={styles.panelHero}>
        <div>
          <span className={styles.panelEyebrow}>GUARD · HUMAN CONTROL LAYER</span>
          <h2>PI Marketing & Outreach Compliance Center</h2>
          <p>
            The growth floor should automate research and organization
            aggressively while putting irreversible external actions behind
            explicit approval gates.
          </p>
        </div>

        <div className={styles.panelActions}>
          <button
            onClick={onRunGuard}
            disabled={Boolean(runningAgent)}
          >
            {runningAgent === "guard" ? (
              <RefreshCw size={14} className={styles.spin} />
            ) : (
              <ShieldCheck size={14} />
            )}
            {runningAgent === "guard" ? "Guard Running…" : "Review Open Items"}
          </button>
        </div>
      </div>

      <div className={styles.complianceGrid}>
        {controls.map((control) => (
          <article className={styles.complianceCard} key={control.title}>
            <div
              className={`${styles.complianceIcon} ${
                control.status === "ready"
                  ? styles.complianceGood
                  : control.status === "blocked"
                  ? styles.complianceBlocked
                  : styles.complianceReview
              }`}
            >
              {control.status === "ready" ? (
                <CheckCircle2 size={17} />
              ) : control.status === "blocked" ? (
                <X size={17} />
              ) : (
                <ShieldCheck size={17} />
              )}
            </div>

            <div>
              <h3>{control.title}</h3>
              <p>{control.text}</p>
            </div>
          </article>
        ))}
      </div>

      <div className={styles.complianceNote}>
        <ClipboardCheck size={17} />
        <div>
          <strong>Build principle</strong>
          <span>
            The software should record who approved an outreach, ad, vendor, or
            status change and when. It should not make legal-compliance
            determinations on its own.
          </span>
        </div>
      </div>
    </div>
  );
}

function ContactItem({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{ size?: number }>;
  value: string;
}) {
  return (
    <div className={styles.contactItem}>
      <Icon size={12} />
      <span>{value}</span>
    </div>
  );
}

function CampaignMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className={styles.campaignMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  text: string;
}) {
  return (
    <div className={styles.emptyState}>
      <Icon size={27} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
