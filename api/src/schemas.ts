import { z } from "zod";

export const STATUSES = ["to_play", "playing", "finished", "dropped"] as const;
export type Status = (typeof STATUSES)[number];

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8, "8 caractères minimum").max(200),
});

const gameFields = {
  title: z.string().trim().min(1).max(200),
  platform: z.string().trim().max(60).nullish(),
  status: z.enum(STATUSES),
  rating: z.number().int().min(1).max(10).nullish(),
  hoursPlayed: z.number().int().min(0).max(100000),
  coverUrl: z.string().url().max(500).nullish(),
  notes: z.string().max(2000).nullish(),
  finishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
};

export const gameCreateSchema = z.object({
  ...gameFields,
  status: gameFields.status.default("to_play"),
  hoursPlayed: gameFields.hoursPlayed.default(0),
});

export const gameUpdateSchema = z.object(gameFields).partial();

export const listQuerySchema = z.object({
  status: z.enum(STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
