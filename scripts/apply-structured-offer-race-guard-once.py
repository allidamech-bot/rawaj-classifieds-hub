from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"marker missing in {path}: {old[:140]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


handler_path = "cloudflare/worker/src/listing-offers.ts"

replace_once(
    handler_path,
    '''    touchConversationStatement(env, conversation.id, timestamp),
    notificationStatement(env, {
      userId: recipient,
      type: `offer.${nextStatus}`,
      title: transitionTitle(nextStatus),
      body: transitionBody(nextStatus, conversation.listing_title),
      offer: nextOffer,
      timestamp,
    }),''',
    '''    touchConversationAfterTransitionStatement(
      env,
      conversation.id,
      current.id,
      requestId,
      timestamp,
    ),
    notificationAfterTransitionStatement(
      env,
      {
        userId: recipient,
        type: `offer.${nextStatus}`,
        title: transitionTitle(nextStatus),
        body: transitionBody(nextStatus, conversation.listing_title),
        offer: nextOffer,
        timestamp,
      },
      current.id,
      requestId,
      timestamp,
    ),''',
)

replace_once(
    handler_path,
    '''  const updated = await offerById(env, current.id);
  return updated ? json({ data: mapOffer(updated, auth.userId) }, 200, cors) : databaseError(cors);''',
    '''  const updated = await offerById(env, current.id);
  if (!updated) return databaseError(cors);
  if (updated.last_action_request_id !== requestId || updated.updated_at !== timestamp) {
    return staleWrite(cors);
  }
  return json({ data: mapOffer(updated, auth.userId) }, 200, cors);''',
)

replace_once(
    handler_path,
    '''    insertOfferStatement(env, counter),
    touchConversationStatement(env, conversation.id, timestamp),
    notificationStatement(env, {
      userId: recipient,
      type: "offer.countered",
      title: "وصل عرض مضاد",
      body: `لديك عرض مضاد على ${conversation.listing_title}.`,
      offer: counter,
      timestamp,
    }),''',
    '''    insertCounterOfferStatement(env, counter, current.id, requestId, timestamp),
    touchConversationAfterTransitionStatement(
      env,
      conversation.id,
      current.id,
      requestId,
      timestamp,
    ),
    notificationAfterTransitionStatement(
      env,
      {
        userId: recipient,
        type: "offer.countered",
        title: "وصل عرض مضاد",
        body: `لديك عرض مضاد على ${conversation.listing_title}.`,
        offer: counter,
        timestamp,
      },
      current.id,
      requestId,
      timestamp,
    ),''',
)

replace_once(
    handler_path,
    '''  if (results.some((result) => !result.success)) return databaseError(cors);
  return json({ data: mapOffer(counter, actorId) }, 201, cors);
}

async function mutationReadiness''',
    '''  if (results.some((result) => !result.success)) return databaseError(cors);
  const created = await offerByRequest(env, actorId, requestId);
  if (!created) return staleWrite(cors);
  return json({ data: mapOffer(created, actorId) }, 201, cors);
}

async function mutationReadiness''',
)

insert_marker = '''function touchConversationStatement(
  env: ListingOffersEnv,
  conversationId: string,
  timestamp: string,
) {'''
helpers = '''function insertCounterOfferStatement(
  env: ListingOffersEnv,
  offer: OfferRow,
  sourceOfferId: string,
  requestId: string,
  transitionTimestamp: string,
) {
  return env.DB.prepare(
    `INSERT INTO listing_price_offers
     (id, listing_id, conversation_id, buyer_id, seller_id, created_by,
      parent_offer_id, amount, currency, status, expires_at, responded_at,
      client_request_id, last_action_request_id, created_at, updated_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE EXISTS (
       SELECT 1 FROM listing_price_offers
       WHERE id = ? AND status = 'countered'
         AND last_action_request_id = ? AND updated_at = ?
     )`,
  ).bind(
    offer.id,
    offer.listing_id,
    offer.conversation_id,
    offer.buyer_id,
    offer.seller_id,
    offer.created_by,
    offer.parent_offer_id,
    offer.amount,
    offer.currency,
    offer.status,
    offer.expires_at,
    offer.responded_at,
    offer.client_request_id,
    offer.last_action_request_id,
    offer.created_at,
    offer.updated_at,
    sourceOfferId,
    requestId,
    transitionTimestamp,
  );
}

function touchConversationAfterTransitionStatement(
  env: ListingOffersEnv,
  conversationId: string,
  sourceOfferId: string,
  requestId: string,
  transitionTimestamp: string,
) {
  return env.DB.prepare(
    `UPDATE conversations SET last_message_at = ?, updated_at = ?
     WHERE id = ? AND EXISTS (
       SELECT 1 FROM listing_price_offers
       WHERE id = ? AND last_action_request_id = ? AND updated_at = ?
     )`,
  ).bind(
    transitionTimestamp,
    transitionTimestamp,
    conversationId,
    sourceOfferId,
    requestId,
    transitionTimestamp,
  );
}

'''
file = Path(handler_path)
text = file.read_text(encoding="utf-8")
if insert_marker not in text:
    raise SystemExit("helper insertion marker missing")
file.write_text(text.replace(insert_marker, helpers + insert_marker, 1), encoding="utf-8")

notification_marker = '''function mapOffer(row: OfferRow, userId: string) {'''
notification_helper = '''function notificationAfterTransitionStatement(
  env: ListingOffersEnv,
  input: {
    userId: string;
    type: string;
    title: string;
    body: string;
    offer: OfferRow;
    timestamp: string;
  },
  sourceOfferId: string,
  requestId: string,
  transitionTimestamp: string,
) {
  return env.DB.prepare(
    `INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?
     WHERE EXISTS (
       SELECT 1 FROM listing_price_offers
       WHERE id = ? AND last_action_request_id = ? AND updated_at = ?
     )`,
  ).bind(
    crypto.randomUUID(),
    input.userId,
    input.type,
    input.title,
    input.body,
    JSON.stringify({
      targetType: "conversation",
      targetId: input.offer.conversation_id,
      conversationId: input.offer.conversation_id,
      listingId: input.offer.listing_id,
      offerId: input.offer.id,
      amount: input.offer.amount,
      currency: input.offer.currency,
      status: input.offer.status,
    }),
    input.timestamp,
    sourceOfferId,
    requestId,
    transitionTimestamp,
  );
}

'''
file = Path(handler_path)
text = file.read_text(encoding="utf-8")
if notification_marker not in text:
    raise SystemExit("notification helper marker missing")
file.write_text(text.replace(notification_marker, notification_helper + notification_marker, 1), encoding="utf-8")

replace_once(
    handler_path,
    '''function databaseError(cors: Headers) {''',
    '''function staleWrite(cors: Headers) {
  return json(
    { error: { code: "stale_write", message: "The offer changed. Refresh and try again." } },
    409,
    cors,
  );
}

function databaseError(cors: Headers) {''',
)

contract = Path("scripts/structured-listing-price-offers-v1.test.mjs")
contract_text = contract.read_text(encoding="utf-8")
contract_marker = '''  assert.match(handler, /Only the sender can withdraw/);
});'''
contract_replacement = '''  assert.match(handler, /Only the sender can withdraw/);
  assert.match(handler, /insertCounterOfferStatement/);
  assert.match(handler, /notificationAfterTransitionStatement/);
  assert.match(handler, /touchConversationAfterTransitionStatement/);
  assert.match(handler, /WHERE EXISTS/);
  assert.match(handler, /updated\\.last_action_request_id !== requestId/);
  assert.match(handler, /const created = await offerByRequest/);
});'''
if contract_marker not in contract_text:
    raise SystemExit("contract race-guard marker missing")
contract.write_text(contract_text.replace(contract_marker, contract_replacement, 1), encoding="utf-8")
