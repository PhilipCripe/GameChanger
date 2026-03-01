export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "Card payments not yet configured — add STRIPE_SECRET_KEY to activate",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  let gchAmount, email;
  try {
    ({ gchAmount, email } = await request.json());
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!gchAmount || gchAmount <= 0) {
    return Response.json({ error: "Invalid GCH amount" }, { status: 400 });
  }

  // $1 USD = 1 GCH; Stripe amounts are in cents
  const amountCents = Math.ceil(Number(gchAmount) * 100);

  const body = new URLSearchParams({
    amount: String(amountCents),
    currency: "usd",
    "metadata[gchAmount]": String(gchAmount),
    "metadata[email]": email || "",
  });

  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    return Response.json(
      { error: data.error?.message || "Stripe error" },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  return new Response(JSON.stringify({ clientSecret: data.client_secret }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
