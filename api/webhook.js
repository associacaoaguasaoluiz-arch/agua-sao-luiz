export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send("OK");

    // O Mercado Pago avisa qual foi o ID do pagamento que acabou de cair
    const paymentId = req.body?.data?.id || req.query["data.id"];
    if (!paymentId) return res.status(200).send("OK");

    // ⚠️ COLOQUE SEU ACCESS TOKEN DO MERCADO PAGO AQUI TAMBÉM:
    const TOKEN = "COLOQUE_SEU_TOKEN_AQUI"; 

    try {
        // 1. Pergunta pro MP se esse pagamento é real e se foi aprovado
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { "Authorization": `Bearer ${TOKEN}` }
        });
        const mpData = await mpRes.json();

        // 2. Se o dinheiro realmente caiu na conta
        if (mpData.status === "approved") {
            
            // 3. Procura no nosso Firebase qual é a Fatura que tem esse ID do Mercado Pago
            const queryUrl = `https://firestore.googleapis.com/v1/projects/sistema-agua-sao-luiz/databases/(default)/documents:runQuery`;
            const queryPayload = {
                structuredQuery: {
                    from: [{ collectionId: "faturas" }],
                    where: { fieldFilter: { field: { fieldPath: "pix_txid" }, op: "EQUAL", value: { stringValue: String(paymentId) } } }
                }
            };

            const queryRes = await fetch(queryUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(queryPayload) });
            const queryData = await queryRes.json();
            
            // 4. Se encontrou a fatura, muda o status dela para "pago"
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
        console.error("Erro no processamento do Webhook:", error);
    }

    // Retorna OK pro Mercado Pago parar de ligar
    return res.status(200).send("OK");
}
