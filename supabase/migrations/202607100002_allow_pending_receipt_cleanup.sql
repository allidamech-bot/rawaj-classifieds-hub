-- Allow owners to clean up receipt objects inside their own pending request folder.
-- This supports compensation when DB attachment fails and cleanup of replaced receipts.

drop policy if exists "RAWAJ promotion receipt owner delete pending" on storage.objects;
create policy "RAWAJ promotion receipt owner delete pending"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'promotion-receipts'
  and auth.uid()::text = (storage.foldername(name))[1]
  and exists (
    select 1
    from public.listing_promotion_requests pr
    where pr.id::text = (storage.foldername(name))[2]
      and pr.requester_user_id = auth.uid()
      and pr.status = 'pending_review'
  )
);
