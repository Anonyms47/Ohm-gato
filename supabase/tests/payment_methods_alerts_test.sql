-- Moyens de paiement réglables (Wave, Orange Money) et alertes « prochaine fournée ».
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Réglages de paiement : serveur uniquement, vérification manuelle obligatoire, lien https seulement.
set local role anon;
select throws_ok($$ select * from public.payment_method_settings $$, '42501', null, 'visiteur : réglages de paiement inaccessibles');
reset role;
set local role service_role;
select is((select enabled from public.payment_method_settings where provider = 'orange_money'), false, 'Orange Money désactivé par défaut');
select is((select merchant_link is null from public.payment_method_settings where provider = 'orange_money'), true, 'aucun lien Orange Money inventé');
select is((select enabled from public.payment_method_settings where provider = 'wave'), true, 'Wave actif comme avant');
select throws_ok($$ update public.payment_method_settings set manual_verification = false where provider = 'wave' $$, '23514', null,
  'la vérification manuelle ne peut pas être retirée sans API officielle');
select throws_ok($$ update public.payment_method_settings set merchant_link = 'http://exemple.test/x' where provider = 'orange_money' $$, '23514', null,
  'le lien marchand doit être en https');
select lives_ok($$ update public.payment_method_settings set merchant_link = 'https://pay.exemple.test/ohm', enabled = true where provider = 'orange_money' $$,
  'un lien https valide peut être enregistré');
select isnt((select updated_at from public.payment_method_settings where provider = 'orange_money'), null, 'date de dernière modification tenue');

-- Alertes : inscription, doublons, désinscription.
select is(public.batch_alert_subscribe('Test.Alerte@Exemple.TEST ', 'accueil', 'Je souhaite être prévenu(e) de la prochaine fournée.'), 'created', 'inscription créée');
select is(public.batch_alert_subscribe('test.alerte@exemple.test', 'fournees', 'Je souhaite être prévenu(e) de la prochaine fournée.'), 'already', 'doublon détecté (casse ignorée)');
select is((select count(*)::int from public.batch_alert_subscribers where lower(email) = 'test.alerte@exemple.test'), 1, 'une seule ligne par adresse');
select is((select source from public.batch_alert_subscribers where lower(email) = 'test.alerte@exemple.test'), 'accueil', 'source du consentement conservée');
select throws_ok($$ insert into public.batch_alert_subscribers (email, source, consent_text) values ('pas-un-mail', 'accueil', 'Je souhaite être prévenu(e).') $$, '23514', null, 'adresse invalide refusée');

create temp table tok as select unsubscribe_token as t from public.batch_alert_subscribers where lower(email) = 'test.alerte@exemple.test';
select is(public.batch_alert_unsubscribe((select t from tok)), true, 'désinscription par lien personnel');
select is((select status from public.batch_alert_subscribers where lower(email) = 'test.alerte@exemple.test'), 'inactive', 'inscrit devenu inactif');
select is(public.batch_alert_unsubscribe((select t from tok)), true, 'désinscription répétée sans effet');
select is(public.batch_alert_unsubscribe('jeton-inconnu'), false, 'jeton inconnu : rien ne se passe');
select is(public.batch_alert_subscribe('test.alerte@exemple.test', 'accueil', 'Je souhaite être prévenu(e) de la prochaine fournée.'), 'reactivated', 'ré-inscription possible');

-- Déclenchement : explicite, une seule fois par fournée, jamais sans inscrit.
select public.batch_alert_subscribe('autre@exemple.test', 'pied_de_page', 'Je souhaite être prévenu(e) de la prochaine fournée.');
create temp table cy as select id from public.production_cycles where status = 'open' order by number limit 1;
select is((public.admin_trigger_batch_alert((select id from cy), null) ->> 'recipients')::int, 2, 'alerte déclenchée pour les 2 inscrits actifs');
select throws_ok($$ select public.admin_trigger_batch_alert((select id from cy), null) $$, 'P0001', 'ALERT_ALREADY_SENT', 'pas de double envoi pour la même fournée');
select is((select count(*)::int from public.claim_batch_alert_sends(10)), 2, 'les envois sont réservés une fois');
select is((select count(*)::int from public.claim_batch_alert_sends(10)), 0, 'une seconde réservation ne reprend rien');

reset role;
set local role anon;
select throws_ok($$ select * from public.batch_alert_subscribers $$, '42501', null, 'visiteur : liste des inscrits inaccessible');
select throws_ok($$ select public.admin_trigger_batch_alert('00000000-0000-4000-8000-000000000012', null) $$, '42501', null, 'visiteur : déclenchement interdit');

select * from finish();
rollback;
