-- Conservation : le cake à l'orange se garde jusqu'à une semaine, correctement emballé, au frais.
alter type public.storage_rule add value if not exists 'cool_wrapped_1w';
