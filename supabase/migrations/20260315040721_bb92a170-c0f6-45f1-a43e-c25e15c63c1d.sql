
-- Drop and recreate foreign keys with ON DELETE SET NULL for departments
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_department_id_fkey;
ALTER TABLE public.units ADD CONSTRAINT units_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.units ALTER COLUMN department_id DROP NOT NULL;

ALTER TABLE public.officers DROP CONSTRAINT IF EXISTS officers_department_id_fkey;
ALTER TABLE public.officers ADD CONSTRAINT officers_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_department_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

ALTER TABLE public.pv DROP CONSTRAINT IF EXISTS pv_department_id_fkey;
ALTER TABLE public.pv ADD CONSTRAINT pv_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
