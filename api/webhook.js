export default async function handler(req, res) {
    // 1. O Mercado Pago só avisa via POST
    if (req.method !== 'POST') return res.status(200).send("OK");

    // 2. SUPER CAPTURA DE ID (Cobre todas as variações do Mercado Pago)
    let paymentId = req.body?.data?.id || req.query?.["data.id"] || req.query?.id || req.body?.id;
    
    // Se ele enviar no formato 'resource' (ex: /v1/payments/123456789)
    if (!paymentId && req.body?.resource) {
        paymentId = req.body.resource.split('/').pop();
    }

    const TOKEN = process.env.MP_TOKEN;
    
    // 3. A SUA CHAVE DO FIREBASE
    const FB_KEY = "AIzaSyCGXtcoSinCR6Kn7nDNf4ITWCelYW1PKBQ";

    // Se a Vercel não achar a chave ou o MP não mandar o ID, paramos aqui
    if (!paymentId || !TOKEN) return res.status(200).send("Faltam dados");

    try {
        // 4. Confirma com o banco se o pagamento caiu mesmo (evita fraudes)
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { "Authorization": `Bearer ${TOKEN}` }
        });
        const mpData = await mpRes.json();

        // 5. Se estiver APROVADO, vamos ao Firebase dar a baixa
        if (mpData.status === "approved") {
            
            // Procura a fatura no Firebase COM A CHAVE DE ACESSO
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/sistema-agua-sao-luiz/databases/(default)/documents:runQuery?key=${FB_KEY}`;
            const payload = {
                structuredQuery: {
                    from: [{ collectionId: "faturas" }],
                    where: { fieldFilter: { field: { fieldPath: "pix_txid" }, op: "EQUAL", value: { stringValue: String(paymentId) } } },
                    limit: 1 // Para não procurar mais depois de encontrar a primeira
                }
            };

            const queryRes = await fetch(firestoreUrl, { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify(payload) 
            });
            const queryData = await queryRes.json();
            
            // 6. Achou a fatura! Substitui o status por 'pago'
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

    // 7. Devolve 200 OK para o Mercado Pago saber que não precisa avisar de novo
    return res.status(200).send("OK");
}
