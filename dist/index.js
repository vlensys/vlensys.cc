"use strict";
const root = document.body;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const reveals = document.querySelectorAll(".reveal");
const cursorRing = document.querySelector(".cursor-ring");
const cursorDot = document.querySelector(".cursor-dot");
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
const canvas = document.getElementById("field");
if (!(canvas instanceof HTMLCanvasElement))
    throw new Error("Canvas element #field was not found.");
const ctx = canvas.getContext("2d");
if (!ctx)
    throw new Error("2D canvas context is unavailable.");
const panel = canvas.parentElement;
if (!(panel instanceof HTMLElement))
    throw new Error("Canvas parent element is unavailable.");
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
const resizeCanvas = () => {
    const rect = panel.getBoundingClientRect();
    state.width = rect.width;
    state.height = rect.height;
    canvas.width = Math.floor(rect.width * state.dpr);
    canvas.height = Math.floor(rect.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    if (ball.x === 0 && ball.y === 0)
        resetBall();
    if (!ball.grabbed) {
        ball.x = clamp(ball.x, ball.radius, Math.max(ball.radius, state.width - ball.radius));
        ball.y = clamp(ball.y, ball.radius, Math.max(ball.radius, state.height - ball.radius));
    }
};
resizeCanvas();
resetBall();
window.addEventListener("resize", resizeCanvas);
canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0)
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
    if (!ball.grabbed)
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
canvas.addEventListener("pointerup", (event) => releasePointer(event.pointerId));
canvas.addEventListener("pointercancel", (event) => releasePointer(event.pointerId));
canvas.addEventListener("pointerleave", () => releasePointer());
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
const drawBackdrop = () => {
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
    drawBackdrop();
    updateBall();
    drawBall();
    window.requestAnimationFrame(tick);
};
window.requestAnimationFrame(tick);
