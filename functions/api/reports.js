export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "GET") {
    const cardId = Number(new URL(request.url).searchParams.get("cardId"));
    if (!cardId) return Response.json({ reports: [] });

    const row = await env.DB.prepare("SELECT reports_json FROM expense_reports WHERE card_id = ?")
      .bind(cardId)
      .first();

    if (!row?.reports_json) return Response.json({ reports: [] });

    try {
      return Response.json({ reports: JSON.parse(row.reports_json) });
    } catch {
      return Response.json({ reports: [] });
    }
  }

  if (request.method === "PUT") {
    const body = await request.json();
    const cardId = Number(body.cardId);
    const reports = Array.isArray(body.reports) ? body.reports : [];

    if (!cardId) return Response.json({ success: false }, { status: 400 });

    await env.DB.prepare(
      `INSERT INTO expense_reports (card_id, reports_json, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(card_id) DO UPDATE SET reports_json = excluded.reports_json, updated_at = datetime('now')`,
    )
      .bind(cardId, JSON.stringify(reports))
      .run();

    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
}
