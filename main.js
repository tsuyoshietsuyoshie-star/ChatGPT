const {
    app,
    BrowserWindow,
    Tray,
    Menu,
    shell,
    nativeTheme,
    globalShortcut,
    ipcMain
} = require("electron");

const path = require("path");
const fs = require("fs");

// Cache-Folder korrekt definieren
const cacheFolder = path.join(app.getPath("userData"), "Partitions/chatgpt");

let mainWin;
let miniWin;
let tray;

let theme = "light";
let buttonY = 10;
let buttonXOffset = -60;
let buttonXOffsetMini = 60;


// --------------------------
// HAUPTFENSTER
// --------------------------
function createMain() {
    mainWin = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, "icon.ico"),
        webPreferences: {
            partition: "persist:chatgpt",
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, "preload.js")
        }
    });

    mainWin.loadURL("https://chatgpt.com");

    mainWin.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("https://chatgpt.com")) return { action: "allow" };
        shell.openExternal(url);
        return { action: "deny" };
    });

    mainWin.webContents.on("did-finish-load", () => {
        injectThemeButton();
        setTimeout(() => applyTheme(), 50);
    });

    mainWin.on("closed", () => {
        mainWin = null;
    });
}



// --------------------------
// MINICHAT
// --------------------------
function createMini() {
    if (miniWin) {
        miniWin.show();
        return;
    }

    miniWin = new BrowserWindow({
        width: 400,
        height: 550,
        alwaysOnTop: true,
        frame: false,
        titleBarStyle: "hidden",
        transparent: true,
        icon: path.join(__dirname, "icon.ico"),
        webPreferences: {
            partition: "persist:chatgpt",
            preload: path.join(__dirname, "preload.js")
        }
    });

    // Grundtransparenz
    miniWin.setOpacity(0.09);

    miniWin.on("focus", () => miniWin.setOpacity(1));
    miniWin.on("blur", () => miniWin.setOpacity(0.2));

    // ---- SNAP FUNKTION ----
    function enableMiniSnap() {
        const snapDistance = 40;

        miniWin.on("move", () => {
            if (!miniWin) return;

            const { screen } = require("electron");
            const display = screen.getPrimaryDisplay();
            const { width: screenW, height: screenH } = display.workAreaSize;

            const [x, y] = miniWin.getPosition();
            const [w, h] = miniWin.getSize();

            let newX = x;
            let newY = y;

            if (Math.abs(x) < snapDistance) newX = 0;
            if (Math.abs((x + w) - screenW) < snapDistance) newX = screenW - w;
            if (Math.abs(y) < snapDistance) newY = 0;
            if (Math.abs((y + h) - screenH) < snapDistance) newY = screenH - h;

            if (newX !== x || newY !== y) miniWin.setPosition(newX, newY);
        });
    }

    enableMiniSnap();

    miniWin.loadURL("https://chatgpt.com/?mini=true");

    miniWin.on("closed", () => {
        miniWin = null;
    });

    miniWin.webContents.on("did-finish-load", () => {
        injectMiniDragZone();
    });
}



// --------------------------
// BUTTONS IM HAUPTFENSTER
// --------------------------
function injectThemeButton() {
    mainWin.webContents.insertCSS(`
        .floatingBtn {
            position: fixed;
            top: ${buttonY}px;
            left: 70%;
            transform: translateX(-50%);
            padding: 6px 14px;
            font-size: 14px;
            z-index: 999999;
            border-radius: 6px;
            cursor: pointer;
            background: rgba(0,0,0,0);
            color: inherit;
            border: 1px solid rgba(0,0,0,0.4);
            user-select: none;
        }

        #themeToggleBtn { margin-left: ${buttonXOffset}px; }
        #miniToggleBtn  { margin-left: ${buttonXOffsetMini}px; }
    `);

    const nextLabel = theme === "light" ? "Dark-Modus" : "Light-Modus";

    mainWin.webContents.executeJavaScript(`
        (function() {
            const old1 = document.getElementById("themeToggleBtn");
            if (old1) old1.remove();

            const old2 = document.getElementById("miniToggleBtn");
            if (old2) old2.remove();

            // Theme-Button
            const btn = document.createElement("button");
            btn.id = "themeToggleBtn";
            btn.className = "floatingBtn";
            btn.textContent = "${nextLabel}";

            btn.onclick = () => {
                btn.textContent = (btn.textContent === "Dark-Modus")
                    ? "Light-Modus"
                    : "Dark-Modus";

                window.themeAPI.toggle();
            };

            document.body.appendChild(btn);

            // MiniChat Button
            const mini = document.createElement("button");
            mini.id = "miniToggleBtn";
            mini.className = "floatingBtn";
            mini.textContent = "Mini-Chat";
            mini.onclick = () => window.themeAPI.toggleMini();
            document.body.appendChild(mini);
        })();
    `);
}



// --------------------------
// DRAGZONE IM MINICHAT
// --------------------------
function injectMiniDragZone() {
    miniWin.webContents.insertCSS(`
        #dragAreaMini {
            position: fixed;
            top: 0;
            left: 45%;
            width: 35%;
            height: 50px;
            -webkit-app-region: drag;
            background: rgba(0,0,0,0);
            z-index: 9999999;
        }
    `);

    miniWin.webContents.executeJavaScript(`
        (function() {
            const old = document.getElementById("dragAreaMini");
            if (old) old.remove();

            const drag = document.createElement("div");
            drag.id = "dragAreaMini";
            document.body.appendChild(drag);
        })();
    `);
}



// --------------------------
// THEME FUNKTION
// --------------------------
function applyTheme() {
    nativeTheme.themeSource = theme;
    updateButtonLabel();
}

function updateButtonLabel() {
    const nextLabel = theme === "light" ? "Dark-Modus" : "Light-Modus";

    for (let i = 0; i < 6; i++) {
        setTimeout(() => {
            mainWin.webContents.executeJavaScript(`
                const btn = document.getElementById("themeToggleBtn");
                if (btn) btn.textContent = "${nextLabel}";
            `).catch(() => { });
        }, i * 20);
    }
}



// --------------------------
// IPC
// --------------------------
ipcMain.on("toggle-theme", () => {
    theme = theme === "light" ? "dark" : "light";
    applyTheme();
});

ipcMain.on("toggle-mini", () => {
    if (!miniWin) return createMini();
    miniWin.isVisible() ? miniWin.hide() : miniWin.show();
});



// --------------------------
// TRAY
// --------------------------
function createTray() {
    tray = new Tray(path.join(__dirname, "icon.ico"));

    const menu = Menu.buildFromTemplate([
        { label: "ChatGPT öffnen", click: () => mainWin.show() },
        { label: "Mini-Chat öffnen", click: createMini },
        { type: "separator" },
        { label: "Beenden", click: () => app.quit() }
    ]);

    tray.setToolTip("ChatGPT Desktop");
    tray.setContextMenu(menu);
}



// --------------------------
// AUTO-HEAL DES CACHE (Login bleibt erhalten!)
//
// Wird NUR ausgeführt, wenn der Cache
// wirklich beschädigt ist.
// --------------------------
app.whenReady().then(() => {
    try {
        const quotaDB = path.join(cacheFolder, "QuotaManager");
        if (fs.existsSync(quotaDB)) {
            fs.readFileSync(quotaDB);
        }
    } catch {
        fs.rmSync(cacheFolder, { recursive: true, force: true });
    }

    createMain();
    createTray();

    // Shortcut
    globalShortcut.register("CommandOrControl+Shift+T", () => {
        theme = theme === "light" ? "dark" : "light";
        applyTheme();
    });
});

app.on("window-all-closed", () => { });