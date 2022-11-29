import html2canvas from 'html2canvas'
import { callReplicateService }  from './replicateapi.js'

const $force = document.querySelectorAll('#force')[0]
const $touches = document.querySelectorAll('#touches')[0]
const canvas = document.querySelectorAll('canvas')[0]
const context = canvas.getContext('2d')
const saveCaptureBtn = document.querySelectorAll('#saveCaptureBtn')[0]
const undoDrawBtn = document.querySelectorAll('#undoDrawBtn')[0]
const resetBtn = document.querySelectorAll('#resetBtn')[0]
const inputField = document.querySelectorAll('#inputField')[0]
const photoHeroUnit =  document.querySelectorAll('#photoHeroUnit')[0]
const photoHeroLoaderUnit = document.querySelectorAll('#photoHeroLoaderUnit')[0]
const heroUnitContainer = document.querySelectorAll('#heroUnitContainer')[0]

let lineWidth = 0
let isMousedown = false
let points = []

const scaleFactor = 2;
canvas.width = window.innerWidth * scaleFactor;
canvas.height = window.innerHeight * scaleFactor;

const strokeHistory = []

const requestIdleCallback = window.requestIdleCallback || function (fn) { setTimeout(fn, 1) };
photoHeroLoaderUnit.hidden = true;

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

function reset () {
  strokeHistory.splice(0, strokeHistory.length);
  context.clearRect(0, 0, canvas.width, canvas.height);
  // clear prompt
  inputField.value = "";
}
resetBtn.onclick = reset;

function saveCapture() {
  html2canvas(canvas, {
      scale: 0.5,
    }).then(function(canvas) {
    // check if prompt is empty
    let inputFieldText = inputField.value.trim();
    let localImageDataURL = strokeHistory.length === 0 ? "" : canvas.toDataURL("image/jpg", 0.75);
    console.log(localImageDataURL);
    if (inputFieldText.length === 0 && localImageDataURL.length === 0) return
    showPhotoLoader();
    postPromptsToReplicateService(inputFieldText, localImageDataURL);
  })
}
saveCaptureBtn.onclick = saveCapture;

function showPhotoLoader() {
  photoHeroLoaderUnit.hidden = false;
  photoHeroUnit.hidden = true;
  let newImg = document.createElement("img");
  newImg.src = photoHeroUnit.src;
  heroUnitContainer.after(newImg);
}

function handleIncomingNewImgUrL(newImageUrl) {
  photoHeroUnit.src = newImageUrl;
  photoHeroLoaderUnit.hidden = true;
  photoHeroUnit.hidden = false;
}

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
    //showTouchPencilDebugDetails();
  })
}

for (const ev of ['touchend', 'touchleave', 'mouseup']) {
  canvas.addEventListener(ev, function (e) {
    isMousedown = false
    requestIdleCallback(function () { strokeHistory.push([...points]); points = []})
    lineWidth = 0
  })
};

function showTouchPencilDebugDetails() {
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
}

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

async function postPromptsToReplicateService(inputPrompt, localImageUrl) {
  callReplicateService(inputPrompt, localImageUrl)
  .then( data => {
    console.log("received data :" + data);
    if (data == null) throw new Error("Data is empty");
    let newImageUrL = data[0];
    handleIncomingNewImgUrL(newImageUrL);
  })
  .catch ( error => {
    console.error(error);
  });
}