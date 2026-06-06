-- Community Events Feature Tables

-- Community Events Table
create table community_events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  event_date date not null,
  event_time time not null,
  location text not null,
  organizer text,
  category text check (category in ('festival', 'meeting', 'class', 'celebration', 'maintenance', 'other')),
  is_recurring boolean default false,
  recurrence_pattern text, -- e.g., 'weekly', 'monthly'
  max_participants integer,
  current_participants integer default 0,
  status text not null default 'scheduled' check (status in ('scheduled', 'ongoing', 'completed', 'cancelled')),
  created_at timestamp with time zone default now(),
  created_by text,
  updated_at timestamp with time zone default now()
);

-- Event Reminders Table
create table event_reminders (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references community_events(id) on delete cascade not null,
  phone text not null,
  reminder_time timestamp with time zone not null,
  is_sent boolean default false,
  created_at timestamp with time zone default now(),
  unique(event_id, phone)
);

-- Event RSVPs Table (optional - for tracking who's attending)
create table event_rsvps (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references community_events(id) on delete cascade not null,
  phone text not null,
  name text,
  status text not null default 'going' check (status in ('going', 'maybe', 'not_going')),
  guests_count integer default 1,
  created_at timestamp with time zone default now(),
  unique(event_id, phone)
);

-- Indexes for performance
create index idx_events_date on community_events(event_date);
create index idx_events_status on community_events(status);
create index idx_reminders_time on event_reminders(reminder_time);
create index idx_reminders_sent on event_reminders(is_sent);
create index idx_rsvps_event on event_rsvps(event_id);

-- Enable Realtime
alter publication supabase_realtime add table community_events;
alter publication supabase_realtime add table event_reminders;
alter publication supabase_realtime add table event_rsvps;

-- Insert sample events (from knowledge base)
insert into community_events (title, description, event_date, event_time, location, organizer, category, status) values
('Republic Day Celebration', 'Flag hoisting ceremony followed by cultural program', '2026-01-26', '08:00:00', 'Community Hall', 'Association Committee', 'festival', 'scheduled'),
('Holi Celebration', 'Community Holi celebration with organic colors', '2026-03-14', '10:00:00', 'Garden Area', 'Cultural Committee', 'festival', 'scheduled'),
('Independence Day', 'Flag hoisting and patriotic program', '2026-08-15', '08:00:00', 'Community Hall', 'Association Committee', 'festival', 'scheduled'),
('Diwali Celebration', 'Community Diwali celebration with diyas and rangoli competition', '2026-10-24', '18:00:00', 'Garden Area', 'Cultural Committee', 'festival', 'scheduled'),
('New Year Party', 'New Years Eve party with music, dance, and refreshments', '2026-12-31', '20:00:00', 'Community Hall', 'Social Committee', 'celebration', 'scheduled'),
('Monthly GM Meeting', 'General body meeting - 2nd Sunday', '2026-07-13', '17:00:00', 'Community Hall', 'Association', 'meeting', 'scheduled'),
('Yoga Classes', 'Monday, Wednesday, Friday morning yoga', '2026-06-09', '06:30:00', 'Garden Area', 'Yoga Instructor', 'class', 'scheduled'),
('Zumba Classes', 'Tuesday, Thursday, Saturday evening zumba', '2026-06-10', '18:00:00', 'Community Hall', 'Zumba Instructor', 'class', 'scheduled');

-- Function to automatically update updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_events_updated_at before update on community_events
for each row execute function update_updated_at_column();
