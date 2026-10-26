// ==UserScript==
// @name         ZeList - Torn Hitlist (V11.3 Masterclass)
// @namespace    http://tampermonkey.net/
// @version      11.3
// @description  Fixed Container Minimizing, Glowing Gear, Animations, GM Storage
// @author       ZEM [4038551]
// @match        https://www.torn.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    // 1. Data Migration & State Management
    let state = GM_getValue('zelist_data', {});
    let settings = GM_getValue('zelist_settings', { sort: 'recent', open: true, pos: { top: 150, left: window.innerWidth - 280 }, width: 240, height: 350 });

    let oldTargets = JSON.parse(localStorage.getItem('torn_targets'));
    if (oldTargets && Array.isArray(oldTargets)) {
        oldTargets.forEach(t => { if (!state[t.id]) state[t.id] = { name: t.name, id: t.id, tag: 'none', note: '', added: Date.now() }; });
        GM_setValue('zelist_data', state);
        localStorage.removeItem('torn_targets');
    }

    const saveState = () => GM_setValue('zelist_data', state);
    const saveSettings = () => GM_setValue('zelist_settings', settings);

    // 2. Core Variables & Audio Engine
    let currentXID = new URLSearchParams(window.location.search).get('XID');
    let isProfilePage = window.location.pathname.includes('profiles.php');
    let isSettingsOpen = false;
    
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    function playZLSound(type) {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        
        if (type === 'add') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc.start(); osc.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'remove') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
            osc.start(); osc.stop(audioCtx.currentTime + 0.15);
        }
    }

    // 3. Premium CSS
    GM_addStyle(`
        #zelist-container { position: fixed; z-index: 9999; background: rgba(18, 18, 18, 0.85); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; font-family: 'Segoe UI', sans-serif; color: #eee; box-shadow: 0 10px 30px rgba(0,0,0,0.5); transform: translateZ(0); will-change: top, left; display: flex; flex-direction: column; resize: both; overflow: hidden; min-width: 220px; min-height: 200px; }
        
        /* FIX: When minimized, destroy the height constraints and snap to header */
        #zelist-container.zl-minimized { height: auto !important; min-height: 0 !important; resize: none !important; }
        
        #zelist-container.zl-dragging { opacity: 0.7; backdrop-filter: none; box-shadow: none; pointer-events: none; }
        
        #zelist-header { position: relative; padding: 10px 12px; cursor: grab; display: flex; justify-content: space-between; align-items: center; font-weight: bold; color: #fff; user-select: none; border-bottom: 1px solid rgba(255,255,255,0.05); background-color: rgba(26,26,26,0.9); background-image: radial-gradient(circle, #ffcc00 2px, transparent 2px); background-size: 20px 20px; background-position: 0 50%; background-repeat: repeat-x; overflow: hidden; flex-shrink: 0; }
        #zelist-header:active { cursor: grabbing; }
        #zelist-header::after { content: ""; position: absolute; top: 0; left: 0; bottom: 0; background: #1a1a1a; z-index: 1; animation: sweepDots 6s infinite linear; }
        #zelist-header::before { content: ""; position: absolute; top: 50%; transform: translateY(-50%); width: 0; height: 0; border: 8px solid #ffcc00; border-radius: 50%; border-right-color: transparent; z-index: 2; animation: chomp 0.3s infinite, movePacman 6s infinite linear; }
        #zelist-header.anim-paused::after, #zelist-header.anim-paused::before { animation-play-state: paused !important; }
        
        .zelist-header-content { position: relative; z-index: 3; display: flex; justify-content: space-between; width: 100%; text-shadow: 1px 1px 3px rgba(0,0,0,0.9); }
        .zl-header-icons span { cursor: pointer; margin-left: 8px; transition: color 0.2s, transform 0.3s; display: inline-block; }
        .zl-header-icons span:hover { color: #58a6ff; }
        
        @keyframes gearPulse {
            0% { text-shadow: 0 0 5px rgba(88, 166, 255, 0.3); color: #8ab4f8; }
            100% { text-shadow: 0 0 10px rgba(88, 166, 255, 0.9), 0 0 15px rgba(88, 166, 255, 0.5); color: #58a6ff; }
        }
        #zl-btn-gear { animation: gearPulse 1.5s infinite alternate ease-in-out; }
        #zl-btn-gear:hover { animation: none; color: #fff; text-shadow: 0 0 12px #58a6ff, 0 0 20px #58a6ff; transform: rotate(90deg) scale(1.1); }
        
        @keyframes chomp { 0%, 100% { border-right-color: transparent; } 50% { border-right-color: #ffcc00; } }
        @keyframes movePacman { 0% { left: -20px; } 100% { left: calc(100% + 20px); } }
        @keyframes sweepDots { 0% { width: 0; } 100% { width: calc(100% + 30px); } }
        
        @keyframes slideInRight { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes popOut { 0% { opacity: 1; transform: scale(1); } 40% { transform: scale(1.05); } 100% { opacity: 0; transform: scale(0); } }

        #zelist-credits { position: absolute; top: 38px; left: 0; right: 0; bottom: 0; background: rgba(10,10,10,0.95); backdrop-filter: blur(8px); display: flex; flex-direction: column; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.4s ease; z-index: 10; }
        .zl-credit-text { font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; background: linear-gradient(135deg, #f39c12, #f1c40f); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .zl-credit-name { font-size: 15px; margin-top: 4px; letter-spacing: 0; }

        #zelist-body { padding: 10px; display: ${settings.open ? 'flex' : 'none'}; flex-direction: column; gap: 8px; flex-grow: 1; overflow: hidden; position: relative; }
        
        #zl-view-main { display: flex; flex-direction: column; gap: 8px; height: 100%; }
        #zl-view-settings { display: none; flex-direction: column; gap: 8px; height: 100%; font-size: 12px; }
        
        .zl-toolbar { display: flex; justify-content: space-between; font-size: 11px; color: #888; padding-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .zl-sort-btn { cursor: pointer; transition: color 0.2s; } .zl-sort-btn:hover { color: #fff; }

        .zl-list { flex-grow: 1; overflow-y: auto; margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; overflow-x: hidden; }
        .zl-list::-webkit-scrollbar { width: 4px; } .zl-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        
        .zl-item { background: rgba(255,255,255,0.03); border-radius: 4px; border-left: 3px solid transparent; display: flex; flex-direction: column; transition: background 0.15s; user-select: none; }
        .zl-item.anim-slide-in { animation: slideInRight 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .zl-item.anim-pop-out { animation: popOut 0.25s forwards; }
        .zl-item:hover { background: rgba(255,255,255,0.08); }
        .zl-item.tag-red { border-left-color: #ff4444; } .zl-item.tag-green { border-left-color: #00C851; } .zl-item.tag-purple { border-left-color: #aa66cc; } .zl-item.tag-yellow { border-left-color: #ffbb33; }
        
        .zl-item-main { padding: 6px 8px; display: flex; justify-content: space-between; align-items: center; }
        .zl-link { color: #58a6ff; text-decoration: none; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; }
        
        .zl-badges { display: flex; gap: 4px; align-items: center; }
        .zl-icon-btn { font-size: 11px; cursor: pointer; color: #777; transition: color 0.2s; } .zl-icon-btn:hover { color: #fff; }
        .zl-id-badge { font-size: 10px; color: #aaa; background: rgba(0,0,0,0.4); padding: 2px 5px; border-radius: 4px; cursor: copy; } .zl-id-badge:hover { color: #fff; background: #3b5998; }
        
        .zl-note-box { display: none; padding: 0 8px 6px 8px; }
        .zl-item.show-note .zl-note-box { display: block; }
        .zl-note-input { width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #ccc; font-size: 11px; padding: 4px; border-radius: 3px; outline: none; }
        .zl-note-input:focus { border-color: #58a6ff; }
        
        .zl-btn { width: 100%; padding: 6px; cursor: pointer; border: none; border-radius: 4px; font-weight: bold; font-size: 11px; color: white; flex-shrink: 0; }
        .zl-btn-save { background: linear-gradient(135deg, #107c41, #16a053); } .zl-btn-remove { background: linear-gradient(135deg, #a80000, #d91c1c); }
        .zl-textarea { width: 100%; flex-grow: 1; box-sizing: border-box; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 10px; resize: none; padding: 5px; border-radius: 4px; }
        
        .zl-btn-explain { background: rgba(88, 166, 255, 0.15); border: 1px solid rgba(88, 166, 255, 0.3); color: #8ab4f8; margin-top: 2px; transition: all 0.2s ease; border-radius: 4px; padding: 6px; cursor: pointer; font-size: 11px; font-weight: bold; width: 100%; }
        .zl-btn-explain:hover { background: rgba(88, 166, 255, 0.25); color: #fff; border-color: rgba(88, 166, 255, 0.5); }

        .zl-footer { padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.05); flex-shrink: 0; }
        .zl-btn-clear { width: 100%; padding: 6px; cursor: pointer; border: 1px solid rgba(168,0,0,0.5); border-radius: 4px; background: transparent; color: #ff6666; font-size: 11px; transition: all 0.2s; font-weight: bold; }
        .zl-btn-clear:hover { background: rgba(168,0,0,0.2); }
    `);

    // 4. Initial DOM Structure
    const container = document.createElement('div');
    container.id = 'zelist-container';
    container.style.top = `${settings.pos.top}px`;
    container.style.left = `${settings.pos.left}px`;
    container.style.width = `${settings.width}px`;
    container.style.height = `${settings.height}px`;
    
    // Apply minimized state if necessary on load
    if (!settings.open) container.classList.add('zl-minimized');

    container.innerHTML = `
        <div id="zelist-header" class="${settings.open ? '' : 'anim-paused'}">
            <div class="zelist-header-content">
                <span>👾 ZeList (<span id="zelist-count">0</span>)</span>
                <div class="zl-header-icons">
                    <span id="zl-btn-gear" title="Settings / Import">⚙</span>
                    <span id="zelist-toggle">${settings.open ? '▼' : '▲'}</span>
                </div>
            </div>
        </div>
        <div id="zelist-credits"><div class="zl-credit-text">Created By</div><div class="zl-credit-text zl-credit-name">ZEM [4038551]</div></div>
        <div id="zelist-body">
            <div id="zl-view-main">
                <div id="zl-btn-container"></div>
                <div class="zl-toolbar">
                    <span>Sort: <span id="zl-sort-label" class="zl-sort-btn">${settings.sort.toUpperCase()}</span></span>
                    <span style="font-size:9px; color:#555;">(R-Click to Del)</span>
                </div>
                <ul class="zl-list" id="zl-ul"></ul>
                <div id="zl-footer-container" class="zl-footer" style="display: none;">
                    <button class="zl-btn-clear" data-action="clear-all">Clear All Targets</button>
                </div>
            </div>
            <div id="zl-view-settings">
                <div style="color:#58a6ff; font-weight:bold; cursor:pointer;" id="zl-btn-back">← Back to List</div>
                <textarea id="zl-import-text" class="zl-textarea" placeholder="Paste export code here..."></textarea>
                <div style="display:flex; gap:5px;">
                    <button class="zl-btn" style="background:#444;" id="zl-btn-export">Copy Export</button>
                    <button class="zl-btn zl-btn-save" id="zl-btn-import">Import</button>
                </div>
                
                <button class="zl-btn-explain" id="zl-btn-explain">ℹ️ Export Explained (Click Me)</button>
                <div id="zl-export-info" style="display:none; background:rgba(0,0,0,0.5); padding:8px; border-radius:4px; font-size:10px; color:#ccc; border:1px solid rgba(255,255,255,0.1); margin-top:2px; line-height:1.4; max-height:80px; overflow-y:auto;">
                    <b style="color:#58a6ff;">Faction Sharing:</b> Paste your code in Discord. Mates can import it to instantly load your chain/war targets.<br><br>
                    <b style="color:#58a6ff;">Backups:</b> Save your list to transfer it to your phone or another browser without losing your tags and notes.
                </div>

                <button class="zl-btn-clear" style="margin-top:auto;" data-action="clear-export">Clear Export Box</button>
            </div>
        </div>
    `;
    document.body.appendChild(container);

    // 5. Dynamic Name Extractor
    function extractPlayerName(xid) {
        if (!xid) return "Unknown";
        let titleMatch = document.title.match(new RegExp(`([a-zA-Z0-9_-]+)\\s*\\[${xid}\\]`));
        if (titleMatch) return titleMatch[1].trim();

        const elements = document.querySelectorAll('h1, h2, h3, h4, h5, span, div, a');
        for (let el of elements) {
            if (el.innerText && el.innerText.length < 50) {
                let domMatch = el.innerText.match(new RegExp(`^\\s*([a-zA-Z0-9_-]+)\\s*\\[${xid}\\]`));
                if (domMatch) return domMatch[1].trim();
            }
        }
        const reactNameNode = document.querySelector('div[class*="user-information"] [class*="name_"], div[class*="profile-wrapper"] [class*="name_"]');
        if (reactNameNode && reactNameNode.innerText && !reactNameNode.innerText.includes('[')) return reactNameNode.innerText.trim();

        return "Unknown";
    }

    // 6. Dynamic Rendering
    const getSortText = () => settings.sort === 'alpha' ? 'A-Z' : settings.sort === 'id' ? 'ID' : 'NEW';
    const tagColors = ['none', 'red', 'green', 'purple', 'yellow'];

    function renderList() {
        const ul = document.getElementById('zl-ul');
        let arr = Object.values(state);
        
        if (settings.sort === 'alpha') arr.sort((a, b) => a.name.localeCompare(b.name));
        else if (settings.sort === 'id') arr.sort((a, b) => parseInt(a.id) - parseInt(b.id));
        else arr.sort((a, b) => b.added - a.added);

        ul.innerHTML = arr.map(t => {
            const isNew = (Date.now() - t.added) < 1000 ? 'anim-slide-in' : '';
            return `
            <li class="zl-item tag-${t.tag} ${isNew}" data-id="${t.id}">
                <div class="zl-item-main">
                    <a href="https://www.torn.com/profiles.php?XID=${t.id}" class="zl-link">${t.name}</a>
                    <div class="zl-badges">
                        <span class="zl-icon-btn" data-action="tag" title="Cycle Color">⚑</span>
                        <span class="zl-icon-btn" data-action="note" title="Notes">✎</span>
                        <span class="zl-id-badge" data-action="copy">${t.id}</span>
                    </div>
                </div>
                <div class="zl-note-box">
                    <input type="text" class="zl-note-input" value="${t.note || ''}" placeholder="Add tactical note..." data-id="${t.id}">
                </div>
            </li>`;
        }).join('');
        
        const count = Object.keys(state).length;
        document.getElementById('zelist-count').innerText = count;
        document.getElementById('zl-sort-label').innerText = getSortText();
        
        const footer = document.getElementById('zl-footer-container');
        if (footer) footer.style.display = count > 0 ? 'block' : 'none';
    }

    function renderProfileButton() {
        const btnContainer = document.getElementById('zl-btn-container');
        if (!btnContainer || !isProfilePage || !currentXID) { btnContainer.innerHTML = ''; return; }
        
        btnContainer.innerHTML = state[currentXID] 
            ? `<button class="zl-btn zl-btn-remove" data-action="remove-current">Remove from ZeList</button>`
            : `<button class="zl-btn zl-btn-save" data-action="add-current">Save to ZeList</button>`;
    }

    function animateAndRemove(id) {
        playZLSound('remove');
        const li = document.querySelector(`.zl-item[data-id="${id}"]`);
        if (li) {
            li.classList.add('anim-pop-out');
            setTimeout(() => {
                delete state[id]; saveState(); renderList(); renderProfileButton();
            }, 240); 
        } else {
            delete state[id]; saveState(); renderList(); renderProfileButton();
        }
    }

    // 7. SPA Location Observer
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            currentXID = new URLSearchParams(window.location.search).get('XID');
            isProfilePage = window.location.pathname.includes('profiles.php');
            renderProfileButton();
        }
    }).observe(document, { subtree: true, childList: true });

    // 8. Core Logic & Event Delegation
    let longPressTimer;
    let isDragging = false, dragStartX, dragStartY, initialTop, initialLeft, rafId = null;
    
    // Drag Logic Start
    container.addEventListener('mousedown', (e) => {
        if (e.target.closest('#zelist-header') && !e.target.closest('.zl-header-icons')) {
            if(e.button !== 0) return; 
            e.preventDefault(); 
            isDragging = false; 
            dragStartX = e.clientX; 
            dragStartY = e.clientY;
            initialTop = container.offsetTop; 
            initialLeft = container.offsetLeft;
            document.onmouseup = closeDrag; 
            document.onmousemove = onMouseMove;
            return;
        }

        // Long Press to Delete
        const item = e.target.closest('.zl-item');
        if (item && e.button === 0 && !e.target.closest('.zl-badges, .zl-note-box, .zl-link')) {
            const id = item.dataset.id;
            longPressTimer = setTimeout(() => {
                if (confirm(`Remove ${state[id].name} [${id}] from your ZeList?`)) animateAndRemove(id);
            }, 800);
        }
    });

    container.addEventListener('mouseup', () => clearTimeout(longPressTimer));
    container.addEventListener('mouseleave', () => clearTimeout(longPressTimer));

    container.addEventListener('contextmenu', (e) => {
        const item = e.target.closest('.zl-item');
        if (item) {
            e.preventDefault();
            const id = item.dataset.id;
            if (confirm(`Remove ${state[id].name} [${id}] from your ZeList?`)) animateAndRemove(id);
        } else if (e.target.closest('#zelist-header')) {
            e.preventDefault();
            const creds = document.getElementById('zelist-credits');
            creds.style.opacity = '1';
            setTimeout(() => creds.style.opacity = '0', 5000);
        }
    });

    container.addEventListener('click', (e) => {
        const target = e.target;
        
        if (target.dataset.action === 'add-current') {
            playZLSound('add');
            let finalName = extractPlayerName(currentXID);
            state[currentXID] = { id: currentXID, name: finalName, tag: 'none', note: '', added: Date.now() };
            saveState(); renderList(); renderProfileButton();
        }
        else if (target.dataset.action === 'remove-current') {
            animateAndRemove(currentXID);
        }
        else if (target.dataset.action === 'clear-all') {
            if (confirm("WIPE ENTIRE LIST? This cannot be undone.")) {
                playZLSound('remove');
                state = {}; saveState(); renderList(); renderProfileButton();
            }
            return;
        }
        else if (target.dataset.action === 'clear-export') {
            document.getElementById('zl-import-text').value = '';
            return;
        }
        
        const item = target.closest('.zl-item');
        if (!item) return;
        const id = item.dataset.id;

        if (target.dataset.action === 'copy') {
            GM_setClipboard(id);
            const orig = target.innerText; target.innerText = 'Copied!';
            setTimeout(() => target.innerText = orig, 1000);
        }
        else if (target.dataset.action === 'tag') {
            let curIdx = tagColors.indexOf(state[id].tag);
            state[id].tag = tagColors[(curIdx + 1) % tagColors.length];
            saveState(); renderList();
        }
        else if (target.dataset.action === 'note') {
            item.classList.toggle('show-note');
            if (item.classList.contains('show-note')) item.querySelector('.zl-note-input').focus();
        }
    });

    container.addEventListener('input', (e) => {
        if (e.target.classList.contains('zl-note-input')) {
            state[e.target.dataset.id].note = e.target.value;
            saveState();
        }
    });

    // 9. Toolbar & Navigation
    document.getElementById('zl-sort-label').addEventListener('click', () => {
        const sorts = ['recent', 'alpha', 'id'];
        settings.sort = sorts[(sorts.indexOf(settings.sort) + 1) % sorts.length];
        saveSettings(); renderList();
    });

    document.getElementById('zl-btn-gear').addEventListener('click', () => {
        isSettingsOpen = true;
        document.getElementById('zl-view-main').style.display = 'none';
        document.getElementById('zl-view-settings').style.display = 'flex';
    });

    document.getElementById('zl-btn-back').addEventListener('click', () => {
        isSettingsOpen = false;
        document.getElementById('zl-view-settings').style.display = 'none';
        document.getElementById('zl-view-main').style.display = 'flex';
    });

    // 10. Import / Export / Info
    document.getElementById('zl-btn-export').addEventListener('click', (e) => {
        const str = btoa(JSON.stringify(state)); 
        document.getElementById('zl-import-text').value = str;
        GM_setClipboard(str);
        e.target.innerText = "Copied to Clipboard!";
        setTimeout(() => e.target.innerText = "Copy Export", 2000);
    });

    document.getElementById('zl-btn-import').addEventListener('click', () => {
        try {
            const imported = JSON.parse(atob(document.getElementById('zl-import-text').value));
            Object.assign(state, imported);
            saveState(); renderList();
            document.getElementById('zl-btn-back').click();
        } catch(err) { alert("Invalid Export String"); }
    });

    document.getElementById('zl-btn-explain').addEventListener('click', () => {
        const info = document.getElementById('zl-export-info');
        info.style.display = info.style.display === 'none' ? 'block' : 'none';
    });

    // 11. Window State Management
    function onMouseMove(e) {
        if (!rafId) rafId = requestAnimationFrame(() => {
            if (!isDragging && (Math.abs(e.clientX - dragStartX) > 3 || Math.abs(e.clientY - dragStartY) > 3)) {
                isDragging = true;
                container.classList.add('zl-dragging'); 
            }
            if (isDragging) {
                container.style.top = (initialTop + (e.clientY - dragStartY)) + "px";
                container.style.left = (initialLeft + (e.clientX - dragStartX)) + "px";
            }
            rafId = null;
        });
    }

    function closeDrag() {
        document.onmouseup = null; 
        document.onmousemove = null;
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        if (isDragging) {
            container.classList.remove('zl-dragging');
            settings.pos = { top: container.offsetTop, left: container.offsetLeft };
            saveSettings();
            setTimeout(() => isDragging = false, 50); 
        }
    }

    // Toggle minimize on click anywhere in header
    document.getElementById('zelist-header').addEventListener('click', (e) => {
        if (isDragging) return; 
        if (e.target.closest('#zl-btn-gear')) return; 

        settings.open = !settings.open;
        document.getElementById('zelist-body').style.display = settings.open ? 'flex' : 'none';
        document.getElementById('zelist-toggle').innerText = settings.open ? '▼' : '▲';
        
        if (settings.open) {
            document.getElementById('zelist-header').classList.remove('anim-paused');
            container.classList.remove('zl-minimized');
        } else {
            document.getElementById('zelist-header').classList.add('anim-paused');
            container.classList.add('zl-minimized');
        }
        saveSettings();
    });

    // Only save ResizeObserver height if it is NOT minimized!
    new ResizeObserver(() => {
        if (!settings.open) return;
        if (container.offsetWidth !== settings.width || container.offsetHeight !== settings.height) {
            settings.width = container.offsetWidth;
            settings.height = container.offsetHeight;
            saveSettings();
        }
    }).observe(container);

    renderProfileButton();
    renderList();
})();
