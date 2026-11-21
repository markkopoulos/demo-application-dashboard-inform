import { prisma } from "../../lib/prisma.js";

/** The authenticated user's profile, role and center context, as the SPA consumes it. */
export async function buildMe(sessionId: string) {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      user: {
        include: {
          memberships: {
            where: { status: "ACTIVE", center: { status: "ACTIVE" } },
            include: { center: { select: { id: true, name: true, slug: true, city: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      activeCenter: { select: { id: true, name: true, slug: true, city: true, status: true, defaultGradeScale: true } },
    },
  });
  const { user } = session;
  const isSuperAdmin = user.platformRole === "SUPER_ADMIN";
  const active = user.memberships.find((m) => m.centerId === session.activeCenterId);
  const center = isSuperAdmin ? session.activeCenter : active ? session.activeCenter : null;

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
      avatarUrl: user.avatarUrl,
    },
    role: isSuperAdmin ? "SUPER_ADMIN" : (active?.role ?? null),
    center,
    centers: user.memberships.map((m) => ({ ...m.center, role: m.role })),
    csrfToken: session.csrfToken,
    sessionExpiresAt: session.expiresAt,
  };
}
