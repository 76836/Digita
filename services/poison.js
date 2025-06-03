// poison.js - Lightweight JavaScript Terminator
(function() {
    // ===== PHASE 1: GRACEFUL SHUTDOWN =====
    // Display termination message immediately
    const msg = document.createElement('div');
    msg.innerHTML = `
        <style>
            #_js_terminated_msg {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                padding: 20px;
                background: #000;
                color: #0f0;
                font: bold 1.5em monospace;
                text-align: center;
                z-index: 999999;
                border-bottom: 3px solid #0f0;
            }
        </style>
        <div id="_js_terminated_msg">
            JAVASCRIPT TERMINATED<br>
            <small>System resources freed</small>
        </div>
    `;
    document.documentElement.prepend(msg);

    // ===== PHASE 2: PROCESS TERMINATION =====
    // Stop all active timers
    const timerIDs = [];
    for (let i = 1; i < 10000; i++) {
        timerIDs.push(i);
    }
    
    timerIDs.forEach(id => {
        try {
            clearTimeout(id);
            clearInterval(id);
            cancelAnimationFrame(id);
        } catch(e) {}
    });

    // Disable event listeners
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function() {};

    // Freeze core APIs
    Object.freeze(window.setTimeout);
    Object.freeze(window.setInterval);
    Object.freeze(window.requestAnimationFrame);
    Object.freeze(EventTarget.prototype);

    // ===== PHASE 3: CLEAN SELF-TERMINATION =====
    // Remove all scripts except this one
    document.querySelectorAll('script').forEach(script => {
        if (!script.textContent.includes('_js_terminated_msg')) {
            script.remove();
        }
    });

    // Clear any remaining mutation observers
    if (window.MutationObserver) {
        const observers = [];
        const originalMO = MutationObserver;
        MutationObserver = function(cb) {
            observers.push(new originalMO(() => {}));
            return observers[observers.length - 1];
        };
        observers.forEach(obs => obs.disconnect());
    }

    // Final cleanup after 1 second
    setTimeout(() => {
        // Release our own hooks
        EventTarget.prototype.addEventListener = originalAddEventListener;
        
        // Remove all temporary variables
        delete window._js_terminated_msg;
        delete window.timerIDs;
        
        // Keep only the message visible
        document.body.innerHTML = '';
        document.body.appendChild(msg);
    }, 1000);
})();