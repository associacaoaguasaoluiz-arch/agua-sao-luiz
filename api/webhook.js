export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send("OK");

    const paymentId = req.body?.data?.id || req.query["data.id"];
    if (!paymentId) return res.status(200).send("OK");

    // 🔒 Puxa do cofre da Vercel
    const TOKEN = process.env.MP_TOKEN; 
    if (!TOKEN) return res.status(200).send("OK");

    try {
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { "Authorization": `Bearer ${TOKEN}` }
        });
        const mpData = await mpRes.json();

        if (mpData.status === "approved") {
            const queryUrl = `https://firestore.googleapis.com/v1/projects/sistema-agua-sao-luiz/databases/(default)/documents:runQuery`;
            const queryPayload = {
                structuredQuery: {
                    from: [{ collectionId: "faturas" }],
                    where: { fieldFilter: { field: { fieldPath: "pix_txid" }, op: "EQUAL", value: { stringValue: String(paymentId) } } }
                }
            };

            const queryRes = await fetch(queryUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(queryPayload) });
            const queryData = await queryRes.json();
            
            if (queryData && queryData[0] && queryData[0].document) {
                const docPath = queryData[0].document.name; 
                const updateUrl = `https://firestore.googleapis.com/v1/${docPath}?updateMask=status&updateMask=data_pagamento`;
                const updatePayload = {
                    fields: {
                        status: { stringValue: "pago" },
                        data_pagamento: { stringValue: new Date().toISOString() }
                    }
                };
                await fetch(updateUrl, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatePayload) });
            }
        }
    } catch (error) {
        console.error("Erro no Webhook:", error);
    }

    return res.status(200).send("OK");
}
