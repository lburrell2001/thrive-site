-- Feedback on drafts (074): the client likes or dislikes each draft and can
-- comment on it, so Lauren knows which versions they want.

alter table portal_files
  add column if not exists reaction text check (reaction in ('like', 'dislike')),
  add column if not exists reaction_at timestamptz;

create table if not exists portal_file_comments (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references portal_files(id) on delete cascade,
  client_id uuid not null references portal_clients(id) on delete cascade,
  author text not null default 'client' check (author in ('client', 'admin')),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists portal_file_comments_file on portal_file_comments (file_id, created_at);

-- Server routes only (vault pattern): RLS on, no policies.
alter table portal_file_comments enable row level security;
