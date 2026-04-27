-- ============================================================
-- INKA — Schéma PostgreSQL (Supabase)
-- Décision : zéro stockage image (covers/avatars génératifs)
--            audio Opus 128kbps VBR, compression en arrière-plan
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists pg_cron;


-- ── profiles ──────────────────────────────────────────────────────────────────
-- Pas d'avatar_id / avatar_url : avatars générés côté client (UserAvatar)

create table if not exists profiles (
  id            uuid        primary key references auth.users on delete cascade,
  username      text        not null unique,
  display_name  text        not null,
  bio           text,
  country       text,
  created_at    timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Lecture publique profils"
  on profiles for select using (true);

create policy "Mise à jour propre profil"
  on profiles for update using (auth.uid() = id);


-- ── sounds ────────────────────────────────────────────────────────────────────
-- Pas de cover_url : CoverArt génératif (title + artist)
-- Pas d'album_id : albums supprimés
-- Pipeline compression : status processing → ready | error
-- audio_url sert toujours le meilleur disponible

create table if not exists sounds (
  id                    uuid        primary key default uuid_generate_v4(),
  title                 text        not null,
  artist                text        not null,
  artists               text[]      not null default '{}',
  producer              text,
  genre                 text,
  country               text,
  year                  int,
  duration              int         not null default 0,
  lyrics                text,
  description           text,
  audio_url             text        not null,
  audio_url_original    text,
  uploaded_by           uuid        not null references profiles(id) on delete cascade,
  play_count            int         not null default 0,
  is_public             boolean     not null default true,
  -- Pipeline compression
  status                text        not null default 'processing' check (status in ('processing','ready','error')),
  compression_attempts  int         not null default 0,
  compressed_at         timestamptz,
  file_size_original    int,
  file_size_compressed  int,
  bitrate               int         default 128,
  audio_format          text        default 'opus',
  acoustid_fingerprint  text,
  storage_ref           uuid        references sounds(id) on delete set null,
  -- Enrichissement IA
  mood                  text,
  energy_level          int         check (energy_level between 1 and 10),
  themes                text[]      default '{}',
  similar_sounds        uuid[]      default '{}',
  youtube_url           text,
  created_at            timestamptz not null default now()
);

alter table sounds enable row level security;

create policy "Lecture publique sons"
  on sounds for select
  using (
    (is_public = true and status = 'ready')
    or auth.uid() = uploaded_by
  );

create policy "Upload son authentifié"
  on sounds for insert with check (auth.uid() = uploaded_by);

create policy "Modification son par propriétaire"
  on sounds for update using (auth.uid() = uploaded_by);

create policy "Suppression son par propriétaire"
  on sounds for delete using (auth.uid() = uploaded_by);


-- ── playlists ─────────────────────────────────────────────────────────────────
-- Pas de cover_url : CoverArt génératif depuis title + display_name créateur

create table if not exists playlists (
  id          uuid        primary key default uuid_generate_v4(),
  title       text        not null,
  description text,
  created_by  uuid        not null references profiles(id) on delete cascade,
  is_public   boolean     not null default false,
  created_at  timestamptz not null default now()
);

alter table playlists enable row level security;

create policy "Lecture playlists publiques ou propriétaire"
  on playlists for select using (is_public = true or auth.uid() = created_by);

create policy "Création playlist authentifiée"
  on playlists for insert with check (auth.uid() = created_by);

create policy "Modification playlist par propriétaire"
  on playlists for update using (auth.uid() = created_by);

create policy "Suppression playlist par propriétaire"
  on playlists for delete using (auth.uid() = created_by);


-- ── playlist_sounds ────────────────────────────────────────────────────────────

create table if not exists playlist_sounds (
  playlist_id uuid not null references playlists(id) on delete cascade,
  sound_id    uuid not null references sounds(id) on delete cascade,
  position    int  not null default 0,
  primary key (playlist_id, sound_id)
);

alter table playlist_sounds enable row level security;

create policy "Lecture playlist_sounds"
  on playlist_sounds for select using (true);

create policy "Gestion playlist_sounds par propriétaire"
  on playlist_sounds for all using (
    auth.uid() = (select created_by from playlists where id = playlist_id)
  );


-- ── reactions ─────────────────────────────────────────────────────────────────

create table if not exists reactions (
  id         uuid        primary key default uuid_generate_v4(),
  sound_id   uuid        not null references sounds(id) on delete cascade,
  user_id    uuid        not null references profiles(id) on delete cascade,
  emoji      text        not null check (emoji in ('fire','heart','sleep','pray')),
  created_at timestamptz not null default now(),
  unique (sound_id, user_id, emoji)
);

alter table reactions enable row level security;

create policy "Lecture réactions"
  on reactions for select using (true);

create policy "Ajout réaction authentifié"
  on reactions for insert with check (auth.uid() = user_id);

create policy "Suppression réaction par auteur"
  on reactions for delete using (auth.uid() = user_id);


-- ── shares ─────────────────────────────────────────────────────────────────────

create table if not exists shares (
  id          uuid        primary key default uuid_generate_v4(),
  from_user   uuid        not null references profiles(id) on delete cascade,
  to_user     uuid        not null references profiles(id) on delete cascade,
  sound_id    uuid        references sounds(id) on delete cascade,
  playlist_id uuid        references playlists(id) on delete cascade,
  message     text,
  is_read     boolean     not null default false,
  created_at  timestamptz not null default now(),
  check (sound_id is not null or playlist_id is not null)
);

alter table shares enable row level security;

create policy "Lecture partages destinataire ou expéditeur"
  on shares for select using (auth.uid() = to_user or auth.uid() = from_user);

create policy "Envoi partage authentifié"
  on shares for insert with check (auth.uid() = from_user);

create policy "Marquer lu par destinataire"
  on shares for update using (auth.uid() = to_user);


-- ── play_history ──────────────────────────────────────────────────────────────

create table if not exists play_history (
  id        uuid        primary key default uuid_generate_v4(),
  user_id   uuid        not null references profiles(id) on delete cascade,
  sound_id  uuid        not null references sounds(id) on delete cascade,
  played_at timestamptz not null default now()
);

alter table play_history enable row level security;

create policy "Lecture historique personnel"
  on play_history for select using (auth.uid() = user_id);

create policy "Ajout historique authentifié"
  on play_history for insert with check (auth.uid() = user_id);


-- ── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists idx_sounds_status_processing
  on sounds(status) where status = 'processing';

create index if not exists idx_sounds_acoustid
  on sounds(acoustid_fingerprint);

create index if not exists idx_sounds_storage_ref
  on sounds(storage_ref);

create index if not exists idx_sounds_uploaded_by
  on sounds(uploaded_by);

create index if not exists idx_sounds_created_at
  on sounds(created_at desc);

create index if not exists idx_sounds_play_count
  on sounds(play_count desc);

create index if not exists idx_sounds_genre
  on sounds(genre);

create index if not exists idx_playlist_sounds_playlist
  on playlist_sounds(playlist_id);

create index if not exists idx_reactions_sound
  on reactions(sound_id);

create index if not exists idx_shares_to_user
  on shares(to_user, is_read, created_at desc);

create index if not exists idx_play_history_user
  on play_history(user_id, played_at desc);


-- ── Fonction play_count ────────────────────────────────────────────────────────

create or replace function increment_play_count()
returns trigger language plpgsql as $$
begin
  update sounds set play_count = play_count + 1 where id = new.sound_id;
  return new;
end;
$$;

drop trigger if exists trg_increment_play_count on play_history;
create trigger trg_increment_play_count
  after insert on play_history
  for each row execute function increment_play_count();


-- ── Nettoyage automatique (pg_cron) — 3h00 UTC ──────────────────────────────

select cron.schedule(
  'inka-cleanup-history',
  '0 3 * * *',
  $$
    delete from play_history
    where played_at < now() - interval '90 days';
  $$
);

select cron.schedule(
  'inka-cleanup-shares',
  '0 3 * * *',
  $$
    delete from shares
    where is_read = true
      and created_at < now() - interval '180 days';
  $$
);

select cron.schedule(
  'inka-cleanup-error-sounds',
  '0 3 * * *',
  $$
    delete from sounds
    where status = 'error'
      and created_at < now() - interval '7 days';
  $$
);


-- ── Analytics view ────────────────────────────────────────────────────────────
-- Vue agrégée par utilisateur : uploads, écoutes totales, réactions reçues, moy. écoutes

create or replace view user_stats as
select
  p.id                                                          as user_id,
  p.username,
  p.display_name,
  count(distinct s.id)                                          as total_uploads,
  coalesce(sum(s.play_count), 0)                                as total_listens,
  coalesce(avg(s.play_count)::numeric(10,2), 0)                 as avg_listens_per_upload,
  count(distinct r.id)                                          as total_reactions_received,
  max(s.play_count)                                             as max_play_count
from profiles p
left join sounds s on s.uploaded_by = p.id and s.is_public = true and s.status = 'ready'
left join reactions r on r.sound_id = s.id
group by p.id, p.username, p.display_name;

-- Lecture publique de la vue analytics
create policy "Lecture user_stats publique"
  on user_stats for select using (true);


-- ── Index analytics ────────────────────────────────────────────────────────────

create index if not exists idx_sounds_uploaded_by_play_count
  on sounds(uploaded_by, play_count desc);

create index if not exists idx_sounds_uploaded_by_created_at
  on sounds(uploaded_by, created_at desc);

create index if not exists idx_reactions_sound_id_user_id
  on reactions(sound_id, user_id);


-- ── Storage bucket ─────────────────────────────────────────────────────────────
-- Bucket audio-files : accès privé, signed URLs 24h
-- Structure : audio-files/original/{id}  — fichier brut uploadé
--             audio-files/compressed/{id} — fichier Opus 128kbps post-compression
-- Pas de bucket cover-images (supprimé — covers génératifs)
--
-- À exécuter dans le dashboard Supabase Storage :
--   insert into storage.buckets (id, name, public)
--     values ('audio-files', 'audio-files', false);
--
-- Policy Storage lecture :
--   create policy "Lecture audio authentifié"
--     on storage.objects for select
--     using (bucket_id = 'audio-files' and auth.role() = 'authenticated');
--
-- Policy Storage upload :
--   create policy "Upload audio propriétaire"
--     on storage.objects for insert
--     with check (bucket_id = 'audio-files' and auth.uid()::text = (storage.foldername(name))[1]);

-- Genre index for fast filtering
CREATE INDEX IF NOT EXISTS idx_sounds_genre ON sounds(genre);
