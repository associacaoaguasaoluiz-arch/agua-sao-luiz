export default async function handler(req, res) {
    // 1. Só permite que o nosso sistema chame essa função (método POST)
    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    // 2. Recebe os dados do morador que vieram do nosso HTML
    const { valor, descricao, cpf, nome } = req.body;

    // 3. Sua chave secreta do Mercado Pago
    const TOKEN = "APP_USR-eba78170-d746-4f52-aba5-1fad3d747573";

    try {
        // 4. Faz o pedido de criação do Pix para o servidor do Mercado Pago
        const respostaMP = await fetch("https://api.mercadopago.com/v1/payments", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${TOKEN}`,
                "Content-Type": "application/json",
                // O X-Idempotency-Key evita que o mesmo Pix seja gerado duplicado por acidente
                "X-Idempotency-Key": Math.random().toString(36).substring(7) + Date.now() 
            },
            body: JSON.stringify({
                transaction_amount: Number(valor),
                description: descricao,
                payment_method_id: "pix",
                payer: {
                    email: "morador@distritosaoluiz.com.br", // O MP exige um e-mail, usamos um genérico
                    first_name: nome,
                    identification: {
                        type: "CPF",
                        number: cpf
                    }
                }
            })
        });

        const dadosPix = await respostaMP.json();

        // 5. Se o Mercado Pago criou com sucesso, devolvemos o QR Code para a tela!
        if (dadosPix.status === "pending" || dadosPix.status === "created") {
            return res.status(200).json({
                sucesso: true,
                qrCodeBase64: dadosPix.point_of_interaction.transaction_data.qr_code_base64,
                copiaECola: dadosPix.point_of_interaction.transaction_data.qr_code,
                txid: dadosPix.id // ID da transação para darmos baixa automática depois
            });
        } else {
            // Se deu erro no MP (ex: CPF inválido), avisamos a tela
            return res.status(400).json({ sucesso: false, erro: "Erro ao gerar PIX", detalhes: dadosPix });
        }

    } catch (error) {
        console.error("Erro interno:", error);
        return res.status(500).json({ sucesso: false, erro: "Erro interno no servidor Vercel" });
    }
}
