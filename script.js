const root = document.documentElement;
const themeToggle = document.querySelector("#themeToggle");
const savedTheme = localStorage.getItem("theme");

if (savedTheme === "light") {
  root.dataset.theme = "light";
  themeToggle.textContent = "Dark";
}

themeToggle.addEventListener("click", () => {
  const isLight = root.dataset.theme === "light";
  if (isLight) {
    delete root.dataset.theme;
    localStorage.setItem("theme", "dark");
    themeToggle.textContent = "Light";
  } else {
    root.dataset.theme = "light";
    localStorage.setItem("theme", "light");
    themeToggle.textContent = "Dark";
  }
});

document.querySelector("#year").textContent = new Date().getFullYear();

const publicationTabs = document.querySelectorAll(".publication-tab");
const publicationPanels = document.querySelectorAll(".publication-panel");

publicationTabs.forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.publicationTab;

    publicationTabs.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");

    publicationPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.publicationPanel === target);
    });
  });
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.animate(
          [
            { opacity: 0, transform: "translateY(18px)" },
            { opacity: 1, transform: "translateY(0)" }
          ],
          { duration: 480, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" }
        );
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08 }
);

document.querySelectorAll(".focus-card, .timeline-item, .publication, .project-card").forEach((element) => {
  observer.observe(element);
});
