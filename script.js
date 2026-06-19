/* script.js - Pure Weather Station Offline-first JS for ClearSky Weather App */

// --- Base Bookmarked Locations Dataset ---
const DEFAULT_LOCATIONS = [
  { id: "stockholm", name: "Stockholm", region: "Stockholm County", country: "Sweden", latitude: 59.3293, longitude: 18.0686 },
  { id: "sf", name: "San Francisco", region: "California", country: "United States", latitude: 37.7749, longitude: -122.4194 },
  { id: "london", name: "London", region: "Greater London", country: "United Kingdom", latitude: 51.5074, longitude: -0.1278 },
  { id: "tokyo", name: "Tokyo", region: "Tokyo", country: "Japan", latitude: 35.6762, longitude: 139.6503 }
];

// --- Persistent Application States ---
let savedLocations = JSON.parse(localStorage.getItem("clearsky_cities")) || [...DEFAULT_LOCATIONS];
let activeLocation = JSON.parse(localStorage.getItem("clearsky_active_city_id")) || savedLocations[0];
let activeTab = "home";
let forecastView = "hourly";
let activeDailyExpandedIndex = 0;

let currentUnit = localStorage.getItem("clearsky_unit") || "C"; // C or F
let currentTheme = localStorage.getItem("clearsky_theme") || "dark"; // default dark
let configAlerts = JSON.parse(localStorage.getItem("clearsky_alerts_severe")) ?? true;
let configBriefing = JSON.parse(localStorage.getItem("clearsky_alerts_brief")) ?? false;
let isProUnlocked = JSON.parse(localStorage.getItem("clearsky_pro")) ?? false;

let travelStartId = localStorage.getItem("clearsky_travel_start_id") || "sf";
let travelEndId = localStorage.getItem("clearsky_travel_end_id") || "london";

// active meteorology fetch cache
let weatherData = null;
let travelStartWeather = null;
let travelEndWeather = null;

// Radar timer
let radarAnimId = null;

// --- SVGIcons Dictionary ---
const SVGIcons = {
  sunny: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="weather-vector-svg animate-spin" style="animation-duration: 20s;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  "sunny-cloudy": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="weather-vector-svg"><path d="M12 2v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M1 12h2"/><path d="M18.36 4.22l-1.42 1.42"/><path d="M22 10.5a5.5 5.5 0 0 0-5.5-5.5h-.5a7.5 7.5 0 0 0-14 3.5c0 .34.02.68.07 1a5 5 0 0 0 .93 9.49h13a5.5 5.5 0 0 0 5-3.49A5.5 5.5 0 0 0 22 10.5z"/></svg>`,
  cloudy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="weather-vector-svg"><path d="M17.5 19A5.5 5.5 0 0 0 22 13.5a5.5 5.5 0 0 0-5.5-5.5H16a7.5 7.5 0 0 0-14 3.5c0 .34.02.68.07 1A5 5 0 0 0 3 22h13a5.5 5.5 0 0 0 1.5-3z"/></svg>`,
  drizzle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="weather-vector-svg"><line x1="8" y1="19" x2="8" y2="21"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="16" y1="19" x2="16" y2="21"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/></svg>`,
  rainy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="weather-vector-svg"><path d="M16 13a4 4 0 0 0-8 0"/><path d="M12 5v14"/><path d="M12 19l-3-3"/><path d="M12 19l3-3"/><line x1="8" y1="19" x2="8.01" y2="19"/><line x1="16" y1="19" x2="16.01" y2="19"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/></svg>`,
  stormy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="weather-vector-svg"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 8.58"/><path d="M13 11l-4 6h3v5l4-6h-3z"/></svg>`,
  snow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="weather-vector-svg"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="16" y1="16" x2="16.01" y2="16"/></svg>`,
  wind: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>`,
  humidity: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z"/></svg>`,
  feels: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`,
  "chevron-down": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  crown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/></svg>`
};

// --- WMO weather code dictionary interpreter ---
function mapWmoToCondition(code) {
  if (code === 0) return { code, label: "Clear Sky", type: "sunny" };
  if ([1, 2, 3].includes(code)) {
    const label = code === 1 ? "Mainly Clear" : code === 2 ? "Partly Cloudy" : "Overcast";
    return { code, label, type: "sunny-cloudy" };
  }
  if ([45, 48].includes(code)) return { code, label: "Foggy", type: "cloudy" };
  if ([51, 53, 55, 56, 57].includes(code)) return { code, label: "Drizzle", type: "drizzle" };
  if ([61, 63, 65, 80, 81, 82].includes(code)) return { code, label: "Rainy", type: "rainy" };
  if ([66, 67].includes(code)) return { code, label: "Freezing Rain", type: "rainy" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { code, label: "Snow", type: "snow" };
  if ([95, 96, 99].includes(code)) return { code, label: "Thunderstorm", type: "stormy" };
  return { code, label: "Partly Cloudy", type: "sunny-cloudy" };
}

// --- Dynamic Temperature Translators ---
function formatTemp(celsius) {
  if (currentUnit === "F") {
    return `${Math.round((celsius * 9) / 5 + 32)}°F`;
  }
  return `${celsius}°C`;
}

function formatTempShort(celsius) {
  if (currentUnit === "F") {
    return `${Math.round((celsius * 9) / 5 + 32)}°`;
  }
  return `${celsius}°`;
}

// --- Live Clock Update Ticker ---
function updateRealtimeClock() {
  const clockEl = document.getElementById("iphone-time");
  if (!clockEl) return;
  const now = new Date();
  let hrs = now.getHours();
  let mins = now.getMinutes();
  const ampm = hrs >= 12 ? "PM" : "AM";
  hrs = hrs % 12 || 12;
  mins = mins < 10 ? "0" + mins : mins;
  clockEl.textContent = `${hrs}:${mins} ${ampm}`;
}

// --- Tab Switching Navigation ---
function switchTab(tabId) {
  activeTab = tabId;

  document.querySelectorAll(".tab-content").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));

  const targetTab = document.getElementById(`tab-screen-${tabId}`);
  const targetNavLink = document.getElementById(`nav-tab-${tabId}`);

  if (targetTab) targetTab.classList.add("active");
  if (targetNavLink) targetNavLink.classList.add("active");

  const container = document.getElementById("app-content");
  if (container) container.scrollTop = 0;

  // Reactively fetch advisories weather if tips tab clicked
  if (tabId === "tips") {
    fetchTravelRouteData();
  } else if (tabId === "map") {
    initializeSouthAfricanMap();
  }
}

function setForecastView(view) {
  forecastView = view;

  const btnHourly = document.getElementById("forecast-toggle-hourly");
  const btnDaily = document.getElementById("forecast-toggle-daily");
  const subviewHourly = document.getElementById("forecast-hourly-subview");
  const subviewDaily = document.getElementById("forecast-daily-subview");

  if (view === "hourly") {
    if (btnHourly) btnHourly.classList.add("active");
    if (btnDaily) btnDaily.classList.remove("active");
    if (subviewHourly) subviewHourly.classList.add("show");
    if (subviewDaily) subviewDaily.classList.remove("show");
  } else {
    if (btnDaily) btnDaily.classList.add("active");
    if (btnHourly) btnHourly.classList.remove("active");
    if (subviewDaily) subviewDaily.classList.add("show");
    if (subviewHourly) subviewHourly.classList.remove("show");
  }
  renderActiveLocationData();
}

// --- Open-Meteo API Core Fetching Engine ---
async function fetchFullForecast(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,uv_index_max,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant&timezone=auto`;
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Meteo Station API error: " + res.statusText);
  }
  const data = await res.json();
  const timezone = data.timezone || "Europe/London";

  // format current stats
  const currentWmoCode = data.current.weather_code;
  const currentCondition = mapWmoToCondition(currentWmoCode);
  const nowTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const current = {
    tempC: Math.round(data.current.temperature_2m),
    condition: currentCondition.label,
    type: currentCondition.type,
    highC: Math.round(data.daily.temperature_2m_max[0] || data.current.temperature_2m + 4),
    lowC: Math.round(data.daily.temperature_2m_min[0] || data.current.temperature_2m - 4),
    humidity: data.current.relative_humidity_2m,
    windKmh: Math.round(data.current.wind_speed_10m),
    windDir: Math.round(data.current.wind_direction_10m),
    feelsLikeC: Math.round(data.current.apparent_temperature),
    uvIndex: Math.round(data.daily.uv_index_max[0] || 2),
    updatedStr: "Updated Live &bull; " + nowTime,
  };

  // forecast timeline segments (8 Hours)
  const hourly = [];
  for (let i = 0; i < 24; i++) {
    const rawTime = new Date(data.hourly.time[i]);
    const hrLabel = rawTime.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
    hourly.push({
      time: hrLabel,
      tempC: Math.round(data.hourly.temperature_2m[i]),
      condition: mapWmoToCondition(data.hourly.weather_code[i]),
      rain: (data.hourly.precipitation_probability[i] || 0) + "%"
    });
  }

  // extended week daily slots
  const daysName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const extended = [];
  for (let d = 0; d < 7; d++) {
    const dateObj = new Date(data.daily.time[d]);
    const dayName = d === 0 ? "Today" : daysName[dateObj.getDay()];
    const dateFormatted = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const precipProb = data.daily.precipitation_probability_max[d] || 0;
    const code = data.daily.weather_code[d];
    const itemCond = mapWmoToCondition(code);

    let desc = "Beautiful stable atmosphere profiles cleared for outdoor schedules.";
    if (precipProb > 40) {
      desc = `Frequent rain drops estimated near ${precipProb}% with wet sidewalks. Pack appropriate folders.`;
    } else if (data.daily.temperature_2m_max[d] > 26) {
      desc = `High ultraviolet parameters measured at ${data.daily.uv_index_max[d]}. Sun protections recommended.`;
    }

    // compile micro hours inside daily
    const innerHours = [];
    const targetSteps = [9, 12, 15, 18];
    targetSteps.forEach(st => {
      const idx = d * 24 + st;
      innerHours.push({
        time: `${st}:00`,
        tempC: Math.round(data.hourly.temperature_2m[idx] || data.current.temperature_2m),
        condition: mapWmoToCondition(data.hourly.weather_code[idx] || 0),
        rain: (data.hourly.precipitation_probability[idx] || 0) + "%"
      });
    });

    extended.push({
      day: dayName,
      date: dateFormatted,
      condition: itemCond.label,
      type: itemCond.type,
      highC: Math.round(data.daily.temperature_2m_max[d]),
      lowC: Math.round(data.daily.temperature_2m_min[d]),
      desc,
      humidity: data.current.relative_humidity_2m,
      windKmh: Math.round(data.daily.wind_speed_10m_max[d] || 10),
      windDir: "N",
      uvIndex: Math.round(data.daily.uv_index_max[d] || 3),
      precipProb,
      hourly: innerHours
    });
  }

  return { current, hourly, extended, timezone };
}

// --- Main App Loader / Synchronizer ---
async function synchronizeLocationMeteo() {
  try {
    const spinner = document.querySelector("#home-refresh-trigger svg");
    if (spinner) spinner.classList.add("spinner-icon");

    const data = await fetchFullForecast(activeLocation.latitude, activeLocation.longitude);
    weatherData = data;

    renderActiveLocationData();
    displayToast(`Synchronized weather statistics for ${activeLocation.name}!`);

    if (spinner) spinner.classList.remove("spinner-icon");
  } catch (error) {
    console.error(error);
    displayToast("Could not retrieve forecast parameters. Check your connection.", false);
  }
}

// --- Render Core Widgets Natively ---
function renderActiveLocationData() {
  if (!weatherData) return;

  const current = weatherData.current;

  // 1. Overview HomeScreen bindings
  const homeLoc = document.getElementById("home-loc-name");
  const homeUpdate = document.getElementById("home-loc-update");
  const homeSky = document.getElementById("home-sky-illustration");
  const homeTemp = document.getElementById("home-current-temp");
  const homeCond = document.getElementById("home-current-condition");
  const homeHighLow = document.getElementById("home-current-highlow");
  const statHumid = document.getElementById("home-stat-humidity");
  const statWind = document.getElementById("home-stat-wind");
  const statFeels = document.getElementById("home-stat-feelslike");
  const homeTip = document.getElementById("home-tip-text");

  if (homeLoc) homeLoc.textContent = `${activeLocation.name}, ${activeLocation.region || activeLocation.country}`;
  if (homeUpdate) homeUpdate.innerHTML = current.updatedStr;
  if (homeSky) homeSky.innerHTML = SVGIcons[current.type] || SVGIcons["sunny"];
  if (homeTemp) homeTemp.textContent = formatTempShort(current.tempC).replace("°", "");
  if (homeCond) homeCond.textContent = current.condition;
  if (homeHighLow) homeHighLow.textContent = `H: ${formatTempShort(current.highC)} L: ${formatTempShort(current.lowC)}`;
  if (statHumid) statHumid.textContent = `${current.humidity}%`;
  if (statWind) statWind.textContent = `${current.windKmh} km/h`;
  if (statFeels) statFeels.textContent = formatTempShort(current.feelsLikeC);
  if (homeTip) homeTip.textContent = weatherData.extended[0].desc;

  // 2. Timeline Horizontal layout inside forecast
  const sumLabel = document.getElementById("hourly-timeline-sum-text");
  const timelineScroll = document.getElementById("hourly-scroll-container");
  
  if (sumLabel) sumLabel.textContent = `Overall atmosphere shows stable indices. Precipitation trends peak at ${weatherData.extended[0].precipProb}%.`;
  
  if (timelineScroll) {
    let scrollHtml = "";
    weatherData.hourly.slice(0, 8).forEach((h, index) => {
      const isNow = index === 0 ? "now" : "";
      scrollHtml += `
        <div class="timeline-card ${isNow}">
          <span class="timeline-time">${isNow ? "NOW" : h.time}</span>
          <div class="timeline-icon">${SVGIcons[h.condition.type] || SVGIcons["sunny"]}</div>
          <span class="timeline-temp">${formatTempShort(h.tempC)}</span>
          <span class="timeline-rain">${h.rain}</span>
        </div>
      `;
    });
    timelineScroll.innerHTML = scrollHtml;
  }

  // 3. Overnight vertical slot list (Forecast)
  const verticalBox = document.getElementById("hourly-vertical-slots-list");
  if (verticalBox) {
    let verticalHtml = "";
    weatherData.hourly.slice(8, 14).forEach(h => {
      verticalHtml += `
        <div class="list-item-row">
          <div class="slot-time-section">
            <span class="slot-time">${h.time}</span>
            <span class="slot-label">FORECAST PROG</span>
          </div>
          <div class="slot-weather">
            <div class="slot-icon">${SVGIcons[h.condition.type] || SVGIcons["sunny"]}</div>
            <span class="slot-condition">${h.condition.label}</span>
          </div>
          <div class="slot-temp-rain">
            <span class="slot-temp">${formatTempShort(h.tempC)}</span>
            <span class="slot-rain">${h.rain} Rain</span>
          </div>
        </div>
      `;
    });
    verticalBox.innerHTML = verticalHtml;
  }

  // 4. Extended Accordion listings inside Forecast
  const extendedLoop = document.getElementById("extended-daily-loop");
  const dailySubtitle = document.getElementById("extended-forecast-loc-subtitle");
  
  if (dailySubtitle) dailySubtitle.textContent = `Detailed 7-day predictions from stations in ${activeLocation.name}`;

  if (extendedLoop) {
    let loopHtml = "";
    const highs = weatherData.extended.map(d => d.highC);
    const lows = weatherData.extended.map(d => d.lowC);
    const absMax = Math.max(...highs);
    const absMin = Math.min(...lows);
    const absDelta = absMax - absMin || 1;

    weatherData.extended.forEach((d, idx) => {
      const isExpanded = idx === activeDailyExpandedIndex;
      const sliderStartPercent = ((d.lowC - absMin) / absDelta) * 100;
      const sliderSpanWidth = Math.max(10, ((d.highC - absMin) / absDelta) * 100 - sliderStartPercent);

      let innerHoursHtml = "";
      d.hourly.forEach(st => {
        innerHoursHtml += `
          <div class="day-hour-grid-item">
            <span class="grid-item-time">${st.time}</span>
            <div class="grid-item-icon">${SVGIcons[st.condition.type] || SVGIcons["sunny"]}</div>
            <span class="grid-item-temp">${formatTempShort(st.tempC)}</span>
            <span class="grid-item-rain">${st.rain}</span>
          </div>
        `;
      });

      loopHtml += `
        <div class="day-row-card ${isExpanded ? "expanded" : ""}">
          <div class="day-header-interactive" onclick="toggleDailyAccordion(${idx})">
            <div class="day-name-block">
              <span class="day-name">${d.day}</span>
              <span class="day-date">${d.date}</span>
            </div>
            <div class="day-icon-condition">
              <div class="day-row-icon">${SVGIcons[d.type] || SVGIcons["sunny"]}</div>
              <span class="day-condition-label">${d.condition}</span>
            </div>
            <div class="day-temp-visual">
              <span class="temp-num-lbl low">${formatTempShort(d.lowC).replace("°", "")}</span>
              <div class="temp-slider-track">
                <div class="temp-slider-span-bar" style="left: ${sliderStartPercent}%; width: ${sliderSpanWidth}%;"></div>
              </div>
              <span class="temp-num-lbl high">${formatTempShort(d.highC).replace("°", "")}</span>
            </div>
            <div class="day-accordion-chevron">${SVGIcons["chevron-down"] || ""}</div>
          </div>

          <div class="day-details-content">
            <p class="day-details-desc">"${d.desc}"</p>
            <div class="details-hours-grid">
              ${innerHoursHtml}
            </div>
            <div class="details-specs-row">
              <span class="spec-pills">Humidity: ${d.humidity}%</span>
              <span class="spec-pills">Wind: ${d.windKmh} km/h</span>
              <span class="spec-pills">UV index: ${d.uvIndex}</span>
            </div>
          </div>
        </div>
      `;
    });
    extendedLoop.innerHTML = loopHtml;
  }

  // 5. Update settings selectors counts
  const savedCountBadge = document.getElementById("val-saved-cities-count");
  if (savedCountBadge) savedCountBadge.textContent = `${savedLocations.length} Cities `;

  // premium titles
  const userPremiumTitleLabel = document.getElementById("pro-card-premium-label");
  if (userPremiumTitleLabel) {
    userPremiumTitleLabel.innerHTML = isProUnlocked
      ? "ClearSky Pro Unlocked  👑"
      : "ClearSky Pro Access";
  }
}

// --- Dynamic Travel Advisories Calculations ---
async function fetchTravelRouteData() {
  const startSelect = document.getElementById("tips-start-location-select");
  const endSelect = document.getElementById("tips-end-location-select");

  if (!startSelect || !endSelect) return;

  // populate select overlays
  let startOpts = "";
  savedLocations.forEach(c => {
    startOpts += `<option value="${c.id}" ${c.id === travelStartId ? "selected" : ""}>${c.name}</option>`;
  });
  startSelect.innerHTML = startOpts;

  let endOpts = "";
  savedLocations.forEach(c => {
    endOpts += `<option value="${c.id}" ${c.id === travelEndId ? "selected" : ""}>${c.name}</option>`;
  });
  endSelect.innerHTML = endOpts;

  const startCity = savedLocations.find(l => l.id === travelStartId) || savedLocations[0];
  const endCity = savedLocations.find(l => l.id === travelEndId) || savedLocations[1] || savedLocations[0];

  try {
    const [startData, endData] = await Promise.all([
      fetchFullForecast(startCity.latitude, startCity.longitude),
      fetchFullForecast(endCity.latitude, endCity.longitude)
    ]);

    travelStartWeather = startData.current;
    travelEndWeather = endData.current;

    const summaryTitle = document.getElementById("tips-active-location-title");
    const summaryWeather = document.getElementById("tips-active-weather-desc");
    const summaryStartIcon = document.getElementById("tips-start-weather-icon");
    const summaryEndIcon = document.getElementById("tips-end-weather-icon");

    if (summaryTitle) summaryTitle.textContent = `${startCity.name} to ${endCity.name}`;
    if (summaryWeather) summaryWeather.innerHTML = `${startData.current.condition} (${formatTempShort(startData.current.tempC)}) ➔ ${endData.current.condition} (${formatTempShort(endData.current.tempC)})`;
    
    if (summaryStartIcon) summaryStartIcon.innerHTML = SVGIcons[startData.current.type] || SVGIcons["sunny"];
    if (summaryEndIcon) summaryEndIcon.innerHTML = SVGIcons[endData.current.type] || SVGIcons["sunny"];

    // dynamic guidelines calculations
    let baseComfort = 96;
    const destType = endData.current.type;
    const tempDiff = endData.current.tempC - startData.current.tempC;
    const absTempDiff = Math.abs(tempDiff);

    if (destType === "sunny") baseComfort = 98;
    else if (destType === "sunny-cloudy") baseComfort = 92;
    else if (destType === "cloudy") baseComfort = 82;
    else if (destType === "drizzle") baseComfort = 70;
    else if (destType === "rainy") baseComfort = 54;
    else if (destType === "stormy") baseComfort = 30;
    else if (destType === "snow") baseComfort = 45;

    let packing = "";
    let transit = "";
    let leisure = "";

    // 1. Pack guidance
    if (absTempDiff >= 6) {
      if (tempDiff < 0) {
        packing = `Significant temperature drop of ${absTempDiff}°C detected! We recommend thermal layered vests, thick denim jackets, or wool coats to withstand the colder climate at destination. `;
      } else {
        packing = `Significant temperature rise of ${absTempDiff}°C detected! We recommend lightweight breathable clothes, sun protective glasses, and short items. `;
      }
    } else {
      packing = `Consistent temperature profiles (variance of just ${absTempDiff}°C). Comfort-wear, standard street layout and a light breeze layering will do. `;
    }

    if (["rainy", "drizzle"].includes(destType)) {
      packing += "Active rain parameters suggest keeping a premium utility umbrella and a waterproof outer trench active.";
    }

    // 2. Transit guidance
    if (["sunny", "sunny-cloudy"].includes(destType)) {
      transit = "PRISTINE TRAVEL CLEARANCE - Dry surface lanes, high visibility parameters, and mild crosswinds suggest zero meteorology delays.";
    } else if (destType === "cloudy") {
      transit = "DUE CAUTION IN TRANSIT - Persistent blanket clouds and morning fog index require standard caution markers on bridges, but airport patterns operate open.";
    } else {
      transit = "INCLIMENT COMMUTE ADVISORY - Slick road lanes with minor aquaplaning warnings. Drive with expanded vehicle spacing parameters. Minor holding cycles reported at airports.";
    }

    // 3. Leisure guidance
    if (["sunny", "sunny-cloudy"].includes(destType)) {
      leisure = "Peak window for outdoor sightseeing! Perfect elements for landscape coordinates, open sightseeing street buses, coastal walks, and botanical garden dining.";
    } else {
      leisure = "Perfect weather window for local indoor experiences. Highly suggest classical art museums, indoor cathedral arches, shopping plazas, or covered coffee hubs.";
    }

    document.getElementById("tips-pack-suggestions").textContent = packing;
    document.getElementById("tips-transit-suggestions").textContent = transit;
    document.getElementById("tips-leisure-suggestions").textContent = leisure;

    // Comfort score circle
    const finalScore = Math.max(12, Math.min(100, baseComfort));
    document.getElementById("tips-comfort-score-value").textContent = finalScore;

    const suitabilityBadge = document.getElementById("tips-suitability-badge");
    const suitabilityDesc = document.getElementById("tips-suitability-description");

    if (suitabilityBadge && suitabilityDesc) {
      suitabilityBadge.className = "suitability-pill"; // reset
      if (finalScore >= 85) {
        suitabilityBadge.classList.add("val-green");
        suitabilityBadge.textContent = "Highly Suitable";
        suitabilityDesc.textContent = `Outstanding comfort curves (${finalScore}% comfort indicator). Fully cleared corridors await you!`;
      } else if (finalScore >= 60) {
        suitabilityBadge.classList.add("val-yellow");
        suitabilityBadge.textContent = "Moderately Optimal";
        suitabilityDesc.textContent = `Intermediate atmosphere indicators (${finalScore}% comfort score). Stay ready with lightweight layering.`;
      } else {
        suitabilityBadge.classList.add("val-red");
        suitabilityBadge.textContent = "Caution Advisory";
        suitabilityDesc.textContent = `Vigorous seasonal drops reported (${finalScore}% comfort score). Limit outdoor commutes; verify flight listings.`;
      }
    }

  } catch (error) {
    console.error(error);
  }
}

function handleTravelRouteUpdate() {
  const startSelect = document.getElementById("tips-start-location-select");
  const endSelect = document.getElementById("tips-end-location-select");
  if (startSelect && endSelect) {
    travelStartId = startSelect.value;
    travelEndId = endSelect.value;
    localStorage.setItem("clearsky_travel_start_id", travelStartId);
    localStorage.setItem("clearsky_travel_end_id", travelEndId);
    fetchTravelRouteData();
  }
}

// --- Accurate Reverse OS Geocoding ---
function detectGoogleGPSLocation() {
  if (!navigator.geolocation) {
    displayToast("Geolocation is not supported by your browser.", false);
    return;
  }
  const gpsBtn = document.getElementById("tips-gps-btn");
  if (gpsBtn) {
    gpsBtn.disabled = true;
    gpsBtn.textContent = "Satellites...";
    gpsBtn.classList.add("loading");
  }

  displayToast("Pinging satellites for location parameters...");

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const gpsCityId = `gps-${lat.toFixed(2)}-${lon.toFixed(2)}`;

      try {
        // Reverse Geocoding with OpenStreetMap Nominatim
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
          headers: { "Accept-Language": "en", "User-Agent": "ClearSkyApp/1.0" }
        });
        const data = await res.json();
        let name = "My GPS Location";
        let sub = "Sensor Coordinates";
        
        if (data && data.address) {
          name = data.address.city || data.address.town || data.address.village || data.address.suburb || "GPS Location";
          sub = data.address.county || data.address.state || "Active System";
        }

        const gpsLocObj = {
          id: gpsCityId,
          name: name,
          region: sub,
          country: "Device Geolocation",
          latitude: lat,
          longitude: lon
        };

        // check duplication
        if (!savedLocations.some(l => l.id === gpsCityId)) {
          savedLocations.unshift(gpsLocObj);
          localStorage.setItem("clearsky_cities", JSON.stringify(savedLocations));
        }

        activeLocation = gpsLocObj;
        localStorage.setItem("clearsky_active_city_id", JSON.stringify(gpsLocObj));
        travelStartId = gpsCityId;
        localStorage.setItem("clearsky_travel_start_id", travelStartId);

        await synchronizeLocationMeteo();

        if (gpsBtn) {
          gpsBtn.disabled = false;
          gpsBtn.innerHTML = `GPS`;
          gpsBtn.classList.remove("loading");
        }
        displayToast(`📍 Location found! Synced active metrics to ${name}`);

      } catch (e) {
        console.error(e);
        if (gpsBtn) {
          gpsBtn.disabled = false;
          gpsBtn.innerHTML = `GPS`;
          gpsBtn.classList.remove("loading");
        }
      }
    },
    (error) => {
      if (gpsBtn) {
        gpsBtn.disabled = false;
        gpsBtn.innerHTML = `GPS`;
        gpsBtn.classList.remove("loading");
      }
      displayToast("Failed to fetch coordinates. Ensure GPS is enabled.", false);
    },
    { timeout: 7000 }
  );
}

// Global placeholder for search results
let currentSearchResults = [];

// --- Autocomplete search algorithm ---
async function handleSearchAutocomplete(event) {
  const qStr = event.target.value.trim();
  const resBox = document.getElementById("search-results-overlay-container");
  if (!resBox) return;

  if (qStr.length < 3) {
    resBox.style.display = "none";
    currentSearchResults = [];
    return;
  }

  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(qStr)}&count=6&language=en&format=json`);
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      resBox.style.display = "none";
      currentSearchResults = [];
      return;
    }

    currentSearchResults = data.results;
    let completionHtml = "";
    data.results.forEach((city, idx) => {
      completionHtml += `
        <div class="city-select-row" onclick="selectSearchedCityByIndex(${idx})">
          <div class="city-name-left">
            <span class="city-active-dot"></span>
            <div class="city-text">
              <span class="city-label-line-main">${city.name}, ${city.admin1 || city.country || ""}</span>
              <span class="city-label-line-desc">${city.country || ""} &bull; Latitude ${Number(city.latitude).toFixed(2)}</span>
            </div>
          </div>
        </div>
      `;
    });
    resBox.innerHTML = completionHtml;
    resBox.style.display = "flex";
  } catch (error) {
    console.error(error);
  }
}

function selectSearchedCity(cityObj) {
  if (!cityObj) return;
  const searchCityId = `city-${cityObj.id}`;
  const duplicate = savedLocations.find(l => Number(l.latitude).toFixed(2) === Number(cityObj.latitude).toFixed(2));
  
  const formattedObj = {
    id: duplicate ? duplicate.id : searchCityId,
    name: cityObj.name,
    region: cityObj.admin1 || cityObj.country,
    country: cityObj.country,
    latitude: cityObj.latitude,
    longitude: cityObj.longitude
  };

  if (!duplicate) {
    savedLocations.push(formattedObj);
    localStorage.setItem("clearsky_cities", JSON.stringify(savedLocations));
  }

  activeLocation = formattedObj;
  localStorage.setItem("clearsky_active_city_id", JSON.stringify(formattedObj));

  // Clear inputs
  const inputEl = document.getElementById("location-search-input");
  if (inputEl) inputEl.value = "";
  const resBox = document.getElementById("search-results-overlay-container");
  if (resBox) resBox.style.display = "none";

  closeLocationManager();
  synchronizeLocationMeteo();
}

function selectSearchedCityByIndex(index) {
  if (currentSearchResults && currentSearchResults[index]) {
    selectSearchedCity(currentSearchResults[index]);
  }
}

async function handleSearchKeyDown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    await submitSearchOnline();
  }
}

async function submitSearchOnline() {
  const inputEl = document.getElementById("location-search-input");
  if (!inputEl) return;
  const qStr = inputEl.value.trim();
  if (qStr.length < 3) {
    displayToast("Please enter at least 3 characters to search", false);
    return;
  }

  try {
    displayToast(`Searching online for "${qStr}"...`);
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(qStr)}&count=5&language=en&format=json`);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      selectSearchedCity(data.results[0]);
      displayToast(`📍 Coordinates verified! Selected ${data.results[0].name}.`);
    } else {
      displayToast(`Could not find coordinates for "${qStr}" online. Try another place.`, false);
    }
  } catch (error) {
    console.error(error);
    displayToast("Network error. Searching online failed.", false);
  }
}

function fastPickCityOption(cityName) {
  const inputEl = document.getElementById("location-search-input");
  if (inputEl) {
    inputEl.value = cityName;
    const fakeEvent = { target: { value: cityName } };
    handleSearchAutocomplete(fakeEvent);
  }
}

// --- Accordion toggling ---
function toggleDailyAccordion(index) {
  activeDailyExpandedIndex = activeDailyExpandedIndex === index ? -1 : index;
  renderActiveLocationData();
}

// --- Toast alert trigger ---
function displayToast(msg, isSuccess = true) {
  const toast = document.getElementById("app-toast-message");
  if (!toast) return;

  toast.textContent = msg;
  toast.style.background = isSuccess ? "var(--success-color)" : "var(--danger-color)";
  toast.classList.add("active");

  setTimeout(() => {
    toast.classList.remove("active");
  }, 3000);
}

// --- Location bookmarks modal overlay ---
function openLocationManager() {
  const modal = document.getElementById("modal-overlay-locations");
  if (modal) modal.classList.add("active");
  renderSavedLocationsModalList();
}

function closeLocationManager() {
  const modal = document.getElementById("modal-overlay-locations");
  if (modal) modal.classList.remove("active");
}

function renderSavedLocationsModalList() {
  const rootWrap = document.getElementById("location-modal-saved-cities-list");
  if (!rootWrap) return;

  let loopHtml = "";
  savedLocations.forEach(c => {
    const isNowActive = c.latitude.toFixed(2) === activeLocation.latitude.toFixed(2);
    loopHtml += `
      <div class="city-select-row ${isNowActive ? "active" : ""}" onclick="alignActiveCity('${c.id}')">
        <div class="city-name-left">
          <div class="city-active-dot"></div>
          <div class="city-text">
            <span class="city-label-line-main">${c.name}, ${c.region || c.country}</span>
            <span class="city-label-line-desc">${c.country} &bull; Coordinates ${c.latitude.toFixed(2)}N</span>
          </div>
        </div>
        <button class="city-delete-btn" onclick="deleteSavedCity(event, '${c.id}')" title="Delete bookmark">
          ${SVGIcons["trash"]}
        </button>
      </div>
    `;
  });
  rootWrap.innerHTML = loopHtml;
}

function alignActiveCity(cityId) {
  const found = savedLocations.find(l => l.id === cityId);
  if (!found) return;

  activeLocation = found;
  localStorage.setItem("clearsky_active_city_id", JSON.stringify(found));

  renderSavedLocationsModalList();
  synchronizeLocationMeteo();
  setTimeout(closeLocationManager, 350);
}

function deleteSavedCity(e, cityId) {
  e.stopPropagation();
  if (savedLocations.length <= 1) {
    displayToast("You must keep at least one saved city bookmarks.", false);
    return;
  }

  const deleteCity = savedLocations.find(l => l.id === cityId);
  savedLocations = savedLocations.filter(l => l.id !== cityId);
  localStorage.setItem("clearsky_cities", JSON.stringify(savedLocations));

  if (activeLocation.id === cityId) {
    activeLocation = savedLocations[0];
    localStorage.setItem("clearsky_active_city_id", JSON.stringify(activeLocation));
  }

  renderSavedLocationsModalList();
  synchronizeLocationMeteo();
  displayToast(`Removed ${deleteCity.name} from saved favorites.`);
}

// --- Refresh action ---
function refreshWeatherDataEvent() {
  synchronizeLocationMeteo();
}

// --- Settings and System preferences ---
function savePreferenceSettings() {
  const alertCheck = document.getElementById("check-alert-severe");
  const briefCheck = document.getElementById("check-alert-brief");

  if (alertCheck) configAlerts = alertCheck.checked;
  if (briefCheck) configBriefing = briefCheck.checked;

  localStorage.setItem("clearsky_alerts_severe", JSON.stringify(configAlerts));
  localStorage.setItem("clearsky_alerts_brief", JSON.stringify(configBriefing));
  displayToast("System preferences compiled and stored!");
}

// --- Doppler Radar Canvas Draw Loops ---
function openRadarModal() {
  const modal = document.getElementById("modal-overlay-radar");
  if (modal) modal.classList.add("active");

  const canvas = document.getElementById("dopplerRadarCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // active particles arrays
  const radarBlobs = Array.from({ length: 12 }, () => ({
    x: Math.random() * 260 + 30,
    y: Math.random() * 260 + 30,
    radius: Math.random() * 40 + 10,
    val: Math.random()
  }));

  let sweepSweepAngle = 0;

  function runSweepAnimation() {
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const rad = cx - 20;

    // grid lines
    ctx.strokeStyle = "rgba(59, 130, 246, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, rad * 0.66, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, rad * 0.33, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, cy); ctx.lineTo(canvas.width - 20, cy); ctx.moveTo(cx, 20); ctx.lineTo(cx, canvas.height - 20); ctx.stroke();

    // conically sweeping lines
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sweepSweepAngle);
    const radGrad = ctx.createConicGradient(0, 0, 0);
    radGrad.addColorStop(0, "rgba(59, 130, 246, 0.6)");
    radGrad.addColorStop(0.12, "rgba(59, 130, 246, 0.2)");
    radGrad.addColorStop(0.35, "rgba(59, 130, 246, 0)");
    radGrad.addColorStop(1, "rgba(59, 130, 246, 0)");

    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, rad, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // precip cell signals
    radarBlobs.forEach(b => {
      const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius);
      const colStr = b.val > 0.75 ? "rgba(239, 68, 68, " : b.val > 0.45 ? "rgba(245, 158, 11, " : "rgba(16, 185, 129, ";
      grad.addColorStop(0, colStr + "0.4)");
      grad.addColorStop(0.4, colStr + "0.15)");
      grad.addColorStop(1, colStr + "0)");

      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
    });

    sweepSweepAngle += 0.02;
    radarAnimId = requestAnimationFrame(runSweepAnimation);
  }

  runSweepAnimation();
}

function closeRadarModal() {
  const modal = document.getElementById("modal-overlay-radar");
  if (modal) modal.classList.remove("active");
  if (radarAnimId) {
    cancelAnimationFrame(radarAnimId);
    radarAnimId = null;
  }
}

// --- Premium Pro pricing tiers sandbox ---
function openPremiumModal() {
  const modal = document.getElementById("modal-overlay-premium");
  if (modal) modal.classList.add("active");
  updateComputedProPriceLabel();
}

function closePremiumModal() {
  const modal = document.getElementById("modal-overlay-premium");
  if (modal) modal.classList.remove("active");
}

function handlePriceSliderUpdate(event) {
  updateComputedProPriceLabel();
}

function setPriceSliderValue(val) {
  const slider = document.getElementById("premium-price-tier-slider");
  if (slider) {
    slider.value = val;
    updateComputedProPriceLabel();
  }
}

function updateComputedProPriceLabel() {
  const slider = document.getElementById("premium-price-tier-slider");
  const label = document.getElementById("premium-computed-price-label");
  if (!slider || !label) return;

  const val = parseInt(slider.value);
  if (val === 1) {
    label.innerHTML = "$2.99 / Month";
  } else if (val === 2) {
    label.innerHTML = "$19.99 / Year <span style='color: #fbbf24'>(Save 45%)</span>";
  } else {
    label.innerHTML = "$39.99 / Lifetime Pass";
  }
}

function processPremiumCheckout() {
  const slider = document.getElementById("premium-price-tier-slider");
  const finalTierVal = slider ? parseInt(slider.value) : 2;
  const tierName = finalTierVal === 1 ? "Monthly License" : finalTierVal === 2 ? "Annual License" : "Lifetime Access Pass";

  isProUnlocked = true;
  localStorage.setItem("clearsky_pro", JSON.stringify(true));

  closePremiumModal();
  renderActiveLocationData();
  displayToast(`Congratulations! ClearSky Pro ${tierName} activated securely!`, true);
}

// --- Active Window Onload Listener ---
window.addEventListener("DOMContentLoaded", () => {
  // Clock initializer
  updateRealtimeClock();
  setInterval(updateRealtimeClock, 1000);

  // Theme application loader
  const rootWrapper = document.getElementById("device-wrapper");
  if (currentTheme === "dark") {
    document.body.classList.add("dark-mode");
    if (rootWrapper) {
      rootWrapper.classList.remove("theme-light");
      rootWrapper.classList.add("theme-dark");
    }
    const darkNode = document.getElementById("theme-option-dark");
    const lightNode = document.getElementById("theme-option-light");
    if (darkNode) darkNode.classList.add("active");
    if (lightNode) lightNode.classList.remove("active");
  } else {
    document.body.classList.remove("dark-mode");
    if (rootWrapper) {
      rootWrapper.classList.remove("theme-dark");
      rootWrapper.classList.add("theme-light");
    }
    const lightNode = document.getElementById("theme-option-light");
    const darkNode = document.getElementById("theme-option-dark");
    if (lightNode) lightNode.classList.add("active");
    if (darkNode) darkNode.classList.remove("active");
  }

  // Bind theme buttons explicitly
  const btnLight = document.getElementById("theme-option-light");
  const btnDark = document.getElementById("theme-option-dark");
  if (btnLight && btnDark) {
    btnLight.addEventListener("click", () => {
      currentTheme = "light";
      localStorage.setItem("clearsky_theme", currentTheme);
      document.body.classList.remove("dark-mode");
      if (rootWrapper) {
        rootWrapper.classList.remove("theme-dark");
        rootWrapper.classList.add("theme-light");
      }
      btnLight.classList.add("active");
      btnDark.classList.remove("active");
      displayToast("Light mode design elements enabled!");
    });

    btnDark.addEventListener("click", () => {
      currentTheme = "dark";
      localStorage.setItem("clearsky_theme", currentTheme);
      document.body.classList.add("dark-mode");
      if (rootWrapper) {
        rootWrapper.classList.remove("theme-light");
        rootWrapper.classList.add("theme-dark");
      }
      btnDark.classList.add("active");
      btnLight.classList.remove("active");
      displayToast("Atmospheric dark mode enabled!");
    });
  }

  // Bind extend C/F unit switches explicitly
  const cBtnExt = document.getElementById("unit-option-c-extended");
  const fBtnExt = document.getElementById("unit-option-f-extended");
  const cBtnSet = document.getElementById("unit-option-c-settings");
  const fBtnSet = document.getElementById("unit-option-f-settings");

  function setMetricUnit(unit) {
    currentUnit = unit;
    localStorage.setItem("clearsky_unit", unit);

    [cBtnExt, cBtnSet].forEach(el => {
      if (el) {
        if (unit === "C") el.classList.add("active");
        else el.classList.remove("active");
      }
    });

    [fBtnExt, fBtnSet].forEach(el => {
      if (el) {
        if (unit === "F") el.classList.add("active");
        else el.classList.remove("active");
      }
    });

    renderActiveLocationData();
    fetchTravelRouteData();
    displayToast(`Thermometer units set to °${unit}`);
  }

  if (cBtnExt) cBtnExt.onclick = () => setMetricUnit("C");
  if (fBtnExt) fBtnExt.onclick = () => setMetricUnit("F");
  if (cBtnSet) cBtnSet.onclick = () => setMetricUnit("C");
  if (fBtnSet) fBtnSet.onclick = () => setMetricUnit("F");

  // Set tab to home by default for Single Page App
  activeTab = "home";
  switchTab(activeTab);

  // Load weather forecasts
  synchronizeLocationMeteo();
});

// ============================================================================
// --- SOUTH AFRICAN WEATHER MAP SYSTEM (LEAFLET INTEGRATION) ---
// ============================================================================

let saMapObject = null;
let saMapMarkersList = [];
let currentMapStyle = localStorage.getItem("clearsky_map_style") || "street";

const SOUTH_AFRICAN_CITIES = [
  { id: "sa-jhb", name: "Johannesburg", province: "Gauteng", latitude: -26.2041, longitude: 28.0473 },
  { id: "sa-cpt", name: "Cape Town", province: "Western Cape", latitude: -33.9249, longitude: 18.4241 },
  { id: "sa-dur", name: "Durban", province: "KwaZulu-Natal", latitude: -29.8587, longitude: 31.0218 },
  { id: "sa-pre", name: "Pretoria", province: "Gauteng", latitude: -25.7479, longitude: 28.2293 },
  { id: "sa-pe",  name: "Gqeberha (PE)", province: "Eastern Cape", latitude: -33.9608, longitude: 25.6022 },
  { id: "sa-blo", name: "Bloemfontein", province: "Free State", latitude: -29.1181, longitude: 26.2241 },
  { id: "sa-plk", name: "Polokwane", province: "Limpopo", latitude: -23.8962, longitude: 29.4486 },
  { id: "sa-nel", name: "Mbombela", province: "Mpumalanga", latitude: -25.4753, longitude: 30.9694 }
];

function initializeSouthAfricanMap() {
  if (saMapObject) {
    // Already defined, invalidate layout size to force complete layout loading in the view wrapper style
    setTimeout(() => {
      saMapObject.invalidateSize();
    }, 100);
    return;
  }

  // Ensure Leaflet object L is defined in browser
  if (typeof L === "undefined") {
    setTimeout(initializeSouthAfricanMap, 200);
    return;
  }

  // Create the Leaflet Map centered on South Africa
  saMapObject = L.map("interactive-leaflet-map", {
    zoomControl: true,
    attributionControl: false
  }).setView([-30.5595, 22.9375], 5);

  // Apply default layer style
  loadTileLayerForMap();

  // Load weather markers across South Africa
  syncSouthAfricanMapWeather();

  // Hide initial spinner loader overlay
  const spinner = document.getElementById("map-initial-spinner");
  if (spinner) spinner.style.display = "none";
}

function loadTileLayerForMap() {
  if (!saMapObject) return;

  // Clear previous layers
  saMapObject.eachLayer((layer) => {
    if (layer instanceof L.TileLayer) {
      saMapObject.removeLayer(layer);
    }
  });

  let tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  if (currentMapStyle === "dark") {
    tileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  } else if (currentMapStyle === "topo") {
    tileUrl = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
  }

  L.tileLayer(tileUrl, {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(saMapObject);
}

function toggleMapLayer(styleId) {
  currentMapStyle = styleId;
  localStorage.setItem("clearsky_map_style", styleId);

  // Switch pill styles
  document.querySelectorAll(".layer-toggle-btn").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.getElementById(`layer-btn-${styleId}`);
  if (activeBtn) activeBtn.classList.add("active");

  loadTileLayerForMap();
}

async function syncSouthAfricanMapWeather() {
  if (!saMapObject) return;

  const trigger = document.getElementById("map-refresh-trigger");
  if (trigger) trigger.classList.add("loading");

  // Remove existing weather pin marks
  saMapMarkersList.forEach(m => saMapObject.removeLayer(m));
  saMapMarkersList = [];

  // Query meteorology forecast indexes for South Africa locations
  for (const city of SOUTH_AFRICAN_CITIES) {
    try {
      const forecast = await fetchFullForecast(city.latitude, city.longitude);
      const tempFormatted = formatTemp(forecast.current.tempC);

      // Create detailed dynamic popup
      const popupHtml = `
        <div class="popup-forecast-header">${city.name}</div>
        <div style="font-weight: 550; margin-bottom: 3px; font-size: 11px;">${city.province} Province</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 5px;">Forecast: <b>${forecast.current.condition}</b></div>
        <div style="display: flex; gap: 8px; font-weight: bold; font-size: 11px; margin-bottom: 8px;">
          <span>${tempFormatted}</span>
          <span>💧 ${forecast.current.humidity}%</span>
        </div>
        <button class="popup-btn-set-active" onclick="setCityFromMap('${city.id}')">Select Active Hub</button>
      `;

      // Color scale pinpoint based on live celsius scale
      const pinColor = forecast.current.tempC > 25 ? "#ef4444" : (forecast.current.tempC > 15 ? "#f59e0b" : "#3b82f6");

      const customIcon = L.divIcon({
        className: 'custom-leaflet-pin',
        html: `<div style="background-color: ${pinColor}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.45); cursor: pointer;"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker([city.latitude, city.longitude], { icon: customIcon })
        .bindPopup(popupHtml)
        .addTo(saMapObject);

      // On map click event, populate South Africa weather info display card
      marker.on("click", () => {
        const titleEl = document.getElementById("map-selected-city-title");
        const detailsEl = document.getElementById("map-selected-city-details");
        const tempEl = document.getElementById("map-selected-city-temp");

        if (titleEl) titleEl.textContent = `${city.name}, SA`;
        if (detailsEl) {
          detailsEl.innerHTML = `Wind Gusts: <b>${forecast.current.windKmh} km/h</b> &bull; Humidity: <b>${forecast.current.humidity}%</b> &bull; Feels like: <b>${formatTemp(forecast.current.feelsLikeC)}</b>`;
        }
        if (tempEl) tempEl.textContent = tempFormatted;
      });

      saMapMarkersList.push(marker);

      // Automatically set the first map selected city as South Africa Weather Grid default info context
      if (city.id === "sa-jhb" && document.getElementById("map-selected-city-title").textContent === "South Africa Weather Grid") {
        document.getElementById("map-selected-city-title").textContent = "Gauteng Province Hub";
        document.getElementById("map-selected-city-details").innerHTML = `${city.name} Station &bull; Wind: <b>${forecast.current.windKmh}km/h</b> &bull; Humidity: <b>${forecast.current.humidity}%</b>`;
        document.getElementById("map-selected-city-temp").textContent = tempFormatted;
      }

    } catch (err) {
      console.error(`Offline Station indexing skipped for ${city.name}:`, err);
    }
  }

  // Soft completion animation removal
  setTimeout(() => {
    if (trigger) trigger.classList.remove("loading");
  }, 1000);
}

function setCityFromMap(cityId) {
  const cityObj = SOUTH_AFRICAN_CITIES.find(c => c.id === cityId);
  if (!cityObj) return;

  const mappedFormat = {
    id: cityObj.id,
    name: cityObj.name,
    region: cityObj.province,
    country: "South Africa",
    latitude: cityObj.latitude,
    longitude: cityObj.longitude
  };

  // Add search index if not duplicate bookmark
  if (!savedLocations.some(l => l.id === cityObj.id)) {
    savedLocations.push(mappedFormat);
    localStorage.setItem("clearsky_cities", JSON.stringify(savedLocations));
  }

  activeLocation = mappedFormat;
  localStorage.setItem("clearsky_active_city_id", JSON.stringify(mappedFormat));

  // Update all current layouts of the main screen
  synchronizeLocationMeteo();

  // Fire premium toast confirmation banner
  displayToast(`📍 Active forecast region set to ${cityObj.name}, South Africa!`, true);

  // Return to Overview main screen
  switchTab("home");
}

function centerMapOn(preset) {
  if (!saMapObject) return;

  // Swap pill designs
  document.querySelectorAll(".map-controls-pills .map-pill").forEach(el => el.classList.remove("active"));
  const activePill = document.getElementById(`pill-map-${preset}`);
  if (activePill) activePill.classList.add("active");

  if (preset === "sa") {
    saMapObject.setView([-30.5595, 22.9375], 5);
  } else if (preset === "capetown") {
    saMapObject.setView([-33.9249, 18.4241], 9);
  } else if (preset === "joburg") {
    saMapObject.setView([-26.2041, 28.0473], 9);
  } else if (preset === "durban") {
    saMapObject.setView([-29.8587, 31.0218], 9);
  } else if (preset === "pe") {
    saMapObject.setView([-33.9608, 25.6022], 9);
  }
}

