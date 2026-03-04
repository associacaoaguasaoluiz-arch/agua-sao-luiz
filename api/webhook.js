export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send("OK");

    // SUPER CAPTURA DE ID (Não falha nunca)
    let paymentId = req.body?.data?.id || req.query?.["data.id"] || req.query?.id;
    if (!paymentId && req.body?.resource) {
        paymentId = req.body.resource.split('/').pop();
    }

    const TOKEN = process.env.MP_TOKEN;
    const FB_KEY = "AIzaSyCGXtcoSinCR6Kn7nDNf4ITWCelYW1PKBQ";

    if (!paymentId || !TOKEN) return res.status(200).send("Faltam dados");

    try {
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { "Authorization": `Bearer ${TOKEN}` }
        });
        const mpData = await mpRes.json();

        if (mpData.status === "approved") {
            
            // Busca Fatura no Firebase
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/sistema-agua-sao-luiz/databases/(default)/documents:runQuery?key=${FB_KEY}`;
            const payload = {
                structuredQuery: {
                    from: [{ collectionId: "faturas" }],
                    where: { fieldFilter: { field: { fieldPath: "pix_txid" }, op: "EQUAL", value: { stringValue: String(paymentId) } } },
                    limit: 1
                }
            };

            const queryRes = await fetch(firestoreUrl, { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify(payload) 
            });
            const queryData = await queryRes.json();
            
            // Dá a baixa para Pago
            if (queryData && queryData[0] && queryData[0].document) {
                const docPath = queryData[0].document.name;
                const updateUrl = `https://firestore.googleapis.com/v1/${docPath}?updateMask=status&updateMask=data_pagamento&key=${FB_KEY}`;
                
                await fetch(updateUrl, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        fields: {
                            status: { stringValue: "pago" },
                            data_pagamento: { stringValue: new Date().toISOString() }
                        }
                    })
                });
            }
        }
    } catch (e) { 
        console.error("Erro no Webhook:", e); 
    }

    return res.status(200).send("OK");
}
