-- Lien de paiement marchand Wave (sans API) : confirmé à la main par OHMEGATO.
alter type public.payment_provider add value if not exists 'wave_link';
