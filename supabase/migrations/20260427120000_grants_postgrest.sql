GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.planos TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meis TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emissoes_mensais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
