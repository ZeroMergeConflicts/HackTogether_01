const staticDemos = {
  symposium: {
    query: "“When is the annual Tech Symposium?”",
    answer:
      "The annual Tech Symposium is on 18 October 2026. Registration closes on 30 September 2026.",
    sources: [
      ["symposium_notice.txt", "Event date: 18 October 2026 · Registration deadline: 30 September 2026"],
      ["coordinator_message.txt", "The coordination team confirms the symposium schedule."],
    ],
  },
  payment: {
    query: "“How much is the registration fee?”",
    answer:
      "The registration fee is ₹500. The notice does not confirm whether a participant has paid.",
    sources: [
      ["symposium_notice.txt", "Registration fee: ₹500 · Venue: Main Auditorium"],
      ["coordinator_message.txt", "Contact the symposium coordination team with questions."],
    ],
  },
  exam: {
    query: "“What should I submit during registration?”",
    answer:
      "Participants must submit a project abstract during registration. The planning notes recommend including the goal, approach, and expected results.",
    sources: [
      ["symposium_notice.txt", "Participants must submit a project abstract during registration."],
      ["abstract_planning_notes.txt", "Include the project goal, proposed approach, and expected results."],
    ],
  },
};

const journeySteps = {
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
    next: "See the grounded answer",
    visual:
      '<div class="journey-link-map"><div class="journey-file-card"><strong>symposium_notice.txt</strong><p>Event date · Fee</p></div><div class="journey-link-beam"><span></span></div><div class="journey-file-card"><strong>coordinator_message.txt</strong><p>Schedule · Contact</p></div></div><div class="journey-visual-footnote">Shared details connect relevant documents.</div>',
  },
  answer: {
    kicker: "STEP 03 / VERIFIED RESPONSE",
    title: "Keep the evidence beside the answer.",
    description: "Open a cited source whenever you want to check the detail for yourself.",
    next: "Restart the answer trail",
    visual:
      '<div class="journey-answer-card"><span class="mono-label">GROUNDED ANSWER</span><p>The symposium is on 18 October 2026. Registration closes on 30 September.</p><div class="journey-citations"><span class="file-ref-chip">symposium_notice.txt</span></div></div><div class="journey-visual-footnote">Answer details stay linked to their source.</div>',
  },
};

function renderStaticDemo(name) {
  const demo = staticDemos[name] || staticDemos.symposium;
  document.getElementById("heroDemoQuery").textContent = demo.query;
  document.getElementById("heroDemoAnswer").textContent = demo.answer;
  document.getElementById("heroDemoSources").innerHTML = demo.sources
    .map(
      ([filename, description]) => `
        <article class="demo-source-card">
          <div style="display:flex;align-items:center;gap:8px;">
            <i data-lucide="file-code-2" class="icon-sm"></i>
            <strong>${filename}</strong>
          </div>
          <p>${description}</p>
        </article>
      `,
    )
    .join("");
  document.getElementById("heroDemoCitations").innerHTML = demo.sources
    .map(([filename]) => `<span class="file-ref-chip">${filename}</span>`)
    .join("");
  renderStaticJourney(document.querySelector("[data-journey-step].active")?.dataset.journeyStep || "sources");
  window.lucide?.createIcons();
}

function renderStaticJourney(name) {
  const step = journeySteps[name] || journeySteps.sources;
  const index = Object.keys(journeySteps).indexOf(name);
  document.getElementById("answerJourney").dataset.stage = name;
  document.getElementById("journeyStageKicker").textContent = step.kicker;
  document.getElementById("journeyStageTitle").textContent = step.title;
  document.getElementById("journeyStageDescription").textContent = step.description;
  document.getElementById("journeyNextLabel").textContent = step.next;
  document.getElementById("journeyVisual").innerHTML = step.visual;
  document.getElementById("journeyProgressFill").style.width = `${((index + 1) / 3) * 100}%`;
  document.querySelector(".journey-progress").setAttribute("aria-valuenow", String(index + 1));
  document.querySelectorAll("[data-journey-step]").forEach((button) => {
    const selected = button.dataset.journeyStep === name;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  window.lucide?.createIcons();
}

document.querySelectorAll("[data-demo]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-demo]").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    renderStaticDemo(button.dataset.demo);
  });
});

document.addEventListener("click", (event) => {
  const stepButton = event.target.closest("[data-journey-step]");
  const nextButton = event.target.closest("#journeyNextStep");
  if (stepButton) {
    renderStaticJourney(stepButton.dataset.journeyStep);
    return;
  }
  if (nextButton) {
    const steps = Object.keys(journeySteps);
    const current = document.getElementById("answerJourney").dataset.stage;
    renderStaticJourney(steps[(steps.indexOf(current) + 1) % steps.length]);
    return;
  }
  const navigation = event.target.closest("[data-nav-target]");
  if (navigation) {
    if (navigation.closest(".footer-actions")) {
      document.getElementById("top").scrollIntoView({ behavior: "smooth" });
      return;
    }
    const target = ["ask"].includes(navigation.dataset.navTarget)
      ? "answer-journey"
      : "get-started";
    document.getElementById(target).scrollIntoView({ behavior: "smooth" });
  }
});

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
  !reducedMotion &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches
) {
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

document.getElementById("heroStatFiles").textContent = "2";
document.getElementById("heroStatContext").textContent = "2";
document.getElementById("heroStatLinks").textContent = "1";
document.getElementById("heroStatEngine").textContent = "STATIC DEMO";
document.querySelector(".landing-nav-Right [data-nav-target] span").textContent =
  "Explore demo";
document.querySelector(".hero-pill-banner .pill-link").textContent = "View demo →";
document.querySelector('.hero-cta-group [data-nav-target="dashboard"] span').textContent =
  "Explore the demo";
document.querySelector('.hero-cta-group [data-nav-target="ask"] span').textContent =
  "See how it works";
document.querySelector('#get-started [data-nav-target="upload"] span').textContent =
  "Browse the demo";
document.querySelector('#get-started [data-nav-target="ask"] span').textContent =
  "View answer flow";
document.querySelector(".footer-actions [data-nav-target] span").textContent =
  "Back to top";
document.getElementById("landingInteractiveChips").innerHTML = [
  "symposium_notice.txt",
  "abstract_planning_notes.txt",
  "coordinator_message.txt",
]
  .map((name) => `<span class="file-ref-chip">${name}</span>`)
  .join("");
renderStaticDemo("symposium");
window.lucide?.createIcons();
