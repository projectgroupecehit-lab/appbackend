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

const calculateQualityScore = (sample: {
  ph?: number;
  turbidity?: number;
  conductivity?: number;
  dissolved_oxygen?: number;
  disolved_oxygen?: number;
  tds?: number;
}) => {
  const ph = getNumber(sample.ph, 7);
  const turbidity = getNumber(sample.turbidity, 1);
  const conductivity = getNumber(sample.conductivity, 300);
  const dissolvedOxygen = getNumber(sample.dissolved_oxygen ?? sample.disolved_oxygen, 7);
  const tds = getNumber(sample.tds, 200);

  const penalties = [
    Math.min(Math.abs(ph - 7.2) * 12, 25),
    Math.min(Math.max(turbidity - 1, 0) * 5, 30),
    Math.min(Math.max(conductivity - 300, 0) / 20, 25),
    Math.min(Math.abs(dissolvedOxygen - 7) * 8, 20),
    Math.min(Math.max(tds - 250, 0) / 12, 25),
  ];

  return Math.round(Math.max(0, 100 - penalties.reduce((sum, penalty) => sum + penalty, 0)));
};

const ruleBasedPrediction = (sample: {
  ph?: number;
  turbidity?: number;
  conductivity?: number;
  dissolved_oxygen?: number;
  disolved_oxygen?: number;
  tds?: number;
}): MLPredictionResult => {
  const ph = getNumber(sample.ph, 7);
  const turbidity = getNumber(sample.turbidity, 1);
  const conductivity = getNumber(sample.conductivity, 300);
  const dissolvedOxygen = getNumber(sample.dissolved_oxygen ?? sample.disolved_oxygen, 7);
  const tds = getNumber(sample.tds, 200);

  const hasWhoViolation =
    ph < 6.5 ||
    ph > 8.5 ||
    turbidity >= 5 ||
    conductivity >= 400 ||
    dissolvedOxygen < 6.5 ||
    dissolvedOxygen > 8 ||
    tds >= 400;

  if (hasWhoViolation) {
    return {
      who_status: 'Unsafe (WHO Rule Violation)',
      ml_prediction: 'Non-Potable Water',
      ml_probability: 0,
      reason: 'WHO safety thresholds exceeded',
    };
  }

  const score = calculateQualityScore(sample);

  return {
    who_status: score >= 75 ? 'Safe (Potable)' : 'Needs Treatment',
    ml_prediction: score >= 75 ? 'Potable Water' : 'Non-Potable Water',
    ml_probability: Math.min(0.99, Math.max(0.01, score / 100)),
    reason: 'Rule-based fallback assessment',
  };
};

const callPythonMLPredictor = (sampleData: {
  ph?: number;
  turbidity?: number;
  conductivity?: number;
  dissolved_oxygen?: number;
  disolved_oxygen?: number;
  tds?: number;
}): Promise<MLPredictionResult> => {
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
  const score = calculateQualityScore(sample);

  return [
    `1. Overall Water Quality Score: ${score}/100.`,
    `2. Potability Assessment: ${prediction.ml_prediction}.`,
    '3. Parameter Analysis: Review pH, turbidity, conductivity, dissolved oxygen, and TDS against accepted ranges.',
    '4. Risks: Untreated use may affect health, taste, scaling, and aquatic safety.',
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
    const score = calculateQualityScore(sample);

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

Current Water Quality Score:
${score}/100

ML Result:
${prediction.ml_prediction}

WHO Status:
${prediction.who_status}

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
