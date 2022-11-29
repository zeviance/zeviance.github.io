import Replicate from 'replicate-js'

// Replicate const
const REPLICATE_DEFAULT_PROMPT = "darth vader eating icecream";
const REPLICATE_RESULT_WIDTH = 512;
const REPLICATE_RESULT_HEIGHT = 512;
const REPLICATE_NUM_OF_IMAGES = 1;
const replicate = new Replicate({
  proxyUrl: 'https://salty-oasis-20821.herokuapp.com/api',
  pollingInterval: 1000,
});

export async function callReplicateService(inputPrompt, localImageUrl) {
  // TODO: can potentially save one round trip down the road.
  console.log(`posting to replicate service with prompt: ${inputPrompt} and localImageUrl: ${localImageUrl}`);
  let inputParam = {
    prompt: inputPrompt,
    grid_size: REPLICATE_NUM_OF_IMAGES,
    width: REPLICATE_RESULT_WIDTH,
    height: REPLICATE_RESULT_HEIGHT,
  }
  let diffusionModel = null;
  if (localImageUrl.length > 0 ) {
    inputParam.init_image = localImageUrl;
    diffusionModel = await replicate.models.get("stability-ai/stable-diffusion/");
  } else {
    diffusionModel = await replicate.models.get("prompthero/openjourney/");
  }
  return await diffusionModel.predict(inputParam);
}