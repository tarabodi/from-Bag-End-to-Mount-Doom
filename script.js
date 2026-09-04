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

// Bouw de lijst met alle milestones opnieuw op, met het juiste symbool
// en een status-klasse (done / current / future) voor de styling.
function renderMilestoneList() {
  milestoneListEl.innerHTML = "";

  const current = getCurrentMilestone();

  milestones.forEach(function (milestone) {
    const li = document.createElement("li");

    let symbol;
    let statusClass;

    if (milestone.id === current.id) {
      symbol = "●";
      statusClass = "current";
    } else if (milestone.km <= totalWalked) {
      symbol = "✓";
      statusClass = "done";
    } else {
      symbol = "○";
      statusClass = "future";
    }

    li.className = statusClass;
    li.innerHTML =
      '<span class="symbol">' + symbol + "</span>" +
      "<span>" + milestone.name + " (" + milestone.km + " km)</span>";

    milestoneListEl.appendChild(li);
  });
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
