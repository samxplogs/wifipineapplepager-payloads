function createModal(id, title, contentHTML) {
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.textContent = `
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); }
        .modal { background: #1e1e1e; color: #fff; border-radius: 10px; width: 440px; max-width: 90%; padding: 20px; box-shadow: 0 10px 40px rgba(0,0,0,.6); font-family: sans-serif; position: relative; z-index: 10000; }
        .modal h2 { margin: 0 0 10px; font-size: 18px; color: #fff; font-weight: 600; }
        .modal-hr { border: 0; height: 1px; background: #333; margin: 0 0 18px 0; }
        .modal .modal-close, .modal .modal-reset, .btn-apply, .btn-unapply, .btn-color-reset { 
            margin-top: 8px; width: 100%; padding: 8px; border-radius: 6px; border: none; cursor: pointer; 
            font-weight: 600; font-size: 14px; transition: transform 0.1s, background 0.2s; 
        }
        .modal .modal-close:active, .modal .modal-reset:active, .btn-apply:active, .btn-unapply:active, .btn-color-reset:active { 
            transform: scale(0.96); filter: brightness(0.8); 
        }
        .modal .modal-close { background: #ff5252; color: #fff; }
        .modal-links .lib-item { display: flex; align-items: center; padding: 10px; border-radius: 6px; margin-bottom: 8px; background: #2b2b2b; color: #fff; gap: 10px; }
        .btn-apply { background: #007acc; color: #fff; width: auto; padding: 5px 12px; font-size: 12px; min-width: 75px; }
        .btn-unapply { background: #ff5252; color: #fff; width: auto; padding: 5px 12px; font-size: 12px; min-width: 75px; }
        .btn-color-reset { background: #555; color: #fff; width: auto; padding: 5px 10px; font-size: 11px; margin-top: 0; }
        .modal-reset { background: #444; color: white; width: 100%; }
        input[type="color"] { -webkit-appearance: none; width: 60px; height: 34px; border: none; padding: 0; background: none; cursor: pointer; }
        input[type="color"]::-webkit-color-swatch { border: 1px solid #333; border-radius: 6px; }
    `;
    document.head.appendChild(style);
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = id;
    overlay.style.display = "none";
    overlay.innerHTML = `
        <div class="modal" onclick="event.stopPropagation()">
            <h2>${title}</h2>
            <hr class="modal-hr">
            <div class="modal-content">${contentHTML}</div>
            <button class="modal-close">Close</button>
        </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector(".modal-close").onclick = () => overlay.style.display = "none";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = "none"; };
}

function showModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) overlay.style.display = "flex";
}

async function getFullConfig() {
    const res = await sendServerRequest("listconfig", undefined, true, true);
    return res?.config || {};
}

async function saveFullConfig(newData) {
    const current = await getFullConfig();
    const merged = { ...current, ...newData };
    return await sendServerRequest("setconfig", JSON.stringify(merged), false, true);
}

async function sendServerRequest(action, data, returnJson = false, authenticated = true) {
    const url = new URL(`http://${window.location.hostname}:4040/cgi-bin/api.sh`);
    url.searchParams.set("action", action);
    if (authenticated) {
        const serverid = localStorage.getItem("serverid");
        if (!serverid) return;
        const cookieName = `AUTH_${serverid}`;
        const cookieValue = document.cookie.split("; ").find(c => c.startsWith(cookieName + "="));
        if (!cookieValue) return;
        url.searchParams.set("token", cookieValue.substring(cookieName.length + 1));
        url.searchParams.set("serverid", serverid);
    }
    const options = { method: action === "setconfig" ? "POST" : "GET" };
    if (action === "setconfig") options.body = data;
    else if (data) url.searchParams.set("data", data);
    try {
        const r = await fetch(url.toString(), options);
        return returnJson ? await r.json() : r;
    } catch(e) { console.error(e); }
}

function applyTheme(value, isColorOnly = false) {
    if (!value) return;
    let styleTag = document.getElementById("dynamic-skinner-css");
    if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = "dynamic-skinner-css";
        document.head.appendChild(styleTag);
    }
    const isImage = !isColorOnly && (value.startsWith("data:") || value.startsWith("http"));
    const cssRule = isImage 
        ? `background-image: url("${value}") !important; background-size: cover !important; background-position: center !important; background-repeat: no-repeat !important; background-attachment: fixed !important;` 
        : `background-color: ${value} !important; background-image: none !important;`;
    styleTag.textContent = `body, #sidebarnav, #sidebarbutton, #sidebarbutton.toggle { ${cssRule} }`;
}

function initLootUI() {
    createModal("lootModal", "Download Specific Loot", '<div class="modal-links"></div>');
    const ul = document.querySelector("#sidebarnav ul");
    if (!ul || document.getElementById("lootSidebarBtn")) return;
    const li = document.createElement("li");
    li.innerHTML = `<a href="#" id="lootSidebarBtn"><i class="material-icons">download</i><div class="sidebarsub">Download Specific Loot<div class="sidebarmini">Download a specific loot folder from /root/loot</div></div></a>`;
    ul.appendChild(li);
    document.getElementById("lootSidebarBtn").onclick = async e => {
        e.preventDefault();
        showModal("lootModal");
        const container = document.querySelector("#lootModal .modal-links");
        container.innerHTML = '<p style="color:#aaa;">Fetching loot...</p>';
        const res = await sendServerRequest("command", "ls /root/loot/ | tr '\\n' ','", true);
        if (res?.status === "done") {
            const list = res.output.trim().split(",").filter(Boolean);
            container.innerHTML = list.length ? "" : "<p>No loot found.</p>";
            list.forEach(dir => {
                const a = document.createElement("a");
                a.className = "lib-item"; 
                a.innerHTML = `<i class="material-icons">folder</i> <span>${dir.trim()}</span>`;
                a.onclick = () => window.location.href = `/api/files/zip/root/loot/${dir.trim()}`;
                container.appendChild(a);
            });
        }
    };
}

function initPagerSkinner() {
    const defaultHex = "#303030";
    const contentHTML = `
        <h3 style="margin: 0 0 8px 0; font-size:14px; color:#ddd;">Background Color</h3>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
            <input type="color" id="backgroundColorPicker" value="${defaultHex}">
            <button id="btnResetDefault" class="btn-color-reset">Reset to Default</button>
        </div>
        <hr class="modal-hr" style="margin: 15px 0;">
        <h3 style="margin: 0 0 8px 0; font-size:14px; color:#ddd;">Upload Image</h3>
        <input type="text" id="imgName" placeholder="Name" style="width:100%; box-sizing:border-box; padding:8px; border-radius:4px; border:1px solid #333; background:#2b2b2b; color:#fff; margin-bottom:10px;">
        <input type="file" id="imgFile" accept="image/*" style="width:100%; color:#aaa; font-size:12px; margin-bottom:10px;">
        <button id="btnUpload" class="modal-reset" style="margin-bottom:15px;">Add to Library</button>
        <h3 style="margin: 0 0 8px 0; font-size:14px; color:#ddd;">Background Library</h3>
        <div id="libraryList" class="modal-links" style="max-height: 200px; overflow-y: auto;"></div>
    `;

    const renderLibrary = (config, overlay) => {
        const listContainer = overlay.querySelector("#libraryList");
        const backgrounds = config.savedBackgrounds || [];
        const currentActiveName = config.appliedBackgroundName || "";
        listContainer.innerHTML = backgrounds.length ? "" : '<p style="color:#666; font-size:12px; font-style:italic;">No images saved.</p>';
        
        backgrounds.forEach((bg, index) => {
            const isApplied = (currentActiveName === bg.name);
            const div = document.createElement("div");
            div.className = "lib-item";
            div.innerHTML = `<i class="material-icons">image</i><span style="flex:1; overflow:hidden; text-overflow:ellipsis;">${bg.name}</span><button class="${isApplied ? 'btn-unapply' : 'btn-apply'}">${isApplied ? 'Unapply' : 'Apply'}</button><i class="material-icons delete-btn" style="font-size:18px; color:#ff5252; cursor:pointer;">delete</i>`;
            
            const actionBtn = div.querySelector(isApplied ? ".btn-unapply" : ".btn-apply");
            actionBtn.onclick = async () => {
                if (isApplied) {
                    await saveFullConfig({ appliedBackgroundName: "" });
                    applyTheme(config.backgroundHex || defaultHex, true);
                } else {
                    await saveFullConfig({ appliedBackgroundName: bg.name });
                    applyTheme(bg.url);
                }
                const newConf = await getFullConfig();
                renderLibrary(newConf, overlay);
            };

            div.querySelector(".delete-btn").onclick = async () => {
                if(!confirm(`Delete "${bg.name}"?`)) return;
                backgrounds.splice(index, 1);
                const update = { savedBackgrounds: backgrounds };
                if (currentActiveName === bg.name) {
                    update.appliedBackgroundName = "";
                    applyTheme(config.backgroundHex || defaultHex, true);
                }
                await saveFullConfig(update);
                renderLibrary({ ...config, ...update }, overlay);
            };
            listContainer.appendChild(div);
        });
    };

    const handleUpload = async (overlay) => {
        const nameInput = overlay.querySelector("#imgName"), fileInput = overlay.querySelector("#imgFile"), file = fileInput.files[0];
        if (!nameInput.value || !file) return alert("Missing name or file.");
        const reader = new FileReader();
        reader.onload = async (e) => {
            const config = await getFullConfig();
            const backgrounds = config.savedBackgrounds || [];
            backgrounds.push({ name: nameInput.value, url: e.target.result });
            await saveFullConfig({ savedBackgrounds: backgrounds });
            nameInput.value = ""; fileInput.value = "";
            renderLibrary({ ...config, savedBackgrounds: backgrounds }, overlay);
        };
        reader.readAsDataURL(file);
    };

    createModal("pagerSkinnerModal", "Pager Skinner Settings", contentHTML);

    const overlay = document.getElementById("pagerSkinnerModal");
    overlay.querySelector("#btnUpload").onclick = () => handleUpload(overlay);
    
    overlay.querySelector("#backgroundColorPicker").onchange = async (e) => {
        const hex = e.target.value;
        await saveFullConfig({ backgroundHex: hex, appliedBackgroundName: "" });
        applyTheme(hex, true);
        const config = await getFullConfig();
        renderLibrary(config, overlay);
    };
    
    overlay.querySelector("#backgroundColorPicker").oninput = (e) => applyTheme(e.target.value, true);

    overlay.querySelector("#btnResetDefault").onclick = async () => {
        const picker = overlay.querySelector("#backgroundColorPicker");
        picker.value = defaultHex;
        await saveFullConfig({ backgroundHex: defaultHex, appliedBackgroundName: "" });
        applyTheme(defaultHex, true);
        const config = await getFullConfig();
        renderLibrary(config, overlay);
    };

    const ul = document.querySelector("#sidebarnav ul");
    if (!ul || document.getElementById("pagerSkinnerBtn")) return;
    const li = document.createElement("li");
    li.innerHTML = `<a href="#" id="pagerSkinnerBtn"><i class="material-icons">color_lens</i><div class="sidebarsub">Pager Skinner<div class="sidebarmini">Skin your pager</div></div></a>`;
    ul.appendChild(li);
    document.getElementById("pagerSkinnerBtn").onclick = async (e) => {
        e.preventDefault();
        showModal("pagerSkinnerModal");
        const config = await getFullConfig();
        renderLibrary(config, overlay);
        if (config.backgroundHex) overlay.querySelector("#backgroundColorPicker").value = config.backgroundHex;
    };
}

async function loadConfigAndApply() {
    const config = await getFullConfig();
    const activeName = config.appliedBackgroundName;
    const backgrounds = config.savedBackgrounds || [];
    if (activeName) {
        const activeObj = backgrounds.find(b => b.name === activeName);
        if (activeObj) { applyTheme(activeObj.url); return; }
    }
    applyTheme(config.backgroundHex || "#303030", true);
}

function onSidebarReady() {
    initLootUI();
    initPagerSkinner();
    loadConfigAndApply();
    fetch("/api/api_ping").then(res => res.json()).then(data => { if (data.serverid) localStorage.setItem("serverid", data.serverid); }).catch(()=>{});
}

function startInitialization() {
    if (!document.body) { window.requestAnimationFrame(startInitialization); return; }
    if (document.getElementById("sidebarnav")) onSidebarReady();
    else {
        const observer = new MutationObserver(() => {
            if (document.getElementById("sidebarnav")) { onSidebarReady(); observer.disconnect(); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
}
startInitialization();