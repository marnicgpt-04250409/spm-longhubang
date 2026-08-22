alter table public.questions add column if not exists answer_confirmed boolean not null default false;

-- Existing published questions were already reviewed before this safeguard was introduced.
update public.questions set answer_confirmed = true where status = 'published';
