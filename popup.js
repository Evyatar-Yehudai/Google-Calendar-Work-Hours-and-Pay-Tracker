document.addEventListener("DOMContentLoaded", async () => {
  const calendarInput = document.getElementById("calendarId");
  const rateInput = document.getElementById("hourlyRate");
  const showEstimateBtn = document.getElementById("showEstimateBtn");
  const saveBtn = document.getElementById("save");
  const status = document.getElementById("status");

  // 1. Fetch previously configured keys immediately upon dropdown rendering
  const data = await chrome.storage.sync.get(["calendarId", "hourlyRate"]);
  calendarInput.value = data.calendarId || "";
  rateInput.value = data.hourlyRate || "";

  // 2. Action to force-reopen and clear the closed state flag
  showEstimateBtn.addEventListener("click", async () => {
    await chrome.storage.sync.set({ showOverlayToggle: true });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes("calendar.google.com")) {
      chrome.tabs.sendMessage(tab.id, { type: "FORCE_REOPEN" });
    }
    
    status.style.color = "var(--status-success)";
    status.innerText = "Overlay box restored!";
    setTimeout(() => { status.innerText = ""; }, 2000);
  });

  // 3. Commit modified records to persistent account storage sync
  saveBtn.addEventListener("click", async () => {
    const calendarId = calendarInput.value.trim();
    const hourlyRate = Number(rateInput.value);

    if (!calendarId || isNaN(hourlyRate)) {
      status.style.color = "var(--status-error)";
      status.innerText = "Please enter valid settings.";
      return;
    }

    await chrome.storage.sync.set({
      calendarId,
      hourlyRate
    });

    status.style.color = "var(--status-success)";
    status.innerText = "Saved! Refresh calendar page to apply.";
    
    setTimeout(() => {
      status.innerText = "";
    }, 2500);
  });
});