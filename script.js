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
const achievementListEl = document.getElementById("achievementList");
const achievementToastEl = document.getElementById("achievementToast");

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
   KAART (JOURNEY MAP V2)
   De kaart is volledig zelf getekend met SVG-vormen. Er wordt
   geen bestaande Midden-aarde-kaart, afbeelding of overtrekking
   gebruikt - alleen wiskunde, en de data uit journey.json bepaalt
   waar elke milestone op het zelfgetekende pad ligt.
   ========================================================= */

const MAP_VIEWBOX_WIDTH = 100;
const MAP_VIEWBOX_HEIGHT = 150;
const MAP_TOP_MARGIN = 10;
const MAP_BOTTOM_MARGIN = 10;
const MAP_PATH_SAMPLES = 180;

// Namen van "ankerpunten" die de globale vorm van de route bepalen,
// plus een zelfgekozen x-positie (puur esthetisch, geen afstandsdata).
// De eerste en laatste ("null") zijn respectievelijk Hobbiton en Mount Doom.
// Dit geeft de route een herkenbare geografische opbouw: de Gouw in het
// westen, Rivendel/de Nevelbergen als barrière, Lothlórien erachter,
// de Anduin naar het zuiden, en tenslotte Mordor.
const MAP_ROUTE_ANCHOR_DEFS = [
  { name: null, x: 28 },
  { name: "Bucklebury Ferry", x: 34 },
  { name: "Bree", x: 46 },
  { name: "Weathertop", x: 57 },
  { name: "Rivendell", x: 66 },
  { name: "Redhorn Pass / Caradhras", x: 49 },
  { name: "West Gate of Moria", x: 44 },
  { name: "Bridge of Khazad-dûm", x: 41 },
  { name: "Dimrill Dale", x: 47 },
  { name: "Lothlórien", x: 63 },
  { name: "River Anduin", x: 55 },
  { name: "Amon Hen / Parth Galen", x: 50 },
  { name: "Emyn Muil", x: 44 },
  { name: "Dead Marshes", x: 38 },
  { name: "Black Gate / Morannon", x: 33 },
  { name: "Ithilien", x: 40 },
  { name: "Minas Morgul", x: 52 },
  { name: "Shelob's Lair", x: 56 },
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
// Gebruikt voor het plaatsen van decoraties per landschapszone.
function milestoneT(name) {
  const milestone = findMilestoneByName(name);
  return milestone ? milestone.km / TOTAL_DISTANCE : 0;
}

// De horizontale positie van de grote, bewuste route-vorm (zonder de
// kleine organische "trilling" die er later overheen komt).
function macroX(t) {
  const anchors = mapRouteAnchors;
  if (anchors.length === 0) {
    return 50;
  }

  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      const localT = span > 0 ? (t - a.t) / span : 0;
      return a.x + (b.x - a.x) * localT;
    }
  }

  return anchors[anchors.length - 1].x;
}

// Bereken de positie op het pad voor een gegeven voortgang "t"
// (0 = Hobbiton, 1 = Mount Doom). Dit is de ENIGE plek waar de vorm
// van het pad wordt bepaald; het pad zelf, de milestones én de
// wandelaar gebruiken allemaal deze functie.
function pathPosition(t) {
  const clampedT = Math.max(0, Math.min(1, t));
  const usableHeight = MAP_VIEWBOX_HEIGHT - MAP_TOP_MARGIN - MAP_BOTTOM_MARGIN;
  const y = MAP_TOP_MARGIN + clampedT * usableHeight;

  // Een kleine, hoogfrequente trilling bovenop de grote route-vorm
  // zorgt voor een organischer, minder "getekend" pad.
  const wiggle = 5 * Math.sin(clampedT * Math.PI * 9 + 0.6);

  let x = macroX(clampedT) + wiggle;
  x = Math.max(10, Math.min(90, x));

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

// Achtergrond: een verticale kleurovergang die de reis door
// verschillende sferen laat lopen, van de Gouw tot Mordor.
function buildMapBackgroundMarkup() {
  return (
    "<defs>" +
    '<linearGradient id="mapTerrainGradient" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#33461f"></stop>' +
    '<stop offset="10%" stop-color="#394a20"></stop>' +
    '<stop offset="20%" stop-color="#3c4022"></stop>' +
    '<stop offset="30%" stop-color="#393a2a"></stop>' +
    '<stop offset="40%" stop-color="#33383c"></stop>' +
    '<stop offset="46%" stop-color="#232227"></stop>' +
    '<stop offset="53%" stop-color="#3d4425"></stop>' +
    '<stop offset="60%" stop-color="#2f3a2e"></stop>' +
    '<stop offset="70%" stop-color="#33302a"></stop>' +
    '<stop offset="80%" stop-color="#2a211d"></stop>' +
    '<stop offset="90%" stop-color="#1d1512"></stop>' +
    '<stop offset="100%" stop-color="#150d0c"></stop>' +
    "</linearGradient>" +
    "</defs>" +
    '<rect x="0" y="0" width="' + MAP_VIEWBOX_WIDTH + '" height="' + MAP_VIEWBOX_HEIGHT +
    '" rx="4" fill="url(#mapTerrainGradient)"></rect>'
  );
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

// Een donkere, gewelfde poort: de ingang van Moria.
function moriaGateMarkup(x, y) {
  return (
    '<g class="map-deco-moria" transform="translate(' + x + "," + y + ')">' +
    '<path d="M -4 4 L -4 -1 A 4 4 0 0 1 4 -1 L 4 4 Z"></path>' +
    '<circle class="map-deco-moria-glow" cy="0.5" r="0.9"></circle>' +
    "</g>"
  );
}

// Een rivier die een stuk van het pad volgt (met een zijdelingse offset,
// zodat hij niet precies over de gouden route heen valt).
function riverAlongPathMarkup(startT, endT) {
  if (!(endT > startT)) {
    return "";
  }

  let d = "";
  const steps = 16;

  for (let i = 0; i <= steps; i++) {
    const t = startT + (endT - startT) * (i / steps);
    const point = pathPosition(t);
    const offset = 6 * Math.sin(i / 2);
    const x = point.x + 8 + offset;
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

// Een eenvoudige, abstracte torensilhouet - geen bestaand ontwerp nagetekend.
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

// Zet alle landschapsdecoraties per zone neer. De zonegrenzen worden
// opgezocht via milestone-namen (dus nog steeds journey.json als bron),
// maar de decoraties zelf horen bij geen enkele specifieke milestone.
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
      const side = index % 2 === 0 ? -11 : 11;
      markup += treeMarkup(point.x + side, point.y - 2, 0.85, "green");
    }
  });

  // Nevelbergen: bergcluster bij de aanloop naar Rivendel/Moria
  [rivendellT + 0.02, rivendellT + 0.05, moriaStartT - 0.015].forEach(function (t, index) {
    const point = pathPosition(t);
    const side = index % 2 === 0 ? 13 : -13;
    markup += mountainMarkup(point.x + side, point.y, 1.15);
  });

  // Moria: een donkere poort tussen de westpoort en Dimrill Dale
  const moriaMidT = (moriaStartT + moriaEndT) / 2;
  const moriaPoint = pathPosition(moriaMidT);
  markup += moriaGateMarkup(moriaPoint.x, moriaPoint.y);

  // Lothlórien: goud-getinte bomen rond het bosgebied
  [lothlorienT - 0.015, lothlorienT + 0.01, lothlorienT + 0.03].forEach(function (t, index) {
    const point = pathPosition(t);
    const side = index % 2 === 0 ? -10 : 10;
    markup += treeMarkup(point.x + side, point.y - 1.5, 0.9, "gold");
  });

  // De Anduin: een rivier die het pad een stuk volgt
  markup += riverAlongPathMarkup(anduinT, emynMuilT);

  // Rotsachtig gebied richting Mordor
  [blackGateT + 0.03, blackGateT + 0.08, minasMorgulT - 0.02].forEach(function (t, index) {
    const point = pathPosition(t);
    const side = index % 2 === 0 ? 12 : -12;
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

// Bouw de markering voor één milestone, inclusief een iets grotere
// onzichtbare "tik-zone" zodat hij op een telefoon makkelijk te raken is.
// Het "type"-veld uit journey.json bepaalt vorm en grootte.
function buildMilestoneNodeMarkup(milestone, status) {
  const t = milestone.km / TOTAL_DISTANCE;
  const point = pathPosition(t);
  const idAttr = 'data-milestone-id="' + milestone.id + '"';
  const hitArea =
    '<circle class="map-node-hitarea" ' + idAttr + ' cx="' + point.x + '" cy="' + point.y + '" r="4.2"></circle>';

  if (milestone.type === "final") {
    return (
      hitArea +
      '<g class="map-icon-doom ' + status + '" ' + idAttr + ' transform="translate(' + point.x + "," + point.y + ')">' +
      '<polygon points="-4,4 0,-5 4,4"></polygon>' +
      '<circle class="map-icon-doom-glow" cy="-1" r="1.1"></circle>' +
      "</g>"
    );
  }

  if (milestone.type === "special") {
    return (
      hitArea +
      '<rect class="map-node map-node-special ' + status + '" ' + idAttr + ' x="' + (point.x - 1.7) + '" y="' + (point.y - 1.7) +
      '" width="3.4" height="3.4" transform="rotate(45 ' + point.x + " " + point.y + ')"></rect>'
    );
  }

  if (milestone.type === "major") {
    return (
      hitArea +
      '<circle class="map-node map-node-major ' + status + '" ' + idAttr + ' cx="' + point.x + '" cy="' + point.y + '" r="2.6"></circle>'
    );
  }

  return (
    hitArea +
    '<circle class="map-node ' + status + '" ' + idAttr + ' cx="' + point.x + '" cy="' + point.y + '" r="1.5"></circle>'
  );
}

// Teken de kaart opnieuw: achtergrond, landschap, pad, milestones
// en de exacte positie van Frodo & Sam, gebaseerd op totalWalked.
function renderMap() {
  if (!journeyMapEl || milestones.length === 0) {
    return;
  }

  journeyMapEl.setAttribute("viewBox", "0 0 " + MAP_VIEWBOX_WIDTH + " " + MAP_VIEWBOX_HEIGHT);

  const current = getCurrentMilestone();

  // Voortgang als getal tussen 0 en 1 - dezelfde verhouding als het
  // percentage, dus kaart en percentage lopen altijd exact gelijk op.
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
    buildMapBackgroundMarkup() +
    buildTerrainMarkup() +
    '<polyline class="map-path-remaining" points="' + toPointsString(remainingPoints) + '"></polyline>' +
    '<polyline class="map-path-done" points="' + toPointsString(traveledPoints) + '"></polyline>' +
    nodesMarkup +
    '<circle class="map-traveler-ring" cx="' + travelerPoint.x + '" cy="' + travelerPoint.y + '" r="1.8"></circle>' +
    '<circle class="map-traveler" cx="' + travelerPoint.x + '" cy="' + travelerPoint.y + '" r="1.6"></circle>';
}

// Tik/klik op een milestone-marker: toon naam, afstand en status
// in het tooltip-paneel onder de kaart (betrouwbaarder op mobiel
// dan een zwevende tooltip bovenop een schaalbare SVG).
if (journeyMapEl) {
  journeyMapEl.addEventListener("click", function (event) {
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
