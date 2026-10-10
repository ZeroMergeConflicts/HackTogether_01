const sampleFiles = [
  {
    id: 1,
    name: "symposium_notice.txt",
    summary:
      "Official notice for the annual Tech Symposium, including the schedule, registration deadline, fee, venue, and abstract requirement.",
    content:
      "TECH SYMPOSIUM 2026\n\nThe Department of Computer Science is organizing the annual Tech Symposium on 18 October 2026.\nRegistration deadline: 30 September 2026.\nParticipants must submit a project abstract during registration.\n\nRegistration fee: ₹500.\nVenue: Main Auditorium.\n\nFor questions, contact the symposium coordination team.",
  },
  {
    id: 2,
    name: "abstract_planning_notes.txt",
    summary:
      "Planning notes for preparing a project abstract for the Tech Symposium.",
    content:
      "TECH SYMPOSIUM — ABSTRACT PLANNING\n\nInclude the project goal, the proposed approach, and expected results in the abstract.\nKeep the summary focused on the project being presented.",
  },
  {
    id: 3,
    name: "coordinator_message.txt",
    summary:
      "A coordination message confirming symposium logistics and directing questions to the organizing team.",
    content:
      "TECH SYMPOSIUM COORDINATION\n\nThe annual Tech Symposium is scheduled for 18 October 2026 at the Main Auditorium.\nThe registration fee is ₹500. Please contact the symposium coordination team with questions.",
  },
];

const sampleFacts = [
  {
    file: 1,
    summary: sampleFiles[0].summary,
    rows: [
      ["Event", "Annual Tech Symposium"],
      ["Date", "18 October 2026"],
      ["Registration deadline", "30 September 2026"],
      ["Action", "Submit a project abstract during registration"],
      ["Amount", "₹500 registration fee"],
      ["Venue", "Main Auditorium"],
    ],
  },
  {
    file: 2,
    summary: sampleFiles[1].summary,
    rows: [
      ["Project abstract", "Goal · Proposed approach · Expected results"],
    ],
  },
  {
    file: 3,
    summary: sampleFiles[2].summary,
    rows: [
      ["Event", "Annual Tech Symposium"],
      ["Date", "18 October 2026"],
      ["Venue", "Main Auditorium"],
      ["Contact", "Symposium coordination team"],
      ["Amount", "₹500 registration fee"],
    ],
  },
];

const sampleLinks = [
  {
    type: "Shared event",
    left: 1,
    right: 3,
    reason:
      "The official notice and coordinator message both identify the event date and venue.",
  },
  {
    type: "Abstract requirement",
    left: 1,
    right: 2,
    reason:
      "The official notice requires an abstract; planning notes outline what to include.",
  },
];

const viewTitles = {
  welcome: ["PRODUCT / LANDING", "ContextVault"],
  dashboard: ["WORKSPACE / OVERVIEW", "Overview"],
  ask: ["WORKSPACE / AI STUDIO", "Ask ContextVault"],
  actions: ["WORKSPACE / TASK MATRIX", "Action & Deadline Board"],
  graph: ["WORKSPACE / TOPOLOGY", "Synaptic Knowledge Graph"],
  files: ["REPOSITORY / REGISTRY", "Vault Files"],
  upload: ["REPOSITORY / ADD SOURCES", "Upload Files"],
  explorer: ["REPOSITORY / EXTRACTIONS", "Context Explorer"],
  telemetry: ["REPOSITORY / CONNECTIONS", "Links & System Telemetry"],
};

const journeyStages = {
  sources: {
    kicker: "STEP 01 / SOURCES",
    title: "Start with the original files.",
    description: "Every useful detail stays attached to the document it came from.",
    next: "Connect the signals",
    visual:
      '<div class="journey-file-card"><span class="mono-label">SOURCE DOCUMENT</span><strong>symposium_notice.txt</strong><p>Event date · Registration deadline · Fee</p></div><div class="journey-visual-footnote">Original files remain one click away.</div>',
  },
  connections: {
    kicker: "STEP 02 / CROSS-FILE LINKS",
    title: "Bring related facts together.",
    description: "Dates, actions, and amounts become useful when their sources are connected.",
    next: "See the sourced answer",
    visual:
      '<div class="journey-link-map"><div class="journey-file-card"><strong>symposium_notice.txt</strong><p>Event date · Fee</p></div><div class="journey-link-beam"><span></span></div><div class="journey-file-card"><strong>coordinator_message.txt</strong><p>Schedule · Contact</p></div></div><div class="journey-visual-footnote">Shared details connect relevant documents.</div>',
  },
  answer: {
    kicker: "STEP 03 / SOURCED RESPONSE",
    title: "Keep the evidence beside the answer.",
    description: "Open a cited source whenever you want to check the detail for yourself.",
    next: "Restart the answer trail",
    visual:
      '<div class="journey-answer-card"><span class="mono-label">ANSWER FROM THE FILES</span><p>The symposium is on 18 October 2026. Registration closes on 30 September.</p><div class="journey-citations"><span class="file-ref-chip">symposium_notice.txt</span></div></div><div class="journey-visual-footnote">Answer details stay linked to their source.</div>',
  },
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function getFile(id) {
  return sampleFiles.find((file) => file.id === Number(id));
}

function renderJourney(stageName) {
  const stage = journeyStages[stageName] || journeyStages.sources;
  const names = Object.keys(journeyStages);
  const stageIndex = names.indexOf(stageName);
  document.getElementById("journeyStageKicker").textContent = stage.kicker;
  document.getElementById("journeyStageTitle").textContent = stage.title;
  document.getElementById("journeyStageDescription").textContent = stage.description;
  document.getElementById("journeyNextLabel").textContent = stage.next;
  document.getElementById("journeyVisual").innerHTML = stage.visual;
  document.getElementById("journeyProgressFill").style.width = `${((stageIndex + 1) / names.length) * 100}%`;
  document.querySelector(".journey-progress").setAttribute("aria-valuenow", String(stageIndex + 1));
  document.getElementById("answerJourney").dataset.stage = stageName;
  document.querySelectorAll("[data-journey-step]").forEach((button) => {
    const selected = button.dataset.journeyStep === stageName;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  window.lucide?.createIcons();
}

function setRoute(route, updateHash = true) {
  const selected = viewTitles[route] ? route : "dashboard";
  if (updateHash && window.location.hash !== `#/${selected}`) {
    window.location.hash = `#/${selected}`;
  }
  document.body.dataset.shellMode = selected === "welcome" ? "landing" : "workspace";
  if (selected === "welcome") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderLandingExample("symposium");
    return;
  }
  document.querySelectorAll(".view-page").forEach((view) => {
    view.classList.toggle("active", view.id === `view-${selected}`);
  });
  document.querySelectorAll(".nav-item").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === selected);
  });
  document.getElementById("currentViewEyebrow").textContent = viewTitles[selected][0];
  document.getElementById("currentViewTitle").textContent = viewTitles[selected][1];
  if (selected === "graph") drawGraphs();
  window.lucide?.createIcons();
}

function renderLandingExample(name) {
  const examples = {
    symposium: {
      query: "“When is the annual Tech Symposium?”",
      answer: "The annual Tech Symposium is on 18 October 2026.",
      sources: [
        ["symposium_notice.txt", "Event date · 18 October 2026"],
        ["coordinator_message.txt", "Schedule and venue confirmation"],
      ],
    },
    payment: {
      query: "“How much is the registration fee?”",
      answer: "The registration fee is ₹500.",
      sources: [
        ["symposium_notice.txt", "Registration fee · ₹500"],
        ["coordinator_message.txt", "Fee confirmed by the coordination team"],
      ],
    },
    exam: {
      query: "“What should I include in the project abstract?”",
      answer:
        "The planning notes recommend including the project goal, proposed approach, and expected results.",
      sources: [
        ["symposium_notice.txt", "A project abstract is required during registration"],
        ["abstract_planning_notes.txt", "Goal · Proposed approach · Expected results"],
      ],
    },
  };
  const example = examples[name] || examples.symposium;
  document.getElementById("heroDemoQuery").textContent = example.query;
  document.getElementById("heroDemoAnswer").textContent = example.answer;
  document.getElementById("heroDemoSources").innerHTML = example.sources
    .map(
      ([filename, detail]) => `
        <article class="demo-source-card">
          <div style="display:flex;align-items:center;gap:8px;">
            <i data-lucide="file-code-2" class="icon-sm"></i>
            <strong>${escapeHtml(filename)}</strong>
          </div>
          <p>${escapeHtml(detail)}</p>
        </article>
      `,
    )
    .join("");
  document.getElementById("chatStream").innerHTML = `
    <div class="chat-bubble assistant">
      <div class="bubble-header"><span>CONTEXTVAULT</span><span>SAMPLE FILES</span></div>
      <div>Ask about the Tech Symposium schedule, registration fee, venue, or project abstract.</div>
    </div>
  `;
  document.getElementById("heroDemoCitations").innerHTML = example.sources
    .map(([filename]) => `<span class="file-ref-chip">${escapeHtml(filename)}</span>`)
    .join("");
  window.lucide?.createIcons();
}

function renderFiles(filter = "") {
  const query = filter.toLowerCase();
  const files = sampleFiles.filter((file) =>
    `${file.name} ${file.summary}`.toLowerCase().includes(query),
  );
  const cards = files
    .map(
      (file) => `
        <li class="file-item vault-file-card" data-file-id="${file.id}" data-filename="${escapeHtml(file.name)}">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="mono-label">#${file.id} · .txt</span>
            <span class="pill analyzed">analyzed</span>
          </div>
          <div>
            <strong><i data-lucide="file-text" class="icon-sm"></i> ${escapeHtml(file.name)}</strong>
            <p>${escapeHtml(file.summary)}</p>
          </div>
          <div class="file-card-meta"><span>Text document</span><span>Example record</span></div>
        </li>
      `,
    )
    .join("");
  document.getElementById("fileList").innerHTML =
    cards || '<li class="empty-state">No matching files found.</li>';
  document.getElementById("dashboardFileList").innerHTML = sampleFiles
    .map(
      (file) => `
        <li class="file-item" data-file-id="${file.id}" data-filename="${escapeHtml(file.name)}">
          <div><strong><i data-lucide="file-text" class="icon-sm"></i> ${escapeHtml(file.name)}</strong>
          <span>TXT · symposium records</span></div>
          <span class="pill analyzed">analyzed</span>
        </li>
      `,
    )
    .join("");
  window.lucide?.createIcons();
}

function renderRelationships(targetId = "relationshipList") {
  document.getElementById(targetId).innerHTML = sampleLinks
    .map(
      (link) => `
        <div class="relation-item">
          <span class="dot"></span>
          <div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px;">
              <strong>${escapeHtml(link.type)}</strong>
              <button class="file-ref-chip" data-open-file="${link.left}">${escapeHtml(getFile(link.left).name)}</button>
              <i data-lucide="arrow-left-right" class="icon-xs"></i>
              <button class="file-ref-chip" data-open-file="${link.right}">${escapeHtml(getFile(link.right).name)}</button>
            </div>
            <p style="color:var(--text-secondary);font-size:0.81rem;">${escapeHtml(link.reason)}</p>
          </div>
          <span class="confidence">0.96</span>
        </div>
      `,
    )
    .join("");
  window.lucide?.createIcons();
}

function renderContext() {
  const query = document.getElementById("contextSearchInput").value.toLowerCase();
  const category = document.querySelector("#entityCategoryTabs .seg-tab.active")?.dataset.cat || "all";
  const matching = sampleFacts.filter((fact) => {
    const text = `${fact.summary} ${fact.rows.flat().join(" ")}`.toLowerCase();
    return text.includes(query) && (category === "all" || fact.rows.some(([label]) => {
      const key = label.toLowerCase();
      return category === "actions" ? key.includes("action") || key.includes("abstract") :
        category === "deadlines" || category === "dates" ? key.includes("date") || key.includes("deadline") :
          category === "amounts" ? key.includes("amount") || key.includes("fee") :
            category === "events" ? key.includes("event") :
              category === "important_facts" ? true :
                category === "people" || category === "organizations" ? key.includes("contact") : true;
    }));
  });
  document.getElementById("contextList").innerHTML = matching.length
    ? matching.map((fact) => `
        <article class="context-card">
          <div class="mini-header"><button class="file-ref-chip" data-open-file="${fact.file}">${escapeHtml(getFile(fact.file).name)}</button><span class="chip">CTX #${fact.file}</span></div>
          <p style="font-weight:600;font-size:0.94rem;">${escapeHtml(fact.summary)}</p>
          <div class="structured-group-list">${fact.rows.map(([label, value]) => `<div class="structured-row"><strong>${escapeHtml(label)}:</strong><span>${escapeHtml(value)}</span></div>`).join("")}</div>
        </article>
      `).join("")
    : '<div class="empty-state">No extracted context matches this filter.</div>';
  document.getElementById("entityPillsCloud").innerHTML = matching
    .flatMap((fact) => fact.rows.map(([label, value]) =>
      `<button class="file-ref-chip" data-open-file="${fact.file}"><small>${escapeHtml(label)}:</small> ${escapeHtml(value)}</button>`,
    ))
    .join("");
}

function renderActions() {
  const pending = ["Attend the annual Tech Symposium · 18 October 2026"];
  const deadlines = ["Registration deadline · 30 September 2026", "Tech Symposium · 18 October 2026"];
  const amounts = ["Registration fee · ₹500"];
  const fill = (id, values) => {
    document.getElementById(id).innerHTML = values
      .map((value) => `<div class="kanban-card"><p>${escapeHtml(value)}</p><button class="file-ref-chip" data-open-file="1">symposium_notice.txt</button></div>`)
      .join("");
  };
  fill("matrixPendingList", pending);
  fill("matrixDeadlineList", deadlines);
  fill("matrixCompletedList", []);
  fill("matrixAmountList", amounts);
  document.getElementById("matrixPendingCount").textContent = String(pending.length);
  document.getElementById("matrixDeadlineCount").textContent = String(deadlines.length);
  document.getElementById("matrixCompletedCount").textContent = "0";
  document.getElementById("matrixAmountCount").textContent = String(amounts.length);
  document.getElementById("dashboardActionFeed").innerHTML = [...pending, ...deadlines]
    .map((item, index) => `<div class="kanban-card"><div><span class="pill ${index ? "failed" : "warning"}">${index ? "DATE" : "UPCOMING"}</span></div><p>${escapeHtml(item)}</p><button class="file-ref-chip" data-open-file="1">symposium_notice.txt</button></div>`)
    .join("");
}

function drawGraph(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const nodes = [
    { label: "symposium_notice.txt", x: width * 0.22, y: height * 0.38, color: "#0f766e", file: 1 },
    { label: "abstract_planning_notes.txt", x: width * 0.66, y: height * 0.27, color: "#0f766e", file: 2 },
    { label: "coordinator_message.txt", x: width * 0.67, y: height * 0.72, color: "#0f766e", file: 3 },
    { label: "Tech Symposium · 18 Oct", x: width * 0.43, y: height * 0.55, color: "#087e9b" },
  ];
  [[0, 1], [0, 2], [0, 3], [1, 3], [2, 3]].forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(nodes[a].x, nodes[a].y);
    ctx.lineTo(nodes[b].x, nodes[b].y);
    ctx.strokeStyle = "rgba(15,118,110,.24)";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  nodes.forEach((node) => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.file ? 9 : 7, 0, Math.PI * 2);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.font = "600 13px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#173b36";
    ctx.fillText(node.label, node.x + 14, node.y + 4);
  });
}

function drawGraphs() {
  drawGraph(document.getElementById("miniGraphCanvas"));
  drawGraph(document.getElementById("fullGraphCanvas"));
}

const answers = [
  {
    matches: /time|arrive|arrival|start/i,
    answer: "The sample files do not specify an arrival time or start time. The notice only gives the event date, 18 October 2026.",
    sources: [1],
  },
  {
    matches: /fee|cost|pay|paid|amount/i,
    answer: "The registration fee is ₹500. The sample files do not state whether a particular participant has paid.",
    sources: [1, 3],
  },
  {
    matches: /abstract|submit|include/i,
    answer: "Participants must submit a project abstract during registration. The planning notes recommend including the project goal, proposed approach, and expected results.",
    sources: [1, 2],
  },
  {
    matches: /deadline|sept|complete|task|need to|registration/i,
    answer: "The notice lists 30 September 2026 as the registration deadline and says participants must submit a project abstract during registration.",
    sources: [1, 2],
  },
  {
    matches: /where|venue|location/i,
    answer: "The Tech Symposium venue is the Main Auditorium.",
    sources: [1, 3],
  },
  {
    matches: /contact|question|who/i,
    answer: "For questions, contact the symposium coordination team.",
    sources: [1, 3],
  },
  {
    matches: /when|date|day|symposium/i,
    answer: "The annual Tech Symposium is scheduled for 18 October 2026. The registration deadline listed in the notice is 30 September 2026.",
    sources: [1, 3],
  },
];

function ask(question) {
  const text = question.trim();
  if (!text) return;
  const match = answers.find((item) => item.matches.test(text));
  const response = match || {
    answer: "That information is not included in the sample files.",
    sources: [],
  };
  const sourceMarkup = response.sources.map((id) =>
    `<button class="file-ref-chip" data-open-file="${id}">${escapeHtml(getFile(id).name)}</button>`,
  ).join("");
  document.getElementById("chatStream").insertAdjacentHTML("beforeend", `
    <div class="chat-bubble user"><div class="bubble-header"><span>YOU</span></div><div>${escapeHtml(text)}</div></div>
    <div class="chat-bubble assistant"><div class="bubble-header"><span>CONTEXTVAULT</span><span>${match ? "EXAMPLE ANSWER" : "NO MATCHING SOURCE"}</span></div><div style="white-space:pre-line;">${escapeHtml(response.answer)}</div>${sourceMarkup ? `<div class="bubble-citations"><span class="mono-label">SOURCES:</span>${sourceMarkup}</div>` : ""}</div>
  `);
  document.getElementById("chatStream").scrollTop = document.getElementById("chatStream").scrollHeight;
  document.getElementById("answerText").textContent = response.answer;
  document.getElementById("answerConfidenceBadge").textContent = "—";
  document.getElementById("answerConfidenceBar").style.width = "0%";
  document.getElementById("contextSufficiencyBadge").textContent = match ? "Grounded in sample files" : "No matching source";
  document.getElementById("sourceCountBadge").textContent = `${response.sources.length} Sources`;
  document.getElementById("sourcesList").innerHTML = response.sources.length
    ? response.sources.map((id) => `<li class="file-item" data-open-file="${id}"><strong>${escapeHtml(getFile(id).name)}</strong><span>Source document</span></li>`).join("")
    : '<li class="empty-state">No matching sources.</li>';
  const input = document.getElementById("queryInput");
  if (input) input.value = "";
}

function openFile(id) {
  const file = getFile(id);
  if (!file) return;
  document.getElementById("inspectorFilename").textContent = file.name;
  document.getElementById("inspectorMetaStrip").textContent = `Example record · Text file · ${file.content.length} characters`;
  document.getElementById("inspectorPreviewContainer").innerHTML = `<pre class="json-code-block">${escapeHtml(file.content)}</pre>`;
  document.getElementById("inspectorStructuredContainer").innerHTML =
    sampleFacts.find((fact) => fact.file === file.id).rows.map(([label, value]) => `<div class="kanban-card"><span class="mono-label">${escapeHtml(label)}</span><p>${escapeHtml(value)}</p></div>`).join("");
  document.getElementById("inspectorConnectionsContainer").innerHTML = sampleLinks
    .filter((link) => link.left === file.id || link.right === file.id)
    .map((link) => `<div class="kanban-card"><strong>${escapeHtml(link.type)}</strong><p>${escapeHtml(link.reason)}</p></div>`)
    .join("") || '<div class="empty-state">No linked files.</div>';
  document.getElementById("inspectorJsonPre").textContent = JSON.stringify(file, null, 2);
  document.getElementById("inspectorRawLink").href = "#";
  document.getElementById("inspectorIgnoreBtn").hidden = true;
  document.getElementById("fileInspectorBackdrop").classList.remove("hidden");
  window.lucide?.createIcons();
}

function initializeWorkspace() {
  document.getElementById("heroStatFiles").textContent = "3";
  document.getElementById("heroStatContext").textContent = "3";
  document.getElementById("heroStatLinks").textContent = "2";
  document.getElementById("heroStatEngine").textContent = "READY";
  document.querySelector(".hero-pill-banner .pill-link").textContent = "Open workspace →";
  document.querySelector(".landing-nav-Right [data-nav-target] span").textContent = "Open workspace";
  document.querySelector('.hero-cta-group [data-nav-target="dashboard"] span').textContent = "Enter Command Workspace";
  document.querySelector('.hero-cta-group [data-nav-target="ask"] span').textContent = "Ask about sample files";
  document.querySelector('#get-started [data-nav-target="upload"] span').textContent = "Browse sample files";
  document.querySelector('#get-started [data-nav-target="ask"] span').textContent = "Ask a question";
  document.getElementById("landingInteractiveChips").innerHTML = sampleFiles
    .map((file) => `<span class="file-ref-chip">${escapeHtml(file.name)}</span>`)
    .join("");

  document.getElementById("folderPath").value = "Tech Symposium";
  document.getElementById("folderPath").readOnly = true;
  document.getElementById("scanBtnLabel").textContent = "View files";
  document.getElementById("scanBtn").dataset.navTarget = "files";
  document.getElementById("refreshBtn").hidden = true;
  document.getElementById("statusText").textContent = "Ready";
  document.getElementById("sidebarFolderText").textContent = "Tech Symposium";
  document.getElementById("aiModelReadout").textContent = "Example workspace";
  document.getElementById("aiHealthDot").style.background = "#0f766e";

  document.getElementById("dashboardFocusLabel").textContent = "UPCOMING EVENT";
  document.getElementById("dashboardFocusText").textContent = "Annual Tech Symposium · 18 October 2026";
  document.getElementById("dashboardFocusSource").innerHTML = '<button class="file-ref-chip" data-open-file="1">symposium_notice.txt</button>';
  document.getElementById("dashboardFocusIcon").setAttribute("data-lucide", "calendar-clock");
  document.querySelector(".dashboard-live-tag").innerHTML = '<i data-lucide="file-check-2" class="icon-xs"></i> EXAMPLE FILES';
  document.getElementById("fileCount").textContent = "3";
  document.getElementById("fileSubtext").textContent = "3 analyzed · 0 failed";
  document.getElementById("contextCount").textContent = "3";
  document.getElementById("relationshipCount").textContent = "2";
  document.getElementById("actionCount").textContent = "1";
  document.getElementById("deadlineSubtext").textContent = "2 documented dates";
  document.getElementById("entityCount").textContent = "6";
  document.getElementById("amountCount").textContent = "1";
  document.getElementById("amountPreviewSub").textContent = "₹500";
  document.getElementById("navBadgeFiles").textContent = "3";
  document.getElementById("navBadgeContext").textContent = "3";
  document.getElementById("navBadgeActions").textContent = "1";
  document.getElementById("navBadgeTelemetry").textContent = "2";
  document.getElementById("navBadgeGraph").textContent = "7";
  renderFiles();
  renderRelationships();
  renderRelationships("dashboardRelationshipList");
  renderActions();
  renderContext();
  document.getElementById("systemTelemetryBox").innerHTML = '<div class="kanban-card"><div style="display:flex;justify-content:space-between;align-items:center;"><strong>Example workspace</strong><span class="pill analyzed">READY</span></div><div style="font-size:.78rem;color:var(--text-secondary);">3 sample files · 2 connections · Local example answers</div></div>';
  document.getElementById("errorLogList").innerHTML = '<div class="empty-state">No processing errors.</div>';

  document.getElementById("uploadInput").disabled = true;
  document.getElementById("uploadDropzone").setAttribute("aria-disabled", "true");
  document.getElementById("uploadDropzone").removeAttribute("tabindex");
  document.querySelector("#uploadDropzone strong").textContent = "Add your files to the local workspace";
  document.querySelector("#uploadDropzone small").textContent = "File uploads and folder scanning are available when running the local server.";
  document.getElementById("uploadStatus").textContent = "This workspace is populated with example symposium files.";
  document.getElementById("uploadFilesBtn").hidden = true;
  document.getElementById("clearUploadBtn").hidden = true;

  document.querySelectorAll("[data-demo]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-demo]").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      renderLandingExample(button.dataset.demo);
    });
  });
  document.getElementById("fileSearchInput").addEventListener("input", (event) => renderFiles(event.target.value));
  document.getElementById("contextSearchInput").addEventListener("input", renderContext);
  document.querySelectorAll("#entityCategoryTabs .seg-tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("#entityCategoryTabs .seg-tab").forEach((tab) => tab.classList.toggle("active", tab === button));
      renderContext();
    });
  });
  document.getElementById("queryBtn").addEventListener("click", () => ask(document.getElementById("queryInput").value));
  document.getElementById("queryInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") ask(event.currentTarget.value);
  });
  document.getElementById("dashboardQuickAskBtn").addEventListener("click", () => ask(document.getElementById("dashboardQuickInput").value));
  document.getElementById("dashboardQuickInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") ask(event.currentTarget.value);
  });
  document.getElementById("clearChatBtn").addEventListener("click", () => {
    document.getElementById("chatStream").innerHTML = "";
    document.getElementById("answerText").textContent = "No answer yet. Ask a question about the sample files.";
    document.getElementById("sourcesList").innerHTML = "";
    document.getElementById("answerConfidenceBadge").textContent = "—";
    document.getElementById("answerConfidenceBar").style.width = "0%";
    document.getElementById("contextSufficiencyBadge").textContent = "Awaiting query";
    document.getElementById("sourceCountBadge").textContent = "0 Sources";
  });
  document.getElementById("closeInspectorBtn").addEventListener("click", () => document.getElementById("fileInspectorBackdrop").classList.add("hidden"));
  document.getElementById("fileInspectorBackdrop").addEventListener("click", (event) => {
    if (event.target.id === "fileInspectorBackdrop") event.currentTarget.classList.add("hidden");
  });
  document.querySelectorAll("[data-insp-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-insp-tab]").forEach((tab) => tab.classList.toggle("active", tab === button));
      document.querySelectorAll(".insp-pane").forEach((pane) => pane.classList.toggle("active", pane.id === `insp-pane-${button.dataset.inspTab}`));
    });
  });
  document.getElementById("uploadDropzone").addEventListener("click", () => {
    document.getElementById("uploadStatus").textContent = "Uploads are available when running the local server.";
  });
  document.getElementById("scanBtn").addEventListener("click", () => setRoute("files"));

  document.addEventListener("click", (event) => {
    const navTarget = event.target.closest("[data-nav-target]");
    if (navTarget) {
      event.preventDefault();
      const target = navTarget.dataset.navTarget;
      setRoute(target === "ask" ? "ask" : target === "upload" ? "upload" : target);
      return;
    }
    const fileTarget = event.target.closest("[data-open-file], [data-file-id]");
    if (fileTarget) {
      openFile(fileTarget.dataset.openFile || fileTarget.dataset.fileId);
      return;
    }
    const suggestion = event.target.closest(".suggestion-chip");
    if (suggestion) {
      const input = document.getElementById("queryInput");
      input.value = suggestion.dataset.query || suggestion.textContent.trim();
      ask(input.value);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") document.getElementById("fileInspectorBackdrop").classList.add("hidden");
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setRoute("dashboard");
      document.getElementById("dashboardQuickInput").focus();
    }
  });
  document.querySelectorAll("[data-journey-step]").forEach((button) => {
    button.addEventListener("click", () => {
      renderJourney(button.dataset.journeyStep);
    });
  });
  document.getElementById("journeyNextStep").addEventListener("click", () => {
    const stages = Object.keys(journeyStages);
    const current = document.getElementById("answerJourney").dataset.stage;
    renderJourney(stages[(stages.indexOf(current) + 1) % stages.length]);
  });
  window.addEventListener("resize", drawGraphs);
  window.addEventListener("hashchange", () => {
    const match = window.location.hash.match(/^#\/([a-z-]+)$/);
    if (match && viewTitles[match[1]]) setRoute(match[1], false);
  });
  renderLandingExample("symposium");
  renderJourney("sources");
  drawGraphs();
  window.lucide?.createIcons();
  initializeLandingMotion();

  const initialRoute = window.location.hash.match(/^#\/([a-z-]+)$/)?.[1];
  setRoute(initialRoute && viewTitles[initialRoute] ? initialRoute : "dashboard", !initialRoute);
}

function initializeLandingMotion() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reducedMotion && "IntersectionObserver" in window) {
    const targets = document.querySelectorAll(
      ".answer-journey-section .journey-header, .section-title-block, .product-bento-grid > *, .landing-start-grid > *, .landing-start-actions, .landing-footer .footer-inner",
    );
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
    targets.forEach((target, index) => {
      target.style.setProperty("--motion-delay", `${Math.min(index % 6, 5) * 65}ms`);
      target.classList.add("scroll-reveal");
      observer.observe(target);
    });
  }
  if (
    reducedMotion ||
    !window.matchMedia("(hover: hover) and (pointer: fine)").matches
  ) {
    return;
  }
  const landing = document.querySelector(".landing-shell");
  const showcase = document.querySelector(".hero-showcase-frame");
  let frameRequest = 0;
  landing.addEventListener("pointermove", (event) => {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    frameRequest = requestAnimationFrame(() => {
      landing.style.setProperty("--cursor-x", `${event.clientX}px`);
      landing.style.setProperty("--cursor-y", `${event.clientY}px`);
      const target = event.target.closest(
        ".hero-showcase-frame, .bento-feature, .landing-start-card, .journey-visual",
      );
      if (target && landing.contains(target)) {
        const bounds = target.getBoundingClientRect();
        target.style.setProperty("--pointer-x", `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
        target.style.setProperty("--pointer-y", `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
        if (target === showcase) {
          target.style.setProperty("--tilt-x", `${(((bounds.top + bounds.height / 2 - event.clientY) / bounds.height) * 4).toFixed(2)}deg`);
          target.style.setProperty("--tilt-y", `${(((event.clientX - bounds.left - bounds.width / 2) / bounds.width) * 4).toFixed(2)}deg`);
        }
      }
      frameRequest = 0;
    });
  });
  landing.addEventListener("pointerleave", () => {
    landing.style.setProperty("--cursor-x", "-1000px");
    landing.style.setProperty("--cursor-y", "-1000px");
    showcase.style.setProperty("--tilt-x", "0deg");
    showcase.style.setProperty("--tilt-y", "0deg");
  });
}

initializeWorkspace();
