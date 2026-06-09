// index.js
const {PubSub} = require('@google-cloud/pubsub');

const pubsub = new PubSub();
const PUBSUB_TOPIC = process.env.PUBSUB_TOPIC; // e.g. "projects/your-project/topics/telemetry"
const API_KEY = process.env.INGEST_API_KEY;    // set via env var in deployment

exports.ingest = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const key = (req.get('x-api-key') || '').trim();
    if (!API_KEY || key !== API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = req.body;
    if (!payload) return res.status(400).json({ error: 'No payload' });

    const dataBuffer = Buffer.from(JSON.stringify({
      receivedAt: new Date().toISOString(),
      payload
    }));

    await pubsub.topic(PUBSUB_TOPIC).publishMessage({ data: dataBuffer });
    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('ingest error', err);
    return res.status(500).json({ error: 'internal error' });
  }
};
