-- Add skills_other column to profiles table if it doesn't exist
do $$
begin
  if not exists (select 1 from information_schema.columns 
                where table_schema = 'public' 
                and table_name = 'profiles' 
                and column_name = 'skills_other') then
    alter table public.profiles
    add column skills_other text;
    
    comment on column public.profiles.skills_other is 'Custom skills input when ''other'' is selected in skills';
  end if;
end $$;
