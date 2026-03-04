export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ sucesso: false, detalhes: { message: 'Apenas POST' } });

    const { valor, descricao, cpf, nome } = req.body;
    const TOKEN = process.env.MP_TOKEN;

    if (!TOKEN) return res.status(500).json({ sucesso: false, detalhes: { message: 'Chave MP_TOKEN não configurada na Vercel.' } });

    try {
        const respostaMP = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + TOKEN,
                "Content-Type": "application/json",
                "X-Idempotency-Key": "pix-v10-" + Date.now()
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
                // AQUI ESTÁ A PEÇA QUE FALTAVA: O ENDEREÇO DE AVISO!
                notification_url: "https://agua-sao-luiz.vercel.app/api/webhook"
            })
        });

        const data = await respostaMP.json();

        if (data.status === "pending" || data.status === "created") {
            return res.status(200).json({
                sucesso: true,
                qrCodeBase64: data.point_of_interaction.transaction_data.qr_code_base64,
                copiaECola: data.point_of_interaction.transaction_data.qr_code,
                txid: data.id
            });
        } else {
            return res.status(400).json({ sucesso: false, detalhes: data });
        }
    } catch (error) {
        return res.status(500).json({ sucesso: false, detalhes: { message: error.message } });
    }
}
