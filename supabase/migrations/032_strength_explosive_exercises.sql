-- Ensure custom explosive exercises exist in strength_exercises.
-- These are non-calculated display-only rows (max exp, empty weight).

insert into public.strength_exercises
  (name, category, percent, related_to, percent_bw_used, equipment_used, rounding, note, video_url, image_url, active)
select
  'Box Squat Jump Sitting', 'Plyometric', 0, 'None', 0, 'Bodyweight', 1, 'Explosive', null, null, true
where not exists (
  select 1 from public.strength_exercises where name = 'Box Squat Jump Sitting'
);

insert into public.strength_exercises
  (name, category, percent, related_to, percent_bw_used, equipment_used, rounding, note, video_url, image_url, active)
select
  'Med Ball Throw SA Stand', 'Plyometric', 0, 'None', 0, 'Med Ball', 1, 'Explosive', null, null, true
where not exists (
  select 1 from public.strength_exercises where name = 'Med Ball Throw SA Stand'
);

insert into public.strength_exercises
  (name, category, percent, related_to, percent_bw_used, equipment_used, rounding, note, video_url, image_url, active)
select
  'Smith Machine Band', 'Plyometric', 0, 'None', 0, 'Smith Machine', 1, 'Explosive', null, null, true
where not exists (
  select 1 from public.strength_exercises where name = 'Smith Machine Band'
);

insert into public.strength_exercises
  (name, category, percent, related_to, percent_bw_used, equipment_used, rounding, note, video_url, image_url, active)
select
  'SL RDL Jump', 'Plyometric', 0, 'None', 0, 'Bodyweight', 1, 'Explosive', null, null, true
where not exists (
  select 1 from public.strength_exercises where name = 'SL RDL Jump'
);

