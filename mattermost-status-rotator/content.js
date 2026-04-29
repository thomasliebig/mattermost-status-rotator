(() => {
  const EXT_PREFIX = "mm-status-rotator";
  const STORAGE_INDEX_KEY = `${EXT_PREFIX}:nextIndex`;
  const STORAGE_ACTIVE_KEY = `${EXT_PREFIX}:active`;
  const BUTTON_ID = `${EXT_PREFIX}-button`;
  const INTERVAL_MS = 5 * 60 * 1000;
  const DB_NAME = `${EXT_PREFIX}-db`;
  const DB_STORE = "handles";
  const DB_HANDLE_KEY = "status-file";

const EMOJI_MAP = {
  "🧠": "brain",
  "📊": "bar_chart",
  "📉": "chart_with_downwards_trend",
  "📈": "chart_with_upwards_trend",
  "🧪": "test_tube",
  "📚": "books",
  "☕": "coffee",
  "🥨": "pretzel",
  "🤖": "robot",
  "🔍": "mag",
  "🔄": "arrows_counterclockwise",
  "🛠️": "hammer_and_wrench",
  "⚙️": "gear",
  "🚀": "rocket",
  "🔥": "fire",
  "🧩": "jigsaw",
  "💡": "bulb",
  "🧮": "abacus",
  "🇩🇪": "de",
  "📡": "satellite_antenna",
  "🧑‍💻": "technologist",
  "🧑‍🔬": "scientist",
  "🧑‍🏫": "teacher",
  "🟢": "green_circle",
  "🟡": "yellow_circle",
  "🔴": "red_circle",
  "⚫": "black_circle",
  "⚪": "white_circle",
  "💬": "speech_balloon",
  "🗨️": "left_speech_bubble",
  "📢": "loudspeaker",
  "📣": "mega",
  "📨": "incoming_envelope",
  "✉️": "email",
  "📝": "memo",
  "📌": "pushpin",
  "📎": "paperclip",
  "📁": "file_folder",
  "📂": "open_file_folder",
  "🗂️": "card_index_dividers",
  "📅": "calendar",
  "⏰": "alarm_clock",
  "⏳": "hourglass_flowing_sand",
  "🤔": "thinking_face",
  "😴": "sleeping",
  "😵": "dizzy_face",
  "🥱": "yawning_face",
  "😅": "sweat_smile",
  "😬": "grimacing",
  "🙃": "upside_down_face",
  "✅": "white_check_mark",
  "❌": "x",
  "⚠️": "warning",
  "❗": "exclamation",
  "❓": "question",
  "💻": "computer",
  "🖥️": "desktop_computer",
  "⌨️": "keyboard",
  "🖱️": "computer_mouse",
  "💾": "floppy_disk",
  "📀": "cd",
  "🔌": "electric_plug",
  "▶️": "arrow_forward",
  "⏸️": "pause_button",
  "⏹️": "stop_button",
  "🔁": "repeat",
  "🔂": "repeat_one",
  "⬆️": "arrow_up",
  "⬇️": "arrow_down",
  "➡️": "arrow_right",
  "⬅️": "arrow_left",
  "↗️": "arrow_upper_right",
  "↘️": "arrow_lower_right",
  "⭐": "star",
  "🌟": "star2",
  "✨": "sparkles",
  "🎯": "dart",
  "🎲": "game_die",
  "🃏": "joker",
  "🔒": "lock",
  "🔓": "unlock",
  "🔑": "key"
  };

  let fileHandle = null;
  let intervalId = null;
  let active = false;
  let initialized = false;

  function log(...args) {
    console.log("[Mattermost Status Rotator]", ...args);
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSet(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function isMattermost() {
    try {
      const response = await fetch("/api/v4/users/me/status", {
        method: "GET",
        credentials: "same-origin",
        headers: { "X-Requested-With": "XMLHttpRequest" }
      });
      if (!response.ok) return false;
      const json = await response.json();
      return Boolean(json && json.user_id && json.status);
    } catch {
      return false;
    }
  }

  function findAppBarTop() {
    return document.querySelector(".app-bar__top");
  }

  function setButtonState(btn) {
    btn.title = active
      ? "Mattermost status rotator is active — click to stop"
      : "Mattermost status rotator is inactive — click to start";

    btn.style.opacity = active ? "1" : "0.35";
    btn.style.filter = active ? "none" : "grayscale(1)";

    const dot = btn.querySelector(`.${EXT_PREFIX}-dot`);
    if (dot) dot.textContent = active ? "🟢" : "⚫";
  }

  function createButton() {
    document.getElementById(BUTTON_ID)?.remove();

    const appBarTop = findAppBarTop();
    if (!appBarTop) return null;

    const wrapper = document.createElement("div");
    wrapper.id = BUTTON_ID;
    wrapper.className = "app-bar__icon";

    wrapper.innerHTML = `
      <div role="button" tabindex="0" class="app-bar__icon-inner" style="
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        cursor: pointer;
        transition: opacity 0.2s ease, filter 0.2s ease;
        user-select: none;
      ">
        <span class="${EXT_PREFIX}-dot">⚫</span>
      </div>
    `;

    appBarTop.appendChild(wrapper);
    return wrapper.querySelector(".app-bar__icon-inner");
  }

  async function pickFile() {
    if (!window.showOpenFilePicker) {
      throw new Error("This browser does not support showOpenFilePicker(). Use current Chrome/Edge.");
    }

    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "Text Files", accept: { "text/plain": [".txt"] } }],
      multiple: false
    });

    fileHandle = handle;
    await idbSet(DB_HANDLE_KEY, handle);
  }

  async function restoreFileHandle() {
    if (fileHandle) return fileHandle;
    fileHandle = await idbGet(DB_HANDLE_KEY);
    return fileHandle;
  }

  async function ensureFilePermission(handle) {
    const opts = { mode: "read" };
    if ((await handle.queryPermission(opts)) === "granted") return true;
    if ((await handle.requestPermission(opts)) === "granted") return true;
    return false;
  }

  async function loadLines() {
    const handle = await restoreFileHandle();
    if (!handle) throw new Error("No status file selected yet.");

    const permitted = await ensureFilePermission(handle);
    if (!permitted) throw new Error("No permission to read the selected status file.");

    const file = await handle.getFile();
    const text = await file.text();
    return text.split("\n").map((s) => s.trim()).filter(Boolean);
  }

  function parseLine(line) {
    const shortcode = line.match(/^:([a-zA-Z0-9_+\-]+):\s*(.*)$/);
    if (shortcode) {
      return { emoji: shortcode[1], text: shortcode[2].slice(0, 100) };
    }

    const parts = line.split(/\s+/);
    const first = parts[0];
    const rest = parts.slice(1).join(" ");

    if (EMOJI_MAP[first]) {
      return { emoji: EMOJI_MAP[first], text: rest.slice(0, 100) };
    }

    return { emoji: "speech_balloon", text: line.slice(0, 100) };
  }

  async function updateStatus() {
    const lines = await loadLines();
    if (!lines.length) {
      log("No status lines found.");
      return;
    }

    let index = Number(localStorage.getItem(STORAGE_INDEX_KEY) || "0");
    if (!Number.isInteger(index) || index < 0 || index >= lines.length) index = 0;

    const line = lines[index];
    const { emoji, text } = parseLine(line);

    const response = await fetch("/api/v4/users/me/status/custom", {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: JSON.stringify({ emoji, text })
    });

    const body = await response.text();

    if (!response.ok) {
      console.error("Mattermost status update failed:", response.status, body);
      return;
    }

    localStorage.setItem(STORAGE_INDEX_KEY, String((index + 1) % lines.length));
    log(`Updated status ${index + 1}/${lines.length}:`, emoji, text);
  }

  async function start(btn, mustPickIfMissing = true) {
    if (active) return;

    if (!fileHandle) await restoreFileHandle();
    if (!fileHandle && mustPickIfMissing) await pickFile();
    if (!fileHandle) return;

    active = true;
    localStorage.setItem(STORAGE_ACTIVE_KEY, "true");
    setButtonState(btn);

    await updateStatus();

    intervalId = setInterval(() => {
      updateStatus().catch((err) => {
        console.error("Mattermost status rotator update failed:", err);
      });
    }, INTERVAL_MS);

    log("Started.");
  }

  function stop(btn) {
    active = false;
    localStorage.setItem(STORAGE_ACTIVE_KEY, "false");

    if (intervalId) clearInterval(intervalId);
    intervalId = null;

    setButtonState(btn);
    log("Stopped.");
  }

  async function attach() {
    if (initialized && document.getElementById(BUTTON_ID)) return;

    const appBarTop = findAppBarTop();
    if (!appBarTop) return;

    const btn = createButton();
    if (!btn) return;

    initialized = true;
    active = false;
    setButtonState(btn);

    btn.addEventListener("click", () => {
      if (active) {
        stop(btn);
      } else {
        start(btn, true).catch((err) => {
          console.error("Could not start Mattermost status rotator:", err);
          active = false;
          localStorage.setItem(STORAGE_ACTIVE_KEY, "false");
          setButtonState(btn);
        });
      }
    });

    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        btn.click();
      }
    });

    const shouldResume = localStorage.getItem(STORAGE_ACTIVE_KEY) === "true";
    if (shouldResume) {
      await restoreFileHandle();
      start(btn, false).catch((err) => {
        console.warn("Could not auto-resume status rotator. Click the button and reselect the file if needed.", err);
        stop(btn);
      });
    }

    log("Attached to app bar.");
  }

  async function boot() {
    if (!(await isMattermost())) return;

    await attach();

    const observer = new MutationObserver(() => {
      if (!document.getElementById(BUTTON_ID)) {
        attach().catch(console.error);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  boot().catch(console.error);
})();
