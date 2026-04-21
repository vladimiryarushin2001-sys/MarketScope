-- Allow authenticated users to update their own request/run rows (RLS).
-- Needed to mark runs as error/cancelled or to repair status fields from client side.

-- client_requests: owner can update own rows
drop policy if exists "Users can update own requests" on public.client_requests;
create policy "Users can update own requests"
  on public.client_requests for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- analysis_runs: owner (via client_requests) can update own run rows
drop policy if exists "Users can update own runs" on public.analysis_runs;
create policy "Users can update own runs"
  on public.analysis_runs for update
  using (
    exists (
      select 1
      from public.client_requests cr
      where cr.id = analysis_runs.request_id
        and cr.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.client_requests cr
      where cr.id = analysis_runs.request_id
        and cr.user_id = auth.uid()
    )
  );

