-- Identité officielle de l'exploitante : nom civil complété (privé, jamais lu par le site public).
-- NINEA, RCCM et adresse administrative restent vides tant qu'OHMEGATO n'est pas formalisée.
update public.site_settings
   set value = jsonb_set(value, '{civil_name}', to_jsonb('Alimatou Sadiya Thiam'::text))
 where key = 'legal.identity' and coalesce(value ->> 'civil_name', '') = '';
