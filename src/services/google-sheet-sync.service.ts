import axios from "axios";
import { StatusModel } from "../models/status.model";
import { TempReadingModel } from "../models/temp-reading.model";
import { logger } from "../utils/logger";

type CsvRow = Record<string, string>;

export interface GoogleSheetSyncOptions {
  sheetId: string;
  gid: string;
  deviceId?: string;
  limit?: number;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields.map((field) => field.trim());
}

function parseCsv(csv: string): CsvRow[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().trim());

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line);
    const row = headers.reduce<CsvRow>((csvRow, header, headerIndex) => {
      csvRow[header] = values[headerIndex] ?? "";
      return csvRow;
    }, {});

    row.__rowNumber = String(index + 2);
    return row;
  }).filter((row) => {
    return Object.entries(row).some(([key, value]) => {
      return key !== "__rowNumber" && value.trim().length > 0;
    });
  });
}

async function updateLatestDeviceStatuses(
  latestByDeviceId: Map<
    string,
    {
      timestamp: Date;
      temperature?: number;
      ph?: number;
      tds?: number;
      do?: number;
      ec?: number;
      turbidity?: number;
    }
  >
) {
  for (const [deviceId, latestReading] of latestByDeviceId) {
    await StatusModel.updateOne(
      { deviceId },
      {
        $set: {
          online: true,
          lastSeen: latestReading.timestamp,
          metrics: {
            temperature: latestReading.temperature,
            tempC: latestReading.temperature,
            ph: latestReading.ph,
            tds: latestReading.tds,
            do: latestReading.do,
            dissolved_oxygen: latestReading.do,
            ec: latestReading.ec,
            conductivity: latestReading.ec,
            turbidity: latestReading.turbidity,
          },
        },
      },
      { upsert: true }
    );
  }
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}

function toTimestamp(dateValue: string | undefined, timeValue: string | undefined): Date {
  const date = (dateValue || "").trim();
  const time = (timeValue || "").trim();
  const timestamp = date ? new Date(time ? `${date}T${time}` : date) : new Date();

  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`Invalid sheet timestamp: date="${dateValue || ""}" time="${timeValue || ""}"`);
  }

  return timestamp;
}

function buildExportUrl(sheetId: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv&gid=${encodeURIComponent(gid)}`;
}

export async function syncGoogleSheetToMongo(options: GoogleSheetSyncOptions) {
  const { sheetId, gid, deviceId, limit } = options;

  if (!sheetId) throw new Error("Google Sheet ID is required");
  if (!gid) throw new Error("Google Sheet gid is required");

  const response = await axios.get<string>(buildExportUrl(sheetId, gid), {
    responseType: "text",
    timeout: 15000,
  });

  const rows = parseCsv(response.data);
  const selectedRows = typeof limit === "number" && limit > 0 ? rows.slice(-limit) : rows;

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const latestByDeviceId = new Map<
    string,
    {
      timestamp: Date;
      temperature?: number;
      ph?: number;
      tds?: number;
      do?: number;
      ec?: number;
      turbidity?: number;
    }
  >();

  for (const row of selectedRows) {
    try {
      if (!row.date || !row.time) {
        skipped += 1;
        continue;
      }

      const timestamp = toTimestamp(row.date, row.time);
      const sheetDeviceId = row["device id"] || row.device_id || row.deviceid;
      const resolvedDeviceId = deviceId || sheetDeviceId;

      if (!resolvedDeviceId) {
        skipped += 1;
        continue;
      }

      const sourceRowKey = `google-sheet:${sheetId}:${gid}:row:${row.__rowNumber}`;
      const legacySourceRowKey = `google-sheet:${sheetId}:${gid}:${sheetDeviceId || resolvedDeviceId}:${timestamp.toISOString()}`;

      const reading = {
        device_id: resolvedDeviceId,
        temperature: toNumber(row.temperature),
        ph: toNumber(row.ph),
        tds: toNumber(row.tds),
        do: toNumber(row.do),
        ec: toNumber(row.ec),
        turbidity: toNumber(row.turbidity),
        source: "google-sheet",
        sourceRowKey,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      if (
        reading.temperature === undefined &&
        reading.ph === undefined &&
        reading.tds === undefined &&
        reading.do === undefined &&
        reading.ec === undefined &&
        reading.turbidity === undefined
      ) {
        skipped += 1;
        continue;
      }

      const result = await TempReadingModel.collection.updateOne(
        { $or: [{ sourceRowKey }, { sourceRowKey: legacySourceRowKey }] },
        { $set: reading },
        { upsert: true }
      );

      if (result.upsertedCount > 0) inserted += 1;
      else if (result.modifiedCount > 0) updated += 1;

      const latestReading = latestByDeviceId.get(resolvedDeviceId);
      if (!latestReading || timestamp > latestReading.timestamp) {
        latestByDeviceId.set(resolvedDeviceId, { ...reading, timestamp });
      }
    } catch (error) {
      skipped += 1;
      logger.warn("Skipping invalid Google Sheet row", row, error);
    }
  }

  await updateLatestDeviceStatuses(latestByDeviceId);

  const latestResult = Array.from(latestByDeviceId.entries()).sort(
    ([, left], [, right]) => right.timestamp.getTime() - left.timestamp.getTime()
  )[0];

  return {
    ok: true,
    sheetId,
    gid,
    fetched: rows.length,
    processed: selectedRows.length,
    inserted,
    updated,
    skipped,
    latestTimestamp: latestResult?.[1].timestamp,
    latestDeviceId: latestResult?.[0],
  };
}
