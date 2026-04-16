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
const browserReset = panel.querySelector("#game-reset");
const objectButtons = Array.from(panel.querySelectorAll("[data-object]"));
const motionButton = panel.querySelector(".motion-button");
const autoModeQuery = window.matchMedia("(max-width: 920px)");
if (!(browser instanceof HTMLDivElement))
    throw new Error("Browser element #game-browser was not found.");
if (!(browserReset instanceof HTMLButtonElement))
    throw new Error("Reset button was not found.");
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
    const interactiveSelector = "a, button, #field, .chip, .button, .link-row, .browser-window";
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
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    browserOpen: false,
    browserX: 0,
    browserY: 0,
    mode: "ball"
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rotatePoint = (x, y, angle) => ({
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle)
});
const toLocal = (item, x, y) => rotatePoint(x - item.x, y - item.y, -item.angle);
const isLightTheme = () => root.dataset.theme === "light";
const createBaseItem = (x, y) => ({
    x,
    y,
    angle: 0,
    grabbed: false,
    dragMode: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    rotateOffset: 0
});
const createBall = (x, y) => ({
    ...createBaseItem(x, y),
    kind: "ball",
    vx: (Math.random() - 0.5) * 1.2,
    vy: 0,
    radius: 28
});
const createPlatform = (x, y) => ({
    ...createBaseItem(x, y),
    kind: "platform",
    width: 190,
    height: 18
});
const createTrampoline = (x, y) => ({
    ...createBaseItem(x, y),
    kind: "trampoline",
    width: 130,
    height: 16
});
const items = [];
const resetBallScene = () => {
    items.length = 0;
    items.push(createBall(state.width * 0.5, state.height * 0.18));
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
let motionPermissionAttempted = false;
let motionTrackingEnabled = false;
const syncMotionUi = () => {
    if (!motionButton)
        return;
    motionButton.hidden = state.mode !== "water" || !hasOrientationPermissionApi || !motionPermissionAttempted || motionTrackingEnabled;
};
const updateBrowserUi = () => {
    browser.classList.toggle("is-open", state.browserOpen && state.mode === "ball");
    browser.setAttribute("aria-hidden", state.browserOpen && state.mode === "ball" ? "false" : "true");
};
const resetCurrentMode = () => {
    if (state.mode === "ball")
        resetBallScene();
    else
        resetWater();
};
const updateModeUi = () => {
    canvas.setAttribute("aria-label", state.mode === "ball" ? "Ball physics playground" : "Water physics playground");
    updateBrowserUi();
    syncMotionUi();
};
function closeBrowser() {
    state.browserOpen = false;
    updateBrowserUi();
}
const setMode = (mode) => {
    if (state.mode === mode) {
        updateModeUi();
        return;
    }
    state.mode = mode;
    closeBrowser();
    resetCurrentMode();
    updateModeUi();
};
const syncModeToResolution = () => {
    setMode(autoModeQuery.matches ? "water" : "ball");
};
const resizeCanvas = () => {
    const rect = panel.getBoundingClientRect();
    state.width = rect.width;
    state.height = rect.height;
    canvas.width = Math.floor(rect.width * state.dpr);
    canvas.height = Math.floor(rect.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    const tankPadding = state.mode === "water" ? 42 : tank.padding;
    tank.width = Math.max(220, state.width - tankPadding * 2);
    tank.height = Math.max(180, state.height - tankPadding * 2);
    tank.x = (state.width - tank.width) * 0.5;
    tank.y = (state.height - tank.height) * 0.5;
    if (state.mode === "ball" && items.length === 0)
        resetBallScene();
    updateModeUi();
};
const positionBrowser = (x, y) => {
    const width = 320;
    const height = 170;
    state.browserX = clamp(x, 12, Math.max(state.width - width - 12, 12));
    state.browserY = clamp(y, 12, Math.max(state.height - height - 12, 12));
    browser.style.left = `${state.browserX}px`;
    browser.style.top = `${state.browserY}px`;
};
const openBrowser = (x, y) => {
    if (state.mode !== "ball")
        return;
    positionBrowser(x, y);
    state.browserOpen = true;
    updateBrowserUi();
};
const spawnObject = (kind) => {
    const x = clamp(state.browserX + 140, 70, state.width - 70);
    const y = clamp(state.browserY + 120, 70, state.height - 70);
    if (kind === "ball")
        items.push(createBall(x, y));
    if (kind === "platform")
        items.push(createPlatform(x, y));
    if (kind === "trampoline")
        items.push(createTrampoline(x, y));
};
resizeCanvas();
syncModeToResolution();
window.addEventListener("resize", resizeCanvas);
autoModeQuery.addEventListener("change", () => {
    syncModeToResolution();
    resizeCanvas();
});
browserReset.addEventListener("click", () => {
    resetCurrentMode();
    closeBrowser();
});
objectButtons.forEach((button) => {
    button.addEventListener("click", () => {
        spawnObject(button.dataset.object || "");
        closeBrowser();
    });
});
if (motionButton) {
    syncMotionUi();
    motionButton.addEventListener("click", () => {
        void enableOrientationTracking();
    });
}
if (supportsDeviceOrientation && !hasOrientationPermissionApi) {
    window.addEventListener("deviceorientation", handleOrientation);
    motionTrackingEnabled = true;
    syncMotionUi();
}
const requestMotionOnFirstMobileGesture = () => {
    if (state.mode !== "water" || !hasOrientationPermissionApi || motionTrackingEnabled || motionPermissionAttempted)
        return;
    void enableOrientationTracking();
};
window.addEventListener("pointerdown", requestMotionOnFirstMobileGesture, { passive: true });
window.addEventListener("pointerdown", (event) => {
    if (state.browserOpen && !browser.contains(event.target) && event.target !== canvas)
        closeBrowser();
});
canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    if (state.mode !== "ball")
        return;
    const rect = canvas.getBoundingClientRect();
    openBrowser(event.clientX - rect.left, event.clientY - rect.top);
});
panel.addEventListener("dblclick", (event) => {
    if (state.mode !== "ball")
        return;
    const target = event.target;
    if (target?.closest(".browser-window") || target?.closest(".motion-button"))
        return;
    const rect = canvas.getBoundingClientRect();
    openBrowser(event.clientX - rect.left, event.clientY - rect.top);
});
const hitBall = (item, x, y) => Math.hypot(x - item.x, y - item.y) <= item.radius + 10;
const hitRect = (item, x, y) => {
    const local = toLocal(item, x, y);
    return Math.abs(local.x) <= item.width * 0.5 && Math.abs(local.y) <= item.height * 0.5 + 10;
};
canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0)
        return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (state.mode === "water") {
        applyTiltInput(((x / Math.max(rect.width, 1)) - 0.5) * 2.35);
        return;
    }
    closeBrowser();
    for (let i = items.length - 1; i >= 0; i -= 1) {
        const item = items[i];
        const hit = item.kind === "ball" ? hitBall(item, x, y) : hitRect(item, x, y);
        if (!hit)
            continue;
        item.grabbed = true;
        if (item.kind === "ball") {
            item.dragMode = "move";
            item.dragOffsetX = x - item.x;
            item.dragOffsetY = y - item.y;
            item.vx = 0;
            item.vy = 0;
        }
        else {
            const local = toLocal(item, x, y);
            if (Math.abs(local.x) >= item.width * 0.34) {
                item.dragMode = "rotate";
                item.rotateOffset = Math.atan2(y - item.y, x - item.x) - item.angle;
            }
            else {
                item.dragMode = "move";
                item.dragOffsetX = x - item.x;
                item.dragOffsetY = y - item.y;
            }
        }
        const lifted = items.splice(i, 1)[0];
        items.push(lifted);
        canvas.setPointerCapture(event.pointerId);
        break;
    }
});
canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (state.mode === "water") {
        if (supportsDeviceOrientation && motionTrackingEnabled)
            return;
        applyTiltInput(((x / Math.max(rect.width, 1)) - 0.5) * 2.35);
        return;
    }
    for (const item of items) {
        if (!item.grabbed)
            continue;
        if (item.dragMode === "rotate") {
            item.angle = Math.atan2(y - item.y, x - item.x) - item.rotateOffset;
            continue;
        }
        const nextX = x - item.dragOffsetX;
        const nextY = y - item.dragOffsetY;
        if (item.kind === "ball") {
            item.vx = nextX - item.x;
            item.vy = nextY - item.y;
        }
        item.x = nextX;
        item.y = nextY;
    }
});
canvas.addEventListener("pointerleave", () => {
    if (state.mode === "water" && !motionTrackingEnabled)
        applyTiltInput(0);
});
const releaseItems = (pointerId) => {
    items.forEach((item) => {
        item.grabbed = false;
        item.dragMode = null;
    });
    if (typeof pointerId === "number" && canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
    }
};
canvas.addEventListener("pointerup", (event) => releaseItems(event.pointerId));
canvas.addEventListener("pointercancel", (event) => releaseItems(event.pointerId));
const resolveBallCollision = (a, b) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy) || 0.001;
    const minDistance = a.radius + b.radius;
    if (distance >= minDistance)
        return;
    const nx = dx / distance;
    const ny = dy / distance;
    const overlap = (minDistance - distance) * 0.5;
    a.x -= nx * overlap;
    a.y -= ny * overlap;
    b.x += nx * overlap;
    b.y += ny * overlap;
    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const velocityAlongNormal = rvx * nx + rvy * ny;
    if (velocityAlongNormal > 0)
        return;
    const restitution = 0.88;
    const impulse = -(1 + restitution) * velocityAlongNormal / 2;
    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;
};
const collideBallWithRect = (ball, item, bounce) => {
    const local = toLocal(item, ball.x, ball.y);
    const halfW = item.width * 0.5;
    const halfH = item.height * 0.5;
    const clampedX = clamp(local.x, -halfW, halfW);
    const clampedY = clamp(local.y, -halfH, halfH);
    const dx = local.x - clampedX;
    const dy = local.y - clampedY;
    const distance = Math.hypot(dx, dy);
    if (distance >= ball.radius)
        return;
    let nx = 0;
    let ny = 0;
    let push = 0;
    if (distance > 0.001) {
        nx = dx / distance;
        ny = dy / distance;
        push = ball.radius - distance;
    }
    else {
        const penLeft = Math.abs(local.x + halfW);
        const penRight = Math.abs(halfW - local.x);
        const penTop = Math.abs(local.y + halfH);
        const penBottom = Math.abs(halfH - local.y);
        const minPen = Math.min(penLeft, penRight, penTop, penBottom);
        if (minPen === penLeft)
            nx = -1;
        else if (minPen === penRight)
            nx = 1;
        else if (minPen === penTop)
            ny = -1;
        else
            ny = 1;
        push = ball.radius + minPen;
    }
    const worldNormal = rotatePoint(nx, ny, item.angle);
    ball.x += worldNormal.x * push;
    ball.y += worldNormal.y * push;
    const velocityAlongNormal = ball.vx * worldNormal.x + ball.vy * worldNormal.y;
    if (velocityAlongNormal < 0) {
        ball.vx -= (1 + bounce) * velocityAlongNormal * worldNormal.x;
        ball.vy -= (1 + bounce) * velocityAlongNormal * worldNormal.y;
    }
};
const updateBallItem = (ball) => {
    const steps = ball.grabbed ? 1 : 5;
    const gravity = (reducedMotion ? 0.18 : 0.34) / steps;
    const platforms = items.filter((item) => item.kind === "platform");
    const trampolines = items.filter((item) => item.kind === "trampoline");
    for (let step = 0; step < steps; step += 1) {
        if (!ball.grabbed) {
            ball.vy += gravity;
            ball.x += ball.vx / steps;
            ball.y += ball.vy / steps;
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
        for (const platform of platforms)
            collideBallWithRect(ball, platform, 0.72);
        for (const trampoline of trampolines)
            collideBallWithRect(ball, trampoline, 1.22);
        if (ball.y > state.height - ball.radius) {
            ball.y = state.height - ball.radius;
            ball.vy *= -0.78;
            ball.vx *= 0.986;
        }
    }
    if (!ball.grabbed) {
        ball.vx *= 0.996;
        ball.vy *= 0.995;
        ball.angle += ball.vx * 0.024;
    }
};
const updateWater = () => {
    const delta = tilt.target - tilt.current;
    tilt.current += delta * 0.14;
    slosh.phase += 0.08 + Math.abs(tilt.current) * 0.1;
    slosh.amplitude += (Math.abs(delta) * tank.height * 0.12 - slosh.amplitude) * 0.16;
    slosh.amplitude *= reducedMotion ? 0.9 : 0.965;
};
const drawBallBackdrop = () => {
    ctx.clearRect(0, 0, state.width, state.height);
    const anchorBall = items.find((item) => item.kind === "ball") || createBall(state.width * 0.5, state.height * 0.5);
    const bandCount = 8;
    const pull = ((anchorBall.x - state.width * 0.5) / Math.max(state.width, 1)) * 24;
    for (let i = 0; i < bandCount; i += 1) {
        const y = ((i + 1) / (bandCount + 1)) * state.height;
        ctx.beginPath();
        ctx.strokeStyle = i % 2 === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)";
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(state.width * 0.25, y + pull * 0.18, state.width * 0.75, y - pull * 0.18, state.width, y);
        ctx.stroke();
    }
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
const drawWater = () => {
    ctx.clearRect(0, 0, state.width, state.height);
    const radius = 28;
    const waveSteps = 26;
    const roundedPath = () => {
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
    roundedPath();
    ctx.clip();
    const waterGradient = ctx.createLinearGradient(0, tank.y, 0, tank.y + tank.height);
    waterGradient.addColorStop(0, "rgba(255,255,255,0.28)");
    waterGradient.addColorStop(0.08, "rgba(191,234,255,0.32)");
    waterGradient.addColorStop(0.4, "rgba(80,172,255,0.36)");
    waterGradient.addColorStop(1, "rgba(20,70,140,0.82)");
    ctx.beginPath();
    ctx.moveTo(tank.x, tank.y + tank.height);
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
    roundedPath();
    ctx.strokeStyle = isLightTheme() ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
};
const drawItem = (item) => {
    if (item.kind === "platform") {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.angle);
        ctx.fillStyle = isLightTheme() ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.16)";
        ctx.fillRect(-item.width * 0.5, -item.height * 0.5, item.width, item.height);
        ctx.strokeStyle = isLightTheme() ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.12)";
        ctx.strokeRect(-item.width * 0.5, -item.height * 0.5, item.width, item.height);
        ctx.restore();
        return;
    }
    if (item.kind === "trampoline") {
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.angle);
        ctx.beginPath();
        ctx.strokeStyle = isLightTheme() ? "rgba(0,0,0,0.9)" : "rgba(255,255,255,0.92)";
        ctx.moveTo(-item.width * 0.5, -item.height * 0.5);
        ctx.lineTo(item.width * 0.5, -item.height * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = isLightTheme() ? "rgba(0,0,0,0.24)" : "rgba(255,255,255,0.2)";
        ctx.moveTo(-item.width * 0.5 + 8, -item.height * 0.5);
        ctx.lineTo(-item.width * 0.5 + 2, 18);
        ctx.moveTo(item.width * 0.5 - 8, -item.height * 0.5);
        ctx.lineTo(item.width * 0.5 - 2, 18);
        ctx.stroke();
        ctx.restore();
        return;
    }
    ctx.beginPath();
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.arc(item.x, item.y, item.radius + 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
    ctx.fill();
    if (isLightTheme()) {
        ctx.beginPath();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.5;
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle);
    ctx.beginPath();
    ctx.strokeStyle = "#000000";
    ctx.moveTo(0, -item.radius * 0.72);
    ctx.lineTo(0, item.radius * 0.72);
    ctx.stroke();
    ctx.restore();
};
const tick = () => {
    if (state.mode === "ball") {
        drawBallBackdrop();
        const balls = items.filter((item) => item.kind === "ball");
        for (const ball of balls)
            updateBallItem(ball);
        for (let i = 0; i < balls.length; i += 1) {
            for (let j = i + 1; j < balls.length; j += 1) {
                resolveBallCollision(balls[i], balls[j]);
            }
        }
        for (const item of items)
            drawItem(item);
    }
    else {
        updateWater();
        drawWater();
    }
    window.requestAnimationFrame(tick);
};
window.requestAnimationFrame(tick);
