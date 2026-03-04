export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    const { valor, descricao, cpf, nome } = req.body;

    try {
        const respostaMP = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
                "Authorization": "Bearer APP_USR-eba78170-d746-4f52-aba5-1fad3d747573",
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
                    identification: {
                        type: "CPF",
                        number: String(cpf).replace(/\D/g, '')
                    }
                }
            })
        });

        const dadosPix = await respostaMP.json();

        if (dadosPix.status === "pending" || dadosPix.status === "created") {
            return res.status(200).json({
                sucesso: true,
                qrCodeBase64: dadosPix.point_of_interaction.transaction_data.qr_code_base64,
                copiaECola: dadosPix.point_of_interaction.transaction_data.qr_code,
                txid: dadosPix.id
            });
        } else {
            // MENSAGEM RASTREADORA PARA SABERMOS SE A VERCEL ATUALIZOU
            let erroReal = dadosPix.message || (dadosPix.cause && dadosPix.cause.length > 0 ? dadosPix.cause[0].description : "Erro Desconhecido");
            return res.status(400).json({ 
                sucesso: false, 
                detalhes: { message: "CÓDIGO NOVO: " + erroReal } 
            });
        }

    } catch (error) {
        return res.status(500).json({ sucesso: false, detalhes: { message: "Erro interno do servidor Vercel" } });
    }
}
