-- Features: Maintenance Tickets, Notice Board, Services, Polls

create table tickets (
  id uuid default gen_random_uuid() primary key,
  phone text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamp with time zone default now()
);

create table notices (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  created_at timestamp with time zone default now()
);

create table services (
  id uuid default gen_random_uuid() primary key,
  category text not null,
  name text not null,
  contact text not null,
  created_at timestamp with time zone default now()
);

create table polls (
  id uuid default gen_random_uuid() primary key,
  question text not null,
  options jsonb not null, -- e.g. ["Option A", "Option B"]
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table poll_votes (
  id uuid default gen_random_uuid() primary key,
  poll_id uuid references polls(id) on delete cascade not null,
  phone text not null,
  vote text not null,
  created_at timestamp with time zone default now(),
  unique(poll_id, phone) -- One vote per user per poll
);

-- Enable Realtime for all tables (optional, useful for admin dashboard later)
alter publication supabase_realtime add table tickets;
alter publication supabase_realtime add table notices;
alter publication supabase_realtime add table services;
alter publication supabase_realtime add table polls;
alter publication supabase_realtime add table poll_votes;

-- Insert some mock data for testing
insert into notices (title, content) values
('Water Supply Interruption', 'There will be no water supply on 10th June from 10 AM to 2 PM due to tank cleaning.'),
('Association Meeting', 'Monthly General Body meeting on 15th June, 5 PM at Community Hall.');

insert into services (category, name, contact) values
('Plumber', 'Ramesh', '9876543210'),
('Plumber', 'Suresh', '9876543211'),
('Electrician', 'Mani', '9876543212');

insert into polls (question, options) values
('Should we paint the club house Blue or Green?', '["Blue", "Green"]'),
('What time should the new Zumba class be?', '["Morning 7 AM", "Evening 6 PM"]');
