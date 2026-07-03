import { z } from "zod";

export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export const insertBoxSchema = z.object({
  name: z.string(),
  location: z.string(),
  isImportant: z.boolean().optional(),
});

export const insertItemSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  boxId: z.string(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = { id: string; username: string };
export type Box = { id: string; name: string; location: string; userId: string; qrToken: string; boxNumber: string; isImportant: boolean; itemCount?: number };
export type Item = { id: string; name: string; description?: string; boxId: string; userId: string };
export type InsertBox = z.infer<typeof insertBoxSchema>;
export type InsertItem = z.infer<typeof insertItemSchema>;
