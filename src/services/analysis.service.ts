import { GoogleGenAI } from '@google/genai';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { TelemetryModel } from '../models/telemetry.model';
import { logger } from '../utils/logger';
import { config } from '../config';

// Initialize Gemini client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  logger.error('GEMINI_API_KEY not set in .env');
}
const genAI = new GoogleGenAI({ apiKey: apiKey || '' });

// ======================================================
// LOAD ML MODEL via Python
// ======================================================

interface MLPredictionResult {
  who_status: string;
  ml_prediction: string;
  ml_probability: number;
  reason: string;
}

/**
 * Call Python ML prediction script
 */
const callPythonMLPredictor = (sampleData: {
  ph?: number;
  turbidity?: number;
  conductivity?: number;
  dissolved_oxygen?: number;
  disolved_oxygen?: number;
  tds?: number;
}): Promise<MLPredictionResult> => {
  return new Promise((resolve, reject) => {
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
          logger.warn(`⚠️  Python process exited with code ${code}: ${errorOutput}`);
          return resolve({
            who_status: 'Unable to Assess',
            ml_prediction: 'Model Unavailable',
            ml_probability: 0.0,
            reason: 'ML model temporarily unavailable'
          });
        }

        try {
          const result = JSON.parse(output.trim());
          resolve(result);
        } catch (parseErr) {
          logger.error('Failed to parse Python output:', output);
          resolve({
            who_status: 'Unable to Assess',
            ml_prediction: 'Parsing Error',
            ml_probability: 0.0,
            reason: 'Error parsing ML prediction'
          });
        }
      });

      python.on('error', (err) => {
        logger.error('Python process error:', err);
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Initialize ML service
 */
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

// ======================================================
// GEMINI INSIGHTS GENERATION
// ======================================================

export interface PredictionResult {
  who_status: string;
  ml_prediction: string;
  ml_probability: number;
  ai_insights: string;
}

export const generateWaterInsights = async (
  sample: any,
  prediction: MLPredictionResult
): Promise<string> => {
  try {
    if (!apiKey) {
      return 'AI service not configured. Set GEMINI_API_KEY to enable insights.';
    }

    const prompt = `
You are an environmental and water-treatment engineering expert.

Measured water parameters:
- pH: ${sample.ph ?? 'N/A'}
- Turbidity: ${sample.turbidity ?? 'N/A'} NTU
- Electrical Conductivity: ${sample.conductivity ?? 'N/A'} µS/cm
- Dissolved Oxygen: ${sample.dissolved_oxygen ?? sample.disolved_oxygen ?? 'N/A'} mg/L
- Total Dissolved Solids (TDS): ${sample.tds ?? 'N/A'} ppm

System decision: ${prediction.who_status}
ML confidence: ${(prediction.ml_probability * 100).toFixed(1)}%

Your task is to generate a structured expert report with the following sections:

### 1. Water Quality Classification
- Describe the overall quality grade of the water (e.g., potable, marginal, industrial-grade, contaminated).

### 2. Key Issues Identified
- Briefly list which parameters are out of range and why they matter.

### 3. Recommended Treatment & Filtration Methods
Suggest suitable treatment methods based on the measured parameters.
Examples (do NOT limit yourself to these):
- pH correction using lime, caustic soda, soda ash, or CO₂ dosing
- Turbidity removal using coagulation–flocculation (alum, ferric salts)
- Membrane separation (RO / UF / NF) for high EC or TDS
- Activated carbon filtration
- Aeration or oxygenation for low dissolved oxygen
- Ion exchange where applicable

Explain **why** each method is recommended.

⚠️ These are advisory engineering suggestions, not operational instructions.

### 4. Post-Treatment Usage Possibilities
After appropriate treatment, suggest suitable uses such as:
- Agricultural irrigation (mention specific crops by name)
- Horticulture or home gardening (mention plant types)
- Pisciculture or aquaculture (mention fish types if suitable)
- Industrial or non-potable reuse if applicable

### 5. Health & Environmental Considerations
- Summarize any remaining risks or precautions.

### 6. Short Conclusion
- 2 concise lines summarizing treatment feasibility and reuse potential.

Formatting rules:
- Use clear headings
- Use bullet points
- Keep language simple and practical
`;

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || 'AI insight generation returned no text.';
  } catch (err: any) {
    logger.error('Gemini insight generation error:', err);
    return `⚠️ AI insight generation failed.\n\nError: ${err.message || String(err)}`;
  }
};

// ======================================================
// MAIN ANALYSIS FUNCTION
// ======================================================

export const analyzeDeviceWaterQuality = async (
  deviceId: string
): Promise<PredictionResult> => {
  try {
    // Fetch latest telemetry
    const latestTelemetry = await TelemetryModel.findOne({ deviceId }).sort({ ts: -1 });

    if (!latestTelemetry) {
      throw new Error('No telemetry data found for this device');
    }

    const sample = {
      ph: latestTelemetry.ph,
      turbidity: latestTelemetry.turbidity,
      conductivity: latestTelemetry.conductivity,
      dissolved_oxygen: latestTelemetry.dissolved_oxygen,
      tds: latestTelemetry.tds,
    };

    // Make prediction using Python
    const prediction = await callPythonMLPredictor(sample);

    // Generate AI insights
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
