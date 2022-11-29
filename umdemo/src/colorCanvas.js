import tinycolor from "tinycolor2";

// Brush colour and size
let colour;
const DEFAULT_STROKE_WIDTH = 20;
let strokeWidth = DEFAULT_STROKE_WIDTH;
const varyBrightness = 10;
const TOUCH_FORCE_MULTIPLIER = 15;

// Drawing state
let latestPoint;
let drawing = false;
let currentAngle;

var isBlank = true;

// Set up our drawing context
const canvas = document.querySelectorAll('canvas')[0]
const rect = canvas.getBoundingClientRect();
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const context = canvas.getContext("2d");

const varyColour = sourceColour => {
    const amount = Math.round(Math.random() * 2 * varyBrightness);
    const c = tinycolor(sourceColour);
    const varied =
        amount > varyBrightness
            ? c.brighten(amount - varyBrightness)
            : c.darken(amount);
    return varied.toHexString();
};

const makeBrush = size => {
    const brush = [];
    let bristleCount = Math.round(size / 3);
    const gap = strokeWidth / bristleCount;
    for (let i = 0; i < bristleCount; i++) {
        const distance =
            i === 0 ? 0 : gap * i + (Math.random() * gap) / 2 - gap / 2;
        brush.push({
            distance,
            thickness: Math.random() * 2 + 2,
            colour: varyColour(colour)
        });
    }
    return brush;
};

let currentBrush = makeBrush(strokeWidth);

// Geometry
const rotatePoint = (distance, angle, origin) => [
    origin[0] + distance * Math.cos(angle),
    origin[1] + distance * Math.sin(angle)
];

const getBearing = (origin, destination) =>
    (Math.atan2(destination[1] - origin[1], destination[0] - origin[0]) -
        Math.PI / 2) %
    (Math.PI * 2);

const getNewAngle = (origin, destination, oldAngle) => {
    const bearing = getBearing(origin, destination);
    if (typeof oldAngle === "undefined") {
        return bearing;
    }
    return oldAngle - angleDiff(oldAngle, bearing);
};

const angleDiff = (angleA, angleB) => {
    const twoPi = Math.PI * 2;
    const diff =
        ((angleA - (angleB > 0 ? angleB : angleB + twoPi) + Math.PI) % twoPi) -
        Math.PI;
    return diff < -Math.PI ? diff + twoPi : diff;
};

// Drawing functions
const strokeBristle = (origin, destination, bristle, controlPoint) => {
    context.beginPath();
    context.moveTo(origin[0], origin[1]);
    context.strokeStyle = bristle.colour;
    context.lineWidth = bristle.thickness;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.shadowColor = bristle.colour;
    context.shadowBlur = bristle.thickness / 2;
    context.quadraticCurveTo(
        controlPoint[0],
        controlPoint[1],
        destination[0],
        destination[1]
    );
    context.lineTo(destination[0], destination[1]);
    context.stroke();
};

const drawStroke = (bristles, origin, destination, oldAngle, newAngle) => {
    isBlank = false;
    bristles.forEach(bristle => {
        context.beginPath();
        let bristleOrigin = rotatePoint(
            bristle.distance - strokeWidth / 2,
            oldAngle,
            origin
        );

        let bristleDestination = rotatePoint(
            bristle.distance - strokeWidth / 2,
            newAngle,
            destination
        );
        const controlPoint = rotatePoint(
            bristle.distance - strokeWidth / 2,
            newAngle,
            origin
        );
        bristleDestination = rotatePoint(
            bristle.distance - strokeWidth / 2,
            newAngle,
            destination
        );
        strokeBristle(bristleOrigin, bristleDestination, bristle, controlPoint);
    });
};
const continueStroke = (newPoint, evt) => {
    const newAngle = getNewAngle(latestPoint, newPoint, currentAngle);
    determinePressureScale(evt);
    currentBrush = makeBrush(strokeWidth);
    drawStroke(currentBrush, latestPoint, newPoint, currentAngle, newAngle);
    currentAngle = newAngle % (Math.PI * 2);
    latestPoint = newPoint;
};
// Event helpers

const startStroke = (point, evt) => {
    colour = document.getElementById("colourInput").value;
    currentAngle = undefined;
    determinePressureScale(evt);
    currentBrush = makeBrush(strokeWidth);
    drawing = true;
    latestPoint = point;
};

const getTouchPoint = evt => {
    if (!evt.currentTarget) {
        return [0, 0];
    }
    const touch = evt.targetTouches[0];
    const rect = evt.currentTarget.getBoundingClientRect();
    let x = translatedXCoor(touch.clientX) - translatedXCoor(rect.left);
    let y = translatedYCoor(touch.clientY) - translatedYCoor(rect.top);
    return [x, y];
};

const BUTTON = 0b01;
const mouseButtonIsDown = buttons => (BUTTON & buttons) === BUTTON;

// Event handlers

const mouseMove = evt => {
  if (!drawing) return;
  continueStroke([translatedXCoor(evt.offsetX), translatedYCoor(evt.offsetY)], evt);
};

const mouseDown = evt => {
  if (drawing) return;
  evt.preventDefault();
  startStroke([translatedXCoor(evt.offsetX), translatedYCoor(evt.offsetY)], evt);
};

const mouseEnter = evt => {
  if (!mouseButtonIsDown(evt.buttons) || drawing) return;
  mouseDown(evt);
};

const endStroke = evt => {
  if (!drawing) return;
  drawing = false;
};

const touchStart = evt => {
  if (drawing) return;
  evt.preventDefault();
  startStroke(getTouchPoint(evt), evt);
};

const touchMove = evt => {
  if (!drawing) return;
  continueStroke(getTouchPoint(evt), evt);
};

const touchEnd = evt => {
  drawing = false;
};

function determinePressureScale(evt) {
  let pressure = 1.0;
  if (evt && evt.touches && evt.touches[0] && typeof evt.touches[0]["force"] !== "undefined") {
    if (evt.touches[0]["force"] > 0) {
      pressure = evt.touches[0]["force"] * TOUCH_FORCE_MULTIPLIER;
    }
  }
  /*
  debugPanel.innerHTML = `
    pressure: ${pressure} <br/>
  `;
  */
  strokeWidth = DEFAULT_STROKE_WIDTH * pressure;
}

// Register event handlers
canvas.addEventListener("touchstart", touchStart, false);
canvas.addEventListener("touchend", touchEnd, false);
canvas.addEventListener("touchcancel", touchEnd, false);
canvas.addEventListener("touchmove", touchMove, false);

canvas.addEventListener("mousedown", mouseDown, false);
canvas.addEventListener("mouseup", endStroke, false);
canvas.addEventListener("mouseout", endStroke, false);
canvas.addEventListener("mouseenter", mouseEnter, false);
canvas.addEventListener("mousemove", mouseMove, false);

// Helper functions
function translatedXCoor(x) {
  var factor = rect.width / canvas.width;
  return (x + rect.left) / factor;
}

function translatedYCoor(y) {
  var factor = rect.height / canvas.height;
  return  (y + rect.top) / factor;
}

export function isBlank() {
  return isBlank;
}

export function resetCanvas() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  isBlank = true;
}