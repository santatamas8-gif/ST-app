-- Custom reps-only exercises (no % / weight on card — coach edits reps only).
-- Idempotent: insert only when the exact name is missing.

insert into public.strength_exercises
  (name, category, percent, related_to, percent_bw_used, equipment_used, rounding, note, video_url, image_url, active)
select
  'Inverted Row', 'Pull', 0, 'None', 0, 'Bodyweight', 1, 'Reps only', null, null, true
where not exists (
  select 1 from public.strength_exercises where name = 'Inverted Row'
);

insert into public.strength_exercises
  (name, category, percent, related_to, percent_bw_used, equipment_used, rounding, note, video_url, image_url, active)
select
  'Band Pallof Press', 'Core', 0, 'None', 0, 'Band', 1, 'Reps only', null, null, true
where not exists (
  select 1 from public.strength_exercises where name = 'Band Pallof Press'
);

insert into public.strength_exercises
  (name, category, percent, related_to, percent_bw_used, equipment_used, rounding, note, video_url, image_url, active)
select
  'Kettlebell Swing', 'Kettlebell', 0, 'None', 0, 'Kettlebell', 1, 'Reps only', null, null, true
where not exists (
  select 1 from public.strength_exercises where name = 'Kettlebell Swing'
);
