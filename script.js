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

// Hoeveel kolommen de kaart gebruikt voor het slingerende pad.
// 42 milestones / 6 kolommen = 7 nette rijen.
const MAP_COLUMNS = 6;

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

// Bereken voor elke milestone een (x, y)-positie op een slingerend pad,
// puur op basis van hun volgorde in journey.json (geen tweede databron).
function computeMilestonePositions() {
  const cols = MAP_COLUMNS;
  const rows = Math.ceil(milestones.length / cols);

  const marginX = 10;
  const marginY = 10;
  const usableWidth = 100 - marginX * 2;
  const colSpacing = cols > 1 ? usableWidth / (cols - 1) : 0;
  const rowSpacing = 12;
  const viewBoxHeight = marginY * 2 + (rows - 1) * rowSpacing;

  const positions = milestones.map(function (milestone, index) {
    const row = Math.floor(index / cols);
    const colInRow = index % cols;
    const isReversedRow = row % 2 === 1; // slingerend: om en om heen en terug
    const col = isReversedRow ? (cols - 1 - colInRow) : colInRow;

    return {
      milestone: milestone,
      x: marginX + col * colSpacing,
      y: marginY + row * rowSpacing
    };
  });

  return { positions: positions, viewBoxHeight: viewBoxHeight };
}

// Zet een lijst van {x, y}-punten om naar een SVG "points"-tekenreeks.
function toPointsString(points) {
  return points
    .map(function (point) {
      return point.x + "," + point.y;
    })
    .join(" ");
}

// Teken de kaart opnieuw: het pad, de milestone-stippen en de
// exacte positie van Frodo & Sam, gebaseerd op de huidige afstand.
function renderMap() {
  if (!journeyMapEl || milestones.length === 0) {
    return;
  }

  const layout = computeMilestonePositions();
  const positions = layout.positions;

  journeyMapEl.setAttribute("viewBox", "0 0 100 " + layout.viewBoxHeight);

  const current = getCurrentMilestone();
  const next = getNextMilestone();

  const currentIndex = milestones.findIndex(function (m) {
    return m.id === current.id;
  });
  const nextIndex = next
    ? milestones.findIndex(function (m) {
        return m.id === next.id;
      })
    : -1;

  // De precieze positie van de wandelaars: geïnterpoleerd tussen de
  // huidige en de volgende milestone, op basis van de gelopen km.
  let travelerPoint = positions[currentIndex];

  if (next) {
    const from = positions[currentIndex];
    const to = positions[nextIndex];
    const segmentKm = next.km - current.km;
    const rawProgress = segmentKm > 0 ? (totalWalked - current.km) / segmentKm : 0;
    const progress = Math.max(0, Math.min(1, rawProgress));

    travelerPoint = {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress
    };
  }

  const traveledPoints = positions.slice(0, currentIndex + 1).concat([travelerPoint]);
  const remainingPoints = next
    ? [travelerPoint].concat(positions.slice(nextIndex))
    : [];

  let nodesMarkup = "";
  positions.forEach(function (point) {
    const status = getMilestoneStatus(point.milestone, current);
    nodesMarkup +=
      '<circle class="map-node ' + status + '" cx="' + point.x + '" cy="' + point.y + '" r="1.8">' +
      "<title>" + point.milestone.name + " (" + point.milestone.km + " km)</title>" +
      "</circle>";
  });

  const startPoint = positions[0];
  const endPoint = positions[positions.length - 1];

  journeyMapEl.innerHTML =
    (remainingPoints.length
      ? '<polyline class="map-path-remaining" points="' + toPointsString(remainingPoints) + '"></polyline>'
      : "") +
    '<polyline class="map-path-done" points="' + toPointsString(traveledPoints) + '"></polyline>' +
    '<g class="map-icon-shire" transform="translate(' + startPoint.x + "," + startPoint.y + ')">' +
    '<circle r="2.6"></circle>' +
    "</g>" +
    '<g class="map-icon-doom" transform="translate(' + endPoint.x + "," + endPoint.y + ')">' +
    '<polygon points="-3,3 0,-4 3,3"></polygon>' +
    '<circle class="map-icon-doom-glow" cy="-1" r="0.9"></circle>' +
    "</g>" +
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
