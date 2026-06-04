function getViewedMonthRange() {
  const match = window.location.pathname.match(/month\/(\d{4})\/(\d{1,2})/);

  if (!match) {
    console.log("Not in a clean month view URL state right now.");
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1; 

  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 1)
  };
}

function initTracker() {
  chrome.storage.sync.get(["calendarId", "hourlyRate", "showOverlayToggle"], (settings) => {
    if (!settings.calendarId || !settings.hourlyRate) return;

    // Check if user turned it off using custom controls
    if (settings.showOverlayToggle === false) {
      const box = document.getElementById("work-tracker-box");
      if (box) {
        box.style.display = "none";
        box.setAttribute("data-hidden", "true");
      }
      return;
    }

    const range = getViewedMonthRange();
    if (!range) return;

    const { start, end } = range;

    chrome.runtime.sendMessage(
      {
        type: "GET_MONTH_DATA",
        calendarId: settings.calendarId,
        hourlyRate: settings.hourlyRate,
        start: start.toISOString(),
        end: end.toISOString()
      },
      (res) => {
        if (!res) return;
        showOverlay(res.regularHours, res.premiumHours, res.pay, start);
      }
    );
  });
}

function showOverlay(regularHours, premiumHours, pay, startDate) {
  let box = document.getElementById("work-tracker-box");

  if (!box) {
    box = document.createElement("div");
    box.id = "work-tracker-box";

    // Style properties & positions
    box.style.position = "fixed";
    box.style.top = "80px";
    box.style.right = "20px";
    box.style.border = "1px solid var(--wt-border, #ccc)";
    box.style.padding = "12px";
    box.style.zIndex = 999999;
    box.style.borderRadius = "4px";
    box.style.boxShadow = "0px 2px 5px rgba(0,0,0,0.15)";
    box.style.fontFamily = "Roboto, sans-serif";
    box.style.fontSize = "13px";
    box.style.lineHeight = "1.5";
    box.style.cursor = "move"; 
    box.style.userSelect = "none";

    const styleNode = document.createElement("style");
    styleNode.textContent = `
      :root {
        --wt-bg: #ffffff;
        --wt-text: #202124;
        --wt-border: #dadce0;
        --wt-header-border: #eee;
        --wt-premium: #b06000;
        --wt-pay: #1e7e34;
        --wt-close-hover: #f5f5f5;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --wt-bg: #2d2e31;
          --wt-text: #e8eaed;
          --wt-border: #5f6368;
          --wt-header-border: #3c4043;
          --wt-premium: #ffb74d;
          --wt-pay: #81c784;
          --wt-close-hover: #3c4043;
        }
      }
      #work-tracker-box {
        background-color: var(--wt-bg);
        color: var(--wt-text);
        transition: background-color 0.3s, color 0.3s, border-color 0.3s;
      }
      .wt-close-btn:hover {
        background-color: var(--wt-close-hover);
      }
    `;
    document.head.appendChild(styleNode);
    document.body.appendChild(box);

    // --- MOUSE DRAG IMPLEMENTATION ---
    let isDragging = false;
    let offsetX, offsetY;

    box.addEventListener("mousedown", (e) => {
      if (e.target.classList.contains("wt-close-btn")) return;
      
      isDragging = true;
      offsetX = e.clientX - box.getBoundingClientRect().left;
      offsetY = e.clientY - box.getBoundingClientRect().top;
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      box.style.right = "auto"; 
      box.style.left = `${e.clientX - offsetX}px`;
      box.style.top = `${e.clientY - offsetY}px`;
    });

    document.addEventListener("mouseup", () => {
      isDragging = false;
    });
  }

  if (box.getAttribute("data-hidden") === "true") {
    return;
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentMonthName = monthNames[startDate.getMonth()] || "Monthly";
  const currentYear = startDate.getFullYear();

  box.style.display = "block";
  box.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid var(--wt-header-border); padding-bottom: 4px; padding-right: 20px;">
      <span>${currentMonthName} ${currentYear} Pay Estimate</span>
      <button class="wt-close-btn" style="position: absolute; right: 6px; top: 6px; background: none; border: none; color: inherit; font-size: 14px; cursor: pointer; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; padding: 0;">&times;</button>
    </div>
    <div>Standard Hours: ${regularHours.toFixed(2)}</div>
    <div style="color: var(--wt-premium); font-weight: 500;">Law Rest Hours (150%): ${premiumHours.toFixed(2)}</div>
    <div style="font-weight: bold; margin-top: 4px; color: var(--wt-pay);">Legal Gross Pay: ₪${pay.toFixed(2)}</div>
  `;

  box.querySelector(".wt-close-btn").addEventListener("click", () => {
    box.style.display = "none";
    box.setAttribute("data-hidden", "true");
    chrome.storage.sync.set({ showOverlayToggle: false });
  });
}

initTracker();

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "URL_CHANGED") {
    setTimeout(initTracker, 250);
  } else if (message.type === "FORCE_REOPEN") {
    let box = document.getElementById("work-tracker-box");
    if (box) {
      box.removeAttribute("data-hidden");
      box.style.display = "block";
    }
    initTracker();
  }
});