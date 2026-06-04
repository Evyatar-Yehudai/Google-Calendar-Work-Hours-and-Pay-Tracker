chrome.storage.sync   // synced with Google account
chrome.storage.local  // device-only


export async function saveSettings(settings) {
  await chrome.storage.sync.set(settings);
}

export async function getSettings() {
  return await chrome.storage.sync.get([
    "calendarId",
    "hourlyRate"
  ]);
}