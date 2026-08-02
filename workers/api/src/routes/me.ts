import { Hono } from "hono";
import type { Env } from "../env";
import type { AppVariables, AppContext } from "../middleware";
import { requireAuth, isErrorResponse } from "../middleware";

export const meRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

meRoutes.get("/me", async (c) => {
  const user = await requireAuth(c as AppContext);
  if (isErrorResponse(user)) return user;

  return c.json({
    id: user.id,
    handle: user.handle,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
  });
});
