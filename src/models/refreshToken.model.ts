import { Schema, model, Document } from "mongoose";

/**
 * RefreshToken document interface
 */
export interface IRefreshToken extends Document {
  userId: string;
  token: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * RefreshToken schema definition
 */
const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId as any,
      required: true,
      ref: "User",
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revoked: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to auto-delete expired tokens (expiresAt index defined via field, TTL option removes old docs)
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model<IRefreshToken>(
  "RefreshToken",
  RefreshTokenSchema,
  "refreshtokens"
);
