import axios from 'axios';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { TempReadingModel } from '../models/temp-reading.model';
import { logger } from '../utils/logger';
import { config } from '../config';

const apiKey = process.env.GROQ_API_KEY;
const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

if (!apiKey) {
  logger.warn('GROQ_API_KEY not set. AI insights will be disabled.');
}

interface MLPredictionResult {
  who_status: string;
  ml_prediction: string;
  ml_probability: number;
  reason: string;
}

type WaterSample = {
  temperature?: number;
  tempC?: number;
  ph?: number;
  turbidity?: number;
  conductivity?: number;
  dissolved_oxygen?: number;
  disolved_oxygen?: number;
  tds?: number;
};

export interface PredictionResult {
  who_status: string;
  ml_prediction: string;
  ml_probability: number;
  ai_insights: string;
}

const getNumber = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const getDissolvedOxygen = (sample: WaterSample) =>
  getNumber(sample.dissolved_oxygen ?? sample.disolved_oxygen, 7);

const getTemperature = (sample: WaterSample) =>
  getNumber(sample.temperature ?? sample.tempC, 25);

const calculateWaterQualityIndex = (sample: WaterSample) => {
  const ph = getNumber(sample.ph, 7);
  const turbidity = getNumber(sample.turbidity, 1);
  const conductivity = getNumber(sample.conductivity, 300);
  const dissolvedOxygen = getDissolvedOxygen(sample);
  const tds = getNumber(sample.tds, 200);
  const temperature = getTemperature(sample);

  const standards = {
    phUpper: 8.5,
    phLower: 6.5,
    tds: 500,
    conductivity: 300,
    dissolvedOxygen: 5,
    turbidity: 5,
    temperature: 25,
  };

  const weights = {
    ph: 4,
    tds: 3,
    conductivity: 3,
    dissolvedOxygen: 5,
    turbidity: 3,
    temperature: 2,
  };

  const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  const phStandard = ph >= 7 ? standards.phUpper : standards.phLower;
  const phQuality = 100 * (Math.abs(ph - 7) / Math.abs(phStandard - 7));
  const dissolvedOxygenQuality = 100 * ((14.6 - dissolvedOxygen) / (14.6 - standards.dissolvedOxygen));

  const wqi =
    (weights.ph / totalWeight) * phQuality +
    (weights.tds / totalWeight) * (100 * (tds / standards.tds)) +
    (weights.conductivity / totalWeight) * (100 * (conductivity / standards.conductivity)) +
    (weights.dissolvedOxygen / totalWeight) * dissolvedOxygenQuality +
    (weights.turbidity / totalWeight) * (100 * (turbidity / standards.turbidity)) +
    (weights.temperature / totalWeight) * (100 * (temperature / standards.temperature));

  return Math.round(Math.max(0, wqi) * 100) / 100;
};

const getWqiStatus = (wqi: number) => {
  if (wqi <= 25) return 'EXCELLENT';
  if (wqi <= 50) return 'GOOD';
  if (wqi <= 75) return 'POOR';
  if (wqi <= 100) return 'VERY POOR';
  return 'UNSUITABLE FOR DRINKING (CRITICAL)';
};

const getWhoViolations = (sample: WaterSample) => {
  const ph = getNumber(sample.ph, 7);
  const turbidity = getNumber(sample.turbidity, 1);
  const conductivity = getNumber(sample.conductivity, 300);
  const dissolvedOxygen = getDissolvedOxygen(sample);
  const tds = getNumber(sample.tds, 200);
  const violations: string[] = [];

  if (ph < 6.5 || ph > 8.5) violations.push('pH outside 6.5-8.5');
  if (turbidity > 5) violations.push('turbidity above 5 NTU');
  if (conductivity > 1500) violations.push('conductivity above 1500 uS/cm');
  if (dissolvedOxygen < 4) violations.push('dissolved oxygen below 4.0 mg/L');
  if (tds > 1000) violations.push('TDS above 1000 mg/L');

  return violations;
};

const classifyParameters = (sample: WaterSample) => {
  const ph = getNumber(sample.ph, 7);
  const turbidity = getNumber(sample.turbidity, 1);
  const conductivity = getNumber(sample.conductivity, 300);
  const dissolvedOxygen = getDissolvedOxygen(sample);
  const tds = getNumber(sample.tds, 200);

  const tdsStatus = tds > 1000 ? 'Worse' : tds >= 50 && tds <= 300 ? 'Best' : tds <= 600 ? 'Acceptable' : 'Elevated';
  const ecStatus = conductivity > 1500 ? 'Worse' : conductivity >= 100 && conductivity <= 400 ? 'Best' : conductivity <= 1000 ? 'Acceptable' : 'Elevated';
  const doStatus = dissolvedOxygen < 4 ? 'Worse' : dissolvedOxygen <= 6.5 ? 'Acceptable' : dissolvedOxygen <= 8 ? 'Best' : 'High';
  const phStatus = ph < 6.5 || ph > 8.5 ? 'Worse' : 'Best';
  const turbidityStatus = turbidity > 5 ? 'Worse' : turbidity < 1 ? 'Best' : 'Acceptable';

  return [
    `TDS ${tds} mg/L: ${tdsStatus}`,
    `EC ${conductivity} uS/cm: ${ecStatus}`,
    `DO ${dissolvedOxygen} mg/L: ${doStatus}`,
    `pH ${ph}: ${phStatus}`,
    `Turbidity ${turbidity} NTU: ${turbidityStatus}`,
  ].join('; ');
};

const ruleBasedPrediction = (sample: WaterSample): MLPredictionResult => {
  const whoViolations = getWhoViolations(sample);

  if (whoViolations.length > 0) {
    return {
      who_status: 'Unsafe (WHO Rule Violation)',
      ml_prediction: 'Non-Potable Water',
      ml_probability: 0,
      reason: whoViolations.join('; '),
    };
  }

  const wqi = calculateWaterQualityIndex(sample);
  const isPotable = wqi <= 50;

  return {
    who_status: isPotable ? 'Safe (Potable)' : 'Needs Treatment',
    ml_prediction: isPotable ? 'Potable Water' : 'Non-Potable Water',
    ml_probability: Math.min(0.99, Math.max(0.01, (100 - Math.min(wqi, 100)) / 100)),
    reason: 'Rule-based fallback assessment',
  };
};

const callPythonMLPredictor = (sampleData: WaterSample): Promise<MLPredictionResult> => {
  return new Promise((resolve) => {
    try {
      const pythonScript = path.join(__dirname, '..', '..', 'predict_water_quality.py');
      const python = spawn(config.pythonBin, [pythonScript, JSON.stringify(sampleData)]);
      let output = '';
      let errorOutput = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          logger.warn(`Python process exited with code ${code}: ${errorOutput}`);
          return resolve(ruleBasedPrediction(sampleData));
        }

        try {
          const result = JSON.parse(output.trim());
          resolve(result);
        } catch {
          logger.error('Failed to parse Python output:', output);
          resolve(ruleBasedPrediction(sampleData));
        }
      });

      python.on('error', (err) => {
        logger.error('Python process error:', err);
        resolve(ruleBasedPrediction(sampleData));
      });
    } catch {
      resolve(ruleBasedPrediction(sampleData));
    }
  });
};

export const loadMLArtifacts = async () => {
  const modelDir = path.join(__dirname, '..', '..');
  const requiredFiles = ['predict_water_quality.py', 'gb_water_model.pkl', 'scaler.pkl', 'model_features.pkl'];
  const missingFiles = requiredFiles.filter((fileName) => !fs.existsSync(path.join(modelDir, fileName)));

  if (missingFiles.length > 0) {
    logger.warn(`ML service will run in degraded mode. Missing files: ${missingFiles.join(', ')}`);
    return false;
  }

  logger.info('ML service initialized');
  return true;
};

const fallbackInsight = (sample: any, prediction: MLPredictionResult) => {
  const wqi = calculateWaterQualityIndex(sample);
  const wqiStatus = getWqiStatus(wqi);
  const parameterAnalysis = classifyParameters(sample);

  return [
    `1. Overall Water Quality Score: WQI ${wqi} (${wqiStatus}).`,
    `2. Potability Assessment: ${prediction.ml_prediction}.`,
    `3. Parameter Analysis: ${parameterAnalysis}.`,
    `4. Risks: ${prediction.reason || 'Untreated use may affect health, taste, scaling, and aquatic safety'}.`,
    '5. Recommended Treatment: Use filtration, disinfection, aeration, or RO based on failed parameters.',
    '6. Environmental Impact: Avoid discharge or irrigation until abnormal parameters are controlled.',
    '7. One-line Conclusion: Treat and retest before drinking use.',
  ].join('\n\n');
};

const sanitizeInsight = (text: string) =>
  text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .trim();

export const generateWaterInsights = async (
  sample: any,
  prediction: MLPredictionResult
): Promise<string> => {
  try {
    const wqi = calculateWaterQualityIndex(sample);
    const wqiStatus = getWqiStatus(wqi);
    const parameterAnalysis = classifyParameters(sample);

    if (!apiKey) {
      return fallbackInsight(sample, prediction);
    }

    const prompt = `
You are a professional water quality expert.

Analyze the following water sample.

Temperature = ${sample.temperature ?? sample.tempC ?? 'N/A'} C
pH = ${sample.ph ?? 'N/A'}
Turbidity = ${sample.turbidity ?? 'N/A'} NTU
Conductivity = ${sample.conductivity ?? 'N/A'} uS/cm
Dissolved Oxygen = ${sample.dissolved_oxygen ?? sample.disolved_oxygen ?? 'N/A'} mg/L
TDS = ${sample.tds ?? 'N/A'} ppm

Water Quality Index (WQI):
${wqi} (${wqiStatus})

ML Result:
${prediction.ml_prediction}

WHO Status:
${prediction.who_status}

WHO-based threshold analysis:
${parameterAnalysis}

Provide exactly these seven numbered sections:

1. Overall Water Quality Score
2. Potability Assessment
3. Parameter Analysis
4. Risks
5. Recommended Treatment
6. Environmental Impact
7. One-line Conclusion

Maximum 150 words.

Be concise and professional.
For section 1, state the WQI value exactly as "WQI ${wqi} (${wqiStatus})"; do not convert it to a /100 score.
Do not use markdown syntax such as ###, **, *, or bullet symbols.
`;

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: groqModel,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const generated = response.data?.choices?.[0]?.message?.content;
    return generated ? sanitizeInsight(generated) : fallbackInsight(sample, prediction);
  } catch (err: any) {
    logger.error('Groq insight generation error:', err?.response?.data || err);
    return fallbackInsight(sample, prediction);
  }
};

export const analyzeDeviceWaterQuality = async (
  deviceId: string
): Promise<PredictionResult> => {
  try {
    const latestTelemetry = await TempReadingModel.findOne({ device_id: deviceId }).sort({ createdAt: -1 });

    if (!latestTelemetry) {
      throw new Error('No telemetry data found for this device');
    }

    const sample = {
      ph: latestTelemetry.ph,
      turbidity: latestTelemetry.turbidity,
      conductivity: latestTelemetry.ec,
      dissolved_oxygen: latestTelemetry.do,
      tds: latestTelemetry.tds,
    };

    const prediction = await callPythonMLPredictor(sample);
    const aiInsights = await generateWaterInsights(sample, prediction);

    return {
      who_status: prediction.who_status,
      ml_prediction: prediction.ml_prediction,
      ml_probability: prediction.ml_probability,
      ai_insights: aiInsights,
    };
  } catch (err) {
    logger.error('Analysis error:', err);
    throw err;
  }
};
