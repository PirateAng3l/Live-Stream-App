const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT = path.resolve(__dirname, "icons");
fs.mkdirSync(OUT, { recursive: true });

const COLORS = {
  brand: "#1F5C4C",
  app: "#B4552D",
  field: "#A9781A",
  alert: "#A23A2C",
  white: "#FFFFFF",
};

// [iconId, colorKey, outputName]
const JOBS = [
  ["i-bag", "brand", "bag-brand"],
  ["i-key", "brand", "key-brand"],
  ["i-phone", "brand", "phone-brand"],
  ["i-signal", "brand", "signal-brand"],
  ["i-check-circle", "brand", "check-circle-brand"],
  ["i-upload", "brand", "upload-brand"],
  ["i-shield", "brand", "shield-brand"],
  ["i-users", "brand", "users-brand"],
  ["i-calendar", "brand", "calendar-brand"],
  ["i-tag", "brand", "tag-brand"],
  ["i-eye-off", "brand", "eye-off-brand"],
  ["i-user", "brand", "user-brand"],
  ["i-user-plus", "brand", "user-plus-brand"],
  ["i-headset", "brand", "headset-brand"],
  ["i-clock", "brand", "clock-brand"],
  ["i-sun", "brand", "sun-brand"],
  ["i-scoreboard", "brand", "scoreboard-brand"],
  ["i-gear", "brand", "gear-brand"],
  ["i-video", "brand", "video-brand"],
  ["i-ball-round", "brand", "ball-round-brand"],
  ["i-cricket", "brand", "cricket-brand"],
  ["i-zoom", "brand", "zoom-brand"],
  ["i-timer", "brand", "timer-brand"],
  ["i-mute", "brand", "mute-brand"],
  ["i-flag-check", "brand", "flag-check-brand"],
  ["i-alert", "brand", "alert-brand"],
  ["i-arrow", "brand", "arrow-brand"],
  ["i-call", "brand", "call-brand"],

  ["i-ball-oval", "app", "ball-oval-app"],
  ["i-ball-round", "app", "ball-round-app"],
  ["i-cricket", "app", "cricket-app"],
  ["i-flag-check", "app", "flag-check-app"],
  ["i-scoreboard", "app", "scoreboard-app"],

  ["i-alert", "field", "alert-field"],
  ["i-wifi", "field", "wifi-field"],
  ["i-cricket", "field", "cricket-field"],

  ["i-alert", "alert", "alert-red"],

  ["i-mark", "white", "mark-white"],
  ["i-call", "white", "call-white"],
  ["i-mail", "white", "mail-white"],
  ["i-clock", "white", "clock-white"],
];

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const bookletUrl = "file://" + path.resolve(__dirname, "../booklet.html");

  // The landscape phone mockup embedded in the docx's App Setup section —
  // a plain element screenshot of .phone at high resolution, taken before
  // the page below gets stripped down for icon rendering.
  const phonePage = await browser.newPage({ deviceScaleFactor: 3 });
  await phonePage.goto(bookletUrl, { waitUntil: "networkidle" });
  await phonePage.evaluate(() => document.fonts.ready);
  await phonePage.locator(".phone").first().screenshot({ path: path.join(OUT, "phone-mockup.png") });
  await phonePage.close();

  const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
  await page.goto(bookletUrl, { waitUntil: "networkidle" });

  // Strip the page down to just the hidden <defs> svg (which holds the
  // <symbol> icon definitions) so nothing else is painted behind the
  // icon we screenshot — otherwise the "transparent" icon element just
  // shows whatever real page content happens to sit underneath it.
  await page.evaluate(() => {
    document.querySelectorAll("body > *").forEach((el) => {
      if (!(el.tagName === "svg" && el.getAttribute("width") === "0")) el.remove();
    });
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
  });

  for (const [iconId, colorKey, outName] of JOBS) {
    const color = COLORS[colorKey];
    await page.evaluate(
      ({ iconId, color }) => {
        const old = document.getElementById("__render_target__");
        if (old) old.remove();
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("id", "__render_target__");
        svg.setAttribute("width", "192");
        svg.setAttribute("height", "192");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.style.position = "fixed";
        svg.style.top = "0";
        svg.style.left = "0";
        svg.style.background = "transparent";
        svg.style.color = color;
        svg.style.stroke = color;
        svg.style.fill = "none";
        svg.setAttribute("stroke-width", "1.8");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
        use.setAttribute("href", "#" + iconId);
        svg.appendChild(use);
        document.body.appendChild(svg);
      },
      { iconId, color },
    );
    const el = page.locator("#__render_target__");
    await el.screenshot({ path: path.join(OUT, outName + ".png"), omitBackground: true });
  }

  await browser.close();
  console.log("done:", JOBS.length, "icons");
})();
