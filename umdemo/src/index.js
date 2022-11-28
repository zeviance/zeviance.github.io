import html2canvas from 'html2canvas'
import Replicate from 'replicate-js'

const $force = document.querySelectorAll('#force')[0]
const $touches = document.querySelectorAll('#touches')[0]
const canvas = document.querySelectorAll('canvas')[0]
const canvasImgScr = document.querySelectorAll('#canvasImgScr')[0]
const context = canvas.getContext('2d')
const saveCaptureBtn = document.querySelectorAll('#saveCaptureBtn')[0]
const undoDrawBtn = document.querySelectorAll('#undoDrawBtn')[0]
const clearDrawBtn = document.querySelectorAll('#clearDrawBtn')[0]
// Replicate const
const REPLICATE_PROMPT = "darth vader eating icecream";
const REPLICATE_NUM_OF_IMAGES = 1;
const replicate = new Replicate({
  proxyUrl: 'http://salty-oasis-20821.herokuapp.com/api',
  pollingInterval: 1000,
});

let lineWidth = 0
let isMousedown = false
let points = []
const {left, top} = canvas.getBoundingClientRect();

const scaleFactor = 2;
canvas.width = window.innerWidth * scaleFactor;
canvas.height = window.innerHeight * scaleFactor;

const strokeHistory = []

const requestIdleCallback = window.requestIdleCallback || function (fn) { setTimeout(fn, 1) };

/**
 * This function takes in an array of points and draws them onto the canvas.
 * @param {array} stroke array of points to draw on the canvas
 * @return {void}
 */
function drawOnCanvas (stroke) {
  context.strokeStyle = 'black'
  context.lineCap = 'round'
  context.lineJoin = 'round'

  const l = stroke.length - 1
  if (stroke.length >= 3) {
    const xc = (stroke[l].x + stroke[l - 1].x) / 2
    const yc = (stroke[l].y + stroke[l - 1].y) / 2
    context.lineWidth = stroke[l - 1].lineWidth
    context.quadraticCurveTo(stroke[l - 1].x, stroke[l - 1].y, xc, yc)
    context.stroke()
    context.beginPath()
    context.moveTo(xc, yc)
  } else {
    const point = stroke[l];
    context.lineWidth = point.lineWidth
    context.strokeStyle = point.color
    context.beginPath()
    context.moveTo(point.x, point.y)
    context.stroke()
  }
}

/**
 * Remove the previous stroke from history and repaint the entire canvas based on history
 * @return {void}
 */
function undoDraw () {
  strokeHistory.pop()
  context.clearRect(0, 0, canvas.width, canvas.height)
  strokeHistory.map(function (stroke) {
    if (strokeHistory.length === 0) return
    context.beginPath()
    let strokePath = [];
    stroke.map(function (point) {
      strokePath.push(point)
      drawOnCanvas(strokePath)
    })
  })
}
undoDrawBtn.onclick = undoDraw;

function clearDraw () {
  strokeHistory.splice(0, strokeHistory.length);
  context.clearRect(0, 0, canvas.width, canvas.height);
  canvasImgScr.src = '';
  canvasImgScr.style.visibility = 'collapse';
}
clearDrawBtn.onclick = clearDraw;

function saveCapture() {
  html2canvas(canvas).then(function(canvas) {
    var localImageDataURL = canvas.toDataURL("image/jpg");
    canvasImgScr.src = localImageDataURL;
    canvasImgScr.style.visibility = 'visible';
    postPromptsToReplicateService();
  })
}
saveCaptureBtn.onclick = saveCapture;

for (const ev of ["touchstart", "mousedown"]) {
  canvas.addEventListener(ev, function (e) {
    let pressure = 0.1;
    let x, y;
    if (e.touches && e.touches[0] && typeof e.touches[0]["force"] !== "undefined") {
      if (e.touches[0]["force"] > 0) {
        pressure = e.touches[0]["force"]
      }
      x = translatedXCoor(e.touches[0].pageX) * scaleFactor
      y = translatedYCoor(e.touches[0].pageY) * scaleFactor
    } else {
      pressure = 1.0
      x = translatedXCoor(e.pageX) * scaleFactor
      y = translatedYCoor(e.pageY) * scaleFactor
    }

    isMousedown = true

    lineWidth = Math.log(pressure + 1) * 40
    context.lineWidth = lineWidth// pressure * 50;

    points.push({ x, y, lineWidth })
    drawOnCanvas(points)
  })
}

for (const ev of ['touchmove', 'mousemove']) {
  canvas.addEventListener(ev, function (e) {
    if (!isMousedown) return
    e.preventDefault()

    let pressure = 0.1
    let x, y
    if (e.touches && e.touches[0] && typeof e.touches[0]["force"] !== "undefined") {
      if (e.touches[0]["force"] > 0) {
        pressure = e.touches[0]["force"]
      }
      x = translatedXCoor(e.touches[0].pageX) * scaleFactor
      y = translatedYCoor(e.touches[0].pageY) * scaleFactor
    } else {
      pressure = 1.0
      x = translatedXCoor(e.pageX) * scaleFactor
      y = translatedYCoor(e.pageY) * scaleFactor
    }

    // smoothen line width
    lineWidth = (Math.log(pressure + 1) * 40 * 0.2 + lineWidth * 0.8)
    points.push({ x, y, lineWidth })

    drawOnCanvas(points);

    requestIdleCallback(() => {
      $force.textContent = 'force = ' + pressure
      const touch = e.touches ? e.touches[0] : null
      if (touch) {
        $touches.innerHTML = `
          touchType = ${touch.touchType} ${touch.touchType === 'direct' ? '👆' : '✍️'} <br/>
          radiusX = ${touch.radiusX} <br/>
          radiusY = ${touch.radiusY} <br/>
          rotationAngle = ${touch.rotationAngle} <br/>
          altitudeAngle = ${touch.altitudeAngle} <br/>
          azimuthAngle = ${touch.azimuthAngle} <br/>
        `
      }
    })
  })
}

for (const ev of ['touchend', 'touchleave', 'mouseup']) {
  canvas.addEventListener(ev, function (e) {
    isMousedown = false
    requestIdleCallback(function () { strokeHistory.push([...points]); points = []})
    lineWidth = 0
  })
};

function translatedXCoor(x){
  var rect = canvas.getBoundingClientRect();
  var factor = rect.width / (canvas.width / scaleFactor); // div 2 since we scaled up
  return (x - rect.left) / factor;
}

function translatedYCoor(y){
  var rect = canvas.getBoundingClientRect();
  var factor = rect.height / (canvas.height / scaleFactor); // div 2 since we scaled up
  return  (y - rect.top) / factor;
}

async function postPromptsToReplicateService() {
  // TODO: can potentially save one round trip down the road.
  console.log("firing commands");
  let stableDiffusionModel = await replicate.models.get("stability-ai/stable-diffusion/");
  let stableDiffusionImages = await stableDiffusionModel.predict({
    prompt: REPLICATE_PROMPT,
    grid_size: REPLICATE_NUM_OF_IMAGES,
  })
    .then( data => {
      console.log(data);
    });
  // TODO: add error handling here.
}