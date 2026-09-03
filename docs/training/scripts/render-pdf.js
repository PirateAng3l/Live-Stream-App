const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage();
  const fileUrl = "file://" + path.resolve(__dirname, "../booklet.html");
  await page.goto(fileUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  // PDF, using the page's own @media print rules for pagination/margins.
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: path.resolve(__dirname, "../Open-Door-Live-Field-Guide.pdf"),
    printBackground: true,
    preferCSSPageSize: true,
  });

  await browser.close();
  console.log("done");
})();
