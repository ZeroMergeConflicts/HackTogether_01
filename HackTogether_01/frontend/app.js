const API_BASE =
  window.location.port === "8000" ? "" : "http://127.0.0.1:8000";

/* =====================================================================
   MODULE 1: CENTRAL APPLICATION STATE
   ===================================================================== */
const state = {
  currentRoute: "welcome",
  selectedFolder: ".test",
  files: [],
  context: [],
  relationships: [],
  errors: [],
  health: { status: "ok", ai_configured: false, model: "gemini-2.5-flash" },
  scanStatus: { status: "idle", total: 0, processed: 0, failed: 0 },
  activeHeroDemo: "symposium",
  activeJourneyStep: "sources",
  chatHistory: [
    {
      role: "assistant",
      text: "Hello! I'm your ContextVault assistant. Ask me about your files, upcoming deadlines, pending tasks, or general questions. Hover any cited file chip for an instant preview, or click to inspect the full source.",
      confidence: 1.0,
      has_sufficient_context: true,
      sources: [],
    },
  ],
  activeCategory: "all",
  previewCache: new Map(),
  graphNodes: [],
  graphEdges: [],
  hoveredGraphNode: null,
  physicsEnabled: true,
  draggedNode: null,
};

const VIEW_META = {
  welcome: { eyebrow: "PRODUCT / LANDING", title: "ContextVault" },
  dashboard: { eyebrow: "WORKSPACE / OVERVIEW", title: "Overview" },
  ask: { eyebrow: "WORKSPACE / AI STUDIO", title: "Ask ContextVault" },
  actions: { eyebrow: "WORKSPACE / TASK MATRIX", title: "Action & Deadline Board" },
  graph: { eyebrow: "WORKSPACE / TOPOLOGY", title: "Synaptic Knowledge Graph" },
  files: { eyebrow: "REPOSITORY / REGISTRY", title: "Vault Files" },
  explorer: { eyebrow: "REPOSITORY / EXTRACTIONS", title: "Context Explorer" },
  telemetry: { eyebrow: "REPOSITORY / DIAGNOSTICS", title: "Links & System Telemetry" },
};

const HERO_DEMOS = {
  symposium: {
    query: "“What do I still need to complete for the Tech Symposium?”",
    answer:
      "For the Annual Tech Symposium 2026, you still need to:\n• Submit the project abstract before the registration deadline.\n• Pay the ₹500 registration fee (if not already paid).\n\nRegistration deadline: 30 September 2026.",
    sources: [
      {
        filename: "symposium_notice.txt",
        desc: "Event: Annual Tech Symposium · Deadline: 30 Sept 2026 · Abstract required",
      },
      {
        filename: "symposium_whatsapp.txt",
        desc: "Reminder: Submit project abstract before registration closes · ₹500 fee",
      },
    ],
  },
  payment: {
    query: "“How much is the registration fee and have I paid it?”",
    answer:
      "The registration fee for the Annual Tech Symposium 2026 is ₹500. Your notes state that it needs to be paid before registration closes on 30 September 2026 if you haven't already.",
    sources: [
      {
        filename: "symposium_whatsapp.txt",
        desc: "Amount: ₹500 registration fee · Status: Pending verification",
      },
      {
        filename: "symposium_notice.txt",
        desc: "Official circular · Registration closes 30 September 2026",
      },
    ],
  },
  exam: {
    query: "“When is my math exam and what topics are covered?”",
    answer:
      "Check your indexed math notes directly by hovering or clicking the source chip below to inspect the full syllabus and exam schedule.",
    sources: [
      {
        filename: "math.txt",
        desc: "Mathematics study notes & exam date reference",
      },
    ],
  },
};

const ANSWER_JOURNEY_STEPS = [
  {
    id: "sources",
    kicker: "STEP 01 / SOURCE FILES",
    title: "Start with the original files.",
    description: "Every useful detail stays attached to the document it came from.",
    nextLabel: "Connect the signals",
  },
  {
    id: "connections",
    kicker: "STEP 02 / CROSS-FILE LINKS",
    title: "Bring related facts together.",
    description: "Dates, actions, and amounts become useful when their sources are connected.",
    nextLabel: "See the grounded answer",
  },
  {
    id: "answer",
    kicker: "STEP 03 / VERIFIED RESPONSE",
    title: "Keep the evidence beside the answer.",
    description: "Open a cited source whenever you want to check the detail for yourself.",
    nextLabel: "Restart the answer trail",
  },
];

const elements = {
  folderPath: document.getElementById("folderPath"),
  statusText: document.getElementById("statusText"),
  fileCount: document.getElementById("fileCount"),
  contextCount: document.getElementById("contextCount"),
  relationshipCount: document.getElementById("relationshipCount"),
  actionCount: document.getElementById("actionCount"),
  entityCount: document.getElementById("entityCount"),
  amountCount: document.getElementById("amountCount"),
  fileList: document.getElementById("fileList"),
  contextList: document.getElementById("contextList"),
  relationshipList: document.getElementById("relationshipList"),
  answerText: document.getElementById("answerText"),
  sourcesList: document.getElementById("sourcesList"),
  queryInput: document.getElementById("queryInput"),
  chatStream: document.getElementById("chatStream"),
  fileHoverCard: document.getElementById("fileHoverCard"),
  fileInspectorBackdrop: document.getElementById("fileInspectorBackdrop"),
  cmdPaletteBackdrop: document.getElementById("cmdPaletteBackdrop"),
  toastContainer: document.getElementById("toastContainer"),
};

/* =====================================================================
   MODULE 2: CORE UTILITIES & API ADAPTER
   ===================================================================== */
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function iconForExtension(filename = "") {
  const lower = String(filename).toLowerCase();
  if (lower.endsWith(".pdf")) return "file-text";
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(lower)) return "image";
  if (/\.(json|csv)$/.test(lower)) return "file-spreadsheet";
  return "file-code-2";
}

function showToast(message) {
  if (!elements.toastContainer) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3200);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || payload.message || "Request failed.");
  }

  return response.json();
}

function setStatus(message) {
  if (elements.statusText) {
    elements.statusText.textContent = message;
  }
}

function findFileRecord(fileId, filename) {
  if (fileId != null && fileId !== "") {
    const byId = state.files.find((f) => Number(f.id) === Number(fileId));
    if (byId) return byId;
  }
  if (filename) {
    const lower = String(filename).toLowerCase();
    return state.files.find((f) => String(f.name).toLowerCase() === lower) || null;
  }
  return null;
}

function renderFileChip(fileId, filename) {
  const file = findFileRecord(fileId, filename);
  const resolvedId = file ? file.id : fileId || "";
  const resolvedName = file ? file.name : filename || "source";
  const iconName = iconForExtension(resolvedName);
  return `
    <span
      class="file-ref-chip"
      data-file-id="${escapeHtml(resolvedId)}"
      data-filename="${escapeHtml(resolvedName)}"
    >
      <i data-lucide="${iconName}" class="icon-xs"></i>
      <span>${escapeHtml(resolvedName)}</span>
    </span>
  `;
}

function renderAnswerJourney(demo) {
  const journey = document.getElementById("answerJourney");
  if (!journey) return;

  const stepIndex = Math.max(
    0,
    ANSWER_JOURNEY_STEPS.findIndex((step) => step.id === state.activeJourneyStep),
  );
  const step = ANSWER_JOURNEY_STEPS[stepIndex];
  const visual = document.getElementById("journeyVisual");
  const demoNames = {
    symposium: "Symposium",
    payment: "Payment",
    exam: "Exam schedule",
  };

  journey.dataset.stage = step.id;
  document.getElementById("journeyStageKicker").textContent = step.kicker;
  document.getElementById("journeyStageTitle").textContent = step.title;
  document.getElementById("journeyStageDescription").textContent = step.description;
  document.getElementById("journeyNextLabel").textContent = step.nextLabel;
  document.getElementById("journeyDemoContext").textContent =
    `${demoNames[state.activeHeroDemo] || "Live"} demo · ${demo.sources.length} source ${demo.sources.length === 1 ? "file" : "files"}`;

  document.querySelectorAll("[data-journey-step]").forEach((button) => {
    const active = button.dataset.journeyStep === step.id;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const sourceRows = demo.sources
    .map((source, index) => `
      <div class="journey-source-row" style="--source-order: ${index};">
        <span class="journey-source-index">0${index + 1}</span>
        <i data-lucide="${iconForExtension(source.filename)}" class="icon-sm" aria-hidden="true"></i>
        <div class="journey-source-copy">
          <strong>${escapeHtml(source.filename)}</strong>
          <span>${escapeHtml(source.desc)}</span>
        </div>
      </div>
    `)
    .join("");

  if (step.id === "sources") {
    visual.innerHTML = `
      <div class="journey-source-list">${sourceRows}</div>
      <div class="journey-visual-footnote">
        <i data-lucide="shield-check" class="icon-sm" aria-hidden="true"></i>
        <span>Original files remain one click away.</span>
      </div>
    `;
  } else if (step.id === "connections") {
    visual.innerHTML = `
      <div class="journey-link-map">
        <div class="journey-connected-files">
          ${demo.sources
            .map((source) => `
              <div class="journey-connected-file">
                <i data-lucide="${iconForExtension(source.filename)}" class="icon-sm" aria-hidden="true"></i>
                <span>${escapeHtml(source.filename)}</span>
              </div>
            `)
            .join("")}
        </div>
        <div class="journey-link-beam" aria-hidden="true"><span></span></div>
        <div class="journey-synthesis-node">
          <span class="journey-synthesis-icon"><i data-lucide="sparkles" class="icon-md" aria-hidden="true"></i></span>
          <span class="mono-label">CONTEXT SYNTHESIS</span>
          <strong>${demo.sources.length} connected ${demo.sources.length === 1 ? "source" : "sources"}</strong>
          <span>Facts stay linked to their origin.</span>
        </div>
      </div>
      <div class="journey-visual-footnote">
        <i data-lucide="git-branch" class="icon-sm" aria-hidden="true"></i>
        <span>${escapeHtml(demo.query)}</span>
      </div>
    `;
  } else {
    visual.innerHTML = `
      <div class="journey-answer-card">
        <div class="journey-answer-heading">
          <span><i data-lucide="badge-check" class="icon-sm" aria-hidden="true"></i> GROUNDED RESPONSE</span>
          <span class="journey-confidence"><i data-lucide="shield-check" class="icon-xs" aria-hidden="true"></i> SOURCE-LINKED</span>
        </div>
        <p>${escapeHtml(demo.answer)}</p>
        <div class="journey-citations">
          <span class="mono-label">CHECK THE SOURCES</span>
          ${demo.sources.map((source) => renderFileChip(null, source.filename)).join("")}
        </div>
      </div>
    `;
  }

  const progress = document.querySelector(".journey-progress");
  progress.setAttribute("aria-valuenow", String(stepIndex + 1));
  document.getElementById("journeyProgressFill").style.width = `${((stepIndex + 1) / ANSWER_JOURNEY_STEPS.length) * 100}%`;
  refreshIcons();
}

function initializeLandingMotion() {
  if (
    !("IntersectionObserver" in window) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const targets = document.querySelectorAll(
    ".answer-journey-section .journey-header, .section-title-block, .comparison-grid > *, .product-bento-grid > *, .pipeline-steps-grid > *, .module-launcher-grid > *, .landing-footer .footer-inner",
  );
  const groupOrder = new Map();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.12 },
  );

  targets.forEach((target) => {
    const group = target.parentElement;
    const order = groupOrder.get(group) || 0;
    groupOrder.set(group, order + 1);
    target.style.setProperty("--motion-delay", `${Math.min(order, 5) * 65}ms`);
    target.classList.add("scroll-reveal");
    observer.observe(target);
  });
}

/* =====================================================================
   MODULE 3: DUAL-SHELL ROUTER (LANDING <-> WORKSPACE)
   ===================================================================== */
function navigateTo(route) {
  const targetRoute = VIEW_META[route] ? route : "welcome";
  state.currentRoute = targetRoute;

  if (window.location.hash !== `#/${targetRoute}`) {
    history.replaceState(null, "", `#/${targetRoute}`);
  }

  if (targetRoute === "welcome") {
    document.body.setAttribute("data-shell-mode", "landing");
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderLandingHero();
    refreshIcons();
    return;
  }

  document.body.setAttribute("data-shell-mode", "workspace");

  document.querySelectorAll(".view-page").forEach((section) => {
    section.classList.toggle("active", section.id === `view-${targetRoute}`);
  });

  document.querySelectorAll(".nav-item").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === targetRoute);
  });

  const meta = VIEW_META[targetRoute];
  document.getElementById("currentViewEyebrow").textContent = meta.eyebrow;
  document.getElementById("currentViewTitle").textContent = meta.title;

  if (targetRoute === "graph" || targetRoute === "dashboard") {
    buildGraphTopology();
  }
  refreshIcons();
}

window.addEventListener("hashchange", () => {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash && VIEW_META[hash]) {
    navigateTo(hash);
  }
});

/* =====================================================================
   MODULE 4: LANDING PAGE & INTERACTIVE HERO SHOWCASE
   ===================================================================== */
function renderLandingHero() {
  const demo = HERO_DEMOS[state.activeHeroDemo] || HERO_DEMOS.symposium;
  const showcaseBody = document.querySelector(".showcase-body");
  if (showcaseBody) {
    showcaseBody.classList.remove("showcase-content-enter");
    void showcaseBody.offsetWidth;
    showcaseBody.classList.add("showcase-content-enter");
  }

  const hFiles = document.getElementById("heroStatFiles");
  const hCtx = document.getElementById("heroStatContext");
  const hLinks = document.getElementById("heroStatLinks");
  const hEngine = document.getElementById("heroStatEngine");

  if (hFiles) hFiles.textContent = String(state.files.length);
  if (hCtx) hCtx.textContent = String(state.context.length);
  if (hLinks) hLinks.textContent = String(state.relationships.length);
  if (hEngine) {
    hEngine.textContent = state.health.ai_configured ? "GEMINI LIVE" : "READY";
  }

  const queryEl = document.getElementById("heroDemoQuery");
  const answerEl = document.getElementById("heroDemoAnswer");
  const sourcesEl = document.getElementById("heroDemoSources");
  const citationsEl = document.getElementById("heroDemoCitations");

  if (queryEl) queryEl.textContent = demo.query;
  if (answerEl) answerEl.textContent = demo.answer;

  if (sourcesEl) {
    sourcesEl.innerHTML = demo.sources
      .map((s) => {
        const rec = findFileRecord(null, s.filename);
        const fid = rec ? rec.id : "";
        return `
          <div
            class="demo-source-card"
            data-file-id="${escapeHtml(fid)}"
            data-filename="${escapeHtml(s.filename)}"
          >
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <strong style="display:flex;align-items:center;gap:6px;font-size:0.86rem;">
                <i data-lucide="${iconForExtension(s.filename)}" class="icon-sm indigo-text"></i>
                ${escapeHtml(s.filename)}
              </strong>
              <span class="badge badge-indigo">Hover / Click</span>
            </div>
            <p style="font-size:0.78rem;color:var(--text-secondary);">${escapeHtml(s.desc)}</p>
          </div>
        `;
      })
      .join("");
  }

  if (citationsEl) {
    citationsEl.innerHTML = `
      <span class="mono-label">ATTRIBUTED SOURCES:</span>
      ${demo.sources.map((s) => renderFileChip(null, s.filename)).join("")}
    `;
  }

  const bentoChips = document.getElementById("landingInteractiveChips");
  if (bentoChips) {
    const sampleFiles = state.files.length
      ? state.files.slice(0, 4)
      : [
        { id: "", name: "symposium_notice.txt" },
        { id: "", name: "symposium_whatsapp.txt" },
        { id: "", name: "math.txt" },
      ];
    bentoChips.innerHTML = sampleFiles
      .map((f) => renderFileChip(f.id, f.name))
      .join("");
  }

  renderAnswerJourney(demo);
  refreshIcons();
}

/* =====================================================================
   MODULE 5: VAULT AGGREGATION & WORKSPACE RENDERERS
   ===================================================================== */
function isCompletedText(text) {
  const lower = String(text || "").toLowerCase();
  if (
    /(need to|needs to|must be|have to|not paid|unpaid|haven't|havent|if you|before|pending|required)/i.test(
      lower,
    )
  ) {
    return false;
  }
  return /(paid|payment successful|payment completed|already completed|completed|done)/i.test(
    lower,
  );
}

function getAggregatedVaultStats() {
  const pendingActions = [];
  const completedFacts = [];
  const deadlines = [];
  const amounts = [];
  const allEntities = new Set();

  for (const ctx of state.context) {
    const data = ctx.data || {};
    const fileId = ctx.file_id;
    const filename = ctx.filename || "unknown";

    (data.actions || []).forEach((act) => {
      const text = String(act).trim();
      if (!text || text.toLowerCase().startsWith("review ")) return;
      if (isCompletedText(text)) {
        completedFacts.push({ text, fileId, filename });
      } else {
        pendingActions.push({ text, fileId, filename });
      }
    });

    (data.deadlines || []).forEach((dl) => {
      const text = String(dl).trim();
      if (
        text &&
        !/(you need to|participants must|needs to be paid)/i.test(text)
      ) {
        deadlines.push({ text, fileId, filename });
      }
    });

    (data.amounts || []).forEach((amt) => {
      const text = String(amt).trim();
      if (text) amounts.push({ text, fileId, filename });
    });

    (data.important_facts || []).forEach((fact) => {
      const text = String(fact).trim();
      if (!text || text.startsWith("Document: ")) return;
      if (isCompletedText(text)) {
        completedFacts.push({ text, fileId, filename });
      }
    });

    ["entities", "people", "organizations", "events"].forEach((key) => {
      (data[key] || []).forEach((val) => {
        const s = String(val || "").trim();
        if (s && !s.startsWith("Document:")) allEntities.add(s);
      });
    });
  }

  return {
    pendingActions,
    completedFacts,
    deadlines,
    amounts,
    entityTotal: allEntities.size,
  };
}

function renderStats() {
  const agg = getAggregatedVaultStats();
  elements.fileCount.textContent = String(state.files.length);
  elements.contextCount.textContent = String(state.context.length);
  elements.relationshipCount.textContent = String(state.relationships.length);
  elements.actionCount.textContent = String(agg.pendingActions.length);
  elements.entityCount.textContent = String(agg.entityTotal);
  elements.amountCount.textContent = String(agg.amounts.length);

  const analyzed = state.files.filter((f) => f.status === "analyzed").length;
  const failed = state.files.filter((f) => f.status === "failed").length;
  document.getElementById("fileSubtext").textContent =
    `${analyzed} analyzed · ${failed} failed`;
  document.getElementById("deadlineSubtext").textContent =
    `${agg.deadlines.length} documented deadlines`;
  document.getElementById("amountPreviewSub").textContent = agg.amounts.length
    ? agg.amounts.map((a) => a.text).slice(0, 3).join(" · ")
    : "Fees & receipts";

  document.getElementById("navBadgeFiles").textContent = String(state.files.length);
  document.getElementById("navBadgeContext").textContent = String(state.context.length);
  document.getElementById("navBadgeActions").textContent = String(agg.pendingActions.length);
  document.getElementById("navBadgeTelemetry").textContent = String(state.relationships.length);
  document.getElementById("navBadgeGraph").textContent = String(
    state.files.length + agg.entityTotal,
  );
}

function renderFiles() {
  const searchQuery = (document.getElementById("fileSearchInput")?.value || "").toLowerCase();
  const statusFilter = document.getElementById("fileStatusFilter")?.value || "all";

  const filtered = state.files.filter((file) => {
    const matchesStatus = statusFilter === "all" || file.status === statusFilter;
    const matchesQuery =
      !searchQuery ||
      String(file.name).toLowerCase().includes(searchQuery) ||
      String(file.extension || "").toLowerCase().includes(searchQuery) ||
      String(file.hash || "").toLowerCase().includes(searchQuery);
    return matchesStatus && matchesQuery;
  });

  const dashList = document.getElementById("dashboardFileList");
  if (dashList) {
    dashList.innerHTML = state.files.length
      ? state.files
        .slice(0, 5)
        .map(
          (file) => `
          <li class="file-item" data-file-id="${file.id}" data-filename="${escapeHtml(file.name)}">
            <div>
              <strong>
                <i data-lucide="${iconForExtension(file.name)}" class="icon-sm"></i>
                ${escapeHtml(file.name)}
              </strong>
              <span>${escapeHtml(file.extension || ".txt")} · ${escapeHtml(String(file.hash || "").slice(0, 10))}…</span>
            </div>
            <span class="pill ${escapeHtml(file.status)}">${escapeHtml(file.status)}</span>
          </li>
        `,
        )
        .join("")
      : '<li class="empty-state">No files indexed yet. Scan a folder above.</li>';
  }

  if (!filtered.length) {
    elements.fileList.innerHTML = '<li class="empty-state">No matching files found.</li>';
    refreshIcons();
    return;
  }

  elements.fileList.innerHTML = filtered
    .map((file) => {
      const ctx = state.context.find((c) => c.file_id === file.id);
      const summary = ctx ? ctx.summary : "No summary extracted.";
      const kb = file.size ? `${(Number(file.size) / 1024).toFixed(1)} KB` : "—";
      return `
        <li class="file-item vault-file-card" data-file-id="${file.id}" data-filename="${escapeHtml(file.name)}">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="mono-label">#${file.id} · ${escapeHtml(file.extension || ".file")}</span>
            <span class="pill ${escapeHtml(file.status)}">${escapeHtml(file.status)}</span>
          </div>
          <div>
            <strong>
              <i data-lucide="${iconForExtension(file.name)}" class="icon-sm"></i>
              ${escapeHtml(file.name)}
            </strong>
            <p style="color:var(--text-secondary);font-size:0.81rem;margin-top:4px;">${escapeHtml(summary)}</p>
          </div>
          <div style="display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:0.7rem;color:var(--text-muted);padding-top:8px;border-top:1px solid var(--border-subtle);">
            <span>${kb}</span>
            <span>SHA256: ${escapeHtml(String(file.hash || "—").slice(0, 12))}…</span>
          </div>
        </li>
      `;
    })
    .join("");

  refreshIcons();
}

function renderContextExplorer() {
  const query = (document.getElementById("contextSearchInput")?.value || "").toLowerCase();
  const category = state.activeCategory;

  const cloudEl = document.getElementById("entityPillsCloud");
  const pillItems = [];
  for (const entry of state.context) {
    const data = entry.data || {};
    const keys =
      category === "all"
        ? ["events", "deadlines", "actions", "amounts", "people", "organizations", "dates", "entities"]
        : [category];

    for (const k of keys) {
      for (const val of data[k] || []) {
        const strVal = String(val).trim();
        if (!strVal || strVal.startsWith("Document: ") || strVal.startsWith("Review ")) continue;
        if (query && !strVal.toLowerCase().includes(query)) continue;
        pillItems.push({ label: strVal, type: k, fileId: entry.file_id, filename: entry.filename });
      }
    }
  }

  if (cloudEl) {
    cloudEl.innerHTML = pillItems.length
      ? pillItems
        .slice(0, 36)
        .map(
          (item) => `
          <span
            class="file-ref-chip"
            data-file-id="${item.fileId}"
            data-filename="${escapeHtml(item.filename)}"
          >
            <i data-lucide="tag" class="icon-xs"></i>
            <small style="opacity:0.65;">${escapeHtml(item.type)}:</small>
            ${escapeHtml(item.label)}
          </span>
        `,
        )
        .join("")
      : '<div class="empty-state" style="width:100%;">No extracted entities match this filter.</div>';
  }

  const filteredContexts = state.context.filter((entry) => {
    const haystack = JSON.stringify(entry).toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (category !== "all") {
      const arr = (entry.data || {})[category] || [];
      return arr.length > 0;
    }
    return true;
  });

  if (!filteredContexts.length) {
    elements.contextList.innerHTML = '<div class="empty-state">No extracted context records.</div>';
    refreshIcons();
    return;
  }

  elements.contextList.innerHTML = filteredContexts
    .map((entry) => {
      const data = entry.data || {};
      const rows = [
        ["Events", data.events],
        ["Deadlines", data.deadlines],
        ["Actions", data.actions],
        ["Amounts", data.amounts],
        ["People", data.people],
        ["Organizations", data.organizations],
        ["Dates", data.dates],
        ["Facts", data.important_facts],
      ]
        .filter(([, values]) => Array.isArray(values) && values.length > 0)
        .map(
          ([label, values]) => `
          <div class="structured-row">
            <strong>${escapeHtml(label)}:</strong>
            <span>${escapeHtml(values.join(" · "))}</span>
          </div>
        `,
        )
        .join("");

      return `
        <article class="context-card">
          <div class="mini-header">
            ${renderFileChip(entry.file_id, entry.filename || "source")}
            <span class="chip">CTX #${entry.id || entry.file_id}</span>
          </div>
          <p style="font-weight:600;font-size:0.94rem;">${escapeHtml(entry.summary || "No summary available.")}</p>
          <div class="structured-group-list">
            ${rows || '<span style="color:var(--text-muted);font-size:0.78rem;">No additional structured fields.</span>'}
          </div>
        </article>
      `;
    })
    .join("");

  refreshIcons();
}

function renderActionMatrixAndRadar() {
  const agg = getAggregatedVaultStats();
  const focus =
    agg.pendingActions.find(
      (item) =>
        /\b(?:need(?:s)? to|must|should|submit|pay|send|finalize|not finalized|not completed)\b/i.test(item.text) &&
        !/^payment (?:status|date):/i.test(item.text.trim()),
    ) || agg.deadlines[0] || null;
  const isAction = Boolean(focus && agg.pendingActions.includes(focus));
  const hasItemsToReview = agg.pendingActions.length > 0 || agg.deadlines.length > 0;
  const focusCard = document.getElementById("dashboardFocusCard");
  if (focusCard) {
    const priority = focus
      ? isAction
        ? "action"
        : "deadline"
      : hasItemsToReview
        ? "review"
        : "clear";
    focusCard.dataset.priority = priority;
    document.getElementById("dashboardFocusLabel").textContent =
      priority === "action"
        ? "NEXT PRIORITY"
        : priority === "deadline"
          ? "UPCOMING DEADLINE"
          : priority === "review"
            ? "REVIEW EXTRACTED ITEMS"
            : "VAULT STATUS";
    document.getElementById("dashboardFocusText").textContent = focus
      ? focus.text.replace(/^[-*]\s*/, "")
      : hasItemsToReview
        ? `${agg.pendingActions.length + agg.deadlines.length} extracted ${agg.pendingActions.length + agg.deadlines.length === 1 ? "item is" : "items are"} ready for review.`
        : state.files.length
          ? "No open actions surfaced. Your vault is looking clear."
          : "Scan a folder to build your first connected overview.";
    document.getElementById("dashboardFocusSource").innerHTML = focus
      ? renderFileChip(focus.fileId, focus.filename)
      : "";
    document.getElementById("dashboardFocusIcon").setAttribute(
      "data-lucide",
      priority === "deadline"
        ? "calendar-clock"
        : priority === "clear"
          ? "circle-check"
          : priority === "review"
            ? "list-checks"
            : "zap",
    );
    const focusButton = document.getElementById("dashboardFocusButton");
    focusButton.dataset.navTarget = hasItemsToReview ? "actions" : "files";
    focusButton.querySelector("span").textContent = hasItemsToReview
      ? "Review action board"
      : "View vault files";
  }

  const radar = document.getElementById("dashboardActionFeed");
  if (radar) {
    const combined = [
      ...agg.pendingActions.map((a) => ({ ...a, badge: "PENDING", cls: "warning" })),
      ...agg.deadlines.map((d) => ({ ...d, badge: "DEADLINE", cls: "failed" })),
      ...agg.completedFacts.map((c) => ({ ...c, badge: "DONE", cls: "analyzed" })),
    ];
    radar.innerHTML = combined.length
      ? combined
        .slice(0, 7)
        .map(
          (item) => `
          <div class="kanban-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span class="pill ${item.cls}">${item.badge}</span>
              ${renderFileChip(item.fileId, item.filename)}
            </div>
            <p>${escapeHtml(item.text)}</p>
          </div>
        `,
        )
        .join("")
      : '<div class="empty-state">No pending actions or deadlines discovered yet.</div>';
  }

  document.getElementById("matrixPendingCount").textContent = String(agg.pendingActions.length);
  document.getElementById("matrixDeadlineCount").textContent = String(agg.deadlines.length);
  document.getElementById("matrixCompletedCount").textContent = String(agg.completedFacts.length);
  document.getElementById("matrixAmountCount").textContent = String(agg.amounts.length);

  const renderCol = (items, emptyText) =>
    items.length
      ? items
        .map(
          (item) => `
        <div class="kanban-card">
          <p>${escapeHtml(item.text)}</p>
          <div>${renderFileChip(item.fileId, item.filename)}</div>
        </div>
      `,
        )
        .join("")
      : `<div class="empty-state">${emptyText}</div>`;

  document.getElementById("matrixPendingList").innerHTML = renderCol(
    agg.pendingActions,
    "No pending tasks.",
  );
  document.getElementById("matrixDeadlineList").innerHTML = renderCol(
    agg.deadlines,
    "No deadlines found.",
  );
  document.getElementById("matrixCompletedList").innerHTML = renderCol(
    agg.completedFacts,
    "No completed items logged.",
  );
  document.getElementById("matrixAmountList").innerHTML = renderCol(
    agg.amounts,
    "No amounts documented.",
  );

  refreshIcons();
}

function renderRelationshipsAndTelemetry() {
  const html = state.relationships.length
    ? state.relationships
      .map(
        (rel) => `
        <div class="relation-item">
          <span class="dot"></span>
          <div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px;">
              <strong>${escapeHtml(rel.relationship_type)}</strong>
              ${renderFileChip(rel.source_id, rel.source_name || `File #${rel.source_id}`)}
              <i data-lucide="arrow-left-right" class="icon-xs" style="color:var(--text-muted);"></i>
              ${renderFileChip(rel.target_id, rel.target_name || `File #${rel.target_id}`)}
            </div>
            <p style="color:var(--text-secondary);font-size:0.81rem;">${escapeHtml(rel.reason)}</p>
          </div>
          <span class="confidence">${Number(rel.confidence || 0).toFixed(2)}</span>
        </div>
      `,
      )
      .join("")
    : '<div class="empty-state">No cross-file relationships discovered yet.</div>';

  elements.relationshipList.innerHTML = html;
  const dashRel = document.getElementById("dashboardRelationshipList");
  if (dashRel) dashRel.innerHTML = html;

  const dot = document.getElementById("aiHealthDot");
  if (dot) {
    dot.style.background = state.health.ai_configured ? "#10b981" : "#f59e0b";
  }

  const telemetryBox = document.getElementById("systemTelemetryBox");
  if (telemetryBox) {
    telemetryBox.innerHTML = `
      <div class="kanban-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>Gemini Reasoning Adapter</strong>
          <span class="pill ${state.health.ai_configured ? "analyzed" : "warning"}">
            ${state.health.ai_configured ? "ONLINE" : "LOCAL FALLBACK"}
          </span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-secondary);">
          <span>Model: ${escapeHtml(state.health.model || "gemini-2.5-flash")}</span>
          <span>Indexed Files: ${state.files.length}</span>
        </div>
      </div>
    `;
  }

  const errList = document.getElementById("errorLogList");
  if (errList) {
    errList.innerHTML = state.errors.length
      ? state.errors
        .map(
          (err) => `
          <div class="kanban-card" style="border-color:rgba(244,63,94,0.35);">
            <span class="mono-label" style="color:#fda4af;">${escapeHtml(err.created_at)}</span>
            <p>${escapeHtml(err.message)}</p>
          </div>
        `,
        )
        .join("")
      : '<div class="empty-state">No processing errors recorded.</div>';
  }

  refreshIcons();
}

/* =====================================================================
   MODULE 6: ASK AI STUDIO & CONVERSATIONAL SYNTHESIS
   ===================================================================== */
function renderChatStream() {
  if (!elements.chatStream) return;
  elements.chatStream.innerHTML = state.chatHistory
    .map((turn) => {
      if (turn.role === "user") {
        return `
          <div class="chat-bubble user">
            <div class="bubble-header"><span>YOU</span></div>
            <div>${escapeHtml(turn.text)}</div>
          </div>
        `;
      }

      const confPct = Math.round(Number(turn.confidence ?? 0.9) * 100);
      const sourcesHtml =
        turn.sources && turn.sources.length
          ? `
          <div class="bubble-citations">
            <span class="mono-label">SOURCES:</span>
            ${turn.sources.map((s) => renderFileChip(s.file_id, s.filename)).join("")}
          </div>
        `
          : "";

      return `
        <div class="chat-bubble assistant">
          <div class="bubble-header">
            <span>CONTEXTVAULT</span>
            <span>${confPct}% CONFIDENCE</span>
          </div>
          <div style="white-space:pre-line;">${escapeHtml(turn.text)}</div>
          ${sourcesHtml}
        </div>
      `;
    })
    .join("");

  elements.chatStream.scrollTop = elements.chatStream.scrollHeight;
  refreshIcons();
}

async function askContextVault(customQuestion) {
  const inputEl = elements.queryInput;
  const question = (customQuestion ?? inputEl.value).trim();
  if (!question) return;

  if (!customQuestion) inputEl.value = "";
  navigateTo("ask");

  state.chatHistory.push({ role: "user", text: question });
  renderChatStream();
  setStatus("Synthesizing response...");

  try {
    const result = await apiRequest("/api/query", {
      method: "POST",
      body: JSON.stringify({ query: question }),
    });

    const answer = result.answer || "No answer available.";
    const sources = result.sources || [];
    const confidence = Number(result.confidence ?? 0.92);
    const sufficient = result.has_sufficient_context ?? true;

    state.chatHistory.push({
      role: "assistant",
      text: answer,
      confidence,
      has_sufficient_context: sufficient,
      sources,
    });
    renderChatStream();

    elements.answerText.textContent = answer;
    document.getElementById("answerConfidenceBadge").textContent =
      `${Math.round(confidence * 100)}%`;
    document.getElementById("answerConfidenceBar").style.width =
      `${Math.round(confidence * 100)}%`;

    const suffBadge = document.getElementById("contextSufficiencyBadge");
    suffBadge.textContent = sufficient ? "Grounded" : "Partial Context";
    suffBadge.className = `pill ${sufficient ? "analyzed" : "warning"}`;

    document.getElementById("sourceCountBadge").textContent =
      `${sources.length} Source${sources.length === 1 ? "" : "s"}`;

    elements.sourcesList.innerHTML = sources.length
      ? sources
        .map(
          (source) => `
          <li
            class="source-card"
            data-file-id="${source.file_id}"
            data-filename="${escapeHtml(source.filename)}"
          >
            <div style="display:flex;align-items:center;gap:10px;">
              <i data-lucide="${iconForExtension(source.filename)}" class="icon-sm" style="color:#a5b4fc;"></i>
              <div>
                <strong style="display:block;font-size:0.85rem;">${escapeHtml(source.filename)}</strong>
                <small style="color:var(--text-muted);font-family:'JetBrains Mono',monospace;font-size:0.69rem;">
                  File #${source.file_id} · Click to inspect
                </small>
              </div>
            </div>
            <span class="badge badge-indigo">Inspect ⤢</span>
          </li>
        `,
        )
        .join("")
      : '<li class="empty-state">No personal files required for this answer.</li>';

    refreshIcons();
    setStatus("Ready");
  } catch (error) {
    elements.answerText.textContent = error.message;
    elements.sourcesList.innerHTML = "";
    state.chatHistory.push({
      role: "assistant",
      text: `Error: ${error.message}`,
      confidence: 0,
      has_sufficient_context: false,
      sources: [],
    });
    renderChatStream();
    setStatus("Query failed");
  }
}

/* =====================================================================
   MODULE 7: HOVER QUICK-PEEK & DEEP FILE INSPECTOR
   ===================================================================== */
async function fetchFilePreviewData(fileId, filename) {
  const record = findFileRecord(fileId, filename);
  const resolvedId = record ? record.id : fileId;

  if (resolvedId && state.previewCache.has(Number(resolvedId))) {
    return state.previewCache.get(Number(resolvedId));
  }

  if (resolvedId) {
    try {
      const data = await apiRequest(`/api/files/${resolvedId}/preview`);
      state.previewCache.set(Number(resolvedId), data);
      return data;
    } catch {
      // Fallback if preview route is unavailable
    }
  }

  const ctx = state.context.find(
    (c) =>
      (resolvedId && Number(c.file_id) === Number(resolvedId)) ||
      (filename && String(c.filename).toLowerCase() === String(filename).toLowerCase()),
  );

  return {
    file: record || {
      id: resolvedId || 0,
      name: filename || "symposium_notice.txt",
      status: "analyzed",
      extension: ".txt",
      hash: "709c49991cff072e3714d665",
    },
    exists_on_disk: false,
    preview_type: "text",
    text_content: ctx
      ? ctx.summary
      : "Annual Tech Symposium 2026\nRegistration deadline: 30 September 2026\nParticipants must submit a project abstract during registration.\nRegistration fee: ₹500.",
    context: ctx ? [ctx] : [],
    relationships: state.relationships.filter(
      (r) => r.source_id === resolvedId || r.target_id === resolvedId,
    ),
  };
}

let hoverTimer = null;

function positionHoverCard(clientX, clientY) {
  const card = elements.fileHoverCard;
  const pad = 16;
  const width = 360;
  const height = 265;
  let left = clientX + pad;
  let top = clientY + pad;

  if (left + width > window.innerWidth - 16) {
    left = clientX - width - pad;
  }
  if (top + height > window.innerHeight - 16) {
    top = Math.max(16, window.innerHeight - height - 16);
  }

  card.style.left = `${Math.max(12, left)}px`;
  card.style.top = `${Math.max(12, top)}px`;
}

async function showHoverPreview(targetEl, clientX, clientY) {
  const fileId = targetEl.dataset.fileId;
  const filename = targetEl.dataset.filename;
  if (!fileId && !filename) return;

  positionHoverCard(clientX, clientY);
  elements.fileHoverCard.classList.remove("hidden");

  const data = await fetchFilePreviewData(fileId, filename);
  if (!data || !data.file) return;

  const file = data.file;
  const ctx = (data.context && data.context[0]) || {};
  const ctxData = ctx.data || {};

  document.getElementById("hoverExt").textContent = (file.extension || ".TXT").toUpperCase();
  document.getElementById("hoverFilename").textContent = file.name || filename;
  document.getElementById("hoverHash").textContent =
    `SHA256: ${String(file.hash || "verified").slice(0, 12)}…`;
  document.getElementById("hoverStatus").textContent = file.status || "analyzed";
  document.getElementById("hoverSummary").textContent =
    ctx.summary || "Indexed Vault Document";

  const tags = [
    ...(ctxData.amounts || []),
    ...(ctxData.deadlines || []).slice(0, 1),
    ...(ctxData.events || []).slice(0, 2),
  ].slice(0, 3);

  document.getElementById("hoverTags").innerHTML = tags
    .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
    .join("");

  const snippetEl = document.getElementById("hoverRawSnippet");
  if (data.preview_type === "image" && data.raw_url) {
    snippetEl.innerHTML = `<img src="${API_BASE}${data.raw_url}" alt="${escapeHtml(file.name)}" style="max-height:85px;border-radius:4px;" />`;
  } else if (data.text_content) {
    snippetEl.textContent = data.text_content.slice(0, 240);
  } else {
    const facts = (ctxData.actions || []).concat(ctxData.important_facts || []);
    snippetEl.textContent = facts.length
      ? facts.join("\n• ")
      : "Click to open full file inspector.";
  }
}

function hideHoverPreview() {
  clearTimeout(hoverTimer);
  elements.fileHoverCard.classList.add("hidden");
}

async function openFileInspector(fileId, filename) {
  hideHoverPreview();
  const data = await fetchFilePreviewData(fileId, filename);
  if (!data || !data.file) return;

  const file = data.file;
  const ctx = (data.context && data.context[0]) || {};
  const ctxData = ctx.data || {};

  document.getElementById("inspectorEyebrow").textContent =
    `FILE INSPECTOR · ID #${file.id}`;
  document.getElementById("inspectorFilename").textContent = file.name;

  const rawLink = document.getElementById("inspectorRawLink");
  if (data.raw_url) {
    rawLink.href = `${API_BASE}${data.raw_url}`;
    rawLink.style.display = "inline-flex";
  } else {
    rawLink.style.display = "none";
  }

  document.getElementById("inspectorMetaStrip").innerHTML = `
    <span><strong>Status:</strong> ${escapeHtml(file.status)}</span>
    <span><strong>Size:</strong> ${file.size ? `${(file.size / 1024).toFixed(2)} KB` : "—"}</span>
    <span><strong>SHA-256:</strong> ${escapeHtml(String(file.hash || "—").slice(0, 18))}…</span>
    <span><strong>Path:</strong> ${escapeHtml(file.path || file.name)}</span>
  `;

  const previewBox = document.getElementById("inspectorPreviewContainer");
  if (data.preview_type === "image" && data.raw_url) {
    previewBox.innerHTML = `<img class="preview-image" src="${API_BASE}${data.raw_url}" alt="${escapeHtml(file.name)}" />`;
  } else if (data.preview_type === "pdf" && data.raw_url) {
    previewBox.innerHTML = `<iframe class="preview-pdf" src="${API_BASE}${data.raw_url}"></iframe>`;
  } else if (data.text_content) {
    previewBox.innerHTML = `<pre class="json-code-block">${escapeHtml(data.text_content)}</pre>`;
  } else {
    previewBox.innerHTML = `<div class="empty-state">${escapeHtml(ctx.summary || file.name)}</div>`;
  }

  const structKeys = [
    ["Summary", [ctx.summary || "—"]],
    ["Pending Actions", ctxData.actions],
    ["Deadlines", ctxData.deadlines],
    ["Amounts", ctxData.amounts],
    ["Important Facts", ctxData.important_facts],
    ["Events", ctxData.events],
    ["People", ctxData.people],
    ["Organizations", ctxData.organizations],
    ["Dates", ctxData.dates],
  ];
  document.getElementById("inspectorStructuredContainer").innerHTML = structKeys
    .map(([label, arr]) => {
      const items = (arr || []).filter(Boolean);
      return `
        <div class="kanban-card">
          <span class="mono-label">${escapeHtml(label)} (${items.length})</span>
          <div>${items.length ? items.map((x) => `<p style="margin:3px 0;">• ${escapeHtml(x)}</p>`).join("") : '<span style="color:var(--text-muted);font-size:0.78rem;">None</span>'}</div>
        </div>
      `;
    })
    .join("");

  const rels = data.relationships || [];
  document.getElementById("inspectorConnectionsContainer").innerHTML = rels.length
    ? rels
      .map(
        (r) => `
        <div class="kanban-card">
          <div style="display:flex;justify-content:space-between;">
            <strong>${escapeHtml(r.relationship_type)}</strong>
            <span class="confidence">${Number(r.confidence || 0).toFixed(2)}</span>
          </div>
          <p>${escapeHtml(r.reason)}</p>
          <div>
            ${renderFileChip(r.source_id, r.source_name || `File #${r.source_id}`)}
            ⟷
            ${renderFileChip(r.target_id, r.target_name || `File #${r.target_id}`)}
          </div>
        </div>
      `,
      )
      .join("")
    : '<div class="empty-state">No linked files found.</div>';

  document.getElementById("inspectorJsonPre").textContent = JSON.stringify(
    { file, context: ctx },
    null,
    2,
  );

  elements.fileInspectorBackdrop.classList.remove("hidden");
  refreshIcons();
}

/* =====================================================================
   MODULE 8: FORCE-DIRECTED GRAPH ENGINE
   ===================================================================== */
function buildGraphTopology() {
  const filter = document.getElementById("graphFilterSelect")?.value || "all";
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();

  const addNode = (id, label, type, fileId = null, filename = null) => {
    if (!nodeMap.has(id)) {
      const angle = nodes.length * 1.7 * Math.PI;
      const radius = 85 + (nodes.length % 5) * 34;
      const node = {
        id,
        label: String(label).slice(0, 26),
        type,
        fileId,
        filename,
        x: 340 + Math.cos(angle) * radius,
        y: 180 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        hoverProgress: 0,
      };
      nodes.push(node);
      nodeMap.set(id, node);
    }
    return nodeMap.get(id);
  };

  state.files.forEach((f) => {
    addNode(`file_${f.id}`, f.name, "file", f.id, f.name);
  });

  state.relationships.forEach((rel) => {
    const src = `file_${rel.source_id}`;
    const tgt = `file_${rel.target_id}`;
    if (nodeMap.has(src) && nodeMap.has(tgt)) {
      edges.push({ source: src, target: tgt, type: "relationship" });
    }
  });

  if (filter !== "files_only") {
    state.context.forEach((ctx) => {
      const fileNodeId = `file_${ctx.file_id}`;
      if (!nodeMap.has(fileNodeId)) return;
      const data = ctx.data || {};

      if (filter === "all" || filter === "events") {
        [...(data.events || []), ...(data.deadlines || []), ...(data.amounts || [])]
          .slice(0, 3)
          .forEach((ev) => {
            const clean = String(ev).trim();
            if (!clean || clean.startsWith("Document:")) return;
            const id = `ev_${clean.toLowerCase()}`;
            addNode(id, clean, "event", ctx.file_id, ctx.filename);
            edges.push({ source: fileNodeId, target: id, type: "event" });
          });
      }

      if (filter === "all" || filter === "actions") {
        (data.actions || []).slice(0, 2).forEach((act) => {
          const clean = String(act).trim();
          if (!clean || clean.toLowerCase().startsWith("review ")) return;
          const id = `act_${clean.toLowerCase()}`;
          addNode(id, clean, "action", ctx.file_id, ctx.filename);
          edges.push({ source: fileNodeId, target: id, type: "action" });
        });
      }
    });
  }

  state.graphNodes = nodes;
  state.graphEdges = edges;
  state.hoveredGraphNode = null;
  const hud = document.getElementById("graphHudStats");
  if (hud) hud.textContent = `${nodes.length} Nodes · ${edges.length} Edges`;
}

function stepAndDrawGraph(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const nodes = state.graphNodes;
  const edges = state.graphEdges;
  if (!nodes.length) {
    ctx.fillStyle = "#536762";
    ctx.font = "13px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText("Scan a folder to visualize context relationships.", 24, height / 2);
    return;
  }

  if (state.physicsEnabled) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x || 1;
        const dy = b.y - a.y || 1;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 190) {
          const force = (190 - dist) * 0.011;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }
    }

    for (const edge of edges) {
      const a = nodes.find((n) => n.id === edge.source);
      const b = nodes.find((n) => n.id === edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const force = (dist - 120) * 0.014;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    for (const node of nodes) {
      if (node === state.draggedNode) continue;
      node.vx += (width / 2 - node.x) * 0.0025;
      node.vy += (height / 2 - node.y) * 0.0025;
      node.vx *= 0.8;
      node.vy *= 0.8;
      node.x = Math.max(45, Math.min(width - 45, node.x + node.vx));
      node.y = Math.max(30, Math.min(height - 30, node.y + node.vy));
    }
  }

  for (const node of nodes) {
    const targetProgress = state.hoveredGraphNode === node.id ? 1 : 0;
    node.hoverProgress += (targetProgress - node.hoverProgress) * 0.18;
  }

  const edgeColors = {
    relationship: "rgba(83, 102, 173, 0.56)",
    event: "rgba(8, 126, 155, 0.52)",
    action: "rgba(152, 96, 10, 0.5)",
  };
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";
  for (const edge of edges) {
    const a = nodes.find((n) => n.id === edge.source);
    const b = nodes.find((n) => n.id === edge.target);
    if (!a || !b) continue;
    const edgeFocus = Math.max(a.hoverProgress, b.hoverProgress);
    ctx.globalAlpha = state.hoveredGraphNode ? 0.16 + edgeFocus * 0.84 : 1;
    ctx.strokeStyle = edgeColors[edge.type] || edgeColors.relationship;
    ctx.lineWidth = 1 + edgeFocus * 1.1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (const node of nodes) {
    const color =
      node.type === "file"
        ? "#0f766e"
        : node.type === "event"
          ? "#087e9b"
          : "#a86104";
    const radius = (node.type === "file" ? 9 : 6) + node.hoverProgress * 1.5;

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 3 + node.hoverProgress * 9;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }

  for (const node of nodes) {
    const color =
      node.type === "file"
        ? "#0f766e"
        : node.type === "event"
          ? "#087e9b"
          : "#a86104";
    const radius = (node.type === "file" ? 9 : 6) + node.hoverProgress * 1.5;
    const isHovered = state.hoveredGraphNode === node.id;
    const labelX = node.x + radius + 7;
    const labelY = node.y + 4;

    ctx.font = `${isHovered ? 700 : 600} ${14 + Math.round(node.hoverProgress)}px 'JetBrains Mono', monospace`;
    ctx.textBaseline = "middle";
    if (node.hoverProgress > 0.08) {
      const labelWidth = ctx.measureText(node.label).width;
      ctx.beginPath();
      ctx.roundRect(labelX - 5, labelY - 10, labelWidth + 10, 20, 5);
      ctx.globalAlpha = node.hoverProgress;
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.lineWidth = 5;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.98)";
      ctx.strokeText(node.label, labelX, labelY);
    }
    ctx.fillStyle = isHovered ? "#123f39" : "#173b36";
    ctx.fillText(node.label, labelX, labelY);
  }
}

function attachCanvasInteractivity(canvas) {
  if (!canvas) return;

  const getHitNode = (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (event.clientX - rect.left) * scaleX;
    const my = (event.clientY - rect.top) * scaleY;
    return {
      mx,
      my,
      node: state.graphNodes.find((n) => Math.hypot(n.x - mx, n.y - my) < 16),
    };
  };

  canvas.addEventListener("mousedown", (event) => {
    const { node } = getHitNode(event);
    if (node) state.draggedNode = node;
  });

  canvas.addEventListener("mousemove", (event) => {
    const { mx, my, node } = getHitNode(event);
    if (state.draggedNode) {
      state.draggedNode.x = mx;
      state.draggedNode.y = my;
      return;
    }
    state.hoveredGraphNode = node?.id || null;
    canvas.style.cursor = node ? "pointer" : "grab";
    if (node && node.fileId) {
      showHoverPreview(
        { dataset: { fileId: node.fileId, filename: node.filename } },
        event.clientX,
        event.clientY,
      );
    } else {
      hideHoverPreview();
    }
  });

  canvas.addEventListener("mouseleave", () => {
    state.hoveredGraphNode = null;
    if (!state.draggedNode) canvas.style.cursor = "grab";
    hideHoverPreview();
  });

  window.addEventListener("mouseup", () => {
    state.draggedNode = null;
  });

  canvas.addEventListener("click", (event) => {
    const { node } = getHitNode(event);
    if (node && node.fileId) {
      openFileInspector(node.fileId, node.filename);
    }
  });
}

function startGraphLoop() {
  const miniCanvas = document.getElementById("miniGraphCanvas");
  const fullCanvas = document.getElementById("fullGraphCanvas");
  attachCanvasInteractivity(miniCanvas);
  attachCanvasInteractivity(fullCanvas);

  function animate() {
    if (state.currentRoute === "dashboard") {
      stepAndDrawGraph(miniCanvas);
    } else if (state.currentRoute === "graph") {
      stepAndDrawGraph(fullCanvas);
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

/* =====================================================================
   MODULE 9: DATA SYNC, SCANNING & COMMAND PALETTE
   ===================================================================== */
async function fetchDashboard() {
  const [files, context, relationships, errors, health] = await Promise.all([
    apiRequest("/api/files"),
    apiRequest("/api/context"),
    apiRequest("/api/relationships"),
    apiRequest("/api/errors").catch(() => ({ errors: [] })),
    apiRequest("/api/health").catch(() => ({ status: "ok", ai_configured: false })),
  ]);

  state.files = files.files || [];
  state.context = context.context || [];
  state.relationships = relationships.relationships || [];
  state.errors = errors.errors || [];
  state.health = health;
  state.previewCache.clear();

  renderLandingHero();
  renderStats();
  renderFiles();
  renderContextExplorer();
  renderActionMatrixAndRadar();
  renderRelationshipsAndTelemetry();
  buildGraphTopology();
  refreshIcons();
}

async function scanFolder() {
  const folderPath = elements.folderPath.value.trim() || ".test";
  const labelEl = document.getElementById("scanBtnLabel");
  if (labelEl) labelEl.textContent = "Scanning...";
  setStatus("Scanning folder...");
  const folderText = document.getElementById("sidebarFolderText");
  if (folderText) folderText.textContent = folderPath;

  try {
    const payload = await apiRequest("/api/scan", {
      method: "POST",
      body: JSON.stringify({ folder_path: folderPath }),
    });

    state.scanStatus = payload;
    await fetchDashboard();
    const msg = `Scan complete: ${payload.processed} processed, ${payload.failed} failed.`;
    setStatus(msg);
    showToast(msg);
  } catch (error) {
    setStatus(error.message);
    showToast(`Scan error: ${error.message}`);
  } finally {
    if (labelEl) labelEl.textContent = "Scan Folder";
  }
}

function openCommandPalette() {
  elements.cmdPaletteBackdrop.classList.remove("hidden");
  const input = document.getElementById("cmdInput");
  input.value = "";
  renderCommandResults("");
  input.focus();
}

function closeCommandPalette() {
  elements.cmdPaletteBackdrop.classList.add("hidden");
}

function renderCommandResults(filterText) {
  const q = filterText.toLowerCase().trim();
  const items = [
    { label: "Product Home (Landing Page)", sub: "Product", action: () => navigateTo("welcome") },
    { label: "Go to Command Overview", sub: "Workspace", action: () => navigateTo("dashboard") },
    { label: "Go to Ask AI Studio", sub: "Workspace", action: () => navigateTo("ask") },
    { label: "Go to Action & Deadline Board", sub: "Workspace", action: () => navigateTo("actions") },
    { label: "Go to Synaptic Knowledge Graph", sub: "Workspace", action: () => navigateTo("graph") },
    { label: "Go to Vault Files", sub: "Repository", action: () => navigateTo("files") },
    { label: "Go to Context Explorer", sub: "Repository", action: () => navigateTo("explorer") },
    ...state.files.map((f) => ({
      label: `Inspect File: ${f.name}`,
      sub: `File #${f.id} · ${f.status}`,
      action: () => openFileInspector(f.id, f.name),
    })),
  ].filter((item) => !q || item.label.toLowerCase().includes(q));

  const container = document.getElementById("cmdResults");
  container.innerHTML = items
    .map(
      (item, idx) => `
      <div class="cmd-item" data-cmd-idx="${idx}">
        <strong>${escapeHtml(item.label)}</strong>
        <span class="mono-label">${escapeHtml(item.sub)}</span>
      </div>
    `,
    )
    .join("");

  container.querySelectorAll(".cmd-item").forEach((el) => {
    el.addEventListener("click", () => {
      const idx = Number(el.dataset.cmdIdx);
      closeCommandPalette();
      items[idx].action();
    });
  });
}

/* =====================================================================
   EVENT DELEGATION & BOOTSTRAP
   ===================================================================== */
document.addEventListener("mouseover", (event) => {
  const trigger = event.target.closest("[data-file-id], [data-filename]");
  if (!trigger) return;
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    showHoverPreview(trigger, event.clientX, event.clientY);
  }, 140);
});

document.addEventListener("mousemove", (event) => {
  if (!elements.fileHoverCard.classList.contains("hidden")) {
    positionHoverCard(event.clientX, event.clientY);
  }
});

document.addEventListener("mouseout", (event) => {
  const trigger = event.target.closest("[data-file-id], [data-filename]");
  if (trigger) hideHoverPreview();
});

document.addEventListener("click", (event) => {
  const journeyStep = event.target.closest("[data-journey-step]");
  if (journeyStep) {
    state.activeJourneyStep = journeyStep.dataset.journeyStep;
    renderAnswerJourney(HERO_DEMOS[state.activeHeroDemo]);
    return;
  }

  const nextJourneyStep = event.target.closest("#journeyNextStep");
  if (nextJourneyStep) {
    const currentIndex = ANSWER_JOURNEY_STEPS.findIndex(
      (step) => step.id === state.activeJourneyStep,
    );
    const nextIndex = (currentIndex + 1) % ANSWER_JOURNEY_STEPS.length;
    state.activeJourneyStep = ANSWER_JOURNEY_STEPS[nextIndex].id;
    renderAnswerJourney(HERO_DEMOS[state.activeHeroDemo]);
    return;
  }

  const demoTab = event.target.closest("[data-demo]");
  if (demoTab) {
    document.querySelectorAll(".win-tab").forEach((b) => b.classList.remove("active"));
    demoTab.classList.add("active");
    state.activeHeroDemo = demoTab.dataset.demo;
    renderLandingHero();
    return;
  }

  const navBtn = event.target.closest("[data-nav-target]");
  if (navBtn) {
    navigateTo(navBtn.dataset.navTarget);
    return;
  }

  const preset = event.target.closest(".suggestion-chip");
  if (preset && preset.dataset.query) {
    askContextVault(preset.dataset.query);
    return;
  }

  const fileTrigger = event.target.closest("[data-file-id], [data-filename]");
  if (fileTrigger) {
    event.preventDefault();
    openFileInspector(fileTrigger.dataset.fileId, fileTrigger.dataset.filename);
  }
});

document.getElementById("scanBtn").addEventListener("click", scanFolder);
document.getElementById("heroQuickScanBtn")?.addEventListener("click", () => {
  navigateTo("dashboard");
  scanFolder();
});
document.getElementById("refreshBtn").addEventListener("click", () => {
  fetchDashboard().then(() => showToast("Vault state synced"));
});
document.getElementById("queryBtn").addEventListener("click", () => askContextVault());
document.getElementById("dashboardQuickAskBtn").addEventListener("click", () => {
  const val = document.getElementById("dashboardQuickInput").value.trim();
  if (val) askContextVault(val);
});

document.getElementById("dashboardQuickInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const val = e.target.value.trim();
    if (val) askContextVault(val);
  }
});

document.getElementById("folderPath").addEventListener("keydown", (event) => {
  if (event.key === "Enter") scanFolder();
});

document.getElementById("queryInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") askContextVault();
});

document.getElementById("clearChatBtn").addEventListener("click", () => {
  state.chatHistory = [];
  renderChatStream();
  showToast("Conversation thread cleared");
});

document.getElementById("fileSearchInput")?.addEventListener("input", renderFiles);
document.getElementById("fileStatusFilter")?.addEventListener("change", renderFiles);
document.getElementById("contextSearchInput")?.addEventListener("input", renderContextExplorer);

document.querySelectorAll(".seg-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".seg-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.activeCategory = btn.dataset.cat;
    renderContextExplorer();
  });
});

document.getElementById("graphFilterSelect")?.addEventListener("change", buildGraphTopology);
document.getElementById("graphResetBtn")?.addEventListener("click", buildGraphTopology);
document.getElementById("graphPhysicsBtn")?.addEventListener("click", () => {
  state.physicsEnabled = !state.physicsEnabled;
  const label = document.getElementById("graphPhysicsLabel");
  if (label) {
    label.textContent = state.physicsEnabled ? "Pause Motion" : "Resume Motion";
  }
});

document.getElementById("closeInspectorBtn").addEventListener("click", () => {
  elements.fileInspectorBackdrop.classList.add("hidden");
});
elements.fileInspectorBackdrop.addEventListener("click", (e) => {
  if (e.target === elements.fileInspectorBackdrop) {
    elements.fileInspectorBackdrop.classList.add("hidden");
  }
});
document.querySelectorAll(".drawer-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".drawer-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".insp-pane").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`insp-pane-${tab.dataset.inspTab}`).classList.add("active");
  });
});

document.getElementById("openCmdPaletteBtn").addEventListener("click", openCommandPalette);
document.getElementById("landingCmdBtn")?.addEventListener("click", openCommandPalette);
document.getElementById("closeCmdBtn").addEventListener("click", closeCommandPalette);
document.getElementById("cmdInput").addEventListener("input", (e) => {
  renderCommandResults(e.target.value);
});

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openCommandPalette();
  } else if (e.key === "Escape") {
    closeCommandPalette();
    elements.fileInspectorBackdrop.classList.add("hidden");
  }
});

// Boot application into Product Landing Page by default (or hash route if specified)
const initialHash = window.location.hash.replace(/^#\/?/, "");
navigateTo(VIEW_META[initialHash] ? initialHash : "welcome");
renderChatStream();
renderLandingHero();
initializeLandingMotion();
startGraphLoop();
refreshIcons();
fetchDashboard().catch((error) => {
  setStatus(error.message);
});