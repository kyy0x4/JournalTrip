-- RLS trip_cancel_evaluations: baca publik (anon + login), tulis khusus admin kmdimcc.
-- Guard di DB via auth.jwt email — bukan cuma di frontend.
ALTER TABLE trip_cancel_evaluations ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON trip_cancel_evaluations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON trip_cancel_evaluations TO authenticated;

DROP POLICY IF EXISTS "trip_cancel_evaluations_public_select" ON trip_cancel_evaluations;
CREATE POLICY "trip_cancel_evaluations_public_select"
  ON trip_cancel_evaluations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "trip_cancel_evaluations_admin_insert" ON trip_cancel_evaluations;
CREATE POLICY "trip_cancel_evaluations_admin_insert"
  ON trip_cancel_evaluations FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'kmdimcc@gmail.com');

DROP POLICY IF EXISTS "trip_cancel_evaluations_admin_update" ON trip_cancel_evaluations;
CREATE POLICY "trip_cancel_evaluations_admin_update"
  ON trip_cancel_evaluations FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'kmdimcc@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'kmdimcc@gmail.com');

DROP POLICY IF EXISTS "trip_cancel_evaluations_admin_delete" ON trip_cancel_evaluations;
CREATE POLICY "trip_cancel_evaluations_admin_delete"
  ON trip_cancel_evaluations FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'kmdimcc@gmail.com');
