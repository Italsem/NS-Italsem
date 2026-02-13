export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);

  // GET ALL CARDS
  if (request.method === "GET") {
    const { results } = await env.DB.prepare(
      "SELECT * FROM cards ORDER BY id DESC"
    ).all();

    return Response.json(results);
  }

  // CREATE CARD
  if (request.method === "POST") {
    const body = await request.json();
    const { card_last4, holder_name } = body;

    const status =
      holder_name === "CASSAFORTE" ? "available" : "assigned";

    await env.DB.prepare(
      "INSERT INTO cards (card_last4, holder_name, status) VALUES (?, ?, ?)"
    )
      .bind(card_last4, holder_name, status)
      .run();

    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
}
