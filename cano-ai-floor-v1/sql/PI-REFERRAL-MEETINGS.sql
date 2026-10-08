-- ============================================================================
-- CANO LAW FIRM · PI REFERRAL MEETING INTELLIGENCE
-- Calendly → Orbit → Titan Calendar → Meeting Brief
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.pi_referral_meetings (
  id uuid primary key default gen_random_uuid(),

  referral_prospect_id uuid null
    references public.pi_referral_prospects(id)
    on delete set null,

  calendly_event_uri text not null,
  calendly_invitee_uri text not null unique,
  calendly_event_type_uri text null,

  invitee_name text not null default '',
  invitee_email text not null default '',
  invitee_phone text not null default '',

  organization_name text not null default '',
  website text not null default '',
  practice_areas text[] not null default '{}'::text[],

  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'America/New_York',

  status text not null default 'booked'
    check (
      status in (
        'booked',
        'conflict',
        'canceled',
        'completed',
        'needs_review'
      )
    ),

  calendar_status text not null default 'pending'
    check (
      calendar_status in (
        'pending',
        'checking',
        'created',
        'conflict',
        'error',
        'not_configured',
        'canceled'
      )
    ),

  titan_event_uid text null,
  titan_event_url text null,

  conflict_detected boolean not null default false,
  conflict_events jsonb not null default '[]'::jsonb,
  alternative_slots jsonb not null default '[]'::jsonb,

  conflict_email_subject text not null default '',
  conflict_email_body text not null default '',
  conflict_outreach_event_id uuid null,

  brief jsonb not null default '{}'::jsonb,
  source_payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists
  pi_referral_meetings_start_idx
on public.pi_referral_meetings(start_at);

create index if not exists
  pi_referral_meetings_prospect_idx
on public.pi_referral_meetings(referral_prospect_id);

create index if not exists
  pi_referral_meetings_status_idx
on public.pi_referral_meetings(status, start_at);

create index if not exists
  pi_referral_meetings_conflict_idx
on public.pi_referral_meetings(conflict_detected, start_at);

comment on table public.pi_referral_meetings is
  'Cano PI referral meetings booked through Calendly and coordinated by Orbit with Titan calendar conflict control and AI pre-call intelligence.';
