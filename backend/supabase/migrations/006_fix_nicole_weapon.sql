-- Nicole is a Catalyst user, not Sword.
UPDATE public.game_characters
SET weapon = 'Catalyst'
WHERE id = 'nicole' AND weapon IS DISTINCT FROM 'Catalyst';
