let cachedToken = null;

function getToken() {
  return new Promise((resolve, reject) => {
    if (cachedToken) return resolve(cachedToken);

    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      cachedToken = token;
      resolve(token);
    });
  });
}

async function fetchEvents(calendarId, start, end) {
  const token = await getToken();
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events` +
    `?timeMin=${start}` +
    `&timeMax=${end}` +
    `&singleEvents=true`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return data.items || [];
}

async function fetchPremiumHolidays(start, end) {
  try {
    const token = await getToken();
    const israelHolidaysId = "en.il#holiday@group.v.calendar.google.com";
    
    const url =
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(israelHolidaysId)}/events` +
      `?timeMin=${start}` +
      `&timeMax=${end}` +
      `&singleEvents=true`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const holidayItems = data.items || [];

    // Official 9 Statutory Holidays Eligible for Premium Overtime under Israeli Law
    const premiumHolidayKeywords = [
      "Rosh Hashana",
      "Yom Kippur",
      "Sukkot",
      "Shmini Atzeret",
      "Simchat Torah",
      "Pesach",
      "Passover",
      "Shavuot",
      "Independence Day"
    ];

    const premiumHolidayDates = new Set();
    for (const item of holidayItems) {
      const summary = item.summary || "";
      const isPremium = premiumHolidayKeywords.some(keyword => 
        summary.toLowerCase().includes(keyword.toLowerCase())
      );
      if (isPremium && item.start?.date) {
        premiumHolidayDates.add(item.start.date);
      }
    }
    return premiumHolidayDates;
  } catch (err) {
    console.error("Error fetching holidays:", err);
    return new Set();
  }
}

/**
 * Astronomical math helper to calculate precise local sunset times in Israel
 * Coordinates tuned to Central Israel (Latitude: 32.08, Longitude: 34.78)
 */
function getSunsetTimeInMinutes(date) {
  const latitude = 32.08;
  const longitude = 34.78;
  const zenith = 90.83; // Standard atmospheric refraction zenith
  
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  const N1 = Math.floor(275 * month / 9);
  const N2 = Math.floor((month + 9) / 12);
  const N3 = (1 + Math.floor((year - 4 * Math.floor(year / 4) + 2) / 3));
  const N = N1 - (N2 * N3) + day - 30;

  const lngHour = longitude / 15;
  const t = N + ((18 - lngHour) / 24); // Approximate sunset time

  const M = (0.9856 * t) - 3.289;
  let L = M + (1.916 * Math.sin(M * Math.PI / 180)) + (0.020 * Math.sin(2 * M * Math.PI / 180)) + 282.634;
  L = (L + 360) % 360;

  let RA = Math.atan(0.91746 * Math.tan(L * Math.PI / 180)) * 180 / Math.PI;
  RA = (RA + 360) % 360;

  const Lquadrant = (Math.floor(L / 90)) * 90;
  const RAquadrant = (Math.floor(RA / 90)) * 90;
  RA = RA + (Lquadrant - RAquadrant);
  RA = RA / 15;

  const sinDec = 0.39782 * Math.sin(L * Math.PI / 180);
  const cosDec = Math.cos(Math.asin(sinDec));

  const cosH = (Math.cos(zenith * Math.PI / 180) - (sinDec * Math.sin(latitude * Math.PI / 180))) / (cosDec * Math.cos(latitude * Math.PI / 180));
  
  if (cosH < -1 || cosH > 1) return 1140; // Default to 7:00 PM if outlier occurs

  const H = Math.acos(cosH) * 180 / Math.PI;
  const T = H / 15;
  const UT = T + RA - (0.06571 * t) - 6.622;
  let localT = UT + lngHour + 3; // Fixed IDT/EET baseline factor

  // Handle Daylight Savings offsets
  const isDST = (month > 3 && month < 10) || (month === 3 && day > 20) || (month === 10 && day < 25);
  if (!isDST) localT -= 1;

  localT = (localT + 24) % 24;
  return Math.floor(localT * 60);
}

function calculateHours(workEvents, premiumHolidays) {
  let regularMinutes = 0;
  let premiumMinutes = 0;

  // Cache calculated solar windows per unique date string to maintain fast performance
  const solarCache = {};

  for (const e of workEvents) {
    if (!e.start?.dateTime || !e.end?.dateTime) continue;

    let current = new Date(e.start.dateTime).getTime();
    let end = new Date(e.end.dateTime).getTime();
    const minuteStep = 60000;

    // --- NEW LOGIC FOR 23:59 EVENING SHIFTS ---
    const originalEndDate = new Date(e.end.dateTime);
    if (originalEndDate.getHours() === 23 && originalEndDate.getMinutes() === 59) {
      const originalStartDate = new Date(e.start.dateTime);
      const startDay = originalStartDate.getDay(); // 0 = Sunday, 4 = Thursday, 5 = Friday

      if (startDay === 4 || startDay === 5) {
        // Thursday or Friday: Add a full hour (60 minutes)
        end += 60 * 60000;
      } else {
        // Any other day: Add half an hour (30 minutes)
        end += 30 * 60000;
      }
    }
    // ------------------------------------------

    while (current < end) {
      const currentDate = new Date(current);
      
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const dateVal = String(currentDate.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${dateVal}`;

      // Pull solar times for today
      if (!solarCache[dateString]) {
        const sunsetMin = getSunsetTimeInMinutes(currentDate);
        solarCache[dateString] = {
          sunset: sunsetMin,
          havdalah: sunsetMin + 40 // Havdalah legal standard: 40 minutes post-sunset
        };
      }

      const todaySolar = solarCache[dateString];
      const day = currentDate.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
      const currentMinuteOfDay = (currentDate.getHours() * 60) + currentDate.getMinutes();

      let isPremiumWindow = false;

      // 1. EVALUATE WEEKEND (SHABBAT) BOUNDARIES
      if (day === 5) { // Friday
        if (currentMinuteOfDay >= todaySolar.sunset) {
          isPremiumWindow = true;
        }
      } else if (day === 6) { // Saturday
        if (currentMinuteOfDay < todaySolar.havdalah) {
          isPremiumWindow = true;
        }
      }

      // 2. EVALUATE HOLIDAY BOUNDARIES
      if (!isPremiumWindow) {
        // Is today an active whitelisted statutory holiday? 
        // Covers up until Havdalah time on the holiday date
        if (premiumHolidays.has(dateString)) {
          if (currentMinuteOfDay < todaySolar.havdalah) {
            isPremiumWindow = true;
          }
        }
        
        // Is today a Holiday Eve? (Tomorrow is on the whitelist)
        // Premium pay officially starts precisely at sunset today
        const tomorrowDate = new Date(current + 24 * 60 * 60 * 1000);
        const tomYear = tomorrowDate.getFullYear();
        const tomMonth = String(tomorrowDate.getMonth() + 1).padStart(2, '0');
        const tomDateVal = String(tomorrowDate.getDate()).padStart(2, '0');
        const tomorrowString = `${tomYear}-${tomMonth}-${tomDateVal}`;

        if (premiumHolidays.has(tomorrowString)) {
          if (currentMinuteOfDay >= todaySolar.sunset) {
            isPremiumWindow = true;
          }
        }
      }

      if (isPremiumWindow) {
        premiumMinutes++;
      } else {
        regularMinutes++;
      }

      current += minuteStep;
    }
  }

  return {
    regularHours: regularMinutes / 60,
    premiumHours: premiumMinutes / 60
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "GET_MONTH_DATA") {
    handleRequest(msg).then(sendResponse);
    return true;
  }
});

async function handleRequest(msg) {
  const { calendarId, hourlyRate, start, end } = msg;

  const [workEvents, premiumHolidays] = await Promise.all([
    fetchEvents(calendarId, start, end),
    fetchPremiumHolidays(start, end)
  ]);

  const { regularHours, premiumHours } = calculateHours(workEvents, premiumHolidays);
  const totalPay = (regularHours * hourlyRate) + (premiumHours * hourlyRate * 1.5);

  return { regularHours, premiumHours, pay: totalPay };
}

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.url && details.url.includes("calendar.google.com")) {
    chrome.tabs.sendMessage(details.tabId, { type: "URL_CHANGED" });
  }
});