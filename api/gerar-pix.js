export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

    const { valor, descricao, cpf, nome } = req.body;
    
    // ⚠️ COLOQUE SEU ACCESS TOKEN DO MERCADO PAGO AQUI:
    const TOKEN = "APP_USR-2580827848136768-030318-b6bdef0c84cf3c2d64774dcd8a687e17-155547253"; 

    try {
        const respostaMP = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + TOKEN,
                "Content-Type": "application/json",
                "X-Idempotency-Key": "pix-" + Date.now()
            },
            body: JSON.stringify({
                transaction_amount: Number(valor),
                description: descricao,
                payment_method_id: "pix",
                payer: {
                    email: "morador@distritosaoluiz.com.br",
                    first_name: nome,
                    identification: { type: "CPF", number: String(cpf).replace(/\D/g, '') }
                },
                // MÁGICA 1: Avisa o Mercado Pago para nos ligar quando pagarem!
                notification_url: "https://agua-sao-luiz.vercel.app/api/webhook"
            })
        });

        const dadosPix = await respostaMP.json();

        if (dadosPix.status === "pending" || dadosPix.status === "created") {
            return res.status(200).json({
                sucesso: true,
                qrCodeBase64: dadosPix.point_of_interaction.transaction_data.qr_code_base64,
                copiaECola: dadosPix.point_of_interaction.transaction_data.qr_code,
                txid: String(dadosPix.id) // O RG dessa transação
            });
        } else {
            return res.status(400).json({ sucesso: false, detalhes: dadosPix });
        }
    } catch (error) {
        return res.status(500).json({ sucesso: false });
    }
}
