import html2canvas from 'html2canvas'
import Replicate from 'replicate-js'

require('dotenv').config();

const $force = document.querySelectorAll('#force')[0]
const $touches = document.querySelectorAll('#touches')[0]
const canvas = document.querySelectorAll('canvas')[0]
const canvasImgScr = document.querySelectorAll('#canvasImgScr')[0]
const context = canvas.getContext('2d')
const saveCaptureBtn = document.querySelectorAll('#saveCaptureBtn')[0]
const undoDrawBtn = document.querySelectorAll('#undoDrawBtn')[0]
const clearDrawBtn = document.querySelectorAll('#clearDrawBtn')[0]
const REPLICATE_API_ENDPOINT = "https://api.replicate.com/v1/predictions";
const REPLICATE_API_TOKEN = "Token d79af4b6bf587a3a1dcff2e0b243abbca58fd516";
const REPLICATE_VERSION = "27b93a2413e7f36cd83da926f3656280b2931564ff050bf9575f1fdf9bcd7478";
const REPLICATE_PROMPT = "patrick star on the beach under the sea";
const replicate = new Replicate({token: REPLICATE_API_TOKEN});

let lineWidth = 0
let isMousedown = false
let points = []

canvas.width = window.innerWidth * 2
canvas.height = window.innerHeight * 2

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
}
clearDrawBtn.onclick = clearDraw;

function saveCapture() {
  html2canvas(canvas).then(function(canvas) {
    var localImageDataURL = canvas.toDataURL("image/jpg");
    canvasImgScr.src = localImageDataURL;
    //generateWithImagePrompt(localImageDataURL);
    postPromptsToReplicateService();
  })
}
saveCaptureBtn.onclick = saveCapture;

function generateWithImagePrompt(localImageDataURL) {
  const api = generate({
    apiKey: process.env.DREAMSTUDIO_API_KEY,
    prompt: 'A Patrick Star from spongebob',    
    /*imagePrompt: {
      mime: "image/jpg",
      content: localImageDataURL,
    }*/
  })

  api.on('image', ({ buffer, filePath }) => {
    console.log('Image', buffer, filePath)
  })

  api.on('end', (data) => {
    console.log('Generating Complete', data)
  })
}

for (const ev of ["touchstart", "mousedown"]) {
  canvas.addEventListener(ev, function (e) {
    let pressure = 0.1;
    let x, y;
    if (e.touches && e.touches[0] && typeof e.touches[0]["force"] !== "undefined") {
      if (e.touches[0]["force"] > 0) {
        pressure = e.touches[0]["force"]
      }
      x = e.touches[0].pageX * 2
      y = e.touches[0].pageY * 2
    } else {
      pressure = 1.0
      x = e.pageX * 2
      y = e.pageY * 2
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
      x = e.touches[0].pageX * 2
      y = e.touches[0].pageY * 2
    } else {
      pressure = 1.0
      x = e.pageX * 2
      y = e.pageY * 2
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
    let pressure = 0.1;
    let x, y;

    if (e.touches && e.touches[0] && typeof e.touches[0]["force"] !== "undefined") {
      if (e.touches[0]["force"] > 0) {
        pressure = e.touches[0]["force"]
      }
      x = e.touches[0].pageX * 2
      y = e.touches[0].pageY * 2
    } else {
      pressure = 1.0
      x = e.pageX * 2
      y = e.pageY * 2
    }

    isMousedown = false
    requestIdleCallback(function () { strokeHistory.push([...points]); points = []})
    lineWidth = 0
  })
};

/**
 * Axios declaration to handle all the networking requests here.
 */

// Post Request
// Construct Interceptor
// If response == 201, keep/start pooling, intercept the url first
// as long as status not succeeded or failed, keep pooling
// handle response 
function postPromptsToReplicateService() {
  //const helloWorldModel = replicate.models.get('replicate/hello-world');
  //const helloWorldPrediction = helloWorldModel.predict({ text: "test"});
  //console.log(helloWorldPrediction);
  
  const data = { 
    'version': REPLICATE_VERSION,
    'input': { 'prompt': REPLICATE_PROMPT, }, 
  }; 

  fetch(REPLICATE_API_ENDPOINT, {
    method: 'POST',
    //mode: 'no-cors',
    //credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': REPLICATE_API_TOKEN,
      //'Origin': '',
      //'Host': 'api.replicate.com',
    },
    body: JSON.stringify(data),
  })
  .then((response) => {
    console.log('Response:', response);
    if (!response.ok) {
      return response.text().then(text => { 
        console.log("not ok:", response.error);
        throw new Error(text);})
    }
    return response.json();
  })
  .then((data) => {
    console.log('Data:', data);
    console.log('Data Message:', data.message);
  })
  .catch((error) => {
    console.error('Error:', error);
  });
  
}


