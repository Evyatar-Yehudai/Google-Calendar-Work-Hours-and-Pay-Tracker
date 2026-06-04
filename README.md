# Google Calendar Work Hours & Pay Tracker

A custom Google Chrome Extension designed to track work shifts directly from Google Calendar, calculate accurate working hours under Israeli Labor Law, and estimate monthly gross pay in real-time. 

The extension features a clean overlay that integrates directly into the Google Calendar web interface and respects your system's light/dark mode preferences.

---

## Features

* **Dynamic Pay Estimation:** Automatically calculates standard working hours and premium legal rest hours (Shabbat and Whitelisted Statutory Holidays).
* **Automated Solar Calculations:** Built-in astronomical tracking tuned to Central Israel coordinates to dynamically shift overtime windows based on exact local Friday sunset and Saturday Havdalah times.
* **Smart Late-Shift Extensions:** Custom processing for evening shifts ending at `23:59`. To avoid cross-day calendar splitting, the tracking loop automatically credits an extra 30 minutes for weekday shifts, and a full 60 minutes for shifts starting on Thursdays or Fridays.
* **System Theme Sync:** Beautiful, native-looking interface that instantly adapts to your system or browser's Light Mode or Dark Mode settings.
* **Secure Google Account Sync:** Your configuration data (Calendar ID and Hourly Rate) is synced securely across devices using Chrome's internal storage profile synchronization.

---

## Extension Structure

* `manifest.json`: Configuration, permissions (storage, identity, activeTab), and background script wiring.
* `background.js`: Handles Google OAuth 2.0 authentication, fetches calendar event data stream, computes sunset windows, and calculates precise work hours.
* `Content.js`: Scrapes the active calendar view range from the URL parameters and draws the interactive floating summary box overlay.
* `popup.html` & `popup.js`: The extension's settings dropdown panel used to manage configurations.
* `storage.js`: Helper module managing background synchronization states.

---

## Getting Started & Installation

### 1. Prerequisites
Ensure you have a Google Cloud Console project configured with the Google Calendar API enabled and an active OAuth 2.0 Client ID that matches the `client_id` in your `manifest.json`.

### 2. Local Installation
1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the root folder containing the extension files.

### 3. Setup Configuration
1. Click the extension icon in your Chrome toolbar to open the **Tracker Settings** popup.
2. Enter the target **Calendar ID** (e.g., your primary Gmail address or a specific work sub-calendar ID).
3. Enter your baseline **Hourly Rate (₪)**.
4. Click **Save Settings** and refresh your Google Calendar tab.

---

## How It Works: Israeli Labor Law Rules
* **Standard Hours (100%):** Calculated during normal weekday windows.
* **Law Rest Hours (150%):** Triggered automatically from Friday sunset through Saturday Havdalah (sunset + 40 minutes), as well as whitelisted Israeli statutory holidays (Rosh Hashana, Yom Kippur, Sukkot, Shmini Atzeret, Simchat Torah, Passover (Pesach), Shavuot, and Independence Day) starting precisely at sunset on the holiday's eve.
