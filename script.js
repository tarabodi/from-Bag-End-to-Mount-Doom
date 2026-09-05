// De totale reisafstand van Hobbiton naar Mount Doom (in km)
const TOTAL_DISTANCE = 2863;

// De sleutelnaam waaronder we de afstand opslaan in localStorage
const STORAGE_KEY = "walkToMordorDistance";

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
   KAART (JOURNEY MAP)
   De kaart is volledig zelf getekend met SVG-vormen (lijnen,
   cirkels, driehoeken). Er wordt geen bestaande afbeelding of
   kaart gebruikt - alleen wiskunde en de data uit journey.json.
   ========================================================= */

// Afmetingen van het SVG-tekengebied. De hoogte is groter dan
// de breedte, zodat de reis als een verticale "banner" oogt.
const MAP_VIEWBOX_WIDTH = 100;
const MAP_VIEWBOX_HEIGHT = 140;
const MAP_TOP_MARGIN = 10;
const MAP_BOTTOM_MARGIN = 10;

// Aantal steekproefpunten waarmee we het pad tekenen. Meer punten
// = een vloeiendere lijn.
const MAP_PATH_SAMPLES = 160;

// Bereken de positie op het pad voor een gegeven voortgang "t"
// (een getal tussen 0 en 1, waarbij 0 = Hobbiton en 1 = Mount Doom).
// Dit is de ENIGE plek waar de vorm van het pad wordt bepaald; het
// pad zelf, de milestones én de wandelaar gebruiken allemaal deze
// functie, zodat alles altijd op precies dezelfde lijn ligt.
function pathPosition(t) {
  const clampedT = Math.max(0, Math.min(1, t));
  const usableHeight = MAP_VIEWBOX_HEIGHT - MAP_TOP_MARGIN - MAP_BOTTOM_MARGIN;
  const y = MAP_TOP_MARGIN + clampedT * usableHeight;

  // Twee sinusgolven van verschillende "golflengte" bij elkaar opgeteld
  // geven een organischer, minder mechanisch pad dan één simpele zigzag.
  const wiggle =
    24 * Math.sin(clampedT * Math.PI * 2.3) +
    9 * Math.sin(clampedT * Math.PI * 5.4 + 1.1);

  let x = 50 + wiggle;
  x = Math.max(14, Math.min(86, x)); // binnen de kaart houden

  return { x: x, y: y };
}

// Neem MAP_PATH_SAMPLES punten langs het hele pad, van start tot einde.
function samplePath() {
  const points = [];
  for (let i = 0; i <= MAP_PATH_SAMPLES; i++) {
    const t = i / MAP_PATH_SAMPLES;
    const position = pathPosition(t);
    points.push({ t: t, x: position.x, y: position.y });
  }
  return points;
}

// Zet een lijst van {x, y}-punten om naar een SVG "points"-tekenreeks.
function toPointsString(points) {
  return points
    .map(function (point) {
      return point.x + "," + point.y;
    })
    .join(" ");
}

// Achtergrond van de kaart: een verticale kleurovergang van een
// zacht groen (Hobbiton) naar een donkere, dreigende tint (Mordor).
function buildMapBackgroundMarkup() {
  return (
    "<defs>" +
    '<linearGradient id="mapTerrainGradient" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#33461f"></stop>' +
    '<stop offset="30%" stop-color="#3a3220"></stop>' +
    '<stop offset="55%" stop-color="#2e2a24"></stop>' +
    '<stop offset="78%" stop-color="#211c1a"></stop>' +
    '<stop offset="100%" stop-color="#150d0c"></stop>' +
    "</linearGradient>" +
    "</defs>" +
    '<rect x="0" y="0" width="' + MAP_VIEWBOX_WIDTH + '" height="' + MAP_VIEWBOX_HEIGHT +
    '" rx="4" fill="url(#mapTerrainGradient)"></rect>'
  );
}

// Kleine, zelfgetekende decoratie-vormen. Puur sfeer, geen data.
function treeMarkup(x, y, scale) {
  return (
    '<g class="map-deco-tree" transform="translate(' + x + "," + y + ") scale(" + scale + ')">' +
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

function riverMarkup(y, amplitude) {
  let d = "M 0 " + y.toFixed(1);
  for (let x = 4; x <= 100; x += 8) {
    const wave = y + amplitude * Math.sin(x / 10);
    d += " L " + x + " " + wave.toFixed(1);
  }
  return '<path class="map-deco-river" d="' + d + '"></path>';
}

function emberMarkup(x, y, radius) {
  return '<circle class="map-deco-ember" cx="' + x + '" cy="' + y + '" r="' + radius + '"></circle>';
}

// Zet vaste, decoratieve landschapselementen neer: bomen bij het begin,
// bergen halverwege, één rivier, en gloeiende vonken vlak voor Mordor.
// Dit staat los van de milestone-data en verandert niet mee met de afstand.
function buildTerrainMarkup() {
  let markup = "";

  [0.03, 0.06, 0.1].forEach(function (t, index) {
    const point = pathPosition(t);
    const side = index % 2 === 0 ? -10 : 10;
    markup += treeMarkup(point.x + side, point.y - 2, 0.9);
  });

  [0.38, 0.46].forEach(function (t, index) {
    const point = pathPosition(t);
    const side = index % 2 === 0 ? 12 : -12;
    markup += mountainMarkup(point.x + side, point.y, 1.1);
  });

  const riverPoint = pathPosition(0.58);
  markup += riverMarkup(riverPoint.y, 2.5);

  [0.88, 0.93, 0.97].forEach(function (t, index) {
    const point = pathPosition(t);
    const side = index % 2 === 0 ? 9 : -9;
    markup += emberMarkup(point.x + side, point.y, 0.6);
  });

  return markup;
}

// Bouw de markering voor één milestone. Het "type"-veld uit journey.json
// (major / special / final / normal) bepaalt vorm en grootte.
function buildMilestoneNodeMarkup(milestone, status) {
  const t = milestone.km / TOTAL_DISTANCE;
  const point = pathPosition(t);
  const title = "<title>" + milestone.name + " (" + milestone.km + " km)</title>";

  if (milestone.type === "final") {
    return (
      '<g class="map-icon-doom ' + status + '" transform="translate(' + point.x + "," + point.y + ')">' +
      '<polygon points="-4,4 0,-5 4,4"></polygon>' +
      '<circle class="map-icon-doom-glow" cy="-1" r="1.1"></circle>' +
      title +
      "</g>"
    );
  }

  if (milestone.type === "special") {
    return (
      '<rect class="map-node map-node-special ' + status + '" x="' + (point.x - 1.7) + '" y="' + (point.y - 1.7) +
      '" width="3.4" height="3.4" transform="rotate(45 ' + point.x + " " + point.y + ')">' +
      title +
      "</rect>"
    );
  }

  if (milestone.type === "major") {
    return (
      '<circle class="map-node map-node-major ' + status + '" cx="' + point.x + '" cy="' + point.y + '" r="2.6">' +
      title +
      "</circle>"
    );
  }

  return (
    '<circle class="map-node ' + status + '" cx="' + point.x + '" cy="' + point.y + '" r="1.5">' +
    title +
    "</circle>"
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

  // De voortgang van de wandelaars als getal tussen 0 en 1.
  // Dit is dezelfde verhouding als het percentage, dus de kaart
  // en het percentage lopen altijd exact gelijk op.
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
    '<circle class="map-traveler" cx="' + travelerPoint.x + '" cy="' + travelerPoint.y + '" r="1.6">' +
    "<title>Huidige positie van Frodo &amp; Sam</title>" +
    "</circle>";
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
   Wist alleen de opgeslagen afstand (STORAGE_KEY). journey.json,
   de milestones en alle andere bestanden blijven onaangeroerd.
   ========================================================= */

// Toon de bevestigingsdialoog
resetButton.addEventListener("click", function () {
  resetModal.classList.remove("hidden");
});

// Annuleren: dialoog verbergen, er verandert niets
cancelResetButton.addEventListener("click", function () {
  resetModal.classList.add("hidden");
});

// Bevestigen: alleen totalWalked terugzetten naar 0 en opnieuw opslaan
confirmResetButton.addEventListener("click", function () {
  totalWalked = 0;
  saveDistance();
  updateDisplay();
  resetModal.classList.add("hidden");
});

// We roepen updateDisplay() hier niet meteen aan voor de milestone-onderdelen,
// want journey.json is dan mogelijk nog niet geladen.
// Voor de afstand tonen we wel meteen de opgeslagen waarde:
currentDistanceEl.textContent = totalWalked.toFixed(1);

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
