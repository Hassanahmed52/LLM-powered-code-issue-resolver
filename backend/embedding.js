const { pipeline } = require('@xenova/transformers');

let extractor;

async function loadModel() {
  if (!extractor) {
    extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'
    );
  }
  return extractor;
}

async function getEmbedding(text) {
  const model = await loadModel();

  const output = await model(text, {
    pooling: 'mean',
    normalize: true
  });

  return Array.from(output.data);
}

module.exports = {
  getEmbedding
};