import { Router } from "express";
import {
  createMatchSchema,
  listMatchesQuerySchema,
} from "../validation/matches";
import { db } from "../db/db";
import { matches } from "../db/schema";
import { getMatchStatus } from "../utils/match-status";
import z from "zod";
import { desc } from "drizzle-orm";

const MAX_LIMIT = 100;

export const matchRouter = Router();

matchRouter.get("/", async (req, res) => {
  const parsed = listMatchesQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid payload",
      details: z.treeifyError(parsed.error),
    });
  }

  const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);

  try {
    const data = await db
      .select()
      .from(matches)
      .orderBy(desc(matches.createdAt))
      .limit(limit);
    return res.status(200).json({ data });
  } catch (e) {
    return res.status(500).json({
      error: "Failed to list matches",
      details: e instanceof Error ? e.message : String(e),
    });
  }
});

matchRouter.post("/", async (req, res) => {
  const parsed = createMatchSchema.safeParse(req.body);
  const { data } = parsed;

  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid payload",
      details: z.treeifyError(parsed.error),
    });
  }

  try {
    const [event] = await db
      .insert(matches)
      .values({
        ...parsed.data,
        startTime: new Date(data!.startTime),
        endTime: new Date(data!.endTime),
        homeScore: data!.homeScore ?? 0,
        awayScore: data!.awayScore ?? 0,
        status: getMatchStatus(data!.startTime, data!.endTime),
      })
      .returning();

    return res.status(201).json({
      data: event,
    });
  } catch (e) {
    return res.status(500).json({
      error: "Failed to create match",
      details: e instanceof Error ? e.message : String(e),
    });
  }
});
