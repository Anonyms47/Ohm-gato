-- File d'e-mails : réservation atomique, reprise contrôlée, abandon, réservations interrompues,
-- journal du prestataire inaccessible aux clientes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Aucun accès client.
set local role anon;
select throws_ok($$ select * from public.email_provider_checks $$, '42501', null, 'anon : journal du prestataire inaccessible');
select throws_ok($$ select public.claim_email_outbox(10) $$, '42501', null, 'anon : réservation interdite');
reset role;
set local role authenticated;
select throws_ok($$ select * from public.email_provider_checks $$, '42501', null, 'cliente connectée : journal inaccessible');
select throws_ok($$ select public.admin_retry_emails(array[1]::bigint[], null) $$, '42501', null, 'cliente connectée : reprise interdite');
select throws_ok($$ select public.admin_skip_emails(array[1]::bigint[], null) $$, '42501', null, 'cliente connectée : abandon interdit');
reset role;

set local role service_role;
insert into public.email_outbox (idempotency_key, template, to_email, payload) values
  ('test:due', 'admin_digest', 'equipe@example.com', '{}'),
  ('test:later', 'admin_digest', 'equipe@example.com', '{}');
update public.email_outbox set next_attempt_at = now() + interval '1 hour' where idempotency_key = 'test:later';

-- Deux processus : le premier réserve le message dû, le second ne trouve plus rien.
create temp table first_claim as select * from public.claim_email_outbox(10);
create temp table second_claim as select * from public.claim_email_outbox(10);
select is((select count(*)::int from first_claim), 1, 'seul le message dû est réservé');
select is((select idempotency_key from first_claim), 'test:due', 'le message à la date dépassée');
select is((select count(*)::int from second_claim), 0, 'un second processus ne réserve jamais le même message');
select is((select status from public.email_outbox where idempotency_key = 'test:due'), 'sending', 'réservé : en cours d''envoi');
select is((select attempts from public.email_outbox where idempotency_key = 'test:due'), 1, 'une tentative comptée');

-- Configuration à corriger : message en pause, repris à la main, même ligne et même clé.
update public.email_outbox set status = 'held', error_category = 'key_invalid' where idempotency_key = 'test:due';
select is(public.admin_retry_emails(array[(select id from public.email_outbox where idempotency_key = 'test:due')]::bigint[], null), 1, 'reprise d''un message en pause');
select is((select status || ':' || error_category from public.email_outbox where idempotency_key = 'test:due'), 'pending:retry_requested', 'remis en envoi, reprise manuelle notée');
select is((select count(*)::int from public.email_outbox where idempotency_key = 'test:due'), 1, 'aucune copie : même clé d''idempotence');

-- Un message envoyé n'est jamais repris ni abandonné.
update public.email_outbox set status = 'sent', sent_at = now() where idempotency_key = 'test:due';
select is(public.admin_retry_emails(array[(select id from public.email_outbox where idempotency_key = 'test:due')]::bigint[], null), 0, 'message envoyé : pas de renvoi');
select is(public.admin_skip_emails(array[(select id from public.email_outbox where idempotency_key = 'test:due')]::bigint[], null), 0, 'message envoyé : pas d''abandon');

-- Abandon d'un message en échec.
update public.email_outbox set status = 'failed' where idempotency_key = 'test:later';
select is(public.admin_skip_emails(array[(select id from public.email_outbox where idempotency_key = 'test:later')]::bigint[], null), 1, 'abandon d''un message en échec');
select is((select status from public.email_outbox where idempotency_key = 'test:later'), 'skipped', 'abandonné : ne partira jamais');

-- Réservation interrompue : jamais renvoyée automatiquement.
insert into public.email_outbox (idempotency_key, template, to_email, status, claimed_at) values ('test:stuck', 'admin_digest', 'equipe@example.com', 'sending', now() - interval '1 hour');
select is(public.release_stale_email_claims(15), 1, 'réservation interrompue détectée');
select is((select status || ':' || error_category from public.email_outbox where idempotency_key = 'test:stuck'), 'failed:unknown_outcome', 'à vérifier par l''équipe, sans renvoi automatique');

select * from finish();
rollback;
