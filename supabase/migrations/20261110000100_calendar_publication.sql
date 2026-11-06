-- Adds opt-in school publication and stable modification timestamps for public calendar subscriptions.
alter table public.schools add column schedule_published boolean not null default false;

-- The existing schools update policy permits only the owning AD or a site admin.
-- No public access to the underlying schedule or staff tables is added.
grant update (schedule_published) on public.schools to authenticated;

alter table public.games add column updated_at timestamptz not null default statement_timestamp();

create function shore_private.touch_game_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;
revoke all on function shore_private.touch_game_updated_at() from public, anon, authenticated;

create trigger games_updated_at before update on public.games
for each row execute function shore_private.touch_game_updated_at();

-- A transportation-only change also needs a new timestamp and sequence for existing subscribers.
create function shore_private.touch_transport_game()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.games set revision = revision + 1
  where id = coalesce(new.game_id, old.game_id);
  return null;
end;
$$;
revoke all on function shore_private.touch_transport_game() from public, anon, authenticated;

create trigger transportation_game_updated after insert or update or delete on public.transportation
for each row execute function shore_private.touch_transport_game();
