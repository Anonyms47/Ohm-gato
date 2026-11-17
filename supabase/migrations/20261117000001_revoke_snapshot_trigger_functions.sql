-- Les fonctions de déclencheur des dates figées n'ont pas à être exposées par l'API : accès retiré aux visiteurs.
revoke all on function public.orders_snapshot_schedule() from public, anon, authenticated;
revoke all on function public.orders_keep_schedule_snapshot() from public, anon, authenticated;
