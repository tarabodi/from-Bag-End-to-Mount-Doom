// De totale reisafstand van Hobbiton naar Mount Doom (in km)
const TOTAL_DISTANCE = 2863;

// De sleutelnaam waaronder we de afstand opslaan in localStorage
const STORAGE_KEY = "walkToMordorDistance";

// De sleutelnaam waaronder we de vrijgespeelde achievements opslaan
const ACHIEVEMENTS_STORAGE_KEY = "walkToMordorAchievements";

// HTML-elementen die we willen bijwerken
const currentDistanceEl = document.getElementById("currentDistance");
const progressPercentEl = document.getElementById("progressPercent");
const progressFillEl = document.getElementById("progressFill");
const addDistanceButton = document.getElementById("addDistanceButton");
const currentMilestoneEl = document.getElementById("currentMilestone");
const nextMilestoneEl = document.getElementById("nextMilestone");
const kmToNextEl = document.getElementById("kmToNext");
const milestoneListEl = document.getElementById("milestoneList");
const journeyMapEl = document.getElementById("journeyMap");
const mapTooltipEl = document.getElementById("mapTooltip");
const mapHintEl = document.getElementById("mapHint");
const mapZoomInButton = document.getElementById("mapZoomInButton");
const mapZoomOutButton = document.getElementById("mapZoomOutButton");
const mapZoomResetButton = document.getElementById("mapZoomResetButton");
const achievementListEl = document.getElementById("achievementList");
const achievementSummaryEl = document.getElementById("achievementSummary");
const achievementToastEl = document.getElementById("achievementToast");

// Tab-navigatie (Journey / Achievements)
const journeyTabButton = document.getElementById("journeyTabButton");
const achievementsTabButton = document.getElementById("achievementsTabButton");
const journeyPanel = document.getElementById("journeyPanel");
const achievementsPanel = document.getElementById("achievementsPanel");

function activateTab(tabName) {
  const isJourney = tabName === "journey";
  journeyPanel.classList.toggle("active", isJourney);
  achievementsPanel.classList.toggle("active", !isJourney);
  journeyTabButton.classList.toggle("active", isJourney);
  achievementsTabButton.classList.toggle("active", !isJourney);
  journeyTabButton.setAttribute("aria-selected", isJourney ? "true" : "false");
  achievementsTabButton.setAttribute("aria-selected", isJourney ? "false" : "true");
}

if (journeyTabButton && achievementsTabButton) {
  journeyTabButton.addEventListener("click", function () {
    activateTab("journey");
  });
  achievementsTabButton.addEventListener("click", function () {
    activateTab("achievements");
  });
}

// Elementen voor de resetfunctie
const resetButton = document.getElementById("resetButton");
const resetModal = document.getElementById("resetModal");
const cancelResetButton = document.getElementById("cancelResetButton");
const confirmResetButton = document.getElementById("confirmResetButton");

// Haal de opgeslagen afstand op uit localStorage.
// Als er nog niets is opgeslagen, beginnen we bij 0.
let totalWalked = Number(localStorage.getItem(STORAGE_KEY)) || 0;

// Hier komt de milestone-data in te staan, geladen uit journey.json
let milestones = [];

// journey.json inladen. Dit gebeurt één keer bij het openen van de pagina.
fetch("journey.json")
  .then(function (response) {
    return response.json();
  })
  .then(function (data) {
    milestones = data.milestones;
    // De route-ankerpunten van de kaart zijn afhankelijk van de milestone-data,
    // dus die bouwen we pas op zodra journey.json geladen is.
    mapRouteAnchors = buildMapRouteAnchors();
    // Pas nadat de data geladen is, kunnen we de pagina volledig tonen
    updateDisplay();
  })
  .catch(function (error) {
    console.error("Kon journey.json niet laden:", error);
    alert("journey.json kon niet worden geladen. Draai je de app via een lokale server?");
  });

// Zoek de huidige milestone: de laatst bereikte milestone.
// Dit is de laatste milestone in de lijst waarvan de km-waarde
// kleiner dan of gelijk aan totalWalked is.
function getCurrentMilestone() {
  let current = milestones[0];

  for (let i = 0; i < milestones.length; i++) {
    if (milestones[i].km <= totalWalked) {
      current = milestones[i];
    } else {
      break;
    }
  }

  return current;
}

// Zoek de volgende, nog niet bereikte milestone.
// Dit is de eerste milestone waarvan de km-waarde groter is dan totalWalked.
// Als er geen volgende meer is (Mount Doom is bereikt), geven we null terug.
function getNextMilestone() {
  for (let i = 0; i < milestones.length; i++) {
    if (milestones[i].km > totalWalked) {
      return milestones[i];
    }
  }
  return null;
}

// Zoek één milestone op zijn exacte naam uit journey.json.
// Dit is de enige manier waarop andere onderdelen (kaart, achievements)
// aan een afstand komen - er wordt nergens een tweede lijst bijgehouden.
function findMilestoneByName(name) {
  return milestones.find(function (milestone) {
    return milestone.name === name;
  });
}

// Bepaal de status van één milestone: "done", "current" of "future".
// Zowel de lijst als de kaart gebruiken deze ene functie, zodat er
// nergens een tweede, losse versie van deze logica ontstaat.
function getMilestoneStatus(milestone, current) {
  if (milestone.id === current.id) {
    return "current";
  } else if (milestone.km <= totalWalked) {
    return "done";
  } else {
    return "future";
  }
}

const STATUS_SYMBOLS = {
  done: "✓",
  current: "●",
  future: "○"
};

const STATUS_LABELS = {
  done: "Reached",
  current: "Current",
  future: "Ahead"
};

// Bouw de lijst met alle milestones opnieuw op, met het juiste symbool
// en een status-klasse (done / current / future) voor de styling.
function renderMilestoneList() {
  milestoneListEl.innerHTML = "";

  const current = getCurrentMilestone();

  milestones.forEach(function (milestone) {
    const li = document.createElement("li");
    const status = getMilestoneStatus(milestone, current);

    li.className = status;
    li.innerHTML =
      '<span class="symbol">' + STATUS_SYMBOLS[status] + "</span>" +
      "<span>" + milestone.name + " (" + milestone.km + " km)</span>";

    milestoneListEl.appendChild(li);
  });
}

/* =========================================================
   KAART (JOURNEY MAP V3)
   Volledig zelf getekend met SVG-vormen. Geen bestaande
   Midden-aarde-kaart, afbeelding of overtrekking - alleen
   wiskunde. journey.json bepaalt waar elke milestone ligt;
   regio's/decoraties zijn puur visuele laag daaromheen.
   ========================================================= */

const MAP_VIEWBOX_WIDTH = 100;
const MAP_VIEWBOX_HEIGHT = 115;
const MAP_TOP_MARGIN = 10;
const MAP_BOTTOM_MARGIN = 10;
const MAP_PATH_SAMPLES = 180;

// Zoom/pan-status van de kaart (puur weergave, geen appdata).
let mapScale = 1;
let mapTranslateX = 0;
let mapTranslateY = 0;
const MAP_MIN_SCALE = 1;
const MAP_MAX_SCALE = 6;
const MAP_ZOOM_TIER_1 = 2;
const MAP_ZOOM_TIER_2 = 3.6;

// Namen van "ankerpunten" die de globale vorm van de route bepalen,
// plus een zelfgekozen x-positie (puur esthetisch, geen afstandsdata).
// Dit geeft de route een herkenbare geografische opbouw: de Gouw in
// het noordwesten, Bree/Weathertop/Rivendel oostwaarts, de Nevelbergen
// als barrière, Moria erin, Lothlórien erachter, de Anduin zuidwaarts,
// en tenslotte Mordor.
const MAP_ROUTE_ANCHOR_DEFS = [
  { name: null, x: 24 },
  { name: "Bucklebury Ferry", x: 30 },
  { name: "Bree", x: 42 },
  { name: "Weathertop", x: 55 },
  { name: "Rivendell", x: 68 },
  { name: "Redhorn Pass / Caradhras", x: 50 },
  { name: "West Gate of Moria", x: 43 },
  { name: "Bridge of Khazad-dûm", x: 39 },
  { name: "Dimrill Dale", x: 46 },
  { name: "Lothlórien", x: 66 },
  { name: "River Anduin", x: 58 },
  { name: "Amon Hen / Parth Galen", x: 52 },
  { name: "Emyn Muil", x: 44 },
  { name: "Dead Marshes", x: 36 },
  { name: "Black Gate / Morannon", x: 30 },
  { name: "Ithilien", x: 40 },
  { name: "Minas Morgul", x: 55 },
  { name: "Shelob's Lair", x: 58 },
  { name: null, x: 50 }
];

// De daadwerkelijke ankerpunten (t + x), opgebouwd zodra journey.json
// geladen is. "t" komt rechtstreeks van milestone.km / TOTAL_DISTANCE.
let mapRouteAnchors = [];

function buildMapRouteAnchors() {
  const anchors = [{ t: 0, x: MAP_ROUTE_ANCHOR_DEFS[0].x }];

  MAP_ROUTE_ANCHOR_DEFS.slice(1, -1).forEach(function (anchorDef) {
    const milestone = findMilestoneByName(anchorDef.name);
    if (milestone) {
      anchors.push({ t: milestone.km / TOTAL_DISTANCE, x: anchorDef.x });
    }
  });

  anchors.push({ t: 1, x: MAP_ROUTE_ANCHOR_DEFS[MAP_ROUTE_ANCHOR_DEFS.length - 1].x });

  return anchors;
}

// Zoek de "t" (voortgang 0-1) van een milestone op basis van zijn naam.
// Gebruikt voor het plaatsen van regio's/decoraties, nooit voor afstanden.
function milestoneT(name) {
  const milestone = findMilestoneByName(name);
  return milestone ? milestone.km / TOTAL_DISTANCE : 0;
}

// Catmull-Rom spline: geeft een vloeiende curve door alle ankerpunten
// (in tegenstelling tot rechte lijnstukken tussen punten).
function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

// De horizontale positie van de grote, bewuste route-vorm (vloeiend
// geïnterpoleerd), zonder de kleine organische "trilling" erbovenop.
function macroX(t) {
  const anchors = mapRouteAnchors;
  if (anchors.length < 2) {
    return 50;
  }

  let i = 0;
  for (; i < anchors.length - 2; i++) {
    if (t <= anchors[i + 1].t) {
      break;
    }
  }

  const p0 = anchors[Math.max(0, i - 1)];
  const p1 = anchors[i];
  const p2 = anchors[Math.min(anchors.length - 1, i + 1)];
  const p3 = anchors[Math.min(anchors.length - 1, i + 2)];
  const span = p2.t - p1.t;
  const localT = span > 0 ? (t - p1.t) / span : 0;

  return catmullRom(p0.x, p1.x, p2.x, p3.x, localT);
}

// Bereken de positie op het pad voor een gegeven voortgang "t"
// (0 = Hobbiton, 1 = Mount Doom). Dit is de ENIGE plek waar de vorm
// van het pad wordt bepaald; het pad zelf, de milestones én de
// wandelaar gebruiken allemaal deze functie.
function pathPosition(t) {
  const clampedT = Math.max(0, Math.min(1, t));
  const usableHeight = MAP_VIEWBOX_HEIGHT - MAP_TOP_MARGIN - MAP_BOTTOM_MARGIN;
  const y = MAP_TOP_MARGIN + clampedT * usableHeight;

  // Een kleine, hoogfrequente trilling bovenop de vloeiende route-vorm
  // zorgt voor een organischer, minder "getekend" pad.
  const wiggle = 3.5 * Math.sin(clampedT * Math.PI * 11 + 0.6);

  let x = macroX(clampedT) + wiggle;
  x = Math.max(8, Math.min(92, x));

  return { x: x, y: y };
}

function samplePath() {
  const points = [];
  for (let i = 0; i <= MAP_PATH_SAMPLES; i++) {
    const t = i / MAP_PATH_SAMPLES;
    const position = pathPosition(t);
    points.push({ t: t, x: position.x, y: position.y });
  }
  return points;
}

function toPointsString(points) {
  return points
    .map(function (point) {
      return point.x + "," + point.y;
    })
    .join(" ");
}

// Y-coördinaat voor een gegeven t, los van x - gebruikt om regio's
// (landschapsbanden) even hoog te laten beginnen/eindigen als de route.
function yForT(t) {
  return pathPosition(t).y;
}

/* ---- Regio's: eigen landschapsvlakken met een golvende rand,
   zodat het geen strakke horizontale kleurbalken worden. ---- */

const MAP_REGION_DEFS = [
  { name: "The Shire", fromKm: 0, toKm: 185.1, top: "#3c5326", bottom: "#334a1f" },
  { name: "Eriador", fromKm: 185.1, toKm: 386.2, top: "#46431f", bottom: "#3a3220" },
  { name: "Road to Rivendell", fromKm: 386.2, toKm: 737.1, top: "#3a3a28", bottom: "#333a2a" },
  { name: "Misty Mountains", fromKm: 737.1, toKm: 1207.0, top: "#43464a", bottom: "#33363a" },
  { name: "Moria", fromKm: 1207.0, toKm: 1367.9, top: "#201f22", bottom: "#151417" },
  { name: "Lothlórien", fromKm: 1367.9, toKm: 1512.8, top: "#4a4420", bottom: "#3d3a1c" },
  { name: "Anduin", fromKm: 1512.8, toKm: 1643.1, top: "#28383e", bottom: "#1f2e33" },
  { name: "Emyn Muil & the Marshes", fromKm: 1643.1, toKm: 1947.3, top: "#33352a", bottom: "#2a2b22" },
  { name: "Approach to Mordor", fromKm: 1947.3, toKm: 2550.9, top: "#3a2e22", bottom: "#2a2018" },
  { name: "Cirith Ungol", fromKm: 2550.9, toKm: 2639.3, top: "#221a1c", bottom: "#170e10" },
  { name: "Mordor", fromKm: 2639.3, toKm: 2863, top: "#1c0f0c", bottom: "#0f0605" }
];

// Bouw één golvend landschapsvlak tussen twee t-waarden.
function regionBandMarkup(region, index) {
  const fromT = region.fromKm / TOTAL_DISTANCE;
  const toT = region.toKm / TOTAL_DISTANCE;
  const yFrom = yForT(fromT);
  const yTo = yForT(toT);
  const steps = 8;
  const amplitude = 2.4;

  let d = "M 0 " + (yFrom + amplitude * Math.sin(index)).toFixed(1);
  for (let i = 1; i <= steps; i++) {
    const x = (i / steps) * MAP_VIEWBOX_WIDTH;
    const wave = amplitude * Math.sin(i * 1.3 + index * 2.1);
    d += " L " + x.toFixed(1) + " " + (yFrom + wave).toFixed(1);
  }
  d += " L " + MAP_VIEWBOX_WIDTH + " " + yTo.toFixed(1);
  for (let i = steps; i >= 0; i--) {
    const x = (i / steps) * MAP_VIEWBOX_WIDTH;
    const wave = amplitude * Math.sin(i * 1.1 + index * 3.4 + 1.5);
    d += " L " + x.toFixed(1) + " " + (yTo + wave).toFixed(1);
  }
  d += " Z";

  const gradId = "regionGrad" + index;
  const defs =
    '<linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + region.top + '"></stop>' +
    '<stop offset="100%" stop-color="' + region.bottom + '"></stop>' +
    "</linearGradient>";

  const rect = '<path d="' + d + '" fill="url(#' + gradId + ')"></path>';

  return { defs: defs, shape: rect };
}

// Bouw de volledige achtergrond: alle regio's na elkaar, plus een
// vaste tekstlabel voor Moria (een gebied, geen losse milestone).
function buildMapBackgroundMarkup() {
  let defs = "<defs>";
  let shapes = "";

  MAP_REGION_DEFS.forEach(function (region, index) {
    const band = regionBandMarkup(region, index);
    defs += band.defs;
    shapes += band.shape;
  });

  defs += "</defs>";

  return defs + shapes;
}

// ---- Kleine, zelfgetekende decoratievormen (puur sfeer, geen data) ----

function treeMarkup(x, y, scale, variant) {
  const cls = variant === "gold" ? "map-deco-tree map-deco-tree-gold" : "map-deco-tree";
  return (
    '<g class="' + cls + '" transform="translate(' + x + "," + y + ") scale(" + scale + ')">' +
    '<polygon points="0,-4 -2.2,0 2.2,0"></polygon>' +
    '<polygon points="0,-2.4 -1.6,1.4 1.6,1.4"></polygon>' +
    '<rect x="-0.4" y="1.2" width="0.8" height="1.4"></rect>' +
    "</g>"
  );
}

function mountainMarkup(x, y, scale) {
  return (
    '<g class="map-deco-mountain" transform="translate(' + x + "," + y + ") scale(" + scale + ')">' +
    '<polygon points="-5,3 -1,-4 2,0 5,3"></polygon>' +
    '<polygon points="0,-4 3,3 -2,3"></polygon>' +
    "</g>"
  );
}

function moriaGateMarkup(x, y) {
  return (
    '<g class="map-deco-moria" transform="translate(' + x + "," + y + ')">' +
    '<path d="M -4 4 L -4 -1 A 4 4 0 0 1 4 -1 L 4 4 Z"></path>' +
    '<circle class="map-deco-moria-glow" cy="0.5" r="0.9"></circle>' +
    "</g>"
  );
}

function riverAlongPathMarkup(startT, endT) {
  if (!(endT > startT)) {
    return "";
  }

  let d = "";
  const steps = 18;

  for (let i = 0; i <= steps; i++) {
    const t = startT + (endT - startT) * (i / steps);
    const point = pathPosition(t);
    const offset = 7 * Math.sin(i / 2);
    const x = point.x + 9 + offset;
    const command = i === 0 ? "M" : "L";
    d += command + " " + x.toFixed(1) + " " + point.y.toFixed(1) + " ";
  }

  return '<path class="map-deco-river" d="' + d.trim() + '"></path>';
}

function rockMarkup(x, y, scale) {
  return (
    '<g class="map-deco-rock" transform="translate(' + x + "," + y + ") scale(" + scale + ')">' +
    '<polygon points="-3,2 -1,-2.5 1,-0.5 3,2"></polygon>' +
    "</g>"
  );
}

function towerMarkup(x, y) {
  return (
    '<g class="map-deco-tower" transform="translate(' + x + "," + y + ')">' +
    '<rect x="-1.2" y="-6" width="2.4" height="7"></rect>' +
    '<polygon points="-1.6,-6 0,-9 1.6,-6"></polygon>' +
    "</g>"
  );
}

function emberMarkup(x, y, radius) {
  return '<circle class="map-deco-ember" cx="' + x + '" cy="' + y + '" r="' + radius + '"></circle>';
}

// Een vast tekstlabel voor een REGIO (geen milestone, geen tik-doel).
// Alleen gebruikt voor "Moria", zoals gevraagd: het gebied heet Moria,
// de losse milestones (West Gate, Chamber of Mazarbul, Bridge of
// Khazad-dûm) blijven de echte, tikbare punten uit journey.json.
function regionLabelMarkup(text, x, y) {
  return (
    '<text class="map-label map-label-major map-region-label" x="' + x + '" y="' + y +
    '" text-anchor="middle">' + text + "</text>"
  );
}

function buildTerrainMarkup() {
  if (milestones.length === 0) {
    return "";
  }

  let markup = "";

  const breeT = milestoneT("Bree");
  const rivendellT = milestoneT("Rivendell");
  const moriaStartT = milestoneT("West Gate of Moria");
  const moriaEndT = milestoneT("Dimrill Dale");
  const lothlorienT = milestoneT("Lothlórien");
  const anduinT = milestoneT("River Anduin");
  const emynMuilT = milestoneT("Emyn Muil");
  const blackGateT = milestoneT("Black Gate / Morannon");
  const minasMorgulT = milestoneT("Minas Morgul");

  // De Gouw: rustige bomen vlak bij het begin
  [0.02, 0.045, 0.07].forEach(function (t, index) {
    if (t < breeT) {
      const point = pathPosition(t);
      const side = index % 2 === 0 ? -12 : 12;
      markup += treeMarkup(point.x + side, point.y - 2, 0.85, "green");
    }
  });

  // Nevelbergen: bergketen bij de aanloop naar Rivendel/Moria
  [rivendellT + 0.015, rivendellT + 0.045, moriaStartT - 0.02, moriaStartT - 0.05].forEach(function (t, index) {
    const point = pathPosition(t);
    const side = index % 2 === 0 ? 14 : -14;
    markup += mountainMarkup(point.x + side, point.y, 1.15);
  });

  // Moria: donkere poort + gebiedslabel
  const moriaMidT = (moriaStartT + moriaEndT) / 2;
  const moriaPoint = pathPosition(moriaMidT);
  markup += moriaGateMarkup(moriaPoint.x, moriaPoint.y);
  markup += regionLabelMarkup("MORIA", moriaPoint.x, moriaPoint.y - 7);

  // Lothlórien: goud-getinte bomen rond het bosgebied
  [lothlorienT - 0.015, lothlorienT + 0.01, lothlorienT + 0.03, lothlorienT + 0.045].forEach(function (t, index) {
    const point = pathPosition(t);
    const side = index % 2 === 0 ? -11 : 11;
    markup += treeMarkup(point.x + side, point.y - 1.5, 0.9, "gold");
  });

  // De Anduin: een kronkelende rivier die het pad een stuk volgt
  markup += riverAlongPathMarkup(anduinT, emynMuilT);

  // Rotsachtig, drogend gebied richting Mordor
  [blackGateT + 0.03, blackGateT + 0.08, minasMorgulT - 0.02, minasMorgulT + 0.03].forEach(function (t, index) {
    const point = pathPosition(t);
    const side = index % 2 === 0 ? 13 : -13;
    markup += rockMarkup(point.x + side, point.y, 1);
  });

  // Een verre torensilhouet bij Minas Morgul
  const towerPoint = pathPosition(minasMorgulT);
  markup += towerMarkup(towerPoint.x - 9, towerPoint.y - 2);

  // Gloeiende as/vonken vlak voor Mount Doom
  [0.9, 0.94, 0.97].forEach(function (t, index) {
    const point = pathPosition(t);
    const side = index % 2 === 0 ? 9 : -9;
    markup += emberMarkup(point.x + side, point.y, 0.6);
  });

  return markup;
}

/* ---- Zoom-afhankelijke milestone-namen ----
   Deze 9 namen (+ het "MORIA"-gebiedslabel hierboven) zijn altijd
   zichtbaar, ook uitgezoomd. Overige "major"-milestones verschijnen
   bij gemiddeld inzoomen; alle 42 pas bij maximaal inzoomen.
   Dit is puur een presentatiekeuze - de namen komen nog steeds
   allemaal uit journey.json, er is geen tweede lijst met namen. */
const MAP_ALWAYS_VISIBLE_NAMES = [
  "Hobbiton / Bag End",
  "Bree",
  "Weathertop",
  "Rivendell",
  "Lothlórien",
  "Amon Hen / Parth Galen",
  "Black Gate / Morannon",
  "Minas Morgul",
  "Mount Doom"
];

// Bouw de markering + het naamlabel voor één milestone. Het "type"-veld
// uit journey.json bepaalt vorm/grootte; de naam-zichtbaarheid wordt
// via CSS-klassen geregeld (zie #journeyMap.tier-1 / .tier-2 in style.css).
function buildMilestoneNodeMarkup(milestone, status) {
  const t = milestone.km / TOTAL_DISTANCE;
  const point = pathPosition(t);
  const idAttr = 'data-milestone-id="' + milestone.id + '"';
  const hitArea =
    '<circle class="map-node-hitarea" ' + idAttr + ' cx="' + point.x + '" cy="' + point.y + '" r="4.2"></circle>';

  let shapeMarkup;

  if (milestone.type === "final") {
    shapeMarkup =
      '<g class="map-icon-doom ' + status + '" ' + idAttr + ' transform="translate(' + point.x + "," + point.y + ')">' +
      '<polygon points="-4,4 0,-5 4,4"></polygon>' +
      '<circle class="map-icon-doom-glow" cy="-1" r="1.1"></circle>' +
      "</g>";
  } else if (milestone.type === "special") {
    shapeMarkup =
      '<rect class="map-node map-node-special ' + status + '" ' + idAttr + ' x="' + (point.x - 1.7) + '" y="' + (point.y - 1.7) +
      '" width="3.4" height="3.4" transform="rotate(45 ' + point.x + " " + point.y + ')"></rect>';
  } else if (milestone.type === "major") {
    shapeMarkup =
      '<circle class="map-node map-node-major ' + status + '" ' + idAttr + ' cx="' + point.x + '" cy="' + point.y + '" r="2.6"></circle>';
  } else {
    shapeMarkup =
      '<circle class="map-node ' + status + '" ' + idAttr + ' cx="' + point.x + '" cy="' + point.y + '" r="1.5"></circle>';
  }

  // Labelzichtbaarheid: altijd zichtbaar / vanaf tier 1 / vanaf tier 2.
  let labelClass = "map-label";
  if (MAP_ALWAYS_VISIBLE_NAMES.indexOf(milestone.name) !== -1) {
    labelClass += " map-label-major";
  } else if (milestone.type === "major") {
    labelClass += " map-label-type-major";
  }

  const labelSide = point.x > 50 ? -1 : 1;
  const labelX = point.x + labelSide * 3.2;
  const labelY = point.y + 1;
  const anchor = labelSide > 0 ? "start" : "end";

  const labelMarkup =
    '<text class="' + labelClass + '" x="' + labelX + '" y="' + labelY + '" text-anchor="' + anchor + '">' +
    milestone.name + "</text>";

  return hitArea + shapeMarkup + labelMarkup;
}

// Teken de kaart opnieuw: achtergrond, landschap, pad, milestones
// en de exacte positie van Frodo & Sam, gebaseerd op totalWalked.
// Alles komt binnen één <g id="mapViewport"> te staan, zodat zoom/pan
// simpelweg een transform op die ene groep is.
function renderMap() {
  if (!journeyMapEl || milestones.length === 0) {
    return;
  }

  journeyMapEl.setAttribute("viewBox", "0 0 " + MAP_VIEWBOX_WIDTH + " " + MAP_VIEWBOX_HEIGHT);

  const current = getCurrentMilestone();

  const travelerT = Math.max(0, Math.min(1, totalWalked / TOTAL_DISTANCE));
  const travelerPoint = pathPosition(travelerT);

  const allPoints = samplePath();
  const traveledPoints = allPoints
    .filter(function (point) {
      return point.t <= travelerT;
    })
    .concat([travelerPoint]);
  const remainingPoints = [travelerPoint].concat(
    allPoints.filter(function (point) {
      return point.t >= travelerT;
    })
  );

  let nodesMarkup = "";
  milestones.forEach(function (milestone) {
    const status = getMilestoneStatus(milestone, current);
    nodesMarkup += buildMilestoneNodeMarkup(milestone, status);
  });

  journeyMapEl.innerHTML =
    '<g id="mapViewport">' +
    buildMapBackgroundMarkup() +
    buildTerrainMarkup() +
    '<polyline class="map-path-remaining" points="' + toPointsString(remainingPoints) + '"></polyline>' +
    '<polyline class="map-path-done" points="' + toPointsString(traveledPoints) + '"></polyline>' +
    nodesMarkup +
    '<circle class="map-traveler-ring" cx="' + travelerPoint.x + '" cy="' + travelerPoint.y + '" r="1.8"></circle>' +
    '<circle class="map-traveler" cx="' + travelerPoint.x + '" cy="' + travelerPoint.y + '" r="1.6"></circle>' +
    "</g>";

  // De kaart is opnieuw opgebouwd, dus de <g> heeft nog geen transform.
  // De huidige zoom/pan-stand opnieuw toepassen:
  applyMapTransform();
}

/* ---- Zoom & pan: alleen native SVG/JS, geen externe library ---- */

function clampMapTransform() {
  const minX = Math.min(0, MAP_VIEWBOX_WIDTH - MAP_VIEWBOX_WIDTH * mapScale);
  const minY = Math.min(0, MAP_VIEWBOX_HEIGHT - MAP_VIEWBOX_HEIGHT * mapScale);
  mapTranslateX = Math.max(minX, Math.min(0, mapTranslateX));
  mapTranslateY = Math.max(minY, Math.min(0, mapTranslateY));
}

function updateZoomTierClass() {
  if (!journeyMapEl) {
    return;
  }
  let tier = 0;
  if (mapScale >= MAP_ZOOM_TIER_2) {
    tier = 2;
  } else if (mapScale >= MAP_ZOOM_TIER_1) {
    tier = 1;
  }
  journeyMapEl.classList.remove("tier-0", "tier-1", "tier-2");
  journeyMapEl.classList.add("tier-" + tier);
}

function applyMapTransform() {
  const viewport = document.getElementById("mapViewport");
  if (!viewport) {
    return;
  }
  viewport.setAttribute(
    "transform",
    "translate(" + mapTranslateX.toFixed(2) + "," + mapTranslateY.toFixed(2) + ") scale(" + mapScale.toFixed(2) + ")"
  );
  updateZoomTierClass();
}

// Zoom in/uit, met (px, py) als vast punt (in viewBox-coördinaten)
// dat op het scherm blijft staan tijdens het zoomen.
function zoomMapAt(px, py, newScale) {
  const clampedScale = Math.max(MAP_MIN_SCALE, Math.min(MAP_MAX_SCALE, newScale));
  const contentX = (px - mapTranslateX) / mapScale;
  const contentY = (py - mapTranslateY) / mapScale;

  mapScale = clampedScale;
  mapTranslateX = px - contentX * mapScale;
  mapTranslateY = py - contentY * mapScale;

  clampMapTransform();
  applyMapTransform();
}

function resetMapView() {
  mapScale = 1;
  mapTranslateX = 0;
  mapTranslateY = 0;
  applyMapTransform();
}

function clientToViewBoxPoint(clientX, clientY) {
  const rect = journeyMapEl.getBoundingClientRect();
  const scaleX = MAP_VIEWBOX_WIDTH / rect.width;
  const scaleY = MAP_VIEWBOX_HEIGHT / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function distanceBetweenTouches(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

if (journeyMapEl) {
  let lastTouchX = 0;
  let lastTouchY = 0;
  let lastPinchDistance = 0;
  let touchMoved = false;

  journeyMapEl.addEventListener("touchstart", function (event) {
    touchMoved = false;
    if (mapHintEl) {
      mapHintEl.classList.add("hidden");
    }

    if (event.touches.length === 1) {
      lastTouchX = event.touches[0].clientX;
      lastTouchY = event.touches[0].clientY;
    } else if (event.touches.length === 2) {
      lastPinchDistance = distanceBetweenTouches(event.touches);
    }
  }, { passive: true });

  journeyMapEl.addEventListener("touchmove", function (event) {
    if (event.touches.length === 2) {
      // Pinch-to-zoom
      event.preventDefault();
      touchMoved = true;

      const newDistance = distanceBetweenTouches(event.touches);
      if (lastPinchDistance > 0) {
        const midX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const midY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        const point = clientToViewBoxPoint(midX, midY);
        const ratio = newDistance / lastPinchDistance;
        zoomMapAt(point.x, point.y, mapScale * ratio);
      }
      lastPinchDistance = newDistance;
    } else if (event.touches.length === 1) {
      // Eén vinger: pannen (alleen als er al ingezoomd is, anders is
      // er toch niets te verschuiven)
      const touch = event.touches[0];
      const dx = touch.clientX - lastTouchX;
      const dy = touch.clientY - lastTouchY;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        touchMoved = true;
        event.preventDefault();

        const rect = journeyMapEl.getBoundingClientRect();
        const scaleX = MAP_VIEWBOX_WIDTH / rect.width;
        const scaleY = MAP_VIEWBOX_HEIGHT / rect.height;

        mapTranslateX += dx * scaleX;
        mapTranslateY += dy * scaleY;
        clampMapTransform();
        applyMapTransform();

        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
      }
    }
  }, { passive: false });

  journeyMapEl.addEventListener("touchend", function () {
    lastPinchDistance = 0;
  });

  // Tik op een milestone-marker: toon naam, afstand en status in het
  // tooltip-paneel onder de kaart. Alleen als het een echte tik was
  // (geen sleepbeweging), zodat pannen geen tooltip opent.
  journeyMapEl.addEventListener("click", function (event) {
    if (touchMoved) {
      return;
    }

    const target = event.target.closest("[data-milestone-id]");
    if (!target) {
      return;
    }

    const id = Number(target.getAttribute("data-milestone-id"));
    const milestone = milestones.find(function (m) {
      return m.id === id;
    });
    if (!milestone) {
      return;
    }

    const current = getCurrentMilestone();
    const status = getMilestoneStatus(milestone, current);

    mapTooltipEl.innerHTML =
      '<p class="map-tooltip-name">' + milestone.name + "</p>" +
      '<p class="map-tooltip-meta">' + milestone.km + " km &nbsp;·&nbsp; " + STATUS_LABELS[status] + "</p>";
  });
}

// Knoppen voor zoom in / uit / fit (voor desktop-muizen en als
// betrouwbaar alternatief naast pinch-to-zoom op mobiel).
if (mapZoomInButton) {
  mapZoomInButton.addEventListener("click", function () {
    zoomMapAt(MAP_VIEWBOX_WIDTH / 2, MAP_VIEWBOX_HEIGHT / 2, mapScale * 1.4);
  });
}

if (mapZoomOutButton) {
  mapZoomOutButton.addEventListener("click", function () {
    zoomMapAt(MAP_VIEWBOX_WIDTH / 2, MAP_VIEWBOX_HEIGHT / 2, mapScale / 1.4);
  });
}

if (mapZoomResetButton) {
  mapZoomResetButton.addEventListener("click", function () {
    resetMapView();
  });
}


/* =========================================================
   ACHIEVEMENTS
   Alle achievement-definities staan hier als vaste data-structuur
   (dit is nieuwe app-data, geen milestone-afstand). Voor het
   controleren van "milestone"-achievements wordt de afstand van
   die milestone altijd rechtstreeks opgezocht in journey.json -
   er wordt geen afstand hier dubbel vastgelegd.
   ========================================================= */

const ACHIEVEMENTS = [
  {
    id: "first-steps",
    icon: "🌿",
    name: "First Steps",
    description: "Walk your first kilometer.",
    type: "distance",
    value: 1
  },
  {
    id: "there-and-back-again",
    icon: "🏡",
    name: "There and Back Again",
    description: "Walk your first 10 km.",
    type: "distance",
    value: 10
  },
  {
    id: "into-the-wild",
    icon: "🌲",
    name: "Into the Wild",
    description: "Leave the Shire behind.",
    type: "milestone",
    milestoneName: "Bucklebury Ferry"
  },
  {
    id: "prancing-pony",
    icon: "🍺",
    name: "A Night at the Prancing Pony",
    description: "Reach Bree.",
    type: "milestone",
    milestoneName: "Bree"
  },
  {
    id: "weathertop",
    icon: "👁️",
    name: "Weathertop",
    description: "Reach Weathertop.",
    type: "milestone",
    milestoneName: "Weathertop"
  },
  {
    id: "last-homely-house",
    icon: "🧝",
    name: "The Last Homely House",
    description: "Reach Rivendell.",
    type: "milestone",
    milestoneName: "Rivendell"
  },
  {
    id: "over-the-mountains",
    icon: "🗻",
    name: "Over the Mountains",
    description: "Cross Redhorn Pass.",
    type: "milestone",
    milestoneName: "Redhorn Pass / Caradhras"
  },
  {
    id: "into-the-mines",
    icon: "⛏️",
    name: "Into the Mines",
    description: "Enter Moria.",
    type: "milestone",
    milestoneName: "West Gate of Moria"
  },
  {
    id: "welcome-lothlorien",
    icon: "🌳",
    name: "Welcome to Lothlórien",
    description: "Reach Lothlórien.",
    type: "milestone",
    milestoneName: "Lothlórien"
  },
  {
    id: "gifts-of-galadriel",
    icon: "🎁",
    name: "Gifts of Galadriel",
    description: "Look into the Mirror.",
    type: "milestone",
    milestoneName: "Mirror of Galadriel"
  },
  {
    id: "follow-the-anduin",
    icon: "🌊",
    name: "Follow the Anduin",
    description: "Reach the River Anduin.",
    type: "milestone",
    milestoneName: "River Anduin"
  },
  {
    id: "into-mordor",
    icon: "🌑",
    name: "Into Mordor",
    description: "Reach the Black Gate.",
    type: "milestone",
    milestoneName: "Black Gate / Morannon"
  },
  {
    id: "ranger-of-ithilien",
    icon: "🏹",
    name: "Ranger of Ithilien",
    description: "Reach Ithilien.",
    type: "milestone",
    milestoneName: "Ithilien"
  },
  {
    id: "shelobs-lair",
    icon: "🕷️",
    name: "Shelob's Lair",
    description: "Survive Shelob's Lair.",
    type: "milestone",
    milestoneName: "Shelob's Lair"
  },
  {
    id: "fires-of-mount-doom",
    icon: "🔥",
    name: "The Fires of Mount Doom",
    description: "Reach Mount Doom.",
    type: "milestone",
    milestoneName: "Mount Doom"
  },
  {
    id: "one-journey-complete",
    icon: "🏆",
    name: "One Journey Complete",
    description: "Walk the full 2,863 km.",
    type: "distance",
    value: TOTAL_DISTANCE
  }
];

// Welke achievement-id's al zijn vrijgespeeld (persistent via localStorage)
let unlockedAchievementIds = loadUnlockedAchievements();

function loadUnlockedAchievements() {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function saveUnlockedAchievements() {
  localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(unlockedAchievementIds));
}

// Bepaal of een achievement (nu) voldaan is, puur op basis van
// totalWalked en - voor "milestone"-achievements - een opzoeking
// in journey.json.
function isAchievementUnlocked(achievement) {
  if (achievement.type === "distance") {
    return totalWalked >= achievement.value;
  }

  if (achievement.type === "milestone") {
    const target = findMilestoneByName(achievement.milestoneName);
    return target ? totalWalked >= target.km : false;
  }

  return false;
}

// Controleer alle achievements. Eenmaal vrijgespeeld blijven ze
// vrijgespeeld (we halen nooit iets terug uit unlockedAchievementIds
// hier - dat gebeurt alleen expliciet bij een reset).
function evaluateAchievements() {
  if (milestones.length === 0) {
    return;
  }

  const newlyUnlocked = [];

  ACHIEVEMENTS.forEach(function (achievement) {
    const alreadyUnlocked = unlockedAchievementIds.indexOf(achievement.id) !== -1;
    if (!alreadyUnlocked && isAchievementUnlocked(achievement)) {
      unlockedAchievementIds.push(achievement.id);
      newlyUnlocked.push(achievement);
    }
  });

  if (newlyUnlocked.length > 0) {
    saveUnlockedAchievements();
    queueAchievementToasts(newlyUnlocked);
  }

  renderAchievements();
}

// Bouw de achievement-kaarten opnieuw op.
function renderAchievements() {
  if (!achievementListEl) {
    return;
  }

  if (achievementSummaryEl) {
    achievementSummaryEl.textContent =
      unlockedAchievementIds.length + " of " + ACHIEVEMENTS.length + " achievements unlocked";
  }

  achievementListEl.innerHTML = "";

  ACHIEVEMENTS.forEach(function (achievement) {
    const unlocked = unlockedAchievementIds.indexOf(achievement.id) !== -1;
    const card = document.createElement("div");
    card.className = "achievement-card " + (unlocked ? "unlocked" : "locked");

    card.innerHTML =
      '<span class="achievement-icon">' + (unlocked ? achievement.icon : "🔒") + "</span>" +
      '<span class="achievement-name">' + achievement.name + "</span>" +
      '<span class="achievement-description">' + achievement.description + "</span>" +
      (unlocked ? '<span class="achievement-status">✓ Unlocked</span>' : "");

    achievementListEl.appendChild(card);
  });
}

// Toon meerdere nieuwe achievements ná elkaar als korte banner
// (geen browser- of systeemnotificatie, puur binnen de pagina).
let toastQueue = [];
let toastIsShowing = false;

function queueAchievementToasts(achievements) {
  toastQueue = toastQueue.concat(achievements);
  showNextToast();
}

function showNextToast() {
  if (!achievementToastEl || toastIsShowing || toastQueue.length === 0) {
    return;
  }

  const achievement = toastQueue.shift();
  toastIsShowing = true;

  achievementToastEl.innerHTML =
    '<p class="toast-title">🏆 Achievement unlocked!</p>' +
    '<p class="toast-name">' + achievement.icon + " " + achievement.name + "</p>" +
    '<p class="toast-description">' + achievement.description + "</p>";

  achievementToastEl.classList.add("visible");

  setTimeout(function () {
    achievementToastEl.classList.remove("visible");
    toastIsShowing = false;
    setTimeout(showNextToast, 300);
  }, 3200);
}

// Werk de hele pagina bij met de huidige waarden
function updateDisplay() {
  // Voor de weergave ronden we af op 1 decimaal; het opgeslagen getal
  // (totalWalked) blijft ongeacht de weergave gewoon exact.
  currentDistanceEl.textContent = totalWalked.toFixed(1);

  // Percentage berekenen, maar nooit boven de 100%
  let percent = (totalWalked / TOTAL_DISTANCE) * 100;
  if (percent > 100) {
    percent = 100;
  }
  progressPercentEl.textContent = percent.toFixed(1);
  progressFillEl.style.width = percent + "%";

  // Als de milestone-data nog niet geladen is, stoppen we hier
  if (milestones.length === 0) {
    return;
  }

  const current = getCurrentMilestone();
  const next = getNextMilestone();

  currentMilestoneEl.textContent = current.name;

  if (next) {
    nextMilestoneEl.textContent = next.name;
    kmToNextEl.textContent = (next.km - totalWalked).toFixed(1);
  } else {
    // Geen volgende milestone meer: de reis is voltooid
    nextMilestoneEl.textContent = "Geen (reis voltooid!)";
    kmToNextEl.textContent = "0";
  }

  renderMilestoneList();
  renderMap();
  evaluateAchievements();
}

// Sla de huidige afstand op in localStorage
function saveDistance() {
  localStorage.setItem(STORAGE_KEY, totalWalked);
}

// Wat er gebeurt als je op de knop klikt
addDistanceButton.addEventListener("click", function () {
  const input = prompt("Hoeveel kilometer heb je gelopen?");

  // Zet de invoer om naar een getal
  const km = Number(input);

  // Alleen doorgaan als het een geldig, positief getal is
  if (!isNaN(km) && km > 0) {
    totalWalked += km;
    saveDistance();
    updateDisplay();
  } else {
    alert("Voer een geldig aantal kilometers in.");
  }
});

/* =========================================================
   RESET PROGRESS
   Wist alleen de opgeslagen afstand en de vrijgespeelde
   achievements. journey.json, de milestones en alle andere
   bestanden blijven onaangeroerd.
   ========================================================= */

resetButton.addEventListener("click", function () {
  resetModal.classList.remove("hidden");
});

cancelResetButton.addEventListener("click", function () {
  resetModal.classList.add("hidden");
});

confirmResetButton.addEventListener("click", function () {
  totalWalked = 0;
  saveDistance();

  unlockedAchievementIds = [];
  saveUnlockedAchievements();

  resetMapView();
  updateDisplay();
  resetModal.classList.add("hidden");
});

// We roepen updateDisplay() hier niet meteen aan voor de milestone-onderdelen,
// want journey.json is dan mogelijk nog niet geladen.
// Voor de afstand en de achievement-kaarten tonen we wel meteen de
// opgeslagen waarden:
currentDistanceEl.textContent = totalWalked.toFixed(1);
renderAchievements();

// Service worker registreren, zodat de app installeerbaar is en offline werkt.
// Dit heeft geen invloed op de afstand-, milestone- of localStorage-logica hierboven.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch(function (error) {
        console.error("Service worker registratie mislukt:", error);
      });
  });
}
