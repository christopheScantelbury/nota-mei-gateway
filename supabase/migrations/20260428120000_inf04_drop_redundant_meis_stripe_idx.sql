DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schemaname, c.relname AS idxname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_index i ON i.indexrelid = c.oid
    JOIN pg_class t ON t.oid = i.indrelid
    WHERE n.nspname = 'public'
      AND t.relname = 'meis'
      AND c.relkind = 'i'
      AND i.indisunique
      AND pg_get_indexdef(c.oid) LIKE '%WHERE%'
      AND pg_get_indexdef(c.oid) ILIKE '%stripe_customer_id%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', r.schemaname, r.idxname);
  END LOOP;
END $$;
