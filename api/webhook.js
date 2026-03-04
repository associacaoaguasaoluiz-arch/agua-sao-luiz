export default async function handler(req, res) {
if (req.method !== 'POST') return res.status(200).send("OK");

console.log("=== 🔍 WEBHOOK INICIADO ===");
console.log("Pacote recebido do MP:", JSON.stringify(req.body));

let paymentId = req.body?.data?.id || req.query?.["data.id"] || req.query?.id;
if (!paymentId && req.body?.resource) {
    paymentId = req.body.resource.split('/').pop();
}

console.log("ID Capturado:", paymentId);

const TOKEN = process.env.MP_TOKEN;
const FB_KEY = "AIzaSyCGXtcoSinCR6Kn7nDNf4ITWCelYW1PKBQ";

if (!paymentId || !TOKEN) {
    console.log("❌ PAROU: Faltou o ID ou a chave MP_TOKEN na Vercel.");
    return res.status(200).send("Faltam dados");
}

try {
    console.log("A consultar o Mercado Pago para confirmar o pagamento...");
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    const mpData = await mpRes.json();
    
    console.log("Status oficial no Banco:", mpData.status);

    if (mpData.status === "approved") {
        console.log("✅ Pagamento APROVADO! A procurar fatura no Firebase...");
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/sistema-agua-sao-luiz/databases/(default)/documents:runQuery?key=${FB_KEY}`;
        const payload = {
            structuredQuery: {
                from: [{ collectionId: "faturas" }],
                where: { fieldFilter: { field: { fieldPath: "pix_txid" }, op: "EQUAL", value: { stringValue: String(paymentId) } } },
                limit: 1
            }
        };

        const queryRes = await fetch(firestoreUrl, { 
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) 
        });
        const queryData = await queryRes.json();
        
        if (queryData && queryData[0] && queryData[0].document) {
            const docPath = queryData[0].document.name;
            console.log("Fatura encontrada! A atualizar para PAGO no Firebase...");
            
            const updateUrl = `https://firestore.googleapis.com/v1/${docPath}?updateMask=status&updateMask=data_pagamento&key=${FB_KEY}`;
            
            const patchRes = await fetch(updateUrl, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fields: {
                        status: { stringValue: "pago" },
                        data_pagamento: { stringValue: new Date().toISOString() }
                    }
                })
            });
            
            const patchData = await patchRes.json();
            console.log("✅ Resultado final do Firebase:", patchData.error ? patchData.error : "Sucesso Total!");
        } else {
            console.log("⚠️ ALERTA: Nenhuma fatura encontrada no Firebase com o ID de Pix:", paymentId);
        }
    } else {
        console.log("⏳ O pagamento ainda não consta como 'approved'. Status atual:", mpData.status);
    }
} catch (e) { 
    console.error("❌ Erro grave no código:", e); 
}

console.log("=== 🏁 WEBHOOK FINALIZADO ===");
return res.status(200).send("OK");
}
