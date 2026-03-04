export default async function handler(req, res) {
    // Apenas aceita avisos via POST do Mercado Pago
    if (req.method !== 'POST') return res.status(200).send("OK");

    const paymentId = req.body?.data?.id || req.query["data.id"];
    const TOKEN = process.env.MP_TOKEN;
    
    // A CHAVE QUE FALTAVA PARA O FIREBASE DEIXAR ATUALIZAR:
    const FB_KEY = "AIzaSyCGXtcoSinCR6Kn7nDNf4ITWCelYW1PKBQ";

    if (!paymentId || !TOKEN) return res.status(200).send("OK");

    try {
        // 1. Confere no Mercado Pago se o Pix realmente caiu na conta
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { "Authorization": `Bearer ${TOKEN}` }
        });
        const mpData = await mpRes.json();

        if (mpData.status === "approved") {
            // 2. Busca a fatura no Firebase COM A CHAVE DE ACESSO
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/sistema-agua-sao-luiz/databases/(default)/documents:runQuery?key=${FB_KEY}`;
            const payload = {
                structuredQuery: {
                    from: [{ collectionId: "faturas" }],
                    where: { fieldFilter: { field: { fieldPath: "pix_txid" }, op: "EQUAL", value: { stringValue: String(paymentId) } } }
                }
            };

            const queryRes = await fetch(firestoreUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const queryData = await queryRes.json();
            
            // 3. Atualiza a fatura para PAGO COM A CHAVE DE ACESSO
            if (queryData && queryData[0]?.document) {
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
    } catch (e) { console.error("Erro no Webhook:", e); }

    // Retorna OK para o Mercado Pago parar de avisar
    return res.status(200).send("OK");
}
