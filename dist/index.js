"use strict";
const root = document.body;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const reveals = document.querySelectorAll(".reveal");
const cursorRing = document.querySelector(".cursor-ring");
const cursorDot = document.querySelector(".cursor-dot");
const themeToggle = document.querySelector(".theme-toggle");
const themeQuery = window.matchMedia("(prefers-color-scheme: light)");
const storedTheme = window.localStorage.getItem("theme");
const initialTheme = storedTheme === "light" || storedTheme === "dark"
    ? storedTheme
    : themeQuery.matches ? "light" : "dark";
const applyTheme = (theme, persist = true) => {
    root.dataset.theme = theme;
    if (themeToggle) {
        const nextTheme = theme === "dark" ? "light" : "dark";
        themeToggle.textContent = nextTheme;
        themeToggle.setAttribute("aria-label", `switch to ${nextTheme} mode`);
        themeToggle.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
    }
    if (persist) {
        window.localStorage.setItem("theme", theme);
    }
};
applyTheme(initialTheme, false);
if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        applyTheme(root.dataset.theme === "light" ? "dark" : "light");
    });
}
themeQuery.addEventListener("change", (event) => {
    if (window.localStorage.getItem("theme"))
        return;
    applyTheme(event.matches ? "light" : "dark", false);
});
const observer = new IntersectionObserver((entries, intersectionObserver) => {
    entries.forEach((entry) => {
        if (!entry.isIntersecting)
            return;
        entry.target.classList.add("in-view");
        intersectionObserver.unobserve(entry.target);
    });
}, {
    threshold: 0.18,
    rootMargin: "0px 0px -8% 0px"
});
reveals.forEach((element) => {
    if (!element.classList.contains("load-in"))
        observer.observe(element);
});
window.addEventListener("load", () => {
    root.classList.add("is-ready");
});
const tracks = document.querySelectorAll(".track");
const spotifyHost = document.querySelector(".spotify-controller-slot");
const spotifyWindow = window;
let activeTrack = null;
let isPlaying = false;
let spotifyController = null;
let spotifyReady = false;
let pendingPlay = false;
let pendingPlayUntil = 0;
let requestedSpotifyUri = null;
let suppressPlaybackUpdatesUntil = 0;
let switchingTrack = false;
const syncTrackButtons = () => {
    tracks.forEach((track) => {
        const button = track.querySelector(".track-play");
        if (!button)
            return;
        const isCurrent = track === activeTrack;
        const showPause = isCurrent && (isPlaying || pendingPlay);
        const showLoading = isCurrent && switchingTrack && pendingPlay;
        track.classList.toggle("is-open", showPause || showLoading);
        button.textContent = showLoading ? "loading" : showPause ? "pause" : "play";
        button.setAttribute("aria-pressed", showPause ? "true" : "false");
        button.disabled = !spotifyReady;
    });
};
spotifyWindow.onSpotifyIframeApiReady = (api) => {
    const firstTrackUri = tracks[0]?.dataset.spotifyUri;
    if (!spotifyHost || !firstTrackUri)
        return;
    api.createController(spotifyHost, {
        uri: firstTrackUri,
        width: 320,
        height: 80
    }, (controller) => {
        spotifyController = controller;
        controller.addListener("ready", () => {
            spotifyReady = true;
            syncTrackButtons();
        });
        controller.addListener("playback_started", () => {
            pendingPlay = false;
            pendingPlayUntil = 0;
            suppressPlaybackUpdatesUntil = 0;
            switchingTrack = false;
            isPlaying = true;
            syncTrackButtons();
        });
        controller.addListener("playback_update", (event) => {
            if (Date.now() < suppressPlaybackUpdatesUntil) {
                syncTrackButtons();
                return;
            }
            const playingUri = typeof event?.data?.playingURI === "string" ? event.data.playingURI : null;
            const paused = Boolean(event?.data?.isPaused);
            const buffering = Boolean(event?.data?.isBuffering);
            const withinPendingWindow = pendingPlay && Date.now() < pendingPlayUntil;
            const isCurrentTrackEvent = !requestedSpotifyUri || !playingUri || playingUri === requestedSpotifyUri;
            if (!isCurrentTrackEvent)
                return;
            if (withinPendingWindow && (buffering || paused)) {
                syncTrackButtons();
                return;
            }
            pendingPlay = false;
            pendingPlayUntil = 0;
            switchingTrack = false;
            isPlaying = !paused;
            syncTrackButtons();
        });
    });
};
tracks.forEach((track) => {
    const button = track.querySelector(".track-play");
    if (!button)
        return;
    button.disabled = true;
    button.addEventListener("click", () => {
        const spotifyUri = track.dataset.spotifyUri;
        if (!spotifyController || !spotifyReady || !spotifyUri)
            return;
        if (activeTrack === track) {
            if (isPlaying) {
                pendingPlay = false;
                pendingPlayUntil = 0;
                requestedSpotifyUri = spotifyUri;
                suppressPlaybackUpdatesUntil = 0;
                switchingTrack = false;
                isPlaying = false;
                syncTrackButtons();
                spotifyController.pause();
            }
            else {
                pendingPlay = true;
                pendingPlayUntil = Date.now() + 4000;
                requestedSpotifyUri = spotifyUri;
                suppressPlaybackUpdatesUntil = Date.now() + 1500;
                switchingTrack = false;
                isPlaying = true;
                syncTrackButtons();
                spotifyController.resume();
            }
            return;
        }
        spotifyController.loadUri(spotifyUri);
        activeTrack = track;
        isPlaying = true;
        pendingPlay = true;
        pendingPlayUntil = Date.now() + 4000;
        requestedSpotifyUri = spotifyUri;
        suppressPlaybackUpdatesUntil = Date.now() + 2000;
        switchingTrack = true;
        syncTrackButtons();
        spotifyController.play();
    });
});
syncTrackButtons();
const canvas = document.getElementById("field");
if (!(canvas instanceof HTMLCanvasElement))
    throw new Error("Canvas element #field was not found.");
const ctx = canvas.getContext("2d");
if (!ctx)
    throw new Error("2D canvas context is unavailable.");
const panel = canvas.parentElement;
if (!(panel instanceof HTMLElement))
    throw new Error("Canvas parent element is unavailable.");
const browser = panel.querySelector("#game-browser");
const browserClose = panel.querySelector("#game-browser-close");
const browserReset = panel.querySelector("#game-reset");
const browserTitle = panel.querySelector(".browser-title");
const objectButtons = Array.from(panel.querySelectorAll("[data-object]"));
const motionButton = panel.querySelector(".motion-button");
const mobileCanvasQuery = window.matchMedia("(max-width: 920px)");
let isMobileCanvas = mobileCanvasQuery.matches;
let motionPermissionAttempted = false;
let motionTrackingEnabled = false;
let browserOpen = false;
let activeObject = "ball";
const syncBrowserState = () => {
    if (!browser)
        return;
    browser.classList.toggle("is-open", browserOpen && !isMobileCanvas);
    browser.setAttribute("aria-hidden", browserOpen && !isMobileCanvas ? "false" : "true");
    if (browserTitle)
        browserTitle.textContent = activeObject;
    objectButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.object === activeObject);
    });
};
syncBrowserState();
const canUseCustomCursor = window.matchMedia("(pointer: fine)").matches && Boolean(cursorRing) && Boolean(cursorDot);
if (canUseCustomCursor && cursorRing && cursorDot) {
    root.classList.add("cursor-on");
    const cursorState = {
        x: window.innerWidth * 0.5,
        y: window.innerHeight * 0.5,
        ringX: window.innerWidth * 0.5,
        ringY: window.innerHeight * 0.5,
        dotX: window.innerWidth * 0.5,
        dotY: window.innerHeight * 0.5
    };
    const interactiveSelector = "a, button, #field, .chip, .button, .link-row";
    const animateCursor = () => {
        cursorState.ringX += (cursorState.x - cursorState.ringX) * 0.68;
        cursorState.ringY += (cursorState.y - cursorState.ringY) * 0.68;
        cursorState.dotX = cursorState.x;
        cursorState.dotY = cursorState.y;
        cursorRing.style.transform = `translate3d(${cursorState.ringX}px, ${cursorState.ringY}px, 0)`;
        cursorDot.style.transform = `translate3d(${cursorState.dotX}px, ${cursorState.dotY}px, 0)`;
        window.requestAnimationFrame(animateCursor);
    };
    window.addEventListener("pointermove", (event) => {
        cursorState.x = event.clientX;
        cursorState.y = event.clientY;
        root.classList.add("cursor-visible");
        root.classList.toggle("cursor-hover", Boolean(event.target?.closest(interactiveSelector)));
    });
    window.addEventListener("pointerdown", () => root.classList.add("cursor-down"));
    window.addEventListener("pointerup", () => root.classList.remove("cursor-down"));
    window.addEventListener("pointerleave", () => root.classList.remove("cursor-visible", "cursor-hover", "cursor-down"));
    window.requestAnimationFrame(animateCursor);
}
const state = {
    width: 0,
    height: 0,
    dpr: Math.min(window.devicePixelRatio || 1, 2)
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const isLightTheme = () => root.dataset.theme === "light";
const ball = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 30,
    angle: 0,
    grabbed: false,
    dragOffsetX: 0,
    dragOffsetY: 0
};
const resetBall = () => {
    ball.x = state.width * 0.5;
    ball.y = state.height * 0.18;
    ball.vx = 1.1;
    ball.vy = 0;
    ball.angle = 0;
    ball.grabbed = false;
};
const tank = {
    padding: 28,
    width: 0,
    height: 0,
    x: 0,
    y: 0
};
const tilt = {
    current: 0,
    target: 0
};
const slosh = {
    phase: 0,
    amplitude: 0
};
const resetWater = () => {
    tilt.current = 0;
    tilt.target = 0;
    slosh.phase = 0;
    slosh.amplitude = 0;
};
const supportsDeviceOrientation = "DeviceOrientationEvent" in window;
const hasOrientationPermissionApi = typeof DeviceOrientationEvent !== "undefined"
    && typeof DeviceOrientationEvent.requestPermission === "function";
const applyTiltInput = (rawTilt) => {
    tilt.target = clamp(rawTilt, -1, 1);
};
const handleOrientation = (event) => {
    const gamma = typeof event.gamma === "number" ? event.gamma : 0;
    applyTiltInput(gamma / 24);
};
const enableOrientationTracking = async () => {
    if (!supportsDeviceOrientation)
        return;
    if (motionTrackingEnabled)
        return;
    motionPermissionAttempted = true;
    if (hasOrientationPermissionApi) {
        try {
            const result = await DeviceOrientationEvent.requestPermission();
            if (result !== "granted") {
                if (motionButton)
                    motionButton.hidden = false;
                return;
            }
        }
        catch {
            if (motionButton)
                motionButton.hidden = false;
            return;
        }
    }
    window.addEventListener("deviceorientation", handleOrientation);
    motionTrackingEnabled = true;
    if (motionButton)
        motionButton.hidden = true;
};
const syncCanvasMode = () => {
    const nextIsMobileCanvas = mobileCanvasQuery.matches;
    if (nextIsMobileCanvas === isMobileCanvas) {
        if (motionButton)
            motionButton.hidden = !isMobileCanvas || !hasOrientationPermissionApi || !motionPermissionAttempted || motionTrackingEnabled;
        return;
    }
    isMobileCanvas = nextIsMobileCanvas;
    if (isMobileCanvas) {
        ball.grabbed = false;
        browserOpen = false;
        resetWater();
    }
    else {
        resetBall();
        if (!supportsDeviceOrientation)
            resetWater();
    }
    if (motionButton)
        motionButton.hidden = !isMobileCanvas || !hasOrientationPermissionApi || !motionPermissionAttempted || motionTrackingEnabled;
    syncBrowserState();
};
const resizeCanvas = () => {
    const rect = panel.getBoundingClientRect();
    state.width = rect.width;
    state.height = rect.height;
    canvas.width = Math.floor(rect.width * state.dpr);
    canvas.height = Math.floor(rect.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    syncCanvasMode();
    if (!isMobileCanvas && ball.x === 0 && ball.y === 0)
        resetBall();
    if (!isMobileCanvas && !ball.grabbed) {
        ball.x = clamp(ball.x, ball.radius, Math.max(ball.radius, state.width - ball.radius));
        ball.y = clamp(ball.y, ball.radius, Math.max(ball.radius, state.height - ball.radius));
    }
    const tankPadding = isMobileCanvas ? 42 : tank.padding;
    tank.width = Math.max(220, state.width - tankPadding * 2);
    tank.height = Math.max(180, state.height - tankPadding * 2);
    tank.x = (state.width - tank.width) * 0.5;
    tank.y = (state.height - tank.height) * 0.5;
    if (motionButton)
        motionButton.hidden = !isMobileCanvas || !hasOrientationPermissionApi || !motionPermissionAttempted || motionTrackingEnabled;
};
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
mobileCanvasQuery.addEventListener("change", () => {
    syncCanvasMode();
    resizeCanvas();
});
browserClose?.addEventListener("click", () => {
    browserOpen = false;
    syncBrowserState();
});
browserReset?.addEventListener("click", () => {
    activeObject = "ball";
    syncBrowserState();
});
objectButtons.forEach((button) => {
    const objectType = button.dataset.object;
    if (!objectType)
        return;
    button.addEventListener("click", () => {
        activeObject = objectType;
        syncBrowserState();
    });
});
panel.addEventListener("dblclick", (event) => {
    if (isMobileCanvas)
        return;
    const target = event.target;
    if (target?.closest(".browser-window") || target?.closest(".motion-button"))
        return;
    browserOpen = true;
    syncBrowserState();
});
if (motionButton) {
    motionButton.hidden = !isMobileCanvas || !hasOrientationPermissionApi || !motionPermissionAttempted || motionTrackingEnabled;
    motionButton.addEventListener("click", () => {
        void enableOrientationTracking();
    });
}
if (supportsDeviceOrientation && !hasOrientationPermissionApi) {
    window.addEventListener("deviceorientation", handleOrientation);
    motionTrackingEnabled = true;
}
const requestMotionOnFirstMobileGesture = () => {
    if (!isMobileCanvas || !hasOrientationPermissionApi || motionTrackingEnabled || motionPermissionAttempted)
        return;
    void enableOrientationTracking();
};
window.addEventListener("pointerdown", requestMotionOnFirstMobileGesture, { passive: true });
canvas.addEventListener("pointermove", (event) => {
    if (!isMobileCanvas)
        return;
    if (supportsDeviceOrientation && !canUseCustomCursor)
        return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    applyTiltInput(((x / Math.max(rect.width, 1)) - 0.5) * 2.35);
});
canvas.addEventListener("pointerleave", () => {
    if (!isMobileCanvas)
        return;
    if (!supportsDeviceOrientation) {
        applyTiltInput(0);
    }
});
canvas.addEventListener("pointerdown", (event) => {
    if (isMobileCanvas || event.button !== 0)
        return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const distance = Math.hypot(x - ball.x, y - ball.y);
    if (distance <= ball.radius + 12) {
        ball.grabbed = true;
        ball.dragOffsetX = x - ball.x;
        ball.dragOffsetY = y - ball.y;
        ball.vx = 0;
        ball.vy = 0;
        canvas.setPointerCapture(event.pointerId);
    }
});
canvas.addEventListener("pointermove", (event) => {
    if (isMobileCanvas || !ball.grabbed)
        return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const nextX = clamp(x - ball.dragOffsetX, ball.radius, state.width - ball.radius);
    const nextY = clamp(y - ball.dragOffsetY, ball.radius, state.height - ball.radius);
    ball.vx = nextX - ball.x;
    ball.vy = nextY - ball.y;
    ball.x = nextX;
    ball.y = nextY;
});
const releasePointer = (pointerId) => {
    ball.grabbed = false;
    if (typeof pointerId === "number" && canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
    }
};
canvas.addEventListener("pointerup", (event) => {
    if (!isMobileCanvas)
        releasePointer(event.pointerId);
});
canvas.addEventListener("pointercancel", (event) => {
    if (!isMobileCanvas)
        releasePointer(event.pointerId);
});
canvas.addEventListener("pointerleave", () => {
    if (!isMobileCanvas)
        releasePointer();
});
const updateWater = () => {
    const delta = tilt.target - tilt.current;
    tilt.current += delta * 0.14;
    slosh.phase += 0.08 + Math.abs(tilt.current) * 0.1;
    slosh.amplitude += (Math.abs(delta) * tank.height * 0.12 - slosh.amplitude) * 0.16;
    slosh.amplitude *= reducedMotion ? 0.9 : 0.965;
};
const updateBall = () => {
    if (!ball.grabbed) {
        const gravity = reducedMotion ? 0.32 : 0.56;
        ball.vy += gravity;
        ball.x += ball.vx;
        ball.y += ball.vy;
    }
    if (ball.x < ball.radius) {
        ball.x = ball.radius;
        ball.vx *= -0.92;
    }
    if (ball.x > state.width - ball.radius) {
        ball.x = state.width - ball.radius;
        ball.vx *= -0.92;
    }
    if (ball.y < ball.radius) {
        ball.y = ball.radius;
        ball.vy *= -0.82;
    }
    if (ball.y > state.height - ball.radius) {
        ball.y = state.height - ball.radius;
        ball.vy *= -0.8;
        ball.vx *= 0.986;
    }
    if (!ball.grabbed) {
        ball.vx *= 0.995;
        ball.vy *= 0.994;
        ball.angle += ball.vx * 0.022;
    }
};
const drawWaterBackdrop = () => {
    ctx.clearRect(0, 0, state.width, state.height);
};
const getWaterSurfaceY = (x) => {
    const normalizedX = (x - tank.x) / Math.max(tank.width, 1);
    const baseFill = tank.y + tank.height * 0.58;
    const slope = tilt.current * tank.height * 0.3;
    const centeredX = normalizedX - 0.5;
    const primaryWave = Math.sin(normalizedX * Math.PI * 2 + slosh.phase) * slosh.amplitude;
    const secondaryWave = Math.sin(normalizedX * Math.PI * 5 - slosh.phase * 1.35) * (slosh.amplitude * 0.34);
    const tertiaryWave = Math.cos(normalizedX * Math.PI * 8 + slosh.phase * 0.65) * (slosh.amplitude * 0.16);
    return clamp(baseFill + centeredX * slope + primaryWave + secondaryWave + tertiaryWave, tank.y + tank.height * 0.16, tank.y + tank.height * 0.92);
};
const drawTank = () => {
    const radius = 28;
    const drawRoundedRectPath = () => {
        ctx.beginPath();
        ctx.moveTo(tank.x + radius, tank.y);
        ctx.lineTo(tank.x + tank.width - radius, tank.y);
        ctx.quadraticCurveTo(tank.x + tank.width, tank.y, tank.x + tank.width, tank.y + radius);
        ctx.lineTo(tank.x + tank.width, tank.y + tank.height - radius);
        ctx.quadraticCurveTo(tank.x + tank.width, tank.y + tank.height, tank.x + tank.width - radius, tank.y + tank.height);
        ctx.lineTo(tank.x + radius, tank.y + tank.height);
        ctx.quadraticCurveTo(tank.x, tank.y + tank.height, tank.x, tank.y + tank.height - radius);
        ctx.lineTo(tank.x, tank.y + radius);
        ctx.quadraticCurveTo(tank.x, tank.y, tank.x + radius, tank.y);
        ctx.closePath();
    };
    ctx.save();
    drawRoundedRectPath();
    ctx.clip();
    const waterGradient = ctx.createLinearGradient(0, tank.y, 0, tank.y + tank.height);
    waterGradient.addColorStop(0, "rgba(255,255,255,0.28)");
    waterGradient.addColorStop(0.08, "rgba(191, 234, 255, 0.32)");
    waterGradient.addColorStop(0.4, "rgba(80, 172, 255, 0.36)");
    waterGradient.addColorStop(1, "rgba(20, 70, 140, 0.82)");
    ctx.beginPath();
    ctx.moveTo(tank.x, tank.y + tank.height);
    const waveSteps = 26;
    for (let step = 0; step <= waveSteps; step += 1) {
        const x = tank.x + (tank.width / waveSteps) * step;
        ctx.lineTo(x, getWaterSurfaceY(x));
    }
    ctx.lineTo(tank.x + tank.width, tank.y + tank.height);
    ctx.closePath();
    ctx.fillStyle = waterGradient;
    ctx.fill();
    ctx.beginPath();
    for (let step = 0; step <= waveSteps; step += 1) {
        const x = tank.x + (tank.width / waveSteps) * step;
        const y = getWaterSurfaceY(x);
        if (step === 0)
            ctx.moveTo(x, y);
        else
            ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.62)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    for (let step = 0; step <= waveSteps; step += 1) {
        const x = tank.x + (tank.width / waveSteps) * step;
        const y = getWaterSurfaceY(x) + 6;
        if (step === 0)
            ctx.moveTo(x, y);
        else
            ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1.2;
    drawRoundedRectPath();
    ctx.stroke();
};
const drawBallBackdrop = () => {
    ctx.clearRect(0, 0, state.width, state.height);
    const bandCount = 8;
    const pull = ((ball.x - state.width * 0.5) / Math.max(state.width, 1)) * 24;
    for (let i = 0; i < bandCount; i += 1) {
        const y = ((i + 1) / (bandCount + 1)) * state.height;
        ctx.beginPath();
        ctx.strokeStyle = i % 2 === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)";
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(state.width * 0.25, y + pull * 0.18, state.width * 0.75, y - pull * 0.18, state.width, y);
        ctx.stroke();
    }
};
const drawBall = () => {
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.arc(ball.x, ball.y, ball.radius + 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    if (isLightTheme()) {
        ctx.beginPath();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.5;
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.angle);
    ctx.beginPath();
    ctx.strokeStyle = "#000000";
    ctx.moveTo(0, -ball.radius * 0.72);
    ctx.lineTo(0, ball.radius * 0.72);
    ctx.stroke();
    ctx.restore();
};
const tick = () => {
    if (isMobileCanvas) {
        drawWaterBackdrop();
        updateWater();
        drawTank();
    }
    else {
        drawBallBackdrop();
        updateBall();
        drawBall();
    }
    window.requestAnimationFrame(tick);
};
window.requestAnimationFrame(tick);
