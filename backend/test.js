const axios = require("axios");

async function test() {
  const res = await axios.post(
    "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
    {
      inputs: "hello world"
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`
      }
    }
  );

  console.log(res.data.length);
}

test();