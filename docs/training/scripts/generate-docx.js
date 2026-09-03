const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  BorderStyle,
  AlignmentType,
  LevelFormat,
  VerticalAlign,
  PageBreak,
} = require("docx");
const fs = require("fs");
const path = require("path");

const CONTENT_WIDTH = 9026; // A4 minus 1in margins, DXA
const FONT = "Calibri";

const COLORS = {
  accent: "1F5C4C", // deep pitch green — matches the field guide's brand color
  accentDeep: "0F3229",
  accentLight: "E9F1EC",
  web: "2B5F8C", // steady blue — "on the website"
  webLight: "EAF1F7",
  app: "B4552D", // warm terracotta — "on the phone"
  appLight: "FBEEE7",
  field: "A9781A", // amber/gold — "logistics"
  fieldLight: "F3ECDA",
  alert: "A23A2C",
  alertLight: "F5E4E0",
  text: "1A1A1A",
  muted: "5B5B5B",
  rule: "CFCFCF",
  warnBg: "FBF1DD",
  warn: "8A5A00",
};

// ---------------- icons (pre-rendered PNGs, see render-icons.js) ----------------

const ICON_DIR = path.join(__dirname, "icons");
const iconCache = {};
function icon(name, size = 20) {
  if (!iconCache[name]) iconCache[name] = fs.readFileSync(path.join(ICON_DIR, name + ".png"));
  return new ImageRun({ data: iconCache[name], transformation: { width: size, height: size }, type: "png" });
}

// ---- numbering: "bullets" is shared; each step list gets its own
// reference so numbering restarts at 1 for every new list. ----
let stepCounter = 0;
const numberingConfigs = [
  {
    reference: "bullets",
    levels: [
      {
        level: 0,
        format: LevelFormat.BULLET,
        text: "•",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 420, hanging: 260 } } },
      },
    ],
  },
];

function newStepListRef() {
  stepCounter += 1;
  const reference = `steps_${stepCounter}`;
  numberingConfigs.push({
    reference,
    levels: [
      {
        level: 0,
        format: LevelFormat.DECIMAL,
        text: "%1.",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 520, hanging: 340 } } },
      },
    ],
  });
  return reference;
}

// ---------------- text helpers ----------------

function run(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: 21, color: COLORS.text, ...opts });
}

function h1(text, iconName) {
  const children = [];
  if (iconName) {
    children.push(icon(iconName, 27));
    children.push(new TextRun({ text: "  ", font: FONT }));
  }
  children.push(new TextRun({ text, bold: true, color: COLORS.accent, font: FONT, size: 27 }));
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 420, after: 180 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.accent, space: 4 } },
    children,
  });
}

function h2(text, iconName) {
  const children = [];
  if (iconName) {
    children.push(icon(iconName, 19));
    children.push(new TextRun({ text: "  ", font: FONT }));
  }
  children.push(new TextRun({ text, bold: true, color: COLORS.text, font: FONT, size: 22 }));
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 100 },
    children,
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    children: [new TextRun({ text, bold: true, color: COLORS.text, font: FONT, size: 21 })],
  });
}

function tag(label, kind) {
  // A small bold uppercase label — WEBSITE or APP — placed above a
  // subsection so the reader knows which screen/device it's about
  // before reading a word of the steps.
  const color = kind === "app" ? COLORS.app : COLORS.web;
  return new Paragraph({
    spacing: { before: 160, after: 40 },
    children: [new TextRun({ text: label, bold: true, font: FONT, size: 17, color, allCaps: true })],
  });
}

function p(children, opts = {}) {
  return new Paragraph({
    spacing: { after: 140, line: 276 },
    children: Array.isArray(children) ? children : [run(children, opts)],
  });
}

function small(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 100, line: 260 },
    children: [run(text, { size: 18, color: COLORS.muted, ...opts })],
  });
}

function bulletItem(text, opts = {}) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 60, line: 260 },
    children: Array.isArray(text) ? text : [run(text, opts)],
  });
}

function stepList(items) {
  const reference = newStepListRef();
  return items.map(
    (text) =>
      new Paragraph({
        numbering: { reference, level: 0 },
        spacing: { after: 100, line: 264 },
        children: Array.isArray(text) ? text : [run(text)],
      }),
  );
}

// ---------------- table helpers ----------------

function cell(children, { width, shade, valign } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: valign ?? VerticalAlign.TOP,
    shading: shade ? { type: ShadingType.CLEAR, color: "auto", fill: shade } : undefined,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children,
  });
}

function headerCell(text, width) {
  return cell([new Paragraph({ children: [run(text, { bold: true, color: "FFFFFF", size: 19 })] })], {
    width,
    shade: COLORS.accent,
  });
}

function bodyCell(text, width, opts = {}) {
  return cell([new Paragraph({ spacing: { line: 260 }, children: [run(text, { size: 19, ...opts })] })], { width });
}

function troubleshootTable(rows) {
  const colSymptom = 3200;
  const colFix = CONTENT_WIDTH - colSymptom;
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [colSymptom, colFix],
    rows: [
      new TableRow({ children: [headerCell("If you see this…", colSymptom), headerCell("Do this", colFix)] }),
      ...rows.map(
        ([symptom, fix], i) =>
          new TableRow({
            children: [
              bodyCell(symptom, colSymptom, { bold: true, color: COLORS.text }),
              bodyCell(fix, colFix),
            ],
          }),
      ),
    ],
  });
}

function fieldTable(rows) {
  // Each row is either a plain label (blank value cell, for the reader to
  // fill in by hand) or a [label, value] pair (pre-filled).
  const labelW = 3200;
  const valueW = CONTENT_WIDTH - labelW;
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [labelW, valueW],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.rule },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.rule },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: COLORS.rule },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: rows.map((row) => {
      const [label, value] = Array.isArray(row) ? row : [row, ""];
      return new TableRow({
        children: [
          cell([new Paragraph({ children: [run(label, { bold: true })] })], { width: labelW, valign: VerticalAlign.CENTER }),
          cell([new Paragraph({ children: value ? [run(value)] : [] })], { width: valueW, valign: VerticalAlign.CENTER }),
        ],
      });
    }),
  });
}

function calloutBox(title, text, { bg = COLORS.accentLight, fg = COLORS.accent } = {}) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [
      new TableRow({
        children: [
          cell(
            [
              new Paragraph({ spacing: { after: 40 }, children: [run(title, { bold: true, color: fg, size: 19 })] }),
              new Paragraph({ spacing: { after: 0 }, children: [run(text, { color: fg, size: 19 })] }),
            ],
            { width: CONTENT_WIDTH, shade: bg },
          ),
        ],
      }),
    ],
  });
}

function chipCell(text, width, { bg, fg } = {}) {
  return cell(
    [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [new TextRun({ text, bold: true, font: FONT, size: 17, color: fg ?? COLORS.text })],
      }),
    ],
    { width, shade: bg ?? "F2F4F0", valign: VerticalAlign.CENTER },
  );
}

// A row of small colored "chip" badges — the docx equivalent of the
// field guide's rounded score/control chips. Wraps onto further table
// rows once a row is full, sized per chip to roughly fit its label.
function chipGrid(chips) {
  const rows = [];
  let current = [];
  let currentWidth = 0;
  for (const chip of chips) {
    const w = Math.min(2600, Math.max(1150, 550 + chip.label.length * 105));
    if (currentWidth + w > CONTENT_WIDTH && current.length) {
      rows.push(current);
      current = [];
      currentWidth = 0;
    }
    current.push({ ...chip, width: w });
    currentWidth += w;
  }
  if (current.length) rows.push(current);

  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: Array(Math.max(...rows.map((r) => r.length))).fill(Math.floor(CONTENT_WIDTH / Math.max(...rows.map((r) => r.length)))),
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: rows.map(
      (r) =>
        new TableRow({
          children: r.map((c) =>
            chipCell(c.label, c.width, {
              bg: c.tone === "score" ? COLORS.appLight : "EEF1EC",
              fg: c.tone === "score" ? COLORS.app : COLORS.muted,
            }),
          ),
        }),
    ),
  });
}

function scoreChip(label) {
  return { label, tone: "score" };
}
function controlChip(label) {
  return { label, tone: "control" };
}

// Icon + bold title + description, laid out N-up in one row — the docx
// equivalent of the field guide's role cards / timeline stages.
function iconCardRow(items, { iconSize = 26, accentColor } = {}) {
  const n = items.length;
  const w = Math.floor(CONTENT_WIDTH / n);
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: Array(n).fill(w),
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: items.map((item, i) =>
          cell(
            [
              new Paragraph({ spacing: { after: 60 }, children: [icon(item.icon, iconSize)] }),
              new Paragraph({
                spacing: { after: 40 },
                children: [new TextRun({ text: item.title, bold: true, font: FONT, size: 19, color: COLORS.text })],
              }),
              ...item.lines.map(
                (line) =>
                  new Paragraph({
                    spacing: { after: 40, line: 240 },
                    children: [new TextRun({ text: "• " + line, font: FONT, size: 17, color: COLORS.muted })],
                  }),
              ),
            ],
            { width: w, shade: "F7F8F5", valign: VerticalAlign.TOP },
          ),
        ),
      }),
    ],
  });
}

// The "END STREAM → dialog → branch" flow for section 7.
function endStreamFlow() {
  const w = Math.floor(CONTENT_WIDTH / 2);
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [w, w],
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          cell(
            [
              new Paragraph({ spacing: { after: 40 }, children: [icon("flag-check-app", 22)] }),
              new Paragraph({
                spacing: { after: 20 },
                children: [new TextRun({ text: "Mark completed", bold: true, font: FONT, size: 19, color: COLORS.accentDeep })],
              }),
              new Paragraph({ children: [new TextRun({ text: "Finishes the match on the website with that score.", font: FONT, size: 17, color: COLORS.accentDeep })] }),
            ],
            { width: w, shade: COLORS.accentLight },
          ),
          cell(
            [
              new Paragraph({ spacing: { after: 40 }, children: [icon("flag-check-brand", 22)] }),
              new Paragraph({
                spacing: { after: 20 },
                children: [new TextRun({ text: "Just stop streaming", bold: true, font: FONT, size: 19, color: COLORS.text })],
              }),
              new Paragraph({ children: [new TextRun({ text: "Match isn't over yet — stream again afterward.", font: FONT, size: 17, color: COLORS.muted })] }),
            ],
            { width: w, shade: "EEF1EC" },
          ),
        ],
      }),
    ],
  });
}

// Grouped troubleshooting: a small-caps category label, then a 2-col
// table of alert-icon + symptom / fix rows, matching the field guide's
// grouped cards more closely than one long undifferentiated table.
function troubleshootGroup(title, rows) {
  const colSymptom = 3400;
  const colFix = CONTENT_WIDTH - colSymptom;
  return [
    new Paragraph({
      spacing: { before: 220, after: 80 },
      children: [new TextRun({ text: title, bold: true, font: FONT, size: 16, color: COLORS.muted, allCaps: true })],
    }),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: [colSymptom, colFix],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.rule },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.rule },
        left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.rule },
        right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.rule },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: COLORS.rule },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: COLORS.rule },
      },
      rows: rows.map(
        ([symptom, fix]) =>
          new TableRow({
            children: [
              cell(
                [
                  new Paragraph({
                    children: [icon("alert-red", 15), new TextRun({ text: "  " + symptom, bold: true, font: FONT, size: 18, color: COLORS.text })],
                  }),
                ],
                { width: colSymptom, shade: "FAFBF9" },
              ),
              bodyCell(fix, colFix),
            ],
          }),
      ),
    }),
  ];
}

// The dark, high-contrast Support card.
function contactCard(rows) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [
      new TableRow({
        children: [
          cell(
            rows.flatMap(([label, value, iconName], i) => [
              new Paragraph({
                spacing: { before: i === 0 ? 0 : 160, after: 20 },
                children: [
                  icon(iconName, 16),
                  new TextRun({ text: "  " + label.toUpperCase(), bold: true, font: FONT, size: 15, color: "BFD3CB" }),
                ],
              }),
              new Paragraph({
                children: [new TextRun({ text: value, bold: true, font: FONT, size: 21, color: "FFFFFF" })],
              }),
            ]),
            { width: CONTENT_WIDTH, shade: COLORS.accentDeep },
          ),
        ],
      }),
    ],
  });
}

// A quick-reference row: a small colored label pill, then the flow path.
function cheatRow(label, text) {
  const labelW = 2400;
  const pathW = CONTENT_WIDTH - labelW;
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [labelW, pathW],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.rule },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.rule },
      left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.rule },
      right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.rule },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: COLORS.rule },
    },
    rows: [
      new TableRow({
        children: [
          cell([new Paragraph({ children: [new TextRun({ text: label, bold: true, font: FONT, size: 16, color: COLORS.accent })] })], {
            width: labelW,
            shade: COLORS.accentLight,
            valign: VerticalAlign.CENTER,
          }),
          cell([new Paragraph({ children: [new TextRun({ text, bold: true, font: FONT, size: 18, color: COLORS.text })] })], {
            width: pathW,
            valign: VerticalAlign.CENTER,
          }),
        ],
      }),
    ],
  });
}

// ==================================================================
// Title page
// ==================================================================

const coverBox = new Table({
  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
  columnWidths: [CONTENT_WIDTH],
  rows: [
    new TableRow({
      children: [
        cell(
          [
            new Paragraph({ spacing: { after: 260 }, children: [icon("mark-white", 40)] }),
            new Paragraph({
              spacing: { after: 60 },
              children: [new TextRun({ text: "CREW TRAINING BOOKLET", bold: true, font: FONT, size: 15, color: "BFD3CB", allCaps: true })],
            }),
            new Paragraph({
              spacing: { after: 200 },
              children: [new TextRun({ text: "Open Door Live Field Guide", bold: true, font: FONT, size: 44, color: "FFFFFF" })],
            }),
            new Paragraph({
              spacing: { after: 160 },
              children: [new TextRun({ text: "The website, the app, and match-day scoring — every step, in order, in your streaming kit.", font: FONT, size: 22, color: "E8EFEA" })],
            }),
            new Paragraph({
              spacing: { after: 0 },
              children: [
                new TextRun({
                  text: "This booklet is a companion to your hands-on training session, and something to page through if anything goes wrong on match day. Keep it with your streaming kit.",
                  font: FONT,
                  size: 18,
                  color: "BFD3CB",
                  italics: true,
                }),
              ],
            }),
          ],
          { width: CONTENT_WIDTH, shade: COLORS.accentDeep },
        ),
      ],
    }),
  ],
});

function tocItem(num, title, iconName) {
  return [
    new Paragraph({
      spacing: { before: 140, after: 20 },
      children: [
        new TextRun({ text: num + "  ", bold: true, font: FONT, size: 22, color: COLORS.accent }),
        icon(iconName, 18),
        new TextRun({ text: "  " + title, bold: true, font: FONT, size: 19, color: COLORS.text }),
      ],
    }),
  ];
}

const titlePage = [
  coverBox,
  new Paragraph({ spacing: { before: 360, after: 100 }, children: [new TextRun({ text: "What's inside", bold: true, font: FONT, size: 22, color: COLORS.text })] }),
  ...tocItem("1", "Before you start", "bag-brand"),
  ...tocItem("2", "Logging in for the first time", "key-brand"),
  ...tocItem("3", "The website — your admin panel", "upload-brand"),
  ...tocItem("4", "Match-day roles & logistics", "users-brand"),
  ...tocItem("5", "The app — setting up to stream", "gear-brand"),
  ...tocItem("6", "The app — going live and scoring the match", "scoreboard-brand"),
  ...tocItem("7", "Ending the stream", "flag-check-brand"),
  ...tocItem("8", "Troubleshooting", "alert-brand"),
  ...tocItem("9", "Quick reference", "arrow-brand"),
  ...tocItem("10", "Support", "call-brand"),
  new Paragraph({ children: [new PageBreak()] }),
];

// ==================================================================
// 1. Before you start
// ==================================================================

const section1 = [
  h1("1. Before You Start", "bag-brand"),
  p("You'll need the following before your first match:"),
  iconCardRow([
    { icon: "key-brand", title: "Your Open Door Live login", lines: ["The email and password from your welcome email."] },
    { icon: "phone-brand", title: "The app, installed", lines: ["On the phone you'll actually stream from."] },
  ]),
  new Paragraph({ spacing: { after: 120 }, children: [] }),
  iconCardRow([
    {
      icon: "bag-brand",
      title: "Your streaming kit",
      lines: ["Full kit for Home Ground schools, or your own device and data for Kickoff schools."],
    },
    { icon: "signal-brand", title: "A stable data connection", lines: ["At the venue — this is what your stream actually runs on."] },
  ]),
  calloutBox(
    "Two places, one login.",
    "The same email and password sign you in to both the Open Door Live website (for setting up fixtures, teams and sponsors) and the Crew Sign-In inside the app (for loading a fixture on match day). You don't need two separate accounts.",
  ),
];

// ==================================================================
// 2. Logging in for the first time
// ==================================================================

const section2 = [
  h1("2. Logging In for the First Time", "key-brand"),
  tag("WEBSITE", "web"),
  ...stepList([
    "Open the welcome email from Open Door Live and click the link inside it.",
    "You'll land on the Set Password page. Choose a password and confirm it.",
    "You're signed in and taken straight to your Admin Panel.",
  ]),
  small(
    "Lost the email, or the link has expired? Open Door Live can resend it at any time — see Support (Section 10).",
  ),
];

// ==================================================================
// 3. The website — admin panel
// ==================================================================

const section3 = [
  h1("3. The Website — Your Admin Panel", "upload-brand"),
  p(
    "This is where your school sets everything up before a match: your logo, your teams, your fixtures (matches), and your sponsors. A school_operator account only ever sees its own school's information here.",
  ),

  h2("3.1 Upload Your Logo & Confirm Consent", "shield-brand"),
  tag("WEBSITE", "web"),
  ...stepList([
    "Go to School in the admin menu.",
    "Upload your school's logo (PNG, JPEG or WebP, up to 5MB).",
    "Tick the consent confirmation — that your school holds appropriate parental/guardian consent to film and broadcast its students.",
  ]),
  calloutBox(
    "Do this first.",
    "You cannot create a fixture until consent is confirmed — the website blocks it on purpose. This is a one-time step, not something you'll need to repeat for every match.",
    { bg: COLORS.warnBg, fg: COLORS.warn },
  ),

  h2("3.2 Add Your Teams", "users-brand"),
  tag("WEBSITE", "web"),
  ...stepList([
    "Go to Teams in the admin menu.",
    "Click + New Team.",
    "Enter the team's full name, and — optionally — a short name for the scoreboard (e.g. \"Rev High 1st\" for \"Revelation High 1st Team\").",
    "Save.",
  ]),
  small("You need at least two teams on file before you can create a fixture."),

  h2("3.3 Create a Fixture (Schedule a Match)", "calendar-brand"),
  tag("WEBSITE", "web"),
  ...stepList([
    "Go to Fixtures in the admin menu and click + New Fixture.",
    "Choose the sport, the home team, the away team, and the kickoff date and time.",
    "Save.",
  ]),
  small(
    "This automatically sets up the YouTube broadcast behind the scenes — the fixture will show \"Provisioning…\" for a short moment, then \"Ready to stream.\" No further action needed on your side.",
  ),

  h2("3.4 Set Up Sponsors", "tag-brand"),
  tag("WEBSITE", "web"),
  ...stepList([
    "Go to Sponsors in the admin menu and click + New Sponsor to add one (name, tier, position, an optional click-through link, and a logo).",
    "Open the fixture you want to sponsor and use Assign Sponsor to place one of your sponsors on that specific match, in a chosen position.",
  ]),
  small(
    "A sponsor only needs to be created once — after that, assign it to as many fixtures as you like from each fixture's own page.",
  ),

  h2("3.5 After the Match — Marking It Completed", "check-circle-brand"),
  tag("WEBSITE", "web"),
  p(
    "Usually this happens automatically — see Section 6 for how confirming \"Mark completed\" in the app does this for you. If it wasn't confirmed there, or a score needs correcting, do it here:",
  ),
  ...stepList([
    "Open the fixture's page in the admin panel.",
    "Under Match Result, enter the final score (or just confirm completion for a Clean Slate/Event fixture, which has no score).",
    "Save. The match moves to the Completed tab on the public schedule and shows its final score.",
  ]),
  small("This can be re-done at any time if a score needs correcting after the fact."),

  h2("3.6 Taking Down a Video (If Ever Needed)", "eye-off-brand"),
  tag("WEBSITE", "web"),
  p(
    "A fixture's page has a Take down video button. This immediately stops the video from displaying on the Open Door Live website — but the underlying YouTube video is not removed, since match footage is public on YouTube. If a request for a full YouTube takedown ever comes in, contact Open Door Live directly rather than acting alone — see Support.",
  ),
];

// ==================================================================
// 4. Match-day roles & logistics
// ==================================================================

const section4 = [
  h1("4. Match-Day Roles & Logistics", "users-brand"),
  p(
    "Streaming a match well is as much about arriving prepared as it is about the app itself. This section is general guidance to plan around, not a fixed rulebook — set whatever version of it works for your own staff and schedule.",
  ),

  h2("4.1 Who's Involved", "users-brand"),
  iconCardRow([
    {
      icon: "user-brand",
      title: "The Operator",
      lines: ["Runs the phone and app during the match — staff, a trained student under supervision, or an Open Door Live crew member if you've booked coverage."],
    },
    {
      icon: "user-plus-brand",
      title: "Backup operator",
      lines: ["Worth having a second person who knows the basics. Open Door Live issues one login per school — ask for a second if you need one."],
    },
    {
      icon: "headset-brand",
      title: "School contact",
      lines: ["Deals with Open Door Live on consent, sponsors, and reports. Doesn't need to be the operator."],
    },
  ]),

  h2("4.2 – 4.4 The Match-Day Timeline", "clock-brand"),
  iconCardRow([
    {
      icon: "sun-brand",
      title: "Before kickoff",
      lines: [
        "Charge the whole kit the night before.",
        "Arrive 20–30 min early — setup takes longer than it looks.",
        "Position the tripod for a clear, elevated view, away from backlight.",
        "Test the data signal at that exact spot.",
        "Sign in, load the fixture, frame the shot (Section 5).",
      ],
    },
    {
      icon: "scoreboard-brand",
      title: "During the match",
      lines: [
        "Stay with the kit — never leave the phone unattended once live.",
        "Watch the status chip (Section 6).",
        "Use Next Period, Mute, and the timer as the match unfolds.",
        "Something wrong? Don't panic — see Troubleshooting (Section 8).",
      ],
    },
    {
      icon: "check-circle-brand",
      title: "After the match",
      lines: [
        "End the stream and confirm the result (Section 7) while it's fresh.",
        "Pack the kit away carefully — good care keeps your renewal rate down.",
        "Recharge everything for next time.",
      ],
    },
  ]),

  h2("4.5 Covering Multiple Events on the Same Day", "bag-brand"),
  p(
    "If two sports or events are happening at the same time, one kit and one operator can't cover both. Extra Kit (a second full streaming kit) or booking Crew for the day / Match Day Pro from Open Door Live are the two ways to cover it — arrange either ahead of time, since crew and kit availability isn't guaranteed on short notice.",
  ),
];

// ==================================================================
// 5. The app — setting up to stream
// ==================================================================

const phoneMockupImage = fs.readFileSync(path.join(ICON_DIR, "phone-mockup.png"));

const section5 = [
  h1("5. The App — Setting Up to Stream", "gear-brand"),
  p(
    "The first time you open the app, grant it camera and microphone permission when asked — the app can't stream without both.",
  ),

  new Paragraph({
    spacing: { before: 100, after: 160 },
    children: [new ImageRun({ data: phoneMockupImage, transformation: { width: 400, height: 201 }, type: "png" })],
  }),
  bulletItem([
    run("Gear icon — ", { bold: true }),
    run("Settings — Stream Setup, Sports, Sponsor Ads, Camera tabs."),
  ]),
  bulletItem([
    run("Scoreboard icon — ", { bold: true }),
    run("Live control panel — score, timer, GO LIVE / END STREAM."),
  ]),
  bulletItem([
    run("Left-edge slider — ", { bold: true }),
    run("Zoom, 0.6x–5x, always on screen — snaps to 1.0x."),
  ]),

  h2("5.1 Sign In and Load Your Fixture", "key-brand"),
  tag("APP", "app"),
  ...stepList([
    "Tap the gear (settings) icon.",
    "On the Stream Setup tab, under CREW SIGN-IN, enter your email and password and tap Sign In.",
    "Choose your fixture from the dropdown list.",
    "Tap Load Fixture.",
  ]),
  small(
    "Load Fixture fills in everything for you: the stream connection details, both team names, the sport, the home team's logo, and any sponsor logos assigned to that fixture. If a sponsor has no logo uploaded yet, that slot is simply left as-is — the stream still works fine.",
  ),

  h2("5.2 Double-Check Before Kickoff", "check-circle-brand"),
  tag("APP", "app"),
  bulletItem("Sports tab — confirm the sport and team names are correct. You can edit either by hand if needed."),
  bulletItem(
    "Sponsor Ads tab — check the four logo slots look right (top-right logo, lower-third headline sponsor, and the two bottom corners). You can pick a different image here at any time.",
  ),
  bulletItem(
    "Camera tab — resolution (720p or 1080p) and stream quality (Data saver, Standard, or High). A change made mid-stream only takes effect the next time the app is opened.",
  ),

  h2("5.3 Framing Your Shot", "zoom-brand"),
  tag("APP", "app"),
  p(
    "The zoom slider on the left edge of the preview is always available — no need to open a menu. It runs from a wide 0.6x up to 5x, and gently snaps to exactly 1.0x (marked with a small tick) so it's easy to find your way back to the default.",
  ),
];

// ==================================================================
// 6. Going live & scoring
// ==================================================================

function sportBlock(iconName, title, chips, note) {
  const out = [
    new Paragraph({
      spacing: { before: 140, after: 80 },
      children: [icon(iconName, 20), new TextRun({ text: "  " + title, bold: true, font: FONT, size: 20, color: COLORS.text })],
    }),
    chipGrid(chips),
  ];
  if (note) out.push(small(note));
  return out;
}

const section6 = [
  h1("6. The App — Going Live & Scoring the Match", "scoreboard-brand"),

  h2("6.1 Starting the Stream", "video-brand"),
  tag("APP", "app"),
  ...stepList([
    "Tap the scoreboard icon to open the live control panel.",
    "Tap GO LIVE.",
    "Watch the status chip: it shows CONNECTING… and then LIVE once the stream is up (this can take up to a minute).",
  ]),
  small(
    "If this fixture was loaded via Crew Sign-In, going live also marks it LIVE on the Open Door Live website automatically — no extra step needed.",
  ),

  h2("6.2 Scoring — Rugby, Soccer, Netball, Hockey, Tennis", "ball-round-brand"),
  ...sportBlock(
    "ball-oval-app",
    "Rugby",
    [
      scoreChip("Try +5"),
      scoreChip("Con +2"),
      scoreChip("Pen +3"),
      scoreChip("Drop +3"),
      controlChip("+ / − plain"),
      controlChip("Undo"),
      controlChip("Swap"),
      controlChip("Next Period"),
    ],
  ),
  ...sportBlock(
    "ball-round-app",
    "Soccer, Netball, Hockey, Tennis",
    [controlChip("+ / − plain"), controlChip("Undo"), controlChip("Swap"), controlChip("Next Period")],
    "Next Period moves 1st Half → 2nd Half (or 1st–4th Quarter for netball) — manual, on purpose. Tennis's running score is sets won, not points.",
  ),

  h2("6.3 Scoring — Cricket", "cricket-brand"),
  ...sportBlock(
    "cricket-app",
    "Runs, wickets & overs — its own scoreboard",
    [
      scoreChip("0"),
      scoreChip("1"),
      scoreChip("2"),
      scoreChip("3"),
      scoreChip("4"),
      scoreChip("6"),
      controlChip("Wd/Nb +1"),
      controlChip("Bye +1"),
      controlChip("WICKET"),
      controlChip("Swap Innings"),
      controlChip("Reset Innings"),
    ],
    "Overs advance automatically on legal balls. Wickets cap at 10. Swap Innings shows the target/chase line.",
  ),

  h2("6.4 – 6.6 Timer, Mute & Reconnecting", "timer-brand"),
  iconCardRow([
    { icon: "timer-brand", title: "The timer", lines: ["Start and Pause control the match clock in the live control panel."] },
    { icon: "mute-brand", title: "Mute audio", lines: ["Cuts sound only — video and connection keep going. Every new stream starts unmuted."] },
  ]),
  calloutBox(
    "If the connection drops",
    "The app reconnects on its own — you'll see RECONNECTING… (attempt N). Stay on the stream, don't close the app. Only tap Stop Reconnecting if you genuinely want to end the broadcast.",
    { bg: COLORS.fieldLight, fg: "5F4712" },
  ),
];

// ==================================================================
// 7. Ending the stream
// ==================================================================

const section7 = [
  h1("7. Ending the Stream", "flag-check-brand"),
  tag("APP", "app"),
  ...stepList([
    "Tap END STREAM in the live control panel.",
    "For Rugby, Soccer, Netball, Hockey, or Tennis fixtures loaded via Crew Sign-In: a \"Match finished?\" dialog pops up showing the final score.",
  ]),
  small("Then, in that dialog:"),
  new Paragraph({ spacing: { before: 100, after: 160 }, children: [] }),
  endStreamFlow(),
  calloutBox(
    "Cricket and Clean Slate/Event.",
    "These don't get the automatic dialog — cricket because only the current innings is tracked, and Clean Slate/Event because there's no score to record. Mark these completed manually from the website afterward (Section 3.5).",
  ),
];

// ==================================================================
// 8. Troubleshooting
// ==================================================================

const section8 = [
  h1("8. Troubleshooting", "alert-brand"),
  ...troubleshootGroup("Signing in & permissions", [
    [
      "The app asks for camera/microphone permission again, or won't open the camera.",
      "Go to your phone's Settings → Apps → Open Door Live → Permissions, and make sure Camera and Microphone are both allowed.",
    ],
    [
      "\"Backend not configured\" under Stream Setup.",
      "Crew Sign-In isn't available on this device. Contact Open Door Live — in the meantime, if you've been given a stream URL and key directly, you can still enter them by hand in the same tab.",
    ],
    [
      "\"Sign in failed\" when signing in on the app or website.",
      "Double-check your email and password. If you've forgotten your password, contact Open Door Live to have it reset.",
    ],
    [
      "Can't sign in, need a new invite link.",
      "Use \"Lost an invite, or can't sign in?\" on the website, or contact Open Door Live directly.",
    ],
  ]),
  ...troubleshootGroup("Fixtures & sponsors", [
    [
      "No fixtures in the Load Fixture dropdown.",
      "It may not be created yet, or kickoff has passed. Check with whoever manages fixtures, or create it yourself (Section 3.3).",
    ],
    [
      "Load Fixture skipped a sponsor logo.",
      "That sponsor has no logo uploaded, or wasn't assigned to this fixture. The stream still works — add it manually on Sponsor Ads if needed.",
    ],
  ]),
  ...troubleshootGroup("Connection & status chip", [
    [
      "Stuck on CONNECTING… a long time.",
      "Check your data signal first — up to a minute is normal. Still stuck? Try loading the fixture again, or double-check URL/key if entered by hand.",
    ],
    [
      "RECONNECTING… (attempt N).",
      "Normal after a signal drop — the app retries on its own. Stay on the stream, don't close the app. See Section 6.6.",
    ],
    [
      "FAILED — won't connect at all.",
      "Usually a wrong stream key. Loaded via Crew Sign-In? Try loading it again. Entered by hand? Double-check URL and key.",
    ],
    [
      "LIVE badge not showing on the website.",
      "Best-effort and can lag a little — give it a minute. Never affects the stream itself.",
    ],
  ]),
  ...troubleshootGroup("After the match", [
    [
      "Match not moving to the Completed tab.",
      "Still needs marking completed — confirm \"Mark completed\" at End Stream (two-team sports), or manually on the website (Section 3.5).",
    ],
    [
      "Final score shown is wrong.",
      "Go to the fixture's page on the website and re-enter it (Section 3.5) — correctable any time.",
    ],
    [
      "Settings look different on another phone.",
      "Saved to the device, not your account — each phone remembers its own setup.",
    ],
    [
      "A parent can't watch a match.",
      "They need a signed-in parent account first. Then \"Watch on YouTube\" opens the stream directly.",
    ],
  ]),
];

// ==================================================================
// 9. Quick reference
// ==================================================================

const section9 = [
  h1("9. Quick Reference", "arrow-brand"),
  p("The short version, once you've done the full walkthrough once."),
  cheatRow("WEBSITE · ONCE/SEASON", "Log in → Upload logo & confirm consent → Add teams → Create fixtures → Set up sponsors"),
  new Paragraph({ spacing: { after: 100 }, children: [] }),
  cheatRow("MATCH-DAY LOGISTICS", "Charge kit → Arrive 20–30 min early → Position & test signal → Sign in & load fixture"),
  new Paragraph({ spacing: { after: 100 }, children: [] }),
  cheatRow("APP · EVERY MATCH", "Gear icon → Sign in → Choose fixture → Load Fixture → Check tabs → GO LIVE"),
  new Paragraph({ spacing: { after: 100 }, children: [] }),
  cheatRow("END OF MATCH", "END STREAM → Mark completed — score already on screen"),
  calloutBox(
    "Something wrong?",
    "See Section 8 (Troubleshooting), or contact Open Door Live — Section 10.",
  ),
];

// ==================================================================
// 10. Support
// ==================================================================

const section10 = [
  h1("10. Support", "call-brand"),
  p("Questions, hiccups, or anything Section 8 didn't sort out — reach Open Door Live directly."),
  contactCard([
    ["Phone", "073 475 7971", "call-white"],
    ["Email", "softleyjd@gmail.com", "mail-white"],
    [
      "Hours",
      "No fixed hours — reachable most times, and especially around the times your school is actually streaming. For anything happening right now, call rather than email.",
      "clock-white",
    ],
  ]),
];

// ==================================================================
// Build document
// ==================================================================

const doc = new Document({
  numbering: { config: numberingConfigs },
  sections: [
    {
      properties: {
        page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } },
      },
      children: [
        ...titlePage,
        ...section1,
        ...section2,
        ...section3,
        ...section4,
        ...section5,
        ...section6,
        ...section7,
        ...section8,
        ...section9,
        ...section10,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(path.join(__dirname, "../Open-Door-Live-Getting-Started-Guide.docx"), buffer);
  console.log("written");
});
