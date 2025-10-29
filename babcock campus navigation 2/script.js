let map, directionsService, directionsRenderer;
let userLocation = null;
let allLocations = [];
let selectedDestination = null;
let travelMode = null;
let watchId = null;
let route = null;
let currentStepIndex = 0;
let userMarker = null;

// Add this to your existing script.js or navigator.html
function checkPreSelectedCategory() {
    const selectedCategory = localStorage.getItem('selectedCategory');
    if (selectedCategory) {
        // Auto-select the category in dropdown
        const categorySelect = document.getElementById('category-select');
        if (categorySelect) {
            categorySelect.value = selectedCategory;
            // Trigger the filter function to show locations
            filterLocations();
        }
        // Clear the selection after use
        localStorage.removeItem('selectedCategory');
    }
}

// Call this function when the page loads
// Add this to your existing init function or window.onload
document.addEventListener('DOMContentLoaded', function() {
    // Your existing initialization code...
    
    // Check for pre-selected category
    setTimeout(checkPreSelectedCategory, 500); // Small delay to ensure everything is loaded
});


function initMap() {
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: false });

  const defaultCenter = { lat: 6.8935, lng: 3.7101 };

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultCenter,
    zoom: 16,
  });

  directionsRenderer.setMap(map);

  fetch("locations.json")
    .then(res => res.json())
    .then(data => {
      allLocations = data;
      populateDatalist(data);
    });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        userMarker = new google.maps.Marker({
          position: userLocation,
          map,
          title: "You",
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            scaledSize: new google.maps.Size(40, 40)
          }
        });
        map.setCenter(userLocation);
      },
      () => alert("Location access denied.")
    );
  } else {
    alert("Geolocation not supported.");
  }
}

function hideSplash() {
  document.getElementById("splash").style.display = "none";
  document.getElementById("controls").style.display = "block";
}

function populateDatalist(locations) {
  const datalist = document.getElementById("locations");
  datalist.innerHTML = "";
  locations.forEach(loc => {
    const option = document.createElement("option");
    option.value = loc.name;
    datalist.appendChild(option);
  });
}

function filterLocations() {
  const category = document.getElementById("category-select").value;
  const filtered = category === "all" ? allLocations : allLocations.filter(loc => loc.category === category);
  populateDatalist(filtered);
}

function startNavigation() {
  const input = document.getElementById("destination-input").value.trim();
  const match = allLocations.find(loc => loc.name.toLowerCase() === input.toLowerCase());

  if (!match) {
    alert("Please choose a valid location from the list.");
    return;
  }

  selectedDestination = match;
  document.getElementById("mode-selector").classList.remove("hidden");
}

function startDirections(mode) {
  travelMode = mode;
  if (!selectedDestination) return;

  document.getElementById("mode-selector").classList.add("hidden");
  document.getElementById("directions-panel").classList.remove("hidden");
  document.getElementById("end-navigation-btn").style.display = "block";

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
  }

  watchId = navigator.geolocation.watchPosition(
    position => {
      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      if (userMarker) userMarker.setMap(null);
      userMarker = new google.maps.Marker({
        position: userLocation,
        map,
        title: "You",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#0000FF',
          fillOpacity: 1,
          strokeWeight: 1,
          strokeColor: '#ffffff'
        }
      });

      map.panTo(userLocation);
      checkUserProgress();
    },
    error => {
      console.warn("Error watching position:", error);
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
  );

  requestRoute();
}

function requestRoute() {
  const request = {
    origin: userLocation,
    destination: { lat: selectedDestination.lat, lng: selectedDestination.lng },
    travelMode: google.maps.TravelMode[travelMode],
  };

  directionsService.route(request, (result, status) => {
    if (status === "OK") {
      route = result;
      currentStepIndex = 0;
      directionsRenderer.setDirections(result);
      updateInstruction();
    } else {
      alert("Could not find a route.");
    }
  });
}

function checkUserProgress() {
  if (!route) return;

  const leg = route.routes[0].legs[0];
  if (currentStepIndex >= leg.steps.length) {
    updateInstruction("You have arrived at your destination.");
    endNavigation();
    return;
  }

  const step = leg.steps[currentStepIndex];
  const stepEnd = step.end_location;

  const distanceToStepEnd = haversineDistance(userLocation, {
    lat: stepEnd.lat(),
    lng: stepEnd.lng()
  });

  if (distanceToStepEnd < 0.02) {
    currentStepIndex++;
    if (currentStepIndex < leg.steps.length) {
      updateInstruction();
    } else {
      updateInstruction("You have arrived at your destination.");
      endNavigation();
    }
  } else {
    updateInstruction();
  }
}

function updateInstruction(text) {
  const leg = route?.routes?.[0]?.legs?.[0];
  if (!leg) return;

  if (!text) {
    const step = leg.steps[currentStepIndex];
    document.getElementById("current-instruction").innerHTML = step.instructions;
    document.getElementById("remaining-distance").innerText = "Distance remaining: " + leg.distance.text;
    document.getElementById("remaining-duration").innerText = "Estimated time: " + leg.duration.text;
  } else {
    document.getElementById("current-instruction").innerText = text;
    document.getElementById("remaining-distance").innerText = "";
    document.getElementById("remaining-duration").innerText = "";
  }
}

function haversineDistance(coord1, coord2) {
  function toRad(x) {
    return x * Math.PI / 180;
  }

  const R = 6371;
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLon = toRad(coord2.lng - coord1.lng);
  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}


function endNavigation() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  route = null;
  currentStepIndex = 0;
  selectedDestination = null;
  travelMode = null;

  directionsRenderer.setDirections({ routes: [] });
  document.getElementById("directions-panel").classList.add("hidden");
  document.getElementById("mode-selector").classList.add("hidden");
  document.getElementById("destination-input").value = "";
  document.getElementById("current-instruction").innerText = "";
  document.getElementById("remaining-distance").innerText = "";
  document.getElementById("remaining-duration").innerText = "";
  document.getElementById("end-navigation-btn").style.display = "none";

  alert("Navigation ended.");
}
