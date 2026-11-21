import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { parse } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { buildMe } from "./service.js";

export const meRouter = Router();
meRouter.use(requireAuth);

const ProfileBody = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  locale: z.enum(["el", "en"]).optional(),
});

meRouter.patch("/profile", async (req, res) => {
  const body = parse(ProfileBody, req.body);
  await prisma.user.update({ where: { id: req.auth!.user.id }, data: body });
  res.json(await buildMe(req.auth!.sessionId));
});
