-- TheatGood P2: apply ONLY after 0002_easy_spot and Neon Auth + Data API
-- are configured on this SAME database branch.
-- Do not run on staging/main without separately authorised release.
-- Neon Data API verifies JWTs and sets the authenticated role and auth.user_id().
BEGIN;

ALTER TABLE public.watch_logs ALTER COLUMN user_id SET DEFAULT (auth.user_id());
ALTER TABLE public.watch_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watch_logs FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.watch_logs FROM PUBLIC;
REVOKE ALL ON TABLE public.watch_logs FROM anonymous;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.watch_logs TO authenticated;

CREATE POLICY watch_logs_select_owner ON public.watch_logs
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.user_id()));

CREATE POLICY watch_logs_insert_owner ON public.watch_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.user_id()));

CREATE POLICY watch_logs_update_owner ON public.watch_logs
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.user_id()))
  WITH CHECK (user_id = (SELECT auth.user_id()));

CREATE POLICY watch_logs_delete_owner ON public.watch_logs
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.user_id()));

COMMIT;
