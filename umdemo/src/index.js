import html2canvas from 'html2canvas'
import { callReplicateService } from './replicateapi'
import { isBlank, resetCanvas } from './colorCanvas'

const canvas = document.querySelectorAll('canvas')[0]
const saveCaptureBtn = document.querySelectorAll('#saveCaptureBtn')[0]
const resetBtn = document.querySelectorAll('#resetBtn')[0]
const inputField = document.querySelectorAll('#inputField')[0]
const photoHeroUnit =  document.querySelectorAll('#photoHeroUnit')[0]
const photoHeroLoaderUnit = document.querySelectorAll('#photoHeroLoaderUnit')[0]
const heroUnitContainer = document.querySelectorAll('#heroUnitContainer')[0]

photoHeroLoaderUnit.hidden = true;

function reset() {
  resetCanvas();
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
    let localImageDataURL = !isBlank ? canvas.toDataURL("image/jpg", 0.75) : "";
    console.log(localImageDataURL);
    if (inputFieldText.length === 0 && localImageDataURL.length === 0) return;
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